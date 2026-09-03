import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

// TABI47：TOPページの中核セクション。
// 初訪問者にとって「保存したいもの」がまだ無い状態を解消するため、
// すでに公開されている完成済みの旅程を提示し、「Copy to My Trip」
// ワンクリックでMy Tripが作られる状態まで一気に運ぶ導線。
// （PDFの「すべてのコンテンツからMY TRIPへつなげる」という原則、および
// 「Recommended Trip → Copy → Customize → Travel」の循環の入口にあたる）

interface PublicTrip {
  id: string;
  title: string;
  summary?: string;
  stays: { id: string }[];
  days: { day: number }[];
  totalDays?: number;
  nationality?: string;
  travelStyle?: string;
  authorName?: string;
  saveCount?: number;
  copyCount?: number;
}

function TripCard({ trip }: { trip: PublicTrip }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [copying, setCopying] = useState(false);
  const [error, setError] = useState('');

  const dayCount = trip.totalDays ?? trip.days?.length ?? 0;

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
      setError('Could not copy this trip. Please try again.');
      setCopying(false);
    }
  };

  return (
    <div className="bg-white border border-background-200 rounded-xl p-6 flex flex-col hover:border-primary-300 transition-colors">
      <div className="flex items-center gap-2 text-xs text-foreground-500 mb-3">
        {dayCount > 0 && (
          <span className="bg-background-100 px-2 py-0.5 rounded-full font-medium">
            {dayCount} {dayCount === 1 ? 'day' : 'days'}
          </span>
        )}
        {trip.travelStyle && (
          <span className="bg-background-100 px-2 py-0.5 rounded-full font-medium">
            {trip.travelStyle}
          </span>
        )}
      </div>

      <Link
        to={`/trips/${trip.id}`}
        className="font-heading font-bold text-lg text-foreground-900 mb-2 hover:text-primary-600 transition-colors block"
      >
        {trip.title}
      </Link>

      {trip.summary && (
        <p className="text-foreground-600 text-sm leading-relaxed mb-4 line-clamp-3 flex-1">
          {trip.summary}
        </p>
      )}

      {(trip.authorName || trip.nationality) && (
        <p className="text-xs text-foreground-400 mb-4">
          {trip.authorName && <span>by {trip.authorName}</span>}
          {trip.authorName && trip.nationality && <span> · </span>}
          {trip.nationality && <span>{trip.nationality}</span>}
        </p>
      )}

      <div className="mt-auto">
        <button
          onClick={handleCopy}
          disabled={copying}
          className="w-full bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2"
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
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        <p className="text-xs text-foreground-400 mt-2 text-center">
          Then customize it however you like
        </p>
      </div>
    </div>
  );
}

export default function CopyableTripsSection() {
  const [trips, setTrips] = useState<PublicTrip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/trips?public=1')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const items: PublicTrip[] = Array.isArray(data?.trips) ? data.trips : [];
        // /api/trips?public=1 はすでにスコア順（Copy数・Save数・閲覧数・
        // 新しさ）で返ってくるため、先頭3件をそのまま使う
        setTrips(items.slice(0, 3));
      })
      .catch(() => {
        if (!cancelled) setTrips([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 公開Tripがまだ無い場合は、セクション自体を出さない
  // （空の枠だけが並ぶのを避ける）
  if (!loading && trips.length === 0) return null;

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
                className="bg-white border border-background-200 rounded-xl p-6 animate-pulse h-64"
              />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {trips.map((trip) => (
                <TripCard key={trip.id} trip={trip} />
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
