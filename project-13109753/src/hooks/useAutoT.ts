// src/hooks/useAutoT.ts
// 既存の t(key, 'English') と同じ書き味のまま、
// 翻訳ファイルに無いキーを自動翻訳でカバーするフック。
//
//   const t = useAutoT();
//   <h1>{t('hero_title', 'Discover Japan')}</h1>
//
// 優先順位：
//   1. src/i18n/local/{lang}/*.ts に手で書いた訳（あればこれを使う）
//   2. 自動翻訳のキャッシュ（/api/translate-ui → KV → localStorage）
//   3. 英語原文（取得が終わるまでの一時表示）

import { useCallback, useEffect, useReducer } from 'react';
import { useTranslation } from 'react-i18next';
import { autoTranslator, resolveLang } from '@/i18n/autoTranslator';

export type AutoT = (key: string, defaultText?: string) => string;

export function useAutoT(): AutoT {
  const { t, i18n } = useTranslation();
  const [, bump] = useReducer((x: number) => x + 1, 0);

  const lang = resolveLang(i18n.language);

  useEffect(() => autoTranslator.subscribe(bump), []);

  return useCallback(
    (key: string, defaultText?: string): string => {
      // 1. その言語に手書きの訳があるか
      const curated = i18n.getResource(lang, 'translation', key);
      if (typeof curated === 'string' && curated.trim()) return curated;

      // defaultTextが無いキーは従来通りi18nextに任せる
      if (defaultText === undefined) {
        return t(key);
      }

      if (lang === 'en') return defaultText;

      // 2. 自動翻訳キャッシュ
      const auto = autoTranslator.get(lang, defaultText);
      if (auto) return auto;

      // 3. 未取得ならキューに積んで、いったん英語を表示
      autoTranslator.request(lang, defaultText);
      return defaultText;
    },
    [t, i18n, lang]
  );
}

export default useAutoT;

/**
 * DBコンテンツなど「キーを持たない任意の文字列」を翻訳するフック。
 *
 *   const tx = useAutoText();
 *   <h3>{tx(spot.title)}</h3>
 *   <p>{tx(spot.description)}</p>
 *
 * 原文が英語でも日本語でも、現在の言語に自動翻訳される。
 * 翻訳結果はKV + localStorageにキャッシュされるので2回目以降は即時。
 */
export function useAutoText(): (value?: string | null) => string {
  const { i18n } = useTranslation();
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const lang = resolveLang(i18n.language);

  useEffect(() => autoTranslator.subscribe(bump), []);

  return useCallback(
    (value?: string | null): string => {
      if (typeof value !== 'string' || !value.trim()) return (value as string) || '';
      if (lang === 'en' && !/[\u3040-\u30ff\u4e00-\u9fff]/.test(value)) return value;

      const auto = autoTranslator.get(lang, value);
      if (auto) return auto;

      autoTranslator.request(lang, value);
      return value;
    },
    [lang]
  );
}
