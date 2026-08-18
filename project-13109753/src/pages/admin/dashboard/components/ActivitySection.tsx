import { activityFeed } from '@/mocks/adminData';

export default function ActivitySection() {
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHrs < 1) return 'Just now';
    if (diffHrs < 24) return `${diffHrs}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const typeIcons: Record<string, string> = {
    published: 'ri-check-double-line text-green-500',
    review: 'ri-eye-line text-accent-500',
    edited: 'ri-edit-line text-foreground-500',
    generating: 'ri-robot-line text-primary-500',
    needs_update: 'ri-alert-line text-red-500',
  };

  return (
    <div className="bg-background-50 rounded-lg border border-background-200 p-5">
      <h3 className="text-sm font-semibold text-foreground-900 mb-4 font-heading">Recent Activity</h3>
      <div className="space-y-3">
        {activityFeed.map((activity) => (
          <div key={activity.id} className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-background-200 flex items-center justify-center flex-shrink-0 mt-0.5">
              <i className={`${typeIcons[activity.type] || 'ri-record-circle-line text-foreground-400'} text-sm`}></i>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground-900">
                <strong className="font-medium">{activity.user}</strong>
                {' '}
                <span className="text-xs text-foreground-500">{activity.action}</span>
              </p>
              <p className="text-xs text-foreground-600 mt-0.5 line-clamp-1">{activity.target}</p>
              <p className="text-[10px] text-foreground-400 mt-0.5">{formatTime(activity.timestamp)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}