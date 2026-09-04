import LocalizedLink from '@/components/feature/LocalizedLink';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

interface Experience {
  id: string;
  placeName: string;
  area?: string;
  category?: string;
  whatWasGood?: string;
  authorName?: string;
  photos?: string[];
  createdAt?: string;
}

export default function TravelerExperiencesSection() {
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const res = await fetch('/api/experiences');
        if (!res.ok) throw new Error('Failed to fetch');
        const json = await res.json();
        if (!cancelled && Array.isArray(json.experiences)) {
          const sorted = [...json.experiences]
            .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
            .slice(0, 6);
          setExperiences(sorted);
        }
      } catch {
        if (!cancelled) {
          setExperiences([]);
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

  if (!loading && experiences.length === 0) {
    return null;
  }

  return (
    <section className="py-16 md:py-24 px-6 md:px-10 lg:px-20 bg-background-50">
      <div className="max-w-7xl mx-auto">
        <div className="mb-12">
          <span className="inline-block text-xs font-semibold tracking-widest uppercase text-accent-600 mb-3">
            Traveler Stories
          </span>
          <h2 className="font-heading font-bold text-3xl md:text-5xl text-foreground-900 leading-tight">
            Latest Traveler <span className="text-primary-500">Experiences</span>
          </h2>
          <p className="text-foreground-500 text-base mt-3 max-w-xl">
            Unfiltered voices from travelers who have actually been there.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-background-100 rounded-xl overflow-hidden">
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
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {experiences.map((exp) => (
              <LocalizedLink
                key={exp.id}
                to={`/experiences/${exp.id}`}
                className="group flex flex-col bg-background-100 rounded-xl overflow-hidden transition-all duration-300 hover:-translate-y-1 cursor-pointer"
              >
                <div className="relative w-full h-48 flex-shrink-0 overflow-hidden bg-background-200">
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
                  {exp.category && (
                    <span className="absolute top-4 left-4 bg-background-50/90 text-foreground-800 text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap">
                      {exp.category}
                    </span>
                  )}
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <h3 className="font-heading font-bold text-base md:text-lg text-foreground-900 mb-2 leading-snug line-clamp-1">
                    {exp.placeName}
                  </h3>
                  <p className="text-foreground-600 text-sm leading-relaxed mb-4 line-clamp-3">
                    {exp.whatWasGood || ''}
                  </p>
                  <span className="mt-auto text-foreground-400 text-xs whitespace-nowrap">
                    — {exp.authorName || 'Anonymous'}
                  </span>
                </div>
              </LocalizedLink>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
