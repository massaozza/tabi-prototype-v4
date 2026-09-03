import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import Navbar from '@/components/feature/Navbar';
import Footer from '@/components/feature/Footer';
import { useAuth } from '@/context/AuthContext';
import type { Trip } from './types';
import DeleteConfirmModal from './components/DeleteConfirmModal';

// TABI47：My Tripページ（/my-trip）
// 自分のTripをカード一覧で表示。カードをタップすると詳細ページ（/my-trip/:id）へ。

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  planning: { label: 'Planning', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  traveling: { label: 'Traveling', color: 'bg-green-50 text-green-700 border-green-200' },
  completed: { label: 'Completed', color: 'bg-background-100 text-foreground-600 border-background-200' },
  published: { label: 'Published', color: 'bg-accent-50 text-accent-700 border-accent-200' },
};

function TripSummaryCard({ trip, onDelete }: { trip: Trip; onDelete: () => void }) {
  const navigate = useNavigate();
  const dayCount = trip.totalDays ?? trip.days?.length ?? 0;
  const statusBadge = STATUS_BADGE[trip.status || 'planning'] || STATUS_BADGE.planning;
  const savedDate = trip.createdAt
    ? new Date(trip.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : '';

  return (
    <div
      className="bg-white border border-background-200 rounded-2xl overflow-hidden hover:border-primary-200 transition-colors cursor-pointer"
      onClick={() => navigate(`/my-trip/${trip.id}`)}
    >
      {/* カードヘッダー */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex flex-wrap gap-1.5">
            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${statusBadge.color}`}>
              {statusBadge.label}
            </span>
            {dayCount > 0 && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary-50 text-primary-700">
                {dayCount} {dayCount === 1 ? 'day' : 'days'}
              </span>
            )}
            {(trip.tags || []).slice(0, 2).map((tag) => (
              <span key={tag} className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-background-100 text-foreground-600 border border-background-200">
                {tag}
              </span>
            ))}
          </div>
          {/* 削除ボタン */}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="w-8 h-8 flex items-center justify-center text-foreground-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer flex-shrink-0"
            aria-label="Delete trip"
          >
            <i className="ri-delete-bin-line text-sm"></i>
          </button>
        </div>

        <h3 className="font-heading font-bold text-base text-foreground-900 leading-snug mb-1">
          {trip.title}
        </h3>

        {trip.summary && (
          <p className="text-xs text-foreground-500 leading-relaxed line-clamp-2 mb-2">
            {trip.summary}
          </p>
        )}

        <div className="flex items-center justify-between">
          <p className="text-xs text-foreground-400">Saved {savedDate}</p>
          <div className="flex items-center gap-3 text-xs text-foreground-400">
            {trip.saveCount !== undefined && (
              <span className="flex items-center gap-1">
                <i className="ri-bookmark-line"></i>{trip.saveCount}
              </span>
            )}
            {trip.copyCount !== undefined && (
              <span className="flex items-center gap-1">
                <i className="ri-file-copy-line"></i>{trip.copyCount}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* フッター：クリックを促す */}
      <div className="border-t border-background-100 px-4 py-2.5 flex items-center justify-between bg-background-50">
        <span className="text-xs text-primary-600 font-semibold flex items-center gap-1">
          <i className="ri-eye-line"></i>View itinerary
        </span>
        <i className="ri-arrow-right-line text-foreground-300 text-sm"></i>
      </div>
    </div>
  );
}

export default function MyTripListPage() {
  const { user, loading: authLoading } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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
          setTrips([...list].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')));
        }
      } catch {
        if (!cancelled) setError('Failed to load your trips. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, [authLoading, user]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/trips?id=${encodeURIComponent(deleteTarget.id)}`, {
        method: 'DELETE', credentials: 'include',
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

  if (authLoading) {
    return (
      <main className="min-h-screen bg-background-50">
        <Navbar />
        <div className="pt-32 flex items-center justify-center">
          <i className="ri-loader-4-line animate-spin text-3xl text-foreground-300"></i>
        </div>
      </main>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <main className="min-h-screen bg-background-50">
      <Navbar />

      {/* ヒーロー */}
      <section className="bg-foreground-900 pt-24 md:pt-32 pb-12">
        <div className="max-w-7xl mx-auto px-6 md:px-10 text-center">
          <nav className="flex items-center justify-center gap-2 text-white/50 text-xs mb-6 flex-wrap">
            <Link to="/" className="hover:text-white/80 transition-colors">Home</Link>
            <span className="text-white/30">/</span>
            <span className="text-white">My Trips</span>
          </nav>
          <h1 className="font-heading font-bold text-3xl md:text-5xl text-white leading-tight mb-3">
            My Trips
          </h1>
          <p className="text-white/60 text-base max-w-xl mx-auto leading-relaxed mb-6">
            Your saved itineraries, ready whenever you need them.
          </p>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('tabi:open-chat'))}
            className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm px-6 py-3 rounded-xl transition-colors cursor-pointer"
          >
            <i className="ri-add-line"></i>
            Plan a new trip
          </button>
        </div>
      </section>

      {/* カード一覧 */}
      <section className="py-10 px-4 md:px-10">
        <div className="max-w-3xl mx-auto">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white border border-background-200 rounded-2xl p-4 space-y-3 animate-pulse">
                  <div className="h-4 w-24 bg-background-200 rounded-full"></div>
                  <div className="h-5 w-3/4 bg-background-200 rounded"></div>
                  <div className="h-3 w-full bg-background-200 rounded"></div>
                </div>
              ))}
            </div>
          ) : trips.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-full bg-background-100 flex items-center justify-center mx-auto mb-6">
                <i className="ri-map-pin-line text-3xl text-foreground-400"></i>
              </div>
              <h2 className="font-heading font-bold text-xl text-foreground-900 mb-2">No trips saved yet</h2>
              <p className="text-foreground-500 text-sm mb-6 max-w-md mx-auto">
                Start planning with AI or copy a trip from Explore to get started.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('tabi:open-chat'))}
                  className="inline-flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm px-6 py-3 rounded-xl transition-colors cursor-pointer"
                >
                  <i className="ri-sparkling-line"></i>Plan with AI
                </button>
                <Link to="/explore" className="inline-flex items-center justify-center gap-2 bg-white border border-background-200 hover:bg-background-50 text-foreground-700 font-semibold text-sm px-6 py-3 rounded-xl transition-colors">
                  <i className="ri-compass-line"></i>Explore trips
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {trips.map((trip) => (
                <TripSummaryCard
                  key={trip.id}
                  trip={trip}
                  onDelete={() => setDeleteTarget(trip)}
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
