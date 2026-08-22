// /api/structure-trip.ts
// Vercel Serverless Function（Edge Runtime）
// チャット（TABI AI）の会話履歴を受け取り、Gemini APIで
// 「Day 1, Day 2...」のような構造化された旅程データに変換する。
//
// 認証必須：ログインしていないユーザーは使えない
// （Trip保存はログインユーザー専用の機能のため）。
//
// この処理はあくまで「構造化するだけ」で、実際の保存は行わない。
// フロントエンドは、この結果をユーザーに確認させてから、
// 別途 POST /api/trips で保存する。

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

interface TripItem {
  time?: string;
  title: string;
  description?: string;
}

interface TripDay {
  day: number;
  title: string;
  items: TripItem[];
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

この会話の中から、具体的な旅行プラン（訪れる場所、日程、順序など）を
読み取り、日程表（Day 1, Day 2...）の形式に構造化してください。

【重要なルール】
- 会話の中に、構造化できるだけの具体的な旅行プランが含まれていない場合
  （例えば、単なる雑談や、一般的な質問への回答だけで終わっている場合）は、
  success を false にし、reason に理由を日本語で簡潔に書いてください。
  無理に旅程を創作しないでください。
- 会話に書かれていない場所・時間・順序を、勝手に創作しないでください。
  あくまで会話の中で実際に言及された内容だけを整理してください。
- 日程が明示されていない場合（「3日間の旅行」のような情報が無い場合）は、
  会話の中で言及された場所の数や流れから、妥当な範囲でDayを分けて構いません。
- タイトルは、会話の内容を踏まえた分かりやすい旅行タイトルにしてください
  （例: "3 Days in Kamakura & Enoshima"）。

出力は、他の説明文を一切付けず、以下のJSON形式のみを出力してください。

成功時：
{
  "success": true,
  "title": "旅行プランのタイトル",
  "summary": "1〜2文の概要",
  "days": [
    {
      "day": 1,
      "title": "Day 1のタイトル（例: Kamakura Temples）",
      "items": [
        { "time": "morning", "title": "訪問先や活動", "description": "補足説明（任意）" }
      ]
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
      days?: TripDay[];
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

    return new Response(
      JSON.stringify({
        success: true,
        title: result.title,
        summary: result.summary || '',
        days: result.days,
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
