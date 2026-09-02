import { useEffect, useState } from 'react';
import Navbar from '@/components/feature/Navbar';
import Footer from '@/components/feature/Footer';

const partnerCards = [
  {
    icon: 'ri-hotel-line',
    name: 'Booking.com',
    desc: 'Hotels & Accommodation — Find and book the perfect place to stay across Japan, from traditional ryokan to modern city hotels.',
  },
  {
    icon: 'ri-ticket-line',
    name: 'Klook',
    desc: 'Tours, Activities & Transport — Book curated experiences, day trips, attraction tickets, and local transport passes.',
  },
  {
    icon: 'ri-compass-discover-line',
    name: 'Viator',
    desc: 'Tours & Experiences — Discover guided walking tours, cultural workshops, food tours, and unique local experiences.',
  },
  {
    icon: 'ri-signal-wifi-line',
    name: 'Airalo',
    desc: 'eSIM & Mobile Data — Stay connected across Japan with affordable, easy-to-install eSIM data plans for travelers.',
  },
  {
    icon: 'ri-train-line',
    name: 'JR Pass Retailers',
    desc: 'Rail Passes — Purchase Japan Rail Passes for unlimited travel on JR trains, including the world-famous Shinkansen.',
  },
  {
    icon: 'ri-shield-check-line',
    name: 'Travel Insurance Providers',
    desc: 'Travel Protection — Compare and purchase travel insurance plans that cover medical, trip cancellation, and baggage.',
  },
  {
    icon: 'ri-shopping-bag-3-line',
    name: 'Amazon Associates',
    desc: 'Travel Gear — Discover recommended travel gear, guidebooks, and essentials for your Japan journey.',
  },
  {
    icon: 'ri-store-3-line',
    name: 'Other Partners',
    desc: 'We occasionally add new partners. This list is updated as we discover products and services that genuinely add value for travelers.',
  },
];

const affiliateSections = [
  { id: 'summary', title: 'Summary' },
  { id: 'commitment', title: '1. Our Commitment to Transparency' },
  { id: 'ftc', title: '2. FTC Disclosure' },
  { id: 'what-are', title: '3. What Are Affiliate Links?' },
  { id: 'partners', title: '4. Our Affiliate Partners' },
  { id: 'editorial', title: '5. Our Editorial Independence' },
  { id: 'sponsored', title: '6. Sponsored Content' },
  { id: 'contact', title: '7. Contact' },
];

function TableOfContents({ sections }: { sections: { id: string; title: string }[] }) {
  return (
    <nav className="mb-12" aria-label="Table of Contents">
      <h4 className="font-heading font-semibold text-sm uppercase tracking-wider text-foreground-500 mb-4">On This Page</h4>
      <ul className="space-y-2">
        {sections.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              className="text-foreground-600 hover:text-primary-500 transition-colors text-sm leading-relaxed cursor-pointer"
            >
              {section.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default function AffiliateDisclosurePage() {
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => setShowBackToTop(window.scrollY > 500);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handlePrint = () => window.print();

  return (
    <main className="min-h-screen bg-background-50">
      <Navbar />

      <section className="bg-background-900 pt-24 md:pt-28 pb-16 md:pb-20 px-6 md:px-10">
        <div className="max-w-[860px] mx-auto">
          <nav className="flex items-center gap-2 text-white/50 text-xs mb-6" aria-label="Breadcrumb">
            <a href="/" className="hover:text-white/80 transition-colors cursor-pointer">Home</a>
            <span className="text-white/30">/</span>
            <span className="text-white/70">Legal</span>
            <span className="text-white/30">/</span>
            <span className="text-white">Affiliate Disclosure</span>
          </nav>
          <span className="text-accent-400 text-xs font-semibold tracking-[0.25em] uppercase">Legal</span>
          <h1 className="font-heading font-bold text-3xl md:text-5xl lg:text-6xl text-white mt-3 mb-3 leading-tight">
            Affiliate Disclosure
          </h1>
          <p className="text-white/60 text-sm md:text-base">Last updated: June 2026</p>
        </div>
      </section>

      <section className="px-6 md:px-10 py-12 md:py-16">
        <div className="max-w-[860px] mx-auto">
          <div className="flex items-start justify-between gap-6 mb-8">
            <TableOfContents sections={affiliateSections} />
            <button
              onClick={handlePrint}
              className="hidden md:inline-flex items-center gap-2 text-foreground-500 hover:text-foreground-700 text-sm cursor-pointer whitespace-nowrap transition-colors"
              aria-label="Print this page"
            >
              <i className="ri-printer-line"></i>
              Print this page
            </button>
          </div>

          <div className="space-y-12">
            <section id="summary">
              <div className="rounded-r-lg p-6 md:p-8" style={{ backgroundColor: '#FFF8E1', borderLeft: '4px solid #F5A623' }}>
                <p className="text-foreground-800 text-base md:text-lg leading-relaxed">
                  Some links on this site are affiliate links. If you click them and make a purchase, we may earn a small commission — at no extra cost to you. This is how we keep TABI free and independent.
                </p>
              </div>
            </section>

            <section id="commitment">
              <h2 className="font-heading font-bold text-xl md:text-2xl text-foreground-900 mb-4">1. Our Commitment to Transparency</h2>
              <p className="text-foreground-600 leading-relaxed">
                TABI participates in affiliate marketing programs to help keep our content free for all readers. We believe in complete transparency about how we earn revenue. Our affiliate relationships comply with the United States Federal Trade Commission guidelines (16 CFR Part 255) concerning the use of endorsements and testimonials in advertising.
              </p>
            </section>

            <section id="ftc">
              <div className="border-2 border-background-200 rounded-lg p-6 md:p-8 bg-background-100">
                <p className="text-foreground-700 leading-relaxed font-medium">
                  TABI participates in affiliate marketing programs. When you click links on our site and make a qualifying purchase, we may receive a commission. This does not affect the price you pay. Our recommendations are based on genuine belief in the quality and value of the products and services we feature.
                </p>
              </div>
            </section>

            <section id="what-are">
              <h2 className="font-heading font-bold text-xl md:text-2xl text-foreground-900 mb-4">3. What Are Affiliate Links?</h2>
              <p className="text-foreground-600 leading-relaxed">
                Affiliate links contain a special tracking code that lets our partner companies know you arrived from TABI. If you make a purchase, the company pays us a small commission from their marketing budget. This does not increase the price you pay — the commission comes from the company, not from you. Think of it as a referral fee for helping you discover something valuable for your Japan trip.
              </p>
            </section>

            <section id="partners">
              <h2 className="font-heading font-bold text-xl md:text-2xl text-foreground-900 mb-4">4. Our Affiliate Partners</h2>
              <p className="text-foreground-600 leading-relaxed mb-6">
                We carefully select partners whose products and services we genuinely believe enhance the Japan travel experience. Here are the companies we currently work with:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {partnerCards.map((card) => (
                  <div
                    key={card.name}
                    className="bg-background-50 border border-background-200 rounded-lg p-5 hover:border-background-300 transition-colors"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-accent-100 flex items-center justify-center flex-shrink-0">
                        <i className={`${card.icon} text-accent-600 text-lg`}></i>
                      </div>
                      <h3 className="font-heading font-semibold text-foreground-800 text-sm">{card.name}</h3>
                    </div>
                    <p className="text-foreground-500 text-sm leading-relaxed">
                      {card.desc}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section id="editorial">
              <h2 className="font-heading font-bold text-xl md:text-2xl text-foreground-900 mb-4">5. Our Editorial Independence</h2>
              <p className="text-foreground-600 leading-relaxed mb-4">
                We recommend products and services based on:
              </p>
              <ul className="space-y-3 mb-4">
                {[
                  'Personal experience and first-hand research by our team',
                  'Verified information from local sources and community feedback',
                  'Honest assessment of value, quality, and relevance for travelers',
                  'Reader feedback and real-world traveler experiences',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-foreground-600 leading-relaxed">
                    <span className="text-accent-500 mt-1.5 flex-shrink-0"><i className="ri-checkbox-circle-line"></i></span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p className="text-foreground-800 font-semibold">
                We will NOT recommend something solely because it pays a higher commission. Our trust with readers is worth more than any affiliate payout.
              </p>
            </section>

            <section id="sponsored">
              <h2 className="font-heading font-bold text-xl md:text-2xl text-foreground-900 mb-4">6. Sponsored Content</h2>
              <p className="text-foreground-600 leading-relaxed">
                On rare occasions, TABI may publish sponsored content or paid partnerships. When we do, it will be clearly labeled as <strong className="text-foreground-800">"Sponsored"</strong> or <strong className="text-foreground-800">"Paid Partnership"</strong> at the top of the content. Sponsored content is created with the same editorial standards as our regular content, and we only work with partners whose values align with our mission of authentic, meaningful travel experiences in Japan.
              </p>
            </section>

            <section id="contact">
              <h2 className="font-heading font-bold text-xl md:text-2xl text-foreground-900 mb-4">7. Contact</h2>
              <p className="text-foreground-600 leading-relaxed">
                Questions about our affiliate relationships or editorial policies? Reach out at{' '}
                <a href="mailto:hello@tabi47.com" className="text-primary-500 hover:text-primary-600 underline cursor-pointer">
                  hello@tabi47.com
                </a>
              </p>
            </section>
          </div>

          <div className="mt-16 pt-8 border-t border-background-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="inline-flex items-center gap-2 text-foreground-500 hover:text-foreground-700 text-sm cursor-pointer transition-colors"
            >
              <i className="ri-arrow-up-line"></i>
              Back to top
            </a>
            <span className="text-foreground-400 text-xs">Last updated: June 2026</span>
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
