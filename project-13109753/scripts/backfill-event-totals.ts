// scripts/backfill-event-totals.ts
//
// 【背景】
// api/track-view.ts は、イベント発生の都度、個別カウンタ
// （views:spot:{id} / events:{event}:spot:{id}）に加えて、
// 種別ごとの合計（totals:{event}:spot）とランキング用Sorted Set
// （rank:{event}:spot）も更新するようにした（2026-09-18）。
//
// しかしこれは「今後発生するイベント」しか集計しない。
// 全国展開で1万件を超えたSpotの、これまでに記録済みの閲覧数・コピー数等は
// まだ totals: / rank: に反映されていない。このスクリプトは、既存の
// 個別カウンタを一度だけ全件読み、totals: と rank: に反映する。
//
// 【重い処理を一度だけ、リクエスト時ではなくバッチで行う理由】
// admin-dashboard.ts が毎回リクエストのたびに1万件超をスキャンすると
// Edge Runtimeのタイムアウトを招く。そのため通常運用時はtotals:/rank:
// だけを読む設計にしたが、その初期値を作るこの集計自体は依然重い処理。
// GitHub Actions（backfill-category等と同じ形）で一度だけ流す。
//
// 使い方:
//   npm run backfill-event-totals -- --dry-run
//   npm run backfill-event-totals

import { kv } from '@vercel/kv';
import { SPOTS_INDEX } from '../api/_spotStore.js';

const EVENTS = ['view', 'save', 'copy', 'booking_hotel', 'booking_experience'] as const;
type FunnelEvent = (typeof EVENTS)[number];

function eventKey(event: FunnelEvent, id: string): string {
  return event === 'view' ? `views:spot:${id}` : `events:${event}:spot:${id}`;
}

function totalsKey(event: FunnelEvent): string {
  return `totals:${event}:spot`;
}

function rankKey(event: FunnelEvent): string {
  return `rank:${event}:spot`;
}

function toNumber(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function parseArgs() {
  const argv = process.argv.slice(2);
  return { dryRun: argv.includes('--dry-run') };
}

async function main() {
  const args = parseArgs();

  console.log('='.repeat(60));
  console.log('Spotイベントカウンタの一括集約（totals: / rank: の初期値作成）');
  if (args.dryRun) console.log('※ dry-run: 実際には書き込みません（集計結果の確認のみ）');
  console.log('='.repeat(60));

  const ids = (((await kv.smembers(SPOTS_INDEX)) || []) as string[]).filter(Boolean);
  console.log(`\n対象Spot件数: ${ids.length} 件\n`);

  const sums: Record<FunnelEvent, number> = {
    view: 0,
    save: 0,
    copy: 0,
    booking_hotel: 0,
    booking_experience: 0,
  };
  // イベントごとに「0件より多いSpotのid → 件数」を持つ（0件はrankに入れる意味が無い）
  const nonZero: Record<FunnelEvent, Map<string, number>> = {
    view: new Map(),
    save: new Map(),
    copy: new Map(),
    booking_hotel: new Map(),
    booking_experience: new Map(),
  };

  const CHUNK = 200;
  let processed = 0;

  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);

    await Promise.all(
      EVENTS.map(async (ev) => {
        const keys = slice.map((id) => eventKey(ev, id));
        let values: unknown[] = [];
        try {
          const got = await kv.mget<unknown[]>(keys[0], ...keys.slice(1));
          values = Array.isArray(got) ? got : keys.map(() => null);
        } catch {
          values = keys.map(() => null);
        }
        values.forEach((v, idx) => {
          const n = toNumber(v);
          if (n > 0) {
            sums[ev] += n;
            nonZero[ev].set(slice[idx], n);
          }
        });
      })
    );

    processed += slice.length;
    process.stdout.write(`\r  読み取り済み: ${processed}/${ids.length}`);
  }

  console.log('\n');
  console.log('='.repeat(60));
  console.log('集計結果（合計）');
  console.log('='.repeat(60));
  for (const ev of EVENTS) {
    console.log(`  ${ev.padEnd(20)}: ${sums[ev]}（0件より多いSpot: ${nonZero[ev].size}件）`);
  }

  if (args.dryRun) {
    console.log('\ndry-run のため、実際の書き込みは行っていません。');
    return;
  }

  console.log('\ntotals: を書き込み中...');
  await Promise.all(EVENTS.map((ev) => kv.set(totalsKey(ev), sums[ev])));

  console.log('rank: (Sorted Set) を書き込み中...');
  for (const ev of EVENTS) {
    const entries = [...nonZero[ev].entries()];
    if (entries.length === 0) continue;

    const ZADD_CHUNK = 300;
    for (let i = 0; i < entries.length; i += ZADD_CHUNK) {
      const slice = entries.slice(i, i + ZADD_CHUNK);
      const [first, ...rest] = slice.map(([id, score]) => ({ score, member: id }));
      await kv.zadd(rankKey(ev), first, ...rest);
    }
    console.log(`  ${ev}: ${entries.length}件をrank:${ev}:spotに反映`);
  }

  console.log('\n完了しました。');
}

main().catch((e) => {
  console.error('致命的エラー:', e);
  process.exit(1);
});
