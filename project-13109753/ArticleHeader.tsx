interface ArticleHeaderProps {
  category: string;
  title: string;
  subtitle: string;
  authorName: string;
  date: string;
  readTime: string;
  heroImage: string;
  heroCaption?: string;
}

export default function ArticleHeader({
  category,
  title,
  subtitle,
  authorName,
  date,
  readTime,
  heroImage,
  heroCaption,
}: ArticleHeaderProps) {
  const categorySlug = category.toLowerCase().replace(/\s+/g, '-');

  return (
    <section className="bg-background-900 pt-24 md:pt-28 pb-0">
      <div className="max-w-[960px] mx-auto px-6 md:px-10">
        <nav className="flex items-center gap-2 text-white/50 text-xs mb-6 flex-wrap" aria-label="Breadcrumb">
          <a href="/" className="hover:text-white/80 transition-colors cursor-pointer whitespace-nowrap">Home</a>
          <span className="text-white/30">/</span>
          <a href={`/${categorySlug}`} className="hover:text-white/80 transition-colors cursor-pointer whitespace-nowrap">{category}</a>
          <span className="text-white/30">/</span>
          <span className="text-white line-clamp-1">{title}</span>
        </nav>

        <span className="inline-block bg-primary-100/20 text-primary-300 text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap mb-4">
          {category.toUpperCase()}
        </span>

        <h1 className="font-heading font-bold text-2xl md:text-[36px] lg:text-[40px] text-white leading-tight mb-4 max-w-3xl">
          {title}
        </h1>

        {subtitle && (
          <p className="text-white/60 text-base md:text-lg leading-relaxed mb-6 max-w-2xl">
            {subtitle}
          </p>
        )}

        <div className="flex items-center gap-3 text-white/50 text-[13px] pb-8 flex-wrap">
          {authorName && <span>{authorName}</span>}
          {authorName && date && <span className="text-white/20">·</span>}
          {date && <span>{date}</span>}
          {(authorName || date) && readTime && <span className="text-white/20">·</span>}
          {readTime && <span>{readTime}</span>}
        </div>
      </div>

      <div className="max-w-[1140px] mx-auto px-0 md:px-10">
        {heroImage && (
          <div className="w-full aspect-[16/9] overflow-hidden">
            <img
              src={heroImage}
              alt={title}
              title={`${title} — TABI`}
              className="w-full h-full object-cover object-top"
            />
          </div>
        )}
        {heroCaption && (
          <p className="text-foreground-400 text-xs mt-3 px-6 md:px-0 italic">
            {heroCaption}
          </p>
        )}
      </div>
    </section>
  );
}