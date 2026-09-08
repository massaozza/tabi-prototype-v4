// /api/admin-osm-import.ts
// Vercel Serverless Function（Edge Runtime）
//
// OpenStreetMap から都道府県単位でSpot候補を取得し、Staging に保存する。
//
// 【Production に直接入れない】
// このAPIは Staging Layer までしか書き込まない。
// Production の Spot を作成・変更するのは Review 後（admin-osm-review）のみ。
//
// 【Overpass API への配慮（指示書34）】
// Overpass は公開の共有リソースなので、
//   - 1リクエストで1都道府県のみ
//   - カテゴリを絞る
//   - タイムアウトとmaxsizeを明示
//   - 429/504 は指数バックオフで再試行
// を守る。全国Importは Overpass ではなく Geofabrik の OSM extract を
// オフライン処理する方式に切り替える（GATE 6で検討）。
//
// 【ライセンス（指示書33）】
// OSMデータは ODbL 1.0。データを利用する場合は
//   - 出典表示（© OpenStreetMap contributors）
//   - 同ライセンスでの提供
// が求められる。Spotに source を記録し、サイト上に帰属表示を出すこと。
// 正確な条件は https://osmfoundation.org/wiki/Licence で確認する。
//
// POST /api/admin-osm-import?prefecture=Tochigi        … 取得してStagingへ
// POST /api/admin-osm-import?prefecture=Tochigi&dryRun=1 … 取得のみ（保存しない）
// GET  /api/admin-osm-import                            … Import状況の一覧

import { isAdminRequest, adminUnauthorized } from './_adminAuth.js';
import { listPublishedSpots } from './_spotStore.js';
import {
  mapOsmToCanonical,
  matchOsmCandidate,
  shouldReject,
  guessCategoryKeyFromLegacy,
  type ExistingSpotRef,
} from './_osmMatching.js';
import {
  bulkSaveStaging,
  getLinkedSpotIds,
  makeStagingId,
  saveImportRun,
  listImportRuns,
  getStagingSummary,
  type StagingRecord,
  type ImportRun,
} from './_osmStaging.js';

// 【注意】maxDuration は Edge Runtime では効かない。
// 実際の実行時間上限は約25秒なので、重い処理は必ず分割する。
export const config = { runtime: 'edge' };

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

/** OSMの都道府県名（日本語）。Overpassの area 検索に使う */
const PREFECTURE_JA: Record<string, string> = {
  Hokkaido: '北海道', Aomori: '青森県', Iwate: '岩手県', Miyagi: '宮城県',
  Akita: '秋田県', Yamagata: '山形県', Fukushima: '福島県', Ibaraki: '茨城県',
  Tochigi: '栃木県', Gunma: '群馬県', Saitama: '埼玉県', Chiba: '千葉県',
  Tokyo: '東京都', Kanagawa: '神奈川県', Niigata: '新潟県', Toyama: '富山県',
  Ishikawa: '石川県', Fukui: '福井県', Yamanashi: '山梨県', Nagano: '長野県',
  Gifu: '岐阜県', Shizuoka: '静岡県', Aichi: '愛知県', Mie: '三重県',
  Shiga: '滋賀県', Kyoto: '京都府', Osaka: '大阪府', Hyogo: '兵庫県',
  Nara: '奈良県', Wakayama: '和歌山県', Tottori: '鳥取県', Shimane: '島根県',
  Okayama: '岡山県', Hiroshima: '広島県', Yamaguchi: '山口県', Tokushima: '徳島県',
  Kagawa: '香川県', Ehime: '愛媛県', Kochi: '高知県', Fukuoka: '福岡県',
  Saga: '佐賀県', Nagasaki: '長崎県', Kumamoto: '熊本県', Oita: '大分県',
  Miyazaki: '宮崎県', Kagoshima: '鹿児島県', Okinawa: '沖縄県',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * 取得対象のカテゴリ群。
 *
 * 【1回のリクエストで全カテゴリを取らない理由】
 * 栃木県の全観光Spotを1クエリで取ると、Overpass側の処理が30秒を超え、
 * Edge Functionの実行時間上限（約25秒）に達して504になる（実測）。
 * カテゴリ単位に分け、呼び出し側が順番に実行できるようにする。
 *
 * 【指示書10に沿った優先順位】
 * 観光価値が明確なものを先に取る。
 * Restaurant / Cafe は全国Importの対象外とし、
 * Creator投稿や人気エリアから個別に追加する方針。
 */
export const IMPORT_GROUPS: { key: string; label: string; query: string }[] = [
  {
    key: 'worship',
    label: 'Shrines & temples',
    query: `
  node["amenity"="place_of_worship"]["name"](area.pref);
  way ["amenity"="place_of_worship"]["name"](area.pref);`,
  },
  {
    key: 'historic',
    label: 'Historic sites & castles',
    query: `
  node["historic"]["name"](area.pref);
  way ["historic"]["name"](area.pref);`,
  },
  {
    key: 'tourism',
    label: 'Attractions & museums',
    query: `
  node["tourism"~"^(attraction|museum|gallery|theme_park|aquarium|zoo)$"]["name"](area.pref);
  way ["tourism"~"^(attraction|museum|gallery|theme_park|aquarium|zoo)$"]["name"](area.pref);`,
  },
  {
    key: 'nature',
    label: 'Nature & viewpoints',
    query: `
  node["tourism"="viewpoint"]["name"](area.pref);
  node["natural"~"^(waterfall|peak|beach|cape|hot_spring)$"]["name"](area.pref);
  way ["natural"~"^(waterfall|beach|cape)$"]["name"](area.pref);`,
  },
  {
    key: 'park',
    label: 'Parks & gardens',
    query: `
  node["leisure"~"^(park|garden)$"]["name"](area.pref);
  way ["leisure"~"^(park|garden)$"]["name"](area.pref);`,
  },
  {
    key: 'onsen',
    label: 'Onsen',
    query: `
  node["amenity"~"^(onsen|public_bath)$"]["name"](area.pref);
  way ["amenity"~"^(onsen|public_bath)$"]["name"](area.pref);
  node["bath:type"="onsen"]["name"](area.pref);`,
  },
];

/**
 * Overpass のクエリを組み立てる。
 *
 * timeout は Edge Functionの上限（約25秒）より短く設定する。
 * Overpass側で90秒待たれると、こちらが先に打ち切られて
 * 何も得られないまま504になる。
 */
function buildOverpassQuery(prefJa: string, groupKey: string): string {
  const group = IMPORT_GROUPS.find((g) => g.key === groupKey);
  if (!group) throw new Error(`Unknown import group: ${groupKey}`);

  return `
[out:json][timeout:18][maxsize:67108864];
area["name"="${prefJa}"]["admin_level"="4"]->.pref;
(${group.query}
);
out tags center;
`.trim();
}

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

/**
 * Overpass から取得する。
 * 429 / 504 は待って再試行し、失敗したら別エンドポイントへ切り替える。
 */
async function fetchOverpass(
  query: string,
  errors: string[]
): Promise<OverpassElement[] | null> {
  // 【重要】Edge Functionの上限は約25秒。
  // 待機を長く取ると再試行する前に打ち切られるため、
  // 待ちは短く、エンドポイントの切り替えを優先する。
  for (const endpoint of OVERPASS_ENDPOINTS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            // Overpassは利用者を識別できるUAを求めている
            'User-Agent': 'TABI47/1.0 (https://www.tabi47.com; spot import)',
          },
          body: `data=${encodeURIComponent(query)}`,
        });

        if (res.status === 429 || res.status === 504) {
          // 1回だけ短く待って再試行し、それでも駄目なら次のエンドポイントへ
          if (attempt === 1) {
            errors.push(`${endpoint} returned ${res.status}, retrying once`);
            await new Promise((r) => setTimeout(r, 2000));
            continue;
          }
          errors.push(`${endpoint} returned ${res.status} twice`);
          break;
        }
        if (!res.ok) {
          errors.push(`${endpoint} returned ${res.status}`);
          break;
        }

        const data = await res.json();
        if (!Array.isArray(data?.elements)) {
          errors.push(`${endpoint} returned unexpected payload`);
          break;
        }
        return data.elements as OverpassElement[];
      } catch (e) {
        errors.push(`${endpoint} failed: ${String(e).slice(0, 120)}`);
        break;
      }
    }
  }
  return null;
}

/** 座標を取り出す（way は center を使う） */
function coordsOf(el: OverpassElement): { lat: number; lng: number } | null {
  if (typeof el.lat === 'number' && typeof el.lon === 'number') {
    return { lat: el.lat, lng: el.lon };
  }
  if (el.center && typeof el.center.lat === 'number') {
    return { lat: el.center.lat, lng: el.center.lon };
  }
  return null;
}

/**
 * 表示名を決める。
 *
 * 【OSMから10言語を作らない（指示書16）】
 * OSMに存在する名称だけを使い、無い翻訳を推測で生成しない。
 * name:en があればそれを表示名にし、name（多くは日本語）は別表記として保持する。
 * 不足する言語は後工程の翻訳パイプラインが担う。
 */
function pickNames(tags: Record<string, string>): { name: string; aliases: string[] } {
  const en = tags['name:en'];
  const ja = tags['name:ja'] || tags.name;
  const romaji = tags['name:ja-Latn'] || tags['name:ja_rm'];

  const primary = en || romaji || ja || '';
  const aliases = [ja, en, romaji, tags['int_name'], tags.alt_name]
    .filter((v): v is string => Boolean(v) && v !== primary);

  return { name: primary, aliases: [...new Set(aliases)] };
}

function addressOf(tags: Record<string, string>): {
  city?: string;
  address?: string;
} {
  const city = tags['addr:city'] || tags['addr:town'] || undefined;
  const parts = [
    tags['addr:province'] || tags['addr:state'],
    city,
    tags['addr:suburb'],
    tags['addr:block_number'],
    tags['addr:housenumber'],
  ].filter(Boolean);
  return { city, address: parts.length > 0 ? parts.join(' ') : undefined };
}

export default async function handler(req: Request): Promise<Response> {
  if (!(await isAdminRequest(req))) return adminUnauthorized();

  const url = new URL(req.url);

  // ── 状況の一覧（Import Dashboard 用） ──
  if (req.method === 'GET') {
    const [runs, summary] = await Promise.all([listImportRuns(), getStagingSummary()]);
    return json({
      runs,
      staging: summary,
      availablePrefectures: Object.keys(PREFECTURE_JA),
      // カテゴリ単位に分けて実行する必要があるため、一覧を返す
      importGroups: IMPORT_GROUPS.map((g) => ({ key: g.key, label: g.label })),
      attribution: '© OpenStreetMap contributors (ODbL 1.0)',
    });
  }

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const prefecture = url.searchParams.get('prefecture') || '';
  const dryRun = url.searchParams.get('dryRun') === '1';
  const groupKey = url.searchParams.get('group') || IMPORT_GROUPS[0].key;

  const prefJa = PREFECTURE_JA[prefecture];
  if (!prefJa) {
    return json(
      { error: `Unknown prefecture. Use one of: ${Object.keys(PREFECTURE_JA).join(', ')}` },
      400
    );
  }

  const groupIndex = IMPORT_GROUPS.findIndex((g) => g.key === groupKey);
  if (groupIndex === -1) {
    return json(
      { error: `Unknown group. Use one of: ${IMPORT_GROUPS.map((g) => g.key).join(', ')}` },
      400
    );
  }
  const nextGroup = IMPORT_GROUPS[groupIndex + 1]?.key ?? null;

  // カテゴリごとに実行するため、runIdは都道府県+カテゴリで作る
  const runId = `${prefecture}-${groupKey}-${Date.now()}`;
  const errors: string[] = [];
  const run: ImportRun = {
    runId,
    prefecture,
    group: groupKey,
    startedAt: new Date().toISOString(),
    fetched: 0,
    staged: 0,
    counts: { MATCHED: 0, POSSIBLE_MATCH: 0, NEW: 0, REJECTED: 0 },
    rejected: 0,
    rejectReasons: {},
    errors: [],
    status: 'running',
  };

  try {
    // ── 1. Overpass から取得 ──
    const elements = await fetchOverpass(buildOverpassQuery(prefJa, groupKey), errors);
    if (!elements) {
      run.status = 'failed';
      run.errors = errors;
      run.finishedAt = new Date().toISOString();
      await saveImportRun(run);
      return json({ error: 'Failed to fetch from Overpass', detail: errors }, 502);
    }
    run.fetched = elements.length;

    // ── 2. 既存Spotを読む（Matchingの照合先） ──
    const spots = await listPublishedSpots();
    const existing: ExistingSpotRef[] = spots.map((s) => ({
      id: s.id,
      title: s.title,
      prefecture: s.prefecture,
      lat: s.lat,
      lng: s.lng,
      category: s.category,
      // 既存367件は canonicalCategory を持たないため推定する
      canonicalCategory:
        s.canonicalCategory || guessCategoryKeyFromLegacy(s.category, s.title) || undefined,
      officialUrl: s.officialUrl,
      aliases: s.aliases,
    }));

    // ── 3. 正規化と除外 ──
    const usable: {
      el: OverpassElement;
      tags: Record<string, string>;
      name: string;
      aliases: string[];
      lat: number;
      lng: number;
      canonicalKey: string | null;
      canonicalGroup: string | null;
    }[] = [];

    for (const el of elements) {
      const tags = el.tags || {};
      const coords = coordsOf(el);
      if (!coords) {
        run.rejected += 1;
        run.rejectReasons['No coordinates'] = (run.rejectReasons['No coordinates'] || 0) + 1;
        continue;
      }

      const { name, aliases } = pickNames(tags);
      const rejection = shouldReject(tags, name);
      if (rejection.reject) {
        run.rejected += 1;
        run.rejectReasons[rejection.reason] = (run.rejectReasons[rejection.reason] || 0) + 1;
        continue;
      }

      const canonical = mapOsmToCanonical(tags);
      usable.push({
        el,
        tags,
        name,
        aliases,
        lat: coords.lat,
        lng: coords.lng,
        canonicalKey: canonical?.key ?? null,
        canonicalGroup: canonical?.group ?? null,
      });
    }

    // ── 4. 既存の紐づけをまとめて引く（冪等性） ──
    const linked = await getLinkedSpotIds(
      usable.map((u) => ({ osmType: u.el.type, osmId: String(u.el.id) }))
    );

    // ── 5. Matching ──
    const records: StagingRecord[] = [];
    const now = new Date().toISOString();

    for (const u of usable) {
      const stagingId = makeStagingId(u.el.type, String(u.el.id));
      const alreadyLinked = linked.get(stagingId) || null;

      const match = matchOsmCandidate(
        {
          osmType: u.el.type,
          osmId: String(u.el.id),
          name: u.name,
          aliases: u.aliases,
          lat: u.lat,
          lng: u.lng,
          canonicalKey: u.canonicalKey,
          officialUrl: u.tags.website || u.tags['contact:website'],
        },
        existing,
        alreadyLinked
      );

      const addr = addressOf(u.tags);
      records.push({
        id: stagingId,
        osmType: u.el.type,
        osmId: String(u.el.id),
        name: u.name,
        aliases: u.aliases,
        lat: u.lat,
        lng: u.lng,
        prefecture,
        city: addr.city,
        address: addr.address,
        officialUrl: u.tags.website || u.tags['contact:website'],
        canonicalGroup: u.canonicalGroup ?? undefined,
        canonicalKey: u.canonicalKey ?? undefined,
        osmTags: u.tags,
        matchStatus: match.status,
        matchedSpotId: match.matchedSpotId,
        confidence: match.confidence,
        candidates: match.candidates.slice(0, 5),
        matchReason: match.reason,
        importRunId: runId,
        createdAt: now,
        updatedAt: now,
      });

      run.counts[match.status] = (run.counts[match.status] || 0) + 1;
    }

    // ── 6. Staging へ保存 ──
    if (!dryRun) {
      run.staged = await bulkSaveStaging(records);
    }

    run.status = 'completed';
    run.errors = errors;
    run.finishedAt = new Date().toISOString();
    if (!dryRun) await saveImportRun(run);

    return json({
      dryRun,
      group: groupKey,
      groupLabel: IMPORT_GROUPS[groupIndex].label,
      nextGroup,
      run,
      // 判定結果の要約。処理をブラックボックスにしないため
      samples: {
        MATCHED: records.filter((r) => r.matchStatus === 'MATCHED').slice(0, 5).map(summarize),
        POSSIBLE_MATCH: records
          .filter((r) => r.matchStatus === 'POSSIBLE_MATCH')
          .slice(0, 10)
          .map(summarize),
        NEW: records.filter((r) => r.matchStatus === 'NEW').slice(0, 5).map(summarize),
      },
      attribution: '© OpenStreetMap contributors (ODbL 1.0)',
      hint: nextGroup
        ? `Next: run again with &group=${nextGroup}`
        : dryRun
          ? 'All groups done (dry run). Remove dryRun=1 to save to staging.'
          : 'All groups done. Review POSSIBLE_MATCH and NEW before publishing.',
    });
  } catch (err) {
    run.status = 'failed';
    run.errors = [...errors, String(err).slice(0, 200)];
    run.finishedAt = new Date().toISOString();
    await saveImportRun(run).catch(() => null);
    return json({ error: 'Import failed', detail: String(err) }, 500);
  }
}

function summarize(r: StagingRecord) {
  return {
    id: r.id,
    name: r.name,
    aliases: r.aliases,
    category: r.canonicalKey,
    matchedSpotId: r.matchedSpotId,
    confidence: r.confidence,
    reason: r.matchReason,
    candidates: r.candidates.map(
      (c) => `${c.spotId} (${c.distance}m, sim=${c.nameSimilarity}, conf=${c.confidence})`
    ),
  };
}
