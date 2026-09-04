import LocalizedLink from '@/components/feature/LocalizedLink';
import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Navbar from '@/components/feature/Navbar';
import Footer from '@/components/feature/Footer';
import { useAuth } from '@/context/AuthContext';

interface TripMeal {
  id: string;
  suggestion: string;
}

interface TripActivity {
  type?: 'activity' | 'transport';
  time?: string;
  title: string;
  description?: string;
  spotId?: string;
}

interface TripDay {
  day: number;
  date?: string;
  activities: TripActivity[];
  meals: { breakfast?: TripMeal; lunch?: TripMeal; dinner?: TripMeal };
}

interface TripStay {
  id: string;
  hotelName: string;
  checkInDay: number;
  checkOutDay: number;
}

interface PublicTrip {
  id: string;
  uid: string;
  title: string;
  summary?: string;
  stays: TripStay[];
  days: TripDay[];
  tripType?: 'recommended' | 'actual';
  nationality?: string;
  travelStyle?: string;
  authorName?: string;
  reflectionWhatWorked?: string;
  reflectionWhatToChange?: string;
  actualTotalCost?: number;
  saveCount?: number;
  copyCount?: number;
}

const TRIP_TYPE_BADGE: Record<string, { label: string; className: string }> = {
  recommended: {
    label: 'Recommended Trip',
    className: 'bg-accent-50 text-accent-700 border border-accent-200',
  },
  actual: {
    label: 'Actual Trip',
    className: 'bg-primary-50 text-primary-700 border border-primary-200',
  },
};

export default function PublicTripDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<PublicTrip | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copying, setCopying] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const res = await fetch('/api/trips?public=1');
        if (!res.ok) throw new Error('Failed to fetch');
        const json = await res.json();
        if (!cancelled && Array.isArray(json.trips)) {
          const found = json.trips.find((t: PublicTrip) => t.id === id) ?? null;
          setTrip(found);
          if (found) {
            fetch('/api/track-view', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contentType: 'trip', id: found.id }),
            }).catch(() => {});
          }
        }
      } catch {
        if (!cancelled) setTrip(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleSave = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (!trip) return;
    setSaving(true);
    setActionError('');
    try {
      const res = await fetch(`/api/trips?action=save&tripId=${encodeURIComponent(trip.id)}`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to save');
      setSaved(true);
    } catch {
      setActionError('Could not save this trip.');
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (!trip) return;
    setCopying(true);
    setActionError('');
    try {
      const res = await fetch(
        `/api/trips?action=copy&sourceTripId=${encodeURIComponent(trip.id)}`,
        { method: 'POST', credentials: 'include' }
      );
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to copy');
      navigate('/my-trip');
    } catch {
      setActionError('Could not copy this trip.');
      setCopying(false);
    }
  };

  return (
    <main className="min-h-screen bg-background-50">
      <Navbar />

      <section className="pt-24 md:pt-28 pb-16 md:pb-20 px-6 md:px-10">
        <div className="max-w-3xl mx-auto">
          {loading ? (
            <div className="space-y-4">
              <div className="h-6 w-40 bg-background-200 rounded animate-pulse"></div>
              <div className="h-10 w-3/4 bg-background-200 rounded animate-pulse"></div>
              <div className="h-40 bg-background-200 rounded-xl animate-pulse"></div>
            </div>
          ) : !trip ? (
            <div className="text-center py-20">
              <span className="w-16 h-16 rounded-full bg-background-100 flex items-center justify-center mx-auto mb-6">
                <i className="ri-error-warning-line text-3xl text-foreground-400"></i>
              </span>
              <h1 className="font-heading font-bold text-2xl text-foreground-900 mb-2">
                Trip not found
              </h1>
              <Link
                to="/trips"
                className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm px-6 py-3 rounded-lg transition-colors whitespace-nowrap"
              >
                <i className="ri-arrow-left-line"></i>
                Back to Trips
              </Link>
            </div>
          ) : (
            <article>
              <nav
                className="flex items-center gap-2 text-foreground-400 text-xs mb-6 flex-wrap"
                aria-label="Breadcrumb"
              >
                <Link to="/" className="hover:text-foreground-700 transition-colors whitespace-nowrap">
                  Home
                </Link>
                <span className="text-foreground-300">/</span>
                <Link
                  to="/trips"
                  className="hover:text-foreground-700 transition-colors whitespace-nowrap"
                >
                  Trips
                </Link>
                <span className="text-foreground-300">/</span>
                <span className="text-foreground-900 line-clamp-1">{trip.title}</span>
              </nav>

              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span
                  className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${
                    TRIP_TYPE_BADGE[trip.tripType || 'actual'].className
                  }`}
                >
                  {TRIP_TYPE_BADGE[trip.tripType || 'actual'].label}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-background-100 text-foreground-700 whitespace-nowrap">
                  <i className="ri-calendar-line"></i>
                  {trip.days.length} {trip.days.length === 1 ? 'day' : 'days'}
                </span>
              </div>

              <h1 className="font-heading font-bold text-3xl md:text-4xl text-foreground-900 leading-tight mb-3">
                {trip.title}
              </h1>

              {trip.summary && (
                <p className="text-foreground-600 text-base leading-relaxed mb-6">
                  {trip.summary}
                </p>
              )}

              {trip.authorName && (
                <p className="text-foreground-500 text-sm mb-8">
                  By{' '}
                  <Link
                    to={`/creator/${trip.uid}`}
                    className="text-foreground-800 font-medium hover:text-primary-600 transition-colors"
                  >
                    {trip.authorName}
                  </Link>
                </p>
              )}

              {actionError && <p className="text-red-500 text-xs mb-4">{actionError}</p>}

              <div className="flex items-center gap-3 mb-10">
                <button
                  onClick={handleSave}
                  disabled={saving || saved}
                  className="inline-flex items-center gap-2 bg-background-100 hover:bg-background-200 disabled:opacity-60 text-foreground-800 font-semibold text-sm px-5 py-2.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  <i className={saved ? 'ri-bookmark-fill' : 'ri-bookmark-line'}></i>
                  {saved ? 'Saved' : saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={handleCopy}
                  disabled={copying}
                  className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white font-semibold text-sm px-5 py-2.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-file-copy-line"></i>
                  {copying ? 'Copying...' : 'Copy to My Trip'}
                </button>
              </div>

              {/* Day by Day */}
              <section className="space-y-6 mb-10">
                {[...trip.days]
                  .sort((a, b) => a.day - b.day)
                  .map((day) => {
                    const stay = trip.stays.find(
                      (s) => day.day >= s.checkInDay && day.day <= s.checkOutDay
                    );
                    return (
                      <div
                        key={day.day}
                        className="bg-background-50 border border-background-200 rounded-xl p-5 md:p-6"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-heading font-bold text-base text-foreground-900">
                            Day {day.day}
                          </h3>
                          {stay && (
                            <span className="inline-flex items-center gap-1 text-xs text-foreground-500 whitespace-nowrap">
                              <i className="ri-hotel-line"></i>
                              {stay.hotelName}
                            </span>
                          )}
                        </div>
                        <ul className="space-y-2 mb-3">
                          {day.activities.map((a, idx) => (
                            <li key={idx} className="text-sm">
                              {a.time && (
                                <span className="text-foreground-400 text-xs mr-1.5">
                                  {a.time}
                                </span>
                              )}
                              <span className="text-foreground-800 font-medium">{a.title}</span>
                              {a.description && (
                                <span className="block text-foreground-500 text-xs mt-0.5">
                                  {a.description}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                        <div className="flex flex-wrap gap-3 text-xs text-foreground-500">
                          {day.meals.breakfast && <span>B: {day.meals.breakfast.suggestion}</span>}
                          {day.meals.lunch && <span>L: {day.meals.lunch.suggestion}</span>}
                          {day.meals.dinner && <span>D: {day.meals.dinner.suggestion}</span>}
                        </div>
                      </div>
                    );
                  })}
              </section>

              {(trip.reflectionWhatWorked || trip.reflectionWhatToChange) && (
                <section className="bg-background-100 rounded-xl p-6 mb-10">
                  <h4 className="font-heading font-semibold text-sm text-foreground-900 mb-3">
                    Traveler's Reflection
                  </h4>
                  {trip.reflectionWhatWorked && (
                    <p className="text-foreground-700 text-sm mb-2">
                      <span className="font-semibold">What worked well: </span>
                      {trip.reflectionWhatWorked}
                    </p>
                  )}
                  {trip.reflectionWhatToChange && (
                    <p className="text-foreground-700 text-sm">
                      <span className="font-semibold">What they'd change: </span>
                      {trip.reflectionWhatToChange}
                    </p>
                  )}
                </section>
              )}

              <Link
                to="/trips"
                className="inline-flex items-center gap-2 text-primary-500 hover:text-primary-600 font-semibold text-sm transition-colors whitespace-nowrap"
              >
                <i className="ri-arrow-left-line"></i>
                Back to Trips
              </Link>
            </article>
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
}
