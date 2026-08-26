import { destinations as fallbackDestinations } from '@/mocks/homeData';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

interface Destination {
  id: string;
  title: string;
  category: string;
  description: string;
  image: string;
}

export default function DestinationsSection() {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);

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
        if (!cancelled) {
          setDestinations(fallbackDestinations);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, []);

  return (
    <section id="destinations" className="py-16 md:py-24 px-6 md:px-10 lg:px-20 bg-background-50">
      <div className="max-w-7xl mx-auto">
        <div className="mb-12">
          <span className="inline-block text-xs font-semibold tracking-widest uppercase text-accent-600 mb-3">
            Destinations
          </span>
          <h2 className="font-heading font-bold text-3xl md:text-5xl text-foreground-900 leading-tight">
            Trending <span className="text-primary-500">Spots</span>
          </h2>
          <p className="text-foreground-500 text-base mt-3 max-w-xl">
            Go beyond the landmarks to discover the authentic rhythms, flavors, and stories of each place
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {loading ? (
            <>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-background-100 rounded-xl overflow-hidden"
                >
                  <div className="w-full h-56 md:h-64 bg-background-200 animate-pulse"></div>
                  <div className="p-5 md:p-6 space-y-3">
                    <div className="h-4 w-20 bg-background-200 rounded-full animate-pulse"></div>
                    <div className="h-5 w-3/4 bg-background-200 rounded animate-pulse"></div>
                    <div className="h-3 w-full bg-background-200 rounded animate-pulse"></div>
                    <div className="h-3 w-5/6 bg-background-200 rounded animate-pulse"></div>
                    <div className="h-3 w-4/6 bg-background-200 rounded animate-pulse"></div>
                  </div>
                </div>
              ))}
            </>
          ) : (
            destinations.map((dest) => (
              <article
                key={dest.id}
                className="group bg-background-100 rounded-xl overflow-hidden transition-all duration-300 hover:-translate-y-1 cursor-pointer"
                data-product-shop
              >
                <div className="relative w-full h-56 md:h-64 overflow-hidden">
                  <img
                    src={dest.image}
                    alt={`${dest.title} — ${dest.category}`}
                    title={`${dest.title} travel experience — TABI`}
                    className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                  />
                  <span className="absolute top-4 left-4 bg-background-50/90 text-foreground-800 text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap">
                    {dest.category}
                  </span>
                </div>
                <div className="p-5 md:p-6">
                  <h3 className="font-heading font-bold text-xl text-foreground-900 mb-2">
                    {dest.title}
                  </h3>
                  <p className="text-foreground-600 text-sm leading-relaxed mb-4 line-clamp-3">
                    {dest.description}
                  </p>
                  <Link
                    to={`/destinations/${dest.id}`}
                    className="inline-flex items-center gap-1 text-primary-500 font-semibold text-sm hover:gap-2 transition-all duration-200 cursor-pointer whitespace-nowrap"
                  >
                    Discover More
                    <i className="ri-arrow-right-line"></i>
                  </Link>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}