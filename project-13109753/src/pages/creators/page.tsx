import { Link } from 'react-router-dom';
import CreatorNavbar from '@/components/feature/CreatorNavbar';
import Footer from '@/components/feature/Footer';
import { useAuth } from '@/context/AuthContext';

// TABI 3.0：日本人クリエイター向けHOME。
// 既存の英語・外国人向けHOMEとは別の、独立した「面」として用意する。
export default function CreatorsHomePage() {
  const { user } = useAuth();

  return (
    <main className="min-h-screen bg-background-50">
      <CreatorNavbar />

      <section className="bg-gradient-to-b from-foreground-900 to-foreground-800 pt-16 pb-20 md:pt-24 md:pb-28">
        <div className="max-w-4xl mx-auto px-6 md:px-10 text-center">
          <span className="inline-block text-xs font-semibold tracking-widest uppercase text-accent-400 mb-4">
            TABI Creators
          </span>
          <h1 className="font-heading font-bold text-3xl md:text-5xl text-white leading-tight mb-5">
            あなたの日本を、<br className="sm:hidden" />
            世界の旅に。
          </h1>
          <p className="text-white/70 text-base md:text-lg max-w-xl mx-auto leading-relaxed">
            あなたが知っている日本の魅力を、世界中の旅行者に届けましょう。
            日本語で書くだけで、AIが翻訳・整形します。
          </p>
        </div>
      </section>

      <section className="py-14 md:py-20 px-6 md:px-10">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link
            to={user ? '/my-trip' : '/login'}
            className="group flex flex-col bg-background-50 border border-background-200 rounded-2xl p-7 hover:-translate-y-1 hover:shadow-md transition-all duration-300 cursor-pointer"
          >
            <span className="w-12 h-12 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center mb-5">
              <i className="ri-map-2-line text-xl"></i>
            </span>
            <h2 className="font-heading font-bold text-lg text-foreground-900 mb-2">
              旅程を作る
            </h2>
            <p className="text-foreground-500 text-sm leading-relaxed flex-1">
              実際に旅行していなくても、「こう巡ってほしい」というおすすめの
              旅程を設計して公開できます。
            </p>
            <span className="mt-5 inline-flex items-center gap-1 text-primary-500 font-semibold text-sm group-hover:gap-2 transition-all">
              はじめる
              <i className="ri-arrow-right-line"></i>
            </span>
          </Link>

          <Link
            to={user ? '/guides/new' : '/login'}
            className="group flex flex-col bg-background-50 border border-background-200 rounded-2xl p-7 hover:-translate-y-1 hover:shadow-md transition-all duration-300 cursor-pointer"
          >
            <span className="w-12 h-12 rounded-full bg-accent-100 text-accent-700 flex items-center justify-center mb-5">
              <i className="ri-map-pin-line text-xl"></i>
            </span>
            <h2 className="font-heading font-bold text-lg text-foreground-900 mb-2">
              SPOTの口コミを書く
            </h2>
            <p className="text-foreground-500 text-sm leading-relaxed flex-1">
              地元ならではのおすすめスポットを、実在する場所を検索して
              紹介できます。
            </p>
            <span className="mt-5 inline-flex items-center gap-1 text-accent-700 font-semibold text-sm group-hover:gap-2 transition-all">
              はじめる
              <i className="ri-arrow-right-line"></i>
            </span>
          </Link>

          <Link
            to={user ? '/experiences/new' : '/login'}
            className="group flex flex-col bg-background-50 border border-background-200 rounded-2xl p-7 hover:-translate-y-1 hover:shadow-md transition-all duration-300 cursor-pointer"
          >
            <span className="w-12 h-12 rounded-full bg-secondary-100 text-secondary-700 flex items-center justify-center mb-5">
              <i className="ri-camera-3-line text-xl"></i>
            </span>
            <h2 className="font-heading font-bold text-lg text-foreground-900 mb-2">
              体験を投稿する
            </h2>
            <p className="text-foreground-500 text-sm leading-relaxed flex-1">
              写真とともに、実際に体験したことを短く投稿できます。
            </p>
            <span className="mt-5 inline-flex items-center gap-1 text-secondary-700 font-semibold text-sm group-hover:gap-2 transition-all">
              はじめる
              <i className="ri-arrow-right-line"></i>
            </span>
          </Link>
        </div>

        {user && (
          <div className="max-w-5xl mx-auto mt-10 text-center">
            <Link
              to="/creators/dashboard"
              className="inline-flex items-center gap-2 text-foreground-600 hover:text-foreground-900 font-semibold text-sm transition-colors"
            >
              <i className="ri-dashboard-line"></i>
              マイページ（投稿・実績の確認）へ
            </Link>
          </div>
        )}
      </section>

      <Footer />
    </main>
  );
}
