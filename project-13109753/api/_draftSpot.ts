// api/_draftSpot.ts
//
// Staging 1件からSpot（draft）を作る処理。
//
// 【なぜ切り出したか】
// 元々 admin-osm-review.ts の中にあったが、全国規模のNEWをまとめて
// draft化するにはEdge Functionの実行時間上限（約25秒）ではとても
// 収まらない。GitHub Actions側にも同じロジックが必要になったため、
// 両方から使える形にここへ切り出した。

import {
  getSpot,
  saveSpot,
  type Spot,
  type SpotSource,
} from './_spotStore.js';
import { linkOsmToSpot, updateStaging, type StagingRecord } from './_osmStaging.js';
import { buildWikiContent } from './_wikiContent.js';

/**
 * SpotのIDになるslugを作る。
 *
 * 【IDは変更できない前提で作る】
 * SpotのIDはURLとリレーションの両方を兼ねるため、後から変えられない。
 * そのため生成時点で読みやすいslugにする。
 * タイムスタンプ由来のIDにすると /destinations/mg8x2k-a3f9j のような
 * 無意味なURLになり、SEO上も不利になる。
 */
export function makeSlug(name: string, prefecture: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // 日本語などラテン文字以外はslugにできないため落とす
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (base.length >= 3) return base.slice(0, 80);

  // ラテン文字が取れない場合は都道府県名を接頭辞にする
  const pref = prefecture.toLowerCase().replace(/[^a-z]/g, '');
  return `${pref}-spot`.slice(0, 80);
}

/** 同名slugが既にある場合に連番を付ける */
export async function uniqueSlug(base: string): Promise<string> {
  if (!(await getSpot(base))) return base;
  for (let i = 2; i <= 20; i++) {
    const candidate = `${base}-${i}`;
    if (!(await getSpot(candidate))) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export function osmSourceOf(record: StagingRecord): SpotSource {
  return {
    type: 'OSM',
    id: `${record.osmType}/${record.osmId}`,
    url: `https://www.openstreetmap.org/${record.osmType}/${record.osmId}`,
    syncedAt: new Date().toISOString(),
  };
}

/**
 * Staging 1件からSpotを作成する（approveNew / bulkApproveNew / GitHub Actions
 * の一括ジョブ、共通処理）。成功したらslugを返す。
 */
export async function createDraftSpotFromStaging(
  record: StagingRecord,
  opts: {
    publish: boolean;
    requestedSlug?: string | null;
    reviewNote: string;
    /**
     * 派生キャッシュ（content:destinations）の再構築を都度行うか。
     * 【なぜ必要か】saveSpotは既定でこの再構築を毎回行うが、それは
     * 公開Spot全件を読み直す処理のため、数百〜数千件をまとめて作る
     * 一括ジョブでは無視できない負荷になる。バッチ処理側は false にして、
     * 全件処理し終えた後に1回だけ再構築する。
     */
    rebuildCache?: boolean;
  }
): Promise<string> {
  const base = opts.requestedSlug
    ? opts.requestedSlug.toLowerCase().replace(/[^a-z0-9-]/g, '-')
    : makeSlug(record.name, record.prefecture);
  const slug = await uniqueSlug(base);

  // 【説明文・写真について】
  // AIに一から作文させることはしない（事実でない説明文を生む恐れがある）。
  // 代わりに、OSMタグにWikidata/Wikipediaの紐づけがあれば、その事実ベースの
  // 要約を取得し、AIには「訪日旅行者向けに読みやすく整える」役割だけを
  // 担わせる（新しい事実は付け加えさせない）。取得できなければ、
  // 無理に埋めず空のままにする。
  let description = '';
  let image = '';
  let imageCredit: Spot['imageCredit'];
  const sources: SpotSource[] = [osmSourceOf(record)];
  const fieldSources: Record<string, SpotSource['type']> = {
    title: 'OSM',
    prefecture: 'OSM',
    lat: 'OSM',
    lng: 'OSM',
    ...(record.city ? { city: 'OSM' as const } : {}),
    ...(record.address ? { address: 'OSM' as const } : {}),
    ...(record.officialUrl ? { officialUrl: 'OSM' as const } : {}),
    ...(record.canonicalKey ? { canonicalCategory: 'OSM' as const } : {}),
  };

  try {
    const wiki = await buildWikiContent(record.name, record.osmTags || {});
    if (wiki) {
      description = wiki.description;
      sources.push({
        type: 'AI_DERIVED',
        url: wiki.descriptionSourceUrl,
        syncedAt: new Date().toISOString(),
      });
      fieldSources.description = 'AI_DERIVED';

      if (wiki.image) {
        image = wiki.image.url;
        imageCredit = {
          author: wiki.image.author,
          license: wiki.image.license,
          licenseUrl: wiki.image.licenseUrl,
          sourceUrl: wiki.image.sourceUrl,
        };
        sources.push({
          type: 'WIKIMEDIA',
          url: wiki.image.sourceUrl,
          syncedAt: new Date().toISOString(),
        });
        fieldSources.image = 'WIKIMEDIA';
      }
    }
  } catch (e) {
    // 取得・生成に失敗しても下書き作成自体は止めない。
    // description/image は空のまま作成し、後からReviewで人が埋められる。
    console.error(`[createDraftSpotFromStaging] wiki content enrichment failed for ${slug}:`, e);
  }

  const spot: Spot = {
    id: slug,
    title: record.name,
    // カテゴリは canonical のみ設定する。
    // 既存367件の表示用カテゴリ（「Culture & History」等）を
    // 推測で当てはめると誤分類になるため、Reviewで人間が付ける。
    category: '',
    prefecture: record.prefecture,
    description,
    lat: record.lat,
    lng: record.lng,
    image,
    imageCredit,
    city: record.city,
    address: record.address,
    officialUrl: record.officialUrl,
    canonicalCategory: record.canonicalKey,
    aliases: record.aliases.slice(0, 20),
    status: opts.publish ? 'published' : 'draft',
    sources,
    fieldSources,
  };

  // 【重要】draft作成は公開一覧（content:destinations）に一切影響しない
  // （rebuildは公開Spotだけを対象にするため）。publish=1の時だけ既定で
  // 再構築し、それ以外はopts.rebuildCacheで明示された場合のみ行う。
  await saveSpot(spot, opts.rebuildCache ?? opts.publish);
  await linkOsmToSpot(record.osmType, record.osmId, slug);
  await updateStaging(record.id, {
    reviewedAt: new Date().toISOString(),
    reviewAction: 'approved_new',
    reviewNote: opts.reviewNote,
    resultSpotId: slug,
    matchedSpotId: slug,
  });

  return slug;
}
