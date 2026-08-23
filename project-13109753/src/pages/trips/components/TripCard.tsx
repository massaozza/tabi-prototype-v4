import { useState } from 'react';
import type { BookingStatus, Trip, TripMeal } from '../types';
import { formatSavedDate } from '../types';

interface TripCardProps {
  trip: Trip;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onBookingStatusChange: (tripId: string, targetId: string) => void;
}

export default function TripCard({
  trip,
  expanded,
  onToggle,
  onDelete,
  onBookingStatusChange,
}: TripCardProps) {
  const dayCount = trip.days?.length || 0;
  const [pendingBookingId, setPendingBookingId] = useState<string | null>(null);
  const [bookingErrors, setBookingErrors] = useState<Record<string, string>>({});

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
          <div className="pt-5 space-y-6">
            {(trip.stays || []).length > 0 && (
              <div>
                <h3 className="font-heading font-semibold text-sm text-foreground-900 mb-3">
                  Accommodation
                </h3>
                <ul className="space-y-3">
                  {(trip.stays || []).map((stay) => (
                    <li key={stay.id}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-foreground-800 font-medium text-sm">
                          {stay.hotelName}（Day {stay.checkInDay} - Day {stay.checkOutDay}）
                        </span>
                        {renderBookingControl(stay.status, stay.id)}
                      </div>
                      {renderBookingError(stay.id)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(trip.days || []).map((day) => {
              const mealEntries = [
                { label: 'Breakfast', meal: (day.meals || {}).breakfast },
                { label: 'Lunch', meal: (day.meals || {}).lunch },
                { label: 'Dinner', meal: (day.meals || {}).dinner },
              ].filter(
                (entry): entry is { label: string; meal: TripMeal } => Boolean(entry.meal)
              );

              return (
                <div key={day.day}>
                  <h3 className="font-heading font-semibold text-sm text-foreground-900 mb-3">
                    Day {day.day}
                  </h3>
                  <ul className="space-y-2.5">
                    {(day.activities || []).map((activity, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-sm">
                        <span className="text-foreground-400 text-xs mt-0.5 w-14 flex-shrink-0 whitespace-nowrap">
                          {activity.time || '—'}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="text-foreground-800 font-medium">
                            {activity.title}
                          </span>
                          {activity.description && (
                            <span className="block text-foreground-500 text-xs leading-relaxed mt-0.5">
                              {activity.description}
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {mealEntries.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-heading font-semibold text-xs uppercase tracking-wide text-foreground-500 mb-2">
                        Meals
                      </h4>
                      <ul className="space-y-2.5">
                        {mealEntries.map(({ label, meal }) => (
                          <li key={meal.id}>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm text-foreground-800 flex-1 min-w-0">
                                <span className="font-medium">{label}:</span> {meal.suggestion}
                              </span>
                              {renderBookingControl(meal.status, meal.id)}
                            </div>
                            {renderBookingError(meal.id)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
