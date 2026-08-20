import type { QuickFactsData, TopPickData, SidebarRelatedData } from '../types';

interface ArticleSidebarProps {
  quickFacts?: QuickFactsData;
  topPick?: TopPickData;
  relatedArticles?: SidebarRelatedData[];
}

export default function ArticleSidebar({ quickFacts, topPick, relatedArticles }: ArticleSidebarProps) {
  const hasQuickFacts = quickFacts && quickFacts.items && quickFacts.items.length > 0;
  const hasRelated = relatedArticles && relatedArticles.length > 0;

  if (!hasQuickFacts && !topPick && !hasRelated) return null;

  return (
    <aside className="w-full lg:w-[320px] flex-shrink-0">
      <div className="lg:sticky lg:top-24 space-y-6">

        {hasQuickFacts && (
          <div className="bg-background-50 border border-background-200 rounded-lg p-5">
            <h4 className="font-heading font-bold text-sm text-foreground-900 mb-4">
              {quickFacts?.title || 'Quick Facts'}
            </h4>
            <dl className="space-y-3">
              {(quickFacts?.items || []).map((item, idx) => (
                <div key={idx}>
                  <dt className="text-foreground-400 text-xs mb-0.5">{item.label}</dt>
                  <dd className="text-foreground-800 text-sm font-medium">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {topPick && (
          <div className="bg-background-50 border-2 border-primary-500 rounded-lg p-5" data-product-shop>
            {topPick.title && (
              <h4 className="font-heading font-bold text-sm text-foreground-900 mb-1">
                {topPick.title}
              </h4>
            )}
            {topPick.productName && (
              <p className="font-heading font-bold text-base text-foreground-900 mb-2">
                {topPick.productName}
              </p>
            )}
            {typeof topPick.rating === 'number' && topPick.rating > 0 && (
              <div className="flex items-center gap-0.5 mb-2">
                {Array.from({ length: topPick.rating }).map((_, i) => (
                  <div key={i} className="w-4 h-4 flex items-center justify-center text-accent-500">
                    <i className="ri-star-fill text-sm"></i>
                  </div>
                ))}
              </div>
            )}
            {topPick.description && (
              <p className="text-foreground-600 text-xs leading-relaxed mb-4">
                {topPick.description}
              </p>
            )}
            {topPick.buttonText && (
              <a
                href="#"
                className="flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm px-4 py-2.5 rounded-md transition-all duration-200 whitespace-nowrap cursor-pointer w-full"
              >
                {topPick.buttonText}
                <i className="ri-arrow-right-line"></i>
              </a>
            )}
            {topPick.guaranteeText && (
              <p className="text-foreground-400 text-[11px] mt-2 text-center">
                {topPick.guaranteeText}
              </p>
            )}
          </div>
        )}

        {hasRelated && (
          <div className="bg-background-50 border border-background-200 rounded-lg p-5">
            <h4 className="font-heading font-bold text-sm text-foreground-900 mb-4">
              You Might Also Like
            </h4>
            <div className="space-y-4">
              {(relatedArticles || []).map((article, idx) => (
                <a
                  key={idx}
                  href={article.href}
                  className="flex gap-3 group cursor-pointer"
                >
                  {article.image && (
                    <div className="w-20 h-[60px] flex-shrink-0 rounded-md overflow-hidden">
                      <img
                        src={article.image}
                        alt={article.title}
                        className="w-full h-full object-cover object-top"
                        loading="lazy"
                      />
                    </div>
                  )}
                  <div className="min-w-0">
                    {article.category && (
                      <span className="text-[10px] font-semibold text-primary-500 uppercase tracking-wider block mb-1">
                        {article.category}
                      </span>
                    )}
                    <span className="text-foreground-800 text-[13px] font-semibold leading-snug line-clamp-2 group-hover:text-primary-500 transition-colors">
                      {article.title}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

      </div>
    </aside>
  );
}