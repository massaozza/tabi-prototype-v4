// src/hooks/useContentTranslation.ts
// コンテンツ（Experience/Trip/Spot）の翻訳を取得するカスタムhook

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface TranslationResult {
  translatedFields: Record<string, string> | null;
  isLoading: boolean;
  isOriginal: boolean;
}

export function useContentTranslation(
  type: 'experience' | 'trip' | 'spot',
  id: string | undefined,
  originalLang = 'ja'
): TranslationResult {
  const { i18n } = useTranslation();
  const currentLang = i18n.language;
  const [translatedFields, setTranslatedFields] = useState<Record<string, string> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOriginal, setIsOriginal] = useState(false);

  useEffect(() => {
    if (!id) return;

    // 同一言語なら翻訳不要
    if (currentLang === originalLang || currentLang === 'en' && originalLang === 'en') {
      setIsOriginal(true);
      setTranslatedFields(null);
      return;
    }

    // 英語コンテンツを英語で見る場合も不要
    if (currentLang === originalLang) {
      setIsOriginal(true);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    fetch(`/api/translate-content?type=${type}&id=${encodeURIComponent(id)}&lang=${currentLang}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (cancelled) return;
        if (data?.translation) {
          setTranslatedFields(data.translation);
          setIsOriginal(data.isOriginal || false);
        }
      })
      .catch(() => {/* silent */})
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [type, id, currentLang, originalLang]);

  return { translatedFields, isLoading, isOriginal };
}

// 翻訳済みテキストを取得するユーティリティ
export function getTranslatedField(
  translatedFields: Record<string, string> | null,
  field: string,
  originalValue: string
): string {
  if (!translatedFields) return originalValue;
  return translatedFields[field] || originalValue;
}
