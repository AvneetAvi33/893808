import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";

/** The house easing: slow out, no overshoot. Nothing here is allowed to snap. */
export const EASE_ZEN = [0.22, 1, 0.36, 1] as const;
export const EASE_DRIFT = [0.33, 0, 0.12, 1] as const;

interface GlassProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
}

/** The frosted shell every floating control lives in. */
export const GlassPanel = forwardRef<HTMLDivElement, GlassProps>(function GlassPanel(
  { children, className = "", ...rest },
  ref,
) {
  return (
    <motion.div
      ref={ref}
      className={`glass rounded-[var(--radius-glass)] ${className}`}
      {...rest}
    >
      {children}
    </motion.div>
  );
});

interface ControlButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Always required: these buttons are icons, and icons say nothing aloud. */
  label: string;
  /** Renders in the accent colour and reports itself as pressed. */
  active?: boolean;
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}

/** Box and icon size in rem, both multiplied by the ten foot scale. */
const SIZES = {
  sm: { box: 2.25, icon: 1.05 },
  md: { box: 2.75, icon: 1.25 },
  lg: { box: 3.75, icon: 1.7 },
} as const;

export function ControlButton({
  label,
  active = false,
  size = "md",
  className = "",
  children,
  ...rest
}: ControlButtonProps) {
  const { box, icon } = SIZES[size];
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active || rest.role === "switch" ? active : undefined}
      className={[
        "inline-flex shrink-0 items-center justify-center rounded-full",
        "text-cream-dim transition-[color,background-color,transform,opacity] duration-500",
        "hover:text-cream hover:bg-white/10 active:scale-95",
        "disabled:opacity-35 disabled:pointer-events-none",
        // Icons scale with the box, so one variable drives the whole set.
        "[&_svg]:h-(--icon-size) [&_svg]:w-(--icon-size)",
        active ? "text-(--accent)" : "",
        className,
      ].join(" ")}
      style={{
        width: `calc(${box}rem * var(--ui-scale))`,
        height: `calc(${box}rem * var(--ui-scale))`,
        ["--icon-size" as string]: `calc(${icon}rem * var(--ui-scale))`,
        transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
