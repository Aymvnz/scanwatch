export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <rect width="32" height="32" rx="9" fill="#246B8E" />
      <circle cx="16" cy="16" r="8.5" stroke="white" strokeOpacity="0.35" strokeWidth="1.5" />
      <path d="M6.5 16.5h5l2.2-5 3.6 9 2.2-4h6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
