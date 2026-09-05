import { useBatchTranslation, getBatchField } from '@/hooks/useBatchTranslation';
import LocalizedLink from '@/components/feature/LocalizedLink';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Navbar from '@/components/feature/Navbar';
import Footer from '@/components/feature/Footer';
import { destinations as fallbackDestinations } from '@/mocks/homeData';
import { PREFECTURE_REGIONS } from '@/mocks/prefectureData';
import type { Guide } from '@/pages/guides/page';

interface Destination {
  id: string;
  title: string;
  category: string;
  prefecture?: string;
  description: string;
  image: string;
}

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
        <i className={`${placeholder.icon} text-4xl text-foreground-400`}></i>
      </div>
    );
  }

  return (
    <img
      src={dest.image}
      alt={`${dest.title} — ${dest.category}`}
      onError={() => setFailed(true)}
      className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
    />
  );
}

export default function PrefecturePage() {
  const { t } = useTranslation();
  const { name } = useParams<{ name: string }>();
  const [destinations, setDestinations] = useState<Destination[]>(fallbackDestinations);
  const [guides, setGuides] = useState<Guide[]>([]);

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
        // フォールバック（homeData.tsの静的データ）のまま
      }
    }
    fetchData();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function fetchGuides() {
      try {
        const res = await fetch('/api/guides');
        if (!res.ok) throw new Error('Failed to fetch');
        const json = await res.json();
        if (!cancelled && Array.isArray(json.guides)) {
          setGuides(json.guides);
        }
      } catch {
        // 取得失敗時はセクション非表示のまま
      }
    }
    fetchGuides();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [name]);

  const region = PREFECTURE_REGIONS.find((r) => r.prefectures.includes(name || ''));
  const prefDestinations = destinations.filter((d) => d.prefecture === name);

  // Spotコンテンツのバッチ翻訳
  const spotIds = prefDestinations.map((d) => d.id);
  const { translations: spotTrans } = useBatchTranslation('spot', spotIds, 'en');
  const tb = (id: string, field: string, original: string) =>
    getBatchField(spotTrans, id, field, original);
  const prefGuides = guides.filter((g) => g.spots.some((s) => s.prefecture === name));

  const handleAskAboutPrefecture = () => {
    window.dispatchEvent(
      new CustomEvent('tabi:ask-question', {
        detail: {
          question: `What should I see and do in ${name}, Japan?`,
        },
      })
    );
  };

  if (!name) {
    return (
      <main className="min-h-screen bg-background-50 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center px-6 py-32">
          <div className="text-center">
            <i className="ri-error-warning-line text-5xl text-foreground-300 block mb-4"></i>
            <h1 className="text-2xl font-bold text-foreground-900 font-heading mb-2">
              {t("pref_notFound", "Prefecture not found")}
            </h1>
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-arrow-left-line"></i>
              {t("common_backToHome", "Back to Home")}
            </Link>
          </div>
        </div>
        <Footer />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background-50">
      <Navbar />

      <section className="pt-24 md:pt-28 pb-16 md:pb-20 px-6 md:px-10 lg:px-20">
        <div className="max-w-5xl mx-auto">
          <nav
            className="flex items-center gap-2 text-foreground-400 text-xs mb-6 flex-wrap"
            aria-label="Breadcrumb"
          >
            <Link to="/" className="hover:text-foreground-700 transition-colors whitespace-nowrap">
              {t("common_home", "Home")}
            </Link>
            <span className="text-foreground-300">/</span>
            {region && (
              <>
                <LocalizedLink
                  to={`/regions/${region.slug}`}
                  className="hover:text-foreground-700 transition-colors whitespace-nowrap"
                >
                  {region.region}
                </LocalizedLink>
                <span className="text-foreground-300">/</span>
              </>
            )}
            <span className="text-foreground-900 whitespace-nowrap">{name}</span>
          </nav>

          <h1 className="font-heading font-bold text-3xl md:text-5xl text-foreground-900 leading-tight mb-3">
            {name}
          </h1>
          <p className="text-foreground-600 text-base max-w-2xl mb-10">
            {prefDestinations.length > 0
              ? `${t('pref_popularIn', 'Popular destinations and experiences in')} ${name}.`
              : `We're still building out destinations for ${name}.`}
          </p>

          {prefDestinations.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {prefDestinations.map((dest) => (
                <article
                  key={dest.id}
                  className="group bg-background-50 border border-background-200 rounded-xl overflow-hidden transition-all duration-300 hover:-translate-y-1"
                >
                  <div className="relative w-full h-44 overflow-hidden">
                    <DestinationImage dest={dest} />
                    <span className="absolute top-3 left-3 bg-background-50/90 text-foreground-800 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap">
                      {dest.category}
                    </span>
                  </div>
                  <div className="p-4">
                    <h3 className="font-heading font-bold text-base text-foreground-900 mb-1.5">
                      {tb(dest.id, "title", dest.title)}
                    </h3>
                    <p className="text-foreground-600 text-sm leading-relaxed mb-3 line-clamp-2">
                      {tb(dest.id, "description", dest.description)}
                    </p>
                    <LocalizedLink
                      to={`/destinations/${dest.id}`}
                      className="inline-flex items-center gap-1 text-primary-500 font-semibold text-sm hover:gap-2 transition-all duration-200 cursor-pointer whitespace-nowrap"
                    >
                      {t("pref_discoverMore", "Discover More")}
                      <i className="ri-arrow-right-line"></i>
                    </LocalizedLink>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="bg-background-50 border border-background-200 rounded-xl p-10 text-center">
              <i className="ri-map-pin-line text-3xl text-foreground-300 block mb-3"></i>
              <p className="text-foreground-600 text-sm mb-4 max-w-sm mx-auto">
                We don't have destinations posted for {name} yet, but TABI AI can still help you
                plan a trip there.
              </p>
              <button
                type="button"
                onClick={handleAskAboutPrefecture}
                className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm px-5 py-2.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-chat-3-line"></i>
                Ask TABI about {name}
              </button>
            </div>
          )}

          {prefGuides.length > 0 && (
            <div className="mt-12">
              <h2 className="font-heading font-bold text-xl md:text-2xl text-foreground-900 mb-6">
                Local Guides for {name}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {prefGuides.map((guide) => (
                  <Link
                    key={guide.id}
                    to={`/guides/${guide.id}`}
                    className="group flex flex-col bg-background-50 border border-background-200 rounded-xl overflow-hidden hover:-translate-y-1 transition-all duration-300 cursor-pointer p-5"
                  >
                    <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full bg-accent-100 text-accent-800 whitespace-nowrap mb-3 self-start">
                      {guide.theme}
                    </span>
                    <h3 className="font-heading font-bold text-base text-foreground-900 mb-2 leading-snug">
                      {guide.titleEn || guide.title}
                    </h3>
                    <p className="text-foreground-600 text-sm leading-relaxed line-clamp-2 mb-3">
                      {guide.bodyEn || guide.bodyJa}
                    </p>
                    <span className="mt-auto text-foreground-400 text-xs whitespace-nowrap">
                      By {guide.authorName}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
}
