import LocalizedLink from '@/components/feature/LocalizedLink';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useLocalizedNavigate } from '@/hooks/useLocalizedNavigate';
import Navbar from '@/components/feature/Navbar';
import Footer from '@/components/feature/Footer';
import { useSpotsPage } from '@/hooks/useSpotsPage';
import { PREFECTURE_REGIONS, getRegionBySlug } from '@/mocks/prefectureData';
import { useAutoT, useAutoText } from '@/hooks/useAutoT';

/**
 * 地方ページの都道府県カード1つ分。
 *
 * 【なぜ別コンポーネントにしたか】
 * 以前はページ全体でuseSpots()（全公開Spot）を1回取得し、
 * .map() の中でJS側filterしていた。公開Spotが数万件規模になると
 * 全件取得が成り立たないため、都道府県ごとに
 * 「サンプル1件＋総件数」だけをAPIから取る方式に変える必要がある。
 * フックは.map()のコールバック内では呼べない（Rules of Hooks）ため、
 * カード自体を独立したコンポーネントにしている。
 */
function PrefectureCard({
  pref,
  t,
}: {
  pref: string;
  t: (key: string, fallback: string) => string;
}) {
  // 画像サンプル1件と総件数だけあればよいため pageSize は最小限にする
  const { spots, total, loading } = useSpotsPage({ prefecture: pref, pageSize: 1 });
  const hasContent = !loading && total > 0;
  const sample = spots[0];

  return (
    <LocalizedLink
      to={`/prefectures/${encodeURIComponent(pref)}`}
      className="bg-background-50 border border-background-200 rounded-xl overflow-hidden flex flex-col hover:border-background-300 transition-colors cursor-pointer"
    >
      {hasContent && sample ? (
        <div className="relative w-full h-36 overflow-hidden">
          <img
            src={sample.image}
            alt={pref}
            className="w-full h-full object-cover object-top"
          />
        </div>
      ) : (
        <div className="w-full h-36 bg-background-100 flex items-center justify-center">
          <i className="ri-map-pin-line text-3xl text-foreground-300"></i>
        </div>
      )}

      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-heading font-bold text-base text-foreground-900 mb-1.5">{pref}</h3>
        {hasContent ? (
          <p className="text-foreground-500 text-xs">
            {total}{' '}
            {total === 1 ? t('region_destination', 'destination') : t('region_destinations', 'destinations')}{' '}
            {t('region_onTabi', 'on TABI')}
          </p>
        ) : (
          <p className="text-foreground-400 text-xs">
            {loading ? '' : t('region_noDestinations', 'No destinations posted yet')}
          </p>
        )}
        <span className="mt-auto pt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary-500 whitespace-nowrap">
          {t('region_explore', 'Explore')} {pref}
          <i className="ri-arrow-right-s-line"></i>
        </span>
      </div>
    </LocalizedLink>
  );
}

export default function RegionPage() {
  const tx = useAutoText();
  const t = useAutoT();
  const { slug } = useParams<{ slug: string }>();
  const navigate = useLocalizedNavigate();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [slug]);

  const region = slug ? getRegionBySlug(slug) : undefined;

  // 地域コンテンツの多言語翻訳
  const regionIndex = region ? PREFECTURE_REGIONS.findIndex((r) => r.slug === region.slug) : -1;
  const prevRegion =
    regionIndex >= 0
      ? PREFECTURE_REGIONS[(regionIndex - 1 + PREFECTURE_REGIONS.length) % PREFECTURE_REGIONS.length]
      : undefined;
  const nextRegion =
    regionIndex >= 0 ? PREFECTURE_REGIONS[(regionIndex + 1) % PREFECTURE_REGIONS.length] : undefined;

  if (!region) {
    return (
      <main className="min-h-screen bg-background-50 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center px-6 py-32">
          <div className="text-center">
            <i className="ri-error-warning-line text-5xl text-foreground-300 block mb-4"></i>
            <h1 className="text-2xl font-bold text-foreground-900 font-heading mb-2">{t('region_notFound', 'Region not found')}</h1>
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
            aria-label={t('auto_c766e66518', "Breadcrumb")}
          >
            <Link to="/" className="hover:text-foreground-700 transition-colors whitespace-nowrap">
              {t("common_home", "Home")}
            </Link>
            <span className="text-foreground-300">/</span>
            <span className="text-foreground-700 whitespace-nowrap">{t('region_title', 'Regions')}</span>
            <span className="text-foreground-300">/</span>
            <span className="text-foreground-900 whitespace-nowrap">{tx(region.region)}</span>
          </nav>

          <div className="flex items-center justify-between gap-4 mb-3">
            <button
              type="button"
              onClick={() => prevRegion && navigate(`/regions/${prevRegion.slug}`)}
              className="flex items-center gap-1 text-foreground-500 hover:text-foreground-900 text-sm transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-arrow-left-s-line text-lg"></i>
              {prevRegion?.region}
            </button>
            <button
              type="button"
              onClick={() => nextRegion && navigate(`/regions/${nextRegion.slug}`)}
              className="flex items-center gap-1 text-foreground-500 hover:text-foreground-900 text-sm transition-colors cursor-pointer whitespace-nowrap"
            >
              {nextRegion?.region}
              <i className="ri-arrow-right-s-line text-lg"></i>
            </button>
          </div>

          <h1 className="font-heading font-bold text-3xl md:text-5xl text-foreground-900 leading-tight mb-3">
            {tx(region.region)}
          </h1>
          <p className="text-foreground-600 text-base max-w-2xl mb-10">{tx(region.description)}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {region.prefectures.map((pref) => (
              <PrefectureCard key={pref} pref={pref} t={t} />
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
