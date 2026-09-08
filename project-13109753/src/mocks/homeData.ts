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
    image: 'https://readdy.ai/api/search-image?query=Early%20morning%20in%20Kamakura%20Japan%2C%20empty%20temple%20pathway%20with%20stone%20steps%20and%20traditional%20wooden%20gate%2C%20soft%20dawn%20mist%20filtering%20through%20ancient%20cedar%20trees%2C%20peaceful%20solitary%20atmosphere%2C%20editorial%20travel%20photography%20with%20warm%20golden%20light&width=700&height=500&seq=local-morning-01&orientation=landscape',
  },
  {
    id: 'local-2',
    title: 'Hidden Café Near Enoshima Station',
    story: 'Tucked down a narrow alley just three minutes from the station, this family-run kissaten has been serving hand-dripped coffee to locals for over forty years. The Showa-era interior has not changed since 1978.',
    image: 'https://readdy.ai/api/search-image?query=Traditional%20Japanese%20kissaten%20coffee%20shop%20interior%20with%20Showa%20era%20retro%20styling%2C%20wooden%20counter%20and%20leather%20stools%2C%20hand%20drip%20coffee%20setup%2C%20warm%20ambient%20lighting%2C%20cozy%20intimate%20atmosphere%2C%20documentary%20style%20photography&width=700&height=500&seq=local-cafe-02&orientation=landscape',
  },
  {
    id: 'local-3',
    title: 'Sunset Spot on Shonan Coast',
    story: 'Locals know the best place to watch the sun melt into Sagami Bay is not the main beach, but this quiet stretch near Inamuragasaki. Bring a konbini beer and sit on the sea wall as the sky turns pink.',
    image: 'https://readdy.ai/api/search-image?query=Shonan%20coast%20Japan%20sunset%20view%20from%20quiet%20rocky%20shoreline%2C%20silhouette%20of%20distant%20Enoshima%20island%20under%20dramatic%20pink%20and%20orange%20twilight%20sky%2C%20calm%20ocean%20waves%2C%20peaceful%20solitary%20moment%2C%20atmospheric%20travel%20photography&width=700&height=500&seq=local-sunset-03&orientation=landscape',
  },
  {
    id: 'local-4',
    title: 'Local Soba Restaurant',
    story: 'Run by the same couple for three decades, this eight-seat soba shop does not appear in any guidebook. The handmade noodles are cut each morning, and the dipping broth follows a recipe passed down through generations.',
    image: 'https://readdy.ai/api/search-image?query=Small%20traditional%20Japanese%20soba%20noodle%20restaurant%20interior%20with%20wooden%20counter%20and%20only%20a%20few%20seats%2C%20artisan%20chef%20preparing%20handmade%20soba%20noodles%2C%20warm%20lantern%20lighting%2C%20intimate%20authentic%20atmosphere%2C%20documentary%20food%20photography&width=700&height=500&seq=local-soba-04&orientation=landscape',
  },
  {
    id: 'local-5',
    title: 'Enoden Tram Window Seat',
    story: 'The best twelve minutes in Kamakura cost just ¥190. Ride the vintage Enoden train between Hase and Inamuragasaki, pressed against the window as the ocean opens up beside you — a view unchanged for a century.',
    image: 'https://readdy.ai/api/search-image?query=View%20from%20inside%20vintage%20Japanese%20Enoden%20green%20electric%20train%20window%20showing%20coastal%20ocean%20scenery%2C%20traditional%20train%20interior%20with%20wooden%20elements%2C%20warm%20afternoon%20sunlight%20streaming%20through%2C%20nostalgic%20travel%20moment%20photography&width=700&height=500&seq=local-enoden-05&orientation=landscape',
  },
];

export const latestGuides = [
  {
    id: 'guide-1',
    title: 'Kamakura Temple Trail: A Half-Day Walking Route Through 5 Must-See Temples',
    category: 'Activities',
    description: 'Skip the crowds and follow this carefully planned morning route through Kamakura most serene temple gardens, ending at a hidden matcha house.',
    image: 'https://readdy.ai/api/search-image?query=Kamakura%20Japan%20temple%20trail%20stone%20steps%20leading%20to%20traditional%20wooden%20temple%20gate%2C%20lush%20green%20bamboo%20forest%20surroundings%2C%20soft%20morning%20mist%2C%20minimalist%20travel%20photography%20warm%20natural%20light&width=600&height=400&seq=guide-temple-01&orientation=landscape',
    href: '/activities/kamakura-temple-trail',
  },
  {
    id: 'guide-2',
    title: 'What to Eat in Enoshima: From Shirasu Bowls to Grilled Shellfish by the Sea',
    category: 'Food',
    description: 'The ultimate foodie guide to Enoshima island — where to find the freshest shirasu, legendary lobster senbei, and sunset terrace dining with Fuji views.',
    image: 'https://readdy.ai/api/search-image?query=Japanese%20seafood%20bowl%20with%20fresh%20shirasu%20whitebait%20on%20rice%20at%20seaside%20restaurant%2C%20wooden%20table%20with%20ocean%20background%2C%20natural%20lighting%2C%20food%20photography%20minimalist%20clean%20style&width=600&height=400&seq=guide-food-02&orientation=landscape',
    href: '/food/enoshima-food-guide',
  },
  {
    id: 'guide-3',
    title: 'Getting from Tokyo to Kamakura & Enoshima: The Complete Transport Guide',
    category: 'Transport',
    description: 'Compare all routes, passes, and insider shortcuts. Whether you are taking the JR line, Odakyu, or the charming Enoden tram, we have you covered.',
    image: 'https://readdy.ai/api/search-image?query=Enoden%20train%20in%20Japan%20vintage%20green%20electric%20tram%20running%20along%20coastal%20track%20with%20ocean%20view%2C%20traditional%20Japanese%20neighborhood%20background%2C%20bright%20sunny%20day%2C%20travel%20photography%20style&width=600&height=400&seq=guide-transport-03&orientation=landscape',
    href: '/transport/tokyo-to-kamakura-enoshima',
  },
  {
    id: 'guide-4',
    title: 'Hidden Kamakura: 7 Secret Spots Most Tourists Never Find',
    category: 'Hidden Gems',
    description: 'Venture beyond the Great Buddha to discover tucked-away tea houses, a cave shrine only locals know, and the most photogenic bamboo path without the crowds.',
    image: 'https://readdy.ai/api/search-image?query=Hidden%20Japanese%20bamboo%20grove%20path%20in%20Kamakura%20with%20sunlight%20filtering%20through%20tall%20green%20bamboo%20stalks%2C%20stone%20lantern%20along%20path%2C%20peaceful%20secluded%20atmosphere%2C%20vertical%20composition%20travel%20photography&width=600&height=400&seq=guide-hidden-04&orientation=landscape',
    href: '/hidden-gems/hidden-kamakura',
  },
  {
    id: 'guide-5',
    title: 'Japan Rail Pass Guide 2026: Is the JR Pass Still Worth It After the Price Increase?',
    category: 'Transport',
    description: 'Unlimited bullet train travel across Japan — 2026 prices, coverage, alternatives, and our honest verdict on whether the JR Pass still makes sense after the price hike.',
    image: 'https://readdy.ai/api/search-image?query=Japan%20Shinkansen%20bullet%20train%20speeding%20past%20Mount%20Fuji%20under%20a%20clear%20blue%20sky%2C%20Japan%20Rail%20Pass%20ticket%20held%20in%20foreground%20on%20a%20modern%20station%20platform%2C%20bright%20natural%20daylight%2C%20editorial%20travel%20photography%20with%20clean%20composition%20and%20warm%20tones&width=600&height=400&seq=guide-jrpass-05&orientation=landscape',
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
