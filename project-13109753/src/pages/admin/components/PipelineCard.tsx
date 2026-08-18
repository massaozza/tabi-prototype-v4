import StatusBadge from './StatusBadge';

interface PipelineCardProps {
  id: string;
  title: string;
  assignedTo: string;
  category: string;
  tier: number;
  dueDate?: string;
  onMove?: (articleId: string, newStatus: string) => void;
}

export default function PipelineCard({ id, title, assignedTo, category, tier, dueDate }: PipelineCardProps) {
  const tierColors: Record<number, string> = {
    1: 'bg-primary-100 text-primary-700',
    2: 'bg-secondary-100 text-secondary-700',
    3: 'bg-foreground-200 text-foreground-600',
    4: 'bg-accent-100 text-accent-700',
  };

  const tierLabel = `Tier ${tier}`;

  return (
    <div className="bg-background-50 rounded-lg border border-background-200 p-3 cursor-pointer hover:border-background-300 transition-colors">
      <p className="text-sm font-medium text-foreground-900 leading-snug line-clamp-2">{title}</p>
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${tierColors[tier] || tierColors[3]}`}>
          {tierLabel}
        </span>
        <span className="text-[10px] text-foreground-500 bg-background-100 px-2 py-0.5 rounded-full">{category}</span>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-foreground-500 whitespace-nowrap">{assignedTo}</span>
        {dueDate && (
          <span className="text-xs text-accent-600 font-medium whitespace-nowrap">Due {dueDate}</span>
        )}
      </div>
    </div>
  );
}