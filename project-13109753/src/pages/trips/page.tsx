import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '@/components/feature/Navbar';
import Footer from '@/components/feature/Footer';

interface PublicTrip {
  id: string;
  title: string;
  summary?: string;
  stays: { id: string }[];
  days: { day: number }[];
  nationality?: string;
  travelStyle?: string;
  authorName?: string;
}

export default function PublicTripsPage() {
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
        if (!cancelled) setTrips([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen bg-background-50">
      <Navbar />

      <section className="bg-background-900 pt-24 md:pt-32 pb-16 md:pb-20">
        <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-20 text-center">
          <nav
            className="flex items-center justify-center gap-2 text-white/50 text-xs mb-6 flex-wrap"
            aria-label="Breadcrumb"
          >
            <Link to="/" className="hover:text-white/80 transition-colors whitespace-nowrap">
              Home
            </Link>
            <span className="text-white/30">/</span>
            <span className="text-white whitespace-nowrap">Trips</span>
          </nav>

          <span className="inline-block text-xs font-semibold tracking-widest uppercase text-accent-400 mb-3">
            Real Trips, Real Travelers
          </span>
          <h1 className="font-heading font-bold text-3xl md:text-5xl text-white leading-tight mb-4">
            Trips <span className="text-primary-400">Shared by Travelers</span>
          </h1>
          <p className="text-white/60 text-base max-w-xl mx-auto leading-relaxed">
            Real itineraries from travelers who have actually been to Japan. Save one,
            or copy it to your own My Trip and customize it with AI.
          </p>
        </div>
      </section>

      <section className="py-12 md:py-16 px-6 md:px-10 lg:px-20">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-56 bg-background-100 rounded-xl animate-pulse"
                ></div>
              ))}
            </div>
          ) : trips.length === 0 ? (
            <div className="text-center py-20">
              <span className="w-16 h-16 rounded-full bg-background-100 flex items-center justify-center mx-auto mb-6">
                <i className="ri-suitcase-3-line text-3xl text-foreground-400"></i>
              </span>
              <h2 className="font-heading font-bold text-xl md:text-2xl text-foreground-900 mb-2">
                No trips shared yet
              </h2>
              <p className="text-foreground-500 text-sm mb-6 max-w-sm mx-auto">
                Be the first traveler to share your Japan trip and help others plan theirs.
              </p>
              <Link
                to="/share"
                className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm px-6 py-3 rounded-lg transition-colors whitespace-nowrap"
              >
                <i className="ri-add-line"></i>
                Share your Trip
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {trips.map((trip) => (
                <div
                  key={trip.id}
                  className="bg-background-50 border border-background-200 rounded-xl p-6 flex flex-col"
                >
                  <h3 className="font-heading font-bold text-lg text-foreground-900 mb-2">
                    {trip.title}
                  </h3>
                  <p className="text-foreground-600 text-sm leading-relaxed mb-4 line-clamp-3 flex-1">
                    {trip.summary || ''}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-foreground-500 mb-4">
                    <span>
                      <i className="ri-calendar-line mr-1"></i>
                      {trip.days.length} {trip.days.length === 1 ? 'day' : 'days'}
                    </span>
                    <span>
                      <i className="ri-hotel-line mr-1"></i>
                      {trip.stays.length} {trip.stays.length === 1 ? 'stay' : 'stays'}
                    </span>
                  </div>
                  {trip.authorName && (
                    <p className="text-foreground-400 text-xs">By {trip.authorName}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
}
