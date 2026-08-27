// /api/trips.ts
// Vercel Serverless Function（Edge Runtime）
// 構造化された旅程（Trip）の保存・一覧取得・予約状況の更新・削除を扱うAPI。
//
// 【TABI 2.0での拡張】
// これまでの「計画としてのTrip」に、以下を追加する：
// - status（'planning' | 'traveling' | 'completed' | 'published'）による
//   ライフサイクル管理
// - 旅行者属性（国籍・旅行スタイル・初回/リピート・予算感）
// - 実績・振り返り（実際の総費用、良かった点、もう一度なら変えること）
// - 公開・Copy機能（isPublic, copiedFromTripId, copyCount, saveCount）
// - 各アクティビティにspotId（既存SPOT/destinationsとの紐づけ）
//
// 既存フィールドは一切変更・削除していない。既存のTripデータ（新フィールドを
// 持たない）を読み込んだ場合、status等はデフォルト値で補って返す。
//
// GET    /api/trips                       → 自分が保存したTripを取得（認証必須）
// GET    /api/trips?public=1              → 公開済み（published）のTrip一覧を取得
//                                            （認証不要、Explore/Trips一覧用）
// GET    /api/trips?saved=1               → 自分がSaveした公開Tripの一覧（認証必須）
// POST   /api/trips                       → 新規保存（認証必須）
// POST   /api/trips?action=copy&sourceTripId=xxx
//                                          → 他人の公開TripをCopyして自分用に保存
// POST   /api/trips?action=save&tripId=xxx
//                                          → 他人の公開TripをMy Tripに保存（Save）
// PATCH  /api/trips?id=xxx                → 宿泊・食事の予約状況を更新（既存の挙動）
// PATCH  /api/trips?id=xxx&action=reflect → status・振り返り・旅行者属性を更新
// PATCH  /api/trips?id=xxx&action=publish → 振り返り入力済みのTripを公開する
// DELETE /api/trips?id=xxx                → 削除（認証必須、本人のみ）

import { kv } from '@vercel/kv';

export const config = { runtime: 'edge' };

const COLLECTION = 'trips';

type BookingStatus = 'not_booked' | 'booked';
export type TripStatus = 'planning' | 'traveling' | 'completed' | 'published';

interface TripStay {
  id: string;
  hotelName: string;
  checkInDay: number;
  checkOutDay: number;
  status: BookingStatus;
  actualCost?: number;
}

interface TripMeal {
  id: string;
  suggestion: string;
  status: BookingStatus;
  actualCost?: number;
}

interface TripActivity {
  type?: 'activity' | 'transport';
  transportMode?: 'walk' | 'train' | 'bus' | 'car' | 'taxi' | 'other';
  time?: string;
  title: string;
  description?: string;
  spotId?: string;
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

  // TABI 2.0 追加フィールド（既存データには存在しない場合があるため、
  // 読み込み時に applyDefaults() でデフォルト値を補う）
  status: TripStatus;
  // TABI 3.0：Recommended Trip（日本人Creatorが設計する、実際に旅行した
  // 必要のないおすすめ旅程）と、Actual Trip（外国人Travelerの実体験）を区別する。
  // 既存データは全て 'actual'（実際の旅程）として扱う。
  tripType: 'recommended' | 'actual';
  nationality?: string;
  travelStyle?: string;
  isFirstVisit?: boolean;
  budgetLevel?: string;
  totalDays: number;

  actualTotalCost?: number;
  reflectionWhatWorked?: string;
  reflectionWhatToChange?: string;

  isPublic: boolean;
  copiedFromTripId?: string;
  copyCount: number;
  saveCount: number;
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

function publishedIndexKey(): string {
  return `${COLLECTION}:published`;
}

function savedIndexKey(uid: string): string {
  return `user:${uid}:savedTrips`;
}

/** 既存データ（新フィールドを持たない）にデフォルト値を補う */
function applyDefaults(trip: Trip): Trip {
  return {
    ...trip,
    status: trip.status || 'planning',
    tripType: trip.tripType || 'actual',
    totalDays: trip.totalDays || trip.days.length,
    isPublic: trip.isPublic ?? false,
    copyCount: trip.copyCount ?? 0,
    saveCount: trip.saveCount ?? 0,
  };
}

async function listUserTrips(uid: string): Promise<Trip[]> {
  const ids = await kv.smembers(userIndexKey(uid));
  if (!ids || ids.length === 0) return [];
  const values = await kv.mget<Trip[]>(...ids.map((id) => recordKey(id)));
  return (values || []).filter((v): v is Trip => v !== null && v !== undefined).map(applyDefaults);
}

async function listPublishedTrips(): Promise<Trip[]> {
  const ids = await kv.smembers(publishedIndexKey());
  if (!ids || ids.length === 0) return [];
  const values = await kv.mget<Trip[]>(...ids.map((id) => recordKey(id)));
  return (values || []).filter((v): v is Trip => v !== null && v !== undefined).map(applyDefaults);
}

async function listSavedTrips(uid: string): Promise<Trip[]> {
  const ids = await kv.smembers(savedIndexKey(uid));
  if (!ids || ids.length === 0) return [];
  const values = await kv.mget<Trip[]>(...ids.map((id) => recordKey(id)));
  return (values || []).filter((v): v is Trip => v !== null && v !== undefined).map(applyDefaults);
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
  type?: 'activity' | 'transport';
  transportMode?: 'walk' | 'train' | 'bus' | 'car' | 'taxi' | 'other';
  time?: string;
  title?: string;
  description?: string;
  spotId?: string;
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
          type: item.type === 'transport' ? 'transport' as const : 'activity' as const,
          transportMode: item.type === 'transport' ? item.transportMode : undefined,
          time: item.time?.trim() || undefined,
          title: (item.title as string).trim(),
          description: item.description?.trim() || undefined,
          spotId: item.spotId?.trim() || undefined,
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
  const url = new URL(req.url);

  // ── GET: 公開Trip一覧（認証不要） ──
  if (req.method === 'GET' && url.searchParams.get('public') === '1') {
    try {
      const trips = await listPublishedTrips();
      trips.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      return jsonResponse({ trips }, 200);
    } catch (err) {
      return jsonResponse({ error: 'Failed to load published trips', detail: String(err) }, 500);
    }
  }

  const uid = await getAuthenticatedUid(req);
  if (!uid) {
    return jsonResponse({ error: 'You must be logged in to access trips' }, 401);
  }

  // ── GET: 自分がSaveした公開Trip一覧 ──
  if (req.method === 'GET' && url.searchParams.get('saved') === '1') {
    try {
      const trips = await listSavedTrips(uid);
      trips.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      return jsonResponse({ trips }, 200);
    } catch (err) {
      return jsonResponse({ error: 'Failed to load saved trips', detail: String(err) }, 500);
    }
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

  // ── POST: Copy（他人の公開Tripを自分用にコピー） ──
  if (req.method === 'POST' && url.searchParams.get('action') === 'copy') {
    const sourceTripId = url.searchParams.get('sourceTripId') || '';
    if (!sourceTripId) {
      return jsonResponse({ error: 'sourceTripId is required' }, 400);
    }
    try {
      const source = await kv.get<Trip>(recordKey(sourceTripId));
      if (!source || !source.isPublic) {
        return jsonResponse({ error: 'Source trip not found or not public' }, 404);
      }

      const id = crypto.randomUUID();
      const copy: Trip = {
        ...source,
        id,
        uid,
        status: 'planning',
        createdAt: new Date().toISOString(),
        isPublic: false,
        copiedFromTripId: source.id,
        copyCount: 0,
        saveCount: 0,
        actualTotalCost: undefined,
        reflectionWhatWorked: undefined,
        reflectionWhatToChange: undefined,
      };

      await kv.set(recordKey(id), copy);
      await kv.sadd(userIndexKey(uid), id);

      // 元TripのcopyCountを+1する
      const updatedSource = { ...source, copyCount: (source.copyCount || 0) + 1 };
      await kv.set(recordKey(source.id), updatedSource);

      return jsonResponse({ success: true, trip: copy }, 200);
    } catch (err) {
      return jsonResponse({ error: 'Failed to copy trip', detail: String(err) }, 500);
    }
  }

  // ── POST: Save（他人の公開TripをMy Tripに保存） ──
  if (req.method === 'POST' && url.searchParams.get('action') === 'save') {
    const tripId = url.searchParams.get('tripId') || '';
    if (!tripId) {
      return jsonResponse({ error: 'tripId is required' }, 400);
    }
    try {
      const trip = await kv.get<Trip>(recordKey(tripId));
      if (!trip || !trip.isPublic) {
        return jsonResponse({ error: 'Trip not found or not public' }, 404);
      }

      await kv.sadd(savedIndexKey(uid), tripId);

      const updatedTrip = { ...trip, saveCount: (trip.saveCount || 0) + 1 };
      await kv.set(recordKey(tripId), updatedTrip);

      return jsonResponse({ success: true }, 200);
    } catch (err) {
      return jsonResponse({ error: 'Failed to save trip', detail: String(err) }, 500);
    }
  }

  // ── POST: 新規保存 ──
  if (req.method === 'POST') {
    let body: {
      title?: string;
      summary?: string;
      stays?: unknown;
      days?: unknown;
      nationality?: string;
      travelStyle?: string;
      isFirstVisit?: boolean;
      budgetLevel?: string;
      tripType?: 'recommended' | 'actual';
    };
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
      status: 'planning',
      tripType: body.tripType === 'recommended' ? 'recommended' : 'actual',
      nationality: body.nationality?.trim() || undefined,
      travelStyle: body.travelStyle?.trim() || undefined,
      isFirstVisit: typeof body.isFirstVisit === 'boolean' ? body.isFirstVisit : undefined,
      budgetLevel: body.budgetLevel?.trim() || undefined,
      totalDays: days.length,
      isPublic: false,
      copyCount: 0,
      saveCount: 0,
    };

    try {
      await kv.set(recordKey(id), trip);
      await kv.sadd(userIndexKey(uid), id);
      return jsonResponse({ success: true, trip }, 200);
    } catch (err) {
      return jsonResponse({ error: 'Failed to save trip', detail: String(err) }, 500);
    }
  }

  // ── PATCH: status・振り返り・旅行者属性を更新 ──
  if (req.method === 'PATCH' && url.searchParams.get('action') === 'reflect') {
    const id = url.searchParams.get('id') || '';
    if (!id) {
      return jsonResponse({ error: 'id is required' }, 400);
    }

    let body: {
      status?: TripStatus;
      actualTotalCost?: number;
      reflectionWhatWorked?: string;
      reflectionWhatToChange?: string;
      nationality?: string;
      travelStyle?: string;
      isFirstVisit?: boolean;
      budgetLevel?: string;
    };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    try {
      const trip = await kv.get<Trip>(recordKey(id));
      if (!trip) {
        return jsonResponse({ error: 'Trip not found' }, 404);
      }
      if (trip.uid !== uid) {
        return jsonResponse({ error: 'You can only update your own trips' }, 403);
      }

      const updated: Trip = applyDefaults({
        ...trip,
        status: body.status || trip.status,
        actualTotalCost:
          typeof body.actualTotalCost === 'number' ? body.actualTotalCost : trip.actualTotalCost,
        reflectionWhatWorked: body.reflectionWhatWorked?.trim() || trip.reflectionWhatWorked,
        reflectionWhatToChange:
          body.reflectionWhatToChange?.trim() || trip.reflectionWhatToChange,
        nationality: body.nationality?.trim() || trip.nationality,
        travelStyle: body.travelStyle?.trim() || trip.travelStyle,
        isFirstVisit:
          typeof body.isFirstVisit === 'boolean' ? body.isFirstVisit : trip.isFirstVisit,
        budgetLevel: body.budgetLevel?.trim() || trip.budgetLevel,
      });

      await kv.set(recordKey(id), updated);
      return jsonResponse({ success: true, trip: updated }, 200);
    } catch (err) {
      return jsonResponse({ error: 'Failed to update trip', detail: String(err) }, 500);
    }
  }

  // ── PATCH: 公開する ──
  if (req.method === 'PATCH' && url.searchParams.get('action') === 'publish') {
    const id = url.searchParams.get('id') || '';
    if (!id) {
      return jsonResponse({ error: 'id is required' }, 400);
    }

    try {
      const trip = await kv.get<Trip>(recordKey(id));
      if (!trip) {
        return jsonResponse({ error: 'Trip not found' }, 404);
      }
      if (trip.uid !== uid) {
        return jsonResponse({ error: 'You can only publish your own trips' }, 403);
      }
      if (trip.status !== 'completed') {
        return jsonResponse(
          { error: 'Only trips with status "completed" can be published. Please add your reflection first.' },
          400
        );
      }

      const updated: Trip = { ...trip, status: 'published', isPublic: true, tripType: 'actual' };
      await kv.set(recordKey(id), updated);
      await kv.sadd(publishedIndexKey(), id);

      return jsonResponse({ success: true, trip: updated }, 200);
    } catch (err) {
      return jsonResponse({ error: 'Failed to publish trip', detail: String(err) }, 500);
    }
  }

  // ── PATCH: Recommended Tripとして公開する（振り返り不要） ──
  // TABI 3.0：日本人Creatorが「実際に旅行していなくても」設計できる
  // おすすめ旅程。Actual Tripのような振り返り・実費用の入力は求めない。
  if (req.method === 'PATCH' && url.searchParams.get('action') === 'publishRecommended') {
    const id = url.searchParams.get('id') || '';
    if (!id) {
      return jsonResponse({ error: 'id is required' }, 400);
    }

    try {
      const trip = await kv.get<Trip>(recordKey(id));
      if (!trip) {
        return jsonResponse({ error: 'Trip not found' }, 404);
      }
      if (trip.uid !== uid) {
        return jsonResponse({ error: 'You can only publish your own trips' }, 403);
      }

      const updated: Trip = {
        ...trip,
        status: 'published',
        isPublic: true,
        tripType: 'recommended',
      };
      await kv.set(recordKey(id), updated);
      await kv.sadd(publishedIndexKey(), id);

      return jsonResponse({ success: true, trip: updated }, 200);
    } catch (err) {
      return jsonResponse(
        { error: 'Failed to publish recommended trip', detail: String(err) },
        500
      );
    }
  }

  // ── PATCH: 宿泊・食事の予約状況を更新（既存の挙動） ──
  if (req.method === 'PATCH') {
    const id = url.searchParams.get('id') || '';
    if (!id) {
      return jsonResponse({ error: 'id is required' }, 400);
    }

    let body: { targetId?: string; status?: string; actualCost?: number };
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
          return { ...s, status, actualCost: body.actualCost ?? s.actualCost };
        }
        return s;
      });

      trip.days = trip.days.map((d) => {
        const meals = { ...d.meals };
        (['breakfast', 'lunch', 'dinner'] as const).forEach((key) => {
          const meal = meals[key];
          if (meal && meal.id === targetId) {
            updated = true;
            meals[key] = { ...meal, status, actualCost: body.actualCost ?? meal.actualCost };
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
      if (existing.isPublic) {
        await kv.srem(publishedIndexKey(), id);
      }
      return jsonResponse({ success: true }, 200);
    } catch (err) {
      return jsonResponse({ error: 'Failed to delete trip', detail: String(err) }, 500);
    }
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}
