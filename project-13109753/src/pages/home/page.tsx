import Navbar from '@/components/feature/Navbar';
import Footer from '@/components/feature/Footer';
import HeroSection from './components/HeroSection';
import CopyableTripsSection from './components/CopyableTripsSection';
import JapanMapSection from './components/JapanMapSection';
import DestinationsSection from './components/DestinationsSection';
import LocalsRecommendSection from './components/LocalsRecommendSection';
import HowItWorksSection from './components/HowItWorksSection';
import FeaturesSection from './components/FeaturesSection';

// TABI47：TOPページの構成（2026.09 再設計）
//
// 設計の狙い：初訪問者を「My Tripに何かを保存した状態」まで最短で運ぶ。
// そのため、抽象的な理念よりも「保存したくなる具体的なもの」を前に置き、
// 理念（How it works / Why TABI47）は納得した人が読む後方に配置している。
//
// 1. HeroSection        … 3秒で理解 ＋ Plan with AI / Explore Japan の2入口
// 2. CopyableTripsSection … ワンクリックでMy Tripが作られる導線（最重要）
// 3. JapanMapSection    … 47都道府県から探す
// 4. DestinationsSection … 具体的な目的地
// 5. LocalsRecommendSection … 日本人Creatorの一次情報
// 6. HowItWorksSection  … Plan→Travel→Actual Trip→Shareの循環
// 7. FeaturesSection    … Why TABI47（3つの価値提案）
//
// 旧BrandPhilosophySectionは、FeaturesSection（Why TABI47）と内容が
// 重複していたため構成から外している（コンポーネント自体は残存）。
// 旧ShareCtaSection（日本人Creator向けの投稿誘導）は、外国人Traveler向けの
// TOPには不適切なため外し、/creators側に集約する。

export default function Home() {
  return (
    <main className="min-h-screen bg-background-50">
      <Navbar />
      <HeroSection />
      <CopyableTripsSection />
      <JapanMapSection />
      <DestinationsSection />
      <LocalsRecommendSection />
      <HowItWorksSection />
      <FeaturesSection />
      <Footer />
    </main>
  );
}
