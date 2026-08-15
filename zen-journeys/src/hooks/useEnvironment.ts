import { useCallback, useEffect, useState } from "react";

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia(query).matches,
  );
  useEffect(() => {
    const list = window.matchMedia(query);
    const sync = () => setMatches(list.matches);
    sync();
    list.addEventListener("change", sync);
    return () => list.removeEventListener("change", sync);
  }, [query]);
  return matches;
}

/**
 * The operating system's reduce-motion setting. Honoured everywhere: the app
 * keeps its transitions, but they become simple fades with no large movement.
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}

const TV_STORAGE_KEY = "zen-journeys:tv-mode";

/**
 * Ten foot mode. Guessed from the display — a large screen you cannot hover,
 * which is what a TV browser looks like — and overridable by hand, because the
 * guess is only a guess and someone across the room should be able to say so.
 */
export function useTvMode() {
  const looksLikeTv = useMediaQuery("(min-width: 1400px) and (hover: none)");
  const [override, setOverride] = useState<boolean | null>(() => {
    if (typeof localStorage === "undefined") return null;
    const stored = localStorage.getItem(TV_STORAGE_KEY);
    return stored === null ? null : stored === "on";
  });

  const enabled = override ?? looksLikeTv;

  useEffect(() => {
    document.documentElement.dataset.tv = enabled ? "on" : "off";
  }, [enabled]);

  const toggle = useCallback(() => {
    setOverride((current) => {
      const next = !(current ?? looksLikeTv);
      try {
        localStorage.setItem(TV_STORAGE_KEY, next ? "on" : "off");
      } catch {
        // Private mode. The setting simply will not persist.
      }
      return next;
    });
  }, [looksLikeTv]);

  return { enabled, toggle };
}

/** True on phone-sized screens, where controls move into thumb reach. */
export function useIsCompact(): boolean {
  return useMediaQuery("(max-width: 640px)");
}

export function useIsPortrait(): boolean {
  return useMediaQuery("(orientation: portrait)");
}
