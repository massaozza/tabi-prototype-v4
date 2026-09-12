import { kv } from '@vercel/kv';
import { localsPlaces, latestGuides } from '../src/mocks/homeData.js';
import { articleData } from '../src/mocks/articleData.js';
import { isAdminRequest, adminUnauthorized } from './_adminAuth.js';
import { isMigrated } from './_spotStore.js';

export const config = { runtime: 'edge' };

const VALID_TYPES = ['localsPlaces', 'latestGuides', 'destinations', 'articles', 'featuredArticleIds'] as const;
type ContentType = typeof VALID_TYPES[number];

const KV_KEY_PREFIX = 'content:';

// 【重要】destinations の mocks フォールバックは廃止した。
//
// Spotの正データは KV の spot:{id} にあり、content:destinations は
// そこから再構築される派生キャッシュ。
// ここで mocks の367件に戻すと、Admin編集やOSM Importの結果が
// 反映されない古いデータを返してしまう（気づきにくい不整合）。
//
// KVが読めない場合のフォールバックは、正データから自動生成される
// R2上のSnapshot（src/lib/spotSnapshot.ts）がブラウザ側で担う。
const FALLBACK_DATA: Record<ContentType, unknown[]> = {
  localsPlaces,
  latestGuides,
  destinations: [],
  articles: [articleData],
  featuredArticleIds: [],
};

function getKvKey(type: ContentType): string {
  return `${KV_KEY_PREFIX}${type}`;
}

function isValidType(value: unknown): value is ContentType {
  return typeof value === 'string' && VALID_TYPES.includes(value as ContentType);
}

// ── 保存時の上限 ──
// 無認証で任意の配列を保存できたため、件数・サイズの歯止めが無かった。
// 認証を入れた上で、誤操作や壊れたデータでKVを埋め尽くさないよう上限も設ける。
const MAX_ITEMS = 2000;
const MAX_PAYLOAD_BYTES = 2 * 1024 * 1024; // 2MB

// ── 文字列長の上限 ──
// 極端に長い文字列でKVを埋め尽くす・表示崩れを起こすのを防ぐ。
const MAX_SHORT = 200; // title, category, slug 等
const MAX_MEDIUM = 500; // description, caption 等
const MAX_LONG = 20000; // 本文（paragraph等）

const SLUG_PATTERN = /^[a-z0-9-]{1,100}$/;
const ID_PATTERN = /^[a-zA-Z0-9_-]{1,100}$/;

const VALID_SECTION_TYPES = [
  'h2',
  'h3',
  'paragraph',
  'pro-tip',
  'warning',
  'image',
  'comparison-table',
  'ordered-list',
] as const;

type ValidationResult = { ok: true; value: unknown } | { ok: false; error: string };

function isFail(r: ValidationResult): r is { ok: false; error: string } {
  return r.ok === false;
}

function ok(value: unknown): ValidationResult {
  return { ok: true, value };
}
function fail(error: string): ValidationResult {
  return { ok: false, error };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** 文字列として妥当か（型・最大長）を確認する */
function checkString(v: unknown, path: string, maxLen: number, required: boolean): ValidationResult {
  if (v === undefined || v === null) {
    return required ? fail(`${path} is required`) : ok(undefined);
  }
  if (typeof v !== 'string') return fail(`${path} must be a string`);
  if (v.length > maxLen) return fail(`${path} exceeds max length (${maxLen})`);
  return ok(v);
}

/**
 * URLとして妥当か確認する。
 * https の絶対URL、または "/" から始まる内部相対URLだけを許可する。
 * javascript:、data:、vbscript: 等のスキームを使った保存型XSSを防ぐ。
 */
function checkUrl(v: unknown, path: string, required: boolean): ValidationResult {
  if (v === undefined || v === null || v === '') {
    return required ? fail(`${path} is required`) : ok(undefined);
  }
  if (typeof v !== 'string' || v.length > 2000) return fail(`${path} must be a URL string`);
  if (v.startsWith('/') && !v.startsWith('//')) return ok(v); // 内部相対URL
  try {
    const url = new URL(v);
    if (url.protocol !== 'https:') return fail(`${path} must use https:// or be an internal path`);
    return ok(v);
  } catch {
    return fail(`${path} is not a valid URL`);
  }
}

/** 1つのSectionを検証する。typeごとに必要なフィールドを見る */
function validateSection(section: unknown, index: number): ValidationResult {
  if (!isPlainObject(section)) return fail(`sections[${index}] must be an object`);
  const type = section.type;
  if (typeof type !== 'string' || !(VALID_SECTION_TYPES as readonly string[]).includes(type)) {
    return fail(`sections[${index}].type is invalid`);
  }

  const out: Record<string, unknown> = { type };

  const idCheck = checkString(section.id, `sections[${index}].id`, MAX_SHORT, false);
  if (!idCheck.ok) return idCheck;
  if (idCheck.value !== undefined) out.id = idCheck.value;

  if (type === 'h2' || type === 'h3' || type === 'paragraph' || type === 'pro-tip' || type === 'warning') {
    const textCheck = checkString(section.text, `sections[${index}].text`, MAX_LONG, true);
    if (!textCheck.ok) return textCheck;
    out.text = textCheck.value;
    return ok(out);
  }

  if (type === 'image') {
    const srcCheck = checkUrl(section.src, `sections[${index}].src`, true);
    if (!srcCheck.ok) return srcCheck;
    const altCheck = checkString(section.alt, `sections[${index}].alt`, MAX_MEDIUM, true);
    if (!altCheck.ok) return altCheck;
    const captionCheck = checkString(section.caption, `sections[${index}].caption`, MAX_MEDIUM, false);
    if (!captionCheck.ok) return captionCheck;
    out.src = srcCheck.value;
    out.alt = altCheck.value;
    if (captionCheck.value !== undefined) out.caption = captionCheck.value;
    return ok(out);
  }

  if (type === 'comparison-table') {
    if (!Array.isArray(section.headers) || section.headers.some((h) => typeof h !== 'string')) {
      return fail(`sections[${index}].headers must be an array of strings`);
    }
    if (
      !Array.isArray(section.rows) ||
      section.rows.some((row) => !Array.isArray(row) || row.some((c) => typeof c !== 'string'))
    ) {
      return fail(`sections[${index}].rows must be an array of string arrays`);
    }
    if (section.headers.length > 20 || section.rows.length > 200) {
      return fail(`sections[${index}] table is too large`);
    }
    out.headers = section.headers;
    out.rows = section.rows;
    return ok(out);
  }

  if (type === 'ordered-list') {
    if (
      !Array.isArray(section.items) ||
      section.items.length > 100 ||
      section.items.some((it) => typeof it !== 'string' || it.length > MAX_MEDIUM)
    ) {
      return fail(`sections[${index}].items must be an array of short strings`);
    }
    out.items = section.items;
    return ok(out);
  }

  return fail(`sections[${index}].type is not handled`);
}

/** articles 1件を検証し、不明なフィールドを取り除いた安全なコピーを返す */
function validateArticle(item: unknown, index: number): ValidationResult {
  if (!isPlainObject(item)) return fail(`articles[${index}] must be an object`);

  const out: Record<string, unknown> = {};

  const idCheck = checkString(item.id, `articles[${index}].id`, MAX_SHORT, false);
  if (!idCheck.ok) return idCheck;
  if (idCheck.value !== undefined) {
    if (!ID_PATTERN.test(idCheck.value as string)) return fail(`articles[${index}].id has an invalid format`);
    out.id = idCheck.value;
  }

  const slugCheck = checkString(item.articleSlug, `articles[${index}].articleSlug`, MAX_SHORT, true);
  if (!slugCheck.ok) return slugCheck;
  if (!SLUG_PATTERN.test(slugCheck.value as string)) {
    return fail(`articles[${index}].articleSlug must be lowercase letters, numbers, and hyphens only`);
  }
  out.articleSlug = slugCheck.value;

  for (const [field, max] of [
    ['category', MAX_SHORT],
    ['title', MAX_SHORT],
    ['subtitle', MAX_MEDIUM],
    ['date', MAX_SHORT],
    ['dateISO', MAX_SHORT],
    ['readTime', MAX_SHORT],
    ['heroCaption', MAX_MEDIUM],
  ] as const) {
    const required = field === 'category' || field === 'title';
    const check = checkString(item[field], `articles[${index}].${field}`, max, required);
    if (!check.ok) return check;
    if (check.value !== undefined) out[field] = check.value;
  }

  const heroImageCheck = checkUrl(item.heroImage, `articles[${index}].heroImage`, false);
  if (!heroImageCheck.ok) return heroImageCheck;
  if (heroImageCheck.value !== undefined) out.heroImage = heroImageCheck.value;

  if (item.author !== undefined) {
    if (!isPlainObject(item.author)) return fail(`articles[${index}].author must be an object`);
    const name = checkString(item.author.name, `articles[${index}].author.name`, MAX_SHORT, false);
    const bio = checkString(item.author.bio, `articles[${index}].author.bio`, MAX_MEDIUM, false);
    const avatar = checkUrl(item.author.avatar, `articles[${index}].author.avatar`, false);
    if (!name.ok) return name;
    if (!bio.ok) return bio;
    if (!avatar.ok) return avatar;
    out.author = { name: name.value, bio: bio.value, avatar: avatar.value };
  }

  if (item.sections !== undefined) {
    if (!Array.isArray(item.sections) || item.sections.length > 200) {
      return fail(`articles[${index}].sections must be an array (max 200)`);
    }
    const sections: unknown[] = [];
    for (let i = 0; i < item.sections.length; i++) {
      const r = validateSection(item.sections[i], i);
      if (!r.ok) return r;
      sections.push(r.value);
    }
    out.sections = sections;
  }

  // affiliateCta / quickFacts / topPick / bottomCta / authorBox は
  // すべて任意項目の集まりで、悪用されやすい実行可能なフィールド
  // （URL・スクリプト）を持たないため、文字列長だけ緩く検証してそのまま許可する。
  for (const field of ['affiliateCta', 'quickFacts', 'topPick', 'bottomCta', 'authorBox'] as const) {
    const value = item[field];
    if (value === undefined) continue;
    if (!isPlainObject(value)) return fail(`articles[${index}].${field} must be an object`);
    for (const [k, v] of Object.entries(value)) {
      if (typeof v === 'string' && v.length > MAX_MEDIUM) {
        return fail(`articles[${index}].${field}.${k} exceeds max length`);
      }
    }
    out[field] = value;
  }

  if (item.tocItems !== undefined) {
    if (!Array.isArray(item.tocItems) || item.tocItems.length > 50) {
      return fail(`articles[${index}].tocItems must be an array (max 50)`);
    }
    out.tocItems = item.tocItems;
  }

  for (const field of ['sidebarRelatedArticles', 'relatedArticles'] as const) {
    const arr = item[field];
    if (arr === undefined) continue;
    if (!Array.isArray(arr) || arr.length > 20) {
      return fail(`articles[${index}].${field} must be an array (max 20)`);
    }
    const validatedItems: unknown[] = [];
    for (let i = 0; i < arr.length; i++) {
      const entry = arr[i];
      if (!isPlainObject(entry)) return fail(`articles[${index}].${field}[${i}] must be an object`);
      const title = checkString(entry.title, `articles[${index}].${field}[${i}].title`, MAX_SHORT, true);
      if (!title.ok) return title;
      const category = checkString(
        entry.category,
        `articles[${index}].${field}[${i}].category`,
        MAX_SHORT,
        true
      );
      if (!category.ok) return category;
      const description = checkString(
        entry.description,
        `articles[${index}].${field}[${i}].description`,
        MAX_MEDIUM,
        field === 'relatedArticles'
      );
      if (!description.ok) return description;
      const image = checkUrl(entry.image, `articles[${index}].${field}[${i}].image`, true);
      if (!image.ok) return image;
      const href = checkUrl(entry.href, `articles[${index}].${field}[${i}].href`, true);
      if (!href.ok) return href;
      const idField = checkString(entry.id, `articles[${index}].${field}[${i}].id`, MAX_SHORT, false);
      if (!idField.ok) return idField;
      validatedItems.push({
        ...(idField.value !== undefined ? { id: idField.value } : {}),
        title: title.value,
        category: category.value,
        ...(description.value !== undefined ? { description: description.value } : {}),
        image: image.value,
        href: href.value,
      });
    }
    out[field] = validatedItems;
  }

  return ok(out);
}

/**
 * 保存データを検証する。
 * typeごとにランタイムスキーマを適用し、不明なフィールドを取り除いた
 * 安全なコピーを返す（保存時検証。表示時のDOMPurifyサニタイズとは別に、
 * 両方を維持する）。
 */
function validateData(type: ContentType, data: unknown[]): { error: string } | { value: unknown[] } {
  if (data.length > MAX_ITEMS) {
    return { error: `Too many items (max ${MAX_ITEMS})` };
  }
  const size = new TextEncoder().encode(JSON.stringify(data)).length;
  if (size > MAX_PAYLOAD_BYTES) {
    return { error: `Payload too large (max ${MAX_PAYLOAD_BYTES} bytes)` };
  }

  if (type === 'featuredArticleIds') {
    const bad = data.find((v) => typeof v !== 'string' || (v as string).length > MAX_SHORT);
    if (bad !== undefined) return { error: 'featuredArticleIds must be an array of short strings' };
    return { value: data };
  }

  if (type === 'articles') {
    const out: unknown[] = [];
    const seenSlugs = new Set<string>();
    const seenIds = new Set<string>();
    for (let i = 0; i < data.length; i++) {
      const r = validateArticle(data[i], i);
      if (isFail(r)) return { error: r.error };
      const validated = r.value as Record<string, unknown>;
      const slug = validated.articleSlug as string;
      if (seenSlugs.has(slug)) return { error: `Duplicate articleSlug: ${slug}` };
      seenSlugs.add(slug);
      if (typeof validated.id === 'string') {
        if (seenIds.has(validated.id)) return { error: `Duplicate id: ${validated.id}` };
        seenIds.add(validated.id);
      }
      out.push(validated);
    }
    return { value: out };
  }

  // localsPlaces / latestGuides はオブジェクトの配列で、idを持つことを期待する
  for (const item of data) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { error: `${type} must be an array of objects` };
    }
    const id = (item as Record<string, unknown>).id;
    if (typeof id !== 'string' || !id || id.length > MAX_SHORT) {
      return { error: `Each ${type} item requires a short string "id"` };
    }
  }
  return { value: data };
}


export default async function handler(req: Request): Promise<Response> {
  // ── GET: KV からデータを取得（無ければフォールバック） ──
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const type = url.searchParams.get('type');

    if (!isValidType(type)) {
      return new Response(
        JSON.stringify({
          error: 'Invalid or missing "type" query parameter. Must be one of: localsPlaces, latestGuides, destinations, articles, featuredArticleIds',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    try {
      const data = await kv.get<unknown[]>(getKvKey(type));
      const result = data ?? FALLBACK_DATA[type];

      return new Response(JSON.stringify({ type, data: result }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      // KV 接続エラー時もフォールバックデータを返してサイトを維持
      console.error('[content] KV read failed:', err);
      return new Response(
        JSON.stringify({
          type,
          data: FALLBACK_DATA[type],
          warning: 'KV read failed, returning fallback data',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // ── POST: KV にデータを保存（管理者のみ） ──
  if (req.method === 'POST') {
    // 【重要】以前はここに認証が無く、誰でも記事・観光地・特集設定を
    // 任意の内容で上書きできた。記事本文はHTMLとして描画されるため、
    // 保存型XSSの入口にもなっていた。
    if (!(await isAdminRequest(req))) return adminUnauthorized();

    let body: { type?: unknown; data?: unknown };
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { type, data } = body;

    if (!isValidType(type)) {
      return new Response(
        JSON.stringify({
          error: 'Invalid or missing "type" field. Must be one of: localsPlaces, latestGuides, destinations, articles, featuredArticleIds',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!Array.isArray(data)) {
      return new Response(
        JSON.stringify({ error: '"data" must be an array' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ── destinations は書き込み禁止 ──
    // 移行後、Spotの正データは spot:{id} に移った。
    // content:destinations はそこから再構築される読み取り専用の派生キャッシュであり、
    // ここに直接書くと spot:{id} との二重管理になり、
    // Import処理と管理画面操作が互いの変更を消し合う原因になる。
    if (type === 'destinations' && (await isMigrated())) {
      return new Response(
        JSON.stringify({
          error:
            'content:destinations is a read-only derived cache. Use /api/spots (POST / PATCH) to change spots.',
          hint: 'POST /api/spots for new spots, PATCH /api/spots?id=xxx to update one.',
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const validated = validateData(type, data);
    if ('error' in validated) {
      return new Response(JSON.stringify({ error: validated.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // featuredArticleIds は、実在する記事のidだけを参照できるようにする。
    // 存在しないidを混入させても表示上害はないが、意図しない設定ミスを
    // 早期に検知できるようにしておく。
    if (type === 'featuredArticleIds') {
      try {
        const articles = (await kv.get<unknown[]>(getKvKey('articles'))) || FALLBACK_DATA.articles;
        const knownIds = new Set(
          (articles as Record<string, unknown>[])
            .map((a) => a.id)
            .filter((v): v is string => typeof v === 'string')
        );
        const unknown = (validated.value as string[]).find((id) => !knownIds.has(id));
        if (unknown) {
          return new Response(
            JSON.stringify({ error: `featuredArticleIds references an unknown article id: ${unknown}` }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
      } catch (err) {
        console.error('[content] failed to verify featuredArticleIds against articles:', err);
        // 参照整合性の確認自体に失敗しても、保存処理は止めない
        // （記事一覧の読み取り不調でfeatured設定が一切できなくなるのは避けたい）
      }
    }

    try {
      await kv.set(getKvKey(type), validated.value);
      return new Response(JSON.stringify({ success: true, type }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      console.error('[content] failed to write to KV:', err);
      return new Response(JSON.stringify({ error: 'Failed to save content' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response(
    JSON.stringify({ error: 'Method not allowed. Use GET or POST.' }),
    { status: 405, headers: { 'Content-Type': 'application/json' } }
  );
}
