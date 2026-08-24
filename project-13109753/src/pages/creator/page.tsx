import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Navbar from '@/components/feature/Navbar';
import Footer from '@/components/feature/Footer';

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

function formatJoinedDate(iso: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
}

function StatCard({ value, label, icon }: { value: number; label: string; icon: string }) {
  return (
    <div className="bg-background-50 border border-background-200 rounded-xl p-5 text-center">
      <i className={`${icon} text-2xl text-primary-500 block mb-2`}></i>
      <p className="font-heading font-bold text-2xl text-foreground-900">{value}</p>
      <p className="text-xs text-foreground-500 mt-1">{label}</p>
    </div>
  );
}

export default function CreatorProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [stats, setStats] = useState<CreatorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchProfile() {
      if (!userId) return;
      setLoading(true);
      setNotFound(false);
      try {
        const res = await fetch(`/api/creator-profile?uid=${encodeURIComponent(userId)}`);
        if (res.status === 404) {
          if (!cancelled) setNotFound(true);
          return;
        }
        if (!res.ok) throw new Error('Failed to fetch');
        const json = await res.json();
        if (!cancelled) {
          setProfile(json.profile);
          setStats(json.stats);
        }
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchProfile();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <div className="min-h-screen flex flex-col bg-background-100">
      <Navbar />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 md:px-6 py-12">
        {loading ? (
          <div className="space-y-4">
            <div className="h-24 bg-background-200 rounded-xl animate-pulse"></div>
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-background-200 rounded-xl animate-pulse"></div>
              ))}
            </div>
          </div>
        ) : notFound || !profile || !stats ? (
          <div className="text-center py-20">
            <i className="ri-user-search-line text-4xl text-foreground-300 block mb-3"></i>
            <p className="text-sm text-foreground-500">This creator profile could not be found.</p>
          </div>
        ) : (
          <>
            <div className="bg-background-50 border border-background-200 rounded-xl p-6 md:p-8 mb-6 flex items-center gap-5">
              <div className="w-16 h-16 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-heading font-bold text-2xl flex-shrink-0">
                {profile.displayName.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="font-heading font-bold text-2xl text-foreground-900">
                  {profile.displayName}
                </h1>
                <p className="text-sm text-foreground-500 mt-1">
                  {formatJoinedDate(profile.joinedAt) &&
                    `TABI member since ${formatJoinedDate(profile.joinedAt)}`}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
              <StatCard
                value={stats.experienceCount}
                label={stats.experienceCount === 1 ? 'Experience shared' : 'Experiences shared'}
                icon="ri-map-pin-line"
              />
              <StatCard value={stats.areaCount} label="Areas covered" icon="ri-compass-3-line" />
              <StatCard
                value={stats.categoryCount}
                label="Categories covered"
                icon="ri-price-tag-3-line"
              />
              <StatCard
                value={stats.totalHelpful}
                label="Helpful votes"
                icon="ri-thumb-up-line"
              />
              <StatCard
                value={stats.totalCitations}
                label="AI citations"
                icon="ri-chat-quote-line"
              />
            </div>

            {(stats.areas.length > 0 || stats.categories.length > 0) && (
              <div className="bg-background-50 border border-background-200 rounded-xl p-6 space-y-4">
                {stats.areas.length > 0 && (
                  <div>
                    <h2 className="font-heading font-semibold text-sm text-foreground-700 mb-2">
                      Areas
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      {stats.areas.map((area) => (
                        <span
                          key={area}
                          className="text-xs bg-background-100 text-foreground-600 rounded-full px-3 py-1"
                        >
                          {area}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {stats.categories.length > 0 && (
                  <div>
                    <h2 className="font-heading font-semibold text-sm text-foreground-700 mb-2">
                      Categories
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      {stats.categories.map((category) => (
                        <span
                          key={category}
                          className="text-xs bg-background-100 text-foreground-600 rounded-full px-3 py-1"
                        >
                          {category}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
