import { Outlet } from 'react-router-dom';
import { useAdminAuth } from './AdminAuth';
import AdminSidebar from './AdminSidebar';

export default function AdminLayout() {
  const { logout } = useAdminAuth();

  return (
    <div className="min-h-screen bg-background-100 flex">
      <AdminSidebar onLogout={logout} />
      <main className="flex-1 min-w-0">
        <div className="px-6 py-5 border-b border-background-200 bg-background-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <i className="ri-shield-check-line text-primary-500 text-lg"></i>
            <span className="text-sm font-medium text-foreground-600">Admin Dashboard</span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary-500 hover:text-primary-600 flex items-center gap-1 whitespace-nowrap cursor-pointer"
            >
              <i className="ri-external-link-line"></i>
              View Site
            </a>
          </div>
        </div>
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}