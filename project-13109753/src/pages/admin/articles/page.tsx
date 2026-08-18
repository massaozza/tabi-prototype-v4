import { useState, useMemo } from 'react';
import { adminArticles, categories, teamMembers, statusOptions } from '@/mocks/adminData';
import FilterBar, { Filters } from './components/FilterBar';
import ArticleTable from './components/ArticleTable';

const ITEMS_PER_PAGE = 50;

export default function ArticlesPage() {
  const [filters, setFilters] = useState<Filters>({
    search: '',
    status: '',
    category: '',
    assignedTo: '',
    sort: 'date-desc',
  });
  const [articles, setArticles] = useState(adminArticles);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let result = [...articles];

    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (a) => a.title.toLowerCase().includes(q) || a.targetKeyword.toLowerCase().includes(q)
      );
    }
    if (filters.status) {
      result = result.filter((a) => a.status === filters.status);
    }
    if (filters.category) {
      result = result.filter((a) => a.category === filters.category);
    }
    if (filters.assignedTo) {
      result = result.filter((a) => a.assignedTo === filters.assignedTo);
    }

    switch (filters.sort) {
      case 'date-desc':
        result.sort((a, b) => (b.publishedDate || '').localeCompare(a.publishedDate || ''));
        break;
      case 'date-asc':
        result.sort((a, b) => (a.publishedDate || '').localeCompare(b.publishedDate || ''));
        break;
      case 'pv-desc':
        result.sort((a, b) => b.monthlyPV - a.monthlyPV);
        break;
      case 'pv-asc':
        result.sort((a, b) => a.monthlyPV - b.monthlyPV);
        break;
      case 'revenue-desc':
        result.sort((a, b) => b.revenueEstimate - a.revenueEstimate);
        break;
      case 'status':
        result.sort((a, b) => a.status.localeCompare(b.status));
        break;
    }

    return result;
  }, [articles, filters]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const handleDelete = (id: string) => {
    setArticles((prev) => prev.filter((a) => a.id !== id));
  };

  const handleExportCSV = () => {
    const headers = ['Title', 'Slug', 'Category', 'Target Keyword', 'Assigned', 'Status', 'Published', 'Monthly PV', 'Revenue'];
    const rows = filtered.map((a) => [
      a.title,
      a.slug,
      a.category,
      a.targetKeyword,
      a.assignedTo,
      a.status,
      a.publishedDate || '',
      String(a.monthlyPV),
      String(a.revenueEstimate),
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jqg-articles-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground-900 font-heading">Articles</h1>
          <p className="text-sm text-foreground-500 mt-1">Manage all {articles.length} articles</p>
        </div>
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-background-50 border border-background-300 rounded-lg text-foreground-700 hover:bg-background-100 transition-colors cursor-pointer whitespace-nowrap"
        >
          <i className="ri-download-line text-sm"></i>
          Export CSV
        </button>
      </div>

      <FilterBar filters={filters} onChange={setFilters} totalResults={filtered.length} />

      <ArticleTable articles={paginated} onDelete={handleDelete} />

      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-background-50 rounded-lg border border-background-200 px-4 py-3">
          <span className="text-xs text-foreground-500">
            Showing {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm rounded-lg border border-background-200 text-foreground-600 hover:bg-background-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
            >
              Previous
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, totalPages - 4));
              const p = start + i;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-9 h-9 text-sm rounded-lg border cursor-pointer whitespace-nowrap ${
                    p === page
                      ? 'bg-primary-500 text-background-50 border-primary-500'
                      : 'border-background-200 text-foreground-600 hover:bg-background-100'
                  }`}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-sm rounded-lg border border-background-200 text-foreground-600 hover:bg-background-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}