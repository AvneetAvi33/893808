import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SCENES, SCENE_LIST, SCENE_ORDER } from "./config/scenes";
import { PLAYLISTS, USING_PLACEHOLDER_AUDIO } from "./config/playlists";
import type { SceneId } from "./types";
import { useAudioEngine } from "./hooks/useAudioEngine";
import {
  useIsCompact,
  usePrefersReducedMotion,
  useTvMode,
} from "./hooks/useEnvironment";
import { MoodSelector } from "./components/MoodSelector";
import { ImmersiveScene } from "./components/ImmersiveScene";
import { EASE_DRIFT, EASE_ZEN } from "./components/Controls/GlassPanel";

/*
  Two screens and the doorway between them.

  The "Begin" transition is a hand-off, not a route change: the selector pushes
  towards the viewer and dissolves, a dark veil closes over everything, the
  scene is mounted behind it, and the veil lifts to reveal the journey already
  moving with the music coming up under it.
*/

type Phase = "select" | "entering" | "scene" | "leaving";

/** Milliseconds. Long by interface standards, which is the whole point. */
const ENTER = { veilClosed: 950, veilLift: 1250, settled: 2700 };
const LEAVE = { veilClosed: 620, veilLift: 900, settled: 2000 };

export default function App() {
  const reducedMotion = usePrefersReducedMotion();
  const compact = useIsCompact();
  const tv = useTvMode();

  const [phase, setPhase] = useState<Phase>("select");
  const [activeIndex, setActiveIndex] = useState(0);
  const [sceneId, setSceneId] = useState<SceneId>(SCENE_ORDER[0]);

  const engine = useAudioEngine(PLAYLISTS[SCENE_ORDER[0]]);
  const timers = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
  }, []);
  useEffect(() => clearTimers, [clearTimers]);

  const after = useCallback((ms: number, run: () => void) => {
    timers.current.push(window.setTimeout(run, ms));
  }, []);

  // The selector carries the tint of whichever card is centre stage.
  useEffect(() => {
    if (phase !== "select") return;
    const scene = SCENE_LIST[activeIndex];
    document.documentElement.style.setProperty("--accent", scene.accent);
    document.documentElement.style.setProperty("--accent-soft", scene.accentSoft);
  }, [activeIndex, phase]);

  const begin = useCallback(
    (id: SceneId) => {
      if (phase !== "select") return;
      clearTimers();
      setPhase("entering");
      const timing = reducedMotion
        ? { veilClosed: 380, veilLift: 460, settled: 900 }
        : ENTER;

      after(timing.veilClosed, () => {
        setSceneId(id);
        // Music starts behind the veil, so it is already in the room when the
        // scene appears rather than arriving after it.
        engine.loadPlaylist(PLAYLISTS[id], { autoplay: true });
      });
      after(timing.veilLift, () => setPhase("scene"));
      after(timing.settled, () => undefined);
    },
    [after, clearTimers, engine, phase, reducedMotion],
  );

  const back = useCallback(() => {
    if (phase !== "scene") return;
    clearTimers();
    setPhase("leaving");
    const timing = reducedMotion ? { veilClosed: 300, veilLift: 420 } : LEAVE;
    after(timing.veilClosed, () => {
      // Leaving a scene releases its audio; nothing plays over the entry screen.
      engine.pause();
      setActiveIndex(Math.max(0, SCENE_ORDER.indexOf(sceneId)));
    });
    after(timing.veilLift, () => setPhase("select"));
    after(LEAVE.settled, () => undefined);
  }, [after, clearTimers, engine, phase, reducedMotion, sceneId]);

  const inScene = phase === "scene" || phase === "leaving";
  // Closed while stepping through the doorway in either direction.
  const veilClosed = phase === "entering" || phase === "leaving";

  return (
    <main className="relative h-full w-full overflow-hidden bg-ink">
      <AnimatePresence mode="sync">
        {!inScene ? (
          <motion.div
            key="selector"
            className="absolute inset-0"
            initial={{ opacity: 0, scale: reducedMotion ? 1 : 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{
              opacity: 0,
              // Pushing towards the viewer reads as stepping into the card.
              scale: reducedMotion ? 1 : 1.5,
              filter: reducedMotion ? "blur(0px)" : "blur(6px)",
            }}
            transition={{ duration: reducedMotion ? 0.35 : 1.1, ease: EASE_DRIFT }}
          >
            <MoodSelector
              activeIndex={activeIndex}
              onActiveIndexChange={setActiveIndex}
              onBegin={begin}
              reducedMotion={reducedMotion}
              compact={compact}
            />

            {USING_PLACEHOLDER_AUDIO ? (
              <p
                className="pointer-events-none absolute inset-x-0 bottom-1 text-center text-cream-faint"
                style={{ fontSize: "calc(0.62rem * var(--ui-scale))", opacity: 0.55 }}
              >
                Sample playlists. Placeholder tones stand in until licensed
                recordings are added.
              </p>
            ) : null}
          </motion.div>
        ) : (
          <motion.div
            key="scene"
            className="absolute inset-0"
            initial={{ opacity: 0, scale: reducedMotion ? 1 : 1.06 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: reducedMotion ? 1 : 1.02 }}
            transition={{ duration: reducedMotion ? 0.35 : 1.8, ease: EASE_DRIFT }}
          >
            <ImmersiveScene
              sceneId={sceneId}
              engine={engine}
              reducedMotion={reducedMotion}
              compact={compact}
              tvMode={tv.enabled}
              onToggleTvMode={tv.toggle}
              onBack={back}
              onSwitchScene={setSceneId}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* The veil. Nothing else in the app is allowed to cut to black. */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-veil"
        initial={{ opacity: 0 }}
        animate={{ opacity: veilClosed ? 1 : 0 }}
        transition={{
          duration: veilClosed ? (reducedMotion ? 0.3 : 0.75) : reducedMotion ? 0.3 : 1.5,
          ease: EASE_ZEN,
        }}
      />

      {/* Announced quietly, so a screen reader knows where it now is. */}
      <p className="sr-only" role="status" aria-live="polite">
        {inScene ? `${SCENES[sceneId].name} journey playing` : "Choose a journey"}
      </p>
    </main>
  );
}
