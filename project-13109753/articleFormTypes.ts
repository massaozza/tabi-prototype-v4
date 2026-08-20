export type SectionType =
  | 'h2'
  | 'h3'
  | 'paragraph'
  | 'image'
  | 'pro-tip'
  | 'warning'
  | 'comparison-table'
  | 'ordered-list';

export interface BodySection {
  id: string;
  type: SectionType;
  content: string;
  caption?: string;
}

export interface FactItem {
  label: string;
  value: string;
}

export interface AffiliateCtaInput {
  label: string;
  title: string;
  description: string;
  price: string;
  buttonText: string;
  partnerName: string;
}

export interface TopPickInput {
  title: string;
  productName: string;
  rating: number;
  description: string;
  buttonText: string;
  guaranteeText: string;
}

export interface BottomCtaInput {
  title: string;
  description: string;
  primaryButtonText: string;
  secondaryButtonText: string;
  disclaimer: string;
}

export interface SidebarRelatedArticleInput {
  title: string;
  category: string;
  image: string;
  href: string;
}

export interface RelatedArticleInput {
  title: string;
  category: string;
  description: string;
  image: string;
  href: string;
}

export interface OptionalFields {
  subtitle?: string;
  authorBio?: string;
  authorAvatar?: string;
  affiliateCta?: AffiliateCtaInput;
  quickFacts?: FactItem[];
  topPick?: TopPickInput;
  bottomCta?: BottomCtaInput;
  sidebarRelatedArticles?: SidebarRelatedArticleInput[];
  relatedArticles?: RelatedArticleInput[];
}

export interface ArticleFormData {
  title: string;
  slug: string;
  category: string;
  tier: number;
  targetKeyword: string;
  assignedTo: string;
  status: string;
  author: string;
  metaTitle: string;
  metaDescription: string;
  heroImage: string;
  bodySections: BodySection[];
  subtitle?: string;
  authorBio?: string;
  authorAvatar?: string;
  affiliateCta?: AffiliateCtaInput;
  quickFacts?: FactItem[];
  topPick?: TopPickInput;
  bottomCta?: BottomCtaInput;
  sidebarRelatedArticles?: SidebarRelatedArticleInput[];
  relatedArticles?: RelatedArticleInput[];
}