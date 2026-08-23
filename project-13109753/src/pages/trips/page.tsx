import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import Navbar from '@/components/feature/Navbar';
import Footer from '@/components/feature/Footer';
import { useAuth } from '@/context/AuthContext';
import type { Trip } from './types';
import TripCard from './components/TripCard';
import DeleteConfirmModal from './components/DeleteConfirmModal';

export default function TripsPage() {
  const { user, loading: authLoading } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Trip | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;

    async function fetchData() {
      try {
        const res = await fetch('/api/trips', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch');
        const json = await res.json();
        const list = json.trips || [];
        if (!cancelled && Array.isArray(list)) {
          const sorted = [...list].sort((a, b) =>
            (b.createdAt || '').localeCompare(a.createdAt || '')
          );
          setTrips(sorted);
        }
      } catch {
        if (!cancelled) setError('Failed to load your trips. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/trips?id=${encodeURIComponent(deleteTarget.id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to delete');
      setTrips((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      setDeleteTarget(null);
      setError('Could not delete the trip. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const handleBookingStatusChange = (tripId: string, targetId: string) => {
    setTrips((prev) =>
      prev.map((t) => {
        if (t.id !== tripId) return t;
        return {
          ...t,
          stays: t.stays.map((s) =>
            s.id === targetId ? { ...s, status: 'booked' as const } : s
          ),
          days: t.days.map((d) => {
            const meals = d.meals || {};
            return {
              ...d,
              meals: {
                breakfast:
                  meals.breakfast && meals.breakfast.id === targetId
                    ? { ...meals.breakfast, status: 'booked' as const }
                    : meals.breakfast,
                lunch:
                  meals.lunch && meals.lunch.id === targetId
                    ? { ...meals.lunch, status: 'booked' as const }
                    : meals.lunch,
                dinner:
                  meals.dinner && meals.dinner.id === targetId
                    ? { ...meals.dinner, status: 'booked' as const }
                    : meals.dinner,
              },
            };
          }),
        };
      })
    );
  };

  if (authLoading) {
    return (
      <main className="min-h-screen bg-background-50">
        <Navbar />
        <div className="pt-32 md:pt-40 px-6 flex items-center justify-center">
          <i className="ri-loader-4-line animate-spin text-3xl text-foreground-300"></i>
        </div>
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

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
            <span className="text-white whitespace-nowrap">My Trips</span>
          </nav>

          <span className="inline-block text-xs font-semibold tracking-widest uppercase text-accent-400 mb-3">
            Saved Itineraries
          </span>
          <h1 className="font-heading font-bold text-3xl md:text-5xl text-white leading-tight mb-4">
            My Trips
          </h1>
          <p className="text-white/60 text-base max-w-xl mx-auto leading-relaxed">
            Your saved itineraries, ready whenever you need them.
          </p>
        </div>
      </section>

      <section className="py-12 md:py-16 px-6 md:px-10 lg:px-20">
        <div className="max-w-3xl mx-auto">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-background-50 border border-background-200 rounded-xl p-6 space-y-3"
                >
                  <div className="h-4 w-24 bg-background-200 rounded-full animate-pulse"></div>
                  <div className="h-5 w-1/2 bg-background-200 rounded animate-pulse"></div>
                  <div className="h-3 w-3/4 bg-background-200 rounded animate-pulse"></div>
                </div>
              ))}
            </div>
          ) : trips.length === 0 ? (
            <div className="text-center py-20">
              <span className="w-16 h-16 rounded-full bg-background-100 flex items-center justify-center mx-auto mb-6">
                <i className="ri-map-pin-line text-3xl text-foreground-400"></i>
              </span>
              <h2 className="font-heading font-bold text-xl md:text-2xl text-foreground-900 mb-2">
                No trips saved yet
              </h2>
              <p className="text-foreground-500 text-sm mb-6 max-w-md mx-auto">
                Start a conversation with Ask TABI and save your itinerary to plan your perfect
                trip.
              </p>
              <Link to="/" className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm px-6 py-3 rounded-lg transition-colors whitespace-nowrap">
                <i className="ri-chat-3-line"></i>
                Start with Ask TABI
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {trips.map((trip) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  expanded={expandedId === trip.id}
                  onToggle={() => setExpandedId(expandedId === trip.id ? null : trip.id)}
                  onDelete={() => setDeleteTarget(trip)}
                  onBookingStatusChange={handleBookingStatusChange}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />

      {deleteTarget && (
        <DeleteConfirmModal
          trip={deleteTarget}
          deleting={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </main>
  );
}
