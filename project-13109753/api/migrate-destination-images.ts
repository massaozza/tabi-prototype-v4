// /api/migrate-destination-images.ts
// Vercel Serverless Function（Node.js Runtime）
// 【一時的な移行用API】homeData.ts / KVに保存されているdestinationsの
// image URLが、readdy.aiの生成画像URL（外部埋め込み用には作られておらず、
// 本番サイトの<img>タグから読み込むと拒否されてしまう）になっている問題を
// 解決するため、各画像をサーバー側で取得し、Cloudflare R2に保存し直して、
// 新しいURLのマッピングを返す。
//
// 【重要】このファイルは自己完結型にしてある（api/内の他ファイルからも、
// src/内のファイルからもimportしない）。Vercelのビルド環境では、
// api/配下のNode.js Runtimeファイルが他ファイルをimportすると、
// 実行時に "Cannot find module" のようなエラーでクラッシュすることがある。
// そのため、destinationsデータは /api/content?type=destinations を
// サーバー間通信で呼び出して取得する（すでに動作確認済みのAPIのため安全）。
//
// 【重要】readdy.aiの画像サーバーは、リクエスト元（Referer）を見て
// ブラウザからの読み込みを拒否するが、サーバー間通信であれば問題なく
// 取得できるため、この移行処理はサーバー側（Vercel Functions）で行う。
//
// 使い方：
// GET /api/migrate-destination-images?offset=0&limit=20
//   → offset番目からlimit件だけ処理する
// GET /api/migrate-destination-images?testUrl=(URLエンコードした1件のURL)
//   → homeData.tsとは関係なく、そのURL1件だけをテストする
// GET /api/migrate-destination-images?testUrls=(URLエンコードしたURLをパイプ|区切りで複数)
//   → 複数件を一度にテストする（検証用）
//
// 認証は不要（開発者が手動でこのURLを叩く一時的な移行ツールのため）。

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';
import { isAdminNodeRequest } from './_adminAuth.js';

interface Destination {
  id: string;
  title: string;
  category: string;
  prefecture?: string;
  description: string;
  image: string;
}

function getExtensionFromContentType(contentType: string): string {
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  return 'jpg';
}

// ───────────────────────────────────────────────
// SSRF・リソース枯渇への対策
//
// このAPIは「指定されたURLをサーバーが取得してR2に保存する」動きをする。
// 無認証・無制限のままだと次の悪用が可能だった：
//   - 社内ネットワークやクラウドのメタデータ（169.254.169.254）への到達
//   - 巨大ファイルを掴ませてメモリを枯渇させる
//   - 第三者にR2の保存容量と転送量を消費させる
// そこで、管理者認証に加えて以下の制限を設ける。
// ───────────────────────────────────────────────

/** 取得を許可する画像1件あたりの上限（10MB） */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** 画像として受け入れるContent-Type */
const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

/** プライベート・ループバック・リンクローカル等の宛先を拒否する */
function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();

  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.internal')) return true;

  // IPv6のループバック・ユニークローカル
  if (h === '::1' || h === '[::1]') return true;
  if (/^\[?f[cd][0-9a-f]{2}:/i.test(h)) return true;

  // IPv4
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10) return true;                       // 10.0.0.0/8
    if (a === 127) return true;                      // ループバック
    if (a === 0) return true;                        // 0.0.0.0/8
    if (a === 169 && b === 254) return true;         // リンクローカル（クラウドメタデータ）
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true;         // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true;                       // マルチキャスト以上
  }
  return false;
}

/** 取得先URLとして安全か検証する */
function validateImageUrl(raw: string): { ok: true; url: URL } | { ok: false; error: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: 'Invalid URL' };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, error: 'Only http(s) URLs are allowed' };
  }
  if (isBlockedHost(url.hostname)) {
    return { ok: false, error: 'This host is not allowed' };
  }
  return { ok: true, url };
}

/** 画像を取得する。サイズ・種別を検証し、上限を超えたら中断する */
async function fetchImageSafely(
  rawUrl: string
): Promise<{ buffer: Buffer; contentType: string } | { error: string }> {
  const checked = validateImageUrl(rawUrl);
  if (checked.ok === false) return { error: checked.error };

  let imgRes: Response;
  try {
    imgRes = await fetch(checked.url.toString(), {
      // リダイレクトで内部ホストへ回り込まれるのを防ぐ
      redirect: 'manual',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
    });
  } catch (err) {
    return { error: String(err) };
  }

  if (imgRes.status >= 300 && imgRes.status < 400) {
    return { error: 'Redirects are not followed' };
  }
  if (!imgRes.ok) return { error: `status ${imgRes.status}` };

  const contentType = (imgRes.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
    return { error: `Unsupported content-type: ${contentType || 'unknown'}` };
  }

  const declared = Number(imgRes.headers.get('content-length') || 0);
  if (declared && declared > MAX_IMAGE_BYTES) {
    return { error: `Image too large (${declared} bytes)` };
  }

  const buffer = Buffer.from(await imgRes.arrayBuffer());
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    return { error: `Image too large (${buffer.byteLength} bytes)` };
  }

  return { buffer, contentType };
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // 管理者以外は実行させない。無認証だと任意URLをサーバーに取得させられる
  if (!(await isAdminNodeRequest(req))) {
    res.status(401).json({ error: 'Admin authentication required' });
    return;
  }

  const offset = Number(req.query.offset) || 0;
  const limit = Math.min(Number(req.query.limit) || 20, 30); // 1回の上限は30件
  const idsParam = (req.query.ids as string) || '';
  const idFilter = idsParam.split(',').map((s) => s.trim()).filter(Boolean);
  const testUrl = req.query.testUrl as string | undefined;
  const testUrlsParam = req.query.testUrls as string | undefined;

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !publicUrl) {
    res.status(500).json({ error: 'Server misconfigured: R2 credentials are not set' });
    return;
  }

  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  const publicUrlBase = publicUrl.replace(/\/$/, '');

  // testUrls（複数、パイプ区切り）が指定されている場合は、それぞれを
  // その場でテストする（動作検証用）
  if (testUrlsParam) {
    const urls = testUrlsParam.split('|').map((u) => decodeURIComponent(u.trim())).filter(Boolean);
    const results = await Promise.all(
      urls.map(async (url) => {
        try {
          const fetched = await fetchImageSafely(url);
          if ('error' in fetched) {
            return { url, error: fetched.error };
          }
          const { buffer, contentType } = fetched;
          const objectKey = `destinations/test-${crypto.randomUUID()}.${getExtensionFromContentType(
            contentType
          )}`;
          await s3.send(
            new PutObjectCommand({
              Bucket: bucketName,
              Key: objectKey,
              Body: buffer,
              ContentType: contentType,
            })
          );
          return { url, newUrl: `${publicUrlBase}/${objectKey}` };
        } catch (err) {
          return { url, error: String(err) };
        }
      })
    );
    res.status(200).json({ testMode: true, count: urls.length, results });
    return;
  }

  // testUrl が指定されている場合は、homeData.tsの内容とは関係なく、
  // そのURL1件だけをその場でテストする（動作検証用）
  if (testUrl) {
    try {
      const fetched = await fetchImageSafely(decodeURIComponent(testUrl));
      if ('error' in fetched) {
        res.status(200).json({
          testMode: true,
          error: `Failed to fetch source image: ${fetched.error}`,
        });
        return;
      }
      const { buffer, contentType } = fetched;
      const objectKey = `destinations/test-${crypto.randomUUID()}.${getExtensionFromContentType(
        contentType
      )}`;
      await s3.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: objectKey,
          Body: buffer,
          ContentType: contentType,
        })
      );
      res.status(200).json({ testMode: true, newUrl: `${publicUrlBase}/${objectKey}` });
    } catch (err) {
      res.status(200).json({ testMode: true, error: String(err) });
    }
    return;
  }

  let destinations: Destination[] = [];
  try {
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host;
    const contentRes = await fetch(`${proto}://${host}/api/content?type=destinations`);
    if (!contentRes.ok) {
      res.status(502).json({ error: 'Failed to fetch destinations from /api/content' });
      return;
    }
    const contentJson = await contentRes.json();
    destinations = Array.isArray(contentJson?.data) ? contentJson.data : [];
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch destinations', detail: String(err) });
    return;
  }

  // idsが指定されていれば、それを優先して絞り込む（offset/limitは無視する）
  const slice =
    idFilter.length > 0
      ? destinations.filter((d) => idFilter.includes(d.id))
      : destinations.slice(offset, offset + limit);

  const results = await Promise.all(
    slice.map(async (dest) => {
      if (dest.image.includes(publicUrlBase) || !dest.image.includes('readdy.ai')) {
        return { id: dest.id, skipped: true, reason: 'Already migrated or not a readdy.ai URL' };
      }
      try {
        const fetched = await fetchImageSafely(dest.image);
        if ('error' in fetched) {
          return { id: dest.id, error: `Failed to fetch source image: ${fetched.error}` };
        }
        const { buffer, contentType } = fetched;

        const objectKey = `destinations/${dest.id}-${crypto.randomUUID()}.${getExtensionFromContentType(
          contentType
        )}`;

        await s3.send(
          new PutObjectCommand({
            Bucket: bucketName,
            Key: objectKey,
            Body: buffer,
            ContentType: contentType,
          })
        );

        return { id: dest.id, newUrl: `${publicUrlBase}/${objectKey}` };
      } catch (err) {
        return { id: dest.id, error: String(err) };
      }
    })
  );

  res.status(200).json({
    total: destinations.length,
    offset,
    limit,
    processed: slice.length,
    results,
  });
}
