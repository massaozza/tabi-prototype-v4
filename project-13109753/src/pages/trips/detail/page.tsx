import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Navbar from '@/components/feature/Navbar';
import Footer from '@/components/feature/Footer';
import { useAuth } from '@/context/AuthContext';

interface TripMeal { id: string; suggestion: string; }
interface TripActivity { type?: 'activity' | 'transport'; time?: string; title: string; description?: string; spotId?: string; category?: string; }
interface TripDay { day: number; date?: string; activities: TripActivity[]; meals: { breakfast?: TripMeal; lunch?: TripMeal; dinner?: TripMeal }; }
interface TripStay { id: string; hotelName: string; checkInDay: number; checkOutDay: number; }
interface Destination { id: string; title: string; image: string; category?: string; }
interface PublicTrip { id: string; uid: string; title: string; summary?: string; stays: TripStay[]; days: TripDay[]; tripType?: 'recommended' | 'actual'; travelStyle?: string; authorName?: string; reflectionWhatWorked?: string; reflectionWhatToChange?: string; highlights?: string[]; tags?: string[]; budgetMin?: number; budgetMax?: number; }

function formatBudget(min?: number, max?: number): string | null {
  if (!min && !max) return null;
  const fmt = (n: number) => n >= 10000 ? `¥${(n / 10000).toFixed(n % 10000 === 0 ? 0 : 1)}万` : `¥${n.toLocaleString()}`;
  if (min && max) return `${fmt(min)}–${fmt(max)}`;
  if (min) return `From ${fmt(min)}`;
  return `Under ${fmt(max!)}`;
}

function isUsableImage(url: string): boolean { return !!url && !url.includes('readdy.ai'); }

const CATEGORY_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  'Culture & History': { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Culture' },
  'Culture': { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Culture' },
  'Nature & Scenery': { bg: 'bg-green-50', text: 'text-green-700', label: 'Nature' },
  'Nature': { bg: 'bg-green-50', text: 'text-green-700', label: 'Nature' },
  'Food': { bg: 'bg-orange-50', text: 'text-orange-700', label: 'Food' },
  'City & Food Culture': { bg: 'bg-orange-50', text: 'text-orange-700', label: 'Food' },
  'Activities': { bg: 'bg-purple-50', text: 'text-purple-700', label: 'Activity' },
  'Hot Springs & Nature': { bg: 'bg-green-50', text: 'text-green-700', label: 'Onsen & Nature' },
  'Shopping & Fashion': { bg: 'bg-pink-50', text: 'text-pink-700', label: 'Shopping' },
  'Beach & Lifestyle': { bg: 'bg-cyan-50', text: 'text-cyan-700', label: 'Beach' },
};

function getCategoryStyle(cat?: string) {
  if (!cat) return { bg: 'bg-primary-50', text: 'text-primary-700', label: 'Sightseeing' };
  return CATEGORY_STYLE[cat] || { bg: 'bg-primary-50', text: 'text-primary-700', label: cat };
}

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

export default function PublicTripDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<PublicTrip | null>(null);
  const [spotData, setSpotData] = useState<Map<string, Destination>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copying, setCopying] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const [tripRes, destRes] = await Promise.all([fetch('/api/trips?public=1'), fetch('/api/content?type=destinations')]);
        const tripJson = await tripRes.json();
        const destJson = await destRes.json();
        if (cancelled) return;
        if (Array.isArray(tripJson?.trips)) {
          const found = tripJson.trips.find((t: PublicTrip) => t.id === id) ?? null;
          setTrip(found);
          if (found) fetch('/api/track-view', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contentType: 'trip', id: found.id }) }).catch(() => {});
        }
        if (Array.isArray(destJson?.data)) {
          const map = new Map<string, Destination>();
          for (const dest of destJson.data as Destination[]) { if (dest.id) map.set(dest.id, dest); }
          setSpotData(map);
        }
      } catch { if (!cancelled) setTrip(null); }
      finally { if (!cancelled) setLoading(false); }
    }
    fetchData();
    return () => { cancelled = true; };
  }, [id]);

  const handleSave = async () => {
    if (!user) { navigate('/login'); return; }
    if (!trip) return;
    setSaving(true); setActionError('');
    try {
      const res = await fetch(`/api/trips?action=save&tripId=${encodeURIComponent(trip.id)}`, { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed');
      setSaved(true);
    } catch { setActionError('Could not save this trip.'); }
    finally { setSaving(false); }
  };

  const handleCopy = async () => {
    if (!user) { navigate('/login'); return; }
    if (!trip) return;
    setCopying(true); setActionError('');
    try {
      const res = await fetch(`/api/trips?action=copy&sourceTripId=${encodeURIComponent(trip.id)}`, { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed');
      navigate('/my-trip');
    } catch { setActionError('Could not copy this trip.'); setCopying(false); }
  };

  const SAMPLE_IMAGES = [
    'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=900&q=80',
    'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=600&q=80',
    'https://images.unsplash.com/photo-1480796927426-f609979314bd?w=600&q=80',
  ];

  const getHeaderImages = (trip: PublicTrip): string[] => {
    const result: string[] = [];
    for (const day of trip.days) {
      for (const act of day.activities || []) {
        if (act.type === 'transport') continue;
        if (act.spotId) {
          const dest = spotData.get(act.spotId);
          if (dest?.image && isUsableImage(dest.image) && !result.includes(dest.image)) result.push(dest.image);
        }
        if (result.length >= 3) return result;
      }
    }
    // R2写真がない場合はUnsplashのサンプル画像でフォールバック
    while (result.length < 3) {
      result.push(SAMPLE_IMAGES[result.length]);
    }
    return result;
  };

  return (
    <main className="min-h-screen bg-background-50">
      <Navbar />
      {loading ? (
        <div className="pt-28 pb-16 px-4 max-w-2xl mx-auto space-y-4">
          <div className="h-72 bg-background-200 rounded-2xl animate-pulse"></div>
          <div className="h-6 w-3/4 bg-background-200 rounded animate-pulse"></div>
          <div className="h-48 bg-background-200 rounded-2xl animate-pulse"></div>
        </div>
      ) : !trip ? (
        <div className="pt-28 pb-16 px-6 text-center">
          <h1 className="font-heading font-bold text-2xl text-foreground-900 mb-4">Trip not found</h1>
          <Link to="/trips" className="inline-flex items-center gap-2 bg-primary-500 text-white font-semibold text-sm px-6 py-3 rounded-lg">
            <i className="ri-arrow-left-line"></i>Back to Trips
          </Link>
        </div>
      ) : (() => {
        const headerImages = getHeaderImages(trip);
        const budgetText = formatBudget(trip.budgetMin, trip.budgetMax);
        const dayCount = trip.days.length;
        return (
          <article>
            {/* Hero */}
            <div style={{ position: 'relative', height: '460px', overflow: 'hidden' }}>
              <div
                style={{
                  position: 'absolute',
                  top: 0, left: 0, right: 0, bottom: 0,
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr',
                  gridTemplateRows: '230px 230px',
                  gap: '3px',
                }}
              >
                <img src={headerImages[0]} alt={trip.title} style={{ gridRow: '1 / 3', width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                <img src={headerImages[1]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                <img src={headerImages[2]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(10,18,40,0.65) 0%, rgba(10,18,40,0.0) 28%, rgba(10,18,40,0.0) 42%, rgba(10,18,40,0.90) 100%)' }}></div>
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 20px 28px', maxWidth: '768px', margin: '0 auto' }}>
                <p className="text-xs font-semibold tracking-widest uppercase text-white/50 mb-1.5">
                  {trip.tripType === 'recommended' ? 'Recommended trip' : 'Actual trip'}{trip.travelStyle && ` · ${trip.travelStyle}`}
                </p>
                <h1 className="font-heading font-bold text-2xl text-white leading-snug mb-2.5">{trip.title}</h1>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-white/15 text-white">{dayCount} {dayCount === 1 ? 'day' : 'days'}</span>
                  {(trip.tags || []).slice(0, 2).map((tag) => (
                    <span key={tag} className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-white/10 text-white/80">{tag}</span>
                  ))}
                  {budgetText && (
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full text-amber-300" style={{ background: 'rgba(200,155,60,0.25)' }}>{budgetText}</span>
                  )}
                </div>
                {trip.authorName && (
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary-600/60 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">{trip.authorName[0].toUpperCase()}</div>
                    <span className="text-xs text-white/90 font-medium">{trip.authorName}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="max-w-3xl mx-auto px-4 md:px-8 py-5">
              <nav className="flex items-center gap-1.5 text-foreground-400 text-xs mb-5 flex-wrap">
                <Link to="/" className="hover:text-foreground-700 transition-colors">Home</Link>
                <span>/</span>
                <Link to="/trips" className="hover:text-foreground-700 transition-colors">Trips</Link>
                <span>/</span>
                <span className="text-foreground-600 line-clamp-1">{trip.title}</span>
              </nav>

              {trip.summary && <p className="text-foreground-600 text-sm leading-relaxed mb-4">{trip.summary}</p>}

              {(trip.highlights || []).length > 0 && (
                <div className="bg-white border border-background-200 rounded-2xl p-4 mb-5">
                  <p className="text-xs font-bold tracking-widest uppercase text-foreground-400 mb-3">Why this trip</p>
                  <ul className="space-y-2.5">
                    {trip.highlights!.map((h, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-foreground-800">
                        <div className="w-5 h-5 rounded-full bg-primary-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <i className="ri-check-line text-primary-600 text-xs"></i>
                        </div>
                        {h}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {actionError && <p className="text-red-500 text-xs mb-3">{actionError}</p>}
              <div className="flex gap-2.5 mb-6">
                <button onClick={handleSave} disabled={saving || saved} className="inline-flex items-center gap-1.5 bg-white border border-background-200 hover:bg-background-50 disabled:opacity-60 text-foreground-700 font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap">
                  <i className={saved ? 'ri-bookmark-fill text-primary-500' : 'ri-bookmark-line'}></i>
                  {saved ? 'Saved' : saving ? 'Saving...' : 'Save'}
                </button>
                <button onClick={handleCopy} disabled={copying} className="flex-1 inline-flex items-center justify-center gap-1.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors cursor-pointer">
                  <i className="ri-file-copy-line"></i>
                  {copying ? 'Copying...' : 'Copy to My Trip'}
                </button>
              </div>

              {/* Day cards */}
              <div className="space-y-4">
                {[...trip.days].sort((a, b) => a.day - b.day).map((day) => {
                  const nonTransport = (day.activities || []).filter((a) => a.type !== 'transport');
                  const stay = trip.stays.find((s) => day.day >= s.checkInDay && day.day <= s.checkOutDay);
                  const prevStay = trip.stays.find((s) => (day.day - 1) >= s.checkInDay && (day.day - 1) <= s.checkOutDay);
                  const isSameStay = stay && prevStay && stay.hotelName === prevStay.hotelName;
                  const dayRoute = getDayRoute(day);
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
                          {nonTransport.map((act, idx) => {
                            const isLast = idx === nonTransport.length - 1;
                            const dest = act.spotId ? spotData.get(act.spotId) : undefined;
                            const imgUrl = dest?.image && isUsableImage(dest.image) ? dest.image : undefined;
                            const catStyle = getCategoryStyle(dest?.category || act.category);
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
                                <div className="flex items-start gap-3">
                                  <div className="flex flex-col items-center w-3 flex-shrink-0 pt-1">
                                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isLast && nonTransport.length > 1 ? 'bg-background-300' : 'bg-primary-500'}`}></div>
                                    {!isLast && <div className="w-px bg-background-200 flex-1 min-h-4 mt-0.5"></div>}
                                  </div>
                                  <div className={`flex-1 min-w-0 flex gap-3 ${isLast ? 'pb-0' : 'pb-3'}`}>
                                    <div className="flex-1 min-w-0">
                                      {act.time && <p className="text-xs text-foreground-400 mb-0.5">{act.time}</p>}
                                      <p className="text-sm font-semibold text-foreground-900">{act.title}</p>
                                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full inline-block mt-1 mb-1.5 ${catStyle.bg} ${catStyle.text}`}>{catStyle.label}</span>
                                      {act.description && <p className="text-xs text-foreground-500 leading-relaxed">{act.description}</p>}
                                    </div>
                                    {imgUrl && <img src={imgUrl} alt={act.title} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          {(() => {
                            const lastAct = day.activities[day.activities.length - 1];
                            if (lastAct?.type === 'transport') {
                              return (
                                <div className="flex items-center gap-2 text-xs text-foreground-400 py-2 -mx-4 px-8 bg-background-50 border-t border-background-100 mt-2">
                                  <i className="ri-train-line flex-shrink-0"></i>
                                  <span>{lastAct.title}</span>
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      )}

                      {/* Meals */}
                      {(day.meals.breakfast || day.meals.lunch || day.meals.dinner) && (
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

              {(trip.reflectionWhatWorked || trip.reflectionWhatToChange) && (
                <div className="bg-background-100 rounded-2xl p-5 mt-5">
                  <p className="text-xs font-bold tracking-widest uppercase text-foreground-400 mb-3">Traveler's reflection</p>
                  {trip.reflectionWhatWorked && <p className="text-sm text-foreground-700 mb-2"><span className="font-semibold">What worked well: </span>{trip.reflectionWhatWorked}</p>}
                  {trip.reflectionWhatToChange && <p className="text-sm text-foreground-700"><span className="font-semibold">What they'd change: </span>{trip.reflectionWhatToChange}</p>}
                </div>
              )}

              {/* Bottom CTA */}
              <div className="bg-foreground-900 rounded-2xl p-6 text-center mt-6">
                <p className="text-xs font-bold tracking-widest uppercase text-white/35 mb-2">Ready to go?</p>
                <p className="font-heading font-bold text-xl text-white mb-2">Make this trip yours</p>
                <p className="text-foreground-500 text-sm mb-5 leading-relaxed">Copy the itinerary to your trip planner, add your own spots, and let AI find the best route.</p>
                <button onClick={handleCopy} disabled={copying} className="w-full inline-flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-500 disabled:opacity-60 text-white font-bold text-sm py-3.5 rounded-xl transition-colors cursor-pointer mb-3">
                  <i className="ri-add-line text-base"></i>
                  {copying ? 'Copying...' : 'Copy to My Trip'}
                </button>
                <button onClick={handleSave} disabled={saving || saved} className="w-full inline-flex items-center justify-center gap-2 disabled:opacity-60 text-white/60 font-medium text-sm py-2.5 rounded-xl border border-white/10 hover:bg-white/5 transition-colors cursor-pointer">
                  <i className={saved ? 'ri-bookmark-fill' : 'ri-bookmark-line'}></i>
                  {saved ? 'Saved' : saving ? 'Saving...' : 'Save for later'}
                </button>
              </div>

              <div className="mt-6">
                <Link to="/trips" className="inline-flex items-center gap-2 text-primary-500 hover:text-primary-600 font-semibold text-sm transition-colors">
                  <i className="ri-arrow-left-line"></i>Back to Trips
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
