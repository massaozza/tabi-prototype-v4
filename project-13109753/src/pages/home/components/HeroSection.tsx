export default function HeroSection() {
  const handleOpenChat = () => {
    window.dispatchEvent(new CustomEvent('tabi:open-chat'));
  };

  return (
    <section className="relative w-full h-[600px] md:h-[700px] flex items-center overflow-hidden">
      {/* 背景画像 — Unsplash（日本の風景、R2移行前のフォールバック） */}
      <img
        src="https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=1600&q=80"
        alt="Discover Japan beyond the guidebooks — TABI47"
        title="TABI47 — Discover Japan Beyond the Guidebooks"
        className="absolute inset-0 w-full h-full object-cover object-center"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/35 to-black/55"></div>

      <div className="relative z-10 w-full px-6 md:px-10 lg:px-20">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="flex -space-x-2">
              {/* アバター — イニシャルフォールバック（Readdy.ai画像は本番で表示されないため） */}
              <div className="w-9 h-9 rounded-full border-2 border-white/60 bg-primary-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">S</div>
              <div className="w-9 h-9 rounded-full border-2 border-white/60 bg-primary-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">M</div>
              <div className="w-9 h-9 rounded-full border-2 border-white/60 bg-primary-800 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">A</div>
            </div>
            <span className="text-white/90 text-sm">Trusted by travelers and locals across Japan</span>
          </div>

          <h2 className="font-heading font-bold text-4xl md:text-6xl lg:text-7xl text-white leading-tight mb-6">
            Discover Japan<br className="hidden sm:block" /> your way.
          </h2>

          <p className="text-white/85 text-base md:text-lg leading-relaxed max-w-xl mx-auto mb-10">
            Powered by AI, real travelers, and the people who know Japan best.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              type="button"
              onClick={handleOpenChat}
              className="inline-flex flex-col items-start gap-1 bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm px-8 py-4 rounded-md transition-all duration-200 whitespace-nowrap cursor-pointer text-left"
            >
              <span className="flex items-center gap-2 text-base">
                <i className="ri-sparkling-2-line"></i>
                Plan with AI
              </span>
              <span className="text-white/80 text-xs font-normal">
                Create a Japan trip made for you
              </span>
            </button>

            <a
              href="#destinations"
              className="inline-flex flex-col items-start gap-1 border-2 border-white/80 text-white hover:bg-white/10 font-semibold text-sm px-8 py-4 rounded-md transition-all duration-200 whitespace-nowrap cursor-pointer text-left"
            >
              <span className="flex items-center gap-2 text-base">
                <i className="ri-compass-3-line"></i>
                Discover Japan
              </span>
              <span className="text-white/70 text-xs font-normal">
                Explore real trips and local knowledge
              </span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
