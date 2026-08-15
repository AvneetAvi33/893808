import { useCallback, useRef, useState } from "react";

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  const minutes = Math.floor(whole / 60);
  return `${minutes}:${String(whole % 60).padStart(2, "0")}`;
}

interface Props {
  position: number;
  duration: number;
  onSeek: (seconds: number) => void;
  disabled?: boolean;
  label?: string;
}

/**
 * A drawn progress bar with a real range input on top of it. The input is
 * invisible but fully present, which is what makes the bar keyboard operable
 * and legible to a screen reader without any ARIA guesswork.
 */
export function SeekBar({ position, duration, onSeek, disabled, label = "Seek" }: Props) {
  const [scrub, setScrub] = useState<number | null>(null);
  const [hovered, setHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const shown = scrub ?? position;
  const total = duration || 1;
  const progress = Math.max(0, Math.min(1, shown / total));

  const commit = useCallback(() => {
    if (scrub === null) return;
    onSeek(scrub);
    setScrub(null);
  }, [onSeek, scrub]);

  return (
    <div
      className="group relative flex w-full items-center"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      style={{ height: "calc(1.25rem * var(--ui-scale))" }}
    >
      {/* Track */}
      <div className="absolute inset-x-0 h-[3px] rounded-full bg-white/15" />
      {/* Elapsed */}
      <div
        className="absolute left-0 h-[3px] rounded-full bg-(--accent)"
        style={{
          width: `${progress * 100}%`,
          // No transition while scrubbing: the thumb must track the finger.
          transition: scrub === null ? "width 220ms linear" : "none",
          boxShadow: "0 0 18px -2px var(--accent)",
        }}
      />
      {/* Handle: only present once the bar is being touched or focused. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute rounded-full bg-cream transition-[opacity,transform] duration-500"
        style={{
          left: `${progress * 100}%`,
          width: "calc(0.7rem * var(--ui-scale))",
          height: "calc(0.7rem * var(--ui-scale))",
          transform: "translateX(-50%)",
          opacity: hovered || scrub !== null ? 1 : 0,
          transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
          boxShadow: "0 2px 10px rgb(0 0 0 / 0.6)",
        }}
      />
      <input
        ref={inputRef}
        type="range"
        className="bare absolute inset-x-0 h-full w-full"
        min={0}
        max={Math.max(total, 1)}
        step={0.5}
        value={shown}
        disabled={disabled}
        aria-label={label}
        aria-valuetext={`${formatTime(shown)} of ${formatTime(duration)}`}
        onChange={(event) => setScrub(Number(event.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
      />
    </div>
  );
}
