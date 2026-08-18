export default function BrandPhilosophySection() {
  return (
    <section className="relative w-full py-24 md:py-36 px-6 md:px-10 lg:px-20 bg-background-100 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-foreground-200/40 to-transparent"></div>
        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-foreground-200/40 to-transparent"></div>
      </div>

      <div className="relative w-full max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row lg:items-start lg:gap-20">
          <div className="flex-1 max-w-3xl">
            <div className="flex items-center gap-6 mb-14 md:mb-20">
              <div className="hidden md:block w-12 h-px bg-accent-400"></div>
              <span className="text-xs font-semibold tracking-[0.25em] uppercase text-accent-600">
                Our Philosophy
              </span>
            </div>

            <h2 className="font-heading font-bold text-6xl md:text-8xl lg:text-9xl text-foreground-900 leading-[0.9] mb-10 md:mb-14 tracking-tight">
              Beyond<br />Sightseeing<span className="text-accent-500">.</span>
            </h2>

            <div className="w-20 h-px bg-foreground-300 mb-10 md:mb-14"></div>

            <p className="font-heading font-semibold text-xl md:text-2xl lg:text-3xl text-foreground-800 leading-snug mb-10 max-w-xl">
              Most travelers see Japan. We help you feel it.
            </p>

            <div className="space-y-6 text-base md:text-lg text-foreground-600 leading-relaxed max-w-xl">
              <p>
                The most memorable journeys begin when you slow down, explore deeper, and discover the stories, traditions, people, and moments that guidebooks often miss.
              </p>
              <p>
                At TABI, we believe the real Japan is found beyond sightseeing.
              </p>
            </div>
          </div>

          <div className="hidden lg:block flex-shrink-0 w-72 lg:w-80 mt-10 lg:mt-0">
            <div className="relative">
              <div className="w-full aspect-[3/4] rounded-lg overflow-hidden">
                <img
                  src="https://readdy.ai/api/search-image?query=Abstract%20minimalist%20Japanese%20aesthetic%20composition%20with%20subtle%20ink%20wash%20texture%2C%20soft%20misty%20atmosphere%2C%20delicate%20negative%20space%2C%20warm%20off%20white%20and%20subtle%20charcoal%20tones%2C%20zen%20inspired%20editorial%20art%20photography%2C%20poetic%20quiet%20mood%20with%20natural%20light&width=600&height=800&seq=philosophy-visual-01&orientation=portrait"
                  alt="Beyond Sightseeing"
                  title="Beyond Sightseeing — TABI"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -bottom-4 -left-4 w-24 h-24 border border-foreground-200/50 rounded-lg -z-10 hidden xl:block"></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}