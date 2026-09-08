// src/pages/admin/osm/page.tsx
//
// OSM Import Dashboard と Review Queue。
//
// 【Importをブラックボックスにしない（指示書30）】
// 何件取得し、何件がMATCHED / POSSIBLE_MATCH / NEW / REJECTED になったかを
// 画面で確認できるようにする。除外理由も内訳を出す。
//
// 【Review Queue（指示書13）】
// POSSIBLE_MATCH は自動でMergeせず、必ず人間が判断する。
// 誤ったMergeは既存のGuide・Review・Tripを壊すため、
// 「新規Spotが重複する」よりも深刻な影響が出る。

import { useEffect, useMemo, useState } from 'react';

type MatchStatus = 'MATCHED' | 'POSSIBLE_MATCH' | 'NEW' | 'REJECTED';

interface Candidate {
  spotId: string;
  title: string;
  distance: number;
  nameSimilarity: number;
  confidence: number;
  reason: string;
  spot?: {
    id: string;
    title: string;
    category: string;
    prefecture: string;
    description?: string;
  } | null;
}

interface StagingItem {
  id: string;
  name: string;
  aliases: string[];
  prefecture: string;
  city?: string;
  category?: string;
  group?: string;
  lat: number;
  lng: number;
  matchStatus: MatchStatus;
  matchedSpotId: string | null;
  confidence: number;
  matchReason: string;
  candidates: Candidate[];
  reviewedAt?: string;
  reviewAction?: string;
  resultSpotId?: string;
  officialUrl?: string;
}

interface ImportRun {
  runId: string;
  prefecture: string;
  startedAt: string;
  finishedAt?: string;
  fetched: number;
  staged: number;
  counts: Record<string, number>;
  rejected: number;
  rejectReasons: Record<string, number>;
  errors: string[];
  status: string;
}

const STATUS_STYLE: Record<MatchStatus, string> = {
  MATCHED: 'bg-green-50 text-green-700 border-green-200',
  POSSIBLE_MATCH: 'bg-amber-50 text-amber-700 border-amber-200',
  NEW: 'bg-blue-50 text-blue-700 border-blue-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
};

function num(n: number | undefined): string {
  return (n ?? 0).toLocaleString('en-US');
}

export default function AdminOsmPage() {
  const [runs, setRuns] = useState<ImportRun[]>([]);
  const [summary, setSummary] = useState<{
    total: number;
    byStatus: Record<string, number>;
    reviewed: number;
    pendingReview: number;
  } | null>(null);
  const [prefectures, setPrefectures] = useState<string[]>([]);

  const [items, setItems] = useState<StagingItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<MatchStatus>('POSSIBLE_MATCH');
  const [onlyPending, setOnlyPending] = useState(true);
  const [search, setSearch] = useState('');

  const [importPref, setImportPref] = useState('Tochigi');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<unknown>(null);
  // カテゴリごとに分けて実行するため、進行状況を表示する
  const [importGroups, setImportGroups] = useState<{ key: string; label: string }[]>([]);
  const [importProgress, setImportProgress] = useState<string[]>([]);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDashboard = () => {
    fetch('/api/admin-osm-import')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setRuns(Array.isArray(d.runs) ? d.runs : []);
        setSummary(d.staging ?? null);
        setPrefectures(Array.isArray(d.availablePrefectures) ? d.availablePrefectures : []);
        setImportGroups(Array.isArray(d.importGroups) ? d.importGroups : []);
      })
      .catch(() => {});
  };

  const loadQueue = () => {
    setLoading(true);
    const params = new URLSearchParams({ status: statusFilter });
    if (onlyPending) params.set('pending', '1');
    fetch(`/api/admin-osm-review?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setItems(Array.isArray(d?.records) ? d.records : []);
        if (d?.summary) setSummary(d.summary);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(loadDashboard, []);
  useEffect(loadQueue, [statusFilter, onlyPending]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.aliases.some((a) => a.toLowerCase().includes(q)) ||
        i.id.toLowerCase().includes(q)
    );
  }, [items, search]);

  /**
   * 全カテゴリを順番に実行する。
   *
   * 1回のリクエストで全カテゴリを取るとOverpassの処理が長引き、
   * Edge Functionの実行時間上限（約25秒）を超えて504になる（実測）。
   * そのためカテゴリ単位に分け、前の結果が返ってから次を投げる。
   * Overpassへの同時アクセスを避ける意味でも順次実行が適切。
   */
  const runImport = async (dryRun: boolean) => {
    setImporting(true);
    setImportResult(null);
    setImportProgress([]);
    setNotice(null);

    const groups = importGroups.length > 0 ? importGroups : [{ key: 'worship', label: 'Shrines & temples' }];
    const results: unknown[] = [];
    const totals = { fetched: 0, staged: 0, rejected: 0, MATCHED: 0, POSSIBLE_MATCH: 0, NEW: 0 };

    try {
      for (const g of groups) {
        setImportProgress((prev) => [...prev, `${g.label}: running…`]);

        const params = new URLSearchParams({ prefecture: importPref, group: g.key });
        if (dryRun) params.set('dryRun', '1');

        const res = await fetch(`/api/admin-osm-import?${params.toString()}`, { method: 'POST' });
        const text = await res.text();

        let data: {
          run?: { fetched?: number; staged?: number; rejected?: number; counts?: Record<string, number> };
          error?: string;
        } | null = null;
        try {
          data = JSON.parse(text);
        } catch {
          // タイムアウト時などJSON以外が返ることがある
          throw new Error(`${g.label}: ${res.status} ${text.slice(0, 120)}`);
        }
        if (!res.ok) throw new Error(data?.error || `${g.label}: failed (${res.status})`);

        const r = data?.run;
        totals.fetched += r?.fetched ?? 0;
        totals.staged += r?.staged ?? 0;
        totals.rejected += r?.rejected ?? 0;
        totals.MATCHED += r?.counts?.MATCHED ?? 0;
        totals.POSSIBLE_MATCH += r?.counts?.POSSIBLE_MATCH ?? 0;
        totals.NEW += r?.counts?.NEW ?? 0;

        results.push(data);
        setImportProgress((prev) => [
          ...prev.slice(0, -1),
          `${g.label}: fetched ${r?.fetched ?? 0}, staged ${r?.staged ?? 0}, rejected ${r?.rejected ?? 0}`,
        ]);
      }

      setImportResult({ totals, perGroup: results });
      setNotice({
        type: 'success',
        message: dryRun
          ? `Dry run finished: ${totals.fetched} fetched, ${totals.rejected} rejected (nothing saved).`
          : `Import finished: ${totals.staged} saved to staging.`,
      });
      loadDashboard();
      if (!dryRun) loadQueue();
    } catch (e) {
      setNotice({
        type: 'error',
        message: e instanceof Error ? e.message : 'Import failed',
      });
      // 途中までの結果も見せる（どのカテゴリで失敗したか分かるように）
      if (results.length > 0) setImportResult({ totals, perGroup: results, incomplete: true });
    } finally {
      setImporting(false);
    }
  };

  const review = async (
    item: StagingItem,
    action: 'approveNew' | 'merge' | 'reject' | 'defer',
    opts: { spotId?: string; publish?: boolean; fill?: boolean } = {}
  ) => {
    setBusyId(item.id);
    setNotice(null);
    try {
      const params = new URLSearchParams({ id: item.id, action });
      if (opts.spotId) params.set('spotId', opts.spotId);
      if (opts.publish) params.set('publish', '1');
      if (opts.fill) params.set('fill', '1');

      const res = await fetch(`/api/admin-osm-review?${params.toString()}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Failed (${res.status})`);

      setNotice({
        type: 'success',
        message: data.note || `${action} applied to "${item.name}".`,
      });
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      loadDashboard();
    } catch (e) {
      setNotice({ type: 'error', message: e instanceof Error ? e.message : 'Failed' });
    } finally {
      setBusyId(null);
    }
  };

  const input =
    'bg-white border border-background-200 rounded-md px-3 py-2 text-sm text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground-900 font-heading">OSM Import</h1>
        <p className="text-sm text-foreground-500 mt-1">
          Candidates from OpenStreetMap go to staging first. Nothing reaches the live site until
          you approve it here.
        </p>
      </div>

      {notice && (
        <div
          className={`rounded-lg p-3 text-sm ${
            notice.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          {notice.message}
        </div>
      )}

      {/* ── Import 実行 ── */}
      <section className="bg-background-50 border border-background-200 rounded-lg p-5">
        <h2 className="font-heading font-bold text-base text-foreground-900 mb-3">
          Run an import
        </h2>
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <select
            value={importPref}
            onChange={(e) => setImportPref(e.target.value)}
            className={`${input} cursor-pointer sm:w-48`}
          >
            {(prefectures.length > 0 ? prefectures : ['Tochigi']).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => runImport(true)}
            disabled={importing}
            className="bg-background-100 hover:bg-background-200 disabled:opacity-50 text-foreground-800 font-semibold text-sm px-4 py-2 rounded-lg cursor-pointer whitespace-nowrap"
          >
            {importing ? 'Running…' : 'Dry run'}
          </button>
          <button
            type="button"
            onClick={() => runImport(false)}
            disabled={importing}
            className="bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white font-semibold text-sm px-4 py-2 rounded-lg cursor-pointer whitespace-nowrap"
          >
            {importing ? 'Running…' : 'Import to staging'}
          </button>
          <span className="text-xs text-foreground-500">
            One prefecture at a time, split by category to stay within Overpass and function
            time limits.
          </span>
        </div>

        {importProgress.length > 0 && (
          <div className="mt-4 space-y-1">
            {importProgress.map((line, i) => (
              <p key={i} className="text-xs text-foreground-600 font-mono">
                {line}
              </p>
            ))}
          </div>
        )}

        {importResult != null && (
          <pre className="mt-4 bg-white border border-background-200 rounded-md p-3 text-xs overflow-x-auto max-h-72 text-foreground-700">
            {JSON.stringify(importResult, null, 2)}
          </pre>
        )}
      </section>

      {/* ── Staging の状況 ── */}
      {summary && (
        <section>
          <h2 className="font-heading font-bold text-base text-foreground-900 mb-3">
            Staging
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {(['MATCHED', 'POSSIBLE_MATCH', 'NEW', 'REJECTED'] as MatchStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`text-left bg-background-50 border rounded-lg p-4 cursor-pointer transition-colors ${
                  statusFilter === s
                    ? 'border-primary-400 ring-2 ring-primary-100'
                    : 'border-background-200 hover:border-background-300'
                }`}
              >
                <p className="text-xs font-medium text-foreground-500">{s}</p>
                <p className="mt-1 text-2xl font-bold font-heading text-foreground-900 tabular-nums">
                  {num(summary.byStatus[s])}
                </p>
              </button>
            ))}
            <div className="bg-background-50 border border-background-200 rounded-lg p-4">
              <p className="text-xs font-medium text-foreground-500">Reviewed</p>
              <p className="mt-1 text-2xl font-bold font-heading text-foreground-900 tabular-nums">
                {num(summary.reviewed)}
              </p>
            </div>
            <div className="bg-background-50 border border-background-200 rounded-lg p-4">
              <p className="text-xs font-medium text-foreground-500">Pending review</p>
              <p className="mt-1 text-2xl font-bold font-heading text-foreground-900 tabular-nums">
                {num(summary.pendingReview)}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ── Review Queue ── */}
      <section>
        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-3">
          <h2 className="font-heading font-bold text-base text-foreground-900 flex-1">
            Review queue
            <span className="ml-2 text-xs font-normal text-foreground-500">
              {statusFilter} · {filtered.length} items
            </span>
          </h2>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name"
            className={`${input} md:w-48`}
          />
          <label className="flex items-center gap-2 text-sm text-foreground-600 whitespace-nowrap cursor-pointer">
            <input
              type="checkbox"
              checked={onlyPending}
              onChange={(e) => setOnlyPending(e.target.checked)}
              className="cursor-pointer"
            />
            Only unreviewed
          </label>
        </div>

        {loading && <div className="h-40 bg-background-200 rounded-lg animate-pulse" />}

        {!loading && filtered.length === 0 && (
          <div className="bg-background-50 border border-background-200 rounded-lg p-10 text-center text-sm text-foreground-500">
            Nothing to review here. Run an import, or switch the status filter above.
          </div>
        )}

        {!loading && (
          <div className="space-y-3">
            {filtered.map((item) => (
              <div
                key={item.id}
                className="bg-background-50 border border-background-200 rounded-lg p-5"
              >
                <div className="flex flex-col md:flex-row md:items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${
                          STATUS_STYLE[item.matchStatus]
                        }`}
                      >
                        {item.matchStatus}
                      </span>
                      {item.category && (
                        <span className="text-xs text-foreground-500">{item.category}</span>
                      )}
                      <span className="text-xs text-foreground-400">
                        confidence {item.confidence}
                      </span>
                    </div>

                    <p className="mt-2 font-semibold text-foreground-900">{item.name}</p>
                    {item.aliases.length > 0 && (
                      <p className="text-xs text-foreground-500">{item.aliases.join(' / ')}</p>
                    )}
                    <p className="text-xs text-foreground-400 mt-1">
                      {item.prefecture}
                      {item.city ? ` · ${item.city}` : ''} · {item.lat.toFixed(5)},{' '}
                      {item.lng.toFixed(5)} ·{' '}
                      <a
                        href={`https://www.openstreetmap.org/${item.id.replace('-', '/')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-500 hover:text-primary-600"
                      >
                        View on OSM
                      </a>
                    </p>
                    <p className="text-xs text-foreground-600 mt-2">{item.matchReason}</p>

                    {item.candidates.length > 0 && (
                      <div className="mt-3 space-y-1">
                        <p className="text-xs font-medium text-foreground-600">
                          Existing spots nearby
                        </p>
                        {item.candidates.map((c) => (
                          <div
                            key={c.spotId}
                            className="flex items-center gap-2 text-xs bg-white border border-background-200 rounded px-2 py-1.5"
                          >
                            <span className="font-medium text-foreground-900 truncate flex-1">
                              {c.title}
                            </span>
                            <span className="text-foreground-500 whitespace-nowrap">
                              {c.distance}m · name {c.nameSimilarity} · conf {c.confidence}
                            </span>
                            <button
                              type="button"
                              onClick={() => review(item, 'merge', { spotId: c.spotId, fill: true })}
                              disabled={busyId === item.id}
                              className="text-primary-500 hover:text-primary-600 font-medium whitespace-nowrap cursor-pointer disabled:opacity-50"
                            >
                              Merge into this
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 md:w-44 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => review(item, 'approveNew')}
                      disabled={busyId === item.id}
                      className="bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white font-semibold text-sm px-3 py-2 rounded-lg cursor-pointer whitespace-nowrap"
                    >
                      Create as draft
                    </button>
                    <button
                      type="button"
                      onClick={() => review(item, 'reject')}
                      disabled={busyId === item.id}
                      className="bg-background-100 hover:bg-background-200 disabled:opacity-50 text-foreground-700 font-medium text-sm px-3 py-2 rounded-lg cursor-pointer whitespace-nowrap"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => review(item, 'defer')}
                      disabled={busyId === item.id}
                      className="text-foreground-500 hover:text-foreground-700 text-sm cursor-pointer disabled:opacity-50"
                    >
                      Decide later
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Import 履歴 ── */}
      {runs.length > 0 && (
        <section>
          <h2 className="font-heading font-bold text-base text-foreground-900 mb-3">
            Import history
          </h2>
          <div className="bg-background-50 border border-background-200 rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-foreground-500 border-b border-background-200">
                  <th className="py-3 px-5 font-medium">Prefecture</th>
                  <th className="py-3 px-3 font-medium">Started</th>
                  <th className="py-3 px-3 font-medium text-right">Fetched</th>
                  <th className="py-3 px-3 font-medium text-right">Staged</th>
                  <th className="py-3 px-3 font-medium text-right">Matched</th>
                  <th className="py-3 px-3 font-medium text-right">Possible</th>
                  <th className="py-3 px-3 font-medium text-right">New</th>
                  <th className="py-3 px-5 font-medium text-right">Rejected</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.runId} className="border-b border-background-100 last:border-0">
                    <td className="py-3 px-5 text-foreground-900 font-medium">{r.prefecture}</td>
                    <td className="py-3 px-3 text-foreground-500 text-xs whitespace-nowrap">
                      {new Date(r.startedAt).toLocaleString()}
                      {r.status !== 'completed' && (
                        <span className="ml-2 text-red-600">{r.status}</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums">{num(r.fetched)}</td>
                    <td className="py-3 px-3 text-right tabular-nums">{num(r.staged)}</td>
                    <td className="py-3 px-3 text-right tabular-nums">
                      {num(r.counts?.MATCHED)}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums">
                      {num(r.counts?.POSSIBLE_MATCH)}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums">{num(r.counts?.NEW)}</td>
                    <td className="py-3 px-5 text-right tabular-nums text-foreground-500">
                      {num(r.rejected)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {runs[0]?.rejectReasons && Object.keys(runs[0].rejectReasons).length > 0 && (
            <p className="text-xs text-foreground-500 mt-2">
              Latest run excluded:{' '}
              {Object.entries(runs[0].rejectReasons)
                .map(([reason, count]) => `${reason} (${count})`)
                .join(', ')}
            </p>
          )}
        </section>
      )}

      <p className="text-xs text-foreground-400 border-t border-background-200 pt-4">
        Spot data from OpenStreetMap is © OpenStreetMap contributors, available under the Open
        Database License (ODbL 1.0). Check the current terms at osmfoundation.org/wiki/Licence
        before publishing imported data.
      </p>
    </div>
  );
}
