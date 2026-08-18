interface BottomCtaProps {
  title: string;
  description: string;
  primaryButtonText: string;
  secondaryButtonText: string;
  disclaimer: string;
}

export default function BottomCta({
  title,
  description,
  primaryButtonText,
  secondaryButtonText,
  disclaimer,
}: BottomCtaProps) {
  return (
    <section className="px-6 md:px-10 lg:px-20 bg-background-50">
      <div className="max-w-[860px] mx-auto">
        <div className="bg-background-900 rounded-xl p-8 md:p-10 text-center" data-product-shop>
          <h3 className="font-heading font-bold text-xl md:text-2xl text-white mb-4">
            {title}
          </h3>
          <p className="text-white/70 text-sm md:text-base leading-relaxed mb-6 max-w-xl mx-auto">
            {description}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-4">
            <a
              href="#"
              className="inline-flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm px-6 py-3 rounded-md transition-all duration-200 whitespace-nowrap cursor-pointer w-full sm:w-auto"
            >
              {primaryButtonText}
              <i className="ri-arrow-right-line"></i>
            </a>
            <a
              href="#"
              className="inline-flex items-center justify-center gap-2 border border-white/30 hover:border-white/60 text-white font-semibold text-sm px-6 py-3 rounded-md transition-all duration-200 whitespace-nowrap cursor-pointer w-full sm:w-auto"
            >
              {secondaryButtonText}
            </a>
          </div>
          <p className="text-white/30 text-[10px]">
            {disclaimer}
          </p>
        </div>
      </div>
    </section>
  );
}