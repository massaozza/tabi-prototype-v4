import { adminStats } from '@/mocks/adminData';

export default function ProgressSection() {
  const percent = Math.round((adminStats.totalArticles / adminStats.totalTarget) * 100);

  return (
    <div className="bg-background-50 rounded-lg border border-background-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground-900 font-heading">1,000 Article Progress</h3>
        <span className="text-sm font-bold text-primary-600">{percent}%</span>
      </div>
      <div className="w-full h-4 bg-background-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary-500 rounded-full transition-all duration-500"
          style={{ width: `${percent}%` }}
        ></div>
      </div>
      <p className="mt-2 text-xs text-foreground-500">
        <strong className="text-foreground-900">{adminStats.totalArticles}</strong> / {adminStats.totalTarget} articles
      </p>
    </div>
  );
}