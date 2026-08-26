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
  prefecture?: string; // 住所から自動抽出した都道府県（英語表記、destinationsと同じ形式）
  name: string; // 紐づかない新規スポットの場合、直接名前を記載
  commentJa: string;
  commentEn?: string;
  localTip?: string;
  bestTime?: string;
  priceHint?: string;
}

// 都道府県名（日本語）→ 英語表記（destinationsで使っている表記と揺れが無いよう統一）
const PREFECTURE_JA_TO_EN: Record<string, string> = {
  北海道: 'Hokkaido',
  青森県: 'Aomori',
  岩手県: 'Iwate',
  宮城県: 'Miyagi',
  秋田県: 'Akita',
  山形県: 'Yamagata',
  福島県: 'Fukushima',
  茨城県: 'Ibaraki',
  栃木県: 'Tochigi',
  群馬県: 'Gunma',
  埼玉県: 'Saitama',
  千葉県: 'Chiba',
  東京都: 'Tokyo',
  神奈川県: 'Kanagawa',
  新潟県: 'Niigata',
  富山県: 'Toyama',
  石川県: 'Ishikawa',
  福井県: 'Fukui',
  山梨県: 'Yamanashi',
  長野県: 'Nagano',
  岐阜県: 'Gifu',
  静岡県: 'Shizuoka',
  愛知県: 'Aichi',
  三重県: 'Mie',
  滋賀県: 'Shiga',
  京都府: 'Kyoto',
  大阪府: 'Osaka',
  兵庫県: 'Hyogo',
  奈良県: 'Nara',
  和歌山県: 'Wakayama',
  鳥取県: 'Tottori',
  島根県: 'Shimane',
  岡山県: 'Okayama',
  広島県: 'Hiroshima',
  山口県: 'Yamaguchi',
  徳島県: 'Tokushima',
  香川県: 'Kagawa',
  愛媛県: 'Ehime',
  高知県: 'Kochi',
  福岡県: 'Fukuoka',
  佐賀県: 'Saga',
  長崎県: 'Nagasaki',
  熊本県: 'Kumamoto',
  大分県: 'Oita',
  宮崎県: 'Miyazaki',
  鹿児島県: 'Kagoshima',
  沖縄県: 'Okinawa',
};

/**
 * Google Places APIから得た住所文字列（日本語表記が基本）から、都道府県を
 * 抽出する。日本の住所は必ず都道府県名を含む形式で表記されるため、
 * 単純な文字列一致で十分信頼できる（AIを使うよりも確実・低コスト）。
 */
function extractPrefectureFromAddress(address?: string): string | undefined {
  if (!address) return undefined;
  for (const [ja, en] of Object.entries(PREFECTURE_JA_TO_EN)) {
    if (address.includes(ja)) return en;
  }
  for (const en of Object.values(PREFECTURE_JA_TO_EN)) {
    if (address.includes(en)) return en;
  }
  return undefined;
}

/**
 * Google Placesで選ばれた場所（name・address）が、既存のSPOT一覧の中の
 * どれかと同じ場所を指しているかをAIが判定し、spotIdを紐づける。
 * GUIDEはGoogle Placesで場所そのものは確定しているので、ここでの判定は
 * 「その実在の場所が、TABIの既存SPOTデータベースに既に存在するか」の
 * 確認という位置づけ（Experience投稿時のような自由入力の解釈ではない）。
 */
async function matchSpotIdForGuideSpot(
  req: VercelRequest,
  name: string,
  address?: string
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !name) return null;
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

    const prompt = `以下の実在する場所（Googleマップで確認済み）が、SPOT一覧のどれかと
同じ場所を指しているか判定してください。

【場所名】${name}
【住所】${address || '(不明)'}

【既存SPOT一覧（JSON、id・title・prefecture）】
${JSON.stringify(spots)}

同じ場所だと確信できるものがあれば、そのidだけを出力してください。
確信が持てない場合は "none" と出力してください。他の説明文は一切付けないでください。`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
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

export interface Guide {
  id: string;
  uid: string;
  authorName: string;
  createdAt: string;

  authorIsLocalExpert: boolean;
  authorExpertiseArea?: string;

  title: string;
  titleEn?: string;
  theme: string;
  area: string;
  areaEn?: string;
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
  title: string,
  area: string,
  bodyJa: string,
  spots: GuideSpot[]
): Promise<{ titleEn: string; areaEn: string; bodyEn: string; spots: GuideSpot[] } | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

  const spotCommentsForPrompt = spots.map((s, i) => ({
    index: i,
    name: s.name,
    commentJa: s.commentJa,
    localTip: s.localTip || '',
  }));

  const prompt = `以下は、日本人が日本語で書いた旅行ガイドのタイトル・対象エリア・本文と、
紹介しているスポットのコメント一覧です。英語話者の訪日旅行者に向けて、自然で
読みやすい英語に翻訳・ローカライズしてください（直訳ではなく、意味が伝わる
自然な表現にすること。地名は一般的な英語表記があれば使うこと）。

【タイトル】
${title}

【対象エリア】
${area}

【本文】
${bodyJa}

【スポットコメント一覧（JSON）】
${JSON.stringify(spotCommentsForPrompt)}

出力は、他の説明文を一切付けず、以下のJSON形式のみで出力してください。
{
  "titleEn": "タイトルの英訳",
  "areaEn": "対象エリアの英訳（地名の一般的な英語表記）",
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
      titleEn?: string;
      areaEn?: string;
      bodyEn?: string;
      spotComments?: { index: number; commentEn?: string; localTipEn?: string }[];
    };

    if (!parsed.titleEn || !parsed.areaEn || !parsed.bodyEn) return null;

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

    return {
      titleEn: parsed.titleEn,
      areaEn: parsed.areaEn,
      bodyEn: parsed.bodyEn,
      spots: translatedSpots,
    };
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
            googlePlaceId: typeof s.googlePlaceId === 'string' ? s.googlePlaceId : undefined,
            address: typeof s.address === 'string' ? s.address : undefined,
            prefecture: extractPrefectureFromAddress(
              typeof s.address === 'string' ? s.address : undefined
            ),
            name: (s.name || '').trim(),
            commentJa: (s.commentJa || '').trim(),
            localTip: s.localTip?.trim() || undefined,
            bestTime: s.bestTime?.trim() || undefined,
            priceHint: s.priceHint?.trim() || undefined,
          }))
          .filter((s) => s.name && s.commentJa)
      : [];

    // Google Placesで場所が確定している（googlePlaceIdがある）が、まだ内部の
    // spotIdが未確定のスポットについて、既存SPOTデータベースとの一致をAIに
    // 判定させる（一致すれば、SPOT詳細ページにこのGuideが表示されるようになる）
    await Promise.all(
      spots.map(async (s) => {
        if (s.googlePlaceId && !s.spotId) {
          s.spotId = (await matchSpotIdForGuideSpot(req, s.name, s.address)) ?? undefined;
        }
      })
    );

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
    const translation = await translateGuide(title, area, bodyJa, spots);

    const guide: Guide = {
      id,
      uid,
      authorName,
      createdAt: new Date().toISOString(),
      authorIsLocalExpert: true,
      authorExpertiseArea: body.authorExpertiseArea?.trim() || undefined,
      title,
      titleEn: translation?.titleEn,
      theme,
      area,
      areaEn: translation?.areaEn,
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
