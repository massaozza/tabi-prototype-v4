interface AffiliateCtaBoxProps {
  label: string;
  title: string;
  description: string;
  price?: string;
  buttonText: string;
  reviewLinkText: string;
}

export default function AffiliateCtaBox({
  label,
  title,
  description,
  price,
  buttonText,
  reviewLinkText,
}: AffiliateCtaBoxProps) {
  return (
    <section className="px-6 md:px-10 lg:px-20 bg-background-50 pt-10 pb-6">
      <div className="max-w-[860px] mx-auto">
        <div className="bg-primary-50 border-l-4 border-primary-500 rounded-r-lg p-5 md:p-6" data-product-shop>
          <span className="text-[11px] font-semibold tracking-wider uppercase text-primary-600 mb-2 block">
            {label}
          </span>
          <h3 className="font-heading font-bold text-lg md:text-xl text-foreground-900 mb-2">
            {title}
          </h3>
          <p className="text-foreground-600 text-sm leading-relaxed mb-2">
            {description}
          </p>
          {price && (
            <p className="text-primary-600 font-semibold text-sm mb-4">
              {price}
            </p>
          )}
          <a
            href="#"
            className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm px-6 py-3 rounded-md transition-all duration-200 whitespace-nowrap cursor-pointer w-full sm:w-auto justify-center"
          >
            {buttonText}
            <i className="ri-arrow-right-line"></i>
          </a>
          <a
            href="#review"
            className="inline-block text-primary-500 hover:text-primary-600 text-xs mt-3 transition-colors cursor-pointer"
          >
            {reviewLinkText}
          </a>
        </div>
      </div>
    </section>
  );
}