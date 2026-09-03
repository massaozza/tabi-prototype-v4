import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Navbar from '@/components/feature/Navbar';
import Footer from '@/components/feature/Footer';
import { useAuth } from '@/context/AuthContext';
import type { Trip } from '../types';
import TripPlanningPanel from '../components/TripPlanningPanel';

// TABI47：My Trip詳細ページ（/my-trip/:id）
// 公開Trip詳細ページと同じUIをベースに、編集機能（TripPlanningPanel）を追加。
// 自分のTripのみアクセス可能。

interface TripMeal { id: string; suggestion: string; }
interface TripActivity { type?: 'activity' | 'transport'; time?: string; title: string; description?: string; spotId?: string; category?: string; }
interface TripDay { day: number; date?: string; activities: TripActivity[]; meals: { breakfast?: TripMeal; lunch?: TripMeal; dinner?: TripMeal }; }
interface TripStay { id: string; hotelName: string; checkInDay: number; checkOutDay: number; }
interface Destination { id: string; title: string; image: string; category?: string; }

function formatBudget(min?: number, max?: number): string | null {
  if (!min && !max) return null;
  const fmt = (n: number) => n >= 10000 ? `¥${(n / 10000).toFixed(n % 10000 === 0 ? 0 : 1)}万` : `¥${n.toLocaleString()}`;
  if (min && max) return `${fmt(min)}–${fmt(max)}`;
  if (min) return `From ${fmt(min)}`;
  return `Under ${fmt(max!)}`;
}

function isUsableImage(url: string): boolean { return !!url && !url.includes('readdy.ai'); }

const CATEGORY_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  'sightseeing': { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Sightseeing' },
  'restaurant': { bg: 'bg-orange-50', text: 'text-orange-700', label: 'Restaurant' },
  'shopping': { bg: 'bg-pink-50', text: 'text-pink-700', label: 'Shopping' },
  'accommodation': { bg: 'bg-primary-50', text: 'text-primary-700', label: 'Stay' },
  'activity': { bg: 'bg-purple-50', text: 'text-purple-700', label: 'Activity' },
  'Culture & History': { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Culture' },
  'Nature & Scenery': { bg: 'bg-green-50', text: 'text-green-700', label: 'Nature' },
  'Food': { bg: 'bg-orange-50', text: 'text-orange-700', label: 'Food' },
  'City & Food Culture': { bg: 'bg-orange-50', text: 'text-orange-700', label: 'Food' },
  'Activities': { bg: 'bg-purple-50', text: 'text-purple-700', label: 'Activity' },
  'Hot Springs & Nature': { bg: 'bg-green-50', text: 'text-green-700', label: 'Onsen' },
  'Shopping & Fashion': { bg: 'bg-pink-50', text: 'text-pink-700', label: 'Shopping' },
  'Beach & Lifestyle': { bg: 'bg-cyan-50', text: 'text-cyan-700', label: 'Beach' },
};
function getCatStyle(cat?: string) { if (!cat) return null; return CATEGORY_STYLE[cat] || null; }

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

export default function MyTripDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [spotData, setSpotData] = useState<Map<string, Destination>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showPlanner, setShowPlanner] = useState(false);

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

  const getHeaderImages = (trip: Trip): string[] => {
    const result: string[] = [];
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

  return (
    <main className="min-h-screen bg-background-50">
      <Navbar />
      {loading ? (
        <div className="pt-28 pb-16 px-4 max-w-3xl mx-auto space-y-4">
          <div className="h-72 bg-background-200 rounded-2xl animate-pulse"></div>
          <div className="h-6 w-3/4 bg-background-200 rounded animate-pulse"></div>
          <div className="h-48 bg-background-200 rounded-2xl animate-pulse"></div>
        </div>
      ) : !trip ? null : (() => {
        const headerImages = getHeaderImages(trip);
        const budgetText = formatBudget(trip.budgetMin, trip.budgetMax);
        const dayCount = trip.days?.length || 0;
        const statusBadge = STATUS_BADGE[trip.status || 'planning'] || STATUS_BADGE.planning;

        return (
          <article>
            {/* Hero */}
            <div style={{ position: 'relative', height: '340px', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'grid', gridTemplateColumns: '2fr 1fr', gridTemplateRows: '170px 170px', gap: '3px' }}>
                <img src={headerImages[0]} alt={trip.title} style={{ gridRow: '1 / 3', width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                <img src={headerImages[1]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                <img src={headerImages[2]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(10,18,40,0.65) 0%, rgba(10,18,40,0.0) 28%, rgba(10,18,40,0.0) 42%, rgba(10,18,40,0.90) 100%)' }}></div>
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 20px 24px', maxWidth: '768px', margin: '0 auto' }}>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${statusBadge.color}`}>{statusBadge.label}</span>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-white/15 text-white">{dayCount} {dayCount === 1 ? 'day' : 'days'}</span>
                  {(trip.tags || []).slice(0, 2).map((tag) => (
                    <span key={tag} className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-white/10 text-white/80">{tag}</span>
                  ))}
                  {budgetText && (
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full text-amber-300" style={{ background: 'rgba(200,155,60,0.25)' }}>{budgetText}</span>
                  )}
                </div>
                <h1 className="font-heading font-bold text-2xl text-white leading-snug">{trip.title}</h1>
              </div>
            </div>

            <div className="max-w-3xl mx-auto px-4 md:px-6 py-5">
              {/* パンくず */}
              <nav className="flex items-center gap-1.5 text-foreground-400 text-xs mb-5 flex-wrap">
                <Link to="/" className="hover:text-foreground-700 transition-colors">Home</Link>
                <span>/</span>
                <Link to="/my-trip" className="hover:text-foreground-700 transition-colors">My Trips</Link>
                <span>/</span>
                <span className="text-foreground-600 line-clamp-1">{trip.title}</span>
              </nav>

              {trip.summary && <p className="text-foreground-600 text-sm leading-relaxed mb-4">{trip.summary}</p>}

              {/* アクションボタン */}
              <div className="flex gap-2.5 mb-6 flex-wrap">
                <button
                  onClick={() => setShowPlanner(!showPlanner)}
                  className="inline-flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
                >
                  <i className={showPlanner ? 'ri-close-line' : 'ri-edit-line'}></i>
                  {showPlanner ? 'Close Planner' : 'Edit Trip'}
                </button>
                <Link
                  to={`/trips/${trip.id}`}
                  className="inline-flex items-center gap-1.5 bg-white border border-background-200 hover:bg-background-50 text-foreground-700 font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
                >
                  <i className="ri-eye-line"></i>
                  Preview
                </Link>
              </div>

              {/* Trip Planner（展開式） */}
              {showPlanner && (
                <div className="bg-white border border-background-200 rounded-2xl p-4 mb-6">
                  <h2 className="font-heading font-bold text-base text-foreground-900 mb-4 flex items-center gap-2">
                    <i className="ri-map-pin-line text-primary-500"></i>
                    Trip Planner
                  </h2>
                  <TripPlanningPanel
                    tripId={trip.id}
                    items={trip.items || []}
                    actualVisitLog={trip.actualVisitLog || []}
                    tripStatus={trip.status || 'planning'}
                    onTripUpdate={(updates) => setTrip((prev) => prev ? { ...prev, ...updates } : prev)}
                  />
                </div>
              )}

              {/* Dayカード */}
              <div className="space-y-4">
                {[...(trip.days || [])].sort((a, b) => a.day - b.day).map((day) => {
                  const nonTransport = (day.activities || []).filter((a: TripActivity) => a.type !== 'transport');
                  const stay = (trip.stays || []).find((s: TripStay) => day.day >= s.checkInDay && day.day <= s.checkOutDay);
                  const prevStay = (trip.stays || []).find((s: TripStay) => (day.day - 1) >= s.checkInDay && (day.day - 1) <= s.checkOutDay);
                  const isSameStay = stay && prevStay && stay.hotelName === prevStay.hotelName;
                  const dayRoute = getDayRoute(day as TripDay);

                  return (
                    <div key={day.day} className="bg-white border border-background-200 rounded-2xl overflow-hidden">
                      <div className="bg-foreground-900 px-4 py-2.5 flex items-center gap-3">
                        <span className="text-xs font-bold tracking-wider text-primary-300">DAY {day.day}</span>
                        {dayRoute && <span className="text-xs text-foreground-500 truncate">{dayRoute}</span>}
                      </div>

                      {/* Schedule */}
                      {nonTransport.length > 0 && (
                        <div className="px-4 py-3 border-b border-background-100">
                          <p className="text-xs font-bold tracking-widest uppercase text-foreground-400 mb-3 flex items-center gap-1.5">
                            <i className="ri-map-pin-line"></i>Schedule
                          </p>
                          {nonTransport.map((act: TripActivity, idx: number) => {
                            const isLast = idx === nonTransport.length - 1;
                            const dest = act.spotId ? spotData.get(act.spotId) : undefined;
                            const imgUrl = dest?.image && isUsableImage(dest.image) ? dest.image : undefined;
                            const catStyle = getCatStyle(dest?.category || act.category);
                            const actIdx = day.activities.indexOf(act);
                            const prevAct = actIdx > 0 ? day.activities[actIdx - 1] : undefined;
                            const hasTransitBefore = prevAct?.type === 'transport';

                            return (
                              <div key={idx}>
                                {hasTransitBefore && (
                                  <div className="flex items-center gap-2 text-xs text-foreground-400 py-2 -mx-4 px-8 bg-background-50 border-y border-background-100 mb-2 overflow-hidden">
                                    <i className="ri-train-line flex-shrink-0"></i>
                                    <span className="truncate">{prevAct!.title}</span>
                                  </div>
                                )}
                                <div className="flex items-stretch gap-3">
                                  <div className="flex flex-col items-center w-3 flex-shrink-0">
                                    <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: isLast && nonTransport.length > 1 ? '#cbd5e1' : '#3b6fd4' }}></div>
                                    {!isLast && <div className="w-px bg-background-200 flex-1 mt-1"></div>}
                                  </div>
                                  <div className={`flex-1 min-w-0 flex gap-3 ${isLast ? 'pb-0' : 'pb-3'}`}>
                                    <div className="flex-1 min-w-0">
                                      {act.time && <p className="text-xs text-foreground-400 mb-0.5">{act.time}</p>}
                                      <p className="text-sm font-semibold text-foreground-900">{act.title}</p>
                                      {catStyle && (
                                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full inline-block mt-1 ${catStyle.bg} ${catStyle.text}`}>{catStyle.label}</span>
                                      )}
                                      {act.description && <p className="text-xs text-foreground-500 leading-relaxed mt-1">{act.description}</p>}
                                    </div>
                                    {imgUrl && <img src={imgUrl} alt={act.title} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Meals */}
                      {(day.meals?.breakfast || day.meals?.lunch || day.meals?.dinner) && (
                        <div className="px-4 py-3 border-b border-background-100">
                          <p className="text-xs font-bold tracking-widest uppercase text-foreground-400 mb-3 flex items-center gap-1.5">
                            <i className="ri-restaurant-line"></i>Meals
                          </p>
                          <div className="space-y-2.5">
                            {day.meals.breakfast && (
                              <div className="flex items-start gap-2.5">
                                <span className="text-xs font-bold text-orange-700 w-4 flex-shrink-0 pt-0.5">B</span>
                                <p className="text-sm font-semibold text-foreground-900">{day.meals.breakfast.suggestion}</p>
                              </div>
                            )}
                            {day.meals.lunch && (
                              <div className="flex items-start gap-2.5">
                                <span className="text-xs font-bold text-orange-700 w-4 flex-shrink-0 pt-0.5">L</span>
                                <p className="text-sm font-semibold text-foreground-900">{day.meals.lunch.suggestion}</p>
                              </div>
                            )}
                            {day.meals.dinner && (
                              <div className="flex items-start gap-2.5">
                                <span className="text-xs font-bold text-orange-700 w-4 flex-shrink-0 pt-0.5">D</span>
                                <p className="text-sm font-semibold text-foreground-900">{day.meals.dinner.suggestion}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Stay */}
                      {stay && (
                        <div className="px-4 py-3">
                          <p className="text-xs font-bold tracking-widest uppercase text-foreground-400 mb-3 flex items-center gap-1.5">
                            <i className="ri-hotel-line"></i>Stay
                          </p>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                              <i className="ri-building-line text-primary-600 text-lg"></i>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground-900 truncate">{stay.hotelName}</p>
                              {isSameStay && <p className="text-xs text-foreground-400">Same hotel — no check-in today</p>}
                            </div>
                            <span className="text-xs font-semibold text-primary-600 bg-primary-50 px-2.5 py-1 rounded-full flex-shrink-0">
                              {getStayNightLabel(stay, day.day)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-6">
                <Link to="/my-trip" className="inline-flex items-center gap-2 text-primary-500 hover:text-primary-600 font-semibold text-sm transition-colors">
                  <i className="ri-arrow-left-line"></i>Back to My Trips
                </Link>
              </div>
            </div>
          </article>
        );
      })()}
      <Footer />
    </main>
  );
}
