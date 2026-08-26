import { useState } from 'react';
import type { BookingStatus, Trip, TripDay, TripMeal, TripStay, TransportMode } from '../types';
import { formatSavedDate } from '../types';
import ReflectionModal from './ReflectionModal';

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

interface DayRow {
  day: TripDay;
  stay?: TripStay;
  /** rowSpan for the Stay cell. 0 means "don't render this cell, it's merged into a previous row". */
  staySpan: number;
}

function findStayForDay(stays: TripStay[], dayNum: number): TripStay | undefined {
  return stays.find((s) => dayNum >= s.checkInDay && dayNum <= s.checkOutDay);
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

  const status = trip.status || 'planning';
  const statusBadge = STATUS_BADGE[status] || STATUS_BADGE.planning;

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
                  const mealSlots: { label: string; short: string; meal?: TripMeal }[] = [
                    { label: 'Breakfast', short: 'B', meal: (row.day.meals || {}).breakfast },
                    { label: 'Lunch', short: 'L', meal: (row.day.meals || {}).lunch },
                    { label: 'Dinner', short: 'D', meal: (row.day.meals || {}).dinner },
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
                          {nonTransport.map((activity, idx) => (
                            <li key={idx} className="text-sm">
                              {activity.time && (
                                <span className="text-foreground-400 text-xs mr-1.5 whitespace-nowrap">
                                  {activity.time}
                                </span>
                              )}
                              <span className="text-foreground-800 font-medium">
                                {activity.title}
                              </span>
                              {activity.description && (
                                <span className="block text-foreground-500 text-xs leading-relaxed mt-0.5">
                                  {activity.description}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </td>

                      <td className="py-3 pl-2">
                        <div className="flex flex-col gap-2">
                          {mealSlots.map(({ label, short, meal }) => (
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
                              ) : (
                                <span className="text-foreground-300">
                                  <span className="font-semibold mr-1">{short}</span>—
                                </span>
                              )}
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

          {/* 振り返り・公開アクション */}
          <div className="mt-6 pt-5 border-t border-background-200">
            {status === 'planning' || status === 'traveling' ? (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-foreground-500 text-xs">
                  Been on this trip already? Add your reflection to publish it and help
                  other travelers.
                </p>
                <button
                  onClick={() => setShowReflectionModal(true)}
                  className="bg-background-100 hover:bg-background-200 text-foreground-800 font-semibold text-xs px-4 py-2 rounded-md transition-colors cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-quill-pen-line mr-1"></i>
                  Add Reflection
                </button>
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
