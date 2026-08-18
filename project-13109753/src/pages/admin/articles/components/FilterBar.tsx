import { statusOptions, categories, teamMembers } from '@/mocks/adminData';

export interface Filters {
  search: string;
  status: string;
  category: string;
  assignedTo: string;
  sort: string;
}

interface FilterBarProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  totalResults: number;
}

export default function FilterBar({ filters, onChange, totalResults }: FilterBarProps) {
  const update = (key: keyof Filters, value: string) => {
    onChange({ ...filters, [key]: value });
  };

  const clearAll = () => {
    onChange({
      search: '',
      status: '',
      category: '',
      assignedTo: '',
      sort: 'date-desc',
    });
  };

  const hasFilters = filters.search || filters.status || filters.category || filters.assignedTo;

  return (
    <div className="bg-background-50 rounded-lg border border-background-200 p-4 space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400 text-sm"></i>
          <input
            type="text"
            value={filters.search}
            onChange={(e) => update('search', e.target.value)}
            placeholder="Search by title or keyword..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-background-300 rounded-lg bg-background-50 text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
          />
        </div>

        <select
          value={filters.status}
          onChange={(e) => update('status', e.target.value)}
          className="px-3 py-2 text-sm border border-background-300 rounded-lg bg-background-50 text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400 cursor-pointer"
        >
          <option value="">All Status</option>
          {statusOptions.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        <select
          value={filters.category}
          onChange={(e) => update('category', e.target.value)}
          className="px-3 py-2 text-sm border border-background-300 rounded-lg bg-background-50 text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400 cursor-pointer"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>

        <select
          value={filters.assignedTo}
          onChange={(e) => update('assignedTo', e.target.value)}
          className="px-3 py-2 text-sm border border-background-300 rounded-lg bg-background-50 text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400 cursor-pointer"
        >
          <option value="">All Members</option>
          {teamMembers.map((m) => (
            <option key={m.id} value={m.name}>{m.name}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="text-xs text-foreground-500 whitespace-nowrap">
            <strong className="text-foreground-900">{totalResults}</strong> articles found
          </span>

          {hasFilters && (
            <button
              onClick={clearAll}
              className="text-xs text-primary-500 hover:text-primary-600 cursor-pointer whitespace-nowrap"
            >
              Clear all filters
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-foreground-500 whitespace-nowrap">Sort:</span>
          <select
            value={filters.sort}
            onChange={(e) => update('sort', e.target.value)}
            className="px-2 py-1.5 text-xs border border-background-300 rounded-lg bg-background-50 text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400 cursor-pointer"
          >
            <option value="date-desc">Newest First</option>
            <option value="date-asc">Oldest First</option>
            <option value="pv-desc">Highest PV</option>
            <option value="pv-asc">Lowest PV</option>
            <option value="revenue-desc">Highest Revenue</option>
            <option value="status">By Status</option>
          </select>
        </div>
      </div>
    </div>
  );
}