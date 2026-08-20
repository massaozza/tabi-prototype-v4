import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Navbar from '@/components/feature/Navbar';
import Footer from '@/components/feature/Footer';
import { destinations as fallbackDestinations } from '@/mocks/homeData';

interface Destination {
  id: string;
  title: string;
  category: string;
  description: string;
  image: string;
}

export default function DestinationPage() {
  const { id } = useParams<{ id: string }>();
  const [destination, setDestination] = useState<Destination | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    setDestination(null);

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
