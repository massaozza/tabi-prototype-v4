import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

interface PublicTrip {
  id: string;
  title: string;
  summary?: string;
  stays?: unknown[];
  days?: unknown[];
}

export default function TripsForYouSection() {
  const [trips, setTrips] = useState<PublicTrip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const res = await fetch('/api/trips?public=1');
        if (!res.ok) throw new Error('Failed to fetch');
        const json = await res.json();
        if (!cancelled && Array.isArray(json.trips)) {
          setTrips(json.trips);
        }
      } catch {
        if (!cancelled) {
          setTrips([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    fetchData();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="py-16 md:py-24 px-6 md:px-10 lg:px-20 bg-background-50">
      <div className="max-w-7xl mx-auto">
        <div className="mb-12">
          <span className="inline-block text-xs font-semibold tracking-widest uppercase text-accent-600 mb-3">
            Real Itineraries
          </span>
          <h2 className="font-heading font-bold text-3xl md:text-5xl text-foreground-900 leading-tight">
            Trips for <span className="text-primary-500">You</span>
          </h2>
          <p className="text-foreground-500 text-base mt-3 max-w-xl">
            Real trips planned and completed by actual travelers — copy them, remix them, or make
            them yours.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-background-100 rounded-xl overflow-hidden">
                <div className="p-6 space-y-3">
                  <div className="h-5 w-3/4 bg-background-200 rounded animate-pulse"></div>
                  <div className="h-3 w-full bg-background-200 rounded animate-pulse"></div>
                  <div className="h-3 w-5/6 bg-background-200 rounded animate-pulse"></div>
                  <div className="h-4 w-32 bg-background-200 rounded animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>
        ) : trips.length === 0 ? (
          <div className="text-center py-16 bg-background-100 rounded-xl">
            <span className="w-16 h-16 rounded-full bg-background-50 flex items-center justify-center mx-auto mb-6">
              <i className="ri-route-line text-3xl text-foreground-400"></i>
            </span>
            <p className="text-foreground-700 text-base mb-6">
              まだ公開されたTripはありません。自分のTripを共有してみましょう
            </p>
            <Link
              to="/share"
              className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm px-8 py-3.5 rounded-md transition-all duration-200 cursor-pointer whitespace-nowrap"
            >
              <i className="ri-share-line"></i>
              Share your Trip
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {trips.map((trip) => {
              const nights = Array.isArray(trip.stays) ? trip.stays.length : 0;
              const days = Array.isArray(trip.days) ? trip.days.length : 0;
              return (
                <article
                  key={trip.id}
                  className="group bg-background-100 rounded-xl overflow-hidden transition-all duration-300 hover:-translate-y-1 cursor-pointer"
                >
                  <div className="p-5 md:p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="w-9 h-9 rounded-lg bg-accent-100 flex items-center justify-center flex-shrink-0">
                        <i className="ri-route-line text-accent-600 text-lg"></i>
                      </span>
                      <h3 className="font-heading font-bold text-lg text-foreground-900 leading-snug line-clamp-2">
                        {trip.title}
                      </h3>
                    </div>
                    <p className="text-foreground-600 text-sm leading-relaxed mb-5 line-clamp-3">
                      {trip.summary || ''}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-foreground-500">
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <i className="ri-moon-line text-foreground-400"></i>
                        {nights} night{nights === 1 ? '' : 's'}
                      </span>
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <i className="ri-calendar-line text-foreground-400"></i>
                        {days} day{days === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}