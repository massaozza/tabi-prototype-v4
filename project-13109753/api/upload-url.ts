// /api/upload-url.ts
// Vercel Serverless Function（Node.js Runtime）
// Experience投稿用の写真を、ブラウザからCloudflare R2へ直接アップロードするための
// 「署名付きURL（Presigned URL）」を発行するAPI。
//
// なぜ直接アップロードにするか：
// - Vercelの関数には1リクエストあたりのデータサイズに上限があり、
//   写真をそのままこのAPI経由で送ろうとすると失敗するリスクがある
// - 署名付きURLを使えば、ブラウザからR2へ直接アップロードでき、
//   Vercel側の関数はURLの発行だけを担当すればよい
//
// 認証必須：ログインしていないユーザーはアップロードできない
// （session Cookieを見て、有効なセッションが無ければ拒否する）

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';

const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

interface SessionRecord {
  uid: string;
  createdAt: string;
}

function getCookie(req: VercelRequest, name: string): string | null {
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function getAuthenticatedUid(req: VercelRequest): Promise<string | null> {
  const token = getCookie(req, 'session');
  if (!token) return null;
  try {
    const session = await kv.get<SessionRecord>(`session:${token}`);
    return session?.uid ?? null;
  } catch {
    return null;
  }
}

function getExtension(contentType: string): string {
  switch (contentType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/heic':
      return 'heic';
    default:
      return 'bin';
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const uid = await getAuthenticatedUid(req);
  if (!uid) {
    res.status(401).json({ error: 'You must be logged in to upload photos' });
    return;
  }

  const body: { contentType?: string; fileSize?: number } = req.body || {};
  const contentType = body.contentType || '';
  const fileSize = typeof body.fileSize === 'number' ? body.fileSize : 0;

  if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
    res.status(400).json({
      error: `Unsupported file type. Allowed types: ${ALLOWED_CONTENT_TYPES.join(', ')}`,
    });
    return;
  }

  if (fileSize <= 0 || fileSize > MAX_FILE_SIZE_BYTES) {
    res.status(400).json({
      error: `File size must be between 1 byte and ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB`,
    });
    return;
  }

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

  const objectKey = `experiences/${uid}/${crypto.randomUUID()}.${getExtension(contentType)}`;

  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
      ContentType: contentType,
      ContentLength: fileSize,
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 }); // 5分間有効
    const publicUrlBase = publicUrl.replace(/\/$/, '');

    res.status(200).json({
      uploadUrl,
      objectKey,
      publicUrl: `${publicUrlBase}/${objectKey}`,
    });
  } catch (err) {
    res.status(500).json({
      error: 'Failed to generate upload URL',
      detail: String(err),
    });
  }
}
