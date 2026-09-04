// src/components/feature/LocalizedLink.tsx
// 言語prefixを自動付与するLinkコンポーネント
// 使い方: <LocalizedLink to="/experiences/xxx">...</LocalizedLink>
// → /ko/experiences/xxx のように現在の言語prefixが自動付与される

import { Link, type LinkProps } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const SUPPORTED_LANGS = ['en','ja','zh-TW','zh-CN','ko','th','fr','de','es','id'];

// 言語prefix対象のパス（Creator/Admin/MyTripは対象外）
const LOCALIZED_PATHS = [
  '/trips/', '/trips',
  '/experiences/', '/experiences',
  '/explore', '/destinations/',
  '/guides/', '/guides',
  '/regions/', '/prefectures/',
  '/creator/', '/blog', '/about',
];

function needsLangPrefix(path: string): boolean {
  // すでにprefixがある
  const parts = path.split('/').filter(Boolean);
  if (parts.length > 0 && SUPPORTED_LANGS.includes(parts[0])) return false;
  // 対象外パス
  if (path.startsWith('/my-trip') || path.startsWith('/creators') ||
      path.startsWith('/admin') || path.startsWith('/login') ||
      path.startsWith('/signup')) return false;
  // 対象パス
  return LOCALIZED_PATHS.some((p) => path.startsWith(p) || path === p.replace('/', ''));
}

export default function LocalizedLink({ to, ...props }: LinkProps) {
  const { i18n } = useTranslation();
  const lang = i18n.language || 'en';

  const toStr = typeof to === 'string' ? to : '';
  const localizedTo = toStr && needsLangPrefix(toStr)
    ? `/${lang}${toStr.startsWith('/') ? toStr : `/${toStr}`}`
    : to;

  return <Link to={localizedTo} {...props} />;
}
