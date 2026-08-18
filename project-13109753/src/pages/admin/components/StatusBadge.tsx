import { statusOptions } from '@/mocks/adminData';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const option = statusOptions.find((s) => s.value === status);
  const colorClass = option ? option.color : 'bg-foreground-200 text-foreground-600';
  const label = option ? option.label : status;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${colorClass} ${className}`}>
      {label}
    </span>
  );
}