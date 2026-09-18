export type BookingStatus = 'not_booked' | 'booked';

export interface TripStay {
  id: string;
  hotelName: string;
  checkInDay: number;
  checkOutDay: number;
  status: BookingStatus;
}

export interface TripMeal {
  id: string;
  suggestion: string;
  status: BookingStatus;
}

export type ActivityType = 'activity' | 'transport';
export type TransportMode = 'walk' | 'train' | 'bus' | 'car' | 'taxi' | 'other';

export interface TripActivity {
  type?: ActivityType;
  transportMode?: TransportMode;
  time?: string;
  title: string;
  description?: string;
  // API側（api/trips.ts）には元から存在するSPOT紐づけ用フィールド。
  // days[].activities は items モデルへの移行前の旧構造だが、まだ
  // 存在する既存Tripのヘッダー画像取得（getHeaderImages）等で参照される
  // ため、フロント側の型にも反映する（2026-09-18修正）。
  spotId?: string;
}

export interface TripDay {
  day: number;
  date?: string;
  activities: TripActivity[];
  meals: {
    breakfast?: TripMeal;
    lunch?: TripMeal;
    dinner?: TripMeal;
  };
}

export type TripStatus = 'planning' | 'traveling' | 'completed' | 'published';
export type TripKind = 'recommended' | 'actual';

export type PlanLevel = 'saved' | 'day_assigned' | 'scheduled';
export type ItemStatus = 'fixed' | 'planned' | 'option';

export interface TripItem {
  id: string;
  itemType: 'sightseeing' | 'restaurant' | 'shopping' | 'accommodation' | 'activity' | 'transport' | 'other';
  title: string;
  spotId?: string;
  imageUrl?: string;
  description?: string;
  planLevel: PlanLevel;
  day?: number;
  time?: string;
  status: ItemStatus;
  optionGroupId?: string;
  // TABI 3.0：この項目をMeals（B/L/D）欄に表示するかどうか。SPOTデータには
  // レストランを判別できる明確なカテゴリがないため、自動判定ではなく
  // ユーザーが手動で「これは食事です」と指定する方式にしている。
  mealSlot?: 'breakfast' | 'lunch' | 'dinner';
  // TABI 3.0：SCHEDULE列でのドラッグ並び替え用。同じday内での表示順
  // （小さいほど先）。未設定の場合は時刻順にフォールバックする。
  order?: number;
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

  status?: TripStatus;
  tripType?: TripKind;
  nationality?: string;
  travelStyle?: string;
  isFirstVisit?: boolean;
  budgetLevel?: string;
  totalDays?: number;

  actualTotalCost?: number;
  reflectionWhatWorked?: string;
  reflectionWhatToChange?: string;

  isPublic?: boolean;
  copiedFromTripId?: string;
  copyCount?: number;
  saveCount?: number;

  // TABI47：パンフレット風カード表示に必要なCreatorが設定するメタ情報。
  // API側（api/trips.ts）には元から存在していたが、フロントのTrip型に
  // 反映されていなかったため、呼び出し側で(trip as any)による回避が
  // 発生していた（2026-09-18修正）。
  highlights?: string[];
  tags?: string[];
  budgetMin?: number;
  budgetMax?: number;
  authorName?: string;
  coverImageUrl?: string;

  items?: TripItem[];
  actualVisitLog?: ActualVisitLogEntry[];
  // TABI 3.0：days[].activitiesからitemsへの自動移行が完了したかどうか。
  // trueの場合、SCHEDULE表示はitemsのみを見る（daysの元データは互換性の
  // ため保持し続けるが、表示には使わない）。
  daysActivitiesMigrated?: boolean;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function formatSavedDate(iso: string): string {
  if (!iso) return iso;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `Saved on ${MONTH_NAMES[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}
