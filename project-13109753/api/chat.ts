// /api/chat.ts
// Vercel Serverless Function（Edge Runtime）
// フロントエンドからのチャット要求を受け取り、サーバー側でGemini APIを呼び出す。
// GEMINI_API_KEYはVercelの環境変数に保存すること。フロントエンドには絶対に露出させない。
//
// content.ts と同じ Vercel KV のキー（content:localsPlaces / content:latestGuides / content:destinations）を読む。
// 加えて、experiences.ts が保存する実際の旅行者の体験（Experience）も読み込み、
// AIの回答が「実際に旅行した人の声」に基づいたものになるようにする。
//
// 【今回の変更】
// 単に文章の中で体験談を引用するだけでなく、「どの投稿を引用したか」を
// 構造化データ（citedExperiences）としてフロントエンドに返す。
// これにより、フロントエンドは引用元をカードUIとして視覚的に表示できる。
// AIには回答と一緒に「引用した投稿のID」もJSON形式で答えさせ、
// サーバー側で実在するIDかどうかを必ず検証してから返す（AIの幻覚対策）。

import { kv } from '@vercel/kv';
import { localsPlaces, latestGuides, destinations } from '../src/mocks/homeData';

export const config = { runtime: 'edge' };

const MAX_HISTORY_MESSAGES = 12;
const MAX_EXPERIENCES_IN_PROMPT = 50; // トークン量が際限なく増えないよう上限を設ける

interface ExperienceRecord {
  id: string;
  authorName: string;
  placeName: string;
  area: string;
  category: string;
  travelStyle: string;
  companions?: string;
  budgetLevel?: string;
  whatWasGood: string;
  whatWasHard?: string;
  tip?: string;
  wouldRecommend: boolean;
  photos: string[];
  createdAt: string;
}

interface CitedExperience {
  id: string;
  placeName: string;
  category: string;
  area: string;
  authorName: string;
  whatWasGood: string;
  wouldRecommend: boolean;
  photos: string[];
}

async function fetchExperiences(): Promise<ExperienceRecord[]> {
  try {
    const ids = await kv.smembers('experiences:all');
    if (!ids || ids.length === 0) return [];
    const keys = ids.map((id) => `experiences:${id}`);
    const values = await kv.mget<ExperienceRecord[]>(...keys);
    const records = (values || []).filter(
      (v): v is ExperienceRecord => v !== null && v !== undefined
    );
    // 新しい投稿を優先して上限件数に絞る
    records.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return records.slice(0, MAX_EXPERIENCES_IN_PROMPT);
  } catch {
    return [];
  }
}

function buildSystemPrompt(
  localsData: any[],
  guidesData: any[],
  destinationsData: any[],
  experiencesData: ExperienceRecord[]
): string {
  const localsSection = localsData
    .map((p) => `- ${p.title}\n  ${p.story}`)
    .join('\n');

  const guidesSection = guidesData
    .map((g) => `- [${g.category}] ${g.title}\n  ${g.description}`)
    .join('\n');

  const destinationsSection = destinationsData
    .map((d) => `- [${d.category}] ${d.title}\n  ${d.description}`)
    .join('\n');

  const experiencesSection =
    experiencesData.length > 0
      ? experiencesData
          .map((e) => {
            const lines = [
              `- [ID: ${e.id}] ${e.placeName}（${e.category}、${e.area}）— 投稿者: ${e.authorName}（${e.travelStyle}${e.companions ? `、同行者: ${e.companions}` : ''}）`,
              `  良かった点: ${e.whatWasGood}`,
            ];
            if (e.whatWasHard) lines.push(`  大変だった点: ${e.whatWasHard}`);
            if (e.tip) lines.push(`  アドバイス: ${e.tip}`);
            lines.push(`  おすすめ度: ${e.wouldRecommend ? 'おすすめする' : 'おすすめしない'}`);
            return lines.join('\n');
          })
          .join('\n')
      : '（まだ投稿された体験談はありません）';

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

以下は、実際にTABIのユーザーが投稿した「旅行体験談」です。それぞれに [ID: ...]
という識別子が付いています。関連する質問には、可能な限りこれらの実体験を
引用して回答してください。引用する際は、「実際に投稿された体験によると」
「〇〇さんの体験では」のように、これが編集部の情報ではなく、実際の旅行者の声で
あることが伝わるようにしてください。

【投稿された旅行体験】
${experiencesSection}

回答のルール：
- 上記の情報に関連する質問には、それを踏まえた具体的な回答をする
- 特に「投稿された旅行体験」に関連する内容があれば、積極的に引用し、
  実際の旅行者の声であることを明示する
- 投稿された体験談に書かれていない内容を、体験談から得た情報であるかのように
  創作しないこと（体験談の引用は、実際に書かれている内容のみに限る）
- 情報にない質問（一般的な事実、他地域、リアルタイム情報など）については、
  一般的な知識で答えて構わないが、憶測で店名や営業時間などを断定しない
- 分からないことは正直に「分かりません」「最新情報は現地で確認してください」と伝える
- 回答は簡潔に、旅行者にとって読みやすい長さで（目安200〜400字）
- 回答文の中に [ID: ...] という識別子そのものを書かないこと
  （識別子は、下記のJSON出力の citedExperienceIds にのみ使うこと）

出力は、他の説明文を一切付けず、以下のJSON形式のみを出力してください。

{
  "reply": "旅行者への回答本文（上記のルールに従った自然な文章）",
  "citedExperienceIds": ["回答の中で実際に引用したExperienceのIDの配列。引用していなければ空配列"]
}`;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
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

  const experiencesData = await fetchExperiences();
  const experiencesById = new Map(experiencesData.map((e) => [e.id, e]));

  const systemPrompt = buildSystemPrompt(
    localsData,
    guidesData,
    destinationsData,
    experiencesData
  );

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
          systemInstruction: { parts: [{ text: systemPrompt }] },
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
    const rawText: string =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text || '')
        .join('') ?? '';

    let parsed: unknown;
    try {
      parsed = extractJson(rawText);
    } catch {
      return new Response(JSON.stringify({ reply: rawText, citedExperiences: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = parsed as { reply?: string; citedExperienceIds?: string[] };
    const reply = typeof result.reply === 'string' ? result.reply : '';

    const citedIds = Array.isArray(result.citedExperienceIds)
      ? result.citedExperienceIds.filter((id): id is string => typeof id === 'string')
      : [];

    const citedExperiences: CitedExperience[] = citedIds
      .map((id) => experiencesById.get(id))
      .filter((e): e is ExperienceRecord => e !== undefined)
      .map((e) => ({
        id: e.id,
        placeName: e.placeName,
        category: e.category,
        area: e.area,
        authorName: e.authorName,
        whatWasGood: e.whatWasGood,
        wouldRecommend: e.wouldRecommend,
        photos: e.photos,
      }));

    return new Response(JSON.stringify({ reply, citedExperiences }), {
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
