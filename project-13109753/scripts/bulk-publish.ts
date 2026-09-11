// scripts/bulk-publish.ts
//
// draft状態のSpotを、管理画面を経由せずまとめて公開する。
//
// 【なぜ必要か】
// 管理画面（/admin/spots）は、件数が多いと1ステータスあたり最大500件
// までしか一覧に出さない仕様にした（タイムアウト対策）。チェックボックス
// での選択・Publish selected は、1万件規模になると現実的な操作数では
// 済まない。GitHub Actionsから直接KVを操作して公開する。
//
// 【公開前の確認について】
// このスクリプトは中身（説明文・画像）を見ずに機械的に公開する。
// 個別に内容を確認したい場合は、事前に /admin/spots で一部を
// サンプルチェックしてから実行することを推奨する。
//
// 使い方:
//   npm run bulk-publish -- --dry-run
//   npm run bulk-publish -- --prefecture=Tochigi --dry-run
//   npm run bulk-publish -- --prefecture=Tochigi
//   npm run bulk-publish -- --limit=5000

import { kv } from '@vercel/kv';
import { statusIndexKey, prefIndexKey, patchSpot, rebuildDerivedCache } from '../api/_spotStore.js';

function parseArgs() {
  const argv = process.argv.slice(2);
  const get = (name: string) => {
    const hit = argv.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.split('=').slice(1).join('=') : undefined;
  };
  return {
    prefecture: get('prefecture'),
    limit: Number(get('limit') || '0') || Infinity,
    concurrency: Math.max(1, Number(get('concurrency') || '15')),
    dryRun: argv.includes('--dry-run'),
  };
}

async function main() {
  const args = parseArgs();

  console.log('='.repeat(60));
  console.log('draft の一括公開');
  if (args.prefecture) console.log(`都道府県: ${args.prefecture}`);
  console.log(`上限: ${args.limit === Infinity ? '無制限（該当分すべて）' : args.limit}`);
  if (args.dryRun) console.log('※ dry-run: 実際には公開しません（対象件数の確認のみ）');
  console.log('='.repeat(60));

  let ids: string[];
  if (args.prefecture) {
    const inter = await kv.sinter(statusIndexKey('draft'), prefIndexKey(args.prefecture));
    ids = ((inter || []) as string[]).filter(Boolean);
  } else {
    const all = (await kv.smembers(statusIndexKey('draft'))) || [];
    ids = (all as string[]).filter(Boolean);
  }

  console.log(`\n対象件数（draft）: ${ids.length} 件`);

  if (ids.length === 0) {
    console.log('対象がありません。終了します。');
    return;
  }

  const targetCount = Math.min(ids.length, args.limit);
  const queue = ids.slice(0, targetCount);

  if (args.dryRun) {
    console.log(`\n今回の上限で公開される件数: ${targetCount} 件`);
    console.log('\ndry-run のため公開は行っていません。');
    return;
  }

  console.log(`\n公開予定: ${targetCount} 件（並列度: ${args.concurrency}）\n`);

  let processed = 0;
  let published = 0;
  let failed = 0;
  const failedSamples: string[] = [];
  const startedAt = Date.now();

  const CHUNK = args.concurrency;
  for (let i = 0; i < queue.length; i += CHUNK) {
    const slice = queue.slice(i, i + CHUNK);
    const results = await Promise.allSettled(
      slice.map((id) => patchSpot(id, { status: 'published' }, false))
    );

    for (let j = 0; j < results.length; j++) {
      processed += 1;
      const r = results[j];
      if (r.status === 'fulfilled' && r.value) {
        published += 1;
      } else {
        failed += 1;
        if (failedSamples.length < 20) failedSamples.push(slice[j]);
      }
    }

    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0);
    process.stdout.write(
      `\r  処理済み: ${processed}/${queue.length}（公開 ${published} / 失敗 ${failed}） 経過 ${elapsed}秒`
    );
  }

  console.log('\n');
  console.log('='.repeat(60));
  console.log('結果');
  console.log('='.repeat(60));
  console.log(`処理     : ${processed}`);
  console.log(`公開成功 : ${published}`);
  console.log(`失敗     : ${failed}`);
  if (failedSamples.length > 0) {
    console.log('\n失敗サンプル（最大20件）:');
    for (const id of failedSamples) console.log(`  - ${id}`);
  }

  if (published > 0) {
    console.log('\n公開一覧（content:destinations）を再構築中...');
    const res = await rebuildDerivedCache();
    console.log(
      res.skipped
        ? `  公開Spotが上限（1500件）を超えているため再構築をスキップしました（${res.count}件）。`
        : `  再構築完了（${res.count}件）`
    );
  }
}

main().catch((e) => {
  console.error('致命的エラー:', e);
  process.exit(1);
});
