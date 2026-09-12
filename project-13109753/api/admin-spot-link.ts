// /api/admin-spot-link.ts
// Vercel Serverless Function（Edge Runtime）
//
// 既存の Guide / Experience を Spot に紐づける（バックフィル）。
//
// 【背景】
// 投稿時にAIが spotId を自動判定する仕組みは実装されていたが、
// Gemini呼び出しで generationConfig の指定が漏れていた。
// thinking対応モデル（gemini-3.6-flash）では思考トークンだけで出力枠を
// 使い切り、本文が空文字で返るため、判定結果が常に「該当なし」になっていた。
// その結果、Guide 1件 / Experience 5件すべてが spotId 未設定のまま残った。
//
// 影響：
//   - Spotページの Guides / Reviews タブが常に空
//   - completeness の localKnowledge / actualData が永久に false
//   - Living Spot の循環（Creatorが知識を加える）の入口が機能しない
//
// このAPIは投稿時の判定を後から実行し、既存データに紐づけを付ける。
//
// GET  /api/admin-spot-link?action=diagnose  … 現状の診断（AIを呼ばない）
// POST /api/admin-spot-link?action=manual    … 手動で指定した対応で紐づける（AIを呼ばない）
// POST /api/admin-spot-link?action=dryRun    … AIが判定するが保存しない
// POST /api/admin-spot-link?action=apply     … AIが判定して保存する
//
// 【manual を用意した理由】
// 件数が少なく正解が目視で確定している場合、AIに判定させる合理性がない。
// 表記が異なると誤判定の余地があり（「Hasedera Temple」→ hase-dera）、
// 同じ地域の別の寺院に誤って紐づける危険もある。
// AI判定は「今後の新規投稿」のために必要だが、
// 既存データの後追い紐づけは手動指定のほうが確実で速く、費用もかからない。
//
// 【重要】確信が持てない場合は紐づけない。
// 誤った紐づけは、紐づかないより悪い（別のSpotのページに他人の体験談が出る）。

import { kv } from '@vercel/kv';
import { isAdminRequest, adminUnauthorized } from './_adminAuth.js';
import { listPublishedSpots } from './_spotStore.js';

// 【注意】maxDuration は Edge Runtime では効かない。
// 実際の実行時間上限は約25秒なので、重い処理は必ず分割する。
export const config = { runtime: 'edge' };

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

interface SpotRef {
  id: string;
  title: string;
  prefecture?: string;
}

interface ExperienceRecord {
  id: string;
  uid?: string;
  placeName?: string;
  area?: string;
  spotId?: string;
}

interface GuideSpotEntry {
  spotId?: string;
  name?: string;
  address?: string;
}

interface GuideRecord {
  id: string;
  uid?: string;
  title?: string;
  spots?: GuideSpotEntry[];
}

/** 候補Spotを絞る。全件をプロンプトに入れると精度と費用が悪化する */
function narrowCandidates(spots: SpotRef[], placeName: string, area: string): SpotRef[] {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[ー・\s]/g, '')
      .replace(/(shrine|temple|castle|park|garden|falls|museum)/g, '');

  const areaLower = (area || '').toLowerCase();

  // 都道府県が一致するものを優先
  const byPref = spots.filter(
    (s) => s.prefecture && areaLower.includes(s.prefecture.toLowerCase())
  );

  // 名称の一部が重なるもの
  const nName = norm(placeName);
  const byName = spots.filter((s) => {
    const nTitle = norm(s.title);
    if (!nName || !nTitle) return false;
    return nTitle.includes(nName) || nName.includes(nTitle);
  });

  const merged = new Map<string, SpotRef>();
  for (const s of [...byName, ...byPref]) merged.set(s.id, s);

  // 候補が少なすぎると取りこぼすため、40件未満なら全件から補う
  if (merged.size < 40) {
    for (const s of spots) {
      if (merged.size >= 60) break;
      merged.set(s.id, s);
    }
  }
  return [...merged.values()];
}

/** AIに1件だけ判定させる。確信が持てなければ null */
async function matchSpot(
  placeName: string,
  area: string,
  spots: SpotRef[],
  apiKey: string
): Promise<{ spotId: string | null; raw: string }> {
  const candidates = narrowCandidates(spots, placeName, area);
  const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

  const prompt = `旅行者が投稿した観光地の名前と地域が、以下のSPOT一覧のどれかと
同じ場所を指しているか判定してください。

【投稿された場所名】${placeName}
【投稿された地域】${area || '(未入力)'}

【既存SPOT一覧（JSON、id・title・prefecture）】
${JSON.stringify(candidates)}

同じ場所だと確信できるものが一覧にあれば、そのidだけを出力してください。
確信が持てない場合（表記が近いだけで実際には別の場所である可能性がある場合を含む）は、
"none" と出力してください。他の説明文は一切付けないでください。`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          // thinking を切らないと本文が空で返る（これが元の不具合の原因）
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 2048,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
        signal: AbortSignal.timeout(15_000),
      }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { spotId: null, raw: `error ${res.status}: ${body.slice(0, 120)}` };
    }

    const data = await res.json();
    const text: string =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text || '')
        .join('') ?? '';
    const answer = text.trim();

    if (!answer) return { spotId: null, raw: '(empty response)' };
    if (answer.toLowerCase() === 'none') return { spotId: null, raw: 'none' };

    // 実在するidかを必ず確認する（AIが存在しないidを返す場合がある）
    const found = candidates.find((s) => s.id === answer);
    return { spotId: found ? found.id : null, raw: answer };
  } catch (e) {
    return { spotId: null, raw: `exception: ${String(e).slice(0, 120)}` };
  }
}

async function loadExperiences(): Promise<ExperienceRecord[]> {
  const ids = ((await kv.smembers('experiences:all')) || []) as string[];
  const records = await Promise.all(
    ids.filter(Boolean).map((id) => kv.get<ExperienceRecord>(`experiences:${id}`).catch(() => null))
  );
  return records.filter((r): r is ExperienceRecord => Boolean(r));
}

async function loadGuides(): Promise<GuideRecord[]> {
  const ids = ((await kv.smembers('guides:all')) || []) as string[];
  const records = await Promise.all(
    ids.filter(Boolean).map((id) => kv.get<GuideRecord>(`guides:${id}`).catch(() => null))
  );
  return records.filter((r): r is GuideRecord => Boolean(r));
}

export default async function handler(req: Request): Promise<Response> {
  if (!(await isAdminRequest(req))) return adminUnauthorized();

  const url = new URL(req.url);
  const action = url.searchParams.get('action') || 'diagnose';

  const [experiences, guides] = await Promise.all([loadExperiences(), loadGuides()]);

  // ── 診断（AIを呼ばない） ──
  if (action === 'diagnose') {
    const expDetail = experiences.map((e) => ({
      id: e.id,
      placeName: e.placeName || '(none)',
      area: e.area || '(none)',
      spotId: e.spotId || null,
    }));
    const guideDetail = guides.map((g) => ({
      id: g.id,
      title: g.title || '(none)',
      spots: (g.spots || []).map((s) => ({
        name: s.name || '(none)',
        address: s.address || '(none)',
        spotId: s.spotId || null,
      })),
    }));

    // 索引の実状も確認する
    const spots = await listPublishedSpots();
    const indexCounts = await Promise.all(
      spots.slice(0, 400).map(async (s) => ({
        id: s.id,
        guides: Number(await kv.scard(`spot:${s.id}:guides`).catch(() => 0)),
        experiences: Number(await kv.scard(`spot:${s.id}:experiences`).catch(() => 0)),
      }))
    );

    return json({
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
      publishedSpots: spots.length,
      experiences: {
        total: experiences.length,
        linked: experiences.filter((e) => e.spotId).length,
        unlinked: experiences.filter((e) => !e.spotId).length,
        detail: expDetail,
      },
      guides: {
        total: guides.length,
        withLinkedSpot: guides.filter((g) => (g.spots || []).some((s) => s.spotId)).length,
        detail: guideDetail,
      },
      spotIndexes: {
        spotsWithGuides: indexCounts.filter((c) => c.guides > 0).length,
        spotsWithExperiences: indexCounts.filter((c) => c.experiences > 0).length,
      },
    });
  }

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // ── 手動指定による紐づけ（AIを呼ばない） ──
  if (action === 'manual') {
    let body: {
      experiences?: Record<string, string>;
      guides?: Record<string, Record<string, string>>;
      dryRun?: boolean;
    };
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    // 指定されたSpot IDが実在するかを必ず確認する。
    // 存在しないIDを保存すると、リレーション索引が孤児になる。
    const spots = await listPublishedSpots();
    const validIds = new Set(spots.map((s) => s.id));
    const isDryRun = body.dryRun === true;

    const applied: { kind: string; id: string; spotId: string; note: string }[] = [];
    const skipped: { kind: string; id: string; reason: string }[] = [];

    // Experience
    const expMap = body.experiences || {};
    const expById = new Map(experiences.map((e) => [e.id, e]));
    for (const [expId, spotId] of Object.entries(expMap)) {
      const exp = expById.get(expId);
      if (!exp) {
        skipped.push({ kind: 'experience', id: expId, reason: 'experience not found' });
        continue;
      }
      if (!validIds.has(spotId)) {
        skipped.push({
          kind: 'experience',
          id: expId,
          reason: `spot "${spotId}" does not exist or is not published`,
        });
        continue;
      }
      if (exp.spotId === spotId) {
        skipped.push({ kind: 'experience', id: expId, reason: 'already linked to this spot' });
        continue;
      }

      if (!isDryRun) {
        // 既に別のSpotへ紐づいていた場合は、古い索引から外す
        if (exp.spotId && exp.spotId !== spotId) {
          await kv.srem(`spot:${exp.spotId}:experiences`, exp.id).catch(() => null);
        }
        await kv.set(`experiences:${exp.id}`, { ...exp, spotId });
        await kv.sadd(`spot:${spotId}:experiences`, exp.id);
      }
      applied.push({
        kind: 'experience',
        id: expId,
        spotId,
        note: `${exp.placeName || '(no name)'} → ${spotId}`,
      });
    }

    // Guide（spots配列の中の該当エントリを name で特定して紐づける）
    const guideMap = body.guides || {};
    const guideById = new Map(guides.map((g) => [g.id, g]));
    for (const [guideId, nameToSpot] of Object.entries(guideMap)) {
      const guide = guideById.get(guideId);
      if (!guide) {
        skipped.push({ kind: 'guide', id: guideId, reason: 'guide not found' });
        continue;
      }

      const entries = guide.spots || [];
      const nextEntries: GuideSpotEntry[] = [];
      let changed = false;

      for (const entry of entries) {
        const target = entry.name ? nameToSpot[entry.name] : undefined;
        if (!target) {
          nextEntries.push(entry);
          continue;
        }
        if (!validIds.has(target)) {
          skipped.push({
            kind: 'guide',
            id: guideId,
            reason: `spot "${target}" does not exist or is not published`,
          });
          nextEntries.push(entry);
          continue;
        }

        if (!isDryRun) {
          if (entry.spotId && entry.spotId !== target) {
            await kv.srem(`spot:${entry.spotId}:guides`, guide.id).catch(() => null);
          }
          await kv.sadd(`spot:${target}:guides`, guide.id);
        }
        nextEntries.push({ ...entry, spotId: target });
        changed = true;
        applied.push({
          kind: 'guide',
          id: guideId,
          spotId: target,
          note: `${entry.name} → ${target}`,
        });
      }

      if (!isDryRun && changed) {
        await kv.set(`guides:${guide.id}`, { ...guide, spots: nextEntries });
      }
    }

    return json({
      mode: isDryRun ? 'manual (dry run)' : 'manual (applied)',
      applied: applied.length,
      skipped: skipped.length,
      appliedDetail: applied,
      skippedDetail: skipped,
      hint: isDryRun
        ? 'Remove "dryRun": true to save.'
        : 'Now run reindex so completeness picks up localKnowledge / actualData.',
    });
  }

  if (action !== 'dryRun' && action !== 'apply') {
    return json({ error: 'Unknown action. Use diagnose / manual / dryRun / apply.' }, 400);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return json({ error: 'GEMINI_API_KEY not configured' }, 503);

  const spots = await listPublishedSpots();
  if (spots.length === 0) {
    return json({ error: 'No published spots found. Run the migration first.' }, 400);
  }
  const spotRefs: SpotRef[] = spots.map((s) => ({
    id: s.id,
    title: s.title,
    prefecture: s.prefecture,
  }));

  const apply = action === 'apply';
  const results: {
    kind: 'experience' | 'guide';
    id: string;
    input: string;
    matchedSpotId: string | null;
    raw: string;
    applied: boolean;
  }[] = [];

  // ── Experience ──
  // レート制限に配慮して順番に処理する（件数が少ないため実用上問題ない）
  for (const e of experiences) {
    if (e.spotId) continue;
    if (!e.placeName) continue;

    const { spotId, raw } = await matchSpot(e.placeName, e.area || '', spotRefs, apiKey);
    let applied = false;

    if (apply && spotId) {
      await kv.set(`experiences:${e.id}`, { ...e, spotId });
      await kv.sadd(`spot:${spotId}:experiences`, e.id);
      applied = true;
    }
    results.push({
      kind: 'experience',
      id: e.id,
      input: `${e.placeName} / ${e.area || '-'}`,
      matchedSpotId: spotId,
      raw,
      applied,
    });
  }

  // ── Guide ──
  for (const g of guides) {
    const entries = g.spots || [];
    if (entries.length === 0) continue;

    let changed = false;
    const nextEntries: GuideSpotEntry[] = [];

    for (const entry of entries) {
      if (entry.spotId || !entry.name) {
        nextEntries.push(entry);
        continue;
      }
      const { spotId, raw } = await matchSpot(entry.name, entry.address || '', spotRefs, apiKey);
      let applied = false;

      if (apply && spotId) {
        nextEntries.push({ ...entry, spotId });
        await kv.sadd(`spot:${spotId}:guides`, g.id);
        changed = true;
        applied = true;
      } else {
        nextEntries.push(entry);
      }

      results.push({
        kind: 'guide',
        id: g.id,
        input: `${entry.name} / ${entry.address || '-'}`,
        matchedSpotId: spotId,
        raw,
        applied,
      });
    }

    if (apply && changed) {
      await kv.set(`guides:${g.id}`, { ...g, spots: nextEntries });
    }
  }

  const matchedCount = results.filter((r) => r.matchedSpotId).length;

  return json({
    mode: apply ? 'apply' : 'dryRun',
    processed: results.length,
    matched: matchedCount,
    unmatched: results.length - matchedCount,
    appliedCount: results.filter((r) => r.applied).length,
    results,
    hint: apply
      ? 'Run action=diagnose to confirm, then reindex spots so completeness picks up the new links.'
      : 'Review the results, then run with action=apply to save.',
  });
}
