import { useCallback, useEffect, useState } from "react";

interface LegacyFullscreen {
  webkitRequestFullscreen?: () => Promise<void> | void;
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenElement?: Element | null;
}

export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const sync = () => {
      const legacy = document as Document & LegacyFullscreen;
      setIsFullscreen(Boolean(document.fullscreenElement ?? legacy.webkitFullscreenElement));
    };
    sync();
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);

  const toggle = useCallback(() => {
    const root = document.documentElement as HTMLElement & LegacyFullscreen;
    const doc = document as Document & LegacyFullscreen;
    const active = document.fullscreenElement ?? doc.webkitFullscreenElement;
    try {
      if (active) {
        void (document.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
      } else {
        void (root.requestFullscreen?.({ navigationUI: "hide" }) ??
          root.webkitRequestFullscreen?.());
      }
    } catch {
      // iPhone Safari has no element fullscreen; the app is designed to look
      // right without it, so a refusal is not worth surfacing.
    }
  }, []);

  const supported =
    typeof document !== "undefined" &&
    Boolean(
      document.documentElement.requestFullscreen ??
        (document.documentElement as HTMLElement & LegacyFullscreen).webkitRequestFullscreen,
    );

  return { isFullscreen, toggle, supported };
}
