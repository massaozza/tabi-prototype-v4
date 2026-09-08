// src/pages/admin/spots/page.tsx
//
// Spot管理画面（Living Spot Database）。
//
// 【なぜ専用画面を新設したか】
// 従来のContent画面のDestinationsタブには次の問題があった：
//   1. 保存が「367件の配列を丸ごと置換」する方式だった。
//      Import処理と同時に保存すると、後から書いた側が相手の変更を全部消す。
//   2. 座標(lat/lng)の入力欄が無かった。新規Spotを作ると座標なしで登録され、
//      地図・Nearby Spots・Matchingがすべて機能しない。
//   3. IDが `generateId()`（タイムスタンプ由来）だったため、
//      新規SpotのURLが /destinations/mg8x2k-a3f9j のような無意味なslugになる。
//
// この画面は1件ずつ /api/spots に PATCH / POST するため、
// 同時実行でも他のSpotに影響しない。

import { useEffect, useMemo, useState } from 'react';
import { PREFECTURE_REGIONS } from '@/mocks/prefectureData';

interface Completeness {
  baseData: boolean;
  editorialContent: boolean;
  officialInfo: boolean;
  localKnowledge: boolean;
  actualData: boolean;
}

interface Spot {
  id: string;
  title: string;
  category: string;
  prefecture: string;
  description: string;
  lat: number;
  lng: number;
  image: string;
  city?: string;
  address?: string;
  officialUrl?: string;
  openingHours?: string;
  admission?: string;
  access?: string;
  status?: string;
  completeness?: Completeness;
  enrichmentLevel?: number;
  updatedAt?: string;
}

const STATUSES = ['published', 'draft', 'staging', 'rejected'] as const;

const ALL_PREFECTURES = PREFECTURE_REGIONS.flatMap((r) => r.prefectures).filter(Boolean);

/** 何が揃っているかを色で示す。単一のレベル値では実態が分からないため */
function CompletenessBadges({ c }: { c?: Completeness }) {
  if (!c) return <span className="text-xs text-foreground-400">—</span>;
  const items: { key: keyof Completeness; label: string }[] = [
    { key: 'baseData', label: 'Base' },
    { key: 'editorialContent', label: 'Text' },
    { key: 'officialInfo', label: 'Official' },
    { key: 'localKnowledge', label: 'Local' },
    { key: 'actualData', label: 'Actual' },
  ];
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((i) => (
        <span
          key={i.key}
          title={i.label}
          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
            c[i.key]
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-background-100 text-foreground-300 border border-background-200'
          }`}
        >
          {i.label}
        </span>
      ))}
    </div>
  );
}

export default function AdminSpotsPage() {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [prefFilter, setPrefFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [missingFilter, setMissingFilter] = useState('all');

  const [editing, setEditing] = useState<Spot | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadSpots = () => {
    setLoading(true);
    // 管理画面では下書き・却下も見たいので、状態ごとに取得して結合する
    Promise.all(
      STATUSES.map((s) =>
        fetch(`/api/spots?status=${s}`)
          .then((r) => (r.ok ? r.json() : { spots: [] }))
          .then((d) => (Array.isArray(d.spots) ? d.spots : []))
          .catch(() => [])
      )
    )
      .then((groups) => {
        const merged = new Map<string, Spot>();
        for (const g of groups) for (const s of g) merged.set(s.id, s);
        setSpots([...merged.values()]);
        setError('');
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(loadSpots, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return spots
      .filter((s) => (prefFilter === 'all' ? true : s.prefecture === prefFilter))
      .filter((s) => (statusFilter === 'all' ? true : (s.status || 'published') === statusFilter))
      .filter((s) => {
        if (missingFilter === 'all') return true;
        if (missingFilter === 'noCoords') return !s.lat || !s.lng;
        if (missingFilter === 'noImage') return !s.image;
        if (missingFilter === 'shortText') return !s.completeness?.editorialContent;
        if (missingFilter === 'noOfficial') return !s.completeness?.officialInfo;
        if (missingFilter === 'noCity') return !s.city;
        return true;
      })
      .filter((s) => !q || s.title.toLowerCase().includes(q) || s.id.toLowerCase().includes(q))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [spots, search, prefFilter, statusFilter, missingFilter]);

  const openNew = () => {
    setIsNew(true);
    setEditing({
      id: '',
      title: '',
      category: '',
      prefecture: '',
      description: '',
      lat: 0,
      lng: 0,
      image: '',
      status: 'draft',
    });
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    setNotice(null);

    try {
      // 【重要】1件ずつ送る。配列全体の置換ではないため、
      // 他のSpotやImport処理の変更を消さない。
      const res = isNew
        ? await fetch('/api/spots', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(editing),
          })
        : await fetch(`/api/spots?id=${encodeURIComponent(editing.id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(editing),
          });

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `Failed (${res.status})`);

      // 返ってきた1件だけをローカル状態に反映する
      const saved: Spot | undefined = data?.spot;
      if (saved) {
        setSpots((prev) => {
          const idx = prev.findIndex((s) => s.id === saved.id);
          if (idx === -1) return [...prev, saved];
          const next = [...prev];
          next[idx] = saved;
          return next;
        });
      }

      setNotice({ type: 'success', message: `Saved "${editing.title}".` });
      setEditing(null);
      setIsNew(false);
      setTimeout(() => setNotice(null), 3000);
    } catch (e) {
      setNotice({ type: 'error', message: e instanceof Error ? e.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  /**
   * 却下（論理削除）。
   * 物理削除はしない。Trip / Guide / Review / My Trip が
   * 紐づいている可能性があり、消すと参照が壊れるため。
   */
  const reject = async (spot: Spot) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/spots?id=${encodeURIComponent(spot.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected' }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Failed');
      if (data?.spot) {
        setSpots((prev) => prev.map((s) => (s.id === spot.id ? data.spot : s)));
      }
      setNotice({ type: 'success', message: `"${spot.title}" set to rejected.` });
      setTimeout(() => setNotice(null), 3000);
    } catch (e) {
      setNotice({ type: 'error', message: e instanceof Error ? e.message : 'Failed' });
    } finally {
      setSaving(false);
    }
  };

  const input =
    'w-full bg-white border border-background-200 rounded-md px-3 py-2 text-sm text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400';

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground-900 font-heading">Spots</h1>
          <p className="text-sm text-foreground-500 mt-1">
            {spots.length} spots · saved one at a time, so imports and edits never overwrite each
            other
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm px-4 py-2 rounded-lg whitespace-nowrap cursor-pointer"
        >
          New spot
        </button>
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

      {/* ── 絞り込み ── */}
      <div className="bg-background-50 border border-background-200 rounded-lg p-4 flex flex-col md:flex-row gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title or ID"
          className={`${input} md:w-56`}
        />
        <select value={prefFilter} onChange={(e) => setPrefFilter(e.target.value)} className={`${input} md:w-44 cursor-pointer`}>
          <option value="all">All prefectures</option>
          {ALL_PREFECTURES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${input} md:w-36 cursor-pointer`}>
          <option value="all">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select value={missingFilter} onChange={(e) => setMissingFilter(e.target.value)} className={`${input} md:w-48 cursor-pointer`}>
          <option value="all">All spots</option>
          <option value="noCoords">Missing coordinates</option>
          <option value="noImage">Missing image</option>
          <option value="shortText">Short description</option>
          <option value="noOfficial">No official info</option>
          <option value="noCity">No city</option>
        </select>
        <span className="text-xs text-foreground-500 md:ml-auto self-center whitespace-nowrap">
          {filtered.length} shown
        </span>
      </div>

      {loading && <div className="h-40 bg-background-200 rounded-lg animate-pulse" />}
      {!loading && error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          Could not load spots. ({error})
        </div>
      )}

      {!loading && !error && (
        <div className="bg-background-50 border border-background-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-foreground-500 border-b border-background-200">
                <th className="py-3 px-5 font-medium">Spot</th>
                <th className="py-3 px-3 font-medium">Prefecture</th>
                <th className="py-3 px-3 font-medium">Status</th>
                <th className="py-3 px-3 font-medium">Data</th>
                <th className="py-3 px-5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-sm text-foreground-500">
                    No spots match this filter.
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.id} className="border-b border-background-100 last:border-0 hover:bg-background-100/50">
                    <td className="py-3 px-5 max-w-[280px]">
                      <p className="text-foreground-900 font-medium truncate">{s.title}</p>
                      <p className="text-xs text-foreground-400 truncate">/destinations/{s.id}</p>
                    </td>
                    <td className="py-3 px-3 text-foreground-700 whitespace-nowrap">{s.prefecture || '—'}</td>
                    <td className="py-3 px-3">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${
                          (s.status || 'published') === 'published'
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : (s.status || '') === 'rejected'
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {s.status || 'published'}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <CompletenessBadges c={s.completeness} />
                    </td>
                    <td className="py-3 px-5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          setIsNew(false);
                          setEditing(s);
                        }}
                        className="text-primary-500 hover:text-primary-600 font-medium text-sm cursor-pointer"
                      >
                        Edit
                      </button>
                      {(s.status || 'published') !== 'rejected' && (
                        <button
                          type="button"
                          onClick={() => reject(s)}
                          disabled={saving}
                          className="ml-3 text-foreground-500 hover:text-red-600 font-medium text-sm cursor-pointer disabled:opacity-50"
                        >
                          Reject
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── 編集フォーム ── */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center p-4 overflow-y-auto z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full my-8 p-6">
            <h2 className="font-heading font-bold text-lg text-foreground-900 mb-4">
              {isNew ? 'New spot' : `Edit: ${editing.title}`}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground-600 mb-1">
                  ID (URL slug){!isNew && ' — cannot be changed'}
                </label>
                <input
                  type="text"
                  value={editing.id}
                  disabled={!isNew}
                  onChange={(e) =>
                    setEditing({ ...editing, id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })
                  }
                  placeholder="nikko-toshogu"
                  className={`${input} ${!isNew ? 'bg-background-100 text-foreground-500' : ''}`}
                />
                <p className="text-xs text-foreground-500 mt-1">
                  {isNew
                    ? 'Becomes the URL: /destinations/{id}. Use readable words, not random characters.'
                    : 'Changing the ID would break the URL and all links from trips, guides and reviews.'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground-600 mb-1">Title</label>
                <input type="text" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className={input} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-foreground-600 mb-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={editing.lat || ''}
                    onChange={(e) => setEditing({ ...editing, lat: Number(e.target.value) })}
                    placeholder="36.7580878"
                    className={input}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground-600 mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={editing.lng || ''}
                    onChange={(e) => setEditing({ ...editing, lng: Number(e.target.value) })}
                    placeholder="139.5987466"
                    className={input}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-foreground-600 mb-1">Prefecture</label>
                  <select
                    value={editing.prefecture}
                    onChange={(e) => setEditing({ ...editing, prefecture: e.target.value })}
                    className={`${input} cursor-pointer`}
                  >
                    <option value="">— select —</option>
                    {ALL_PREFECTURES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground-600 mb-1">City (optional)</label>
                  <input type="text" value={editing.city || ''} onChange={(e) => setEditing({ ...editing, city: e.target.value })} className={input} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground-600 mb-1">Category</label>
                <input type="text" value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} className={input} />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground-600 mb-1">Description</label>
                <textarea
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  rows={4}
                  className={input}
                />
                <p className="text-xs text-foreground-500 mt-1">
                  {editing.description.trim().length} characters
                  {editing.description.trim().length < 40 && ' — under 40 counts as incomplete'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground-600 mb-1">Image URL</label>
                <input type="text" value={editing.image} onChange={(e) => setEditing({ ...editing, image: e.target.value })} className={input} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-foreground-600 mb-1">Official website (optional)</label>
                  <input type="text" value={editing.officialUrl || ''} onChange={(e) => setEditing({ ...editing, officialUrl: e.target.value })} className={input} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground-600 mb-1">Status</label>
                  <select
                    value={editing.status || 'published'}
                    onChange={(e) => setEditing({ ...editing, status: e.target.value })}
                    className={`${input} cursor-pointer`}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setIsNew(false);
                }}
                className="px-4 py-2 text-sm font-medium text-foreground-600 hover:text-foreground-900 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving || !editing.title.trim() || !editing.id.trim()}
                className="bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white font-semibold text-sm px-5 py-2 rounded-lg cursor-pointer"
              >
                {saving ? 'Saving…' : 'Save this spot'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
