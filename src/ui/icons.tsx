type P = { className?: string };

const base = "w-[1.15em] h-[1.15em]";

export const IconPlay = ({ className = "" }: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={`${base} ${className}`}>
    <path d="M8 5.14v13.72c0 .8.87 1.29 1.55.87l10.8-6.86a1.03 1.03 0 0 0 0-1.74L9.55 4.27A1.03 1.03 0 0 0 8 5.14Z" />
  </svg>
);

export const IconPause = ({ className = "" }: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={`${base} ${className}`}>
    <rect x="6" y="4.5" width="4.2" height="15" rx="1.6" />
    <rect x="13.8" y="4.5" width="4.2" height="15" rx="1.6" />
  </svg>
);

export const IconPrev = ({ className = "" }: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={`${base} ${className}`}>
    <rect x="4.5" y="5" width="2.8" height="14" rx="1.3" />
    <path d="M19.5 6.2v11.6c0 .82-.92 1.3-1.6.85l-8.6-5.8a1.03 1.03 0 0 1 0-1.7l8.6-5.8c.68-.46 1.6.03 1.6.85Z" />
  </svg>
);

export const IconNext = ({ className = "" }: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={`${base} ${className}`}>
    <rect x="16.7" y="5" width="2.8" height="14" rx="1.3" />
    <path d="M4.5 6.2v11.6c0 .82.92 1.3 1.6.85l8.6-5.8a1.03 1.03 0 0 0 0-1.7l-8.6-5.8c-.68-.46-1.6.03-1.6.85Z" />
  </svg>
);

export const IconNote = ({ className = "" }: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={`${base} ${className}`}>
    <path d="M20 3.2 9.2 5.5a1 1 0 0 0-.8 1v9.05a3.4 3.4 0 1 0 2 3.1V9.1l8-1.7v5.4a3.4 3.4 0 1 0 2 3.1V4.18a1 1 0 0 0-1.2-.98Z" />
  </svg>
);

export const IconSound = ({ className = "" }: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={`${base} ${className}`}>
    <path d="M11.4 4.2 6.9 7.8H4a1.2 1.2 0 0 0-1.2 1.2v6a1.2 1.2 0 0 0 1.2 1.2h2.9l4.5 3.6c.72.58 1.8.07 1.8-.86V5.06c0-.93-1.08-1.44-1.8-.86Z" />
    <path
      d="M16.2 8.6a4.6 4.6 0 0 1 0 6.8M18.9 5.9a8.3 8.3 0 0 1 0 12.2"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
    />
  </svg>
);

export const IconMute = ({ className = "" }: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={`${base} ${className}`}>
    <path d="M11.4 4.2 6.9 7.8H4a1.2 1.2 0 0 0-1.2 1.2v6a1.2 1.2 0 0 0 1.2 1.2h2.9l4.5 3.6c.72.58 1.8.07 1.8-.86V5.06c0-.93-1.08-1.44-1.8-.86Z" />
    <path
      d="M16.3 9.5 21 14.2M21 9.5l-4.7 4.7"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
    />
  </svg>
);

export const IconHorn = ({ className = "" }: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={`${base} ${className}`}>
    <path d="M3.6 9.4h3.1l6.9-4.3c.7-.43 1.6.07 1.6.9v11.9c0 .83-.9 1.33-1.6.9l-6.9-4.3H3.6a1 1 0 0 1-1-1V10.4a1 1 0 0 1 1-1Z" />
    <path
      d="M18.4 8.1c1.5 1 2.4 2.4 2.4 3.9s-.9 2.9-2.4 3.9"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
    />
  </svg>
);

export const IconPin = ({ className = "" }: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={`${base} ${className}`}>
    <path d="M12 2.6a7 7 0 0 0-7 7c0 5 6.1 11.3 6.36 11.56a.9.9 0 0 0 1.28 0C12.9 20.9 19 14.6 19 9.6a7 7 0 0 0-7-7Zm0 9.5a2.6 2.6 0 1 1 0-5.2 2.6 2.6 0 0 1 0 5.2Z" />
  </svg>
);

export const IconChevron = ({ className = "" }: P) => (
  <svg viewBox="0 0 24 24" fill="none" className={`${base} ${className}`}>
    <path
      d="m7 10 5 5 5-5"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
