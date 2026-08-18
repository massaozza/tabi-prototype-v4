import { adminArticles, pipelineColumns } from '@/mocks/adminData';
import PipelineCard from '../../components/PipelineCard';

export default function PipelineSection() {
  const getArticlesByStatus = (status: string) => {
    return adminArticles.filter((a) => a.status === status);
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground-900 mb-4 font-heading">Article Pipeline</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {pipelineColumns.map((col) => {
          const articles = getArticlesByStatus(col.id);
          return (
            <div key={col.id} className="bg-background-50 rounded-lg border border-background-200 p-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-foreground-700 whitespace-nowrap">{col.label}</span>
                <span className="text-xs font-bold text-foreground-500 bg-background-200 px-2 py-0.5 rounded-full">
                  {articles.length}
                </span>
              </div>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {articles.map((article) => (
                  <PipelineCard
                    key={article.id}
                    id={article.id}
                    title={article.title}
                    assignedTo={article.assignedTo}
                    category={article.category}
                    tier={article.tier}
                    dueDate={article.publishedDate || undefined}
                  />
                ))}
                {articles.length === 0 && (
                  <p className="text-xs text-foreground-400 text-center py-4">No articles</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}