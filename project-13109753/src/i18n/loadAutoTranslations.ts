// src/i18n/loadAutoTranslations.ts
//
// 自動生成された auto.ts を「現在の言語の分だけ」遅延読み込みする。
//
// なぜ遅延にするか：
//   auto.ts は1言語あたり約34KB（gzip 17KB）ある。
//   10言語すべてを初期バンドルに含めると約150KB増えてしまい、
//   モバイル回線での初回表示が遅くなる。
//   実際に必要なのは表示中の1言語だけなので、動的importで取得する。
//
// 手書きの訳（common.ts / home.ts / pages.ts）は初期バンドルに含まれており、
// addResourceBundle の overwrite=false により auto.ts に上書きされない。

import i18n from 'i18next';

// eager: false（既定）なので、ここでは読み込み関数だけが登録される
const autoModules = import.meta.glob<{ default: Record<string, string> }>('./local/*/auto.ts');

const loaded = new Set<string>();

export async function loadAutoTranslations(lang: string): Promise<void> {
  if (!lang || loaded.has(lang)) return;

  const loader = autoModules[`./local/${lang}/auto.ts`];
  if (!loader) {
    // その言語のauto.tsがまだ生成されていない場合は何もしない
    loaded.add(lang);
    return;
  }

  loaded.add(lang);
  try {
    const mod = await loader();
    if (!mod?.default) return;
    // deep=true, overwrite=false … 既存の手書き訳を残す
    i18n.addResourceBundle(lang, 'translation', mod.default, true, false);
  } catch (e) {
    console.warn('[i18n] auto.ts の読み込みに失敗しました:', lang, e);
    loaded.delete(lang);
  }
}

/** URLの言語prefixを優先して現在の言語を判定する */
function currentLang(): string {
  const codes = Object.keys(autoModules)
    .map((p) => p.match(/\.\/local\/([^/]+)\/auto\.ts$/)?.[1])
    .filter((c): c is string => !!c);

  if (typeof window !== 'undefined') {
    const first = window.location.pathname.split('/').filter(Boolean)[0];
    if (first && codes.includes(first)) return first;
  }
  return i18n.language || 'en';
}

/** 起動時に呼ぶ。以後の言語切り替えにも追従する。 */
export function initAutoTranslations(): void {
  void loadAutoTranslations(currentLang());
  i18n.on('languageChanged', (lng) => {
    void loadAutoTranslations(lng);
  });
}
