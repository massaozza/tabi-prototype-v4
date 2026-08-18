import type { ContentItem } from '../page';

interface ContentListProps {
  items: ContentItem[];
  activeTab: string;
  onEdit: (item: ContentItem) => void;
  onDelete: (id: string) => void;
}

export default function ContentList({ items, activeTab, onEdit, onDelete }: ContentListProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-full bg-background-200 flex items-center justify-center mx-auto mb-4">
          <i className="ri-database-2-line text-foreground-400 text-2xl"></i>
        </div>
        <p className="text-foreground-500 text-sm">No items found. Click &quot;Add New&quot; to create one.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((item) => (
        <div key={item.id} className="bg-background-50 rounded-xl overflow-hidden border border-background-200/70">
          <div className="relative h-40 bg-background-200">
            {item.image && (
              <img
                src={item.image}
                alt={item.title}
                className="w-full h-full object-cover object-top"
              />
            )}
            {activeTab !== 'localsPlaces' && item.category && (
              <span className="absolute top-3 left-3 bg-background-50/90 text-foreground-800 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap">
                {item.category}
              </span>
            )}
          </div>
          <div className="p-4">
            <h4 className="font-heading font-bold text-sm text-foreground-900 mb-2 line-clamp-1">
              {item.title}
            </h4>
            <p className="text-foreground-600 text-xs leading-relaxed line-clamp-3 mb-4">
              {activeTab === 'localsPlaces' ? item.story : item.description}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onEdit(item)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-500 hover:text-primary-600 bg-primary-50 hover:bg-primary-100 px-3 py-1.5 rounded-md transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-edit-line"></i>
                Edit
              </button>
              <button
                onClick={() => onDelete(item.id)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-md transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-delete-bin-line"></i>
                Delete
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}