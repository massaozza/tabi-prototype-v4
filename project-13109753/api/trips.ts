// /api/trips.ts
// Vercel Serverless Function（Edge Runtime）
// 構造化された旅程（Trip）の保存・一覧取得・予約状況の更新・削除を扱うAPI。
//
// 【今回の変更】
// 単純な「Day毎のitems配列」から、以下の形式に変更：
// - stays（宿泊）: ホテルごとに何日目から何日目まで宿泊するか。
//   連泊・日ごとに違うホテル、どちらも表現できる。各stayにidと
//   予約状況（status）を付与し、後から個別に「予約済み」にできる。
// - days（日程）: 各日の朝食・昼食・夕食（提案＋予約状況）とアクティビティ。
//   各食事にもidとstatusを付与する。
//
// アフィリエイト登録が済んでいない現段階では、実際の予約サイトへの
// リンクは無い。「予約済みにする」は、あくまでユーザーが手動で
// チェックする自己申告のステータス管理として実装する。
//
// GET    /api/trips             → 自分が保存したTripを取得（認証必須）
// POST   /api/trips             → 新規保存（認証必須）
// PATCH  /api/trips?id=xxx      → 宿泊・食事の予約状況を更新（認証必須、本人のみ）
// DELETE /api/trips?id=xxx      → 削除（認証必須、本人のみ）

import { kv } from '@vercel/kv';

export const config = { runtime: 'edge' };

const COLLECTION = 'trips';

type BookingStatus = 'not_booked' | 'booked';

interface TripStay {
  id: string;
  hotelName: string;
  checkInDay: number;
  checkOutDay: number;
  status: BookingStatus;
}

interface TripMeal {
  id: string;
  suggestion: string;
  status: BookingStatus;
}

interface TripActivity {
  time?: string;
  title: string;
  description?: string;
}

interface TripDay {
  day: number;
  date?: string;
  activities: TripActivity[];
  meals: {
    breakfast?: TripMeal;
    lunch?: TripMeal;
    dinner?: TripMeal;
  };
}

export interface Trip {
  id: string;
  uid: string;
  title: string;
  summary?: string;
  stays: TripStay[];
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

interface RawStayInput {
  hotelName?: string;
  checkInDay?: number;
  checkOutDay?: number;
}

interface RawMealInput {
  suggestion?: string;
}

interface RawActivityInput {
  time?: string;
  title?: string;
  description?: string;
}

interface RawDayInput {
  day?: number;
  date?: string;
  activities?: RawActivityInput[];
  meals?: {
    breakfast?: RawMealInput;
    lunch?: RawMealInput;
    dinner?: RawMealInput;
  };
}

function buildStays(raw: unknown, tripId: string): TripStay[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s, idx) => {
      const stay = s as RawStayInput;
      if (
        !stay ||
        typeof stay.hotelName !== 'string' ||
        stay.hotelName.trim() === '' ||
        typeof stay.checkInDay !== 'number' ||
        typeof stay.checkOutDay !== 'number' ||
        stay.checkOutDay <= stay.checkInDay
      ) {
        return null;
      }
      return {
        id: `${tripId}-stay-${idx}`,
        hotelName: stay.hotelName.trim(),
        checkInDay: stay.checkInDay,
        checkOutDay: stay.checkOutDay,
        status: 'not_booked' as BookingStatus,
      };
    })
    .filter((s): s is TripStay => s !== null);
}

function buildMeal(
  raw: RawMealInput | undefined,
  tripId: string,
  day: number,
  mealType: string
): TripMeal | undefined {
  if (!raw || typeof raw.suggestion !== 'string' || raw.suggestion.trim() === '') {
    return undefined;
  }
  return {
    id: `${tripId}-d${day}-${mealType}`,
    suggestion: raw.suggestion.trim(),
    status: 'not_booked',
  };
}

function buildDays(raw: unknown, tripId: string): TripDay[] {
  if (!Array.isArray(raw)) return [];
  const results: (TripDay | null)[] = raw.map((d) => {
    const day = d as RawDayInput;
    if (typeof day.day !== 'number' || !Array.isArray(day.activities)) {
      return null;
    }
    const activities: TripActivity[] = day.activities
      .filter((a) => a && typeof (a as RawActivityInput).title === 'string')
      .map((a) => {
        const item = a as RawActivityInput;
        return {
          time: item.time?.trim() || undefined,
          title: (item.title as string).trim(),
          description: item.description?.trim() || undefined,
        };
      });

    const day_: TripDay = {
      day: day.day,
      date: day.date?.trim() || undefined,
      activities,
      meals: {
        breakfast: buildMeal(day.meals?.breakfast, tripId, day.day, 'breakfast'),
        lunch: buildMeal(day.meals?.lunch, tripId, day.day, 'lunch'),
        dinner: buildMeal(day.meals?.dinner, tripId, day.day, 'dinner'),
      },
    };
    return day_;
  });
  return results.filter((d): d is TripDay => d !== null);
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
    let body: { title?: string; summary?: string; stays?: unknown; days?: unknown };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const title = (body.title || '').trim();
    if (!title) {
      return jsonResponse({ error: 'title is required' }, 400);
    }

    const id = crypto.randomUUID();
    const days = buildDays(body.days, id);
    if (days.length === 0) {
      return jsonResponse({ error: 'days must be a non-empty, valid array' }, 400);
    }
    const stays = buildStays(body.stays, id);

    const trip: Trip = {
      id,
      uid,
      title,
      summary: (body.summary || '').trim() || undefined,
      stays,
      days,
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

  // ── PATCH: 宿泊・食事の予約状況を更新 ──
  if (req.method === 'PATCH') {
    const url = new URL(req.url);
    const id = url.searchParams.get('id') || '';
    if (!id) {
      return jsonResponse({ error: 'id is required' }, 400);
    }

    let body: { targetId?: string; status?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const targetId = body.targetId || '';
    const status = body.status;
    if (!targetId || (status !== 'booked' && status !== 'not_booked')) {
      return jsonResponse(
        { error: 'targetId and a valid status ("booked" or "not_booked") are required' },
        400
      );
    }

    try {
      const trip = await kv.get<Trip>(recordKey(id));
      if (!trip) {
        return jsonResponse({ error: 'Trip not found' }, 404);
      }
      if (trip.uid !== uid) {
        return jsonResponse({ error: 'You can only update your own trips' }, 403);
      }

      let updated = false;

      trip.stays = trip.stays.map((s) => {
        if (s.id === targetId) {
          updated = true;
          return { ...s, status };
        }
        return s;
      });

      trip.days = trip.days.map((d) => {
        const meals = { ...d.meals };
        (['breakfast', 'lunch', 'dinner'] as const).forEach((key) => {
          const meal = meals[key];
          if (meal && meal.id === targetId) {
            updated = true;
            meals[key] = { ...meal, status };
          }
        });
        return { ...d, meals };
      });

      if (!updated) {
        return jsonResponse({ error: 'Target not found in this trip' }, 404);
      }

      await kv.set(recordKey(id), trip);
      return jsonResponse({ success: true, trip }, 200);
    } catch (err) {
      return jsonResponse({ error: 'Failed to update trip', detail: String(err) }, 500);
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
