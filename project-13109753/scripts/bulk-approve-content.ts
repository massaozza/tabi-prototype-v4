// scripts/bulk-approve-content.ts
//
// NEW（OSM由来の新規Spot候補）を、指定した優先度でまとめてdraft化する。
//
// 【なぜGitHub Actionsで実行するか】
// 1件ごとにWikidata/Wikipedia/Geminiを呼ぶため、数千〜数万件を処理すると
// 実行時間はEdge Function/Serverless Functionの上限（約25秒）を大きく
// 超える。GitHub Actionsなら最大6時間まで使えるため、ここで処理する。
// Review画面の「Bulk approve」ボタン（1回の呼び出しは15件程度）を
// 手動で連打し続ける代わりに、まとめて流せるようにするためのもの。
//
// 【Stagingの状態は変えない設計】
// 承認したレコードは Staging 側で reviewedAt が入り、以後
// listUnreviewedStagingIds() の対象から自動的に外れる。
// そのため、このスクリプトを複数回・複数都道府県にまたがって実行しても
// 二重に処理されることはない。
//
// 使い方:
//   npm run bulk-approve -- --priority=high
//   npm run bulk-approve -- --priority=high --limit=500
//   npm run bulk-approve -- --priority=high --prefecture=Tochigi
//   npm run bulk-approve -- --priority=high --publish
//   npm run bulk-approve -- --priority=high --dry-run

import { listUnreviewedStagingIds, getStagingRecords, type StagingRecord } from '../api/_osmStaging.js';
import { createDraftSpotFromStaging } from '../api/_draftSpot.js';
import { rebuildDerivedCache } from '../api/_spotStore.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Args {
  priority: 'high' | 'medium' | 'low';
  prefecture?: string;
  limit: number;
  publish: boolean;
  dryRun: boolean;
  concurrency: number;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (name: string) => {
    const hit = argv.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.split('=').slice(1).join('=') : undefined;
  };

  const priority = (get('priority') || 'high') as Args['priority'];
  if (!['high', 'medium', 'low'].includes(priority)) {
    console.error(`不明な優先度: "${priority}"（high, medium, low のいずれかを指定）`);
    process.exit(1);
  }

  return {
    priority,
    prefecture: get('prefecture'),
    limit: Number(get('limit') || '0') || Infinity, // 0や未指定なら無制限（＝残り全件）
    publish: argv.includes('--publish'),
    dryRun: argv.includes('--dry-run'),
    concurrency: Math.max(1, Number(get('concurrency') || '8')),
  };
}

async function main() {
  const args = parseArgs();

  console.log('='.repeat(60));
  console.log(`一括コンテンツ生成: priority=${args.priority}`);
  if (args.prefecture) console.log(`都道府県: ${args.prefecture}`);
  console.log(`上限: ${args.limit === Infinity ? '無制限（残り全件）' : args.limit}`);
  console.log(`公開: ${args.publish ? 'する（published)' : 'しない（draftのまま）'}`);
  if (args.dryRun) console.log('※ dry-run: 実際には何も作成しません（対象件数の確認のみ）');
  console.log('='.repeat(60));

  const unreviewedIds = await listUnreviewedStagingIds('NEW', args.priority);
  console.log(`\n未Review件数（priority=${args.priority}、全都道府県）: ${unreviewedIds.length} 件`);

  if (unreviewedIds.length === 0) {
    console.log('対象がありません。終了します。');
    return;
  }

  if (args.dryRun) {
    if (args.prefecture) {
      // 都道府県指定時は、その都道府県だけに絞った実際の対象件数を出す。
      // サンプリングではなく全件を都道府県で絞り込む（実行時と同じ絞り込み）。
      const all = await getStagingRecords(unreviewedIds);
      const matched = all.filter((r) => r.prefecture === args.prefecture);
      console.log(`\n${args.prefecture} の未Review件数: ${matched.length} 件`);
      const willProcess = Math.min(matched.length, args.limit);
      console.log(`今回の上限（--limit=${args.limit === Infinity ? '無制限' : args.limit}）で処理される件数: ${willProcess} 件`);
    } else {
      // 都道府県未指定時は、全国の内訳をサンプルから出す
      const sample = await getStagingRecords(unreviewedIds.slice(0, Math.min(unreviewedIds.length, 5000)));
      const byPref = new Map<string, number>();
      for (const r of sample) {
        byPref.set(r.prefecture, (byPref.get(r.prefecture) || 0) + 1);
      }
      console.log('\n都道府県別の内訳（先頭5000件のサンプルから集計）:');
      for (const [pref, count] of [...byPref.entries()].sort((a, b) => b[1] - a[1])) {
        console.log(`  ${pref}: ${count} 件`);
      }
      const willProcess = Math.min(unreviewedIds.length, args.limit);
      console.log(`\n今回の上限（--limit=${args.limit === Infinity ? '無制限' : args.limit}）で処理される件数: ${willProcess} 件`);
    }
    console.log('\ndry-run のため作成は行っていません。');
    return;
  }

  let processed = 0;
  let created = 0;
  let failed = 0;
  const failedSamples: string[] = [];
  const startedAt = Date.now();

  // 未Review一覧は最初に一度だけ取得し、あとはこの配列を順番に消費する。
  // （処理するたびにSDIFFを取り直すと、承認済みの分がAPI呼び出し1回ごとに
  // 減っていくのを確認しながら進められるが、都度Redisに問い合わせるより
  // 単純にこの実行の最初に取得した一覧を順に処理する方が速い。
  // 他のプロセスと同時に走らせない前提であれば、これで十分整合する）
  let queue = unreviewedIds;
  if (args.prefecture) {
    const filtered = await getStagingRecords(queue);
    queue = filtered.filter((r) => r.prefecture === args.prefecture).map((r) => r.id);
    console.log(`都道府県で絞り込み後: ${queue.length} 件`);
  }

  const targetCount = Math.min(queue.length, args.limit);
  console.log(`\n処理予定: ${targetCount} 件（並列度: ${args.concurrency}）\n`);

  // この実行全体で共有する。並列処理中のslug競合（同じ候補が同時に
  // "空いている" と判定されて片方がもう片方を上書きする）を防ぐため。
  const reservedSlugs = new Set<string>();

  const CHUNK = args.concurrency;
  for (let i = 0; i < targetCount; i += CHUNK) {
    const idsSlice = queue.slice(i, Math.min(i + CHUNK, targetCount));
    const records = await getStagingRecords(idsSlice);
    // Staging取得後にreviewedAtが入っている（既に処理済み）ものは念のため除く
    const toProcess = records.filter((r) => !r.reviewedAt && !r.resultSpotId);

    const results = await Promise.allSettled(
      toProcess.map((record: StagingRecord) =>
        createDraftSpotFromStaging(record, {
          publish: args.publish,
          reviewNote: `Bulk approved via GitHub Actions (priority=${args.priority})`,
          // 大量処理のため、1件ごとの派生キャッシュ再構築は行わない。
          // publish時は最後に1回だけ再構築する。
          rebuildCache: false,
          reservedSlugs,
        }).then(
          (slug) => ({ ok: true as const, name: record.name, slug }),
          (err) => Promise.reject({ name: record.name, err })
        )
      )
    );

    for (const r of results) {
      processed += 1;
      if (r.status === 'fulfilled') {
        created += 1;
      } else {
        failed += 1;
        const info = r.reason as { name?: string; err?: unknown };
        if (failedSamples.length < 20) {
          failedSamples.push(`${info?.name || '?'}: ${String(info?.err).slice(0, 160)}`);
        }
      }
    }

    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0);
    process.stdout.write(
      `\r  処理済み: ${processed}/${targetCount}（成功 ${created} / 失敗 ${failed}） 経過 ${elapsed}秒`
    );

    // Wikidata/Wikipedia/Geminiへの負荷を抑えるため、チャンク間に短い間隔を空ける
    await sleep(300);
  }

  console.log('\n');
  console.log('='.repeat(60));
  console.log('結果');
  console.log('='.repeat(60));
  console.log(`処理     : ${processed}`);
  console.log(`作成成功 : ${created}`);
  console.log(`失敗     : ${failed}`);
  if (failedSamples.length > 0) {
    console.log('\n失敗サンプル（最大20件）:');
    for (const s of failedSamples) console.log(`  - ${s}`);
  }

  if (args.publish && created > 0) {
    console.log('\n公開一覧（content:destinations）を再構築中...');
    const res = await rebuildDerivedCache();
    console.log(
      res.skipped
        ? `  公開Spotが上限を超えているため再構築をスキップしました（${res.count}件）`
        : `  再構築完了（${res.count}件）`
    );
  }

  const remaining = queue.length - targetCount;
  if (remaining > 0) {
    console.log(`\nこのpriorityにはまだ ${remaining} 件残っています。再度実行すると続きから処理します。`);
  } else {
    console.log(`\npriority=${args.priority} は全件処理済みです。`);
  }
}

main().catch((e) => {
  console.error('致命的エラー:', e);
  process.exit(1);
});
