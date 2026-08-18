interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  change?: { value: string; positive: boolean };
  icon: string;
  iconBg: string;
  iconColor: string;
}

export default function StatCard({ title, value, subtitle, change, icon, iconBg, iconColor }: StatCardProps) {
  return (
    <div className="bg-background-50 rounded-lg border border-background-200 p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground-500 whitespace-nowrap">{title}</p>
          <p className="mt-2 text-3xl font-bold font-heading text-foreground-900 tracking-tight">{value}</p>
          {subtitle && (
            <p className="mt-1 text-xs text-foreground-500 whitespace-nowrap">{subtitle}</p>
          )}
          {change && (
            <p className={`mt-2 text-xs font-medium whitespace-nowrap ${change.positive ? 'text-green-600' : 'text-red-600'}`}>
              <span className="inline-block mr-1">{change.positive ? '↑' : '↓'}</span>
              {change.value}
            </p>
          )}
        </div>
        <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0 ml-3`}>
          <i className={`${icon} ${iconColor} text-lg`}></i>
        </div>
      </div>
    </div>
  );
}