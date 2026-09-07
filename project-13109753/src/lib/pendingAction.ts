// src/lib/pendingAction.ts
// 未ログイン時に Save / Copy を押したユーザーを、
// ログイン後に元のページへ戻し、その操作を自動で続行させるための仕組み。
//
// 【なぜ必要か】
// 従来は未ログインで Copy を押すと /login に飛ばされ、ログインしても
// トップページに戻るだけだった。ユーザーはどの旅程をコピーしようとしていたか
// 探し直す必要があり、収益ファネルの離脱点になっていた。
//
// 【流れ】
//   1. 未ログインで Copy を押す
//      → savePendingAction({ action:'copy', contentType:'trip', id }) を保存
//      → /login?next=<今いるパス> へ遷移
//   2. ログイン成功 → next のパスへ戻る
//   3. 戻ったページで takePendingAction() を読み、一致すれば Copy を自動実行
//
// sessionStorage を使う理由：タブを閉じたら消えてよい一時的な意図であり、
// 別タブに持ち越す必要もないため。

const STORAGE_KEY = 'tabi47_pending_action';

export type PendingActionType = 'save' | 'copy';

export interface PendingAction {
  action: PendingActionType;
  contentType: 'trip' | 'guide' | 'experience' | 'spot';
  id: string;
  /** 保存時刻。古すぎる意図は実行しない */
  at: number;
}

/** 保留アクションの有効期限（30分） */
const MAX_AGE_MS = 30 * 60 * 1000;

export function savePendingAction(
  action: PendingActionType,
  contentType: PendingAction['contentType'],
  id: string
): void {
  if (typeof window === 'undefined' || !id) return;
  try {
    const payload: PendingAction = { action, contentType, id, at: Date.now() };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* sessionStorageが使えない環境では復帰をあきらめる */
  }
}

/**
 * 保留アクションを読み出して削除する（1回しか実行させない）。
 * 期限切れや形式不正の場合は null を返す。
 */
export function takePendingAction(): PendingAction | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(STORAGE_KEY);

    const parsed = JSON.parse(raw) as PendingAction;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.action !== 'save' && parsed.action !== 'copy') return null;
    if (typeof parsed.id !== 'string' || !parsed.id) return null;
    if (typeof parsed.at !== 'number' || Date.now() - parsed.at > MAX_AGE_MS) return null;

    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingAction(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}

/**
 * ログイン画面へのパスを組み立てる。
 * 戻り先は現在のパス（言語prefixを含む）をそのまま使う。
 */
export function loginPathWithReturn(): string {
  if (typeof window === 'undefined') return '/login';
  const next = window.location.pathname + window.location.search;
  return `/login?next=${encodeURIComponent(next)}`;
}

const SUPPORTED_LANGS = ['en', 'ja', 'zh-TW', 'zh-CN', 'ko', 'th', 'fr', 'de', 'es', 'id'];

/** 現在のURLの言語prefixを付けたパスにする（戻り先の言語を保つため） */
export function withCurrentLang(path: string): string {
  if (typeof window === 'undefined') return path;
  const parts = window.location.pathname.split('/').filter(Boolean);
  const lang = parts.length > 0 && SUPPORTED_LANGS.includes(parts[0]) ? parts[0] : '';
  if (!lang) return path;
  // すでに言語prefixが付いているならそのまま
  const first = path.split('/').filter(Boolean)[0];
  if (first && SUPPORTED_LANGS.includes(first)) return path;
  return `/${lang}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * 指定のパスへ戻るログイン画面のパスを組み立てる。
 * 一覧カードなど「その場では続行できない」箇所から、
 * 対象の詳細ページへ戻して操作を再開させたいときに使う。
 */
export function loginPathFor(next: string): string {
  return `/login?next=${encodeURIComponent(withCurrentLang(next))}`;
}

/**
 * ログイン成功後の遷移先を ?next= から取り出す。
 * 外部サイトへ飛ばされないよう、同一サイト内の絶対パスだけを許可する。
 */
export function resolveNextPath(search: string, fallback = '/'): string {
  try {
    const next = new URLSearchParams(search).get('next');
    if (!next) return fallback;
    // 「/」で始まり「//」でないものだけ許可（オープンリダイレクト対策）
    if (!next.startsWith('/') || next.startsWith('//')) return fallback;
    return next;
  } catch {
    return fallback;
  }
}
