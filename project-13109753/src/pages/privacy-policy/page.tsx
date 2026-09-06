import { useEffect, useState } from 'react';
import Navbar from '@/components/feature/Navbar';
import Footer from '@/components/feature/Footer';
import { useAutoT } from '@/hooks/useAutoT';

function TableOfContents({ sections }: { sections: { id: string; title: string }[] }) {
  const t = useAutoT();
  return (
    <nav className="mb-12" aria-label={t('auto_9730d4326a', "Table of Contents")}>
      <h4 className="font-heading font-semibold text-sm uppercase tracking-wider text-foreground-500 mb-4">{t('auto_27fdd62ebe', "On This Page")}</h4>
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

const privacySections = [
  { id: 'summary', title: 'Summary' },
  { id: 'who-we-are', title: '1. Who We Are' },
  { id: 'information-we-collect', title: '2. Information We Collect' },
  { id: 'how-we-use', title: '3. How We Use Your Information' },
  { id: 'affiliate-links', title: '4. Affiliate Links' },
  { id: 'google-analytics', title: '5. Google Analytics' },
  { id: 'your-rights', title: '6. Your Rights' },
  { id: 'changes', title: '7. Changes to This Policy' },
  { id: 'contact', title: '8. Contact' },
];

export default function PrivacyPolicyPage() {
  const t = useAutoT();
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
          <nav className="flex items-center gap-2 text-white/50 text-xs mb-6" aria-label={t('auto_c766e66518', "Breadcrumb")}>
            <a href="/" className="hover:text-white/80 transition-colors cursor-pointer">{t('auto_70f8bb9a8a', "Home")}</a>
            <span className="text-white/30">/</span>
            <span className="text-white/70">{t('auto_902c91d94e', "Legal")}</span>
            <span className="text-white/30">/</span>
            <span className="text-white">{t('auto_9db108ba6b', "Privacy Policy")}</span>
          </nav>
          <span className="text-accent-400 text-xs font-semibold tracking-[0.25em] uppercase">{t('auto_902c91d94e', "Legal")}</span>
          <h1 className="font-heading font-bold text-3xl md:text-5xl lg:text-6xl text-white mt-3 mb-3 leading-tight">
            {t('auto_9db108ba6b', "Privacy Policy")}
          </h1>
          <p className="text-white/60 text-sm md:text-base">{t('auto_8f12a6169f', "Last updated: June 2026")}</p>
        </div>
      </section>

      <section className="px-6 md:px-10 py-12 md:py-16">
        <div className="max-w-[860px] mx-auto">
          <div className="flex items-start justify-between gap-6 mb-8">
            <TableOfContents sections={privacySections} />
            <button
              onClick={handlePrint}
              className="hidden md:inline-flex items-center gap-2 text-foreground-500 hover:text-foreground-700 text-sm cursor-pointer whitespace-nowrap transition-colors"
              aria-label={t('auto_d1b6f8d34a', "Print this page")}
            >
              <i className="ri-printer-line"></i>
              {t('auto_d1b6f8d34a', "Print this page")}
            </button>
          </div>

          <div className="space-y-12">
            <section id="summary">
              <div className="bg-primary-50 border-l-4 border-primary-500 rounded-r-lg p-6 md:p-8">
                <p className="text-foreground-800 text-base md:text-lg leading-relaxed">
                  {t('auto_d37c05c680', "We collect minimal data, we don't sell your information, and we use standard tools like Google Analytics to improve our content.")}
                </p>
              </div>
            </section>

            <section id="who-we-are">
              <h2 className="font-heading font-bold text-xl md:text-2xl text-foreground-900 mb-4">{t('auto_9c5b859116', "1. Who We Are")}</h2>
              <div className="prose-custom space-y-4">
                <p className="text-foreground-600 leading-relaxed">
                  {t('auto_90027cb3c5', "TABI operates")}{' '}<strong className="text-foreground-800">{t('auto_72d2721a5f', "tabi47.com")}</strong>{t('auto_e65e73dcc5', ". We provide travel guides, local recommendations, and planning resources for visitors exploring Japan beyond the typical tourist trail.")}
                </p>
                <p className="text-foreground-600 leading-relaxed">
                  {t('auto_9a77d86d5b', "For any privacy-related inquiries, you can reach us at:")}{' '}
                  <a href="mailto:privacy@tabi47.com" className="text-primary-500 hover:text-primary-600 underline cursor-pointer">
                    {t('auto_bb3ebe2be3', "privacy@tabi47.com")}
                  </a>
                </p>
              </div>
            </section>

            <section id="information-we-collect">
              <h2 className="font-heading font-bold text-xl md:text-2xl text-foreground-900 mb-4">{t('auto_21edd19047', "2. Information We Collect")}</h2>
              <div className="space-y-6">
                <div>
                  <h3 className="font-heading font-semibold text-lg text-foreground-800 mb-2">
                    <i className="ri-mail-send-line text-primary-500 mr-2"></i>
                    {t('auto_7e3a60cbd5', "Information you provide directly")}
                  </h3>
                  <p className="text-foreground-600 leading-relaxed">
                    {t('auto_f1cc8a7cf5', "When you use our contact forms, newsletter signup, experience submission forms, or ambassador applications, we collect the information you choose to share — such as your name and email address.")}
                  </p>
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-lg text-foreground-800 mb-2">
                    <i className="ri-computer-line text-primary-500 mr-2"></i>
                    {t('auto_8a91412513', "Information collected automatically")}
                  </h3>
                  <p className="text-foreground-600 leading-relaxed">
                    {t('auto_f7dbc2c90e', "When you visit our site, we automatically collect certain technical information including your anonymized IP address, browser type, pages visited, time spent on pages, and device type. This data helps us understand how visitors use our content.")}
                  </p>
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-lg text-foreground-800 mb-2">
                    <i className="ri-file-settings-line text-primary-500 mr-2"></i>
                    {t('auto_fbd829409e', "Cookies and tracking")}
                  </h3>
                  <p className="text-foreground-600 leading-relaxed">
                    {t('auto_1b45255d03', "We use cookies for Google Analytics (with IP anonymization enabled), affiliate link tracking to credit referrals, and preference cookies to remember your settings. You can disable cookies in your browser settings at any time.")}
                  </p>
                </div>
              </div>
            </section>

            <section id="how-we-use">
              <h2 className="font-heading font-bold text-xl md:text-2xl text-foreground-900 mb-4">{t('auto_983d0b75dd', "3. How We Use Your Information")}</h2>
              <div className="space-y-4">
                <ul className="space-y-3">
                  {[
                    t('auto_f46ccf0bd0', "Provide and improve our travel content and resources"),
                    t('auto_d79b5de152', "Respond to your inquiries and messages"),
                    t('auto_2ac11f6abf', "Send newsletters and updates (only if you opt in)"),
                    t('auto_bea565ce0a', "Analyze site traffic to improve our content and user experience"),
                    t('auto_ea1cf26dae', "Comply with applicable legal obligations"),
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-foreground-600 leading-relaxed">
                      <span className="text-primary-500 mt-1.5 flex-shrink-0"><i className="ri-checkbox-circle-line"></i></span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-foreground-800 font-semibold pt-2">
                  {t('auto_e80b9298a6', "We do NOT sell your personal information to any third party.")}
                </p>
              </div>
            </section>

            <section id="affiliate-links">
              <h2 className="font-heading font-bold text-xl md:text-2xl text-foreground-900 mb-4">{t('auto_3b84bb2dbd', "4. Affiliate Links")}</h2>
              <p className="text-foreground-600 leading-relaxed">
                {t('auto_f0bee5413f', "Some links on TABI are affiliate links. We earn commissions from partners including Booking.com, Klook, Viator, Airalo, JR Pass retailers, and travel insurance providers. These commissions do not affect the price you pay, and we only recommend products and services we genuinely believe in. For full details, please read our")}{' '}
                <a href="/affiliate-disclosure" className="text-primary-500 hover:text-primary-600 underline cursor-pointer">{t('auto_8f415e7989', "Affiliate Disclosure")}</a>.
              </p>
            </section>

            <section id="google-analytics">
              <h2 className="font-heading font-bold text-xl md:text-2xl text-foreground-900 mb-4">{t('auto_6b8eba5e7d', "5. Google Analytics")}</h2>
              <p className="text-foreground-600 leading-relaxed">
                {t('auto_4b7433e49b', "We use Google Analytics with IP anonymization enabled to understand how visitors interact with our content. Google Analytics uses cookies to collect anonymized usage data. You can opt out of Google Analytics tracking by installing the")}{' '}
                <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer" className="text-primary-500 hover:text-primary-600 underline cursor-pointer">
                  {t('auto_a97178f76c', "Google Analytics Opt-out Browser Add-on")}
                </a>.
              </p>
            </section>

            <section id="your-rights">
              <h2 className="font-heading font-bold text-xl md:text-2xl text-foreground-900 mb-4">{t('auto_9b0e8639cb', "6. Your Rights")}</h2>
              <p className="text-foreground-600 leading-relaxed mb-4">
                {t('auto_66b4f4dd37', "Depending on your location, you may have the following rights regarding your personal information:")}
              </p>
              <ul className="space-y-3">
                {[
                  { label: t('auto_2f81a22de0', "Access"), desc: t('auto_aed314881a', "Request a copy of the personal data we hold about you.") },
                  { label: t('auto_7f26406a3e', "Correction"), desc: t('auto_f1f4cafaa6', "Ask us to correct any inaccurate or incomplete information.") },
                  { label: t('auto_e5760a885d', "Deletion"), desc: t('auto_66a7364da9', "Request that we delete your personal data, subject to legal requirements.") },
                  { label: t('auto_0e9592f5a8', "Objection"), desc: t('auto_fea6c88994', "Object to certain processing of your personal data.") },
                  { label: t('auto_b307b88c84', "Portability"), desc: t('auto_0ddc44aac2', "Request your data in a portable, machine-readable format.") },
                ].map((right) => (
                  <li key={right.label} className="flex items-start gap-3 text-foreground-600 leading-relaxed">
                    <span className="font-semibold text-foreground-800 min-w-[100px]">{right.label}</span>
                    <span>{right.desc}</span>
                  </li>
                ))}
              </ul>
              <p className="text-foreground-600 leading-relaxed mt-4">
                {t('auto_4fad70aa25', "To exercise any of these rights, contact us at")}{' '}
                <a href="mailto:privacy@tabi47.com" className="text-primary-500 hover:text-primary-600 underline cursor-pointer">
                  {t('auto_bb3ebe2be3', "privacy@tabi47.com")}
                </a>.
              </p>
            </section>

            <section id="changes">
              <h2 className="font-heading font-bold text-xl md:text-2xl text-foreground-900 mb-4">{t('auto_54d6c4d999', "7. Changes to This Policy")}</h2>
              <p className="text-foreground-600 leading-relaxed">
                {t('auto_af6bf9b9c0', "We may update this Privacy Policy from time to time. When we make changes, we will update the date at the top of this page. We encourage you to review this policy periodically to stay informed about how we protect your information.")}
              </p>
            </section>

            <section id="contact">
              <h2 className="font-heading font-bold text-xl md:text-2xl text-foreground-900 mb-4">{t('auto_130c7a4bbd', "8. Contact")}</h2>
              <p className="text-foreground-600 leading-relaxed">
                {t('auto_39a4666005', "If you have any questions about this Privacy Policy or how we handle your data, please contact us at:")}{' '}
                <a href="mailto:privacy@tabi47.com" className="text-primary-500 hover:text-primary-600 underline cursor-pointer">
                  {t('auto_bb3ebe2be3', "privacy@tabi47.com")}
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
              {t('auto_d9c883a905', "Back to top")}
            </a>
            <span className="text-foreground-400 text-xs">{t('auto_8f12a6169f', "Last updated: June 2026")}</span>
          </div>
        </div>
      </section>

      {showBackToTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-8 right-8 w-10 h-10 bg-primary-500 hover:bg-primary-600 text-white rounded-full flex items-center justify-center shadow-lg cursor-pointer transition-all z-40"
          aria-label={t('auto_d9c883a905', "Back to top")}
        >
          <i className="ri-arrow-up-line"></i>
        </button>
      )}

      <Footer />
    </main>
  );
}
