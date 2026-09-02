import { features } from '@/mocks/homeData';

const featureImages = [
  'https://readdy.ai/api/search-image?query=Japanese%20local%20guide%20pointing%20at%20a%20paper%20map%20in%20a%20traditional%20narrow%20street%20Kamakura%2C%20authentic%20travel%20moment%2C%20warm%20natural%20light%2C%20documentary%20photography%20style%2C%20clean%20minimalist%20composition&width=600&height=400&seq=feature-local-01&orientation=landscape',
  'https://readdy.ai/api/search-image?query=Remote%20Japanese%20coastal%20hiking%20trail%20with%20nobody%20around%2C%20wild%20ocean%20cliffs%20and%20green%20vegetation%2C%20dramatic%20natural%20scenery%20off%20the%20tourist%20path%2C%20adventure%20travel%20photography%20with%20soft%20golden%20light&width=600&height=400&seq=feature-beyond-03&orientation=landscape',
  'https://readdy.ai/api/search-image?query=Traveler%20sitting%20quietly%20at%20traditional%20Japanese%20tatami%20room%20overlooking%20zen%20garden%2C%20deep%20contemplative%20moment%2C%20soft%20natural%20light%20through%20shoji%20screens%2C%20peaceful%20and%20meaningful%20travel%20experience%20photography&width=600&height=400&seq=feature-deeper-04&orientation=landscape',
];

export default function FeaturesSection() {
  return (
    <section id="features" className="py-16 md:py-24 px-6 md:px-10 lg:px-20 bg-background-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between mb-12">
          <div>
            <span className="inline-block text-xs font-semibold tracking-widest uppercase text-accent-600 mb-3">
              Our Philosophy
            </span>
            <h2 className="font-heading font-bold text-3xl md:text-5xl text-foreground-900 leading-tight">
              Why TABI47
            </h2>
          </div>
          <p className="text-foreground-500 text-base mt-4 lg:mt-0 lg:max-w-sm">
            We're not just another travel site — we're the bridge between Japan's 47 prefectures and the travelers who want to experience them like locals do.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {features.map((feat, idx) => (
            <div
              key={feat.title}
              className="bg-background-100 rounded-xl overflow-hidden transition-all duration-300 hover:-translate-y-1"
            >
              <div className="relative w-full h-48 overflow-hidden">
                <img
                  src={featureImages[idx]}
                  alt={feat.title}
                  title={`${feat.title} — TABI47`}
                  className="w-full h-full object-cover object-top"
                />
              </div>
              <div className="p-6">
                <div className="w-11 h-11 rounded-lg bg-accent-100 flex items-center justify-center mb-4">
                  <i className={`${feat.icon} text-accent-600 text-xl`}></i>
                </div>
                <h3 className="font-heading font-bold text-lg text-foreground-900 mb-2">
                  {feat.title}
                </h3>
                <p className="text-foreground-600 text-sm leading-relaxed">
                  {feat.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}