import { useState } from 'react';

export default function ExperienceForm() {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const params = new URLSearchParams();
    formData.forEach((value, key) => params.append(key, value.toString()));

    const btn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
    const originalText = btn?.textContent;
    if (btn) { btn.textContent = 'Sending...'; btn.disabled = true; }

    try {
      const res = await fetch('https://readdy.ai/api/form/d8lmiptk31rj0i4c6tpg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      if (res.ok) {
        setSubmitted(true);
        setError(false);
        form.reset();
      } else {
        setError(true);
        if (btn) { btn.textContent = originalText; btn.disabled = false; }
      }
    } catch {
      setError(true);
      if (btn) { btn.textContent = originalText; btn.disabled = false; }
    }
  };

  return (
    <section className="px-6 md:px-10 lg:px-20 bg-background-50">
      <div className="max-w-[860px] mx-auto">
        <div className="bg-background-100 rounded-xl p-6 md:p-10">
          <h2 className="font-heading font-bold text-xl md:text-2xl text-foreground-900 mb-2">
            Have You Been Here?
          </h2>
          <p className="text-foreground-500 text-sm md:text-base mb-8 max-w-lg">
            Share your experience and help other travelers discover the real Japan.
          </p>

          {submitted ? (
            <div className="bg-primary-50 border border-primary-200 rounded-lg p-5 text-center">
              <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-3">
                <i className="ri-check-line text-primary-500 text-xl"></i>
              </div>
              <p className="text-foreground-800 font-semibold text-sm mb-1">Thank you for sharing!</p>
              <p className="text-foreground-500 text-xs">Your experience helps fellow travelers discover the real Japan.</p>
            </div>
          ) : (
            <form
              data-readdy-form=""
              method="POST"
              action="https://readdy.ai/api/form/d8lmiptk31rj0i4c6tpg"
              onSubmit={handleSubmit}
              className="space-y-5"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="exp-name" className="block text-foreground-700 text-xs font-semibold mb-1.5">
                    Your Name <span className="text-foreground-400 font-normal">(optional)</span>
                  </label>
                  <input
                    id="exp-name"
                    name="name"
                    type="text"
                    className="w-full bg-background-50 border border-background-200 rounded-md px-4 py-2.5 text-sm text-foreground-800 placeholder:text-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label htmlFor="exp-location" className="block text-foreground-700 text-xs font-semibold mb-1.5">
                    Where did you go?
                  </label>
                  <input
                    id="exp-location"
                    name="location"
                    type="text"
                    required
                    className="w-full bg-background-50 border border-background-200 rounded-md px-4 py-2.5 text-sm text-foreground-800 placeholder:text-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all"
                    placeholder="e.g. Kamakura, Kyoto, Osaka"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="exp-why" className="block text-foreground-700 text-xs font-semibold mb-1.5">
                  Why do you love this place?
                </label>
                <textarea
                  id="exp-why"
                  name="why_love"
                  rows={3}
                  required
                  maxLength={500}
                  className="w-full bg-background-50 border border-background-200 rounded-md px-4 py-2.5 text-sm text-foreground-800 placeholder:text-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all resize-none"
                  placeholder="Tell us what makes this place special..."
                />
              </div>

              <div>
                <label htmlFor="exp-who" className="block text-foreground-700 text-xs font-semibold mb-1.5">
                  Who would you bring here?
                </label>
                <input
                  id="exp-who"
                  name="who_bring"
                  type="text"
                  className="w-full bg-background-50 border border-background-200 rounded-md px-4 py-2.5 text-sm text-foreground-800 placeholder:text-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all"
                  placeholder="e.g. My partner, best friend, family"
                />
              </div>

              <div>
                <label htmlFor="exp-memory" className="block text-foreground-700 text-xs font-semibold mb-1.5">
                  What moment do you remember most?
                </label>
                <textarea
                  id="exp-memory"
                  name="favorite_memory"
                  rows={3}
                  maxLength={500}
                  className="w-full bg-background-50 border border-background-200 rounded-md px-4 py-2.5 text-sm text-foreground-800 placeholder:text-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all resize-none"
                  placeholder="Describe a moment that stayed with you..."
                />
              </div>

              <div>
                <label htmlFor="exp-photo" className="block text-foreground-700 text-xs font-semibold mb-1.5">
                  Upload a Photo <span className="text-foreground-400 font-normal">(optional)</span>
                </label>
                <input
                  id="exp-photo"
                  name="photo"
                  type="file"
                  accept="image/*"
                  className="w-full text-sm text-foreground-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-600 hover:file:bg-primary-100 file:cursor-pointer file:transition-colors"
                />
              </div>

              {error && (
                <p className="text-red-500 text-xs">Something went wrong. Please try again.</p>
              )}

              <div className="bg-background-50 border border-background-200 rounded-md px-4 py-3 text-center">
                <p className="text-foreground-500 text-xs">
                  We&apos;re upgrading this feature — submissions will reopen soon
                </p>
              </div>

              <button
                type="submit"
                disabled
                className="flex items-center justify-center gap-2 bg-primary-500 text-white font-semibold text-sm px-6 py-3 rounded-md transition-all duration-200 whitespace-nowrap cursor-not-allowed w-full sm:w-auto opacity-50"
              >
                Share My Experience
                <i className="ri-send-plane-line"></i>
              </button>

              <p className="text-foreground-400 text-[11px] leading-relaxed">
                By submitting, you agree to our Terms of Use. We may feature your experience on TABI.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
