import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { DEFAULT_ADMIN_PASSWORD } from '@/mocks/adminData';

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

  useEffect(() => {
    const stored = localStorage.getItem('jgq_admin_auth');
    if (stored) {
      try {
        const data = JSON.parse(stored);
        const now = Date.now();
        const eightHours = 8 * 60 * 60 * 1000;
        if (data.timestamp && now - data.timestamp < eightHours) {
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem('jgq_admin_auth');
        }
      } catch {
        localStorage.removeItem('jgq_admin_auth');
      }
    }
    setChecked(true);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('jgq_admin_auth');
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    setTimeout(() => {
      const storedPassword = localStorage.getItem('jgq_admin_password') || DEFAULT_ADMIN_PASSWORD;
      if (password === storedPassword) {
        localStorage.setItem('jgq_admin_auth', JSON.stringify({ timestamp: Date.now() }));
        onLogin();
      } else {
        setError('Incorrect password. Please try again.');
      }
      setLoading(false);
    }, 600);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background-100">
      <div className="w-full max-w-sm mx-4">
        <div className="bg-background-50 rounded-xl border border-background-200 p-8">
          <div className="text-center mb-8">
            <h1 className="font-heading font-bold text-2xl text-foreground-900">
              JQG <span className="text-primary-500">CMS</span>
            </h1>
            <p className="text-sm text-foreground-500 mt-2">Japan Quest Guide Admin</p>
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