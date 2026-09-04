import LocalizedLink from '@/components/feature/LocalizedLink';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

// TABI47：TOPページ「Trips You Can Copy」セクション。
// カードはティーザーに徹する。写真・タグ・タイトル・概要・予算・CTAのみ。
// 詳細（日程タイムライン・ハイライト等）はTripの詳細ページで見せる。

interface TripDay {
  day: number;
  activities?: { type?: string; spotId?: string; title: string }[];
}

interface PublicTrip {
  id: string;
  title: string;
  summary?: string;
  days: TripDay[];
  totalDays?: number;
  travelStyle?: string;
  authorName?: string;
  tags?: string[];
  budgetMin?: number;
  budgetMax?: number;
}

interface Destination {
  id: string;
  image: string;
}

function formatBudget(min?: number, max?: number): string | null {
  if (!min && !max) return null;
  const fmt = (n: number) =>
    n >= 10000 ? `¥${(n / 10000).toFixed(n % 10000 === 0 ? 0 : 1)}万` : `¥${n.toLocaleString()}`;
  if (min && max) return `${fmt(min)} – ${fmt(max)} / person`;
  if (min) return `From ${fmt(min)} / person`;
  return `Under ${fmt(max!)} / person`;
}

// TripのSpotIDから画像を最大3枚取得
function getCoverImages(trip: PublicTrip, spotImages: Map<string, string>): string[] {
  const result: string[] = [];
  for (const day of trip.days) {
    for (const act of day.activities || []) {
      if (act.type === 'transport') continue;
      if (act.spotId) {
        const img = spotImages.get(act.spotId);
        if (img && !result.includes(img)) result.push(img);
      }
      if (result.length >= 3) return result;
    }
  }
  return result;
}

const PLACEHOLDER_COLORS = [
  'from-green-800 to-emerald-950',
  'from-stone-600 to-stone-800',
  'from-blue-800 to-indigo-950',
];

function TripCard({ trip, spotImages }: { trip: PublicTrip; spotImages: Map<string, string> }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [copying, setCopying] = useState(false);
  const [error, setError] = useState('');

  const dayCount = trip.totalDays ?? trip.days?.length ?? 0;
  const coverImages = getCoverImages(trip, spotImages);
  const budgetText = formatBudget(trip.budgetMin, trip.budgetMax);

  const handleCopy = async () => {
    if (!user) { navigate('/login'); return; }
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

  return (
    <div className="bg-white border border-background-200 rounded-2xl overflow-hidden flex flex-col hover:border-primary-200 transition-colors">
      {/* 写真グリッド */}
      <LocalizedLink to={`/trips/${trip.id}`}>
        <div
          className="grid gap-0.5"
          style={{
            gridTemplateColumns: coverImages.length >= 2 ? '2fr 1fr' : '1fr',
            gridTemplateRows: coverImages.length >= 3 ? '130px 70px' : '180px',
          }}
        >
          {coverImages[0] ? (
            <img
              src={coverImages[0]}
              alt={trip.title}
              className="w-full h-full object-cover"
              style={{ gridRow: coverImages.length >= 2 ? '1 / 3' : '1' }}
            />
          ) : (
            <div
              className={`w-full h-full bg-gradient-to-br ${PLACEHOLDER_COLORS[0]} flex items-center justify-center`}
              style={{ gridRow: coverImages.length >= 2 ? '1 / 3' : '1' }}
            >
              <i className="ri-map-pin-2-line text-white/30 text-4xl"></i>
            </div>
          )}
          {coverImages[1] ? (
            <img src={coverImages[1]} alt="" className="w-full h-full object-cover" />
          ) : coverImages.length === 0 ? null : (
            <div className={`w-full h-full bg-gradient-to-br ${PLACEHOLDER_COLORS[1]} flex items-center justify-center`}>
              <i className="ri-landscape-line text-white/30 text-2xl"></i>
            </div>
          )}
          {coverImages[2] ? (
            <img src={coverImages[2]} alt="" className="w-full h-full object-cover" />
          ) : coverImages.length <= 1 ? null : (
            <div className={`w-full h-full bg-gradient-to-br ${PLACEHOLDER_COLORS[2]} flex items-center justify-center`}>
              <i className="ri-restaurant-line text-white/30 text-xl"></i>
            </div>
          )}
        </div>
      </LocalizedLink>

      {/* テキスト部分 */}
      <div className="p-4 flex flex-col flex-1">
        {/* タグ */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {dayCount > 0 && (
            <span className="bg-primary-50 text-primary-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">
              {dayCount} {dayCount === 1 ? 'day' : 'days'}
            </span>
          )}
          {(trip.tags || []).slice(0, 2).map((tag) => (
            <span key={tag} className="bg-background-100 text-foreground-600 text-xs font-medium px-2.5 py-0.5 rounded-full border border-background-200">
              {tag}
            </span>
          ))}
          {budgetText && (
            <span className="bg-amber-50 text-amber-700 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-amber-200">
              {budgetText}
            </span>
          )}
        </div>

        {/* タイトル */}
        <LocalizedLink to={`/trips/${trip.id}`} className="font-heading font-bold text-base text-foreground-900 hover:text-primary-600 transition-colors leading-snug mb-1 block">
          {trip.title}
        </LocalizedLink>

        {/* 概要 */}
        {trip.summary && (
          <p className="text-xs text-foreground-500 leading-relaxed mb-3 line-clamp-2 flex-1">
            {trip.summary}
          </p>
        )}

        {trip.authorName && (
          <p className="text-xs text-foreground-400 mb-3">by {trip.authorName}</p>
        )}

        {/* CTA */}
        <div className="mt-auto">
          <button
            onClick={handleCopy}
            disabled={copying}
            className="w-full bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            {copying ? 'Copying...' : <><i className="ri-add-line"></i>Copy to My Trip</>}
          </button>
          {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
          <p className="text-xs text-foreground-400 mt-1.5 text-center">
            See full itinerary before copying →{' '}
            <LocalizedLink to={`/trips/${trip.id}`} className="underline hover:text-foreground-600">View trip</LocalizedLink>
          </p>
        </div>
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
        const [tripRes, destRes] = await Promise.all([
          fetch('/api/trips?public=1'),
          fetch('/api/content?type=destinations'),
        ]);
        const tripJson = await tripRes.json();
        const destJson = await destRes.json();
        if (cancelled) return;

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
    return () => { cancelled = true; };
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
            Real itineraries from Japanese locals and travelers. Copy one, then make it yours.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-white border border-background-200 rounded-2xl animate-pulse h-72" />
            ))}
          </div>
        ) : showPlaceholder ? (
          <div className="text-center py-16 text-foreground-400">
            <i className="ri-map-2-line text-4xl mb-4 block"></i>
            <p className="text-base font-medium text-foreground-500 mb-1">Trips coming soon</p>
            <p className="text-sm">Real itineraries from locals and travelers are on their way.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {trips.map((trip) => (
                <TripCard key={trip.id} trip={trip} spotImages={spotImages} />
              ))}
            </div>
            <div className="text-center mt-10">
              <LocalizedLink to="/explore" className="inline-flex items-center gap-2 text-foreground-700 hover:text-primary-600 font-semibold text-sm transition-colors">
                Browse all trips <i className="ri-arrow-right-line"></i>
              </LocalizedLink>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
