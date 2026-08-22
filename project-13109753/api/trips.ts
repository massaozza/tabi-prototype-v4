// /api/trips.ts
// Vercel Serverless Function（Edge Runtime）
// 構造化された旅程（Trip）の保存・一覧取得・削除を扱うAPI。
//
// structure-trip.ts で構造化した結果を、ユーザーが確認した上で
// このAPIで実際に保存する。Tripは常にログインユーザー専用
// （Experienceと違い、公開一覧は無い。自分のものだけ見られる）。
//
// 保存方式：experiences.ts と同じ「1レコード＝1キー」＋
// RedisのSet型（sadd/smembers/srem）による索引。
//
// GET    /api/trips          → 自分が保存したTripを取得（認証必須）
// POST   /api/trips          → 新規保存（認証必須）
// DELETE /api/trips?id=xxx   → 削除（認証必須、本人の投稿のみ）

import { kv } from '@vercel/kv';

export const config = { runtime: 'edge' };

const COLLECTION = 'trips';

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

export interface Trip {
  id: string;
  uid: string;
  title: string;
  summary?: string;
  days: TripDay[];
  createdAt: string;
}

interface SessionRecord {
  uid: string;
  createdAt: string;
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

function recordKey(id: string): string {
  return `${COLLECTION}:${id}`;
}

function userIndexKey(uid: string): string {
  return `user:${uid}:${COLLECTION}`;
}

async function listUserTrips(uid: string): Promise<Trip[]> {
  const ids = await kv.smembers(userIndexKey(uid));
  if (!ids || ids.length === 0) return [];
  const values = await kv.mget<Trip[]>(...ids.map((id) => recordKey(id)));
  return (values || []).filter((v): v is Trip => v !== null && v !== undefined);
}

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isValidDays(days: unknown): days is TripDay[] {
  if (!Array.isArray(days) || days.length === 0) return false;
  return (days as unknown[]).every((raw) => {
    const d = raw as Partial<TripDay>;
    if (!d || typeof d.day !== 'number' || typeof d.title !== 'string') return false;
    if (!Array.isArray(d.items)) return false;
    return d.items.every((item) => {
      const i = item as Partial<TripItem>;
      return !!i && typeof i.title === 'string';
    });
  });
}

export default async function handler(req: Request): Promise<Response> {
  const uid = await getAuthenticatedUid(req);
  if (!uid) {
    return jsonResponse({ error: 'You must be logged in to access trips' }, 401);
  }

  // ── GET: 自分のTrip一覧 ──
  if (req.method === 'GET') {
    try {
      const trips = await listUserTrips(uid);
      trips.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      return jsonResponse({ trips }, 200);
    } catch (err) {
      return jsonResponse({ error: 'Failed to load trips', detail: String(err) }, 500);
    }
  }

  // ── POST: 新規保存 ──
  if (req.method === 'POST') {
    let body: { title?: string; summary?: string; days?: unknown };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const title = (body.title || '').trim();
    if (!title) {
      return jsonResponse({ error: 'title is required' }, 400);
    }
    if (!isValidDays(body.days)) {
      return jsonResponse({ error: 'days must be a non-empty, valid array' }, 400);
    }

    const id = crypto.randomUUID();
    const trip: Trip = {
      id,
      uid,
      title,
      summary: (body.summary || '').trim() || undefined,
      days: body.days as TripDay[],
      createdAt: new Date().toISOString(),
    };

    try {
      await kv.set(recordKey(id), trip);
      await kv.sadd(userIndexKey(uid), id);
      return jsonResponse({ success: true, trip }, 200);
    } catch (err) {
      return jsonResponse({ error: 'Failed to save trip', detail: String(err) }, 500);
    }
  }

  // ── DELETE: 削除（本人のみ） ──
  if (req.method === 'DELETE') {
    const url = new URL(req.url);
    const id = url.searchParams.get('id') || '';
    if (!id) {
      return jsonResponse({ error: 'id is required' }, 400);
    }

    try {
      const existing = await kv.get<Trip>(recordKey(id));
      if (!existing) {
        return jsonResponse({ error: 'Trip not found' }, 404);
      }
      if (existing.uid !== uid) {
        return jsonResponse({ error: 'You can only delete your own trips' }, 403);
      }

      await kv.del(recordKey(id));
      await kv.srem(userIndexKey(uid), id);
      return jsonResponse({ success: true }, 200);
    } catch (err) {
      return jsonResponse({ error: 'Failed to delete trip', detail: String(err) }, 500);
    }
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}
