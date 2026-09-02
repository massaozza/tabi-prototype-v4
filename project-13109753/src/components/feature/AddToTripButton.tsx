import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

interface TripOption {
  id: string;
  title: string;
  status?: string;
}

interface AddToTripButtonProps {
  spotId: string;
  spotTitle: string;
  // 「Saved for Trip」のカード表示（写真＋概要）用。SPOT詳細ページの
  // destination.image / destination.description をそのまま渡す想定。
  spotImageUrl?: string;
  spotDescription?: string;
  // SPOTのcategory（destination.category）。'Restaurant'カテゴリの場合、
  // Trip Planner側でMeals（B/L/D）への割り当てができるitemType='restaurant'
  // として追加する。SPOTデータに今後カテゴリが追加された場合に備え、
  // 判定は大文字小文字を区別せず「restaurant」を含むかで行う。
  spotCategory?: string;
  className?: string;
}

// TABI 3.0：旅行で実際に行く「場所の種類」。'restaurant'のみTrip Planner側で
// Meals（B/L/D）への割り当てができる。
type ItemType =
  | 'sightseeing'
  | 'restaurant'
  | 'shopping'
  | 'accommodation'
  | 'activity'
  | 'transport'
  | 'other';

// SPOTのcategory（destination.category）から、Trip Item用のitemTypeを判定する。
// 現行の既存カテゴリ（Nature & Scenery、Culture & Historyなど）は、旅行者の
// 訪問先としては大半が"sightseeing"に該当するため、明確に対応するものが
// 無ければ'sightseeing'にフォールバックする。将来的にSPOT側へ専用の
// 「Restaurant」「Shopping」等のカテゴリが追加された場合、そのまま対応する。
const CATEGORY_TO_ITEM_TYPE: Record<string, ItemType> = {
  'food': 'restaurant',
  'city & food culture': 'restaurant',
  'restaurant': 'restaurant',
  'shopping & fashion': 'shopping',
  'shopping': 'shopping',
  'activities': 'activity',
  'skiing & winter sports': 'activity',
  'theme parks & entertainment': 'activity',
  'transport': 'transport',
};

function categoryToItemType(category?: string): ItemType {
  if (!category) return 'sightseeing';
  const normalized = category.trim().toLowerCase();
  return CATEGORY_TO_ITEM_TYPE[normalized] || 'sightseeing';
}

// TABI 3.0：SPOT詳細ページ等から、既存の（まだ公開していない）Tripに、
// その場所を直接追加できるボタン。Mindtrip等の「+ Add to trip」を参考にした機能。
export default function AddToTripButton({
  spotId,
  spotTitle,
  spotImageUrl,
  spotDescription,
  spotCategory,
  className,
}: AddToTripButtonProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [trips, setTrips] = useState<TripOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [doneId, setDoneId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const openModal = async () => {
    if (!user) {
      window.location.href = '/login';
      return;
    }
    setOpen(true);
    setError('');
    setDoneId(null);
    setLoading(true);
    try {
      const res = await fetch('/api/trips', { credentials: 'include' });
      const data = await res.json();
      if (res.ok && Array.isArray(data.trips)) {
        // まだ公開していない、編集可能なTripのみを候補にする
        const editable = data.trips.filter(
          (t: TripOption) => (t.status || 'planning') !== 'published'
        );
        setTrips(editable);
      }
    } catch {
      setError('Could not load your trips.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (tripId: string) => {
    setAddingId(tripId);
    setError('');
    try {
      const res = await fetch(`/api/trips?id=${encodeURIComponent(tripId)}&action=addItem`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: spotTitle,
          itemType: categoryToItemType(spotCategory),
          spotId,
          imageUrl: spotImageUrl,
          description: spotDescription,
          planLevel: 'saved',
          status: 'planned',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to add');
      }
      setDoneId(tripId);
    } catch {
      setError('Could not add this spot. Please try again.');
    } finally {
      setAddingId(null);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className={
          className ||
          'inline-flex items-center gap-1.5 bg-background-100 hover:bg-background-200 text-foreground-800 font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap'
        }
      >
        <i className="ri-add-line"></i>
        Add to Trip
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-foreground-950/50" onClick={() => setOpen(false)}></div>
          <div className="relative w-full max-w-sm bg-background-50 rounded-xl overflow-hidden shadow-lg">
            <div className="flex items-center justify-between px-5 py-4 border-b border-background-200">
              <h3 className="font-heading font-semibold text-base text-foreground-950">
                Add to a Trip
              </h3>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="w-8 h-8 rounded-full flex items-center justify-center text-foreground-500 hover:bg-background-100 transition-colors cursor-pointer"
              >
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>

            <div className="p-5 max-h-[60vh] overflow-y-auto">
              {error && <p className="text-red-500 text-xs mb-3">{error}</p>}

              {loading ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-12 bg-background-100 rounded-lg animate-pulse"></div>
                  ))}
                </div>
              ) : trips.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-foreground-500 text-sm mb-4">
                    You don't have any editable trips yet.
                  </p>
                  <Link
                    to="/creators/trips/new"
                    className="inline-flex items-center gap-1.5 bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors whitespace-nowrap"
                  >
                    <i className="ri-add-line"></i>
                    Create a new Trip
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {trips.map((trip) => (
                    <button
                      key={trip.id}
                      type="button"
                      onClick={() => handleAdd(trip.id)}
                      disabled={addingId === trip.id || doneId === trip.id}
                      className="w-full flex items-center justify-between gap-3 bg-background-100 hover:bg-background-200 disabled:opacity-70 rounded-lg px-4 py-3 text-left transition-colors cursor-pointer"
                    >
                      <span className="text-sm font-medium text-foreground-900 line-clamp-1">
                        {trip.title}
                      </span>
                      {doneId === trip.id ? (
                        <span className="text-xs text-emerald-600 font-semibold whitespace-nowrap">
                          <i className="ri-checkbox-circle-fill mr-1"></i>
                          Added
                        </span>
                      ) : addingId === trip.id ? (
                        <span className="text-xs text-foreground-400 whitespace-nowrap">
                          Adding...
                        </span>
                      ) : (
                        <i className="ri-add-line text-foreground-400"></i>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
