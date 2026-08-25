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
//   → 一度に大量に処理するとVercelの実行時間制限に達する可能性があるため、
//     20件程度ずつ、offsetを増やして繰り返し呼び出すことを推奨する
//   → レスポンスで { total, processed, results: [{ id, newUrl } ...] } を返す
//
// 認証は不要（開発者が手動でこのURLを叩く一時的な移行ツールのため）。

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';

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

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const offset = Number(req.query.offset) || 0;
  const limit = Math.min(Number(req.query.limit) || 20, 30); // 1回の上限は30件

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

  const slice = destinations.slice(offset, offset + limit);

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

  const results = await Promise.all(
    slice.map(async (dest) => {
      if (dest.image.includes(publicUrlBase) || !dest.image.includes('readdy.ai')) {
        return { id: dest.id, skipped: true, reason: 'Already migrated or not a readdy.ai URL' };
      }
      try {
        const imgRes = await fetch(dest.image, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
          },
        });
        if (!imgRes.ok) {
          return { id: dest.id, error: `Failed to fetch source image (status ${imgRes.status})` };
        }
        const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
        const buffer = Buffer.from(await imgRes.arrayBuffer());

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
