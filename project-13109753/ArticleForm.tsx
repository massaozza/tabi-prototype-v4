import { useState, useEffect } from 'react';
import { categories, teamMembers } from '@/mocks/adminData';
import OptionalSections from './OptionalSections';
import type { ArticleFormData, BodySection, OptionalFields } from './articleFormTypes';

export type { ArticleFormData, BodySection, BodySection as ArticleBodySection } from './articleFormTypes';

const defaultBodySection = (): BodySection => ({
  id: `sec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  type: 'paragraph',
  content: '',
});

function toOptionalFields(data?: Partial<ArticleFormData>): OptionalFields {
  if (!data) return {};
  const out: OptionalFields = {};
  if (data.subtitle !== undefined) out.subtitle = data.subtitle;
  if (data.authorBio !== undefined || data.authorAvatar !== undefined) {
    out.authorBio = data.authorBio || '';
    out.authorAvatar = data.authorAvatar || '';
  }
  if (data.affiliateCta) out.affiliateCta = data.affiliateCta;
  if (data.quickFacts) out.quickFacts = data.quickFacts;
  if (data.topPick) out.topPick = data.topPick;
  if (data.bottomCta) out.bottomCta = data.bottomCta;
  if (data.sidebarRelatedArticles) out.sidebarRelatedArticles = data.sidebarRelatedArticles;
  if (data.relatedArticles) out.relatedArticles = data.relatedArticles;
  return out;
}

interface ArticleFormProps {
  initialData?: Partial<ArticleFormData>;
  onSubmit: (data: ArticleFormData) => void;
  submitLabel?: string;
  submitting?: boolean;
}

export default function ArticleForm({ initialData, onSubmit, submitLabel = 'Save Article', submitting = false }: ArticleFormProps) {
  const [title, setTitle] = useState(initialData?.title || '');
  const [slug, setSlug] = useState(initialData?.slug || '');
  const [category, setCategory] = useState(initialData?.category || 'Transport');
  const [tier, setTier] = useState(initialData?.tier || 1);
  const [targetKeyword, setTargetKeyword] = useState(initialData?.targetKeyword || '');
  const [assignedTo, setAssignedTo] = useState(initialData?.assignedTo || teamMembers[0].name);
  const [status, setStatus] = useState(initialData?.status || 'not_started');
  const [author, setAuthor] = useState(initialData?.author || teamMembers[0].name);
  const [metaTitle, setMetaTitle] = useState(initialData?.metaTitle || '');
  const [metaDescription, setMetaDescription] = useState(initialData?.metaDescription || '');
  const [heroImage, setHeroImage] = useState(initialData?.heroImage || '');
  const [bodySections, setBodySections] = useState<BodySection[]>(initialData?.bodySections || [defaultBodySection()]);
  const [autoSlug, setAutoSlug] = useState(!initialData?.slug);
  const [optional, setOptional] = useState<OptionalFields>(() => toOptionalFields(initialData));

  useEffect(() => {
    if (autoSlug && title) {
      setSlug(title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
    }
  }, [title, autoSlug]);

  const handleSlugChange = (val: string) => {
    setAutoSlug(false);
    setSlug(val.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, ''));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      title,
      slug,
      category,
      tier,
      targetKeyword,
      assignedTo,
      status,
      author,
      metaTitle,
      metaDescription,
      heroImage,
      bodySections: bodySections.filter((s) => s.content.trim() || s.type === 'image'),
      ...optional,
    });
  };

  const updateSection = (id: string, field: keyof BodySection, value: string) => {
    setBodySections((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  const changeSectionType = (id: string, newType: BodySection['type']) => {
    setBodySections((prev) => prev.map((s) => (s.id === id ? { ...s, type: newType } : s)));
  };

  const addSection = () => {
    setBodySections((prev) => [...prev, defaultBodySection()]);
  };

  const removeSection = (id: string) => {
    setBodySections((prev) => prev.filter((s) => s.id !== id));
  };

  const moveSection = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= bodySections.length) return;
    const updated = [...bodySections];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setBodySections(updated);
  };

  const sectionTypeLabels: Record<string, string> = {
    'h2': 'H2 Heading',
    'h3': 'H3 Heading',
    'paragraph': 'Paragraph',
    'image': 'Image',
    'pro-tip': 'Pro Tip',
    'warning': 'Warning',
    'comparison-table': 'Comparison Table',
    'ordered-list': 'Ordered List',
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex gap-6">
        <div className="flex-1 min-w-0 space-y-5">
          <div className="bg-background-50 rounded-lg border border-background-200 p-5">
            <h2 className="text-sm font-semibold text-foreground-900 mb-4 font-heading">Content Editor</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground-600 mb-1">Article Title (H1)</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-background-300 rounded-lg bg-background-50 text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent font-heading font-semibold"
                  placeholder="Enter article title..."
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground-600 mb-1">URL Slug</label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-foreground-400 whitespace-nowrap">/category/</span>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border border-background-300 rounded-lg bg-background-50 text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent font-mono text-xs"
                    placeholder="article-slug"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground-600 mb-1">
                  Hero Image URL
                </label>
                <input
                  type="text"
                  value={heroImage}
                  onChange={(e) => setHeroImage(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-background-300 rounded-lg bg-background-50 text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                  placeholder="https://..."
                />
                {heroImage && (
                  <img src={heroImage} alt="Hero preview" className="mt-2 w-full h-32 object-cover rounded-lg border border-background-200" />
                )}
              </div>
            </div>
          </div>

          <div className="bg-background-50 rounded-lg border border-background-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground-900 font-heading">Article Body</h2>
              <button
                type="button"
                onClick={addSection}
                className="text-xs px-3 py-1.5 bg-primary-500 text-background-50 rounded-lg hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap"
              >
                + Add Section
              </button>
            </div>

            <div className="space-y-3">
              {bodySections.map((section, idx) => (
                <div key={section.id} className="border border-background-200 rounded-lg p-3 relative group">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <select
                      value={section.type}
                      onChange={(e) => changeSectionType(section.id, e.target.value as BodySection['type'])}
                      className="text-xs px-2 py-1 border border-background-300 rounded bg-background-50 text-foreground-700 cursor-pointer"
                    >
                      {Object.entries(sectionTypeLabels).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>

                    <div className="flex-1"></div>

                    <button
                      type="button"
                      onClick={() => moveSection(idx, 'up')}
                      disabled={idx === 0}
                      className="text-xs px-2 py-1 text-foreground-500 hover:text-foreground-900 disabled:opacity-30 cursor-pointer"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSection(idx, 'down')}
                      disabled={idx === bodySections.length - 1}
                      className="text-xs px-2 py-1 text-foreground-500 hover:text-foreground-900 disabled:opacity-30 cursor-pointer"
                    >
                      ↓
                    </button>

                    <button
                      type="button"
                      onClick={() => removeSection(section.id)}
                      className="text-xs px-2 py-1 text-red-500 hover:text-red-700 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  {section.type === 'image' ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={section.content}
                        onChange={(e) => updateSection(section.id, 'content', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-background-300 rounded-lg bg-background-50 text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                        placeholder="Image URL..."
                      />
                      <input
                        type="text"
                        value={section.caption || ''}
                        onChange={(e) => updateSection(section.id, 'caption', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-background-300 rounded-lg bg-background-50 text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                        placeholder="Image caption (optional)..."
                      />
                    </div>
                  ) : section.type === 'comparison-table' ? (
                    <div>
                      <textarea
                        value={section.content}
                        onChange={(e) => updateSection(section.id, 'content', e.target.value)}
                        rows={4}
                        className="w-full px-3 py-2 text-sm border border-background-300 rounded-lg bg-background-50 text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent resize-y"
                        placeholder="Paste table as JSON: { headers: [...], rows: [[...], ...] }"
                      />
                    </div>
                  ) : section.type === 'ordered-list' ? (
                    <textarea
                      value={section.content}
                      onChange={(e) => updateSection(section.id, 'content', e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 text-sm border border-background-300 rounded-lg bg-background-50 text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent resize-y"
                      placeholder="One item per line..."
                    />
                  ) : (
                    <textarea
                      value={section.content}
                      onChange={(e) => updateSection(section.id, 'content', e.target.value)}
                      rows={section.type === 'paragraph' ? 5 : 3}
                      className="w-full px-3 py-2 text-sm border border-background-300 rounded-lg bg-background-50 text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent resize-y"
                      placeholder={`${sectionTypeLabels[section.type]} content...`}
                    />
                  )}
                </div>
              ))}

              {bodySections.length === 0 && (
                <p className="text-sm text-foreground-400 text-center py-8">
                  No sections yet. Click &quot;+ Add Section&quot; to start building your article body.
                </p>
              )}
            </div>
          </div>

          <OptionalSections value={optional} onChange={setOptional} />
        </div>

        <div className="w-[320px] flex-shrink-0 space-y-5">
          <div className="bg-background-50 rounded-lg border border-background-200 p-5">
            <h2 className="text-sm font-semibold text-foreground-900 mb-4 font-heading">Article Settings</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground-600 mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-background-300 rounded-lg bg-background-50 text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent cursor-pointer"
                >
                  {categories.map((c) => (
                    <option key={c.value} value={c.value}>{c.label} (Tier {c.tier})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground-600 mb-1">Tier</label>
                <select
                  value={tier}
                  onChange={(e) => setTier(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-background-300 rounded-lg bg-background-50 text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent cursor-pointer"
                >
                  <option value={1}>Tier 1 — Core Content</option>
                  <option value={2}>Tier 2 — Supporting Content</option>
                  <option value={3}>Tier 3 — Niche Content</option>
                  <option value={4}>Tier 4 — Low Priority</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground-600 mb-1">Target Keyword</label>
                <input
                  type="text"
                  value={targetKeyword}
                  onChange={(e) => setTargetKeyword(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-background-300 rounded-lg bg-background-50 text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                  placeholder="e.g., JR Pass 2026 price"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground-600 mb-1">Assigned To</label>
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-background-300 rounded-lg bg-background-50 text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent cursor-pointer"
                >
                  {teamMembers.map((m) => (
                    <option key={m.id} value={m.name}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground-600 mb-1">Author</label>
                <select
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-background-300 rounded-lg bg-background-50 text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent cursor-pointer"
                >
                  {teamMembers.map((m) => (
                    <option key={m.id} value={m.name}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground-600 mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-background-300 rounded-lg bg-background-50 text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent cursor-pointer"
                >
                  <option value="not_started">未着手</option>
                  <option value="generating">AI生成中</option>
                  <option value="review">レビュー待ち</option>
                  <option value="editing">修正中</option>
                  <option value="published">公開済み</option>
                  <option value="needs_update">要更新</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-background-50 rounded-lg border border-background-200 p-5">
            <h2 className="text-sm font-semibold text-foreground-900 mb-4 font-heading">SEO</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground-600 mb-1">
                  Meta Title
                  <span className={`ml-2 ${metaTitle.length > 60 ? 'text-red-500' : 'text-foreground-400'}`}>
                    {metaTitle.length}/60
                  </span>
                </label>
                <input
                  type="text"
                  value={metaTitle}
                  onChange={(e) => setMetaTitle(e.target.value)}
                  maxLength={60}
                  className="w-full px-3 py-2 text-sm border border-background-300 rounded-lg bg-background-50 text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                  placeholder="Meta title..."
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground-600 mb-1">
                  Meta Description
                  <span className={`ml-2 ${metaDescription.length > 160 ? 'text-red-500' : 'text-foreground-400'}`}>
                    {metaDescription.length}/160
                  </span>
                </label>
                <textarea
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                  maxLength={160}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-background-300 rounded-lg bg-background-50 text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent resize-y"
                  placeholder="Meta description..."
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
              submitting
                ? 'bg-background-300 text-foreground-400 cursor-not-allowed'
                : 'bg-primary-500 text-background-50 hover:bg-primary-600 cursor-pointer'
            }`}
          >
            {submitting ? 'Saving...' : submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}