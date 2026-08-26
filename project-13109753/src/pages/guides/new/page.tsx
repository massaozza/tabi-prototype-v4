import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '@/components/feature/Navbar';
import Footer from '@/components/feature/Footer';
import PlaceAutocompleteInput from '@/components/feature/PlaceAutocompleteInput';
import { useAuth } from '@/context/AuthContext';
import { destinations as fallbackDestinations } from '@/mocks/homeData';
import PhotoUploader from '@/pages/experiences/new/components/PhotoUploader';

interface SpotOption {
  id: string;
  title: string;
  prefecture?: string;
}

interface GuideSpotDraft {
  spotId?: string;
  googlePlaceId?: string;
  address?: string;
  name: string;
  commentJa: string;
  localTip: string;
  bestTime: string;
  priceHint: string;
}

const inputClass =
  'w-full bg-background-50 border border-background-200 rounded-md px-4 py-3 text-sm text-foreground-900 placeholder:text-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400 transition-all';

const MAX_SPOTS = 20;

function emptySpotDraft(): GuideSpotDraft {
  return {
    spotId: undefined,
    googlePlaceId: undefined,
    address: undefined,
    name: '',
    commentJa: '',
    localTip: '',
    bestTime: '',
    priceHint: '',
  };
}

export default function NewGuidePage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const [title, setTitle] = useState('');
  const [theme, setTheme] = useState('');
  const [area, setArea] = useState('');
  const [season, setSeason] = useState('');
  const [authorExpertiseArea, setAuthorExpertiseArea] = useState('');
  const [bodyJa, setBodyJa] = useState('');
  const [spotDrafts, setSpotDrafts] = useState<GuideSpotDraft[]>([emptySpotDraft()]);
  const [spotOptions, setSpotOptions] = useState<SpotOption[]>(fallbackDestinations);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [photosUploading, setPhotosUploading] = useState(false);

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [uploaderKey, setUploaderKey] = useState(0);

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

  const updateSpotDraft = (index: number, patch: Partial<GuideSpotDraft>) => {
    setSpotDrafts((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const addSpotDraft = () => {
    if (spotDrafts.length >= MAX_SPOTS) return;
    setSpotDrafts((prev) => [...prev, emptySpotDraft()]);
  };

  const removeSpotDraft = (index: number) => {
    setSpotDrafts((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  };

  const validSpots = spotDrafts.filter((s) => s.name.trim() && s.commentJa.trim());

  const requiredFilled =
    title.trim() !== '' &&
    theme.trim() !== '' &&
    area.trim() !== '' &&
    bodyJa.trim() !== '' &&
    validSpots.length > 0;

  const canSubmit = requiredFilled && !photosUploading && !submitting;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError('');
    setSubmitting(true);

    try {
      const payload = {
        authorName: user.displayName,
        authorExpertiseArea: authorExpertiseArea.trim(),
        title: title.trim(),
        theme: theme.trim(),
        area: area.trim(),
        season: season.trim(),
        bodyJa: bodyJa.trim(),
        spots: validSpots.map((s) => ({
          spotId: s.spotId,
          googlePlaceId: s.googlePlaceId,
          address: s.address,
          name: s.name.trim(),
          commentJa: s.commentJa.trim(),
          localTip: s.localTip.trim(),
          bestTime: s.bestTime.trim(),
          priceHint: s.priceHint.trim(),
        })),
        photos: photoUrls,
      };

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
        setError(data.error || 'Guideの投稿に失敗しました。もう一度お試しください。');
      }
    } catch {
      setError('通信エラーが発生しました。もう一度お試しください。');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setTheme('');
    setArea('');
    setSeason('');
    setAuthorExpertiseArea('');
    setBodyJa('');
    setSpotDrafts([emptySpotDraft()]);
    setPhotoUrls([]);
    setPhotosUploading(false);
    setError('');
    setSubmitting(false);
    setSubmitted(false);
    setUploaderKey((k) => k + 1);
  };

  if (submitted) {
    return (
      <main className="min-h-screen bg-background-50">
        <Navbar />
        <section className="py-24 md:py-32 px-6 md:px-10">
          <div className="max-w-lg mx-auto text-center">
            <span className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-6">
              <i className="ri-check-line text-3xl text-primary-500"></i>
            </span>
            <h1 className="font-heading font-bold text-2xl text-foreground-900 mb-3">
              投稿ありがとうございます！
            </h1>
            <p className="text-foreground-500 text-sm mb-8">
              あなたのGuideは、AIによる英語への翻訳処理を経て、世界中の旅行者に届けられます。
              （翻訳が完了しなかった場合、内容の見直しをお願いする場合があります）
            </p>
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-2 bg-background-100 hover:bg-background-200 text-foreground-700 font-semibold text-sm px-6 py-3 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                もう1件投稿する
              </button>
              <a
                href="/guides"
                className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm px-6 py-3 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                Guide一覧を見る
              </a>
            </div>
          </div>
        </section>
        <Footer />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background-50">
      <Navbar />

      <section className="bg-background-900 pt-24 md:pt-28 pb-16 md:pb-20 px-6 md:px-10">
        <div className="max-w-[960px] mx-auto text-center">
          <nav
            className="flex items-center justify-center gap-2 text-white/50 text-xs mb-6"
            aria-label="Breadcrumb"
          >
            <a href="/" className="hover:text-white/80 transition-colors cursor-pointer">
              Home
            </a>
            <span className="text-white/30">/</span>
            <span className="text-white">Share your Japan</span>
          </nav>
          <h1 className="font-heading font-bold text-3xl md:text-4xl text-white mt-3 leading-tight">
            日本のことを、世界へ届けよう
          </h1>
          <p className="text-white/60 text-sm md:text-base mt-3 max-w-md mx-auto">
            日本語で書くだけで大丈夫。AIが英語に翻訳し、訪日旅行者に届けます。
          </p>
        </div>
      </section>

      <section className="py-16 md:py-20 px-6 md:px-10">
        <div className="max-w-2xl mx-auto">
          <div className="bg-background-50 border border-background-200 rounded-lg p-6 md:p-10">
            <form onSubmit={handleSubmit} className="space-y-8">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="space-y-5">
                <h4 className="font-heading font-semibold text-base text-foreground-900">
                  Guideについて
                </h4>
                <div>
                  <label className="block font-heading font-semibold text-sm text-foreground-700 mb-2">
                    タイトル <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="例：地元民が選ぶ鎌倉の朝ごはん"
                    required
                    className={inputClass}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block font-heading font-semibold text-sm text-foreground-700 mb-2">
                      テーマ <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={theme}
                      onChange={(e) => setTheme(e.target.value)}
                      placeholder="例：朝ごはん、雨の日の過ごし方"
                      required
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block font-heading font-semibold text-sm text-foreground-700 mb-2">
                      対象エリア（都道府県・地域名） <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      placeholder="例：湘南、鎌倉、北海道（大まかな地域で構いません）"
                      required
                      className={inputClass}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block font-heading font-semibold text-sm text-foreground-700 mb-2">
                      季節（任意）
                    </label>
                    <input
                      type="text"
                      value={season}
                      onChange={(e) => setSeason(e.target.value)}
                      placeholder="例：桜の季節、冬"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block font-heading font-semibold text-sm text-foreground-700 mb-2">
                      あなたの専門性（任意）
                    </label>
                    <input
                      type="text"
                      value={authorExpertiseArea}
                      onChange={(e) => setAuthorExpertiseArea(e.target.value)}
                      placeholder="例：鎌倉在住15年、雪山ガイド"
                      className={inputClass}
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-heading font-semibold text-sm text-foreground-700 mb-2">
                    本文（日本語） <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={bodyJa}
                    onChange={(e) => setBodyJa(e.target.value)}
                    rows={5}
                    maxLength={3000}
                    placeholder="このGuideで伝えたいことを、日本語で自由に書いてください。"
                    required
                    className={`${inputClass} resize-none`}
                  />
                  <p className="text-xs text-foreground-400 mt-1">{bodyJa.length} / 3000文字</p>
                </div>
              </div>

              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <h4 className="font-heading font-semibold text-base text-foreground-900">
                    紹介するスポット <span className="text-red-500">*</span>
                  </h4>
                  <button
                    type="button"
                    onClick={addSpotDraft}
                    disabled={spotDrafts.length >= MAX_SPOTS}
                    className="text-xs font-semibold text-primary-500 hover:text-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
                  >
                    + スポットを追加
                  </button>
                </div>

                {spotDrafts.map((spot, index) => (
                  <div
                    key={index}
                    className="bg-background-100 border border-background-200 rounded-lg p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground-500">
                        スポット {index + 1}
                      </span>
                      {spotDrafts.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSpotDraft(index)}
                          className="text-xs text-red-500 hover:text-red-600 transition-colors cursor-pointer"
                        >
                          削除
                        </button>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground-600 mb-1.5">
                        具体的なお店・場所の名前
                      </label>
                      <PlaceAutocompleteInput
                        value={spot.name}
                        onChange={(newName) => updateSpotDraft(index, { name: newName })}
                        onPlaceSelected={(place) =>
                          updateSpotDraft(index, {
                            name: place.name,
                            googlePlaceId: place.placeId,
                            address: place.address,
                            spotId: undefined,
                          })
                        }
                        placeholder="例：伊勢屋、鎌倉大仏（候補が出たら選んでください）"
                        className={`${inputClass} text-sm`}
                      />
                      {spot.googlePlaceId && (
                        <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                          <i className="ri-checkbox-circle-fill"></i>
                          Googleマップ上の場所と紐づきました
                          {spot.address ? `（${spot.address}）` : ''}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground-600 mb-1.5">
                        コメント（日本語）
                      </label>
                      <textarea
                        value={spot.commentJa}
                        onChange={(e) => updateSpotDraft(index, { commentJa: e.target.value })}
                        rows={2}
                        placeholder="このスポットについて、短く紹介してください"
                        className={`${inputClass} text-sm resize-none`}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-foreground-600 mb-1.5">
                          Local Tip（任意）
                        </label>
                        <input
                          type="text"
                          value={spot.localTip}
                          onChange={(e) => updateSpotDraft(index, { localTip: e.target.value })}
                          placeholder="地元民ならではのTips"
                          className={`${inputClass} text-sm`}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-foreground-600 mb-1.5">
                          おすすめの時間帯（任意）
                        </label>
                        <input
                          type="text"
                          value={spot.bestTime}
                          onChange={(e) => updateSpotDraft(index, { bestTime: e.target.value })}
                          placeholder="例：平日の午前中"
                          className={`${inputClass} text-sm`}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-foreground-600 mb-1.5">
                          価格感（任意）
                        </label>
                        <input
                          type="text"
                          value={spot.priceHint}
                          onChange={(e) => updateSpotDraft(index, { priceHint: e.target.value })}
                          placeholder="例：¥500程度"
                          className={`${inputClass} text-sm`}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <h4 className="font-heading font-semibold text-base text-foreground-900">
                  写真（任意）
                </h4>
                <PhotoUploader
                  key={uploaderKey}
                  onPhotosChange={setPhotoUrls}
                  onUploadingChange={setPhotosUploading}
                />
              </div>

              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm py-3.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                {submitting ? '投稿中...' : 'Guideを投稿する'}
              </button>
            </form>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
