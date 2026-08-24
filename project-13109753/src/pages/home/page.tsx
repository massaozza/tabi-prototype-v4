import Navbar from '@/components/feature/Navbar';
import Footer from '@/components/feature/Footer';
import HeroSection from './components/HeroSection';
import BrandPhilosophySection from './components/BrandPhilosophySection';
import JapanMapSection from './components/JapanMapSection';
import DestinationsSection from './components/DestinationsSection';
import FeaturedSection from './components/FeaturedSection';
// Budget Calculator section temporarily disabled (2026.08) — keep component file intact
// import BudgetCalculatorSection from './components/BudgetCalculatorSection';
import LocalsRecommendSection from './components/LocalsRecommendSection';
import LatestGuidesSection from './components/LatestGuidesSection';
import FeaturesSection from './components/FeaturesSection';

export default function Home() {
  return (
    <main className="min-h-screen bg-background-50">
      <Navbar />
      <HeroSection />
      <BrandPhilosophySection />
      <JapanMapSection />
      <DestinationsSection />
      <FeaturedSection />
      {/* Budget Calculator section temporarily hidden */}
      {/* <BudgetCalculatorSection /> */}
      <LocalsRecommendSection />
      <LatestGuidesSection />
      <FeaturesSection />
      <Footer />
    </main>
  );
}
