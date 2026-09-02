import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

// TABI 3.0：日本人クリエイター向けの、既存の（英語・外国人向け）Navbarとは
// 別の専用ナビゲーション。/creators 以下のページでのみ使用する。
export default function CreatorNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { user, loading, logout } = useAuth();

  const handleLogout = async () => {
    setUserMenuOpen(false);
    await logout();
  };

  return (
    <header className="bg-foreground-900 text-white">
      <nav className="flex items-center justify-between px-6 md:px-10 py-4">
        <a href="/creators" className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center">
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

          {loading ? null : user ? (
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-1.5 text-sm font-semibold text-white/90 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
              >
                {user.displayName}
                <i className={`text-sm transition-transform ${userMenuOpen ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'}`}></i>
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-2 min-w-[160px] bg-background-50 border border-background-200 rounded-md py-1 shadow-lg">
                  <a
                    href="/creators/dashboard"
                    onClick={() => setUserMenuOpen(false)}
                    className="block w-full text-left px-4 py-2.5 text-sm text-foreground-700 hover:bg-background-100 hover:text-foreground-900 transition-colors whitespace-nowrap"
                  >
                    マイページ
                  </a>
                  <a
                    href={`/creator/${user.uid}`}
                    onClick={() => setUserMenuOpen(false)}
                    className="block w-full text-left px-4 py-2.5 text-sm text-foreground-700 hover:bg-background-100 hover:text-foreground-900 transition-colors whitespace-nowrap"
                  >
                    プロフィール
                  </a>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2.5 text-sm text-foreground-700 hover:bg-background-100 hover:text-foreground-900 transition-colors whitespace-nowrap cursor-pointer border-t border-background-200"
                  >
                    ログアウト
                  </button>
                </div>
              )}
            </div>
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
            className="text-xs text-white/40 hover:text-white/70 transition-colors whitespace-nowrap"
          >
            International site →
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
          {!loading && user && (
            <>
              <span className="text-white/50 text-sm">{user.displayName}</span>
              <a href="/creators/dashboard" className="text-sm font-semibold text-white/90" onClick={() => setMobileOpen(false)}>
                マイページ
              </a>
              <a href={`/creator/${user.uid}`} className="text-sm font-semibold text-white/90" onClick={() => setMobileOpen(false)}>
                プロフィール
              </a>
            </>
          )}
          {loading ? null : user ? (
            <button onClick={() => { setMobileOpen(false); handleLogout(); }} className="text-left text-sm font-semibold text-white/60 cursor-pointer">
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
