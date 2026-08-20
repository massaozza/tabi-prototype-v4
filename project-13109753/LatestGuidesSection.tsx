import { latestGuides as fallbackLatestGuides } from '@/mocks/homeData';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const categoryColors: Record<string, string> = {
  'Food': 'bg-accent-100 text-accent-800',
  'Transport': 'bg-secondary-100 text-secondary-800',
  'Activities': 'bg-primary-100 text-primary-800',
  'Hidden Gems': 'bg-accent-50 text-accent-700',
};

interface Guide {
  id: string;
  title: string;
  category: string;
  description: string;
  image: string;
  href?: string;
}

export default function LatestGuidesSection() {
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const res = await fetch('/api/content?type=latestGuides');
        if (!res.ok) throw new Error('Failed to fetch');
        const json = await res.json();
        if (!cancelled && Array.isArray(json.data)) {
          setGuides(json.data);
        }
      } catch {
        if (!cancelled) {
          setGuides(fallbackLatestGuides);
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
    <section className="py-16 md:py-24 px-6 md:px-10 lg:px-20 bg-background-100">
      <div className="max-w-7xl mx-auto">
        <div className="mb-12">
          <span className="inline-block text-xs font-semibold tracking-widest uppercase text-accent-600 mb-3">
            Travel Knowledge
          </span>
          <h2 className="font-heading font-bold text-3xl md:text-5xl text-foreground-900 leading-tight">
            Latest <span className="text-primary-500">Guides</span>
          </h2>
          <p className="text-foreground-500 text-base mt-3 max-w-xl">
            Fresh insights, honest reviews, and practical tips written by locals and frequent visitors
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
          {loading ? (
            <>
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="flex flex-col sm:flex-row bg-background-50 rounded-xl overflow-hidden"
                >
                  <div className="w-full sm:w-48 md:w-56 h-48 sm:h-auto flex-shrink-0 bg-background-200 animate-pulse"></div>
                  <div className="p-5 flex flex-col justify-between flex-1 space-y-3">
                    <div className="h-4 w-16 bg-background-200 rounded-full animate-pulse"></div>
                    <div className="h-5 w-3/4 bg-background-200 rounded animate-pulse"></div>
                    <div className="h-3 w-full bg-background-200 rounded animate-pulse"></div>
                    <div className="h-3 w-5/6 bg-background-200 rounded animate-pulse"></div>
                    <div className="h-4 w-24 bg-background-200 rounded animate-pulse"></div>
                  </div>
                </div>
              ))}
            </>
          ) : (
            guides.map((guide) => (
              <Link
                key={guide.id}
                to={guide.href || `/${guide.category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}/${guide.id}`}
                className="group flex flex-col sm:flex-row bg-background-50 rounded-xl overflow-hidden transition-all duration-300 hover:-translate-y-0.5 cursor-pointer"
                data-product-shop
              >
                <div className="relative w-full sm:w-48 md:w-56 h-48 sm:h-auto flex-shrink-0 overflow-hidden">
                  <img
                    src={guide.image}
                    alt={guide.title}
                    title={`${guide.title} — TABI`}
                    className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="p-5 flex flex-col justify-between flex-1">
                  <div>
                    <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full mb-2 whitespace-nowrap ${categoryColors[guide.category] || 'bg-background-200 text-foreground-600'}`}>
                      {guide.category}
                    </span>
                    <h3 className="font-heading font-bold text-base md:text-lg text-foreground-900 mb-2 leading-snug line-clamp-2">
                      {guide.title}
                    </h3>
                    <p className="text-foreground-600 text-sm leading-relaxed line-clamp-2">
                      {guide.description}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-primary-500 font-semibold text-sm mt-3 hover:gap-2 transition-all duration-200 cursor-pointer whitespace-nowrap">
                    Read Full Guide
                    <i className="ri-arrow-right-line"></i>
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>

        <div className="text-center mt-10">
          <Link
            to="/guides"
            className="inline-flex items-center gap-2 bg-foreground-900 hover:bg-foreground-800 text-white font-semibold text-sm px-8 py-3.5 rounded-md transition-all duration-200 cursor-pointer whitespace-nowrap"
          >
            View All Guides
            <i className="ri-arrow-right-line"></i>
          </Link>
        </div>
      </div>
    </section>
  );
}