import type { BottomCtaData } from '../types';

interface BottomCtaProps {
  data?: BottomCtaData;
}

export default function BottomCta({ data }: BottomCtaProps) {
  if (!data || (!data.title && !data.primaryButtonText)) return null;

  return (
    <section className="px-6 md:px-10 lg:px-20 bg-background-50">
      <div className="max-w-[860px] mx-auto">
        <div className="bg-background-900 rounded-xl p-8 md:p-10 text-center" data-product-shop>
          {data.title && (
            <h3 className="font-heading font-bold text-xl md:text-2xl text-white mb-4">
              {data.title}
            </h3>
          )}
          {data.description && (
            <p className="text-white/70 text-sm md:text-base leading-relaxed mb-6 max-w-xl mx-auto">
              {data.description}
            </p>
          )}
          {(data.primaryButtonText || data.secondaryButtonText) && (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-4">
              {data.primaryButtonText && (
                <a
                  href="#"
                  className="inline-flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm px-6 py-3 rounded-md transition-all duration-200 whitespace-nowrap cursor-pointer w-full sm:w-auto"
                >
                  {data.primaryButtonText}
                  <i className="ri-arrow-right-line"></i>
                </a>
              )}
              {data.secondaryButtonText && (
                <a
                  href="#"
                  className="inline-flex items-center justify-center gap-2 border border-white/30 hover:border-white/60 text-white font-semibold text-sm px-6 py-3 rounded-md transition-all duration-200 whitespace-nowrap cursor-pointer w-full sm:w-auto"
                >
                  {data.secondaryButtonText}
                </a>
              )}
            </div>
          )}
          {data.disclaimer && <p className="text-white/30 text-[10px]">{data.disclaimer}</p>}
        </div>
      </div>
    </section>
  );
}