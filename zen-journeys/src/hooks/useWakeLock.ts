import { useEffect, useRef } from "react";

/**
 * Keeps the display awake for as long as a scene is on screen, and hands the
 * lock straight back when it is not. The lock is dropped by the browser
 * whenever the tab is hidden, so it is re-taken on the way back.
 */
export function useWakeLock(active: boolean): void {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let cancelled = false;

    const acquire = async () => {
      if (cancelled || document.visibilityState !== "visible") return;
      try {
        sentinelRef.current = await navigator.wakeLock.request("screen");
      } catch {
        // Denied, or the device is on low power. Not worth telling anyone.
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible" && !sentinelRef.current) void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void sentinelRef.current?.release().catch(() => undefined);
      sentinelRef.current = null;
    };
  }, [active]);
}
