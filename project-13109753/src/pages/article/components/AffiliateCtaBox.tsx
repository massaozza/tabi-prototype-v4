import type { AffiliateCtaData } from '../types';

interface AffiliateCtaBoxProps {
  data?: AffiliateCtaData;
  articleSlug?: string;
}

export default function AffiliateCtaBox({ data, articleSlug }: AffiliateCtaBoxProps) {
  if (!data || !data.title) return null;

  const handleCtaClick = () => {
    // クリックの記録は非同期・失敗しても無視（ユーザーの遷移をブロックしない）。
    // 実際のアフィリエイトリンクはまだ無い（href="#"のプレースホルダー）ため、
    // 現時点ではクリックの「意思」だけを記録しておき、実際のリンクに
    // 差し替わった後の収益計算にすぐ使えるようにする。
    fetch('/api/affiliate-click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        source: 'article',
        context: articleSlug,
        partnerName: data.partnerName,
        ctaLabel: data.buttonText,
      }),
    }).catch(() => {
      // ネットワークエラーは無視する
    });
  };

  return (
    <section className="px-6 md:px-10 lg:px-20 bg-background-50 pt-10 pb-6">
      <div className="max-w-[860px] mx-auto">
        <div className="bg-primary-50 border-l-4 border-primary-500 rounded-r-lg p-5 md:p-6" data-product-shop>
          {data.label && (
            <span className="text-[11px] font-semibold tracking-wider uppercase text-primary-600 mb-2 block">
              {data.label}
            </span>
          )}
          <h3 className="font-heading font-bold text-lg md:text-xl text-foreground-900 mb-2">
            {data.title}
          </h3>
          {data.description && (
            <p className="text-foreground-600 text-sm leading-relaxed mb-2">
              {data.description}
            </p>
          )}
          {data.price && (
            <p className="text-primary-600 font-semibold text-sm mb-4">
              {data.price}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {data.buttonText && (
              
                href="#"
                onClick={handleCtaClick}
                className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm px-6 py-3 rounded-md transition-all duration-200 whitespace-nowrap cursor-pointer"
              >
                {data.buttonText}
                <i className="ri-arrow-right-line"></i>
              </a>
            )}
            {data.partnerName && (
              <span className="text-foreground-400 text-xs">via {data.partnerName}</span>
            )}
          </div>
          {data.reviewLinkText && (
            
              href="#review"
              className="inline-block text-primary-500 hover:text-primary-600 text-xs mt-3 transition-colors cursor-pointer"
            >
              {data.reviewLinkText}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
