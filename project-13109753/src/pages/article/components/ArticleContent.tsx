import { useEffect, useRef, useState } from 'react';

interface TocItem {
  number: string;
  title: string;
  id: string;
}

interface ComparisonTable {
  type: 'comparison-table';
  headers: string[];
  rows: string[][];
}

interface OrderedList {
  type: 'ordered-list';
  items: string[];
}

interface ContentBlock {
  type: 'h2' | 'h3' | 'paragraph' | 'pro-tip' | 'warning' | 'image' | 'comparison-table' | 'ordered-list';
  id?: string;
  text?: string;
  src?: string;
  caption?: string;
  alt?: string;
  headers?: string[];
  rows?: string[][];
  items?: string[];
}

interface ArticleContentProps {
  tocItems?: TocItem[];
  sections?: ContentBlock[];
}

function renderContentBlock(block: ContentBlock, index: number) {
  switch (block.type) {
    case 'h2':
      return (
        <h2
          key={index}
          id={block.id}
          className="font-heading font-bold text-xl md:text-[22px] text-foreground-900 mt-10 mb-4 pb-2 border-b-2 border-primary-500"
        >
          {block.text}
        </h2>
      );

    case 'h3':
      return (
        <h3
          key={index}
          id={block.id}
          className="font-heading font-semibold text-lg md:text-[18px] text-foreground-900 mt-7 mb-3"
        >
          {block.text}
        </h3>
      );

    case 'paragraph':
      return (
        <p
          key={index}
          className="text-foreground-700 text-[15px] md:text-base leading-[1.8] mb-5"
          dangerouslySetInnerHTML={{ __html: block.text || '' }}
        />
      );

    case 'pro-tip':
      return (
        <div key={index} className="bg-primary-50 border-l-4 border-primary-500 rounded-r-lg p-4 md:p-5 mb-6">
          <span className="text-xs font-bold tracking-wider uppercase text-primary-500 mb-2 block">
            Pro Tip
          </span>
          <p className="text-foreground-700 text-sm leading-relaxed">
            {block.text}
          </p>
        </div>
      );

    case 'warning':
      return (
        <div key={index} className="bg-accent-50 border-l-4 border-accent-500 rounded-r-lg p-4 md:p-5 mb-6">
          <span className="text-xs font-bold tracking-wider uppercase text-accent-600 mb-2 block">
            Heads Up
          </span>
          <p className="text-foreground-700 text-sm leading-relaxed">
            {block.text}
          </p>
        </div>
      );

    case 'image':
      return (
        <figure key={index} className="mb-6">
          <div className="w-full rounded-lg overflow-hidden">
            <img
              src={block.src}
              alt={block.alt || ''}
              title={block.alt || 'TABI'}
              className="w-full h-auto object-cover object-top"
              loading="lazy"
            />
          </div>
          {block.caption && (
            <figcaption className="text-foreground-400 text-xs mt-2 italic">
              {block.caption}
            </figcaption>
          )}
        </figure>
      );

    case 'comparison-table':
      return (
        <div key={index} className="mb-6 overflow-x-auto rounded-lg border border-background-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-background-900 text-white">
                {block.headers?.map((header, hIdx) => (
                  <th key={hIdx} className="text-left px-4 py-3 font-semibold text-xs whitespace-nowrap">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows?.map((row, rIdx) => (
                <tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-background-50' : 'bg-background-100'}>
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-4 py-3 text-foreground-700 whitespace-nowrap">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case 'ordered-list':
      return (
        <ol key={index} className="list-decimal list-inside space-y-2 mb-6 text-foreground-700 text-[15px] md:text-base leading-relaxed pl-1">
          {block.items?.map((item, iIdx) => (
            <li key={iIdx}>{item}</li>
          ))}
        </ol>
      );

    default:
      return null;
  }
}

export default function ArticleContent({ tocItems, sections }: ArticleContentProps) {
  const [activeId, setActiveId] = useState<string>('');
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const headingIds = sections
      ?.filter((s) => s.type === 'h2' && s.id)
      .map((s) => s.id!) || [];

    if (headingIds.length === 0) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: '-80px 0px -70% 0px' }
    );

    headingIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observerRef.current?.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, [sections]);

  return (
    <div className="flex-1 min-w-0">
      {tocItems && tocItems.length > 0 && (
        <div className="bg-background-50 border border-background-200 rounded-lg p-5 mb-10">
          <h4 className="font-heading font-bold text-sm text-foreground-900 mb-4">
            In This Guide
          </h4>
          <nav className="space-y-2">
            {tocItems.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className={`flex items-center gap-3 text-sm transition-colors cursor-pointer group ${
                  activeId === item.id
                    ? 'text-primary-500 font-semibold'
                    : 'text-foreground-600 hover:text-primary-500'
                }`}
              >
                <span className="text-xs font-mono text-foreground-400 w-5 flex-shrink-0">
                  {item.number}
                </span>
                <span className="leading-snug">{item.title}</span>
              </a>
            ))}
          </nav>
        </div>
      )}

      <div id="review">
        {sections?.map((block, index) => renderContentBlock(block, index))}
      </div>
    </div>
  );
}