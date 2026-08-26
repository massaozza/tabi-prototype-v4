import { Link } from 'react-router-dom';
import Navbar from '@/components/feature/Navbar';
import Footer from '@/components/feature/Footer';
import { useAuth } from '@/context/AuthContext';

export default function SharePage() {
  const { user } = useAuth();

  return (
    <main className="min-h-screen bg-background-50">
      <Navbar />

      <section className="bg-background-900 pt-24 md:pt-32 pb-16 md:pb-20">
        <div className="max-w-5xl mx-auto px-6 md:px-10 lg:px-20 text-center">
          <nav
            className="flex items-center justify-center gap-2 text-white/50 text-xs mb-6 flex-wrap"
            aria-label="Breadcrumb"
          >
            <Link to="/" className="hover:text-white/80 transition-colors whitespace-nowrap">
              Home
            </Link>
            <span className="text-white/30">/</span>
            <span className="text-white whitespace-nowrap">Share</span>
          </nav>

          <span className="inline-block text-xs font-semibold tracking-widest uppercase text-accent-400 mb-3">
            Give back to the community
          </span>
          <h1 className="font-heading font-bold text-3xl md:text-5xl text-white leading-tight mb-4">
            Share what <span className="text-primary-400">you know</span>
          </h1>
          <p className="text-white/60 text-base max-w-xl mx-auto leading-relaxed">
            Whichever kind of traveler you are, your knowledge is valuable to someone
            planning their trip to Japan right now.
          </p>
        </div>
      </section>

      <section className="py-16 md:py-24 px-6 md:px-10 lg:px-20">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          <div className="bg-background-50 border border-background-200 rounded-2xl p-8 md:p-10 flex flex-col">
            <span className="w-14 h-14 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center mb-6">
              <i className="ri-suitcase-3-line text-2xl"></i>
            </span>
            <span className="inline-block text-xs font-semibold tracking-widest uppercase text-primary-600 mb-2">
              For Foreign Travelers
            </span>
            <h2 className="font-heading font-bold text-2xl text-foreground-900 mb-3">
              Share your Trip
            </h2>
            <p className="text-foreground-600 text-sm leading-relaxed mb-8 flex-1">
              Already been to Japan? Share your actual route, real costs, and honest
              feedback — what worked, what didn't, and what you'd change next time.
              The next traveler can save your Trip and customize it with AI.
            </p>
            <Link
              to={user ? '/trips' : '/login'}
              className="inline-flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm px-6 py-3 rounded-lg transition-colors whitespace-nowrap"
            >
              <i className="ri-arrow-right-line"></i>
              {user ? 'Go to My Trips' : 'Log in to share your Trip'}
            </Link>
          </div>

          <div className="bg-background-50 border border-background-200 rounded-2xl p-8 md:p-10 flex flex-col">
            <span className="w-14 h-14 rounded-full bg-accent-100 text-accent-700 flex items-center justify-center mb-6">
              <i className="ri-heart-line text-2xl"></i>
            </span>
            <span className="inline-block text-xs font-semibold tracking-widest uppercase text-accent-700 mb-2">
              For Japanese Locals
            </span>
            <h2 className="font-heading font-bold text-2xl text-foreground-900 mb-3">
              Share your Japan
            </h2>
            <p className="text-foreground-600 text-sm leading-relaxed mb-8 flex-1">
              Know a great local spot or a hidden gem in your area? Write it in
              Japanese — no need to translate. TABI AI will bring your knowledge to
              travelers around the world.
            </p>
            <Link
              to={user ? '/guides/new' : '/login'}
              className="inline-flex items-center justify-center gap-2 bg-accent-600 hover:bg-accent-700 text-white font-semibold text-sm px-6 py-3 rounded-lg transition-colors whitespace-nowrap"
            >
              <i className="ri-arrow-right-line"></i>
              {user ? 'Share your Japan' : 'Log in to share your Japan'}
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
