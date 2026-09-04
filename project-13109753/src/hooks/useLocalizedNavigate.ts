// src/hooks/useLocalizedNavigate.ts
// 言語prefixを自動付与するnavigateラッパー

import { useNavigate, useLocation } from 'react-router-dom';

const SUPPORTED_LANGS = ['en','ja','zh-TW','zh-CN','ko','th','fr','de','es','id'];

const SKIP_PATHS = ['/my-trip','/creators','/admin','/login','/signup','/share',
  '/privacy-policy','/affiliate-disclosure','/disclaimer'];

function needsLangPrefix(path: string): boolean {
  const parts = path.split('/').filter(Boolean);
  if (parts.length > 0 && SUPPORTED_LANGS.includes(parts[0])) return false;
  return !SKIP_PATHS.some((p) => path.startsWith(p));
}

function getLangFromPathname(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length > 0 && SUPPORTED_LANGS.includes(parts[0])) return parts[0];
  return 'en';
}

export function useLocalizedNavigate() {
  const navigate = useNavigate();
  const location = useLocation();
  const lang = getLangFromPathname(location.pathname);

  return (to: string, options?: Parameters<typeof navigate>[1]) => {
    const localizedTo = needsLangPrefix(to)
      ? `/${lang}${to.startsWith('/') ? to : `/${to}`}`
      : to;
    navigate(localizedTo, options);
  };
}
