import { useTranslation } from 'react-i18next';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '@/components/feature/Navbar';
import Footer from '@/components/feature/Footer';
import { loadGoogleMaps } from '@/lib/loadGoogleMaps';

type ContentType = 'trip' | 'guide' | 'spot';

interface ExploreResult {
  id: string;
  contentType: ContentType;
  title: string;
  image?: string;
  area?: string;
  summary?: string;
  href: string;
  lat?: number;
  lng?: number;
  category?: string;
}

const TYPE_BADGE: Record<ContentType, { label: string; className: string }> = {
  trip: { label: 'Trip', className: 'bg-primary-100 text-primary-800' },
  guide: { label: 'Guide', className: 'bg-accent-100 text-accent-800' },
  spot: { label: 'Spot', className: 'bg-secondary-100 text-secondary-800' },
};

const TABS: { key: 'all' | ContentType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'trip', label: 'Trips' },
  { key: 'guide', label: 'Guides' },
  { key: 'spot', label: 'Spots' },
];

const SPOT_CATEGORIES = [
  'Temple',
  'Nature',
  'Restaurant',
  'Cafe',
  'Activity',
  'Hotel',
  'Shop',
  'Other',
];

// TABI 3.0：検索結果（SPOTのみ、緯度経度を持つもの）を地図にピン表示し、
// カード一覧と連動させる。ピンをクリックすると、その場所の詳細ページに移動する。
function ExploreMapPanel({ results }: { results: ExploreResult[] }) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  const spotsWithCoords = results.filter(
    (r): r is ExploreResult & { lat: number; lng: number } =>
      typeof r.lat === 'number' && typeof r.lng === 'number'
  );

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then(() => {
        if (cancelled || !containerRef.current || mapRef.current) return;
        const googleAny = (window as any).google;
        if (!googleAny?.maps) return;

        mapRef.current = new googleAny.maps.Map(containerRef.current, {
          zoom: 5,
          center: { lat: 36.5, lng: 138.0 },
          disableDefaultUI: true,
          zoomControl: true,
        });
      })
      .catch(() => {
        // 地図の読み込みに失敗しても、カード一覧は引き続き使えるようにする
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    const googleAny = (window as any).google;
    if (!googleAny?.maps) return;

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    if (spotsWithCoords.length === 0) return;

    const bounds = new googleAny.maps.LatLngBounds();
    spotsWithCoords.forEach((spot) => {
      const position = { lat: spot.lat, lng: spot.lng };
      const marker = new googleAny.maps.Marker({
        position,
        map: mapRef.current,
        title: spot.title,
      });
      marker.addListener('click', () => {
        window.location.href = spot.href;
      });
      markersRef.current.push(marker);
      bounds.extend(position);
    });

    if (spotsWithCoords.length === 1) {
      mapRef.current.setCenter({ lat: spotsWithCoords[0].lat, lng: spotsWithCoords[0].lng });
      mapRef.current.setZoom(12);
    } else {
      mapRef.current.fitBounds(bounds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      {spotsWithCoords.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-background-100/80 pointer-events-none">
          <p className="text-foreground-400 text-sm px-6 text-center">
            {t("explore_noMap")}
          </p>
        </div>
      )}
    </div>
  );
}

function ResultCard({ r }: { r: ExploreResult }) {
  const badge = TYPE_BADGE[r.contentType];
  return (
    <Link
      to={r.href}
      className="group flex flex-col bg-background-50 border border-background-200 rounded-xl overflow-hidden hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
    >
      <div className="relative w-full h-40 flex-shrink-0 overflow-hidden bg-background-100">
        {r.image ? (
          <img
            src={r.image}
            alt={r.title}
            className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-foreground-300">
            <i className="ri-image-line text-4xl"></i>
          </div>
        )}
        <span
          className={`absolute top-3 left-3 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${badge.className}`}
        >
          {badge.label}
        </span>
      </div>
      <div className="p-5 flex flex-col flex-1">
        {r.area && (
          <span className="text-xs text-foreground-400 mb-1.5 whitespace-nowrap">
            <i className="ri-map-pin-line mr-1"></i>
            {r.area}
          </span>
        )}
        <h3 className="font-heading font-bold text-base text-foreground-900 mb-2 leading-snug line-clamp-2">
          {r.title}
        </h3>
        {r.summary && (
          <p className="text-foreground-600 text-sm leading-relaxed line-clamp-2">{r.summary}</p>
        )}
      </div>
    </Link>
  );
}

export default function ExplorePage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'all' | ContentType>('all');
  const [query, setQuery] = useState('');
  const [area, setArea] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState<'popular' | 'rating' | 'az'>('popular');
  const [results, setResults] = useState<ExploreResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (activeTab !== 'all') params.set('type', activeTab);
        if (query.trim()) params.set('q', query.trim());
        if (area.trim()) params.set('area', area.trim());
        if (activeTab === 'spot' && category) params.set('category', category);
        params.set('sort', sort);

        const res = await fetch(`/api/explore?${params.toString()}`);
        if (!res.ok) throw new Error('Failed to fetch');
        const json = await res.json();
        if (!cancelled && Array.isArray(json.results)) {
          setResults(json.results);
        }
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    const timeout = setTimeout(fetchData, 300);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [activeTab, query, area, category, sort]);

  // 「All」タブでの、種類ごとのグルーピング（混在を避けるため）
  const spotsResults = results.filter((r) => r.contentType === 'spot');
  const guidesResults = results.filter((r) => r.contentType === 'guide');
  const tripsResults = results.filter((r) => r.contentType === 'trip');

  return (
    <main className="min-h-screen bg-background-50">
      <Navbar />

      <section className="bg-background-900 pt-24 md:pt-32 pb-10 md:pb-12">
        <div className="max-w-6xl mx-auto px-6 md:px-10 lg:px-20 text-center">
          <nav
            className="flex items-center justify-center gap-2 text-white/50 text-xs mb-5 flex-wrap"
            aria-label="Breadcrumb"
          >
            <Link to="/" className="hover:text-white/80 transition-colors whitespace-nowrap">
              Home
            </Link>
            <span className="text-white/30">/</span>
            <span className="text-white whitespace-nowrap">{t("explore_title")}</span>
          </nav>

          <span className="inline-block text-xs font-semibold tracking-widest uppercase text-accent-400 mb-3">
            Trips · Guides · Spots
          </span>
          <h1 className="font-heading font-bold text-2xl md:text-4xl text-white leading-tight mb-3">
            Explore Everything <span className="text-primary-400">TABI Knows</span>
          </h1>
          <p className="text-white/60 text-sm md:text-base max-w-xl mx-auto leading-relaxed">
            Search across real trips, local guides, and spots — all in one place.
          </p>
        </div>
      </section>

      <section className="px-6 md:px-10 lg:px-20 py-6">
        <div className="max-w-6xl mx-auto">
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-5">
            <div className="flex-1 relative">
              <i className="ri-search-line absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-400"></i>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("explore_searchPlaceholder", "Search by keyword")}
                className="w-full bg-background-50 border border-background-200 rounded-md pl-10 pr-4 py-2.5 text-sm text-foreground-900 placeholder:text-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400"
              />
            </div>
            <div className="relative md:w-56">
              <i className="ri-map-pin-line absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-400"></i>
              <input
                type="text"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder={t("explore_areaPlaceholder", "Area (e.g. Kyoto)")}
                className="w-full bg-background-50 border border-background-200 rounded-md pl-10 pr-4 py-2.5 text-sm text-foreground-900 placeholder:text-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400"
              />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
            <div className="flex gap-1 bg-background-100 rounded-lg p-1 w-fit">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => {
                    setActiveTab(tab.key);
                    setCategory('');
                  }}
                  className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    activeTab === tab.key
                      ? 'bg-background-50 text-foreground-900 shadow-sm'
                      : 'text-foreground-500 hover:text-foreground-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* 個別タブ選択時のみ、並び替えの意味があるので表示する
                （「All」はSpots/Guides/Tripsごとにセクション分けしているため、
                このドロップダウンでの並び替えは非表示にする） */}
            {activeTab !== 'all' && (
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as 'popular' | 'rating' | 'az')}
                className="text-sm font-semibold text-foreground-700 bg-background-50 border border-background-200 rounded-md px-3 py-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-400"
              >
                <option value="popular">Sort: Most Popular</option>
                {activeTab === 'spot' && <option value="rating">Sort: Highest Rated</option>}
                <option value="az">Sort: A-Z</option>
              </select>
            )}
          </div>

          {/* SPOTタブの時だけ、カテゴリ絞り込みを表示 */}
          {activeTab === 'spot' && (
            <div className="flex items-center gap-2 flex-wrap mb-5">
              <button
                onClick={() => setCategory('')}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap transition-colors cursor-pointer ${
                  category === ''
                    ? 'bg-foreground-900 text-white'
                    : 'bg-background-100 text-foreground-600 hover:bg-background-200'
                }`}
              >
                All Categories
              </button>
              {SPOT_CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap transition-colors cursor-pointer ${
                    category === c
                      ? 'bg-foreground-900 text-white'
                      : 'bg-background-100 text-foreground-600 hover:bg-background-200'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="px-6 md:px-10 lg:px-20 pb-16">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row-reverse gap-6">
          {/* 地図パネル */}
          <div className="w-full md:w-[380px] flex-shrink-0">
            <div className="h-64 md:h-[600px] md:sticky md:top-24 rounded-xl overflow-hidden border border-background-200">
              <ExploreMapPanel results={results} />
            </div>
          </div>

          {/* カード一覧 */}
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-56 bg-background-100 rounded-xl animate-pulse"></div>
                ))}
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-20">
                <span className="w-16 h-16 rounded-full bg-background-100 flex items-center justify-center mx-auto mb-6">
                  <i className="ri-search-line text-3xl text-foreground-400"></i>
                </span>
                <h2 className="font-heading font-bold text-xl text-foreground-900 mb-2">
                  No results found
                </h2>
                <p className="text-foreground-500 text-sm">
                  Try a different keyword, area, or category.
                </p>
              </div>
            ) : activeTab !== 'all' ? (
              // 個別タブ：そのままフラットなグリッド
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {results.map((r) => (
                  <ResultCard key={`${r.contentType}-${r.id}`} r={r} />
                ))}
              </div>
            ) : (
              // 「All」タブ：種類が混ざって分かりにくくならないよう、
              // Spots / Guides / Trips ごとにセクションを分けて表示する
              <div className="space-y-10">
                {spotsResults.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="font-heading font-bold text-lg text-foreground-900">
                        Spots
                      </h2>
                      <button
                        onClick={() => setActiveTab('spot')}
                        className="text-primary-500 hover:text-primary-600 text-sm font-semibold whitespace-nowrap cursor-pointer"
                      >
                        View all →
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      {spotsResults.slice(0, 4).map((r) => (
                        <ResultCard key={`${r.contentType}-${r.id}`} r={r} />
                      ))}
                    </div>
                  </div>
                )}

                {guidesResults.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="font-heading font-bold text-lg text-foreground-900">
                        Guides
                      </h2>
                      <button
                        onClick={() => setActiveTab('guide')}
                        className="text-primary-500 hover:text-primary-600 text-sm font-semibold whitespace-nowrap cursor-pointer"
                      >
                        View all →
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      {guidesResults.slice(0, 4).map((r) => (
                        <ResultCard key={`${r.contentType}-${r.id}`} r={r} />
                      ))}
                    </div>
                  </div>
                )}

                {tripsResults.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="font-heading font-bold text-lg text-foreground-900">
                        Trips
                      </h2>
                      <button
                        onClick={() => setActiveTab('trip')}
                        className="text-primary-500 hover:text-primary-600 text-sm font-semibold whitespace-nowrap cursor-pointer"
                      >
                        View all →
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      {tripsResults.slice(0, 4).map((r) => (
                        <ResultCard key={`${r.contentType}-${r.id}`} r={r} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
