import { Link } from 'react-router-dom';
import CreatorNavbar from '@/components/feature/CreatorNavbar';
import Footer from '@/components/feature/Footer';
import { useAuth } from '@/context/AuthContext';

export default function CreatorsHomePage() {
  const { user } = useAuth();

  return (
    <main className="min-h-screen bg-background-50">
      <CreatorNavbar />

      <section className="relative pt-16 pb-20 md:pt-28 md:pb-32 overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="https://readdy.ai/api/search-image?query=Serene%20Japanese%20landscape%20with%20a%20red%20torii%20gate%20and%20Mount%20Fuji%20at%20golden%20hour%2C%20soft%20gradient%20sky%20in%20warm%20amber%20and%20deep%20indigo%2C%20delicate%20cherry%20blossom%20petals%20floating%20in%20the%20air%2C%20misty%20atmosphere%2C%20artistic%20digital%20illustration%2C%20elegant%20minimal%20composition%2C%20high%20detail%2C%20cinematic%20lighting&width=1600&height=900&seq=creators-hero-01&orientation=landscape"
            alt="日本の風景"
            title="日本の風景 TABI Creators"
            className="w-full h-full object-cover object-top"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-foreground-950/85 via-foreground-900/70 to-foreground-800/85"></div>
        </div>

        <div className="relative max-w-4xl mx-auto px-6 md:px-10 text-center">
          <span className="inline-flex items-center gap-3 text-xs font-semibold tracking-widest uppercase text-accent-300 mb-6">
            <span className="w-10 h-px bg-accent-400/60"></span>
            TABI Creators
            <span className="w-10 h-px bg-accent-400/60"></span>
          </span>
          <h1 className="font-heading font-bold text-3xl md:text-5xl text-white leading-tight mb-6">
            あなたの日本を、<br className="sm:hidden" />
            世界の旅に。
          </h1>
          <p className="text-white/75 text-base md:text-lg max-w-xl mx-auto leading-relaxed">
            あなたが知っている日本の魅力を、世界中の旅行者に届けましょう。
            日本語で書くだけで、AIが翻訳・整形します。
          </p>
        </div>
      </section>

      <section className="py-14 md:py-20 px-6 md:px-10">
        <div className="max-w-5xl mx-auto mb-8">
          <Link
            to={user ? '/creators/guides/write' : '/login'}
            className="group relative flex flex-col sm:flex-row sm:items-center gap-5 bg-gradient-to-r from-accent-600 to-accent-700 rounded-2xl p-7 hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden text-white"
          >
            <span className="w-14 h-14 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
              <i className="ri-quill-pen-line text-2xl"></i>
            </span>
            <div className="flex-1">
              <span className="inline-block text-xs font-semibold tracking-widest uppercase text-white/70 mb-1">
                おすすめ・いちばん簡単
              </span>
              <h2 className="font-heading font-bold text-xl text-white mb-1">
                旅行記を書く
              </h2>
              <p className="text-white/80 text-sm leading-relaxed">
                いつものブログのように、自由に書くだけ。あとはAIが自動で
                読み解き、ガイドや旅程として整理します。
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-white font-semibold text-sm whitespace-nowrap group-hover:gap-2 transition-all flex-shrink-0">
              はじめる
              <i className="ri-arrow-right-line"></i>
            </span>
          </Link>
        </div>

        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link
            to={user ? '/creators/trips/new' : '/login'}
            className="group relative flex flex-col bg-background-50 border border-background-200 rounded-2xl p-7 hover:-translate-y-1.5 hover:border-primary-300 transition-all duration-300 cursor-pointer overflow-hidden"
          >
            <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary-400 to-primary-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
            <span className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 text-primary-600 flex items-center justify-center mb-5 ring-1 ring-primary-200 group-hover:scale-110 transition-transform duration-300">
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
            className="group relative flex flex-col bg-background-50 border border-background-200 rounded-2xl p-7 hover:-translate-y-1.5 hover:border-accent-300 transition-all duration-300 cursor-pointer overflow-hidden"
          >
            <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-accent-400 to-accent-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
            <span className="w-12 h-12 rounded-full bg-gradient-to-br from-accent-100 to-accent-200 text-accent-700 flex items-center justify-center mb-5 ring-1 ring-accent-200 group-hover:scale-110 transition-transform duration-300">
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
            to={user ? '/creators/experiences/new' : '/login'}
            className="group relative flex flex-col bg-background-50 border border-background-200 rounded-2xl p-7 hover:-translate-y-1.5 hover:border-secondary-300 transition-all duration-300 cursor-pointer overflow-hidden"
          >
            <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-secondary-400 to-secondary-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
            <span className="w-12 h-12 rounded-full bg-gradient-to-br from-secondary-100 to-secondary-200 text-secondary-700 flex items-center justify-center mb-5 ring-1 ring-secondary-200 group-hover:scale-110 transition-transform duration-300">
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
              className="inline-flex items-center gap-2 text-foreground-600 hover:text-foreground-900 font-semibold text-sm transition-colors group"
            >
              <i className="ri-dashboard-line group-hover:text-primary-500 transition-colors"></i>
              マイページ（投稿・実績の確認）へ
              <i className="ri-arrow-right-line text-xs opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 transition-all"></i>
            </Link>
          </div>
        )}
      </section>

      <Footer />
    </main>
  );
}
