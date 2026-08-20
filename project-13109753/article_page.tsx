import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Navbar from '@/components/feature/Navbar';
import Footer from '@/components/feature/Footer';
import ArticleHeader from './components/ArticleHeader';
import AffiliateCtaBox from './components/AffiliateCtaBox';
import ArticleContent from './components/ArticleContent';
import ArticleSidebar from './components/ArticleSidebar';
import BottomCta from './components/BottomCta';
import ExperienceForm from './components/ExperienceForm';
import RelatedArticlesGrid from './components/RelatedArticlesGrid';
import AuthorBox from './components/AuthorBox';
import { articleData } from '@/mocks/articleData';
import type { ArticleData } from './types';

export default function ArticlePage() {
  const { category, articleSlug } = useParams<{ category: string; articleSlug: string }>();
  const [article, setArticle] = useState<ArticleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setNotFound(false);
      const cat = (category || '').toLowerCase();

      const staticMatch =
        String(articleData.category).toLowerCase() === cat && articleData.articleSlug === articleSlug;

      try {
        const res = await fetch('/api/content?type=articles');
        if (res.ok) {
          const json = await res.json();
          const list = Array.isArray(json.data) ? json.data : [];
          const match = list.find(
            (a) =>
              String((a as ArticleData).category).toLowerCase() === cat &&
              (a as ArticleData).articleSlug === articleSlug
          );
          if (match) {
            if (!cancelled) setArticle(match as ArticleData);
            return;
          }
        }
      } catch {
        // fall through to static fallback
      }

      if (staticMatch) {
        if (!cancelled) setArticle(articleData as unknown as ArticleData);
      } else if (!cancelled) {
        setNotFound(true);
      }
    }

    load().finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [category, articleSlug]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? Math.min((scrollTop / docHeight) * 100, 100) : 0;
      setReadingProgress(progress);
      setShowBackToTop(scrollTop > 500);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-background-50">
        <Navbar />
        <div className="pt-24 md:pt-28 pb-24 px-6 md:px-10 lg:px-20">
          <div className="max-w-[860px] mx-auto space-y-4">
            <div className="h-8 w-40 bg-background-200 rounded animate-pulse"></div>
            <div className="h-10 w-3/4 bg-background-200 rounded animate-pulse"></div>
            <div className="h-4 w-full bg-background-200 rounded animate-pulse"></div>
            <div className="h-4 w-5/6 bg-background-200 rounded animate-pulse"></div>
            <div className="h-64 w-full bg-background-200 rounded-lg animate-pulse mt-6"></div>
          </div>
        </div>
        <Footer />
      </main>
    );
  }

  if (notFound || !article) {
    return (
      <main className="min-h-screen bg-background-50 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center px-6 py-32">
          <div className="text-center">
            <i className="ri-error-warning-line text-5xl text-foreground-300 block mb-4"></i>
            <h1 className="text-2xl font-bold text-foreground-900 font-heading mb-2">Article not found</h1>
            <p className="text-foreground-500 text-sm mb-6">
              The article you are looking for does not exist or may have been moved.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-arrow-left-line"></i>
              Back to Home
            </Link>
          </div>
        </div>
        <Footer />
      </main>
    );
  }

  const data = article;

  return (
    <main className="min-h-screen bg-background-50">
      <div className="fixed top-0 left-0 w-full h-[3px] z-[60] bg-transparent pointer-events-none">
        <div
          className="h-full bg-primary-500 transition-all duration-150 ease-out"
          style={{ width: `${readingProgress}%` }}
        />
      </div>

      <Navbar />

      <ArticleHeader
        category={data.category}
        title={data.title}
        subtitle={data.subtitle || ''}
        authorName={data.author?.name || ''}
        date={data.date || ''}
        readTime={data.readTime || ''}
        heroImage={data.heroImage || ''}
        heroCaption={data.heroCaption}
      />

      {data.affiliateCta && <AffiliateCtaBox data={data.affiliateCta} />}

      <section className="py-12 md:py-16 px-6 md:px-10 lg:px-20 bg-background-50">
        <div className="max-w-[1140px] mx-auto">
          <div className="hidden md:flex justify-end mb-4">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 text-foreground-400 hover:text-foreground-600 text-xs transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-printer-line text-sm"></i>
              Print this page
            </button>
          </div>

          <div className="flex flex-col lg:flex-row gap-10 lg:gap-12">
            <ArticleContent tocItems={data.tocItems} sections={data.sections} />

            <ArticleSidebar
              quickFacts={data.quickFacts}
              topPick={data.topPick}
              relatedArticles={data.sidebarRelatedArticles}
            />
          </div>
        </div>
      </section>

      {data.bottomCta && (
        <div className="py-10 md:py-16">
          <BottomCta data={data.bottomCta} />
        </div>
      )}

      <div className="pb-16 md:pb-24">
        <ExperienceForm />
      </div>

      {data.relatedArticles && data.relatedArticles.length > 0 && (
        <RelatedArticlesGrid articles={data.relatedArticles} />
      )}

      {data.authorBox && (
        <div className="pb-16 md:pb-24">
          <AuthorBox data={data.authorBox} />
        </div>
      )}

      <div className="text-center pb-12 px-6">
        <p className="text-foreground-400 text-xs leading-relaxed">
          Some links in this article are affiliate links.{' '}
          <a href="/affiliate-disclosure" className="text-primary-500 hover:text-primary-600 underline transition-colors cursor-pointer">
            Read our Affiliate Disclosure
          </a>.
        </p>
      </div>

      {showBackToTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-8 right-8 w-10 h-10 bg-primary-500 hover:bg-primary-600 text-white rounded-full flex items-center justify-center cursor-pointer transition-all z-40"
          aria-label="Back to top"
        >
          <i className="ri-arrow-up-line"></i>
        </button>
      )}

      <Footer />
    </main>
  );
}