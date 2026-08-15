import { useEffect, useRef } from "react";

interface Props {
  src: string;
  poster?: string;
  label: string;
  /** Loaded but held back: used to warm a scene the user has not entered yet. */
  preloadOnly?: boolean;
  onReady: () => void;
  onFail: () => void;
}

/**
 * A seamlessly looping, muted, covering background video. Muted autoplay is
 * allowed everywhere; the music is a separate stream, so nothing here needs
 * sound.
 */
export function VideoStage({ src, poster, label, preloadOnly, onReady, onFail }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readyRef = useRef(onReady);
  const failRef = useRef(onFail);
  readyRef.current = onReady;
  failRef.current = onFail;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlaying = () => readyRef.current();
    const onError = () => failRef.current();
    video.addEventListener("playing", onPlaying);
    video.addEventListener("error", onError);

    if (!preloadOnly) {
      // Some browsers reject the promise if the element is torn down mid-play.
      video.play().catch(() => failRef.current());
    }

    return () => {
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("error", onError);
      // Detach the source so the download stops the moment the scene is left.
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [src, preloadOnly]);

  return (
    <video
      ref={videoRef}
      className="absolute inset-0 h-full w-full object-cover"
      src={src}
      poster={poster}
      aria-label={label}
      muted
      loop
      playsInline
      disablePictureInPicture
      preload={preloadOnly ? "metadata" : "auto"}
      tabIndex={-1}
    />
  );
}
