export default function LogoMark({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const isLg = size === 'lg';

  return (
    <svg
      viewBox="0 0 400 400"
      className={`${isLg ? 'w-9 h-9' : 'w-7 h-7'} shrink-0`}
      aria-hidden="true"
    >
      <circle cx="200" cy="200" r="190" fill="#D62828" />
      <path
        d="M30,160 Q200,108 370,160"
        stroke="#FFFFFF"
        strokeWidth="32"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M58,210 L342,210"
        stroke="#FFFFFF"
        strokeWidth="32"
        strokeLinecap="round"
      />
      <path
        d="M88,228 L88,360 M312,228 L312,360"
        stroke="#FFFFFF"
        strokeWidth="32"
        strokeLinecap="round"
      />
      <path
        d="M148,272 L252,272"
        stroke="#FFFFFF"
        strokeWidth="20"
        strokeLinecap="round"
      />
    </svg>
  );
}
