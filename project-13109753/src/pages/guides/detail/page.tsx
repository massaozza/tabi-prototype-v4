import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Navbar from '@/components/feature/Navbar';
import Footer from '@/components/feature/Footer';
import type { Guide } from '../page';

export default function GuideDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [guide, setGuide] = useState<Guide | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const res = await fetch('/api/guides');
        if (!res.ok) throw new Error('Failed to fetch');
        const json = await res.json();
        if (!cancelled && Array.isArray(json.guides)) {
          const found = json.guides.find((g: Guide) => g.id === id) ?? null;
          setGuide(found);
          if (found) {
            // 閲覧数を記録する（失敗してもページ表示には影響させない）
            fetch('/api/track-view', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contentType: 'guide', id: found.id }),
            }).catch(() => {});
          }
        }
      } catch {
        if (!cancelled) setGuide(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [id]);

  const handleAskAboutGuide = () => {
    if (!guide) return;
    window.dispatchEvent(
      new CustomEvent('tabi:ask-question', {
        detail: {
          question: `Tell me more about ${guide.areaEn || guide.area} — I'm interested in ${guide.theme}.`,
        },
      })
    );
  };

  return (
    <main className="min-h-screen bg-background-50">
      <Navbar />

      <section className="pt-24 md:pt-28 pb-16 md:pb-20 px-6 md:px-10">
        <div className="max-w-4xl mx-auto">
          {loading ? (
            <div className="space-y-6">
              <div className="h-8 w-40 bg-background-200 rounded animate-pulse"></div>
              <div className="h-72 bg-background-200 rounded-xl animate-pulse"></div>
              <div className="h-6 w-3/4 bg-background-200 rounded animate-pulse"></div>
              <div className="h-4 w-full bg-background-200 rounded animate-pulse"></div>
            </div>
          ) : !guide ? (
            <div className="text-center py-20">
              <span className="w-16 h-16 rounded-full bg-background-100 flex items-center justify-center mx-auto mb-6">
                <i className="ri-error-warning-line text-3xl text-foreground-400"></i>
              </span>
              <h1 className="font-heading font-bold text-2xl text-foreground-900 mb-2">
                {t("guides_notFound", "Guide not found")}
              </h1>
              <p className="text-foreground-500 text-sm mb-6">
                {t('guides_notFoundDesc', 'The guide you are looking for may have been removed.')}
              </p>
              <Link
                to="/guides"
                className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm px-6 py-3 rounded-lg transition-colors whitespace-nowrap"
              >
                <i className="ri-arrow-left-line"></i>
                {t("guides_backToGuides", "Back to Guides")}
              </Link>
            </div>
          ) : (
            <article>
              {/* Gallery */}
              {guide.photos && guide.photos.length > 0 && (
                <div
                  className={`grid gap-3 mb-8 ${
                    guide.photos.length > 1 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'
                  }`}
                >
                  {guide.photos.map((url, idx) => (
                    <div
                      key={url}
                      className={`rounded-xl overflow-hidden border border-background-200 bg-background-100 ${
                        guide.photos.length === 1 ? 'h-72 md:h-96' : 'h-56 md:h-64'
                      }`}
                    >
                      <img
                        src={url}
                        alt={`${guide.title} photo ${idx + 1}`}
                        className="w-full h-full object-cover object-top"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Header */}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="inline-block text-xs font-semibold px-3 py-1 rounded-full bg-accent-100 text-accent-800 whitespace-nowrap">
                  {guide.theme}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full bg-background-100 text-foreground-700 whitespace-nowrap">
                  <i className="ri-map-pin-line"></i>
                  {guide.areaEn || guide.area}
                </span>
                {guide.season && (
                  <span className="inline-block text-xs font-semibold px-3 py-1 rounded-full bg-background-100 text-foreground-700 whitespace-nowrap">
                    {guide.season}
                  </span>
                )}
              </div>

              <h1 className="font-heading font-bold text-3xl md:text-4xl text-foreground-900 leading-tight mb-3">
                {guide.titleEn || guide.title}
              </h1>

              <p className="text-foreground-500 text-sm mb-8">
                By{' '}
                <Link
                  to={`/creator/${guide.uid}`}
                  className="text-foreground-800 font-medium hover:text-primary-600 transition-colors"
                >
                  {guide.authorName}
                </Link>
                {guide.authorExpertiseArea && (
                  <span className="text-foreground-400"> — {guide.authorExpertiseArea}</span>
                )}
                <span className="inline-flex items-center gap-1 ml-2 text-accent-600">
                  <i className="ri-translate-2 text-xs"></i>
                  {t("guides_translatedByAI", "Translated by TABI AI")}
                </span>
              </p>

              {/* Body */}
              <section className="mb-10">
                <p className="text-foreground-700 text-base leading-relaxed whitespace-pre-wrap">
                  {guide.bodyEn || guide.bodyJa}
                </p>
              </section>

              {/* Spots */}
              <section className="mb-10">
                <h4 className="font-heading font-semibold text-lg text-foreground-900 mb-4">
                  {t("guides_spotsInGuide", "Spots featured in this Guide")}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {guide.spots.map((spot, idx) => (
                    <div
                      key={idx}
                      className="bg-background-50 border border-background-200 rounded-lg p-4"
                    >
                      <h5 className="font-heading font-semibold text-sm text-foreground-900 mb-1.5">
                        {spot.spotId ? (
                          <Link
                            to={`/destinations/${spot.spotId}`}
                            className="hover:text-primary-600 transition-colors"
                          >
                            {spot.name}
                          </Link>
                        ) : (
                          spot.name
                        )}
                      </h5>
                      <p className="text-foreground-600 text-sm leading-relaxed mb-2">
                        {spot.commentEn || spot.commentJa}
                      </p>
                      {spot.localTip && (
                        <p className="text-xs text-accent-700 bg-accent-50 rounded px-2 py-1 mb-1.5 inline-block">
                          <i className="ri-lightbulb-line mr-1"></i>
                          {spot.localTip}
                        </p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-foreground-400">
                        {spot.bestTime && <span>Best time: {spot.bestTime}</span>}
                        {spot.priceHint && <span>{spot.priceHint}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <button
                type="button"
                onClick={handleAskAboutGuide}
                className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm px-5 py-2.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap mb-10"
              >
                <i className="ri-chat-3-line"></i>
                Ask TABI about {guide.areaEn || guide.area}
              </button>

              <div>
                <Link
                  to="/guides"
                  className="inline-flex items-center gap-2 text-primary-500 hover:text-primary-600 font-semibold text-sm transition-colors whitespace-nowrap"
                >
                  <i className="ri-arrow-left-line"></i>
                  {t("guides_backToGuides", "Back to Guides")}
                </Link>
              </div>
            </article>
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
}
