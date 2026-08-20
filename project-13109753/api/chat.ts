// /api/chat.ts
// Vercel Serverless Function（Edge Runtime）
// フロントエンドからのチャット要求を受け取り、サーバー側でGemini APIを呼び出す。
// GEMINI_API_KEYはVercelの環境変数に保存すること。フロントエンドには絶対に露出させない。
//
// content.ts と同じ Vercel KV のキー（content:localsPlaces / content:latestGuides / content:destinations）を読む。

import { kv } from '@vercel/kv';
import { localsPlaces, latestGuides, destinations } from '../src/mocks/homeData';

export const config = { runtime: 'edge' };

const MAX_HISTORY_MESSAGES = 12;

async function buildSystemPrompt(): Promise<string> {
  let localsData: any[] = localsPlaces;
  let guidesData: any[] = latestGuides;
  let destinationsData: any[] = destinations;

  try {
    const kvLocals = await kv.get<any[]>('content:localsPlaces');
    if (kvLocals) localsData = kvLocals;
  } catch {}

  try {
    const kvGuides = await kv.get<any[]>('content:latestGuides');
    if (kvGuides) guidesData = kvGuides;
  } catch {}

  try {
    const kvDestinations = await kv.get<any[]>('content:destinations');
    if (kvDestinations) destinationsData = kvDestinations;
  } catch {}

  const localsSection = localsData
    .map((p) => `- ${p.title}\n  ${p.story}`)
    .join('\n');

  const guidesSection = guidesData
    .map((g) => `- [${g.category}] ${g.title}\n  ${g.description}`)
    .join('\n');

  const destinationsSection = destinationsData
    .map((d) => `- [${d.category}] ${d.title}\n  ${d.description}`)
    .join('\n');

  return `あなたはTABI、鎌倉・江ノ島・湘南エリア専門の旅行コンシェルジュです。

以下は、サイトに掲載されている目的地情報です。回答する際は、
可能な限りこの情報を優先的に使ってください。

【目的地情報】
${destinationsSection}

以下は、サイトに掲載されている「地元の人が友人を連れて行く場所」の情報です。

【ローカル知識】
${localsSection}

以下は、サイトに掲載されている記事の一覧です。関連する質問があれば、
該当する記事があることを伝え、読むことを勧めてください。

【掲載記事】
${guidesSection}

回答のルール：
- 上記の情報に関連する質問には、それを踏まえた具体的な回答をする
- 情報にない質問（一般的な事実、他地域、リアルタイム情報など）については、
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

  const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

  const contents = [
    ...safeHistory.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    { role: 'user', parts: [{ text: message }] },
  ];

  try {
    const systemPrompt = await buildSystemPrompt();

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
          systemInstruction: { parts: [{ text: systemPrompt }] },
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
