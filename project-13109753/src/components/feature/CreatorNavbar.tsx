import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

export default function CreatorNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, loading, logout } = useAuth();

  return (
    <header className="bg-foreground-900 text-white relative">
      <div className="h-0.5 w-full bg-gradient-to-r from-primary-500 via-accent-400 to-primary-500" />
      <nav className="flex items-center justify-between px-6 md:px-10 py-4">
        <a href="/creators" className="flex items-center gap-2.5 group">
          <span className="w-9 h-9 rounded-full bg-primary-500 flex items-center justify-center ring-1 ring-white/20 transition-transform duration-300 group-hover:scale-105">
            <i className="ri-store-2-line text-white text-sm"></i>
          </span>
          <span className="font-heading font-bold text-lg tracking-wide">
            TABI <span className="text-white/50 text-xs font-normal ml-1">Creators</span>
          </span>
        </a>

        <div className="hidden md:flex items-center gap-6">
          <a href="/share" className="text-sm font-semibold text-white/90 hover:text-white transition-colors whitespace-nowrap">
            投稿する
          </a>
          <a href="/creators/dashboard" className="text-sm font-semibold text-white/90 hover:text-white transition-colors whitespace-nowrap">
            マイページ
          </a>
          {!loading && user && (
            <a
              href={`/creator/${user.uid}`}
              className="text-sm font-semibold text-white/90 hover:text-white transition-colors whitespace-nowrap"
            >
              プロフィール
            </a>
          )}
          {loading ? null : user ? (
            <button
              onClick={() => logout()}
              className="text-sm font-semibold text-white/60 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              ログアウト
            </button>
          ) : (
            <a
              href="/login"
              className="bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm px-4 py-2 rounded-md transition-colors whitespace-nowrap cursor-pointer"
            >
              ログイン
            </a>
          )}
          <a
            href="/"
            className="inline-flex items-center gap-1 text-xs font-medium text-white/40 hover:text-white/80 transition-colors whitespace-nowrap border border-white/15 rounded-full px-3 py-1.5 hover:border-white/30"
          >
            International site
            <i className="ri-arrow-right-up-line text-[11px]"></i>
          </a>
        </div>

        <button
          className="md:hidden w-8 h-8 flex items-center justify-center text-white"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="メニュー"
        >
          <i className={`text-xl ${mobileOpen ? 'ri-close-line' : 'ri-menu-line'}`}></i>
        </button>
      </nav>

      {mobileOpen && (
        <div className="md:hidden bg-foreground-800 px-6 py-4 flex flex-col gap-3">
          <a href="/share" className="text-sm font-semibold text-white/90" onClick={() => setMobileOpen(false)}>
            投稿する
          </a>
          <a href="/creators/dashboard" className="text-sm font-semibold text-white/90" onClick={() => setMobileOpen(false)}>
            マイページ
          </a>
          {!loading && user && (
            <a href={`/creator/${user.uid}`} className="text-sm font-semibold text-white/90" onClick={() => setMobileOpen(false)}>
              プロフィール
            </a>
          )}
          {loading ? null : user ? (
            <button onClick={() => logout()} className="text-left text-sm font-semibold text-white/60 cursor-pointer">
              ログアウト
            </button>
          ) : (
            <a href="/login" className="text-sm font-semibold text-primary-300" onClick={() => setMobileOpen(false)}>
              ログイン
            </a>
          )}
          <a href="/" className="text-xs text-white/40" onClick={() => setMobileOpen(false)}>
            International site →
          </a>
        </div>
      )}
    </header>
  );
}