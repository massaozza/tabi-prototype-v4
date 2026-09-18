import { useTranslation } from 'react-i18next';
import {  } from 'react-router-dom';
import { useLocalizedNavigate } from '@/hooks/useLocalizedNavigate';
import { PREFECTURE_REGIONS } from '@/mocks/prefectureData';
import { useAutoT, useAutoText } from '@/hooks/useAutoT';

interface RegionImage {
  slug: string;
  image: string;
}

const REGION_IMAGES: RegionImage[] = [
  {
    slug: 'hokkaido',
    image: 'https://pub-06389d4ab58c4eaf89af8574a94bdc18.r2.dev/destinations/test-c8a4fe27-7c49-4342-be0f-48b578fc6c0c.jpg',
  },
  {
    slug: 'tohoku',
    image: 'https://pub-06389d4ab58c4eaf89af8574a94bdc18.r2.dev/destinations/test-03c089da-8630-4532-b2e5-ca09d239e57f.jpg',
  },
  {
    slug: 'kanto',
    image: 'https://pub-06389d4ab58c4eaf89af8574a94bdc18.r2.dev/destinations/test-f2e3c560-08f7-43a0-9529-372c1e9d58f3.jpg',
  },
  {
    slug: 'chubu',
    image: 'https://pub-06389d4ab58c4eaf89af8574a94bdc18.r2.dev/destinations/test-a98ffc28-1f1b-46f8-a3be-ffa0e007ec87.jpg',
  },
  {
    slug: 'kansai',
    image: 'https://pub-06389d4ab58c4eaf89af8574a94bdc18.r2.dev/destinations/test-8518c5f6-e791-42cc-8178-26e8760e2733.jpg',
  },
  {
    slug: 'chugoku',
    image: 'https://pub-06389d4ab58c4eaf89af8574a94bdc18.r2.dev/destinations/test-4eb3f777-42a1-4f61-81a1-ca88b2e709f4.jpg',
  },
  {
    slug: 'shikoku',
    image: 'https://pub-06389d4ab58c4eaf89af8574a94bdc18.r2.dev/destinations/test-1952d7da-d322-4bd4-931a-f2101077044b.jpg',
  },
  {
    slug: 'kyushu-okinawa',
    image: 'https://pub-06389d4ab58c4eaf89af8574a94bdc18.r2.dev/destinations/test-5880adee-b51b-4e31-8e9c-24cbde419fed.jpg',
  },
];

export default function JapanMapSection() {
  const tx = useAutoText();
  const t = useAutoT();
  const regionSlugs = PREFECTURE_REGIONS.map((r) => r.slug);
  const navigate = useLocalizedNavigate();

  return (
    <section className="py-16 md:py-24 px-6 md:px-10 lg:px-20 bg-background-100">
      <div className="max-w-5xl mx-auto">
        <div className="mb-10 text-center">
          <span className="inline-block text-xs font-semibold tracking-widest uppercase text-accent-600 mb-3">
            {t('auto_bed698a01b', "All 47 Prefectures")}
          </span>
          <h2 className="font-heading font-bold text-3xl md:text-5xl text-foreground-900 leading-tight mb-3">
            {t("map_exploreJapan", "Explore Japan")} <span className="text-primary-500">{t("map_regionByRegion", "Region by Region")}</span>
          </h2>
          <p className="text-foreground-500 text-base max-w-xl mx-auto">
            {t("map_selectRegion", "Select a region to discover its prefectures, local destinations, and hidden experiences.")}
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
                      alt={tx(region.region)}
                      className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                  <div className="absolute bottom-3 left-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <span className="text-white text-sm font-semibold whitespace-nowrap">
                      {t("map_explore", "Explore")} {tx(region.region)}
                    </span>
                    <i className="ri-arrow-right-line text-white text-sm"></i>
                  </div>
                </div>

                <div className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-heading font-bold text-lg text-foreground-900">
                      {tx(region.region)}
                    </h3>
                    <span className="text-xs font-medium text-foreground-400 bg-background-100 px-2.5 py-1 rounded-full whitespace-nowrap">
                      {prefCount}{' '}
                      {prefCount > 1
                        ? t('map_prefectures', 'prefectures')
                        : t('map_prefecture', 'prefecture')}
                    </span>
                  </div>
                  <p className="text-foreground-600 text-sm leading-relaxed line-clamp-2">
                    {tx(region.description)}
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
