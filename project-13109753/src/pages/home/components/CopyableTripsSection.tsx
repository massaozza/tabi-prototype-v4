import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

// TABI47：TOPページの中核セクション。
// パンフレット風のリッチカードで旅程を提示し、「Copy to My Trip」
// ワンクリックでMy Tripが作られる状態まで一気に運ぶ導線。
// カードには写真グリッド・タグ・予算・日別行程（最大4スポット）を含む。

interface Activity {
  type: string;
  title: string;
  description?: string;
  time?: string;
  spotId?: string;
}

interface TripDay {
  day: number;
  activities?: Activity[];
}

interface PublicTrip {
  id: string;
  title: string;
  summary?: string;
  stays: { id: string }[];
  days: TripDay[];
  totalDays?: number;
  nationality?: string;
  travelStyle?: string;
  authorName?: string;
  saveCount?: number;
  copyCount?: number;
  highlights?: string[];
  tags?: string[];
  budgetMin?: number;
  budgetMax?: number;
}

// Spotのimageフィールドを取得するためのDestination型
interface Destination {
  id: string;
  title: string;
  image: string;
  prefecture?: string;
}

// SpotIDから画像URLを引いてくるためのキャッシュ
const spotImageCache = new Map<string, string>();

function formatBudget(min?: number, max?: number): string | null {
  if (!min && !max) return null;
  const fmt = (n: number) =>
    n >= 10000 ? `¥${(n / 10000).toFixed(n % 10000 === 0 ? 0 : 1)}万` : `¥${n.toLocaleString()}`;
  if (min && max) return `${fmt(min)} – ${fmt(max)} / person`;
  if (min) return `From ${fmt(min)} / person`;
  if (max) return `Under ${fmt(max)} / person`;
  return null;
}

// TOPページカードに表示するSpotを最大n件取得（transport以外）
function getCardActivities(days: TripDay[], max = 4): Activity[] {
  const result: Activity[] = [];
  for (const day of days) {
    if (result.length >= max) break;
    for (const act of day.activities || []) {
      if (act.type === 'transport') continue;
      result.push(act);
      if (result.length >= max) break;
    }
  }
  return result;
}

function TripCard({
  trip,
  spotImages,
}: {
  trip: PublicTrip;
  spotImages: Map<string, string>;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [copying, setCopying] = useState(false);
  const [error, setError] = useState('');

  const dayCount = trip.totalDays ?? trip.days?.length ?? 0;
  const activities = getCardActivities(trip.days);

  // Spot画像をspotId→image URLで引く（最大3枚）
  const spotIds = activities
    .map((a) => a.spotId)
    .filter((id): id is string => !!id)
    .slice(0, 3);
  const coverImages = spotIds.map((id) => spotImages.get(id)).filter(Boolean) as string[];

  const handleCopy = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    setCopying(true);
    setError('');
    try {
      const res = await fetch(
        `/api/trips?action=copy&sourceTripId=${encodeURIComponent(trip.id)}`,
        { method: 'POST', credentials: 'include' }
      );
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to copy');
      navigate('/my-trip');
    } catch {
      setError('Could not copy. Please try again.');
      setCopying(false);
    }
  };

  // カバー写真プレースホルダーの背景色（写真が無い場合）
  const PLACEHOLDER_COLORS = [
    'from-green-700 to-green-900',
    'from-stone-500 to-stone-700',
    'from-blue-700 to-blue-900',
  ];

  return (
    <div className="bg-white border border-background-200 rounded-2xl overflow-hidden flex flex-col">
      {/* 写真グリッド */}
      <div
        className="grid gap-0.5"
        style={{ gridTemplateColumns: '2fr 1fr', gridTemplateRows: '160px 90px' }}
      >
        {/* メイン写真（左、縦長） */}
        {coverImages[0] ? (
          <img
            src={coverImages[0]}
            alt={activities[0]?.title || trip.title}
            className="w-full h-full object-cover"
            style={{ gridRow: '1 / 3' }}
          />
        ) : (
          <div
            className={`w-full h-full bg-gradient-to-br ${PLACEHOLDER_COLORS[0]} flex items-center justify-center`}
            style={{ gridRow: '1 / 3' }}
          >
            <i className="ri-map-pin-2-line text-white/60 text-4xl"></i>
          </div>
        )}
        {/* サブ写真1 */}
        {coverImages[1] ? (
          <img
            src={coverImages[1]}
            alt={activities[1]?.title || ''}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className={`w-full h-full bg-gradient-to-br ${PLACEHOLDER_COLORS[1]} flex items-center justify-center`}
          >
            <i className="ri-landscape-line text-white/50 text-2xl"></i>
          </div>
        )}
        {/* サブ写真2 */}
        {coverImages[2] ? (
          <img
            src={coverImages[2]}
            alt={activities[2]?.title || ''}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className={`w-full h-full bg-gradient-to-br ${PLACEHOLDER_COLORS[2]} flex items-center justify-center`}
          >
            <i className="ri-restaurant-line text-white/50 text-xl"></i>
          </div>
        )}
      </div>

      {/* カード本文 */}
      <div className="p-4 flex flex-col flex-1">
        {/* タグ行 */}
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          {dayCount > 0 && (
            <span className="bg-primary-50 text-primary-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">
              {dayCount} {dayCount === 1 ? 'day' : 'days'}
            </span>
          )}
          {trip.travelStyle && (
            <span className="bg-background-100 text-foreground-600 text-xs font-medium px-2.5 py-0.5 rounded-full border border-background-200">
              {trip.travelStyle}
            </span>
          )}
          {(trip.tags || []).slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="bg-background-100 text-foreground-600 text-xs font-medium px-2.5 py-0.5 rounded-full border border-background-200"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* タイトル */}
        <Link
          to={`/trips/${trip.id}`}
          className="font-heading font-bold text-base text-foreground-900 hover:text-primary-600 transition-colors leading-snug mb-1 block"
        >
          {trip.title}
        </Link>

        {/* 概要 */}
        {trip.summary && (
          <p className="text-xs text-foreground-500 leading-relaxed mb-3 line-clamp-2">
            {trip.summary}
          </p>
        )}

        {/* 日程（タイムライン） */}
        {activities.length > 0 && (
          <div className="mb-3 space-y-0">
            {activities.map((act, idx) => (
              <div key={idx} className="flex items-start gap-2.5">
                <div className="flex flex-col items-center flex-shrink-0 w-3 pt-1">
                  <div
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      idx === activities.length - 1
                        ? 'bg-background-300'
                        : 'bg-primary-400'
                    }`}
                  ></div>
                  {idx < activities.length - 1 && (
                    <div className="w-px bg-background-200 flex-1 min-h-3 mt-0.5"></div>
                  )}
                </div>
                <div className="pb-2.5 min-w-0">
                  <div className="flex items-baseline gap-1.5">
                    {act.time && (
                      <span className="text-xs text-foreground-400 whitespace-nowrap flex-shrink-0">
                        {act.time}
                      </span>
                    )}
                    <span className="text-sm font-medium text-foreground-900 leading-snug">
                      {act.title}
                    </span>
                  </div>
                  {act.description && (
                    <p className="text-xs text-foreground-400 mt-0.5 line-clamp-1">
                      {act.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 予算・投稿者 */}
        <div className="flex items-center justify-between mb-3 mt-auto">
          {formatBudget(trip.budgetMin, trip.budgetMax) ? (
            <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
              {formatBudget(trip.budgetMin, trip.budgetMax)}
            </span>
          ) : (
            <span></span>
          )}
          {trip.authorName && (
            <span className="text-xs text-foreground-400">by {trip.authorName}</span>
          )}
        </div>

        {/* CTAボタン */}
        <button
          onClick={handleCopy}
          disabled={copying}
          className="w-full bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
        >
          {copying ? (
            'Copying...'
          ) : (
            <>
              <i className="ri-add-line"></i>
              Copy to My Trip
            </>
          )}
        </button>
        {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
        <p className="text-xs text-foreground-400 mt-1.5 text-center">
          Then customize it however you like
        </p>
      </div>
    </div>
  );
}

export default function CopyableTripsSection() {
  const [trips, setTrips] = useState<PublicTrip[]>([]);
  const [spotImages, setSpotImages] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        // Tripsと Destinationsを並列で取得
        const [tripRes, destRes] = await Promise.all([
          fetch('/api/trips?public=1'),
          fetch('/api/content?type=destinations'),
        ]);

        const tripJson = await tripRes.json();
        const destJson = await destRes.json();

        if (cancelled) return;

        // SpotIDから画像URLへのマップを構築
        const imgMap = new Map<string, string>();
        if (Array.isArray(destJson?.data)) {
          for (const dest of destJson.data as Destination[]) {
            if (dest.id && dest.image) imgMap.set(dest.id, dest.image);
          }
        }
        setSpotImages(imgMap);

        const items: PublicTrip[] = Array.isArray(tripJson?.trips) ? tripJson.trips : [];
        setTrips(items.slice(0, 3));
      } catch {
        if (!cancelled) setTrips([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, []);

  const showPlaceholder = !loading && trips.length === 0;

  return (
    <section className="py-16 md:py-24 px-6 md:px-10 bg-background-100">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between mb-10">
          <div>
            <span className="text-primary-600 font-semibold text-sm tracking-[0.15em] uppercase">
              Start in one click
            </span>
            <h2 className="font-heading font-bold text-3xl md:text-5xl text-foreground-900 leading-tight mt-2">
              Trips You Can Copy
            </h2>
          </div>
          <p className="text-foreground-500 text-base mt-4 lg:mt-0 lg:max-w-sm">
            Real itineraries from Japanese locals and travelers who've actually been there. Copy one, then make it yours.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="bg-white border border-background-200 rounded-2xl animate-pulse h-96"
              />
            ))}
          </div>
        ) : showPlaceholder ? (
          <div className="text-center py-16 text-foreground-400">
            <i className="ri-map-2-line text-4xl mb-4 block"></i>
            <p className="text-base font-medium text-foreground-500 mb-1">Trips coming soon</p>
            <p className="text-sm">
              Real itineraries from locals and travelers are on their way.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {trips.map((trip) => (
                <TripCard key={trip.id} trip={trip} spotImages={spotImages} />
              ))}
            </div>
            <div className="text-center mt-10">
              <Link
                to="/explore"
                className="inline-flex items-center gap-2 text-foreground-700 hover:text-primary-600 font-semibold text-sm transition-colors"
              >
                Browse all trips
                <i className="ri-arrow-right-line"></i>
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
