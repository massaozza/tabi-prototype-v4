// scripts/osm-import.ts
//
// OpenStreetMap から都道府県単位でSpot候補を取得し、KVのStagingへ保存する。
//
//   npm run osm:import -- --prefecture=Tochigi
//   npm run osm:import -- --prefecture=Tochigi --dry-run
//   npm run osm:import -- --prefecture=Tochigi --group=worship
//
// 【なぜVercelではなくGitHub Actionsで実行するか】
// Vercel Edge Function の実行時間上限は約25秒で変更できない。
// 栃木県の寺社カテゴリだけでOverpassの処理が20秒を超え、
// 実測で FUNCTION_INVOCATION_TIMEOUT になった。
// 全国47都道府県では最初から成り立たない方式だった。
//
// GitHub Actions なら6時間まで使えるため、
//   - Overpassの応答を十分に待てる
//   - カテゴリ間に間隔を空けて負荷をかけない
//   - 将来 Geofabrik の OSM extract をオフライン処理する道も残る
//
// 【Matchingロジックは api/_osmMatching.ts を共有する】
// 判定ロジックを二重に持つと必ず片方が古くなる。
// このスクリプトはビルド時にesbuildでバンドルして実行する。
//
// 必要な環境変数：
//   KV_REST_API_URL / KV_REST_API_TOKEN

import {
  mapOsmToCanonical,
  matchOsmCandidate,
  shouldReject,
  guessCategoryKeyFromLegacy,
  cleanOsmName,
  isLowQualityRomaji,
  travelValueScore,
  reviewPriority,
  detectBatchDuplicates,
  type ExistingSpotRef,
  type MatchStatus,
  type DedupeInput,
} from '../api/_osmMatching.js';

// ───────────────────────────────────────────────
// 設定
// ───────────────────────────────────────────────

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

if (!KV_URL || !KV_TOKEN) {
  console.error('KV_REST_API_URL / KV_REST_API_TOKEN が設定されていません。');
  process.exit(1);
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

/** Overpassへの配慮。カテゴリ間に必ず待機を入れる */
const DELAY_BETWEEN_GROUPS_MS = 8000;
/** Overpass側のタイムアウト。Actionsは6時間使えるので余裕を持たせる */
const OVERPASS_TIMEOUT_SEC = 180;

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

/**
 * 取得対象のカテゴリ群。
 *
 * 【指示書10に沿った方針】
 * 観光価値が明確なものに限定する。
 * Restaurant / Cafe は全国Importの対象外とし、
 * Creator投稿や人気エリアから個別に追加する。
 */
const IMPORT_GROUPS: { key: string; label: string; body: string }[] = [
  {
    key: 'worship',
    label: 'Shrines & temples',
    body: `
  node["amenity"="place_of_worship"]["name"](area.pref);
  way ["amenity"="place_of_worship"]["name"](area.pref);`,
  },
  {
    key: 'historic',
    label: 'Historic sites & castles',
    body: `
  node["historic"]["name"](area.pref);
  way ["historic"]["name"](area.pref);`,
  },
  {
    key: 'tourism',
    label: 'Attractions & museums',
    body: `
  node["tourism"~"^(attraction|museum|gallery|theme_park|aquarium|zoo)$"]["name"](area.pref);
  way ["tourism"~"^(attraction|museum|gallery|theme_park|aquarium|zoo)$"]["name"](area.pref);`,
  },
  {
    key: 'nature',
    label: 'Nature & viewpoints',
    body: `
  node["tourism"="viewpoint"]["name"](area.pref);
  node["natural"~"^(waterfall|peak|beach|cape|hot_spring)$"]["name"](area.pref);
  way ["natural"~"^(waterfall|beach|cape)$"]["name"](area.pref);`,
  },
  {
    key: 'park',
    label: 'Parks & gardens',
    body: `
  node["leisure"~"^(park|garden)$"]["name"](area.pref);
  way ["leisure"~"^(park|garden)$"]["name"](area.pref);`,
  },
  {
    key: 'onsen',
    label: 'Onsen',
    body: `
  node["amenity"~"^(onsen|public_bath)$"]["name"](area.pref);
  way ["amenity"~"^(onsen|public_bath)$"]["name"](area.pref);
  node["bath:type"="onsen"]["name"](area.pref);`,
  },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ───────────────────────────────────────────────
// KV（Upstash REST API）
// ───────────────────────────────────────────────

async function kvPipeline(commands: unknown[][]): Promise<unknown[]> {
  const res = await fetch(`${KV_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error(`KV pipeline failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { result: unknown }[];
  return data.map((r) => r.result);
}

async function kvCommand(command: unknown[]): Promise<unknown> {
  const [result] = await kvPipeline([command]);
  return result;
}

/** Upstashは値をJSON文字列で返すことがあるため両対応にする */
function parseValue(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') return v;
  if (typeof v === 'string') {
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  }
  return v;
}

// ───────────────────────────────────────────────
// Overpass
// ───────────────────────────────────────────────

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function buildQuery(prefJa: string, body: string): string {
  return `
[out:json][timeout:${OVERPASS_TIMEOUT_SEC}][maxsize:268435456];
area["name"="${prefJa}"]["admin_level"="4"]->.pref;
(${body}
);
out tags center;
`.trim();
}

/**
 * Overpassから取得する。
 *
 * 公開の共有リソースなので、429/504は指数バックオフで待ってから再試行し、
 * それでも駄目なら別エンドポイントへ切り替える。
 * Actionsは実行時間に余裕があるため、十分に待てる。
 */
async function fetchOverpass(query: string, errors: string[]): Promise<OverpassElement[] | null> {
  for (const endpoint of OVERPASS_ENDPOINTS) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'TABI47/1.0 (https://www.tabi47.com; spot import)',
          },
          body: `data=${encodeURIComponent(query)}`,
        });

        if (res.status === 429 || res.status === 504) {
          const wait = attempt * 30000;
          console.log(`    ${res.status} を受信。${wait / 1000}秒待って再試行 (${attempt}/3)`);
          errors.push(`${endpoint} returned ${res.status}`);
          await sleep(wait);
          continue;
        }
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          errors.push(`${endpoint} returned ${res.status}: ${body.slice(0, 200)}`);
          break;
        }

        const data = (await res.json()) as { elements?: OverpassElement[] };
        if (!Array.isArray(data.elements)) {
          errors.push(`${endpoint} returned unexpected payload`);
          break;
        }
        return data.elements;
      } catch (e) {
        errors.push(`${endpoint} failed: ${String(e).slice(0, 160)}`);
        await sleep(5000);
      }
    }
    console.log(`    ${endpoint} で取得できず。次のエンドポイントを試します`);
  }
  return null;
}

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
 * 存在しない翻訳を推測で生成しない。
 * name:en があればそれを表示名にし、name（多くは日本語）は別表記として保持する。
 */
function pickNames(tags: Record<string, string>): { name: string; aliases: string[] } {
  const en = tags['name:en'];
  const ja = cleanOsmName(tags['name:ja'] || tags.name || '');
  const romaji = tags['name:ja-Latn'] || tags['name:ja_rm'];

  // 【表示名の選び方】
  // name:en を優先するが、機械的なローマ字転写（例: "torinokosanshou jinjya"）は
  // 表示名として不適切なので日本語名を使う。
  // TABI47は表示時に自動翻訳を通すため、日本語名でも各言語に変換される。
  // 質の低いローマ字より日本語のほうが翻訳の入力としても正確。
  let primary = '';
  if (en && !isLowQualityRomaji(en)) primary = cleanOsmName(en);
  else if (ja) primary = ja;
  else if (romaji && !isLowQualityRomaji(romaji)) primary = cleanOsmName(romaji);
  else primary = cleanOsmName(en || romaji || '');

  const aliases = [ja, en, romaji, tags.int_name, tags.alt_name]
    .map((v) => (v ? cleanOsmName(v) : v))
    .filter((v): v is string => Boolean(v) && v !== primary);

  return { name: primary, aliases: [...new Set(aliases)] };
}

function addressOf(tags: Record<string, string>): { city?: string; address?: string } {
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

// ───────────────────────────────────────────────
// 本体
// ───────────────────────────────────────────────

interface Args {
  prefecture: string;
  groups: string[];
  dryRun: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (name: string): string | undefined => {
    const hit = argv.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.split('=').slice(1).join('=') : undefined;
  };

  const prefecture = get('prefecture') || '';
  const groupArg = get('group');
  const groups = groupArg
    ? groupArg.split(',').map((g) => g.trim()).filter(Boolean)
    : IMPORT_GROUPS.map((g) => g.key);

  return { prefecture, groups, dryRun: argv.includes('--dry-run') };
}

/** 既存の公開Spotを読む（Matchingの照合先） */
async function loadExistingSpots(): Promise<ExistingSpotRef[]> {
  const ids = ((await kvCommand(['SMEMBERS', 'spots:status:published'])) || []) as string[];
  const clean = ids.filter(Boolean);
  const out: ExistingSpotRef[] = [];

  const CHUNK = 100;
  for (let i = 0; i < clean.length; i += CHUNK) {
    const slice = clean.slice(i, i + CHUNK);
    const results = await kvPipeline(slice.map((id) => ['GET', `spot:${id}`]));
    for (const r of results) {
      const s = parseValue(r) as Record<string, unknown> | null;
      if (!s || typeof s.id !== 'string') continue;
      out.push({
        id: s.id,
        title: String(s.title || ''),
        prefecture: s.prefecture ? String(s.prefecture) : undefined,
        lat: Number(s.lat),
        lng: Number(s.lng),
        category: s.category ? String(s.category) : undefined,
        // 既存367件は canonicalCategory を持たないため推定する
        canonicalCategory:
          (s.canonicalCategory as string) ||
          guessCategoryKeyFromLegacy(String(s.category || ''), String(s.title || '')) ||
          undefined,
        officialUrl: s.officialUrl ? String(s.officialUrl) : undefined,
        aliases: Array.isArray(s.aliases) ? (s.aliases as string[]) : undefined,
      });
    }
  }
  return out;
}

/** OSM要素が既にSpotへ紐づいているかをまとめて引く（冪等性の担保） */
async function loadOsmLinks(
  items: { osmType: string; osmId: string }[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const CHUNK = 100;
  for (let i = 0; i < items.length; i += CHUNK) {
    const slice = items.slice(i, i + CHUNK);
    const results = await kvPipeline(
      slice.map((it) => ['GET', `osm:src:${it.osmType}:${it.osmId}`])
    );
    slice.forEach((it, idx) => {
      const v = parseValue(results[idx]);
      if (typeof v === 'string' && v) map.set(`${it.osmType}-${it.osmId}`, v);
    });
  }
  return map;
}

const STAGING_TTL = 90 * 24 * 60 * 60;

async function main(): Promise<void> {
  const args = parseArgs();
  const prefJa = PREFECTURE_JA[args.prefecture];

  if (!prefJa) {
    console.error(`不明な都道府県: "${args.prefecture}"`);
    console.error(`指定できる値: ${Object.keys(PREFECTURE_JA).join(', ')}`);
    process.exit(1);
  }

  const groups = IMPORT_GROUPS.filter((g) => args.groups.includes(g.key));
  if (groups.length === 0) {
    console.error(`不明なカテゴリ: ${args.groups.join(', ')}`);
    console.error(`指定できる値: ${IMPORT_GROUPS.map((g) => g.key).join(', ')}`);
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log(`OSM Import: ${args.prefecture} (${prefJa})`);
  console.log(`カテゴリ: ${groups.map((g) => g.key).join(', ')}`);
  if (args.dryRun) console.log('※ dry-run: Stagingへの保存は行いません');
  console.log('='.repeat(60));

  // 既存Spotを1回だけ読む（カテゴリごとに読み直さない）
  console.log('\n既存Spotを読み込み中...');
  const existing = await loadExistingSpots();
  console.log(`  公開Spot: ${existing.length} 件`);
  if (existing.length === 0) {
    console.error('公開Spotが0件です。Migrationが完了しているか確認してください。');
    process.exit(1);
  }

  const totals = {
    fetched: 0,
    staged: 0,
    rejected: 0,
    MATCHED: 0,
    POSSIBLE_MATCH: 0,
    NEW: 0,
    REJECTED: 0,
  };
  const allRejectReasons: Record<string, number> = {};
  const allErrors: string[] = [];
  const runId = `${args.prefecture}-${Date.now()}`;
  const samples: Record<string, unknown[]> = { MATCHED: [], POSSIBLE_MATCH: [], NEW: [] };
  // 重複検出はカテゴリを横断して行うため、いったん全件をためる
  const allRecords: Record<string, unknown>[] = [];

  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];
    console.log(`\n[${gi + 1}/${groups.length}] ${group.label}`);

    const errors: string[] = [];
    const elements = await fetchOverpass(buildQuery(prefJa, group.body), errors);
    allErrors.push(...errors);

    if (!elements) {
      console.log('  取得に失敗しました。次のカテゴリへ進みます。');
      continue;
    }
    console.log(`  取得: ${elements.length} 件`);
    totals.fetched += elements.length;

    // ── 正規化と除外 ──
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
        totals.rejected += 1;
        allRejectReasons['No coordinates'] = (allRejectReasons['No coordinates'] || 0) + 1;
        continue;
      }
      const { name, aliases } = pickNames(tags);
      const rejection = shouldReject(tags, name);
      if (rejection.reject) {
        totals.rejected += 1;
        allRejectReasons[rejection.reason] = (allRejectReasons[rejection.reason] || 0) + 1;
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
    console.log(`  除外後: ${usable.length} 件`);

    // ── 既存の紐づけを引く ──
    const links = await loadOsmLinks(
      usable.map((u) => ({ osmType: u.el.type, osmId: String(u.el.id) }))
    );

    // ── Matching ──
    // 【重複検出のため、この段階では保存しない】
    // OSMは同じ施設に node と way の両方を持つことが多く、
    // 実測で日光東照宮が2件取得された。
    // カテゴリを横断して重複を見る必要があるため、
    // 全カテゴリの処理が終わってからまとめて判定する。
    const now = new Date().toISOString();
    const records: Record<string, unknown>[] = [];

    for (const u of usable) {
      const stagingId = `${u.el.type}-${u.el.id}`;
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
        links.get(stagingId) || null
      );

      const addr = addressOf(u.tags);
      // 旅行価値スコア。除外ではなくReviewの優先順位付けに使う
      const value = travelValueScore(u.tags, u.name, u.canonicalKey);

      records.push({
        id: stagingId,
        osmType: u.el.type,
        osmId: String(u.el.id),
        name: u.name,
        aliases: u.aliases,
        lat: u.lat,
        lng: u.lng,
        prefecture: args.prefecture,
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
        travelScore: value.score,
        travelSignals: value.signals,
        reviewPriority: reviewPriority(value.score),
        importRunId: runId,
        createdAt: now,
        updatedAt: now,
      });

      totals[match.status] += 1;

      // 判定内容を確認できるようサンプルを残す
      // POSSIBLE_MATCH は誤統合の危険があるため全件残す。
      // MATCHED / NEW は件数が多いのでサンプルに留める。
      const bucket = samples[match.status];
      const limit = match.status === 'POSSIBLE_MATCH' ? 100 : 10;
      if (bucket && bucket.length < limit) {
        bucket.push({
          name: u.name,
          aliases: u.aliases,
          category: u.canonicalKey,
          travelScore: value.score,
          matchedSpotId: match.matchedSpotId,
          confidence: match.confidence,
          reason: match.reason,
          candidates: match.candidates.map(
            (c) => `${c.spotId} (${c.distance}m, sim=${c.nameSimilarity}, conf=${c.confidence})`
          ),
        });
      }
    }

    const counts = records.reduce<Record<string, number>>((acc, r) => {
      const s = String(r.matchStatus);
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {});
    console.log(
      `  判定: MATCHED=${counts.MATCHED || 0} POSSIBLE=${counts.POSSIBLE_MATCH || 0} NEW=${counts.NEW || 0}`
    );

    allRecords.push(...records);

    // Overpassへの連続アクセスを避ける
    if (gi < groups.length - 1) {
      console.log(`  ${DELAY_BETWEEN_GROUPS_MS / 1000}秒待機...`);
      await sleep(DELAY_BETWEEN_GROUPS_MS);
    }
  }

  // ───────────────────────────────────────────
  // カテゴリを跨いだ重複除去
  // ───────────────────────────────────────────
  // 同一のOSM要素（同じosmType+osmId）が複数のカテゴリクエリに
  // 引っかかることがある（例: 日光東照宮が Shrines & temples と
  // Historic sites の両方でヒット）。この場合 allRecords に同じidの
  // レコードが2件以上入り、totals/samples が水増しされ、Stagingへの
  // 保存時も同じKVキーに上書きされるため実際の保存件数と集計値がずれる。
  // MATCHED > POSSIBLE_MATCH > NEW の優先度で1件に統合する。
  const statusRank: Record<string, number> = { MATCHED: 0, POSSIBLE_MATCH: 1, NEW: 2 };
  const byRecordId = new Map<string, Record<string, unknown>>();
  for (const r of allRecords) {
    const id = String(r.id);
    const prev = byRecordId.get(id);
    if (!prev) {
      byRecordId.set(id, r);
      continue;
    }
    const prevRank = statusRank[String(prev.matchStatus)] ?? 99;
    const nextRank = statusRank[String(r.matchStatus)] ?? 99;
    if (
      nextRank < prevRank ||
      (nextRank === prevRank && Number(r.travelScore) > Number(prev.travelScore))
    ) {
      byRecordId.set(id, r);
    }
  }
  const crossCategoryDuplicates = allRecords.length - byRecordId.size;
  allRecords.length = 0;
  allRecords.push(...byRecordId.values());
  if (crossCategoryDuplicates > 0) {
    console.log(
      `  カテゴリ横断の重複: ${crossCategoryDuplicates} 件（同一施設が複数カテゴリで取得されたため統合）`
    );
  }

  // totals/samples の作り直しは、この後のバッチ内重複検出も終わってから
  // まとめて行う（そうしないとログの「POSSIBLE_MATCH（N件）」の見出しと
  // 「結果」セクションの集計値がずれてしまうため）。

  // ───────────────────────────────────────────
  // バッチ内の重複検出（カテゴリ横断）
  // ───────────────────────────────────────────
  // OSMは同じ施設に node（POI）と way（建物・敷地）の両方を持つことが多い。
  // 検出しないと、承認時に同じSpotが2つできてしまう。
  console.log('\n重複を検出中...');
  const dedupeInput: DedupeInput[] = allRecords.map((r) => ({
    key: String(r.id),
    osmType: String(r.osmType),
    name: String(r.name),
    aliases: Array.isArray(r.aliases) ? (r.aliases as string[]) : [],
    lat: Number(r.lat),
    lng: Number(r.lng),
    canonicalKey: (r.canonicalKey as string) ?? null,
    tagCount: Object.keys((r.osmTags as Record<string, string>) || {}).length,
    score: Number(r.travelScore) || 0,
  }));

  const dupGroups = detectBatchDuplicates(dedupeInput);
  const duplicateOf = new Map<string, string>();
  for (const g of dupGroups) {
    for (const d of g.duplicates) duplicateOf.set(d, g.representative);
  }
  console.log(`  重複グループ: ${dupGroups.length} / 統合される件数: ${duplicateOf.size}`);

  const byId = new Map(allRecords.map((r) => [String(r.id), r]));
  for (const [dupId, repId] of duplicateOf) {
    const rec = byId.get(dupId);
    if (!rec) continue;
    // 削除はせず、代表への参照を持たせてStagingに残す。
    // 判断の履歴を残すため、また誤検出だった場合に戻せるようにするため。
    rec.duplicateOf = repId;
    rec.matchStatus = 'REJECTED';
    rec.matchReason = `Duplicate of ${repId} within the same OSM import`;
  }

  // 統合後の件数を数え直す
  const finalCounts: Record<string, number> = {
    MATCHED: 0,
    POSSIBLE_MATCH: 0,
    NEW: 0,
    REJECTED: 0,
  };
  const priorityCounts: Record<string, number> = { high: 0, medium: 0, low: 0 };
  for (const r of allRecords) {
    finalCounts[String(r.matchStatus)] = (finalCounts[String(r.matchStatus)] || 0) + 1;
    if (r.matchStatus === 'NEW') {
      const p = String(r.reviewPriority);
      priorityCounts[p] = (priorityCounts[p] || 0) + 1;
    }
  }
  totals.MATCHED = finalCounts.MATCHED;
  totals.POSSIBLE_MATCH = finalCounts.POSSIBLE_MATCH;
  totals.NEW = finalCounts.NEW;
  totals.REJECTED = finalCounts.REJECTED;

  // samples もここで作り直す。カテゴリ横断の重複統合・バッチ内重複検出の
  // 両方が終わった後の最終的な matchStatus を反映することで、ログの
  // 「POSSIBLE_MATCH（N件）」の見出しと「結果」セクションの集計値が
  // 一致するようにする。
  samples.MATCHED = [];
  samples.POSSIBLE_MATCH = [];
  samples.NEW = [];
  for (const r of allRecords) {
    const status = String(r.matchStatus) as 'MATCHED' | 'POSSIBLE_MATCH' | 'NEW';
    const bucket = samples[status];
    const limit = status === 'POSSIBLE_MATCH' ? 100 : 10;
    if (bucket && bucket.length < limit) {
      bucket.push({
        name: r.name,
        aliases: r.aliases,
        category: r.canonicalKey,
        travelScore: r.travelScore,
        matchedSpotId: r.matchedSpotId,
        confidence: r.confidence,
        reason: r.matchReason,
        candidates: Array.isArray(r.candidates)
          ? (r.candidates as Array<Record<string, unknown>>).map(
              (c) => `${c.spotId} (${c.distance}m, sim=${c.nameSimilarity}, conf=${c.confidence})`
            )
          : [],
      });
    }
  }

  // ───────────────────────────────────────────
  // Stagingへ保存
  // ───────────────────────────────────────────
  if (!args.dryRun && allRecords.length > 0) {
    console.log('\nStagingへ保存中...');
    const CHUNK = 50;
    for (let i = 0; i < allRecords.length; i += CHUNK) {
      const slice = allRecords.slice(i, i + CHUNK);
      await kvPipeline(
        slice.map((r) => [
          'SET',
          `osm:staging:${r.id}`,
          JSON.stringify(r),
          'EX',
          String(STAGING_TTL),
        ])
      );

      const byStatus = new Map<string, string[]>();
      for (const r of slice) {
        const s = String(r.matchStatus);
        const arr = byStatus.get(s) || [];
        arr.push(String(r.id));
        byStatus.set(s, arr);
      }
      const idxCommands: unknown[][] = [
        ['SADD', 'osm:staging:index', ...slice.map((r) => String(r.id))],
        ['SADD', `osm:staging:pref:${args.prefecture}`, ...slice.map((r) => String(r.id))],
      ];
      for (const [status, ids] of byStatus) {
        idxCommands.push(['SADD', `osm:staging:status:${status}`, ...ids]);
      }
      await kvPipeline(idxCommands);

      if ((i / CHUNK) % 10 === 0) {
        process.stdout.write(`\r  保存: ${Math.min(i + CHUNK, allRecords.length)}/${allRecords.length}`);
      }
    }
    console.log(`\r  保存: ${allRecords.length}/${allRecords.length}`);
    totals.staged = allRecords.length;
  }

  // ── Import記録を残す（処理をブラックボックスにしない） ──
  if (!args.dryRun) {
    const run = {
      runId,
      prefecture: args.prefecture,
      group: args.groups.join(','),
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      fetched: totals.fetched,
      staged: totals.staged,
      counts: {
        MATCHED: totals.MATCHED,
        POSSIBLE_MATCH: totals.POSSIBLE_MATCH,
        NEW: totals.NEW,
        REJECTED: totals.REJECTED,
      },
      rejected: totals.rejected,
      rejectReasons: allRejectReasons,
      errors: allErrors.slice(0, 20),
      status: 'completed',
      source: 'github-actions',
    };
    await kvPipeline([
      ['SET', `osm:run:${runId}`, JSON.stringify(run), 'EX', String(STAGING_TTL)],
      ['SADD', 'osm:runs:index', runId],
    ]);
  }

  // ── 結果の要約 ──
  console.log('\n' + '='.repeat(60));
  console.log('結果');
  console.log('='.repeat(60));
  console.log(`取得         : ${totals.fetched}`);
  console.log(`除外         : ${totals.rejected}`);
  console.log(`Staging保存  : ${totals.staged}${args.dryRun ? ' (dry-run)' : ''}`);
  console.log(`MATCHED      : ${totals.MATCHED}`);
  console.log(`POSSIBLE     : ${totals.POSSIBLE_MATCH}`);
  console.log(`NEW          : ${totals.NEW}`);
  console.log(`REJECTED     : ${totals.REJECTED}（重複 ${duplicateOf.size} 件を含む）`);
  console.log('');
  console.log('NEW の Review優先度（旅行価値スコアによる）:');
  console.log(`  high   (70以上): ${priorityCounts.high}  ← まず確認すべき候補`);
  console.log(`  medium (35〜69): ${priorityCounts.medium}`);
  console.log(`  low    (34以下): ${priorityCounts.low}  ← 公開しない前提`);
  console.log('');
  console.log('除外理由:');
  for (const [reason, count] of Object.entries(allRejectReasons).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${reason}: ${count}`);
  }

  if (allErrors.length > 0) {
    console.log('');
    console.log(`Overpassの警告・エラー (${allErrors.length}件):`);
    for (const e of allErrors.slice(0, 10)) console.log(`  ${e}`);
  }

  // ── 判定内容を確認できるように出力する ──
  // POSSIBLE_MATCH は誤統合の危険があるため最初に、全件出す。
  const possible = samples.POSSIBLE_MATCH || [];
  console.log('');
  console.log('#'.repeat(60));
  console.log(`# POSSIBLE_MATCH （要確認・${possible.length}件）`);
  console.log('#'.repeat(60));
  console.log(
    possible.length === 0
      ? '  なし'
      : JSON.stringify(possible, null, 2)
  );

  const matched = samples.MATCHED || [];
  console.log('');
  console.log('#'.repeat(60));
  console.log(`# MATCHED （既存Spotに統合・サンプル${matched.length}件）`);
  console.log('#'.repeat(60));
  console.log(matched.length === 0 ? '  なし' : JSON.stringify(matched, null, 2));

  // NEW は件数が多いので、旅行価値スコアの高いものだけを出す
  const highValueNew = allRecords
    .filter((r) => r.matchStatus === 'NEW' && r.reviewPriority === 'high')
    .sort((a, b) => Number(b.travelScore) - Number(a.travelScore))
    .slice(0, 30)
    .map((r) => ({
      name: r.name,
      aliases: r.aliases,
      category: r.canonicalKey,
      travelScore: r.travelScore,
      signals: r.travelSignals,
    }));

  console.log('');
  console.log('#'.repeat(60));
  console.log(`# NEW / 優先度high （上位${highValueNew.length}件）`);
  console.log('#'.repeat(60));
  console.log(highValueNew.length === 0 ? '  なし' : JSON.stringify(highValueNew, null, 2));

  // 重複として統合されたもの
  if (dupGroups.length > 0) {
    console.log('');
    console.log('#'.repeat(60));
    console.log(`# 重複として統合（${dupGroups.length}グループ・上位20件）`);
    console.log('#'.repeat(60));
    const dupSamples = dupGroups.slice(0, 20).map((g) => ({
      representative: byId.get(g.representative)?.name,
      representativeId: g.representative,
      duplicates: g.duplicates.map((d) => `${byId.get(d)?.name} (${d})`),
    }));
    console.log(JSON.stringify(dupSamples, null, 2));
  }

  console.log('');
  console.log('© OpenStreetMap contributors (ODbL 1.0)');
  console.log(
    args.dryRun
      ? 'dry-run のため保存していません。--dry-run を外すとStagingへ保存します。'
      : '/admin/osm の Review queue で POSSIBLE_MATCH と NEW を確認してください。'
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
