// src/hooks/useSpots.ts
//
// Spot一覧を取得する共通フック。
//
// 【なぜ集約したか】
// 以前は9ファイルがそれぞれ
//   - useState の初期値に mocks/homeData.ts の367件を入れる
//   - useEffect で /api/content?type=destinations を叩く
//   - 失敗したら mocks のまま
// という同じコードを持っていた。
//
// この方式には次の問題があった：
//   - Admin編集やOSM Importの結果が mocks に反映されず、
//     取得失敗時だけ古い367件に戻る（気づきにくい不整合）
//   - 新規Spotが mocks に含まれないため、増えるほど欠落が大きくなる
//   - 367件（269KB）が全ページのバンドルに含まれる
//
// 現在は loadAllSpots() が
//   1. KV（正データ）
//   2. R2のLast Known Good Snapshot（自動生成）
// の順で解決する。フォールバックも常に最新の正データ由来になる。

import { useEffect, useState } from 'react';
import { loadAllSpots, type SnapshotSpot } from '@/lib/spotSnapshot';

export type Spot = SnapshotSpot;

/** 同一セッション内で何度も取りに行かないようにする */
let cache: Spot[] | null = null;
let inFlight: Promise<Spot[]> | null = null;

async function fetchOnce(): Promise<Spot[]> {
  if (cache) return cache;
  if (inFlight) return inFlight;

  inFlight = loadAllSpots()
    .then((spots) => {
      cache = spots;
      return spots;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

/**
 * 全Spotを取得する。
 *
 * 初回は取得完了まで空配列を返すため、呼び出し側は loading を見て
 * スケルトンなどを出すこと。以前は mocks の367件が即座に表示されていたが、
 * その値は古い可能性があり、実データと差し替わる瞬間に表示が変わっていた。
 */
export function useSpots(): { spots: Spot[]; loading: boolean } {
  const [spots, setSpots] = useState<Spot[]>(cache ?? []);
  const [loading, setLoading] = useState(cache === null);

  useEffect(() => {
    if (cache) {
      setSpots(cache);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchOnce()
      .then((result) => {
        if (!cancelled) setSpots(result);
      })
      .catch(() => {
        // KVもSnapshotも読めない場合は空のまま。
        // 呼び出し側で「読み込めませんでした」を出せるよう loading は解除する。
        if (!cancelled) setSpots([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { spots, loading };
}

/** 都道府県の一覧を Spot から導出する（固定リストを持たない） */
export function usePrefecturesFromSpots(): { prefectures: string[]; loading: boolean } {
  const { spots, loading } = useSpots();
  const prefectures = Array.from(
    new Set(spots.map((s) => s.prefecture).filter(Boolean))
  ).sort();
  return { prefectures, loading };
}

/** テスト・管理操作用にキャッシュを破棄する */
export function clearSpotCache(): void {
  cache = null;
  inFlight = null;
}
