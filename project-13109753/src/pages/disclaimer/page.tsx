import { useEffect, useState } from 'react';
import Navbar from '@/components/feature/Navbar';
import Footer from '@/components/feature/Footer';

const disclaimerSections = [
  { id: 'summary', title: 'Summary' },
  { id: 'general', title: '1. General Information' },
  { id: 'no-advice', title: '2. No Professional Advice' },
  { id: 'accuracy', title: '3. Accuracy of Information' },
  { id: 'external', title: '4. External Links' },
  { id: 'liability', title: '5. Limitation of Liability' },
  { id: 'contact', title: '6. Contact' },
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

export default function DisclaimerPage() {
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
            <span className="text-white">Disclaimer</span>
          </nav>
          <span className="text-accent-400 text-xs font-semibold tracking-[0.25em] uppercase">Legal</span>
          <h1 className="font-heading font-bold text-3xl md:text-5xl lg:text-6xl text-white mt-3 mb-3 leading-tight">
            Disclaimer
          </h1>
          <p className="text-white/60 text-sm md:text-base">Last updated: June 2026</p>
        </div>
      </section>

      <section className="px-6 md:px-10 py-12 md:py-16">
        <div className="max-w-[860px] mx-auto">
          <div className="flex items-start justify-between gap-6 mb-8">
            <TableOfContents sections={disclaimerSections} />
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
              <div className="rounded-r-lg p-6 md:p-8" style={{ backgroundColor: '#F5F5F5', borderLeft: '4px solid #888888' }}>
                <p className="text-foreground-700 text-base md:text-lg leading-relaxed">
                  The information on TABI is provided for general informational purposes only. While we strive for accuracy, travel conditions change, and we encourage you to verify critical details independently.
                </p>
              </div>
            </section>

            <section id="general">
              <h2 className="font-heading font-bold text-xl md:text-2xl text-foreground-900 mb-4">1. General Information</h2>
              <p className="text-foreground-600 leading-relaxed">
                All content published on jtabi.com is for general informational and entertainment purposes only. We make every effort to ensure our guides, recommendations, and travel information are accurate and up to date, but we make no warranties of any kind — express or implied — about the completeness, accuracy, reliability, suitability, or availability of the information, products, services, or related graphics on this website.
              </p>
            </section>

            <section id="no-advice">
              <h2 className="font-heading font-bold text-xl md:text-2xl text-foreground-900 mb-4">2. No Professional Advice</h2>
              <p className="text-foreground-600 leading-relaxed">
                The content on TABI does not constitute professional travel, legal, financial, medical, or safety advice. Travel decisions involve risks, and what worked for one traveler may not be suitable for another. Always consult official government sources, licensed professionals, and current local authorities for matters concerning:
              </p>
              <ul className="space-y-2 mt-4 pl-4">
                {[
                  'Visa requirements and entry procedures',
                  'Health, vaccination, and travel insurance requirements',
                  'Safety advisories and travel warnings',
                  'Financial matters including currency, taxes, and payment methods',
                  'Legal obligations in your destination country',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-foreground-600 leading-relaxed">
                    <span className="text-foreground-400 mt-1.5 flex-shrink-0"><i className="ri-arrow-right-s-line"></i></span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section id="accuracy">
              <h2 className="font-heading font-bold text-xl md:text-2xl text-foreground-900 mb-4">3. Accuracy of Information</h2>
              <p className="text-foreground-600 leading-relaxed mb-4">
                Japan is a dynamic country where things change. While we research thoroughly before publishing and update our content regularly, the following details can change without notice and may differ from what is presented on our site:
              </p>
              <ul className="space-y-3">
                {[
                  'Opening hours and admission prices for temples, shrines, and attractions',
                  'Transportation schedules, routes, fares, and pass validity',
                  'Visa policies and entry requirements for different nationalities',
                  'Natural events such as cherry blossom timing, autumn foliage, and seasonal closures',
                  'Restaurant availability, menu items, and pricing',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-foreground-600 leading-relaxed">
                    <span className="text-foreground-400 mt-1.5 flex-shrink-0"><i className="ri-error-warning-line"></i></span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p className="text-foreground-600 leading-relaxed mt-4">
                We encourage you to verify critical information — especially transportation, accommodation, and visa details — through official sources before your trip.
              </p>
            </section>

            <section id="external">
              <h2 className="font-heading font-bold text-xl md:text-2xl text-foreground-900 mb-4">4. External Links</h2>
              <p className="text-foreground-600 leading-relaxed">
                TABI contains links to external websites that are not operated or controlled by us. We have no control over the content, privacy policies, or practices of any third-party websites and assume no responsibility for them. The inclusion of any link does not imply endorsement. We recommend reviewing the privacy policies and terms of any external site you visit.
              </p>
            </section>

            <section id="liability">
              <h2 className="font-heading font-bold text-xl md:text-2xl text-foreground-900 mb-4">5. Limitation of Liability</h2>
              <p className="text-foreground-600 leading-relaxed">
                To the fullest extent permitted by applicable law, TABI and its authors, contributors, and operators shall not be liable for any direct, indirect, incidental, consequential, or punitive damages arising from your use of, or reliance on, the information provided on this website. This includes, but is not limited to, financial losses, travel disruptions, injuries, or other damages resulting from inaccuracies, omissions, or outdated information. Your use of this website and reliance on any information is solely at your own risk.
              </p>
            </section>

            <section id="contact">
              <h2 className="font-heading font-bold text-xl md:text-2xl text-foreground-900 mb-4">6. Contact</h2>
              <p className="text-foreground-600 leading-relaxed">
                If you notice inaccurate information or have questions about this disclaimer, please contact us at{' '}
                <a href="mailto:hello@jtabi.com" className="text-primary-500 hover:text-primary-600 underline cursor-pointer">
                  hello@jtabi.com
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