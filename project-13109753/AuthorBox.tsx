import type { AuthorBoxData } from '../types';

interface AuthorBoxProps {
  data?: AuthorBoxData;
}

export default function AuthorBox({ data }: AuthorBoxProps) {
  if (!data || !data.name || (!data.bio && !data.avatar)) return null;

  return (
    <section className="px-6 md:px-10 lg:px-20 bg-background-50">
      <div className="max-w-[860px] mx-auto">
        <div className="bg-background-100 border border-background-200 rounded-lg p-6 flex flex-col sm:flex-row gap-5 items-start">
          {data.avatar && (
            <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0">
              <img
                src={data.avatar}
                alt={data.name}
                title={`${data.name} — TABI Author`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          )}
          <div className="min-w-0">
            <span className="text-foreground-400 text-[11px] font-semibold uppercase tracking-wider block mb-1">
              Written by
            </span>
            <p className="font-heading font-bold text-[15px] text-foreground-900 mb-2">
              {data.name}
            </p>
            {data.bio && (
              <p className="text-foreground-500 text-sm leading-relaxed mb-3">
                {data.bio}
              </p>
            )}
            {data.articlesHref && (
              <a
                href={data.articlesHref}
                className="inline-flex items-center gap-1 text-primary-500 hover:text-primary-600 font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap"
              >
                View all articles
                <i className="ri-arrow-right-line"></i>
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}