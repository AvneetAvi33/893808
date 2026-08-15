/*
  Hand drawn icons, on a 24 unit grid with a thin 1.5 unit stroke. Thin lines
  are part of the design language: a heavier icon set would make the floating
  panels look like a dashboard.
*/

interface IconProps {
  className?: string;
}

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Svg({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className ?? "h-5 w-5"}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const PlayIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M8 5.5 19 12 8 18.5Z" {...stroke} fill="currentColor" />
  </Svg>
);

export const PauseIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M9 5v14M15 5v14" {...stroke} strokeWidth={2} />
  </Svg>
);

export const NextIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M7 6l8 6-8 6Z" {...stroke} fill="currentColor" />
    <path d="M18 5.5v13" {...stroke} />
  </Svg>
);

export const PreviousIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M17 6l-8 6 8 6Z" {...stroke} fill="currentColor" />
    <path d="M6 5.5v13" {...stroke} />
  </Svg>
);

export const ShuffleIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M3 7h3.5l4 10H14M3 17h3.5l4-10H14" {...stroke} />
    <path d="M17.5 4.5 21 7l-3.5 2.5M17.5 14.5 21 17l-3.5 2.5" {...stroke} />
  </Svg>
);

export const RepeatIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M4 12V9.5A3.5 3.5 0 0 1 7.5 6H19M17 3.5 19.5 6 17 8.5" {...stroke} />
    <path d="M20 12v2.5a3.5 3.5 0 0 1-3.5 3.5H5M7 15.5 4.5 18 7 20.5" {...stroke} />
  </Svg>
);

export const RepeatOneIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M4 12V9.5A3.5 3.5 0 0 1 7.5 6H19M17 3.5 19.5 6 17 8.5" {...stroke} />
    <path d="M20 12v2.5a3.5 3.5 0 0 1-3.5 3.5H5M7 15.5 4.5 18 7 20.5" {...stroke} />
    <path d="M11.5 10.5 13 9.6V14" {...stroke} />
  </Svg>
);

export const VolumeIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M4 9.5h3L11 6v12L7 14.5H4Z" {...stroke} />
    <path d="M14.5 9.5a3.5 3.5 0 0 1 0 5M17 7a7 7 0 0 1 0 10" {...stroke} />
  </Svg>
);

export const MuteIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M4 9.5h3L11 6v12L7 14.5H4Z" {...stroke} />
    <path d="m15 10 4 4M19 10l-4 4" {...stroke} />
  </Svg>
);

export const QueueIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M4 7h11M4 12h11M4 17h7" {...stroke} />
    <path d="M18.5 9.5v7.2" {...stroke} />
    <circle cx="17" cy="17.5" r="1.8" {...stroke} />
  </Svg>
);

export const BackIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M19 12H5M11 6l-6 6 6 6" {...stroke} />
  </Svg>
);

export const CloseIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="m6 6 12 12M18 6 6 18" {...stroke} />
  </Svg>
);

export const ExpandIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" {...stroke} />
  </Svg>
);

export const CollapseIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" {...stroke} />
  </Svg>
);

export const AmbientIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M3 9c2-2 3.5-2 5.5 0s3.5 2 5.5 0 3.5-2 5.5 0" {...stroke} />
    <path d="M3 15c2-2 3.5-2 5.5 0s3.5 2 5.5 0 3.5-2 5.5 0" {...stroke} />
  </Svg>
);

export const TvIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <rect x="3" y="5.5" width="18" height="12" rx="2" {...stroke} />
    <path d="M8.5 20.5h7" {...stroke} />
  </Svg>
);

export const ChevronLeftIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M14.5 5.5 8 12l6.5 6.5" {...stroke} />
  </Svg>
);

export const ChevronRightIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M9.5 5.5 16 12l-6.5 6.5" {...stroke} />
  </Svg>
);

export const CompassIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <circle cx="12" cy="12" r="8.5" {...stroke} />
    <path d="m15 9-2 4.6-4.6 2 2-4.6Z" {...stroke} />
  </Svg>
);
