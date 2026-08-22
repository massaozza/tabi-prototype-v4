export interface Experience {
  id: string;
  uid: string;
  authorName: string;
  createdAt: string;
  placeName: string;
  area: string;
  category: string;
  visitedMonth: string;
  travelStyle: string;
  companions?: string;
  budgetLevel?: string;
  whatWasGood: string;
  whatWasHard?: string;
  tip?: string;
  wouldRecommend: boolean;
  photos: string[];
}

export const AREA_LABELS: Record<string, string> = {
  kamakura: 'Kamakura',
  enoshima: 'Enoshima',
  shonan: 'Shonan Coast',
  other: 'Other',
};

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

export function formatArea(area: string): string {
  return AREA_LABELS[area] ?? area;
}

export function formatMonth(visitedMonth: string): string {
  if (!visitedMonth) return visitedMonth;
  const parts = visitedMonth.split('-');
  if (parts.length !== 2) return visitedMonth;
  const year = parts[0];
  const monthIndex = Number(parts[1]) - 1;
  if (!year || Number.isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return visitedMonth;
  }
  return `${MONTH_NAMES[monthIndex]} ${year}`;
}
