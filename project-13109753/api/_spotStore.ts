// /api/_spotStore.ts
//
// Living Spot Database の中核。Spotの読み書きをここに集約する。
//
// 【Source of Truth】
//   spot:{id}  … これが唯一の正データ
//   content:destinations … 読み取り専用の派生キャッシュ（互換のため維持）
//
// 移行前は content:destinations が唯一のデータで、367件を1キーのJSON配列に
// 格納していた。この方式には次の問題があった：
//   - 保存がAdminからの配列一括置換のみ。Import処理と同時実行すると
//     片方の変更が消える（データ消失）
//   - 1キーの容量上限に当たるため、全国Import（数万件）に耐えられない
//   - 1件だけ直すのに全件を送り直す必要がある
//
// そこで Spot を個別キーに分割し、派生キャッシュを自動再構築する方式にした。
// 既存の読み取り経路（GET /api/content?type=destinations）は
// 派生キャッシュを読むため、フロントエンドの変更なしで動き続ける。
//
// 【重要】ファイル名を "_" で始めているのは、
// Vercelがこれをエンドポイントとして公開しないようにするため。

import { kv } from '@vercel/kv';

// ───────────────────────────────────────────────
// 型
// ───────────────────────────────────────────────

export type SpotStatus = 'published' | 'draft' | 'staging' | 'rejected';

export type SourceType =
  | 'TABI47_LEGACY'
  | 'TABI47_CURATED'
  | 'OFFICIAL'
  | 'OSM'
  | 'CREATOR'
  | 'TRAVELER'
  | 'AI_DERIVED'
  | 'WIKIMEDIA';

export interface SpotSource {
  type: SourceType;
  id?: string;
  url?: string;
  updatedAt?: string;
  syncedAt?: string;
}

/**
 * 「何の情報が存在するか」を種類ごとに保持する。
 *
 * 単一の enrichmentLevel(1〜5) だけでは、
 * 「説明文はあるが公式情報がない」「Creator知識はあるが座標がない」
 * といった実態を表現できない。実際、既存367件のうち
 * 説明文が実質的な内容を持つのは289件で、残り78件は短文だった。
 * そのため種類ごとに独立して判定する。
 */
export interface SpotCompleteness {
  /** 名称・カテゴリ・都道府県・座標が揃っている */
  baseData: boolean;
  /** 実質的な説明文（40文字以上）がある */
  editorialContent: boolean;
  /** 公式サイト・営業時間・料金などの一次情報がある */
  officialInfo: boolean;
  /** Creatorによる知識（Guide等）が紐づいている */
  localKnowledge: boolean;
  /** 旅行者の実体験（Experience等）が紐づいている */
  actualData: boolean;
}

export interface Spot {
  // ── 既存フィールド（名前も型も変更しない） ──
  id: string;
  title: string;
  category: string;
  prefecture: string;
  description: string;
  lat: number;
  lng: number;
  image: string;

  // ── 追加フィールド（すべて任意。未設定でも既存機能は動く） ──
  city?: string;
  address?: string;
  officialUrl?: string;
  openingHours?: string;
  admission?: string;
  access?: string;
  canonicalCategory?: string;
  aliases?: string[];
  status?: SpotStatus;
  sources?: SpotSource[];
  /** フィールド単位の出典。営業時間はOFFICIAL、Local TipはCREATORが真実 */
  fieldSources?: Record<string, SourceType>;
  completeness?: SpotCompleteness;
  createdAt?: string;
  updatedAt?: string;
  /**
   * 画像の出典表示（Wikimedia Commons由来の画像はライセンス上、
   * 撮影者・ライセンスの明記が必要なことが多い）。
   * フロントエンドの画像表示部分でこの情報をクレジット表示する。
   */
  imageCredit?: {
    author?: string;
    license?: string;
    licenseUrl?: string;
    sourceUrl: string;
  };
}

// ───────────────────────────────────────────────
// キー
// ───────────────────────────────────────────────

export const LEGACY_CACHE_KEY = 'content:destinations';

export function spotKey(id: string): string {
  return `spot:${id}`;
}
export const SPOTS_INDEX = 'spots:index';
export function prefIndexKey(prefecture: string): string {
  return `spots:pref:${prefecture}`;
}
export function statusIndexKey(status: SpotStatus): string {
  return `spots:status:${status}`;
}
/**
 * カテゴリ索引のキー。
 *
 * 【なぜ category と canonicalCategory の両方を見るか】
 * OSM一括インポートで作るSpotは、既存カテゴリ体系（"Culture & History"等の
 * 表示用文言）を推測で当てはめると誤分類になるため category は空のまま作り、
 * canonicalCategory（shrine_temple, museum 等の機械的な分類）だけを持つ。
 * 一方、既存367件は category のみを持つ。
 * 絞り込みの軸として両方を1つの索引に統合しておく。
 */
export function categoryIndexKey(category: string): string {
  return `spots:category:${category}`;
}
export function categoryOf(spot: Spot): string | null {
  return spot.canonicalCategory || spot.category || null;
}
/**
 * 都道府県 × 画像の有無 の索引キー。
 *
 * 【なぜ必要か】
 * OSM一括インポートでは、Wikidataに写真が無い候補は image が空のまま
 * 作られる。一覧で画像なしのSpotが上位に出ると見栄えが悪いため、
 * 「画像ありを先に、画像なしは最後に」表示したい。数千〜数万件を
 * 都度全件取得して image の有無でソートするのは高コストなので、
 * 保存時にどちらの索引に入れるかを決めておき、一覧取得時は
 * 画像ありの索引から先に埋める。
 */
export function prefImageIndexKey(prefecture: string, hasImage: boolean): string {
  return `spots:pref:${prefecture}:${hasImage ? 'img' : 'noimg'}`;
}
export function backupKey(stamp: string): string {
  return `backup:destinations:${stamp}`;
}
/** 移行が完了したかを示すフラグ */
export const MIGRATION_FLAG = 'spots:migrated';

/**
 * 派生キャッシュを再構築する件数の上限。
 * これを超えると1キーの容量に収まらなくなるため、
 * 全国Import後は個別取得API（/api/spots）へ移行する必要がある。
 */
export const DERIVED_CACHE_MAX = 1500;

// ───────────────────────────────────────────────
// 判定
// ───────────────────────────────────────────────

/** 既存データから completeness を判定する（推測で埋めない） */
export async function evaluateCompleteness(spot: Spot): Promise<SpotCompleteness> {
  const baseData =
    Boolean(spot.title) &&
    Boolean(spot.category) &&
    Boolean(spot.prefecture) &&
    typeof spot.lat === 'number' &&
    typeof spot.lng === 'number';

  const editorialContent = typeof spot.description === 'string' && spot.description.trim().length >= 40;

  const officialInfo = Boolean(spot.officialUrl || spot.openingHours || spot.admission);

  // Creator知識と実体験は、既存のリレーション索引の有無で判定する
  let localKnowledge = false;
  let actualData = false;
  try {
    const [guides, experiences] = await Promise.all([
      kv.scard(`spot:${spot.id}:guides`).catch(() => 0),
      kv.scard(`spot:${spot.id}:experiences`).catch(() => 0),
    ]);
    localKnowledge = Number(guides) > 0;
    actualData = Number(experiences) > 0;
  } catch {
    /* 索引が読めない場合は false のまま（過大評価しない） */
  }

  return { baseData, editorialContent, officialInfo, localKnowledge, actualData };
}

/** completeness から表示用のレベル(1〜5)を導く。固定値を持たせない */
export function deriveEnrichmentLevel(c: SpotCompleteness): number {
  if (c.actualData) return 4;
  if (c.localKnowledge) return 3;
  if (c.officialInfo || c.editorialContent) return 2;
  if (c.baseData) return 1;
  return 1;
}

// ───────────────────────────────────────────────
// 読み取り
// ───────────────────────────────────────────────

export async function getSpot(id: string): Promise<Spot | null> {
  if (!id) return null;
  try {
    return await kv.get<Spot>(spotKey(id));
  } catch {
    return null;
  }
}

export async function listSpotIds(): Promise<string[]> {
  try {
    const ids = await kv.smembers(SPOTS_INDEX);
    return (ids || []).filter(Boolean) as string[];
  } catch {
    return [];
  }
}

export async function getSpots(ids: string[]): Promise<Spot[]> {
  if (ids.length === 0) return [];
  const out: Spot[] = [];
  const CHUNK = 100;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    const records = await Promise.all(slice.map((id) => getSpot(id)));
    for (const r of records) if (r) out.push(r);
  }
  return out;
}

/** 公開中のSpotをすべて取得する */
export async function listPublishedSpots(): Promise<Spot[]> {
  try {
    const ids = ((await kv.smembers(statusIndexKey('published'))) || []) as string[];
    return getSpots(ids.filter(Boolean));
  } catch {
    return [];
  }
}

/**
 * ページ単位でSpotを取得する。
 *
 * 【なぜ必要か】
 * listPublishedSpots() や content:destinations は、公開Spotが
 * 数万〜数十万件になると、全件を毎回KVから引く／配列として持つのが
 * 現実的でなくなる（実行時間・メモリの両方で）。
 * 都道府県ごとの索引（prefIndexKey）は既に存在するため、
 * 「そのページに必要な分だけ」idを絞ってから個別取得する。
 *
 * 【並び順について】
 * Redis Setは順序を保証しないため、安定した並び順にするために
 * idをソートしてから offset/limit を適用する。真の「新着順」等は
 * 別途ソート済み索引（Sorted Set）が必要になるため、ここでは
 * 「毎回同じ順序で、ページを送れば重複や欠落なく全件を辿れる」
 * ことだけを保証する。
 */
export async function listPublishedSpotsPage(
  opts: { prefecture?: string; category?: string; limit: number; offset: number }
): Promise<{ spots: Spot[]; total: number }> {
  try {
    let allIds: string[];

    if (opts.prefecture && opts.category) {
      // 両方指定時はRedis側の積集合（SINTER）で絞り込む。
      // 全件取得してJS側で交差を取ると、件数が多いカテゴリ・都道府県では
      // また同じ「全件個別取得」問題に戻ってしまうため。
      const inter = await kv.sinter(
        prefIndexKey(opts.prefecture),
        categoryIndexKey(opts.category)
      );
      allIds = ((inter || []) as string[]).filter(Boolean).sort();
    } else if (opts.category) {
      const ids = (await kv.smembers(categoryIndexKey(opts.category))) || [];
      allIds = (ids as string[]).filter(Boolean).sort();
    } else if (opts.prefecture) {
      // 【画像ありを先に、画像なしを最後に】
      // OSM一括インポートでは、Wikidataに写真が無かった候補は画像なしで
      // 作られる。一覧の見栄えのため、画像ありの索引から先に埋め、
      // 画像なしは常に末尾に回す。
      const [withImg, noImg] = await Promise.all([
        kv.smembers(prefImageIndexKey(opts.prefecture, true)),
        kv.smembers(prefImageIndexKey(opts.prefecture, false)),
      ]);
      allIds = [
        ...((withImg || []) as string[]).filter(Boolean).sort(),
        ...((noImg || []) as string[]).filter(Boolean).sort(),
      ];
    } else {
      allIds = (((await kv.smembers(statusIndexKey('published'))) || []) as string[])
        .filter(Boolean)
        .sort();
    }

    const total = allIds.length;

    // prefecture/category索引はstatus索引ではないため、draft/rejected等も
    // 混ざりうる。公開分だけに絞るには、ページ分だけ取得してからstatusを
    // 見てフィルタする（このページ分のみの個別取得なので全件取得にはならない）。
    const pageIds = allIds.slice(opts.offset, opts.offset + opts.limit);
    let spots = await getSpots(pageIds);
    if (opts.prefecture || opts.category) {
      spots = spots.filter((s) => !s.status || s.status === 'published');
    }
    return { spots, total };
  } catch {
    return { spots: [], total: 0 };
  }
}

export async function isMigrated(): Promise<boolean> {
  try {
    return Boolean(await kv.get(MIGRATION_FLAG));
  } catch {
    return false;
  }
}

// ───────────────────────────────────────────────
// 書き込み
// ───────────────────────────────────────────────

/** 既存フィールドだけを取り出す（派生キャッシュの形を変えないため） */
function toLegacyShape(spot: Spot) {
  return {
    id: spot.id,
    title: spot.title,
    category: spot.category,
    prefecture: spot.prefecture,
    description: spot.description,
    lat: spot.lat,
    lng: spot.lng,
    image: spot.image,
    // 追加フィールド。既存フィールドの構成・順序は変えていないため、
    // これを見ないコンシューマには影響しない。
    ...(spot.imageCredit ? { imageCredit: spot.imageCredit } : {}),
  };
}

/**
 * 派生キャッシュ（content:destinations）を spot:{id} から再構築する。
 *
 * これは読み取り専用の派生データであり、外部から直接書き換えてはいけない。
 * 既存のフロントエンド・チャットAPIがこのキーを読んでいるため、
 * 形（フィールド構成と順序）を変えずに維持する。
 */
export async function rebuildDerivedCache(): Promise<{ count: number; skipped: boolean }> {
  const spots = await listPublishedSpots();

  if (spots.length > DERIVED_CACHE_MAX) {
    // 容量上限を超えるため再構築しない。全国Import後は個別取得APIに移行する。
    console.warn(
      `[spotStore] published spots (${spots.length}) exceed DERIVED_CACHE_MAX (${DERIVED_CACHE_MAX}). Skipping cache rebuild.`
    );
    return { count: spots.length, skipped: true };
  }

  // 既存の並び順（登録順）に近づけるため id でソートせず、索引の順序をそのまま使う
  const legacy = spots.map(toLegacyShape);
  await kv.set(LEGACY_CACHE_KEY, legacy);
  return { count: legacy.length, skipped: false };
}

/**
 * Spot 1件を保存する。索引も同時に更新する。
 *
 * @param rebuild 派生キャッシュを再構築するか。
 *                大量投入時は false にして、最後に1回だけ再構築する。
 */
export async function saveSpot(spot: Spot, rebuild = true): Promise<void> {
  if (!spot.id) throw new Error('spot.id is required');

  const now = new Date().toISOString();
  const existing = await getSpot(spot.id);

  const completeness = await evaluateCompleteness(spot);
  const status: SpotStatus = spot.status || existing?.status || 'published';

  const record: Spot = {
    ...spot,
    status,
    completeness,
    createdAt: existing?.createdAt || spot.createdAt || now,
    updatedAt: now,
  };

  await kv.set(spotKey(spot.id), record);
  await kv.sadd(SPOTS_INDEX, spot.id);
  if (spot.prefecture) {
    await kv.sadd(prefIndexKey(spot.prefecture), spot.id);
    await kv.sadd(prefImageIndexKey(spot.prefecture, Boolean(spot.image)), spot.id);
  }
  await kv.sadd(statusIndexKey(status), spot.id);
  const category = categoryOf(record);
  if (category) await kv.sadd(categoryIndexKey(category), spot.id);

  // 状態が変わった場合は古い索引から外す
  if (existing?.status && existing.status !== status) {
    await kv.srem(statusIndexKey(existing.status), spot.id);
  }
  // 都道府県が変わった場合も同様
  if (existing?.prefecture && existing.prefecture !== spot.prefecture) {
    await kv.srem(prefIndexKey(existing.prefecture), spot.id);
    await kv.srem(prefImageIndexKey(existing.prefecture, Boolean(existing.image)), spot.id);
  } else if (existing && spot.prefecture && Boolean(existing.image) !== Boolean(spot.image)) {
    // 都道府県は変わらないが、画像の有無だけ変わった場合
    // （Regenerate content等で後から画像が付いた場合）は、
    // 反対側の索引から外す。
    await kv.srem(prefImageIndexKey(spot.prefecture, !spot.image), spot.id);
  }
  // カテゴリが変わった場合も同様
  const existingCategory = existing ? categoryOf(existing) : null;
  if (existingCategory && existingCategory !== category) {
    await kv.srem(categoryIndexKey(existingCategory), spot.id);
  }

  if (rebuild) await rebuildDerivedCache();
}

/**
 * 移行・Import用の一括書き込み。
 *
 * saveSpot() は1件あたりKV操作を9回行う（本体+索引+completeness判定）。
 * 367件を逐次実行すると約3,300往復になり、
 * Edge Functionの実行時間上限を超えてタイムアウトする（実測504）。
 *
 * この関数は次の工夫で往復回数を大幅に削減する：
 *   - completeness判定に必要な scard を全件まとめて並列実行
 *   - 索引の sadd を「1件ずつ」ではなく「まとめて1回」に集約
 *   - 本体の set を並列実行
 *
 * @returns 書き込んだ件数
 */
export async function bulkSaveSpots(
  spots: Spot[],
  defaultStatus: SpotStatus = 'published'
): Promise<{ written: number; errors: { id: string; error: string }[] }> {
  const errors: { id: string; error: string }[] = [];
  if (spots.length === 0) return { written: 0, errors };

  const now = new Date().toISOString();

  // 1. completeness判定に必要なリレーション件数を全件まとめて取得
  const relCounts = await Promise.all(
    spots.map(async (s) => {
      try {
        const [g, e] = await Promise.all([
          kv.scard(`spot:${s.id}:guides`).catch(() => 0),
          kv.scard(`spot:${s.id}:experiences`).catch(() => 0),
        ]);
        return { guides: Number(g), experiences: Number(e) };
      } catch {
        return { guides: 0, experiences: 0 };
      }
    })
  );

  // 2. レコードを組み立てる（ここではKVアクセスなし）
  const records: Spot[] = spots.map((s, i) => {
    const rel = relCounts[i];
    const completeness: SpotCompleteness = {
      baseData:
        Boolean(s.title) &&
        Boolean(s.category) &&
        Boolean(s.prefecture) &&
        typeof s.lat === 'number' &&
        typeof s.lng === 'number',
      editorialContent: typeof s.description === 'string' && s.description.trim().length >= 40,
      officialInfo: Boolean(s.officialUrl || s.openingHours || s.admission),
      localKnowledge: rel.guides > 0,
      actualData: rel.experiences > 0,
    };
    return {
      ...s,
      status: s.status || defaultStatus,
      completeness,
      createdAt: s.createdAt || now,
      updatedAt: now,
    };
  });

  // 3. 本体を並列で書き込む
  const writes = await Promise.allSettled(
    records.map((r) => kv.set(spotKey(r.id), r))
  );
  writes.forEach((w, i) => {
    if (w.status === 'rejected') {
      errors.push({ id: records[i].id, error: String(w.reason) });
    }
  });

  const ok = records.filter((_, i) => writes[i].status === 'fulfilled');

  // 4. 索引はまとめて1回ずつ（都道府県・状態・カテゴリごとにグループ化）
  const byPref = new Map<string, string[]>();
  const byStatus = new Map<string, string[]>();
  const byCategory = new Map<string, string[]>();
  for (const r of ok) {
    if (r.prefecture) {
      const arr = byPref.get(r.prefecture) || [];
      arr.push(r.id);
      byPref.set(r.prefecture, arr);
    }
    const st = r.status || defaultStatus;
    const arr2 = byStatus.get(st) || [];
    arr2.push(r.id);
    byStatus.set(st, arr2);

    const cat = categoryOf(r);
    if (cat) {
      const arr3 = byCategory.get(cat) || [];
      arr3.push(r.id);
      byCategory.set(cat, arr3);
    }
  }

  const indexOps: Promise<unknown>[] = [];
  if (ok.length > 0) {
    indexOps.push(kv.sadd(SPOTS_INDEX, ok[0].id, ...ok.slice(1).map((r) => r.id)));
  }
  for (const [pref, ids] of byPref) {
    indexOps.push(kv.sadd(prefIndexKey(pref), ids[0], ...ids.slice(1)));
  }
  for (const [st, ids] of byStatus) {
    indexOps.push(kv.sadd(statusIndexKey(st as SpotStatus), ids[0], ...ids.slice(1)));
  }
  for (const [cat, ids] of byCategory) {
    indexOps.push(kv.sadd(categoryIndexKey(cat), ids[0], ...ids.slice(1)));
  }
  await Promise.all(indexOps.map((p) => p.catch(() => null)));

  return { written: ok.length, errors };
}

/**
 * Spotを部分更新する。渡されたフィールドだけを変更する。
 * 一括置換ではないため、Import処理と同時に実行しても他の変更を消さない。
 */
export async function patchSpot(
  id: string,
  patch: Partial<Spot>,
  rebuild = true
): Promise<Spot | null> {
  const existing = await getSpot(id);
  if (!existing) return null;

  // idは変更させない（URLとリレーションが壊れるため）
  const rest = { ...patch };
  delete rest.id;
  const merged: Spot = { ...existing, ...rest, id: existing.id };

  await saveSpot(merged, rebuild);
  return getSpot(id);
}

/**
 * Spotを削除する。
 *
 * 【注意】外部データソースから消えたことと、TABI47から削除すべきことは別。
 * Creator content / Reviews / Trips / My Trip が紐づいている可能性があるため、
 * 原則は status を 'rejected' にする論理削除を使う。
 */
export async function deleteSpot(id: string, rebuild = true): Promise<boolean> {
  const existing = await getSpot(id);
  if (!existing) return false;

  await kv.del(spotKey(id));
  await kv.srem(SPOTS_INDEX, id);
  if (existing.prefecture) {
    await kv.srem(prefIndexKey(existing.prefecture), id);
    await kv.srem(prefImageIndexKey(existing.prefecture, Boolean(existing.image)), id);
  }
  if (existing.status) await kv.srem(statusIndexKey(existing.status), id);
  const existingCategory = categoryOf(existing);
  if (existingCategory) await kv.srem(categoryIndexKey(existingCategory), id);

  if (rebuild) await rebuildDerivedCache();
  return true;
}
