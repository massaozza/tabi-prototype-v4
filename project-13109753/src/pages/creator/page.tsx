import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Navbar from '@/components/feature/Navbar';
import Footer from '@/components/feature/Footer';

interface CreatorProfile { uid: string; displayName: string; joinedAt: string; }
interface CreatorStats { experienceCount: number; areaCount: number; categoryCount: number; areas: string[]; categories: string[]; totalHelpful: number; totalCitations: number; }
interface Experience { id: string; placeName: string; area: string; category: string; whatWasGood: string; wouldRecommend: boolean; photos: string[]; createdAt: string; }

function calcScore(s: CreatorStats) { return s.totalHelpful * 3 + s.totalCitations * 5 + s.experienceCount; }

function scoreLevel(score: number) {
  if (score >= 200) return { label: 'Expert', icon: 'ri-medal-line', color: 'rgba(240,180,60,0.2)', text: '#f5c84a', border: 'rgba(240,180,60,0.3)' };
  if (score >= 80) return { label: 'Contributor', icon: 'ri-award-line', color: 'rgba(99,143,220,0.25)', text: '#93bcf0', border: 'rgba(99,143,220,0.3)' };
  if (score >= 20) return { label: 'Active', icon: 'ri-star-line', color: 'rgba(60,200,120,0.2)', text: '#6ee7a0', border: 'rgba(60,200,120,0.3)' };
  return { label: 'Newcomer', icon: 'ri-user-line', color: 'rgba(255,255,255,0.1)', text: 'rgba(255,255,255,0.7)', border: 'rgba(255,255,255,0.2)' };
}

export default function CreatorPublicProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [stats, setStats] = useState<CreatorStats | null>(null);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetch(`/api/creator-profile?uid=${encodeURIComponent(userId)}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => {
        if (cancelled) return;
        setProfile(d.profile);
        setStats(d.stats);
        setExperiences(Array.isArray(d.experiences) ? d.experiences : []);
      })
      .catch(() => { if (!cancelled) setNotFound(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId]);

  if (loading) return (
    <main className="min-h-screen bg-background-50">
      <Navbar variant="dark" />
      <div style={{ background: '#1e2540', minHeight: '280px', paddingTop: '80px' }}></div>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-3">
        <div className="h-40 bg-background-200 rounded-2xl animate-pulse"></div>
        <div className="h-24 bg-background-200 rounded-2xl animate-pulse"></div>
      </div>
    </main>
  );

  if (notFound || !profile || !stats) return (
    <main className="min-h-screen bg-background-50">
      <Navbar variant="dark" />
      <div className="pt-28 text-center px-6">
        <p className="text-foreground-500 mb-4">Creator not found.</p>
        <Link to="/" className="text-primary-500 font-semibold text-sm">← Back to home</Link>
      </div>
      <Footer />
    </main>
  );

  const score = calcScore(stats);
  const level = scoreLevel(score);
  const joinYear = new Date(profile.joinedAt).getFullYear();
  const scorePct = Math.min(100, (score / 200) * 100);

  return (
    <main className="min-h-screen bg-background-50">
      <Navbar />

      {/* ── ダークネイビーヒーロー ── */}
      <div style={{ background: '#1e2540', paddingTop: '110px', paddingBottom: '32px' }}>
        <div className="max-w-2xl mx-auto px-4 md:px-6">

          {/* アバター＋名前 */}
          <div className="flex items-start gap-4 mb-6">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold flex-shrink-0"
              style={{ background: '#3a6ed4' }}>
              {profile.displayName?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="font-heading font-bold text-xl text-white">{profile.displayName}</h1>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full border flex items-center gap-1"
                  style={{ background: level.color, color: level.text, borderColor: level.border }}>
                  <i className={`${level.icon} text-xs`}></i>{level.label}
                </span>
              </div>
              <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Japan local · Member since {joinYear}</p>
              {stats.areas.length > 0 && (
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>
                  <i className="ri-map-pin-line mr-1"></i>
                  {stats.areas.slice(0, 3).join(' · ')}{stats.areas.length > 3 ? ` +${stats.areas.length - 3}` : ''}
                </p>
              )}
            </div>
          </div>

          {/* Experience Score */}
          <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.1)', paddingTop: '16px' }}>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.4)' }}>Experience Score</span>
              <span className="text-3xl font-bold text-white">{score}</span>
            </div>
            {/* スコアバー */}
            <div className="rounded-full overflow-hidden mb-1" style={{ height: '6px', background: 'rgba(255,255,255,0.1)' }}>
              <div className="h-full rounded-full" style={{ width: `${scorePct}%`, background: '#3a6ed4' }}></div>
            </div>
            <div className="flex justify-between mb-4">
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Newcomer</span>
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Expert (200)</span>
            </div>
            {/* 統計3列 */}
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-white">{stats.experienceCount}</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>Posts</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.totalHelpful}</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>Helpful</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.totalCitations}</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>AI citations</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── コンテンツ ── */}
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-6">

        {/* Specialties */}
        {stats.categories.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-bold tracking-widest uppercase text-foreground-400 mb-2">Specialties</p>
            <div className="flex flex-wrap gap-2">
              {stats.categories.map((cat) => (
                <span key={cat} className="text-xs font-medium px-3 py-1 bg-white border border-background-200 rounded-full text-foreground-600">{cat}</span>
              ))}
            </div>
          </div>
        )}

        {/* Experiences */}
        <div>
          <p className="text-xs font-bold tracking-widest uppercase text-foreground-400 mb-3">
            Experiences ({experiences.length})
          </p>
          {experiences.length === 0 ? (
            <div className="text-center py-12 text-foreground-400">
              <i className="ri-camera-line text-3xl mb-2 block"></i>
              <p className="text-sm">No experiences posted yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {experiences.map((exp) => (
                <Link key={exp.id} to={`/experiences/${exp.id}`}
                  className="flex items-start gap-3 bg-white border border-background-200 rounded-2xl p-4 hover:border-primary-200 transition-colors">
                  {exp.photos?.[0] ? (
                    <img src={exp.photos[0]} alt={exp.placeName} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-background-100 flex items-center justify-center flex-shrink-0">
                      <i className="ri-camera-line text-foreground-400 text-xl"></i>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex gap-1.5 flex-wrap mb-1">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary-50 text-primary-700">{exp.category}</span>
                      {exp.wouldRecommend && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700">
                          <i className="ri-thumb-up-line mr-0.5"></i>Recommended
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-foreground-900 truncate">{exp.placeName}</p>
                    <p className="text-xs text-foreground-500 mt-0.5 line-clamp-2">{exp.whatWasGood}</p>
                  </div>
                  <i className="ri-arrow-right-s-line text-foreground-300 flex-shrink-0 mt-1"></i>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </main>
  );
}
