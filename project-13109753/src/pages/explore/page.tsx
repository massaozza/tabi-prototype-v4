import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '@/components/feature/Navbar';
import Footer from '@/components/feature/Footer';

type ContentType = 'trip' | 'guide' | 'spot';

interface ExploreResult {
  id: string;
  contentType: ContentType;
  title: string;
  image?: string;
  area?: string;
  summary?: string;
  href: string;
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

export default function ExplorePage() {
  const [activeTab, setActiveTab] = useState<'all' | ContentType>('all');
  const [query, setQuery] = useState('');
  const [area, setArea] = useState('');
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

    const timeout = setTimeout(fetchData, 300); // 入力ごとの検索を少し間引く
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [activeTab, query, area]);

  return (
    <main className="min-h-screen bg-background-50">
      <Navbar />

      <section className="bg-background-900 pt-24 md:pt-32 pb-12 md:pb-16">
        <div className="max-w-5xl mx-auto px-6 md:px-10 lg:px-20 text-center">
          <nav
            className="flex items-center justify-center gap-2 text-white/50 text-xs mb-6 flex-wrap"
            aria-label="Breadcrumb"
          >
            <Link to="/" className="hover:text-white/80 transition-colors whitespace-nowrap">
              Home
            </Link>
            <span className="text-white/30">/</span>
            <span className="text-white whitespace-nowrap">Explore</span>
          </nav>

          <span className="inline-block text-xs font-semibold tracking-widest uppercase text-accent-400 mb-3">
            Trips · Guides · Spots
          </span>
          <h1 className="font-heading font-bold text-3xl md:text-5xl text-white leading-tight mb-4">
            Explore Everything <span className="text-primary-400">TABI Knows</span>
          </h1>
          <p className="text-white/60 text-base max-w-xl mx-auto leading-relaxed">
            Search across real trips, local guides, and spots — all in one place.
          </p>
        </div>
      </section>

      <section className="py-10 px-6 md:px-10 lg:px-20">
        <div className="max-w-6xl mx-auto">
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <div className="flex-1 relative">
              <i className="ri-search-line absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-400"></i>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by keyword (e.g. temple, ramen, hiking)"
                className="w-full bg-background-50 border border-background-200 rounded-md pl-10 pr-4 py-2.5 text-sm text-foreground-900 placeholder:text-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400"
              />
            </div>
            <div className="relative md:w-56">
              <i className="ri-map-pin-line absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-400"></i>
              <input
                type="text"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="Area (e.g. Kyoto)"
                className="w-full bg-background-50 border border-background-200 rounded-md pl-10 pr-4 py-2.5 text-sm text-foreground-900 placeholder:text-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400"
              />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-background-100 rounded-lg p-1 w-fit mb-8">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
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

          {/* Results */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
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
                Try a different keyword or area, or check back later as more content is added.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {results.map((r) => {
                const badge = TYPE_BADGE[r.contentType];
                return (
                  <Link
                    key={`${r.contentType}-${r.id}`}
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
                        <p className="text-foreground-600 text-sm leading-relaxed line-clamp-2">
                          {r.summary}
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
}
