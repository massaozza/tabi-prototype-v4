import { useState, useEffect } from 'react';

interface Article {
  id: string;
  category: string;
  articleSlug: string;
  title: string;
  subtitle?: string;
  heroImage?: string;
  dateISO?: string;
}

function articleKey(a: Article): string {
  return a.id || a.articleSlug || '';
}

export default function FeaturedPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [featuredIds, setFeaturedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      setLoading(true);
      setLoadError(false);
      setSaveStatus(null);
      try {
        const [articlesRes, featuredRes] = await Promise.all([
          fetch('/api/content?type=articles'),
          fetch('/api/content?type=featuredArticleIds'),
        ]);
        if (!articlesRes.ok || !featuredRes.ok) throw new Error('Failed to fetch');
        const articlesJson = await articlesRes.json();
        const featuredJson = await featuredRes.json();
        if (!cancelled) {
          const list: Article[] = Array.isArray(articlesJson.data)
            ? (articlesJson.data as Article[]).sort((a, b) =>
                (b.dateISO || '').localeCompare(a.dateISO || '')
              )
            : [];
          setArticles(list);
          setFeaturedIds(
            Array.isArray(featuredJson.data)
              ? featuredJson.data.filter((x): x is string => typeof x === 'string')
              : []
          );
        }
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleArticle = (id: string) => {
    setFeaturedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const moveArticle = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= featuredIds.length) return;
    const updated = [...featuredIds];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setFeaturedIds(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus(null);
    try {
      const res = await fetch('/api/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'featuredArticleIds', data: featuredIds }),
      });
      if (!res.ok) throw new Error('Failed to save');
      const json = await res.json();
      if (json.success) {
        setSaveStatus({ type: 'success', message: 'Saved successfully!' });
        setTimeout(() => setSaveStatus(null), 3000);
      } else {
        throw new Error(json.error || 'Save failed');
      }
    } catch (err) {
      setSaveStatus({ type: 'error', message: err instanceof Error ? err.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  const selectedArticles = featuredIds
    .map((id) => articles.find((a) => articleKey(a) === id || a.articleSlug === id))
    .filter((a): a is Article => Boolean(a));

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground-900 font-heading">Featured</h1>
          <p className="text-sm text-foreground-500 mt-1">
            Curate the &quot;Editor&apos;s Picks&quot; section on the homepage
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          {saveStatus && (
            <span className={`text-sm ${saveStatus.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
              {saveStatus.message}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className={`inline-flex items-center gap-2 font-semibold text-sm px-4 py-2 rounded-md transition-colors whitespace-nowrap ${
              saving
                ? 'bg-background-300 text-foreground-400 cursor-not-allowed'
                : 'bg-primary-500 hover:bg-primary-600 text-white cursor-pointer'
            }`}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-background-50 rounded-lg border border-background-200 p-8 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 bg-background-200 rounded animate-pulse"></div>
          ))}
        </div>
      ) : loadError ? (
        <div className="bg-background-50 rounded-lg border border-background-200 p-10 text-center">
          <i className="ri-error-warning-line text-4xl text-foreground-300 block mb-3"></i>
          <p className="text-sm text-foreground-600 mb-4">Failed to load articles.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-sm bg-primary-500 text-background-50 rounded-lg hover:bg-primary-600 cursor-pointer whitespace-nowrap"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Available articles */}
          <div className="bg-background-50 rounded-lg border border-background-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground-900 font-heading">All Articles</h2>
              <span className="text-xs text-foreground-400">{articles.length} total</span>
            </div>
            <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
              {articles.map((a) => {
                const key = articleKey(a);
                const checked = featuredIds.includes(key) || featuredIds.includes(a.articleSlug);
                return (
                  <label
                    key={key}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      checked
                        ? 'border-primary-300 bg-primary-50/50'
                        : 'border-background-200 hover:bg-background-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleArticle(key)}
                      className="w-4 h-4 accent-primary-500 cursor-pointer flex-shrink-0"
                    />
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <img
                        src={a.heroImage || ''}
                        alt={a.title}
                        className="w-12 h-12 rounded-md object-cover object-top flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-sm text-foreground-900 font-medium truncate">{a.title}</p>
                        <p className="text-xs text-foreground-400 truncate">{a.category}</p>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Selected (order) */}
          <div className="bg-background-50 rounded-lg border border-background-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground-900 font-heading">
                Selected Articles
              </h2>
              <span className="text-xs text-foreground-400">{selectedArticles.length} selected</span>
            </div>
            {selectedArticles.length === 0 ? (
              <div className="text-center py-16">
                <span className="w-14 h-14 rounded-full bg-background-100 flex items-center justify-center mx-auto mb-4">
                  <i className="ri-star-line text-2xl text-foreground-400"></i>
                </span>
                <p className="text-sm text-foreground-500">
                  No articles selected. Check articles on the left to feature them.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedArticles.map((a, index) => {
                  const key = articleKey(a);
                  return (
                    <div
                      key={key}
                      className="flex items-center gap-3 p-3 rounded-lg border border-background-200 bg-background-50"
                    >
                      <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-xs font-semibold flex items-center justify-center flex-shrink-0">
                        {index + 1}
                      </span>
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <img
                          src={a.heroImage || ''}
                          alt={a.title}
                          className="w-12 h-12 rounded-md object-cover object-top flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-sm text-foreground-900 font-medium truncate">{a.title}</p>
                          <p className="text-xs text-foreground-400 truncate">{a.category}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => moveArticle(index, 'up')}
                          disabled={index === 0}
                          className="w-7 h-7 flex items-center justify-center rounded-md text-foreground-500 hover:text-foreground-900 hover:bg-background-100 disabled:opacity-30 cursor-pointer"
                          aria-label="Move up"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => moveArticle(index, 'down')}
                          disabled={index === selectedArticles.length - 1}
                          className="w-7 h-7 flex items-center justify-center rounded-md text-foreground-500 hover:text-foreground-900 hover:bg-background-100 disabled:opacity-30 cursor-pointer"
                          aria-label="Move down"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleArticle(key)}
                          className="w-7 h-7 flex items-center justify-center rounded-md text-red-500 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                          aria-label="Remove"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
