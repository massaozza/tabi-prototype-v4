// scripts/backfill-image-index.ts
//
// 都道府県×画像有無の索引（prefImageIndexKey）は、この索引を追加した
// 時点より後に保存されたSpotにしか作られない。既存のSpot（今回の
// 一括インポート分・既存367件を含む）はこの索引に一切登録されていない
// ため、一覧の並び替え（画像ありを先に）が効かない。
// 既存の全Spotを読み直し、この索引に登録し直す一回限りのスクリプト。
//
// 使い方:
//   npm run backfill-image-index

import { kv } from '@vercel/kv';
import { SPOTS_INDEX, spotKey, prefImageIndexKey, type Spot } from '../api/_spotStore.js';

async function main() {
  console.log('='.repeat(60));
  console.log('画像索引の一括登録');
  console.log('='.repeat(60));

  const ids = ((await kv.smembers(SPOTS_INDEX)) || []) as string[];
  console.log(`\n対象Spot件数: ${ids.length} 件\n`);

  let processed = 0;
  let indexed = 0;
  const CHUNK = 200;

  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.filter(Boolean).slice(i, i + CHUNK);
    const spots = (await Promise.all(slice.map((id) => kv.get<Spot>(spotKey(id))))).filter(
      (s): s is Spot => Boolean(s)
    );

    const ops: Promise<unknown>[] = [];
    for (const spot of spots) {
      if (!spot.prefecture) continue;
      ops.push(kv.sadd(prefImageIndexKey(spot.prefecture, Boolean(spot.image)), spot.id));
      indexed += 1;
    }
    await Promise.all(ops.map((p) => p.catch(() => null)));

    processed += slice.length;
    process.stdout.write(`\r  処理済み: ${processed}/${ids.length}`);
  }

  console.log('\n');
  console.log('='.repeat(60));
  console.log('結果');
  console.log('='.repeat(60));
  console.log(`確認     : ${processed}`);
  console.log(`索引登録 : ${indexed}`);
}

main().catch((e) => {
  console.error('致命的エラー:', e);
  process.exit(1);
});
