import { useEffect, useState } from 'react';
import Navbar from '@/components/feature/Navbar';
import Footer from '@/components/feature/Footer';

const beliefCards = [
  {
    icon: 'ri-map-pin-user-line',
    title: 'The best experiences are never in the guidebook.',
    body: 'They\'re in the alley behind the station, shared by someone who lives there.',
  },
  {
    icon: 'ri-eye-line',
    title: 'Japan is not just something you see.',
    body: 'It\'s something you smell, hear, taste, and feel.',
  },
  {
    icon: 'ri-compass-discover-line',
    title: 'The real Japan exists beyond Tokyo, Kyoto, and Osaka.',
    body: 'Most travelers never find it. We believe they should.',
  },
];

const discoverCards = [
  {
    icon: 'ri-map-pin-user-line',
    title: 'Find the places locals love',
    body: 'The best experiences in Japan aren\'t in the top 10 lists. They\'re in the alley behind the train station, recommended by someone who lives there.',
  },
  {
    icon: 'ri-eye-line',
    title: 'Experience Japan through all five senses',
    body: 'Japan isn\'t just something you see. It\'s the smell of cedar in an ancient shrine. The sound of rain on a temple roof. The taste of dashi made from scratch at dawn.',
  },
  {
    icon: 'ri-compass-discover-line',
    title: 'Discover the Japan most travelers miss',
    body: 'Beyond Tokyo, Kyoto, and Osaka lies a Japan that most visitors never find. We\'re here to change that.',
  },
];

const howWeWorkPrinciples = [
  {
    number: '01',
    title: 'First-hand research',
    body: 'We verify information through direct research, local contacts, and on-the-ground sources. When we can\'t verify something ourselves, we say so.',
  },
  {
    number: '02',
    title: 'Honest recommendations',
    body: 'We only recommend products, services, and experiences we genuinely believe will improve your trip. Our affiliate relationships never influence our editorial opinions. If something isn\'t worth it, we\'ll tell you.',
  },
  {
    number: '03',
    title: 'Constantly updated',
    body: 'Japan changes. Restaurants close. Train lines open. Rules change. We update our content regularly to make sure what you read today is still true when you arrive.',
  },
];

const coverageItems = [
  {
    icon: 'ri-train-line',
    title: 'Transport & Getting Around',
    desc: 'Honest guides to JR Pass, eSIM, airport transfers, and navigating Japan\'s train system.',
  },
  {
    icon: 'ri-hotel-line',
    title: 'Where to Stay',
    desc: 'Ryokan, hotels, and hidden accommodations from budget to luxury.',
  },
  {
    icon: 'ri-restaurant-line',
    title: 'Food & Drink',
    desc: 'From Michelin-starred to the best ramen stall nobody knows about.',
  },
  {
    icon: 'ri-calendar-event-line',
    title: 'Day Trips & Itineraries',
    desc: 'Ready-to-use itineraries built around how real travelers actually move.',
  },
  {
    icon: 'ri-building-4-line',
    title: 'Local Experiences',
    desc: 'Craft workshops, hidden shrines, seasonal festivals, and places locals actually go.',
  },
  {
    icon: 'ri-calculator-line',
    title: 'Travel Planning Tools',
    desc: 'Budget calculators, JR Pass checkers, and itinerary builders.',
  },
];

export default function AboutPage() {
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => setShowBackToTop(window.scrollY > 500);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <main className="min-h-screen bg-background-50">
      <Navbar />

      {/* Page Header */}
      <section className="bg-background-900 pt-24 md:pt-28 pb-16 md:pb-20 px-6 md:px-10">
        <div className="max-w-[960px] mx-auto text-center">
          <nav className="flex items-center justify-center gap-2 text-white/50 text-xs mb-6" aria-label="Breadcrumb">
            <a href="/" className="hover:text-white/80 transition-colors cursor-pointer">Home</a>
            <span className="text-white/30">/</span>
            <span className="text-white">About</span>
          </nav>
          <span className="text-accent-400 text-xs font-semibold tracking-[0.25em] uppercase">About</span>
          <h1 className="font-heading font-bold text-3xl md:text-5xl lg:text-6xl text-white mt-3 mb-3 leading-tight">
            Why TABI Exists
          </h1>
          <p className="text-white/60 text-sm md:text-base max-w-xl mx-auto">
            Discover Japan Beyond the Guidebooks
          </p>
        </div>
      </section>

      {/* Section 1 — The Problem */}
      <section className="relative w-full py-20 md:py-28 px-6 md:px-10 lg:px-20 bg-background-50 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-foreground-200/40 to-transparent"></div>
        </div>

        <div className="relative max-w-[960px] mx-auto">
          <h2 className="font-heading font-bold text-3xl md:text-5xl lg:text-6xl text-foreground-900 leading-tight mb-10 md:mb-14 max-w-3xl">
            Most travelers see Japan. They don&apos;t feel it.
          </h2>

          <div className="space-y-6 text-base md:text-lg text-foreground-600 leading-relaxed max-w-2xl">
            <p>
              Every year, millions of travelers visit Japan. They check off Senso-ji, Fushimi Inari, and the deer park in Nara.
            </p>
            <p>
              They take the photos. They share the moments.
            </p>
            <p>
              And then they go home wondering why it felt like something was missing.
            </p>
            <p className="text-foreground-800 font-semibold pt-4">
              The guidebooks showed them Japan. Nobody showed them how to experience it.
            </p>
          </div>
        </div>
      </section>

      {/* Section 2 — Our Philosophy (Two-column) */}
      <section className="relative w-full py-20 md:py-28 px-6 md:px-10 lg:px-20 bg-background-100 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-foreground-200/40 to-transparent"></div>
          <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-foreground-200/40 to-transparent"></div>
        </div>

        <div className="relative max-w-[960px] mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-start lg:gap-20">
            <div className="flex-1 max-w-2xl">
              <div className="flex items-center gap-6 mb-12 md:mb-16">
                <div className="hidden md:block w-12 h-px bg-accent-400"></div>
                <span className="text-xs font-semibold tracking-[0.25em] uppercase text-accent-600">
                  Our Philosophy
                </span>
              </div>

              <h2 className="font-heading font-bold text-5xl md:text-7xl lg:text-8xl text-foreground-900 leading-[0.9] mb-8 md:mb-12 tracking-tight">
                Beyond<br />Sightseeing<span className="text-accent-500">.</span>
              </h2>

              <div className="w-20 h-px bg-foreground-300 mb-8 md:mb-12"></div>

              <div className="space-y-5 text-base md:text-lg text-foreground-600 leading-relaxed max-w-xl">
                <p>
                  Travel is more than checking famous places off a list.
                </p>
                <p>
                  The most memorable journeys begin when you slow down, explore deeper, and discover the stories, traditions, people, and moments that guidebooks often miss.
                </p>
                <p>
                  At TABI, we believe the real Japan is found beyond the obvious.
                </p>
                <p>
                  In the izakaya where nobody speaks English. In the mountain trail that isn&apos;t on any map. In the craftsman who has been making the same pottery for forty years.
                </p>
                <p className="text-foreground-800 font-semibold pt-2">
                  That Japan is worth finding.
                </p>
              </div>
            </div>

            <div className="hidden lg:block flex-shrink-0 w-72 lg:w-80 mt-10 lg:mt-24">
              <div className="relative">
                <div className="w-full aspect-[3/4] rounded-lg overflow-hidden">
                  <img
                    src="https://readdy.ai/api/search-image?query=Traditional%20Japanese%20pottery%20studio%20interior%20with%20craftsman%20hands%20shaping%20clay%20on%20wooden%20wheel%2C%20warm%20ambient%20light%20from%20paper%20lantern%2C%20shelves%20of%20handmade%20ceramics%20in%20background%2C%20documentary%20style%20photography%20with%20intimate%20atmosphere%2C%20soft%20natural%20tones&width=600&height=800&seq=about-philosophy-visual&orientation=portrait"
                    alt="Beyond Sightseeing — traditional Japanese craftsmanship"
                    title="Beyond Sightseeing — TABI Philosophy"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute -bottom-4 -left-4 w-24 h-24 border border-foreground-200/50 rounded-lg -z-10 hidden xl:block"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3 — What We Believe (3-card grid) */}
      <section className="py-20 md:py-28 px-6 md:px-10 lg:px-20 bg-background-50">
        <div className="max-w-[960px] mx-auto">
          <h2 className="font-heading font-bold text-2xl md:text-3xl text-foreground-900 mb-4">
            What We Believe
          </h2>
          <p className="text-foreground-500 text-base mb-12 max-w-xl">
            Three things that guide everything we create.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {beliefCards.map((card) => (
              <div
                key={card.title}
                className="bg-background-50 border border-background-200 rounded-lg p-6 md:p-8 hover:border-background-300 transition-colors group"
              >
                <div className="w-12 h-12 rounded-lg bg-accent-100 flex items-center justify-center mb-5 group-hover:bg-accent-200 transition-colors">
                  <i className={`${card.icon} text-accent-600 text-xl`}></i>
                </div>
                <h3 className="font-heading font-semibold text-foreground-800 text-base mb-3 leading-snug">
                  {card.title}
                </h3>
                <p className="text-foreground-500 text-sm leading-relaxed">
                  {card.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 4 — What You'll Discover (3-card grid) */}
      <section className="py-20 md:py-28 px-6 md:px-10 lg:px-20 bg-background-100">
        <div className="max-w-[960px] mx-auto">
          <h2 className="font-heading font-bold text-2xl md:text-3xl text-foreground-900 mb-4">
            What You&apos;ll Discover
          </h2>
          <p className="text-foreground-500 text-base mb-12 max-w-xl">
            Three promises we make to every traveler.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {discoverCards.map((card) => (
              <div
                key={card.title}
                className="bg-background-50 border border-background-200 rounded-lg p-6 md:p-8 hover:border-background-300 transition-colors group"
              >
                <div className="w-12 h-12 rounded-lg bg-accent-100 flex items-center justify-center mb-5 group-hover:bg-accent-200 transition-colors">
                  <i className={`${card.icon} text-accent-600 text-xl`}></i>
                </div>
                <h3 className="font-heading font-semibold text-foreground-800 text-base mb-3 leading-snug">
                  {card.title}
                </h3>
                <p className="text-foreground-500 text-sm leading-relaxed">
                  {card.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 5 — How We Work */}
      <section className="py-20 md:py-28 px-6 md:px-10 lg:px-20 bg-background-100">
        <div className="max-w-[960px] mx-auto">
          <h2 className="font-heading font-bold text-2xl md:text-3xl text-foreground-900 mb-4">
            How We Create Our Content
          </h2>
          <p className="text-foreground-500 text-base md:text-lg leading-relaxed mb-14 max-w-2xl">
            Every piece of content on TABI is created with one question in mind:{' '}
            <span className="text-foreground-800 font-medium">Would we recommend this to a friend planning their trip to Japan?</span>
          </p>

          <div className="space-y-10">
            {howWeWorkPrinciples.map((principle) => (
              <div key={principle.number} className="flex gap-6 md:gap-8">
                <span className="text-4xl md:text-5xl font-heading font-bold text-foreground-200 leading-none flex-shrink-0">
                  {principle.number}
                </span>
                <div>
                  <h3 className="font-heading font-semibold text-lg md:text-xl text-foreground-800 mb-2">
                    {principle.title}
                  </h3>
                  <p className="text-foreground-500 text-sm md:text-base leading-relaxed max-w-2xl">
                    {principle.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 6 — Mission Statement (dark full-width) */}
      <section className="py-20 md:py-20 px-6 md:px-10 lg:px-20 bg-background-900">
        <div className="max-w-[960px] mx-auto text-center">
          <h2 className="font-heading font-bold text-2xl md:text-[36px] lg:text-[40px] text-white leading-tight max-w-2xl mx-auto">
            Discover Japan Beyond the Guidebooks
          </h2>
          <div className="w-[60px] h-px bg-primary-500 mx-auto my-6"></div>
          <p className="text-white font-body text-base md:text-lg leading-relaxed max-w-xl mx-auto mb-5">
            We are building the only platform that knows not just where travelers go in Japan, but why they fall in love with it.
          </p>
          <p className="text-white/40 text-[13px]">
            TABI · Beyond Sightseeing
          </p>
        </div>
      </section>

      {/* Section 7 — What You'll Find Here (2-column grid) */}
      <section className="py-20 md:py-28 px-6 md:px-10 lg:px-20 bg-background-50">
        <div className="max-w-[960px] mx-auto">
          <h2 className="font-heading font-bold text-2xl md:text-3xl text-foreground-900 mb-12">
            What TABI Covers
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {coverageItems.map((item) => (
              <div key={item.title} className="flex gap-4 p-5 rounded-lg border border-background-200 bg-background-50 hover:border-background-300 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <i className={`${item.icon} text-primary-600 text-lg`}></i>
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-foreground-800 text-sm mb-1.5">
                    {item.title}
                  </h3>
                  <p className="text-foreground-500 text-sm leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 8 — Transparency highlight box */}
      <section className="py-20 md:py-28 px-6 md:px-10 lg:px-20 bg-background-100">
        <div className="max-w-[960px] mx-auto">
          <div className="bg-primary-50 border-l-4 border-primary-500 rounded-r-lg p-6 md:p-10">
            <h2 className="font-heading font-bold text-xl md:text-2xl text-foreground-900 mb-4">
              A note on transparency
            </h2>
            <div className="space-y-4 text-foreground-600 text-sm md:text-base leading-relaxed max-w-2xl">
              <p>
                Some links on TABI are affiliate links. When you book or buy through them, we may earn a small commission — at no extra cost to you.
              </p>
              <p>
                This is how we keep the site free, independent, and constantly updated.
              </p>
              <p>
                Our recommendations are never influenced by commission rates. Full details in our Affiliate Disclosure.
              </p>
            </div>
            <a
              href="/affiliate-disclosure"
              className="inline-flex items-center gap-2 text-primary-500 hover:text-primary-600 font-semibold text-sm mt-6 transition-colors cursor-pointer"
            >
              Read our full Affiliate Disclosure
              <i className="ri-arrow-right-line"></i>
            </a>
          </div>
        </div>
      </section>

      {/* Section 9 — CTA */}
      <section className="py-20 md:py-28 px-6 md:px-10 lg:px-20 bg-background-50">
        <div className="max-w-[960px] mx-auto text-center">
          <h2 className="font-heading font-bold text-2xl md:text-4xl lg:text-5xl text-foreground-900 mb-8 leading-tight">
            Ready to explore Japan differently?
          </h2>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="/"
              className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm px-8 py-3.5 rounded-md transition-all duration-200 whitespace-nowrap cursor-pointer"
            >
              Start Exploring
              <i className="ri-arrow-right-line"></i>
            </a>
            <a
              href="/"
              className="inline-flex items-center gap-2 border-2 border-foreground-200 text-foreground-700 hover:border-foreground-400 hover:text-foreground-900 font-semibold text-sm px-8 py-3.5 rounded-md transition-all duration-200 whitespace-nowrap cursor-pointer"
            >
              Plan Your Trip
              <i className="ri-calendar-line"></i>
            </a>
          </div>
        </div>
      </section>

      {showBackToTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-8 right-8 w-10 h-10 bg-primary-500 hover:bg-primary-600 text-white rounded-full flex items-center justify-center shadow-lg cursor-pointer transition-all z-40"
          aria-label="Back to top"
        >
          <i className="ri-arrow-up-line"></i>
        </button>
      )}

      <Footer />
    </main>
  );
}