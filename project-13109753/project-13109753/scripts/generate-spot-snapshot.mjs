// scripts/generate-spot-snapshot.mjs
//
// Published Spot から Last Known Good Snapshot を生成し、Cloudflare R2 へ保存する。
//
//   npm run snapshot:spots
//
// 【なぜ必要か】
// 移行後、Spotの正データは KV の spot:{id} にある。
// KVが読めない場合のフォールバックとして src/mocks/homeData.ts の367件を
// 使い続けると、次の問題が起きる：
//   - Admin編集後に正データと乖離する
//   - OSM Import後の新規Spotが含まれない
//   - 数千〜数万Spotに増えた際にFallbackとして不完全になる
//   - 障害時だけ古いデータに戻るという、気づきにくい不整合が生じる
//
// そこで「正データから自動生成される最新のSnapshot」をフォールバックにする。
//
// 【なぜ R2 か】
// KVが落ちたときの代替なので、KVとは別系統の永続ストレージが必要。
// R2は egress 無料なので、フォールバック読み出しのコストもかからない。
//
// 【なぜ都道府県単位に分割するか】
// 全国Import後は数万件になる。単一の巨大JSONでは読み込みが破綻し、
// 1件表示するために全件を落とすことになる。
// Spotの利用は「1件表示」か「都道府県内の一覧」なので、
// 都道府県単位に分けると必要な分だけ取得できる。
//
// 出力：
//   snapshot/spots/manifest.json          … 生成日時・件数・都道府県一覧
//   snapshot/spots/index.json             … id → prefecture の対応表
//   snapshot/spots/pref/{prefecture}.json … 都道府県ごとのSpot配列
//
// 必要な環境変数：
//   KV_REST_API_URL / KV_REST_API_TOKEN
//   R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET_NAME

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;

const missing = [];
if (!KV_URL) missing.push('KV_REST_API_URL');
if (!KV_TOKEN) missing.push('KV_REST_API_TOKEN');
if (!R2_ACCOUNT_ID) missing.push('R2_ACCOUNT_ID');
if (!R2_ACCESS_KEY_ID) missing.push('R2_ACCESS_KEY_ID');
if (!R2_SECRET_ACCESS_KEY) missing.push('R2_SECRET_ACCESS_KEY');
if (!R2_BUCKET_NAME) missing.push('R2_BUCKET_NAME');
if (missing.length > 0) {
  console.error('必要な環境変数が設定されていません:', missing.join(', '));
  process.exit(1);
}

const DRY_RUN = process.argv.includes('--dry-run');
const SNAPSHOT_PREFIX = 'snapshot/spots';

// ───────────────────────────────────────────────
// KV（Upstash REST API）
// ───────────────────────────────────────────────

/** Upstashのパイプラインで複数コマンドをまとめて実行する */
async function kvPipeline(commands) {
  const res = await fetch(`${KV_URL}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  });
  if (!res.ok) {
    throw new Error(`KV pipeline failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.map((r) => r.result);
}

async function kvCommand(command) {
  const [result] = await kvPipeline([command]);
  return result;
}

/** Upstashは値をJSON文字列で返すことがあるため、両方に対応する */
function parseValue(v) {
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
// R2
// ───────────────────────────────────────────────

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

async function putJson(key, data) {
  const body = JSON.stringify(data);
  if (DRY_RUN) {
    console.log(`  [dry-run] ${key} (${(Buffer.byteLength(body) / 1024).toFixed(1)}KB)`);
    return Buffer.byteLength(body);
  }
  await s3.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: 'application/json; charset=utf-8',
      // フォールバックは常に最新を読みたいので短めにする
      CacheControl: 'public, max-age=300',
    })
  );
  return Buffer.byteLength(body);
}

// ───────────────────────────────────────────────
// 本体
// ───────────────────────────────────────────────

/** フロントエンドが必要とするフィールドだけに絞る */
function toSnapshotShape(spot) {
  return {
    id: spot.id,
    title: spot.title,
    category: spot.category,
    prefecture: spot.prefecture,
    description: spot.description,
    lat: spot.lat,
    lng: spot.lng,
    image: spot.image,
    // 追加フィールドは存在するものだけ含める（Unknownを量産しない）
    ...(spot.city ? { city: spot.city } : {}),
    ...(spot.officialUrl ? { officialUrl: spot.officialUrl } : {}),
    ...(spot.canonicalCategory ? { canonicalCategory: spot.canonicalCategory } : {}),
  };
}

async function main() {
  console.log(DRY_RUN ? '=== Snapshot生成（dry-run） ===' : '=== Snapshot生成 ===');

  // 1. 公開Spotのidを取得
  const ids = (await kvCommand(['SMEMBERS', 'spots:status:published'])) || [];
  const spotIds = ids.filter(Boolean);
  console.log(`公開Spot: ${spotIds.length} 件`);

  if (spotIds.length === 0) {
    console.error('公開Spotが0件です。Migrationが完了しているか確認してください。');
    process.exit(1);
  }

  // 2. Spot本体を取得（パイプラインで100件ずつまとめる）
  const spots = [];
  const CHUNK = 100;
  for (let i = 0; i < spotIds.length; i += CHUNK) {
    const slice = spotIds.slice(i, i + CHUNK);
    const results = await kvPipeline(slice.map((id) => ['GET', `spot:${id}`]));
    for (const r of results) {
      const spot = parseValue(r);
      if (spot && spot.id) spots.push(spot);
    }
    process.stdout.write(`\r  取得: ${spots.length}/${spotIds.length}`);
  }
  console.log('');

  if (spots.length !== spotIds.length) {
    console.warn(
      `⚠ 索引には ${spotIds.length} 件あるが ${spots.length} 件しか取得できなかった（欠損の可能性）`
    );
  }

  // 3. 都道府県ごとに分ける
  const byPref = new Map();
  const index = {};
  let noPrefecture = 0;

  for (const spot of spots) {
    const pref = spot.prefecture || '_unknown';
    if (!spot.prefecture) noPrefecture += 1;
    if (!byPref.has(pref)) byPref.set(pref, []);
    byPref.get(pref).push(toSnapshotShape(spot));
    index[spot.id] = pref;
  }

  // 表示順を安定させる（差分が読みやすくなる）
  for (const list of byPref.values()) list.sort((a, b) => a.id.localeCompare(b.id));

  console.log(`都道府県: ${byPref.size} 種`);
  if (noPrefecture > 0) console.log(`  都道府県未設定: ${noPrefecture} 件（_unknown へ）`);

  // 4. R2へ書き出す
  const generatedAt = new Date().toISOString();
  let totalBytes = 0;

  for (const [pref, list] of [...byPref.entries()].sort()) {
    const key = `${SNAPSHOT_PREFIX}/pref/${encodeURIComponent(pref)}.json`;
    totalBytes += await putJson(key, { prefecture: pref, generatedAt, spots: list });
  }

  totalBytes += await putJson(`${SNAPSHOT_PREFIX}/index.json`, { generatedAt, index });

  const manifest = {
    generatedAt,
    spotCount: spots.length,
    prefectures: [...byPref.keys()].sort(),
    // フォールバック側がどのデータを見ているか判断できるようにする
    source: 'kv:spot:{id} (status=published)',
    schemaVersion: 1,
  };
  totalBytes += await putJson(`${SNAPSHOT_PREFIX}/manifest.json`, manifest);

  console.log('');
  console.log(`生成日時: ${generatedAt}`);
  console.log(`ファイル数: ${byPref.size + 2}`);
  console.log(`合計サイズ: ${(totalBytes / 1024).toFixed(1)}KB`);
  console.log(DRY_RUN ? '（dry-runのため書き込みは行っていません）' : '完了しました。');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
