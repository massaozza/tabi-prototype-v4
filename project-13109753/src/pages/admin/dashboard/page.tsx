// src/pages/admin/dashboard/page.tsx
//
// 管理画面のDashboard。
//
// 【変更の経緯】
// 以前は src/mocks/adminData.ts の固定値を表示しており、
// 本番の実績とは無関係な数字が並んでいた（判断を誤る原因になる）。
// 現在は /api/admin-dashboard から実データを取得している。
//
// 【前月比について】
// 月別の記録は計測を実装した月から始まるため、前月のデータが無い間は
// 「—」と表示する。数字を捏造せず、無いことを明示する方針。
//
// 【アクセス解析との住み分け】
// PV・流入元・国別・滞在時間はGoogle Analyticsで見る。
// ここではGAで追いにくい「コンテンツ単位のファネル」を扱う。

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const EVENTS = ['view', 'save', 'copy', 'booking_hotel', 'booking_experience'] as const;
type FunnelEvent = (typeof EVENTS)[number];
type Counts = Record<FunnelEvent, number>;

interface ContentCounts {
  total: number;
  recent7d: number;
}

interface DashboardData {
  months: { current: string; previous: string };
  funnel: {
    allTime: Counts;
    current: Counts | null;
    previous: Counts | null;
  };
  content: {
    trips: ContentCounts;
    publishedTrips: number;
    guides: ContentCounts;
    experiences: ContentCounts;
    spots: ContentCounts;
    articles: ContentCounts;
  };
  users: { total: number; recent7d: number; withTrip: number };
  topContent: { contentType: string; id: string; title: string; copy: number; view: number }[];
}

function num(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString('en-US');
}

function rate(numerator: number, denominator: number): string {
  if (!denominator) return '—';
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

/** 前月比。どちらかのデータが無ければ null（画面では表示しない） */
function monthOverMonth(
  current: number | null | undefined,
  previous: number | null | undefined
): { text: string; positive: boolean } | null {
  if (current === null || current === undefined) return null;
  if (previous === null || previous === undefined) return null;
  if (previous === 0) {
    // 先月0からの増加は割合にできないので実数で示す
    if (current === 0) return null;
    return { text: `+${num(current)} vs last month`, positive: true };
  }
  const diff = ((current - previous) / previous) * 100;
  const sign = diff >= 0 ? '+' : '';
  return { text: `${sign}${diff.toFixed(1)}% vs last month`, positive: diff >= 0 };
}

interface MetricProps {
  label: string;
  value: string;
  sub?: string;
  change?: { text: string; positive: boolean } | null;
  icon: string;
  iconBg: string;
  iconColor: string;
}

function Metric({ label, value, sub, change, icon, iconBg, iconColor }: MetricProps) {
  return (
    <div className="bg-background-50 rounded-lg border border-background-200 p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground-500">{label}</p>
          <p className="mt-2 text-3xl font-bold font-heading text-foreground-900 tracking-tight tabular-nums">
            {value}
          </p>
          {sub && <p className="mt-1 text-xs text-foreground-500">{sub}</p>}
          {change && (
            <p
              className={`mt-2 text-xs font-medium ${
                change.positive ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {change.positive ? '↑' : '↓'} {change.text}
            </p>
          )}
        </div>
        <div
          className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0 ml-3`}
        >
          <i className={`${icon} ${iconColor} text-lg`}></i>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin-dashboard')
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

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-8 w-48 bg-background-200 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-background-200 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
        Could not load dashboard data. ({error || 'unknown error'})
      </div>
    );
  }

  const { funnel, content, users, topContent, months } = data;
  const cur = funnel.current;
  const prev = funnel.previous;

  const curBookings = cur ? cur.booking_hotel + cur.booking_experience : null;
  const prevBookings = prev ? prev.booking_hotel + prev.booking_experience : null;
  const allBookings = funnel.allTime.booking_hotel + funnel.allTime.booking_experience;

  const hasMonthly = Boolean(cur);
  const hasPrevious = Boolean(prev);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground-900 font-heading">Dashboard</h1>
        <p className="text-sm text-foreground-500 mt-1">
          TABI47 overview · {months.current}
          {hasPrevious ? ` (compared with ${months.previous})` : ''}
        </p>
      </div>

      {!hasPrevious && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          Month-over-month comparison needs two months of data. Monthly tracking has just
          started, so comparisons will appear from next month.
        </div>
      )}

      {/* ── 収益ファネル ── */}
      <section>
        <h2 className="font-heading font-bold text-base text-foreground-900 mb-3">
          Revenue funnel {hasMonthly ? `· ${months.current}` : '· all time'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <Metric
            label="Content views"
            value={num(cur ? cur.view : funnel.allTime.view)}
            sub={`${num(funnel.allTime.view)} all time`}
            change={monthOverMonth(cur?.view, prev?.view)}
            icon="ri-eye-line"
            iconBg="bg-blue-50"
            iconColor="text-blue-600"
          />
          <Metric
            label="Trips copied"
            value={num(cur ? cur.copy : funnel.allTime.copy)}
            sub={`Copy rate ${rate(
              cur ? cur.copy : funnel.allTime.copy,
              cur ? cur.view : funnel.allTime.view
            )}`}
            change={monthOverMonth(cur?.copy, prev?.copy)}
            icon="ri-file-copy-line"
            iconBg="bg-violet-50"
            iconColor="text-violet-600"
          />
          <Metric
            label="Booking CTA taps"
            value={num(curBookings ?? allBookings)}
            sub={`${rate(
              curBookings ?? allBookings,
              cur ? cur.copy : funnel.allTime.copy
            )} of copies`}
            change={monthOverMonth(curBookings, prevBookings)}
            icon="ri-hotel-line"
            iconBg="bg-primary-50"
            iconColor="text-primary-600"
          />
          <Metric
            label="Saves"
            value={num(cur ? cur.save : funnel.allTime.save)}
            sub={`${num(funnel.allTime.save)} all time`}
            change={monthOverMonth(cur?.save, prev?.save)}
            icon="ri-bookmark-line"
            iconBg="bg-indigo-50"
            iconColor="text-indigo-600"
          />
        </div>
        <p className="text-xs text-foreground-500 mt-3">
          Page views, traffic sources and countries are tracked in Google Analytics. This funnel
          covers what happens to individual pieces of content.{' '}
          <Link to="/admin/funnel" className="text-primary-500 hover:text-primary-600 font-medium">
            See per-content breakdown →
          </Link>
        </p>
      </section>

      {/* ── ユーザー ── */}
      <section>
        <h2 className="font-heading font-bold text-base text-foreground-900 mb-3">Users</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Metric
            label="Registered users"
            value={num(users.total)}
            sub={`${num(users.recent7d)} in the last 7 days`}
            icon="ri-team-line"
            iconBg="bg-green-50"
            iconColor="text-green-600"
          />
          <Metric
            label="Users with a trip"
            value={num(users.withTrip)}
            sub={`${rate(users.withTrip, users.total)} of registered users`}
            icon="ri-map-2-line"
            iconBg="bg-amber-50"
            iconColor="text-amber-600"
          />
          <Metric
            label="Published trips"
            value={num(content.publishedTrips)}
            sub={`${num(content.trips.total)} trips in total`}
            icon="ri-send-plane-line"
            iconBg="bg-blue-50"
            iconColor="text-blue-600"
          />
        </div>
      </section>

      {/* ── コンテンツ在庫 ── */}
      <section>
        <h2 className="font-heading font-bold text-base text-foreground-900 mb-3">
          Content inventory
        </h2>
        <div className="bg-background-50 rounded-lg border border-background-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-foreground-500 border-b border-background-200">
                <th className="py-3 px-5 font-medium">Type</th>
                <th className="py-3 px-3 font-medium text-right">Total</th>
                <th className="py-3 px-5 font-medium text-right">Last 7 days</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'Trips', c: content.trips, noDate: false },
                { label: 'Guides', c: content.guides, noDate: false },
                { label: 'Experiences', c: content.experiences, noDate: false },
                { label: 'Spots', c: content.spots, noDate: true },
                { label: 'Articles', c: content.articles, noDate: true },
              ].map((row) => (
                <tr key={row.label} className="border-b border-background-100 last:border-0">
                  <td className="py-3 px-5 text-foreground-900 font-medium">{row.label}</td>
                  <td className="py-3 px-3 text-right text-foreground-900 tabular-nums">
                    {num(row.c.total)}
                  </td>
                  <td className="py-3 px-5 text-right tabular-nums text-foreground-600">
                    {row.noDate ? '—' : `+${num(row.c.recent7d)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-foreground-500 mt-2">
          Spots and Articles are stored as lists without timestamps, so recent counts are not
          available for them.
        </p>
      </section>

      {/* ── 伸びているコンテンツ ── */}
      <section>
        <h2 className="font-heading font-bold text-base text-foreground-900 mb-3">
          Most copied content
        </h2>
        <div className="bg-background-50 rounded-lg border border-background-200 overflow-x-auto">
          {topContent.length === 0 ? (
            <p className="py-10 text-center text-sm text-foreground-500">
              No copies recorded yet.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-foreground-500 border-b border-background-200">
                  <th className="py-3 px-5 font-medium">Content</th>
                  <th className="py-3 px-3 font-medium text-right">Views</th>
                  <th className="py-3 px-3 font-medium text-right">Copies</th>
                  <th className="py-3 px-5 font-medium text-right">Copy rate</th>
                </tr>
              </thead>
              <tbody>
                {topContent.map((t) => (
                  <tr
                    key={`${t.contentType}:${t.id}`}
                    className="border-b border-background-100 last:border-0"
                  >
                    <td className="py-3 px-5 max-w-[320px]">
                      <p className="text-foreground-900 font-medium truncate">{t.title}</p>
                      <p className="text-xs text-foreground-400 truncate">{t.id}</p>
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-foreground-700">
                      {num(t.view)}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-foreground-900 font-medium">
                      {num(t.copy)}
                    </td>
                    <td className="py-3 px-5 text-right tabular-nums text-foreground-600">
                      {rate(t.copy, t.view)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
