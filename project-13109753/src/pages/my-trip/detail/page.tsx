import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Navbar from '@/components/feature/Navbar';
import Footer from '@/components/feature/Footer';
import { useAuth } from '@/context/AuthContext';
import type { Trip, TripItem } from '../types';

interface TripMeal { id: string; suggestion: string; status?: string; }
interface TripActivity { type?: 'activity' | 'transport'; time?: string; title: string; description?: string; spotId?: string; category?: string; }
interface TripDay { day: number; activities: TripActivity[]; meals: { breakfast?: TripMeal; lunch?: TripMeal; dinner?: TripMeal }; }
interface TripStay { id: string; hotelName: string; checkInDay: number; checkOutDay: number; status?: string; }
interface Destination { id: string; title: string; image: string; category?: string; }

function isUsableImage(url: string): boolean { return !!url && !url.includes('readdy.ai'); }

function formatBudget(min?: number, max?: number): string | null {
  if (!min && !max) return null;
  const fmt = (n: number) => n >= 10000 ? `¥${(n / 10000).toFixed(n % 10000 === 0 ? 0 : 1)}万` : `¥${n.toLocaleString()}`;
  if (min && max) return `${fmt(min)}–${fmt(max)}`;
  if (min) return `From ${fmt(min)}`;
  return `Under ${fmt(max!)}`;
}

const CATEGORY_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  sightseeing: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Sightseeing' },
  restaurant: { bg: 'bg-orange-50', text: 'text-orange-700', label: 'Restaurant' },
  shopping: { bg: 'bg-pink-50', text: 'text-pink-700', label: 'Shopping' },
  accommodation: { bg: 'bg-primary-50', text: 'text-primary-700', label: 'Stay' },
  activity: { bg: 'bg-purple-50', text: 'text-purple-700', label: 'Activity' },
  transport: { bg: 'bg-background-100', text: 'text-foreground-500', label: 'Transport' },
  'Culture & History': { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Culture' },
  'Nature & Scenery': { bg: 'bg-green-50', text: 'text-green-700', label: 'Nature' },
  'Food': { bg: 'bg-orange-50', text: 'text-orange-700', label: 'Food' },
  'City & Food Culture': { bg: 'bg-orange-50', text: 'text-orange-700', label: 'Food' },
  'Activities': { bg: 'bg-purple-50', text: 'text-purple-700', label: 'Activity' },
  'Hot Springs & Nature': { bg: 'bg-green-50', text: 'text-green-700', label: 'Onsen' },
  'Shopping & Fashion': { bg: 'bg-pink-50', text: 'text-pink-700', label: 'Shopping' },
  'Beach & Lifestyle': { bg: 'bg-cyan-50', text: 'text-cyan-700', label: 'Beach' },
};
function getCatStyle(cat?: string) { return cat ? (CATEGORY_STYLE[cat] || null) : null; }

function getDayRoute(day: TripDay): string {
  const spots = (day.activities || []).filter((a) => a.type !== 'transport');
  if (spots.length === 0) return '';
  if (spots.length === 1) return spots[0].title;
  return `${spots[0].title} → ${spots[spots.length - 1].title}`;
}

function getStayNightLabel(stay: TripStay, dayNum: number): string {
  const nightIndex = dayNum - stay.checkInDay + 1;
  const totalNights = stay.checkOutDay - stay.checkInDay + 1;
  return totalNights > 1 ? `Night ${nightIndex} / ${totalNights}` : `Night ${nightIndex}`;
}

const SAMPLE_IMAGES = [
  'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=900&q=80',
  'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=600&q=80',
  'https://images.unsplash.com/photo-1480796927426-f609979314bd?w=600&q=80',
];

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  planning: { label: 'Planning', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  traveling: { label: 'Traveling', color: 'bg-green-50 text-green-700 border-green-200' },
  completed: { label: 'Completed', color: 'bg-background-100 text-foreground-600 border-background-200' },
  published: { label: 'Published', color: 'bg-accent-50 text-accent-700 border-accent-200' },
};

const TRANSIT_OPTIONS = [
  { mode: 'walk', label: 'Walk', icon: 'ri-walk-line' },
  { mode: 'train', label: 'Train', icon: 'ri-train-line' },
  { mode: 'bus', label: 'Bus', icon: 'ri-bus-line' },
  { mode: 'taxi', label: 'Taxi', icon: 'ri-taxi-line' },
  { mode: 'car', label: 'Car', icon: 'ri-car-line' },
  { mode: 'other', label: 'Other', icon: 'ri-navigation-line' },
];

const TRANSIT_LABELS: Record<string, string> = {
  walk: 'Walk to next stop',
  train: 'Take train / subway',
  bus: 'Take bus',
  taxi: 'Take taxi',
  car: 'Drive',
  other: 'Move to next stop',
};

function transitIcon(mode?: string, title?: string): string {
  if (mode === 'walk' || title?.includes('歩')) return 'ri-walk-line';
  if (mode === 'train' || title?.includes('電') || title?.includes('Train')) return 'ri-train-line';
  if (mode === 'bus' || title?.includes('バス')) return 'ri-bus-line';
  if (mode === 'taxi' || title?.includes('タクシー')) return 'ri-taxi-line';
  if (mode === 'car' || title?.includes('車')) return 'ri-car-line';
  return 'ri-arrow-down-line';
}

async function callTripAction(tripId: string, action: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/trips?id=${encodeURIComponent(tripId)}&action=${action}`, {
    method: 'PATCH', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.ok ? res.json() : null;
}

export default function MyTripDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [spotData, setSpotData] = useState<Map<string, Destination>>(new Map());
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [travelMode, setTravelMode] = useState(false);
  const [currentTravelDay, setCurrentTravelDay] = useState(1);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [addingToDay, setAddingToDay] = useState<number | null>(null);
  const [newSpotTitle, setNewSpotTitle] = useState('');
  const [assigningItemId, setAssigningItemId] = useState<string | null>(null);
  const [editingTimeItemId, setEditingTimeItemId] = useState<string | null>(null);
  const [editingTimeValue, setEditingTimeValue] = useState('');
  const [editingStayDay, setEditingStayDay] = useState<number | null>(null);
  const [editingStayValue, setEditingStayValue] = useState('');
  const [editingTransitIdx, setEditingTransitIdx] = useState<string | null>(null);
  const [pendingBookingId, setPendingBookingId] = useState<string | null>(null);
  const [bookingErrors, setBookingErrors] = useState<Record<string, string>>({});
  const [coverUploading, setCoverUploading] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const isEditable = (status?: string) => status === 'planning' || status === 'traveling';

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    let cancelled = false;
    async function fetchData() {
      try {
        const [tripRes, destRes] = await Promise.all([
          fetch('/api/trips', { credentials: 'include' }),
          fetch('/api/content?type=destinations'),
        ]);
        const tripJson = await tripRes.json();
        const destJson = await destRes.json();
        if (cancelled) return;
        if (Array.isArray(tripJson?.trips)) {
          const found = tripJson.trips.find((t: Trip) => t.id === id) ?? null;
          if (!found) { navigate('/my-trip'); return; }
          setTrip(found);
          // transport itemsが含まれていない古いTripを自動再構築
          const hasTransport = (found.items || []).some((it: TripItem) => it.itemType === 'transport');
          const hasActivities = (found.days || []).some((d: TripDay) => (d.activities || []).some((a: TripActivity) => a.type === 'transport'));
          if (!hasTransport && hasActivities) {
            fetch(`/api/trips?id=${encodeURIComponent(found.id)}&action=rebuildItemsFromDays`, {
              method: 'PATCH', credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({}),
            }).then((r) => r.json()).then((data) => {
              if (data?.trip && !cancelled) setTrip(data.trip);
            }).catch(() => {});
          }
        }
        if (Array.isArray(destJson?.data)) {
          const map = new Map<string, Destination>();
          for (const dest of destJson.data as Destination[]) { if (dest.id) map.set(dest.id, dest); }
          setSpotData(map);
        }
      } catch { if (!cancelled) navigate('/my-trip'); }
      finally { if (!cancelled) setLoading(false); }
    }
    fetchData();
    return () => { cancelled = true; };
  }, [id, user, navigate]);

  // ── handlers ──
  const handleRemoveItem = async (item: TripItem) => {
    if (!trip) return;
    setBusyItemId(item.id);
    const data = await callTripAction(trip.id, 'removeItem', { itemId: item.id });
    if (data?.trip) setTrip(data.trip);
    setBusyItemId(null);
  };

  const handleMoveItem = async (item: TripItem, direction: -1 | 1) => {
    if (!trip) return;
    const dayItems = (trip.items || [])
      .filter((it) => it.planLevel !== 'saved' && (it.day || 1) === (item.day || 1) && !it.mealSlot && it.itemType !== 'transport')
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const idx = dayItems.findIndex((it) => it.id === item.id);
    const targetIdx = idx + direction;
    if (idx === -1 || targetIdx < 0 || targetIdx >= dayItems.length) return;
    const reordered = [...dayItems];
    [reordered[idx], reordered[targetIdx]] = [reordered[targetIdx], reordered[idx]];
    setBusyItemId(item.id);
    const data = await callTripAction(trip.id, 'reorderDayItems', {
      day: item.day || 1,
      itemIds: reordered.map((it) => it.id),
    });
    if (data?.trip) setTrip(data.trip);
    setBusyItemId(null);
  };

  const handleAddSpot = async (dayNum: number) => {
    const title = newSpotTitle.trim();
    if (!title || !trip) return;
    const data = await callTripAction(trip.id, 'addItem', {
      title, itemType: 'sightseeing', planLevel: 'day_assigned', day: dayNum, status: 'planned',
    });
    if (data?.trip) setTrip(data.trip);
    setNewSpotTitle('');
    setAddingToDay(null);
  };

  const handleAssignToDay = async (item: TripItem, dayNum: number) => {
    if (!trip) return;
    setBusyItemId(item.id);
    const data = await callTripAction(trip.id, 'updateItem', {
      itemId: item.id, planLevel: 'day_assigned', day: dayNum,
    });
    if (data?.trip) setTrip(data.trip);
    setBusyItemId(null);
  };

  const handleUpdateTime = async (item: TripItem) => {
    if (!trip) return;
    setBusyItemId(item.id);
    const data = await callTripAction(trip.id, 'updateItem', {
      itemId: item.id,
      time: editingTimeValue.trim() || undefined,
      planLevel: editingTimeValue.trim() ? 'scheduled' : 'day_assigned',
    });
    if (data?.trip) setTrip(data.trip);
    setBusyItemId(null);
    setEditingTimeItemId(null);
    setEditingTimeValue('');
  };

  const handleUpdateStay = async (stay: TripStay) => {
    if (!trip) return;
    const newName = editingStayValue.trim();
    if (!newName) return;
    try {
      const res = await fetch(`/api/trips?id=${encodeURIComponent(trip.id)}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stayId: stay.id, hotelName: newName }),
      });
      const data = await res.json();
      if (data?.trip) setTrip(data.trip);
    } catch { /* silent */ }
    setEditingStayDay(null);
    setEditingStayValue('');
  };

  const handleSetTransit = async (fromItemId: string, mode: string, dayNum: number, fromOrder: number) => {
    if (!trip) return;
    const title = TRANSIT_LABELS[mode] || 'Move to next stop';
    const dayItems = (trip.items || [])
      .filter((it) => (it.day || 1) === dayNum && it.planLevel !== 'saved')
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const fromIdx = dayItems.findIndex((it) => it.id === fromItemId);
    const nextItem = fromIdx >= 0 ? dayItems[fromIdx + 1] : null;
    const existingTransport = nextItem?.itemType === 'transport' ? nextItem : null;
    if (existingTransport) {
      const data = await callTripAction(trip.id, 'updateItem', { itemId: existingTransport.id, title, description: mode });
      if (data?.trip) setTrip(data.trip);
    } else {
      const data = await callTripAction(trip.id, 'addItem', {
        title, description: mode, itemType: 'transport',
        planLevel: 'day_assigned', day: dayNum, order: fromOrder + 0.5, status: 'planned',
      });
      if (data?.trip) setTrip(data.trip);
    }
    setEditingTransitIdx(null);
  };

  const handleRemoveMeal = async (mealId: string) => {
    if (!trip) return;
    try {
      const res = await fetch(`/api/trips?id=${encodeURIComponent(trip.id)}&action=removeMeal`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mealId }),
      });
      const data = await res.json();
      if (data?.trip) setTrip(data.trip);
    } catch { /* silent */ }
  };

  const handleMarkBooked = async (targetId: string) => {
    if (!trip) return;
    setPendingBookingId(targetId);
    setBookingErrors((prev) => { const n = { ...prev }; delete n[targetId]; return n; });
    try {
      const res = await fetch(`/api/trips?id=${encodeURIComponent(trip.id)}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId, status: 'booked' }),
      });
      if (!res.ok) throw new Error('Failed');
      setTrip((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          stays: prev.stays.map((s) => s.id === targetId ? { ...s, status: 'booked' as const } : s),
          days: prev.days.map((d) => ({
            ...d,
            meals: {
              breakfast: d.meals?.breakfast?.id === targetId ? { ...d.meals.breakfast, status: 'booked' as const } : d.meals?.breakfast,
              lunch: d.meals?.lunch?.id === targetId ? { ...d.meals.lunch, status: 'booked' as const } : d.meals?.lunch,
              dinner: d.meals?.dinner?.id === targetId ? { ...d.meals.dinner, status: 'booked' as const } : d.meals?.dinner,
            },
          })),
        };
      });
    } catch {
      setBookingErrors((prev) => ({ ...prev, [targetId]: 'Could not mark as booked.' }));
    } finally { setPendingBookingId(null); }
  };

  const handleMarkVisited = async (itemId: string) => {
    if (!trip) return;
    setBusyItemId(itemId);
    const data = await callTripAction(trip.id, 'markVisited', { itemId });
    if (data?.trip) setTrip(data.trip);
    setBusyItemId(null);
  };

  const handleStartTravel = async () => {
    if (!trip) return;
    try {
      const res = await fetch(`/api/trips?id=${encodeURIComponent(trip.id)}&action=reflect`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'traveling' }),
      });
      const data = await res.json();
      if (data?.trip) setTrip(data.trip);
      setTravelMode(true);
      setCurrentTravelDay(1);
    } catch { /* silent */ }
  };

  const handleCoverUpload = async (file: File) => {
    if (!trip) return;
    setCoverUploading(true);
    try {
      const urlRes = await fetch('/api/upload-url', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: file.type, fileSize: file.size }),
      });
      const { uploadUrl, publicUrl } = await urlRes.json();
      if (!uploadUrl) throw new Error('No upload URL');
      await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
      const res = await fetch(`/api/trips?id=${encodeURIComponent(trip.id)}&action=setCoverImage`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coverImageUrl: publicUrl }),
      });
      const data = await res.json();
      if (data?.trip) setTrip(data.trip);
    } catch { /* silent */ }
    finally { setCoverUploading(false); }
  };

  const renderBookingControl = (status: string | undefined, targetId: string) => {
    if (status === 'booked') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-1 whitespace-nowrap flex-shrink-0">
          <i className="ri-check-line"></i>Booked
        </span>
      );
    }
    const isPending = pendingBookingId === targetId;
    return (
      <button
        onClick={() => handleMarkBooked(targetId)}
        disabled={isPending}
        className="text-xs font-semibold border border-background-200 text-foreground-600 hover:bg-background-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap flex-shrink-0"
      >
        {isPending ? 'Saving...' : 'Mark booked'}
      </button>
    );
  };

  const getHeaderImages = (trip: Trip): string[] => {
    const result: string[] = [];
    if ((trip as any).coverImageUrl && isUsableImage((trip as any).coverImageUrl)) {
      result.push((trip as any).coverImageUrl);
    }
    for (const day of trip.days || []) {
      for (const act of day.activities || []) {
        if (act.type === 'transport') continue;
        if (act.spotId) {
          const dest = spotData.get(act.spotId);
          if (dest?.image && isUsableImage(dest.image) && !result.includes(dest.image)) result.push(dest.image);
        }
        if (result.length >= 3) return result;
      }
    }
    while (result.length < 3) result.push(SAMPLE_IMAGES[result.length]);
    return result;
  };

  const getItemsForDay = (dayNum: number) =>
    (trip?.items || [])
      .filter((it) => it.planLevel !== 'saved' && (it.day || 1) === dayNum && !it.mealSlot)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  // ── render ──
  if (loading) {
    return (
      <main className="min-h-screen bg-background-50">
        <Navbar />
        <div className="pt-28 pb-16 px-4 max-w-3xl mx-auto space-y-4">
          <div className="h-72 bg-background-200 rounded-2xl animate-pulse"></div>
          <div className="h-48 bg-background-200 rounded-2xl animate-pulse"></div>
        </div>
      </main>
    );
  }

  if (!trip) {
    return (
      <main className="min-h-screen bg-background-50">
        <Navbar />
        <div className="pt-28 pb-16 px-6 text-center">
          <p className="text-foreground-500">Trip not found.</p>
          <Link to="/my-trip" className="text-primary-500 text-sm font-semibold mt-4 inline-block">← Back to My Trips</Link>
        </div>
        <Footer />
      </main>
    );
  }

  const headerImages = getHeaderImages(trip);
  const budgetText = formatBudget((trip as any).budgetMin, (trip as any).budgetMax);
  const dayCount = trip.days?.length || 0;
  const statusBadge = STATUS_BADGE[trip.status || 'planning'] || STATUS_BADGE.planning;
  const visitedIds = new Set((trip.actualVisitLog || []).map((l) => l.itemId));

  return (
    <main className="min-h-screen bg-background-50">
      <Navbar />
      <article>
        {/* Hero */}
        <div style={{ position: 'relative', height: '280px', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'grid', gridTemplateColumns: '2fr 1fr', gridTemplateRows: '140px 140px', gap: '3px' }}>
            <img src={headerImages[0]} alt={trip.title} style={{ gridRow: '1 / 3', width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            <img src={headerImages[1]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            <img src={headerImages[2]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(10,18,40,0.55) 0%, rgba(10,18,40,0.0) 30%, rgba(10,18,40,0.0) 45%, rgba(10,18,40,0.88) 100%)' }}></div>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 20px 20px', maxWidth: '768px', margin: '0 auto' }}>
            <div className="flex flex-wrap gap-1.5 mb-2">
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${statusBadge.color}`}>{statusBadge.label}</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-white/15 text-white">{dayCount} {dayCount === 1 ? 'day' : 'days'}</span>
              {budgetText && <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full text-amber-300" style={{ background: 'rgba(200,155,60,0.25)' }}>{budgetText}</span>}
            </div>
            <h1 className="font-heading font-bold text-xl text-white leading-snug">{trip.title}</h1>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 md:px-6 py-5">
          {/* パンくず */}
          <nav className="flex items-center gap-1.5 text-foreground-400 text-xs mb-4 flex-wrap">
            <Link to="/" className="hover:text-foreground-700">Home</Link>
            <span>/</span>
            <Link to="/my-trip" className="hover:text-foreground-700">My Trips</Link>
            <span>/</span>
            <span className="text-foreground-600 line-clamp-1">{trip.title}</span>
          </nav>

          {/* アクションボタン */}
          <div className="flex gap-2 mb-5 flex-wrap">
            {trip.status === 'planning' && (
              <button onClick={handleStartTravel} className="inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white font-semibold text-sm px-4 py-2 rounded-xl cursor-pointer">
                <i className="ri-map-pin-line"></i>Start Travel
              </button>
            )}
            {trip.status === 'traveling' && (
              <button
                onClick={() => setTravelMode(!travelMode)}
                className={`inline-flex items-center gap-1.5 font-semibold text-sm px-4 py-2 rounded-xl cursor-pointer ${travelMode ? 'bg-foreground-900 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}`}
              >
                <i className={travelMode ? 'ri-close-line' : 'ri-navigation-line'}></i>
                {travelMode ? 'Exit Travel Mode' : 'Travel Mode'}
              </button>
            )}
            {isEditable(trip.status) && !travelMode && (
              <button
                onClick={() => { setEditMode(!editMode); setAddingToDay(null); setEditingTimeItemId(null); setEditingStayDay(null); }}
                className={`inline-flex items-center gap-1.5 font-semibold text-sm px-4 py-2 rounded-xl cursor-pointer ${editMode ? 'bg-foreground-900 text-white' : 'bg-primary-600 hover:bg-primary-700 text-white'}`}
              >
                <i className={editMode ? 'ri-check-line' : 'ri-edit-line'}></i>
                {editMode ? 'Done editing' : 'Edit'}
              </button>
            )}
            {editMode && (
              <>
                <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCoverUpload(f); e.target.value = ''; }} />
                <button onClick={() => coverInputRef.current?.click()} disabled={coverUploading}
                  className="inline-flex items-center gap-1.5 bg-white border border-background-200 hover:bg-background-50 disabled:opacity-60 text-foreground-700 font-semibold text-sm px-4 py-2 rounded-xl cursor-pointer">
                  <i className={coverUploading ? 'ri-loader-4-line animate-spin' : 'ri-camera-line'}></i>
                  {coverUploading ? 'Uploading...' : 'Change cover photo'}
                </button>
              </>
            )}
            <Link to={`/trips/${trip.id}`} className="inline-flex items-center gap-1.5 bg-white border border-background-200 hover:bg-background-50 text-foreground-700 font-semibold text-sm px-4 py-2 rounded-xl">
              <i className="ri-eye-line"></i>Preview
            </Link>
          </div>

          {/* ── TRAVEL MODE ── */}
          {travelMode && (() => {
            const days = [...(trip.days || [])].sort((a, b) => a.day - b.day);
            const currentDay = days.find((d) => d.day === currentTravelDay);
            const stay = (trip.stays || []).find((s) => currentTravelDay >= s.checkInDay && currentTravelDay <= s.checkOutDay);
            const travelItems = getItemsForDay(currentTravelDay);

            return (
              <div className="mb-6">
                <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
                  {days.map((d) => (
                    <button key={d.day} onClick={() => setCurrentTravelDay(d.day)}
                      className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer ${currentTravelDay === d.day ? 'bg-foreground-900 text-white' : 'bg-white border border-background-200 text-foreground-600'}`}>
                      Day {d.day}
                    </button>
                  ))}
                </div>

                <div className="bg-white border border-background-200 rounded-2xl overflow-hidden">
                  <div className="bg-foreground-900 px-4 py-3">
                    <p className="text-xs font-bold tracking-wider text-primary-300">DAY {currentTravelDay}</p>
                    {currentDay && <p className="text-xs text-foreground-500 mt-0.5">{getDayRoute(currentDay as TripDay)}</p>}
                  </div>

                  <div className="divide-y divide-background-100">
                    {travelItems.length === 0 && (
                      <p className="text-xs text-foreground-300 italic px-4 py-4 text-center">No spots for this day</p>
                    )}
                    {travelItems.map((item, idx) => {
                      const visited = visitedIds.has(item.id);
                      const isBusy = busyItemId === item.id;
                      const isTransport = item.itemType === 'transport';
                      const nextItem = travelItems[idx + 1];
                      const showAutoTransit = !isTransport && nextItem && nextItem.itemType !== 'transport';

                      if (isTransport) {
                        return (
                          <div key={item.id} className="flex items-center gap-2.5 px-4 py-2.5 bg-background-50">
                            <i className={`${transitIcon(item.description, item.title)} text-foreground-400 text-sm flex-shrink-0`}></i>
                            <p className="text-xs font-medium text-foreground-600 truncate">{item.title}</p>
                          </div>
                        );
                      }

                      return (
                        <div key={item.id}>
                          <div className={`flex items-center gap-3 px-4 py-3 ${visited ? 'bg-green-50' : ''}`}>
                            <button
                              onClick={() => !visited && handleMarkVisited(item.id)}
                              disabled={visited || isBusy}
                              className={`w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 cursor-pointer ${visited ? 'bg-green-500 border-green-500' : 'border-background-300 hover:border-green-400'}`}
                            >
                              {visited && <i className="ri-check-line text-white text-sm"></i>}
                              {isBusy && <i className="ri-loader-4-line animate-spin text-foreground-400 text-sm"></i>}
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-semibold ${visited ? 'text-foreground-400 line-through' : 'text-foreground-900'}`}>{item.title}</p>
                              {item.time && <p className="text-xs text-foreground-400 mt-0.5">{item.time}</p>}
                              {item.description && !visited && <p className="text-xs text-foreground-500 mt-0.5 line-clamp-2">{item.description}</p>}
                            </div>
                            <a href={`https://www.google.com/maps/search/${encodeURIComponent(item.title)}`} target="_blank" rel="noopener noreferrer"
                              className="w-9 h-9 flex items-center justify-center bg-background-50 border border-background-200 rounded-xl text-foreground-500 hover:bg-primary-50 hover:text-primary-600 flex-shrink-0">
                              <i className="ri-map-pin-line text-sm"></i>
                            </a>
                          </div>
                          {/* スポット間移動帯（Travel Mode） */}
                          {showAutoTransit && (
                            <div>
                              <button
                                onClick={() => setEditingTransitIdx(editingTransitIdx === item.id ? null : item.id)}
                                className="w-full flex items-center gap-2.5 px-4 py-2 bg-background-50 border-t border-background-100 hover:bg-background-100 cursor-pointer"
                              >
                                <i className="ri-arrow-down-line text-foreground-400 text-sm flex-shrink-0"></i>
                                <span className="text-xs text-foreground-500 flex-1 text-left">Move to next stop</span>
                                <i className="ri-pencil-line text-foreground-300 text-xs"></i>
                              </button>
                              {editingTransitIdx === item.id && (
                                <div className="bg-white border-b border-background-200 px-4 py-3">
                                  <p className="text-xs font-bold text-foreground-500 uppercase tracking-wider mb-2">Choose transport</p>
                                  <div className="grid grid-cols-3 gap-2">
                                    {TRANSIT_OPTIONS.map((opt) => (
                                      <button key={opt.mode}
                                        onClick={() => handleSetTransit(item.id, opt.mode, currentTravelDay, item.order ?? idx)}
                                        className="flex flex-col items-center gap-1 py-2.5 px-2 bg-background-50 border border-background-200 rounded-xl hover:border-primary-400 hover:bg-primary-50 cursor-pointer">
                                        <i className={`${opt.icon} text-lg text-foreground-500`}></i>
                                        <span className="text-xs font-medium text-foreground-600 text-center leading-tight">{opt.label}</span>
                                      </button>
                                    ))}
                                  </div>
                                  <button onClick={() => setEditingTransitIdx(null)} className="mt-2 text-xs text-foreground-400 cursor-pointer w-full text-center py-1">Cancel</button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {stay && (
                    <div className="border-t border-background-200 px-4 py-3 flex items-center gap-3 bg-background-50">
                      <i className="ri-hotel-line text-foreground-400"></i>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-foreground-400">Tonight's stay</p>
                        <p className="text-sm font-semibold text-foreground-900 truncate">{stay.hotelName}</p>
                      </div>
                      {renderBookingControl(stay.status, stay.id)}
                    </div>
                  )}

                  {currentDay && (currentDay.meals?.breakfast || currentDay.meals?.lunch || currentDay.meals?.dinner) && (
                    <div className="border-t border-background-200 px-4 py-3 bg-background-50">
                      <p className="text-xs font-bold tracking-widest uppercase text-foreground-400 mb-2 flex items-center gap-1.5">
                        <i className="ri-restaurant-line"></i>Meals
                      </p>
                      <div className="space-y-1.5">
                        {currentDay.meals.breakfast && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-orange-700 w-4">B</span>
                            <span className="text-sm text-foreground-700 flex-1">{currentDay.meals.breakfast.suggestion}</span>
                            {renderBookingControl(currentDay.meals.breakfast.status, currentDay.meals.breakfast.id)}
                          </div>
                        )}
                        {currentDay.meals.lunch && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-orange-700 w-4">L</span>
                            <span className="text-sm text-foreground-700 flex-1">{currentDay.meals.lunch.suggestion}</span>
                            {renderBookingControl(currentDay.meals.lunch.status, currentDay.meals.lunch.id)}
                          </div>
                        )}
                        {currentDay.meals.dinner && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-orange-700 w-4">D</span>
                            <span className="text-sm text-foreground-700 flex-1">{currentDay.meals.dinner.suggestion}</span>
                            {renderBookingControl(currentDay.meals.dinner.status, currentDay.meals.dinner.id)}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-3 text-center text-xs text-foreground-400">
                  {visitedIds.size} of {(trip.items || []).filter((it) => it.planLevel !== 'saved' && it.itemType !== 'transport').length} spots visited
                </div>
              </div>
            );
          })()}

          {/* ── 通常表示 ── */}
          {!travelMode && (
            <>
              {/* Saved for Trip */}
              {(() => {
                const savedItems = (trip.items || []).filter((it) => it.planLevel === 'saved');
                if (savedItems.length === 0) return null;
                return (
                  <div className="mb-5 bg-white border border-background-200 rounded-2xl overflow-hidden">
                    <div className="bg-background-100 px-4 py-2.5 border-b border-background-200">
                      <p className="text-xs font-bold tracking-widest uppercase text-foreground-500">Saved for Trip — not yet assigned to a day</p>
                    </div>
                    <div className="divide-y divide-background-100">
                      {savedItems.map((item) => {
                        const catStyle = getCatStyle(item.itemType);
                        const isAssigning = assigningItemId === item.id;
                        const isBusy = busyItemId === item.id;
                        return (
                          <div key={item.id} className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {item.imageUrl ? (
                                <img src={item.imageUrl} alt={item.title} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-background-100 flex items-center justify-center flex-shrink-0">
                                  <i className="ri-map-pin-line text-foreground-400 text-sm"></i>
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-foreground-900 truncate">{item.title}</p>
                                {catStyle && <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full inline-block mt-0.5 ${catStyle.bg} ${catStyle.text}`}>{catStyle.label}</span>}
                              </div>
                              <button onClick={() => setAssigningItemId(isAssigning ? null : item.id)} disabled={isBusy}
                                className="text-xs font-semibold text-primary-600 bg-primary-50 hover:bg-primary-100 border border-primary-200 px-2.5 py-1.5 rounded-lg cursor-pointer flex-shrink-0 flex items-center gap-1">
                                <i className="ri-calendar-line text-xs"></i>Add to day
                              </button>
                              {editMode && (
                                <button onClick={() => handleRemoveItem(item)} disabled={isBusy}
                                  className="w-7 h-7 flex items-center justify-center bg-background-50 border border-background-200 rounded-lg text-foreground-300 hover:bg-red-50 hover:text-red-500 cursor-pointer flex-shrink-0">
                                  <i className="ri-delete-bin-line text-sm"></i>
                                </button>
                              )}
                            </div>
                            {isAssigning && (
                              <div className="flex items-center gap-2 mt-2 flex-wrap">
                                <span className="text-xs text-foreground-500">Assign to:</span>
                                {Array.from({ length: (trip.days || []).length }, (_, i) => i + 1).map((d) => (
                                  <button key={d} onClick={() => { handleAssignToDay(item, d); setAssigningItemId(null); }} disabled={isBusy}
                                    className="text-xs font-semibold px-2.5 py-1 bg-white border border-background-200 hover:border-primary-400 hover:bg-primary-50 rounded-lg cursor-pointer">
                                    Day {d}
                                  </button>
                                ))}
                                <button onClick={() => setAssigningItemId(null)} className="text-xs text-foreground-400 cursor-pointer ml-1">Cancel</button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Dayカード */}
              <div className="space-y-4">
                {[...(trip.days || [])].sort((a, b) => a.day - b.day).map((day) => {
                  const nonTransport = (day.activities || []).filter((a: TripActivity) => a.type !== 'transport');
                  const stay = (trip.stays || []).find((s: TripStay) => day.day >= s.checkInDay && day.day <= s.checkOutDay);
                  const prevStay = (trip.stays || []).find((s: TripStay) => (day.day - 1) >= s.checkInDay && (day.day - 1) <= s.checkOutDay);
                  const isSameStay = stay && prevStay && stay.hotelName === prevStay.hotelName;
                  const dayRoute = getDayRoute(day as TripDay);
                  const allDayItems = getItemsForDay(day.day);
                  const scheduleItems = allDayItems.filter((it) => it.itemType !== 'transport');
                  const transportItems = allDayItems.filter((it) => it.itemType === 'transport');
                  const migrated = !!trip.daysActivitiesMigrated;

                  // Mealsをスケジュールに統合（食事場所→移動手段漏れを防ぐ）
                  const mealEntries: any[] = [];
                  if (day.meals?.breakfast) mealEntries.push({
                    id: `meal-b-${day.day}`, title: day.meals.breakfast.suggestion,
                    mealType: 'breakfast', mealLabel: 'Breakfast', mealId: day.meals.breakfast.id,
                    mealStatus: (day.meals.breakfast as any).status, isMeal: true, time: '08:00',
                  });
                  if (day.meals?.lunch) mealEntries.push({
                    id: `meal-l-${day.day}`, title: day.meals.lunch.suggestion,
                    mealType: 'lunch', mealLabel: 'Lunch', mealId: day.meals.lunch.id,
                    mealStatus: (day.meals.lunch as any).status, isMeal: true, time: '12:00',
                  });
                  if (day.meals?.dinner) mealEntries.push({
                    id: `meal-d-${day.day}`, title: day.meals.dinner.suggestion,
                    mealType: 'dinner', mealLabel: 'Dinner', mealId: day.meals.dinner.id,
                    mealStatus: (day.meals.dinner as any).status, isMeal: true, time: '19:00',
                  });

                  const baseEntries = migrated
                    ? scheduleItems
                    : [...nonTransport.map((a: TripActivity, i: number) => ({ id: `legacy-${i}`, title: a.title, time: a.time, description: a.description, category: a.category, isLegacy: true })), ...scheduleItems];

                  // Mealsをtime順で混在させる
                  const scheduleEntries = [...baseEntries, ...mealEntries].sort((a, b) => {
                    const ta = a.time || '99:99';
                    const tb = b.time || '99:99';
                    return ta.localeCompare(tb);
                  });

                  return (
                    <div key={day.day} className="bg-white border border-background-200 rounded-2xl overflow-hidden">
                      <div className="bg-foreground-900 px-4 py-2.5 flex items-center gap-3">
                        <span className="text-xs font-bold tracking-wider text-primary-300">DAY {day.day}</span>
                        {dayRoute && <span className="text-xs text-foreground-500 truncate">{dayRoute}</span>}
                      </div>

                      {/* Schedule */}
                      <div className="px-4 py-3 border-b border-background-100">
                        <p className="text-xs font-bold tracking-widest uppercase text-foreground-400 mb-3 flex items-center gap-1.5">
                          <i className="ri-map-pin-line"></i>Schedule
                        </p>
                        {scheduleEntries.length === 0 && (
                          <p className="text-xs text-foreground-300 italic mb-3">No spots yet</p>
                        )}
                        {scheduleEntries.map((entry: any, idx: number) => {
                          const isLast = idx === scheduleEntries.length - 1;
                          const dest = entry.spotId ? spotData.get(entry.spotId) : undefined;
                          const imgUrl = dest?.image && isUsableImage(dest.image) ? dest.image : undefined;
                          const catStyle = entry.isMeal ? null : getCatStyle(dest?.category || entry.category || entry.itemType);
                          const isBusy = busyItemId === entry.id;
                          const isItem = !entry.isLegacy && !entry.isMeal && entry.planLevel !== undefined;
                          const currentOrder = entry.order ?? idx;
                          const nextEntry = scheduleEntries[idx + 1];
                          const nextOrder = nextEntry?.order ?? (idx + 1);
                          const nextTransport = !isLast ? transportItems.find((t) => {
                            const to = t.order ?? 0;
                            return to > currentOrder && to < nextOrder;
                          }) : undefined;

                          // Mealエントリの表示
                          if (entry.isMeal) {
                            const mealIcon = entry.mealType === 'breakfast' ? 'ri-sun-line' : entry.mealType === 'lunch' ? 'ri-restaurant-line' : 'ri-moon-line';
                            const mealColor = 'text-orange-700';
                            return (
                              <div key={entry.id}>
                                <div className="flex items-stretch gap-2">
                                  <div className="flex flex-col items-center w-3 flex-shrink-0">
                                    <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5 bg-orange-400"></div>
                                    {!isLast && <div className="w-px bg-background-200 flex-1 mt-1"></div>}
                                  </div>
                                  <div className={`flex-1 min-w-0 flex items-center gap-2 ${isLast ? 'pb-0' : 'pb-3'}`}>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs text-foreground-400 mb-0.5">{entry.time} · {entry.mealLabel}</p>
                                      <div className="flex items-center gap-1.5">
                                        <i className={`${mealIcon} ${mealColor} text-sm flex-shrink-0`}></i>
                                        <p className="text-sm font-semibold text-foreground-900 truncate">{entry.title}</p>
                                      </div>
                                    </div>
                                    {renderBookingControl(entry.mealStatus, entry.mealId)}
                                    {editMode && (
                                      <button onClick={() => handleRemoveMeal(entry.mealId)}
                                        className="w-7 h-7 flex items-center justify-center bg-background-50 border border-background-200 rounded-lg text-foreground-300 hover:bg-red-50 hover:text-red-500 cursor-pointer flex-shrink-0">
                                        <i className="ri-delete-bin-line text-sm"></i>
                                      </button>
                                    )}
                                  </div>
                                </div>
                                {/* 移動帯 */}
                                {!isLast && (
                                  <div className="ml-5 mb-2">
                                    <button
                                      onClick={() => setEditingTransitIdx(editingTransitIdx === `normal-${entry.id}` ? null : `normal-${entry.id}`)}
                                      className="w-full flex items-center gap-2 bg-background-50 border border-background-100 rounded-lg px-3 py-1.5 hover:bg-background-100 cursor-pointer text-left"
                                    >
                                      <i className={`${transitIcon(nextTransport?.description, nextTransport?.title)} text-xs text-foreground-400 flex-shrink-0`}></i>
                                      <span className="text-xs text-foreground-400 truncate flex-1">{nextTransport?.title || 'Move to next stop'}</span>
                                      <i className="ri-pencil-line text-foreground-300 text-xs flex-shrink-0"></i>
                                    </button>
                                    {editingTransitIdx === `normal-${entry.id}` && (
                                      <div className="bg-white border border-background-200 rounded-xl p-3 mt-1.5">
                                        <p className="text-xs font-bold text-foreground-500 uppercase tracking-wider mb-2">Choose transport</p>
                                        <div className="grid grid-cols-3 gap-2">
                                          {TRANSIT_OPTIONS.map((opt) => (
                                            <button key={opt.mode}
                                              onClick={() => { setEditingTransitIdx(null); }}
                                              className="flex flex-col items-center gap-1 py-2 px-2 bg-background-50 border border-background-200 rounded-xl hover:border-primary-400 hover:bg-primary-50 cursor-pointer">
                                              <i className={`${opt.icon} text-base text-foreground-500`}></i>
                                              <span className="text-xs font-medium text-foreground-600 text-center leading-tight">{opt.label}</span>
                                            </button>
                                          ))}
                                        </div>
                                        <button onClick={() => setEditingTransitIdx(null)} className="mt-2 text-xs text-foreground-400 cursor-pointer w-full text-center py-1">Cancel</button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          }

                          return (
                            <div key={entry.id || idx}>
                              <div className="flex items-stretch gap-2">
                                {/* タイムライン */}
                                <div className="flex flex-col items-center w-3 flex-shrink-0">
                                  <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: isLast && scheduleEntries.length > 1 ? '#cbd5e1' : '#3b6fd4' }}></div>
                                  {!isLast && <div className="w-px bg-background-200 flex-1 mt-1"></div>}
                                </div>
                                {/* コンテンツ */}
                                <div className={`flex-1 min-w-0 flex gap-2 ${isLast ? 'pb-0' : 'pb-3'}`}>
                                  <div className="flex-1 min-w-0">
                                    {editingTimeItemId === entry.id ? (
                                      <div className="flex items-center gap-1.5 mb-1">
                                        <input type="time" value={editingTimeValue} onChange={(e) => setEditingTimeValue(e.target.value)}
                                          onKeyDown={(e) => { if (e.key === 'Enter') handleUpdateTime(entry); if (e.key === 'Escape') { setEditingTimeItemId(null); setEditingTimeValue(''); } }}
                                          className="bg-background-50 border border-primary-300 rounded-lg px-2 py-1 text-xs focus:outline-none" autoFocus />
                                        <button onClick={() => handleUpdateTime(entry)} className="text-xs text-primary-600 font-semibold cursor-pointer">Save</button>
                                        <button onClick={() => { setEditingTimeItemId(null); setEditingTimeValue(''); }} className="text-xs text-foreground-400 cursor-pointer">✕</button>
                                      </div>
                                    ) : (
                                      <div className={`flex items-center gap-1 mb-0.5 ${isItem && editMode ? 'cursor-pointer group' : ''}`}
                                        onClick={() => { if (isItem && editMode) { setEditingTimeItemId(entry.id); setEditingTimeValue(entry.time || ''); } }}>
                                        {entry.time ? (
                                          <p className="text-xs text-foreground-400">{entry.time}</p>
                                        ) : (
                                          <p className="text-xs text-foreground-300 italic">Want to go</p>
                                        )}
                                        {isItem && editMode && <i className="ri-pencil-line text-xs text-foreground-300 opacity-0 group-hover:opacity-100"></i>}
                                      </div>
                                    )}
                                    <p className="text-sm font-semibold text-foreground-900">{entry.title}</p>
                                    {catStyle && <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full inline-block mt-1 ${catStyle.bg} ${catStyle.text}`}>{catStyle.label}</span>}
                                    {entry.description && <p className="text-xs text-foreground-500 leading-relaxed mt-1">{entry.description}</p>}
                                  </div>
                                  {imgUrl && <img src={imgUrl} alt={entry.title} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />}
                                </div>
                                {/* 編集ボタン */}
                                {editMode && isItem && (
                                  <div className="flex flex-col gap-1 flex-shrink-0 pt-1">
                                    <button onClick={() => handleMoveItem(entry, -1)} disabled={isBusy || idx === 0}
                                      className="w-7 h-7 flex items-center justify-center bg-background-50 border border-background-200 rounded-lg text-foreground-400 hover:bg-background-100 disabled:opacity-20 cursor-pointer">
                                      <i className="ri-arrow-up-s-line text-sm"></i>
                                    </button>
                                    <button onClick={() => handleMoveItem(entry, 1)} disabled={isBusy || isLast}
                                      className="w-7 h-7 flex items-center justify-center bg-background-50 border border-background-200 rounded-lg text-foreground-400 hover:bg-background-100 disabled:opacity-20 cursor-pointer">
                                      <i className="ri-arrow-down-s-line text-sm"></i>
                                    </button>
                                    <button onClick={() => handleRemoveItem(entry)} disabled={isBusy}
                                      className="w-7 h-7 flex items-center justify-center bg-background-50 border border-background-200 rounded-lg text-foreground-300 hover:bg-red-50 hover:text-red-500 disabled:opacity-20 cursor-pointer">
                                      <i className="ri-delete-bin-line text-sm"></i>
                                    </button>
                                  </div>
                                )}
                              </div>
                              {/* スポット間移動帯（タップで選択可能） */}
                              {!isLast && (
                                <div className="ml-5 mb-2">
                                  <button
                                    onClick={() => setEditingTransitIdx(editingTransitIdx === `normal-${entry.id || idx}` ? null : `normal-${entry.id || idx}`)}
                                    className="w-full flex items-center gap-2 bg-background-50 border border-background-100 rounded-lg px-3 py-1.5 hover:bg-background-100 cursor-pointer text-left"
                                  >
                                    <i className={`${transitIcon(nextTransport?.description, nextTransport?.title)} text-xs text-foreground-400 flex-shrink-0`}></i>
                                    <span className="text-xs text-foreground-400 truncate flex-1">
                                      {nextTransport?.title || 'Move to next stop'}
                                    </span>
                                    <i className="ri-pencil-line text-foreground-300 text-xs flex-shrink-0"></i>
                                  </button>
                                  {editingTransitIdx === `normal-${entry.id || idx}` && (
                                    <div className="bg-white border border-background-200 rounded-xl p-3 mt-1.5 shadow-sm">
                                      <p className="text-xs font-bold text-foreground-500 uppercase tracking-wider mb-2">Choose transport</p>
                                      <div className="grid grid-cols-3 gap-2">
                                        {TRANSIT_OPTIONS.map((opt) => (
                                          <button key={opt.mode}
                                            onClick={() => isItem && handleSetTransit(entry.id, opt.mode, day.day, currentOrder)}
                                            className="flex flex-col items-center gap-1 py-2 px-2 bg-background-50 border border-background-200 rounded-xl hover:border-primary-400 hover:bg-primary-50 cursor-pointer">
                                            <i className={`${opt.icon} text-base text-foreground-500`}></i>
                                            <span className="text-xs font-medium text-foreground-600 text-center leading-tight">{opt.label}</span>
                                          </button>
                                        ))}
                                      </div>
                                      <button onClick={() => setEditingTransitIdx(null)} className="mt-2 text-xs text-foreground-400 cursor-pointer w-full text-center py-1">Cancel</button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Add a spot */}
                        {editMode && (addingToDay === day.day ? (
                          <div className="flex gap-2 mt-3">
                            <input ref={addInputRef} type="text" value={newSpotTitle} onChange={(e) => setNewSpotTitle(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleAddSpot(day.day); if (e.key === 'Escape') { setAddingToDay(null); setNewSpotTitle(''); } }}
                              placeholder="Spot name..." autoFocus
                              className="flex-1 bg-background-50 border border-background-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
                            <button onClick={() => handleAddSpot(day.day)} disabled={!newSpotTitle.trim()}
                              className="px-3 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg cursor-pointer">Add</button>
                            <button onClick={() => { setAddingToDay(null); setNewSpotTitle(''); }}
                              className="px-3 py-2 bg-background-100 hover:bg-background-200 text-foreground-600 text-xs font-semibold rounded-lg cursor-pointer">Cancel</button>
                          </div>
                        ) : (
                          <button onClick={() => setAddingToDay(day.day)}
                            className="flex items-center gap-2 w-full mt-3 px-3 py-2 border border-dashed border-background-300 hover:border-primary-400 hover:bg-primary-50 rounded-lg text-foreground-400 hover:text-primary-600 text-xs font-semibold cursor-pointer">
                            <i className="ri-add-line text-sm"></i>Add a spot
                          </button>
                        ))}
                      </div>

                      {/* Meals — スケジュールに統合済みのため非表示 */}

                      {/* Stay */}
                      {stay && (
                        <div className="px-4 py-3">
                          <p className="text-xs font-bold tracking-widest uppercase text-foreground-400 mb-3 flex items-center gap-1.5">
                            <i className="ri-hotel-line"></i>Stay
                          </p>
                          {editingStayDay === day.day && editMode ? (
                            <div className="flex gap-2">
                              <input type="text" value={editingStayValue} onChange={(e) => setEditingStayValue(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleUpdateStay(stay); if (e.key === 'Escape') { setEditingStayDay(null); setEditingStayValue(''); } }}
                                placeholder="Hotel name..." autoFocus
                                className="flex-1 bg-background-50 border border-primary-300 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                              <button onClick={() => handleUpdateStay(stay)} className="px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold rounded-lg cursor-pointer">Save</button>
                              <button onClick={() => { setEditingStayDay(null); setEditingStayValue(''); }} className="px-3 py-2 bg-background-100 text-foreground-600 text-xs font-semibold rounded-lg cursor-pointer">Cancel</button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                                <i className="ri-building-line text-primary-600 text-lg"></i>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-foreground-900 truncate">{stay.hotelName}</p>
                                {isSameStay && <p className="text-xs text-foreground-400">Same hotel — no check-in today</p>}
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-xs font-semibold text-primary-600 bg-primary-50 px-2.5 py-1 rounded-full">{getStayNightLabel(stay, day.day)}</span>
                                {renderBookingControl(stay.status, stay.id)}
                                {editMode && (
                                  <button onClick={() => { setEditingStayDay(day.day); setEditingStayValue(stay.hotelName); }}
                                    className="w-7 h-7 flex items-center justify-center bg-background-50 border border-background-200 rounded-lg text-foreground-400 hover:bg-background-100 cursor-pointer">
                                    <i className="ri-pencil-line text-sm"></i>
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <div className="mt-6">
            <Link to="/my-trip" className="inline-flex items-center gap-2 text-primary-500 hover:text-primary-600 font-semibold text-sm">
              <i className="ri-arrow-left-line"></i>Back to My Trips
            </Link>
          </div>
        </div>
      </article>
      <Footer />
    </main>
  );
}
