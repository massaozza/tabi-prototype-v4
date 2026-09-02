import { footerLinks } from '@/mocks/homeData';
import LogoMark from '@/components/feature/LogoMark';

export default function Footer() {
  return (
    <footer className="bg-background-900 text-white">
      <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-20 py-16 md:py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
          <div className="lg:col-span-2">
            <a href="/" className="flex items-center gap-3 mb-4">
              <LogoMark />
              <span className="font-heading font-bold text-xl md:text-2xl tracking-[0.08em]">
                TABI47
              </span>
            </a>
            <p className="text-white/60 text-sm leading-relaxed mb-6 max-w-sm">
              Your trusted companion for exploring Japan beyond the tourist trail. We bring you first-hand local knowledge, honest recommendations, and smart planning tools.
            </p>

            <div className="bg-background-800/50 rounded-xl p-5 max-w-md">
              <h4 className="font-heading font-semibold text-sm mb-3">Get our free Japan travel guide</h4>
              <form className="flex flex-col sm:flex-row gap-2" data-readdy-form="" action="https://readdy.ai/api/form/d8khvl7jf7p243ot2mmg" method="POST" onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const formData = new FormData(form);
                const params = new URLSearchParams();
                formData.forEach((value, key) => params.append(key, value.toString()));
                const btn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
                const originalText = btn?.textContent;
                if (btn) { btn.textContent = 'Sending...'; btn.disabled = true; }
                try {
                  await fetch(form.action, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: params.toString(),
                  });
                  if (btn) btn.textContent = 'Subscribed!';
                } catch {
                  if (btn) { btn.textContent = originalText; btn.disabled = false; }
                }
              }}>
                <input
                  type="email"
                  name="email"
                  placeholder="Your email address"
                  className="flex-1 bg-background-700/50 border border-background-600/50 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-primary-400 transition-all"
                />
                <button
                  type="submit"
                  className="bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm px-5 py-2.5 rounded-lg transition-all duration-200 whitespace-nowrap cursor-pointer"
                >
                  Subscribe
                </button>
              </form>
            </div>
          </div>

          <div>
            <h4 className="font-heading font-semibold text-sm mb-4 text-white/90 uppercase tracking-wider">
              Explore
            </h4>
            <ul className="space-y-3">
              {footerLinks.explore.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-white/55 hover:text-white transition-colors text-sm whitespace-nowrap">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-heading font-semibold text-sm mb-4 text-white/90 uppercase tracking-wider">
              Resources
            </h4>
            <ul className="space-y-3">
              {footerLinks.resources.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-white/55 hover:text-white transition-colors text-sm whitespace-nowrap">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-heading font-semibold text-sm mb-4 text-white/90 uppercase tracking-wider">
              Company
            </h4>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-white/55 hover:text-white transition-colors text-sm whitespace-nowrap">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-5">
            <p className="text-white/40 text-sm">
              &copy; 2026 TABI47. All rights reserved.
            </p>
            <div className="flex items-center gap-3">
              <a href="/privacy-policy" className="text-white/35 hover:text-white/60 transition-colors text-xs cursor-pointer">Privacy Policy</a>
              <span className="text-white/20">·</span>
              <a href="/affiliate-disclosure" className="text-white/35 hover:text-white/60 transition-colors text-xs cursor-pointer">Affiliate Disclosure</a>
              <span className="text-white/20">·</span>
              <a href="/disclaimer" className="text-white/35 hover:text-white/60 transition-colors text-xs cursor-pointer">Disclaimer</a>
            </div>
          </div>
          <div className="flex items-center gap-5">
            <a href="#" className="w-8 h-8 flex items-center justify-center text-white/50 hover:text-white transition-colors" aria-label="Instagram">
              <i className="ri-instagram-line text-lg"></i>
            </a>
            <a href="#" className="w-8 h-8 flex items-center justify-center text-white/50 hover:text-white transition-colors" aria-label="Pinterest">
              <i className="ri-pinterest-line text-lg"></i>
            </a>
            <a href="#" className="w-8 h-8 flex items-center justify-center text-white/50 hover:text-white transition-colors" aria-label="Reddit">
              <i className="ri-reddit-line text-lg"></i>
            </a>
            <a href="#" className="w-8 h-8 flex items-center justify-center text-white/50 hover:text-white transition-colors" aria-label="YouTube">
              <i className="ri-youtube-line text-lg"></i>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
