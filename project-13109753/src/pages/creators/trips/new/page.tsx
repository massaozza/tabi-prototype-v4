import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import CreatorNavbar from '@/components/feature/CreatorNavbar';
import Footer from '@/components/feature/Footer';
import { useAuth } from '@/context/AuthContext';
import { destinations as fallbackDestinations } from '@/mocks/homeData';

// TABI 3.0：日本人クリエイターが、AIチャットを使わずに「手動で・簡単に」
// おすすめ旅程（Recommended Trip）を作れるようにするためのフォーム。
//
// 【設計方針】旅程は本来、宿泊・食事・時刻等、細かく作り込むと複雑になるが、
// クリエイターにとっての本質は「どの順番で、どこを巡ってほしいか」だけで
// 十分価値がある。そのため、あえて「1日ごとに、訪れるスポットを並べる」
// という最小構成にし、作成のハードルを下げている。

interface SpotOption {
  id: string;
  title: string;
}

interface SpotEntry {
  name: string;
  spotId?: string;
  note: string;
}

interface DayDraft {
  spots: SpotEntry[];
}

const STYLE_TAGS = [
  'Solo', 'Couple', 'Family', 'Friends',
  'Culture', 'Food', 'Nature', 'Shopping',
  'Budget', 'Mid-range', 'Luxury',
  'Active', 'Relaxed',
];

function emptySpot(): SpotEntry {
  return { name: '', spotId: undefined, note: '' };
}

function emptyDay(): DayDraft {
  return { spots: [emptySpot()] };
}

const inputClass =
  'w-full bg-background-50 border border-background-200 rounded-md px-3.5 py-2.5 text-sm text-foreground-900 placeholder:text-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400 transition-all';

export default function NewRecommendedTripPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [days, setDays] = useState<DayDraft[]>([emptyDay()]);
  const [highlights, setHighlights] = useState<string[]>(['', '', '']);
  const [tags, setTags] = useState<string[]>([]);
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [spotOptions, setSpotOptions] = useState<SpotOption[]>(fallbackDestinations);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login', { replace: true });
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    let cancelled = false;
    async function fetchSpots() {
      try {
        const res = await fetch('/api/content?type=destinations');
        if (!res.ok) throw new Error('failed');
        const json = await res.json();
        if (!cancelled && Array.isArray(json.data)) {
          setSpotOptions(json.data);
        }
      } catch {
        // フォールバック（homeData.tsの静的データ）のまま
      }
    }
    fetchSpots();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || !user) {
    return null;
  }

  const updateSpot = (dayIndex: number, spotIndex: number, patch: Partial<SpotEntry>) => {
    setDays((prev) =>
      prev.map((d, di) =>
        di !== dayIndex
          ? d
          : { spots: d.spots.map((s, si) => (si === spotIndex ? { ...s, ...patch } : s)) }
      )
    );
  };

  const addSpot = (dayIndex: number) => {
    setDays((prev) =>
      prev.map((d, di) => (di !== dayIndex ? d : { spots: [...d.spots, emptySpot()] }))
    );
  };

  const removeSpot = (dayIndex: number, spotIndex: number) => {
    setDays((prev) =>
      prev.map((d, di) =>
        di !== dayIndex
          ? d
          : { spots: d.spots.length > 1 ? d.spots.filter((_, si) => si !== spotIndex) : d.spots }
      )
    );
  };

  const addDay = () => setDays((prev) => [...prev, emptyDay()]);
  const removeDay = (dayIndex: number) =>
    setDays((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== dayIndex) : prev));

  const canSubmit =
    title.trim() !== '' &&
    days.some((d) => d.spots.some((s) => s.name.trim() !== '')) &&
    !submitting;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');

    const builtDays = days.map((d, idx) => ({
      day: idx + 1,
      activities: d.spots
        .filter((s) => s.name.trim() !== '')
        .map((s) => ({
          type: 'activity' as const,
          title: s.name.trim(),
          description: s.note.trim() || undefined,
          spotId: s.spotId,
        })),
      meals: {},
    }));

    try {
      const res = await fetch('/api/trips', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          summary: summary.trim(),
          days: builtDays,
          stays: [],
          tripType: 'recommended',
          highlights: highlights.map((h) => h.trim()).filter(Boolean),
          tags,
          budgetMin: budgetMin ? parseInt(budgetMin, 10) : undefined,
          budgetMax: budgetMax ? parseInt(budgetMax, 10) : undefined,
          authorName: authorName.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || '保存に失敗しました');
      }
      navigate('/creators/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました。もう一度お試しください。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-background-50">
      <CreatorNavbar />

      <section className="bg-foreground-900 pt-12 pb-10 px-6 md:px-10">
        <div className="max-w-2xl mx-auto text-center">
          <span className="inline-block text-xs font-semibold tracking-widest uppercase text-accent-400 mb-3">
            旅程を作る
          </span>
          <h1 className="font-heading font-bold text-2xl md:text-3xl text-white leading-tight mb-3">
            おすすめの旅程を、手動で作成
          </h1>
          <p className="text-white/60 text-sm max-w-md mx-auto leading-relaxed">
            各日、訪れてほしいスポットを順番に並べるだけで、旅程が作れます。
            実際に旅行していなくても、おすすめとして公開できます。
          </p>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('tabi:open-chat'))}
            className="inline-flex items-center gap-1.5 text-accent-300 hover:text-accent-200 text-xs font-semibold mt-4 transition-colors cursor-pointer"
          >
            <i className="ri-chat-3-line"></i>
            AIと相談しながら作りたい方はこちら
          </button>
        </div>
      </section>

      <section className="py-10 px-6 md:px-10">
        <div className="max-w-2xl mx-auto">
          <div className="bg-background-50 border border-background-200 rounded-xl p-6 md:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div>
                <label className="block font-heading font-semibold text-sm text-foreground-700 mb-2">
                  タイトル <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例：初めての京都、外せない2日間"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block font-heading font-semibold text-sm text-foreground-700 mb-2">
                  概要（任意）
                </label>
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={2}
                  placeholder="この旅程がどんな人におすすめか、簡単に書いてください"
                  className={`${inputClass} resize-none`}
                />
              </div>

              {/* ハイライト（英語・最大3点） */}
              <div>
                <label className="block font-heading font-semibold text-sm text-foreground-700 mb-1">
                  ハイライト（英語・最大3点）
                </label>
                <p className="text-xs text-foreground-400 mb-2">
                  カードに表示する見どころを英語で。例：Sunrise hike at Fushimi Inari
                </p>
                <div className="space-y-2">
                  {highlights.map((h, i) => (
                    <input
                      key={i}
                      type="text"
                      value={h}
                      onChange={(e) =>
                        setHighlights((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))
                      }
                      placeholder={`ハイライト ${i + 1}`}
                      className={inputClass}
                    />
                  ))}
                </div>
              </div>

              {/* 旅行スタイルタグ */}
              <div>
                <label className="block font-heading font-semibold text-sm text-foreground-700 mb-2">
                  旅行スタイル（複数選択可）
                </label>
                <div className="flex flex-wrap gap-2">
                  {STYLE_TAGS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() =>
                        setTags((prev) =>
                          prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
                        )
                      }
                      className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors cursor-pointer ${
                        tags.includes(tag)
                          ? 'bg-primary-600 text-white border-primary-600'
                          : 'bg-background-50 text-foreground-600 border-background-200 hover:border-primary-300'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* 予算目安 */}
              <div>
                <label className="block font-heading font-semibold text-sm text-foreground-700 mb-1">
                  予算目安（1人あたり・円）
                </label>
                <p className="text-xs text-foreground-400 mb-2">例：最低8000円〜最高15000円/日</p>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={budgetMin}
                    onChange={(e) => setBudgetMin(e.target.value)}
                    placeholder="最低額（例：8000）"
                    className={inputClass}
                    min={0}
                  />
                  <span className="text-foreground-400 flex-shrink-0">〜</span>
                  <input
                    type="number"
                    value={budgetMax}
                    onChange={(e) => setBudgetMax(e.target.value)}
                    placeholder="最高額（例：15000）"
                    className={inputClass}
                    min={0}
                  />
                </div>
              </div>

              {/* Creator表示名 */}
              <div>
                <label className="block font-heading font-semibold text-sm text-foreground-700 mb-1">
                  表示名（英語）
                </label>
                <p className="text-xs text-foreground-400 mb-2">
                  カードに表示されます。例：Keiko · Kyoto local
                </p>
                <input
                  type="text"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="例：Keiko · Kyoto local"
                  className={inputClass}
                />
              </div>

              <div className="space-y-5">
                {days.map((day, dayIndex) => (
                  <div
                    key={dayIndex}
                    className="bg-background-100 border border-background-200 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-heading font-bold text-sm text-foreground-900">
                        {dayIndex + 1}日目
                      </h3>
                      {days.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeDay(dayIndex)}
                          className="text-xs text-red-500 hover:text-red-600 transition-colors cursor-pointer"
                        >
                          この日を削除
                        </button>
                      )}
                    </div>

                    <div className="space-y-2.5">
                      {day.spots.map((spot, spotIndex) => (
                        <div key={spotIndex} className="flex items-start gap-2">
                          <span className="text-foreground-400 text-xs mt-2.5 w-5 text-right flex-shrink-0">
                            {spotIndex + 1}
                          </span>
                          <div className="flex-1 space-y-1.5">
                            <input
                              type="text"
                              list={`spot-options-${dayIndex}-${spotIndex}`}
                              value={spot.name}
                              onChange={(e) => {
                                const matched = spotOptions.find(
                                  (o) => o.title === e.target.value
                                );
                                updateSpot(dayIndex, spotIndex, {
                                  name: e.target.value,
                                  spotId: matched?.id,
                                });
                              }}
                              placeholder="訪れるスポット名（例：清水寺）"
                              className={`${inputClass} text-sm`}
                            />
                            <datalist id={`spot-options-${dayIndex}-${spotIndex}`}>
                              {spotOptions.map((o) => (
                                <option key={o.id} value={o.title} />
                              ))}
                            </datalist>
                            <input
                              type="text"
                              value={spot.note}
                              onChange={(e) =>
                                updateSpot(dayIndex, spotIndex, { note: e.target.value })
                              }
                              placeholder="一言メモ（任意：例：朝一番の参拝がおすすめ）"
                              className={`${inputClass} text-xs`}
                            />
                          </div>
                          {day.spots.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeSpot(dayIndex, spotIndex)}
                              className="text-foreground-300 hover:text-red-500 mt-2.5 transition-colors cursor-pointer"
                              aria-label="削除"
                            >
                              <i className="ri-close-line"></i>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => addSpot(dayIndex)}
                      className="text-xs font-semibold text-primary-500 hover:text-primary-600 mt-3 transition-colors cursor-pointer"
                    >
                      + スポットを追加
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addDay}
                className="w-full border-2 border-dashed border-background-300 hover:border-primary-300 text-foreground-500 hover:text-primary-600 font-semibold text-sm py-3 rounded-lg transition-colors cursor-pointer"
              >
                <i className="ri-add-line mr-1"></i>
                日を追加する
              </button>

              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm py-3.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                {submitting ? '保存中...' : '旅程を保存する'}
              </button>
            </form>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
