// /api/guides.ts
// Vercel Serverless Function（Node.js Runtime）
// TABI 2.0：日本人クリエイターによる「ローカル知識」投稿（GUIDE）の
// 投稿・一覧取得・削除を扱うAPI。
//
// 【重要】このVercelプロジェクトのNode.js Runtimeでは、api/配下の別ファイルを
// importすると "Cannot find module" で落ちることが判明しているため、
// experiences.ts / trips.ts と同様、このファイルも自己完結させている。
//
// GUIDEの思想（TABI 2.0事業戦略書 4-2章）：
// 日本人クリエイターは日本語で、Spot単位の短いコメント・Local Tipを投稿する。
// TABI AIが翻訳・Localizationを担うことで、英語で発信するハードルを下げる。
//
// 保存方式：experiences.ts と同じ「1レコード＝1キー」＋KVのSet型索引。
//
// GET  /api/guides                → 公開済み（translationStatus='translated'）の
//                                    GUIDEを取得（認証不要）
// GET  /api/guides?mine=1         → 自分が投稿したGUIDE（翻訳中も含む全件）を取得
// GET  /api/guides?spotId=xxx     → 指定したSPOTを含むGUIDEのみ取得
// POST /api/guides                → 新規投稿（認証必須、投稿直後に翻訳を実行）
// DELETE /api/guides?id=xxx       → 削除（認証必須、本人の投稿のみ）

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';
import crypto from 'crypto';

const COLLECTION = 'guides';

export interface GuideSpot {
  spotId?: string; // 既存SPOT（destinations）と紐づく場合はそのid
  googlePlaceId?: string; // Google Places APIの place_id（同一場所の名寄せに使う不変の識別子）
  address?: string; // Google Places APIから取得した住所（参考情報）
  name: string; // 紐づかない新規スポットの場合、直接名前を記載
  commentJa: string;
  commentEn?: string;
  localTip?: string;
  bestTime?: string;
  priceHint?: string;
}

export interface Guide {
  id: string;
  uid: string;
  authorName: string;
  createdAt: string;

  authorIsLocalExpert: boolean;
  authorExpertiseArea?: string;

  title: string;
  theme: string;
  area: string;
  season?: string;

  bodyJa: string;
  bodyEn?: string;
  translationStatus: 'pending' | 'translated' | 'failed';

  spots: GuideSpot[];
  photos: string[];
  published: boolean;
}

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

function recordKey(id: string): string {
  return `${COLLECTION}:${id}`;
}

function collectionIndexKey(): string {
  return `${COLLECTION}:all`;
}

function userIndexKey(uid: string): string {
  return `user:${uid}:${COLLECTION}`;
}

function spotGuidesIndexKey(spotId: string): string {
  return `spot:${spotId}:guides`;
}

async function createGuideRecord(id: string, data: Guide, uid: string): Promise<void> {
  await kv.set(recordKey(id), data);
  await kv.sadd(collectionIndexKey(), id);
  await kv.sadd(userIndexKey(uid), id);
  // このGUIDEが紐づく各SPOTのインデックスにも追加する
  // （SPOT詳細ページで「このSpotを含むGuide」を高速に表示するため）
  const spotIds = data.spots.map((s) => s.spotId).filter((s): s is string => !!s);
  await Promise.all(spotIds.map((spotId) => kv.sadd(spotGuidesIndexKey(spotId), id)));
}

async function getGuideRecord(id: string): Promise<Guide | null> {
  const value = await kv.get<Guide>(recordKey(id));
  return value ?? null;
}

async function updateGuideRecord(id: string, data: Guide): Promise<void> {
  await kv.set(recordKey(id), data);
}

async function deleteGuideRecord(id: string, uid: string, spotIds: string[]): Promise<void> {
  await kv.del(recordKey(id));
  await kv.srem(collectionIndexKey(), id);
  await kv.srem(userIndexKey(uid), id);
  await Promise.all(spotIds.map((spotId) => kv.srem(spotGuidesIndexKey(spotId), id)));
}

async function listAllGuides(): Promise<Guide[]> {
  const ids = await kv.smembers(collectionIndexKey());
  if (!ids || ids.length === 0) return [];
  const values = await kv.mget<Guide[]>(...ids.map((id) => recordKey(id)));
  return (values || []).filter((v): v is Guide => v !== null && v !== undefined);
}

async function listUserGuides(uid: string): Promise<Guide[]> {
  const ids = await kv.smembers(userIndexKey(uid));
  if (!ids || ids.length === 0) return [];
  const values = await kv.mget<Guide[]>(...ids.map((id) => recordKey(id)));
  return (values || []).filter((v): v is Guide => v !== null && v !== undefined);
}

async function listGuidesBySpot(spotId: string): Promise<Guide[]> {
  const ids = await kv.smembers(spotGuidesIndexKey(spotId));
  if (!ids || ids.length === 0) return [];
  const values = await kv.mget<Guide[]>(...ids.map((id) => recordKey(id)));
  return (values || []).filter((v): v is Guide => v !== null && v !== undefined);
}

/**
 * GUIDEの日本語本文・各Spotの日本語コメントを、Gemini APIで英語に翻訳する。
 * Experience投稿時の写真解析（analyzePhoto）と同じ考え方で、投稿直後に
 * 一度だけ実行し、結果をKVに保存する。失敗した場合は translationStatus を
 * 'failed' にし、日本語のまま公開しない（英語話者に日本語のまま出すのを防ぐ）。
 */
async function translateGuide(
  bodyJa: string,
  spots: GuideSpot[]
): Promise<{ bodyEn: string; spots: GuideSpot[] } | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

  const spotCommentsForPrompt = spots.map((s, i) => ({
    index: i,
    name: s.name,
    commentJa: s.commentJa,
    localTip: s.localTip || '',
  }));

  const prompt = `以下は、日本人が日本語で書いた旅行ガイドの本文と、紹介しているスポットの
コメント一覧です。英語話者の訪日旅行者に向けて、自然で読みやすい英語に翻訳・
ローカライズしてください（直訳ではなく、意味が伝わる自然な表現にすること）。

【本文】
${bodyJa}

【スポットコメント一覧（JSON）】
${JSON.stringify(spotCommentsForPrompt)}

出力は、他の説明文を一切付けず、以下のJSON形式のみで出力してください。
{
  "bodyEn": "本文の英訳",
  "spotComments": [
    { "index": 0, "commentEn": "そのスポットのコメントの英訳", "localTipEn": "Local Tipの英訳（無ければ空文字）" },
    ...
  ]
}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      }
    );
    if (!response.ok) return null;

    const data = await response.json();
    const rawText: string =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text || '')
        .join('') ?? '';

    const cleaned = rawText.replace(/```json\s*|```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned) as {
      bodyEn?: string;
      spotComments?: { index: number; commentEn?: string; localTipEn?: string }[];
    };

    if (!parsed.bodyEn) return null;

    const translatedSpots = spots.map((s, i) => {
      const match = parsed.spotComments?.find((c) => c.index === i);
      return {
        ...s,
        commentEn: match?.commentEn || undefined,
        // localTipは元のフィールドに翻訳結果を上書きせず、別で保持したいところだが
        // データ構造をシンプルに保つため、ここでは commentEn のみ翻訳結果を反映する。
        // localTipの翻訳が必要な場合は将来 localTipEn フィールドの追加を検討する。
      };
    });

    return { bodyEn: parsed.bodyEn, spots: translatedSpots };
  } catch {
    return null;
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // ── GET: 一覧取得 ──
  if (req.method === 'GET') {
    const mine = req.query.mine === '1' || req.query.mine === 'true';
    const spotId = typeof req.query.spotId === 'string' ? req.query.spotId : '';

    if (mine) {
      const uid = await getAuthenticatedUid(req);
      if (!uid) {
        res.status(401).json({ error: 'You must be logged in to view your guides' });
        return;
      }
      const guides = await listUserGuides(uid);
      res.status(200).json({ guides });
      return;
    }

    if (spotId) {
      const guides = (await listGuidesBySpot(spotId)).filter(
        (g) => g.translationStatus === 'translated'
      );
      res.status(200).json({ guides });
      return;
    }

    const guides = (await listAllGuides()).filter((g) => g.translationStatus === 'translated');
    res.status(200).json({ guides });
    return;
  }

  // ── POST: 新規投稿 ──
  if (req.method === 'POST') {
    const uid = await getAuthenticatedUid(req);
    if (!uid) {
      res.status(401).json({ error: 'You must be logged in to post a guide' });
      return;
    }

    const body: Partial<Guide> = req.body || {};

    const title = (body.title || '').trim();
    const theme = (body.theme || '').trim();
    const area = (body.area || '').trim();
    const bodyJa = (body.bodyJa || '').trim();
    const authorName = (body.authorName || '').trim() || '匿名クリエイター';
    const spots = Array.isArray(body.spots)
      ? body.spots
          .map((s) => ({
            spotId: typeof s.spotId === 'string' ? s.spotId : undefined,
            name: (s.name || '').trim(),
            commentJa: (s.commentJa || '').trim(),
            localTip: s.localTip?.trim() || undefined,
            bestTime: s.bestTime?.trim() || undefined,
            priceHint: s.priceHint?.trim() || undefined,
          }))
          .filter((s) => s.name && s.commentJa)
      : [];
    const photos = Array.isArray(body.photos)
      ? body.photos.filter((p): p is string => typeof p === 'string')
      : [];

    if (!title) {
      res.status(400).json({ error: 'title is required' });
      return;
    }
    if (!theme) {
      res.status(400).json({ error: 'theme is required' });
      return;
    }
    if (!area) {
      res.status(400).json({ error: 'area is required' });
      return;
    }
    if (!bodyJa) {
      res.status(400).json({ error: 'bodyJa is required' });
      return;
    }
    if (bodyJa.length > 3000) {
      res.status(400).json({ error: 'bodyJa must be 3000 characters or fewer' });
      return;
    }
    if (spots.length === 0) {
      res.status(400).json({ error: 'At least one spot with a comment is required' });
      return;
    }
    if (spots.length > 20) {
      res.status(400).json({ error: 'A maximum of 20 spots is allowed per guide' });
      return;
    }
    if (photos.length > 10) {
      res.status(400).json({ error: 'A maximum of 10 photos is allowed per guide' });
      return;
    }

    const id = crypto.randomUUID();

    // 投稿直後に一度だけ翻訳を実行する（Experience投稿時の写真解析と同じ考え方）
    const translation = await translateGuide(bodyJa, spots);

    const guide: Guide = {
      id,
      uid,
      authorName,
      createdAt: new Date().toISOString(),
      authorIsLocalExpert: true,
      authorExpertiseArea: body.authorExpertiseArea?.trim() || undefined,
      title,
      theme,
      area,
      season: body.season?.trim() || undefined,
      bodyJa,
      bodyEn: translation?.bodyEn,
      translationStatus: translation ? 'translated' : 'failed',
      spots: translation?.spots || spots,
      photos,
      published: !!translation,
    };

    try {
      await createGuideRecord(id, guide, uid);
      res.status(200).json({ success: true, guide });
    } catch (err) {
      res.status(500).json({ error: 'Failed to save guide', detail: String(err) });
    }
    return;
  }

  // ── DELETE: 削除（本人のみ） ──
  if (req.method === 'DELETE') {
    const uid = await getAuthenticatedUid(req);
    if (!uid) {
      res.status(401).json({ error: 'You must be logged in to delete a guide' });
      return;
    }

    const id = typeof req.query.id === 'string' ? req.query.id : '';
    if (!id) {
      res.status(400).json({ error: 'id is required' });
      return;
    }

    try {
      const existing = await getGuideRecord(id);
      if (!existing) {
        res.status(404).json({ error: 'Guide not found' });
        return;
      }
      if (existing.uid !== uid) {
        res.status(403).json({ error: 'You can only delete your own guides' });
        return;
      }

      const spotIds = existing.spots.map((s) => s.spotId).filter((s): s is string => !!s);
      await deleteGuideRecord(id, uid, spotIds);
      res.status(200).json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete guide', detail: String(err) });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
