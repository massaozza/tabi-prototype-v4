// src/hooks/useContentTranslation.ts
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface TranslationResult {
  translatedFields: Record<string, string> | null;
  isLoading: boolean;
  isOriginal: boolean;
}

const SUPPORTED_LANGS = ['en','ja','zh-TW','zh-CN','ko','th','fr','de','es','id'];

export function useContentTranslation(
  type: 'experience' | 'trip' | 'spot',
  id: string | undefined,
  originalLang = 'ja'
): TranslationResult {
  const { i18n } = useTranslation();

  // URLから言語を取得（i18n.languageより信頼性が高い）
  const getLangFromUrl = () => {
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (parts.length > 0 && SUPPORTED_LANGS.includes(parts[0])) return parts[0];
    return i18n.language || 'en';
  };

  const [currentLang, setCurrentLang] = useState(getLangFromUrl);
  const [translatedFields, setTranslatedFields] = useState<Record<string, string> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOriginal, setIsOriginal] = useState(false);

  // i18n言語変更を監視
  useEffect(() => {
    setCurrentLang(getLangFromUrl());
  }, [i18n.language]);

  useEffect(() => {
    if (!id) return;

    // 現在の言語とコンテンツの原語が同じなら翻訳不要
    if (currentLang === originalLang) {
      setIsOriginal(true);
      setTranslatedFields(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setTranslatedFields(null);

    fetch(`/api/translate-content?type=${type}&id=${encodeURIComponent(id)}&lang=${currentLang}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((data) => {
        if (cancelled) return;
        if (data?.translation) {
          setTranslatedFields(data.translation);
          setIsOriginal(data.isOriginal || false);
        }
      })
      .catch((err) => {
        console.warn('[useContentTranslation] failed:', type, id, currentLang, err);
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [type, id, currentLang, originalLang]);

  return { translatedFields, isLoading, isOriginal };
}

export function getTranslatedField(
  translatedFields: Record<string, string> | null,
  field: string,
  originalValue: string
): string {
  if (!translatedFields) return originalValue;
  return translatedFields[field] || originalValue;
}
