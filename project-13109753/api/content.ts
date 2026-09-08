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

/**
 * 保存データの形をざっと検証する。
 * 完全なスキーマ検証ではないが、「配列であること」しか見ていなかった状態から、
 * 型ごとの最低限の期待に合っているかを確認する段階まで引き上げる。
 */
function validateData(type: ContentType, data: unknown[]): string | null {
  if (data.length > MAX_ITEMS) {
    return `Too many items (max ${MAX_ITEMS})`;
  }

  const size = new TextEncoder().encode(JSON.stringify(data)).length;
  if (size > MAX_PAYLOAD_BYTES) {
    return `Payload too large (max ${MAX_PAYLOAD_BYTES} bytes)`;
  }

  if (type === 'featuredArticleIds') {
    const bad = data.find((v) => typeof v !== 'string' || v.length > 200);
    if (bad !== undefined) return 'featuredArticleIds must be an array of short strings';
    return null;
  }

  // それ以外はオブジェクトの配列で、idを持つことを期待する
  for (const item of data) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return `${type} must be an array of objects`;
    }
    const id = (item as Record<string, unknown>).id;
    if (type !== 'articles' && (typeof id !== 'string' || !id)) {
      return `Each ${type} item requires a string "id"`;
    }
  }
  return null;
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
      return new Response(
        JSON.stringify({
          type,
          data: FALLBACK_DATA[type],
          warning: 'KV read failed, returning fallback data',
          detail: String(err),
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

    const invalid = validateData(type, data);
    if (invalid) {
      return new Response(JSON.stringify({ error: invalid }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      await kv.set(getKvKey(type), data);
      return new Response(JSON.stringify({ success: true, type }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: 'Failed to write to KV', detail: String(err) }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  return new Response(
    JSON.stringify({ error: 'Method not allowed. Use GET or POST.' }),
    { status: 405, headers: { 'Content-Type': 'application/json' } }
  );
}
