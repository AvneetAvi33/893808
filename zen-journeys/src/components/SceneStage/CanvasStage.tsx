import { useEffect, useRef } from "react";
import { startProceduralScene, type SceneHandle } from "../../scenes/procedural";
import type { SceneId } from "../../types";

interface Props {
  scene: SceneId;
  reducedMotion: boolean;
  /**
   * Set once a richer source (a live stream or a video) has taken over the
   * screen. The loop is torn down rather than left drawing behind a video.
   */
  paused?: boolean;
}

export function CanvasStage({ scene, reducedMotion, paused = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || paused) return;
    let handle: SceneHandle | null = startProceduralScene(canvas, scene, reducedMotion);
    return () => {
      handle?.stop();
      handle = null;
    };
  }, [scene, reducedMotion, paused]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 h-full w-full"
      style={{ display: "block" }}
    />
  );
}
