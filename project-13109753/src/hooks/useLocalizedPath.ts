// src/hooks/useLocalizedPath.ts
// 現在の言語prefixを自動で付けるhook

import { useTranslation } from 'react-i18next';

export function useLocalizedPath() {
  const { i18n } = useTranslation();
  const lang = i18n.language || 'en';

  // /path → /en/path のように変換
  const localizedPath = (path: string): string => {
    // すでに言語prefixがついている場合はそのまま
    const supportedLangs = ['en','ja','zh-TW','zh-CN','ko','th','fr','de','es','id'];
    const parts = path.split('/').filter(Boolean);
    if (parts.length > 0 && supportedLangs.includes(parts[0])) {
      return path;
    }
    return `/${lang}${path.startsWith('/') ? path : `/${path}`}`;
  };

  return { localizedPath, lang };
}
