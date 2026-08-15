import { memo, useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Scene, SceneId } from "../../types";
import { SCENES } from "../../config/scenes";
import { CanvasStage } from "./CanvasStage";
import { VideoStage } from "./VideoStage";
import { YouTubeStage } from "./YouTubeStage";

/*
  One stage, three kinds of background, and a fallback chain.

  The canvas scene is always the floor: it starts instantly, needs no network
  and cannot fail. Richer sources are layered over it and fade in only once
  they are genuinely playing, so a slow stream never shows a black rectangle
  and a dead one is never noticed at all.
*/

interface LayerProps {
  scene: Scene;
  reducedMotion: boolean;
}

function SceneLayer({ scene, reducedMotion }: LayerProps) {
  // Everything but the canvas floor, in the order the config lists them.
  const candidates = scene.sources.filter((source) => source.kind !== "canvas");
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setIndex(0);
    setReady(false);
  }, [scene.id]);

  const onFail = useCallback(() => {
    setReady(false);
    setIndex((current) => current + 1);
  }, []);
  const onReady = useCallback(() => setReady(true), []);

  const source = candidates[index];

  return (
    <div className="absolute inset-0">
      <CanvasStage
        scene={scene.id}
        reducedMotion={reducedMotion}
        // Stop drawing once something richer has the screen.
        paused={ready}
      />

      {source ? (
        <motion.div
          key={`${scene.id}-${index}`}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: ready ? 1 : 0 }}
          transition={{ duration: reducedMotion ? 0.4 : 1.6, ease: [0.33, 0, 0.12, 1] }}
        >
          {source.kind === "youtube" ? (
            <YouTubeStage source={source} onReady={onReady} onFail={onFail} />
          ) : source.kind === "video" ? (
            <VideoStage
              src={source.src}
              poster={source.poster}
              label={source.label}
              onReady={onReady}
              onFail={onFail}
            />
          ) : null}
        </motion.div>
      ) : null}

      {/* A whisper of the scene's accent over the whole picture, so the
          interface and the background never look like two separate products. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 mix-blend-soft-light opacity-40"
        style={{
          background: `radial-gradient(120% 90% at 50% 100%, ${scene.accent}55, transparent 70%)`,
        }}
      />
    </div>
  );
}

interface Props {
  sceneId: SceneId;
  reducedMotion: boolean;
  /** Warmed in the background so switching to it is instant. */
  preloadSceneId?: SceneId;
}

function SceneStageImpl({ sceneId, reducedMotion, preloadSceneId }: Props) {
  const scene = SCENES[sceneId];
  const preload = preloadSceneId ? SCENES[preloadSceneId] : undefined;
  const preloadVideo = preload?.sources.find((source) => source.kind === "video");

  return (
    <div className="absolute inset-0 overflow-hidden bg-ink">
      {/* Both scenes are mounted through the dissolve, never a cut to black. */}
      <AnimatePresence mode="sync">
        <motion.div
          key={sceneId}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0.35 : 1.4, ease: [0.33, 0, 0.12, 1] }}
        >
          <SceneLayer scene={scene} reducedMotion={reducedMotion} />
        </motion.div>
      </AnimatePresence>

      {preloadVideo ? (
        <div className="pointer-events-none absolute h-px w-px opacity-0">
          <VideoStage
            src={preloadVideo.src}
            label={preloadVideo.label}
            preloadOnly
            onReady={() => undefined}
            onFail={() => undefined}
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * Memoised hard: the player above it re-renders several times a second as the
 * seek bar moves, and none of that should reach the background.
 */
export const SceneStage = memo(SceneStageImpl);
