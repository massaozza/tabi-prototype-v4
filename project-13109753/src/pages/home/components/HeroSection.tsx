import { useTranslation } from 'react-i18next';

export default function HeroSection() {
  const { t } = useTranslation();

  const handleOpenChat = () => {
    window.dispatchEvent(new CustomEvent('tabi:open-chat'));
  };

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
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
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
