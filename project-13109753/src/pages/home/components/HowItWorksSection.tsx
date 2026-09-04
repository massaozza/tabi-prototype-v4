import { useTranslation } from 'react-i18next';

export default function HowItWorksSection() {
  const { t } = useTranslation();

  const STEPS = [
    {
      icon: 'ri-bookmark-line',
      label: t('how_step1_label', 'Plan'),
      title: t('how_step1_title', 'Save what catches your eye'),
      description: t('how_step1_desc', 'Collect spots, restaurants and experiences into My Trip. Assign them to days — or leave them loose. Plan as much, or as little, as you want.'),
    },
    {
      icon: 'ri-footprint-line',
      label: t('how_step2_label', 'Travel'),
      title: t('how_step2_title', 'Travel your way'),
      description: t('how_step2_desc', "Skip a place, add a place, change your mind. TABI47 keeps track of what you actually did — without asking you to fill in forms while you're travelling."),
    },
    {
      icon: 'ri-sparkling-2-line',
      label: t('how_step3_label', 'Look back'),
      title: t('how_step3_title', 'Your trip, written for you'),
      description: t('how_step3_desc', 'AI turns your actual route, photos and notes into a finished trip record. Rate the places you visited in a few taps. No blank page to stare at.'),
    },
    {
      icon: 'ri-share-forward-line',
      label: t('how_step4_label', 'Pass it on'),
      title: t('how_step4_title', 'Help the next traveler'),
      description: t('how_step4_desc', "Share your real trip, and someone planning theirs can copy it as a starting point — the same way you started with someone else's."),
    },
  ];

  return (
    <section className="py-16 md:py-24 px-6 md:px-10 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-primary-600 font-semibold text-sm tracking-[0.15em] uppercase">
            {t('how_label', 'How it works')}
          </span>
          <h2 className="font-heading font-bold text-3xl md:text-5xl text-foreground-900 leading-tight mt-2">
            {t('how_title', 'Every trip makes the next one better')}
          </h2>
          <p className="text-foreground-500 text-base mt-4 leading-relaxed">
            {t('how_subtitle', 'Most travel sites end when you close the tab. On TABI47, the trips people actually take become the starting point for everyone who comes after.')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-4">
          {STEPS.map((step, idx) => (
            <div key={step.label} className="relative flex flex-col">
              {idx < STEPS.length - 1 && (
                <i className="ri-arrow-right-line hidden lg:block absolute top-6 -right-4 text-foreground-300 text-xl" aria-hidden="true"></i>
              )}
              <div className="bg-background-50 border border-background-200 rounded-xl p-6 h-full flex flex-col">
                <div className="w-12 h-12 bg-primary-50 rounded-lg flex items-center justify-center mb-4">
                  <i className={`${step.icon} text-primary-600 text-xl`}></i>
                </div>
                <span className="text-xs font-semibold text-primary-600 tracking-[0.1em] uppercase mb-2">{step.label}</span>
                <h3 className="font-heading font-bold text-base text-foreground-900 mb-2 leading-snug">{step.title}</h3>
                <p className="text-foreground-500 text-sm leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-foreground-400 text-sm mt-10 italic">
          {t('how_footer', 'The more people travel with TABI47, the better TABI47 becomes.')}
        </p>
      </div>
    </section>
  );
}
