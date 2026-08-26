import Navbar from '@/components/feature/Navbar';
import Footer from '@/components/feature/Footer';
import HeroSection from './components/HeroSection';
import BrandPhilosophySection from './components/BrandPhilosophySection';
import JapanMapSection from './components/JapanMapSection';
import DestinationsSection from './components/DestinationsSection';
// Budget Calculator section temporarily disabled (2026.08) — keep component file intact
// import BudgetCalculatorSection from './components/BudgetCalculatorSection';
import LocalsRecommendSection from './components/LocalsRecommendSection';
import LatestGuidesSection from './components/LatestGuidesSection';
import FeaturesSection from './components/FeaturesSection';
import TripsForYouSection from './components/TripsForYouSection';
import TravelerExperiencesSection from './components/TravelerExperiencesSection';
import MeetCreatorsSection from './components/MeetCreatorsSection';
import ShareCtaSection from './components/ShareCtaSection';

export default function Home() {
  return (
    <main className="min-h-screen bg-background-50">
      <Navbar />
      <HeroSection />
      <BrandPhilosophySection />
      <TripsForYouSection />
      <LatestGuidesSection />
      <DestinationsSection />
      <JapanMapSection />
      <LocalsRecommendSection />
      <TravelerExperiencesSection />
      <MeetCreatorsSection />
      <ShareCtaSection />
      <FeaturesSection />
      {/* Budget Calculator section temporarily hidden */}
      {/* <BudgetCalculatorSection /> */}
      <Footer />
    </main>
  );
}