import type {
  OptionalFields,
  FactItem,
  AffiliateCtaInput,
  TopPickInput,
  BottomCtaInput,
  SidebarRelatedArticleInput,
  RelatedArticleInput,
} from './articleFormTypes';

interface OptionalSectionsProps {
  value: OptionalFields;
  onChange: (value: OptionalFields) => void;
}

interface ToggleCardProps {
  enabled: boolean;
  onToggle: () => void;
  title: string;
  hint: string;
  children: React.ReactNode;
}

function ToggleCard({ enabled, onToggle, title, hint, children }: ToggleCardProps) {
  return (
    <div className="border border-background-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-background-100 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <span
            className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
              enabled ? 'bg-primary-500' : 'bg-background-300'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                enabled ? 'translate-x-4' : ''
              }`}
            ></span>
          </span>
          <span className="text-sm font-medium text-foreground-800 text-left">{title}</span>
        </div>
        <span className="text-xs text-foreground-400 whitespace-nowrap">{enabled ? 'On' : 'Off'}</span>
      </button>
      {enabled && (
        <div className="px-4 py-3 border-t border-background-200 bg-background-50/60">
          {hint && <p className="text-xs text-foreground-400 mb-3">{hint}</p>}
          {children}
        </div>
      )}
    </div>
  );
}

const inputCls =
  'w-full px-3 py-2 text-sm border border-background-300 rounded-lg bg-background-50 text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent';
const labelCls = 'block text-xs font-medium text-foreground-600 mb-1';

export default function OptionalSections({ value, onChange }: OptionalSectionsProps) {
  const patch = (partial: Partial<OptionalFields>) => onChange({ ...value, ...partial });

  const toggleSubtitle = () => {
    if (value.subtitle !== undefined) {
      const next = { ...value };
      delete next.subtitle;
      onChange(next);
    } else {
      patch({ subtitle: '' });
    }
  };

  const toggleAuthor = () => {
    if (value.authorBio !== undefined || value.authorAvatar !== undefined) {
      const next = { ...value };
      delete next.authorBio;
      delete next.authorAvatar;
      onChange(next);
    } else {
      patch({ authorBio: '', authorAvatar: '' });
    }
  };

  const toggleAffiliateCta = () => {
    if (value.affiliateCta !== undefined) {
      const next = { ...value };
      delete next.affiliateCta;
      onChange(next);
    } else {
      patch({ affiliateCta: { label: '', title: '', description: '', price: '', buttonText: '', partnerName: '' } });
    }
  };

  const toggleQuickFacts = () => {
    if (value.quickFacts !== undefined) {
      const next = { ...value };
      delete next.quickFacts;
      onChange(next);
    } else {
      patch({ quickFacts: [{ label: '', value: '' }] });
    }
  };

  const toggleTopPick = () => {
    if (value.topPick !== undefined) {
      const next = { ...value };
      delete next.topPick;
      onChange(next);
    } else {
      patch({
        topPick: { title: '', productName: '', rating: 5, description: '', buttonText: '', guaranteeText: '' },
      });
    }
  };

  const toggleBottomCta = () => {
    if (value.bottomCta !== undefined) {
      const next = { ...value };
      delete next.bottomCta;
      onChange(next);
    } else {
      patch({
        bottomCta: { title: '', description: '', primaryButtonText: '', secondaryButtonText: '', disclaimer: '' },
      });
    }
  };

  const toggleSidebarRelated = () => {
    if (value.sidebarRelatedArticles !== undefined) {
      const next = { ...value };
      delete next.sidebarRelatedArticles;
      onChange(next);
    } else {
      patch({ sidebarRelatedArticles: [{ title: '', category: '', image: '', href: '' }] });
    }
  };

  const toggleRelated = () => {
    if (value.relatedArticles !== undefined) {
      const next = { ...value };
      delete next.relatedArticles;
      onChange(next);
    } else {
      patch({ relatedArticles: [{ title: '', category: '', description: '', image: '', href: '' }] });
    }
  };

  const updateAffiliate = (field: keyof AffiliateCtaInput, val: string) => {
    const current = value.affiliateCta ?? { label: '', title: '', description: '', price: '', buttonText: '', partnerName: '' };
    patch({ affiliateCta: { ...current, [field]: val } });
  };

  const updateTopPick = (field: keyof TopPickInput, val: string | number) => {
    const current = value.topPick ?? { title: '', productName: '', rating: 5, description: '', buttonText: '', guaranteeText: '' };
    patch({ topPick: { ...current, [field]: val } });
  };

  const updateBottomCta = (field: keyof BottomCtaInput, val: string) => {
    const current = value.bottomCta ?? { title: '', description: '', primaryButtonText: '', secondaryButtonText: '', disclaimer: '' };
    patch({ bottomCta: { ...current, [field]: val } });
  };

  const updateFact = (idx: number, field: keyof FactItem, val: string) => {
    const facts = value.quickFacts ? [...value.quickFacts] : [];
    facts[idx] = { ...facts[idx], [field]: val };
    patch({ quickFacts: facts });
  };

  const addFact = () => patch({ quickFacts: [...(value.quickFacts ?? []), { label: '', value: '' }] });
  const removeFact = (idx: number) => patch({ quickFacts: (value.quickFacts ?? []).filter((_, i) => i !== idx) });

  const updateSidebar = (idx: number, field: keyof SidebarRelatedArticleInput, val: string) => {
    const items = value.sidebarRelatedArticles ? [...value.sidebarRelatedArticles] : [];
    items[idx] = { ...items[idx], [field]: val };
    patch({ sidebarRelatedArticles: items });
  };
  const addSidebar = () =>
    patch({ sidebarRelatedArticles: [...(value.sidebarRelatedArticles ?? []), { title: '', category: '', image: '', href: '' }] });
  const removeSidebar = (idx: number) =>
    patch({ sidebarRelatedArticles: (value.sidebarRelatedArticles ?? []).filter((_, i) => i !== idx) });

  const updateRelated = (idx: number, field: keyof RelatedArticleInput, val: string) => {
    const items = value.relatedArticles ? [...value.relatedArticles] : [];
    items[idx] = { ...items[idx], [field]: val };
    patch({ relatedArticles: items });
  };
  const addRelated = () =>
    patch({ relatedArticles: [...(value.relatedArticles ?? []), { title: '', category: '', description: '', image: '', href: '' }] });
  const removeRelated = (idx: number) =>
    patch({ relatedArticles: (value.relatedArticles ?? []).filter((_, i) => i !== idx) });

  return (
    <div className="bg-background-50 rounded-lg border border-background-200 p-5">
      <h2 className="text-sm font-semibold text-foreground-900 mb-1 font-heading">Optional Sections</h2>
      <p className="text-xs text-foreground-400 mb-4">
        Toggle on any of these to add them to the article. Leaving them off will simply omit the section.
      </p>

      <div className="space-y-3">
        <ToggleCard
          enabled={value.subtitle !== undefined}
          onToggle={toggleSubtitle}
          title="Subtitle"
          hint="A short 1–2 sentence summary shown at the top of the article."
        >
          <textarea
            value={value.subtitle || ''}
            onChange={(e) => patch({ subtitle: e.target.value })}
            rows={2}
            className={inputCls}
            placeholder="Enter subtitle..."
          />
        </ToggleCard>

        <ToggleCard
          enabled={value.authorBio !== undefined || value.authorAvatar !== undefined}
          onToggle={toggleAuthor}
          title="Author Bio / Avatar"
          hint="Add a bio and avatar URL for the author box at the bottom of the article."
        >
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Author Bio</label>
              <textarea
                value={value.authorBio || ''}
                onChange={(e) => patch({ authorBio: e.target.value })}
                rows={3}
                className={inputCls}
                placeholder="Short author bio..."
              />
            </div>
            <div>
              <label className={labelCls}>Author Avatar URL</label>
              <input
                type="text"
                value={value.authorAvatar || ''}
                onChange={(e) => patch({ authorAvatar: e.target.value })}
                className={inputCls}
                placeholder="https://..."
              />
            </div>
          </div>
        </ToggleCard>

        <ToggleCard
          enabled={value.affiliateCta !== undefined}
          onToggle={toggleAffiliateCta}
          title="Affiliate CTA Box"
          hint="A highlighted recommendation box shown right after the header."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Label</label>
              <input type="text" value={value.affiliateCta?.label || ''} onChange={(e) => updateAffiliate('label', e.target.value)} className={inputCls} placeholder="QUICK RECOMMENDATION" />
            </div>
            <div>
              <label className={labelCls}>Partner Name</label>
              <input type="text" value={value.affiliateCta?.partnerName || ''} onChange={(e) => updateAffiliate('partnerName', e.target.value)} className={inputCls} placeholder="Klook" />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Title</label>
              <input type="text" value={value.affiliateCta?.title || ''} onChange={(e) => updateAffiliate('title', e.target.value)} className={inputCls} placeholder="Product title..." />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Description</label>
              <textarea value={value.affiliateCta?.description || ''} onChange={(e) => updateAffiliate('description', e.target.value)} rows={2} className={inputCls} placeholder="Short description..." />
            </div>
            <div>
              <label className={labelCls}>Price</label>
              <input type="text" value={value.affiliateCta?.price || ''} onChange={(e) => updateAffiliate('price', e.target.value)} className={inputCls} placeholder="From ¥50,000" />
            </div>
            <div>
              <label className={labelCls}>Button Text</label>
              <input type="text" value={value.affiliateCta?.buttonText || ''} onChange={(e) => updateAffiliate('buttonText', e.target.value)} className={inputCls} placeholder="Check Latest Price" />
            </div>
          </div>
        </ToggleCard>

        <ToggleCard
          enabled={value.quickFacts !== undefined}
          onToggle={toggleQuickFacts}
          title="Quick Facts"
          hint="A key-value list shown in the article sidebar."
        >
          <div className="space-y-2">
            {(value.quickFacts ?? []).map((fact, idx) => (
              <div key={idx} className="flex gap-2 items-start">
                <input
                  type="text"
                  value={fact.label}
                  onChange={(e) => updateFact(idx, 'label', e.target.value)}
                  className={`${inputCls} flex-1`}
                  placeholder="Label"
                />
                <input
                  type="text"
                  value={fact.value}
                  onChange={(e) => updateFact(idx, 'value', e.target.value)}
                  className={`${inputCls} flex-1`}
                  placeholder="Value"
                />
                <button
                  type="button"
                  onClick={() => removeFact(idx)}
                  className="w-8 h-8 flex items-center justify-center rounded text-foreground-400 hover:text-red-500 cursor-pointer flex-shrink-0"
                  title="Remove"
                >
                  <i className="ri-close-line text-sm"></i>
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addFact}
              className="text-xs px-3 py-1.5 text-primary-500 hover:text-primary-600 cursor-pointer whitespace-nowrap"
            >
              + Add Fact
            </button>
          </div>
        </ToggleCard>

        <ToggleCard
          enabled={value.topPick !== undefined}
          onToggle={toggleTopPick}
          title="Top Pick"
          hint="A featured product box shown in the sidebar."
        >
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Title</label>
              <input type="text" value={value.topPick?.title || ''} onChange={(e) => updateTopPick('title', e.target.value)} className={inputCls} placeholder="Our Top Pick" />
            </div>
            <div>
              <label className={labelCls}>Product Name</label>
              <input type="text" value={value.topPick?.productName || ''} onChange={(e) => updateTopPick('productName', e.target.value)} className={inputCls} placeholder="7-Day JR Pass (Ordinary)" />
            </div>
            <div>
              <label className={labelCls}>Rating (1–5)</label>
              <select
                value={value.topPick?.rating ?? 5}
                onChange={(e) => updateTopPick('rating', Number(e.target.value))}
                className={`${inputCls} cursor-pointer`}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Description</label>
              <textarea value={value.topPick?.description || ''} onChange={(e) => updateTopPick('description', e.target.value)} rows={2} className={inputCls} placeholder="Short description..." />
            </div>
            <div>
              <label className={labelCls}>Button Text</label>
              <input type="text" value={value.topPick?.buttonText || ''} onChange={(e) => updateTopPick('buttonText', e.target.value)} className={inputCls} placeholder="Check Price on Klook" />
            </div>
            <div>
              <label className={labelCls}>Guarantee Text</label>
              <input type="text" value={value.topPick?.guaranteeText || ''} onChange={(e) => updateTopPick('guaranteeText', e.target.value)} className={inputCls} placeholder="Free cancellation..." />
            </div>
          </div>
        </ToggleCard>

        <ToggleCard
          enabled={value.bottomCta !== undefined}
          onToggle={toggleBottomCta}
          title="Bottom CTA"
          hint="A final recommendation box shown at the end of the article."
        >
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Title</label>
              <input type="text" value={value.bottomCta?.title || ''} onChange={(e) => updateBottomCta('title', e.target.value)} className={inputCls} placeholder="Our Recommendation" />
            </div>
            <div>
              <label className={labelCls}>Description</label>
              <textarea value={value.bottomCta?.description || ''} onChange={(e) => updateBottomCta('description', e.target.value)} rows={2} className={inputCls} placeholder="Description..." />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Primary Button Text</label>
                <input type="text" value={value.bottomCta?.primaryButtonText || ''} onChange={(e) => updateBottomCta('primaryButtonText', e.target.value)} className={inputCls} placeholder="Check Price" />
              </div>
              <div>
                <label className={labelCls}>Secondary Button Text</label>
                <input type="text" value={value.bottomCta?.secondaryButtonText || ''} onChange={(e) => updateBottomCta('secondaryButtonText', e.target.value)} className={inputCls} placeholder="Compare Options" />
              </div>
            </div>
            <div>
              <label className={labelCls}>Disclaimer</label>
              <input type="text" value={value.bottomCta?.disclaimer || ''} onChange={(e) => updateBottomCta('disclaimer', e.target.value)} className={inputCls} placeholder="Affiliate link — we may earn a commission..." />
            </div>
          </div>
        </ToggleCard>

        <ToggleCard
          enabled={value.sidebarRelatedArticles !== undefined}
          onToggle={toggleSidebarRelated}
          title="Sidebar Related Articles"
          hint="Compact related article links shown in the sidebar."
        >
          <div className="space-y-3">
            {(value.sidebarRelatedArticles ?? []).map((item, idx) => (
              <div key={idx} className="border border-background-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground-500">Item {idx + 1}</span>
                  <button type="button" onClick={() => removeSidebar(idx)} className="text-foreground-400 hover:text-red-500 cursor-pointer" title="Remove">
                    <i className="ri-close-line text-sm"></i>
                  </button>
                </div>
                <input type="text" value={item.title} onChange={(e) => updateSidebar(idx, 'title', e.target.value)} className={inputCls} placeholder="Title" />
                <input type="text" value={item.category} onChange={(e) => updateSidebar(idx, 'category', e.target.value)} className={inputCls} placeholder="Category" />
                <input type="text" value={item.image} onChange={(e) => updateSidebar(idx, 'image', e.target.value)} className={inputCls} placeholder="Image URL" />
                <input type="text" value={item.href} onChange={(e) => updateSidebar(idx, 'href', e.target.value)} className={inputCls} placeholder="Link (href)" />
              </div>
            ))}
            <button type="button" onClick={addSidebar} className="text-xs px-3 py-1.5 text-primary-500 hover:text-primary-600 cursor-pointer whitespace-nowrap">
              + Add
            </button>
          </div>
        </ToggleCard>

        <ToggleCard
          enabled={value.relatedArticles !== undefined}
          onToggle={toggleRelated}
          title="Related Articles (Grid)"
          hint="A grid of related articles shown after the main content."
        >
          <div className="space-y-3">
            {(value.relatedArticles ?? []).map((item, idx) => (
              <div key={idx} className="border border-background-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground-500">Item {idx + 1}</span>
                  <button type="button" onClick={() => removeRelated(idx)} className="text-foreground-400 hover:text-red-500 cursor-pointer" title="Remove">
                    <i className="ri-close-line text-sm"></i>
                  </button>
                </div>
                <input type="text" value={item.title} onChange={(e) => updateRelated(idx, 'title', e.target.value)} className={inputCls} placeholder="Title" />
                <input type="text" value={item.category} onChange={(e) => updateRelated(idx, 'category', e.target.value)} className={inputCls} placeholder="Category" />
                <textarea value={item.description} onChange={(e) => updateRelated(idx, 'description', e.target.value)} rows={2} className={inputCls} placeholder="Description" />
                <input type="text" value={item.image} onChange={(e) => updateRelated(idx, 'image', e.target.value)} className={inputCls} placeholder="Image URL" />
                <input type="text" value={item.href} onChange={(e) => updateRelated(idx, 'href', e.target.value)} className={inputCls} placeholder="Link (href)" />
              </div>
            ))}
            <button type="button" onClick={addRelated} className="text-xs px-3 py-1.5 text-primary-500 hover:text-primary-600 cursor-pointer whitespace-nowrap">
              + Add
            </button>
          </div>
        </ToggleCard>
      </div>
    </div>
  );
}