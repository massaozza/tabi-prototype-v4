import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import CreatorNavbar from '@/components/feature/CreatorNavbar';
import Footer from '@/components/feature/Footer';
import { useAuth } from '@/context/AuthContext';

type TabKey =
  | 'overview'
  | 'trips'
  | 'spotReviews'
  | 'experiences'
  | 'analytics'
  | 'earnings'
  | 'profile';

const STATUS_LABEL_JA: Record<string, string> = {
  planning: '計画中',
  traveling: '旅行中',
  completed: '振り返り済み',
  published: '公開済み',
};

const TRIP_TYPE_LABEL_JA: Record<string, string> = {
  recommended: 'おすすめ旅程',
  actual: '実体験の旅程',
};

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'overview', label: '概要', icon: 'ri-dashboard-line' },
  { key: 'trips', label: '旅程', icon: 'ri-map-2-line' },
  { key: 'spotReviews', label: 'スポットの口コミ', icon: 'ri-map-pin-line' },
  { key: 'experiences', label: '体験', icon: 'ri-camera-3-line' },
  { key: 'analytics', label: '実績', icon: 'ri-bar-chart-line' },
  { key: 'earnings', label: '収益', icon: 'ri-money-dollar-circle-line' },
  { key: 'profile', label: 'プロフィール', icon: 'ri-user-line' },
];

interface TripSummary {
  id: string;
  title: string;
  status?: string;
  tripType?: 'recommended' | 'actual';
  saveCount?: number;
  copyCount?: number;
}

interface GuideSummary {
  id: string;
  title: string;
  titleEn?: string;
  translationStatus: string;
  spots: unknown[];
}

interface ExperienceSummary {
  id: string;
  placeName: string;
}

export default function CreatorDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [guides, setGuides] = useState<GuideSummary[]>([]);
  const [experiences, setExperiences] = useState<ExperienceSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;

    async function fetchAll() {
      try {
        const [tripsRes, guidesRes, expRes] = await Promise.all([
          fetch('/api/trips', { credentials: 'include' }),
          fetch('/api/guides?mine=1', { credentials: 'include' }),
          fetch('/api/experiences?mine=1', { credentials: 'include' }),
        ]);
        if (!cancelled) {
          if (tripsRes.ok) {
            const json = await tripsRes.json();
            setTrips(Array.isArray(json.trips) ? json.trips : []);
          }
          if (guidesRes.ok) {
            const json = await guidesRes.json();
            setGuides(Array.isArray(json.guides) ? json.guides : []);
          }
          if (expRes.ok) {
            const json = await expRes.json();
            const list = Array.isArray(json) ? json : json.experiences;
            setExperiences(Array.isArray(list) ? list : []);
          }
        }
      } catch {
        // 取得失敗時は空のまま（各タブが「まだありません」表示になる）
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchAll();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  if (authLoading) {
    return (
      <main className="min-h-screen bg-background-50">
        <CreatorNavbar />
        <div className="pt-20 px-6 flex items-center justify-center">
          <i className="ri-loader-4-line animate-spin text-3xl text-foreground-300"></i>
        </div>
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const totalSaves = trips.reduce((sum, t) => sum + (t.saveCount || 0), 0);
  const totalCopies = trips.reduce((sum, t) => sum + (t.copyCount || 0), 0);
  const publishedTrips = trips.filter((t) => t.status === 'published').length;
  const translatedGuides = guides.filter((g) => g.translationStatus === 'translated').length;

  return (
    <main className="min-h-screen bg-background-50">
      <CreatorNavbar />

      <section className="relative bg-foreground-900 pt-10 pb-10 px-6 md:px-10 overflow-hidden">
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-primary-500/10 blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -left-16 w-72 h-72 rounded-full bg-accent-500/10 blur-3xl pointer-events-none"></div>
        <div className="relative max-w-5xl mx-auto">
          <h1 className="font-heading font-bold text-2xl md:text-3xl text-white mb-2">
            マイページ
          </h1>
          <p className="text-white/60 text-sm flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-primary-500 text-white text-xs font-semibold flex items-center justify-center">
              {user.displayName ? user.displayName.charAt(0).toUpperCase() : '?'}
            </span>
            {user.displayName} さんの投稿・実績
          </p>
        </div>
      </section>

      <section className="px-6 md:px-10 -mt-5 relative z-10">
        <div className="max-w-5xl mx-auto bg-background-50 border border-background-200 rounded-xl p-1.5 flex gap-1 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer ${
                activeTab === tab.key
                  ? 'bg-primary-500 text-white'
                  : 'text-foreground-600 hover:bg-background-100 hover:text-foreground-900'
              }`}
            >
              <i className={tab.icon}></i>
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      <section className="py-10 px-6 md:px-10">
        <div className="max-w-5xl mx-auto">
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 bg-background-100 rounded-xl animate-pulse"></div>
              ))}
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: '旅程', value: trips.length, icon: 'ri-map-2-line', color: 'primary' },
                    { label: 'スポットの口コミ', value: guides.length, icon: 'ri-map-pin-line', color: 'accent' },
                    { label: '体験', value: experiences.length, icon: 'ri-camera-3-line', color: 'secondary' },
                    { label: '公開中の旅程', value: publishedTrips, icon: 'ri-global-line', color: 'primary' },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="relative bg-background-50 border border-background-200 rounded-xl p-5 hover:border-background-300 transition-colors overflow-hidden"
                    >
                      <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-primary-400/50 to-transparent"></span>
                      <span className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${
                        stat.color === 'accent'
                          ? 'bg-accent-100 text-accent-700'
                          : stat.color === 'secondary'
                          ? 'bg-secondary-100 text-secondary-700'
                          : 'bg-primary-100 text-primary-600'
                      }`}>
                        <i className={`${stat.icon} text-lg`}></i>
                      </span>
                      <p className="text-2xl font-heading font-bold text-foreground-900">
                        {stat.value}
                      </p>
                      <p className="text-foreground-500 text-xs mt-1">{stat.label}</p>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'trips' && (
                <div className="space-y-3">
                  {trips.length === 0 ? (
                    <EmptyState
                      text="まだTripがありません"
                      linkTo="/"
                      linkLabel="Ask TABIで旅程を作る"
                    />
                  ) : (
                    trips.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between bg-background-50 border border-background-200 rounded-lg p-4 hover:border-primary-200 hover:-translate-y-0.5 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-9 h-9 rounded-lg bg-primary-100 text-primary-600 flex items-center justify-center shrink-0">
                            <i className="ri-map-2-line"></i>
                          </span>
                          <div>
                            <p className="font-semibold text-sm text-foreground-900">{t.title}</p>
                            <p className="text-xs text-foreground-400 mt-1">
                              {STATUS_LABEL_JA[t.status || ''] || t.status}
                              {t.tripType ? `・${TRIP_TYPE_LABEL_JA[t.tripType] || t.tripType}` : ''}
                            </p>
                          </div>
                        </div>
                        <Link
                          to="/my-trip"
                          className="text-primary-500 hover:text-primary-600 text-xs font-semibold whitespace-nowrap"
                        >
                          管理する →
                        </Link>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'spotReviews' && (
                <div className="space-y-3">
                  {guides.length === 0 ? (
                    <EmptyState
                      text="まだSpot Reviewがありません"
                      linkTo="/guides/new"
                      linkLabel="投稿する"
                    />
                  ) : (
                    guides.map((g) => (
                      <Link
                        key={g.id}
                        to={`/guides/${g.id}`}
                        className="flex items-center justify-between bg-background-50 border border-background-200 rounded-lg p-4 hover:border-accent-200 hover:-translate-y-0.5 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-9 h-9 rounded-lg bg-accent-100 text-accent-700 flex items-center justify-center shrink-0">
                            <i className="ri-map-pin-line"></i>
                          </span>
                          <div>
                            <p className="font-semibold text-sm text-foreground-900">
                              {g.titleEn || g.title}
                            </p>
                            <p className="text-xs text-foreground-400 mt-1">
                              {g.spots.length}件のスポット・
                              {g.translationStatus === 'translated'
                                ? '翻訳済み'
                                : g.translationStatus === 'pending'
                                ? '翻訳待ち'
                                : '翻訳失敗'}
                            </p>
                          </div>
                        </div>
                        <i className="ri-arrow-right-line text-foreground-400"></i>
                      </Link>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'experiences' && (
                <div className="space-y-3">
                  {experiences.length === 0 ? (
                    <EmptyState
                      text="まだExperienceがありません"
                      linkTo="/experiences/new"
                      linkLabel="投稿する"
                    />
                  ) : (
                    experiences.map((e) => (
                      <Link
                        key={e.id}
                        to={`/experiences/${e.id}`}
                        className="flex items-center justify-between bg-background-50 border border-background-200 rounded-lg p-4 hover:border-secondary-200 hover:-translate-y-0.5 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-9 h-9 rounded-lg bg-secondary-100 text-secondary-700 flex items-center justify-center shrink-0">
                            <i className="ri-camera-3-line"></i>
                          </span>
                          <p className="font-semibold text-sm text-foreground-900">
                            {e.placeName}
                          </p>
                        </div>
                        <i className="ri-arrow-right-line text-foreground-400"></i>
                      </Link>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'analytics' && (
                <div>
                  <p className="text-foreground-500 text-sm mb-6">
                    ページ閲覧数（Views）の計測は、今後の実装で対応予定です。
                    現時点では、実際の行動につながった実績のみを表示しています。
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: '旅程の保存数', value: totalSaves, icon: 'ri-bookmark-line', color: 'accent' },
                      { label: '旅程のコピー数', value: totalCopies, icon: 'ri-file-copy-line', color: 'accent' },
                      {
                        label: '翻訳済みの口コミ',
                        value: translatedGuides,
                        icon: 'ri-translate-2',
                        color: 'accent',
                      },
                      { label: '公開中の旅程', value: publishedTrips, icon: 'ri-global-line', color: 'accent' },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="relative bg-background-50 border border-background-200 rounded-xl p-5 hover:border-accent-200 transition-colors overflow-hidden"
                      >
                        <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-accent-400/50 to-transparent"></span>
                        <span className="w-10 h-10 rounded-lg bg-accent-100 text-accent-700 flex items-center justify-center mb-3">
                          <i className={`${stat.icon} text-lg`}></i>
                        </span>
                        <p className="text-2xl font-heading font-bold text-foreground-900">
                          {stat.value}
                        </p>
                        <p className="text-foreground-500 text-xs mt-1">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'earnings' && (
                <div className="text-center py-16">
                  <span className="w-16 h-16 rounded-full bg-gradient-to-br from-background-100 to-background-200 flex items-center justify-center mx-auto mb-6">
                    <i className="ri-money-dollar-circle-line text-3xl text-foreground-400"></i>
                  </span>
                  <h2 className="font-heading font-bold text-lg text-foreground-900 mb-2">
                    収益はまだ発生していません
                  </h2>
                  <p className="text-foreground-500 text-sm max-w-sm mx-auto">
                    アフィリエイト連携が本格稼働すると、あなたの投稿経由での予約実績に
                    応じた収益分配がここに表示される予定です。
                  </p>
                </div>
              )}

              {activeTab === 'profile' && (
                <div className="text-center py-10">
                  <Link
                    to={`/creator/${user.uid}`}
                    className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm px-6 py-3 rounded-lg transition-colors whitespace-nowrap"
                  >
                    <i className="ri-external-link-line"></i>
                    公開プロフィールを見る
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
}

function EmptyState({
  text,
  linkTo,
  linkLabel,
}: {
  text: string;
  linkTo: string;
  linkLabel: string;
}) {
  return (
    <div className="text-center py-16">
      <span className="w-14 h-14 rounded-full bg-background-100 flex items-center justify-center mx-auto mb-5">
        <i className="ri-inbox-line text-2xl text-foreground-400"></i>
      </span>
      <p className="text-foreground-500 text-sm mb-5">{text}</p>
      <Link
        to={linkTo}
        className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm px-5 py-2.5 rounded-lg transition-colors whitespace-nowrap"
      >
        {linkLabel}
      </Link>
    </div>
  );
}
