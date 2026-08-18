import { localsPlaces as fallbackLocalsPlaces } from '@/mocks/homeData';
import { useRef, useState, useEffect, useCallback } from 'react';

interface Place {
  id: string;
  title: string;
  story: string;
  image: string;
}

export default function LocalsRecommendSection() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener('scroll', checkScroll, { passive: true });
    return () => el.removeEventListener('scroll', checkScroll);
  }, [checkScroll]);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const res = await fetch('/api/content?type=localsPlaces');
        if (!res.ok) throw new Error('Failed to fetch');
        const json = await res.json();
        if (!cancelled && Array.isArray(json.data)) {
          setPlaces(json.data);
        }
      } catch {
        if (!cancelled) {
          setPlaces(fallbackLocalsPlaces);
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

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = 360;
    el.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  return (
    <section id="locals-places" className="py-16 md:py-24 px-6 md:px-10 lg:px-20 bg-background-100">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-10 gap-4">
          <div>
            <span className="inline-block text-xs font-semibold tracking-widest uppercase text-accent-600 mb-3">
              Local Favorites
            </span>
            <h2 className="font-heading font-bold text-3xl md:text-5xl text-foreground-900 leading-tight">
              Places Locals Would<br /> Take Their Friends
            </h2>
          </div>
          <p className="text-foreground-500 text-base md:max-w-xs">
            Discover recommendations inspired by the places people genuinely love.
          </p>
        </div>

        <div className="relative">
          <button
            onClick={() => scroll('left')}
            className={`absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 md:w-12 md:h-12 rounded-full bg-background-50 border border-background-200 flex items-center justify-center shadow-sm transition-all duration-200 cursor-pointer ${canScrollLeft ? 'opacity-100' : 'opacity-0 pointer-events-none'} -ml-3 md:-ml-5`}
            aria-label="Scroll left"
          >
            <i className="ri-arrow-left-s-line text-foreground-700 text-lg"></i>
          </button>

          <div
            ref={scrollRef}
            className="flex gap-5 overflow-x-auto scrollbar-hide scroll-smooth pb-4 -mx-6 md:-mx-10 lg:-mx-20 px-6 md:px-10 lg:px-20"
          >
            {loading ? (
              <>
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex-shrink-0 w-[300px] md:w-[360px] bg-background-50 rounded-xl overflow-hidden"
                  >
                    <div className="w-full h-56 md:h-64 bg-background-200 animate-pulse"></div>
                    <div className="p-5 md:p-6 space-y-3">
                      <div className="h-5 w-3/4 bg-background-200 rounded animate-pulse"></div>
                      <div className="h-3 w-full bg-background-200 rounded animate-pulse"></div>
                      <div className="h-3 w-5/6 bg-background-200 rounded animate-pulse"></div>
                      <div className="h-3 w-4/6 bg-background-200 rounded animate-pulse"></div>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              places.map((place) => (
                <article
                  key={place.id}
                  className="flex-shrink-0 w-[300px] md:w-[360px] bg-background-50 rounded-xl overflow-hidden transition-all duration-300 hover:-translate-y-1 cursor-pointer group"
                  data-product-shop
                >
                  <div className="relative w-full h-56 md:h-64 overflow-hidden">
                    <img
                      src={place.image}
                      alt={place.title}
                      title={`${place.title} — TABI local recommendation`}
                      className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-5 md:p-6">
                    <h3 className="font-heading font-bold text-lg text-foreground-900 mb-3">
                      {place.title}
                    </h3>
                    <p className="text-foreground-600 text-sm leading-relaxed line-clamp-4">
                      {place.story}
                    </p>
                  </div>
                </article>
              ))
            )}
          </div>

          <button
            onClick={() => scroll('right')}
            className={`absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 md:w-12 md:h-12 rounded-full bg-background-50 border border-background-200 flex items-center justify-center shadow-sm transition-all duration-200 cursor-pointer ${canScrollRight ? 'opacity-100' : 'opacity-0 pointer-events-none'} -mr-3 md:-mr-5`}
            aria-label="Scroll right"
          >
            <i className="ri-arrow-right-s-line text-foreground-700 text-lg"></i>
          </button>
        </div>
      </div>
    </section>
  );
}