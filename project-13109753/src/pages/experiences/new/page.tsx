import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '@/components/feature/Navbar';
import Footer from '@/components/feature/Footer';
import { useAuth } from '@/context/AuthContext';
import PhotoUploader from './components/PhotoUploader';

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
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const [step, setStep] = useState<Step>('form');

  const [placeName, setPlaceName] = useState('');
  const [area, setArea] = useState('');
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
          <div className="text-foreground-500 text-sm">Loading...</div>
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

  const canReview = requiredFilled && !photosUploading;

  const areaLabel = area.trim();

  const buildPayload = () => ({
    authorName: user.displayName,
    placeName: placeName.trim(),
    area,
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
            aria-label="Breadcrumb"
          >
            <a href="/" className="hover:text-white/80 transition-colors cursor-pointer">
              Home
            </a>
            <span className="text-white/30">/</span>
            <span className="text-white">Share Experience</span>
          </nav>
          <h1 className="font-heading font-bold text-3xl md:text-4xl text-white mt-3 leading-tight">
            Share Your Experience
          </h1>
          <p className="text-white/60 text-sm md:text-base mt-3 max-w-md mx-auto">
            Tell fellow travelers what it was really like — the good, the hard, and the unexpected.
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
                  The Place
                </h4>
                <div>
                  <label
                    htmlFor="placeName"
                    className="block font-heading font-semibold text-sm text-foreground-700 mb-2"
                  >
                    Place Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="placeName"
                    name="placeName"
                    type="text"
                    value={placeName}
                    onChange={(e) => setPlaceName(e.target.value)}
                    placeholder="e.g., Tsurugaoka Hachimangu Shrine"
                    required
                    className={inputClass}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label
                      htmlFor="area"
                      className="block font-heading font-semibold text-sm text-foreground-700 mb-2"
                    >
                      Area
                    </label>
                    <input
                      id="area"
                      name="area"
                      type="text"
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      placeholder="e.g., Kamakura, Kanagawa"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="category"
                      className="block font-heading font-semibold text-sm text-foreground-700 mb-2"
                    >
                      Category <span className="text-red-500">*</span>
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
                  Your Trip
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label
                      htmlFor="visitedMonth"
                      className="block font-heading font-semibold text-sm text-foreground-700 mb-2"
                    >
                      Visited Month <span className="text-red-500">*</span>
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
                      Travel Style <span className="text-red-500">*</span>
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
                      Companions
                    </label>
                    <input
                      id="companions"
                      name="companions"
                      type="text"
                      value={companions}
                      onChange={(e) => setCompanions(e.target.value)}
                      placeholder="e.g., partner and 2 kids (ages 4, 7)"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="budgetLevel"
                      className="block font-heading font-semibold text-sm text-foreground-700 mb-2"
                    >
                      Budget Level
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
                            {opt || 'Not specified'}
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
                  Your Impressions
                </h4>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label
                      htmlFor="whatWasGood"
                      className="block font-heading font-semibold text-sm text-foreground-700"
                    >
                      What was good? <span className="text-red-500">*</span>
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
                    placeholder="Share what you loved about it..."
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
                      What was hard? / What surprised you?
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
                    placeholder="Anything difficult, unexpected, or worth knowing?"
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
                      Tip for other travelers
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
                    placeholder="A little advice to make their visit smoother..."
                    maxLength={MAX_TEXT_LENGTH}
                    rows={3}
                    className={`${inputClass} resize-y`}
                  />
                </div>
              </div>

              {/* Recommendation */}
              <div className="pt-6 border-t border-background-200">
                <span className="block font-heading font-semibold text-sm text-foreground-700 mb-3">
                  Would you recommend this?
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
                    Yes
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
                  Photos
                </label>
                <PhotoUploader
                  key={uploaderKey}
                  onPhotosChange={setPhotoUrls}
                  onUploadingChange={setPhotosUploading}
                />
              </div>

              <button
                type="submit"
                disabled={!canReview}
                className="w-full bg-primary-500 hover:bg-primary-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm px-6 py-3 rounded-md transition-all duration-200 whitespace-nowrap cursor-pointer"
              >
                {photosUploading ? 'Uploading photos...' : 'Review Your Experience'}
              </button>
            </form>
          </div>

          {/* Step: Review */}
          {step === 'review' && (
            <div className="bg-background-50 border border-background-200 rounded-lg p-6 md:p-10">
              <h2 className="font-heading font-bold text-2xl text-foreground-900">
                Review Your Experience
              </h2>
              <p className="text-sm text-foreground-500 mt-2 mb-6">
                Please check your details before posting.
              </p>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3 text-sm text-red-700 mb-6">
                  {error}
                </div>
              )}

              <div className="bg-background-50 border border-background-200 rounded-md px-5 py-2">
                <ReviewField label="Place Name" value={placeName.trim()} />
                {areaLabel !== '' && <ReviewField label="Area" value={areaLabel} />}
                <ReviewField label="Category" value={category} />
                <ReviewField label="Visited Month" value={visitedMonth} />
                <ReviewField label="Travel Style" value={travelStyle} />
                {companions.trim() !== '' && (
                  <ReviewField label="Companions" value={companions.trim()} />
                )}
                {budgetLevel !== '' && <ReviewField label="Budget Level" value={budgetLevel} />}
                <ReviewField label="What was good?" value={whatWasGood.trim()} multiline />
                {whatWasHard.trim() !== '' && (
                  <ReviewField label="What was hard?" value={whatWasHard.trim()} multiline />
                )}
                {tip.trim() !== '' && (
                  <ReviewField label="Tip" value={tip.trim()} multiline />
                )}
                <ReviewField
                  label="Would you recommend?"
                  value={wouldRecommend ? 'Yes' : 'No'}
                />
              </div>

              {photoUrls.length > 0 && (
                <div className="mt-6">
                  <span className="block font-heading font-semibold text-sm text-foreground-700 mb-3">
                    Photos ({photoUrls.length})
                  </span>
                  <div className="flex flex-wrap gap-3">
                    {photoUrls.map((url) => (
                      <img
                        key={url}
                        src={url}
                        alt="Uploaded photo"
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
                  ← Edit
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPost}
                  disabled={submitting}
                  className="w-full sm:w-auto flex-1 bg-primary-500 hover:bg-primary-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm px-6 py-3 rounded-md transition-all duration-200 whitespace-nowrap cursor-pointer"
                >
                  {submitting ? 'Posting...' : 'Confirm & Post'}
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
                Your experience has been posted!
              </h2>
              <p className="text-sm text-foreground-500 mt-3 max-w-sm mx-auto">
                Thank you for sharing your experience with other travelers.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mt-8 justify-center">
                <button
                  type="button"
                  onClick={resetForm}
                  className="w-full sm:w-auto px-6 py-3 rounded-md border border-background-300 text-foreground-700 font-semibold text-sm hover:bg-background-100 transition-colors duration-200 whitespace-nowrap cursor-pointer"
                >
                  Share Another Experience
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="w-full sm:w-auto bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm px-6 py-3 rounded-md transition-all duration-200 whitespace-nowrap cursor-pointer"
                >
                  Back to Home
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
