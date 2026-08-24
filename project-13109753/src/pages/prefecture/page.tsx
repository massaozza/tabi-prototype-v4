import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Navbar from '@/components/feature/Navbar';
import Footer from '@/components/feature/Footer';
import { destinations as fallbackDestinations } from '@/mocks/homeData';
import { PREFECTURE_REGIONS } from '@/mocks/prefectureData';

interface Destination {
  id: string;
  title: string;
  category: string;
  prefecture?: string;
  description: string;
  image: string;
}

export default function PrefecturePage() {
  const { name } = useParams<{ name: string }>();
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
  }, [name]);

  const prefectureName = name || '';
  const region = PREFECTURE_REGIONS.find((r) => r.prefectures.includes(prefectureName));
  const prefDestinations = destinations.filter((d) => d.prefecture === prefectureName);

  const handleAskAboutPrefecture = () => {
    window.dispatchEvent(
      new CustomEvent('tabi:ask-question', {
        detail: {
          question: `What should I see and do in ${prefectureName}, Japan?`,
        },
      })
    );
  };

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
            {region && (
              <>
                <span className="text-foreground-300">/</span>
                <Link
                  to={`/regions/${region.slug}`}
                  className="hover:text-foreground-700 transition-colors whitespace-nowrap"
                >
                  {region.region}
                </Link>
              </>
            )}
            <span className="text-foreground-300">/</span>
            <span className="text-foreground-900 whitespace-nowrap">{prefectureName}</span>
          </nav>

          <h1 className="font-heading font-bold text-3xl md:text-5xl text-foreground-900 leading-tight mb-3">
            {prefectureName}
          </h1>
          <p className="text-foreground-600 text-base max-w-2xl mb-10">
            Destinations and experiences across {prefectureName}.
          </p>

          {prefDestinations.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {prefDestinations.map((d) => (
                <div
                  key={d.id}
                  className="bg-background-50 border border-background-200 rounded-xl overflow-hidden flex flex-col"
                >
                  <div className="relative w-full h-36 overflow-hidden">
                    <img
                      src={d.image}
                      alt={d.title}
                      className="w-full h-full object-cover object-top"
                    />
                  </div>
                  <div className="p-4 flex flex-col flex-1">
                    <span className="inline-block self-start text-xs font-semibold text-accent-700 bg-accent-100 rounded-full px-2.5 py-0.5 mb-2">
                      {d.category}
                    </span>
                    <h3 className="font-heading font-bold text-base text-foreground-900 mb-1.5">
                      {d.title}
                    </h3>
                    <p className="text-foreground-500 text-xs mb-3 leading-relaxed">
                      {d.description}
                    </p>
                    <Link
                      to={`/destinations/${d.id}`}
                      className="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold text-primary-500 hover:text-primary-600 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Discover More
                      <i className="ri-arrow-right-line"></i>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-background-50 border border-background-200 rounded-xl p-10 md:p-14 text-center">
              <i className="ri-map-pin-line text-4xl text-foreground-300 block mb-4"></i>
              <p className="text-foreground-600 text-base mb-6">
                No destination information is available yet for {prefectureName}.
              </p>
              <button
                type="button"
                onClick={handleAskAboutPrefecture}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-chat-3-line"></i>
                Ask TABI about {prefectureName}
              </button>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
}
