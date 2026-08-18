export default function LogoMark({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const isLg = size === 'lg';

  return (
    <span
      className={`${isLg ? 'w-9 h-9' : 'w-7 h-7'} flex flex-col items-center justify-center shrink-0`}
      aria-hidden="true"
    >
      <span className={`${isLg ? 'w-4 h-4' : 'w-3.5 h-3.5'} rounded-full bg-[#C8402E] -mb-[2px]`} />
      <span className="w-full h-[2px] rounded-full bg-[#C8402E]" />
    </span>
  );
}