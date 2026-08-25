// /api/migrate-destination-images.ts
// Vercel Serverless Function（Node.js Runtime）
// 【一時的な移行用API】homeData.ts / KVに保存されているdestinationsの
// image URLが、readdy.aiの生成画像URL（外部埋め込み用には作られておらず、
// 本番サイトの<img>タグから読み込むと拒否されてしまう）になっている問題を
// 解決するため、各画像をサーバー側で取得し、Cloudflare R2に保存し直して、
// 新しいURLのマッピングを返す。
//
// 【重要】この処理はサーバー側（Vercel Functions）で行う必要がある。
// readdy.aiの画像サーバーは、リクエスト元（Referer）を見て拒否するため、
// ブラウザから直接読み込むことはできないが、サーバー間通信であれば
// 問題なく取得できる。
//
// 使い方：
// GET /api/migrate-destination-images?offset=0&limit=20
//   → 現在のdestinationsデータ（/api/content?type=destinations と同じ
//     データソース）を取得し、offset番目からlimit件だけ処理する
//   → 一度に大量に処理するとVercelの実行時間制限に達する可能性があるため、
//     20件程度ずつ、offsetを増やして繰り返し呼び出すことを推奨する
//   → レスポンスで { total, processed, results: [{ id, newUrl } ...] } を返す
//
// 認証は不要（開発者が手動でこのURLを叩く一時的な移行ツールのため）。

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';
import { destinations as fallbackDestinations } from '../src/mocks/homeData';

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

  // content.ts と同じ考え方：KVに保存済みのデータがあればそれを使い、
  // 無ければ homeData.ts のフォールバックを使う
  let destinations: Destination[] = fallbackDestinations as Destination[];
  try {
    const kvData = await kv.get<Destination[]>('content:destinations');
    if (kvData) destinations = kvData;
  } catch {
    // KV取得失敗時はフォールバックのまま
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
      // すでにR2（自社ドメイン）の画像になっている場合はスキップする
      if (dest.image.includes(publicUrlBase) || !dest.image.includes('readdy.ai')) {
        return { id: dest.id, skipped: true, reason: 'Already migrated or not a readdy.ai URL' };
      }
      try {
        const imgRes = await fetch(dest.image);
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
