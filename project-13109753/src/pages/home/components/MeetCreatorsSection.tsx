import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

interface Guide {
  id: string;
  uid?: string;
  authorName?: string;
  authorExpertiseArea?: string;
}

interface Creator {
  uid: string;
  authorName: string;
  authorExpertiseArea?: string;
  guideCount: number;
}

export default function MeetCreatorsSection() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const res = await fetch('/api/guides');
        if (!res.ok) throw new Error('Failed to fetch');
        const json = await res.json();
        if (!cancelled && Array.isArray(json.guides)) {
          const guides = json.guides as Guide[];
          const map = new Map<string, Creator>();
          guides.forEach((g) => {
            const name = g.authorName || 'Anonymous';
            const key = g.uid || name;
            if (!map.has(key)) {
              map.set(key, {
                uid: g.uid || '',
                authorName: name,
                authorExpertiseArea: g.authorExpertiseArea,
                guideCount: 0,
              });
            }
            const existing = map.get(key);
            if (existing) {
              existing.guideCount += 1;
            }
          });
          setCreators(Array.from(map.values()).slice(0, 6));
        }
      } catch {
        if (!cancelled) {
          setCreators([]);
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
            The People Behind
          </span>
          <h2 className="font-heading font-bold text-3xl md:text-5xl text-foreground-900 leading-tight">
            Meet Japanese <span className="text-primary-500">Creators</span>
          </h2>
          <p className="text-foreground-500 text-base mt-3 max-w-xl">
            Real creators sharing their knowledge of Japan with the world.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-background-50 rounded-xl p-6 flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-background-200 animate-pulse flex-shrink-0"></div>
                <div className="flex-1 space-y-3">
                  <div className="h-4 w-2/3 bg-background-200 rounded animate-pulse"></div>
                  <div className="h-3 w-1/2 bg-background-200 rounded animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>
        ) : creators.length === 0 ? (
          <div className="text-center py-16 bg-background-50 rounded-xl">
            <span className="w-16 h-16 rounded-full bg-background-100 flex items-center justify-center mx-auto mb-6">
              <i className="ri-team-line text-3xl text-foreground-400"></i>
            </span>
            <p className="text-foreground-700 text-base mb-6">まだクリエイターがいません</p>
            <Link
              to="/share"
              className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm px-8 py-3.5 rounded-md transition-all duration-200 cursor-pointer whitespace-nowrap"
            >
              <i className="ri-add-line"></i>
              Become a Creator
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {creators.map((creator) => (
              <Link
                key={creator.uid || creator.authorName}
                to={`/creator/${creator.uid}`}
                className="group flex items-center gap-4 bg-background-50 rounded-xl p-6 transition-all duration-300 hover:-translate-y-1 cursor-pointer"
              >
                <span className="w-14 h-14 rounded-full bg-primary-500 text-white flex items-center justify-center text-xl font-heading font-bold flex-shrink-0">
                  {creator.authorName.charAt(0).toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-heading font-bold text-base text-foreground-900 leading-snug truncate">
                    {creator.authorName}
                  </h3>
                  {creator.authorExpertiseArea && (
                    <p className="text-foreground-500 text-sm truncate mt-0.5">
                      {creator.authorExpertiseArea}
                    </p>
                  )}
                  <span className="inline-flex items-center gap-1 text-accent-600 text-xs font-semibold mt-2 whitespace-nowrap">
                    <i className="ri-book-open-line"></i>
                    {creator.guideCount} guide{creator.guideCount === 1 ? '' : 's'}
                  </span>
                </div>
                <i className="ri-arrow-right-s-line text-foreground-300 group-hover:text-primary-500 group-hover:translate-x-1 transition-all duration-200 text-xl flex-shrink-0"></i>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}