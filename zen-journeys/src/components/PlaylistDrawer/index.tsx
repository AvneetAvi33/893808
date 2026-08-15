import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Track } from "../../types";
import { EASE_ZEN, ControlButton } from "../Controls/GlassPanel";
import { CloseIcon } from "../Controls/icons";
import { formatTime } from "../Player/SeekBar";

interface Props {
  open: boolean;
  onClose: () => void;
  queue: Track[];
  currentId?: string;
  isPlaying: boolean;
  sceneName: string;
  compact: boolean;
  reducedMotion: boolean;
  onPlayTrack: (trackId: string) => void;
}

/** Four bars that rise and fall while a track is the one playing. */
function PlayingBars({ animate }: { animate: boolean }) {
  return (
    <span className="flex h-3 items-end gap-[2px]" aria-hidden="true">
      {[0, 1, 2, 3].map((index) => (
        <motion.span
          key={index}
          className="w-[2px] rounded-full bg-(--accent)"
          initial={{ height: 4 }}
          animate={animate ? { height: [4, 12, 6, 10, 4] } : { height: 4 }}
          transition={{
            duration: 1.8 + index * 0.25,
            repeat: animate ? Infinity : 0,
            ease: "easeInOut",
          }}
        />
      ))}
    </span>
  );
}

export function PlaylistDrawer({
  open,
  onClose,
  queue,
  currentId,
  isPlaying,
  sceneName,
  compact,
  reducedMotion,
  onPlayTrack,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape closes, and focus moves in on open so a keyboard lands in the list.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    const current = panelRef.current?.querySelector<HTMLElement>("[data-current='true']");
    (current ?? panelRef.current)?.focus({ preventScroll: false });
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, onClose]);

  const slideFrom = compact ? { y: "100%" } : { x: "100%" };
  const slideTo = compact ? { y: 0 } : { x: 0 };

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="Close playlist"
            className="fixed inset-0 z-30 cursor-default bg-black/25"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: EASE_ZEN }}
            onClick={onClose}
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="false"
            aria-label={`${sceneName} playlist`}
            tabIndex={-1}
            className={[
              // A full height surface carrying a lot of text needs more ground
              // under it than a small floating control does.
              "glass fixed z-40 flex flex-col bg-ink/85",
              compact
                ? "inset-x-0 bottom-0 max-h-[72vh] rounded-t-[var(--radius-glass)]"
                : "right-0 top-0 h-full w-[min(26rem,88vw)] rounded-l-[var(--radius-glass)]",
            ].join(" ")}
            style={{ width: compact ? undefined : "min(calc(26rem * var(--ui-scale)), 88vw)" }}
            initial={reducedMotion ? { opacity: 0 } : { ...slideFrom, opacity: 0.4 }}
            animate={reducedMotion ? { opacity: 1 } : { ...slideTo, opacity: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { ...slideFrom, opacity: 0.2 }}
            transition={{ duration: 0.72, ease: EASE_ZEN }}
          >
            <header className="flex items-start justify-between gap-3 px-6 pb-4 pt-6">
              <div>
                <p
                  className="text-cream-faint uppercase"
                  style={{
                    fontSize: "calc(0.65rem * var(--ui-scale))",
                    letterSpacing: "0.18em",
                  }}
                >
                  Playing from
                </p>
                <h2
                  className="font-display text-cream"
                  style={{ fontSize: "calc(1.35rem * var(--ui-scale))" }}
                >
                  {sceneName}
                </h2>
              </div>
              <ControlButton label="Close playlist" size="sm" onClick={onClose}>
                <CloseIcon />
              </ControlButton>
            </header>

            <ol className="min-h-0 flex-1 overflow-y-auto px-3 pb-8">
              {queue.map((track, index) => {
                const current = track.id === currentId;
                return (
                  <li key={track.id}>
                    <button
                      type="button"
                      data-current={current}
                      aria-current={current ? "true" : undefined}
                      onClick={() => onPlayTrack(track.id)}
                      className={[
                        "group flex w-full items-center gap-4 rounded-2xl px-3 py-3 text-left",
                        "transition-colors duration-500 hover:bg-white/8",
                        current ? "bg-white/6" : "",
                      ].join(" ")}
                      style={{ transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
                    >
                      <span className="flex w-6 shrink-0 justify-center">
                        {current ? (
                          <PlayingBars animate={isPlaying && !reducedMotion} />
                        ) : (
                          <span
                            className="tabular-nums text-cream-faint"
                            style={{ fontSize: "calc(0.8rem * var(--ui-scale))" }}
                          >
                            {index + 1}
                          </span>
                        )}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span
                          className={`block truncate ${current ? "text-(--accent)" : "text-cream"}`}
                          style={{ fontSize: "calc(0.95rem * var(--ui-scale))" }}
                        >
                          {track.title}
                        </span>
                        {track.titleNative ? (
                          <span
                            aria-hidden="true"
                            className="block truncate font-deva text-cream-faint"
                            style={{ fontSize: "calc(0.8rem * var(--ui-scale))" }}
                          >
                            {track.titleNative}
                          </span>
                        ) : null}
                        <span
                          className="block truncate text-cream-faint"
                          style={{ fontSize: "calc(0.75rem * var(--ui-scale))" }}
                        >
                          {track.artist}
                        </span>
                      </span>

                      <span
                        className="shrink-0 tabular-nums text-cream-faint"
                        style={{ fontSize: "calc(0.75rem * var(--ui-scale))" }}
                      >
                        {formatTime(track.duration)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
