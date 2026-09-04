import { useBatchTranslation, getBatchField } from '@/hooks/useBatchTranslation';
import { useTranslation } from 'react-i18next';
import LocalizedLink from '@/components/feature/LocalizedLink';
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

const DISPLAY_LIMIT = 6;

// カテゴリごとに、画像が読み込めない場合の代替アイコン・背景色を決める
// （写真が用意できていない投稿でも、殺風景にならないようにするため）
const CATEGORY_PLACEHOLDER: Record<string, { icon: string; bg: string }> = {
  'Culture & History': { icon: 'ri-ancient-gate-line', bg: 'from-amber-100 to-amber-50' },
  'Nature & Scenery': { icon: 'ri-leaf-line', bg: 'from-emerald-100 to-emerald-50' },
  'Hot Springs & Nature': { icon: 'ri-drop-line', bg: 'from-orange-100 to-orange-50' },
  'City & Food Culture': { icon: 'ri-restaurant-line', bg: 'from-rose-100 to-rose-50' },
  'Skiing & Winter Sports': { icon: 'ri-snowy-line', bg: 'from-sky-100 to-sky-50' },
  'Festivals & Events': { icon: 'ri-lantern-line', bg: 'from-red-100 to-red-50' },
  'Theme Parks & Entertainment': { icon: 'ri-gamepad-line', bg: 'from-violet-100 to-violet-50' },
  'Pop Culture & Entertainment': { icon: 'ri-sparkling-2-line', bg: 'from-pink-100 to-pink-50' },
  'Shopping & Fashion': { icon: 'ri-shopping-bag-line', bg: 'from-fuchsia-100 to-fuchsia-50' },
  'Beach & Lifestyle': { icon: 'ri-sun-line', bg: 'from-cyan-100 to-cyan-50' },
  'Coastal Escape': { icon: 'ri-ship-line', bg: 'from-blue-100 to-blue-50' },
};

function getPlaceholder(category: string) {
  return CATEGORY_PLACEHOLDER[category] || { icon: 'ri-map-pin-line', bg: 'from-background-200 to-background-100' };
}

function DestinationImage({ dest }: { dest: Destination }) {
  const [failed, setFailed] = useState(false);
  const placeholder = getPlaceholder(dest.category);

  if (failed) {
    return (
      <div
        className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${placeholder.bg}`}
      >
        <i className={`${placeholder.icon} text-5xl text-foreground-400`}></i>
      </div>
    );
  }

  return (
    <img
      src={dest.image}
      alt={`${tb(dest.id, "title", dest.title)} — ${dest.category}`}
      title={`${tb(dest.id, "title", dest.title)} travel experience — TABI`}
      onError={() => setFailed(true)}
      className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
    />
  );
}

export default function DestinationsSection() {
  const { t } = useTranslation();
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const destIds = destinations.map((d) => d.id);
  const { translations: destTrans } = useBatchTranslation('spot', destIds, 'en');
  const tb = (id: string, field: string, original: string) =>
    getBatchField(destTrans, id, field, original);
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

  const displayedDestinations = destinations.slice(0, DISPLAY_LIMIT);

  return (
    <section id="destinations" className="py-16 md:py-24 px-6 md:px-10 lg:px-20 bg-background-50">
      <div className="max-w-7xl mx-auto">
        <div className="mb-12">
          <span className="inline-block text-xs font-semibold tracking-widest uppercase text-accent-600 mb-3">
            Destinations
          </span>
          <h2 className="font-heading font-bold text-3xl md:text-5xl text-foreground-900 leading-tight">
            {t("dest_trending", "Trending")} <span className="text-primary-500">{t("dest_spots", "Spots")}</span>
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
            displayedDestinations.map((dest) => (
              <article
                key={dest.id}
                className="group bg-background-100 rounded-xl overflow-hidden transition-all duration-300 hover:-translate-y-1 cursor-pointer"
                data-product-shop
              >
                <div className="relative w-full h-56 md:h-64 overflow-hidden">
                  <DestinationImage dest={dest} />
                  <span className="absolute top-4 left-4 bg-background-50/90 text-foreground-800 text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap">
                    {dest.category}
                  </span>
                </div>
                <div className="p-5 md:p-6">
                  <h3 className="font-heading font-bold text-xl text-foreground-900 mb-2">
                    {tb(dest.id, "title", dest.title)}
                  </h3>
                  <p className="text-foreground-600 text-sm leading-relaxed mb-4 line-clamp-3">
                    {tb(dest.id, "description", dest.description)}
                  </p>
                  <Link
                    to={`/destinations/${dest.id}`}
                    className="inline-flex items-center gap-1 text-primary-500 font-semibold text-sm hover:gap-2 transition-all duration-200 cursor-pointer whitespace-nowrap"
                  >
                    {t("dest_discoverMore", "Discover More")}
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
