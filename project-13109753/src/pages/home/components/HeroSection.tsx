import { useTranslation } from 'react-i18next';

export default function HeroSection() {
  const { t } = useTranslation();

  return (
    <section className="relative w-full h-[600px] md:h-[700px] flex items-center overflow-hidden">
      <img
        src="https://readdy.ai/api/search-image?query=Stunning%20Japanese%20landscape%20with%20Mount%20Fuji%20in%20the%20distance%20visible%20across%20a%20calm%20ocean%20bay%2C%20traditional%20wooden%20temple%20roof%20silhouette%20in%20foreground%2C%20golden%20hour%20warm%20sunlight%20washing%20over%20the%20scene%2C%20cherry%20blossom%20branches%20framing%20the%20edges%2C%20soft%20atmospheric%20haze%2C%20moody%20and%20inviting%20travel%20photography%20aesthetic&width=1600&height=900&seq=hero-japan-01&orientation=landscape"
        alt="Discover Japan beyond the guidebooks — TABI"
        title="TABI — Discover Japan Beyond the Guidebooks"
        className="absolute inset-0 w-full h-full object-cover object-top"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/35 to-black/55"></div>

      <div className="relative z-10 w-full px-6 md:px-10 lg:px-20">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-10">
          <div className="flex-1 max-w-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex -space-x-2">
                <div className="w-9 h-9 rounded-full border-2 border-white/60 overflow-hidden">
                  <img src="https://readdy.ai/api/search-image?query=Friendly%20traveler%20portrait%20young%20Asian%20woman%20smiling%2C%20clean%20white%20background%2C%20professional%20headshot%20style%2C%20natural%20lighting&width=72&height=72&seq=avatar-01&orientation=squarish" alt="" className="w-full h-full object-cover" />
                </div>
                <div className="w-9 h-9 rounded-full border-2 border-white/60 overflow-hidden">
                  <img src="https://readdy.ai/api/search-image?query=Friendly%20male%20traveler%20portrait%20European%20man%20smiling%2C%20clean%20white%20background%2C%20professional%20headshot%20style%2C%20natural%20lighting&width=72&height=72&seq=avatar-02&orientation=squarish" alt="" className="w-full h-full object-cover" />
                </div>
                <div className="w-9 h-9 rounded-full border-2 border-white/60 overflow-hidden">
                  <img src="https://readdy.ai/api/search-image?query=Friendly%20female%20traveler%20portrait%20young%20woman%20with%20glasses%20smiling%2C%20clean%20white%20background%2C%20professional%20headshot%20style%2C%20natural%20lighting&width=72&height=72&seq=avatar-03&orientation=squarish" alt="" className="w-full h-full object-cover" />
                </div>
              </div>
              <span className="text-white/90 text-sm">Join curious travelers discovering deeper Japan</span>
            </div>

            <h2 className="font-heading font-bold text-4xl md:text-6xl lg:text-7xl text-white leading-tight mb-6">
              Japan<br className="hidden sm:block" /> Starts Here.
            </h2>

            <p className="text-white/85 text-base md:text-lg leading-relaxed max-w-xl mb-8">
              Find the places locals love.<br />
              Go beyond the guidebook.<br />
              Your Japan starts here.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <a
                href="#destinations"
                className="inline-flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm px-8 py-3.5 rounded-md transition-all duration-200 whitespace-nowrap cursor-pointer"
              >
                Start Exploring
                <i className="ri-arrow-right-line"></i>
              </a>
              {/* "Plan My Trip" button temporarily removed — target #budget-calculator is hidden (2026.08) */}
              {/* <a
                href="#budget-calculator"
                className="inline-flex items-center justify-center gap-2 border-2 border-white/80 text-white hover:bg-white/10 font-semibold text-sm px-8 py-3.5 rounded-md transition-all duration-200 whitespace-nowrap cursor-pointer"
              >
                Plan My Trip
                <i className="ri-calendar-line"></i>
              </a> */}
            </div>

            <p className="text-white/50 text-xs tracking-[0.2em] uppercase font-semibold">
              Beyond Sightseeing.
            </p>
          </div>

          {/* Trip Budget Estimator widget temporarily hidden (2026.08) */}
          {/* <div className="lg:w-80 bg-white/10 backdrop-blur-md rounded-xl p-5 border border-white/20">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-accent-500/80 flex items-center justify-center">
                <i className="ri-calculator-line text-white text-sm"></i>
              </div>
              <span className="text-white font-heading font-semibold text-sm">Trip Budget Estimator</span>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-white/70 text-xs block mb-1">Travelers</label>
                <select className="w-full bg-white/15 border border-white/20 rounded-md px-3 py-2 text-sm text-white cursor-pointer">
                  <option className="text-foreground-900">1 person</option>
                  <option className="text-foreground-900">2 people</option>
                  <option className="text-foreground-900">3-4 people</option>
                  <option className="text-foreground-900">5+ people</option>
                </select>
              </div>
              <div>
                <label className="text-white/70 text-xs block mb-1">Days</label>
                <select className="w-full bg-white/15 border border-white/20 rounded-md px-3 py-2 text-sm text-white cursor-pointer">
                  <option className="text-foreground-900">1 day trip</option>
                  <option className="text-foreground-900">2-3 days</option>
                  <option className="text-foreground-900">4-7 days</option>
                  <option className="text-foreground-900">1 week+</option>
                </select>
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-white/70 text-xs">Estimated</span>
                <span className="text-white font-heading font-bold text-lg">¥15,000-25,000</span>
              </div>
              <a
                href="#budget-calculator"
                className="block w-full text-center bg-accent-500 hover:bg-accent-600 text-white font-semibold text-sm py-2.5 rounded-md transition-all duration-200 whitespace-nowrap cursor-pointer"
              >
                Calculate Full Budget
              </a>
              <p className="text-white/50 text-[11px] text-center mt-3">
                Demo preview — live calculator coming soon
              </p>
            </div>
          </div> */}
        </div>
      </div>
    </section>
  );
}