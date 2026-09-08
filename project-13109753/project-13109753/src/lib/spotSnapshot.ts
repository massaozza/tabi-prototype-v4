// src/lib/spotSnapshot.ts
//
// Spotデータの取得口。KVを正データとし、読めない場合はR2のSnapshotへ退避する。
//
// 【方針】
//   1. /api/spots または /api/content（KV経由）を試す ← 正データ
//   2. 失敗したらR2のSnapshotを読む                  ← Last Known Good
//
// Snapshot は scripts/generate-spot-snapshot.mjs が
// Published Spot から自動生成したもの。
// 以前は src/mocks/homeData.ts の367件を恒久的なフォールバックにしていたが、
// Admin編集やOSM Importの結果が反映されず、
// 障害時だけ古いデータに戻るという気づきにくい不整合があった。
//
// 【生成日時を保持する理由】
// フォールバックが働いていること自体に気づけないと、
// 「なぜか古い内容が表示される」という調査しにくい状態になる。
// そのため manifest の generatedAt を読み、コンソールに警告を出す。

const SNAPSHOT_BASE = (import.meta.env.VITE_SNAPSHOT_BASE_URL as string | undefined)?.replace(
  /\/$/,
  ''
);

export interface SnapshotSpot {
  id: string;
  title: string;
  category: string;
  prefecture: string;
  description: string;
  lat: number;
  lng: number;
  image: string;
  city?: string;
  officialUrl?: string;
  canonicalCategory?: string;
}

interface Manifest {
  generatedAt: string;
  spotCount: number;
  prefectures: string[];
  schemaVersion: number;
}

/** 同じデータを何度も取りに行かないようにする */
const prefCache = new Map<string, SnapshotSpot[]>();
let manifestCache: Manifest | null = null;
let indexCache: Record<string, string> | null = null;
let warned = false;

function snapshotAvailable(): boolean {
  return Boolean(SNAPSHOT_BASE);
}

/** フォールバックが働いたことを一度だけ知らせる */
function warnFallback(manifest: Manifest | null): void {
  if (warned) return;
  warned = true;
  const when = manifest?.generatedAt
    ? new Date(manifest.generatedAt).toLocaleString()
    : 'unknown date';
  console.warn(
    `[spotSnapshot] Live spot data is unavailable. Falling back to the snapshot generated at ${when}. ` +
      'Content may be out of date until the live source recovers.'
  );
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function getManifest(): Promise<Manifest | null> {
  if (!snapshotAvailable()) return null;
  if (manifestCache) return manifestCache;
  manifestCache = await fetchJson<Manifest>(`${SNAPSHOT_BASE}/snapshot/spots/manifest.json`);
  return manifestCache;
}

async function getIndex(): Promise<Record<string, string> | null> {
  if (!snapshotAvailable()) return null;
  if (indexCache) return indexCache;
  const data = await fetchJson<{ index: Record<string, string> }>(
    `${SNAPSHOT_BASE}/snapshot/spots/index.json`
  );
  indexCache = data?.index ?? null;
  return indexCache;
}

async function getSnapshotByPrefecture(prefecture: string): Promise<SnapshotSpot[]> {
  if (!snapshotAvailable()) return [];
  const cached = prefCache.get(prefecture);
  if (cached) return cached;

  const data = await fetchJson<{ spots: SnapshotSpot[] }>(
    `${SNAPSHOT_BASE}/snapshot/spots/pref/${encodeURIComponent(prefecture)}.json`
  );
  const spots = data?.spots ?? [];
  prefCache.set(prefecture, spots);
  return spots;
}

/**
 * Spot 1件を取得する。
 * KVが読めない場合は、index.json で都道府県を特定してからSnapshotを引く。
 */
export async function loadSpot(id: string): Promise<SnapshotSpot | null> {
  if (!id) return null;

  // 1. 正データ
  const live = await fetchJson<{ spot?: SnapshotSpot }>(
    `/api/spots?id=${encodeURIComponent(id)}`
  );
  if (live?.spot) return live.spot;

  // 2. Snapshot
  const index = await getIndex();
  if (!index) return null;
  const prefecture = index[id];
  if (!prefecture) return null;

  const spots = await getSnapshotByPrefecture(prefecture);
  const found = spots.find((s) => s.id === id) ?? null;
  if (found) warnFallback(await getManifest());
  return found;
}

/** 都道府県内のSpotを取得する */
export async function loadSpotsByPrefecture(prefecture: string): Promise<SnapshotSpot[]> {
  if (!prefecture) return [];

  const live = await fetchJson<{ spots?: SnapshotSpot[] }>(
    `/api/spots?prefecture=${encodeURIComponent(prefecture)}`
  );
  if (live?.spots && live.spots.length > 0) return live.spots;

  const spots = await getSnapshotByPrefecture(prefecture);
  if (spots.length > 0) warnFallback(await getManifest());
  return spots;
}

/**
 * 全Spotを取得する。
 *
 * 【注意】Spot数が増えると全件取得は重くなる。
 * TOPページのように「一部を見せるだけ」の用途では、
 * 表示に必要な件数だけを使うこと。
 */
export async function loadAllSpots(): Promise<SnapshotSpot[]> {
  // 1. 正データ（派生キャッシュ経由。既存の読み取り経路と同じ）
  const live = await fetchJson<{ data?: SnapshotSpot[] }>('/api/content?type=destinations');
  if (live?.data && live.data.length > 0) return live.data;

  // 2. Snapshot（都道府県ファイルを結合する）
  const manifest = await getManifest();
  if (!manifest) return [];

  const groups = await Promise.all(
    manifest.prefectures.map((p) => getSnapshotByPrefecture(p))
  );
  const all = groups.flat();
  if (all.length > 0) warnFallback(manifest);
  return all;
}

/** Snapshotの状態を確認する（管理画面での表示用） */
export async function getSnapshotStatus(): Promise<{
  configured: boolean;
  generatedAt: string | null;
  spotCount: number | null;
  prefectures: number | null;
}> {
  if (!snapshotAvailable()) {
    return { configured: false, generatedAt: null, spotCount: null, prefectures: null };
  }
  const manifest = await getManifest();
  return {
    configured: true,
    generatedAt: manifest?.generatedAt ?? null,
    spotCount: manifest?.spotCount ?? null,
    prefectures: manifest?.prefectures.length ?? null,
  };
}
