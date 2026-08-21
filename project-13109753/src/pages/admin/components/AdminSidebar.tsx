import { NavLink, useLocation } from 'react-router-dom';

interface AdminSidebarProps {
  onLogout: () => void;
}

const sidebarLinks = [
  { to: '/admin/dashboard', icon: 'ri-dashboard-line', label: 'Dashboard' },
  { to: '/admin/articles', icon: 'ri-article-line', label: 'Articles' },
  { to: '/admin/articles/new', icon: 'ri-add-circle-line', label: 'New Article' },
  { to: '/admin/content', icon: 'ri-database-2-line', label: 'Content' },
  { to: '/admin/featured', icon: 'ri-star-line', label: 'Featured' },
];

export default function AdminSidebar({ onLogout }: AdminSidebarProps) {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/admin/dashboard') return location.pathname === '/admin/dashboard';
    if (path === '/admin/articles') return location.pathname === '/admin/articles';
    if (path === '/admin/articles/new') return location.pathname === '/admin/articles/new';
    if (path === '/admin/content') return location.pathname === '/admin/content';
    return location.pathname.startsWith(path);
  };

  return (
    <aside className="w-[220px] bg-background-900 flex flex-col h-screen sticky top-0 flex-shrink-0">
      <div className="p-5 border-b border-background-700/50">
        <h1 className="font-heading font-bold text-lg text-background-50 whitespace-nowrap">
          TABI <span className="text-primary-400">CMS</span>
        </h1>
        <p className="text-xs text-foreground-400 mt-0.5 whitespace-nowrap">Content Management</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {sidebarLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              isActive(link.to)
                ? 'bg-primary-500/20 text-primary-300'
                : 'text-foreground-400 hover:text-background-50 hover:bg-background-800'
            }`}
          >
            <i className={`${link.icon} text-base`}></i>
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-background-700/50">
        <button
          onClick={onLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground-400 hover:text-red-400 hover:bg-background-800 transition-colors w-full whitespace-nowrap cursor-pointer"
        >
          <i className="ri-logout-box-line text-base"></i>
          Logout
        </button>
      </div>
    </aside>
  );
}
