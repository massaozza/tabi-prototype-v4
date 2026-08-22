import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '@/components/feature/Navbar';
import Footer from '@/components/feature/Footer';
import { formatArea, type Experience } from './types';

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

export default function ExperiencesPage() {
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const res = await fetch('/api/experiences');
        if (!res.ok) throw new Error('Failed to fetch');
        const json = await res.json();
        const list = Array.isArray(json) ? json : json.experiences;
        if (!cancelled && Array.isArray(list)) {
          const sorted = [...list].sort((a, b) =>
            (b.createdAt || '').localeCompare(a.createdAt || '')
          );
          setExperiences(sorted);
        }
      } catch {
        if (!cancelled) setExperiences([]);
      } finally {
        if (!cancelled) setLoading(false);
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
            <span className="text-white whitespace-nowrap">Experiences</span>
          </nav>

          <span className="inline-block text-xs font-semibold tracking-widest uppercase text-accent-400 mb-3">
            Traveler Stories
          </span>
          <h1 className="font-heading font-bold text-3xl md:text-5xl text-white leading-tight mb-4">
            Real Experiences from <span className="text-primary-400">Real Travelers</span>
          </h1>
          <p className="text-white/60 text-base max-w-xl mx-auto leading-relaxed">
            Unfiltered stories from people who have actually been there — the good moments, the
            tough ones, and the little tips that make a trip better.
          </p>

          <Link
            to="/experiences/new"
            className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm px-6 py-3 rounded-lg transition-colors mt-8 whitespace-nowrap"
          >
            <i className="ri-add-line"></i>
            Share Your Experience
          </Link>
        </div>
      </section>

      {/* Experiences grid */}
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
          ) : experiences.length === 0 ? (
            <div className="text-center py-20">
              <span className="w-16 h-16 rounded-full bg-background-100 flex items-center justify-center mx-auto mb-6">
                <i className="ri-emotion-line text-3xl text-foreground-400"></i>
              </span>
              <h2 className="font-heading font-bold text-xl md:text-2xl text-foreground-900 mb-2">
                No experiences yet
              </h2>
              <p className="text-foreground-500 text-sm mb-6">
                Be the first to share your story with fellow travelers.
              </p>
              <Link
                to="/experiences/new"
                className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm px-6 py-3 rounded-lg transition-colors whitespace-nowrap"
              >
                <i className="ri-add-line"></i>
                Share Your Experience
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {experiences.map((exp) => (
                <Link
                  key={exp.id}
                  to={`/experiences/${exp.id}`}
                  className="group flex flex-col bg-background-50 rounded-xl overflow-hidden border border-background-200 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
                >
                  <div className="relative w-full h-48 flex-shrink-0 overflow-hidden bg-background-100">
                    {exp.photos && exp.photos.length > 0 ? (
                      <img
                        src={exp.photos[0]}
                        alt={exp.placeName}
                        title={`${exp.placeName} — TABI`}
                        className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-foreground-300">
                        <i className="ri-image-line text-5xl"></i>
                      </div>
                    )}
                  </div>

                  <div className="p-5 flex flex-col flex-1">
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <span
                        className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${
                          categoryColors[exp.category] || 'bg-background-200 text-foreground-600'
                        }`}
                      >
                        {exp.category}
                      </span>
                      {exp.wouldRecommend && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 whitespace-nowrap">
                          <i className="ri-checkbox-circle-fill"></i>
                          Recommended
                        </span>
                      )}
                    </div>

                    <h2 className="font-heading font-bold text-base md:text-lg text-foreground-900 mb-1 leading-snug line-clamp-2">
                      {exp.placeName}
                    </h2>
                    <div className="flex items-center gap-2 text-xs text-foreground-500 mb-3 flex-wrap">
                      <span className="inline-flex items-center gap-1 whitespace-nowrap">
                        <i className="ri-map-pin-line"></i>
                        {formatArea(exp.area)}
                      </span>
                      <span className="text-foreground-300">·</span>
                      <span className="inline-flex items-center gap-1 whitespace-nowrap">
                        <i className="ri-user-line"></i>
                        {exp.travelStyle}
                      </span>
                    </div>

                    <p className="text-foreground-600 text-sm leading-relaxed line-clamp-2 mb-4">
                      {exp.whatWasGood}
                    </p>

                    <span className="mt-auto text-foreground-400 text-xs whitespace-nowrap">
                      — {exp.authorName}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
}
