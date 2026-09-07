// src/lib/track.ts
// 収益ファネルの各段階を計測するためのヘルパー。
//
// 計測は「あくまで補助」なので、失敗してもユーザーの操作は止めない。
// そのため fetch は待たず、エラーも握りつぶす（keepalive でページ遷移中も送る）。
//
//   trackEvent('copy', 'trip', trip.id);
//   trackEvent('booking_hotel', 'trip', trip.id);

export type FunnelEvent = 'view' | 'save' | 'copy' | 'booking_hotel' | 'booking_experience';
export type TrackContentType = 'guide' | 'experience' | 'trip' | 'spot';

/**
 * ファネルイベントを1件記録する。
 * 戻り値を待つ必要はない（await しなくてよい）。
 */
export function trackEvent(
  event: FunnelEvent,
  contentType: TrackContentType,
  id: string
): void {
  if (typeof window === 'undefined' || !id) return;

  try {
    void fetch('/api/track-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, contentType, id }),
      // ページ遷移が始まっても送信を打ち切らせない
      keepalive: true,
    }).catch(() => {
      /* 計測の失敗は無視する */
    });
  } catch {
    /* 計測の失敗は無視する */
  }
}

/** 複数idのイベント数をまとめて取得する（Creator Dashboard等で使う） */
export async function fetchEventCounts(
  event: FunnelEvent,
  contentType: TrackContentType,
  ids: string[]
): Promise<Record<string, number>> {
  if (ids.length === 0) return {};
  try {
    const params = new URLSearchParams({
      contentType,
      ids: ids.join(','),
      event,
    });
    const res = await fetch(`/api/track-view?${params.toString()}`);
    if (!res.ok) return {};
    const data = await res.json();
    return data?.views && typeof data.views === 'object' ? data.views : {};
  } catch {
    return {};
  }
}
