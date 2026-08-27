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
