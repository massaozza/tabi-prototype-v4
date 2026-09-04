import { useState, useEffect, useMemo } from 'react';

interface AdminTrip {
  id: string;
  title: string;
  status: string;
  uid: string;
  authorName?: string;
  createdAt: string;
  isPublic: boolean;
  tripType?: string;a
  saveCount: number;
  copyCount: number;
}

function formatDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

const STATUS_COLOR: Record<string, string> = {
  published: 'bg-green-50 text-green-700 border-green-200',
  planning: 'bg-blue-50 text-blue-700 border-blue-200',
  traveling: 'bg-amber-50 text-amber-700 border-amber-200',
  completed: 'bg-background-100 text-foreground-600 border-background-200',
};

export default function AdminTripsPage() {
  const [trips, setTrips] = useState<AdminTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<AdminTrip | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin-trips')
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => { if (!cancelled) setTrips(d.trips || []); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return trips;
    return trips.filter((t) =>
      t.title?.toLowerCase().includes(q) ||
      t.authorName?.toLowerCase().includes(q) ||
      t.uid?.toLowerCase().includes(q)
    );
  }, [trips, search]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      const res = await fetch(`/api/admin-trips?id=${encodeURIComponent(deleteTarget.id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setTrips((prev) => prev.filter((t) => t.id !== deleteTarget.id));
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
          <h1 className="text-xl font-bold text-foreground-900 font-heading">Trips</h1>
          <p className="text-sm text-foreground-500 mt-1">
            {loading ? 'Loading…' : `${trips.length} total trips`}
          </p>
        </div>
      </div>

      <div className="bg-background-50 rounded-lg border border-background-200 p-3">
        <div className="relative max-w-sm">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400 text-sm"></i>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or creator"
            className="w-full pl-9 pr-3 py-2 text-sm border border-background-300 rounded-lg bg-background-50 text-foreground-900 placeholder:text-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary-400" />
        </div>
      </div>

      {loading ? (
        <div className="bg-background-50 rounded-lg border border-background-200 p-8 space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-background-200 rounded animate-pulse"></div>)}
        </div>
      ) : error ? (
        <div className="bg-background-50 rounded-lg border border-background-200 p-10 text-center">
          <p className="text-sm text-foreground-500">Failed to load trips.</p>
        </div>
      ) : (
        <div className="bg-background-50 rounded-lg border border-background-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-background-100 border-b border-background-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-foreground-600">Title</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-foreground-600">Creator</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-foreground-600">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-foreground-600">Saves / Copies</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-foreground-600">Created</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((trip) => (
                  <tr key={trip.id} className="border-b border-background-200 hover:bg-background-100/50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground-900 max-w-xs truncate">{trip.title || '(No title)'}</div>
                      <div className="text-xs font-mono text-foreground-300 mt-0.5">{trip.id}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-foreground-600">{trip.authorName || trip.uid?.slice(0, 8) + '…'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLOR[trip.status] || STATUS_COLOR.planning}`}>
                        {trip.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-foreground-600">{trip.saveCount} / {trip.copyCount}</td>
                    <td className="px-4 py-3 text-xs text-foreground-500 whitespace-nowrap">{formatDate(trip.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setDeleteTarget(trip)}
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
              <p className="text-sm text-foreground-500">{trips.length === 0 ? 'No trips yet' : 'No trips match your search'}</p>
            </div>
          )}
        </div>
      )}

      {/* 削除確認モーダル */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h3 className="font-bold text-foreground-900 mb-2">Delete Trip?</h3>
            <p className="text-sm text-foreground-600 mb-1">「{deleteTarget.title}」を削除します。</p>
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
