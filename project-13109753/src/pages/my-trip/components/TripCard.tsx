import { useEffect, useState } from 'react';
import type { BookingStatus, Trip, TripDay, TripItem, TripMeal, TripStay, TransportMode } from '../types';
import { formatSavedDate } from '../types';
import ReflectionModal from './ReflectionModal';
import TripPlanningPanel from './TripPlanningPanel';

const TRANSPORT_ICONS: Record<TransportMode, string> = {
  walk: 'ri-walk-line',
  train: 'ri-train-line',
  bus: 'ri-bus-2-line',
  car: 'ri-car-line',
  taxi: 'ri-taxi-line',
  other: 'ri-route-line',
};

function transportIcon(mode?: TransportMode): string {
  return TRANSPORT_ICONS[mode ?? 'other'] || TRANSPORT_ICONS.other;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  planning: { label: 'Planning', className: 'bg-background-100 text-foreground-600' },
  traveling: { label: 'Traveling', className: 'bg-accent-100 text-accent-700' },
  completed: { label: 'Completed', className: 'bg-secondary-100 text-secondary-700' },
  published: { label: 'Published', className: 'bg-primary-100 text-primary-700' },
};

const TRIP_TYPE_BADGE: Record<string, { label: string; className: string }> = {
  recommended: { label: 'Recommended Trip', className: 'bg-accent-50 text-accent-700 border border-accent-200' },
  actual: { label: 'Actual Trip', className: 'bg-primary-50 text-primary-700 border border-primary-200' },
};

interface DayRow {
  day: TripDay;
  stay?: TripStay;
  /** rowSpan for the Stay cell. 0 means "don't render this cell, it's merged into a previous row". */
  staySpan: number;
}

// TABI 3.0：SCHEDULE表示の並び替え用。「09:24」のような実時刻と、
// 「morning」「afternoon」のような大まかなラベル（Creatorが手動作成した
// Recommended Tripのdays.activitiesで使われる）が混在するため、
// どちらでも比較できるよう、並び替え専用の代表時刻に正規化する。
// 表示上の文字列（activity.time / item.time）自体は変更しない。
const QUALITATIVE_TIME_SORT_KEY: Record<string, string> = {
  morning: '07:00',
  afternoon: '13:00',
  evening: '18:00',
  night: '21:00',
};

function timeSortKey(time?: string): string {
  if (!time) return '99:99'; // 時刻未設定は最後に表示
  const normalized = time.trim().toLowerCase();
  if (QUALITATIVE_TIME_SORT_KEY[normalized]) return QUALITATIVE_TIME_SORT_KEY[normalized];
  if (/^\d{1,2}:\d{2}$/.test(time.trim())) return time.trim();
  return '99:98'; // 認識できない形式は、時刻未設定の直前に表示
}

interface ScheduleEntry {
  key: string;
  itemId?: string;
  time?: string;
  title: string;
  description?: string;
}

function findStayForDay(stays: TripStay[], dayNum: number): TripStay | undefined {
  return stays.find((s) => dayNum >= s.checkInDay && dayNum <= s.checkOutDay);
}

// TABI 3.0：My Trip中心の循環。Trip Planner（items配列）でDayに割り当てられた
// SPOT/Restaurant/Experienceを、元の旅程（SCHEDULE列、days[].activities）にも
// 反映して見せるためのヘルパー。items配列を書き換えず「表示用に統合」するだけ
// なので、既存のdays構造・保存処理には一切影響しない。
// 並び順はドラッグで保存された`order`を優先し、未設定の場合のみ時刻順に
// フォールバックする。
function getItemsForDay(items: TripItem[] | undefined, dayNum: number): TripItem[] {
  return (items || [])
    .filter((it) => it.planLevel !== 'saved' && (it.day || 1) === dayNum)
    .sort((a, b) => {
      if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
      if (a.order !== undefined) return -1;
      if (b.order !== undefined) return 1;
      if (a.time && b.time) return a.time.localeCompare(b.time);
      if (a.time) return -1;
      if (b.time) return 1;
      return 0;
    });
}

/** Builds one row per day, grouping consecutive days under the same stay so the
 * "Stay" column can be rendered with a single merged (rowSpan) cell, matching
 * a typical day-by-day itinerary table layout. */
function buildDayRows(days: TripDay[], stays: TripStay[]): DayRow[] {
  const sorted = [...days].sort((a, b) => a.day - b.day);
  const withStay = sorted.map((day) => ({ day, stay: findStayForDay(stays, day.day) }));

  const rows: DayRow[] = [];
  let i = 0;
  while (i < withStay.length) {
    const stay = withStay[i].stay;
    if (!stay) {
      rows.push({ day: withStay[i].day, stay: undefined, staySpan: 1 });
      i += 1;
      continue;
    }
    let j = i;
    while (j < withStay.length && withStay[j].stay?.id === stay.id) j += 1;
    const span = j - i;
    for (let k = i; k < j; k += 1) {
      rows.push({ day: withStay[k].day, stay, staySpan: k === i ? span : 0 });
    }
    i = j;
  }
  return rows;
}

interface TripCardProps {
  trip: Trip;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onBookingStatusChange: (tripId: string, targetId: string) => void;
  onTripUpdate: (updatedTrip: Trip) => void;
}

export default function TripCard({
  trip,
  expanded,
  onToggle,
  onDelete,
  onBookingStatusChange,
  onTripUpdate,
}: TripCardProps) {
  const dayCount = trip.days?.length || 0;
  const [pendingBookingId, setPendingBookingId] = useState<string | null>(null);
  const [bookingErrors, setBookingErrors] = useState<Record<string, string>>({});
  const [showReflectionModal, setShowReflectionModal] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [migrating, setMigrating] = useState(false);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);

  const status = trip.status || 'planning';
  const statusBadge = STATUS_BADGE[status] || STATUS_BADGE.planning;

  // TABI 3.0：Copyより前に作られた古いTripは、days[].activities（長谷寺・江ノ島
  // など）がまだitems化されていない。SCHEDULE列を開いたときに1回だけ自動で
  // itemsへ移行し、以後はTrip Plannerでの編集・SCHEDULE列でのドラッグ並び替え
  // の対象にする。daysの元データ自体は変更しない。
  useEffect(() => {
    if (!expanded) return;
    if (trip.daysActivitiesMigrated) return;
    const hasActivities = (trip.days || []).some(
      (d) => (d.activities || []).some((a) => a.type !== 'transport')
    );
    if (!hasActivities) return;
    if (migrating) return;

    setMigrating(true);
    fetch(`/api/trips?id=${encodeURIComponent(trip.id)}&action=migrateActivitiesToItems`, {
      method: 'PATCH',
      credentials: 'include',
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.trip) onTripUpdate(data.trip);
      })
      .catch(() => {
        // 移行に失敗しても、既存のdays表示（フォールバック）で読めるため、
        // ここでは静かに無視する（次回開いた時に再試行される）
      })
      .finally(() => setMigrating(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, trip.id, trip.daysActivitiesMigrated]);

  // TABI 3.0：SCHEDULE列でのドラッグ並び替え。同じday内でのみ入れ替え可能。
  const handleReorderDay = async (day: number, orderedItemIds: string[]) => {
    try {
      const res = await fetch(
        `/api/trips?id=${encodeURIComponent(trip.id)}&action=reorderDayItems`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ day, itemIds: orderedItemIds }),
        }
      );
      const data = await res.json();
      if (data.success && data.trip) onTripUpdate(data.trip);
    } catch {
      // 並び替えの保存に失敗した場合は、次のtrip更新で元の並びに戻る
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    setPublishError('');
    try {
      const res = await fetch(
        `/api/trips?id=${encodeURIComponent(trip.id)}&action=publish`,
        { method: 'PATCH', credentials: 'include' }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to publish');
      }
      onTripUpdate(data.trip);
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : 'Failed to publish this trip.');
    } finally {
      setPublishing(false);
    }
  };

  const handlePublishRecommended = async () => {
    setPublishing(true);
    setPublishError('');
    try {
      const res = await fetch(
        `/api/trips?id=${encodeURIComponent(trip.id)}&action=publishRecommended`,
        { method: 'PATCH', credentials: 'include' }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to publish');
      }
      onTripUpdate(data.trip);
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : 'Failed to publish this trip.');
    } finally {
      setPublishing(false);
    }
  };

  const handleMarkBooked = async (targetId: string) => {
    setPendingBookingId(targetId);
    setBookingErrors((prev) => {
      const next = { ...prev };
      delete next[targetId];
      return next;
    });
    try {
      const res = await fetch(`/api/trips?id=${encodeURIComponent(trip.id)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId, status: 'booked' }),
      });
      if (!res.ok) throw new Error('Failed to update');
      onBookingStatusChange(trip.id, targetId);
    } catch {
      setBookingErrors((prev) => ({
        ...prev,
        [targetId]: 'Could not mark as booked. Please try again.',
      }));
    } finally {
      setPendingBookingId(null);
    }
  };

  const renderBookingControl = (status: BookingStatus, targetId: string) => {
    if (status === 'booked') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 rounded-full px-2.5 py-1 whitespace-nowrap">
          <i className="ri-check-line"></i> Booked
        </span>
      );
    }
    const isPending = pendingBookingId === targetId;
    return (
      <button
        onClick={() => handleMarkBooked(targetId)}
        disabled={isPending}
        className="border border-background-300 text-foreground-700 hover:bg-background-100 font-semibold text-xs px-3 py-1.5 rounded-md transition-colors whitespace-nowrap cursor-pointer disabled:opacity-60"
      >
        {isPending ? 'Marking...' : 'Mark as Booked'}
      </button>
    );
  };

  const renderBookingError = (targetId: string) =>
    bookingErrors[targetId] ? (
      <p className="text-red-500 text-xs mt-1">{bookingErrors[targetId]}</p>
    ) : null;

  return (
    <div className="bg-background-50 border border-background-200 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full text-left p-5 md:p-6 flex items-start justify-between gap-4 cursor-pointer hover:bg-background-100/60 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${statusBadge.className}`}>
              {statusBadge.label}
            </span>
            {trip.status === 'published' && (
              <span
                className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${
                  TRIP_TYPE_BADGE[trip.tripType || 'actual'].className
                }`}
              >
                {TRIP_TYPE_BADGE[trip.tripType || 'actual'].label}
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-primary-100 text-primary-800 whitespace-nowrap">
              <i className="ri-calendar-line"></i>
              {dayCount} {dayCount === 1 ? 'day' : 'days'}
            </span>
            {(trip.stays || []).length > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-foreground-500 whitespace-nowrap">
                <i className="ri-hotel-line"></i>
                {(trip.stays || [])[0].hotelName}
              </span>
            )}
          </div>

          <h2 className="font-heading font-bold text-base md:text-lg text-foreground-900 mb-1 leading-snug">
            {trip.title}
          </h2>

          {trip.summary && (
            <p className="text-foreground-600 text-sm leading-relaxed line-clamp-2">
              {trip.summary}
            </p>
          )}

          <p className="text-foreground-400 text-xs mt-2 whitespace-nowrap">
            {formatSavedDate(trip.createdAt)}
          </p>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="w-9 h-9 flex items-center justify-center text-foreground-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
            aria-label="Delete trip"
          >
            <i className="ri-delete-bin-line text-lg"></i>
          </button>
          <span className="w-6 h-6 flex items-center justify-center text-foreground-400">
            <i
              className={`ri-arrow-down-s-line text-xl transition-transform duration-200 ${
                expanded ? 'rotate-180' : ''
              }`}
            ></i>
          </span>
        </div>
      </button>

      {expanded && (
        <div className="px-5 md:px-6 pb-6 border-t border-background-200">
          <div className="pt-5 overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[640px]">
              <thead>
                <tr className="text-left text-xs font-semibold text-foreground-500 uppercase tracking-wide border-b border-background-200">
                  <th className="py-2 pr-3 w-16 align-bottom">Day</th>
                  <th className="py-2 pr-3 w-40 align-bottom">Stay</th>
                  <th className="py-2 pr-3 align-bottom">Schedule</th>
                  <th className="py-2 pl-2 w-44 align-bottom">Meals</th>
                </tr>
              </thead>
              <tbody>
                {buildDayRows(trip.days || [], trip.stays || []).map((row) => {
                  const nonTransport = (row.day.activities || []).filter(
                    (a) => a.type !== 'transport'
                  );
                  const transportItems = (row.day.activities || []).filter(
                    (a) => a.type === 'transport'
                  );
                  const dayItems = getItemsForDay(trip.items, row.day.day);
                  // mealSlotが指定されているitem（レストラン）はMeals列に表示するため、
                  // SCHEDULE列には出さない
                  const scheduleItems = dayItems.filter((it) => !it.mealSlot);
                  const mealItemsBySlot = {
                    breakfast: dayItems.filter((it) => it.mealSlot === 'breakfast'),
                    lunch: dayItems.filter((it) => it.mealSlot === 'lunch'),
                    dinner: dayItems.filter((it) => it.mealSlot === 'dinner'),
                  };
                  // 移行済み（daysActivitiesMigrated）のTripは、items配列だけが
                  // 正のデータになっており、そのまま並び順（order/time）で
                  // ドラッグ並び替え可能。移行前（古いTripを初めて開いた直後の
                  // 一瞬）は、legacy activitiesとitemsを混在させて表示するのみで
                  // ドラッグは無効にする。
                  const migrated = !!trip.daysActivitiesMigrated;
                  const scheduleEntries: ScheduleEntry[] = migrated
                    ? scheduleItems.map((item) => ({
                        key: `item-${item.id}`,
                        itemId: item.id,
                        time: item.time,
                        title: item.title,
                        description: item.description,
                      }))
                    : [
                        ...nonTransport.map((activity, idx) => ({
                          key: `legacy-${idx}`,
                          time: activity.time,
                          title: activity.title,
                          description: activity.description,
                        })),
                        ...scheduleItems.map((item) => ({
                          key: `item-${item.id}`,
                          time: item.time,
                          title: item.title,
                          description: item.description,
                        })),
                      ].sort((a, b) => timeSortKey(a.time).localeCompare(timeSortKey(b.time)));
                  const orderedItemIdsForDay = scheduleEntries
                    .map((e) => e.itemId)
                    .filter((itemId): itemId is string => !!itemId);
                  const mealSlots: {
                    label: string;
                    short: string;
                    meal?: TripMeal;
                    items: TripItem[];
                  }[] = [
                    {
                      label: 'Breakfast',
                      short: 'B',
                      meal: (row.day.meals || {}).breakfast,
                      items: mealItemsBySlot.breakfast,
                    },
                    {
                      label: 'Lunch',
                      short: 'L',
                      meal: (row.day.meals || {}).lunch,
                      items: mealItemsBySlot.lunch,
                    },
                    {
                      label: 'Dinner',
                      short: 'D',
                      meal: (row.day.meals || {}).dinner,
                      items: mealItemsBySlot.dinner,
                    },
                  ];

                  return (
                    <tr key={row.day.day} className="border-b border-background-100 align-top">
                      <td className="py-3 pr-3 whitespace-nowrap">
                        <span className="font-semibold text-foreground-800">Day {row.day.day}</span>
                        {row.day.date && (
                          <span className="block text-foreground-400 text-xs mt-0.5">
                            {row.day.date}
                          </span>
                        )}
                      </td>

                      {row.staySpan !== 0 && (
                        <td className="py-3 pr-3" rowSpan={row.staySpan || 1}>
                          {row.stay ? (
                            <div>
                              <span className="text-foreground-800 font-medium text-sm block flex items-center gap-1">
                                <i className="ri-hotel-line text-foreground-400"></i>
                                {row.stay.hotelName}
                              </span>
                              <div className="mt-1.5">
                                {renderBookingControl(row.stay.status, row.stay.id)}
                              </div>
                              {renderBookingError(row.stay.id)}
                            </div>
                          ) : (
                            <span className="text-foreground-300 text-xs">—</span>
                          )}
                        </td>
                      )}

                      <td className="py-3 pr-3">
                        {transportItems.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {transportItems.map((t, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center gap-1.5 bg-background-100 text-foreground-600 text-xs rounded-full px-2.5 py-1"
                              >
                                <i className={`${transportIcon(t.transportMode)} flex-shrink-0`}></i>
                                {t.title}
                              </span>
                            ))}
                          </div>
                        )}
                        <ul className="space-y-2">
                          {scheduleEntries.map((entry) => {
                            const draggable = migrated && !!entry.itemId;
                            const isDragging = draggable && draggedItemId === entry.itemId;
                            return (
                              <li
                                key={entry.key}
                                draggable={draggable}
                                onDragStart={() => {
                                  if (draggable) setDraggedItemId(entry.itemId!);
                                }}
                                onDragOver={(e) => {
                                  if (draggable) e.preventDefault();
                                }}
                                onDrop={(e) => {
                                  if (!draggable || !draggedItemId || draggedItemId === entry.itemId) return;
                                  e.preventDefault();
                                  const fromIdx = orderedItemIdsForDay.indexOf(draggedItemId);
                                  const toIdx = orderedItemIdsForDay.indexOf(entry.itemId!);
                                  if (fromIdx === -1 || toIdx === -1) return;
                                  const reordered = [...orderedItemIdsForDay];
                                  reordered.splice(fromIdx, 1);
                                  reordered.splice(toIdx, 0, draggedItemId);
                                  handleReorderDay(row.day.day, reordered);
                                  setDraggedItemId(null);
                                }}
                                onDragEnd={() => setDraggedItemId(null)}
                                className={`text-sm rounded-md ${draggable ? 'cursor-grab active:cursor-grabbing' : ''} ${
                                  isDragging ? 'opacity-40' : ''
                                }`}
                              >
                                {draggable && (
                                  <i className="ri-draggable text-foreground-300 mr-1 align-middle"></i>
                                )}
                                {entry.time ? (
                                  <span className="text-foreground-400 text-xs mr-1.5 whitespace-nowrap">
                                    {entry.time}
                                  </span>
                                ) : (
                                  <span className="text-foreground-300 text-xs mr-1.5 whitespace-nowrap italic">
                                    Want to go
                                  </span>
                                )}
                                <span className="text-foreground-800 font-medium">
                                  {entry.title}
                                </span>
                                {entry.description && (
                                  <span className="block text-foreground-500 text-xs leading-relaxed mt-0.5">
                                    {entry.description}
                                  </span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </td>

                      <td className="py-3 pl-2">
                        <div className="flex flex-col gap-2">
                          {mealSlots.map(({ label, short, meal, items: mealItems }) => (
                            <div key={label} className="text-xs" title={label}>
                              {meal ? (
                                <div>
                                  <span className="text-foreground-400 font-semibold mr-1">
                                    {short}
                                  </span>
                                  <span className="text-foreground-700">{meal.suggestion}</span>
                                  <div className="mt-1">
                                    {renderBookingControl(meal.status, meal.id)}
                                  </div>
                                  {renderBookingError(meal.id)}
                                </div>
                              ) : mealItems.length === 0 ? (
                                <span className="text-foreground-300">
                                  <span className="font-semibold mr-1">{short}</span>—
                                </span>
                              ) : null}
                              {/* Trip Plannerでこの食事に割り当てられたレストラン */}
                              {mealItems.map((item) => (
                                <div key={item.id} className={meal ? 'mt-1.5' : ''}>
                                  {!meal && (
                                    <span className="text-foreground-400 font-semibold mr-1">
                                      {short}
                                    </span>
                                  )}
                                  <span className="text-foreground-700">{item.title}</span>
                                  {item.time && (
                                    <span className="text-foreground-400 ml-1">{item.time}</span>
                                  )}
                                  {item.description && (
                                    <span className="block text-foreground-500 leading-relaxed mt-0.5">
                                      {item.description}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {(status === 'planning' || status === 'traveling') && (
            <TripPlanningPanel
              tripId={trip.id}
              items={trip.items || []}
              actualVisitLog={trip.actualVisitLog || []}
              tripStatus={status}
              onTripUpdate={(updates) => {
                onTripUpdate({ ...trip, ...updates });
              }}
            />
          )}

          {/* 振り返り・公開アクション */}
          <div className="mt-6 pt-5 border-t border-background-200">
            {status === 'planning' || status === 'traveling' ? (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-foreground-500 text-xs max-w-xs">
                  Been on this trip already? Add your reflection to publish it as an Actual
                  Trip. Designing a route for others without traveling it yourself? Publish
                  it directly as a Recommended Trip.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePublishRecommended}
                    disabled={publishing}
                    className="border border-accent-300 text-accent-700 hover:bg-accent-50 disabled:opacity-60 font-semibold text-xs px-4 py-2 rounded-md transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-lightbulb-line mr-1"></i>
                    {publishing ? 'Publishing...' : 'Publish as Recommended Trip'}
                  </button>
                  <button
                    onClick={() => setShowReflectionModal(true)}
                    className="bg-background-100 hover:bg-background-200 text-foreground-800 font-semibold text-xs px-4 py-2 rounded-md transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-quill-pen-line mr-1"></i>
                    Add Reflection
                  </button>
                </div>
              </div>
            ) : status === 'completed' ? (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-foreground-500 text-xs">
                  Your reflection is saved. Publish this Trip so other travelers can find,
                  save, and copy it.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowReflectionModal(true)}
                    className="text-foreground-500 hover:text-foreground-700 font-semibold text-xs px-3 py-2 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Edit
                  </button>
                  <button
                    onClick={handlePublish}
                    disabled={publishing}
                    className="bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white font-semibold text-xs px-4 py-2 rounded-md transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {publishing ? 'Publishing...' : 'Publish this Trip'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4 text-xs text-foreground-500">
                <span className="inline-flex items-center gap-1">
                  <i className="ri-bookmark-line"></i>
                  Saved by {trip.saveCount || 0}
                </span>
                <span className="inline-flex items-center gap-1">
                  <i className="ri-file-copy-line"></i>
                  Copied by {trip.copyCount || 0}
                </span>
              </div>
            )}
            {publishError && (
              <p className="text-red-500 text-xs mt-2">{publishError}</p>
            )}
          </div>
        </div>
      )}

      {showReflectionModal && (
        <ReflectionModal
          trip={trip}
          onClose={() => setShowReflectionModal(false)}
          onSaved={(updatedTrip) => {
            onTripUpdate(updatedTrip);
            setShowReflectionModal(false);
          }}
        />
      )}
    </div>
  );
}
