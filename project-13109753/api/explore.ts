// /api/explore.ts
// Vercel Serverless Function（Node.js Runtime）
// TABI 2.0：TRIP・GUIDE・SPOTを横断して検索・一覧表示するための統合API。
//
// 【重要】このファイルは自己完結型にしてある（api/内の他ファイルからも、
// src/内のファイルからもimportしない）。Node.js Runtimeでの
// クロスファイルimportはクラッシュの原因になるため。
// 各コンテンツは、既存の /api/content, /api/guides, /api/trips への
// サーバー間通信（内部HTTPリクエスト）で取得する。
//
// GET /api/explore?q=検索語&type=all|trip|guide|spot&area=都道府県名
//   → 3種類のコンテンツを正規化した同じ形（ExploreResult）で返す
//   → 認証不要（公開情報のみを対象にする）

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

type ContentType = 'trip' | 'guide' | 'spot';

interface ExploreResult {
  id: string;
  contentType: ContentType;
  title: string;
  image?: string;
  area?: string;
  summary?: string;
  href: string;
  lat?: number;
  lng?: number;
  category?: string;
}

interface DestinationItem {
  id: string;
  title: string;
  category?: string;
  prefecture?: string;
  description?: string;
  image?: string;
  lat?: number;
  lng?: number;
}

interface GuideItem {
  id: string;
  title: string;
  titleEn?: string;
  area?: string;
  areaEn?: string;
  bodyJa?: string;
  bodyEn?: string;
  photos?: string[];
}

interface TripItem {
  id: string;
  title: string;
  summary?: string;
  totalDays?: number;
  days?: { day: number; activities?: { spotId?: string }[] }[];
}

function baseUrl(req: VercelRequest): string {
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
  const host = req.headers.host;
  return `${proto}://${host}`;
}

async function fetchSpots(req: VercelRequest): Promise<ExploreResult[]> {
  try {
    const res = await fetch(`${baseUrl(req)}/api/content?type=destinations`);
    if (!res.ok) return [];
    const json = await res.json();
    const items: DestinationItem[] = Array.isArray(json?.data) ? json.data : [];
    return items.map((d) => ({
      id: d.id,
      contentType: 'spot' as const,
      title: d.title,
      image: d.image,
      area: d.prefecture,
      summary: d.description,
      href: `/destinations/${d.id}`,
      lat: d.lat,
      lng: d.lng,
      category: d.category,
    }));
  } catch {
    return [];
  }
}

async function fetchGuides(req: VercelRequest): Promise<ExploreResult[]> {
  try {
    const res = await fetch(`${baseUrl(req)}/api/guides`);
    if (!res.ok) return [];
    const json = await res.json();
    const items: GuideItem[] = Array.isArray(json?.guides) ? json.guides : [];
    return items.map((g) => ({
      id: g.id,
      contentType: 'guide' as const,
      title: g.titleEn || g.title,
      image: g.photos && g.photos.length > 0 ? g.photos[0] : undefined,
      area: g.areaEn || g.area,
      summary: g.bodyEn || g.bodyJa,
      href: `/guides/${g.id}`,
    }));
  } catch {
    return [];
  }
}

async function fetchTrips(
  req: VercelRequest,
  spotPrefectureById: Map<string, string>
): Promise<ExploreResult[]> {
  try {
    const res = await fetch(`${baseUrl(req)}/api/trips?public=1`);
    if (!res.ok) return [];
    const json = await res.json();
    const items: TripItem[] = Array.isArray(json?.trips) ? json.trips : [];
    return items.map((t) => {
      // Tripには都道府県の情報が直接無いため、Trip内で言及されている
      // Spotの都道府県から推測する（一番多く登場した都道府県を採用）
      const counts = new Map<string, number>();
      (t.days || []).forEach((d) => {
        (d.activities || []).forEach((a) => {
          if (a.spotId) {
            const pref = spotPrefectureById.get(a.spotId);
            if (pref) counts.set(pref, (counts.get(pref) || 0) + 1);
          }
        });
      });
      let area: string | undefined;
      let max = 0;
      counts.forEach((count, pref) => {
        if (count > max) {
          max = count;
          area = pref;
        }
      });

      return {
        id: t.id,
        contentType: 'trip' as const,
        title: t.title,
        summary: t.summary,
        href: `/trips/${t.id}`,
        area,
      };
    });
  } catch {
    return [];
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const q = (typeof req.query.q === 'string' ? req.query.q : '').trim().toLowerCase();
  const type = (typeof req.query.type === 'string' ? req.query.type : 'all') as
    | 'all'
    | ContentType;
  const area = (typeof req.query.area === 'string' ? req.query.area : '').trim().toLowerCase();
  const category = (typeof req.query.category === 'string' ? req.query.category : '').trim();
  const sort = (typeof req.query.sort === 'string' ? req.query.sort : 'popular') as
    | 'popular'
    | 'rating'
    | 'az';

  try {
    // TripのエリアをSpot経由で推測するため、typeの絞り込みに関わらず
    // Spot一覧は常に取得しておく（結果に含めるかどうかは別途判定する）
    const allSpots = await fetchSpots(req);
    const spotPrefectureById = new Map<string, string>(
      allSpots.filter((s) => s.area).map((s) => [s.id, s.area as string])
    );

    const [guides, trips] = await Promise.all([
      type === 'all' || type === 'guide' ? fetchGuides(req) : Promise.resolve([]),
      type === 'all' || type === 'trip' ? fetchTrips(req, spotPrefectureById) : Promise.resolve([]),
    ]);
    const spots = type === 'all' || type === 'spot' ? allSpots : [];

    let results: ExploreResult[] = [...spots, ...guides, ...trips];

    if (q) {
      results = results.filter((r) => {
        const haystack = `${r.title} ${r.summary || ''} ${r.area || ''}`.toLowerCase();
        return haystack.includes(q);
      });
    }

    if (area) {
      results = results.filter((r) => (r.area || '').toLowerCase().includes(area));
    }

    // SPOTのカテゴリ絞り込み（Temple/Nature/Restaurant等）。SPOT以外の
    // 種類（Trip/Guide）にはcategoryが無いため、この絞り込みは影響しない。
    if (category) {
      results = results.filter((r) => r.contentType !== 'spot' || r.category === category);
    }

    if (sort === 'az') {
      results = [...results].sort((a, b) => a.title.localeCompare(b.title));
    } else if (sort === 'rating') {
      // Googleの評価は、今のところSPOTにしか無いため、評価が無いもの
      // （Trip・Guide、および未取得のSPOT）は末尾に回す
      try {
        const ratingValues = await kv.mget<{ rating: number | null }[]>(
          ...results.map((r) => `spot-rating:${r.id}`)
        );
        results = results
          .map((r, idx) => ({ result: r, rating: ratingValues?.[idx]?.rating ?? null }))
          .sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1))
          .map((x) => x.result);
      } catch {
        // 評価の取得に失敗しても、並び替え無しでそのまま返す
      }
    } else {
      // デフォルト（popular）：TRIP・GUIDE・SPOTを横断して公平に比較できる
      // 指標は「閲覧数」のみのため、これを使って並び替える
      // （views:{contentType}:{id} キーは api/track-view.ts と共通のKVストアを参照する）
      try {
        const viewValues = await kv.mget<number[]>(
          ...results.map((r) => `views:${r.contentType}:${r.id}`)
        );
        results = results
          .map((r, idx) => ({ result: r, views: viewValues?.[idx] ?? 0 }))
          .sort((a, b) => b.views - a.views)
          .map((x) => x.result);
      } catch {
        // 閲覧数の取得に失敗しても、並び替え無しでそのまま返す
      }
    }

    res.status(200).json({ results, total: results.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load explore results', detail: String(err) });
  }
}
