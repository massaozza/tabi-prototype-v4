// /api/_osmStaging.ts
//
// OSM Import の Staging Layer。
//
// 【なぜ Staging を挟むか】
// OSMから取得したデータを直接 Production の Spot に入れると、
//   - 旅行価値の低いSpot（小さな祠、私有地の庭）が大量に公開される
//   - 誤ったMatchingで既存Spotが壊れても気づけない
//   - 取り消しができない
// という問題が起きる。
//
// そこで次の流れにする：
//   OSM → Raw Import → Staging → Matching/Duplicate判定 → 人間のReview → Spot Master
//
// Staging に置いた時点では Production に一切影響しない。
//
// 【冪等性】
// osm:src:{osmType}:{osmId} → Spot ID の逆引きを持つことで、
// 同じImportを何度実行してもSpotが増えないようにする。
//
// 【重要】ファイル名を "_" で始めているのは、
// Vercelがこれをエンドポイントとして公開しないようにするため。

import { kv } from '@vercel/kv';
import type { MatchCandidate, MatchStatus } from './_osmMatching.js';

// ───────────────────────────────────────────────
// キー
// ───────────────────────────────────────────────

/** Staging に置かれた1件 */
export function stagingKey(id: string): string {
  return `osm:staging:${id}`;
}

/** Staging の全ID */
export const STAGING_INDEX = 'osm:staging:index';

/** 判定状態ごとの索引 */
export function stagingStatusKey(status: MatchStatus): string {
  return `osm:staging:status:${status}`;
}

/**
 * Review済み（reviewedAtが入った）だが、まだ POSSIBLE_MATCH / NEW の
 * プールに留まっているレコードの索引（approveNew / defer の場合）。
 * reject / merge のように matchStatus が変わるものはプールから抜けるため、
 * この索引からも同時に外す。
 *
 * 【なぜ必要か】
 * 以前は getStagingSummary() が POSSIBLE_MATCH + NEW の全レコードを
 * 1件ずつ取得して reviewedAt の有無を数えていた。都道府県が増えて
 * 対象が万単位になると、この個別取得だけでEdge Functionの実行時間
 * 上限（約25秒）を超えてタイムアウトし、ダッシュボード・Review画面が
 * 丸ごと空表示になる不具合が起きた。SCARD（O(1)）だけで数えられる
 * よう、この専用索引で置き換える。
 */
export const STAGING_REVIEWED_INDEX = 'osm:staging:reviewed';

/** 都道府県ごとの索引 */
export function stagingPrefKey(prefecture: string): string {
  return `osm:staging:pref:${prefecture}`;
}

/**
 * 判定状態 × 優先度の複合索引。
 *
 * 【なぜ必要か】
 * status索引だけだと、NEWが数万件になったときに「priority=highだけ見たい」
 * という絞り込みでも一旦全件を個別取得してからJSでフィルタするしかなく、
 * Edge Functionの実行時間上限（約25秒）を超えてタイムアウトする
 * （実際に都道府県3つ目でNEW 14,714件になり発生した）。
 * status × priority の組み合わせごとにSetを持たせておけば、
 * SMEMBERSで絞り込み済みのidだけを取得できる。
 */
export function stagingStatusPriorityKey(
  status: MatchStatus,
  priority: 'high' | 'medium' | 'low'
): string {
  return `osm:staging:status:${status}:priority:${priority}`;
}

/**
 * OSM要素 → TABI47 Spot の逆引き。
 * これが冪等性の担保。同じOSM要素を二度取り込まない。
 */
export function osmSourceKey(osmType: string, osmId: string): string {
  return `osm:src:${osmType}:${osmId}`;
}

/** Import 実行ごとの記録 */
export function importRunKey(runId: string): string {
  return `osm:run:${runId}`;
}
export const IMPORT_RUNS_INDEX = 'osm:runs:index';

/** Staging の保持期間（90日）。放置されたものは自動で消える */
export const STAGING_TTL_SECONDS = 90 * 24 * 60 * 60;

// ───────────────────────────────────────────────
// 型
// ───────────────────────────────────────────────

export interface StagingRecord {
  /** Staging内の一意ID。osmType:osmId から作るため冪等 */
  id: string;
  osmType: string;
  osmId: string;

  /** 表示名（name:en を優先） */
  name: string;
  /** 日本語名など別表記 */
  aliases: string[];

  lat: number;
  lng: number;
  prefecture: string;
  city?: string;
  address?: string;
  officialUrl?: string;

  /** TABI47 の Canonical Category */
  canonicalGroup?: string;
  canonicalKey?: string;
  /** 元のOSMタグ（判断材料として保持する。推測で埋めない） */
  osmTags: Record<string, string>;

  /**
   * 旅行価値スコア（0〜100）とその根拠。
   * 除外の判断ではなく、Reviewの優先順位付けに使う。
   * 栃木県の実測で NEW が2,459件になり、
   * 優先順位なしでは人間が確認できる量ではなかった。
   */
  travelScore?: number;
  travelSignals?: string[];
  reviewPriority?: 'high' | 'medium' | 'low';

  /** 同一Import内で重複と判定された場合、代表のID */
  duplicateOf?: string;

  /** 判定結果 */
  matchStatus: MatchStatus;
  matchedSpotId: string | null;
  confidence: number;
  candidates: MatchCandidate[];
  matchReason: string;

  /** 人間のReview結果 */
  reviewedAt?: string;
  reviewAction?: 'approved_new' | 'merged' | 'rejected' | 'deferred';
  reviewNote?: string;
  /** 承認後に作成・更新されたSpot ID */
  resultSpotId?: string;

  importRunId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ImportRun {
  runId: string;
  prefecture: string;
  /** 取得したカテゴリ群。1回で全カテゴリを取ると実行時間上限を超えるため分割する */
  group?: string;
  startedAt: string;
  finishedAt?: string;
  /** Overpassから取得した生の件数 */
  fetched: number;
  /** Stagingに保存した件数 */
  staged: number;
  counts: Record<MatchStatus, number>;
  /** 除外した件数と理由 */
  rejected: number;
  rejectReasons: Record<string, number>;
  errors: string[];
  status: 'running' | 'completed' | 'failed';
}

// ───────────────────────────────────────────────
// 操作
// ───────────────────────────────────────────────

/** OSM要素からStagingのIDを作る。同じ要素なら常に同じIDになる */
export function makeStagingId(osmType: string, osmId: string): string {
  return `${osmType}-${osmId}`;
}

export async function getStaging(id: string): Promise<StagingRecord | null> {
  try {
    return await kv.get<StagingRecord>(stagingKey(id));
  } catch {
    return null;
  }
}

export async function listStagingIds(status?: MatchStatus): Promise<string[]> {
  try {
    const key = status ? stagingStatusKey(status) : STAGING_INDEX;
    const ids = await kv.smembers(key);
    // Setは順序を保証しないため、分割取得を安全にするためソートする
    return ((ids || []).filter(Boolean) as string[]).sort();
  } catch {
    return [];
  }
}

/**
 * status＋priorityで絞り込んだid一覧。priorityを指定すると複合索引
 * （stagingStatusPriorityKey）を使うため、対象がNEW数万件でも
 * SMEMBERS一発で絞り込める。priority未指定時は従来のlistStagingIdsと同じ。
 */
export async function listStagingIdsFiltered(
  status: MatchStatus,
  priority?: 'high' | 'medium' | 'low'
): Promise<string[]> {
  if (!priority) return listStagingIds(status);
  try {
    const ids = await kv.smembers(stagingStatusPriorityKey(status, priority));
    return ((ids || []).filter(Boolean) as string[]).sort();
  } catch {
    return [];
  }
}

export async function getStagingRecords(ids: string[]): Promise<StagingRecord[]> {
  if (ids.length === 0) return [];
  const out: StagingRecord[] = [];
  const CHUNK = 100;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    const records = await Promise.all(slice.map((id) => getStaging(id)));
    for (const r of records) if (r) out.push(r);
  }
  return out;
}

/**
 * Stagingに一括保存する。
 *
 * 逐次実行するとKV往復が多くなり実行時間上限に触れるため、
 * 索引の更新はまとめて行う。
 */
export async function bulkSaveStaging(records: StagingRecord[]): Promise<number> {
  if (records.length === 0) return 0;

  const now = new Date().toISOString();

  // 既存レコードの状態を先に取得する（状態が変わったら古い索引から外す）
  const existing = await Promise.all(records.map((r) => getStaging(r.id)));

  const writes = await Promise.allSettled(
    records.map((r, i) =>
      kv.set(
        stagingKey(r.id),
        {
          ...r,
          createdAt: existing[i]?.createdAt || r.createdAt || now,
          updatedAt: now,
          // 既にReview済みの場合、その結果は保持する
          reviewedAt: existing[i]?.reviewedAt,
          reviewAction: existing[i]?.reviewAction,
          reviewNote: existing[i]?.reviewNote,
          resultSpotId: existing[i]?.resultSpotId,
        },
        { ex: STAGING_TTL_SECONDS }
      )
    )
  );

  const ok = records.filter((_, i) => writes[i].status === 'fulfilled');
  if (ok.length === 0) return 0;

  // 索引をまとめて更新する
  const byStatus = new Map<string, string[]>();
  const byPref = new Map<string, string[]>();
  const byStatusPriority = new Map<string, string[]>();
  for (const r of ok) {
    const s = byStatus.get(r.matchStatus) || [];
    s.push(r.id);
    byStatus.set(r.matchStatus, s);

    if (r.prefecture) {
      const p = byPref.get(r.prefecture) || [];
      p.push(r.id);
      byPref.set(r.prefecture, p);
    }

    if (r.reviewPriority) {
      const spKey = `${r.matchStatus}:${r.reviewPriority}`;
      const sp = byStatusPriority.get(spKey) || [];
      sp.push(r.id);
      byStatusPriority.set(spKey, sp);
    }
  }

  const ops: Promise<unknown>[] = [
    kv.sadd(STAGING_INDEX, ok[0].id, ...ok.slice(1).map((r) => r.id)),
  ];
  for (const [status, ids] of byStatus) {
    ops.push(kv.sadd(stagingStatusKey(status as MatchStatus), ids[0], ...ids.slice(1)));
  }
  for (const [pref, ids] of byPref) {
    ops.push(kv.sadd(stagingPrefKey(pref), ids[0], ...ids.slice(1)));
  }
  for (const [spKey, ids] of byStatusPriority) {
    const [status, priority] = spKey.split(':') as [MatchStatus, 'high' | 'medium' | 'low'];
    ops.push(kv.sadd(stagingStatusPriorityKey(status, priority), ids[0], ...ids.slice(1)));
  }

  // 状態が変わったものは古い索引から外す
  for (let i = 0; i < records.length; i++) {
    const prev = existing[i];
    if (prev && prev.matchStatus !== records[i].matchStatus) {
      ops.push(kv.srem(stagingStatusKey(prev.matchStatus), records[i].id));
      if (prev.reviewPriority) {
        ops.push(
          kv.srem(stagingStatusPriorityKey(prev.matchStatus, prev.reviewPriority), records[i].id)
        );
      }
    }
  }

  await Promise.all(ops.map((p) => p.catch(() => null)));
  return ok.length;
}

/** Staging 1件の状態を更新する（Review時） */
export async function updateStaging(
  id: string,
  patch: Partial<StagingRecord>
): Promise<StagingRecord | null> {
  const existing = await getStaging(id);
  if (!existing) return null;

  const merged: StagingRecord = {
    ...existing,
    ...patch,
    id: existing.id,
    updatedAt: new Date().toISOString(),
  };

  await kv.set(stagingKey(id), merged, { ex: STAGING_TTL_SECONDS });

  if (patch.matchStatus && patch.matchStatus !== existing.matchStatus) {
    await kv.srem(stagingStatusKey(existing.matchStatus), id).catch(() => null);
    await kv.sadd(stagingStatusKey(patch.matchStatus), id).catch(() => null);
    // status × priority の複合索引も追従させる
    if (existing.reviewPriority) {
      await kv
        .srem(stagingStatusPriorityKey(existing.matchStatus, existing.reviewPriority), id)
        .catch(() => null);
    }
    if (merged.reviewPriority) {
      await kv
        .sadd(stagingStatusPriorityKey(patch.matchStatus, merged.reviewPriority), id)
        .catch(() => null);
    }
    // MATCHED/REJECTEDに移るものは POSSIBLE_MATCH/NEW のプールから抜けるため、
    // reviewed索引からも外す（プール内の「reviewed済み件数」としては数えない）
    await kv.srem(STAGING_REVIEWED_INDEX, id).catch(() => null);
  } else if (patch.reviewedAt) {
    // approveNew / defer のように matchStatus を変えずにReviewだけ記録する場合
    await kv.sadd(STAGING_REVIEWED_INDEX, id).catch(() => null);
  }

  return merged;
}

/** OSM要素が既にSpotへ紐づいているか */
export async function getLinkedSpotId(
  osmType: string,
  osmId: string
): Promise<string | null> {
  try {
    return await kv.get<string>(osmSourceKey(osmType, osmId));
  } catch {
    return null;
  }
}

/** 複数のOSM要素の紐づけをまとめて引く */
export async function getLinkedSpotIds(
  items: { osmType: string; osmId: string }[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (items.length === 0) return map;

  const CHUNK = 100;
  for (let i = 0; i < items.length; i += CHUNK) {
    const slice = items.slice(i, i + CHUNK);
    const results = await Promise.all(
      slice.map((it) => kv.get<string>(osmSourceKey(it.osmType, it.osmId)).catch(() => null))
    );
    slice.forEach((it, idx) => {
      const spotId = results[idx];
      if (spotId) map.set(makeStagingId(it.osmType, it.osmId), spotId);
    });
  }
  return map;
}

/** OSM要素とSpotの紐づけを記録する（冪等性の担保） */
export async function linkOsmToSpot(
  osmType: string,
  osmId: string,
  spotId: string
): Promise<void> {
  await kv.set(osmSourceKey(osmType, osmId), spotId);
}

// ───────────────────────────────────────────────
// Import Run
// ───────────────────────────────────────────────

export async function saveImportRun(run: ImportRun): Promise<void> {
  await kv.set(importRunKey(run.runId), run, { ex: STAGING_TTL_SECONDS });
  await kv.sadd(IMPORT_RUNS_INDEX, run.runId).catch(() => null);
}

export async function listImportRuns(limit = 20): Promise<ImportRun[]> {
  try {
    const ids = ((await kv.smembers(IMPORT_RUNS_INDEX)) || []) as string[];
    const runs = await Promise.all(
      ids.filter(Boolean).map((id) => kv.get<ImportRun>(importRunKey(id)).catch(() => null))
    );
    return runs
      .filter((r): r is ImportRun => Boolean(r))
      .sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''))
      .slice(0, limit);
  } catch {
    return [];
  }
}

/** Import Dashboard 用の集計（処理をブラックボックスにしないため） */
export async function getStagingSummary(): Promise<{
  total: number;
  byStatus: Record<string, number>;
  reviewed: number;
  pendingReview: number;
}> {
  const statuses: MatchStatus[] = ['MATCHED', 'POSSIBLE_MATCH', 'NEW', 'REJECTED'];
  const counts = await Promise.all(
    statuses.map(async (s) => {
      try {
        return Number(await kv.scard(stagingStatusKey(s)));
      } catch {
        return 0;
      }
    })
  );

  const byStatus: Record<string, number> = {};
  statuses.forEach((s, i) => {
    byStatus[s] = counts[i];
  });

  let total = 0;
  try {
    total = Number(await kv.scard(STAGING_INDEX));
  } catch {
    total = counts.reduce((a, b) => a + b, 0);
  }

  // Review待ちは POSSIBLE_MATCH と NEW（MATCHEDは自動、REJECTEDは対象外）
  //
  // 【以前の実装の問題】
  // POSSIBLE_MATCH + NEW の全レコードを1件ずつ取得して reviewedAt の
  // 有無を数えていた。都道府県が増えて対象が万単位になると、この
  // 個別取得だけでEdge Functionの実行時間上限（約25秒）を超えて
  // タイムアウトし、ダッシュボード・Review画面が丸ごと空表示になった。
  // SCARD（O(1)）だけで数えられる専用索引（STAGING_REVIEWED_INDEX）に
  // 置き換える。
  const poolSize = byStatus.POSSIBLE_MATCH + byStatus.NEW;
  let reviewed = 0;
  try {
    reviewed = Number(await kv.scard(STAGING_REVIEWED_INDEX));
  } catch {
    reviewed = 0;
  }
  // reviewed索引はプールを離れたレコードから都度除いているため、
  // 理論上 poolSize を超えないはずだが、念のため下限をかける。
  const pendingReview = Math.max(0, poolSize - reviewed);

  return {
    total,
    byStatus,
    reviewed,
    pendingReview,
  };
}
