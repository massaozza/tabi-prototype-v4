import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Navbar from '@/components/feature/Navbar';
import Footer from '@/components/feature/Footer';

// TABI47：Creator公開プロフィールページ（/creator/:userId）
// 外国人旅行者がExperienceやTripの投稿者を確認し、
// その人の他の投稿も閲覧できるページ。

interface CreatorProfile {
  uid: string;
  displayName: string;
  joinedAt: string;
}

interface CreatorStats {
  experienceCount: number;
  areaCount: number;
  categoryCount: number;
  areas: string[];
  categories: string[];
  totalHelpful: number;
  totalCitations: number;
}

interface Experience {
  id: string;
  placeName: string;
  area: string;
  category: string;
  whatWasGood: string;
  wouldRecommend: boolean;
  photos: string[];
  createdAt: string;
}

// Experience Score計算
// 役立った数（×3）＋AI引用数（×5）＋投稿数（×1）の加重合計
function calcScore(stats: CreatorStats): number {
  return stats.totalHelpful * 3 + stats.totalCitations * 5 + stats.experienceCount;
}

function scoreLevel(score: number): { label: string; color: string; icon: string } {
  if (score >= 200) return { label: 'Expert', color: 'text-amber-600 bg-amber-50 border-amber-200', icon: 'ri-medal-line' };
  if (score >= 80) return { label: 'Contributor', color: 'text-primary-700 bg-primary-50 border-primary-200', icon: 'ri-award-line' };
  if (score >= 20) return { label: 'Active', color: 'text-green-700 bg-green-50 border-green-200', icon: 'ri-star-line' };
  return { label: 'Newcomer', color: 'text-foreground-600 bg-background-100 border-background-200', icon: 'ri-user-line' };
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
    async function fetchData() {
      try {
        const profileRes = await fetch(`/api/creator-profile?uid=${encodeURIComponent(userId!)}`);
        if (!profileRes.ok) { if (!cancelled) setNotFound(true); return; }
        const profileJson = await profileRes.json();
        if (cancelled) return;
        setProfile(profileJson.profile);
        setStats(profileJson.stats);
        setExperiences(Array.isArray(profileJson.experiences) ? profileJson.experiences : []);
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, [userId]);

  if (loading) {
    return (
      <main className="min-h-screen bg-background-50">
        <Navbar />
        <div className="pt-28 pb-16 px-4 max-w-2xl mx-auto space-y-4">
          <div className="h-32 bg-background-200 rounded-2xl animate-pulse"></div>
          <div className="h-24 bg-background-200 rounded-2xl animate-pulse"></div>
        </div>
      </main>
    );
  }

  if (notFound || !profile || !stats) {
    return (
      <main className="min-h-screen bg-background-50">
        <Navbar />
        <div className="pt-28 pb-16 px-6 text-center">
          <p className="text-foreground-500 mb-4">Creator not found.</p>
          <Link to="/" className="text-primary-500 font-semibold text-sm">← Back to home</Link>
        </div>
        <Footer />
      </main>
    );
  }

  const score = calcScore(stats);
  const level = scoreLevel(score);
  const joinYear = new Date(profile.joinedAt).getFullYear();

  return (
    <main className="min-h-screen bg-background-50">
      <Navbar />

      <div className="max-w-2xl mx-auto px-4 md:px-6 pt-24 pb-16">

        {/* プロフィールカード */}
        <div className="bg-white border border-background-200 rounded-2xl p-6 mb-5">
          <div className="flex items-start gap-4">
            {/* アバター */}
            <div className="w-16 h-16 rounded-full bg-primary-600 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
              {profile.displayName?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="font-heading font-bold text-xl text-foreground-900">{profile.displayName}</h1>
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1 ${level.color}`}>
                  <i className={`${level.icon} text-xs`}></i>{level.label}
                </span>
              </div>
              <p className="text-foreground-400 text-xs">Japan local · Member since {joinYear}</p>
              {stats.areas.length > 0 && (
                <p className="text-foreground-600 text-sm mt-1.5">
                  <i className="ri-map-pin-line text-foreground-400 mr-1"></i>
                  {stats.areas.slice(0, 3).join(' · ')}{stats.areas.length > 3 ? ` +${stats.areas.length - 3} more` : ''}
                </p>
              )}
            </div>
          </div>

          {/* Experience Score */}
          <div className="mt-5 pt-4 border-t border-background-100">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold tracking-widest uppercase text-foreground-400">Experience Score</p>
              <span className="text-2xl font-bold text-foreground-900">{score}</span>
            </div>
            {/* スコアバー */}
            <div className="w-full bg-background-100 rounded-full h-2 mb-3">
              <div
                className="bg-primary-500 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(100, (score / 200) * 100)}%` }}
              ></div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-lg font-bold text-foreground-900">{stats.experienceCount}</p>
                <p className="text-xs text-foreground-400">Posts</p>
              </div>
              <div>
                <p className="text-lg font-bold text-foreground-900">{stats.totalHelpful}</p>
                <p className="text-xs text-foreground-400">Helpful</p>
              </div>
              <div>
                <p className="text-lg font-bold text-foreground-900">{stats.totalCitations}</p>
                <p className="text-xs text-foreground-400">AI citations</p>
              </div>
            </div>
          </div>
        </div>

        {/* カテゴリタグ */}
        {stats.categories.length > 0 && (
          <div className="mb-5">
            <p className="text-xs font-bold tracking-widest uppercase text-foreground-400 mb-2">Specialties</p>
            <div className="flex flex-wrap gap-2">
              {stats.categories.map((cat) => (
                <span key={cat} className="text-xs font-medium px-3 py-1 bg-white border border-background-200 rounded-full text-foreground-600">
                  {cat}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Experiences一覧 */}
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
                <Link
                  key={exp.id}
                  to={`/experiences/${exp.id}`}
                  className="block bg-white border border-background-200 rounded-2xl p-4 hover:border-primary-200 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {exp.photos?.[0] ? (
                      <img src={exp.photos[0]} alt={exp.placeName} className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-background-100 flex items-center justify-center flex-shrink-0">
                        <i className="ri-camera-line text-foreground-400 text-xl"></i>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-medium text-foreground-500 bg-background-100 px-2 py-0.5 rounded-full">{exp.category}</span>
                        {exp.wouldRecommend && (
                          <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                            <i className="ri-thumb-up-line mr-0.5"></i>Recommended
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-foreground-900 truncate">{exp.placeName}</p>
                      <p className="text-xs text-foreground-500 mt-0.5 line-clamp-2">{exp.whatWasGood}</p>
                    </div>
                    <i className="ri-arrow-right-s-line text-foreground-300 flex-shrink-0 mt-1"></i>
                  </div>
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
