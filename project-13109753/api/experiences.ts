// /api/experiences.ts
// Vercel Serverless Function（Node.js Runtime）
// 旅行者のリアルな体験（Experience）の投稿・一覧取得・削除を扱うAPI。
//
// 【重要】このVercelプロジェクトのNode.js Runtimeでは、api/配下の別ファイル
// （_auth.ts, _store.ts等）をimportすると、実行時に "Cannot find module" で
// 落ちることが判明した（Edge Runtimeでは問題なく動く）。そのため、
// このファイルは共通ヘルパーに頼らず、必要なロジックを全て自己完結させている。
//
// 事業計画書の構造化データ（WHO/WHERE/WHEN/CONTEXT/EXPERIENCE/EVIDENCE）を
// 反映したデータ構造。まずはAIとの会話ではなく、通常のフォーム入力で作成する。
//
// 保存方式：「1レコード＝1キー」＋RedisのSet型（sadd/smembers/srem）による索引。
// 配列を丸ごと上書きする方式（localsPlaces等）とは異なり、同時投稿でも
// データが失われない。
//
// GET  /api/experiences            → 公開されている全Experienceを取得（認証不要）
// GET  /api/experiences?mine=1     → 自分が投稿したExperienceだけを取得（認証必須）
// POST /api/experiences            → 新規投稿（認証必須）
// DELETE /api/experiences?id=xxx   → 削除（認証必須、本人の投稿のみ）

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';
import crypto from 'crypto';

const COLLECTION = 'experiences';

const TRAVEL_STYLES = ['Solo', 'Couple', 'Family with kids', 'Friends', 'Business'] as const;
const BUDGET_LEVELS = ['Budget', 'Mid-range', 'Luxury'] as const;

export interface Experience {
  id: string;
  uid: string;
  authorName: string;
  createdAt: string;

  // WHERE
  placeName: string;
  area: string;
  category: string;
  spotId?: string; // TABI 2.0：既存SPOT（destinations）と紐づく場合のid
                    // 投稿時にSPOTを検索して選択した場合に設定される。
                    // 未設定でも投稿自体は成立する（placeNameの自由入力のみでもよい）。

  // WHEN
  visitedMonth: string; // "2026-07" 形式

  // WHO / CONTEXT
  travelStyle: string;
  companions?: string;
  budgetLevel?: string;

  // EXPERIENCE
  whatWasGood: string;
  whatWasHard?: string;
  tip?: string;
  wouldRecommend: boolean;

  // EVIDENCE
  photos: string[];
  videos?: string[]; // TABI 3.0：動画対応（任意）
  photoDescription?: string; // 1枚目の写真をAIが解析した説明文（投稿時に一度だけ生成）
}

/**
 * 投稿されたplaceName・areaから、既存のSPOT一覧の中で最も近いものをAIが判定し、
 * spotIdを自動で紐づける（投稿者が候補を明示的に選ばなくても、自動で
 * 紐づくようにするための仕組み）。
 * 確信が持てる一致が無い場合は null を返し、無理に紐づけない
 * （誤った紐づけの方が、紐づかないより悪いため）。
 *
 * 【重要】このファイルはNode.js Runtimeで他ファイルをimportできないため、
 * SPOT一覧は /api/content?type=destinations への内部リクエストで取得する。
 */
async function matchSpotIdWithAI(
  req: VercelRequest,
  placeName: string,
  area: string
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !placeName) return null;
  const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

  try {
    const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
    const host = req.headers.host;
    const contentRes = await fetch(`${proto}://${host}/api/content?type=destinations`);
    if (!contentRes.ok) return null;
    const contentJson = await contentRes.json();
    const spots: { id: string; title: string; prefecture?: string }[] = Array.isArray(
      contentJson?.data
    )
      ? contentJson.data.map((d: { id: string; title: string; prefecture?: string }) => ({
          id: d.id,
          title: d.title,
          prefecture: d.prefecture,
        }))
      : [];
    if (spots.length === 0) return null;

    const prompt = `旅行者が投稿した観光地の名前と地域が、以下のSPOT一覧のどれかと
同じ場所を指しているか判定してください。

【投稿された場所名】${placeName}
【投稿された地域】${area || '(未入力)'}

【既存SPOT一覧（JSON、id・title・prefecture）】
${JSON.stringify(spots)}

同じ場所だと確信できるものが一覧にあれば、そのidだけを出力してください。
確信が持てない場合（表記が近いだけで実際には別の場所である可能性がある場合を含む）は、
"none" と出力してください。他の説明文は一切付けないでください。`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
        }),
      }
    );
    if (!response.ok) return null;

    const data = await response.json();
    const text: string =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text || '')
        .join('') ?? '';
    const answer = text.trim();

    if (!answer || answer.toLowerCase() === 'none') return null;
    const matched = spots.find((s) => s.id === answer);
    return matched ? matched.id : null;
  } catch {
    return null;
  }
}

/**
 * 写真の中身をGemini APIで解析し、簡潔な説明文を生成する。
 * 投稿時に一度だけ実行し、結果をKVに保存しておく
 * （チャットの応答のたびに画像処理を行うと遅く・高コストになるため）。
 * 失敗しても投稿自体は止めず、単に説明文が付かないだけにする。
 */
async function analyzePhoto(photoUrl: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

  try {
    const imgRes = await fetch(photoUrl);
    if (!imgRes.ok) return null;
    const arrayBuffer = await imgRes.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const contentType = imgRes.headers.get('content-type') || 'image/jpeg';

    const prompt =
      'これは旅行者が投稿した写真です。写っているものを簡潔に日本語で説明してください' +
      '（1〜2文、店名や場所名の断定はせず、見えるものだけを客観的に描写してください）。';

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: prompt },
                { inlineData: { mimeType: contentType, data: base64 } },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) return null;
    const data = await response.json();
    const text: string =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text || '')
        .join('') ?? '';
    return text.trim() || null;
  } catch {
    return null;
  }
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

function spotExperiencesIndexKey(spotId: string): string {
  return `spot:${spotId}:experiences`;
}

async function createExperienceRecord(id: string, data: Experience, uid: string): Promise<void> {
  await kv.set(recordKey(id), data);
  await kv.sadd(collectionIndexKey(), id);
  await kv.sadd(userIndexKey(uid), id);
  // spotIdが設定されている場合、SPOT側のインデックスにも追加する
  // （SPOT詳細ページで「旅行者の実体験」を高速に表示するため）
  if (data.spotId) {
    await kv.sadd(spotExperiencesIndexKey(data.spotId), id);
  }
}

async function getExperienceRecord(id: string): Promise<Experience | null> {
  const value = await kv.get<Experience>(recordKey(id));
  return value ?? null;
}

async function deleteExperienceRecord(id: string, uid: string, spotId?: string): Promise<void> {
  await kv.del(recordKey(id));
  await kv.srem(collectionIndexKey(), id);
  await kv.srem(userIndexKey(uid), id);
  if (spotId) {
    await kv.srem(spotExperiencesIndexKey(spotId), id);
  }
}

async function listAllExperiences(): Promise<Experience[]> {
  const ids = await kv.smembers(collectionIndexKey());
  if (!ids || ids.length === 0) return [];
  const values = await kv.mget<Experience[]>(...ids.map((id) => recordKey(id)));
  return (values || []).filter((v): v is Experience => v !== null && v !== undefined);
}

async function listUserExperiences(uid: string): Promise<Experience[]> {
  const ids = await kv.smembers(userIndexKey(uid));
  if (!ids || ids.length === 0) return [];
  const values = await kv.mget<Experience[]>(...ids.map((id) => recordKey(id)));
  return (values || []).filter((v): v is Experience => v !== null && v !== undefined);
}

async function listExperiencesBySpot(spotId: string): Promise<Experience[]> {
  const ids = await kv.smembers(spotExperiencesIndexKey(spotId));
  if (!ids || ids.length === 0) return [];
  const values = await kv.mget<Experience[]>(...ids.map((id) => recordKey(id)));
  return (values || []).filter((v): v is Experience => v !== null && v !== undefined);
}

function isValidMonthFormat(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
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
        res.status(401).json({ error: 'You must be logged in to view your experiences' });
        return;
      }
      const experiences = await listUserExperiences(uid);
      res.status(200).json({ experiences });
      return;
    }

    if (spotId) {
      const experiences = await listExperiencesBySpot(spotId);
      res.status(200).json({ experiences });
      return;
    }

    const experiences = await listAllExperiences();
    res.status(200).json({ experiences });
    return;
  }

  // ── POST: 新規投稿 ──
  if (req.method === 'POST') {
    const uid = await getAuthenticatedUid(req);
    if (!uid) {
      res.status(401).json({ error: 'You must be logged in to post an experience' });
      return;
    }

    const body: Partial<Experience> = req.body || {};

    const placeName = (body.placeName || '').trim();
    const area = (body.area || '').trim();
    const category = (body.category || '').trim();
    let spotId = (body.spotId || '').trim() || undefined;
    const visitedMonth = (body.visitedMonth || '').trim();
    const travelStyle = (body.travelStyle || '').trim();
    const whatWasGood = (body.whatWasGood || '').trim();
    const authorName = (body.authorName || '').trim() || 'Anonymous traveler';
    const photos = Array.isArray(body.photos)
      ? body.photos.filter((p): p is string => typeof p === 'string')
      : [];
    const videos = Array.isArray(body.videos)
      ? body.videos.filter((v): v is string => typeof v === 'string').slice(0, 2)
      : [];

    if (!placeName) {
      res.status(400).json({ error: 'placeName is required' });
      return;
    }
    if (!category) {
      res.status(400).json({ error: 'category is required' });
      return;
    }
    if (!isValidMonthFormat(visitedMonth)) {
      res.status(400).json({ error: 'visitedMonth must be in "YYYY-MM" format' });
      return;
    }
    if (!TRAVEL_STYLES.includes(travelStyle as (typeof TRAVEL_STYLES)[number])) {
      res.status(400).json({
        error: `travelStyle must be one of: ${TRAVEL_STYLES.join(', ')}`,
      });
      return;
    }
    if (
      body.budgetLevel &&
      !BUDGET_LEVELS.includes(body.budgetLevel as (typeof BUDGET_LEVELS)[number])
    ) {
      res.status(400).json({
        error: `budgetLevel must be one of: ${BUDGET_LEVELS.join(', ')}`,
      });
      return;
    }
    if (!whatWasGood) {
      res.status(400).json({ error: 'whatWasGood is required' });
      return;
    }
    if (
      whatWasGood.length > 2000 ||
      (body.whatWasHard || '').length > 2000 ||
      (body.tip || '').length > 2000
    ) {
      res.status(400).json({ error: 'Text fields must be 2000 characters or fewer' });
      return;
    }
    if (photos.length > 10) {
      res.status(400).json({ error: 'A maximum of 10 photos is allowed per experience' });
      return;
    }

    const id = crypto.randomUUID();

    // フロントエンドがspotIdを設定していない場合、AIが自動で最も近いSPOTを判定する
    // （投稿者が候補を明示的に選ばなくても、自動で紐づくようにするための仕組み）
    if (!spotId) {
      spotId = (await matchSpotIdWithAI(req, placeName, area)) ?? undefined;
    }

    // 1枚目の写真だけをAIで解析する（複数枚あっても最初の1枚のみ、コスト・時間を抑えるため）
    const photoDescription =
      photos.length > 0 ? (await analyzePhoto(photos[0])) ?? undefined : undefined;

    const experience: Experience = {
      id,
      uid,
      authorName,
      createdAt: new Date().toISOString(),
      placeName,
      area,
      category,
      spotId,
      visitedMonth,
      travelStyle,
      companions: body.companions?.trim() || undefined,
      budgetLevel: body.budgetLevel,
      whatWasGood,
      whatWasHard: body.whatWasHard?.trim() || undefined,
      tip: body.tip?.trim() || undefined,
      wouldRecommend: body.wouldRecommend !== false,
      photos,
      videos: videos.length > 0 ? videos : undefined,
      photoDescription,
    };

    try {
      await createExperienceRecord(id, experience, uid);

      // 投稿完了後、バックグラウンドで英語翻訳をトリガー（非同期・失敗しても投稿は成功）
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'https://www.tabi47.com';
      fetch(`${baseUrl}/api/translate-content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'experience', id, targetLang: 'en' }),
      }).catch(() => {/* 翻訳失敗は無視 */});

      res.status(200).json({ success: true, experience });
    } catch (err) {
      res.status(500).json({ error: 'Failed to save experience', detail: String(err) });
    }
    return;
  }

  // ── DELETE: 削除（本人のみ） ──
  if (req.method === 'DELETE') {
    const uid = await getAuthenticatedUid(req);
    if (!uid) {
      res.status(401).json({ error: 'You must be logged in to delete an experience' });
      return;
    }

    const id = typeof req.query.id === 'string' ? req.query.id : '';
    if (!id) {
      res.status(400).json({ error: 'id is required' });
      return;
    }

    try {
      const existing = await getExperienceRecord(id);
      if (!existing) {
        res.status(404).json({ error: 'Experience not found' });
        return;
      }
      if (existing.uid !== uid) {
        res.status(403).json({ error: 'You can only delete your own experiences' });
        return;
      }

      await deleteExperienceRecord(id, uid, existing.spotId);
      res.status(200).json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete experience', detail: String(err) });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
