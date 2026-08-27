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

type ContentType = 'trip' | 'guide' | 'spot';

interface ExploreResult {
  id: string;
  contentType: ContentType;
  title: string;
  image?: string;
  area?: string;
  summary?: string;
  href: string;
}

interface DestinationItem {
  id: string;
  title: string;
  category?: string;
  prefecture?: string;
  description?: string;
  image?: string;
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
  days?: { day: number }[];
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

async function fetchTrips(req: VercelRequest): Promise<ExploreResult[]> {
  try {
    const res = await fetch(`${baseUrl(req)}/api/trips?public=1`);
    if (!res.ok) return [];
    const json = await res.json();
    const items: TripItem[] = Array.isArray(json?.trips) ? json.trips : [];
    return items.map((t) => ({
      id: t.id,
      contentType: 'trip' as const,
      title: t.title,
      summary: t.summary,
      href: `/trips`,
    }));
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

  try {
    const [spots, guides, trips] = await Promise.all([
      type === 'all' || type === 'spot' ? fetchSpots(req) : Promise.resolve([]),
      type === 'all' || type === 'guide' ? fetchGuides(req) : Promise.resolve([]),
      type === 'all' || type === 'trip' ? fetchTrips(req) : Promise.resolve([]),
    ]);

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

    res.status(200).json({ results, total: results.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load explore results', detail: String(err) });
  }
}
