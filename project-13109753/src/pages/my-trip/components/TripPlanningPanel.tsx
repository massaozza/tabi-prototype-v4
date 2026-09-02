import { useState } from 'react';

// TABI 3.0：My Trip中心の循環の基盤となる、計画パネル。
// 「まだ日程未定（saved）」→「日だけ決めた（day_assigned）」→
// 「時間まで決めた（scheduled）」という計画レベルを、画面内の
// ドロップダウン・入力欄で自然に進められるようにする
// （ブラウザ標準のprompt()は、サイトのデザインから浮いて分かりにくい
// というフィードバックを受け、画面内蔵のUIに置き換えている）。

type PlanLevel = 'saved' | 'day_assigned' | 'scheduled';
type ItemStatus = 'fixed' | 'planned' | 'option';

interface TripItem {
  id: string;
  itemType: 'sightseeing' | 'restaurant' | 'shopping' | 'accommodation' | 'activity' | 'transport' | 'other';
  title: string;
  spotId?: string;
  // 「Saved for Trip」のカード表示用。この変更より前に追加されたItemには
  // 存在しないため、常にオプショナルとして扱い、無い場合はフォールバック表示にする。
  imageUrl?: string;
  description?: string;
  planLevel: PlanLevel;
  day?: number;
  time?: string;
  status: ItemStatus;
  optionGroupId?: string;
  // TABI 3.0：この項目をMeals（B/L/D）欄に表示するかどうか。SPOTデータには
  // レストランを判別できる明確なカテゴリがないため、ユーザーが手動で
  // 「これは食事です」と指定する方式にしている。
  mealSlot?: 'breakfast' | 'lunch' | 'dinner';
  // TABI 3.0：SCHEDULE列でのドラッグ並び替え用（TripCard.tsx側で使用）。
  order?: number;
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

const STATUS_LABELS: Record<ItemStatus, string> = {
  fixed: 'Fixed',
  planned: 'Planned',
  option: 'Option',
};

const STATUS_COLORS: Record<ItemStatus, string> = {
  fixed: 'text-emerald-700 bg-emerald-50',
  planned: 'text-foreground-600 bg-background-100',
  option: 'text-accent-700 bg-accent-50',
};

// TABI 3.0：旅行で実際に行く「場所の種類」を表すカテゴリ。TABIのコンテンツ種別
// （TRIP/SPOT/EXPERIENCE）とは別の概念で、Trip Planner上でユーザーが手動で
// 選ぶ・SPOTのcategoryから推測する際に使う。'restaurant'のみMeals（B/L/D）への
// 割り当てができる。
const ITEM_TYPE_ICON: Record<TripItem['itemType'], string> = {
  sightseeing: 'ri-map-pin-line',
  restaurant: 'ri-restaurant-line',
  shopping: 'ri-shopping-bag-line',
  accommodation: 'ri-hotel-line',
  activity: 'ri-footprint-line',
  transport: 'ri-train-line',
  other: 'ri-more-line',
};

export default function TripPlanningPanel({
  tripId,
  items,
  actualVisitLog,
  tripStatus,
  onTripUpdate,
}: TripPlanningPanelProps) {
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemType, setNewItemType] = useState<TripItem['itemType']>('sightseeing');
  const [adding, setAdding] = useState(false);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

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
      itemType: newItemType,
      planLevel: 'saved',
      status: 'planned',
    });
    if (result) {
      onTripUpdate(result);
      setNewItemTitle('');
      setNewItemType('sightseeing');
    }
    setAdding(false);
  };

  const handleAssignDay = async (item: TripItem, day: number) => {
    setBusyItemId(item.id);
    const result = await callTripAction('updateItem', {
      itemId: item.id,
      planLevel: 'day_assigned',
      day,
    });
    if (result) onTripUpdate(result);
    setBusyItemId(null);
  };

  const handleSetTime = async (item: TripItem, time: string) => {
    if (!time) return;
    setBusyItemId(item.id);
    const result = await callTripAction('updateItem', {
      itemId: item.id,
      planLevel: 'scheduled',
      time,
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

  const handleSetStatus = async (item: TripItem, status: ItemStatus) => {
    if (status === item.status) return;
    setBusyItemId(item.id);
    const result = await callTripAction('updateItem', {
      itemId: item.id,
      status,
    });
    if (result) onTripUpdate(result);
    setBusyItemId(null);
  };

  // TABI 3.0：itemType==='restaurant'の項目を、Meals（B/L/D）欄に割り当てる。
  // 'none'を渡すと割り当てを解除する。
  const handleSetMealSlot = async (
    item: TripItem,
    mealSlot: 'breakfast' | 'lunch' | 'dinner' | 'none'
  ) => {
    setBusyItemId(item.id);
    const result = await callTripAction('updateItem', {
      itemId: item.id,
      mealSlot,
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
  const existingDayNumbers = Array.from(
    new Set(items.filter((i) => i.planLevel !== 'saved').map((i) => i.day || 1))
  ).sort((a, b) => a - b);
  // 日を選ぶ選択肢：既存の日＋「次の新しい日」を1つ追加しておく
  const dayChoices = [...existingDayNumbers, (existingDayNumbers[existingDayNumbers.length - 1] || 0) + 1];

  const renderItemRow = (item: TripItem) => {
    const visited = visitedItemIds.has(item.id);
    const busy = busyItemId === item.id;
    const expanded = expandedItemId === item.id;

    return (
      <div
        key={item.id}
        className="bg-background-50 border border-background-200 rounded-lg overflow-hidden"
      >
        <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <i
              className={`${ITEM_TYPE_ICON[item.itemType]} text-foreground-400 flex-shrink-0`}
              title={item.itemType}
            ></i>
            {item.time && (
              <span className="text-xs text-foreground-500 whitespace-nowrap font-semibold">
                {item.time}
              </span>
            )}
            <span className="text-sm text-foreground-900 truncate">{item.title}</span>
            <select
              value={item.status}
              onChange={(e) => handleSetStatus(item, e.target.value as ItemStatus)}
              disabled={busy || isTraveling}
              title="Fixed = booked, can't change. Planned = tentative. Option = one of a few choices."
              className={`text-xs font-semibold pl-2 pr-1 py-0.5 rounded-full whitespace-nowrap cursor-pointer disabled:opacity-50 border-0 focus:outline-none focus:ring-1 focus:ring-primary-400 ${STATUS_COLORS[item.status]}`}
            >
              {(Object.keys(STATUS_LABELS) as ItemStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
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
            {!isTraveling && (
              <button
                onClick={() => setExpandedItemId(expanded ? null : item.id)}
                disabled={busy}
                className="text-xs font-semibold text-foreground-600 hover:text-foreground-900 whitespace-nowrap cursor-pointer disabled:opacity-50 px-2 py-1 flex items-center gap-1"
              >
                {item.planLevel === 'saved' && 'Assign day'}
                {item.planLevel === 'day_assigned' && 'Add time'}
                {item.planLevel === 'scheduled' && 'Edit'}
                <i className={`text-sm ${expanded ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'}`}></i>
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

        {/* 展開時：画面内蔵のドロップダウン・入力欄（prompt()は使わない） */}
        {expanded && !isTraveling && (
          <div className="px-3.5 pb-3 pt-1 border-t border-background-200 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-foreground-500">
              Day
              <select
                value={item.day || ''}
                onChange={(e) => handleAssignDay(item, Number(e.target.value))}
                disabled={busy}
                className="bg-background-100 border border-background-200 rounded-md px-2 py-1.5 text-sm text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400 cursor-pointer"
              >
                <option value="" disabled>
                  Choose a day
                </option>
                {dayChoices.map((d) => (
                  <option key={d} value={d}>
                    Day {d}
                    {!existingDayNumbers.includes(d) ? ' (new)' : ''}
                  </option>
                ))}
              </select>
            </label>

            {(item.planLevel === 'day_assigned' || item.planLevel === 'scheduled') && (
              <label className="flex items-center gap-2 text-xs text-foreground-500">
                Time
                <input
                  type="time"
                  value={item.time || ''}
                  onChange={(e) => handleSetTime(item, e.target.value)}
                  disabled={busy}
                  className="bg-background-100 border border-background-200 rounded-md px-2 py-1.5 text-sm text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </label>
            )}

            {item.planLevel === 'scheduled' && (
              <button
                onClick={() => handleMakeFlexible(item)}
                disabled={busy}
                className="text-xs font-semibold text-foreground-500 hover:text-foreground-800 whitespace-nowrap cursor-pointer underline"
              >
                Make this day flexible (remove time)
              </button>
            )}

            {item.itemType === 'restaurant' && (
              <label className="flex items-center gap-2 text-xs text-foreground-500">
                Meal
                <select
                  value={item.mealSlot || 'none'}
                  onChange={(e) =>
                    handleSetMealSlot(
                      item,
                      e.target.value as 'breakfast' | 'lunch' | 'dinner' | 'none'
                    )
                  }
                  disabled={busy}
                  title="Show this in the Meals (B/L/D) column instead of the Schedule column"
                  className="bg-background-100 border border-background-200 rounded-md px-2 py-1.5 text-sm text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400 cursor-pointer"
                >
                  <option value="none">Not a meal</option>
                  <option value="breakfast">Breakfast</option>
                  <option value="lunch">Lunch</option>
                  <option value="dinner">Dinner</option>
                </select>
              </label>
            )}
          </div>
        )}
      </div>
    );
  };

  // 「Saved for Trip」用のカード表示。まだ日程未定のSPOTは、リストの1行ではなく
  // 写真＋概要のカードとして見せることで、「どこを保存したか」がひと目で分かるようにする。
  // imageUrl/descriptionを持たない古いItem（この変更より前に追加されたもの）は、
  // アイコンのプレースホルダーと概要非表示のフォールバック表示にする。
  const renderSavedItemCard = (item: TripItem) => {
    const busy = busyItemId === item.id;
    const expanded = expandedItemId === item.id;

    return (
      <div
        key={item.id}
        className="bg-background-50 border border-background-200 rounded-lg overflow-hidden"
      >
        <div className="flex gap-3 p-3">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.title}
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-md object-cover flex-shrink-0 bg-background-200"
            />
          ) : (
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-md bg-background-200 flex items-center justify-center flex-shrink-0">
              <i
                className={`${ITEM_TYPE_ICON[item.itemType]} text-foreground-400 text-xl`}
                title={item.itemType}
              ></i>
            </div>
          )}

          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-semibold text-foreground-900 line-clamp-1">
                {item.title}
              </span>
              <button
                onClick={() => handleRemove(item)}
                disabled={busy}
                className="w-6 h-6 flex items-center justify-center text-foreground-300 hover:text-red-500 transition-colors cursor-pointer disabled:opacity-50 flex-shrink-0"
                aria-label="Remove"
              >
                <i className="ri-close-line"></i>
              </button>
            </div>

            {item.description ? (
              <p className="text-xs text-foreground-500 line-clamp-2 mt-0.5">{item.description}</p>
            ) : (
              <p className="text-xs text-foreground-300 italic mt-0.5">No description available</p>
            )}

            <div className="flex items-center gap-2 mt-auto pt-2 flex-wrap">
              <select
                value={item.status}
                onChange={(e) => handleSetStatus(item, e.target.value as ItemStatus)}
                disabled={busy || isTraveling}
                title="Fixed = booked, can't change. Planned = tentative. Option = one of a few choices."
                className={`text-xs font-semibold pl-2 pr-1 py-0.5 rounded-full whitespace-nowrap cursor-pointer disabled:opacity-50 border-0 focus:outline-none focus:ring-1 focus:ring-primary-400 ${STATUS_COLORS[item.status]}`}
              >
                {(Object.keys(STATUS_LABELS) as ItemStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
              {!isTraveling && (
                <button
                  onClick={() => setExpandedItemId(expanded ? null : item.id)}
                  disabled={busy}
                  className="text-xs font-semibold text-primary-600 hover:text-primary-700 whitespace-nowrap cursor-pointer disabled:opacity-50 flex items-center gap-1"
                >
                  Assign day
                  <i className={`text-sm ${expanded ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'}`}></i>
                </button>
              )}
            </div>
          </div>
        </div>

        {expanded && !isTraveling && (
          <div className="px-3 pb-3 pt-1 border-t border-background-200 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-foreground-500">
              Day
              <select
                value=""
                onChange={(e) => handleAssignDay(item, Number(e.target.value))}
                disabled={busy}
                className="bg-background-100 border border-background-200 rounded-md px-2 py-1.5 text-sm text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400 cursor-pointer"
              >
                <option value="" disabled>
                  Choose a day
                </option>
                {dayChoices.map((d) => (
                  <option key={d} value={d}>
                    Day {d}
                    {!existingDayNumbers.includes(d) ? ' (new)' : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mt-6 pt-6 border-t border-background-200">
      <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
        <h3 className="font-heading font-bold text-sm text-foreground-900">Trip Planner</h3>
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

      {!isTraveling && (
        <p className="text-foreground-400 text-xs mb-4">
          Add places below, then tap a place to assign it to a day and (optionally) a time.
          The status dropdown (Fixed / Planned / Option) shows how certain each plan is —
          Fixed means booked and can't change, Option means it's one of a few choices.
        </p>
      )}

      {error && <p className="text-red-500 text-xs mb-3">{error}</p>}

      {/* Saved for Trip（まだ日程未定）：写真＋概要のカード形式 */}
      {savedItems.length > 0 && (
        <div className="mb-5">
          <span className="block text-xs font-semibold text-foreground-500 uppercase tracking-wide mb-2">
            Saved for Trip
          </span>
          <div className="space-y-2">{savedItems.map(renderSavedItemCard)}</div>
        </div>
      )}

      {/* Day毎の表示 */}
      {existingDayNumbers.map((dayNum) => {
        const dayItems = items
          .filter((i) => i.planLevel !== 'saved' && (i.day || 1) === dayNum)
          .sort((a, b) => {
            if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
            if (a.order !== undefined) return -1;
            if (b.order !== undefined) return 1;
            return (a.time || '').localeCompare(b.time || '');
          });
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
          <select
            value={newItemType}
            onChange={(e) => setNewItemType(e.target.value as TripItem['itemType'])}
            title="Category — pick Restaurant / Café if you'll want to assign it to a meal (B/L/D) later"
            className="bg-background-50 border border-background-200 rounded-md px-2 py-2 text-sm text-foreground-700 focus:outline-none focus:ring-2 focus:ring-primary-400 cursor-pointer flex-shrink-0"
          >
            <option value="sightseeing">Sightseeing</option>
            <option value="restaurant">Restaurant / Café</option>
            <option value="shopping">Shopping</option>
            <option value="accommodation">Accommodation</option>
            <option value="activity">Activity</option>
            <option value="transport">Transport</option>
            <option value="other">Other</option>
          </select>
          <input
            type="text"
            value={newItemTitle}
            onChange={(e) => setNewItemTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddItem();
              }
            }}
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
