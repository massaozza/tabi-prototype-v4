import { useTranslation } from 'react-i18next';
import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Navbar from '@/components/feature/Navbar';
import Footer from '@/components/feature/Footer';
import { loadAllSpots } from '@/lib/spotSnapshot';
import { type Experience } from '@/pages/experiences/types';
import AddToTripButton from '@/components/feature/AddToTripButton';
import { useAutoT, useAutoText } from '@/hooks/useAutoT';

interface Destination {
  id: string;
  title: string;
  category: string;
  prefecture?: string;
  description: string;
  image: string;
  lat?: number;
  lng?: number;
  /** Wikimedia Commons由来の画像等、出典表示が必要な場合に入る */
  imageCredit?: {
    author?: string;
    license?: string;
    licenseUrl?: string;
    sourceUrl: string;
  };
}

interface Guide {
  id: string;
  title: string;
  titleEn?: string;
  theme?: string;
  bodyEn?: string;
  bodyJa?: string;
  authorName?: string;
}

interface RelatedTrip {
  id: string;
  title: string;
  summary?: string;
  tripType?: 'recommended' | 'actual';
  days: { day: number; activities: { spotId?: string }[] }[];
  saveCount?: number;
  copyCount?: number;
}

// レビュー数を「7.8K」のような短縮表示にする（1000未満はそのままの数字）
function formatReviewCount(count: number): string {
  if (count < 1000) return String(count);
  return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}K`;
}

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

// TABI 3.0：SPOT詳細ページのタブ構成（Mindtrip等の競合を参考に、
// Overview/Guides/Reviews/Location という一般的な構成に、TABI独自の
// コンテンツである「Trips（旅程）」タブを追加している）
type TabKey = 'overview' | 'guides' | 'reviews' | 'trips' | 'location';

// Google Maps を動的に読み込む小さなヘルパー（読み込み済みなら即解決）
let mapsLoading: Promise<void> | null = null;

function loadGoogleMaps(): Promise<void> {
  if (!mapsLoading) {
    mapsLoading = new Promise<void>((resolve, reject) => {
      const win = window as unknown as { google?: { maps?: unknown } };
      if (win.google?.maps) {
        resolve();
        return;
      }
      const key = import.meta.env.VITE_PUBLIC_GOOGLE_MAPS_KEY as string | undefined;
      const script = document.createElement('script');
      script.async = true;
      script.defer = true;
      script.src = `https://maps.googleapis.com/maps/api/js${key ? `?key=${key}` : ''}`;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Google Maps failed to load'));
      document.head.appendChild(script);
    });
  }
  return mapsLoading;
}

// Locationタブ用の小さな地図（このSpot1件だけをピン表示する）
function LocationMap({ lat, lng, title }: { lat: number; lng: number; title: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        const googleAny = (window as any).google;
        if (!googleAny?.maps) return;
        const map = new googleAny.maps.Map(containerRef.current, {
          zoom: 14,
          center: { lat, lng },
          disableDefaultUI: true,
          zoomControl: true,
        });
        new googleAny.maps.Marker({ position: { lat, lng }, map, title });
      })
      .catch(() => {
        // 地図の読み込みに失敗しても、他の情報は表示され続ける
      });
    return () => {
      cancelled = true;
    };
  }, [lat, lng, title]);

  return <div ref={containerRef} className="w-full h-72 md:h-96 rounded-xl overflow-hidden" />;
}

export default function DestinationPage() {
  const tx = useAutoText();
  const t = useAutoT();
  const { id } = useParams<{ id: string }>();
  const [destination, setDestination] = useState<Destination | null>(null);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [trips, setTrips] = useState<RelatedTrip[]>([]);
  const [similarSpots, setSimilarSpots] = useState<Destination[]>([]);
  const [rating, setRating] = useState<{ rating: number; userRatingCount?: number; googleMapsUri?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [heroImageFailed, setHeroImageFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    setDestination(null);
    setHeroImageFailed(false);
    setExperiences([]);
    setGuides([]);
    setTrips([]);
    setSimilarSpots([]);
    setRating(null);
    setActiveTab('overview');

    async function fetchData() {
      // 【重要】個別取得を先に試す。
      // /api/content?type=destinations（content:destinations）は
      // 公開Spotが DERIVED_CACHE_MAX（1500件）を超えると更新が止まる
      // 派生キャッシュのため、全件をこの配列から探す方式だと
      // それ以降に公開したSpotが永久に見つからなくなる。
      // /api/spots?id=xxx はKVから直接1件引くため件数に依存しない。
      let found: Destination | null = null;
      try {
        const soloRes = await fetch(`/api/spots?id=${encodeURIComponent(id || '')}`);
        if (soloRes.ok) {
          const soloJson = await soloRes.json();
          if (soloJson.spot) found = soloJson.spot as Destination;
        }
      } catch {
        // 下のフォールバックで処理する
      }

      // 全件キャッシュ。Similar Spotsの算出、および個別取得が失敗した
      // 場合のフォールバックに使う（1500件超では最新のSpotを含まない
      // ことがあるが、Similar Spotsは無くても致命的ではない）。
      let list: Destination[] = [];

      try {
        const res = await fetch('/api/content?type=destinations');
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.data)) {
            list = json.data;
          }
        }
      } catch {
        // 下のフォールバックで処理する
      }

      // KVが読めなかった場合は R2 の Last Known Good Snapshot に退避する。
      // 以前は mocks の367件を使っていたため、Admin編集やImportの結果が
      // 反映されない古いデータが表示されていた。
      if (list.length === 0) {
        list = (await loadAllSpots()) as Destination[];
      }

      if (cancelled) return;

      if (!found) {
        found = list.find((d) => d.id === id) || null;
      }
      if (found) {
        setDestination(found);
        fetch('/api/track-view', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contentType: 'spot', id: found.id }),
        }).catch(() => {});

        // Googleの評価・レビュー数を取得（キャッシュがあればそれを使う）
        fetch(`/api/spot-rating?id=${encodeURIComponent(found.id)}`)
          .then((r) => r.json())
          .then((data) => {
            if (!cancelled && typeof data.rating === 'number') {
              setRating(data);
            }
          })
          .catch(() => {});

        // Similar Spots：同じ都道府県を優先し、足りなければ同じカテゴリで補う
        const others = list.filter((d) => d.id !== found.id);
        const samePrefecture = found.prefecture
          ? others.filter((d) => d.prefecture === found.prefecture)
          : [];
        const sameCategory = others.filter(
          (d) => d.category === found.category && !samePrefecture.includes(d)
        );
        const combined = [...samePrefecture, ...sameCategory].slice(0, 4);
        setSimilarSpots(combined);

        // 関連するExperienceを取得（spotId で正しく絞り込む）
        try {
          const expRes = await fetch(`/api/experiences?spotId=${encodeURIComponent(found.id)}`);
          if (expRes.ok) {
            const json = await expRes.json();
            const all = Array.isArray(json) ? json : json.experiences;
            if (!cancelled && Array.isArray(all)) {
              const sorted = [...all]
                .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
                .slice(0, 6);
              setExperiences(sorted);
            }
          }
        } catch {
          // Experience取得失敗時はセクション非表示のまま
        }

        // このSpotを紹介しているGuideを取得
        try {
          const guideRes = await fetch(`/api/guides?spotId=${encodeURIComponent(found.id)}`);
          if (guideRes.ok) {
            const json = await guideRes.json();
            if (!cancelled && Array.isArray(json.guides)) {
              setGuides(json.guides.slice(0, 4));
            }
          }
        } catch {
          // Guide取得失敗時はセクション非表示のまま
        }

        // このSpotを含む公開Tripを取得（クライアント側でspotIdに一致するものを絞り込む）
        try {
          const tripRes = await fetch('/api/trips?public=1');
          if (tripRes.ok) {
            const json = await tripRes.json();
            if (!cancelled && Array.isArray(json.trips)) {
              // /api/trips?public=1 は既にスコア順（Copy数・Save数・閲覧数・
              // 新しさを加味）で返ってくるため、ここでは絞り込みのみ行う
              const matching = json.trips
                .filter((_row) =>
                  _row.days.some((d) => d.activities.some((a) => a.spotId === found.id))
                )
                .slice(0, 4);
              setTrips(matching);
            }
          }
        } catch {
          // Trip取得失敗時はセクション非表示のまま
        }
      } else {
        setNotFound(true);
      }
      setLoading(false);
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleAskTabi = () => {
    if (!destination) return;
    window.dispatchEvent(
      new CustomEvent('tabi:ask-question', {
        detail: {
          question: `Tell me more about ${destination.title} — what should I know before visiting?`,
        },
      })
    );
  };

  const TABS: { key: TabKey; label: string; count?: number }[] = destination
    ? [
        { key: 'overview', label: t('dest_overview', 'Overview') },
        { key: 'guides', label: t('dest_guides', 'Guides'), count: guides.length },
        { key: 'reviews', label: t('dest_reviews', 'Reviews'), count: experiences.length },
        { key: 'trips', label: t('dest_trips', 'Trips'), count: trips.length },
        { key: 'location', label: t('dest_location', 'Location') },
      ]
    : [];

  return (
    <main className="min-h-screen bg-background-50">
      <Navbar />

      {loading ? (
        <div className="pt-36 pb-24 px-6 md:px-10 flex justify-center">
          <div className="w-full max-w-4xl space-y-6">
            <div className="h-6 w-40 bg-background-200 rounded-full animate-pulse"></div>
            <div className="h-12 w-3/4 bg-background-200 rounded animate-pulse"></div>
            <div className="w-full aspect-[16/9] bg-background-200 rounded-2xl animate-pulse"></div>
            <div className="h-4 w-full bg-background-200 rounded animate-pulse"></div>
            <div className="h-4 w-5/6 bg-background-200 rounded animate-pulse"></div>
          </div>
        </div>
      ) : notFound || !destination ? (
        <div className="pt-40 pb-24 px-6 flex flex-col items-center justify-center text-center">
          <span className="w-16 h-16 rounded-full bg-background-100 flex items-center justify-center mb-6">
            <i className="ri-map-pin-line text-3xl text-foreground-400"></i>
          </span>
          <h1 className="font-heading font-bold text-2xl md:text-4xl text-foreground-900 mb-3">
            {t('auto_62722f5302', "Destination not found")}
          </h1>
          <p className="text-foreground-500 text-base mb-8">
            {t("dest_notFoundDesc", "We could not find the destination you are looking for.")}
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm px-6 py-3 rounded-lg transition-colors whitespace-nowrap"
          >
            <i className="ri-arrow-left-line"></i>
            {t('auto_ce7472d6a6', "Back to Home")}
          </Link>
        </div>
      ) : (
        <>
          {/* Hero */}
          <section className="bg-background-50 pt-24 md:pt-28 pb-6 md:pb-8">
            <div className="max-w-[1140px] mx-auto px-6 md:px-10">
              <nav
                className="flex items-center gap-2 text-foreground-500 text-xs mb-6 flex-wrap"
                aria-label={t('auto_c766e66518', "Breadcrumb")}
              >
                <Link to="/" className="hover:text-foreground-800 transition-colors whitespace-nowrap">
                  {t('auto_70f8bb9a8a', "Home")}
                </Link>
                <span className="text-foreground-300">/</span>
                <Link
                  to="/#destinations"
                  className="hover:text-foreground-800 transition-colors whitespace-nowrap"
                >
                  {t('auto_0fc66bc436', "Destinations")}
                </Link>
                <span className="text-foreground-300">/</span>
                <span className="text-foreground-700 line-clamp-1">{tx(destination.title)}</span>
              </nav>

              <span
                className={`inline-block text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap mb-4 ${
                  categoryColors[destination.category] ||
                  'bg-background-200 text-foreground-600'
                }`}
              >
                {destination.category.toUpperCase()}
              </span>

              <h1 className="font-heading font-bold text-3xl md:text-5xl text-foreground-900 leading-tight mb-4 max-w-3xl">
                {tx(destination.title)}
              </h1>

              <div className="flex items-center gap-2 text-foreground-600 text-sm mb-6 flex-wrap">
                {rating && (
                  <a
                    href={rating.googleMapsUri || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 hover:text-foreground-900 transition-colors whitespace-nowrap"
                  >
                    <i className="ri-star-fill text-amber-500"></i>
                    <span className="font-semibold">{rating.rating.toFixed(1)}</span>
                    {rating.userRatingCount !== undefined && (
                      <span className="text-foreground-400">
                        · {formatReviewCount(rating.userRatingCount)}{' '}{t('auto_7b2c6e04fe', "reviews")}
                      </span>
                    )}
                  </a>
                )}
                {rating && destination.prefecture && <span className="text-foreground-300">·</span>}
                {destination.prefecture && (
                  <span className="whitespace-nowrap text-foreground-600">
                    {destination.prefecture}
                  </span>
                )}
              </div>
            </div>

            <div className="max-w-[1140px] mx-auto px-6 md:px-10">
              <div className="w-full aspect-[16/9] overflow-hidden rounded-2xl border border-background-200 bg-background-100">
                {destination.image && !heroImageFailed ? (
                  <img
                    src={destination.image}
                    alt={`${destination.title} — ${destination.category}`}
                    title={`${destination.title} travel experience — TABI`}
                    onError={() => setHeroImageFailed(true)}
                    className="w-full h-full object-cover object-top"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <i className="ri-map-pin-line text-5xl text-foreground-300"></i>
                  </div>
                )}
              </div>
              {destination.imageCredit && (
                <p className="mt-1.5 text-xs text-foreground-400">
                  Photo:{' '}
                  {destination.imageCredit.author ? `${destination.imageCredit.author}, ` : ''}
                  <a
                    href={destination.imageCredit.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-foreground-600"
                  >
                    Wikimedia Commons
                  </a>
                  {destination.imageCredit.license && (
                    <>
                      {' '}
                      (
                      {destination.imageCredit.licenseUrl ? (
                        <a
                          href={destination.imageCredit.licenseUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:text-foreground-600"
                        >
                          {destination.imageCredit.license}
                        </a>
                      ) : (
                        destination.imageCredit.license
                      )}
                      )
                    </>
                  )}
                </p>
              )}
            </div>
          </section>

          {/* タブナビゲーション */}
          <section className="bg-background-50 border-b border-background-200 sticky top-0 z-30">
            <div className="max-w-[1140px] mx-auto px-6 md:px-10">
              <div className="flex gap-2 overflow-x-auto">
                {TABS.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`-mb-px px-4 py-4 text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer border-b-2 ${
                      activeTab === tab.key
                        ? 'text-foreground-900 border-primary-500'
                        : 'text-foreground-500 border-transparent hover:text-foreground-700'
                    }`}
                  >
                    {tx(tab.label)}
                    {typeof tab.count === 'number' && tab.count > 0 && (
                      <span className="ml-1 text-xs text-foreground-400">({tab.count})</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* タブごとのコンテンツ */}
          <section className="py-10 md:py-12 px-6 md:px-10 lg:px-20">
            <div className="max-w-3xl mx-auto">
              {activeTab === 'overview' && (
                <div>
                  <h2 className="font-heading font-bold text-xl md:text-2xl text-foreground-900 mb-4">
                    {t('auto_6b21fb791a', "About")}{' '}{tx(destination.title)}
                  </h2>
                  <p className="text-foreground-600 text-base md:text-lg leading-relaxed mb-10">
                    {tx(destination.description)}
                  </p>

                  {similarSpots.length > 0 && (
                    <section>
                      <h3 className="font-heading font-bold text-lg text-foreground-900 mb-5">
                        {t('auto_1d0e6b941a', "Similar Spots")}
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {similarSpots.map((spot) => (
                          <Link
                            key={spot.id}
                            to={`/destinations/${spot.id}`}
                            className="group flex flex-col rounded-xl overflow-hidden border border-background-200 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
                          >
                            <div className="relative w-full h-24 overflow-hidden bg-background-100">
                              <img
                                src={spot.image}
                                alt={tx(spot.title)}
                                className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                              />
                            </div>
                            <div className="p-2.5">
                              <p className="font-heading font-semibold text-xs text-foreground-900 line-clamp-2 leading-snug">
                                {tx(spot.title)}
                              </p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </section>
                  )}

                  <div className="mt-10 pt-8 border-t border-background-200 flex flex-wrap gap-3">
                    <button
                      onClick={handleAskTabi}
                      className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm md:text-base px-6 py-3.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <i className="ri-chat-3-line text-lg"></i>
                      {t('auto_c48326d1fb', "Ask TABI about")}{' '}{tx(destination.title)}
                    </button>
                    <AddToTripButton
                      spotId={destination.id}
                      spotTitle={destination.title}
                      spotImageUrl={destination.image}
                      spotDescription={destination.description}
                      spotCategory={destination.category}
                      className="inline-flex items-center gap-2 bg-background-100 hover:bg-background-200 text-foreground-800 font-semibold text-sm md:text-base px-6 py-3.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {activeTab === 'guides' && (
                <div>
                  <h2 className="font-heading font-bold text-xl md:text-2xl text-foreground-900 mb-6">
                    {t('auto_9b271cb891', "Guides Featuring")}{' '}{tx(destination.title)}
                  </h2>
                  {guides.length === 0 ? (
                    <p className="text-foreground-500 text-sm">
                      {t('dest_noGuides', 'No guides mention this spot yet.')}
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 md:gap-6">
                      {guides.map((guide) => (
                        <Link
                          key={guide.id}
                          to={`/guides/${guide.id}`}
                          className="group flex flex-col bg-background-50 rounded-xl overflow-hidden border border-background-200 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer p-5"
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
                  )}
                </div>
              )}

              {activeTab === 'reviews' && (
                <div>
                  <h2 className="font-heading font-bold text-xl md:text-2xl text-foreground-900 mb-6">
                    {t('auto_cbafa9888c', "Real Experiences from Travelers")}
                  </h2>
                  {experiences.length === 0 ? (
                    <p className="text-foreground-500 text-sm">
                      {t('dest_noExp', 'No traveler experiences shared yet.')}
                    </p>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 md:gap-6">
                        {experiences.map((exp) => (
                          <Link
                            key={exp.id}
                            to={`/experiences/${exp.id}`}
                            className="group flex flex-col bg-background-50 rounded-xl overflow-hidden border border-background-200 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
                          >
                            {exp.photos && exp.photos.length > 0 && (
                              <div className="relative w-full h-40 flex-shrink-0 overflow-hidden bg-background-100">
                                <img
                                  src={exp.photos[0]}
                                  alt={tx(exp.placeName)}
                                  title={`${exp.placeName} — TABI`}
                                  className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                                />
                              </div>
                            )}

                            <div className="p-5 flex flex-col flex-1">
                              <div className="flex items-center gap-2 mb-3 flex-wrap">
                                <span
                                  className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${
                                    categoryColors[exp.category] ||
                                    'bg-background-200 text-foreground-600'
                                  }`}
                                >
                                  {tx(exp.category)}
                                </span>
                                {exp.wouldRecommend && (
                                  <span className="inline-flex items-center text-xs font-semibold text-emerald-600 whitespace-nowrap">
                                    <i className="ri-checkbox-circle-fill mr-1"></i>
                                    {t('auto_9ef937556e', "Recommended")}
                                  </span>
                                )}
                              </div>

                              <h3 className="font-heading font-bold text-base text-foreground-900 mb-2 leading-snug">
                                {tx(exp.placeName)}
                              </h3>

                              <p className="text-foreground-600 text-sm leading-relaxed line-clamp-2 mb-3">
                                {tx(exp.whatWasGood)}
                              </p>

                              <span className="mt-auto text-foreground-400 text-xs whitespace-nowrap">
                                — {exp.authorName}
                              </span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {activeTab === 'trips' && (
                <div>
                  <h2 className="font-heading font-bold text-xl md:text-2xl text-foreground-900 mb-6">
                    {t('auto_22ef3ae85d', "Trips Featuring")}{' '}{tx(destination.title)}
                  </h2>
                  {trips.length === 0 ? (
                    <p className="text-foreground-500 text-sm">
                      {t('dest_noTrips', 'No trips include this spot yet.')}
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {trips.map((_row) => (
                        <Link
                          key={_row.id}
                          to={`/trips/${_row.id}`}
                          className="group flex items-center justify-between gap-4 bg-background-50 border border-background-200 rounded-xl p-5 hover:-translate-y-0.5 hover:border-primary-300 transition-all duration-300 cursor-pointer"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 whitespace-nowrap">
                                {_row.tripType === 'actual' ? t('auto_3da47ff430', "Actual Trip") : t('auto_9ef937556e', "Recommended")}
                              </span>
                              <span className="text-xs text-foreground-400 whitespace-nowrap">
                                {_row.days.length}{' '}{t('auto_5548ae4f34', "days")}
                              </span>
                            </div>
                            <h3 className="font-semibold text-sm text-foreground-900 leading-snug">
                              {tx(_row.title)}
                            </h3>
                            {_row.summary && (
                              <p className="text-foreground-500 text-sm leading-relaxed line-clamp-2 mt-1">
                                {tx(_row.summary)}
                              </p>
                            )}
                            <div className="flex items-center gap-3 text-xs text-foreground-400 mt-2 flex-wrap">
                              {typeof _row.saveCount === 'number' && (
                                <span className="inline-flex items-center gap-1 whitespace-nowrap">
                                  <i className="ri-bookmark-line"></i>
                                  {_row.saveCount}
                                </span>
                              )}
                              {typeof _row.copyCount === 'number' && (
                                <span className="inline-flex items-center gap-1 whitespace-nowrap">
                                  <i className="ri-file-copy-line"></i>
                                  {_row.copyCount}
                                </span>
                              )}
                            </div>
                          </div>
                          <i className="ri-arrow-right-line text-foreground-400 flex-shrink-0 group-hover:translate-x-0.5 transition-transform"></i>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'location' && (
                <div>
                  <h2 className="font-heading font-bold text-xl md:text-2xl text-foreground-900 mb-6">
                    {t('auto_d219c68101', "Location")}
                  </h2>
                  {destination.lat !== undefined && destination.lng !== undefined ? (
                    <LocationMap
                      lat={destination.lat}
                      lng={destination.lng}
                      title={tx(destination.title)}
                    />
                  ) : (
                    <p className="text-foreground-500 text-sm">
                      {t("dest_noLocation", "Location information is not available for this spot.")}
                    </p>
                  )}
                </div>
              )}
            </div>
          </section>
        </>
      )}

      <Footer />
    </main>
  );
}
