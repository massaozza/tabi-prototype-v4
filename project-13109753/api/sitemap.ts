// /api/sitemap.ts
// Vercel Serverless Function（Edge Runtime）
//
// 【なぜEdge Runtimeにしたか】
// このプロジェクトはNode.js Runtime関数が既に12本ちょうどで上限に
// 達している（13本目は追加してもエラーにならず、静かに404になる
// という過去の教訓がある）。sitemapはGemini呼び出し等のNode専用機能を
// 使わないため、Edge Runtimeで実装してNode枠を消費しないようにした。
//
// 【なぜ必要か】
// これまでsitemap.xml・robots.txtが一切存在せず、Googleがサイト内の
// ページ（特に1万件を超える個別Spotページ）を発見する手段が、
// リンクをたどるクロールだけに頼っていた。sitemapを置くことで、
// 全ページのURLをGoogleに直接伝えられ、索引付けが速くなる。
//
// 【動的に生成する理由】
// Spotの件数・IDは日々増えるため、ビルド時の静的ファイルではなく、
// リクエストのたびにKVから最新の公開Spot一覧を読んで生成する。
// 1万件超でも smembers 1回で済むIDの一覧取得だけなので軽い
// （Spotの中身は使わない。URLの生成にはIDだけで十分なため）。
//
// 【アクセス経路】
// vercel.json の rewrites で /sitemap.xml → /api/sitemap を
// 割り当てている（検索エンジン・robots.txtが期待する慣例的なURLに
// 合わせるため）。

import { kv } from '@vercel/kv';

export const config = { runtime: 'edge' };

// 【2026-10-22 修正】正規ホストに合わせる。
// 本番は apex（tabi47.com）→ www.tabi47.com に転送され、canonical も
// `https://www.tabi47.com/en/...`（言語prefix付き）になっている。
// 以前は apex・prefixなしのURLを並べていたため、1万3千件すべてが
// 「転送されるURL」となり、Search Consoleで全件「検出 - インデックス未登録」に
// なっていた。サイトマップには転送されない最終URL（正規URL）だけを載せる。
const SITE_ORIGIN = 'https://www.tabi47.com';
/** 正規URLの言語prefix（canonicalが /en/ 付きのため） */
const LANG = 'en';

/**
 * サイトマップに載せるSpotの品質基準。
 *
 * 【なぜ絞るか】
 * 説明文が1文だけの似たページを1万件以上まとめて出すと、新規ドメインでは
 * 「薄いページ」と判断され、インデックスされにくい。まず中身のあるSpotだけを
 * 伝え、インデックスされてから基準を緩めて広げる。
 *   ・実質的な説明文（completeness.editorialContent）があり、かつ
 *     公式情報・Creatorの知識・旅行者の実体験のいずれかがある、または
 *   ・説明文そのものが十分長い（MIN_DESC_LENGTH 以上）
 * 緩めたいときは MIN_DESC_LENGTH を下げる、または ?all=1 で全件を確認できる。
 */
const MIN_DESC_LENGTH = 200;
const MGET_CHUNK = 250;
const MGET_PARALLEL = 6;

interface SpotLite {
  id?: string;
  description?: string;
  completeness?: {
    editorialContent?: boolean;
    officialInfo?: boolean;
    localKnowledge?: boolean;
    actualData?: boolean;
  };
}

function isIndexWorthy(spot: SpotLite | null | undefined): boolean {
  if (!spot) return false;
  const c = spot.completeness;
  if (c?.editorialContent && (c.officialInfo || c.localKnowledge || c.actualData)) return true;
  return typeof spot.description === 'string' && spot.description.trim().length >= MIN_DESC_LENGTH;
}

/** 公開Spotのうち、基準を満たすIDだけを返す。mgetを分割して読む */
async function listIndexWorthyIds(allIds: string[]): Promise<string[]> {
  const chunks: string[][] = [];
  for (let i = 0; i < allIds.length; i += MGET_CHUNK) chunks.push(allIds.slice(i, i + MGET_CHUNK));
  const out: string[] = [];
  for (let i = 0; i < chunks.length; i += MGET_PARALLEL) {
    const batch = chunks.slice(i, i + MGET_PARALLEL);
    const results = await Promise.all(
      batch.map(async (ids) => {
        const spots = (await kv.mget(...ids.map((id) => `spot:${id}`))) as (SpotLite | null)[];
        return ids.filter((_, idx) => isIndexWorthy(spots[idx]));
      }),
    );
    for (const r of results) out.push(...r);
  }
  return out;
}

/** 47都道府県。都道府県ページのURL生成に使う（表示名はSpotのprefectureフィールドと揃えている） */
const PREFECTURES = [
  'Hokkaido', 'Aomori', 'Iwate', 'Miyagi', 'Akita', 'Yamagata', 'Fukushima',
  'Ibaraki', 'Tochigi', 'Gunma', 'Saitama', 'Chiba', 'Tokyo', 'Kanagawa',
  'Niigata', 'Toyama', 'Ishikawa', 'Fukui', 'Yamanashi', 'Nagano', 'Gifu',
  'Shizuoka', 'Aichi', 'Mie', 'Shiga', 'Kyoto', 'Osaka', 'Hyogo', 'Nara',
  'Wakayama', 'Tottori', 'Shimane', 'Okayama', 'Hiroshima', 'Yamaguchi',
  'Tokushima', 'Kagawa', 'Ehime', 'Kochi', 'Fukuoka', 'Saga', 'Nagasaki',
  'Kumamoto', 'Oita', 'Miyazaki', 'Kagoshima', 'Okinawa',
];

/** 地方ページ（region）のスラッグ */
const REGIONS = [
  'hokkaido', 'tohoku', 'kanto', 'chubu', 'kansai', 'chugoku', 'shikoku', 'kyushu-okinawa',
];

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function urlEntry(path: string, changefreq: string, priority: string): string {
  return `  <url>\n    <loc>${xmlEscape(SITE_ORIGIN + path)}</loc>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const entries: string[] = [];

  entries.push(urlEntry(`/${LANG}`, 'daily', '1.0'));
  entries.push(urlEntry(`/${LANG}/explore`, 'daily', '0.9'));

  for (const pref of PREFECTURES) {
    entries.push(urlEntry(`/${LANG}/prefectures/${encodeURIComponent(pref)}`, 'weekly', '0.7'));
  }
  for (const region of REGIONS) {
    entries.push(urlEntry(`/${LANG}/regions/${region}`, 'weekly', '0.6'));
  }

  // 公開中のSpot一覧。基準を満たすものだけを載せる（?all=1 で全件）
  const all = new URL(req.url).searchParams.get('all') === '1';
  let totalPublished = 0;
  let included = 0;
  try {
    const ids = ((await kv.smembers('spots:status:published')) || []) as string[];
    totalPublished = ids.length;
    const target = all ? ids : await listIndexWorthyIds(ids);
    included = target.length;
    for (const id of target) {
      if (!id) continue;
      entries.push(urlEntry(`/${LANG}/destinations/${encodeURIComponent(id)}`, 'weekly', '0.5'));
    }
  } catch (err) {
    console.error('[sitemap] failed to list published spots:', err);
    // Spot一覧が取れなくても、静的ページ分だけは返す（全滅させない）
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      // 基準の調整用（公開Spot総数と、サイトマップに載せた件数）
      'X-Sitemap-Spots': `${included}/${totalPublished}`,
      // sitemapは日々のSpot増減はあるが、頻繁に見に行く必要はないため
      // 短めのキャッシュを許可し、クロールのたびにKVへ問い合わせるのを避ける
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
