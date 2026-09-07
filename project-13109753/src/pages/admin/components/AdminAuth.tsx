import { useState, useEffect, createContext, useContext, useCallback } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  logout: () => void;
}

export const AdminAuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  logout: () => {},
});

export function useAdminAuth() {
  return useContext(AdminAuthContext);
}

interface AdminAuthProviderProps {
  children: React.ReactNode;
}

export function AdminAuthProvider({ children }: AdminAuthProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checked, setChecked] = useState(false);

  // 【重要】以前は localStorage の値だけで認証済みと判断していた。
  // それはブラウザ内で完結する仕組みで、画面を隠すだけの効果しかなく、
  // APIを直接叩けば誰でもデータを読み書きできた。
  // 現在は HttpOnly Cookie のセッションをサーバーに問い合わせて判定する。
  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin-auth', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setIsAuthenticated(Boolean(d?.authenticated));
      })
      .catch(() => {
        if (!cancelled) setIsAuthenticated(false);
      })
      .finally(() => {
        if (!cancelled) setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const logout = useCallback(() => {
    // Cookieはサーバー側でしか消せないのでAPIに依頼する
    void fetch('/api/admin-auth', { method: 'DELETE', credentials: 'include' }).catch(() => {});
    // 古い実装が残した値も掃除しておく
    try {
      localStorage.removeItem('tabi47_admin_auth');
      localStorage.removeItem('tabi47_admin_password');
    } catch {
      /* noop */
    }
    setIsAuthenticated(false);
  }, []);

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-50">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-foreground-500">Loading...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AdminLoginScreen onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <AdminAuthContext.Provider value={{ isAuthenticated, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

function AdminLoginScreen({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // パスワードの照合はサーバー側で行う。
    // 成功すると HttpOnly Cookie が発行され、以後のAPI呼び出しが通る。
    try {
      const res = await fetch('/api/admin-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        onLogin();
        return;
      }

      const data = await res.json().catch(() => null);
      if (res.status === 429) {
        setError('Too many attempts. Please wait a few minutes.');
      } else if (res.status === 503) {
        setError(
          'Admin login is not configured on the server (ADMIN_PASSWORD / ADMIN_SESSION_SECRET).'
        );
      } else {
        setError(data?.error || 'Incorrect password. Please try again.');
      }
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background-100">
      <div className="w-full max-w-sm mx-4">
        <div className="bg-background-50 rounded-xl border border-background-200 p-8">
          <div className="text-center mb-8">
            <h1 className="font-heading font-bold text-2xl text-foreground-900">
              TABI47 <span className="text-primary-500">Admin</span>
            </h1>
            <p className="text-sm text-foreground-500 mt-2">TABI47 Admin Console</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="admin-password" className="block text-sm font-medium text-foreground-700 mb-1.5">
                Admin Password
              </label>
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 text-sm border border-background-300 rounded-lg bg-background-50 text-foreground-900 placeholder:text-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all"
                placeholder="Enter admin password"
                autoFocus
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 mb-4 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full py-2.5 bg-primary-500 text-background-50 rounded-lg text-sm font-semibold hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap cursor-pointer"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-foreground-400 mt-6">
          Internal use only — authorized team members
        </p>
      </div>
    </div>
  );
}