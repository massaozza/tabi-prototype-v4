export interface TocItem {
  number: string;
  title: string;
  id: string;
}

export interface Section {
  type:
    | 'h2'
    | 'h3'
    | 'paragraph'
    | 'pro-tip'
    | 'warning'
    | 'image'
    | 'comparison-table'
    | 'ordered-list';
  id?: string;
  text?: string;
  src?: string;
  caption?: string;
  alt?: string;
  headers?: string[];
  rows?: string[][];
  items?: string[];
}

export interface FactItem {
  label: string;
  value: string;
}

export interface QuickFactsData {
  title?: string;
  items?: FactItem[];
}

export interface AffiliateCtaData {
  label?: string;
  title?: string;
  description?: string;
  price?: string;
  buttonText?: string;
  partnerName?: string;
  reviewLinkText?: string;
}

export interface TopPickData {
  title?: string;
  productName?: string;
  rating?: number;
  description?: string;
  buttonText?: string;
  guaranteeText?: string;
}

export interface SidebarRelatedData {
  title: string;
  category: string;
  image: string;
  href: string;
}

export interface BottomCtaData {
  title?: string;
  description?: string;
  primaryButtonText?: string;
  secondaryButtonText?: string;
  disclaimer?: string;
}

export interface RelatedData {
  id?: string;
  title: string;
  category: string;
  description: string;
  image: string;
  href: string;
}

export interface AuthorBoxData {
  name?: string;
  bio?: string;
  avatar?: string;
  articlesHref?: string;
}

export interface ArticleData {
  id?: string;
  category: string;
  articleSlug: string;
  title: string;
  subtitle?: string;
  author?: { name?: string; bio?: string; avatar?: string };
  date?: string;
  dateISO?: string;
  readTime?: string;
  heroImage?: string;
  heroCaption?: string;
  tocItems?: TocItem[];
  sections?: Section[];
  affiliateCta?: AffiliateCtaData;
  quickFacts?: QuickFactsData;
  topPick?: TopPickData;
  sidebarRelatedArticles?: SidebarRelatedData[];
  bottomCta?: BottomCtaData;
  relatedArticles?: RelatedData[];
  authorBox?: AuthorBoxData;
}