import { Link } from 'react-router-dom';

export default function ShareCtaSection() {
  return (
    <section className="py-16 md:py-24 px-6 md:px-10 lg:px-20 bg-primary-500">
      <div className="max-w-5xl mx-auto text-center">
        <h2 className="font-heading font-bold text-3xl md:text-5xl text-white leading-tight mb-4">
          Share what you know about Japan
        </h2>
        <p className="text-white/85 text-base md:text-lg leading-relaxed max-w-2xl mx-auto mb-8">
          Your real experiences and local knowledge can help someone who is planning a trip to
          Japan right now.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/share"
            className="inline-flex items-center justify-center gap-2 bg-white hover:bg-background-100 text-primary-600 font-semibold text-sm px-8 py-3.5 rounded-md transition-all duration-200 whitespace-nowrap cursor-pointer"
          >
            <i className="ri-route-line"></i>
            Share your Trip
          </Link>
          <Link
            to="/share"
            className="inline-flex items-center justify-center gap-2 border-2 border-white text-white hover:bg-white/10 font-semibold text-sm px-8 py-3.5 rounded-md transition-all duration-200 whitespace-nowrap cursor-pointer"
          >
            <i className="ri-edit-line"></i>
            Share your Japan
          </Link>
        </div>
      </div>
    </section>
  );
}