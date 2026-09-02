// /api/parse-travelogue.ts
// Vercel Serverless Function（Node.js Runtime）
// TABI 3.0：日本人が慣れ親しんだ「旅行記」形式（フォートラベル等を参考にした、
// 時系列の自由記述＋写真）で投稿してもらい、AIが裏側で解析して、TABIの
// 構造化データ（GUIDE または Recommended Trip）に自動変換するための専用API。
//
// 【設計方針・タイムアウト対策】
// 今日、api/chat.ts で「367件のSPOT一覧を1回のAI呼び出しの中で読ませつつ、
// 該当するIDを判定させる」処理が重すぎてタイムアウトする問題が発生した。
// その教訓を踏まえ、ここでは処理を2段階に分けている：
//   1回目：旅行記の本文だけを渡し、場所の名前・コメント・日程を抽出する
//          （SPOT一覧そのものは渡さない、軽い処理）
//   2回目：抽出された場所名それぞれについて、既存SPOTとの一致を個別に
//          判定する（GUIDE投稿時に既に使っている、実績のある軽い仕組みを
//          再利用。各判定は並列実行するため、全体の待ち時間は抑えられる）
//
// POST /api/parse-travelogue
//   body: { title, bodyJa, photos: [{ url, caption }] }
//   → 解析結果に応じて、GUIDEまたはRecommended Tripとして保存する
//   → { success: true, contentType: 'guide' | 'trip', id: '...' } を返す

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';
import crypto from 'crypto';

interface PhotoInput {
  url: string;
  caption?: string;
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

// ── 1回目のAI呼び出し：旅行記本文の解析（SPOT一覧は渡さない、軽い処理） ──
interface ParsedSpot {
  name: string;
  commentJa: string;
  commentEn: string;
  localTip?: string;
  day: number | null;
}

interface ParsedTravelogue {
  classification: 'guide' | 'trip';
  titleEn: string;
  theme?: string;
  area: string;
  areaEn: string;
  bodyEn: string;
  spots: ParsedSpot[];
}

async function parseTravelogue(title: string, bodyJa: string): Promise<ParsedTravelogue | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

  const prompt = `以下は、日本人が日本語で書いた旅行記（自由記述のブログ形式）です。
これを解析し、TABIというサイトに構造化データとして登録するための情報を
抽出してください。

【タイトル】
${title}

【旅行記本文】
${bodyJa}

【判定基準】
- 本文に「1日目」「2日目」のような、複数日にわたる明確な日程の区切りが
  あれば classification は "trip"、無ければ（単発の話題や、1つのテーマに
  沿った紹介であれば） "guide" としてください。

【抽出してほしい情報】
- タイトルの英訳
- 本文中で言及されている、実際に訪れた場所（観光地・飲食店・宿泊施設等）
  それぞれについて、その場所名（本文中の表記のまま）、日本語のコメント
  （その場所についてどう書かれていたか、要約）、英訳、地元ならではの
  一言があればそれも（無ければ省略）、classification が "trip" の場合は
  何日目の出来事かの数字（分からなければ null）
- 対象エリア（都道府県・地域名）とその英訳
- 本文全体の英訳（自然な英語に、意訳して構わない）

出力は、他の説明文を一切付けず、以下のJSON形式のみで出力してください。
{
  "classification": "guide または trip",
  "titleEn": "タイトルの英訳",
  "theme": "この旅行記のテーマを一言で（例：ローカル路線バスの旅、グルメ巡り等）",
  "area": "対象エリア（日本語）",
  "areaEn": "対象エリアの英訳",
  "bodyEn": "本文全体の英訳",
  "spots": [
    {
      "name": "場所名（本文中の表記のまま）",
      "commentJa": "その場所についての日本語コメント",
      "commentEn": "その場所についての英語コメント",
      "localTip": "地元ならではの一言（無ければ空文字）",
      "day": 1
    }
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
    const parsed = JSON.parse(cleaned) as ParsedTravelogue;

    if (!parsed.titleEn || !parsed.bodyEn || !Array.isArray(parsed.spots)) return null;
    return parsed;
  } catch {
    return null;
  }
}

// ── 2回目のAI呼び出し：抽出された場所名を、既存SPOTと個別に照合する ──
// （GUIDE投稿時に使っている matchSpotIdForGuideSpot と同じ考え方。
// 場所ごとに独立して呼び出すため、1回あたりの処理は軽い）
async function matchSpotId(
  req: VercelRequest,
  name: string,
  area: string
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

    const prompt = `旅行記に登場する場所が、SPOT一覧のどれかと同じ場所を指しているか判定してください。

【場所名】${name}
【エリア】${area || '(不明)'}

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
    res.status(401).json({ error: 'You must be logged in to post a travelogue' });
    return;
  }

  const body: {
    title?: string;
    bodyJa?: string;
    photos?: PhotoInput[];
    authorName?: string;
    area?: string;
    travelStartDate?: string;
    travelEndDate?: string;
    tags?: string[];
  } = req.body || {};

  const title = (body.title || '').trim();
  const bodyJa = (body.bodyJa || '').trim();
  const photos = Array.isArray(body.photos) ? body.photos : [];
  const authorName = (body.authorName || '').trim() || '匿名クリエイター';
  const userProvidedArea = (body.area || '').trim();
  const tags = Array.isArray(body.tags) ? body.tags.slice(0, 10) : [];
  const travelPeriod =
    body.travelStartDate && body.travelEndDate
      ? `${body.travelStartDate} 〜 ${body.travelEndDate}`
      : body.travelStartDate || undefined;

  if (!title || !bodyJa) {
    res.status(400).json({ error: 'title and bodyJa are required' });
    return;
  }
  if (bodyJa.length > 8000) {
    res.status(400).json({ error: 'bodyJa must be 8000 characters or fewer' });
    return;
  }

  try {
    const parsed = await parseTravelogue(title, bodyJa);
    if (!parsed) {
      res.status(500).json({ error: 'Failed to analyze the travelogue. Please try again.' });
      return;
    }

    // ユーザーが明示的にエリアを指定していれば、AIの推測より優先する
    // （SPOT照合の精度が上がるため）
    const effectiveArea = userProvidedArea || parsed.area;

    // 抽出された各場所について、既存SPOTとの一致を並列で判定する
    const spotsWithIds = await Promise.all(
      parsed.spots.map(async (s) => ({
        ...s,
        spotId: (await matchSpotId(req, s.name, effectiveArea)) ?? undefined,
      }))
    );

    // 写真のキャプションは、既存のGUIDE/Trip構造には「写真ごとのキャプション」
    // という概念が無いため、本文の末尾に一覧として追記する形で失わせない
    const photoCaptionsText = photos
      .filter((p) => p.caption?.trim())
      .map((p, i) => `${i + 1}. ${p.caption}`)
      .join('\n');
    const bodyEnWithCaptions = photoCaptionsText
      ? `${parsed.bodyEn}\n\n[Photo notes]\n${photoCaptionsText}`
      : parsed.bodyEn;
    const bodyJaWithCaptions = photoCaptionsText
      ? `${bodyJa}\n\n【写真メモ】\n${photoCaptionsText}`
      : bodyJa;

    const photoUrls = photos.map((p) => p.url).filter(Boolean);

    if (parsed.classification === 'trip') {
      // ── Recommended Tripとして保存する ──
      const id = crypto.randomUUID();
      const dayNumbers = Array.from(
        new Set(spotsWithIds.map((s) => s.day ?? 1))
      ).sort((a, b) => a - b);
      const days = (dayNumbers.length > 0 ? dayNumbers : [1]).map((dayNum) => ({
        day: dayNum,
        activities: spotsWithIds
          .filter((s) => (s.day ?? 1) === dayNum)
          .map((s) => ({
            type: 'activity' as const,
            title: s.name,
            description: s.commentEn || s.commentJa,
            spotId: s.spotId,
          })),
        meals: {},
      }));

      const trip = {
        id,
        uid,
        title: parsed.titleEn || title,
        summary: bodyEnWithCaptions.slice(0, 300),
        stays: [],
        days,
        createdAt: new Date().toISOString(),
        status: 'planning' as const,
        tripType: 'recommended' as const,
        totalDays: days.length,
        isPublic: false,
        copyCount: 0,
        saveCount: 0,
        tags: tags.length > 0 ? tags : undefined,
        travelPeriod,
      };

      await kv.set(`trips:${id}`, trip);
      await kv.sadd('user:' + uid + ':trips', id);

      res.status(200).json({ success: true, contentType: 'trip', id });
      return;
    }

    // ── GUIDEとして保存する ──
    const id = crypto.randomUUID();
    const guide = {
      id,
      uid,
      authorName,
      createdAt: new Date().toISOString(),
      authorIsLocalExpert: true,
      title,
      titleEn: parsed.titleEn,
      theme: parsed.theme || 'Travel Story',
      area: effectiveArea,
      areaEn: parsed.areaEn,
      bodyJa: bodyJaWithCaptions,
      bodyEn: bodyEnWithCaptions,
      translationStatus: 'translated' as const,
      spots: spotsWithIds.map((s) => ({
        spotId: s.spotId,
        name: s.name,
        commentJa: s.commentJa,
        commentEn: s.commentEn,
        localTip: s.localTip || undefined,
      })),
      photos: photoUrls,
      published: true,
      tags: tags.length > 0 ? tags : undefined,
      travelPeriod,
    };

    await kv.set(`guides:${id}`, guide);
    await kv.sadd('guides:all', id);
    await kv.sadd('user:' + uid + ':guides', id);
    const spotIds = spotsWithIds.map((s) => s.spotId).filter((v): v is string => !!v);
    await Promise.all(spotIds.map((spotId) => kv.sadd(`spot:${spotId}:guides`, id)));

    res.status(200).json({ success: true, contentType: 'guide', id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save travelogue', detail: String(err) });
  }
}
