import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const categoryColors: Record<string, string> = {
  Food: 'bg-accent-100 text-accent-800',
  Transport: 'bg-secondary-100 text-secondary-800',
  Activities: 'bg-primary-100 text-primary-800',
  'Hidden Gems': 'bg-accent-50 text-accent-700',
};

interface Article {
  id: string;
  category: string;
  articleSlug: string;
  title: string;
  subtitle?: string;
  heroImage?: string;
  dateISO?: string;
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default function FeaturedSection() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [featuredIds, setFeaturedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const [articlesRes, featuredRes] = await Promise.all([
          fetch('/api/content?type=articles'),
          fetch('/api/content?type=featuredArticleIds'),
        ]);
        if (!articlesRes.ok || !featuredRes.ok) throw new Error('Failed to fetch');
        const articlesJson = await articlesRes.json();
        const featuredJson = await featuredRes.json();
        if (!cancelled) {
          setArticles(Array.isArray(articlesJson.data) ? articlesJson.data : []);
          setFeaturedIds(
            Array.isArray(featuredJson.data)
              ? featuredJson.data.filter((x): x is string => typeof x === 'string')
              : []
          );
        }
      } catch {
        if (!cancelled) {
          setArticles([]);
          setFeaturedIds([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    fetchData();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return null;

  const featured = featuredIds
    .map((id) => articles.find((a) => a.id === id || a.articleSlug === id))
    .filter((a): a is Article => Boolean(a));

  if (featured.length === 0) return null;

  return (
    <section className="py-16 md:py-24 px-6 md:px-10 lg:px-20 bg-background-50">
      <div className="max-w-7xl mx-auto">
        <div className="mb-12">
          <span className="inline-block text-xs font-semibold tracking-widest uppercase text-accent-600 mb-3">
            Featured
          </span>
          <h2 className="font-heading font-bold text-3xl md:text-5xl text-foreground-900 leading-tight">
            Editor&apos;s <span className="text-primary-500">Picks</span>
          </h2>
          <p className="text-foreground-500 text-base mt-3 max-w-xl">
            Hand-picked guides our editors think you should read first
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {featured.map((article) => {
            const href = `/${slugify(article.category)}/${slugify(article.articleSlug || article.id)}`;
            return (
              <article
                key={article.id}
                className="group bg-background-100 rounded-xl overflow-hidden transition-all duration-300 hover:-translate-y-1 cursor-pointer"
              >
                <div className="relative w-full h-56 md:h-64 overflow-hidden">
                  <img
                    src={article.heroImage || ''}
                    alt={`${article.title} — ${article.category}`}
                    title={`${article.title} — TABI`}
                    className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                  />
                  <span className="absolute top-4 left-4 bg-background-50/90 text-foreground-800 text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap">
                    {article.category}
                  </span>
                </div>
                <div className="p-5 md:p-6">
                  <h3 className="font-heading font-bold text-xl text-foreground-900 mb-2 line-clamp-2">
                    {article.title}
                  </h3>
                  <p className="text-foreground-600 text-sm leading-relaxed mb-4 line-clamp-3">
                    {article.subtitle || ''}
                  </p>
                  <Link
                    to={href}
                    className="inline-flex items-center gap-1 text-primary-500 font-semibold text-sm hover:gap-2 transition-all duration-200 cursor-pointer whitespace-nowrap"
                  >
                    Read Guide
                    <i className="ri-arrow-right-line"></i>
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
