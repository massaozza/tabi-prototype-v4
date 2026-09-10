// src/hooks/useSpotsPage.ts
//
// ページネーション対応のSpot取得フック。
//
// 【なぜuseSpots()と別に用意したか】
// useSpots()（およびその内部のloadAllSpots()）は「全公開Spot」を
// 一括で読み込む前提で、content:destinations（DERIVED_CACHE_MAXである
// 1500件を超えると更新が止まる派生キャッシュ）またはR2の全件Snapshotに
// 依存している。都道府県別・地方別ページは元々ここから該当分だけを
// クライアント側でfilterしていたが、公開Spotが数万〜数十万件になると
// 「まず全件をブラウザに読み込む」こと自体が成り立たない。
//
// このフックは /api/spots?prefecture=...&limit=&offset= を使い、
// 都道府県索引（KVのSet）から必要な分だけを都度取得する。
// 何件公開されていても、1回のリクエストで返るのは最大 pageSize 件だけ。

import { useCallback, useEffect, useRef, useState } from 'react';

export interface PagedSpot {
  id: string;
  title: string;
  category: string;
  prefecture?: string;
  description: string;
  image: string;
  imageCredit?: {
    author?: string;
    license?: string;
    licenseUrl?: string;
    sourceUrl: string;
  };
}

interface UseSpotsPageOptions {
  /** 指定すると、その都道府県のSpotだけを取得する */
  prefecture?: string;
  /** 1回のリクエストで取得する件数（既定24、上限100はAPI側で強制される） */
  pageSize?: number;
}

interface UseSpotsPageResult {
  spots: PagedSpot[];
  /** 該当条件の総件数（都道府県指定時はその都道府県の総数） */
  total: number;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  loadMore: () => void;
  error: boolean;
}

export function useSpotsPage(options: UseSpotsPageOptions): UseSpotsPageResult {
  const pageSize = options.pageSize ?? 24;
  const prefecture = options.prefecture;

  const [spots, setSpots] = useState<PagedSpot[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  // 連打・連続リクエストで順序が入れ替わらないよう、最新のリクエストだけを反映する
  const requestSeq = useRef(0);

  const fetchPage = useCallback(
    async (offset: number, append: boolean) => {
      const seq = ++requestSeq.current;
      try {
        const params = new URLSearchParams({
          limit: String(pageSize),
          offset: String(offset),
        });
        if (prefecture) params.set('prefecture', prefecture);

        const res = await fetch(`/api/spots?${params.toString()}`);
        if (!res.ok) throw new Error(`Failed (${res.status})`);
        const json = await res.json();
        if (seq !== requestSeq.current) return; // 古いリクエストの結果は無視する

        const page: PagedSpot[] = Array.isArray(json.spots) ? json.spots : [];
        setTotal(typeof json.total === 'number' ? json.total : page.length);
        setSpots((prev) => (append ? [...prev, ...page] : page));
        setError(false);
      } catch {
        if (seq !== requestSeq.current) return;
        setError(true);
        if (!append) setSpots([]);
      }
    },
    [pageSize, prefecture]
  );

  useEffect(() => {
    setLoading(true);
    fetchPage(0, false).finally(() => setLoading(false));
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    setLoadingMore(true);
    fetchPage(spots.length, true).finally(() => setLoadingMore(false));
  }, [fetchPage, spots.length]);

  return {
    spots,
    total,
    loading,
    loadingMore,
    hasMore: spots.length < total,
    loadMore,
    error,
  };
}
