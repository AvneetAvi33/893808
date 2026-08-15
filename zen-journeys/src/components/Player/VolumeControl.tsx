import { useState } from "react";
import { ControlButton } from "../Controls/GlassPanel";
import { MuteIcon, VolumeIcon } from "../Controls/icons";

interface Props {
  volume: number;
  muted: boolean;
  onChange: (value: number) => void;
  onToggleMute: () => void;
}

/**
 * A mute button that grows a slider when you reach for it. Collapsed by
 * default, because a permanent volume slider is one more thing floating over
 * the view for no reason.
 */
export function VolumeControl({ volume, muted, onChange, onToggleMute }: Props) {
  const [open, setOpen] = useState(false);
  const level = muted ? 0 : volume;

  return (
    <div
      className="flex items-center"
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <ControlButton
        label={muted ? "Unmute" : "Mute"}
        size="sm"
        onClick={onToggleMute}
        active={muted}
      >
        {muted ? <MuteIcon /> : <VolumeIcon />}
      </ControlButton>

      <div
        className="relative flex items-center overflow-hidden transition-[width,opacity] duration-500"
        style={{
          width: open ? "calc(5.5rem * var(--ui-scale))" : "0rem",
          opacity: open ? 1 : 0,
          transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <div className="relative mx-2 h-[3px] w-full rounded-full bg-white/15">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-cream-dim"
            style={{ width: `${level * 100}%` }}
          />
        </div>
        <input
          type="range"
          className="bare absolute inset-0 h-full w-full"
          min={0}
          max={1}
          step={0.01}
          value={level}
          aria-label="Volume"
          aria-valuetext={`${Math.round(level * 100)} percent`}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </div>
    </div>
  );
}
