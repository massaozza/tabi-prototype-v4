import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '@/components/feature/Navbar';
import Footer from '@/components/feature/Footer';
import { useAuth } from '@/context/AuthContext';
import PhotoUploader from './components/PhotoUploader';
import VideoUploader from './components/VideoUploader';
import { destinations as fallbackDestinations } from '@/mocks/homeData';
import { useAutoT } from '@/hooks/useAutoT';

const CATEGORY_OPTIONS = [
  'Temple',
  'Restaurant',
  'Cafe',
  'Nature',
  'Activity',
  'Hotel',
  'Shop',
  'Other',
];

const TRAVEL_STYLE_OPTIONS = [
  'Solo',
  'Couple',
  'Family with kids',
  'Friends',
  'Business',
];

const BUDGET_OPTIONS = ['', 'Budget', 'Mid-range', 'Luxury'];

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

export default function NewExperiencePage() {
  const t = useAutoT();
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
        <Navbar />
        <div className="flex items-center justify-center py-40">
          <div className="text-foreground-500 text-sm">{t('auto_b04ba49f84', "Loading...")}</div>
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
        setError(data.error || 'Failed to post your experience. Please try again.');
      }
    } catch {
      setError('Network error. Please try again.');
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
      <Navbar />

      {/* Page Header */}
      <section className="bg-background-900 pt-24 md:pt-28 pb-16 md:pb-20 px-6 md:px-10">
        <div className="max-w-[960px] mx-auto text-center">
          <nav
            className="flex items-center justify-center gap-2 text-white/50 text-xs mb-6"
            aria-label={t('auto_c766e66518', "Breadcrumb")}
          >
            <a href="/" className="hover:text-white/80 transition-colors cursor-pointer">
              {t('auto_70f8bb9a8a', "Home")}
            </a>
            <span className="text-white/30">/</span>
            <span className="text-white">{t('auto_ed45fe1001', "Share Experience")}</span>
          </nav>
          <h1 className="font-heading font-bold text-3xl md:text-4xl text-white mt-3 leading-tight">
            {t('auto_b6d04e43e4', "Share Your Experience")}
          </h1>
          <p className="text-white/60 text-sm md:text-base mt-3 max-w-md mx-auto">
            {t('auto_57a2073714', "Tell fellow travelers what it was really like — the good, the hard, and the unexpected.")}
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
                  {t('auto_c600056ee6', "The Place")}
                </h4>
                <div>
                  <label
                    htmlFor="placeName"
                    className="block font-heading font-semibold text-sm text-foreground-700 mb-2"
                  >
                    {t('auto_93260c48af', "Place Name")}{' '}<span className="text-red-500">*</span>
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
                    placeholder={t('auto_5001184590', "e.g., Tsurugaoka Hachimangu Shrine")}
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
                      {t('auto_5f174c30fb', "Linked to an existing Spot on TABI")}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label
                      htmlFor="area"
                      className="block font-heading font-semibold text-sm text-foreground-700 mb-2"
                    >
                      {t('auto_2745debaa6', "Area")}
                    </label>
                    <input
                      id="area"
                      name="area"
                      type="text"
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      placeholder={t('auto_c126d6ba3d', "e.g., Kamakura, Kanagawa")}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="category"
                      className="block font-heading font-semibold text-sm text-foreground-700 mb-2"
                    >
                      {t('auto_a3c686e711', "Category")}{' '}<span className="text-red-500">*</span>
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
                          <option key={opt} value={opt}>
                            {opt}
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
                  {t('auto_49d325a04c', "Your Trip")}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label
                      htmlFor="visitedMonth"
                      className="block font-heading font-semibold text-sm text-foreground-700 mb-2"
                    >
                      {t('auto_e0381e347a', "Visited Month")}{' '}<span className="text-red-500">*</span>
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
                      {t('auto_0a84fb83b3', "Travel Style")}{' '}<span className="text-red-500">*</span>
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
                          <option key={opt} value={opt}>
                            {opt}
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
                      {t('auto_759f9cdcb4', "Companions")}
                    </label>
                    <input
                      id="companions"
                      name="companions"
                      type="text"
                      value={companions}
                      onChange={(e) => setCompanions(e.target.value)}
                      placeholder={t('auto_e1c717cbc1', "e.g., partner and 2 kids (ages 4, 7)")}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="budgetLevel"
                      className="block font-heading font-semibold text-sm text-foreground-700 mb-2"
                    >
                      {t('auto_e9c10e8cc6', "Budget Level")}
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
                          <option key={opt || 'empty'} value={opt}>
                            {opt || t('auto_60f1e913db', "Not specified")}
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
                  {t('auto_52db6ca9c6', "Your Impressions")}
                </h4>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label
                      htmlFor="whatWasGood"
                      className="block font-heading font-semibold text-sm text-foreground-700"
                    >
                      {t('auto_b14e7ae057', "What was good?")}{' '}<span className="text-red-500">*</span>
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
                    placeholder={t('auto_84d6a8c633', "Share what you loved about it...")}
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
                      {t('auto_8112cd3575', "What was hard? / What surprised you?")}
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
                    placeholder={t('auto_538307f4fe', "Anything difficult, unexpected, or worth knowing?")}
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
                      {t('auto_dd62209a10', "Tip for other travelers")}
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
                    placeholder={t('auto_d8ca5b122b', "A little advice to make their visit smoother...")}
                    maxLength={MAX_TEXT_LENGTH}
                    rows={3}
                    className={`${inputClass} resize-y`}
                  />
                </div>
              </div>

              {/* Recommendation */}
              <div className="pt-6 border-t border-background-200">
                <span className="block font-heading font-semibold text-sm text-foreground-700 mb-3">
                  {t('auto_c4a41a6907', "Would you recommend this?")}
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
                    {t('auto_5397e0583f', "Yes")}
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
                    No
                  </button>
                </div>
              </div>

              {/* Photos */}
              <div className="pt-6 border-t border-background-200">
                <label
                  htmlFor="experience-photos"
                  className="block font-heading font-semibold text-sm text-foreground-700 mb-3"
                >
                  {t('auto_c8b2e864ec', "Photos")}
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
                  {t('auto_c48ac2cd64', "Videos (optional)")}
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
                {photosUploading || videosUploading ? t('auto_070e328ec8', "Uploading...") : t('auto_22506d6ddb', "Review Your Experience")}
              </button>
            </form>
          </div>

          {/* Step: Review */}
          {step === 'review' && (
            <div className="bg-background-50 border border-background-200 rounded-lg p-6 md:p-10">
              <h2 className="font-heading font-bold text-2xl text-foreground-900">
                {t('auto_22506d6ddb', "Review Your Experience")}
              </h2>
              <p className="text-sm text-foreground-500 mt-2 mb-6">
                {t('auto_d0e047e78d', "Please check your details before posting.")}
              </p>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3 text-sm text-red-700 mb-6">
                  {error}
                </div>
              )}

              <div className="bg-background-50 border border-background-200 rounded-md px-5 py-2">
                <ReviewField label={t('auto_93260c48af', "Place Name")} value={placeName.trim()} />
                {areaLabel !== '' && <ReviewField label={t('auto_2745debaa6', "Area")} value={areaLabel} />}
                <ReviewField label={t('auto_a3c686e711', "Category")} value={category} />
                <ReviewField label={t('auto_e0381e347a', "Visited Month")} value={visitedMonth} />
                <ReviewField label={t('auto_0a84fb83b3', "Travel Style")} value={travelStyle} />
                {companions.trim() !== '' && (
                  <ReviewField label={t('auto_759f9cdcb4', "Companions")} value={companions.trim()} />
                )}
                {budgetLevel !== '' && <ReviewField label={t('auto_e9c10e8cc6', "Budget Level")} value={budgetLevel} />}
                <ReviewField label={t('auto_b14e7ae057', "What was good?")} value={whatWasGood.trim()} multiline />
                {whatWasHard.trim() !== '' && (
                  <ReviewField label={t('auto_db8d543c39', "What was hard?")} value={whatWasHard.trim()} multiline />
                )}
                {tip.trim() !== '' && (
                  <ReviewField label={t('auto_d19ceca501', "Tip")} value={tip.trim()} multiline />
                )}
                <ReviewField
                  label={t('auto_24ec09f7c5', "Would you recommend?")}
                  value={wouldRecommend ? t('auto_5397e0583f', "Yes") : t('auto_816c52fd2b', "No")}
                />
              </div>

              {photoUrls.length > 0 && (
                <div className="mt-6">
                  <span className="block font-heading font-semibold text-sm text-foreground-700 mb-3">
                    {t('auto_9d5a0c6035', "Photos (")}{photoUrls.length})
                  </span>
                  <div className="flex flex-wrap gap-3">
                    {photoUrls.map((url) => (
                      <img
                        key={url}
                        src={url}
                        alt={t('auto_766150b78f', "Uploaded photo")}
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
                  {t('auto_da0a6cef02', "← Edit")}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPost}
                  disabled={submitting}
                  className="w-full sm:w-auto flex-1 bg-primary-500 hover:bg-primary-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm px-6 py-3 rounded-md transition-all duration-200 whitespace-nowrap cursor-pointer"
                >
                  {submitting ? t('auto_987e82e939', "Posting...") : t('auto_0c4e07dfdc', "Confirm & Post")}
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
                {t('auto_c590501013', "Your experience has been posted!")}
              </h2>
              <p className="text-sm text-foreground-500 mt-3 max-w-sm mx-auto">
                {t('auto_0a1736ffb0', "Thank you for sharing your experience with other travelers.")}
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mt-8 justify-center">
                <button
                  type="button"
                  onClick={resetForm}
                  className="w-full sm:w-auto px-6 py-3 rounded-md border border-background-300 text-foreground-700 font-semibold text-sm hover:bg-background-100 transition-colors duration-200 whitespace-nowrap cursor-pointer"
                >
                  {t('auto_94ae38f3f8', "Share Another Experience")}
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="w-full sm:w-auto bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm px-6 py-3 rounded-md transition-all duration-200 whitespace-nowrap cursor-pointer"
                >
                  {t('auto_ce7472d6a6', "Back to Home")}
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
