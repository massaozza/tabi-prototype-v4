import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Navbar from '@/components/feature/Navbar';
import Footer from '@/components/feature/Footer';
import { useAuth } from '@/context/AuthContext';
import { useAutoT, useAutoText } from '@/hooks/useAutoT';
import BookingCta from '@/components/feature/BookingCta';
import { trackEvent } from '@/lib/track';
import {
  savePendingAction,
  takePendingAction,
  loginPathWithReturn,
} from '@/lib/pendingAction';

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
}

/** OSM由来の一部Spotは正しい画像を持たないことがあるため、この判定を共通化する */
function isUsableImage(url: string | undefined): boolean {
  return !!url && !url.includes('readdy.ai');
}

/** Spot画像が3枚に満たない場合の汎用フォールバック（旅先の雰囲気だけを伝える一般的な写真） */
const SAMPLE_IMAGES = [
  'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=900&q=80',
  'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=600&q=80',
  'https://images.unsplash.com/photo-1480796927426-f609979314bd?w=600&q=80',
];

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
  const tx = useAutoText();
  const t = useAutoT();
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
        const res = await fetch('/api/trips?public=1');
        if (!res.ok) throw new Error('Failed to fetch');
        const json = await res.json();
        if (!cancelled && Array.isArray(json.trips)) {
          const found = json.trips.find((t: PublicTrip) => t.id === id) ?? null;
          setTrip(found);
          if (found) {
            trackEvent('view', 'trip', found.id);

            // 【重要】旅程で紹介しているSpotの写真を表示するため、個別に取得する。
            // /api/content?type=destinations（1500件を超えると更新が止まる
            // 派生キャッシュ）からは、全国展開後の新しいSpotが見つからない
            // ことがあるため、/api/spots?id=xxx で1件ずつ確実に取得する。
            const spotIds: string[] = Array.from(
              new Set(
                (found.days || [])
                  .flatMap((d: TripDay) => d.activities || [])
                  .map((a: TripActivity) => a.spotId)
                  .filter((v: unknown): v is string => typeof v === 'string' && !!v)
              )
            ) as string[];
            if (spotIds.length > 0) {
              Promise.all(
                spotIds.map((sid) =>
                  fetch(`/api/spots?id=${encodeURIComponent(sid)}`)
                    .then((r) => (r.ok ? r.json() : null))
                    .then((d) => (d?.spot ? (d.spot as Destination) : null))
                    .catch(() => null)
                )
              ).then((results) => {
                if (cancelled) return;
                const map = new Map<string, Destination>();
                for (const dest of results) if (dest?.id) map.set(dest.id, dest);
                setSpotData(map);
              });
            }
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

  const handleSave = async (tripArg?: PublicTrip) => {
    const target = tripArg || trip;
    if (!target) return;
    if (!user) {
      // ログイン後にこの操作を続行できるよう、意図と戻り先を残す
      savePendingAction('save', 'trip', target.id);
      navigate(loginPathWithReturn());
      return;
    }
    trackEvent('save', 'trip', target.id);
    setSaving(true);
    setActionError('');
    try {
      const res = await fetch(`/api/trips?action=save&tripId=${encodeURIComponent(target.id)}`, {
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

  const handleCopy = async (tripArg?: PublicTrip) => {
    const target = tripArg || trip;
    if (!target) return;
    if (!user) {
      savePendingAction('copy', 'trip', target.id);
      navigate(loginPathWithReturn());
      return;
    }
    trackEvent('copy', 'trip', target.id);
    setCopying(true);
    setActionError('');
    try {
      const res = await fetch(
        `/api/trips?action=copy&sourceTripId=${encodeURIComponent(target.id)}`,
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

  // ── ログインから戻ってきたときに、押しかけた操作を自動で続行する ──
  // 未ログインでSave/Copyを押した人が、ログイン後にどの旅程だったか
  // 探し直さずに済むようにするための処理。
  useEffect(() => {
    if (!user || !trip) return;
    const pending = takePendingAction();
    if (!pending || pending.contentType !== 'trip' || pending.id !== trip.id) return;

    if (pending.action === 'copy') {
      void handleCopy(trip);
    } else if (pending.action === 'save') {
      void handleSave(trip);
    }
    // trip と user が揃った初回だけ実行させる
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, trip]);

  const getHeaderImages = (t: PublicTrip): string[] => {
    const result: string[] = [];
    for (const day of [...t.days].sort((a, b) => a.day - b.day)) {
      for (const act of day.activities || []) {
        if (act.type === 'transport') continue;
        if (act.spotId) {
          const dest = spotData.get(act.spotId);
          if (dest?.image && isUsableImage(dest.image) && !result.includes(dest.image)) {
            result.push(dest.image);
          }
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
                {t("trips_notFound", "Trip not found")}
              </h1>
              <Link
                to="/trips"
                className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm px-6 py-3 rounded-lg transition-colors whitespace-nowrap"
              >
                <i className="ri-arrow-left-line"></i>
                {t("trips_backToTrips", "Back to Trips")}
              </Link>
            </div>
          ) : (
            <article>
              {(() => {
                const headerImages = getHeaderImages(trip);
                return (
                  <div className="relative h-[220px] md:h-[320px] overflow-hidden rounded-2xl mb-6 -mx-6 md:mx-0">
                    <div
                      className="absolute inset-0 grid gap-[3px]"
                      style={{ gridTemplateColumns: '2fr 1fr', gridTemplateRows: '1fr 1fr' }}
                    >
                      <img
                        src={headerImages[0]}
                        alt={tx(trip.title)}
                        className="w-full h-full object-cover"
                        style={{ gridRow: '1 / 3' }}
                      />
                      <img src={headerImages[1]} alt="" className="w-full h-full object-cover" />
                      <img src={headerImages[2]} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div
                      className="absolute inset-0"
                      style={{
                        background:
                          'linear-gradient(to bottom, rgba(10,18,40,0.45) 0%, rgba(10,18,40,0) 35%, rgba(10,18,40,0) 55%, rgba(10,18,40,0.85) 100%)',
                      }}
                    />
                  </div>
                );
              })()}

              <nav
                className="flex items-center gap-2 text-foreground-400 text-xs mb-6 flex-wrap"
                aria-label={t('auto_c766e66518', "Breadcrumb")}
              >
                <Link to="/" className="hover:text-foreground-700 transition-colors whitespace-nowrap">
                  {t("common_home", "Home")}
                </Link>
                <span className="text-foreground-300">/</span>
                <Link
                  to="/trips"
                  className="hover:text-foreground-700 transition-colors whitespace-nowrap"
                >
                  {t("trips_title", "Trips")}
                </Link>
                <span className="text-foreground-300">/</span>
                <span className="text-foreground-900 line-clamp-1">{tx(trip.title)}</span>
              </nav>

              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span
                  className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${
                    TRIP_TYPE_BADGE[trip.tripType || 'actual'].className
                  }`}
                >
                  {tx(TRIP_TYPE_BADGE[trip.tripType || 'actual'].label)}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-background-100 text-foreground-700 whitespace-nowrap">
                  <i className="ri-calendar-line"></i>
                  {trip.days.length} {trip.days.length === 1 ? 'day' : 'days'}
                </span>
              </div>

              <h1 className="font-heading font-bold text-3xl md:text-4xl text-foreground-900 leading-tight mb-3">
                {tx(trip.title)}
              </h1>

              {trip.summary && (
                <p className="text-foreground-600 text-base leading-relaxed mb-6">
                  {tx(trip.summary)}
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
                  onClick={() => handleSave()}
                  disabled={saving || saved}
                  className="inline-flex items-center gap-2 bg-background-100 hover:bg-background-200 disabled:opacity-60 text-foreground-800 font-semibold text-sm px-5 py-2.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  <i className={saved ? 'ri-bookmark-fill' : 'ri-bookmark-line'}></i>
                  {saved ? t('trips_saved', 'Saved') : saving ? t('trips_saving', 'Saving...') : t('trips_save', 'Save')}
                </button>
                <button
                  onClick={() => handleCopy()}
                  disabled={copying}
                  className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white font-semibold text-sm px-5 py-2.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-file-copy-line"></i>
                  {copying ? t('trips_copying', 'Copying...') : t('trips_copyToMyTrip', 'Copy to My Trip')}
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
                        className="bg-background-50 border border-background-200 rounded-2xl overflow-hidden"
                      >
                        <div className="flex items-center justify-between px-5 md:px-6 py-4 bg-background-100/70 border-b border-background-200">
                          <div className="flex items-center gap-2.5">
                            <span className="w-7 h-7 rounded-full bg-primary-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                              {day.day}
                            </span>
                            <h3 className="font-heading font-bold text-base text-foreground-900">
                              {t('auto_987b9ced08', "Day")}{' '}{day.day}
                            </h3>
                          </div>
                          {stay && (
                            <span className="inline-flex items-center gap-1 text-xs text-foreground-500 whitespace-nowrap">
                              <i className="ri-hotel-line"></i>
                              {stay.hotelName}
                            </span>
                          )}
                        </div>

                        <div className="px-5 md:px-6 pt-5 pb-1">
                          {day.activities.map((a, idx) => {
                            const isTransport = a.type === 'transport';
                            const dest = a.spotId ? spotData.get(a.spotId) : undefined;
                            const imgUrl = dest?.image && isUsableImage(dest.image) ? dest.image : undefined;
                            const isLast = idx === day.activities.length - 1;

                            return (
                              <div key={idx} className="flex gap-3.5">
                                {/* タイムライン（縦線＋ドット/アイコン） */}
                                <div className="flex flex-col items-center flex-shrink-0">
                                  {isTransport ? (
                                    <span className="w-6 h-6 rounded-full bg-background-100 border border-background-200 flex items-center justify-center text-foreground-400">
                                      <i className="ri-route-line text-xs"></i>
                                    </span>
                                  ) : imgUrl ? (
                                    <img
                                      src={imgUrl}
                                      alt=""
                                      className="w-12 h-12 rounded-xl object-cover ring-2 ring-white"
                                    />
                                  ) : (
                                    <span className="w-12 h-12 rounded-xl bg-background-100 border border-background-200 flex items-center justify-center text-foreground-300">
                                      <i className="ri-map-pin-line"></i>
                                    </span>
                                  )}
                                  {!isLast && (
                                    <span
                                      className={`w-px flex-1 my-1 ${
                                        isTransport ? 'bg-background-200' : 'bg-background-200'
                                      }`}
                                      style={{ minHeight: isTransport ? '16px' : '10px' }}
                                    ></span>
                                  )}
                                </div>

                                {/* 内容 */}
                                <div className={`min-w-0 ${isTransport ? 'pb-3' : 'pb-4'}`}>
                                  {a.time && !isTransport && (
                                    <span className="inline-block text-[11px] font-semibold text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full mb-1">
                                      {a.time}
                                    </span>
                                  )}
                                  <p
                                    className={
                                      isTransport
                                        ? 'text-foreground-600 text-sm font-medium'
                                        : 'text-foreground-900 text-sm font-bold'
                                    }
                                  >
                                    {tx(a.title)}
                                  </p>
                                  {a.description && (
                                    <p className="text-foreground-500 text-xs mt-0.5 leading-relaxed">
                                      {tx(a.description)}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {(day.meals.breakfast || day.meals.lunch || day.meals.dinner) && (
                          <div className="flex flex-wrap gap-3 text-xs text-foreground-500 px-5 md:px-6 pb-5">
                            {day.meals.breakfast && (
                              <span className="inline-flex items-center gap-1">
                                <i className="ri-sun-line"></i>B: {day.meals.breakfast.suggestion}
                              </span>
                            )}
                            {day.meals.lunch && (
                              <span className="inline-flex items-center gap-1">
                                <i className="ri-restaurant-line"></i>L: {day.meals.lunch.suggestion}
                              </span>
                            )}
                            {day.meals.dinner && (
                              <span className="inline-flex items-center gap-1">
                                <i className="ri-moon-line"></i>D: {day.meals.dinner.suggestion}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </section>

              {/* 収益ファネルの出口。日程を見終わった直後に置く */}
              <BookingCta
                contentType="trip"
                contentId={trip.id}
                source="trip"
                context={trip.title}
                className="mb-10"
              />

              {(trip.reflectionWhatWorked || trip.reflectionWhatToChange) && (
                <section className="bg-background-100 rounded-xl p-6 mb-10">
                  <h4 className="font-heading font-semibold text-sm text-foreground-900 mb-3">
                    {t('trips_reflection', "Traveler's Reflection")}
                  </h4>
                  {trip.reflectionWhatWorked && (
                    <p className="text-foreground-700 text-sm mb-2">
                      <span className="font-semibold">{t('trips_whatWorked', 'What worked well:')} </span>
                      {trip.reflectionWhatWorked}
                    </p>
                  )}
                  {trip.reflectionWhatToChange && (
                    <p className="text-foreground-700 text-sm">
                      <span className="font-semibold">{t('trips_whatChange', "What they'd change:")} </span>
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
                {t("trips_backToTrips", "Back to Trips")}
              </Link>
            </article>
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
}
