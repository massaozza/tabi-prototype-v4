import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import CreatorNavbar from '@/components/feature/CreatorNavbar';
import Footer from '@/components/feature/Footer';
import { useAuth } from '@/context/AuthContext';
import PhotoUploader from '@/pages/experiences/new/components/PhotoUploader';
import VideoUploader from '@/pages/experiences/new/components/VideoUploader';
import { destinations as fallbackDestinations } from '@/mocks/homeData';

// TABI 3.0：日本人クリエイター向けの、体験投稿フォーム（日本語版）。
// 既存の /experiences/new（英語・外国人向け）と、ロジック・API呼び出しは
// 完全に同じで、表示文言だけを日本語化している。

const CATEGORY_OPTIONS = [
  { value: 'Temple', label: '寺社' },
  { value: 'Restaurant', label: '飲食店' },
  { value: 'Cafe', label: 'カフェ' },
  { value: 'Nature', label: '自然' },
  { value: 'Activity', label: 'アクティビティ' },
  { value: 'Hotel', label: '宿泊施設' },
  { value: 'Shop', label: 'ショップ' },
  { value: 'Other', label: 'その他' },
];

const TRAVEL_STYLE_OPTIONS = [
  { value: 'Solo', label: '一人旅' },
  { value: 'Couple', label: 'カップル' },
  { value: 'Family with kids', label: '子連れ家族' },
  { value: 'Friends', label: '友人と' },
  { value: 'Business', label: '出張' },
];

const BUDGET_OPTIONS = [
  { value: '', label: '未指定' },
  { value: 'Budget', label: '低め' },
  { value: 'Mid-range', label: '中間' },
  { value: 'Luxury', label: '高め' },
];

const MAX_TEXT_LENGTH = 2000;

type Step = 'form' | 'review' | 'success';

const inputClass =
  'w-full bg-background-50 border border-background-200 rounded-md px-4 py-3 text-sm text-foreground-900 placeholder:text-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400 transition-all';

const selectClass =
  'w-full bg-background-50 border border-background-200 rounded-md px-4 py-3 pr-10 text-sm text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400 transition-all appearance-none cursor-pointer';

function ReviewField({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  if (multiline) {
    return (
      <div className="py-4 border-b border-background-100 last:border-b-0">
        <span className="block font-heading font-semibold text-sm text-foreground-600 mb-1">
          {label}
        </span>
        <p className="text-sm text-foreground-900 whitespace-pre-wrap break-words">{value}</p>
      </div>
    );
  }
  return (
    <div className="flex items-start justify-between gap-6 py-3 border-b border-background-100 last:border-b-0">
      <span className="font-heading font-semibold text-sm text-foreground-600 whitespace-nowrap">
        {label}
      </span>
      <span className="text-sm text-foreground-900 text-right break-words">{value}</span>
    </div>
  );
}

export default function NewExperiencePageJa() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const [step, setStep] = useState<Step>('form');

  const [placeName, setPlaceName] = useState('');
  const [area, setArea] = useState('');
  const [spotId, setSpotId] = useState<string | undefined>(undefined);
  const [spotOptions, setSpotOptions] = useState(fallbackDestinations);

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
  const [category, setCategory] = useState('Temple');
  const [visitedMonth, setVisitedMonth] = useState('');
  const [travelStyle, setTravelStyle] = useState('Solo');
  const [companions, setCompanions] = useState('');
  const [budgetLevel, setBudgetLevel] = useState('');
  const [whatWasGood, setWhatWasGood] = useState('');
  const [whatWasHard, setWhatWasHard] = useState('');
  const [tip, setTip] = useState('');
  const [wouldRecommend, setWouldRecommend] = useState(true);

  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [photosUploading, setPhotosUploading] = useState(false);
  const [videoUrls, setVideoUrls] = useState<string[]>([]);
  const [videosUploading, setVideosUploading] = useState(false);

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploaderKey, setUploaderKey] = useState(0);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login', { replace: true });
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  if (loading) {
    return (
      <main className="min-h-screen bg-background-50">
        <CreatorNavbar />
        <div className="flex items-center justify-center py-40">
          <div className="text-foreground-500 text-sm">読み込み中...</div>
        </div>
        <Footer />
      </main>
    );
  }

  if (!user) {
    return null;
  }

  const requiredFilled =
    placeName.trim() !== '' && visitedMonth !== '' && whatWasGood.trim() !== '';

  const canReview = requiredFilled && !photosUploading && !videosUploading;

  const areaLabel = area.trim();

  const buildPayload = () => ({
    authorName: user.displayName,
    placeName: placeName.trim(),
    area,
    spotId,
    category,
    visitedMonth,
    travelStyle,
    companions: companions.trim(),
    budgetLevel,
    whatWasGood: whatWasGood.trim(),
    whatWasHard: whatWasHard.trim(),
    tip: tip.trim(),
    wouldRecommend,
    photos: photoUrls,
    videos: videoUrls,
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canReview) return;
    setError('');
    setStep('review');
  };

  const handleConfirmPost = async () => {
    setError('');
    setSubmitting(true);
    try {
      const payload = buildPayload();

      const res = await fetch('/api/experiences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setStep('success');
      } else {
        setError(data.error || '投稿に失敗しました。もう一度お試しください。');
      }
    } catch {
      setError('通信エラーが発生しました。もう一度お試しください。');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setPlaceName('');
    setArea('');
    setCategory('Temple');
    setVisitedMonth('');
    setTravelStyle('Solo');
    setCompanions('');
    setBudgetLevel('');
    setWhatWasGood('');
    setWhatWasHard('');
    setTip('');
    setWouldRecommend(true);
    setPhotoUrls([]);
    setVideoUrls([]);
    setPhotosUploading(false);
    setError('');
    setSubmitting(false);
    setUploaderKey((k) => k + 1);
    setStep('form');
  };

  return (
    <main className="min-h-screen bg-background-50">
      <CreatorNavbar />

      {/* Page Header */}
      <section className="bg-background-900 pt-24 md:pt-28 pb-16 md:pb-20 px-6 md:px-10">
        <div className="max-w-[960px] mx-auto text-center">
          <nav
            className="flex items-center justify-center gap-2 text-white/50 text-xs mb-6"
            aria-label="Breadcrumb"
          >
            <a href="/creators" className="hover:text-white/80 transition-colors cursor-pointer">
              ホーム
            </a>
            <span className="text-white/30">/</span>
            <span className="text-white">体験を投稿する</span>
          </nav>
          <h1 className="font-heading font-bold text-3xl md:text-4xl text-white mt-3 leading-tight">
            体験を投稿する
          </h1>
          <p className="text-white/60 text-sm md:text-base mt-3 max-w-md mx-auto">
            実際にどうだったか——良かったこと、大変だったこと、意外だったことを、
            他の旅行者に伝えてください。
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-16 md:py-20 px-6 md:px-10">
        <div className="max-w-2xl mx-auto">
          {/* Step: Form */}
          <div
            className={`bg-background-50 border border-background-200 rounded-lg p-6 md:p-10 ${
              step === 'form' ? '' : 'hidden'
            }`}
          >
            <form onSubmit={handleSubmit} className="space-y-8">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Place */}
              <div className="space-y-5">
                <h4 className="font-heading font-semibold text-base text-foreground-900">
                  場所について
                </h4>
                <div>
                  <label
                    htmlFor="placeName"
                    className="block font-heading font-semibold text-sm text-foreground-700 mb-2"
                  >
                    場所の名前 <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="placeName"
                    name="placeName"
                    type="text"
                    list="spot-options"
                    value={placeName}
                    onChange={(e) => {
                      const matched = spotOptions.find((o) => o.title === e.target.value);
                      setPlaceName(e.target.value);
                      setSpotId(matched?.id);
                    }}
                    placeholder="例：鶴岡八幡宮"
                    required
                    className={inputClass}
                  />
                  <datalist id="spot-options">
                    {spotOptions.map((o) => (
                      <option key={o.id} value={o.title} />
                    ))}
                  </datalist>
                  {spotId && (
                    <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                      <i className="ri-checkbox-circle-fill"></i>
                      TABIの既存SPOTと紐づきました
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label
                      htmlFor="area"
                      className="block font-heading font-semibold text-sm text-foreground-700 mb-2"
                    >
                      エリア
                    </label>
                    <input
                      id="area"
                      name="area"
                      type="text"
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      placeholder="例：鎌倉、神奈川県"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="category"
                      className="block font-heading font-semibold text-sm text-foreground-700 mb-2"
                    >
                      カテゴリ <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        id="category"
                        name="category"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className={selectClass}
                      >
                        {CATEGORY_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400 pointer-events-none"></i>
                    </div>
                  </div>
                </div>
              </div>

              {/* Trip details */}
              <div className="space-y-5 pt-6 border-t border-background-200">
                <h4 className="font-heading font-semibold text-base text-foreground-900">
                  旅について
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label
                      htmlFor="visitedMonth"
                      className="block font-heading font-semibold text-sm text-foreground-700 mb-2"
                    >
                      訪れた年月 <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="visitedMonth"
                      name="visitedMonth"
                      type="month"
                      value={visitedMonth}
                      onChange={(e) => setVisitedMonth(e.target.value)}
                      required
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="travelStyle"
                      className="block font-heading font-semibold text-sm text-foreground-700 mb-2"
                    >
                      旅のスタイル <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        id="travelStyle"
                        name="travelStyle"
                        value={travelStyle}
                        onChange={(e) => setTravelStyle(e.target.value)}
                        className={selectClass}
                      >
                        {TRAVEL_STYLE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400 pointer-events-none"></i>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label
                      htmlFor="companions"
                      className="block font-heading font-semibold text-sm text-foreground-700 mb-2"
                    >
                      同行者
                    </label>
                    <input
                      id="companions"
                      name="companions"
                      type="text"
                      value={companions}
                      onChange={(e) => setCompanions(e.target.value)}
                      placeholder="例：パートナーと子供2人（4歳・7歳）"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="budgetLevel"
                      className="block font-heading font-semibold text-sm text-foreground-700 mb-2"
                    >
                      予算感
                    </label>
                    <div className="relative">
                      <select
                        id="budgetLevel"
                        name="budgetLevel"
                        value={budgetLevel}
                        onChange={(e) => setBudgetLevel(e.target.value)}
                        className={selectClass}
                      >
                        {BUDGET_OPTIONS.map((opt) => (
                          <option key={opt.value || 'empty'} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400 pointer-events-none"></i>
                    </div>
                  </div>
                </div>
              </div>

              {/* Impressions */}
              <div className="space-y-5 pt-6 border-t border-background-200">
                <h4 className="font-heading font-semibold text-base text-foreground-900">
                  感想
                </h4>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label
                      htmlFor="whatWasGood"
                      className="block font-heading font-semibold text-sm text-foreground-700"
                    >
                      良かったこと <span className="text-red-500">*</span>
                    </label>
                    <span className="text-xs text-foreground-400">
                      {whatWasGood.length} / {MAX_TEXT_LENGTH}
                    </span>
                  </div>
                  <textarea
                    id="whatWasGood"
                    name="whatWasGood"
                    value={whatWasGood}
                    onChange={(e) => setWhatWasGood(e.target.value)}
                    placeholder="気に入った点を自由に書いてください..."
                    required
                    maxLength={MAX_TEXT_LENGTH}
                    rows={4}
                    className={`${inputClass} resize-y`}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label
                      htmlFor="whatWasHard"
                      className="block font-heading font-semibold text-sm text-foreground-700"
                    >
                      大変だったこと・意外だったこと
                    </label>
                    <span className="text-xs text-foreground-400">
                      {whatWasHard.length} / {MAX_TEXT_LENGTH}
                    </span>
                  </div>
                  <textarea
                    id="whatWasHard"
                    name="whatWasHard"
                    value={whatWasHard}
                    onChange={(e) => setWhatWasHard(e.target.value)}
                    placeholder="大変だったこと、意外だったこと、知っておくとよいことなど"
                    maxLength={MAX_TEXT_LENGTH}
                    rows={4}
                    className={`${inputClass} resize-y`}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label
                      htmlFor="tip"
                      className="block font-heading font-semibold text-sm text-foreground-700"
                    >
                      他の旅行者へのひとこと
                    </label>
                    <span className="text-xs text-foreground-400">
                      {tip.length} / {MAX_TEXT_LENGTH}
                    </span>
                  </div>
                  <textarea
                    id="tip"
                    name="tip"
                    value={tip}
                    onChange={(e) => setTip(e.target.value)}
                    placeholder="訪れる人がスムーズに楽しめるような、ちょっとしたアドバイス"
                    maxLength={MAX_TEXT_LENGTH}
                    rows={3}
                    className={`${inputClass} resize-y`}
                  />
                </div>
              </div>

              {/* Recommendation */}
              <div className="pt-6 border-t border-background-200">
                <span className="block font-heading font-semibold text-sm text-foreground-700 mb-3">
                  おすすめしますか？
                </span>
                <div className="inline-flex rounded-full bg-background-100 p-1">
                  <button
                    type="button"
                    onClick={() => setWouldRecommend(true)}
                    className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 whitespace-nowrap cursor-pointer ${
                      wouldRecommend
                        ? 'bg-accent-500 text-white'
                        : 'text-foreground-600 hover:text-foreground-900'
                    }`}
                  >
                    はい
                  </button>
                  <button
                    type="button"
                    onClick={() => setWouldRecommend(false)}
                    className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 whitespace-nowrap cursor-pointer ${
                      !wouldRecommend
                        ? 'bg-foreground-700 text-white'
                        : 'text-foreground-600 hover:text-foreground-900'
                    }`}
                  >
                    いいえ
                  </button>
                </div>
              </div>

              {/* Photos */}
              <div className="pt-6 border-t border-background-200">
                <label
                  htmlFor="experience-photos"
                  className="block font-heading font-semibold text-sm text-foreground-700 mb-3"
                >
                  写真
                </label>
                <PhotoUploader
                  key={uploaderKey}
                  onPhotosChange={setPhotoUrls}
                  onUploadingChange={setPhotosUploading}
                />
              </div>

              {/* Videos */}
              <div className="pt-6 border-t border-background-200">
                <label className="block font-heading font-semibold text-sm text-foreground-700 mb-3">
                  動画（任意）
                </label>
                <VideoUploader
                  key={uploaderKey}
                  onVideosChange={setVideoUrls}
                  onUploadingChange={setVideosUploading}
                />
              </div>

              <button
                type="submit"
                disabled={!canReview}
                className="w-full bg-primary-500 hover:bg-primary-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm px-6 py-3 rounded-md transition-all duration-200 whitespace-nowrap cursor-pointer"
              >
                {photosUploading || videosUploading ? 'アップロード中...' : '内容を確認する'}
              </button>
            </form>
          </div>

          {/* Step: Review */}
          {step === 'review' && (
            <div className="bg-background-50 border border-background-200 rounded-lg p-6 md:p-10">
              <h2 className="font-heading font-bold text-2xl text-foreground-900">
                投稿内容の確認
              </h2>
              <p className="text-sm text-foreground-500 mt-2 mb-6">
                投稿する前に、内容をご確認ください。
              </p>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3 text-sm text-red-700 mb-6">
                  {error}
                </div>
              )}

              <div className="bg-background-50 border border-background-200 rounded-md px-5 py-2">
                <ReviewField label="場所の名前" value={placeName.trim()} />
                {areaLabel !== '' && <ReviewField label="エリア" value={areaLabel} />}
                <ReviewField
                  label="カテゴリ"
                  value={CATEGORY_OPTIONS.find((o) => o.value === category)?.label || category}
                />
                <ReviewField label="訪れた年月" value={visitedMonth} />
                <ReviewField
                  label="旅のスタイル"
                  value={
                    TRAVEL_STYLE_OPTIONS.find((o) => o.value === travelStyle)?.label || travelStyle
                  }
                />
                {companions.trim() !== '' && (
                  <ReviewField label="同行者" value={companions.trim()} />
                )}
                {budgetLevel !== '' && (
                  <ReviewField
                    label="予算感"
                    value={BUDGET_OPTIONS.find((o) => o.value === budgetLevel)?.label || budgetLevel}
                  />
                )}
                <ReviewField label="良かったこと" value={whatWasGood.trim()} multiline />
                {whatWasHard.trim() !== '' && (
                  <ReviewField label="大変だったこと" value={whatWasHard.trim()} multiline />
                )}
                {tip.trim() !== '' && <ReviewField label="ひとこと" value={tip.trim()} multiline />}
                <ReviewField label="おすすめしますか？" value={wouldRecommend ? 'はい' : 'いいえ'} />
              </div>

              {photoUrls.length > 0 && (
                <div className="mt-6">
                  <span className="block font-heading font-semibold text-sm text-foreground-700 mb-3">
                    写真（{photoUrls.length}枚）
                  </span>
                  <div className="flex flex-wrap gap-3">
                    {photoUrls.map((url) => (
                      <img
                        key={url}
                        src={url}
                        alt="アップロードした写真"
                        className="w-24 h-24 rounded-md object-cover border border-background-200"
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 mt-8">
                <button
                  type="button"
                  onClick={() => setStep('form')}
                  disabled={submitting}
                  className="w-full sm:w-auto px-6 py-3 rounded-md border border-background-300 text-foreground-700 font-semibold text-sm hover:bg-background-100 transition-colors duration-200 whitespace-nowrap cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  ← 編集する
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPost}
                  disabled={submitting}
                  className="w-full sm:w-auto flex-1 bg-primary-500 hover:bg-primary-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm px-6 py-3 rounded-md transition-all duration-200 whitespace-nowrap cursor-pointer"
                >
                  {submitting ? '投稿中...' : 'この内容で投稿する'}
                </button>
              </div>
            </div>
          )}

          {/* Step: Success */}
          {step === 'success' && (
            <div className="bg-background-50 border border-background-200 rounded-lg p-10 md:p-14 text-center">
              <div className="w-16 h-16 mx-auto flex items-center justify-center rounded-full bg-accent-100 text-accent-600">
                <i className="ri-checkbox-circle-line text-4xl"></i>
              </div>
              <h2 className="font-heading font-bold text-2xl md:text-3xl text-foreground-900 mt-6">
                投稿が完了しました！
              </h2>
              <p className="text-sm text-foreground-500 mt-3 max-w-sm mx-auto">
                あなたの体験を共有していただき、ありがとうございます。
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mt-8 justify-center">
                <button
                  type="button"
                  onClick={resetForm}
                  className="w-full sm:w-auto px-6 py-3 rounded-md border border-background-300 text-foreground-700 font-semibold text-sm hover:bg-background-100 transition-colors duration-200 whitespace-nowrap cursor-pointer"
                >
                  もう1つ投稿する
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/creators')}
                  className="w-full sm:w-auto bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm px-6 py-3 rounded-md transition-all duration-200 whitespace-nowrap cursor-pointer"
                >
                  トップに戻る
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
}
