import { AnimatePresence, motion } from "framer-motion";
import type { AudioEngine } from "../../hooks/useAudioEngine";
import { ControlButton, EASE_ZEN, GlassPanel } from "../Controls/GlassPanel";
import {
  NextIcon,
  PauseIcon,
  PlayIcon,
  PreviousIcon,
  QueueIcon,
  RepeatIcon,
  RepeatOneIcon,
  ShuffleIcon,
} from "../Controls/icons";
import { SeekBar, formatTime } from "./SeekBar";
import { VolumeControl } from "./VolumeControl";

interface Props {
  engine: AudioEngine;
  compact: boolean;
  reducedMotion: boolean;
  queueOpen: boolean;
  onToggleQueue: () => void;
}

export function Player({ engine, compact, reducedMotion, queueOpen, onToggleQueue }: Props) {
  const { track } = engine;
  const repeatLabel =
    engine.repeat === "one"
      ? "Repeat one, on"
      : engine.repeat === "all"
        ? "Repeat all, on"
        : "Repeat, off";

  return (
    <GlassPanel
      className="pointer-events-auto w-full px-4 py-3 sm:px-6 sm:py-4"
      role="region"
      aria-label="Now playing"
    >
      <div className="flex flex-col gap-2 sm:gap-3">
        {/* Track identity ------------------------------------------------ */}
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={track?.id ?? "none"}
                initial={{ opacity: 0, y: reducedMotion ? 0 : 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reducedMotion ? 0 : -8 }}
                transition={{ duration: 0.7, ease: EASE_ZEN }}
              >
                <p
                  className="truncate font-display text-cream scrim"
                  style={{ fontSize: "calc(1.05rem * var(--ui-scale))" }}
                >
                  {track?.title ?? "Nothing playing"}
                </p>
                <p className="flex items-baseline gap-2 truncate text-cream-faint">
                  {track?.titleNative ? (
                    <span
                      className="font-deva truncate text-cream-dim"
                      style={{ fontSize: "calc(0.85rem * var(--ui-scale))" }}
                      // The Devanagari line repeats the title above it, so it
                      // is decoration as far as a screen reader is concerned.
                      aria-hidden="true"
                    >
                      {track.titleNative}
                    </span>
                  ) : null}
                  <span
                    className="truncate"
                    style={{ fontSize: "calc(0.8rem * var(--ui-scale))" }}
                  >
                    {track?.artist ?? ""}
                  </span>
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {!compact ? (
            <div className="flex shrink-0 items-center gap-1">
              <ControlButton
                label="Shuffle"
                size="sm"
                active={engine.shuffle}
                role="switch"
                onClick={engine.toggleShuffle}
              >
                <ShuffleIcon />
              </ControlButton>
              <ControlButton
                label={repeatLabel}
                size="sm"
                active={engine.repeat !== "off"}
                onClick={engine.cycleRepeat}
              >
                {engine.repeat === "one" ? <RepeatOneIcon /> : <RepeatIcon />}
              </ControlButton>
              <VolumeControl
                volume={engine.volume}
                muted={engine.muted}
                onChange={engine.setVolume}
                onToggleMute={engine.toggleMute}
              />
              <ControlButton
                label={queueOpen ? "Hide playlist" : "Show playlist"}
                size="sm"
                active={queueOpen}
                aria-expanded={queueOpen}
                onClick={onToggleQueue}
              >
                <QueueIcon />
              </ControlButton>
            </div>
          ) : null}
        </div>

        {/* Seek ----------------------------------------------------------- */}
        <div className="flex items-center gap-3">
          <span
            className="tabular-nums text-cream-faint"
            style={{ fontSize: "calc(0.7rem * var(--ui-scale))" }}
          >
            {formatTime(engine.position)}
          </span>
          <SeekBar
            position={engine.position}
            duration={engine.duration}
            onSeek={engine.seek}
            disabled={!track}
            label={track ? `Seek within ${track.title}` : "Seek"}
          />
          <span
            className="tabular-nums text-cream-faint"
            style={{ fontSize: "calc(0.7rem * var(--ui-scale))" }}
          >
            {formatTime(engine.duration)}
          </span>
        </div>

        {/* Transport ------------------------------------------------------ */}
        <div className="flex items-center justify-center gap-2 sm:gap-4">
          {compact ? (
            <ControlButton
              label="Shuffle"
              size="sm"
              active={engine.shuffle}
              role="switch"
              onClick={engine.toggleShuffle}
            >
              <ShuffleIcon />
            </ControlButton>
          ) : null}

          <ControlButton label="Previous track" onClick={engine.previous}>
            <PreviousIcon />
          </ControlButton>

          <ControlButton
            label={engine.isPlaying ? "Pause" : "Play"}
            size="lg"
            onClick={engine.toggle}
            className="bg-white/10 text-cream hover:bg-white/16"
          >
            {engine.isPlaying ? <PauseIcon /> : <PlayIcon />}
          </ControlButton>

          <ControlButton label="Next track" onClick={engine.next}>
            <NextIcon />
          </ControlButton>

          {compact ? (
            <ControlButton
              label={queueOpen ? "Hide playlist" : "Show playlist"}
              size="sm"
              active={queueOpen}
              aria-expanded={queueOpen}
              onClick={onToggleQueue}
            >
              <QueueIcon />
            </ControlButton>
          ) : null}
        </div>
      </div>
    </GlassPanel>
  );
}
