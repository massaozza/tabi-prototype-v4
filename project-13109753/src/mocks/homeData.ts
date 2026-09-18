export const navLinks = [
  // TABI 3.0：ナビゲーションの簡素化。「Trips」「Guides」「Spots」は、
  // 全て /explore の中のタブとして統合されているため、個別のナビ項目としては
  // 廃止した（同じ内容がナビに重複して並び、分かりにくいという指摘のため）。
  // 「My Trip」「Profile」は、ログイン中のユーザーのみ意味を持つため、
  // ここには含めず、Navbar.tsx側でログイン状態に応じて動的に追加している。
  { label: 'Plan with AI', href: '/' },
  { label: 'Explore', href: '/explore' },
  { label: 'Share', href: '/share' },
];

// 【削除済み】export const destinations
//
// Spotの正データは KV の spot:{id} に移行した（Living Spot Database）。
// KVが読めない場合のフォールバックは、正データから自動生成される
// R2上のSnapshot（src/lib/spotSnapshot.ts）が担う。
//
// ここに367件を残していた際の問題：
//   - Admin編集やOSM Importの結果が反映されず、
//     取得失敗時だけ古いデータが表示される（気づきにくい不整合）
//   - 新規Spotが含まれないため、増えるほど欠落が大きくなる
//   - 269KB がすべてのページのバンドルに含まれる

export const localsPlaces = [
  {
    id: 'local-1',
    title: 'Morning Walk in Kamakura',
    story: 'Before the crowds arrive, the temple paths belong to locals on their morning walks. The air is cool, the incense drifts through cedar groves, and the only sound is the crunch of gravel underfoot.',
    image: 'https://pub-06389d4ab58c4eaf89af8574a94bdc18.r2.dev/destinations/test-666b2de1-7610-4fab-aaac-19631831d280.jpg',
  },
  {
    id: 'local-2',
    title: 'Hidden Café Near Enoshima Station',
    story: 'Tucked down a narrow alley just three minutes from the station, this family-run kissaten has been serving hand-dripped coffee to locals for over forty years. The Showa-era interior has not changed since 1978.',
    image: 'https://pub-06389d4ab58c4eaf89af8574a94bdc18.r2.dev/destinations/test-b521b845-508d-422c-968b-7e68042acc84.jpg',
  },
  {
    id: 'local-3',
    title: 'Sunset Spot on Shonan Coast',
    story: 'Locals know the best place to watch the sun melt into Sagami Bay is not the main beach, but this quiet stretch near Inamuragasaki. Bring a konbini beer and sit on the sea wall as the sky turns pink.',
    image: 'https://pub-06389d4ab58c4eaf89af8574a94bdc18.r2.dev/destinations/test-09760fa4-f382-48ca-80aa-bf27f92617dd.jpg',
  },
  {
    id: 'local-4',
    title: 'Local Soba Restaurant',
    story: 'Run by the same couple for three decades, this eight-seat soba shop does not appear in any guidebook. The handmade noodles are cut each morning, and the dipping broth follows a recipe passed down through generations.',
    image: 'https://pub-06389d4ab58c4eaf89af8574a94bdc18.r2.dev/destinations/test-74952e74-33a3-404f-8295-bbf5d9b48260.jpg',
  },
  {
    id: 'local-5',
    title: 'Enoden Tram Window Seat',
    story: 'The best twelve minutes in Kamakura cost just ¥190. Ride the vintage Enoden train between Hase and Inamuragasaki, pressed against the window as the ocean opens up beside you — a view unchanged for a century.',
    image: 'https://pub-06389d4ab58c4eaf89af8574a94bdc18.r2.dev/destinations/test-7209dc80-8d95-4592-9067-d6c23977725a.jpg',
  },
];

export const latestGuides = [
  {
    id: 'guide-1',
    title: 'Kamakura Temple Trail: A Half-Day Walking Route Through 5 Must-See Temples',
    category: 'Activities',
    description: 'Skip the crowds and follow this carefully planned morning route through Kamakura most serene temple gardens, ending at a hidden matcha house.',
    image: 'https://pub-06389d4ab58c4eaf89af8574a94bdc18.r2.dev/destinations/test-67852c36-be18-47ee-a72c-2388653ed7ad.jpg',
    href: '/activities/kamakura-temple-trail',
  },
  {
    id: 'guide-2',
    title: 'What to Eat in Enoshima: From Shirasu Bowls to Grilled Shellfish by the Sea',
    category: 'Food',
    description: 'The ultimate foodie guide to Enoshima island — where to find the freshest shirasu, legendary lobster senbei, and sunset terrace dining with Fuji views.',
    image: 'https://pub-06389d4ab58c4eaf89af8574a94bdc18.r2.dev/destinations/test-7e61df1e-041d-48c2-9f40-33a000fabc66.jpg',
    href: '/food/enoshima-food-guide',
  },
  {
    id: 'guide-3',
    title: 'Getting from Tokyo to Kamakura & Enoshima: The Complete Transport Guide',
    category: 'Transport',
    description: 'Compare all routes, passes, and insider shortcuts. Whether you are taking the JR line, Odakyu, or the charming Enoden tram, we have you covered.',
    image: 'https://pub-06389d4ab58c4eaf89af8574a94bdc18.r2.dev/destinations/test-4eadd6c5-bd95-4906-803a-5199ce8fae7c.jpg',
    href: '/transport/tokyo-to-kamakura-enoshima',
  },
  {
    id: 'guide-4',
    title: 'Hidden Kamakura: 7 Secret Spots Most Tourists Never Find',
    category: 'Hidden Gems',
    description: 'Venture beyond the Great Buddha to discover tucked-away tea houses, a cave shrine only locals know, and the most photogenic bamboo path without the crowds.',
    image: 'https://pub-06389d4ab58c4eaf89af8574a94bdc18.r2.dev/destinations/test-bdbd0eeb-d196-4aff-bb6c-06580e1325d9.jpg',
    href: '/hidden-gems/hidden-kamakura',
  },
  {
    id: 'guide-5',
    title: 'Japan Rail Pass Guide 2026: Is the JR Pass Still Worth It After the Price Increase?',
    category: 'Transport',
    description: 'Unlimited bullet train travel across Japan — 2026 prices, coverage, alternatives, and our honest verdict on whether the JR Pass still makes sense after the price hike.',
    image: 'https://pub-06389d4ab58c4eaf89af8574a94bdc18.r2.dev/destinations/test-ba9564a9-6158-4ca1-95ca-0d66300f1fdc.jpg',
    href: '/transport/jr-pass-guide',
  },
];

export const features = [
  {
    icon: 'ri-map-pin-user-line',
    title: 'All 47 Prefectures, One Platform',
    description: 'From famous cities to hidden corners, every prefecture has local stories waiting to be discovered.',
  },
  {
    icon: 'ri-compass-3-line',
    title: 'Real Voices, Not Listicles',
    description: 'Recommendations come from Japanese creators who actually live these places — not generic guidebooks.',
  },
  {
    icon: 'ri-heart-line',
    title: 'Plan Your Way, With AI',
    description: 'From a rough wishlist to a minute-by-minute itinerary — AI helps as much or as little as you want.',
  },
];

export const footerLinks = {
  explore: [
    { label: 'Kamakura', href: '#' },
    { label: 'Enoshima', href: '#' },
    { label: 'Shonan Coast', href: '#' },
    { label: 'Day Trips from Tokyo', href: '#' },
  ],
  resources: [
    { label: 'Travel Tips', href: '#' },
    { label: 'Transport Guides', href: '#' },
    { label: 'Food & Dining', href: '#' },
    { label: 'Seasonal Events', href: '#' },
  ],
  company: [
    { label: 'About Us', href: '/about' },
    { label: 'Contact', href: '#' },
    { label: 'Privacy Policy', href: '/privacy-policy' },
    { label: 'Affiliate Disclosure', href: '/affiliate-disclosure' },
    { label: 'Disclaimer', href: '/disclaimer' },
  ],
};
