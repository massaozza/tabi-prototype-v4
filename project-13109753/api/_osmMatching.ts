// /api/_osmMatching.ts
//
// OSMから取得したSpot候補が、既存のTABI47 Spotと同一かを判定する。
//
// 【最優先の方針：False Positive を避ける】
// 誤って別のSpotに統合すると、既存のGuide・Review・Trip・My Tripが
// 間違ったSpotに紐づく。これは「新規Spotが重複する」よりも深刻で、
// 後から気づいて直すのも困難になる。
// そのため迷った場合は必ず POSSIBLE_MATCH に落とし、人間の確認に回す。
//
// 【カテゴリごとに距離閾値を変える理由】
// 単一の距離閾値（例：150m）では現実に合わない。
//   - 寺社は境内に複数の堂宇が数十m間隔で並ぶ（東照宮と輪王寺は約300m）
//   - 飲食店は同一ビルに複数入る
//   - 公園・庭園は敷地が広く、代表点の定義が曖昧（数百m離れても同一）
// 密集しやすい種別は厳しく、面積が大きい種別は緩く設定する。
//
// 【重要】ファイル名を "_" で始めているのは、
// Vercelがこれをエンドポイントとして公開しないようにするため。

// ───────────────────────────────────────────────
// TABI47 Canonical Category
// ───────────────────────────────────────────────

export type CanonicalGroup = 'SEE' | 'DO' | 'EAT' | 'STAY' | 'SHOP' | 'MOVE';

export interface CanonicalCategory {
  group: CanonicalGroup;
  key: string;
}

/**
 * OSMのタグを TABI47 の Canonical Category に対応させる。
 * OSMのタグをそのままUIに出さないための変換表。
 */
export function mapOsmToCanonical(tags: Record<string, string>): CanonicalCategory | null {
  const t = (k: string) => tags[k];

  // ── SEE ──
  if (t('historic') === 'castle' || t('castle_type')) return { group: 'SEE', key: 'castle' };
  if (t('amenity') === 'place_of_worship') {
    const religion = t('religion');
    if (religion === 'shinto') return { group: 'SEE', key: 'shrine_temple' };
    if (religion === 'buddhist') return { group: 'SEE', key: 'shrine_temple' };
    return { group: 'SEE', key: 'shrine_temple' };
  }
  if (t('tourism') === 'museum') return { group: 'SEE', key: 'museum' };
  if (t('tourism') === 'gallery') return { group: 'SEE', key: 'art' };
  if (t('tourism') === 'viewpoint') return { group: 'SEE', key: 'viewpoint' };
  if (t('historic')) return { group: 'SEE', key: 'historic' };
  if (t('leisure') === 'garden') return { group: 'SEE', key: 'garden' };
  if (t('leisure') === 'park' || t('boundary') === 'national_park') {
    return { group: 'SEE', key: 'park' };
  }
  if (t('natural') === 'waterfall' || t('waterway') === 'waterfall') {
    return { group: 'SEE', key: 'viewpoint' };
  }
  if (t('natural')) return { group: 'SEE', key: 'viewpoint' };

  // ── DO ──
  if (t('amenity') === 'onsen' || t('bath:type') === 'onsen' || t('amenity') === 'public_bath') {
    return { group: 'DO', key: 'onsen' };
  }
  if (t('tourism') === 'theme_park') return { group: 'DO', key: 'theme_park' };
  if (t('tourism') === 'aquarium') return { group: 'DO', key: 'aquarium' };
  if (t('tourism') === 'zoo') return { group: 'DO', key: 'zoo' };
  if (t('landuse') === 'winter_sports' || t('piste:type')) return { group: 'DO', key: 'ski' };
  if (t('tourism') === 'camp_site') return { group: 'DO', key: 'outdoor' };
  if (t('tourism') === 'attraction') return { group: 'SEE', key: 'attraction' };

  // ── STAY ──
  if (t('tourism') === 'hotel') return { group: 'STAY', key: 'hotel' };
  if (t('tourism') === 'ryokan' || t('hotel') === 'ryokan') return { group: 'STAY', key: 'ryokan' };
  if (t('tourism') === 'hostel' || t('tourism') === 'guest_house') {
    return { group: 'STAY', key: 'hostel' };
  }

  // ── EAT ──
  // 全国Importでは飲食店を対象外にする方針だが、
  // Creator投稿経由で入ってくる可能性があるため変換は用意する
  if (t('amenity') === 'restaurant') return { group: 'EAT', key: 'restaurant' };
  if (t('amenity') === 'cafe') return { group: 'EAT', key: 'cafe' };

  // ── SHOP ──
  if (t('shop') === 'mall' || t('shop') === 'department_store') {
    return { group: 'SHOP', key: 'shopping' };
  }
  if (t('amenity') === 'marketplace') return { group: 'SHOP', key: 'market' };

  // ── MOVE ──
  if (t('railway') === 'station') return { group: 'MOVE', key: 'station' };
  if (t('aeroway') === 'aerodrome') return { group: 'MOVE', key: 'airport' };

  return null;
}

// ───────────────────────────────────────────────
// カテゴリごとの距離閾値
// ───────────────────────────────────────────────

/**
 * 「同一Spotとみなしてよい最大距離（メートル）」。
 *
 * 密集しやすい種別は厳しく、敷地が広い種別は緩くする。
 * ここに収まっていても、名称が一致しなければ MATCHED にはしない。
 */
const DISTANCE_THRESHOLD: Record<string, number> = {
  // 密集しやすい：境内に複数の堂宇、同一ビルに複数店舗
  shrine_temple: 80,
  restaurant: 50,
  cafe: 50,
  hotel: 80,
  ryokan: 80,
  hostel: 80,
  station: 120, // 出口ごとにノードが分かれる

  // 標準
  attraction: 200,
  historic: 200,
  museum: 200,
  art: 200,
  viewpoint: 200,
  onsen: 150,
  aquarium: 200,
  zoo: 300,
  theme_park: 400,

  // 敷地が広く代表点が曖昧
  castle: 300,
  park: 300,
  garden: 300,
  ski: 800,
  outdoor: 300,
  airport: 1500,
  shopping: 150,
  market: 150,
};

const DEFAULT_THRESHOLD = 150;

export function distanceThresholdFor(categoryKey: string | null | undefined): number {
  if (!categoryKey) return DEFAULT_THRESHOLD;
  return DISTANCE_THRESHOLD[categoryKey] ?? DEFAULT_THRESHOLD;
}

/**
 * 既存Spotの日本語カテゴリ（「Culture & History」等）から
 * 距離閾値の判断に使う canonical key を推定する。
 * 既存367件は canonicalCategory を持たないため必要になる。
 */
export function guessCategoryKeyFromLegacy(category: string, title: string): string | null {
  const c = (category || '').toLowerCase();
  const n = (title || '').toLowerCase();

  if (/shrine|temple|jinja|taisha|-ji\b|dera/.test(n)) return 'shrine_temple';
  if (/castle|-jo\b/.test(n)) return 'castle';
  if (/onsen|hot spring/.test(n) || /hot springs/.test(c)) return 'onsen';
  if (/park|garden|koen|-en\b/.test(n)) return 'park';
  if (/museum/.test(n)) return 'museum';
  if (/station/.test(n)) return 'station';
  if (/falls|waterfall|gorge|valley|lake|mount|mt\.|beach|cape/.test(n)) return 'viewpoint';
  if (/theme park|land\b/.test(c)) return 'theme_park';
  if (/ski|snow/.test(c)) return 'ski';

  if (/culture & history/.test(c)) return 'historic';
  if (/nature & scenery/.test(c)) return 'viewpoint';
  return null;
}

// ───────────────────────────────────────────────
// 距離
// ───────────────────────────────────────────────

/** 2点間の距離（メートル）。Haversine */
export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

// ───────────────────────────────────────────────
// 名称の正規化と類似度
// ───────────────────────────────────────────────

/**
 * 施設種別を表す一般語。
 *
 * 【重要】これを単純に除去すると危険な誤判定が起きる。
 *   「Osaka Castle」と「Osaka Station」
 *     → castle も station も除去すると、両方 "osaka" になり同一と判定される
 *   「Hase-dera」と「Hase Station」
 *     → 同様に両方 "hase" になる
 *
 * そこで種別語は「除去して固有部分を比較する」だけでなく、
 * 「種別自体が矛盾していないか」も確認する。
 * 大阪城（castle）と大阪駅（station）は種別が違うので別施設と判定できる。
 */
const GENERIC_WORDS = [
  'shrine',
  'temple',
  'jinja',
  'jingu',
  'taisha',
  'gu',
  'ji',
  'dera',
  'in',
  'castle',
  'jo',
  'park',
  'garden',
  'koen',
  'museum',
  'station',
  'eki',
  'falls',
  'waterfall',
  'onsen',
  'hotspring',
  'hotsprings',
  'tower',
  'the',
  'of',
  'and',
];

/**
 * 名称から読み取れる施設種別のグループ。
 * 異なるグループなら、固有部分が一致していても別施設とみなす。
 */
const TYPE_GROUPS: { group: string; words: string[] }[] = [
  { group: 'worship', words: ['shrine', 'temple', 'jinja', 'jingu', 'taisha', 'dera', 'ji'] },
  { group: 'castle', words: ['castle', 'jo'] },
  { group: 'station', words: ['station', 'eki'] },
  { group: 'park', words: ['park', 'garden', 'koen'] },
  { group: 'museum', words: ['museum', 'gallery'] },
  // 同義語は同じグループにまとめる。
  // 「Kusatsu Onsen」と「Kusatsu Hot Spring」は同一施設なので、
  // onsen と hot spring を別グループにすると正当な一致を落としてしまう。
  { group: 'water', words: ['falls', 'waterfall'] },
  { group: 'onsen', words: ['onsen', 'hotsprings', 'hotspring', 'spa'] },
  { group: 'tower', words: ['tower'] },
];

/** 名称から施設種別グループを推定する。判定できなければ null */
function typeGroupOf(name: string): string | null {
  const n = normalizeName(name);
  for (const { group, words } of TYPE_GROUPS) {
    for (const w of words) {
      // 短い語（ji, jo, in, gu）は末尾でのみ種別とみなす。
      // 「Fujisan」の "ji" のような偶然の一致を避ける。
      if (w.length <= 2) {
        if (n.endsWith(w)) return group;
      } else if (n.includes(w)) {
        return group;
      }
    }
  }
  return null;
}

/**
 * 名称を比較用に正規化する。
 *
 * 「日光東照宮 / Nikko Toshogu Shrine / Nikkō Tōshō-gū / Toshogu Shrine」を
 * 同一視できるようにするため、以下を行う：
 *   - 小文字化
 *   - 発音記号の除去（Tōshō-gū → toshogu）
 *   - 記号・空白の除去
 */
export function normalizeName(name: string): string {
  if (!name) return '';
  return (
    name
      .toLowerCase()
      // 発音記号（マクロン等）を分解して除去する
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      // 記号・空白をすべて落とす
      .replace(/[\s\-_'’.,()（）「」・]/g, '')
  );
}

/**
 * 一般語を除いた固有部分を取り出す。
 *
 * 【注意】単純に部分文字列を除去すると壊れる。
 *   "hotspring" から "in" を除去すると "hotsprg" になり、
 *   別の名称と一致しなくなる。
 * そのため、
 *   1. 長い語から順に除去する（hotspring を in より先に処理）
 *   2. 短い語（2文字以下）は末尾でのみ除去する
 * という順序を守る。
 */
export function coreName(name: string): string {
  let s = normalizeName(name);

  // 長い語を先に処理する。'hotspring' を 'in' より先に消す必要がある
  const sorted = [...GENERIC_WORDS].sort((a, b) => b.length - a.length);

  for (const w of sorted) {
    if (w.length <= 2) {
      // ji / jo / in / gu などは末尾のみ除去する。
      // 語中で消すと Fujisan → Fusan のように壊れる。
      if (s.endsWith(w)) s = s.slice(0, -w.length);
    } else {
      s = s.split(w).join('');
    }
  }
  return s;
}

/** 日本語（漢字・かな）を含むか */
export function hasJapanese(s: string): boolean {
  return /[\u3040-\u30ff\u4e00-\u9fff]/.test(s || '');
}

/**
 * 名称の類似度（0〜1）。
 *
 * 完全一致だけでは「Nikkō Tōshō-gū」と「Nikko Toshogu Shrine」を拾えない。
 * かといって部分一致だけで判定すると「Nikko Station」と
 * 「Nikko Toshogu」を同一視してしまう。
 * そこで一般語を除いた固有部分で比較する。
 */
export function nameSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;

  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na && na === nb) return 1;

  // 日本語同士はそのまま比較する（ローマ字化は行わない）
  if (hasJapanese(a) && hasJapanese(b)) {
    if (na === nb) return 1;
    if (na.includes(nb) || nb.includes(na)) {
      const ratio = Math.min(na.length, nb.length) / Math.max(na.length, nb.length);
      return ratio >= 0.6 ? 0.85 : 0.5;
    }
    return 0;
  }

  // 施設種別が明確に矛盾している場合は別施設とみなす。
  // 「Osaka Castle」と「Osaka Station」は固有部分がどちらも "osaka" に
  // なってしまうため、種別で切り分けないと誤って統合される。
  const ga = typeGroupOf(a);
  const gb = typeGroupOf(b);
  if (ga && gb && ga !== gb) return 0;

  const ca = coreName(a);
  const cb = coreName(b);
  // 固有部分が短すぎる場合は判定材料にしない（一般語だけの名称）
  if (ca.length < 3 || cb.length < 3) return 0;

  if (ca === cb) return 0.95;

  if (ca.includes(cb) || cb.includes(ca)) {
    const shorter = ca.length < cb.length ? ca : cb;
    const longer = ca.length < cb.length ? cb : ca;
    const ratio = shorter.length / longer.length;

    // 【重要】「地名だけが共通」と「地名が省略された同一施設」を区別する。
    //
    //   同一施設: "Nikko Toshogu Shrine" と "Toshogu Shrine"
    //             → core: nikkotosho / tosho（後方が一致＝施設名が残っている）
    //   別施設:   "Nikko Toshogu Shrine" と "Nikko Station"
    //             → core: nikkotosho / nikko（前方が一致＝地名だけ共通）
    //
    // 短い側が長い側の「末尾」に含まれる場合は施設名の一致とみなし、
    // 「先頭」にしか含まれない場合は地名のみの一致として証拠にしない。
    const atEnd = longer.endsWith(shorter);
    const atStart = longer.startsWith(shorter);

    if (atStart && !atEnd && ratio < 0.75) {
      // 地名部分だけが共通している可能性が高い
      return 0;
    }

    if (ratio >= 0.8) return 0.85;
    if (ratio >= 0.45) return 0.6;
    return 0.3;
  }
  return 0;
}

// ───────────────────────────────────────────────
// 判定
// ───────────────────────────────────────────────

export type MatchStatus = 'MATCHED' | 'POSSIBLE_MATCH' | 'NEW' | 'REJECTED';

export interface MatchCandidate {
  spotId: string;
  title: string;
  distance: number;
  nameSimilarity: number;
  confidence: number;
  reason: string;
}

export interface ExistingSpotRef {
  id: string;
  title: string;
  prefecture?: string;
  lat: number;
  lng: number;
  category?: string;
  canonicalCategory?: string;
  officialUrl?: string;
  aliases?: string[];
}

export interface OsmCandidateInput {
  /** OSMの種別とID。既に紐づけ済みかの判定に使う */
  osmType: string;
  osmId: string;
  /** 表示名（name:en を優先し、無ければ name） */
  name: string;
  /** 日本語名など別表記 */
  aliases?: string[];
  lat: number;
  lng: number;
  canonicalKey?: string | null;
  officialUrl?: string;
}

export interface MatchResult {
  status: MatchStatus;
  matchedSpotId: string | null;
  confidence: number;
  candidates: MatchCandidate[];
  reason: string;
}

/**
 * OSM候補を既存Spot群と照合する。
 *
 * @param alreadyLinkedSpotId osm:src:{type}:{id} から引いた既存の紐づけ。
 *                            あれば即 MATCHED（冪等性の担保）。
 */
export function matchOsmCandidate(
  osm: OsmCandidateInput,
  existing: ExistingSpotRef[],
  alreadyLinkedSpotId?: string | null
): MatchResult {
  // ── 1. 既にこのOSM要素を取り込んでいる場合 ──
  // 同じImportを何度実行してもSpotが増えないようにするための最優先判定
  if (alreadyLinkedSpotId) {
    return {
      status: 'MATCHED',
      matchedSpotId: alreadyLinkedSpotId,
      confidence: 1,
      candidates: [],
      reason: 'Already linked by OSM id (idempotent)',
    };
  }

  const threshold = distanceThresholdFor(osm.canonicalKey);
  const candidates: MatchCandidate[] = [];

  for (const spot of existing) {
    if (typeof spot.lat !== 'number' || typeof spot.lng !== 'number') continue;

    const distance = distanceMeters(osm.lat, osm.lng, spot.lat, spot.lng);
    // 明らかに遠いものは候補にしない（計算量を抑える）
    if (distance > Math.max(threshold * 6, 2000)) continue;

    // OSM側の別表記も含めて最も高い類似度を採用する
    const names = [osm.name, ...(osm.aliases || [])].filter(Boolean);
    const spotNames = [spot.title, ...(spot.aliases || [])].filter(Boolean);
    let sim = 0;
    for (const n of names) {
      for (const sn of spotNames) {
        sim = Math.max(sim, nameSimilarity(n, sn));
      }
    }

    // 公式URLの一致は強い証拠
    const urlMatch =
      Boolean(osm.officialUrl && spot.officialUrl) &&
      normalizeUrl(osm.officialUrl!) === normalizeUrl(spot.officialUrl!);

    let confidence = 0;
    let reason = '';

    if (urlMatch) {
      confidence = 0.95;
      reason = 'Official website matches';
    } else if (distance <= threshold && sim >= 0.85) {
      confidence = 0.9;
      reason = `Within ${Math.round(distance)}m (limit ${threshold}m) and names match`;
    } else if (distance <= threshold && sim >= 0.5) {
      confidence = 0.6;
      reason = `Within ${Math.round(distance)}m but names only partially match`;
    } else if (distance <= threshold) {
      // 距離だけでは同一と判断しない。
      // 寺社の境内、駅の出口、同一ビルの店舗などで誤統合が起きるため。
      confidence = 0.3;
      reason = `Within ${Math.round(distance)}m but names do not match`;
    } else if (sim >= 0.95 && distance <= threshold * 4) {
      confidence = 0.55;
      reason = `Names match but ${Math.round(distance)}m apart (limit ${threshold}m)`;
    } else {
      continue;
    }

    candidates.push({
      spotId: spot.id,
      title: spot.title,
      distance: Math.round(distance),
      nameSimilarity: Number(sim.toFixed(2)),
      confidence: Number(confidence.toFixed(2)),
      reason,
    });
  }

  candidates.sort((a, b) => b.confidence - a.confidence || a.distance - b.distance);

  if (candidates.length === 0) {
    return {
      status: 'NEW',
      matchedSpotId: null,
      confidence: 0,
      candidates: [],
      reason: 'No existing spot nearby',
    };
  }

  const top = candidates[0];

  // 同程度の候補が複数ある場合は自動判定しない。
  // 寺院群のように近接した別施設が並ぶケースで誤統合を防ぐ。
  const ambiguous =
    candidates.length > 1 && candidates[1].confidence >= top.confidence - 0.1;

  if (top.confidence >= 0.85 && !ambiguous) {
    return {
      status: 'MATCHED',
      matchedSpotId: top.spotId,
      confidence: top.confidence,
      candidates,
      reason: top.reason,
    };
  }

  return {
    status: 'POSSIBLE_MATCH',
    matchedSpotId: null,
    confidence: top.confidence,
    candidates,
    reason: ambiguous
      ? `Multiple similar candidates (${candidates.length}); needs human review`
      : top.reason,
  };
}

function normalizeUrl(url: string): string {
  return url
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '');
}

// ───────────────────────────────────────────────
// 旅行価値の判定
// ───────────────────────────────────────────────

/**
 * 旅行Spotとして不適切なものを除外する。
 *
 * OSMには小さな祠、私有地の庭、バス停の待合所なども含まれる。
 * 全国Importでこれらを公開すると、旅行価値の低いSpotが大量に増える。
 */
export function shouldReject(
  tags: Record<string, string>,
  name: string
): { reject: boolean; reason: string } {
  if (!name || name.trim().length === 0) {
    return { reject: true, reason: 'No name' };
  }
  if (name.trim().length < 2) {
    return { reject: true, reason: 'Name too short' };
  }
  // 私有・立入禁止
  if (tags.access === 'private' || tags.access === 'no') {
    return { reject: true, reason: 'Private access' };
  }
  // 廃止・解体済み
  if (tags.abandoned || tags.disused || tags['demolished:building']) {
    return { reject: true, reason: 'Abandoned or disused' };
  }
  // 名前が種別そのままのもの（「神社」「公園」だけ等）は識別できない
  const core = coreName(name);
  if (core.length === 0 && !hasJapanese(name)) {
    return { reject: true, reason: 'Name consists only of generic words' };
  }
  return { reject: false, reason: '' };
}

// ───────────────────────────────────────────────
// 名称の整形（指示書のC）
// ───────────────────────────────────────────────

/**
 * 社格・寺格を表す接頭辞。
 * 「村社星宮神社」はSpot名としては「星宮神社」が適切で、
 * 「村社」は明治期の社格制度の名残であり施設名の一部ではない。
 */
const RANK_PREFIXES = [
  '官幣大社', '官幣中社', '官幣小社',
  '國幣大社', '国幣大社', '國幣中社', '国幣中社', '國幣小社', '国幣小社',
  '別格官幣社', '別表神社',
  '県社', '縣社', '府社', '郷社', '鄉社', '村社', '無格社',
];

/**
 * 表示名として使えるよう整形する。
 *
 * OSMの name はそのままでは品質にばらつきがある：
 *   「村社星宮神社」  … 社格の接頭辞が付いている
 *   "馬頭院<U+3000>金堂"  ... 全角スペースが入っている
 * これらを機械的に直せる範囲で整える。
 * ただし推測で情報を足すことはしない。
 */
export function cleanOsmName(name: string): string {
  if (!name) return '';
  let s = name
    // 全角スペースを半角に
    .replace(/\u3000/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  for (const prefix of RANK_PREFIXES) {
    if (s.startsWith(prefix) && s.length > prefix.length + 1) {
      s = s.slice(prefix.length).trim();
      break;
    }
  }
  return s;
}

/**
 * name:en が機械的なローマ字転写で、表示名として不適切かを判定する。
 *
 * 例：「torinokosanshou jinjya」
 *   - すべて小文字（固有名詞なのに大文字がない）
 *   - 「jinjya」のような非標準の転写
 * このような場合は、日本語名を使ったほうが良い。
 * TABI47は表示時に自動翻訳を通すため、日本語名でも各言語に変換される。
 */
export function isLowQualityRomaji(name: string): boolean {
  if (!name) return false;
  // 日本語を含むならローマ字ではない
  if (hasJapanese(name)) return false;
  // ラテン文字が含まれない
  if (!/[a-z]/i.test(name)) return false;

  // 大文字が1つもない固有名詞は機械的な転写の可能性が高い
  const hasUpperCase = /[A-Z]/.test(name);
  if (!hasUpperCase) return true;

  // 非標準の転写パターン
  if (/\b(jinjya|jinjyа|tera\b|dera\b|otera|jinnja)\b/i.test(name)) return true;

  return false;
}

// ───────────────────────────────────────────────
// 旅行価値スコア（指示書のA）
// ───────────────────────────────────────────────

export interface TravelValue {
  /** 0〜100。高いほど旅行Spotとして価値が高いと推定される */
  score: number;
  /** 判断の根拠。人間が確認できるようにする */
  signals: string[];
}

/**
 * 明らかに観光目的でない施設名のパターン。
 * 栃木県だけで公園が987件取得されたが、その大半は
 * 児童公園・街区公園といった地域住民向けの施設だった。
 */
const LOW_VALUE_NAME_PATTERNS: { pattern: RegExp; label: string; penalty: number }[] = [
  { pattern: /児童(公園|遊園)/, label: 'Children\'s playground', penalty: 60 },
  { pattern: /街区公園|近隣公園|ちびっこ広場|わんぱく広場/, label: 'Neighbourhood park', penalty: 55 },
  { pattern: /(第[0-9０-９一二三四五六七八九十]+|[0-9０-９]+)(公園|児童)/, label: 'Numbered local park', penalty: 45 },
  { pattern: /団地|社宅|集会所|自治会/, label: 'Residential facility', penalty: 60 },
  { pattern: /墓地|霊園|納骨/, label: 'Cemetery', penalty: 50 },
  { pattern: /^(祠|地蔵|道祖神|庚申塔|石仏|馬頭観音)$/, label: 'Small roadside shrine', penalty: 60 },
  { pattern: /公民館|集落センター/, label: 'Community centre', penalty: 55 },
];

/**
 * 旅行Spotとしての価値を推定する。
 *
 * 【なぜ除外ではなくスコアにするか】
 * 機械的に捨てると、価値あるSpotも一緒に失われる。
 * 「情報が少ない」ことと「価値がない」ことは別で、
 * 無名でも実際に訪れる価値のある場所は存在する。
 * そのため除外はせず、Reviewの優先順位付けに使う。
 * 低スコアのものは staging に残り、公開されない。
 *
 * 【スコアの根拠】
 * 「誰かが手をかけた形跡」を信号として使う。
 * Wikipedia記事や文化財指定は第三者による認知の証拠であり、
 * AIに観光価値を推測させるより確実で、事実に基づく。
 */
export function travelValueScore(
  tags: Record<string, string>,
  name: string,
  canonicalKey: string | null
): TravelValue {
  let score = 20; // 基準点
  const signals: string[] = [];

  // ── 第三者による認知（最も強い信号） ──
  if (tags.wikidata) {
    score += 30;
    signals.push('Has Wikidata entry');
  }
  if (tags.wikipedia || tags['wikipedia:ja'] || tags['wikipedia:en']) {
    score += 25;
    signals.push('Has Wikipedia article');
  }

  // ── 公的な指定 ──
  if (tags.heritage || tags['heritage:operator'] || tags.ref_cultural_property) {
    score += 25;
    signals.push('Designated heritage');
  }
  if (tags.protect_class || tags.protection_title) {
    score += 15;
    signals.push('Protected site');
  }

  // ── 訪問者向けの整備 ──
  if (tags['name:en']) {
    score += 12;
    signals.push('Has English name');
  }
  if (tags.website || tags['contact:website']) {
    score += 12;
    signals.push('Has website');
  }
  if (tags.opening_hours) {
    score += 8;
    signals.push('Has opening hours');
  }
  if (tags.fee || tags.charge) {
    score += 5;
    signals.push('Has admission info');
  }
  if (tags.image || tags.wikimedia_commons) {
    score += 8;
    signals.push('Has image');
  }
  if (tags.description || tags['description:en']) {
    score += 5;
    signals.push('Has description');
  }

  // ── 観光目的が明示されている ──
  if (tags.tourism === 'attraction' || tags.tourism === 'museum' || tags.tourism === 'theme_park') {
    score += 15;
    signals.push(`tourism=${tags.tourism}`);
  }
  if (canonicalKey === 'castle') {
    score += 20;
    signals.push('Castle');
  }
  if (canonicalKey === 'onsen') {
    score += 15;
    signals.push('Onsen');
  }
  if (tags.historic === 'monument' || tags.historic === 'memorial') {
    score += 5;
    signals.push(`historic=${tags.historic}`);
  }

  // ── 規模の手がかり ──
  if (tags['addr:full'] || tags['addr:street']) {
    score += 3;
    signals.push('Has address');
  }
  if (tags.phone || tags['contact:phone']) {
    score += 3;
    signals.push('Has phone');
  }

  // ── 減点 ──
  for (const { pattern, label, penalty } of LOW_VALUE_NAME_PATTERNS) {
    if (pattern.test(name)) {
      score -= penalty;
      signals.push(`- ${label}`);
      break;
    }
  }

  // 名前が短すぎる、情報がタグ名しかない
  const tagCount = Object.keys(tags).filter((k) => !k.startsWith('name')).length;
  if (tagCount <= 2) {
    score -= 10;
    signals.push('- Very few tags');
  }

  return { score: Math.max(0, Math.min(100, score)), signals };
}

/** Reviewの優先度。スコアから機械的に決める */
export function reviewPriority(score: number): 'high' | 'medium' | 'low' {
  if (score >= 70) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
}

// ───────────────────────────────────────────────
// バッチ内の重複検出（指示書14 / のB）
// ───────────────────────────────────────────────

export interface DedupeInput {
  key: string;
  osmType: string;
  name: string;
  aliases: string[];
  lat: number;
  lng: number;
  canonicalKey: string | null;
  tagCount: number;
  score: number;
}

export interface DedupeResult {
  /** 代表として残すキー */
  representative: string;
  /** 代表に統合されるキー */
  duplicates: string[];
  reason: string;
}

/**
 * 同一バッチ内の重複を検出する。
 *
 * 【なぜ必要か】
 * OSMは同じ施設に対して node（POI）と way（建物・敷地）の両方を
 * 持つことが多い。実測で日光東照宮が2件取得された。
 * これを検出しないと、承認時に同じSpotが2つできてしまう。
 *
 * 既存Spotとの照合（matchOsmCandidate）は候補と既存の比較であり、
 * 候補同士は見ていなかった。
 *
 * 【代表の選び方】
 * 情報量が多いもの、スコアが高いものを残す。
 * way は敷地全体を表すことが多く座標が代表点になりやすいため、
 * 同条件なら way を優先する。
 */
export function detectBatchDuplicates(items: DedupeInput[]): DedupeResult[] {
  const results: DedupeResult[] = [];
  const consumed = new Set<string>();

  // 座標で粗く区切って総当たりを避ける（件数が数千になるため）
  const cell = (lat: number, lng: number) => `${Math.floor(lat * 200)}:${Math.floor(lng * 200)}`;
  const grid = new Map<string, DedupeInput[]>();
  for (const it of items) {
    const k = cell(it.lat, it.lng);
    const arr = grid.get(k) || [];
    arr.push(it);
    grid.set(k, arr);
  }

  for (const item of items) {
    if (consumed.has(item.key)) continue;

    // 近傍セル（自セル＋周囲8）だけを見る
    const baseLat = Math.floor(item.lat * 200);
    const baseLng = Math.floor(item.lng * 200);
    const neighbours: DedupeInput[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        neighbours.push(...(grid.get(`${baseLat + dx}:${baseLng + dy}`) || []));
      }
    }

    const threshold = distanceThresholdFor(item.canonicalKey);
    const group: DedupeInput[] = [item];

    for (const other of neighbours) {
      if (other.key === item.key || consumed.has(other.key)) continue;

      const d = distanceMeters(item.lat, item.lng, other.lat, other.lng);
      if (d > threshold) continue;

      // 名称が一致しなければ別施設として扱う。
      // 距離だけで統合すると、境内の別の堂宇まで消えてしまう。
      let sim = 0;
      for (const a of [item.name, ...item.aliases]) {
        for (const b of [other.name, ...other.aliases]) {
          sim = Math.max(sim, nameSimilarity(a, b));
        }
      }
      if (sim >= 0.85) group.push(other);
    }

    if (group.length === 1) continue;

    // 代表を選ぶ：スコア → タグ数 → way優先
    group.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.tagCount !== a.tagCount) return b.tagCount - a.tagCount;
      if (a.osmType !== b.osmType) return a.osmType === 'way' ? -1 : 1;
      return a.key.localeCompare(b.key);
    });

    const rep = group[0];
    const dups = group.slice(1);
    for (const g of group) consumed.add(g.key);

    results.push({
      representative: rep.key,
      duplicates: dups.map((d) => d.key),
      reason: `Same place appears ${group.length} times in OSM (node/way duplication)`,
    });
  }

  return results;
}
