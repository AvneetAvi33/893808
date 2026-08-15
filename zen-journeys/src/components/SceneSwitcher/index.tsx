import { motion } from "framer-motion";
import { SCENE_LIST } from "../../config/scenes";
import type { SceneId } from "../../types";
import { EASE_ZEN, GlassPanel } from "../Controls/GlassPanel";

interface Props {
  current: SceneId;
  onSelect: (id: SceneId) => void;
  compact: boolean;
}

/** Jump between journeys without going back to the entry screen. */
export function SceneSwitcher({ current, onSelect, compact }: Props) {
  return (
    <GlassPanel
      className="pointer-events-auto p-1"
      role="group"
      aria-label="Switch journey"
    >
      <div className="flex items-center gap-1">
        {SCENE_LIST.map((scene) => {
          const active = scene.id === current;
          return (
            <button
              key={scene.id}
              type="button"
              onClick={() => onSelect(scene.id)}
              aria-current={active ? "true" : undefined}
              title={scene.description}
              className={[
                "relative rounded-full px-3 py-2 transition-colors duration-500",
                active ? "text-cream" : "text-cream-faint hover:text-cream-dim",
              ].join(" ")}
              style={{
                fontSize: "calc(0.78rem * var(--ui-scale))",
                transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            >
              {active ? (
                // One element that slides between buttons, so the highlight
                // travels rather than blinking on and off.
                <motion.span
                  layoutId="scene-switcher-pill"
                  className="absolute inset-0 rounded-full"
                  style={{ background: `${scene.accent}2e`, border: `1px solid ${scene.accent}55` }}
                  transition={{ duration: 0.6, ease: EASE_ZEN }}
                />
              ) : null}
              <span className="relative whitespace-nowrap">
                {compact ? scene.name.split(" ")[0] : scene.name}
              </span>
            </button>
          );
        })}
      </div>
    </GlassPanel>
  );
}
