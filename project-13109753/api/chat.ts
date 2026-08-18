// /api/chat.ts
// Vercel Serverless Function（Edge Runtime）
// フロントエンドからのチャット要求を受け取り、サーバー側でGemini APIを呼び出す。
// GEMINI_API_KEYはVercelの環境変数に保存すること。フロントエンドには絶対に露出させない。
//
// 【注意】Gemini APIのエンドポイント・モデル名・無料枠の条件は変更される可能性があります。
// 最新情報は https://ai.google.dev で必ず確認してください。
// モデル名が変わっている場合は、環境変数 GEMINI_MODEL で上書きしてください。

import { knowledgeBase } from './_knowledgeBase';

export const config = { runtime: 'edge' };

const MAX_HISTORY_MESSAGES = 12; // 直近の会話のみ保持（コスト・レイテンシ対策）

function buildSystemPrompt(): string {
  const entries = knowledgeBase
    .map(
      (e) =>
        `- [${e.area}/${e.category}] ${e.title}\n  ${e.story}`
    )
    .join('\n');

  return `あなたはTABI、鎌倉・江ノ島・湘南エリア専門の旅行コンシェルジュです。

以下は、地元の人や現地調査によって集められた実際のローカル知識です。
回答する際は、可能な限りこの情報を優先的に使ってください。

${entries}

回答のルール：
- 上記の知識ベースに関連情報がある場合は、それを踏まえた具体的な回答をする
- 知識ベースにない質問（一般的な事実、他地域、リアルタイム情報など）については、
  一般的な知識で答えて構わないが、憶測で店名や営業時間などを断定しない
- 分からないことは正直に「分かりません」「最新情報は現地で確認してください」と伝える
- 回答は簡潔に、旅行者にとって読みやすい長さで（目安200〜400字）`;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: { message?: string; history?: ChatMessage[] };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { message, history } = body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return new Response(JSON.stringify({ error: 'message is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (message.length > 2000) {
    return new Response(JSON.stringify({ error: 'message is too long' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const safeHistory: ChatMessage[] = Array.isArray(history)
    ? history
        .filter(
          (m) =>
            m &&
            (m.role === 'user' || m.role === 'assistant') &&
            typeof m.content === 'string'
        )
        .slice(-MAX_HISTORY_MESSAGES)
    : [];

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'Server misconfigured: GEMINI_API_KEY is not set' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // モデル名は環境変数 GEMINI_MODEL で上書き可能。
  // 未設定の場合のデフォルトは目安です。最新のモデル名は ai.google.dev で確認してください。
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

  // AnthropicのChatMessage形式（role: 'user'|'assistant'）を
  // Geminiのcontents形式（role: 'user'|'model'）に変換する
  const contents = [
    ...safeHistory.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    { role: 'user', parts: [{ text: message }] },
  ];

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
          contents,
          systemInstruction: {
            parts: [{ text: buildSystemPrompt() }],
          },
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
    const reply: string =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text || '')
        .join('\n') ?? '';

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Internal error', detail: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}