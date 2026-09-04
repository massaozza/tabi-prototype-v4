import { useTranslation } from 'react-i18next';

const featureImages = [
  'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=600&q=80',
  'https://images.unsplash.com/photo-1480796927426-f609979314bd?w=600&q=80',
  'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=600&q=80',
];

export default function FeaturesSection() {
  const { t } = useTranslation();

  const features = [
    { icon: 'ri-map-pin-user-line', title: t('feat1_title', 'All 47 Prefectures'), description: t('feat1_desc', 'From Hokkaido to Okinawa — real local knowledge across all of Japan, not just the tourist hotspots.') },
    { icon: 'ri-compass-3-line', title: t('feat2_title', 'Real Voices'), description: t('feat2_desc', 'Every tip, route and review comes from people who actually went there — Japanese locals and fellow travelers.') },
    { icon: 'ri-heart-line', title: t('feat3_title', 'Plan Your Way with AI'), description: t('feat3_desc', 'Tell TABI AI what you love. It finds the right spots, builds your itinerary and explains why each choice fits you.') },
  ];

  return (
    <section id="features" className="py-16 md:py-24 px-6 md:px-10 lg:px-20 bg-background-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between mb-12">
          <div>
            <span className="inline-block text-xs font-semibold tracking-widest uppercase text-accent-600 mb-3">
              {t('feat_label', 'Our Philosophy')}
            </span>
            <h2 className="font-heading font-bold text-3xl md:text-5xl text-foreground-900 leading-tight">
              {t('feat_title', 'Why TABI47')}
            </h2>
          </div>
          <p className="text-foreground-500 text-base mt-4 lg:mt-0 lg:max-w-sm">
            {t('feat_subtitle', "We're not just another travel site — we're the bridge between Japan's 47 prefectures and the travelers who want to experience them like locals do.")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {features.map((feat, idx) => (
            <div key={feat.title} className="bg-background-100 rounded-xl overflow-hidden transition-all duration-300 hover:-translate-y-1">
              <div className="relative w-full h-48 overflow-hidden">
                <img src={featureImages[idx]} alt={feat.title} title={`${feat.title} — TABI47`} className="w-full h-full object-cover object-top" />
              </div>
              <div className="p-6">
                <div className="w-11 h-11 rounded-lg bg-accent-100 flex items-center justify-center mb-4">
                  <i className={`${feat.icon} text-accent-600 text-xl`}></i>
                </div>
                <h3 className="font-heading font-bold text-lg text-foreground-900 mb-2">{feat.title}</h3>
                <p className="text-foreground-600 text-sm leading-relaxed">{feat.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
