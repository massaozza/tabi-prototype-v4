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

const SITE_ORIGIN = 'https://tabi47.com';

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

  entries.push(urlEntry('/', 'daily', '1.0'));
  entries.push(urlEntry('/explore', 'daily', '0.9'));

  for (const pref of PREFECTURES) {
    entries.push(urlEntry(`/prefectures/${encodeURIComponent(pref)}`, 'weekly', '0.7'));
  }
  for (const region of REGIONS) {
    entries.push(urlEntry(`/regions/${region}`, 'weekly', '0.6'));
  }

  // 公開中のSpot一覧（IDだけをKVから直接読む。1回のsmembersで済む軽い処理）
  try {
    const ids = ((await kv.smembers('spots:status:published')) || []) as string[];
    for (const id of ids) {
      if (!id) continue;
      entries.push(urlEntry(`/destinations/${encodeURIComponent(id)}`, 'weekly', '0.5'));
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
      // sitemapは日々のSpot増減はあるが、頻繁に見に行く必要はないため
      // 短めのキャッシュを許可し、クロールのたびにKVへ問い合わせるのを避ける
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
