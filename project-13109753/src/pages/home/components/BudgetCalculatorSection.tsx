export default function BudgetCalculatorSection() {
  return (
    <section id="budget-calculator" className="relative py-16 md:py-24 bg-primary-500 overflow-hidden">
      <div className="absolute inset-0 opacity-10">
        <img
          src="https://readdy.ai/api/search-image?query=Japanese%20wave%20pattern%20seigaiha%20style%20in%20light%20blue%20tones%2C%20repeating%20geometric%20ocean%20wave%20motif%2C%20subtle%20textured%20background%2C%20minimalist%20Japanese%20design%20aesthetic&width=1600&height=600&seq=budget-bg-pattern&orientation=landscape"
          alt=""
          className="w-full h-full object-cover"
        />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 md:px-10 text-center">
        <span className="inline-block text-xs font-semibold tracking-widest uppercase text-white/70 mb-3">
          Travel Planning Tool
        </span>
        <h2 className="font-heading font-bold text-3xl md:text-5xl text-white leading-tight mb-4">
          Plan Your Kamakura Day Trip Budget
        </h2>
        <p className="text-white/80 text-base md:text-lg max-w-2xl mx-auto mb-10">
          Calculate transport, food &amp; activities in seconds — no spreadsheets needed
        </p>

        <div className="bg-background-50 rounded-2xl p-6 md:p-10 text-left max-w-2xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
            <div>
              <label className="text-foreground-600 text-xs font-semibold block mb-1.5 uppercase tracking-wide">
                Starting Point
              </label>
              <select className="w-full bg-background-100 border border-background-300 rounded-lg px-4 py-3 text-sm text-foreground-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-300 transition-all">
                <option>Tokyo Station</option>
                <option>Shinjuku</option>
                <option>Shibuya</option>
                <option>Yokohama</option>
                <option>Shinagawa</option>
              </select>
            </div>
            <div>
              <label className="text-foreground-600 text-xs font-semibold block mb-1.5 uppercase tracking-wide">
                Travel Style
              </label>
              <select className="w-full bg-background-100 border border-background-300 rounded-lg px-4 py-3 text-sm text-foreground-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-300 transition-all">
                <option>Budget-friendly</option>
                <option>Mid-range comfort</option>
                <option>Premium experience</option>
              </select>
            </div>
            <div>
              <label className="text-foreground-600 text-xs font-semibold block mb-1.5 uppercase tracking-wide">
                Meals Per Day
              </label>
              <select className="w-full bg-background-100 border border-background-300 rounded-lg px-4 py-3 text-sm text-foreground-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-300 transition-all">
                <option>2 meals</option>
                <option>3 meals</option>
                <option>3 meals + snacks</option>
              </select>
            </div>
            <div>
              <label className="text-foreground-600 text-xs font-semibold block mb-1.5 uppercase tracking-wide">
                Activities
              </label>
              <select className="w-full bg-background-100 border border-background-300 rounded-lg px-4 py-3 text-sm text-foreground-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-300 transition-all">
                <option>1-2 attractions</option>
                <option>3-4 attractions</option>
                <option>5+ attractions</option>
              </select>
            </div>
          </div>

          <div className="bg-primary-50 rounded-xl p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-foreground-600 text-sm">Round-trip Transport</span>
              <span className="text-foreground-900 font-bold">¥2,000</span>
            </div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-foreground-600 text-sm">Food &amp; Drinks</span>
              <span className="text-foreground-900 font-bold">¥4,500</span>
            </div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-foreground-600 text-sm">Activities &amp; Entrance Fees</span>
              <span className="text-foreground-900 font-bold">¥3,000</span>
            </div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-foreground-600 text-sm">Local Transport (Enoden, bus)</span>
              <span className="text-foreground-900 font-bold">¥1,500</span>
            </div>
            <div className="border-t border-primary-100 pt-3 flex items-center justify-between">
              <span className="text-foreground-900 font-heading font-bold text-lg">Total Estimated</span>
              <span className="text-primary-500 font-heading font-bold text-2xl">¥11,000</span>
            </div>
          </div>

          <button className="w-full bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm py-3.5 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap">
            <i className="ri-download-line"></i>
            Download Budget Breakdown
          </button>
          <p className="text-foreground-400 text-xs text-center mt-3">
            Demo preview — live calculator coming soon
          </p>
        </div>
      </div>
    </section>
  );
}