
import { useAutoT } from '@/hooks/useAutoT';export default function BudgetCalculatorSection() {
  const t = useAutoT();
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
          {t('auto_f1223fbc93', "Travel Planning Tool")}
        </span>
        <h2 className="font-heading font-bold text-3xl md:text-5xl text-white leading-tight mb-4">
          {t('auto_b472278c72', "Plan Your Japan Day Trip Budget")}
        </h2>
        <p className="text-white/80 text-base md:text-lg max-w-2xl mx-auto mb-10">
          {t('auto_445ed8210f', "Calculate transport, food & activities in seconds — no spreadsheets needed")}
        </p>

        <div className="bg-background-50 rounded-2xl p-6 md:p-10 text-left max-w-2xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
            <div>
              <label className="text-foreground-600 text-xs font-semibold block mb-1.5 uppercase tracking-wide">
                {t('auto_2e5fd8d9c5', "Starting Point")}
              </label>
              <select className="w-full bg-background-100 border border-background-300 rounded-lg px-4 py-3 text-sm text-foreground-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-300 transition-all">
                <option>{t('auto_c3c782ca91', "Tokyo Station")}</option>
                <option>{t('auto_d3a28c7656', "Shinjuku")}</option>
                <option>{t('auto_963f2b5db8', "Shibuya")}</option>
                <option>{t('auto_b0bd38d2f5', "Yokohama")}</option>
                <option>{t('auto_9fd423d841', "Shinagawa")}</option>
              </select>
            </div>
            <div>
              <label className="text-foreground-600 text-xs font-semibold block mb-1.5 uppercase tracking-wide">
                {t('auto_0a84fb83b3', "Travel Style")}
              </label>
              <select className="w-full bg-background-100 border border-background-300 rounded-lg px-4 py-3 text-sm text-foreground-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-300 transition-all">
                <option>{t('auto_b6e02823de', "Budget-friendly")}</option>
                <option>{t('auto_39cbfe8f5f', "Mid-range comfort")}</option>
                <option>{t('auto_36ec07de65', "Premium experience")}</option>
              </select>
            </div>
            <div>
              <label className="text-foreground-600 text-xs font-semibold block mb-1.5 uppercase tracking-wide">
                {t('auto_4a3f34e485', "Meals Per Day")}
              </label>
              <select className="w-full bg-background-100 border border-background-300 rounded-lg px-4 py-3 text-sm text-foreground-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-300 transition-all">
                <option>{t('auto_cc512f6cd7', "2 meals")}</option>
                <option>{t('auto_d3aeab5100', "3 meals")}</option>
                <option>{t('auto_874ac2c0ce', "3 meals + snacks")}</option>
              </select>
            </div>
            <div>
              <label className="text-foreground-600 text-xs font-semibold block mb-1.5 uppercase tracking-wide">
                {t('auto_e58f7f8899', "Activities")}
              </label>
              <select className="w-full bg-background-100 border border-background-300 rounded-lg px-4 py-3 text-sm text-foreground-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-300 transition-all">
                <option>{t('auto_f5301b0c31', "1-2 attractions")}</option>
                <option>{t('auto_d5f6d04c45', "3-4 attractions")}</option>
                <option>{t('auto_1b70468619', "5+ attractions")}</option>
              </select>
            </div>
          </div>

          <div className="bg-primary-50 rounded-xl p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-foreground-600 text-sm">{t('auto_9be3931140', "Round-trip Transport")}</span>
              <span className="text-foreground-900 font-bold">¥2,000</span>
            </div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-foreground-600 text-sm">{t('auto_fbad8ac1c6', "Food & Drinks")}</span>
              <span className="text-foreground-900 font-bold">¥4,500</span>
            </div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-foreground-600 text-sm">{t('auto_0ef731dad6', "Activities & Entrance Fees")}</span>
              <span className="text-foreground-900 font-bold">¥3,000</span>
            </div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-foreground-600 text-sm">{t('auto_b8be2d5acb', "Local Transport (Enoden, bus)")}</span>
              <span className="text-foreground-900 font-bold">¥1,500</span>
            </div>
            <div className="border-t border-primary-100 pt-3 flex items-center justify-between">
              <span className="text-foreground-900 font-heading font-bold text-lg">{t('auto_62804e6a3d', "Total Estimated")}</span>
              <span className="text-primary-500 font-heading font-bold text-2xl">¥11,000</span>
            </div>
          </div>

          <button className="w-full bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm py-3.5 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap">
            <i className="ri-download-line"></i>
            {t('auto_4477be6255', "Download Budget Breakdown")}
          </button>
          <p className="text-foreground-400 text-xs text-center mt-3">
            {t('auto_74b8d6e912', "Demo preview — live calculator coming soon")}
          </p>
        </div>
      </div>
    </section>
  );
}
