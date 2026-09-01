// /api/spot-rating.ts
// Vercel Serverless Function（Node.js Runtime）
// TABI 3.0：SPOT詳細ページに、Googleの実際の評価（★）・レビュー数を表示するための
// 専用API。Places API (New) の Text Search を使い、SPOT名・都道府県から
// 該当する場所を検索し、評価・レビュー数を取得する。
//
// 【コスト面の配慮】Places APIは呼び出しごとに課金が発生するため、取得結果を
// KVに保存し、次回以降は再度APIを呼ばずキャッシュを返す
// （評価・レビュー数は日々大きく変わるものではないため、これで十分）。
// 手動で最新化したい場合は ?refresh=1 を付けて呼ぶと、キャッシュを無視して
// 再取得する。
//
// GET /api/spot-rating?id=xxx
//   → { rating: 4.5, userRatingCount: 7800, googleMapsUri: "https://..." }
//   → 見つからない・エラーの場合は { rating: null } を返す（画面側は非表示にする）

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

interface RatingResult {
  rating: number | null;
  userRatingCount?: number;
  googleMapsUri?: string;
  fetchedAt: string;
}

interface Destination {
  id: string;
  title: string;
  prefecture?: string;
}

function cacheKey(id: string): string {
  return `spot-rating:${id}`;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const id = typeof req.query.id === 'string' ? req.query.id : '';
  const forceRefresh = req.query.refresh === '1';
  if (!id) {
    res.status(400).json({ error: 'id is required' });
    return;
  }

  // キャッシュがあれば、それを返す（コスト削減のため）
  if (!forceRefresh) {
    try {
      const cached = await kv.get<RatingResult>(cacheKey(id));
      if (cached) {
        res.status(200).json(cached);
        return;
      }
    } catch {
      // キャッシュ取得に失敗しても、そのまま新規取得を試みる
    }
  }

  const apiKey = process.env.GOOGLE_GEOCODING_API_KEY;
  if (!apiKey) {
    res.status(200).json({ rating: null });
    return;
  }

  try {
    const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
    const host = req.headers.host;
    const contentRes = await fetch(`${proto}://${host}/api/content?type=destinations`);
    const contentJson = await contentRes.json();
    const destinations: Destination[] = Array.isArray(contentJson?.data) ? contentJson.data : [];
    const spot = destinations.find((d) => d.id === id);

    if (!spot) {
      res.status(200).json({ rating: null });
      return;
    }

    const query = spot.prefecture ? `${spot.title}, ${spot.prefecture}, Japan` : `${spot.title}, Japan`;

    // Places API (New) の Text Search
    const searchRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.rating,places.userRatingCount,places.googleMapsUri',
      },
      body: JSON.stringify({ textQuery: query, languageCode: 'en' }),
    });
    const searchJson = await searchRes.json();
    const place = searchJson?.places?.[0];

    const result: RatingResult = {
      rating: typeof place?.rating === 'number' ? place.rating : null,
      userRatingCount: typeof place?.userRatingCount === 'number' ? place.userRatingCount : undefined,
      googleMapsUri: typeof place?.googleMapsUri === 'string' ? place.googleMapsUri : undefined,
      fetchedAt: new Date().toISOString(),
    };

    await kv.set(cacheKey(id), result);
    res.status(200).json(result);
  } catch {
    res.status(200).json({ rating: null });
  }
}
