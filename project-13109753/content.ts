import { kv } from '@vercel/kv';
import { localsPlaces, latestGuides, destinations } from '../src/mocks/homeData';
import { articleData } from '../src/mocks/articleData';

export const config = { runtime: 'edge' };

const VALID_TYPES = ['localsPlaces', 'latestGuides', 'destinations', 'articles'] as const;
type ContentType = typeof VALID_TYPES[number];

const KV_KEY_PREFIX = 'content:';

const FALLBACK_DATA: Record<ContentType, unknown[]> = {
  localsPlaces,
  latestGuides,
  destinations,
  articles: [articleData],
};

function getKvKey(type: ContentType): string {
  return `${KV_KEY_PREFIX}${type}`;
}

function isValidType(value: unknown): value is ContentType {
  return typeof value === 'string' && VALID_TYPES.includes(value as ContentType);
}

export default async function handler(req: Request): Promise<Response> {
  // ── GET: KV からデータを取得（無ければフォールバック） ──
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const type = url.searchParams.get('type');

    if (!isValidType(type)) {
      return new Response(
        JSON.stringify({
          error: 'Invalid or missing "type" query parameter. Must be one of: localsPlaces, latestGuides, destinations, articles',
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

  // ── POST: KV にデータを保存 ──
  if (req.method === 'POST') {
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
          error: 'Invalid or missing "type" field. Must be one of: localsPlaces, latestGuides, destinations, articles',
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