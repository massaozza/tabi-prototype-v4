// src/pages/admin/funnel/page.tsx
// 管理画面「Funnel」タブ。収益ファネルの数値を確認する画面。
//
// 表示するもの：
//   1. 全体のファネル（表示 → 保存 → コピー → 予約CTA）と各段階の転換率
//   2. コンテンツ種別ごとの内訳
//   3. コンテンツ単位の明細（並び替え・検索・種別絞り込み）
//
// データは /api/admin-funnel から取得する。
// 数値の出どころは /api/track-view が積んでいるKVのカウンタ。

import { useState, useEffect, useMemo } from 'react';

const EVENTS = ['view', 'save', 'copy', 'booking_hotel', 'booking_experience'] as const;
type FunnelEvent = (typeof EVENTS)[number];

type Counts = Record<FunnelEvent, number>;

interface FunnelItem {
  contentType: string;
  id: string;
  title: string;
  counts: Counts;
}

interface FunnelResponse {
  totals: Counts;
  byType: Record<string, Counts & { items: number }>;
  items: FunnelItem[];
}

const EVENT_LABEL: Record<FunnelEvent, string> = {
  view: 'Views',
  save: 'Saves',
  copy: 'Copies',
  booking_hotel: 'Book Hotel',
  booking_experience: 'Book Experience',
};

const TYPE_LABEL: Record<string, string> = {
  trip: 'Trip',
  guide: 'Guide',
  experience: 'Experience',
  spot: 'Spot',
};

const TYPE_COLOR: Record<string, string> = {
  trip: 'bg-blue-50 text-blue-700 border-blue-200',
  guide: 'bg-purple-50 text-purple-700 border-purple-200',
  experience: 'bg-amber-50 text-amber-700 border-amber-200',
  spot: 'bg-green-50 text-green-700 border-green-200',
};

function emptyCounts(): Counts {
  return { view: 0, save: 0, copy: 0, booking_hotel: 0, booking_experience: 0 };
}

/** 転換率。分母が0のときは「—」を返す */
function rate(numerator: number, denominator: number): string {
  if (!denominator) return '—';
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function num(n: number): string {
  return n.toLocaleString('en-US');
}

/** ファネルの各段。前段からの転換率を添えて表示する */
function FunnelBar({ totals }: { totals: Counts }) {
  const bookings = totals.booking_hotel + totals.booking_experience;
  const steps = [
    { label: 'Views', value: totals.view, prev: null as number | null, color: 'bg-blue-500' },
    { label: 'Saves', value: totals.save, prev: totals.view, color: 'bg-indigo-500' },
    { label: 'Copies', value: totals.copy, prev: totals.view, color: 'bg-violet-500' },
    { label: 'Booking CTA', value: bookings, prev: totals.copy, color: 'bg-primary-500' },
  ];
  const max = Math.max(...steps.map((s) => s.value), 1);

  return (
    <div className="bg-background-50 rounded-lg border border-background-200 p-5">
      <h2 className="font-heading font-bold text-base text-foreground-900 mb-1">
        Revenue funnel
      </h2>
      <p className="text-xs text-foreground-500 mb-5">
        Percentages are conversion from the stage noted under each bar.
      </p>

      <div className="space-y-4">
        {steps.map((s) => (
          <div key={s.label}>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-sm font-medium text-foreground-700">{s.label}</span>
              <span className="text-sm font-semibold text-foreground-900 tabular-nums">
                {num(s.value)}
                {s.prev !== null && (
                  <span className="ml-2 text-xs font-normal text-foreground-500">
                    {rate(s.value, s.prev)} of{' '}
                    {s.label === 'Booking CTA' ? 'copies' : 'views'}
                  </span>
                )}
              </span>
            </div>
            <div className="h-2.5 bg-background-200 rounded-full overflow-hidden">
              <div
                className={`h-full ${s.color} rounded-full transition-all`}
                style={{ width: `${Math.max((s.value / max) * 100, s.value > 0 ? 2 : 0)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminFunnelPage() {
  const [data, setData] = useState<FunnelResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<FunnelEvent>('view');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin-funnel')
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((d) => {
        if (cancelled) return;
        if (d?.error) throw new Error(d.error);
        setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const items = data?.items || [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = items;
    if (typeFilter !== 'all') out = out.filter((i) => i.contentType === typeFilter);
    if (q) {
      out = out.filter(
        (i) => i.title.toLowerCase().includes(q) || i.id.toLowerCase().includes(q)
      );
    }
    return [...out].sort((a, b) => b.counts[sortKey] - a.counts[sortKey]);
  }, [items, search, typeFilter, sortKey]);

  const totals = data?.totals || emptyCounts();
  const hasAnyData = EVENTS.some((ev) => totals[ev] > 0);

  return (
    <div className="p-6 md:p-8 max-w-[1200px]">
      <div className="mb-6">
        <h1 className="font-heading font-bold text-2xl text-foreground-900">Funnel</h1>
        <p className="text-sm text-foreground-500 mt-1">
          How visitors move from browsing to booking.
        </p>
      </div>

      {loading && (
        <div className="space-y-4">
          <div className="h-40 bg-background-200 rounded-lg animate-pulse" />
          <div className="h-24 bg-background-200 rounded-lg animate-pulse" />
        </div>
      )}

      {!loading && error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          Could not load funnel data. ({error})
        </div>
      )}

      {!loading && !error && data && (
        <>
          {!hasAnyData && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800 mb-6">
              No events recorded yet. Numbers will appear once visitors view content,
              save or copy trips, or tap a booking CTA.
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
            <FunnelBar totals={totals} />

            <div className="bg-background-50 rounded-lg border border-background-200 p-5">
              <h2 className="font-heading font-bold text-base text-foreground-900 mb-4">
                By content type
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-foreground-500 border-b border-background-200">
                      <th className="pb-2 pr-3 font-medium">Type</th>
                      <th className="pb-2 px-3 font-medium text-right">Items</th>
                      {EVENTS.map((ev) => (
                        <th key={ev} className="pb-2 px-3 font-medium text-right whitespace-nowrap">
                          {EVENT_LABEL[ev]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(data.byType).map(([type, c]) => (
                      <tr key={type} className="border-b border-background-100 last:border-0">
                        <td className="py-2.5 pr-3">
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                              TYPE_COLOR[type] || 'bg-background-100 text-foreground-600 border-background-200'
                            }`}
                          >
                            {TYPE_LABEL[type] || type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-foreground-500 tabular-nums">
                          {num(c.items)}
                        </td>
                        {EVENTS.map((ev) => (
                          <td
                            key={ev}
                            className="py-2.5 px-3 text-right text-foreground-900 tabular-nums"
                          >
                            {num(c[ev])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ── コンテンツ単位の明細 ── */}
          <div className="bg-background-50 rounded-lg border border-background-200">
            <div className="p-5 border-b border-background-200 flex flex-col md:flex-row md:items-center gap-3">
              <h2 className="font-heading font-bold text-base text-foreground-900 flex-1">
                By content
                <span className="ml-2 text-xs font-normal text-foreground-500">
                  {num(filtered.length)} items
                </span>
              </h2>

              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search title or ID"
                className="bg-white border border-background-200 rounded-md px-3 py-2 text-sm text-foreground-900 placeholder:text-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary-400 w-full md:w-56"
              />

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="bg-white border border-background-200 rounded-md px-3 py-2 text-sm text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400 cursor-pointer"
              >
                <option value="all">All types</option>
                {Object.keys(data.byType).map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABEL[t] || t}
                  </option>
                ))}
              </select>

              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as FunnelEvent)}
                className="bg-white border border-background-200 rounded-md px-3 py-2 text-sm text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400 cursor-pointer"
              >
                {EVENTS.map((ev) => (
                  <option key={ev} value={ev}>
                    Sort by {EVENT_LABEL[ev]}
                  </option>
                ))}
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-foreground-500 border-b border-background-200">
                    <th className="py-3 px-5 font-medium">Content</th>
                    <th className="py-3 px-3 font-medium">Type</th>
                    {EVENTS.map((ev) => (
                      <th key={ev} className="py-3 px-3 font-medium text-right whitespace-nowrap">
                        {EVENT_LABEL[ev]}
                      </th>
                    ))}
                    <th className="py-3 px-5 font-medium text-right whitespace-nowrap">
                      Copy rate
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={EVENTS.length + 3}
                        className="py-10 text-center text-sm text-foreground-500"
                      >
                        No content matches this filter.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((item) => (
                      <tr
                        key={`${item.contentType}:${item.id}`}
                        className="border-b border-background-100 last:border-0 hover:bg-background-100/50"
                      >
                        <td className="py-3 px-5 max-w-[280px]">
                          <p className="text-foreground-900 font-medium truncate">
                            {item.title}
                          </p>
                          <p className="text-xs text-foreground-400 truncate">{item.id}</p>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${
                              TYPE_COLOR[item.contentType] ||
                              'bg-background-100 text-foreground-600 border-background-200'
                            }`}
                          >
                            {TYPE_LABEL[item.contentType] || item.contentType}
                          </span>
                        </td>
                        {EVENTS.map((ev) => (
                          <td
                            key={ev}
                            className={`py-3 px-3 text-right tabular-nums ${
                              item.counts[ev] > 0 ? 'text-foreground-900' : 'text-foreground-300'
                            }`}
                          >
                            {num(item.counts[ev])}
                          </td>
                        ))}
                        <td className="py-3 px-5 text-right tabular-nums text-foreground-600">
                          {rate(item.counts.copy, item.counts.view)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
