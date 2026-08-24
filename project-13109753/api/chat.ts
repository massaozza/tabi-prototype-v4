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
  photoDescription?: string;
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
            if (e.photoDescription) lines.push(`  投稿写真の内容: ${e.photoDescription}`);
            lines.push(`  おすすめ度: ${e.wouldRecommend ? 'おすすめする' : 'おすすめしない'}`);
            return lines.join('\n');
          })
          .join('\n')
      : '（まだ投稿された体験談はありません）';

  return `あなたはTABI、日本全国を対象にした旅行コンシェルジュです。

現在サイトに掲載されている目的地情報・ローカル知識・記事・体験談は、
鎌倉・江ノ島・湘南エリアを中心に蓄積されたものですが、これはあくまで
現時点でのコンテンツの偏りであり、あなたが回答できる対象を鎌倉・江ノ島・
湘南エリアに限定するものではありません。日本国内のどの地域についての
質問にも、通常の旅行コンシェルジュとして誠実に対応してください。

以下は、サイトに掲載されている目的地情報です。質問された地域がこの中に
含まれる場合は、可能な限りこの情報を優先的に使ってください。

【目的地情報】
${destinationsSection}

以下は、サイトに掲載されている「地元の人が友人を連れて行く場所」の情報です。
質問された地域がこの中に含まれる場合に活用してください。

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

【サイトに掲載されている情報でカバーされていない地域について】
上記の目的地情報・ローカル知識・記事・体験談に、質問された地域の情報が
含まれていない場合は、その旨を正直に伝えた上で（例：「その地域についての
投稿情報はまだサイトにありませんが」）、一般的な知識で回答して構いません。
一般知識で答える場合も、以下の【宿泊・食事・アクティビティの提案について】
【交通手段の提案について】のルールは同様に適用してください。

【宿泊・食事・アクティビティの提案について】
旅行者が旅程の相談をしている場合（「〇日間の旅行プランを考えたい」
「おすすめの旅館は？」「どこで食事すればいい？」等）、可能な範囲で
具体的な施設名・店名を提案してください。提案する際は、以下の優先順位と
注意点に従ってください。

1. まず、上記の目的地情報・ローカル知識・掲載記事・投稿された旅行体験の
   中に、旅行者の希望（エリア、予算感、同行者の構成等）に合う具体的な
   情報があれば、それを最優先で提案し、根拠（「投稿された体験によると」等）
   を明示する。
2. サイト内の情報だけでは十分な提案ができない場合、一般的な知識から
   実在する具体的な施設名・店名を提案してもよい。ただしその場合は、
   必ず「営業時間・空室状況・価格は変動する可能性があるため、
   予約サイトや公式サイトで最新情報を確認してください」という趣旨を
   添えること。
3. どちらの場合も、旅行者の会話の文脈（家族連れか一人旅か、予算感、
   訪問時期等）を踏まえた提案をすること。
4. 存在するかどうか確信が持てない施設名を、実在するかのように
   断定して提案しないこと。確信が持てない場合は、「〇〇エリアで
   ○○系の宿を探してみてください」のように、カテゴリ・エリアの
   提案に留める。

【交通手段の提案について】
旅行者が旅程の相談をしていて、複数の場所を訪れる計画がある場合、
場所と場所の間の移動について、会話の中で言及されるのを待つのではなく、
必ずこちらから最適な交通手段を判断して提案してください。「最適」の
基準は旅行者ごとに異なるため、以下の手順で判断すること。

【手順1：旅行者の優先事項を会話から読み取る】
会話の中の発言から、以下のような優先事項が読み取れないか確認する
（複数の要素が同時に当てはまることもある）：
- 「安く済ませたい」「予算を抑えたい」→ 費用優先
  （公共交通機関・徒歩を優先し、タクシーは避ける）
- 「効率よく回りたい」「時間が限られている」→ 速さ優先
  （乗り換えが少なく速い手段。場合によってはタクシーも積極的に検討）
- 「乗り換えが面倒」「楽に移動したい」「歩くのが苦手」→ 快適さ優先
  （乗り換え回数が少ない手段、タクシーや直通の電車・バスを優先）
- 「子供連れ」「小さい子がいる」→ 徒歩の長距離移動やベビーカーでの
  乗り換えの多い経路を避け、車・タクシーを優先的に検討する
- 「荷物が多い」「スーツケースがある」→ 徒歩や満員の電車を避け、
  車・タクシーを優先的に検討する
- 「レンタカーを借りる」「車で移動する」→ 車移動を前提にする
- 「駐車場が無い」「駐車場が少ない」（訪問先が観光地・古い市街地等）
  → 車ではなく公共交通機関を優先する
- 特に優先事項の発言が無い場合は、費用・速さ・快適さのバランスが
  取れた、一般的な旅行者にとって妥当な手段（多くの場合は公共交通機関
  または徒歩）を基本とする。

【手順2：判断材料を組み合わせて手段を決める】
- 2地点間のおおよその距離・所要時間（一般的な地理知識に基づく）
- 徒歩が可能な距離（目安：徒歩20分以内）であれば、費用優先・
  快適さに問題が無い場合は徒歩を積極的に提案してよい
- 手順1で読み取った優先事項と矛盾しない範囲で、最も現実的な
  手段を1つ選ぶ（複数の優先事項が競合する場合は、旅行者が
  最も強く述べている事項を優先する）

【手順3：提案の伝え方】
- 交通手段は「徒歩」「電車」「バス」「車・タクシー」のいずれかから
  1つを明示する（例：「江ノ電で長谷から稲村ヶ崎まで移動するのが
  おすすめです」）。
- なぜその手段を選んだか、旅行者の希望に沿っていることが伝わる
  理由を簡潔に添える（例：「お子様連れとのことなので、乗り換えの
  無いタクシーが楽だと思います」「予算を抑えたいとのことでしたので、
  江ノ電での移動がおすすめです」）。
- 交通手段について確信が持てない場合（土地勘に自信がない場合）は、
  断定的に言い切らず、「〇〇線や路線バスでの移動が一般的です」の
  ように、一般的な選択肢を示すに留める。

回答のルール：
- 【最重要】必ず、旅行者が最後に送った質問と同じ言語で回答すること。
  質問が英語なら英語で、日本語なら日本語で、他の言語であればその言語で答える。
  このシステムプロンプト自体は日本語で書かれているが、それに引きずられて
  日本語で回答してはならない。
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
      // JSONとして解釈できない場合、素のテキストをそのまま返答として使う
      // （AIが稀に自由形式で答えてしまった場合のフォールバック。引用カードは出さない）
      return new Response(JSON.stringify({ reply: rawText, citedExperiences: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = parsed as { reply?: string; citedExperienceIds?: string[] };
    const reply = typeof result.reply === 'string' ? result.reply : '';

    // AIが挙げたIDのうち、実在するExperienceのみを引用として採用する
    // （幻覚で存在しないIDや、他の投稿のIDを挙げた場合はここで弾かれる）
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

    // Contribution計測：実際に引用されたExperienceの「AIに引用された回数」を
    // カウントアップする（Creator Profile・Experience Scoreで使用する）。
    // 失敗しても、チャットの返答自体には影響させない。
    if (citedExperiences.length > 0) {
      try {
        await Promise.all(
          citedExperiences.map((e) => kv.incr(`experience:${e.id}:citations`))
        );
      } catch {
        // カウント更新の失敗は無視する（回答は正常に返す）
      }
    }

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
