import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { adminArticles } from '@/mocks/adminData';
import ArticleForm, { ArticleFormData } from '../../components/ArticleForm';

export default function EditArticlePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [saved, setSaved] = useState(false);

  const article = adminArticles.find((a) => a.id === id);

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

  const initialData: Partial<ArticleFormData> = {
    title: article.title,
    slug: article.slug,
    category: article.category,
    tier: article.tier,
    targetKeyword: article.targetKeyword,
    assignedTo: article.assignedTo,
    status: article.status,
    author: article.author,
    metaTitle: article.metaTitle,
    metaDescription: article.metaDescription,
    heroImage: '',
  };

  const handleSubmit = (data: ArticleFormData) => {
    console.log('Article updated:', { id: article.id, ...data });
    setSaved(true);
    setTimeout(() => {
      navigate('/admin/articles');
    }, 800);
  };

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

      <ArticleForm initialData={initialData} onSubmit={handleSubmit} submitLabel="Update Article" />
    </div>
  );
}