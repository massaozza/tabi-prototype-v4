// src/components/feature/LocalizedLink.tsx
// 言語prefixを自動付与するLinkコンポーネント
// 使い方: <LocalizedLink to="/experiences/xxx">...</LocalizedLink>
// → /ko/experiences/xxx のように現在の言語prefixが自動付与される

import { Link, type LinkProps } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useParams, useLocation } from 'react-router-dom';

const SUPPORTED_LANGS = ['en','ja','zh-TW','zh-CN','ko','th','fr','de','es','id'];

const LOCALIZED_PATHS = [
  '/trips/', '/trips',
  '/experiences/', '/experiences',
  '/explore', '/destinations/',
  '/guides/', '/guides',
  '/regions/', '/prefectures/',
  '/creator/', '/blog', '/about',
];

function needsLangPrefix(path: string): boolean {
  const parts = path.split('/').filter(Boolean);
  if (parts.length > 0 && SUPPORTED_LANGS.includes(parts[0])) return false;
  if (path.startsWith('/my-trip') || path.startsWith('/creators') ||
      path.startsWith('/admin') || path.startsWith('/login') ||
      path.startsWith('/signup')) return false;
  return LOCALIZED_PATHS.some((p) => path.startsWith(p) || path === p.replace('/', ''));
}

// 現在のURLから言語コードを取得する
function useLangFromUrl(): string {
  const location = useLocation();
  const parts = location.pathname.split('/').filter(Boolean);
  if (parts.length > 0 && SUPPORTED_LANGS.includes(parts[0])) {
    return parts[0];
  }
  return 'en';
}

export default function LocalizedLink({ to, ...props }: LinkProps) {
  const lang = useLangFromUrl();

  const toStr = typeof to === 'string' ? to : '';
  const localizedTo = toStr && needsLangPrefix(toStr)
    ? `/${lang}${toStr.startsWith('/') ? toStr : `/${toStr}`}`
    : to;

  return <Link to={localizedTo} {...props} />;
}
