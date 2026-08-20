import type { RelatedData } from '../types';

interface RelatedArticlesGridProps {
  articles?: RelatedData[];
}

const categoryColors: Record<string, string> = {
  'Food': 'bg-accent-100 text-accent-800',
  'Transport': 'bg-secondary-100 text-secondary-800',
  'Activities': 'bg-primary-100 text-primary-800',
  'Culture': 'bg-accent-50 text-accent-700',
  'Travel Tips': 'bg-primary-100 text-primary-800',
  'Hidden Gems': 'bg-accent-50 text-accent-700',
};

export default function RelatedArticlesGrid({ articles }: RelatedArticlesGridProps) {
  if (!articles || articles.length === 0) return null;

  return (
    <section className="py-16 md:py-24 px-6 md:px-10 lg:px-20 bg-background-100">
      <div className="max-w-[960px] mx-auto">
        <h2 className="font-heading font-bold text-2xl md:text-3xl text-foreground-900 mb-8">
          Keep Exploring
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {articles.map((article) => (
            <article
              key={article.id || article.href || article.title}
              className="bg-background-50 rounded-xl overflow-hidden border border-background-200 hover:border-background-300 transition-all duration-300 group cursor-pointer"
              data-product-shop
            >
              <div className="relative w-full h-48 overflow-hidden">
                {article.image && (
                  <img
                    src={article.image}
                    alt={article.title}
                    title={`${article.title} — TABI`}
                    className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                )}
                {article.category && (
                  <span className={`absolute top-3 left-3 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${categoryColors[article.category] || 'bg-background-200 text-foreground-600'}`}>
                    {article.category}
                  </span>
                )}
              </div>
              <div className="p-5">
                <h3 className="font-heading font-bold text-base text-foreground-900 mb-2 leading-snug line-clamp-2 group-hover:text-primary-500 transition-colors">
                  {article.title}
                </h3>
                {article.description && (
                  <p className="text-foreground-500 text-sm leading-relaxed line-clamp-2 mb-3">
                    {article.description}
                  </p>
                )}
                <a
                  href={article.href}
                  className="inline-flex items-center gap-1 text-primary-500 font-semibold text-sm hover:gap-2 transition-all duration-200 cursor-pointer whitespace-nowrap"
                >
                  Read More
                  <i className="ri-arrow-right-line"></i>
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}