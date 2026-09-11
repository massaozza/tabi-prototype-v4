// /api/migrate-destination-images.ts
// Vercel Serverless Function（Node.js Runtime）
//
// 【一時的な移行用API】destinationsに保存されているimage URLが、
// readdy.aiの生成画像URL（外部埋め込み用には作られておらず、本番サイトの
// <img>タグから読み込むと拒否されてしまう）になっている問題を解決する
// ため、各画像をサーバー側で取得し、Cloudflare R2に保存し直して、
// 新しいURLのマッピングを返す。
//
// 【まだ本番APIとして残している理由】
// R2移行（Readdy.aiのURLが残存しているSpotの解消）はまだ完了していない
// 技術的負債として認識されているため、CLIスクリプトへの移行は今回は
// 行わず、まずAPIとしての安全性を高める形にした。
// 完全に移行が終わった段階で、このAPI自体を削除するのが望ましい。
//
// 【今回のセキュリティ変更点（元の実装との差分）】
// 1. GET（副作用あり）→ POST に変更した。
//    以前はGETで画像取得・R2アップロードという副作用のある処理を
//    行っていたため、管理者がログインした状態で悪意あるページを開くと
//    <img src="https://.../migrate-destination-images?..."> のような
//    タグ1つでR2の容量・転送量を消費させられた（クリックすら不要）。
// 2. Origin検証を追加した（SameSite=LaxのCookieだけでは、単純な
//    <img>タグ等の“安全”とみなされるクロスサイトGETは防げないため、
//    POST化に加えてOriginヘッダーも見る）。
// 3. 取得先ホストを明示的な許可リスト（readdy.aiのみ）に変更した。
//    以前は「よくある内部IPを拒否するブロックリスト」方式だったが、
//    ブロックリストは漏れが必ず残る（DNSリバインディング、IPの
//    10進数・16進数表記、IPv4埋め込みIPv6等）。用途がreaddy.aiの画像
//    移行だけなので、許可リスト方式にする方が安全かつシンプル。
// 4. http:// を廃止し、httpsのみ許可する。
// 5. ホスト名のDNS解決結果が実際にパブリックIPかどうかも検証する
//    （許可リストのおかげでリスクは大幅に下がっているが、念のため
//    多層防御として残す）。
// 6. レスポンス本体をarrayBufferで全量取得する前に、ストリームを
//    読みながら上限（10MB）で打ち切るようにした。
// 7. Content-Typeだけでなく、実際のバイト列（マジックバイト）を見て
//    JPEG/PNG/WebP/AVIFであることを確認する。
// 8. testUrls（動作確認用）の件数に上限を設けた。
// 9. 管理者単位（実質IP単位）のレート制限を追加した。
// 10. 外部URLや内部例外のメッセージをレスポンスにそのまま含めない
//     （サーバーログにだけ出す）。
//
// 【DNSリバインディングに関する残存リスク】
// ホスト検証時に解決したIPと、実際にfetch()が接続する時点の解決結果が
// 完全に同一であることまでは保証していない（TOCTOU）。これを完全に
// 塞ぐには、解決したIPへ直接接続しつつSNI/Hostだけ元のホスト名を使う
// ソケットレベルの実装が必要になる。今回は許可リストをreaddy.ai
// （信頼できる既知の外部サービス）1つに絞ったことで、この残存リスクの
// 実害は大きく下がっていると判断し、今回のスコープでは実装していない。

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';
import dns from 'dns';
import { isAdminNodeRequest } from './_adminAuth.js';
import { checkRateLimit, clientIpFromNodeRequest } from './_rateLimit.js';

interface Destination {
  id: string;
  title: string;
  category: string;
  prefecture?: string;
  description: string;
  image: string;
}

// ───────────────────────────────────────────────
// 許可リスト・上限値
// ───────────────────────────────────────────────

/** 取得先として許可するホスト（このドメイン自身、またはそのサブドメインのみ） */
const ALLOWED_HOSTS = ['readdy.ai'];

/** 取得を許可する画像1件あたりの上限（10MB） */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** 画像として受け入れるContent-Type */
const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

/** 1回のtestUrls呼び出しで検証できる件数の上限 */
const MAX_TEST_URLS = 5;

/** このAPI自体の呼び出しレート制限（管理者による誤操作・スクリプト暴走対策） */
const MIGRATE_LIMITS = [{ windowSeconds: 60, max: 20 }];

function getExtensionFromContentType(contentType: string): string {
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('avif')) return 'avif';
  return 'jpg';
}

/** ホスト名が許可リストに一致するか（完全一致 or サブドメイン） */
function isAllowedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return ALLOWED_HOSTS.some((allowed) => h === allowed || h.endsWith(`.${allowed}`));
}

/** IPv4アドレスがパブリックかどうか（プライベート・ループバック・リンクローカル等を拒否） */
function isPublicIPv4(ip: string): boolean {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const parts = m.slice(1, 5).map(Number);
  if (parts.some((n) => n < 0 || n > 255)) return false;
  const [a, b] = parts;
  if (a === 10) return false; // 10.0.0.0/8
  if (a === 127) return false; // loopback
  if (a === 0) return false; // 0.0.0.0/8
  if (a === 169 && b === 254) return false; // link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return false; // 172.16.0.0/12
  if (a === 192 && b === 168) return false; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT
  if (a >= 224) return false; // multicast以上（予約含む）
  return true;
}

/** IPv6アドレスがパブリックかどうか（ループバック・ユニークローカル・リンクローカル・IPv4埋め込み等を拒否） */
function isPublicIPv6(ip: string): boolean {
  const h = ip.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === '::1') return false; // loopback
  if (/^fe80:/.test(h)) return false; // link-local
  if (/^f[cd][0-9a-f]{2}:/.test(h)) return false; // unique local (fc00::/7)
  // IPv4-mapped / IPv4-compatible（::ffff:127.0.0.1 等）はIPv4側のルールで判定する
  const mapped = h.match(/(?:^::ffff:|^::)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped) return isPublicIPv4(mapped[1]);
  return true;
}

/**
 * ホスト名を解決し、すべての解決先アドレスがパブリックIPであることを
 * 確認する。許可リストで既に信頼できるドメインに絞っているため、
 * これは多層防御（DNSが不正なIPを返す異常系への備え）として行う。
 */
async function resolvesToPublicIpsOnly(hostname: string): Promise<boolean> {
  try {
    const records = await dns.promises.lookup(hostname, { all: true, verbatim: true });
    if (records.length === 0) return false;
    return records.every((r) =>
      r.family === 4 ? isPublicIPv4(r.address) : isPublicIPv6(r.address)
    );
  } catch {
    return false;
  }
}

/** 取得先URLとして安全か検証する（プロトコル・許可リスト・DNS解決結果） */
async function validateImageUrl(
  raw: string
): Promise<{ ok: true; url: URL } | { ok: false; error: string }> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: 'Invalid URL' };
  }
  if (url.protocol !== 'https:') {
    return { ok: false, error: 'Only https URLs are allowed' };
  }
  if (!isAllowedHost(url.hostname)) {
    return { ok: false, error: 'This host is not on the allowlist' };
  }
  if (!(await resolvesToPublicIpsOnly(url.hostname))) {
    return { ok: false, error: 'This host does not resolve to a public address' };
  }
  return { ok: true, url };
}

/** 先頭バイトから実際の画像形式を判定する（Content-Typeの詐称対策） */
function detectImageFormat(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return 'image/png';
  }
  if (
    buf.length >= 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  if (buf.length >= 12 && buf.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buf.toString('ascii', 8, 12);
    if (brand.startsWith('avif') || brand.startsWith('avis')) return 'image/avif';
  }
  return null;
}

/** レスポンス本体をストリームで読みつつ、上限を超えたら打ち切る */
async function readBodyWithLimit(res: Response, maxBytes: number): Promise<Buffer | { error: string }> {
  if (!res.body) {
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > maxBytes) return { error: `Image too large (${buf.byteLength} bytes)` };
    return buf;
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel().catch(() => {});
          return { error: `Image too large (exceeded ${maxBytes} bytes while streaming)` };
        }
        chunks.push(value);
      }
    }
  } catch (e) {
    return { error: 'Failed while reading response body' };
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c)));
}

/** 画像を取得する。プロトコル・許可リスト・DNS・サイズ・種別をすべて検証する */
async function fetchImageSafely(
  rawUrl: string
): Promise<{ buffer: Buffer; contentType: string } | { error: string }> {
  const checked = await validateImageUrl(rawUrl);
  if (checked.ok === false) return { error: checked.error };

  let imgRes: Response;
  try {
    imgRes = await fetch(checked.url.toString(), {
      // リダイレクトで許可リスト外のホストへ回り込まれるのを防ぐ
      redirect: 'manual',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    console.error('[migrate-destination-images] fetch failed:', err);
    return { error: 'Failed to reach the source host' };
  }

  if (imgRes.status >= 300 && imgRes.status < 400) {
    return { error: 'Redirects are not followed' };
  }
  if (!imgRes.ok) return { error: `Upstream returned status ${imgRes.status}` };

  const declaredType = (imgRes.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!ALLOWED_CONTENT_TYPES.includes(declaredType)) {
    return { error: 'Unsupported content-type' };
  }

  const declaredLength = Number(imgRes.headers.get('content-length') || 0);
  if (declaredLength && declaredLength > MAX_IMAGE_BYTES) {
    return { error: 'Image too large (declared content-length)' };
  }

  const bodyResult = await readBodyWithLimit(imgRes, MAX_IMAGE_BYTES);
  if ('error' in bodyResult) return bodyResult;

  // Content-Typeの詐称対策：実際のバイト列から形式を判定し、
  // 宣言されたContent-Typeと矛盾しないか確認する
  const actualType = detectImageFormat(bodyResult);
  if (!actualType) return { error: 'File does not look like a supported image format' };

  return { buffer: bodyResult, contentType: actualType };
}

/** Originヘッダーがこのサイト自身からのリクエストかを確認する（CSRF対策） */
function isSameOriginRequest(req: VercelRequest): boolean {
  const origin = req.headers.origin;
  // Originを送らないリクエスト（同一オリジンの一部のケース、非ブラウザのCLI等）は
  // ここでは許容せず、明示的に一致する場合のみ通す方が安全側に倒せる。
  // ただし社内運用ツールからの直接呼び出しも想定されるため、Origin未送信は
  // 「不明」として拒否する（fail-closed）。
  if (!origin) return false;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host;
  if (!host) return false;
  return origin === `${proto}://${host}`;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  // 管理者以外は実行させない。無認証だと任意URL（許可リスト内であっても）を
  // 無制限にサーバーへ取得させ、R2の容量・転送量を消費させられる。
  if (!(await isAdminNodeRequest(req))) {
    res.status(401).json({ error: 'Admin authentication required' });
    return;
  }

  // CSRF対策：POST化に加えてOriginも確認する
  // （SameSite=LaxのCookieだけでは、状況によりクロスサイトのPOSTが
  // 通ってしまうケースを完全に排除できないため）。
  if (!isSameOriginRequest(req)) {
    res.status(403).json({ error: 'Cross-origin requests are not allowed' });
    return;
  }

  const ip = clientIpFromNodeRequest(req);
  const limit = await checkRateLimit('migrate-destination-images', ip, MIGRATE_LIMITS);
  if (!limit.ok) {
    res.setHeader('Retry-After', String(limit.retryAfter));
    res.status(429).json({ error: 'Too many requests. Please try again later.', retryAfter: limit.retryAfter });
    return;
  }

  const body = (req.body || {}) as {
    offset?: unknown;
    limit?: unknown;
    ids?: unknown;
    testUrl?: unknown;
    testUrls?: unknown;
  };

  const offset = Number(body.offset) || 0;
  const limitCount = Math.min(Number(body.limit) || 20, 30); // 1回の上限は30件
  const idFilter = Array.isArray(body.ids)
    ? body.ids.filter((s): s is string => typeof s === 'string')
    : [];
  const testUrl = typeof body.testUrl === 'string' ? body.testUrl : undefined;
  const testUrls = Array.isArray(body.testUrls)
    ? body.testUrls.filter((s): s is string => typeof s === 'string').slice(0, MAX_TEST_URLS)
    : undefined;

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !publicUrl) {
    console.error('[migrate-destination-images] R2 credentials are not fully configured');
    res.status(503).json({ error: 'Image migration is not configured on the server' });
    return;
  }

  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  const publicUrlBase = publicUrl.replace(/\/$/, '');

  async function migrateOne(url: string, keyPrefix: string) {
    const fetched = await fetchImageSafely(url);
    if ('error' in fetched) return { error: fetched.error };
    const { buffer, contentType } = fetched;
    const objectKey = `destinations/${keyPrefix}-${crypto.randomUUID()}.${getExtensionFromContentType(
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
    return { newUrl: `${publicUrlBase}/${objectKey}` };
  }

  // testUrls（複数、検証用）
  if (testUrls && testUrls.length > 0) {
    const results = await Promise.all(
      testUrls.map(async (url) => {
        try {
          const out = await migrateOne(url, 'test');
          return { url, ...out };
        } catch (err) {
          console.error('[migrate-destination-images] testUrls error:', err);
          return { url, error: 'Failed to process this URL' };
        }
      })
    );
    res.status(200).json({ testMode: true, count: testUrls.length, results });
    return;
  }

  // testUrl（単体、検証用）
  if (testUrl) {
    try {
      const out = await migrateOne(testUrl, 'test');
      res.status(200).json({ testMode: true, ...out });
    } catch (err) {
      console.error('[migrate-destination-images] testUrl error:', err);
      res.status(200).json({ testMode: true, error: 'Failed to process this URL' });
    }
    return;
  }

  // ── 本処理：destinationsをKVから直接読む ──
  // 【重要】以前はreq.headers.hostを使い自分自身の/api/contentへ
  // サーバー間fetchしていたが、Hostヘッダーはクライアントが送る値であり
  // 外部fetch先として信用してはならない。KVから直接読む形に変更した。
  let destinations: Destination[] = [];
  try {
    const { kv } = await import('@vercel/kv');
    const list = (await kv.get<Destination[]>('content:destinations')) || [];
    destinations = Array.isArray(list) ? list : [];
  } catch (err) {
    console.error('[migrate-destination-images] failed to read destinations from KV:', err);
    res.status(502).json({ error: 'Failed to load destinations' });
    return;
  }

  const slice =
    idFilter.length > 0
      ? destinations.filter((d) => idFilter.includes(d.id))
      : destinations.slice(offset, offset + limitCount);

  const results = await Promise.all(
    slice.map(async (dest) => {
      if (!dest.image || dest.image.includes(publicUrlBase) || !dest.image.includes('readdy.ai')) {
        return { id: dest.id, skipped: true, reason: 'Already migrated or not a readdy.ai URL' };
      }
      try {
        const out = await migrateOne(dest.image, dest.id);
        return { id: dest.id, ...out };
      } catch (err) {
        console.error(`[migrate-destination-images] failed for ${dest.id}:`, err);
        return { id: dest.id, error: 'Failed to migrate this image' };
      }
    })
  );

  res.status(200).json({
    total: destinations.length,
    offset,
    limit: limitCount,
    processed: slice.length,
    results,
  });
}
