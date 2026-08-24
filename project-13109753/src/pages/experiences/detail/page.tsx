import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Navbar from '@/components/feature/Navbar';
import Footer from '@/components/feature/Footer';
import { formatArea, formatMonth, type Experience } from '../types';
import { computeExperienceScore, MAX_EXPERIENCE_SCORE } from '../score';

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
  const [experience, setExperience] = useState<Experience | null>(null);
  const [allExperiences, setAllExperiences] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);

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

  const score = experience ? computeExperienceScore(experience, allExperiences) : null;

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
                Back to Experiences
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

              {/* Trip Details */}
              <section className="mb-8">
                <h4 className="font-heading font-semibold text-base text-foreground-900 mb-4">
                  Trip Details
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-background-50 border border-background-200 rounded-lg p-4">
                    <span className="block text-xs text-foreground-400 mb-1">Travel Style</span>
                    <span className="font-heading font-semibold text-sm text-foreground-900">
                      {experience.travelStyle}
                    </span>
                  </div>
                  {experience.companions && (
                    <div className="bg-background-50 border border-background-200 rounded-lg p-4">
                      <span className="block text-xs text-foreground-400 mb-1">Companions</span>
                      <span className="font-heading font-semibold text-sm text-foreground-900">
                        {experience.companions}
                      </span>
                    </div>
                  )}
                  {experience.budgetLevel && (
                    <div className="bg-background-50 border border-background-200 rounded-lg p-4">
                      <span className="block text-xs text-foreground-400 mb-1">Budget Level</span>
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
                  What was good?
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
                    What was hard?
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
                    Tip for travelers
                  </h4>
                  <p className="text-accent-900 text-base leading-relaxed whitespace-pre-wrap">
                    {experience.tip}
                  </p>
                </section>
              )}

              {/* Would recommend */}
              <section className="mb-10">
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
                      Would recommend
                    </>
                  ) : (
                    <>
                      <i className="ri-close-circle-fill"></i>
                      Would not recommend
                    </>
                  )}
                </span>
              </section>

              {/* Experience Score */}
              <section className="mb-10 bg-background-50 border border-background-200 rounded-lg p-5 md:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-heading font-semibold text-base text-foreground-900 flex items-center gap-2">
                    <i className="ri-award-line text-primary-500"></i>
                    Experience Score
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
                  <ScoreBar label="Detail" value={score?.detail ?? 0} max={score?.maxDetail ?? 1} />
                  <ScoreBar
                    label="Authenticity"
                    value={score?.authenticity ?? 0}
                    max={score?.maxAuthenticity ?? 1}
                  />
                  <ScoreBar
                    label="Freshness"
                    value={score?.freshness ?? 0}
                    max={score?.maxFreshness ?? 1}
                  />
                  <ScoreBar label="Rarity" value={score?.rarity ?? 0} max={score?.maxRarity ?? 1} />
                </div>

                <p className="text-xs text-foreground-400 mt-4 pt-4 border-t border-background-100">
                  Community & Impact scoring (Helpful votes, AI citations, booking impact) — coming soon.
                </p>
              </section>

              <Link to="/experiences" className="inline-flex items-center gap-2 text-primary-500 hover:text-primary-600 font-semibold text-sm transition-colors whitespace-nowrap">
                <i className="ri-arrow-left-line"></i>
                Back to Experiences
              </Link>
            </article>
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
}
