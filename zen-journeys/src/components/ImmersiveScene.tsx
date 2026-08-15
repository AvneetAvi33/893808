import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SCENES, SCENE_ORDER } from "../config/scenes";
import { PLAYLISTS } from "../config/playlists";
import type { SceneId } from "../types";
import type { AudioEngine } from "../hooks/useAudioEngine";
import { useIdleControls } from "../hooks/useIdleControls";
import { useWakeLock } from "../hooks/useWakeLock";
import { useFullscreen } from "../hooks/useFullscreen";
import { AmbientLayer } from "../audio/ambient";
import { SceneStage } from "./SceneStage";
import { Player } from "./Player";
import { PlaylistDrawer } from "./PlaylistDrawer";
import { SceneSwitcher } from "./SceneSwitcher";
import { ControlButton, EASE_ZEN, GlassPanel } from "./Controls/GlassPanel";
import {
  AmbientIcon,
  BackIcon,
  CollapseIcon,
  ExpandIcon,
  TvIcon,
} from "./Controls/icons";

interface Props {
  sceneId: SceneId;
  engine: AudioEngine;
  reducedMotion: boolean;
  compact: boolean;
  tvMode: boolean;
  onToggleTvMode: () => void;
  onBack: () => void;
  onSwitchScene: (id: SceneId) => void;
}

export function ImmersiveScene({
  sceneId,
  engine,
  reducedMotion,
  compact,
  tvMode,
  onToggleTvMode,
  onBack,
  onSwitchScene,
}: Props) {
  const scene = SCENES[sceneId];
  const [queueOpen, setQueueOpen] = useState(false);
  const [ambientOn, setAmbientOn] = useState(false);
  const [focusWithinControls, setFocusWithinControls] = useState(false);
  const { isFullscreen, toggle: toggleFullscreen, supported: fullscreenSupported } =
    useFullscreen();

  // Controls stay put while a drawer is open, the browser is asking for a tap,
  // or a keyboard is somewhere inside them. Hiding the interface out from under
  // someone who is using it is never right.
  const pinned = queueOpen || engine.blocked || focusWithinControls;
  const { visible } = useIdleControls(pinned);
  useWakeLock(true);

  // Ambient realism layer. One instance for the life of the screen.
  const ambientRef = useRef<AmbientLayer | null>(null);
  if (ambientRef.current === null) ambientRef.current = new AmbientLayer();
  useEffect(() => {
    const layer = ambientRef.current;
    return () => layer?.teardown();
  }, []);
  useEffect(() => {
    ambientRef.current?.setKind(scene.ambient);
  }, [scene.ambient]);
  useEffect(() => {
    ambientRef.current?.setEnabled(ambientOn);
  }, [ambientOn]);

  // The scene's accent tints the entire interface.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--accent", scene.accent);
    root.style.setProperty("--accent-soft", scene.accentSoft);
  }, [scene.accent, scene.accentSoft]);

  const nextSceneId = useMemo(() => {
    const index = SCENE_ORDER.indexOf(sceneId);
    return SCENE_ORDER[(index + 1) % SCENE_ORDER.length];
  }, [sceneId]);

  const switchTo = useCallback(
    (id: SceneId) => {
      if (id === sceneId) return;
      onSwitchScene(id);
      // A crossfade into the new journey's queue, never a hard cut.
      engine.loadPlaylist(PLAYLISTS[id], { autoplay: true });
    },
    [engine, onSwitchScene, sceneId],
  );

  // Keyboard and remote control. Deliberately close to what a media player
  // does elsewhere, so nobody has to learn anything.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;
      // Let the drawer handle its own Escape.
      if (queueOpen && event.key === "Escape") return;

      switch (event.key) {
        case " ":
        case "k":
          event.preventDefault();
          engine.toggle();
          break;
        case "ArrowRight":
          event.preventDefault();
          engine.next();
          break;
        case "ArrowLeft":
          event.preventDefault();
          engine.previous();
          break;
        case "ArrowUp":
          event.preventDefault();
          engine.setVolume(Math.min(1, engine.volume + 0.05));
          break;
        case "ArrowDown":
          event.preventDefault();
          engine.setVolume(Math.max(0, engine.volume - 0.05));
          break;
        case "Escape":
          event.preventDefault();
          onBack();
          break;
        case "f":
          event.preventDefault();
          toggleFullscreen();
          break;
        case "m":
          engine.toggleMute();
          break;
        case "q":
          setQueueOpen((open) => !open);
          break;
        case "s":
          engine.toggleShuffle();
          break;
        case "r":
          engine.cycleRepeat();
          break;
        case "1":
        case "2":
        case "3":
        case "4": {
          const target = SCENE_ORDER[Number(event.key) - 1];
          if (target) switchTo(target);
          break;
        }
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [engine, onBack, queueOpen, switchTo, toggleFullscreen]);

  const fade = {
    initial: { opacity: 0, y: reducedMotion ? 0 : -14 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: reducedMotion ? 0 : -14 },
    transition: { duration: 0.75, ease: EASE_ZEN },
  };

  return (
    <div className="relative h-full w-full">
      <SceneStage
        sceneId={sceneId}
        reducedMotion={reducedMotion}
        preloadSceneId={nextSceneId}
      />

      {/* Everything below floats over the scene and never blocks it. */}
      <div
        className="pointer-events-none absolute inset-0 flex flex-col justify-between"
        onFocusCapture={() => setFocusWithinControls(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setFocusWithinControls(false);
          }
        }}
      >
        {/* Top row ------------------------------------------------------- */}
        <AnimatePresence>
          {visible ? (
            <motion.div
              key="top"
              {...fade}
              className="pointer-events-none flex items-start justify-between gap-3 p-[max(1rem,env(safe-area-inset-top))_max(1rem,env(safe-area-inset-right))_0_max(1rem,env(safe-area-inset-left))] sm:p-6"
            >
              <GlassPanel className="pointer-events-auto flex items-center gap-2 p-1 pr-4">
                <ControlButton label="Back to the journeys" onClick={onBack} size="sm">
                  <BackIcon />
                </ControlButton>
                <span className="min-w-0">
                  <span
                    className="block truncate font-display text-cream"
                    style={{ fontSize: "calc(0.95rem * var(--ui-scale))" }}
                  >
                    {scene.name}
                  </span>
                  {!compact ? (
                    <span
                      className="block truncate text-cream-faint"
                      style={{ fontSize: "calc(0.7rem * var(--ui-scale))" }}
                    >
                      {scene.mood}
                    </span>
                  ) : null}
                </span>
              </GlassPanel>

              <div className="flex items-center gap-2">
                {!compact ? (
                  <SceneSwitcher current={sceneId} onSelect={switchTo} compact={compact} />
                ) : null}
                <GlassPanel className="pointer-events-auto flex items-center gap-1 p-1">
                  <ControlButton
                    label={ambientOn ? "Ambient sound, on" : "Ambient sound, off"}
                    size="sm"
                    role="switch"
                    active={ambientOn}
                    onClick={() => setAmbientOn((on) => !on)}
                  >
                    <AmbientIcon />
                  </ControlButton>
                  <ControlButton
                    label={tvMode ? "Big screen mode, on" : "Big screen mode, off"}
                    size="sm"
                    role="switch"
                    active={tvMode}
                    onClick={onToggleTvMode}
                  >
                    <TvIcon />
                  </ControlButton>
                  {fullscreenSupported ? (
                    <ControlButton
                      label={isFullscreen ? "Leave fullscreen" : "Fullscreen"}
                      size="sm"
                      onClick={toggleFullscreen}
                    >
                      {isFullscreen ? <CollapseIcon /> : <ExpandIcon />}
                    </ControlButton>
                  ) : null}
                </GlassPanel>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Bottom row ---------------------------------------------------- */}
        <AnimatePresence>
          {visible ? (
            <motion.div
              key="bottom"
              initial={{ opacity: 0, y: reducedMotion ? 0 : 26 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reducedMotion ? 0 : 26 }}
              transition={{ duration: 0.75, ease: EASE_ZEN }}
              className="pointer-events-none flex flex-col items-center gap-3 p-[0_max(1rem,env(safe-area-inset-right))_max(1rem,env(safe-area-inset-bottom))_max(1rem,env(safe-area-inset-left))] sm:p-6"
            >
              {compact ? (
                <SceneSwitcher current={sceneId} onSelect={switchTo} compact />
              ) : null}
              {/* Grows with the ten foot scale, so the player keeps its share
                  of a television rather than shrinking into the middle. */}
              <div
                className="w-full"
                style={{ maxWidth: "min(100%, calc(48rem * var(--ui-scale)))" }}
              >
                <Player
                  engine={engine}
                  compact={compact}
                  reducedMotion={reducedMotion}
                  queueOpen={queueOpen}
                  onToggleQueue={() => setQueueOpen((open) => !open)}
                />
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <PlaylistDrawer
        open={queueOpen}
        onClose={() => setQueueOpen(false)}
        queue={engine.queue}
        currentId={engine.track?.id}
        isPlaying={engine.isPlaying}
        sceneName={scene.name}
        compact={compact}
        reducedMotion={reducedMotion}
        onPlayTrack={engine.playTrack}
      />

      {/* Autoplay gate --------------------------------------------------- */}
      <AnimatePresence>
        {engine.blocked ? (
          <motion.div
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: EASE_ZEN }}
          >
            <button
              type="button"
              onClick={engine.unlock}
              className="glass rounded-full px-8 py-5 text-cream"
              style={{ fontSize: "calc(1rem * var(--ui-scale))" }}
            >
              Tap to enable sound
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
