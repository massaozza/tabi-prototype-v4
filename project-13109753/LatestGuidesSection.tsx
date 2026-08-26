import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

interface Guide {
  id: string;
  title?: string;
  titleEn?: string;
  area?: string;
  areaEn?: string;
  theme?: string;
  authorName?: string;
  authorExpertiseArea?: string;
  bodyEn?: string;
  bodyJa?: string;
  photos?: string[];
}

export default function LatestGuidesSection() {
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const res = await fetch('/api/guides');
        if (!res.ok) throw new Error('Failed to fetch');
        const json = await res.json();
        if (!cancelled && Array.isArray(json.guides)) {
          setGuides(json.guides.slice(0, 4));
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
    <section className="py-16 md:py-24 px-6 md:px-10 lg:px-20 bg-background-100">
      <div className="max-w-7xl mx-auto">
        <div className="mb-12">
          <span className="inline-block text-xs font-semibold tracking-widest uppercase text-accent-600 mb-3">
            Local Voices
          </span>
          <h2 className="font-heading font-bold text-3xl md:text-5xl text-foreground-900 leading-tight">
            From Japanese <span className="text-primary-500">Locals</span>
          </h2>
          <p className="text-foreground-500 text-base mt-3 max-w-xl">
            Real local knowledge, written in Japanese by Japanese creators and delivered to the
            world by AI.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
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
          </div>
        ) : guides.length === 0 ? (
          <div className="text-center py-16 bg-background-50 rounded-xl">
            <span className="w-16 h-16 rounded-full bg-background-100 flex items-center justify-center mx-auto mb-6">
              <i className="ri-book-open-line text-3xl text-foreground-400"></i>
            </span>
            <p className="text-foreground-700 text-base mb-6">
              まだGuideがありません。最初の投稿者になりましょう
            </p>
            <Link
              to="/guides/new"
              className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm px-8 py-3.5 rounded-md transition-all duration-200 cursor-pointer whitespace-nowrap"
            >
              <i className="ri-add-line"></i>
              Share your Japan
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
            {guides.map((guide) => {
              const title = guide.titleEn || guide.title || 'Untitled Guide';
              const area = guide.areaEn || guide.area || '';
              const snippet = guide.bodyEn || guide.bodyJa || '';
              return (
                <Link
                  key={guide.id}
                  to={`/guides/${guide.id}`}
                  className="group flex flex-col sm:flex-row bg-background-50 rounded-xl overflow-hidden transition-all duration-300 hover:-translate-y-0.5 cursor-pointer"
                >
                  <div className="relative w-full sm:w-48 md:w-56 h-48 sm:h-auto flex-shrink-0 overflow-hidden bg-background-200">
                    {guide.photos && guide.photos.length > 0 ? (
                      <img
                        src={guide.photos[0]}
                        alt={title}
                        title={`${title} — TABI`}
                        className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-foreground-300">
                        <i className="ri-image-line text-4xl"></i>
                      </div>
                    )}
                  </div>
                  <div className="p-5 flex flex-col justify-between flex-1">
                    <div>
                      {area && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full mb-2 bg-background-100 text-foreground-600 whitespace-nowrap">
                          <i className="ri-map-pin-line"></i>
                          {area}
                        </span>
                      )}
                      <h3 className="font-heading font-bold text-base md:text-lg text-foreground-900 mb-2 leading-snug line-clamp-2">
                        {title}
                      </h3>
                      <p className="text-foreground-600 text-sm leading-relaxed line-clamp-2">
                        {snippet}
                      </p>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-foreground-400 text-xs whitespace-nowrap">
                        — {guide.authorName || 'Anonymous'}
                      </span>
                      <span className="inline-flex items-center gap-1 text-primary-500 font-semibold text-sm hover:gap-2 transition-all duration-200 cursor-pointer whitespace-nowrap">
                        Read Guide
                        <i className="ri-arrow-right-line"></i>
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {guides.length > 0 && (
          <div className="text-center mt-10">
            <Link
              to="/guides"
              className="inline-flex items-center gap-2 bg-foreground-900 hover:bg-foreground-800 text-white font-semibold text-sm px-8 py-3.5 rounded-md transition-all duration-200 cursor-pointer whitespace-nowrap"
            >
              View All Guides
              <i className="ri-arrow-right-line"></i>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}