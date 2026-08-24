import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Navbar from '@/components/feature/Navbar';
import Footer from '@/components/feature/Footer';
import { destinations as fallbackDestinations } from '@/mocks/homeData';
import { PREFECTURE_REGIONS, getRegionBySlug } from '@/mocks/prefectureData';

interface Destination {
  id: string;
  title: string;
  category: string;
  prefecture?: string;
  description: string;
  image: string;
}

export default function RegionPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [destinations, setDestinations] = useState<Destination[]>(fallbackDestinations);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const res = await fetch('/api/content?type=destinations');
        if (!res.ok) throw new Error('Failed to fetch');
        const json = await res.json();
        if (!cancelled && Array.isArray(json.data)) {
          setDestinations(json.data);
        }
      } catch {
        // フォールバック（homeData.tsの静的データ）のまま
      }
    }
    fetchData();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [slug]);

  const region = slug ? getRegionBySlug(slug) : undefined;
  const regionIndex = region ? PREFECTURE_REGIONS.findIndex((r) => r.slug === region.slug) : -1;
  const prevRegion =
    regionIndex >= 0
      ? PREFECTURE_REGIONS[(regionIndex - 1 + PREFECTURE_REGIONS.length) % PREFECTURE_REGIONS.length]
      : undefined;
  const nextRegion =
    regionIndex >= 0 ? PREFECTURE_REGIONS[(regionIndex + 1) % PREFECTURE_REGIONS.length] : undefined;

  if (!region) {
    return (
      <main className="min-h-screen bg-background-50 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center px-6 py-32">
          <div className="text-center">
            <i className="ri-error-warning-line text-5xl text-foreground-300 block mb-4"></i>
            <h1 className="text-2xl font-bold text-foreground-900 font-heading mb-2">Region not found</h1>
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-arrow-left-line"></i>
              Back to Home
            </Link>
          </div>
        </div>
        <Footer />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background-50">
      <Navbar />

      <section className="pt-24 md:pt-28 pb-16 md:pb-20 px-6 md:px-10 lg:px-20">
        <div className="max-w-5xl mx-auto">
          <nav
            className="flex items-center gap-2 text-foreground-400 text-xs mb-6 flex-wrap"
            aria-label="Breadcrumb"
          >
            <Link to="/" className="hover:text-foreground-700 transition-colors whitespace-nowrap">
              Home
            </Link>
            <span className="text-foreground-300">/</span>
            <span className="text-foreground-700 whitespace-nowrap">Regions</span>
            <span className="text-foreground-300">/</span>
            <span className="text-foreground-900 whitespace-nowrap">{region.region}</span>
          </nav>

          <div className="flex items-center justify-between gap-4 mb-3">
            <button
              type="button"
              onClick={() => prevRegion && navigate(`/regions/${prevRegion.slug}`)}
              className="flex items-center gap-1 text-foreground-500 hover:text-foreground-900 text-sm transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-arrow-left-s-line text-lg"></i>
              {prevRegion?.region}
            </button>
            <button
              type="button"
              onClick={() => nextRegion && navigate(`/regions/${nextRegion.slug}`)}
              className="flex items-center gap-1 text-foreground-500 hover:text-foreground-900 text-sm transition-colors cursor-pointer whitespace-nowrap"
            >
              {nextRegion?.region}
              <i className="ri-arrow-right-s-line text-lg"></i>
            </button>
          </div>

          <h1 className="font-heading font-bold text-3xl md:text-5xl text-foreground-900 leading-tight mb-3">
            {region.region}
          </h1>
          <p className="text-foreground-600 text-base max-w-2xl mb-10">{region.description}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {region.prefectures.map((pref) => {
              const prefDestinations = destinations.filter((d) => d.prefecture === pref);
              const hasContent = prefDestinations.length > 0;

              return (
                <Link
                  key={pref}
                  to={`/prefectures/${encodeURIComponent(pref)}`}
                  className="bg-background-50 border border-background-200 rounded-xl overflow-hidden flex flex-col hover:border-background-300 transition-colors cursor-pointer"
                >
                  {hasContent ? (
                    <div className="relative w-full h-36 overflow-hidden">
                      <img
                        src={prefDestinations[0].image}
                        alt={pref}
                        className="w-full h-full object-cover object-top"
                      />
                    </div>
                  ) : (
                    <div className="w-full h-36 bg-background-100 flex items-center justify-center">
                      <i className="ri-map-pin-line text-3xl text-foreground-300"></i>
                    </div>
                  )}

                  <div className="p-4 flex flex-col flex-1">
                    <h3 className="font-heading font-bold text-base text-foreground-900 mb-1.5">
                      {pref}
                    </h3>
                    {hasContent ? (
                      <p className="text-foreground-500 text-xs">
                        {prefDestinations.length}{' '}
                        {prefDestinations.length === 1 ? 'destination' : 'destinations'} on TABI
                      </p>
                    ) : (
                      <p className="text-foreground-400 text-xs">No destinations posted yet</p>
                    )}
                    <span className="mt-auto pt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary-500 whitespace-nowrap">
                      Explore {pref}
                      <i className="ri-arrow-right-s-line"></i>
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
