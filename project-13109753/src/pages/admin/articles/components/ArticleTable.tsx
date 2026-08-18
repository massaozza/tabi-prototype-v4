import { useNavigate } from 'react-router-dom';
import StatusBadge from '../../components/StatusBadge';

interface Article {
  id: string;
  title: string;
  slug: string;
  category: string;
  targetKeyword: string;
  assignedTo: string;
  status: string;
  publishedDate: string | null;
  monthlyPV: number;
  revenueEstimate: number;
}

interface ArticleTableProps {
  articles: Article[];
  onDelete: (id: string) => void;
}

export default function ArticleTable({ articles, onDelete }: ArticleTableProps) {
  const navigate = useNavigate();

  return (
    <div className="bg-background-50 rounded-lg border border-background-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-background-100 border-b border-background-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-foreground-600 whitespace-nowrap">Title</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-foreground-600 whitespace-nowrap">Slug</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-foreground-600 whitespace-nowrap">Category</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-foreground-600 whitespace-nowrap">Target KW</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-foreground-600 whitespace-nowrap">Assigned</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-foreground-600 whitespace-nowrap">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-foreground-600 whitespace-nowrap">Published</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-foreground-600 whitespace-nowrap">Monthly PV</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-foreground-600 whitespace-nowrap">Revenue</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-foreground-600 whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {articles.map((article) => (
              <tr key={article.id} className="border-b border-background-200 hover:bg-background-100/50 transition-colors">
                <td className="px-4 py-3">
                  <button
                    onClick={() => navigate(`/admin/articles/${article.id}/edit`)}
                    className="text-left text-foreground-900 font-medium hover:text-primary-500 transition-colors line-clamp-2 max-w-[260px] cursor-pointer"
                  >
                    {article.title}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs font-mono text-foreground-500 whitespace-nowrap">/{article.slug}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-foreground-600 whitespace-nowrap">{article.category}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-foreground-500 max-w-[140px] line-clamp-1 block">{article.targetKeyword}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-foreground-600 whitespace-nowrap">{article.assignedTo}</span>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={article.status} />
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-foreground-500 whitespace-nowrap">
                    {article.publishedDate || '—'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-xs text-foreground-700 font-medium whitespace-nowrap">
                    {article.monthlyPV > 0 ? article.monthlyPV.toLocaleString() : '—'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-xs text-foreground-700 font-medium whitespace-nowrap">
                    {article.revenueEstimate > 0 ? `¥${article.revenueEstimate.toLocaleString()}` : '—'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => navigate(`/admin/articles/${article.id}/edit`)}
                      className="w-8 h-8 flex items-center justify-center rounded hover:bg-background-200 text-foreground-500 hover:text-primary-500 transition-colors cursor-pointer"
                      title="Edit"
                    >
                      <i className="ri-edit-line text-sm"></i>
                    </button>
                    <a
                      href={`/${article.category.toLowerCase().replace(/\s+/g, '-')}/${article.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-8 h-8 flex items-center justify-center rounded hover:bg-background-200 text-foreground-500 hover:text-primary-500 transition-colors cursor-pointer"
                      title="View"
                    >
                      <i className="ri-external-link-line text-sm"></i>
                    </a>
                    <button
                      onClick={() => {
                        if (window.confirm(`Delete "${article.title}"?`)) {
                          onDelete(article.id);
                        }
                      }}
                      className="w-8 h-8 flex items-center justify-center rounded hover:bg-red-50 text-foreground-500 hover:text-red-500 transition-colors cursor-pointer"
                      title="Delete"
                    >
                      <i className="ri-delete-bin-line text-sm"></i>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {articles.length === 0 && (
        <div className="text-center py-16">
          <i className="ri-inbox-line text-4xl text-foreground-300 block mb-3"></i>
          <p className="text-sm text-foreground-500">No articles match your filters</p>
        </div>
      )}
    </div>
  );
}