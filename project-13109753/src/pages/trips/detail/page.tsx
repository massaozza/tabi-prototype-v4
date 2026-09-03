import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Navbar from '@/components/feature/Navbar';
import Footer from '@/components/feature/Footer';
import { useAuth } from '@/context/AuthContext';

// TABI47：Trip詳細ページ。
// Artifactモックアップのデザインを踏襲：
// 写真グリッド（左大＋右上下2枚）→ 著者バッジ（写真内オーバーレイ）
// → タグ行（日数・エリア・スタイル・予算）→ タイトル→ 概要
// → 日程タイムライン（Day Nヘッダー＋ドット縦線スタイル）→ CTA

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
    n >= 10000
      ? `¥${(n / 10000).toFixed(n % 10000 === 0 ? 0 : 1)}万`
      : `¥${n.toLocaleString()}`;
  if (min && max) return `${fmt(min)}–${fmt(max)}`;
  if (min) return `From ${fmt(min)}`;
  return `Under ${fmt(max!)}`;
}

// Readdy.aiのURLはtabi47.comドメインでRefererブロックされるため除外
function isUsableImage(url: string): boolean {
  return !!url && !url.includes('readdy.ai');
}

const PLACEHOLDER_COLORS = [
  { bg: 'bg-green-800', icon: 'ri-map-pin-2-line' },
  { bg: 'bg-stone-600', icon: 'ri-landscape-line' },
  { bg: 'bg-blue-800', icon: 'ri-train-line' },
];

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
      const res = await fetch(
        `/api/trips?action=save&tripId=${encodeURIComponent(trip.id)}`,
        { method: 'POST', credentials: 'include' }
      );
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

  // SpotIDからR2画像を最大3枚取得（Readdy.aiを除外）
  const getHeaderImages = (trip: PublicTrip): string[] => {
    const result: string[] = [];
    for (const day of trip.days) {
      for (const act of day.activities || []) {
        if (act.type === 'transport') continue;
        if (act.spotId) {
          const img = spotImages.get(act.spotId);
          if (img && isUsableImage(img) && !result.includes(img)) result.push(img);
        }
        if (result.length >= 3) return result;
      }
    }
    return result;
  };

  // Day間の移動エリアを「A → B」形式で表示
  const getDayLocation = (day: TripDay): string => {
    const spots = (day.activities || [])
      .filter((a) => a.type !== 'transport')
      .map((a) => a.title);
    if (spots.length === 0) return '';
    if (spots.length === 1) return spots[0];
    return `${spots[0]} → ${spots[spots.length - 1]}`;
  };

  return (
    <main className="min-h-screen bg-background-50">
      <Navbar />

      {loading ? (
        <div className="pt-28 pb-16 px-4 max-w-lg mx-auto space-y-4">
          <div className="h-64 bg-background-200 rounded-2xl animate-pulse"></div>
          <div className="h-6 w-3/4 bg-background-200 rounded animate-pulse"></div>
          <div className="h-40 bg-background-200 rounded-2xl animate-pulse"></div>
        </div>
      ) : !trip ? (
        <div className="pt-28 pb-16 px-6 text-center">
          <h1 className="font-heading font-bold text-2xl text-foreground-900 mb-4">
            Trip not found
          </h1>
          <Link
            to="/trips"
            className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm px-6 py-3 rounded-lg"
          >
            <i className="ri-arrow-left-line"></i>Back to Trips
          </Link>
        </div>
      ) : (() => {
        const headerImages = getHeaderImages(trip);
        const budgetText = formatBudget(trip.budgetMin, trip.budgetMax);
        const dayCount = trip.days.length;

        return (
          <article className="pt-20 md:pt-24 pb-16">
            <div className="max-w-2xl mx-auto px-4 md:px-6">

              {/* パンくず */}
              <nav className="flex items-center gap-1.5 text-foreground-400 text-xs mb-5 flex-wrap">
                <Link to="/" className="hover:text-foreground-700 transition-colors">Home</Link>
                <span>/</span>
                <Link to="/trips" className="hover:text-foreground-700 transition-colors">Trips</Link>
                <span>/</span>
                <span className="text-foreground-600 line-clamp-1">{trip.title}</span>
              </nav>

              {/* ── 写真グリッド（モックアップ準拠） ── */}
              <div
                className="rounded-2xl overflow-hidden mb-4 relative"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr',
                  gridTemplateRows: '160px 90px',
                  gap: '3px',
                  height: '253px',
                }}
              >
                {/* メイン写真（左・縦長） */}
                {headerImages[0] ? (
                  <img
                    src={headerImages[0]}
                    alt={trip.title}
                    className="w-full h-full object-cover"
                    style={{ gridRow: '1 / 3' }}
                  />
                ) : (
                  <div
                    className={`w-full h-full ${PLACEHOLDER_COLORS[0].bg} flex flex-col items-center justify-center gap-2`}
                    style={{ gridRow: '1 / 3' }}
                  >
                    <i className={`${PLACEHOLDER_COLORS[0].icon} text-white/40 text-4xl`}></i>
                    {trip.days[0]?.activities?.find((a) => a.type !== 'transport')?.title && (
                      <span className="text-white/70 text-xs font-medium px-3 text-center">
                        {trip.days[0].activities.find((a) => a.type !== 'transport')!.title}
                      </span>
                    )}
                  </div>
                )}

                {/* サブ写真1（右上） */}
                {headerImages[1] ? (
                  <img src={headerImages[1]} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className={`w-full h-full ${PLACEHOLDER_COLORS[1].bg} flex items-center justify-center`}>
                    <i className={`${PLACEHOLDER_COLORS[1].icon} text-white/40 text-2xl`}></i>
                  </div>
                )}

                {/* サブ写真2（右下） */}
                {headerImages[2] ? (
                  <img src={headerImages[2]} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className={`w-full h-full ${PLACEHOLDER_COLORS[2].bg} flex items-center justify-center`}>
                    <i className={`${PLACEHOLDER_COLORS[2].icon} text-white/40 text-xl`}></i>
                  </div>
                )}

                {/* 著者バッジ（写真左下にオーバーレイ） */}
                {trip.authorName && (
                  <div
                    className="absolute bottom-3 left-3 bg-foreground-900/75 backdrop-blur-sm text-white text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1.5"
                  >
                    <i className="ri-user-line text-xs"></i>
                    {trip.authorName}
                  </div>
                )}
              </div>

              {/* ── タグ行（モックアップ準拠） ── */}
              <div className="flex flex-wrap gap-2 mb-3">
                {dayCount > 0 && (
                  <span className="bg-primary-100 text-primary-700 text-xs font-semibold px-3 py-1 rounded-full">
                    {dayCount} {dayCount === 1 ? 'day' : 'days'}
                  </span>
                )}
                {trip.travelStyle && (
                  <span className="bg-background-100 text-foreground-600 text-xs font-medium px-3 py-1 rounded-full border border-background-200">
                    {trip.travelStyle}
                  </span>
                )}
                {(trip.tags || []).slice(0, 2).map((tag) => (
                  <span
                    key={tag}
                    className="bg-background-100 text-foreground-600 text-xs font-medium px-3 py-1 rounded-full border border-background-200"
                  >
                    {tag}
                  </span>
                ))}
                {budgetText && (
                  <span className="bg-amber-50 text-amber-700 text-xs font-semibold px-3 py-1 rounded-full border border-amber-200">
                    {budgetText}
                  </span>
                )}
              </div>

              {/* ── タイトル・概要 ── */}
              <h1 className="font-heading font-bold text-2xl md:text-3xl text-foreground-900 leading-tight mb-2">
                {trip.title}
              </h1>

              {trip.summary && (
                <p className="text-foreground-500 text-sm leading-relaxed mb-5">
                  {trip.summary}
                </p>
              )}

              {/* ハイライト */}
              {(trip.highlights || []).length > 0 && (
                <div className="bg-primary-50 border border-primary-100 rounded-xl p-4 mb-5">
                  <p className="text-xs font-semibold text-primary-700 uppercase tracking-wider mb-2">
                    Highlights
                  </p>
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

              {/* Save / Copy CTA */}
              {actionError && <p className="text-red-500 text-xs mb-3">{actionError}</p>}
              <div className="flex gap-3 mb-8">
                <button
                  onClick={handleSave}
                  disabled={saving || saved}
                  className="inline-flex items-center gap-2 bg-background-100 hover:bg-background-200 disabled:opacity-60 text-foreground-800 font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap border border-background-200"
                >
                  <i className={saved ? 'ri-bookmark-fill' : 'ri-bookmark-line'}></i>
                  {saved ? 'Saved' : saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={handleCopy}
                  disabled={copying}
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors cursor-pointer"
                >
                  <i className="ri-file-copy-line"></i>
                  {copying ? 'Copying...' : 'Copy to My Trip'}
                </button>
              </div>

              {/* ── 日程タイムライン（モックアップ準拠） ── */}
              <div className="space-y-5">
                {[...trip.days].sort((a, b) => a.day - b.day).map((day) => {
                  const nonTransport = (day.activities || []).filter((a) => a.type !== 'transport');
                  const transport = (day.activities || []).filter((a) => a.type === 'transport');
                  const stay = trip.stays.find(
                    (s) => day.day >= s.checkInDay && day.day <= s.checkOutDay
                  );
                  const dayLocation = getDayLocation(day);

                  return (
                    <div key={day.day}>
                      {/* Day ヘッダー行（モックアップのピル＋エリア表示） */}
                      <div className="flex items-center gap-3 mb-3">
                        <span className="bg-background-100 border border-background-200 text-foreground-700 text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap">
                          Day {day.day}
                        </span>
                        {dayLocation && (
                          <span className="text-foreground-400 text-xs">{dayLocation}</span>
                        )}
                        {stay && (
                          <span className="ml-auto text-foreground-400 text-xs flex items-center gap-1 whitespace-nowrap">
                            <i className="ri-hotel-line"></i>
                            {stay.hotelName}
                          </span>
                        )}
                      </div>

                      {/* 移動手段（薄いグレーで小さく） */}
                      {transport.map((t, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 text-xs text-foreground-400 mb-2 pl-1"
                        >
                          <i className="ri-train-line flex-shrink-0"></i>
                          <span>{t.title}</span>
                          {t.description && (
                            <span className="text-foreground-300">— {t.description}</span>
                          )}
                        </div>
                      ))}

                      {/* アクティビティ タイムライン */}
                      <div>
                        {nonTransport.map((act, idx) => {
                          const isLast = idx === nonTransport.length - 1;
                          const imgUrl = act.spotId ? spotImages.get(act.spotId) : undefined;
                          const showImg = imgUrl && isUsableImage(imgUrl);

                          return (
                            <div key={idx} className="flex items-start gap-3">
                              {/* タイムライン（ドット＋縦線） */}
                              <div className="flex flex-col items-center w-3 flex-shrink-0">
                                <div
                                  className={`w-3 h-3 rounded-full flex-shrink-0 mt-1 ${
                                    idx === 0 ? 'bg-primary-500' : 'bg-background-300 border border-background-300'
                                  }`}
                                ></div>
                                {!isLast && (
                                  <div className="w-px bg-background-200 flex-1 min-h-6 mt-0.5"></div>
                                )}
                              </div>

                              {/* コンテンツ */}
                              <div className={`flex-1 min-w-0 ${isLast ? 'pb-0' : 'pb-4'}`}>
                                <div className="flex items-start gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-1.5 flex-wrap">
                                      {act.time && (
                                        <span className="text-xs text-foreground-400 whitespace-nowrap">
                                          {act.time}
                                        </span>
                                      )}
                                      <span className="text-sm font-semibold text-foreground-900">
                                        {act.title}
                                      </span>
                                    </div>
                                    {act.description && (
                                      <p className="text-xs text-foreground-500 mt-0.5 leading-relaxed">
                                        {act.description}
                                      </p>
                                    )}
                                  </div>
                                  {showImg && (
                                    <img
                                      src={imgUrl!}
                                      alt={act.title}
                                      className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
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
                        <div className="flex flex-wrap gap-3 text-xs text-foreground-400 mt-2 pl-6">
                          {day.meals.breakfast && (
                            <span>
                              <span className="font-semibold text-foreground-600">B</span>{' '}
                              {day.meals.breakfast.suggestion}
                            </span>
                          )}
                          {day.meals.lunch && (
                            <span>
                              <span className="font-semibold text-foreground-600">L</span>{' '}
                              {day.meals.lunch.suggestion}
                            </span>
                          )}
                          {day.meals.dinner && (
                            <span>
                              <span className="font-semibold text-foreground-600">D</span>{' '}
                              {day.meals.dinner.suggestion}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* ── Traveler's Reflection ── */}
              {(trip.reflectionWhatWorked || trip.reflectionWhatToChange) && (
                <div className="bg-background-100 rounded-xl p-5 mt-8">
                  <p className="text-xs font-semibold text-foreground-700 uppercase tracking-wider mb-3">
                    Traveler's Reflection
                  </p>
                  {trip.reflectionWhatWorked && (
                    <p className="text-sm text-foreground-700 mb-2">
                      <span className="font-semibold">What worked well: </span>
                      {trip.reflectionWhatWorked}
                    </p>
                  )}
                  {trip.reflectionWhatToChange && (
                    <p className="text-sm text-foreground-700">
                      <span className="font-semibold">What they'd change: </span>
                      {trip.reflectionWhatToChange}
                    </p>
                  )}
                </div>
              )}

              {/* ── ボトム CTA ── */}
              <div className="mt-8 border border-background-200 rounded-2xl p-5 bg-white text-center">
                <p className="font-heading font-bold text-base text-foreground-900 mb-1">
                  Like this trip?
                </p>
                <p className="text-foreground-500 text-sm mb-4">
                  Copy it to My Trip and customize it however you like.
                </p>
                <button
                  onClick={handleCopy}
                  disabled={copying}
                  className="w-full inline-flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white font-semibold text-sm py-3 rounded-xl transition-colors cursor-pointer"
                >
                  <i className="ri-add-line"></i>
                  {copying ? 'Copying...' : 'Copy to My Trip'}
                </button>
                <p className="text-xs text-foreground-400 mt-2">Then customize it however you like</p>
              </div>

              <div className="mt-8">
                <Link
                  to="/trips"
                  className="inline-flex items-center gap-2 text-primary-500 hover:text-primary-600 font-semibold text-sm transition-colors"
                >
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
