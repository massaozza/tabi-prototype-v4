import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Navbar from '@/components/feature/Navbar';
import Footer from '@/components/feature/Footer';
import { useAuth } from '@/context/AuthContext';
import PhotoUploader from '@/pages/experiences/new/components/PhotoUploader';

const MAX_BODY_LENGTH = 3000;
const MAX_SPOTS = 20;

interface Destination {
  id: string;
  title: string;
  category: string;
  description: string;
  image: string;
}

interface Spot {
  key: number;
  spotId?: string;
  name: string;
  commentJa: string;
  localTip: string;
  bestTime: string;
  priceHint: string;
}

const inputClass =
  'w-full bg-background-50 border border-background-200 rounded-md px-4 py-3 text-sm text-foreground-900 placeholder:text-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400 transition-all';

export default function NewGuidePage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const [submitted, setSubmitted] = useState(false);

  const [title, setTitle] = useState('');
  const [theme, setTheme] = useState('');
  const [area, setArea] = useState('');
  const [season, setSeason] = useState('');
  const [expertise, setExpertise] = useState('');
  const [bodyJa, setBodyJa] = useState('');

  const [spots, setSpots] = useState<Spot[]>([
    {
      key: 0,
      name: '',
      commentJa: '',
      localTip: '',
      bestTime: '',
      priceHint: '',
    },
  ]);

  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [photosUploading, setPhotosUploading] = useState(false);
  const [uploaderKey, setUploaderKey] = useState(0);

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [spotKeyCounter, setSpotKeyCounter] = useState(1);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login', { replace: true });
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    let cancelled = false;
    async function fetchDestinations() {
      try {
        const res = await fetch('/api/content?type=destinations');
        if (res.ok) {
          const json = await res.json();
          if (!cancelled && Array.isArray(json.data)) {
            setDestinations(json.data as Destination[]);
          }
        }
      } catch {
        // オートコンプリートが無くても投稿は可能
      }
    }
    fetchDestinations();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [submitted]);

  if (loading) {
    return (
      <main className="min-h-screen bg-background-50">
        <Navbar />
        <div className="flex items-center justify-center py-40">
          <div className="text-foreground-500 text-sm">Loading...</div>
        </div>
        <Footer />
      </main>
    );
  }

  if (!user) {
    return null;
  }

  const addSpot = () => {
    if (spots.length >= MAX_SPOTS) return;
    const nextKey = spotKeyCounter;
    setSpotKeyCounter((k) => k + 1);
    setSpots((prev) => [
      ...prev,
      {
        key: nextKey,
        name: '',
        commentJa: '',
        localTip: '',
        bestTime: '',
        priceHint: '',
      },
    ]);
  };

  const removeSpot = (key: number) => {
    setSpots((prev) => (prev.length > 1 ? prev.filter((s) => s.key !== key) : prev));
  };

  const updateSpot = (key: number, field: keyof Spot, value: string) => {
    setSpots((prev) => prev.map((s) => (s.key === key ? { ...s, [field]: value } : s)));
  };

  const handleSpotNameChange = (key: number, value: string) => {
    const matched = destinations.find((d) => d.title.toLowerCase() === value.trim().toLowerCase());
    setSpots((prev) =>
      prev.map((s) =>
        s.key === key ? { ...s, name: value, spotId: matched ? matched.id : undefined } : s
      )
    );
  };

  const hasNamedSpot = spots.some((s) => s.name.trim() !== '');

  const requiredFilled =
    title.trim() !== '' &&
    theme.trim() !== '' &&
    area.trim() !== '' &&
    bodyJa.trim() !== '' &&
    hasNamedSpot;

  const canSubmit = requiredFilled && !photosUploading;

  const buildPayload = () => ({
    authorName: user.displayName,
    authorExpertiseArea: expertise.trim(),
    title: title.trim(),
    theme: theme.trim(),
    area: area.trim(),
    season: season.trim(),
    bodyJa: bodyJa.trim(),
    spots: spots
      .filter((s) => s.name.trim() !== '')
      .map((s) => ({
        ...(s.spotId ? { spotId: s.spotId } : {}),
        name: s.name.trim(),
        commentJa: s.commentJa.trim(),
        localTip: s.localTip.trim(),
        bestTime: s.bestTime.trim(),
        priceHint: s.priceHint.trim(),
      })),
    photos: photoUrls,
  });

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError('');
    setSubmitting(true);
    try {
      const payload = buildPayload();

      const res = await fetch('/api/guides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setSubmitted(true);
      } else {
        setError(data.error || '投稿に失敗しました。もう一度お試しください。');
      }
    } catch {
      setError('ネットワークエラーが発生しました。もう一度お試しください。');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setTheme('');
    setArea('');
    setSeason('');
    setExpertise('');
    setBodyJa('');
    setSpots([
      {
        key: 0,
        name: '',
        commentJa: '',
        localTip: '',
        bestTime: '',
        priceHint: '',
      },
    ]);
    setSpotKeyCounter(1);
    setPhotoUrls([]);
    setPhotosUploading(false);
    setError('');
    setSubmitting(false);
    setUploaderKey((k) => k + 1);
    setSubmitted(false);
  };

  return (
    <main className="min-h-screen bg-background-50">
      <Navbar />

      {/* Page Header */}
      <section className="bg-background-900 pt-24 md:pt-28 pb-16 md:pb-20 px-6 md:px-10">
        <div className="max-w-[960px] mx-auto text-center">
          <nav
            className="flex items-center justify-center gap-2 text-white/50 text-xs mb-6 flex-wrap"
            aria-label="Breadcrumb"
          >
            <a href="/" className="hover:text-white/80 transition-colors cursor-pointer whitespace-nowrap">
              Home
            </a>
            <span className="text-white/30">/</span>
            <span className="text-white whitespace-nowrap">Share your Japan</span>
          </nav>
          <h1 className="font-heading font-bold text-3xl md:text-4xl text-white mt-3 leading-tight">
            日本のことを、世界へ届けよう
          </h1>
          <p className="text-white/60 text-sm md:text-base mt-3 max-w-md mx-auto">
            日本語で書くだけで大丈夫。AIが英語に翻訳し、訪日旅行者に届けます。
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-16 md:py-20 px-6 md:px-10">
        <div className="max-w-2xl mx-auto">
          {/* Step: Form */}
          <div
            className={`bg-background-50 border border-background-200 rounded-lg p-6 md:p-10 ${
              submitted ? 'hidden' : ''
            }`}
          >
            <form onSubmit={handleSubmit} className="space-y-8">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* 基本情報 */}
              <div className="space-y-5">
                <h4 className="font-heading font-semibold text-base text-foreground-900">
                  基本情報
                </h4>

                <div>
                  <label
                    htmlFor="title"
                    className="block font-heading font-semibold text-sm text-foreground-700 mb-2"
                  >
                    タイトル <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="title"
                    name="title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="例：地元民が選ぶ鎌倉の朝ごはん"
                    required
                    className={inputClass}
                  />
                </div>

                <div>
                  <label
                    htmlFor="theme"
                    className="block font-heading font-semibold text-sm text-foreground-700 mb-2"
                  >
                    テーマ <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="theme"
                    name="theme"
                    type="text"
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    placeholder="例：朝ごはん、雨の日の過ごし方"
                    required
                    className={inputClass}
                  />
                </div>

                <div>
                  <label
                    htmlFor="area"
                    className="block font-heading font-semibold text-sm text-foreground-700 mb-2"
                  >
                    エリア <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="area"
                    name="area"
                    type="text"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder="例：鎌倉、北海道"
                    required
                    className={inputClass}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label
                      htmlFor="season"
                      className="block font-heading font-semibold text-sm text-foreground-700 mb-2"
                    >
                      季節
                    </label>
                    <input
                      id="season"
                      name="season"
                      type="text"
                      value={season}
                      onChange={(e) => setSeason(e.target.value)}
                      placeholder="例：春、桜の季節"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="expertise"
                      className="block font-heading font-semibold text-sm text-foreground-700 mb-2"
                    >
                      あなたの専門性
                    </label>
                    <input
                      id="expertise"
                      name="expertise"
                      type="text"
                      value={expertise}
                      onChange={(e) => setExpertise(e.target.value)}
                      placeholder="例：鎌倉在住15年"
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>

              {/* 本文 */}
              <div className="pt-6 border-t border-background-200">
                <div className="flex items-center justify-between mb-2">
                  <label
                    htmlFor="bodyJa"
                    className="block font-heading font-semibold text-sm text-foreground-700"
                  >
                    本文・日本語 <span className="text-red-500">*</span>
                  </label>
                  <span className="text-xs text-foreground-400">
                    {bodyJa.length} / {MAX_BODY_LENGTH}
                  </span>
                </div>
                <textarea
                  id="bodyJa"
                  name="bodyJa"
                  value={bodyJa}
                  onChange={(e) => setBodyJa(e.target.value)}
                  placeholder="おすすめの理由や、実際の体験を自由に書いてください。"
                  required
                  maxLength={MAX_BODY_LENGTH}
                  rows={8}
                  className={`${inputClass} resize-y`}
                />
              </div>

              {/* 紹介するスポット */}
              <div className="pt-6 border-t border-background-200">
                <div className="flex items-center justify-between mb-5">
                  <h4 className="font-heading font-semibold text-base text-foreground-900">
                    紹介するスポット <span className="text-red-500">*</span>
                  </h4>
                  <span className="text-xs text-foreground-400">
                    {spots.length} / {MAX_SPOTS}
                  </span>
                </div>

                <datalist id="spot-name-options">
                  {destinations.map((d) => (
                    <option key={d.id} value={d.title} />
                  ))}
                </datalist>

                <div className="space-y-6">
                  {spots.map((spot, index) => (
                    <div
                      key={spot.key}
                      className="bg-background-50 border border-background-200 rounded-md p-5"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <span className="font-heading font-semibold text-sm text-foreground-900">
                          スポット {index + 1}
                        </span>
                        {spots.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeSpot(spot.key)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-600 transition-colors whitespace-nowrap cursor-pointer"
                          >
                            <i className="ri-delete-bin-line"></i>
                            削除
                          </button>
                        )}
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label
                            htmlFor={`spot-name-${spot.key}`}
                            className="block font-heading font-semibold text-sm text-foreground-700 mb-2"
                          >
                            スポット名 <span className="text-red-500">*</span>
                          </label>
                          <input
                            id={`spot-name-${spot.key}`}
                            name={`spot-name-${spot.key}`}
                            type="text"
                            list="spot-name-options"
                            value={spot.name}
                            onChange={(e) => handleSpotNameChange(spot.key, e.target.value)}
                            placeholder="例：鶴岡八幡宮"
                            className={inputClass}
                          />
                        </div>

                        <div>
                          <label
                            htmlFor={`spot-comment-${spot.key}`}
                            className="block font-heading font-semibold text-sm text-foreground-700 mb-2"
                          >
                            コメント
                          </label>
                          <textarea
                            id={`spot-comment-${spot.key}`}
                            name={`spot-comment-${spot.key}`}
                            value={spot.commentJa}
                            onChange={(e) => updateSpot(spot.key, 'commentJa', e.target.value)}
                            placeholder="このスポットの魅力を教えてください。"
                            rows={3}
                            className={`${inputClass} resize-y`}
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                            <label
                              htmlFor={`spot-tip-${spot.key}`}
                              className="block font-heading font-semibold text-sm text-foreground-700 mb-2"
                            >
                              Local Tip
                            </label>
                            <input
                              id={`spot-tip-${spot.key}`}
                              name={`spot-tip-${spot.key}`}
                              type="text"
                              value={spot.localTip}
                              onChange={(e) => updateSpot(spot.key, 'localTip', e.target.value)}
                              placeholder="地元ならではの豆知識"
                              className={inputClass}
                            />
                          </div>

                          <div>
                            <label
                              htmlFor={`spot-time-${spot.key}`}
                              className="block font-heading font-semibold text-sm text-foreground-700 mb-2"
                            >
                              おすすめの時間帯
                            </label>
                            <input
                              id={`spot-time-${spot.key}`}
                              name={`spot-time-${spot.key}`}
                              type="text"
                              value={spot.bestTime}
                              onChange={(e) => updateSpot(spot.key, 'bestTime', e.target.value)}
                              placeholder="例：朝7時、夕方"
                              className={inputClass}
                            />
                          </div>

                          <div>
                            <label
                              htmlFor={`spot-price-${spot.key}`}
                              className="block font-heading font-semibold text-sm text-foreground-700 mb-2"
                            >
                              価格感
                            </label>
                            <input
                              id={`spot-price-${spot.key}`}
                              name={`spot-price-${spot.key}`}
                              type="text"
                              value={spot.priceHint}
                              onChange={(e) => updateSpot(spot.key, 'priceHint', e.target.value)}
                              placeholder="例：¥1,000前後"
                              className={inputClass}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {spots.length < MAX_SPOTS && (
                  <button
                    type="button"
                    onClick={addSpot}
                    className="mt-5 w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-md border-2 border-dashed border-background-300 text-foreground-600 font-semibold text-sm hover:border-primary-400 hover:text-primary-500 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <i className="ri-add-line text-base"></i>
                    スポットを追加
                  </button>
                )}
              </div>

              {/* 写真 */}
              <div className="pt-6 border-t border-background-200">
                <label
                  htmlFor="guide-photos"
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

              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full bg-primary-500 hover:bg-primary-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm px-6 py-3 rounded-md transition-all duration-200 whitespace-nowrap cursor-pointer"
              >
                {photosUploading ? '写真をアップロード中...' : submitting ? '投稿中...' : '投稿する'}
              </button>
            </form>
          </div>

          {/* Step: Success */}
          {submitted && (
            <div className="bg-background-50 border border-background-200 rounded-lg p-10 md:p-14 text-center">
              <div className="w-16 h-16 mx-auto flex items-center justify-center rounded-full bg-accent-100 text-accent-600">
                <i className="ri-checkbox-circle-line text-4xl"></i>
              </div>
              <h2 className="font-heading font-bold text-2xl md:text-3xl text-foreground-900 mt-6">
                投稿ありがとうございます！
              </h2>
              <p className="text-sm text-foreground-500 mt-3 max-w-sm mx-auto">
                あなたのGuideは、AIによる英語への翻訳処理を経て、世界中の旅行者に届けられます。
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mt-8 justify-center">
                <button
                  type="button"
                  onClick={resetForm}
                  className="w-full sm:w-auto px-6 py-3 rounded-md border border-background-300 text-foreground-700 font-semibold text-sm hover:bg-background-100 transition-colors duration-200 whitespace-nowrap cursor-pointer"
                >
                  もう1件投稿する
                </button>
                <Link
                  to="/guides"
                  className="w-full sm:w-auto bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm px-6 py-3 rounded-md transition-all duration-200 whitespace-nowrap cursor-pointer inline-flex items-center justify-center"
                >
                  Guide一覧を見る
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
}
