import StatsRow from './components/StatsRow';
import ProgressSection from './components/ProgressSection';
import PipelineSection from './components/PipelineSection';
import ActivitySection from './components/ActivitySection';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground-900 font-heading">Dashboard</h1>
        <p className="text-sm text-foreground-500 mt-1">Overview of Japan Quest Guide content operations</p>
      </div>

      <StatsRow />

      <ProgressSection />

      <PipelineSection />

      <ActivitySection />
    </div>
  );
}