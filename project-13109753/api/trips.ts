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
// PATCH  /api/trips?id=xxx&action=addItem → TripItemを追加
// PATCH  /api/trips?id=xxx&action=updateItem → TripItemを更新
// PATCH  /api/trips?id=xxx&action=removeItem → TripItemを削除
// PATCH  /api/trips?id=xxx&action=migrateActivitiesToItems
//                                          → 古いTripのdays[].activitiesをitems化（1回のみ）
// PATCH  /api/trips?id=xxx&action=reorderDayItems
//                                          → SCHEDULE列のドラッグ並び替え結果を保存
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

// TABI 3.0：My Trip中心の循環（Plan → Travel → Actual Trip → Review → Share）の
// 基盤となる、計画レベル・ステータスを持つTripItem。
// 既存の days[].activities（確定した旅程の表示用）とは別の配列として持たせ、
// 「計画中の柔軟な管理」に使う。互換性のため、既存フィールドには一切触れない。
export type PlanLevel = 'saved' | 'day_assigned' | 'scheduled';
export type ItemStatus = 'fixed' | 'planned' | 'option';
// TABI 3.0：旅行で実際に行く「場所の種類」。TABIのコンテンツ種別
// （TRIP/SPOT/EXPERIENCE）とは別の概念。'restaurant'のみMeals（B/L/D）への
// 割り当てが可能。
export type ItemType =
  | 'sightseeing'
  | 'restaurant'
  | 'shopping'
  | 'accommodation'
  | 'activity'
  | 'transport'
  | 'other';

export interface TripItem {
  id: string;
  itemType: ItemType;
  title: string;
  spotId?: string;

  // 「Saved for Trip」カード表示用（SPOT詳細ページのdestinationから受け取る）。
  // 古いデータ（この変更前に追加されたItem）には存在しないため、
  // フロントエンド側では常にオプショナルとして扱い、フォールバック表示にする。
  imageUrl?: string;
  description?: string;

  planLevel: PlanLevel;
  day?: number; // day_assigned 以上で設定
  time?: string; // scheduled でのみ設定

  status: ItemStatus;
  optionGroupId?: string; // status: 'option' の場合、同じ候補グループをまとめるID

  // TABI 3.0：この項目をMeals（B/L/D）欄に表示するかどうか。SPOTデータには
  // レストランを判別できる明確なカテゴリがないため、自動判定ではなく
  // ユーザーが手動で「これは食事です」と指定する方式にしている。
  mealSlot?: 'breakfast' | 'lunch' | 'dinner';

  // TABI 3.0：SCHEDULE列でのドラッグ並び替え用。同じday内での表示順
  // （小さいほど先）。未設定の場合は時刻順にフォールバックする。
  order?: number;

  createdAt: string;
}

export interface ActualVisitLogEntry {
  itemId: string;
  visitedAt: string;
  order: number;
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

  // TABI47：パンフレット風カード表示に必要なCreatorが設定するメタ情報。
  // highlights … カードに表示するハイライト（英語、最大3点）
  // tags       … 旅行スタイルタグ（Solo / Couple / Family / Culture / Food ...）
  // budgetMin/Max … 予算目安（円/人）
  // authorName … Creator表示名
  highlights?: string[];
  tags?: string[];
  budgetMin?: number;
  budgetMax?: number;
  authorName?: string;

  isPublic: boolean;
  copiedFromTripId?: string;
  copyCount: number;
  saveCount: number;

  // TABI 3.0：My Trip中心の循環の基盤（既存データには存在しない場合があるため、
  // applyDefaults() で空配列を補う）
  items?: TripItem[];
  actualVisitLog?: ActualVisitLogEntry[];
  derivedFromActualTripId?: string;
  // TABI 3.0：days[].activitiesからitemsへの自動移行が完了したかどうか。
  daysActivitiesMigrated?: boolean;
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
// TABI 3.0：My Trip中心の循環。Recommended Trip等をCopyした際、
// days[].activities（従来の確定旅程表示用データ）から、Trip Planner用の
// items（planLevel/statusを持つ、柔軟な計画管理用データ）を生成する。
// これにより、Copy直後からTrip Plannerで「Saved for Trip」等として
// 扱えるようになり、SCHEDULE表示とTrip Plannerの両方が同じデータを指す。
// 既存のdays配列自体は変更しない（互換性維持）。
function buildItemsFromDays(days: TripDay[]): TripItem[] {
  const items: TripItem[] = [];
  for (const day of days || []) {
    let order = 0;
    for (const activity of day.activities || []) {
      if (activity.type === 'transport') continue; // 移動手段はitem化しない
      items.push({
        id: crypto.randomUUID(),
        itemType: 'sightseeing',
        title: activity.title,
        spotId: activity.spotId,
        description: activity.description,
        planLevel: activity.time ? 'scheduled' : 'day_assigned',
        day: day.day,
        time: activity.time,
        order: order++,
        status: 'planned',
        createdAt: new Date().toISOString(),
      });
    }
  }
  return items;
}

function applyDefaults(trip: Trip): Trip {
  return {
    ...trip,
    status: trip.status || 'planning',
    tripType: trip.tripType || 'actual',
    totalDays: trip.totalDays || trip.days.length,
    isPublic: trip.isPublic ?? false,
    copyCount: trip.copyCount ?? 0,
    saveCount: trip.saveCount ?? 0,
    items: trip.items ?? [],
    actualVisitLog: trip.actualVisitLog ?? [],
  };
}

async function listUserTrips(uid: string): Promise<Trip[]> {
  const ids = await kv.smembers(userIndexKey(uid));
  if (!ids || ids.length === 0) return [];
  const values = await kv.mget<Trip[]>(...ids.map((id) => recordKey(id)));
  return (values || []).filter((v): v is Trip => v !== null && v !== undefined).map(applyDefaults);
}

/**
 * 公開Tripの「おすすめ順」スコアを計算する。
 * Copy数（最も強いシグナル：実際に使いたいと思われた）を最も重視し、
 * 次にSave数、閲覧数は補助的な重みにとどめる。
 * また、新しく投稿されたTripが埋もれないよう、30日かけて減衰する
 * 「新しさボーナス」を加える。
 */
function computeTripScore(trip: Trip, views: number): number {
  const daysSinceCreated =
    (Date.now() - new Date(trip.createdAt).getTime()) / (1000 * 60 * 60 * 24);
  const recencyBonus = Math.max(0, 15 - daysSinceCreated * 0.5);
  return (trip.copyCount || 0) * 5 + (trip.saveCount || 0) * 3 + views * 0.1 + recencyBonus;
}

async function listPublishedTrips(): Promise<Trip[]> {
  const ids = await kv.smembers(publishedIndexKey());
  if (!ids || ids.length === 0) return [];
  const values = await kv.mget<Trip[]>(...ids.map((id) => recordKey(id)));
  const trips = (values || [])
    .filter((v): v is Trip => v !== null && v !== undefined)
    .map(applyDefaults);

  // 閲覧数を取得し、スコア順に並び替える
  // （views:trip:{id} キーは api/track-view.ts と共通のKVストアを参照している）
  const viewValues = await kv.mget<number[]>(...trips.map((t) => `views:trip:${t.id}`));
  const scored = trips.map((trip, idx) => ({
    trip,
    score: computeTripScore(trip, viewValues?.[idx] ?? 0),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.trip);
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
      // 既存にitemsを持つ場合はそれを引き継ぎ（id再発行）、持たない場合は
      // days[].activitiesから生成する。両方は起きない想定だが、念のため
      // 両方あれば両方引き継ぐ。
      const carriedItems: TripItem[] = (source.items || []).map((it) => ({
        ...it,
        id: crypto.randomUUID(),
      }));
      const generatedItems =
        carriedItems.length > 0 ? [] : buildItemsFromDays(source.days || []);

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
        items: [...carriedItems, ...generatedItems],
        daysActivitiesMigrated: true,
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
      highlights?: string[];
      tags?: string[];
      budgetMin?: number;
      budgetMax?: number;
      authorName?: string;
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
      highlights: Array.isArray(body.highlights)
        ? body.highlights.map((h) => String(h).trim()).filter(Boolean).slice(0, 3)
        : undefined,
      tags: Array.isArray(body.tags)
        ? body.tags.map((t) => String(t).trim()).filter(Boolean)
        : undefined,
      budgetMin: typeof body.budgetMin === 'number' ? body.budgetMin : undefined,
      budgetMax: typeof body.budgetMax === 'number' ? body.budgetMax : undefined,
      authorName: body.authorName?.trim() || undefined,
      isPublic: false,
      copyCount: 0,
      saveCount: 0,
      // TABI 3.0：daysで作成された旅程も、最初からTrip Planner（items）で
      // 管理できるようにする
      items: buildItemsFromDays(days),
      daysActivitiesMigrated: true,
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

  // ── PATCH: 既存Tripに、SPOTを1件アクティビティとして追加する ──
  // TABI 3.0：SPOT詳細ページ等から、「+ Add to Trip」で、自分の既存Tripに
  // その場所を直接追加できるようにする（Mindtrip等を参考にした機能）。
  // day を指定しなければ、最後の日に追加する（Tripに日が無ければDay 1を作る）。
  if (req.method === 'PATCH' && url.searchParams.get('action') === 'addSpot') {
    const id = url.searchParams.get('id') || '';
    if (!id) {
      return jsonResponse({ error: 'id is required' }, 400);
    }

    let body: { title?: string; spotId?: string; day?: number };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const title = (body.title || '').trim();
    if (!title) {
      return jsonResponse({ error: 'title is required' }, 400);
    }

    try {
      const trip = await kv.get<Trip>(recordKey(id));
      if (!trip) {
        return jsonResponse({ error: 'Trip not found' }, 404);
      }
      if (trip.uid !== uid) {
        return jsonResponse({ error: 'You can only edit your own trips' }, 403);
      }

      const days = [...(trip.days || [])];
      const targetDayNum =
        typeof body.day === 'number' ? body.day : days.length > 0 ? days[days.length - 1].day : 1;

      const dayIndex = days.findIndex((d) => d.day === targetDayNum);
      const newActivity: TripActivity = {
        type: 'activity',
        title,
        spotId: body.spotId?.trim() || undefined,
      };

      if (dayIndex >= 0) {
        days[dayIndex] = {
          ...days[dayIndex],
          activities: [...days[dayIndex].activities, newActivity],
        };
      } else {
        days.push({ day: targetDayNum, activities: [newActivity], meals: {} });
      }

      const updated = applyDefaults({ ...trip, days });
      await kv.set(recordKey(id), updated);

      return jsonResponse({ success: true, trip: updated }, 200);
    } catch (err) {
      return jsonResponse({ error: 'Failed to add spot to trip', detail: String(err) }, 500);
    }
  }

  // ── PATCH: TripItemを追加する（計画レベル・ステータス付き） ──
  // TABI 3.0：My Trip中心の循環の基盤。SPOT/Restaurant/Experienceを、
  // 「まだ日程未定（saved）」「日だけ決めた（day_assigned）」「時間まで決めた
  // （scheduled）」のいずれかとして追加できる。
  if (req.method === 'PATCH' && url.searchParams.get('action') === 'addItem') {
    const id = url.searchParams.get('id') || '';
    if (!id) return jsonResponse({ error: 'id is required' }, 400);

    let body: {
      title?: string;
      spotId?: string;
      itemType?: ItemType;
      imageUrl?: string;
      description?: string;
      planLevel?: PlanLevel;
      day?: number;
      time?: string;
      status?: ItemStatus;
      optionGroupId?: string;
      mealSlot?: 'breakfast' | 'lunch' | 'dinner';
    };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const title = (body.title || '').trim();
    if (!title) return jsonResponse({ error: 'title is required' }, 400);

    try {
      const trip = await kv.get<Trip>(recordKey(id));
      if (!trip) return jsonResponse({ error: 'Trip not found' }, 404);
      if (trip.uid !== uid) {
        return jsonResponse({ error: 'You can only edit your own trips' }, 403);
      }

      const newItem: TripItem = {
        id: crypto.randomUUID(),
        itemType: body.itemType || 'sightseeing',
        title,
        spotId: body.spotId?.trim() || undefined,
        imageUrl: body.imageUrl?.trim() || undefined,
        description: body.description?.trim() || undefined,
        planLevel: body.planLevel || 'saved',
        day: body.day,
        time: body.time,
        status: body.status || 'planned',
        optionGroupId: body.optionGroupId,
        mealSlot: body.mealSlot,
        createdAt: new Date().toISOString(),
      };

      const updated = applyDefaults({
        ...trip,
        items: [...(trip.items || []), newItem],
      });
      await kv.set(recordKey(id), updated);

      return jsonResponse({ success: true, trip: updated, item: newItem }, 200);
    } catch (err) {
      return jsonResponse({ error: 'Failed to add item', detail: String(err) }, 500);
    }
  }

  // ── PATCH: TripItemを更新する（計画レベルを進める・ステータス変更等） ──
  if (req.method === 'PATCH' && url.searchParams.get('action') === 'updateItem') {
    const id = url.searchParams.get('id') || '';
    if (!id) return jsonResponse({ error: 'id is required' }, 400);

    let body: {
      itemId?: string;
      planLevel?: PlanLevel;
      day?: number;
      time?: string;
      status?: ItemStatus;
      optionGroupId?: string;
      // 'none' を送ることで、設定済みのmealSlotを明示的に解除できる
      mealSlot?: 'breakfast' | 'lunch' | 'dinner' | 'none';
    };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const itemId = body.itemId || '';
    if (!itemId) return jsonResponse({ error: 'itemId is required' }, 400);

    try {
      const trip = await kv.get<Trip>(recordKey(id));
      if (!trip) return jsonResponse({ error: 'Trip not found' }, 404);
      if (trip.uid !== uid) {
        return jsonResponse({ error: 'You can only edit your own trips' }, 403);
      }

      const items = trip.items || [];
      const idx = items.findIndex((i) => i.id === itemId);
      if (idx < 0) return jsonResponse({ error: 'Item not found' }, 404);

      const resolvedDay = body.day ?? items[idx].day;
      // Dayが（新しく）割り当てられて、まだorderを持っていない場合は、
      // その日の末尾（最大order + 1）に配置する
      let resolvedOrder = items[idx].order;
      if (resolvedOrder === undefined && resolvedDay !== undefined) {
        const maxOrder = items.reduce((max, i) => {
          if (i.id === itemId) return max;
          if ((i.day || 1) !== resolvedDay || i.order === undefined) return max;
          return Math.max(max, i.order);
        }, -1);
        resolvedOrder = maxOrder + 1;
      }

      const updatedItem: TripItem = {
        ...items[idx],
        planLevel: body.planLevel ?? items[idx].planLevel,
        day: resolvedDay,
        time: body.time ?? items[idx].time,
        status: body.status ?? items[idx].status,
        optionGroupId: body.optionGroupId ?? items[idx].optionGroupId,
        mealSlot:
          body.mealSlot === undefined
            ? items[idx].mealSlot
            : body.mealSlot === 'none'
              ? undefined
              : body.mealSlot,
        order: resolvedOrder,
      };
      const newItems = [...items];
      newItems[idx] = updatedItem;

      const updated = applyDefaults({ ...trip, items: newItems });
      await kv.set(recordKey(id), updated);

      return jsonResponse({ success: true, trip: updated, item: updatedItem }, 200);
    } catch (err) {
      return jsonResponse({ error: 'Failed to update item', detail: String(err) }, 500);
    }
  }

  // ── PATCH: 既存のdays[].activitiesを、まだitems化されていない場合に限り
  //           itemsへ変換する（1回だけ実行、以後はdaysActivitiesMigratedで
  //           スキップする）。SCHEDULE列でのドラッグ並び替え等、items基盤の
  //           機能を、Copyより前の古いTripにも使えるようにするための移行。
  //           daysの元データ自体は削除・変更しない（互換性維持）。 ──
  if (req.method === 'PATCH' && url.searchParams.get('action') === 'migrateActivitiesToItems') {
    const id = url.searchParams.get('id') || '';
    if (!id) return jsonResponse({ error: 'id is required' }, 400);

    try {
      const trip = await kv.get<Trip>(recordKey(id));
      if (!trip) return jsonResponse({ error: 'Trip not found' }, 404);
      if (trip.uid !== uid) {
        return jsonResponse({ error: 'You can only edit your own trips' }, 403);
      }

      if (trip.daysActivitiesMigrated) {
        // 既に移行済みなら何もしない（冗長な呼び出しに対して安全）
        return jsonResponse({ success: true, trip: applyDefaults(trip) }, 200);
      }

      const migratedItems = buildItemsFromDays(trip.days || []);
      const updated = applyDefaults({
        ...trip,
        items: [...(trip.items || []), ...migratedItems],
        daysActivitiesMigrated: true,
      });
      await kv.set(recordKey(id), updated);

      return jsonResponse({ success: true, trip: updated }, 200);
    } catch (err) {
      return jsonResponse({ error: 'Failed to migrate activities', detail: String(err) }, 500);
    }
  }

  // ── PATCH: SCHEDULE列でのドラッグ並び替え結果を保存する。
  //           指定したday内のitemIdsを、新しい順番（配列の並び）でorderに
  //           反映する。 ──
  if (req.method === 'PATCH' && url.searchParams.get('action') === 'reorderDayItems') {
    const id = url.searchParams.get('id') || '';
    if (!id) return jsonResponse({ error: 'id is required' }, 400);

    let body: { day?: number; itemIds?: string[] };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const day = body.day;
    const itemIds = Array.isArray(body.itemIds) ? body.itemIds : [];
    if (day === undefined || itemIds.length === 0) {
      return jsonResponse({ error: 'day and itemIds are required' }, 400);
    }

    try {
      const trip = await kv.get<Trip>(recordKey(id));
      if (!trip) return jsonResponse({ error: 'Trip not found' }, 404);
      if (trip.uid !== uid) {
        return jsonResponse({ error: 'You can only edit your own trips' }, 403);
      }

      const orderIndex = new Map(itemIds.map((itemId, i) => [itemId, i]));
      const newItems = (trip.items || []).map((it) => {
        if (!orderIndex.has(it.id)) return it;
        return { ...it, order: orderIndex.get(it.id) };
      });

      const updated = applyDefaults({ ...trip, items: newItems });
      await kv.set(recordKey(id), updated);

      return jsonResponse({ success: true, trip: updated }, 200);
    } catch (err) {
      return jsonResponse({ error: 'Failed to reorder items', detail: String(err) }, 500);
    }
  }

  // ── PATCH: TripItemを削除する ──
  if (req.method === 'PATCH' && url.searchParams.get('action') === 'removeItem') {
    const id = url.searchParams.get('id') || '';
    if (!id) return jsonResponse({ error: 'id is required' }, 400);

    let body: { itemId?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const itemId = body.itemId || '';
    if (!itemId) return jsonResponse({ error: 'itemId is required' }, 400);

    try {
      const trip = await kv.get<Trip>(recordKey(id));
      if (!trip) return jsonResponse({ error: 'Trip not found' }, 404);
      if (trip.uid !== uid) {
        return jsonResponse({ error: 'You can only edit your own trips' }, 403);
      }

      const items = (trip.items || []).filter((i) => i.id !== itemId);
      const updated = applyDefaults({ ...trip, items });
      await kv.set(recordKey(id), updated);

      return jsonResponse({ success: true, trip: updated }, 200);
    } catch (err) {
      return jsonResponse({ error: 'Failed to remove item', detail: String(err) }, 500);
    }
  }

  // ── PATCH: 旅行を開始する（Travel Modeへ移行） ──
  if (req.method === 'PATCH' && url.searchParams.get('action') === 'startTravel') {
    const id = url.searchParams.get('id') || '';
    if (!id) return jsonResponse({ error: 'id is required' }, 400);

    try {
      const trip = await kv.get<Trip>(recordKey(id));
      if (!trip) return jsonResponse({ error: 'Trip not found' }, 404);
      if (trip.uid !== uid) {
        return jsonResponse({ error: 'You can only edit your own trips' }, 403);
      }

      const updated = applyDefaults({
        ...trip,
        status: 'traveling',
        actualVisitLog: trip.actualVisitLog && trip.actualVisitLog.length > 0
          ? trip.actualVisitLog
          : [],
      });
      await kv.set(recordKey(id), updated);

      return jsonResponse({ success: true, trip: updated }, 200);
    } catch (err) {
      return jsonResponse({ error: 'Failed to start travel', detail: String(err) }, 500);
    }
  }

  // ── PATCH: 実際に訪問したことを記録する（Travel Mode中） ──
  // 【設計方針】旅行中にユーザーへ大量の入力を要求しないため、
  // 「訪問した」を押すだけの、ワンタップの記録にとどめる。訪問順序は、
  // このAPIが呼ばれた順に自動的に記録される。
  if (req.method === 'PATCH' && url.searchParams.get('action') === 'markVisited') {
    const id = url.searchParams.get('id') || '';
    if (!id) return jsonResponse({ error: 'id is required' }, 400);

    let body: { itemId?: string; title?: string; spotId?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    try {
      const trip = await kv.get<Trip>(recordKey(id));
      if (!trip) return jsonResponse({ error: 'Trip not found' }, 404);
      if (trip.uid !== uid) {
        return jsonResponse({ error: 'You can only edit your own trips' }, 403);
      }

      let items = trip.items || [];
      let itemId = body.itemId || '';

      // itemIdが無い場合、予定に無かった場所を旅行中に追加した扱いにする
      if (!itemId) {
        const title = (body.title || '').trim();
        if (!title) return jsonResponse({ error: 'itemId or title is required' }, 400);
        const newItem: TripItem = {
          id: crypto.randomUUID(),
          itemType: 'sightseeing',
          title,
          spotId: body.spotId?.trim() || undefined,
          planLevel: 'scheduled',
          status: 'planned',
          createdAt: new Date().toISOString(),
        };
        items = [...items, newItem];
        itemId = newItem.id;
      }

      const log = trip.actualVisitLog || [];
      if (log.some((l) => l.itemId === itemId)) {
        return jsonResponse({ error: 'This item is already marked as visited' }, 400);
      }

      const newLogEntry: ActualVisitLogEntry = {
        itemId,
        visitedAt: new Date().toISOString(),
        order: log.length + 1,
      };

      const updated = applyDefaults({
        ...trip,
        items,
        actualVisitLog: [...log, newLogEntry],
      });
      await kv.set(recordKey(id), updated);

      return jsonResponse({ success: true, trip: updated }, 200);
    } catch (err) {
      return jsonResponse({ error: 'Failed to mark visited', detail: String(err) }, 500);
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
