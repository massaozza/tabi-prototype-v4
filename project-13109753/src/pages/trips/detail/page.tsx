import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Navbar from '@/components/feature/Navbar';
import Footer from '@/components/feature/Footer';
import { useAuth } from '@/context/AuthContext';

// TABI47：Trip詳細ページ。旅行代理店のパンフレットをWebで体験するような
// リッチなビジュアル表現を目指す。Spot写真・日程タイムライン・予算・
// ハイライト・Copy to My Tripを一枚のページに凝縮する。

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

interface Destination {
  id: string;
  title: string;
  image: string;
  prefecture?: string;
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
  highlights?: string[];
  tags?: string[];
  budgetMin?: number;
  budgetMax?: number;
}

function formatBudget(min?: number, max?: number): string | null {
  if (!min && !max) return null;
  const fmt = (n: number) =>
    n >= 10000 ? `¥${(n / 10000).toFixed(n % 10000 === 0 ? 0 : 1)}万` : `¥${n.toLocaleString()}`;
  if (min && max) return `${fmt(min)} – ${fmt(max)} / person`;
  if (min) return `From ${fmt(min)} / person`;
  if (max) return `Under ${fmt(max)} / person`;
  return null;
}

export default function PublicTripDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<PublicTrip | null>(null);
  const [spotImages, setSpotImages] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copying, setCopying] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const [tripRes, destRes] = await Promise.all([
          fetch('/api/trips?public=1'),
          fetch('/api/content?type=destinations'),
        ]);
        const tripJson = await tripRes.json();
        const destJson = await destRes.json();
        if (cancelled) return;

        if (Array.isArray(tripJson?.trips)) {
          const found = tripJson.trips.find((t: PublicTrip) => t.id === id) ?? null;
          setTrip(found);
          if (found) {
            fetch('/api/track-view', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contentType: 'trip', id: found.id }),
            }).catch(() => {});
          }
        }

        if (Array.isArray(destJson?.data)) {
          const imgMap = new Map<string, string>();
          for (const dest of destJson.data as Destination[]) {
            if (dest.id && dest.image) imgMap.set(dest.id, dest.image);
          }
          setSpotImages(imgMap);
        }
      } catch {
        if (!cancelled) setTrip(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, [id]);

  const handleSave = async () => {
    if (!user) { navigate('/login'); return; }
    if (!trip) return;
    setSaving(true);
    setActionError('');
    try {
      const res = await fetch(`/api/trips?action=save&tripId=${encodeURIComponent(trip.id)}`, {
        method: 'POST', credentials: 'include',
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
    if (!user) { navigate('/login'); return; }
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

  // ヘッダービジュアル用の写真を最大3枚収集（SpotIDから引く）
  const getHeaderImages = (trip: PublicTrip): string[] => {
    const result: string[] = [];
    for (const day of trip.days) {
      for (const act of day.activities || []) {
        if (act.type === 'transport') continue;
        if (act.spotId && spotImages.has(act.spotId)) {
          const img = spotImages.get(act.spotId)!;
          if (!result.includes(img)) result.push(img);
        }
        if (result.length >= 3) return result;
      }
    }
    return result;
  };

  return (
    <main className="min-h-screen bg-background-50">
      <Navbar />

      {loading ? (
        <div className="pt-28 pb-16 px-6 md:px-10 max-w-3xl mx-auto space-y-4">
          <div className="h-64 bg-background-200 rounded-xl animate-pulse"></div>
          <div className="h-8 w-3/4 bg-background-200 rounded animate-pulse"></div>
          <div className="h-40 bg-background-200 rounded-xl animate-pulse"></div>
        </div>
      ) : !trip ? (
        <div className="pt-28 pb-16 px-6 text-center">
          <h1 className="font-heading font-bold text-2xl text-foreground-900 mb-4">Trip not found</h1>
          <Link to="/trips" className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm px-6 py-3 rounded-lg">
            <i className="ri-arrow-left-line"></i>Back to Trips
          </Link>
        </div>
      ) : (() => {
        const headerImages = getHeaderImages(trip);
        const budgetText = formatBudget(trip.budgetMin, trip.budgetMax);
        const dayCount = trip.days.length;

        return (
          <article>
            {/* ── ヘッダービジュアル ── */}
            <div className="w-full" style={{ height: '320px', display: 'grid', gridTemplateColumns: headerImages.length >= 2 ? '2fr 1fr' : '1fr', gridTemplateRows: headerImages.length >= 3 ? '1fr 1fr' : '1fr', gap: '2px' }}>
              {headerImages.length > 0 ? (
                <>
                  <img
                    src={headerImages[0]}
                    alt={trip.title}
                    className="w-full h-full object-cover"
                    style={{ gridRow: headerImages.length >= 2 ? '1 / 3' : '1' }}
                  />
                  {headerImages[1] && (
                    <img src={headerImages[1]} alt="" className="w-full h-full object-cover" />
                  )}
                  {headerImages[2] && (
                    <img src={headerImages[2]} alt="" className="w-full h-full object-cover" />
                  )}
                </>
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary-800 to-primary-950 flex items-center justify-center">
                  <i className="ri-map-pin-2-line text-white/30 text-6xl"></i>
                </div>
              )}
            </div>

            {/* ── メタ情報・CTA ── */}
            <div className="max-w-3xl mx-auto px-6 md:px-10 py-8">
              {/* パンくず */}
              <nav className="flex items-center gap-2 text-foreground-400 text-xs mb-5 flex-wrap">
                <Link to="/" className="hover:text-foreground-700 transition-colors">Home</Link>
                <span>/</span>
                <Link to="/trips" className="hover:text-foreground-700 transition-colors">Trips</Link>
                <span>/</span>
                <span className="text-foreground-700 line-clamp-1">{trip.title}</span>
              </nav>

              {/* タグ行 */}
              <div className="flex flex-wrap gap-2 mb-4">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${trip.tripType === 'recommended' ? 'bg-accent-50 text-accent-700 border border-accent-200' : 'bg-primary-50 text-primary-700 border border-primary-200'}`}>
                  {trip.tripType === 'recommended' ? 'Recommended Trip' : 'Actual Trip'}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-background-100 text-foreground-700">
                  <i className="ri-calendar-line"></i>{dayCount} {dayCount === 1 ? 'day' : 'days'}
                </span>
                {trip.travelStyle && (
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-background-100 text-foreground-600 border border-background-200">
                    {trip.travelStyle}
                  </span>
                )}
                {(trip.tags || []).map((tag) => (
                  <span key={tag} className="text-xs font-medium px-2.5 py-1 rounded-full bg-background-100 text-foreground-600 border border-background-200">
                    {tag}
                  </span>
                ))}
                {budgetText && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                    {budgetText}
                  </span>
                )}
              </div>

              {/* タイトル */}
              <h1 className="font-heading font-bold text-2xl md:text-4xl text-foreground-900 leading-tight mb-3">
                {trip.title}
              </h1>

              {/* 概要 */}
              {trip.summary && (
                <p className="text-foreground-600 text-base leading-relaxed mb-4">{trip.summary}</p>
              )}

              {/* Author */}
              {trip.authorName && (
                <p className="text-foreground-500 text-sm mb-6">
                  by <span className="text-foreground-800 font-medium">{trip.authorName}</span>
                </p>
              )}

              {/* ハイライト */}
              {(trip.highlights || []).length > 0 && (
                <div className="bg-primary-50 border border-primary-100 rounded-xl p-4 mb-6">
                  <p className="text-xs font-semibold text-primary-700 uppercase tracking-wider mb-2">Highlights</p>
                  <ul className="space-y-1.5">
                    {trip.highlights!.map((h, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-foreground-800">
                        <i className="ri-check-line text-primary-500 flex-shrink-0 mt-0.5"></i>
                        {h}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* CTA */}
              {actionError && <p className="text-red-500 text-xs mb-3">{actionError}</p>}
              <div className="flex items-center gap-3 mb-10">
                <button
                  onClick={handleSave}
                  disabled={saving || saved}
                  className="inline-flex items-center gap-2 bg-background-100 hover:bg-background-200 disabled:opacity-60 text-foreground-800 font-semibold text-sm px-5 py-3 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                >
                  <i className={saved ? 'ri-bookmark-fill' : 'ri-bookmark-line'}></i>
                  {saved ? 'Saved' : saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={handleCopy}
                  disabled={copying}
                  className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white font-semibold text-sm px-6 py-3 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-add-line"></i>
                  {copying ? 'Copying...' : 'Copy to My Trip'}
                </button>
              </div>

              {/* ── Day by Day ── */}
              <section className="space-y-6 mb-10">
                <h2 className="font-heading font-bold text-xl text-foreground-900">Itinerary</h2>
                {[...trip.days].sort((a, b) => a.day - b.day).map((day) => {
                  const stay = trip.stays.find((s) => day.day >= s.checkInDay && day.day <= s.checkOutDay);
                  const nonTransport = (day.activities || []).filter((a) => a.type !== 'transport');
                  const transport = (day.activities || []).filter((a) => a.type === 'transport');

                  return (
                    <div key={day.day} className="border border-background-200 rounded-2xl overflow-hidden bg-white">
                      {/* Day ヘッダー */}
                      <div className="bg-foreground-900 px-5 py-3 flex items-center justify-between">
                        <span className="font-heading font-bold text-white text-sm">Day {day.day}</span>
                        {stay && (
                          <span className="text-white/60 text-xs flex items-center gap-1">
                            <i className="ri-hotel-line"></i>{stay.hotelName}
                          </span>
                        )}
                      </div>

                      {/* 移動手段 */}
                      {transport.map((t, idx) => (
                        <div key={idx} className="px-5 py-2.5 bg-background-50 border-b border-background-100 flex items-center gap-2 text-xs text-foreground-500">
                          <i className="ri-train-line text-foreground-400"></i>
                          <span className="font-medium">{t.title}</span>
                          {t.description && <span className="text-foreground-400">— {t.description}</span>}
                        </div>
                      ))}

                      {/* アクティビティ（タイムライン） */}
                      <div className="px-5 py-4">
                        {nonTransport.map((act, idx) => {
                          const imgUrl = act.spotId ? spotImages.get(act.spotId) : undefined;
                          const isLast = idx === nonTransport.length - 1;
                          return (
                            <div key={idx} className="flex gap-4">
                              {/* タイムライン縦線 */}
                              <div className="flex flex-col items-center flex-shrink-0 w-4">
                                <div className={`w-3 h-3 rounded-full border-2 flex-shrink-0 mt-1 ${idx === 0 ? 'bg-primary-500 border-primary-500' : 'bg-white border-background-300'}`}></div>
                                {!isLast && <div className="w-px bg-background-200 flex-1 min-h-8 mt-1"></div>}
                              </div>
                              {/* コンテンツ */}
                              <div className={`flex-1 min-w-0 ${isLast ? 'pb-2' : 'pb-5'}`}>
                                <div className="flex items-start gap-3">
                                  <div className="flex-1 min-w-0">
                                    {act.time && (
                                      <span className="text-xs text-foreground-400 font-medium block mb-0.5">{act.time}</span>
                                    )}
                                    <h4 className="font-semibold text-sm text-foreground-900 leading-snug">{act.title}</h4>
                                    {act.description && (
                                      <p className="text-xs text-foreground-500 mt-1 leading-relaxed">{act.description}</p>
                                    )}
                                  </div>
                                  {/* Spot写真（小さなサムネイル） */}
                                  {imgUrl && (
                                    <img
                                      src={imgUrl}
                                      alt={act.title}
                                      className="w-16 h-16 md:w-20 md:h-20 rounded-lg object-cover flex-shrink-0"
                                    />
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* 食事 */}
                      {(day.meals.breakfast || day.meals.lunch || day.meals.dinner) && (
                        <div className="border-t border-background-100 px-5 py-3 flex flex-wrap gap-3 text-xs text-foreground-500">
                          {day.meals.breakfast && <span><span className="font-semibold text-foreground-700">B</span> {day.meals.breakfast.suggestion}</span>}
                          {day.meals.lunch && <span><span className="font-semibold text-foreground-700">L</span> {day.meals.lunch.suggestion}</span>}
                          {day.meals.dinner && <span><span className="font-semibold text-foreground-700">D</span> {day.meals.dinner.suggestion}</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </section>

              {/* ── Traveler's Reflection ── */}
              {(trip.reflectionWhatWorked || trip.reflectionWhatToChange) && (
                <section className="bg-background-100 rounded-xl p-6 mb-10">
                  <h4 className="font-heading font-semibold text-sm text-foreground-900 mb-3">Traveler's Reflection</h4>
                  {trip.reflectionWhatWorked && (
                    <p className="text-foreground-700 text-sm mb-2">
                      <span className="font-semibold">What worked well: </span>{trip.reflectionWhatWorked}
                    </p>
                  )}
                  {trip.reflectionWhatToChange && (
                    <p className="text-foreground-700 text-sm">
                      <span className="font-semibold">What they'd change: </span>{trip.reflectionWhatToChange}
                    </p>
                  )}
                </section>
              )}

              {/* Bottom CTA */}
              <div className="bg-primary-50 border border-primary-100 rounded-2xl p-6 text-center mb-10">
                <p className="font-heading font-bold text-lg text-foreground-900 mb-1">Like this trip?</p>
                <p className="text-foreground-500 text-sm mb-4">Copy it to My Trip and customize it however you like.</p>
                <button
                  onClick={handleCopy}
                  disabled={copying}
                  className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white font-semibold text-sm px-8 py-3 rounded-xl transition-colors cursor-pointer"
                >
                  <i className="ri-add-line"></i>
                  {copying ? 'Copying...' : 'Copy to My Trip'}
                </button>
              </div>

              <Link to="/trips" className="inline-flex items-center gap-2 text-primary-500 hover:text-primary-600 font-semibold text-sm transition-colors">
                <i className="ri-arrow-left-line"></i>Back to Trips
              </Link>
            </div>
          </article>
        );
      })()}

      <Footer />
    </main>
  );
}
