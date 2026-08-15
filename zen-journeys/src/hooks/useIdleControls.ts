import { useCallback, useEffect, useRef, useState } from "react";

const IDLE_MS = 3000;

/**
 * Fades the interface away when nothing is happening, so a scene becomes a
 * clean screensaver, and brings it back on the first sign of life. The cursor
 * goes with it: a visible arrow over a still scene ruins the illusion.
 *
 * `pinned` holds the controls open regardless — used while a drawer is open or
 * a control has keyboard focus, where hiding would be hostile.
 */
export function useIdleControls(pinned = false, idleMs = IDLE_MS) {
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<number | undefined>(undefined);
  const pinnedRef = useRef(pinned);
  pinnedRef.current = pinned;

  const wake = useCallback(() => {
    setVisible(true);
    window.clearTimeout(timerRef.current);
    if (pinnedRef.current) return;
    timerRef.current = window.setTimeout(() => setVisible(false), idleMs);
  }, [idleMs]);

  useEffect(() => {
    // Re-arm whenever the pin is released, and cancel the timer while held.
    wake();
  }, [pinned, wake]);

  useEffect(() => {
    const events: (keyof WindowEventMap)[] = [
      "pointermove",
      "pointerdown",
      "keydown",
      "wheel",
      "touchstart",
    ];
    for (const event of events) {
      window.addEventListener(event, wake, { passive: true });
    }
    return () => {
      for (const event of events) window.removeEventListener(event, wake);
      window.clearTimeout(timerRef.current);
    };
  }, [wake]);

  useEffect(() => {
    document.body.dataset.cursor = visible ? "shown" : "hidden";
    return () => {
      document.body.dataset.cursor = "shown";
    };
  }, [visible]);

  return { visible, wake };
}
