// scripts/repair-lost-drafts.ts
//
// 一括処理中のslug競合バグにより、「承認済み（reviewedAt/resultSpotId
// 設定済み）」と記録されているのに、実際にはSpotが存在しない・
// 別のレコードのSpotに上書きされてしまった、という壊れた状態を
// 検出し、Reviewの記録を取り消して未Reviewのプールに戻す。
//
// 【判定方法】
// Staging側でreviewedAt/resultSpotIdが入っているレコードについて、
// 実際のSpot（resultSpotId）を引き、
//   1. Spotが存在しない → このレコードの分は失われている
//   2. Spotは存在するが、そのsourcesに このレコード自身のOSM要素
//      （osmType/osmId）が見当たらない → 別のレコードに上書きされた
// のどちらかに該当すれば「失われた」と判定し、resetStagingReview()で
// 未Reviewに戻す。
//
// 使い方:
//   npm run repair-lost-drafts -- --dry-run
//   npm run repair-lost-drafts -- --prefecture=Tochigi
//   npm run repair-lost-drafts -- --prefecture=Tochigi --dry-run

import {
  listReviewedStagingIds,
  getStagingRecords,
  resetStagingReview,
} from '../api/_osmStaging.js';
import { getSpot } from '../api/_spotStore.js';

function parseArgs() {
  const argv = process.argv.slice(2);
  const get = (name: string) => {
    const hit = argv.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.split('=').slice(1).join('=') : undefined;
  };
  return {
    prefecture: get('prefecture'),
    dryRun: argv.includes('--dry-run'),
  };
}

async function main() {
  const args = parseArgs();

  console.log('='.repeat(60));
  console.log('失われたdraftの検出・修復');
  if (args.prefecture) console.log(`都道府県: ${args.prefecture}`);
  if (args.dryRun) console.log('※ dry-run: 実際には修復しません（検出のみ）');
  console.log('='.repeat(60));

  const reviewedIds = await listReviewedStagingIds();
  console.log(`\nReview済み（プール内）件数: ${reviewedIds.length} 件`);

  let records = await getStagingRecords(reviewedIds);
  if (args.prefecture) {
    records = records.filter((r) => r.prefecture === args.prefecture);
    console.log(`都道府県で絞り込み後: ${records.length} 件`);
  }

  // resultSpotIdがあるものだけが対象（approveNewされたもの）
  const candidates = records.filter((r) => r.resultSpotId);
  console.log(`\n確認対象（resultSpotIdあり）: ${candidates.length} 件\n`);

  let lost = 0;
  let ok = 0;
  const lostNames: string[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const record = candidates[i];
    const spot = await getSpot(record.resultSpotId as string);

    const expectedOsmId = `${record.osmType}/${record.osmId}`;
    const hasMatchingSource = spot?.sources?.some(
      (s) => s.type === 'OSM' && s.id === expectedOsmId
    );

    if (!spot || !hasMatchingSource) {
      lost += 1;
      lostNames.push(`${record.name} (${record.id} → ${record.resultSpotId})`);
      if (!args.dryRun) {
        await resetStagingReview(record.id);
      }
    } else {
      ok += 1;
    }

    if ((i + 1) % 50 === 0 || i === candidates.length - 1) {
      process.stdout.write(`\r  確認済み: ${i + 1}/${candidates.length}（正常 ${ok} / 失われた ${lost}）`);
    }
  }

  console.log('\n');
  console.log('='.repeat(60));
  console.log('結果');
  console.log('='.repeat(60));
  console.log(`確認     : ${candidates.length}`);
  console.log(`正常     : ${ok}`);
  console.log(`失われた : ${lost}`);

  if (lostNames.length > 0) {
    console.log('\n失われたレコード（上位50件）:');
    for (const name of lostNames.slice(0, 50)) console.log(`  - ${name}`);
  }

  if (args.dryRun) {
    console.log('\ndry-run のため、実際の修復は行っていません。');
  } else if (lost > 0) {
    console.log(
      `\n${lost} 件を未Reviewの状態に戻しました。npm run bulk-approve で再度処理できます。`
    );
  }
}

main().catch((e) => {
  console.error('致命的エラー:', e);
  process.exit(1);
});
