// /api/admin-osm-import.ts
// Vercel Serverless Function（Edge Runtime）
//
// OSM Import の「状況表示」のみを担う。
//
// 【なぜ取得処理をここから外したか】
// 当初はこのAPIでOverpassから取得していたが、
// Edge Function の実行時間上限（約25秒、変更不可）に対して
// 栃木県の寺社カテゴリだけでOverpassの処理が20秒を超え、
// 実測で FUNCTION_INVOCATION_TIMEOUT になった。
// 全国47都道府県では最初から成り立たない方式だった。
//
// 取得は GitHub Actions（.github/workflows/osm-import.yml →
// scripts/osm-import.ts）に移した。Actionsなら6時間使えるため、
// Overpassの応答を十分に待て、カテゴリ間に間隔も空けられる。
//
// このAPIに取得機能を残すと再び504を踏むため、意図的に削除している。
//
// GET /api/admin-osm-import → Import履歴とStagingの集計

import { isAdminRequest, adminUnauthorized } from './_adminAuth.js';
import { listImportRuns, getStagingSummary } from './_osmStaging.js';

export const config = { runtime: 'edge' };

/** 取得対象のカテゴリ。scripts/osm-import.ts と対応させる */
const IMPORT_GROUPS = [
  { key: 'worship', label: 'Shrines & temples' },
  { key: 'historic', label: 'Historic sites & castles' },
  { key: 'tourism', label: 'Attractions & museums' },
  { key: 'nature', label: 'Nature & viewpoints' },
  { key: 'park', label: 'Parks & gardens' },
  { key: 'onsen', label: 'Onsen' },
];

const PREFECTURES = [
  'Hokkaido', 'Aomori', 'Iwate', 'Miyagi', 'Akita', 'Yamagata', 'Fukushima',
  'Ibaraki', 'Tochigi', 'Gunma', 'Saitama', 'Chiba', 'Tokyo', 'Kanagawa',
  'Niigata', 'Toyama', 'Ishikawa', 'Fukui', 'Yamanashi', 'Nagano', 'Gifu',
  'Shizuoka', 'Aichi', 'Mie', 'Shiga', 'Kyoto', 'Osaka', 'Hyogo', 'Nara',
  'Wakayama', 'Tottori', 'Shimane', 'Okayama', 'Hiroshima', 'Yamaguchi',
  'Tokushima', 'Kagawa', 'Ehime', 'Kochi', 'Fukuoka', 'Saga', 'Nagasaki',
  'Kumamoto', 'Oita', 'Miyazaki', 'Kagoshima', 'Okinawa',
];

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (!(await isAdminRequest(req))) return adminUnauthorized();

  if (req.method === 'GET') {
    const [runs, staging] = await Promise.all([listImportRuns(), getStagingSummary()]);
    return json({
      runs,
      staging,
      availablePrefectures: PREFECTURES,
      importGroups: IMPORT_GROUPS,
      // Importの実行場所を画面から案内するため
      runner: {
        type: 'github-actions',
        workflow: 'OSM import',
        reason:
          'Overpass responses can take longer than the 25s Edge Function limit, so imports run in GitHub Actions.',
      },
      attribution: '© OpenStreetMap contributors (ODbL 1.0)',
    });
  }

  if (req.method === 'POST') {
    return json(
      {
        error: 'Imports are no longer run from this API.',
        reason:
          'Overpass responses exceeded the 25s Edge Function limit. Run the "OSM import" workflow in GitHub Actions instead.',
        workflow: '.github/workflows/osm-import.yml',
      },
      410
    );
  }

  return json({ error: 'Method not allowed' }, 405);
}
