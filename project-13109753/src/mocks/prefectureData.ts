// src/mocks/prefectureData.ts
// 47都道府県を、日本の伝統的な8地域区分でグループ化したデータ。
// トップページの日本地図（模式図）や、リージョン一覧ページ（/regions/:slug）で使用する。
//
// 【重要】ここでの説明文は、各地域について広く知られている一般的な事実
// （気候・代表都市・観光の傾向など）に限定している。特定の観光地や店舗名を
// 断定的に紹介するような記述は含めない（未確認情報の誤掲載を避けるため）。

export interface PrefectureRegion {
  slug: string;
  region: string;
  description: string;
  prefectures: string[];
}

export const PREFECTURE_REGIONS: PrefectureRegion[] = [
  {
    slug: 'hokkaido',
    region: 'Hokkaido',
    description:
      "Japan's northernmost island, known for powder snow, national parks, and fresh seafood.",
    prefectures: ['Hokkaido'],
  },
  {
    slug: 'tohoku',
    region: 'Tohoku',
    description:
      'The northeastern region of Honshu, known for hot springs, mountain scenery, and seasonal traditions.',
    prefectures: ['Aomori', 'Iwate', 'Miyagi', 'Akita', 'Yamagata', 'Fukushima'],
  },
  {
    slug: 'kanto',
    region: 'Kanto',
    description:
      'Home to Tokyo and the surrounding prefectures, blending modern city life with historic towns like Kamakura.',
    prefectures: ['Ibaraki', 'Tochigi', 'Gunma', 'Saitama', 'Chiba', 'Tokyo', 'Kanagawa'],
  },
  {
    slug: 'chubu',
    region: 'Chubu',
    description:
      'Central Japan, home to the Japanese Alps, Mt. Fuji, and cities like Nagoya and Kanazawa.',
    prefectures: [
      'Niigata',
      'Toyama',
      'Ishikawa',
      'Fukui',
      'Yamanashi',
      'Nagano',
      'Gifu',
      'Shizuoka',
      'Aichi',
    ],
  },
  {
    slug: 'kansai',
    region: 'Kansai',
    description:
      "The historic heart of Japan, home to Kyoto, Osaka, and Nara's ancient temples and shrines.",
    prefectures: ['Mie', 'Shiga', 'Kyoto', 'Osaka', 'Hyogo', 'Nara', 'Wakayama'],
  },
  {
    slug: 'chugoku',
    region: 'Chugoku',
    description:
      'Western Honshu, home to Hiroshima and the scenic Seto Inland Sea coastline.',
    prefectures: ['Tottori', 'Shimane', 'Okayama', 'Hiroshima', 'Yamaguchi'],
  },
  {
    slug: 'shikoku',
    region: 'Shikoku',
    description:
      "The smallest of Japan's main islands, known for pilgrimage temples and rural coastal scenery.",
    prefectures: ['Tokushima', 'Kagawa', 'Ehime', 'Kochi'],
  },
  {
    slug: 'kyushu-okinawa',
    region: 'Kyushu & Okinawa',
    description:
      "Japan's southern islands, spanning volcanic landscapes in Kyushu to the subtropical beaches of Okinawa.",
    prefectures: [
      'Fukuoka',
      'Saga',
      'Nagasaki',
      'Kumamoto',
      'Oita',
      'Miyazaki',
      'Kagoshima',
      'Okinawa',
    ],
  },
];

export const ALL_PREFECTURES: string[] = PREFECTURE_REGIONS.flatMap((r) => r.prefectures);

export function getRegionBySlug(slug: string): PrefectureRegion | undefined {
  return PREFECTURE_REGIONS.find((r) => r.slug === slug);
}
