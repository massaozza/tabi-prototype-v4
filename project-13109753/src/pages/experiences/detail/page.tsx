import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import Navbar from '@/components/feature/Navbar';
import Footer from '@/components/feature/Footer';
import { useAuth } from '@/context/AuthContext';
import { formatArea, formatMonth, type Experience } from '../types';
import { computeExperienceScore, MAX_EXPERIENCE_SCORE } from '../score';

interface RelatedSpot {
  id: string;
  title: string;
  category: string;
  image: string;
}

interface RelatedTrip {
  id: string;
  title: string;
  tripType?: 'recommended' | 'actual';
  days: { activities: { spotId?: string }[] }[];
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

function ScoreBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-foreground-600">{label}</span>
        <span className="text-foreground-500 font-medium">
          {value} / {max}
        </span>
      </div>
      <div className="w-full h-1.5 bg-background-200 rounded-full overflow-hidden">
        <div className="h-full bg-primary-500 rounded-full" style={{ width: `${pct}%` }}></div>
      </div>
    </div>
  );
}

export default function ExperienceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [experience, setExperience] = useState<Experience | null>(null);
  const [allExperiences, setAllExperiences] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);
  const [helpfulCount, setHelpfulCount] = useState(0);
  const [helpfulByMe, setHelpfulByMe] = useState(false);
  const [helpfulPending, setHelpfulPending] = useState(false);
  const [citationCount, setCitationCount] = useState(0);
  const [relatedSpot, setRelatedSpot] = useState<RelatedSpot | null>(null);
  const [relatedTrips, setRelatedTrips] = useState<RelatedTrip[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const res = await fetch('/api/experiences');
        if (!res.ok) throw new Error('Failed to fetch');
        const json = await res.json();
        const list = Array.isArray(json) ? json : json.experiences;
        if (!cancelled && Array.isArray(list)) {
          const found = list.find((e: Experience) => e.id === id) ?? null;
          setExperience(found);
          setAllExperiences(list);
          if (found) {
            fetch('/api/track-view', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contentType: 'experience', id: found.id }),
            }).catch(() => {});
          }

          if (found?.spotId) {
            // {t('exp_relatedSpot', 'Related Spot')}（このExperienceが紐づいているSPOTの基本情報）
            try {
              const spotRes = await fetch('/api/content?type=destinations');
              if (spotRes.ok) {
                const spotJson = await spotRes.json();
                const spot = Array.isArray(spotJson?.data)
                  ? spotJson.data.find((d: RelatedSpot) => d.id === found.spotId)
                  : null;
                if (!cancelled && spot) setRelatedSpot(spot);
              }
            } catch {
              // 取得失敗時はセクション非表示のまま
            }

            // Trips including this Experience（同じSpotを含む公開Trip）
            try {
              const tripRes = await fetch('/api/trips?public=1');
              if (tripRes.ok) {
                const tripJson = await tripRes.json();
                if (!cancelled && Array.isArray(tripJson.trips)) {
                  // /api/trips?public=1 は既にスコア順で返ってくるため、
                  // ここでは絞り込みのみ行う
                  const matching = tripJson.trips
                    .filter((t: RelatedTrip) =>
                      t.days.some((d) => d.activities.some((a) => a.spotId === found.spotId))
                    )
                    .slice(0, 4);
                  setRelatedTrips(matching);
                }
              }
            } catch {
              // 取得失敗時はセクション非表示のまま
            }
          }
        }
      } catch {
        if (!cancelled) setExperience(null);
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
    let cancelled = false;
    async function fetchHelpful() {
      if (!id) return;
      try {
        const res = await fetch(
          `/api/experience-helpful?ids=${encodeURIComponent(id)}`,
          { credentials: 'include' }
        );
        if (!res.ok) return;
        const json = await res.json();
        const stat = json.stats?.[id];
        if (!cancelled && stat) {
          setHelpfulCount(stat.helpfulCount);
          setHelpfulByMe(stat.helpfulByMe);
          setCitationCount(stat.citationCount || 0);
        }
      } catch {
        // 取得失敗時は0件・未押下のまま（致命的ではないため静かに諦める）
      }
    }
    fetchHelpful();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleToggleHelpful = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (!id || helpfulPending) return;
    setHelpfulPending(true);
    try {
      const res = await fetch('/api/experience-helpful', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ experienceId: id }),
      });
      if (res.ok) {
        const json = await res.json();
        setHelpfulCount(json.helpfulCount);
        setHelpfulByMe(json.helpfulByMe);
      }
    } catch {
      // ネットワークエラー時はボタンの状態をそのまま維持する
    } finally {
      setHelpfulPending(false);
    }
  };

  const score = experience
    ? computeExperienceScore(experience, allExperiences, {
        helpfulCount,
        citationCount,
      })
    : null;

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
              <div className="h-4 w-5/6 bg-background-200 rounded animate-pulse"></div>
            </div>
          ) : !experience ? (
            <div className="text-center py-20">
              <span className="w-16 h-16 rounded-full bg-background-100 flex items-center justify-center mx-auto mb-6">
                <i className="ri-error-warning-line text-3xl text-foreground-400"></i>
              </span>
              <h1 className="font-heading font-bold text-2xl text-foreground-900 mb-2">
                Experience not found
              </h1>
              <p className="text-foreground-500 text-sm mb-6">
                The experience you are looking for may have been removed.
              </p>
              <Link to="/experiences" className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm px-6 py-3 rounded-lg transition-colors whitespace-nowrap">
                <i className="ri-arrow-left-line"></i>
                {t('exp_backToExp', 'Back to Experiences')}
              </Link>
            </div>
          ) : (
            <article>
              {/* Gallery */}
              {experience.photos && experience.photos.length > 0 && (
                <div
                  className={`grid gap-3 mb-8 ${
                    experience.photos.length > 1
                      ? 'grid-cols-1 sm:grid-cols-2'
                      : 'grid-cols-1'
                  }`}
                >
                  {experience.photos.map((url, idx) => (
                    <div
                      key={url}
                      className={`rounded-xl overflow-hidden border border-background-200 bg-background-100 ${
                        experience.photos.length === 1 ? 'h-72 md:h-96' : 'h-56 md:h-64'
                      }`}
                    >
                      <img
                        src={url}
                        alt={`${experience.placeName} photo ${idx + 1}`}
                        title={`${experience.placeName} — TABI`}
                        className="w-full h-full object-cover object-top"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Videos */}
              {experience.videos && experience.videos.length > 0 && (
                <div
                  className={`grid gap-3 mb-8 ${
                    experience.videos.length > 1 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'
                  }`}
                >
                  {experience.videos.map((url) => (
                    <div
                      key={url}
                      className="rounded-xl overflow-hidden border border-background-200 bg-black"
                    >
                      <video
                        src={url}
                        controls
                        className="w-full h-full max-h-[480px] object-contain bg-black"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Header */}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span
                  className={`inline-block text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap ${
                    categoryColors[experience.category] || 'bg-background-200 text-foreground-600'
                  }`}
                >
                  {experience.category}
                </span>
                <span className="inline-block text-xs font-semibold px-3 py-1 rounded-full bg-background-100 text-foreground-700 whitespace-nowrap">
                  {formatArea(experience.area)}
                </span>
              </div>

              <h1 className="font-heading font-bold text-3xl md:text-4xl text-foreground-900 leading-tight mb-3">
                {experience.placeName}
              </h1>

              <p className="text-foreground-500 text-sm mb-8">
                Posted by{' '}
                <Link
                  to={`/creator/${experience.uid}`}
                  className="text-foreground-800 font-medium hover:text-primary-600 transition-colors"
                >
                  {experience.authorName}
                </Link>{' '}
                in {formatMonth(experience.visitedMonth)}
              </p>

              {/* {t('exp_tripDetails', 'Trip Details')} */}
              <section className="mb-8">
                <h4 className="font-heading font-semibold text-base text-foreground-900 mb-4">
                  {t('exp_tripDetails', 'Trip Details')}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-background-50 border border-background-200 rounded-lg p-4">
                    <span className="block text-xs text-foreground-400 mb-1">{t('exp_travelStyle', 'Travel Style')}</span>
                    <span className="font-heading font-semibold text-sm text-foreground-900">
                      {experience.travelStyle}
                    </span>
                  </div>
                  {experience.companions && (
                    <div className="bg-background-50 border border-background-200 rounded-lg p-4">
                      <span className="block text-xs text-foreground-400 mb-1">{t('exp_companions', 'Companions')}</span>
                      <span className="font-heading font-semibold text-sm text-foreground-900">
                        {experience.companions}
                      </span>
                    </div>
                  )}
                  {experience.budgetLevel && (
                    <div className="bg-background-50 border border-background-200 rounded-lg p-4">
                      <span className="block text-xs text-foreground-400 mb-1">{t('exp_budgetLevel', 'Budget Level')}</span>
                      <span className="font-heading font-semibold text-sm text-foreground-900">
                        {experience.budgetLevel}
                      </span>
                    </div>
                  )}
                </div>
              </section>

              {/* What was good */}
              <section className="mb-8">
                <h4 className="font-heading font-semibold text-base text-foreground-900 mb-3">
                  {t('exp_whatWasGood', 'What was good?')}
                </h4>
                <p className="text-foreground-700 text-base leading-relaxed whitespace-pre-wrap">
                  {experience.whatWasGood}
                </p>
              </section>

              {/* What was hard */}
              {experience.whatWasHard && (
                <section className="mb-8 bg-amber-50 border border-amber-200 rounded-lg p-5">
                  <h4 className="font-heading font-semibold text-base text-amber-800 mb-3 flex items-center gap-2">
                    <i className="ri-alert-line"></i>
                    {t('exp_whatWasHard', 'What was hard?')}
                  </h4>
                  <p className="text-amber-900 text-base leading-relaxed whitespace-pre-wrap">
                    {experience.whatWasHard}
                  </p>
                </section>
              )}

              {/* Tip */}
              {experience.tip && (
                <section className="mb-8 bg-accent-50 border border-accent-200 rounded-lg p-5">
                  <h4 className="font-heading font-semibold text-base text-accent-800 mb-3 flex items-center gap-2">
                    <i className="ri-lightbulb-line"></i>
                    {t('exp_tipForTravelers', 'Tip for travelers')}
                  </h4>
                  <p className="text-accent-900 text-base leading-relaxed whitespace-pre-wrap">
                    {experience.tip}
                  </p>
                </section>
              )}

              {/* {t('exp_relatedSpot', 'Related Spot')} */}
              {relatedSpot && (
                <section className="mb-8">
                  <h4 className="font-heading font-semibold text-base text-foreground-900 mb-3">
                    {t('exp_relatedSpot', 'Related Spot')}
                  </h4>
                  <Link
                    to={`/destinations/${relatedSpot.id}`}
                    className="group flex items-center gap-4 bg-background-50 border border-background-200 rounded-xl overflow-hidden hover:-translate-y-0.5 transition-all duration-300 cursor-pointer p-4"
                  >
                    <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-background-100">
                      <img
                        src={relatedSpot.image}
                        alt={relatedSpot.title}
                        className="w-full h-full object-cover object-top"
                      />
                    </div>
                    <div>
                      <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-secondary-100 text-secondary-800 whitespace-nowrap mb-1">
                        {relatedSpot.category}
                      </span>
                      <h5 className="font-heading font-bold text-sm text-foreground-900">
                        {relatedSpot.title}
                      </h5>
                    </div>
                    <i className="ri-arrow-right-line text-foreground-400 ml-auto group-hover:text-primary-500 transition-colors"></i>
                  </Link>
                </section>
              )}

              {/* Trips including this Experience */}
              {relatedTrips.length > 0 && (
                <section className="mb-8">
                  <h4 className="font-heading font-semibold text-base text-foreground-900 mb-3">
                    Trips Including This Spot
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {relatedTrips.map((trip) => (
                      <Link
                        key={trip.id}
                        to={`/trips/${trip.id}`}
                        className="flex flex-col bg-background-50 border border-background-200 rounded-lg p-4 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
                      >
                        <span
                          className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap mb-1.5 self-start ${
                            trip.tripType === 'recommended'
                              ? 'bg-accent-50 text-accent-700'
                              : 'bg-primary-50 text-primary-700'
                          }`}
                        >
                          {trip.tripType === 'recommended' ? '{t('exp_recommendedTrip', 'Recommended Trip')}' : '{t('exp_actualTrip', 'Actual Trip')}'}
                        </span>
                        <span className="font-heading font-semibold text-sm text-foreground-900">
                          {trip.title}
                        </span>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {/* {t('exp_wouldRecommend', 'Would recommend')} / Helpful */}
              <section className="mb-10 flex items-center gap-3 flex-wrap">
                <span
                  className={`inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-full whitespace-nowrap ${
                    experience.wouldRecommend
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-background-100 text-foreground-600'
                  }`}
                >
                  {experience.wouldRecommend ? (
                    <>
                      <i className="ri-checkbox-circle-fill"></i>
                      {t('exp_wouldRecommend', 'Would recommend')}
                    </>
                  ) : (
                    <>
                      <i className="ri-close-circle-fill"></i>
                      Would not recommend
                    </>
                  )}
                </span>

                <button
                  type="button"
                  onClick={handleToggleHelpful}
                  disabled={helpfulPending}
                  className={`inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-full whitespace-nowrap transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                    helpfulByMe
                      ? 'bg-primary-500 text-white'
                      : 'bg-background-100 text-foreground-600 hover:bg-background-200'
                  }`}
                >
                  <i className={helpfulByMe ? 'ri-thumb-up-fill' : 'ri-thumb-up-line'}></i>
                  Helpful{helpfulCount > 0 ? ` (${helpfulCount})` : ''}
                </button>
              </section>

              {/* {t('exp_expScore', 'Experience Score')} */}
              <section className="mb-10 bg-background-50 border border-background-200 rounded-lg p-5 md:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-heading font-semibold text-base text-foreground-900 flex items-center gap-2">
                    <i className="ri-award-line text-primary-500"></i>
                    {t('exp_expScore', 'Experience Score')}
                  </h4>
                  <span className="font-heading font-bold text-2xl text-foreground-900">
                    {score?.total ?? 0}
                    <span className="text-sm font-normal text-foreground-400">
                      {' '}
                      / {MAX_EXPERIENCE_SCORE}
                    </span>
                  </span>
                </div>

                <div className="space-y-3">
                  <ScoreBar label={t('exp_scoreDetail', 'Detail')} value={score?.detail ?? 0} max={score?.maxDetail ?? 1} />
                  <ScoreBar
                    label={t('exp_scoreAuthenticity', 'Authenticity')}
                    value={score?.authenticity ?? 0}
                    max={score?.maxAuthenticity ?? 1}
                  />
                  <ScoreBar
                    label={t('exp_scoreFreshness', 'Freshness')}
                    value={score?.freshness ?? 0}
                    max={score?.maxFreshness ?? 1}
                  />
                  <ScoreBar label={t('exp_scoreRarity', 'Rarity')} value={score?.rarity ?? 0} max={score?.maxRarity ?? 1} />
                  <ScoreBar
                    label={t('exp_scoreHelpfulness', 'Helpfulness')}
                    value={score?.helpfulness ?? 0}
                    max={score?.maxHelpfulness ?? 1}
                  />
                  <ScoreBar
                    label={t('exp_scoreAI', 'AI Contribution')}
                    value={score?.aiContribution ?? 0}
                    max={score?.maxAiContribution ?? 1}
                  />
                </div>

                <p className="text-xs text-foreground-400 mt-4 pt-4 border-t border-background-100">
                  {t('exp_commerceSoon', 'Commerce Contribution — coming soon.')}
                </p>
              </section>

              <Link to="/experiences" className="inline-flex items-center gap-2 text-primary-500 hover:text-primary-600 font-semibold text-sm transition-colors whitespace-nowrap">
                <i className="ri-arrow-left-line"></i>
                {t('exp_backToExp', 'Back to Experiences')}
              </Link>
            </article>
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
}
