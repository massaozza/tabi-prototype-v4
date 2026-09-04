import { useState, useEffect, useMemo } from 'react';

interface AdminExperience {
  id: string;
  placeName: string;
  area: string;
  category: string;
  uid: string;
  wouldRecommend: boolean;
  helpfulCount: number;
  createdAt: string;
}

function formatDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function AdminExperiencesPage() {
  const [experiences, setExperiences] = useState<AdminExperience[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<AdminExperience | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin-experiences')
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => { if (!cancelled) setExperiences(d.experiences || []); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return experiences;
    return experiences.filter((e) =>
      e.placeName?.toLowerCase().includes(q) ||
      e.area?.toLowerCase().includes(q) ||
      e.category?.toLowerCase().includes(q)
    );
  }, [experiences, search]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      const res = await fetch(`/api/admin-experiences?id=${encodeURIComponent(deleteTarget.id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setExperiences((prev) => prev.filter((e) => e.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      setDeleteError('Failed to delete. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground-900 font-heading">Experiences</h1>
          <p className="text-sm text-foreground-500 mt-1">
            {loading ? 'Loading…' : `${experiences.length} total experiences`}
          </p>
        </div>
      </div>

      <div className="bg-background-50 rounded-lg border border-background-200 p-3">
        <div className="relative max-w-sm">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400 text-sm"></i>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by place, area or category"
            className="w-full pl-9 pr-3 py-2 text-sm border border-background-300 rounded-lg bg-background-50 text-foreground-900 placeholder:text-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary-400" />
        </div>
      </div>

      {loading ? (
        <div className="bg-background-50 rounded-lg border border-background-200 p-8 space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-background-200 rounded animate-pulse"></div>)}
        </div>
      ) : error ? (
        <div className="bg-background-50 rounded-lg border border-background-200 p-10 text-center">
          <p className="text-sm text-foreground-500">Failed to load experiences.</p>
        </div>
      ) : (
        <div className="bg-background-50 rounded-lg border border-background-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-background-100 border-b border-background-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-foreground-600">Place</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-foreground-600">Area</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-foreground-600">Category</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-foreground-600">Helpful</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-foreground-600">Created</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((exp) => (
                  <tr key={exp.id} className="border-b border-background-200 hover:bg-background-100/50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground-900">{exp.placeName}</div>
                      {exp.wouldRecommend && (
                        <span className="text-xs text-green-600"><i className="ri-thumb-up-line mr-0.5"></i>Recommended</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-foreground-600">{exp.area || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium px-2 py-0.5 bg-primary-50 text-primary-700 rounded-full">{exp.category}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-foreground-600">{exp.helpfulCount}</td>
                    <td className="px-4 py-3 text-xs text-foreground-500 whitespace-nowrap">{formatDate(exp.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setDeleteTarget(exp)}
                        className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded cursor-pointer">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="text-center py-16">
              <p className="text-sm text-foreground-500">{experiences.length === 0 ? 'No experiences yet' : 'No experiences match your search'}</p>
            </div>
          )}
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h3 className="font-bold text-foreground-900 mb-2">Delete Experience?</h3>
            <p className="text-sm text-foreground-600 mb-1">「{deleteTarget.placeName}」を削除します。</p>
            <p className="text-xs text-red-600 mb-4">この操作は取り消せません。</p>
            {deleteError && <p className="text-xs text-red-600 mb-3">{deleteError}</p>}
            <div className="flex gap-3">
              <button onClick={() => { setDeleteTarget(null); setDeleteError(''); }}
                className="flex-1 py-2 text-sm border border-background-300 rounded-lg text-foreground-700 hover:bg-background-100 cursor-pointer">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 cursor-pointer">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
