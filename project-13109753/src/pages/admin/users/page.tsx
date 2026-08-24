import { useState, useEffect, useMemo } from 'react';

interface AdminUser {
  uid: string;
  email: string;
  displayName: string;
  createdAt: string;
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function fetchUsers() {
      setLoading(true);
      setLoadError(false);
      try {
        const res = await fetch('/api/admin-users');
        if (!res.ok) throw new Error('Failed to fetch');
        const json = await res.json();
        if (!cancelled && Array.isArray(json.users)) {
          setUsers(json.users);
        }
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchUsers();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.trim().toLowerCase();
    return users.filter(
      (u) =>
        u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [users, search]);

  const handleExportCSV = () => {
    const headers = ['Display Name', 'Email', 'Registered', 'UID'];
    const rows = filtered.map((u) => [u.displayName, u.email, u.createdAt, u.uid]);
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join(
      '\n'
    );
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tabi-users-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground-900 font-heading">Users</h1>
          <p className="text-sm text-foreground-500 mt-1">
            {loading ? 'Loading users…' : `${users.length} registered ${users.length === 1 ? 'user' : 'users'}`}
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          disabled={filtered.length === 0}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-background-50 border border-background-300 rounded-lg text-foreground-700 hover:bg-background-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
        >
          <i className="ri-download-line text-sm"></i>
          Export CSV
        </button>
      </div>

      <div className="bg-background-50 rounded-lg border border-background-200 p-3">
        <div className="relative max-w-sm">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400 text-sm"></i>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email"
            className="w-full pl-9 pr-3 py-2 text-sm border border-background-300 rounded-lg bg-background-50 text-foreground-900 placeholder:text-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all"
          />
        </div>
      </div>

      {loading ? (
        <div className="bg-background-50 rounded-lg border border-background-200 p-8 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 bg-background-200 rounded animate-pulse"></div>
          ))}
        </div>
      ) : loadError ? (
        <div className="bg-background-50 rounded-lg border border-background-200 p-10 text-center">
          <i className="ri-error-warning-line text-4xl text-foreground-300 block mb-3"></i>
          <p className="text-sm text-foreground-600 mb-4">Failed to load users.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-sm bg-primary-500 text-background-50 rounded-lg hover:bg-primary-600 cursor-pointer whitespace-nowrap"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="bg-background-50 rounded-lg border border-background-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-background-100 border-b border-background-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-foreground-600 whitespace-nowrap">
                    Display Name
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-foreground-600 whitespace-nowrap">
                    Email
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-foreground-600 whitespace-nowrap">
                    Registered
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-foreground-600 whitespace-nowrap">
                    UID
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <tr
                    key={user.uid}
                    className="border-b border-background-200 hover:bg-background-100/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="text-foreground-900 font-medium">{user.displayName}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-foreground-600">{user.email}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-foreground-500 whitespace-nowrap">
                        {formatDate(user.createdAt)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-foreground-400">{user.uid}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-16">
              <i className="ri-user-search-line text-4xl text-foreground-300 block mb-3"></i>
              <p className="text-sm text-foreground-500">
                {users.length === 0 ? 'No registered users yet' : 'No users match your search'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
