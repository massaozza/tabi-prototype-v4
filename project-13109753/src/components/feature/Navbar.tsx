import LocalizedLink from '@/components/feature/LocalizedLink';
import { useState, useEffect, useRef } from 'react';
import { navLinks } from '@/mocks/homeData';
import LogoMark from '@/components/feature/LogoMark';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { SUPPORTED_LANGUAGES } from '@/i18n/index';

export default function Navbar({ variant }: { variant?: 'default' | 'dark' } = {}) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);
  const { user, loading, logout } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const SUPPORTED_CODES = SUPPORTED_LANGUAGES.map((l) => l.code);

  // 言語切替：i18nを変えてURLも書き換える
  const handleLanguageChange = (langCode: string) => {
    i18n.changeLanguage(langCode);
    setLangMenuOpen(false);
    // 現在のURLから言語prefixを検出して入れ替え
    const pathParts = location.pathname.split('/').filter(Boolean);
    if (pathParts.length > 0 && SUPPORTED_CODES.includes(pathParts[0] as any)) {
      // 既存の言語prefixを新しい言語に置換
      pathParts[0] = langCode;
      navigate('/' + pathParts.join('/') + (location.search || ''), { replace: false });
    } else {
      // 言語prefixがない場合（/login等）は言語TOPへ
      navigate('/' + langCode, { replace: false });
    }
  };

  const currentLang = SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language)
    || SUPPORTED_LANGUAGES[0];

  // 言語メニュー外クリックで閉じる
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) {
        setLangMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // variant='dark' のときは常にダークネイビー背景で表示（透過なし）
  const isDark = variant === 'dark';

  useEffect(() => {
    if (isDark) return; // darkモードはscroll不要
    const handleScroll = () => {
      setScrolled(window.scrollY > 60);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isDark]);

  const handleLogout = async () => {
    setUserMenuOpen(false);
    await logout();
  };

  return (
    <header
      className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${
        isDark
          ? 'bg-foreground-900'
          : scrolled
          ? 'bg-background-50 shadow-sm'
          : 'bg-transparent'
      }`}
    >
      <div className={`hidden md:flex items-center justify-between px-6 md:px-10 py-2 text-xs gap-4 transition-colors duration-300 ${
        isDark || !scrolled ? 'text-white/80' : 'text-foreground-600 border-b border-background-200'
      }`}>
        <a href="/creators" className="hover:opacity-70 transition-opacity whitespace-nowrap">
          日本の方はこちら →
        </a>
        <div className="flex items-center gap-4">
          <span className="whitespace-nowrap">Follow our journey</span>
          <a href="#" className="w-5 h-5 flex items-center justify-center hover:opacity-70 transition-opacity" aria-label="Instagram"><i className="ri-instagram-line text-sm"></i></a>
          <a href="#" className="w-5 h-5 flex items-center justify-center hover:opacity-70 transition-opacity" aria-label="Pinterest"><i className="ri-pinterest-line text-sm"></i></a>
          <a href="#" className="w-5 h-5 flex items-center justify-center hover:opacity-70 transition-opacity" aria-label="Reddit"><i className="ri-reddit-line text-sm"></i></a>
          <a href="#" className="w-5 h-5 flex items-center justify-center hover:opacity-70 transition-opacity" aria-label="YouTube"><i className="ri-youtube-line text-sm"></i></a>
        </div>
      </div>

      <nav className="flex items-center justify-between px-6 md:px-10 py-3 md:py-4">
        <a href="/en" className="flex items-center gap-3">
          <LogoMark />
          <h1 className={`font-heading font-bold text-xl md:text-2xl tracking-[0.08em] leading-none transition-colors duration-300 ${
            (isDark || !scrolled) ? 'text-white' : 'text-foreground-900'
          }`}>
            TABI47
          </h1>
        </a>

        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((link) =>
            link.label === 'Plan with AI' ? (
              <button
                key={link.label}
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('tabi:open-chat'))}
                className={`text-sm font-semibold whitespace-nowrap transition-colors duration-300 hover:opacity-70 cursor-pointer ${
                  (isDark || !scrolled) ? 'text-white' : 'text-foreground-800'
                }`}
              >
                {link.label}
              </button>
            ) : (
              <LocalizedLink key={link.label} to={link.href} className={`text-sm font-semibold whitespace-nowrap transition-colors duration-300 hover:opacity-70 ${
                  (isDark || !scrolled) ? 'text-white' : 'text-foreground-800'
                }`}>
                {link.label}
              </LocalizedLink>
            )
          )}

          <div className="hidden md:flex items-center gap-5">
            {/* 言語切替ドロップダウン */}
            <div className="relative" ref={langMenuRef}>
              <button
                onClick={() => setLangMenuOpen(!langMenuOpen)}
                className={`flex items-center gap-1 text-sm font-medium whitespace-nowrap transition-colors duration-300 hover:opacity-70 ${
                  (isDark || !scrolled) ? 'text-white/80' : 'text-foreground-600'
                }`}
                aria-label={t('common.language')}
              >
                <i className="ri-global-line text-base"></i>
                <span>{currentLang.label}</span>
                <i className={`text-xs transition-transform ${langMenuOpen ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'}`}></i>
              </button>
              {langMenuOpen && (
                <div className="absolute right-0 top-full mt-2 min-w-[180px] bg-white border border-background-200 rounded-xl py-1.5 shadow-lg z-50">
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => handleLanguageChange(lang.code)}
                      className={`w-full text-left px-4 py-2 text-sm transition-colors cursor-pointer ${
                        i18n.language === lang.code
                          ? 'text-primary-600 font-semibold bg-primary-50'
                          : 'text-foreground-700 hover:bg-background-50'
                      }`}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {loading ? null : user ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className={`flex items-center gap-1.5 text-sm font-semibold whitespace-nowrap transition-colors duration-300 hover:opacity-70 ${
                    (isDark || !scrolled) ? 'text-white' : 'text-foreground-800'
                  }`}
                >
                  {user.displayName}
                  <i className={`text-sm transition-transform ${userMenuOpen ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'}`}></i>
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 min-w-[160px] bg-background-50 border border-background-200 rounded-md py-1">
                    <a
                      href="/my-trip"
                      onClick={() => setUserMenuOpen(false)}
                      className="block w-full text-left px-4 py-2.5 text-sm text-foreground-700 hover:bg-background-100 hover:text-foreground-900 transition-colors whitespace-nowrap"
                    >
                      My Trip
                    </a>
                    <a
                      href={`/creator/${user.uid}`}
                      onClick={() => setUserMenuOpen(false)}
                      className="block w-full text-left px-4 py-2.5 text-sm text-foreground-700 hover:bg-background-100 hover:text-foreground-900 transition-colors whitespace-nowrap"
                    >
                      Profile
                    </a>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2.5 text-sm text-foreground-700 hover:bg-background-100 hover:text-foreground-900 transition-colors whitespace-nowrap cursor-pointer border-t border-background-200"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <a href="/login" className={`text-sm font-semibold whitespace-nowrap transition-colors duration-300 hover:opacity-70 ${
                    (isDark || !scrolled) ? 'text-white' : 'text-foreground-800'
                  }`}>
                  Log in
                </a>
                <a href="/signup" className="bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm px-4 py-2 rounded-md transition-all duration-200 whitespace-nowrap cursor-pointer">
                  Sign up
                </a>
              </>
            )}
          </div>
        </div>

        <button
          className={`md:hidden w-8 h-8 flex items-center justify-center transition-colors duration-300 ${
            (isDark || !scrolled) ? 'text-white' : 'text-foreground-900'
          }`}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          <i className={`text-xl ${mobileOpen ? 'ri-close-line' : 'ri-menu-line'}`}></i>
        </button>
      </nav>

      {mobileOpen && (
        <div className="md:hidden bg-background-50 border-t border-background-200 px-6 py-4 flex flex-col gap-3">
          {navLinks.map((link) =>
            link.label === 'Plan with AI' ? (
              <button
                key={link.label}
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  window.dispatchEvent(new CustomEvent('tabi:open-chat'));
                }}
                className="text-left text-foreground-800 text-sm font-semibold whitespace-nowrap hover:text-primary-500 transition-colors cursor-pointer"
              >
                {link.label}
              </button>
            ) : (
              <LocalizedLink key={link.label} to={link.href} className="text-foreground-800 text-sm font-semibold whitespace-nowrap hover:text-primary-500 transition-colors" onClick={() => setMobileOpen(false)}>
                {link.label}
              </LocalizedLink>
            )
          )}

          <div className="flex flex-col gap-3 pt-3 border-t border-background-200">
            {loading ? null : user ? (
              <>
                <span className="text-foreground-500 text-sm">{user.displayName}</span>
                <a href="/my-trip" onClick={() => setMobileOpen(false)} className="text-foreground-800 text-sm font-semibold whitespace-nowrap hover:text-primary-500 transition-colors">
                  My Trip
                </a>
                <a href={`/creator/${user.uid}`} onClick={() => setMobileOpen(false)} className="text-foreground-800 text-sm font-semibold whitespace-nowrap hover:text-primary-500 transition-colors">
                  Profile
                </a>
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    handleLogout();
                  }}
                  className="text-left text-primary-500 hover:text-primary-600 text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer"
                >
                  Logout
                </button>
              </>
            ) : (
              <div className="flex items-center gap-4">
                <a href="/login" className="text-foreground-800 text-sm font-semibold whitespace-nowrap hover:text-primary-500 transition-colors" onClick={() => setMobileOpen(false)}>
                  Log in
                </a>
                <a href="/signup" className="bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm px-4 py-2 rounded-md transition-all duration-200 whitespace-nowrap cursor-pointer" onClick={() => setMobileOpen(false)}>
                  Sign up
                </a>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 pt-2 border-t border-background-200">
            <a href="#" className="w-6 h-6 flex items-center justify-center text-foreground-500 hover:text-primary-500 transition-colors" aria-label="Instagram"><i className="ri-instagram-line"></i></a>
            <a href="#" className="w-6 h-6 flex items-center justify-center text-foreground-500 hover:text-primary-500 transition-colors" aria-label="Pinterest"><i className="ri-pinterest-line"></i></a>
            <a href="#" className="w-6 h-6 flex items-center justify-center text-foreground-500 hover:text-primary-500 transition-colors" aria-label="Reddit"><i className="ri-reddit-line"></i></a>
            <a href="#" className="w-6 h-6 flex items-center justify-center text-foreground-500 hover:text-primary-500 transition-colors" aria-label="YouTube"><i className="ri-youtube-line"></i></a>
          </div>
        </div>
      )}
    </header>
  );
}
