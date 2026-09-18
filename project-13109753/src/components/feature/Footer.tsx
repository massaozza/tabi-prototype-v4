import { footerLinks } from '@/mocks/homeData';
import LogoMark from '@/components/feature/LogoMark';
import { useAutoT, useAutoText } from '@/hooks/useAutoT';

export default function Footer() {
  const tx = useAutoText();
  const t = useAutoT();
  return (
    <footer className="bg-background-900 text-white">
      <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-20 py-16 md:py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
          <div className="lg:col-span-2">
            <a href="/" className="flex items-center gap-3 mb-4">
              <LogoMark />
              <span className="font-heading font-bold text-xl md:text-2xl tracking-[0.08em]">
                {t('auto_b6e4a2d1db', "TABI47")}
              </span>
            </a>
            <p className="text-white/60 text-sm leading-relaxed mb-6 max-w-sm">
              {t('auto_6656587431', "Your trusted companion for exploring Japan beyond the tourist trail. We bring you first-hand local knowledge, honest recommendations, and smart planning tools.")}
            </p>
          </div>

          <div>
            <h4 className="font-heading font-semibold text-sm mb-4 text-white/90 uppercase tracking-wider">
              {t('auto_b965ae66fc', "Explore")}
            </h4>
            <ul className="space-y-3">
              {footerLinks.explore.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-white/55 hover:text-white transition-colors text-sm whitespace-nowrap">
                    {tx(link.label)}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-heading font-semibold text-sm mb-4 text-white/90 uppercase tracking-wider">
              {t('auto_87df60de33', "Resources")}
            </h4>
            <ul className="space-y-3">
              {footerLinks.resources.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-white/55 hover:text-white transition-colors text-sm whitespace-nowrap">
                    {tx(link.label)}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-heading font-semibold text-sm mb-4 text-white/90 uppercase tracking-wider">
              {t('auto_7a1994999d', "Company")}
            </h4>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-white/55 hover:text-white transition-colors text-sm whitespace-nowrap">
                    {tx(link.label)}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-5">
            <p className="text-white/40 text-sm">
              {t('auto_6e19829941', "© 2026 TABI47. All rights reserved.")}
            </p>
            <div className="flex items-center gap-3">
              <a href="/privacy-policy" className="text-white/35 hover:text-white/60 transition-colors text-xs cursor-pointer">{t('auto_9db108ba6b', "Privacy Policy")}</a>
              <span className="text-white/20">·</span>
              <a href="/affiliate-disclosure" className="text-white/35 hover:text-white/60 transition-colors text-xs cursor-pointer">{t('auto_8f415e7989', "Affiliate Disclosure")}</a>
              <span className="text-white/20">·</span>
              <a href="/disclaimer" className="text-white/35 hover:text-white/60 transition-colors text-xs cursor-pointer">{t('auto_4c4a2e80cc', "Disclaimer")}</a>
            </div>
          </div>
          <div className="flex items-center gap-5">
            <a href="#" className="w-8 h-8 flex items-center justify-center text-white/50 hover:text-white transition-colors" aria-label={t('auto_5721bbef40', "Instagram")}>
              <i className="ri-instagram-line text-lg"></i>
            </a>
            <a href="#" className="w-8 h-8 flex items-center justify-center text-white/50 hover:text-white transition-colors" aria-label={t('auto_a45a799497', "Pinterest")}>
              <i className="ri-pinterest-line text-lg"></i>
            </a>
            <a href="#" className="w-8 h-8 flex items-center justify-center text-white/50 hover:text-white transition-colors" aria-label={t('auto_4af26436ae', "Reddit")}>
              <i className="ri-reddit-line text-lg"></i>
            </a>
            <a href="#" className="w-8 h-8 flex items-center justify-center text-white/50 hover:text-white transition-colors" aria-label={t('auto_558865a16f', "YouTube")}>
              <i className="ri-youtube-line text-lg"></i>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
