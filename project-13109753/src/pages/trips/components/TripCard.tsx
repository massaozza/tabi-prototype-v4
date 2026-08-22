import type { Trip } from '../types';
import { formatSavedDate } from '../types';

interface TripCardProps {
  trip: Trip;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
}

export default function TripCard({ trip, expanded, onToggle, onDelete }: TripCardProps) {
  const dayCount = trip.days?.length || 0;

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
            {trip.days.map((day) => (
              <div key={day.day}>
                <h3 className="font-heading font-semibold text-sm text-foreground-900 mb-3">
                  Day {day.day}: {day.title}
                </h3>
                <ul className="space-y-2.5">
                  {day.items.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-sm">
                      <span className="text-foreground-400 text-xs mt-0.5 w-14 flex-shrink-0 whitespace-nowrap">
                        {item.time || '—'}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="text-foreground-800 font-medium">{item.title}</span>
                        {item.description && (
                          <span className="block text-foreground-500 text-xs leading-relaxed mt-0.5">
                            {item.description}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
