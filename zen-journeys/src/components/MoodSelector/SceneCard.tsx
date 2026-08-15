import { motion, useTransform, type MotionValue } from "framer-motion";
import type { Scene } from "../../types";
import { CanvasStage } from "../SceneStage/CanvasStage";
import { EASE_ZEN } from "../Controls/GlassPanel";

interface Props {
  scene: Scene;
  index: number;
  /** Track offset in pixels; one card's width plus its gap is `stride`. */
  x: MotionValue<number>;
  stride: number;
  active: boolean;
  /** True for the active card and its immediate neighbours. */
  near: boolean;
  reducedMotion: boolean;
  onBegin: () => void;
  onSelect: () => void;
}

export function SceneCard({
  scene,
  index,
  x,
  stride,
  active,
  near,
  reducedMotion,
  onBegin,
  onSelect,
}: Props) {
  // Signed distance from the centre of the stage, in cards. The whole depth
  // effect is a function of this one number.
  const distance = useTransform(x, (value) => index + value / stride);
  const absolute = useTransform(distance, (value) => Math.min(Math.abs(value), 2));

  const scale = useTransform(absolute, (value) => (reducedMotion ? 1 : 1 - value * 0.11));
  const opacity = useTransform(absolute, (value) => 1 - value * 0.42);
  /**
   * Neighbours are dimmed with a black overlay rather than a CSS brightness
   * filter: a filter on the card forces the rounded clip and the canvas into
   * separate layers, which Chromium seams at the corners, and it costs far
   * more per frame than an opacity.
   */
  const dim = useTransform(absolute, (value) => value * 0.34);
  // The picture inside slides against the card: depth, rather than a flat slide.
  const parallax = useTransform(distance, (value) => (reducedMotion ? 0 : value * -52));
  const zIndex = useTransform(absolute, (value) => Math.round(10 - value * 5));

  return (
    <motion.div
      className="relative shrink-0"
      style={{
        width: "var(--card-width)",
        height: "var(--card-height)",
        scale,
        opacity,
        zIndex,
      }}
    >
      <button
        type="button"
        onClick={active ? onBegin : onSelect}
        aria-current={active ? "true" : undefined}
        aria-label={
          active
            ? `Begin the ${scene.name} journey. ${scene.description}`
            : `Show ${scene.name}. ${scene.mood}`
        }
        className="group relative block h-full w-full overflow-hidden rounded-[2rem] text-left"
        style={{
          boxShadow: active
            ? `0 40px 120px -40px ${scene.accent}, 0 20px 60px -30px rgb(0 0 0 / 0.9)`
            : "0 20px 60px -35px rgb(0 0 0 / 0.9)",
          border: "1px solid rgb(255 255 255 / 0.08)",
        }}
      >
        <motion.div className="absolute inset-0" style={{ x: parallax, scale: 1.12 }}>
          <CanvasStage
            scene={scene.id}
            reducedMotion={reducedMotion}
            // Only the cards in view are worth animating.
            paused={!near}
          />
        </motion.div>

        {/* Depth: the further from centre, the further into shadow. */}
        <motion.div
          aria-hidden="true"
          className="absolute inset-0 bg-black"
          style={{ opacity: dim }}
        />

        {/* Legibility scrim: text over a moving picture needs a floor. */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgb(5 4 7 / 0.92) 0%, rgb(5 4 7 / 0.45) 32%, rgb(5 4 7 / 0) 62%)",
          }}
        />

        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-9">
          <p
            className="uppercase text-cream-faint scrim"
            style={{
              fontSize: "calc(0.65rem * var(--ui-scale))",
              letterSpacing: "0.22em",
            }}
          >
            {String(index + 1).padStart(2, "0")}
          </p>
          <h2
            className="mt-2 font-display text-cream scrim"
            style={{ fontSize: "calc(clamp(1.75rem, 4.6vw, 3.25rem) * var(--ui-scale))" }}
          >
            {scene.name}
          </h2>
          <p
            className="mt-1 text-cream-dim scrim"
            style={{ fontSize: "calc(clamp(0.85rem, 1.5vw, 1.05rem) * var(--ui-scale))" }}
          >
            {scene.mood}
          </p>

          <motion.span
            className="mt-6 inline-flex items-center gap-3 rounded-full px-6 py-3"
            initial={false}
            animate={{
              opacity: active ? 1 : 0,
              y: active || reducedMotion ? 0 : 12,
            }}
            transition={{ duration: 0.7, ease: EASE_ZEN }}
            style={{
              background: `${scene.accent}22`,
              border: `1px solid ${scene.accent}66`,
              color: "var(--color-cream)",
              fontSize: "calc(0.9rem * var(--ui-scale))",
              pointerEvents: active ? "auto" : "none",
            }}
          >
            Begin
            <span
              aria-hidden="true"
              className="transition-transform duration-700 group-hover:translate-x-1"
              style={{ transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
            >
              →
            </span>
          </motion.span>
        </div>
      </button>
    </motion.div>
  );
}
