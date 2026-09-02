import { useState } from 'react';

// TABI 3.0：My Trip中心の循環の基盤となる、計画パネル。
// 「まだ日程未定（saved）」→「日だけ決めた（day_assigned）」→
// 「時間まで決めた（scheduled）」という計画レベルを、ボタン操作で
// 自然に進められるようにする。ドラッグ&ドロップは今回は使わず、
// シンプルなボタン操作にとどめている。

type PlanLevel = 'saved' | 'day_assigned' | 'scheduled';
type ItemStatus = 'fixed' | 'planned' | 'option';

interface TripItem {
  id: string;
  itemType: 'spot' | 'restaurant' | 'experience';
  title: string;
  spotId?: string;
  planLevel: PlanLevel;
  day?: number;
  time?: string;
  status: ItemStatus;
  optionGroupId?: string;
}

interface ActualVisitLogEntry {
  itemId: string;
  visitedAt: string;
  order: number;
}

interface TripPlanningPanelProps {
  tripId: string;
  items: TripItem[];
  actualVisitLog: ActualVisitLogEntry[];
  tripStatus: string;
  onTripUpdate: (trip: { items: TripItem[]; actualVisitLog: ActualVisitLogEntry[]; status?: string }) => void;
}

const STATUS_BADGE: Record<ItemStatus, { label: string; className: string }> = {
  fixed: { label: 'Fixed', className: 'bg-emerald-100 text-emerald-700' },
  planned: { label: 'Planned', className: 'bg-background-200 text-foreground-600' },
  option: { label: 'Option', className: 'bg-accent-100 text-accent-700' },
};

export default function TripPlanningPanel({
  tripId,
  items,
  actualVisitLog,
  tripStatus,
  onTripUpdate,
}: TripPlanningPanelProps) {
  const [newItemTitle, setNewItemTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const isTraveling = tripStatus === 'traveling';

  const callTripAction = async (
    action: string,
    body: Record<string, unknown>
  ): Promise<{ items: TripItem[]; actualVisitLog: ActualVisitLogEntry[]; status?: string } | null> => {
    try {
      const res = await fetch(
        `/api/trips?id=${encodeURIComponent(tripId)}&action=${action}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Something went wrong');
      }
      return {
        items: data.trip.items || [],
        actualVisitLog: data.trip.actualVisitLog || [],
        status: data.trip.status,
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      return null;
    }
  };

  const handleAddItem = async () => {
    const title = newItemTitle.trim();
    if (!title) return;
    setAdding(true);
    setError('');
    const result = await callTripAction('addItem', {
      title,
      itemType: 'spot',
      planLevel: 'saved',
      status: 'planned',
    });
    if (result) {
      onTripUpdate(result);
      setNewItemTitle('');
    }
    setAdding(false);
  };

  const handleAssignDay = async (item: TripItem) => {
    const dayInput = window.prompt('What day is this for? (e.g. 1, 2, 3)', String(item.day || 1));
    if (!dayInput) return;
    const day = parseInt(dayInput, 10);
    if (Number.isNaN(day) || day < 1) return;
    setBusyItemId(item.id);
    const result = await callTripAction('updateItem', {
      itemId: item.id,
      planLevel: 'day_assigned',
      day,
    });
    if (result) onTripUpdate(result);
    setBusyItemId(null);
  };

  const handleSetTime = async (item: TripItem) => {
    const timeInput = window.prompt('What time? (e.g. 09:00)', item.time || '');
    if (!timeInput) return;
    setBusyItemId(item.id);
    const result = await callTripAction('updateItem', {
      itemId: item.id,
      planLevel: 'scheduled',
      time: timeInput,
    });
    if (result) onTripUpdate(result);
    setBusyItemId(null);
  };

  const handleMakeFlexible = async (item: TripItem) => {
    setBusyItemId(item.id);
    const result = await callTripAction('updateItem', {
      itemId: item.id,
      planLevel: 'day_assigned',
      time: undefined,
    });
    if (result) onTripUpdate(result);
    setBusyItemId(null);
  };

  const cycleStatus = (current: ItemStatus): ItemStatus => {
    if (current === 'planned') return 'fixed';
    if (current === 'fixed') return 'option';
    return 'planned';
  };

  const handleToggleStatus = async (item: TripItem) => {
    setBusyItemId(item.id);
    const result = await callTripAction('updateItem', {
      itemId: item.id,
      status: cycleStatus(item.status),
    });
    if (result) onTripUpdate(result);
    setBusyItemId(null);
  };

  const handleRemove = async (item: TripItem) => {
    setBusyItemId(item.id);
    const result = await callTripAction('removeItem', { itemId: item.id });
    if (result) onTripUpdate(result);
    setBusyItemId(null);
  };

  const handleStartTravel = async () => {
    const result = await callTripAction('startTravel', {});
    if (result) onTripUpdate(result);
  };

  const handleMarkVisited = async (item: TripItem) => {
    setBusyItemId(item.id);
    const result = await callTripAction('markVisited', { itemId: item.id });
    if (result) onTripUpdate(result);
    setBusyItemId(null);
  };

  const [unplannedTitle, setUnplannedTitle] = useState('');
  const handleAddUnplannedVisit = async () => {
    const title = unplannedTitle.trim();
    if (!title) return;
    setAdding(true);
    const result = await callTripAction('markVisited', { title });
    if (result) {
      onTripUpdate(result);
      setUnplannedTitle('');
    }
    setAdding(false);
  };

  const visitedItemIds = new Set(actualVisitLog.map((l) => l.itemId));

  const savedItems = items.filter((i) => i.planLevel === 'saved');
  const dayNumbers = Array.from(
    new Set(items.filter((i) => i.planLevel !== 'saved').map((i) => i.day || 1))
  ).sort((a, b) => a - b);

  const renderItemRow = (item: TripItem) => {
    const badge = STATUS_BADGE[item.status];
    const visited = visitedItemIds.has(item.id);
    const busy = busyItemId === item.id;
    return (
      <div
        key={item.id}
        className="flex items-center justify-between gap-3 bg-background-50 border border-background-200 rounded-lg px-3.5 py-2.5"
      >
        <div className="flex items-center gap-2 min-w-0">
          {item.time && (
            <span className="text-xs text-foreground-500 whitespace-nowrap font-semibold">
              {item.time}
            </span>
          )}
          <span className="text-sm text-foreground-900 truncate">{item.title}</span>
          <button
            onClick={() => handleToggleStatus(item)}
            disabled={busy}
            className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap cursor-pointer disabled:opacity-50 ${badge.className}`}
          >
            {badge.label}
          </button>
          {visited && (
            <span className="text-xs text-emerald-600 font-semibold whitespace-nowrap">
              <i className="ri-checkbox-circle-fill mr-0.5"></i>
              Visited
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {isTraveling && !visited && (
            <button
              onClick={() => handleMarkVisited(item)}
              disabled={busy}
              className="text-xs font-semibold text-primary-600 hover:text-primary-700 whitespace-nowrap cursor-pointer disabled:opacity-50 px-2 py-1"
            >
              Mark visited
            </button>
          )}
          {!isTraveling && item.planLevel === 'saved' && (
            <button
              onClick={() => handleAssignDay(item)}
              disabled={busy}
              className="text-xs font-semibold text-foreground-600 hover:text-foreground-900 whitespace-nowrap cursor-pointer disabled:opacity-50 px-2 py-1"
            >
              Assign day
            </button>
          )}
          {!isTraveling && item.planLevel === 'day_assigned' && (
            <button
              onClick={() => handleSetTime(item)}
              disabled={busy}
              className="text-xs font-semibold text-foreground-600 hover:text-foreground-900 whitespace-nowrap cursor-pointer disabled:opacity-50 px-2 py-1"
            >
              Add time
            </button>
          )}
          {!isTraveling && item.planLevel === 'scheduled' && (
            <button
              onClick={() => handleMakeFlexible(item)}
              disabled={busy}
              className="text-xs font-semibold text-foreground-600 hover:text-foreground-900 whitespace-nowrap cursor-pointer disabled:opacity-50 px-2 py-1"
            >
              Make flexible
            </button>
          )}
          {!isTraveling && (
            <button
              onClick={() => handleRemove(item)}
              disabled={busy}
              className="w-7 h-7 flex items-center justify-center text-foreground-300 hover:text-red-500 transition-colors cursor-pointer disabled:opacity-50"
              aria-label="Remove"
            >
              <i className="ri-close-line"></i>
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="mt-6 pt-6 border-t border-background-200">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="font-heading font-bold text-sm text-foreground-900">
          Trip Planner
        </h3>
        {!isTraveling && tripStatus === 'planning' && items.length > 0 && (
          <button
            onClick={handleStartTravel}
            className="inline-flex items-center gap-1.5 bg-foreground-900 hover:bg-foreground-800 text-white font-semibold text-xs px-3 py-1.5 rounded-md transition-colors whitespace-nowrap cursor-pointer"
          >
            <i className="ri-flight-takeoff-line"></i>
            Start Travel
          </button>
        )}
        {isTraveling && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 whitespace-nowrap">
            <i className="ri-map-pin-user-line"></i>
            Traveling now
          </span>
        )}
      </div>

      {error && <p className="text-red-500 text-xs mb-3">{error}</p>}

      {/* Saved for Trip（まだ日程未定） */}
      {savedItems.length > 0 && (
        <div className="mb-5">
          <span className="block text-xs font-semibold text-foreground-500 uppercase tracking-wide mb-2">
            Saved for Trip
          </span>
          <div className="space-y-2">{savedItems.map(renderItemRow)}</div>
        </div>
      )}

      {/* Day毎の表示 */}
      {dayNumbers.map((dayNum) => {
        const dayItems = items
          .filter((i) => i.planLevel !== 'saved' && (i.day || 1) === dayNum)
          .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
        return (
          <div key={dayNum} className="mb-5">
            <span className="block text-xs font-semibold text-foreground-500 uppercase tracking-wide mb-2">
              Day {dayNum}
            </span>
            <div className="space-y-2">{dayItems.map(renderItemRow)}</div>
          </div>
        );
      })}

      {/* 予定外の訪問先を追加（Travel Mode中のみ） */}
      {isTraveling && (
        <div className="mb-5 flex items-center gap-2">
          <input
            type="text"
            value={unplannedTitle}
            onChange={(e) => setUnplannedTitle(e.target.value)}
            placeholder="Add a place you visited (not planned)..."
            className="flex-1 bg-background-50 border border-background-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
          <button
            onClick={handleAddUnplannedVisit}
            disabled={adding || !unplannedTitle.trim()}
            className="bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white text-xs font-semibold px-3 py-2 rounded-md transition-colors whitespace-nowrap cursor-pointer"
          >
            Add & Mark Visited
          </button>
        </div>
      )}

      {/* 新規アイテム追加（Planningフェーズのみ） */}
      {!isTraveling && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newItemTitle}
            onChange={(e) => setNewItemTitle(e.target.value)}
            placeholder="Add a place, restaurant, or experience..."
            className="flex-1 bg-background-50 border border-background-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
          <button
            onClick={handleAddItem}
            disabled={adding || !newItemTitle.trim()}
            className="bg-background-100 hover:bg-background-200 disabled:opacity-50 text-foreground-800 text-xs font-semibold px-3 py-2 rounded-md transition-colors whitespace-nowrap cursor-pointer"
          >
            + Add
          </button>
        </div>
      )}

      {items.length === 0 && (
        <p className="text-foreground-400 text-xs">
          No items yet. Add a place above to start planning.
        </p>
      )}
    </div>
  );
}
