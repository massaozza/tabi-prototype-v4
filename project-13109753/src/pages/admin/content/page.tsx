import { useState, useEffect } from 'react';
import ContentList from './components/ContentList';
import { PREFECTURE_REGIONS } from '@/mocks/prefectureData';

type ContentTab = 'localsPlaces' | 'latestGuides' | 'destinations';

export interface ContentItem {
  id: string;
  title: string;
  image: string;
  story?: string;
  category?: string;
  description?: string;
  href?: string;
  prefecture?: string;
}

const TAB_LABELS: Record<ContentTab, string> = {
  localsPlaces: 'Local Places',
  latestGuides: 'Latest Guides',
  destinations: 'Destinations',
};

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function ContentPage() {
  const [activeTab, setActiveTab] = useState<ContentTab>('localsPlaces');
  const [items, setItems] = useState<ContentItem[]>([]);
  const [originalItems, setOriginalItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null);
  const [isNewItem, setIsNewItem] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const [formTitle, setFormTitle] = useState('');
  const [formImage, setFormImage] = useState('');
  const [formStory, setFormStory] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formHref, setFormHref] = useState('');
  const [formPrefecture, setFormPrefecture] = useState('');

  const hasChanges = JSON.stringify(items) !== JSON.stringify(originalItems);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      setLoading(true);
      setSaveStatus(null);
      try {
        const res = await fetch(`/api/content?type=${activeTab}`);
        if (!res.ok) throw new Error('Failed to fetch');
        const json = await res.json();
        if (!cancelled && Array.isArray(json.data)) {
          setItems(json.data);
          setOriginalItems(JSON.parse(JSON.stringify(json.data)));
        }
      } catch {
        if (!cancelled) {
          setItems([]);
          setOriginalItems([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, [activeTab]);

  const openAddForm = () => {
    setFormTitle('');
    setFormImage('');
    setFormStory('');
    setFormCategory('');
    setFormDescription('');
    setFormHref('');
    setFormPrefecture('');
    setIsNewItem(true);
    setEditingItem(null);
    setShowForm(true);
  };

  const openEditForm = (item: ContentItem) => {
    setFormTitle(item.title);
    setFormImage(item.image);
    setFormStory(item.story || '');
    setFormCategory(item.category || '');
    setFormDescription(item.description || '');
    setFormHref(item.href || '');
    setFormPrefecture(item.prefecture || '');
    setIsNewItem(false);
    setEditingItem(item);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingItem(null);
  };

  const saveForm = () => {
    const trimmedTitle = formTitle.trim();
    const trimmedImage = formImage.trim();
    if (!trimmedTitle || !trimmedImage) return;

    const updatedItem: ContentItem = {
      id: isNewItem ? generateId() : (editingItem?.id || generateId()),
      title: trimmedTitle,
      image: trimmedImage,
      ...(activeTab === 'localsPlaces' ? { story: formStory.trim() } : {}),
      ...(activeTab !== 'localsPlaces' ? { category: formCategory.trim(), description: formDescription.trim() } : {}),
      ...(activeTab === 'latestGuides' ? { href: formHref.trim() } : {}),
      ...(activeTab === 'destinations' ? { prefecture: formPrefecture.trim() } : {}),
    };

    if (isNewItem) {
      setItems((prev) => [...prev, updatedItem]);
    } else {
      setItems((prev) => prev.map((i) => (i.id === updatedItem.id ? updatedItem : i)));
    }
    closeForm();
  };

  const confirmDelete = (id: string) => {
    setDeleteTargetId(id);
    setShowDeleteDialog(true);
  };

  const executeDelete = () => {
    if (deleteTargetId) {
      setItems((prev) => prev.filter((i) => i.id !== deleteTargetId));
    }
    setShowDeleteDialog(false);
    setDeleteTargetId(null);
  };

  const handleSaveAll = async () => {
    setSaving(true);
    setSaveStatus(null);
    try {
      const res = await fetch('/api/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: activeTab, data: items }),
      });
      if (!res.ok) throw new Error('Failed to save');
      const json = await res.json();
      if (json.success) {
        setOriginalItems(JSON.parse(JSON.stringify(items)));
        setSaveStatus({ type: 'success', message: 'Saved successfully!' });
        setTimeout(() => setSaveStatus(null), 3000);
      } else {
        throw new Error(json.error || 'Save failed');
      }
    } catch (err) {
      setSaveStatus({ type: 'error', message: err instanceof Error ? err.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <div className="flex gap-1 bg-background-200 rounded-lg p-1 w-fit">
          {(['localsPlaces', 'latestGuides', 'destinations'] as ContentTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${activeTab === tab ? 'bg-background-50 text-foreground-900 shadow-sm' : 'text-foreground-500 hover:text-foreground-700'}`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          {saveStatus && (
            <span className={`text-sm ${saveStatus.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
              {saveStatus.message}
            </span>
          )}
          <button
            onClick={openAddForm}
            className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm px-4 py-2 rounded-md transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-add-line"></i>
            Add New
          </button>
          <button
            onClick={handleSaveAll}
            disabled={!hasChanges || saving}
            className={`inline-flex items-center gap-2 font-semibold text-sm px-4 py-2 rounded-md transition-colors whitespace-nowrap ${hasChanges ? 'bg-foreground-900 hover:bg-foreground-800 text-white cursor-pointer' : 'bg-background-300 text-foreground-400 cursor-not-allowed'}`}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-background-50 rounded-xl p-4 space-y-3">
              <div className="h-32 bg-background-200 rounded-lg animate-pulse"></div>
              <div className="h-4 w-3/4 bg-background-200 rounded animate-pulse"></div>
              <div className="h-3 w-full bg-background-200 rounded animate-pulse"></div>
            </div>
          ))}
        </div>
      ) : (
        <ContentList
          items={items}
          activeTab={activeTab}
          onEdit={openEditForm}
          onDelete={confirmDelete}
        />
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={closeForm}>
          <div className="bg-background-50 rounded-xl w-full max-w-lg mx-4 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-heading font-bold text-lg mb-5">
              {isNewItem ? 'Add New' : 'Edit'} {TAB_LABELS[activeTab]}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground-700 mb-1">Title</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-background-200 bg-background-50 text-foreground-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                  placeholder="Enter title..."
                />
              </div>
              {activeTab !== 'localsPlaces' && (
                <div>
                  <label className="block text-sm font-medium text-foreground-700 mb-1">Category</label>
                  <input
                    type="text"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-background-200 bg-background-50 text-foreground-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                    placeholder="Enter category..."
                  />
                </div>
              )}
              {activeTab === 'destinations' && (
                <div>
                  <label className="block text-sm font-medium text-foreground-700 mb-1">
                    Prefecture
                  </label>
                  <select
                    value={formPrefecture}
                    onChange={(e) => setFormPrefecture(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-background-200 bg-background-50 text-foreground-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                  >
                    <option value="">Select a prefecture...</option>
                    {PREFECTURE_REGIONS.map((region) => (
                      <optgroup key={region.slug} label={region.region}>
                        {region.prefectures.map((pref) => (
                          <option key={pref} value={pref}>
                            {pref}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <p className="text-xs text-foreground-400 mt-1">
                    Required for this destination to appear on its prefecture page.
                  </p>
                </div>
              )}
              {activeTab === 'latestGuides' && (
                <div>
                  <label className="block text-sm font-medium text-foreground-700 mb-1">Link (href)</label>
                  <input
                    type="text"
                    value={formHref}
                    onChange={(e) => setFormHref(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-background-200 bg-background-50 text-foreground-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                    placeholder="/transport/jr-pass-guide"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-foreground-700 mb-1">Image URL</label>
                <input
                  type="text"
                  value={formImage}
                  onChange={(e) => setFormImage(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-background-200 bg-background-50 text-foreground-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                  placeholder="https://..."
                />
              </div>
              {activeTab === 'localsPlaces' ? (
                <div>
                  <label className="block text-sm font-medium text-foreground-700 mb-1">Story</label>
                  <textarea
                    value={formStory}
                    onChange={(e) => setFormStory(e.target.value)}
                    rows={4}
                    maxLength={500}
                    className="w-full px-3 py-2 rounded-lg border border-background-200 bg-background-50 text-foreground-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
                    placeholder="Enter story..."
                  />
                  <p className="text-xs text-foreground-400 mt-1">{formStory.length} / 500</p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-foreground-700 mb-1">Description</label>
                  <textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    rows={4}
                    maxLength={500}
                    className="w-full px-3 py-2 rounded-lg border border-background-200 bg-background-50 text-foreground-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
                    placeholder="Enter description..."
                  />
                  <p className="text-xs text-foreground-400 mt-1">{formDescription.length} / 500</p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={closeForm}
                className="px-4 py-2 rounded-lg text-sm font-medium text-foreground-600 hover:bg-background-100 transition-colors cursor-pointer whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                onClick={saveForm}
                disabled={!formTitle.trim() || !formImage.trim()}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${formTitle.trim() && formImage.trim() ? 'bg-primary-500 hover:bg-primary-600 text-white cursor-pointer' : 'bg-background-300 text-foreground-400 cursor-not-allowed'}`}
              >
                {isNewItem ? 'Add' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowDeleteDialog(false)}>
          <div className="bg-background-50 rounded-xl w-full max-w-sm mx-4 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <i className="ri-delete-bin-line text-red-500 text-lg"></i>
              </div>
              <h3 className="font-heading font-bold text-lg text-foreground-900">Confirm Delete</h3>
            </div>
            <p className="text-sm text-foreground-600 mb-6">
              Are you sure you want to remove this item? This will only affect the current session until you save changes.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteDialog(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-foreground-600 hover:bg-background-100 transition-colors cursor-pointer whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                onClick={executeDelete}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-500 hover:bg-red-600 text-white transition-colors cursor-pointer whitespace-nowrap"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
