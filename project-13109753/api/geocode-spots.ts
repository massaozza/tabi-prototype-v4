// /api/geocode-spots.ts
// Vercel Serverless Function（Node.js Runtime）
// 【一時的な移行用API】既存367件のSPOT（destinations）に、Google Geocoding APIを
// 使って緯度・経度（lat/lng）を一括で付与するための、開発者専用ツール。
//
// AI Planner強化（Chat×Map×Itinerary）の前提として、地図上にSPOTのピンを
// 表示するには、各SPOTが緯度・経度を持っている必要があるが、今のSPOTデータ
// （homeData.ts）には位置情報が無いため、この処理で一括付与する。
//
// 使い方：
// GET /api/geocode-spots?offset=0&limit=20
//   → 現在のdestinationsデータ（/api/content?type=destinations と同じ
//     データソース）を取得し、offset番目からlimit件だけジオコーディングする
//   → 一度に大量に処理するとVercelの実行時間制限に達する可能性があるため、
//     20件程度ずつ、offsetを増やして繰り返し呼び出すことを推奨する
//   → レスポンスで { total, processed, results: [{ id, title, lat, lng } ...] } を返す
//   → この結果を使って、homeData.ts の各destinationにlat/lngを追記する
//
// 認証は不要（開発者が手動でこのURLを叩く一時的な移行ツールのため）。

import type { VercelRequest, VercelResponse } from '@vercel/node';

interface Destination {
  id: string;
  title: string;
  prefecture?: string;
  category?: string;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GOOGLE_GEOCODING_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server misconfigured: GOOGLE_GEOCODING_API_KEY is not set' });
    return;
  }

  const offset = Number(req.query.offset) || 0;
  const limit = Math.min(Number(req.query.limit) || 20, 50); // 1回の上限は50件

  let destinations: Destination[] = [];
  try {
    const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
    const host = req.headers.host;
    const contentRes = await fetch(`${proto}://${host}/api/content?type=destinations`);
    if (!contentRes.ok) {
      res.status(502).json({ error: 'Failed to fetch destinations from /api/content' });
      return;
    }
    const contentJson = await contentRes.json();
    destinations = Array.isArray(contentJson?.data) ? contentJson.data : [];
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch destinations', detail: String(err) });
    return;
  }

  const slice = destinations.slice(offset, offset + limit);

  const results = await Promise.all(
    slice.map(async (dest) => {
      // 都道府県名も一緒に渡すことで、同名の別の場所と間違えるのを防ぐ
      const query = dest.prefecture ? `${dest.title}, ${dest.prefecture}, Japan` : `${dest.title}, Japan`;
      try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
          query
        )}&key=${apiKey}`;
        const geoRes = await fetch(url);
        const geoJson = await geoRes.json();

        if (geoJson.status !== 'OK' || !geoJson.results?.[0]?.geometry?.location) {
          return { id: dest.id, title: dest.title, error: geoJson.status || 'No result' };
        }

        const { lat, lng } = geoJson.results[0].geometry.location;
        return { id: dest.id, title: dest.title, lat, lng };
      } catch (err) {
        return { id: dest.id, title: dest.title, error: String(err) };
      }
    })
  );

  res.status(200).json({
    total: destinations.length,
    offset,
    limit,
    processed: slice.length,
    results,
  });
}
