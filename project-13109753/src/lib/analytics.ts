// src/lib/analytics.ts
//
// Google Analytics 4（GA4）へのページビュー送信。
//
// 【なぜ必要か】
// TABI47はSPAなので、URLが変わってもページの再読み込みは起きない。
// index.htmlのgtagタグは初回読み込みしか記録しないため、
// 画面遷移がページビューとしてカウントされない。
// ルーターの遷移を拾って明示的に送る必要がある。
//
// 【役割分担】
//   GA4        … PV・流入元・国別・滞在時間などの一般的なアクセス解析
//   自前の計測  … コンテンツ単位の収益ファネル（/api/track-view）
// GAでは「どの旅程が何回コピーされたか」を追いにくいため、両方使う。
//
// 測定IDは Vite の環境変数 VITE_GA_MEASUREMENT_ID から読む。
// 未設定なら何も送らない（開発環境の数字が混ざるのを防ぐ）。

type GtagFn = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: GtagFn;
  }
}

const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

/** 測定IDが正しく設定されているか。プレースホルダは無効扱いにする */
function isConfigured(): boolean {
  if (!MEASUREMENT_ID) return false;
  if (!/^G-[A-Z0-9]{6,}$/.test(MEASUREMENT_ID)) return false;
  return true;
}

let initialized = false;

/** GA4のスクリプトを読み込む。アプリ起動時に一度だけ呼ぶ */
export function initAnalytics(): void {
  if (initialized || typeof window === 'undefined') return;
  if (!isConfigured()) return;
  initialized = true;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  const gtag: GtagFn = (...args) => {
    window.dataLayer?.push(args);
  };
  window.gtag = gtag;

  // 【重要】これが無いと「同意ステータスが未設定」の状態のまま送信が
  // 保留され続ける（実際に本番で発生し、手動でgtag()を叩いても
  // 一切ヒットが送られない不具合の原因だった）。
  // TABI47は広告用Cookieを使わないため ad_storage は denied のままにし、
  // 計測（analytics_storage）だけ明示的に許可する。
  // 【注意】EEA/UK等、Cookie同意バナーが法的に必須な地域向けに公開する
  // 場合は、本来はユーザーの選択に応じて動的に更新する必要がある。
  // 現時点ではバナー自体が未実装なため、まず計測を機能させることを
  // 優先し、常時 granted にしている。
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'granted',
  });

  gtag('js', new Date());
  // 遷移ごとに自前で送るので、自動のページビュー送信は切る
  gtag('config', MEASUREMENT_ID, { send_page_view: false });
}

/**
 * ページビューを送る。ルーターの遷移ごとに呼ぶ。
 * 言語prefixを含んだパスをそのまま送るので、GA側で言語別に分析できる。
 */
export function trackPageView(path: string, title?: string): void {
  if (typeof window === 'undefined' || !window.gtag || !isConfigured()) return;
  window.gtag('event', 'page_view', {
    page_path: path,
    page_location: window.location.href,
    page_title: title || document.title,
  });
}

/**
 * 収益に関わる操作をGAにも送る。
 * 自前の計測（/api/track-view）と二重になるが、
 * GA側で「流入元ごとのコピー率」などを見られるようにするため。
 */
export function trackAnalyticsEvent(
  name: string,
  params: Record<string, string | number> = {}
): void {
  if (typeof window === 'undefined' || !window.gtag || !isConfigured()) return;
  window.gtag('event', name, params);
}
