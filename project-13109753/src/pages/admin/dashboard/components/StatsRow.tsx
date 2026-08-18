import StatCard from '../../components/StatCard';
import { adminStats } from '@/mocks/adminData';

export default function StatsRow() {
  const publishedPercent = adminStats.totalArticles > 0
    ? Math.round((adminStats.publishedCount / adminStats.totalArticles) * 100)
    : 0;

  const pvChange = adminStats.previousMonthPV > 0
    ? Math.round(((adminStats.monthlyPV - adminStats.previousMonthPV) / adminStats.previousMonthPV) * 100)
    : 0;

  const revenuePercent = Math.round((adminStats.monthlyRevenue / adminStats.monthlyRevenueTarget) * 100);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="Total Articles"
        value={String(adminStats.totalArticles)}
        subtitle={`${adminStats.publishedCount} published · ${adminStats.draftCount} draft (${publishedPercent}%)`}
        icon="ri-article-line"
        iconBg="bg-primary-100"
        iconColor="text-primary-600"
      />
      <StatCard
        title="This Month"
        value={String(adminStats.thisMonthPublished)}
        subtitle={`Target: ${adminStats.monthlyTarget}/month`}
        icon="ri-calendar-check-line"
        iconBg="bg-secondary-100"
        iconColor="text-secondary-600"
      />
      <StatCard
        title="Monthly PV"
        value={adminStats.monthlyPV.toLocaleString()}
        icon="ri-eye-line"
        iconBg="bg-accent-100"
        iconColor="text-accent-600"
        change={{
          value: `${pvChange > 0 ? '+' : ''}${pvChange}% vs last month`,
          positive: pvChange >= 0,
        }}
      />
      <StatCard
        title="Monthly Revenue"
        value={`¥${(adminStats.monthlyRevenue / 10000).toFixed(1)}万`}
        subtitle={`${revenuePercent}% of ¥200万 target`}
        icon="ri-money-dollar-circle-line"
        iconBg="bg-green-100"
        iconColor="text-green-600"
      />
    </div>
  );
}