import { useNavigate } from 'react-router-dom';
import ArticleForm, { ArticleFormData } from '../../components/ArticleForm';
import { adminArticles } from '@/mocks/adminData';
import { useState } from 'react';

export default function NewArticlePage() {
  const navigate = useNavigate();
  const [saved, setSaved] = useState(false);

  const handleSubmit = (data: ArticleFormData) => {
    const newArticle = {
      id: `art-${String(adminArticles.length + 1).padStart(3, '0')}`,
      ...data,
      publishedDate: null,
      monthlyPV: 0,
      revenueEstimate: 0,
    };
    console.log('New article created:', newArticle);
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

      <ArticleForm onSubmit={handleSubmit} submitLabel="Create Article" />
    </div>
  );
}