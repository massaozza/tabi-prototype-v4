import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import ArticleForm, { ArticleFormData } from '../../components/ArticleForm';
import { buildArticle } from '../buildArticle';

export default function NewArticlePage() {
  const navigate = useNavigate();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (data: ArticleFormData) => {
    setSaving(true);
    setError(null);
    try {
      let existing: unknown[] = [];
      try {
        const res = await fetch('/api/content?type=articles');
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.data)) existing = json.data;
        }
      } catch {
        // ignore fetch failure; fall back to empty list
      }

      const id = data.slug || `art-${Date.now().toString(36)}`;
      const article = buildArticle(data, id);
      const next = [...existing, article];

      const saveRes = await fetch('/api/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'articles', data: next }),
      });
      if (!saveRes.ok) throw new Error('Failed to save article');

      setSaved(true);
      setTimeout(() => {
        navigate('/admin/articles');
      }, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save article');
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <i className="ri-check-line text-2xl text-green-600"></i>
          </div>
          <h2 className="text-lg font-semibold text-foreground-900 font-heading">Article Created!</h2>
          <p className="text-sm text-foreground-500 mt-1">Redirecting to articles list...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground-900 font-heading">New Article</h1>
          <p className="text-sm text-foreground-500 mt-1">Create a new article for Japan Quest Guide</p>
        </div>
        <button
          onClick={() => navigate('/admin/articles')}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-background-50 border border-background-300 rounded-lg text-foreground-600 hover:bg-background-100 transition-colors cursor-pointer whitespace-nowrap"
        >
          <i className="ri-arrow-left-line text-sm"></i>
          Back to Articles
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg">
          <i className="ri-error-warning-line"></i>
          {error}
        </div>
      )}

      <ArticleForm onSubmit={handleSubmit} submitLabel="Create Article" submitting={saving} />
    </div>
  );
}
