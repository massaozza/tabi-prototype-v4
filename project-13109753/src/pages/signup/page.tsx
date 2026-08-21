import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '@/components/feature/Navbar';
import Footer from '@/components/feature/Footer';
import { useAuth } from '@/context/AuthContext';

export default function SignupPage() {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const result = await signup(email, password, displayName);
    setSubmitting(false);
    if (result.success) {
      navigate('/');
    } else {
      setError(result.error || 'Signup failed');
    }
  };

  const inputClass =
    'w-full bg-background-50 border border-background-200 rounded-md px-4 py-3 text-sm text-foreground-900 placeholder:text-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400 transition-all';

  return (
    <main className="min-h-screen bg-background-50">
      <Navbar />

      {/* Page Header */}
      <section className="bg-background-900 pt-24 md:pt-28 pb-16 md:pb-20 px-6 md:px-10">
        <div className="max-w-[960px] mx-auto text-center">
          <nav
            className="flex items-center justify-center gap-2 text-white/50 text-xs mb-6"
            aria-label="Breadcrumb"
          >
            <a href="/" className="hover:text-white/80 transition-colors cursor-pointer">
              Home
            </a>
            <span className="text-white/30">/</span>
            <span className="text-white">Sign up</span>
          </nav>
          <h1 className="font-heading font-bold text-3xl md:text-4xl text-white mt-3 leading-tight">
            Join TABI
          </h1>
          <p className="text-white/60 text-sm md:text-base mt-3 max-w-md mx-auto">
            Create an account to save your favorite destinations and plan your Japan trip.
          </p>
        </div>
      </section>

      {/* Form */}
      <section className="py-16 md:py-24 px-6 md:px-10">
        <div className="max-w-md mx-auto">
          <div className="bg-background-50 border border-background-200 rounded-lg p-6 md:p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="displayName"
                  className="block font-heading font-semibold text-sm text-foreground-700 mb-2"
                >
                  Display Name
                </label>
                <input
                  id="displayName"
                  name="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  required
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="block font-heading font-semibold text-sm text-foreground-700 mb-2"
                >
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block font-heading font-semibold text-sm text-foreground-700 mb-2"
                >
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                  minLength={8}
                  className={inputClass}
                />
                <p className="text-foreground-400 text-xs mt-2">
                  Must be at least 8 characters.
                </p>
              </div>

              {error && (
                <div className="bg-primary-50 border border-primary-200 rounded-md px-4 py-3 text-sm text-primary-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-primary-500 hover:bg-primary-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm px-6 py-3 rounded-md transition-all duration-200 whitespace-nowrap cursor-pointer"
              >
                {submitting ? 'Creating account...' : 'Create account'}
              </button>
            </form>
          </div>

          <p className="text-center text-sm text-foreground-500 mt-6">
            Already have an account?{' '}
            
              href="/login"
              className="text-primary-500 hover:text-primary-600 font-semibold transition-colors cursor-pointer"
            >
              Log in
            </a>
          </p>
        </div>
      </section>

      <Footer />
    </main>
  );
}
