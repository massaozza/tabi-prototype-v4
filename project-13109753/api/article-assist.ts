// /api/article-assist.ts
// Vercel Serverless Function（Edge Runtime）
// 記事作成の支援機能。2つのモードを持つ：
//
// mode: "structure"
//   ライターが書いた生の下書きテキストを受け取り、Gemini APIで
//   見出し・段落・箇条書き・比較表などのセクション構成に自動で組み立て直す。
//   あわせて、タイトル案（2〜3個）も提案する。
//   ArticleForm.tsx の bodySections にそのまま流し込める形式で返す。
//
// mode: "polish"
//   1つのセクションのテキストだけを受け取り、文章を校正・改善する。
//   構成（type）は変えず、文章だけを整える。
//
// GEMINI_API_KEYはVercelの環境変数に保存すること。フロントエンドには絶対に露出させない。

export const config = { runtime: 'edge' };

const TEXT_TYPES = ['h2', 'h3', 'paragraph', 'pro-tip', 'warning'] as const;
const ALL_TYPES = [...TEXT_TYPES, 'comparison-table', 'ordered-list'] as const;

interface StructureRequest {
  mode: 'structure';
  rawText: string;
  title?: string;
  category?: string;
}

interface PolishRequest {
  mode: 'polish';
  type: string;
  content: string;
}

type AssistRequest = StructureRequest | PolishRequest;

function buildStructurePrompt(rawText: string, title?: string, category?: string): string {
  return `あなたは旅行メディア「TABI」の編集アシスタントです。
以下は、ライターが書いた記事の下書き（構成を考えずに書いたメモ・文章）です。

${title ? `ライターが仮に付けたタイトル（参考、変更してよい）: ${title}\n` : ''}${category ? `カテゴリ: ${category}\n` : ''}
--- 下書き本文 ---
${rawText}
--- 下書き本文ここまで ---

この下書きをもとに、以下の2つの作業を行ってください。

【作業1：タイトル案の提案】
下書きの内容を踏まえて、記事タイトルの案を2〜3個提案してください。
- 下書きと同じ言語で書く
- 具体的で、読者が内容を想像できるタイトルにする
- 誇張しすぎない、旅行メディアとして自然なトーンにする

【作業2：本文の構成】
下書きを、以下のルールに従って読みやすい記事構成に組み立て直してください。

1. 内容を意味のまとまりで分割し、適切な見出し（h2, 必要ならh3）を追加する
2. 各段落は paragraph として整理し、誤字脱字・不自然な言い回しがあれば自然に校正する
   （ただし、下書きに書かれていない事実を新しく創作しないこと。情報の追加は禁止）
3. 「知っておくと得する情報」があれば pro-tip として抜き出す
4. 「注意すべき点・警告」があれば warning として抜き出す
5. 料金・時間・選択肢の比較など、表形式が適切な情報があれば comparison-table として整理する
6. 手順やチェックリストのような列挙情報があれば ordered-list として整理する
7. 画像を挿入すべき箇所は生成しない（画像は後でライターが手動で追加するため）

出力は、他の説明文を一切付けず、以下のJSON形式のみを出力してください。

{
  "titleSuggestions": ["タイトル案1", "タイトル案2", "タイトル案3"],
  "sections": [
    { "type": "h2", "content": "見出しテキスト" },
    { "type": "paragraph", "content": "段落テキスト" },
    { "type": "pro-tip", "content": "豆知識テキスト" },
    { "type": "warning", "content": "注意テキスト" },
    { "type": "comparison-table", "content": "{\\"headers\\":[\\"列1\\",\\"列2\\"],\\"rows\\":[[\\"値1\\",\\"値2\\"]]}" },
    { "type": "ordered-list", "content": "項目1\\n項目2\\n項目3" }
  ]
}`;
}

function buildPolishPrompt(type: string, content: string): string {
  return `あなたは旅行メディア「TABI」の編集アシスタントです。
以下は記事の一部（種類: ${type}）です。

--- 原文 ---
${content}
--- 原文ここまで ---

この文章を、以下のルールで校正してください。

1. 誤字脱字・不自然な言い回しを直す
2. 冗長な表現を簡潔にする
3. 元の意味・事実関係は絶対に変えない（新しい情報を追加しない、事実を書き換えない）
4. 元の言語（日本語なら日本語、英語なら英語）のまま校正する

出力は、他の説明文を一切付けず、以下のJSON形式のみを出力してください。

{ "content": "校正後の文章" }`;
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

  let body: Partial<AssistRequest>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'Server misconfigured: GEMINI_API_KEY is not set' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
  const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

  let prompt: string;

  if (body.mode === 'structure') {
    const rawText = (body.rawText || '').trim();
    if (!rawText) {
      return new Response(JSON.stringify({ error: 'rawText is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (rawText.length > 20000) {
      return new Response(JSON.stringify({ error: 'rawText is too long (max 20000 chars)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    prompt = buildStructurePrompt(rawText, body.title, body.category);
  } else if (body.mode === 'polish') {
    const content = (body.content || '').trim();
    const type = body.type || '';
    if (!content || !TEXT_TYPES.includes(type as (typeof TEXT_TYPES)[number])) {
      return new Response(
        JSON.stringify({ error: 'content and a valid text type are required for polish mode' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (content.length > 5000) {
      return new Response(JSON.stringify({ error: 'content is too long (max 5000 chars)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    prompt = buildPolishPrompt(type, content);
  } else {
    return new Response(
      JSON.stringify({ error: 'mode must be "structure" or "polish"' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

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
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
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

    if (body.mode === 'structure') {
      const sections = (parsed as { sections?: unknown }).sections;
      if (!Array.isArray(sections)) {
        return new Response(
          JSON.stringify({ error: 'AI response missing "sections" array', detail: text }),
          { status: 502, headers: { 'Content-Type': 'application/json' } }
        );
      }
      const validSections = sections.filter(
        (s): s is { type: string; content: string } =>
          !!s &&
          typeof s === 'object' &&
          ALL_TYPES.includes((s as { type?: string }).type as (typeof ALL_TYPES)[number]) &&
          typeof (s as { content?: unknown }).content === 'string'
      );

      const rawTitleSuggestions = (parsed as { titleSuggestions?: unknown }).titleSuggestions;
      const titleSuggestions = Array.isArray(rawTitleSuggestions)
        ? rawTitleSuggestions.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
        : [];

      return new Response(JSON.stringify({ sections: validSections, titleSuggestions }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      const content = (parsed as { content?: unknown }).content;
      if (typeof content !== 'string') {
        return new Response(
          JSON.stringify({ error: 'AI response missing "content" string', detail: text }),
          { status: 502, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ content }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Internal error', detail: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
