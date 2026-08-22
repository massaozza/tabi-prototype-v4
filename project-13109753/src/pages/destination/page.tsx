import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Navbar from '@/components/feature/Navbar';
import Footer from '@/components/feature/Footer';
import { destinations as fallbackDestinations } from '@/mocks/homeData';
import { type Experience } from '@/pages/experiences/types';

interface Destination {
  id: string;
  title: string;
  category: string;
  description: string;
  image: string;
}

const categoryColors: Record<string, string> = {
  Temple: 'bg-accent-100 text-accent-800',
  Restaurant: 'bg-secondary-100 text-secondary-800',
  Cafe: 'bg-accent-50 text-accent-700',
  Nature: 'bg-primary-100 text-primary-800',
  Activity: 'bg-primary-100 text-primary-800',
  Hotel: 'bg-secondary-100 text-secondary-800',
  Shop: 'bg-accent-100 text-accent-800',
  Other: 'bg-background-200 text-foreground-600',
};

export default function DestinationPage() {
  const { id } = useParams<{ id: string }>();
  const [destination, setDestination] = useState<Destination | null>(null);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    setDestination(null);
    setExperiences([]);

    async function fetchData() {
      let list: Destination[] = fallbackDestinations;

      try {
        const res = await fetch('/api/content?type=destinations');
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.data)) {
            list = json.data;
          }
        }
      } catch {
        // フォールバックデータのまま続行
      }

      if (cancelled) return;

      const found = list.find((d) => d.id === id);
      if (found) {
        setDestination(found);

        // 関連するExperienceを取得（area === destination.id で絞り込み）
        try {
          const expRes = await fetch('/api/experiences');
          if (expRes.ok) {
            const json = await expRes.json();
            const all = Array.isArray(json) ? json : json.experiences;
            if (!cancelled && Array.isArray(all)) {
              const matching = all
                .filter((e: Experience) => e.area === found.id)
                .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
                .slice(0, 6);
              setExperiences(matching);
            }
          }
        } catch {
          // Experience取得失敗時はセクション非表示のまま
        }
      } else {
        setNotFound(true);
      }
      setLoading(false);
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleAskTabi = () => {
    if (!destination) return;
    window.dispatchEvent(
      new CustomEvent('tabi:ask-question', {
        detail: {
          question: `Tell me more about ${destination.title} — what should I know before visiting?`,
        },
      })
    );
  };

  return (
    <main className="min-h-screen bg-background-50">
      <Navbar />

      {loading ? (
        <div className="pt-36 pb-24 px-6 md:px-10 flex justify-center">
          <div className="w-full max-w-4xl space-y-6">
            <div className="h-6 w-40 bg-background-200 rounded-full animate-pulse"></div>
            <div className="h-12 w-3/4 bg-background-200 rounded animate-pulse"></div>
            <div className="w-full aspect-[16/9] bg-background-200 rounded-2xl animate-pulse"></div>
            <div className="h-4 w-full bg-background-200 rounded animate-pulse"></div>
            <div className="h-4 w-5/6 bg-background-200 rounded animate-pulse"></div>
          </div>
        </div>
      ) : notFound || !destination ? (
        <div className="pt-40 pb-24 px-6 flex flex-col items-center justify-center text-center">
          <span className="w-16 h-16 rounded-full bg-background-100 flex items-center justify-center mb-6">
            <i className="ri-map-pin-line text-3xl text-foreground-400"></i>
          </span>
          <h1 className="font-heading font-bold text-2xl md:text-4xl text-foreground-900 mb-3">
            Destination not found
          </h1>
          <p className="text-foreground-500 text-base mb-8">
            We couldn't find the destination you're looking for.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm px-6 py-3 rounded-lg transition-colors whitespace-nowrap"
          >
            <i className="ri-arrow-left-line"></i>
            Back to Home
          </Link>
        </div>
      ) : (
        <>
          {/* Hero */}
          <section className="bg-background-900 pt-24 md:pt-28 pb-0">
            <div className="max-w-[1140px] mx-auto px-6 md:px-10">
              <nav
                className="flex items-center gap-2 text-white/50 text-xs mb-6 flex-wrap"
                aria-label="Breadcrumb"
              >
                <Link to="/" className="hover:text-white/80 transition-colors whitespace-nowrap">
                  Home
                </Link>
                <span className="text-white/30">/</span>
                <Link
                  to="/#destinations"
                  className="hover:text-white/80 transition-colors whitespace-nowrap"
                >
                  Destinations
                </Link>
                <span className="text-white/30">/</span>
                <span className="text-white line-clamp-1">{destination.title}</span>
              </nav>

              <span className="inline-block bg-primary-100/20 text-primary-300 text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap mb-4">
                {destination.category.toUpperCase()}
              </span>

              <h1 className="font-heading font-bold text-3xl md:text-5xl text-white leading-tight mb-6 max-w-3xl">
                {destination.title}
              </h1>
            </div>

            <div className="max-w-[1140px] mx-auto px-0 md:px-10">
              <div className="w-full aspect-[16/9] overflow-hidden">
                <img
                  src={destination.image}
                  alt={`${destination.title} — ${destination.category}`}
                  title={`${destination.title} travel experience — TABI`}
                  className="w-full h-full object-cover object-top"
                />
              </div>
            </div>
          </section>

          {/* Content */}
          <section className="py-12 md:py-16 px-6 md:px-10 lg:px-20">
            <div className="max-w-3xl mx-auto">
              <Link
                to="/#destinations"
                className="inline-flex items-center gap-1.5 text-primary-500 hover:text-primary-600 font-semibold text-sm transition-colors whitespace-nowrap mb-8"
              >
                <i className="ri-arrow-left-line"></i>
                Back to Destinations
              </Link>

              <h2 className="font-heading font-bold text-xl md:text-2xl text-foreground-900 mb-4">
                About {destination.title}
              </h2>
              <p className="text-foreground-600 text-base md:text-lg leading-relaxed">
                {destination.description}
              </p>

              {experiences.length > 0 && (
                <section className="mt-12">
                  <h2 className="font-heading font-bold text-xl md:text-2xl text-foreground-900 mb-6">
                    Real Experiences from Travelers
                  </h2>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 md:gap-6">
                    {experiences.map((exp) => (
                      <Link
                        key={exp.id}
                        to={`/experiences/${exp.id}`}
                        className="group flex flex-col bg-background-50 rounded-xl overflow-hidden border border-background-200 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
                      >
                        {exp.photos && exp.photos.length > 0 && (
                          <div className="relative w-full h-40 flex-shrink-0 overflow-hidden bg-background-100">
                            <img
                              src={exp.photos[0]}
                              alt={exp.placeName}
                              title={`${exp.placeName} — TABI`}
                              className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                            />
                          </div>
                        )}

                        <div className="p-5 flex flex-col flex-1">
                          <div className="flex items-center gap-2 mb-3 flex-wrap">
                            <span
                              className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${
                                categoryColors[exp.category] ||
                                'bg-background-200 text-foreground-600'
                              }`}
                            >
                              {exp.category}
                            </span>
                            {exp.wouldRecommend && (
                              <span className="inline-flex items-center text-xs font-semibold text-emerald-600 whitespace-nowrap">
                                <i className="ri-checkbox-circle-fill mr-1"></i>
                                Recommended
                              </span>
                            )}
                          </div>

                          <h3 className="font-heading font-bold text-base text-foreground-900 mb-2 leading-snug">
                            {exp.placeName}
                          </h3>

                          <p className="text-foreground-600 text-sm leading-relaxed line-clamp-2 mb-3">
                            {exp.whatWasGood}
                          </p>

                          <span className="mt-auto text-foreground-400 text-xs whitespace-nowrap">
                            — {exp.authorName}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>

                  <div className="mt-8">
                    <Link
                      to="/experiences"
                      className="inline-flex items-center gap-1.5 text-primary-500 hover:text-primary-600 font-semibold text-sm transition-colors whitespace-nowrap"
                    >
                      View All Experiences
                      <i className="ri-arrow-right-line"></i>
                    </Link>
                  </div>
                </section>
              )}

              <div className="mt-10 pt-8 border-t border-background-200">
                <button
                  onClick={handleAskTabi}
                  className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm md:text-base px-6 py-3.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                >
                  <i className="ri-chat-3-line text-lg"></i>
                  Ask TABI about {destination.title}
                </button>
              </div>
            </div>
          </section>
        </>
      )}

      <Footer />
    </main>
  );
}
