import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
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

export default function ArticlePage() {
  const { category, articleSlug } = useParams<{ category: string; articleSlug: string }>();
  const [readingProgress, setReadingProgress] = useState(0);
  const [showBackToTop, setShowBackToTop] = useState(false);

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

  const data = articleData;

  return (
    <main className="min-h-screen bg-background-50">
      {/* Reading Progress Bar */}
      <div className="fixed top-0 left-0 w-full h-[3px] z-[60] bg-transparent pointer-events-none">
        <div
          className="h-full bg-primary-500 transition-all duration-150 ease-out"
          style={{ width: `${readingProgress}%` }}
        />
      </div>

      <Navbar />

      {/* Part 1: Article Header */}
      <ArticleHeader
        category={data.category}
        title={data.title}
        subtitle={data.subtitle}
        authorName={data.author.name}
        date={data.date}
        readTime={data.readTime}
        heroImage={data.heroImage}
        heroCaption={data.heroCaption}
      />

      {/* Part 2: Affiliate CTA Box */}
      <AffiliateCtaBox
        label={data.affiliateCta.label}
        title={data.affiliateCta.title}
        description={data.affiliateCta.description}
        price={data.affiliateCta.price}
        buttonText={data.affiliateCta.buttonText}
        reviewLinkText={data.affiliateCta.reviewLinkText}
      />

      {/* Part 3: Two-Column Layout */}
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
            {/* Left: Article Body */}
            <ArticleContent
              tocItems={data.tocItems}
              sections={data.sections}
            />

            {/* Right: Sidebar */}
            <ArticleSidebar
              quickFacts={data.quickFacts}
              topPick={data.topPick}
              relatedArticles={data.sidebarRelatedArticles}
            />
          </div>
        </div>
      </section>

      {/* Part 4: Bottom Affiliate CTA */}
      <div className="py-10 md:py-16">
        <BottomCta
          title={data.bottomCta.title}
          description={data.bottomCta.description}
          primaryButtonText={data.bottomCta.primaryButtonText}
          secondaryButtonText={data.bottomCta.secondaryButtonText}
          disclaimer={data.bottomCta.disclaimer}
        />
      </div>

      {/* Part 5: Experience Submission Form */}
      <div className="pb-16 md:pb-24">
        <ExperienceForm />
      </div>

      {/* Part 6: Related Articles Grid */}
      <RelatedArticlesGrid articles={data.relatedArticles} />

      {/* Part 7: Author Box */}
      <div className="pb-16 md:pb-24">
        <AuthorBox
          name={data.authorBox.name}
          bio={data.authorBox.bio}
          avatar={data.authorBox.avatar}
          articlesHref={data.authorBox.articlesHref}
        />
      </div>

      {/* Part 8: Footer Disclaimer */}
      <div className="text-center pb-12 px-6">
        <p className="text-foreground-400 text-xs leading-relaxed">
          Some links in this article are affiliate links.{' '}
          <a href="/affiliate-disclosure" className="text-primary-500 hover:text-primary-600 underline transition-colors cursor-pointer">
            Read our Affiliate Disclosure
          </a>.
        </p>
      </div>

      {/* Back to top */}
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