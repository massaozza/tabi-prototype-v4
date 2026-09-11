// scripts/backfill-category.ts
//
// OSM一括インポートで作ったSpotは、意図的に category（表示用カテゴリ、
// 既存367件が使っている「Culture & History」等の文言）を空のままにし、
// canonicalCategory（shrine_temple, museum 等、機械的な分類）だけを
// 持たせていた。理由は、推測で誤分類するより空のままにして人が確認する
// 方が安全、という判断だったため。
//
// ただし1万件超を1件ずつ人力で分類するのは非現実的なので、
// canonicalCategory → 表示カテゴリ のマッピングで機械的に埋める。
// このマッピングは「大きく外れることのない、粗い分類」を目指している
// （神社仏閣・城・史跡・博物館・美術館はまとめて「Culture & History」、
// 公園・庭園・展望台は「Nature & Scenery」など）。個別の微調整が必要な
// ものは、後から管理画面で人が直せばよい。
//
// 使い方:
//   npm run backfill-category -- --dry-run
//   npm run backfill-category -- --prefecture=Tochigi
//   npm run backfill-category

import { kv } from '@vercel/kv';
import { SPOTS_INDEX, prefIndexKey, spotKey, patchSpot, rebuildDerivedCache, type Spot } from '../api/_spotStore.js';

/**
 * canonicalCategory → 表示カテゴリ（既存367件と同じ語彙）
 * 語彙は src/pages/home/components/DestinationsSection.tsx の
 * CATEGORY_PLACEHOLDER と揃えている。
 */
const CANONICAL_TO_LEGACY: Record<string, string> = {
  shrine_temple: 'Culture & History',
  castle: 'Culture & History',
  historic: 'Culture & History',
  museum: 'Culture & History',
  art: 'Culture & History',
  attraction: 'Culture & History',
  park: 'Nature & Scenery',
  garden: 'Nature & Scenery',
  viewpoint: 'Nature & Scenery',
  outdoor: 'Nature & Scenery',
  onsen: 'Hot Springs & Nature',
  ski: 'Skiing & Winter Sports',
  theme_park: 'Theme Parks & Entertainment',
  zoo: 'Theme Parks & Entertainment',
  aquarium: 'Theme Parks & Entertainment',
  shopping: 'Shopping & Fashion',
  market: 'Shopping & Fashion',
  cafe: 'City & Food Culture',
  restaurant: 'City & Food Culture',
};

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
  console.log('カテゴリの一括分類（canonicalCategory → 表示カテゴリ）');
  if (args.prefecture) console.log(`都道府県: ${args.prefecture}`);
  if (args.dryRun) console.log('※ dry-run: 実際には更新しません（対象件数の確認のみ）');
  console.log('='.repeat(60));

  const ids = args.prefecture
    ? (((await kv.smembers(prefIndexKey(args.prefecture))) || []) as string[]).filter(Boolean)
    : (((await kv.smembers(SPOTS_INDEX)) || []) as string[]).filter(Boolean);

  console.log(`\n対象Spot件数: ${ids.length} 件\n`);

  let processed = 0;
  let updated = 0;
  let skippedHasCategory = 0;
  let skippedNoMapping = 0;
  const unmappedKeys = new Map<string, number>();

  const CHUNK = 200;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    const spots = (await Promise.all(slice.map((id) => kv.get<Spot>(spotKey(id))))).filter(
      (s): s is Spot => Boolean(s)
    );

    // 【重要】以前はここで1件ずつ await patchSpot(...) していたため、
    // KVの往復（読み取り＋複数の索引更新）が完全に直列化され、
    // 13,177件で60分のワークフロー上限に達してキャンセルされる不具合が
    // あった。チャンク内は並列に処理する。
    await Promise.all(
      spots.map(async (spot) => {
        processed += 1;

        if (spot.category && spot.category.trim().length > 0) {
          skippedHasCategory += 1;
          return;
        }
        const canonical = spot.canonicalCategory;
        const legacy = canonical ? CANONICAL_TO_LEGACY[canonical] : undefined;
        if (!legacy) {
          skippedNoMapping += 1;
          if (canonical) unmappedKeys.set(canonical, (unmappedKeys.get(canonical) || 0) + 1);
          return;
        }

        if (!args.dryRun) {
          await patchSpot(
            spot.id,
            {
              category: legacy,
              fieldSources: { ...(spot.fieldSources || {}), category: 'AI_DERIVED' },
            },
            false
          );
        }
        updated += 1;
      })
    );

    process.stdout.write(`\r  処理済み: ${processed}/${ids.length}（分類 ${updated}）`);
  }

  console.log('\n');
  console.log('='.repeat(60));
  console.log('結果');
  console.log('='.repeat(60));
  console.log(`処理           : ${processed}`);
  console.log(`分類${args.dryRun ? '予定' : '完了'}       : ${updated}`);
  console.log(`既にcategoryあり: ${skippedHasCategory}`);
  console.log(`対応表に無い   : ${skippedNoMapping}`);

  if (unmappedKeys.size > 0) {
    console.log('\n対応表に無かったcanonicalCategory:');
    for (const [key, count] of [...unmappedKeys.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${key}: ${count} 件`);
    }
    console.log('（このキーをCANONICAL_TO_LEGACYに追加すれば次回分類できます）');
  }

  if (args.dryRun) {
    console.log('\ndry-run のため、実際の更新は行っていません。');
  } else if (updated > 0) {
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
