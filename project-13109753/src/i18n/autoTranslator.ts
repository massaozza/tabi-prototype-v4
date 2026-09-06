// src/i18n/autoTranslator.ts
// 翻訳ファイルに無いUI文言を自動翻訳するためのランタイム。
//
// 仕組み：
//   1. 画面が必要とした英語原文を集める
//   2. 50msまとめて /api/translate-ui に1リクエストで送る
//   3. 返ってきた訳をメモリ + localStorage にキャッシュして再描画
//
// これにより src/i18n/local/{lang}/*.ts を手作業で更新しなくても
// 新しい文言が自動的に全言語へ反映される。
// 手で調整した訳がある場合はそちらが優先される（useAutoT 側で判定）。

export const SUPPORTED_LANGS = [
  'en',
  'ja',
  'zh-TW',
  'zh-CN',
  'ko',
  'th',
  'fr',
  'de',
  'es',
  'id',
] as const;

const STORAGE_PREFIX = 'tabi47_ui_trans_';
// 1リクエストあたりの上限。サーバー側はチャンクを順番にGeminiへ送るため、
// 大きすぎるとEdge Functionの実行時間上限に触れる。
const MAX_BATCH = 100;
// レート上限で取得できなかった分を再挑戦するまでの待ち時間
const RETRY_DELAY_MS = 15000;
const MAX_ATTEMPTS = 3;

type Listener = () => void;

function safeParse(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

class AutoTranslator {
  /** lang -> { englishText: translated } */
  private cache: Record<string, Record<string, string>> = {};
  /** 読み込み済みの言語 */
  private hydrated = new Set<string>();
  /** 取得待ちの原文 */
  private pending: Record<string, Set<string>> = {};
  /** 原文ごとの取得試行回数（無限リトライ防止） */
  private attempts: Record<string, Map<string, number>> = {};
  private listeners = new Set<Listener>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private failures = 0;

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit() {
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch {
        /* noop */
      }
    });
  }

  private hydrate(lang: string) {
    if (this.hydrated.has(lang)) return;
    this.hydrated.add(lang);
    if (!this.cache[lang]) this.cache[lang] = {};
    if (typeof window === 'undefined') return;
    try {
      const stored = safeParse(window.localStorage.getItem(STORAGE_PREFIX + lang));
      this.cache[lang] = { ...stored, ...this.cache[lang] };
    } catch {
      /* localStorageが使えない環境でも動作させる */
    }
  }

  private persist(lang: string) {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_PREFIX + lang, JSON.stringify(this.cache[lang] || {}));
    } catch {
      /* 容量超過などは無視 */
    }
  }

  /** キャッシュ済みの訳を返す。無ければ undefined */
  get(lang: string, text: string): string | undefined {
    this.hydrate(lang);
    return this.cache[lang]?.[text];
  }

  /** 未取得の原文を取得キューに積む */
  request(lang: string, text: string) {
    if (typeof window === 'undefined') return;
    if (!text.trim()) return;
    this.hydrate(lang);
    if (this.cache[lang]?.[text] !== undefined) return;
    if (!this.attempts[lang]) this.attempts[lang] = new Map();
    if ((this.attempts[lang].get(text) || 0) >= MAX_ATTEMPTS) return;
    if (!this.pending[lang]) this.pending[lang] = new Set();
    this.pending[lang].add(text);
    this.schedule();
  }

  private schedule(delay = 50) {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, delay);
  }

  private async flush() {
    // ネットワークが繰り返し失敗する環境では諦める
    if (this.failures >= 3) return;

    const langs = Object.keys(this.pending).filter((l) => this.pending[l].size > 0);
    for (const lang of langs) {
      const all = Array.from(this.pending[lang]);
      const batch = all.slice(0, MAX_BATCH);
      const rest = all.slice(MAX_BATCH);
      this.pending[lang] = new Set(rest);
      batch.forEach((t) => this.attempts[lang].set(t, (this.attempts[lang].get(t) || 0) + 1));

      let retryLater: string[] = [];

      try {
        const res = await fetch('/api/translate-ui', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lang, texts: batch }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        const map = data?.translations || {};
        if (typeof map === 'object') {
          this.hydrate(lang);
          let changed = false;
          for (const [original, translated] of Object.entries(map)) {
            if (typeof translated === 'string' && translated.trim()) {
              this.cache[lang][original] = translated;
              changed = true;
            }
          }
          if (changed) {
            this.persist(lang);
            this.emit();
          }
        }
        // Geminiのレート上限で返らなかった分は、少し待ってから再挑戦する
        if (data?.rateLimited) {
          retryLater = batch.filter((t) => this.cache[lang]?.[t] === undefined);
        }
        this.failures = 0;
      } catch {
        this.failures += 1;
        // ネットワーク失敗した分は試行回数を戻して再挑戦できるようにする
        batch.forEach((t) => {
          const n = this.attempts[lang].get(t) || 1;
          this.attempts[lang].set(t, n - 1);
        });
      }

      if (retryLater.length > 0) {
        retryLater.forEach((t) => this.pending[lang].add(t));
        this.schedule(RETRY_DELAY_MS);
      } else if (rest.length > 0) {
        this.schedule();
      }
    }
  }
}

export const autoTranslator = new AutoTranslator();

/** URLの言語prefixを最優先で使う（i18n.languageより信頼できる） */
export function resolveLang(fallback?: string): string {
  const list = SUPPORTED_LANGS as readonly string[];
  if (typeof window !== 'undefined') {
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (parts.length > 0 && list.includes(parts[0])) return parts[0];
  }
  if (fallback) {
    if (list.includes(fallback)) return fallback;
    const base = fallback.split('-')[0];
    if (list.includes(base)) return base;
  }
  return 'en';
}
