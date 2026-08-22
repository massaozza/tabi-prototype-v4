export interface TripItem {
  time?: string;
  title: string;
  description?: string;
}

export interface TripDay {
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
