import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { teamMembers } from '@/mocks/adminData';
import ArticleForm, { ArticleFormData } from '../../components/ArticleForm';
import { buildArticle, mapSectionsToBodySections } from '../buildArticle';
import type { PublishedArticle } from '../buildArticle';

export default function EditArticlePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [article, setArticle] = useState<PublishedArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchArticle() {
      setLoading(true);
      try {
        const res = await fetch('/api/content?type=articles');
        if (res.ok) {
          const json = await res.json();
          const list = Array.isArray(json.data) ? json.data : [];
          const found = list.find((a) => a.id === id) || null;
          if (!cancelled) setArticle(found);
        } else if (!cancelled) {
          setArticle(null);
        }
      } catch {
        if (!cancelled) setArticle(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchArticle();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleSubmit = async (data: ArticleFormData) => {
    if (!article) return;
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

      const updated = buildArticle(data, article.id);
      const next = existing.map((a) => ((a as PublishedArticle).id === article.id ? updated : a));

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

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-8 w-64 bg-background-200 rounded animate-pulse"></div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-background-200 rounded-lg animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="text-center py-32">
        <i className="ri-error-warning-line text-4xl text-foreground-300 block mb-3"></i>
        <h2 className="text-lg font-semibold text-foreground-900 font-heading">Article Not Found</h2>
        <p className="text-sm text-foreground-500 mt-1">The article you are looking for does not exist.</p>
        <button
          onClick={() => navigate('/admin/articles')}
          className="mt-4 px-4 py-2 text-sm bg-primary-500 text-background-50 rounded-lg hover:bg-primary-600 cursor-pointer whitespace-nowrap"
        >
          Back to Articles
        </button>
      </div>
    );
  }

  if (saved) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <i className="ri-check-line text-2xl text-green-600"></i>
          </div>
          <h2 className="text-lg font-semibold text-foreground-900 font-heading">Article Updated!</h2>
          <p className="text-sm text-foreground-500 mt-1">Redirecting to articles list...</p>
        </div>
      </div>
    );
  }

  const authorName = article.author?.name || teamMembers[0].name;

  const initialData: Partial<ArticleFormData> = {
    title: article.title,
    slug: article.articleSlug,
    category: article.category,
    tier: article.tier ?? 1,
    targetKeyword: article.targetKeyword ?? '',
    assignedTo: article.assignedTo ?? teamMembers[0].name,
    status: article.status ?? 'not_started',
    author: authorName,
    metaTitle: article.metaTitle ?? '',
    metaDescription: article.metaDescription ?? '',
    heroImage: article.heroImage ?? '',
    bodySections: mapSectionsToBodySections(article.sections),
    subtitle: article.subtitle,
    authorBio: article.author?.bio ?? article.authorBox?.bio,
    authorAvatar: article.author?.avatar ?? article.authorBox?.avatar,
    affiliateCta: article.affiliateCta
      ? {
          label: article.affiliateCta.label ?? '',
          title: article.affiliateCta.title ?? '',
          description: article.affiliateCta.description ?? '',
          price: article.affiliateCta.price ?? '',
          buttonText: article.affiliateCta.buttonText ?? '',
          partnerName: article.affiliateCta.partnerName ?? '',
        }
      : undefined,
    quickFacts: article.quickFacts?.items,
    topPick: article.topPick
      ? {
          title: (article.topPick.title as string) ?? '',
          productName: (article.topPick.productName as string) ?? '',
          rating: Number(article.topPick.rating) || 5,
          description: (article.topPick.description as string) ?? '',
          buttonText: (article.topPick.buttonText as string) ?? '',
          guaranteeText: (article.topPick.guaranteeText as string) ?? '',
        }
      : undefined,
    bottomCta: article.bottomCta
      ? {
          title: article.bottomCta.title ?? '',
          description: article.bottomCta.description ?? '',
          primaryButtonText: article.bottomCta.primaryButtonText ?? '',
          secondaryButtonText: article.bottomCta.secondaryButtonText ?? '',
          disclaimer: article.bottomCta.disclaimer ?? '',
        }
      : undefined,
    sidebarRelatedArticles: article.sidebarRelatedArticles,
    relatedArticles: article.relatedArticles
      ? article.relatedArticles.map(({ title, category, description, image, href }) => ({
          title,
          category,
          description,
          image,
          href,
        }))
      : undefined,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground-900 font-heading">Edit Article</h1>
          <p className="text-sm text-foreground-500 mt-1">
            Editing: <span className="text-foreground-700 font-medium">{article.title}</span>
          </p>
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

      <ArticleForm initialData={initialData} onSubmit={handleSubmit} submitLabel="Update Article" submitting={saving} />
    </div>
  );
}
