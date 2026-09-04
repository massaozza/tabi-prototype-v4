import { useLocalizedNavigate } from '@/hooks/useLocalizedNavigate';
import { PREFECTURE_REGIONS } from '@/mocks/prefectureData';

interface RegionImage {
  slug: string;
  image: string;
}

const REGION_IMAGES: RegionImage[] = [
  {
    slug: 'hokkaido',
    image: 'https://readdy.ai/api/search-image?query=Snow-covered%20Hokkaido%20landscape%20with%20rolling%20hills%20and%20farm%20fields%20under%20clear%20winter%20sky%2C%20minimalist%20travel%20photography%20with%20soft%20natural%20light%2C%20muted%20cool%20color%20palette%2C%20clean%20composition%20and%20wide%20open%20space&width=800&height=500&seq=region-hokkaido-01&orientation=landscape',
  },
  {
    slug: 'tohoku',
    image: 'https://readdy.ai/api/search-image?query=Tohoku%20Japan%20mountain%20valley%20with%20rice%20terraces%20and%20misty%20green%20forests%20in%20early%20morning%20light%2C%20rural%20scenery%20with%20traditional%20farmhouses%2C%20minimalist%20travel%20photography%20with%20warm%20natural%20tones%20and%20clean%20composition&width=800&height=500&seq=region-tohoku-01&orientation=landscape',
  },
  {
    slug: 'kanto',
    image: 'https://readdy.ai/api/search-image?query=Tokyo%20Japan%20cityscape%20blending%20modern%20skyscrapers%20with%20traditional%20temple%20rooftops%20and%20cherry%20blossom%20trees%20along%20a%20river%2C%20soft%20golden%20hour%20light%2C%20minimalist%20travel%20photography%20with%20warm%20neutral%20color%20palette%20and%20clean%20composition&width=800&height=500&seq=region-kanto-01&orientation=landscape',
  },
  {
    slug: 'chubu',
    image: 'https://readdy.ai/api/search-image?query=Mount%20Fuji%20and%20the%20Japanese%20Alps%20with%20lake%20reflection%20and%20forested%20foothills%20under%20clear%20blue%20sky%2C%20autumn%20colors%20beginning%20to%20show%2C%20minimalist%20travel%20photography%20with%20soft%20natural%20light%20and%20serene%20composition&width=800&height=500&seq=region-chubu-01&orientation=landscape',
  },
  {
    slug: 'kansai',
    image: 'https://readdy.ai/api/search-image?query=Kyoto%20Japan%20traditional%20temple%20with%20vermillion%20torii%20gates%20and%20stone%20path%20surrounded%20by%20maple%20trees%20in%20warm%20afternoon%20light%2C%20ancient%20wooden%20architecture%2C%20minimalist%20travel%20photography%20with%20rich%20warm%20tones%20and%20clean%20composition&width=800&height=500&seq=region-kansai-01&orientation=landscape',
  },
  {
    slug: 'chugoku',
    image: 'https://readdy.ai/api/search-image?query=Seto%20Inland%20Sea%20coastline%20with%20small%20islands%20scattered%20across%20calm%20blue%20water%20and%20traditional%20fishing%20boats%20near%20shore%2C%20soft%20afternoon%20light%2C%20minimalist%20travel%20photography%20with%20muted%20blue%20and%20warm%20neutral%20color%20palette&width=800&height=500&seq=region-chugoku-01&orientation=landscape',
  },
  {
    slug: 'shikoku',
    image: 'https://readdy.ai/api/search-image?query=Shikoku%20Japan%20rural%20coastal%20village%20with%20small%20harbor%20traditional%20wooden%20houses%20and%20green%20terraced%20hills%20meeting%20the%20sea%2C%20soft%20morning%20mist%2C%20minimalist%20travel%20photography%20with%20natural%20earth%20tones%20and%20peaceful%20composition&width=800&height=500&seq=region-shikoku-01&orientation=landscape',
  },
  {
    slug: 'kyushu-okinawa',
    image: 'https://readdy.ai/api/search-image?query=Okinawa%20Japan%20tropical%20beach%20with%20crystal%20clear%20turquoise%20water%20white%20sand%20and%20lush%20green%20vegetation%20along%20the%20coastline%2C%20palm%20trees%20swaying%20in%20gentle%20breeze%2C%20minimalist%20travel%20photography%20with%20bright%20natural%20light%20and%20vibrant%20yet%20soft%20color%20palette&width=800&height=500&seq=region-kyushu-01&orientation=landscape',
  },
];

export default function JapanMapSection() {
  const navigate = useLocalizedNavigate();

  return (
    <section className="py-16 md:py-24 px-6 md:px-10 lg:px-20 bg-background-100">
      <div className="max-w-5xl mx-auto">
        <div className="mb-10 text-center">
          <span className="inline-block text-xs font-semibold tracking-widest uppercase text-accent-600 mb-3">
            All 47 Prefectures
          </span>
          <h2 className="font-heading font-bold text-3xl md:text-5xl text-foreground-900 leading-tight mb-3">
            Explore Japan <span className="text-primary-500">Region by Region</span>
          </h2>
          <p className="text-foreground-500 text-base max-w-xl mx-auto">
            Select a region to discover its prefectures, local destinations, and hidden experiences.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {PREFECTURE_REGIONS.map((region) => {
            const img = REGION_IMAGES.find((r) => r.slug === region.slug);
            const prefCount = region.prefectures.length;

            return (
              <button
                key={region.slug}
                type="button"
                onClick={() => navigate(`/regions/${region.slug}`)}
                className="group cursor-pointer text-left bg-background-50 rounded-xl border border-background-200 overflow-hidden hover:border-primary-300 hover:shadow-md transition-all duration-200"
              >
                <div className="relative w-full h-44 overflow-hidden">
                  {img && (
                    <img
                      src={img.image}
                      alt={region.region}
                      className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                  <div className="absolute bottom-3 left-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <span className="text-white text-sm font-semibold whitespace-nowrap">
                      Explore {region.region}
                    </span>
                    <i className="ri-arrow-right-line text-white text-sm"></i>
                  </div>
                </div>

                <div className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-heading font-bold text-lg text-foreground-900">
                      {region.region}
                    </h3>
                    <span className="text-xs font-medium text-foreground-400 bg-background-100 px-2.5 py-1 rounded-full whitespace-nowrap">
                      {prefCount} prefecture{prefCount > 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className="text-foreground-600 text-sm leading-relaxed line-clamp-2">
                    {region.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
