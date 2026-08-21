import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '@/components/feature/Navbar';
import Footer from '@/components/feature/Footer';

const categoryColors: Record<string, string> = {
  Food: 'bg-accent-100 text-accent-800',
  Transport: 'bg-secondary-100 text-secondary-800',
  Activities: 'bg-primary-100 text-primary-800',
  'Hidden Gems': 'bg-accent-50 text-accent-700',
};

interface Article {
  id: string;
  category: string;
  articleSlug: string;
  title: string;
  subtitle?: string;
  heroImage?: string;
  dateISO?: string;
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default function GuidesPage() {
  const [guides, setGuides] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const res = await fetch('/api/content?type=articles');
        if (!res.ok) throw new Error('Failed to fetch');
        const json = await res.json();
        if (!cancelled && Array.isArray(json.data)) {
          const sorted = [...json.data].sort((a, b) =>
            (b.dateISO || '').localeCompare(a.dateISO || '')
          );
          setGuides(sorted);
        }
      } catch {
        if (!cancelled) {
          setGuides([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    fetchData();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen bg-background-50">
      <Navbar />

      {/* Hero */}
      <section className="bg-background-900 pt-24 md:pt-32 pb-16 md:pb-20">
        <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-20 text-center">
          <nav
            className="flex items-center justify-center gap-2 text-white/50 text-xs mb-6 flex-wrap"
            aria-label="Breadcrumb"
          >
            <Link to="/" className="hover:text-white/80 transition-colors whitespace-nowrap">
              Home
            </Link>
            <span className="text-white/30">/</span>
            <span className="text-white whitespace-nowrap">Guides</span>
          </nav>

          <span className="inline-block text-xs font-semibold tracking-widest uppercase text-accent-400 mb-3">
            Travel Knowledge
          </span>
          <h1 className="font-heading font-bold text-3xl md:text-5xl text-white leading-tight mb-4">
            All Travel <span className="text-primary-400">Guides</span>
          </h1>
          <p className="text-white/60 text-base max-w-xl mx-auto leading-relaxed">
            Fresh insights, honest reviews, and practical tips written by locals and frequent
            visitors — everything you need to explore Japan like an insider.
          </p>
        </div>
      </section>

      {/* Guide grid */}
      <section className="py-12 md:py-16 px-6 md:px-10 lg:px-20">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="flex flex-col bg-background-50 rounded-xl overflow-hidden border border-background-200"
                >
                  <div className="w-full h-48 bg-background-200 animate-pulse"></div>
                  <div className="p-5 space-y-3">
                    <div className="h-4 w-16 bg-background-200 rounded-full animate-pulse"></div>
                    <div className="h-5 w-3/4 bg-background-200 rounded animate-pulse"></div>
                    <div className="h-3 w-full bg-background-200 rounded animate-pulse"></div>
                    <div className="h-3 w-5/6 bg-background-200 rounded animate-pulse"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : guides.length === 0 ? (
            <div className="text-center py-20">
              <span className="w-16 h-16 rounded-full bg-background-100 flex items-center justify-center mx-auto mb-6">
                <i className="ri-book-open-line text-3xl text-foreground-400"></i>
              </span>
              <h2 className="font-heading font-bold text-xl md:text-2xl text-foreground-900 mb-2">
                No guides yet
              </h2>
              <p className="text-foreground-500 text-sm mb-6">
                New travel guides are on the way — check back soon.
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {guides.map((guide) => {
                const href = `/${slugify(guide.category)}/${slugify(guide.articleSlug || guide.id)}`;
                return (
                  <Link
                    key={guide.id}
                    to={href}
                    className="group flex flex-col bg-background-50 rounded-xl overflow-hidden border border-background-200 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
                  >
                    <div className="relative w-full h-48 flex-shrink-0 overflow-hidden">
                      <img
                        src={guide.heroImage || ''}
                        alt={guide.title}
                        title={`${guide.title} — TABI`}
                        className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>
                    <div className="p-5 flex flex-col flex-1">
                      <span
                        className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full mb-3 whitespace-nowrap ${
                          categoryColors[guide.category] || 'bg-background-200 text-foreground-600'
                        }`}
                      >
                        {guide.category}
                      </span>
                      <h2 className="font-heading font-bold text-base md:text-lg text-foreground-900 mb-2 leading-snug line-clamp-2">
                        {guide.title}
                      </h2>
                      <p className="text-foreground-600 text-sm leading-relaxed line-clamp-3 mb-4">
                        {guide.subtitle || ''}
                      </p>
                      <span className="mt-auto inline-flex items-center gap-1 text-primary-500 font-semibold text-sm hover:gap-2 transition-all duration-200 whitespace-nowrap">
                        Read Full Guide
                        <i className="ri-arrow-right-line"></i>
                      </span>
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
