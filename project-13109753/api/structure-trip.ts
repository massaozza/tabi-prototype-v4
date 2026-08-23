// /api/structure-trip.ts
// Vercel Serverless Function（Edge Runtime）
// チャット（TABI AI）の会話履歴を受け取り、Gemini APIで構造化された旅程データに変換する。
//
// 【今回の変更】
// 単純な「Day毎のitems配列」から、以下の形式に変更：
// - stays（宿泊）: ホテル名と、何日目から何日目まで宿泊するか。
//   同じホテルに連泊する場合も、日ごとに違うホテルに泊まる場合も両方表現できる。
// - days（日程）: 各日の朝食・昼食・夕食（提案とその日の予定）＋アクティビティ。
//   食事・宿泊は、後から個別に「予約済み」にできるよう、母体の trips.ts 側で
//   id と予約状況（status）を付与する（この時点ではまだ付与しない）。
//
// 認証必須：ログインしていないユーザーは使えない。
// この処理はあくまで「構造化するだけ」で、実際の保存は行わない。

import { kv } from '@vercel/kv';

export const config = { runtime: 'edge' };

interface SessionRecord {
  uid: string;
  createdAt: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface RawStay {
  hotelName: string;
  checkInDay: number;
  checkOutDay: number;
}

interface RawMeal {
  suggestion?: string;
}

interface RawActivity {
  type?: 'activity' | 'transport';
  transportMode?: 'walk' | 'train' | 'bus' | 'car' | 'taxi' | 'other';
  time?: string;
  title: string;
  description?: string;
}

interface RawDay {
  day: number;
  date?: string;
  activities: RawActivity[];
  meals?: {
    breakfast?: RawMeal;
    lunch?: RawMeal;
    dinner?: RawMeal;
  };
}

function getCookie(req: Request, name: string): string | null {
  const cookieHeader = req.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function getAuthenticatedUid(req: Request): Promise<string | null> {
  const token = getCookie(req, 'session');
  if (!token) return null;
  try {
    const session = await kv.get<SessionRecord>(`session:${token}`);
    return session?.uid ?? null;
  } catch {
    return null;
  }
}

function buildPrompt(conversationText: string): string {
  return `あなたは旅行プランナーです。以下は、旅行者とTABI AIチャットとの会話履歴です。

--- 会話履歴 ---
${conversationText}
--- 会話履歴ここまで ---

この会話の中から、具体的な旅行プランを読み取り、以下の形式に構造化してください。

【重要なルール】
- 会話の中に、構造化できるだけの具体的な旅行プランが含まれていない場合は、
  success を false にし、reason に理由を日本語で簡潔に書いてください。
  無理に旅程を創作しないでください。
- 会話に書かれていない場所・時間・順序・宿泊先・食事先を、勝手に創作しないでください。
  あくまで会話の中で実際に言及された内容だけを整理してください。
- 日程が明示されていない場合は、会話の中で言及された場所の数や流れから、
  妥当な範囲でDayを分けて構いません。
- 宿泊（stays）について：会話の中でホテル・旅館名が具体的に言及されていれば、
  それが何日目のチェックインから何日目のチェックアウトまでかを整理してください
  （例：1日目〜3日目まで同じホテルなら checkInDay:1, checkOutDay:3。
  日ごとに違う宿に泊まる場合は、それぞれ別のstayとして分けてください）。
  会話の中でホテル名が一切言及されていなければ、stays は空配列にしてください。
- 食事（meals）について：会話の中で具体的なレストラン名・食事の提案が
  言及されていれば、その日の朝食/昼食/夕食として整理してください。
  言及が無い食事枠は、そのキー自体を省略してください（無理に埋めない）。
- 移動（transport）について：会話の中で、ある活動から次の活動へ場所が
  変わる際の交通手段（徒歩・電車・バス・車/タクシー）が言及されていれば、
  それを type: "transport" のactivityとして、該当する2つの活動の間に
  明示的に挿入してください（例：長谷寺の後に「江ノ電で稲村ヶ崎へ移動」と
  言及があれば、それを1つの独立したactivityとして含める）。
  会話の中で交通手段が全く言及されていない場合は、無理に創作せず、
  移動のactivityは省略して構いません。
- 【重要】TABI AIの回答の中で、移動と、その後の訪問先・観光内容が
  1つの文にまとめて書かれている場合（例：「江ノ電での移動と稲村ヶ崎海岸
  での夕日鑑賞をお楽しみください」のように、移動と活動が一緒に語られている
  場合）でも、必ず以下の2つの別々のactivityに分割してください。
  1つのactivityのtitleに、移動手段と訪問先・活動内容の両方を混在させては
  いけません。
    1. type: "transport" のactivity（移動手段・区間のみを表すtitle。
       例：「江ノ電で移動」）
    2. type: "activity" のactivity（訪問先・観光内容のみを表すtitle。
       例：「稲村ヶ崎海岸で夕日鑑賞」）
  transportMode（walk/train/bus/car/taxi/other）も、会話の中の記述から
  判断できる範囲で設定してください。判断できない場合は "other" にしてください。
- タイトルは、会話の内容を踏まえた分かりやすい旅行タイトルにしてください
  （例: "3 Days in Kamakura & Enoshima"）。

出力は、他の説明文を一切付けず、以下のJSON形式のみを出力してください。

成功時：
{
  "success": true,
  "title": "旅行プランのタイトル",
  "summary": "1〜2文の概要",
  "stays": [
    { "hotelName": "ホテル名", "checkInDay": 1, "checkOutDay": 3 }
  ],
  "days": [
    {
      "day": 1,
      "activities": [
        { "type": "activity", "time": "morning", "title": "訪問先や活動", "description": "補足説明（任意）" },
        { "type": "transport", "transportMode": "train", "title": "江ノ電で長谷から稲村ヶ崎へ移動", "description": "補足説明（任意）" }
      ],
      "meals": {
        "lunch": { "suggestion": "店名（言及があれば）" },
        "dinner": { "suggestion": "店名（言及があれば）" }
      }
    }
  ]
}

失敗時：
{
  "success": false,
  "reason": "構造化できなかった理由"
}`;
}

function extractJson(text: string): unknown {
  const cleaned = text.replace(/```json\s*|```\s*/g, '').trim();
  return JSON.parse(cleaned);
}

function isValidStay(s: unknown): s is RawStay {
  const stay = s as Partial<RawStay>;
  return (
    !!stay &&
    typeof stay.hotelName === 'string' &&
    stay.hotelName.trim() !== '' &&
    typeof stay.checkInDay === 'number' &&
    typeof stay.checkOutDay === 'number' &&
    stay.checkOutDay > stay.checkInDay
  );
}

function isValidDay(d: unknown): d is RawDay {
  const day = d as Partial<RawDay>;
  if (!day || typeof day.day !== 'number' || !Array.isArray(day.activities)) {
    return false;
  }
  return day.activities.every(
    (item) => item && typeof (item as RawActivity).title === 'string'
  );
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const uid = await getAuthenticatedUid(req);
  if (!uid) {
    return new Response(
      JSON.stringify({ error: 'You must be logged in to save a trip' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let body: { history?: ChatMessage[] };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const history = Array.isArray(body.history) ? body.history : [];
  const safeHistory = history.filter(
    (m) =>
      m &&
      (m.role === 'user' || m.role === 'assistant') &&
      typeof m.content === 'string'
  );

  if (safeHistory.length === 0) {
    return new Response(
      JSON.stringify({ success: false, reason: 'No conversation to structure' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const conversationText = safeHistory
    .map((m) => `${m.role === 'user' ? 'ユーザー' : 'TABI AI'}: ${m.content}`)
    .join('\n\n');

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'Server misconfigured: GEMINI_API_KEY is not set' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
  const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: buildPrompt(conversationText) }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      }
    );

    if (!response.ok) {
      const detail = await response.text();
      return new Response(
        JSON.stringify({ error: 'Upstream API error', detail }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const text: string =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text || '')
        .join('') ?? '';

    let parsed: unknown;
    try {
      parsed = extractJson(text);
    } catch {
      return new Response(
        JSON.stringify({ error: 'AI returned invalid JSON', detail: text }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = parsed as {
      success?: boolean;
      title?: string;
      summary?: string;
      stays?: unknown[];
      days?: unknown[];
      reason?: string;
    };

    if (!result.success) {
      return new Response(
        JSON.stringify({
          success: false,
          reason: result.reason || 'Could not structure this conversation into a trip',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!result.title || !Array.isArray(result.days) || result.days.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          reason: 'AI response was missing required trip details',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const validDays = result.days.filter(isValidDay);
    if (validDays.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          reason: 'AI response did not contain valid day details',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const validStays = Array.isArray(result.stays)
      ? result.stays.filter(isValidStay)
      : [];

    return new Response(
      JSON.stringify({
        success: true,
        title: result.title,
        summary: result.summary || '',
        stays: validStays,
        days: validDays,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Internal error', detail: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
