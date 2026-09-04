// src/hooks/useBatchTranslation.ts
// 一覧ページで複数コンテンツの翻訳をまとめて取得するhook

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const SUPPORTED_LANGS = ['en','ja','zh-TW','zh-CN','ko','th','fr','de','es','id'];

function getLangFromUrl(fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const parts = window.location.pathname.split('/').filter(Boolean);
  if (parts.length > 0 && SUPPORTED_LANGS.includes(parts[0])) return parts[0];
  return fallback;
}

export function useBatchTranslation(
  type: 'region' | 'spot' | 'experience' | 'trip',
  ids: string[],
  originalLang = 'en'
): {
  translations: Record<string, Record<string, string>>;
  isLoading: boolean;
} {
  const { i18n } = useTranslation();
  const currentLang = getLangFromUrl(i18n.language || 'en');
  const [translations, setTranslations] = useState<Record<string, Record<string, string>>>({});
  const [isLoading, setIsLoading] = useState(false);

  const idsKey = ids.join(',');

  useEffect(() => {
    if (!ids.length) return;
    if (currentLang === originalLang) {
      setTranslations({});
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    // 各IDごとに翻訳を取得（並列）
    Promise.all(
      ids.map((id) =>
        fetch(`/api/translate-content?type=${type}&id=${encodeURIComponent(id)}&lang=${currentLang}`)
          .then((r) => r.ok ? r.json() : null)
          .then((data) => ({ id, translation: data?.translation || null }))
          .catch(() => ({ id, translation: null }))
      )
    ).then((results) => {
      if (cancelled) return;
      const map: Record<string, Record<string, string>> = {};
      for (const { id, translation } of results) {
        if (translation) map[id] = translation;
      }
      setTranslations(map);
    }).finally(() => {
      if (!cancelled) setIsLoading(false);
    });

    return () => { cancelled = true; };
  }, [type, idsKey, currentLang, originalLang]);

  return { translations, isLoading };
}

export function getBatchField(
  translations: Record<string, Record<string, string>>,
  id: string,
  field: string,
  original: string
): string {
  return translations[id]?.[field] || original;
}
