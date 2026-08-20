import type { ArticleFormData, BodySection } from '../components/articleFormTypes';

export interface PublishedSection {
  type: string;
  id?: string;
  text?: string;
  src?: string;
  caption?: string;
  headers?: string[];
  rows?: string[][];
  items?: string[];
}

export interface PublishedTocItem {
  number: string;
  title: string;
  id: string;
}

export interface PublishedArticle {
  id: string;
  category: string;
  articleSlug: string;
  title: string;
  subtitle?: string;
  author: { name: string; bio?: string; avatar?: string };
  date: string;
  dateISO: string;
  readTime: string;
  heroImage: string;
  heroCaption?: string;
  metaTitle?: string;
  metaDescription?: string;
  status?: string;
  tier?: number;
  targetKeyword?: string;
  assignedTo?: string;
  sections: PublishedSection[];
  tocItems: PublishedTocItem[];
  affiliateCta?: Record<string, string>;
  quickFacts?: { title: string; items: { label: string; value: string }[] };
  topPick?: Record<string, string | number>;
  bottomCta?: Record<string, string>;
  sidebarRelatedArticles?: { title: string; category: string; image: string; href: string }[];
  relatedArticles?: { id: string; title: string; category: string; description: string; image: string; href: string }[];
  authorBox?: { name: string; bio: string; avatar: string; articlesHref: string };
}

export function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function buildSections(bodySections: BodySection[]): PublishedSection[] {
  const sections: PublishedSection[] = [];

  for (const s of bodySections) {
    const content = (s.content || '').trim();

    switch (s.type) {
      case 'h2':
      case 'h3':
        if (!content) continue;
        sections.push({ type: s.type, id: slugify(content), text: content });
        break;

      case 'paragraph':
      case 'pro-tip':
      case 'warning':
        if (!content) continue;
        sections.push({ type: s.type, text: content });
        break;

      case 'image':
        if (!content) continue;
        sections.push({ type: 'image', src: content, caption: s.caption?.trim() || undefined });
        break;

      case 'comparison-table':
        if (!content) continue;
        try {
          const parsed = JSON.parse(content);
          if (parsed && Array.isArray(parsed.headers) && Array.isArray(parsed.rows)) {
            sections.push({ type: 'comparison-table', headers: parsed.headers, rows: parsed.rows });
          }
        } catch {
          // ignore invalid JSON and skip this section
        }
        break;

      case 'ordered-list':
        if (!content) continue;
        const items = content
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean);
        if (items.length) sections.push({ type: 'ordered-list', items });
        break;

      default:
        break;
    }
  }

  return sections;
}

function buildToc(sections: PublishedSection[]): PublishedTocItem[] {
  let counter = 0;
  return sections
    .filter((s) => s.type === 'h2' || s.type === 'h3')
    .map((s) => {
      counter += 1;
      return {
        number: String(counter).padStart(2, '0'),
        title: s.text || '',
        id: s.id || '',
      };
    });
}

function calcReadTime(sections: PublishedSection[]): string {
  let chars = 0;
  for (const s of sections) {
    if (s.text) chars += s.text.length;
    if (s.caption) chars += s.caption.length;
    if (s.items) chars += s.items.join('').length;
    if (s.headers) chars += s.headers.join('').length;
    if (s.rows) chars += s.rows.flat().join('').length;
  }
  const minutes = Math.max(1, Math.ceil(chars / 400));
  return `${minutes} min read`;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function formatDate(now: Date): { date: string; dateISO: string } {
  return {
    date: `${MONTHS[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`,
    dateISO: now.toISOString().slice(0, 10),
  };
}

export function buildArticle(form: ArticleFormData, id: string): PublishedArticle {
  const sections = buildSections(form.bodySections);
  const tocItems = buildToc(sections);
  const { date, dateISO } = formatDate(new Date());
  const readTime = calcReadTime(sections);

  const article: PublishedArticle = {
    id,
    category: form.category,
    articleSlug: form.slug,
    title: form.title,
    author: { name: form.author },
    date,
    dateISO,
    readTime,
    heroImage: form.heroImage || '',
    sections,
    tocItems,
  };

  if (form.metaTitle?.trim()) article.metaTitle = form.metaTitle.trim();
  if (form.metaDescription?.trim()) article.metaDescription = form.metaDescription.trim();
  if (form.status) article.status = form.status;
  if (form.tier !== undefined) article.tier = form.tier;
  if (form.targetKeyword?.trim()) article.targetKeyword = form.targetKeyword.trim();
  if (form.assignedTo?.trim()) article.assignedTo = form.assignedTo.trim();

  if (form.subtitle?.trim()) article.subtitle = form.subtitle.trim();

  const bio = form.authorBio?.trim();
  const avatar = form.authorAvatar?.trim();
  if (bio) article.author.bio = bio;
  if (avatar) article.author.avatar = avatar;

  const cta = form.affiliateCta;
  if (cta && (cta.title?.trim() || cta.buttonText?.trim())) {
    article.affiliateCta = {
      label: cta.label?.trim() || undefined,
      title: cta.title?.trim() || '',
      description: cta.description?.trim() || undefined,
      price: cta.price?.trim() || undefined,
      buttonText: cta.buttonText?.trim() || '',
      partnerName: cta.partnerName?.trim() || undefined,
    };
  }

  if (form.quickFacts && form.quickFacts.length) {
    const items = form.quickFacts
      .filter((f) => f.label?.trim() && f.value?.trim())
      .map((f) => ({ label: f.label.trim(), value: f.value.trim() }));
    if (items.length) article.quickFacts = { title: 'Quick Facts', items };
  }

  const topPick = form.topPick;
  if (topPick && (topPick.title?.trim() || topPick.productName?.trim())) {
    article.topPick = {
      title: topPick.title?.trim() || 'Our Top Pick',
      productName: topPick.productName?.trim() || '',
      rating: Number(topPick.rating) || 0,
      description: topPick.description?.trim() || undefined,
      buttonText: topPick.buttonText?.trim() || undefined,
      guaranteeText: topPick.guaranteeText?.trim() || undefined,
    };
  }

  const bottomCta = form.bottomCta;
  if (bottomCta && (bottomCta.title?.trim() || bottomCta.primaryButtonText?.trim())) {
    article.bottomCta = {
      title: bottomCta.title?.trim() || '',
      description: bottomCta.description?.trim() || undefined,
      primaryButtonText: bottomCta.primaryButtonText?.trim() || '',
      secondaryButtonText: bottomCta.secondaryButtonText?.trim() || undefined,
      disclaimer: bottomCta.disclaimer?.trim() || undefined,
    };
  }

  if (form.sidebarRelatedArticles && form.sidebarRelatedArticles.length) {
    const list = form.sidebarRelatedArticles
      .filter((a) => a.title?.trim())
      .map((a) => ({
        title: a.title.trim(),
        category: a.category?.trim() || '',
        image: a.image?.trim() || '',
        href: a.href?.trim() || '#',
      }));
    if (list.length) article.sidebarRelatedArticles = list;
  }

  if (form.relatedArticles && form.relatedArticles.length) {
    const list = form.relatedArticles
      .filter((a) => a.title?.trim())
      .map((a, i) => ({
        id: `related-${i + 1}`,
        title: a.title.trim(),
        category: a.category?.trim() || '',
        description: a.description?.trim() || '',
        image: a.image?.trim() || '',
        href: a.href?.trim() || '#',
      }));
    if (list.length) article.relatedArticles = list;
  }

  if (bio || avatar) {
    article.authorBox = {
      name: form.author,
      bio: bio || '',
      avatar: avatar || '',
      articlesHref: `/author/${slugify(form.author)}`,
    };
  }

  return article;
}

/**
 * 公開用の sections を、編集フォームの bodySections 形式に逆変換する。
 */
export function mapSectionsToBodySections(sections?: PublishedSection[]): BodySection[] {
  if (!sections || !sections.length) return [{ id: `sec-${Date.now()}`, type: 'paragraph', content: '' }];

  return sections.map((s, i) => {
    const base = { id: `sec-${i}-${Date.now()}` };

    switch (s.type) {
      case 'h2':
      case 'h3':
      case 'paragraph':
      case 'pro-tip':
      case 'warning':
        return { ...base, type: s.type, content: s.text || '' };
      case 'image':
        return { ...base, type: 'image', content: s.src || '', caption: s.caption || '' };
      case 'comparison-table':
        return {
          ...base,
          type: 'comparison-table',
          content: JSON.stringify({ headers: s.headers || [], rows: s.rows || [] }),
        };
      case 'ordered-list':
        return { ...base, type: 'ordered-list', content: (s.items || []).join('\n') };
      default:
        return { ...base, type: 'paragraph', content: '' };
    }
  });
}