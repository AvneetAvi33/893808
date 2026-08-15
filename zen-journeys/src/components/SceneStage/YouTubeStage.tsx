import { useEffect, useRef } from "react";
import { youtubeEmbedUrl, type YouTubeSource } from "../../config/scenes";

/*
  The NASA live stream. Everything about this is defensive: the stream can be
  offline, the embed can be blocked by a network or an extension, and the API
  script may never arrive. Any of those simply means the canvas star field
  underneath keeps the screen, and nobody is shown an error.
*/

/** How long to wait for the stream to actually start before giving up on it. */
const READY_TIMEOUT_MS = 9000;

interface YouTubePlayer {
  destroy: () => void;
  playVideo: () => void;
  mute: () => void;
}

interface YouTubeApi {
  Player: new (
    element: HTMLElement,
    options: {
      events: {
        onReady?: (event: { target: YouTubePlayer }) => void;
        onStateChange?: (event: { data: number }) => void;
        onError?: () => void;
      };
    },
  ) => YouTubePlayer;
  PlayerState: { PLAYING: number };
}

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YouTubeApi> | null = null;

function loadYouTubeApi(): Promise<YouTubeApi> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<YouTubeApi>((resolve, reject) => {
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => reject(new Error("iframe api unavailable"));
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT) resolve(window.YT);
      else reject(new Error("iframe api loaded without YT"));
    };
    document.head.appendChild(script);
  });
  return apiPromise;
}

interface Props {
  source: YouTubeSource;
  /** Called once frames are genuinely on screen. */
  onReady: () => void;
  /** Called if the stream will not play, so the caller can fall through. */
  onFail: () => void;
}

export function YouTubeStage({ source, onReady, onFail }: Props) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const readyRef = useRef(onReady);
  const failRef = useRef(onFail);
  readyRef.current = onReady;
  failRef.current = onFail;

  useEffect(() => {
    const iframe = frameRef.current;
    if (!iframe) return;

    let player: YouTubePlayer | null = null;
    let settled = false;
    const timeout = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        failRef.current();
      }
    }, READY_TIMEOUT_MS);

    loadYouTubeApi()
      .then((api) => {
        // Built from the existing iframe, so the `live_stream?channel=` form —
        // which follows the channel rather than one broadcast — still works.
        player = new api.Player(iframe, {
          events: {
            onReady: (event) => {
              event.target.mute();
              event.target.playVideo();
            },
            onStateChange: (event) => {
              if (event.data === api.PlayerState.PLAYING && !settled) {
                settled = true;
                window.clearTimeout(timeout);
                readyRef.current();
              }
            },
            onError: () => {
              if (!settled) {
                settled = true;
                window.clearTimeout(timeout);
                failRef.current();
              }
            },
          },
        });
      })
      .catch(() => {
        if (!settled) {
          settled = true;
          window.clearTimeout(timeout);
          failRef.current();
        }
      });

    return () => {
      window.clearTimeout(timeout);
      settled = true;
      try {
        player?.destroy();
      } catch {
        // The iframe may already be gone; nothing to release.
      }
    };
  }, [source]);

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      {/*
        A 16:9 iframe blown up until it covers the viewport in both directions,
        which is how you get `object-fit: cover` behaviour out of an embed.
      */}
      <iframe
        ref={frameRef}
        title={source.label}
        src={youtubeEmbedUrl(source, window.location.origin)}
        allow="autoplay; encrypted-media; picture-in-picture"
        frameBorder="0"
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          width: "max(100vw, 177.78vh)",
          height: "max(100vh, 56.25vw)",
          border: 0,
        }}
      />
    </div>
  );
}
