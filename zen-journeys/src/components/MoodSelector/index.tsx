import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue } from "framer-motion";
import { SCENE_LIST } from "../../config/scenes";
import type { SceneId } from "../../types";
import { EASE_ZEN } from "../Controls/GlassPanel";
import { SceneCard } from "./SceneCard";

interface Props {
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onBegin: (id: SceneId) => void;
  reducedMotion: boolean;
  compact: boolean;
}

/** Distance the card gap adds on top of the card itself. */
const GAP_RATIO = 0.04;

export function MoodSelector({
  activeIndex,
  onActiveIndexChange,
  onBegin,
  reducedMotion,
  compact,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [stride, setStride] = useState(1);
  const x = useMotionValue(0);
  const draggingRef = useRef(false);

  // The stride is the card width plus its gap, and every position in this
  // component is expressed as a multiple of it.
  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const measure = () => {
      const width = element.clientWidth;
      const cardWidth = Math.min(width * (compact ? 0.84 : 0.66), 980);
      const next = cardWidth * (1 + GAP_RATIO);
      setStride(next);
      element.style.setProperty("--card-width", `${cardWidth}px`);
      element.style.setProperty("--card-gap", `${cardWidth * GAP_RATIO}px`);
      element.style.setProperty("--card-edge", `${(width - cardWidth) / 2}px`);
      // Re-anchor without animating: a resize is not a navigation.
      x.set(-activeIndex * next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
    // activeIndex is deliberately excluded: it is handled by the effect below,
    // which animates rather than jumps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compact, x]);

  // Glide to the active card whenever it changes from anywhere.
  useEffect(() => {
    if (draggingRef.current) return;
    const target = -activeIndex * stride;
    if (reducedMotion) {
      animate(x, target, { duration: 0.25, ease: "linear" });
      return;
    }
    const controls = animate(x, target, {
      type: "spring",
      stiffness: 120,
      damping: 22,
      mass: 0.9,
      restDelta: 0.4,
    });
    return () => controls.stop();
  }, [activeIndex, stride, reducedMotion, x]);

  const step = useCallback(
    (delta: number) => {
      const next = Math.max(0, Math.min(SCENE_LIST.length - 1, activeIndex + delta));
      if (next !== activeIndex) onActiveIndexChange(next);
    },
    [activeIndex, onActiveIndexChange],
  );

  // Keyboard and remote: left and right walk the carousel, select begins.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      if (typing) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        step(1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        step(-1);
      } else if (event.key === "Enter" && target?.tagName !== "BUTTON") {
        event.preventDefault();
        onBegin(SCENE_LIST[activeIndex].id);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, onBegin, step]);

  return (
    <div className="flex h-full w-full flex-col">
      {/* Welcome ---------------------------------------------------------- */}
      <motion.header
        className="px-6 pt-[max(2rem,env(safe-area-inset-top))] text-center sm:pt-12"
        initial={{ opacity: 0, y: reducedMotion ? 0 : 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.4, ease: EASE_ZEN, delay: 0.15 }}
      >
        <p
          className="text-cream-faint uppercase"
          style={{ fontSize: "calc(0.62rem * var(--ui-scale))", letterSpacing: "0.34em" }}
        >
          Zen Journeys
        </p>
        <h1
          className="mt-3 font-display text-cream"
          style={{ fontSize: "calc(clamp(1.4rem, 3.2vw, 2.4rem) * var(--ui-scale))" }}
        >
          Where would you like to travel today?
        </h1>
      </motion.header>

      {/* Carousel --------------------------------------------------------- */}
      <motion.div
        ref={containerRef}
        className="relative min-h-0 flex-1 overflow-hidden"
        style={{ ["--card-height" as string]: compact ? "58vh" : "62vh" }}
        initial={{ opacity: 0, y: reducedMotion ? 0 : 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.6, ease: EASE_ZEN, delay: 0.35 }}
        role="group"
        aria-roledescription="carousel"
        aria-label="Choose a journey"
      >
        <motion.div
          className="absolute inset-y-0 flex items-center"
          style={{
            x,
            gap: "var(--card-gap)",
            paddingLeft: "var(--card-edge)",
            paddingRight: "var(--card-edge)",
            touchAction: "pan-y",
          }}
          drag="x"
          dragConstraints={{
            left: -(SCENE_LIST.length - 1) * stride,
            right: 0,
          }}
          dragElastic={0.12}
          dragMomentum={false}
          onDragStart={() => {
            draggingRef.current = true;
          }}
          onDragEnd={(_event, info) => {
            draggingRef.current = false;
            // Throw the card: where the drag would have landed decides the
            // target, so a flick travels further than a nudge.
            const projected = info.offset.x + info.velocity.x * 0.22;
            const moved = Math.round(-projected / stride);
            const next = Math.max(
              0,
              Math.min(SCENE_LIST.length - 1, activeIndex + Math.max(-1, Math.min(1, moved))),
            );
            if (next === activeIndex) {
              // Settle back into place even when the index has not changed.
              animate(x, -activeIndex * stride, {
                type: "spring",
                stiffness: 140,
                damping: 24,
              });
            } else {
              onActiveIndexChange(next);
            }
          }}
        >
          {SCENE_LIST.map((scene, index) => (
            <SceneCard
              key={scene.id}
              scene={scene}
              index={index}
              x={x}
              stride={stride}
              active={index === activeIndex}
              near={Math.abs(index - activeIndex) <= 1}
              reducedMotion={reducedMotion}
              onBegin={() => onBegin(scene.id)}
              onSelect={() => onActiveIndexChange(index)}
            />
          ))}
        </motion.div>
      </motion.div>

      {/* Progress --------------------------------------------------------- */}
      <motion.div
        className="flex items-center justify-center gap-2 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, ease: EASE_ZEN, delay: 0.7 }}
      >
        {SCENE_LIST.map((scene, index) => {
          const active = index === activeIndex;
          return (
            <button
              key={scene.id}
              type="button"
              onClick={() => onActiveIndexChange(index)}
              aria-label={`Show ${scene.name}`}
              aria-current={active ? "true" : undefined}
              className="group flex h-8 items-center px-1"
            >
              <span
                className="block h-[2px] rounded-full transition-[width,background-color,opacity] duration-700"
                style={{
                  width: active ? "calc(2.5rem * var(--ui-scale))" : "calc(1rem * var(--ui-scale))",
                  background: active ? scene.accent : "var(--color-cream-faint)",
                  opacity: active ? 1 : 0.45,
                  transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
                }}
              />
            </button>
          );
        })}
      </motion.div>
    </div>
  );
}
