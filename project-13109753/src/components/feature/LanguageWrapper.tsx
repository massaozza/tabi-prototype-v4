// src/components/feature/LanguageWrapper.tsx
// /:lang/* ルートのWrapper。
// URLの言語コードをi18nに同期し、未対応言語はenにフォールバックする。

import { useEffect } from 'react';
import { useParams, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, type SupportedLanguageCode } from '@/i18n/index';

const SUPPORTED_CODES = SUPPORTED_LANGUAGES.map((l) => l.code);

export default function LanguageWrapper() {
  const { lang } = useParams<{ lang: string }>();
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!lang) return;
    if (!SUPPORTED_CODES.includes(lang as SupportedLanguageCode)) {
      // 未対応言語 → /en/... にリダイレクト
      const newPath = location.pathname.replace(`/${lang}/`, '/en/').replace(`/${lang}`, '/en');
      navigate(newPath, { replace: true });
      return;
    }
    // i18nの言語をURLに合わせる
    if (i18n.language !== lang) {
      i18n.changeLanguage(lang);
    }
  }, [lang, i18n, navigate, location.pathname]);

  return <Outlet />;
}
