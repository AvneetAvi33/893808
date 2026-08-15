import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Howl, Howler } from "howler";
import type { RepeatMode, Track } from "../types";
import { placeholderTrackUrl, releasePlaceholderTracks } from "../audio/placeholderTones";

/** Long enough to feel like a dissolve rather than a cut. */
const CROSSFADE_MS = 2200;
/** Position polling: fast enough for a smooth bar, slow enough to be free. */
const TICK_MS = 200;

export interface AudioEngine {
  track: Track | null;
  playlist: Track[];
  /** Playback order after shuffle. */
  queue: Track[];
  isPlaying: boolean;
  isLoading: boolean;
  /** The browser refused to start audio; the user has to allow it once. */
  blocked: boolean;
  position: number;
  duration: number;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  playTrack: (trackId: string) => void;
  seek: (seconds: number) => void;
  setVolume: (value: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  /** Swap in a scene's playlist, crossfading out of whatever is playing. */
  loadPlaylist: (tracks: Track[], options?: { autoplay?: boolean }) => void;
  unlock: () => void;
}

function naturalOrder(length: number): number[] {
  return Array.from({ length }, (_, i) => i);
}

/** Fisher-Yates over everything but `first`, which stays at the front. */
function shuffledOrder(length: number, first: number): number[] {
  const rest = naturalOrder(length).filter((i) => i !== first);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return first >= 0 && first < length ? [first, ...rest] : rest;
}

async function resolveSource(track: Track): Promise<{ url: string; synthetic: boolean }> {
  if (track.src) return { url: track.src, synthetic: false };
  return { url: await placeholderTrackUrl(track.id), synthetic: true };
}

export function useAudioEngine(initial: Track[] = []): AudioEngine {
  const [playlist, setPlaylist] = useState<Track[]>(initial);
  const [order, setOrder] = useState<number[]>(() => naturalOrder(initial.length));
  const [orderIndex, setOrderIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>("all");

  const howlRef = useRef<Howl | null>(null);
  /** Howls on their way out, kept only until their fade finishes. */
  const retiringRef = useRef<Howl[]>([]);
  /** Guards against a slow load landing after the user has moved on. */
  const loadTokenRef = useRef(0);
  /** True between "start handing over to the next track" and "it is playing". */
  const advancingRef = useRef(false);

  // Mirrors, so the imperative audio callbacks always read live values without
  // being rebuilt on every render.
  const listRef = useRef(playlist);
  const orderRef = useRef(order);
  const indexRef = useRef(orderIndex);
  const volumeRef = useRef(volume);
  const mutedRef = useRef(muted);
  const repeatRef = useRef(repeat);
  listRef.current = playlist;
  orderRef.current = order;
  indexRef.current = orderIndex;
  volumeRef.current = volume;
  mutedRef.current = muted;
  repeatRef.current = repeat;

  const liveVolume = () => (mutedRef.current ? 0 : volumeRef.current);

  const retire = useCallback((howl: Howl | null, fadeMs: number) => {
    if (!howl) return;
    retiringRef.current.push(howl);
    const drop = () => {
      howl.stop();
      howl.unload();
      retiringRef.current = retiringRef.current.filter((entry) => entry !== howl);
    };
    if (fadeMs > 0 && howl.playing()) {
      howl.fade(howl.volume(), 0, fadeMs);
      window.setTimeout(drop, fadeMs + 80);
    } else {
      drop();
    }
  }, []);

  /** Declared up front so the Howl callbacks below can reach the newest one. */
  const advanceRef = useRef<(delta: number, options?: { auto?: boolean }) => void>(() => {});
  const advance = useCallback(
    (delta: number, options?: { auto?: boolean }) => advanceRef.current(delta, options),
    [],
  );

  /**
   * Load the track at `index` of the given order and hand playback over to it,
   * fading the outgoing track out across the same window so the two overlap.
   *
   * `list` and `ord` are passed explicitly because `loadPlaylist` needs to
   * start a track from state React has not committed yet.
   */
  const begin = useCallback(
    (
      index: number,
      options: { autoplay: boolean; fadeMs: number },
      list: Track[] = listRef.current,
      ord: number[] = orderRef.current,
    ) => {
      const track = list[ord[index]];
      if (!track) return;

      const token = ++loadTokenRef.current;
      advancingRef.current = true;
      setOrderIndex(index);
      indexRef.current = index;
      setIsLoading(true);
      setPosition(0);
      setDuration(track.duration || 0);

      const outgoing = howlRef.current;
      howlRef.current = null;
      retire(outgoing, options.fadeMs);

      void resolveSource(track).then(({ url, synthetic }) => {
        if (token !== loadTokenRef.current) return; // superseded mid-load

        const current = () => token === loadTokenRef.current;
        const howl = new Howl({
          src: [url],
          // A blob URL carries no extension for Howler to sniff.
          format: synthetic ? ["wav"] : undefined,
          html5: false, // Web Audio: needed for dependable fades and seeking.
          volume: options.fadeMs > 0 ? 0 : liveVolume(),
          onload: () => {
            if (!current()) return;
            setDuration(howl.duration() || track.duration || 0);
            setIsLoading(false);
          },
          onloaderror: () => {
            if (!current()) return;
            setIsLoading(false);
            // A missing or unplayable file must not strand the queue.
            window.setTimeout(() => advance(1, { auto: true }), 400);
          },
          onplay: () => {
            if (!current()) return;
            setIsPlaying(true);
            setBlocked(false);
            advancingRef.current = false;
          },
          onpause: () => current() && setIsPlaying(false),
          onstop: () => current() && setIsPlaying(false),
          onplayerror: () => {
            if (!current()) return;
            // Autoplay policy: wait for a gesture, then pick up where we were.
            setBlocked(true);
            setIsPlaying(false);
            howl.once("unlock", () => {
              if (!current()) return;
              howl.play();
              setBlocked(false);
            });
          },
          onend: () => {
            // The ticker normally crossfades before this fires; this catches
            // short files, repeat-one, and anything the ticker missed.
            if (current() && !advancingRef.current) advance(1, { auto: true });
          },
        });

        howlRef.current = howl;
        if (options.autoplay) {
          howl.play();
          if (options.fadeMs > 0) howl.fade(0, liveVolume(), options.fadeMs);
        } else {
          advancingRef.current = false;
        }
      });

      // Warm the next track while this one plays, so its crossfade is ready.
      const upcoming = list[ord[(index + 1) % Math.max(ord.length, 1)]];
      if (upcoming && !upcoming.src) void placeholderTrackUrl(upcoming.id);
    },
    [advance, retire],
  );

  advanceRef.current = (delta, options) => {
    const ord = orderRef.current;
    if (ord.length === 0) return;

    if (options?.auto && repeatRef.current === "one") {
      begin(indexRef.current, { autoplay: true, fadeMs: CROSSFADE_MS });
      return;
    }

    const next = indexRef.current + delta;
    if (next >= ord.length) {
      if (options?.auto && repeatRef.current === "off") {
        // End of the queue: settle into silence rather than looping back.
        retire(howlRef.current, CROSSFADE_MS);
        howlRef.current = null;
        setIsPlaying(false);
        return;
      }
      begin(0, { autoplay: true, fadeMs: CROSSFADE_MS });
      return;
    }
    begin(next < 0 ? ord.length - 1 : next, { autoplay: true, fadeMs: CROSSFADE_MS });
  };

  // Position ticker, and the early hand-off that makes tracks crossfade.
  useEffect(() => {
    const id = window.setInterval(() => {
      const howl = howlRef.current;
      if (!howl || !howl.playing()) return;
      const seconds = howl.seek();
      if (typeof seconds !== "number") return;
      setPosition(seconds);
      const total = howl.duration();
      const fadeSeconds = CROSSFADE_MS / 1000;
      if (
        total > fadeSeconds + 1 &&
        total - seconds <= fadeSeconds &&
        !advancingRef.current
      ) {
        advance(1, { auto: true });
      }
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [advance]);

  // Volume changes reach the live track at once, not on the next play.
  useEffect(() => {
    const howl = howlRef.current;
    // Never fight an in-flight crossfade.
    if (howl && !advancingRef.current) howl.volume(muted ? 0 : volume);
  }, [muted, volume]);

  // Release everything when the engine goes away, so nothing plays on in the dark.
  useEffect(
    () => () => {
      loadTokenRef.current++;
      howlRef.current?.stop();
      howlRef.current?.unload();
      howlRef.current = null;
      for (const howl of retiringRef.current) {
        howl.stop();
        howl.unload();
      }
      retiringRef.current = [];
      Howler.unload();
      releasePlaceholderTracks();
    },
    [],
  );

  const play = useCallback(() => {
    const howl = howlRef.current;
    if (howl) {
      howl.play();
      howl.fade(howl.volume(), mutedRef.current ? 0 : volumeRef.current, 400);
      return;
    }
    if (orderRef.current.length > 0) {
      begin(indexRef.current, { autoplay: true, fadeMs: 900 });
    }
  }, [begin]);

  const pause = useCallback(() => {
    const howl = howlRef.current;
    if (!howl) return;
    // A short fade out, so pausing never chops a note in half.
    howl.fade(howl.volume(), 0, 320);
    window.setTimeout(() => {
      howl.pause();
      howl.volume(liveVolume());
    }, 340);
    setIsPlaying(false);
  }, []);

  const toggle = useCallback(() => {
    if (isPlaying) pause();
    else play();
  }, [isPlaying, pause, play]);

  const seek = useCallback((seconds: number) => {
    const howl = howlRef.current;
    if (!howl) return;
    const total = howl.duration() || 0;
    const clamped = Math.max(0, Math.min(total > 0 ? total - 0.25 : seconds, seconds));
    howl.seek(clamped);
    setPosition(clamped);
  }, []);

  const playTrack = useCallback(
    (trackId: string) => {
      const trackIndex = listRef.current.findIndex((track) => track.id === trackId);
      if (trackIndex < 0) return;
      const target = orderRef.current.indexOf(trackIndex);
      if (target < 0) return;
      begin(target, { autoplay: true, fadeMs: CROSSFADE_MS });
    },
    [begin],
  );

  const previous = useCallback(() => {
    const howl = howlRef.current;
    const at = howl?.seek();
    // Standard player behaviour: restart the track before stepping back.
    if (typeof at === "number" && at > 4) {
      seek(0);
      return;
    }
    advance(-1);
  }, [advance, seek]);

  const toggleShuffle = useCallback(() => {
    const playing = orderRef.current[indexRef.current];
    const length = listRef.current.length;
    setShuffle((wasOn) => {
      if (wasOn) {
        const natural = naturalOrder(length);
        setOrder(natural);
        orderRef.current = natural;
        const restored = Math.max(0, natural.indexOf(playing));
        setOrderIndex(restored);
        indexRef.current = restored;
      } else {
        // The current track stays put; everything after it is reshuffled.
        const shuffledList = shuffledOrder(length, playing ?? 0);
        setOrder(shuffledList);
        orderRef.current = shuffledList;
        setOrderIndex(0);
        indexRef.current = 0;
      }
      return !wasOn;
    });
  }, []);

  const cycleRepeat = useCallback(() => {
    setRepeat((mode) => (mode === "off" ? "all" : mode === "all" ? "one" : "off"));
  }, []);

  const loadPlaylist = useCallback(
    (tracks: Track[], options?: { autoplay?: boolean }) => {
      const fresh = shuffle ? shuffledOrder(tracks.length, 0) : naturalOrder(tracks.length);
      setPlaylist(tracks);
      setOrder(fresh);
      listRef.current = tracks;
      orderRef.current = fresh;
      begin(0, { autoplay: options?.autoplay !== false, fadeMs: CROSSFADE_MS }, tracks, fresh);
    },
    [begin, shuffle],
  );

  const unlock = useCallback(() => {
    void Howler.ctx?.resume();
    setBlocked(false);
    const howl = howlRef.current;
    if (howl) {
      howl.play();
      howl.volume(liveVolume());
    } else {
      play();
    }
  }, [play]);

  const setVolume = useCallback((value: number) => {
    const clamped = Math.max(0, Math.min(1, value));
    setVolumeState(clamped);
    if (clamped > 0) setMuted(false);
  }, []);

  const queue = useMemo(
    () => order.map((index) => playlist[index]).filter(Boolean),
    [order, playlist],
  );

  return {
    track: playlist[order[orderIndex]] ?? null,
    playlist,
    queue,
    isPlaying,
    isLoading,
    blocked,
    position,
    duration,
    volume,
    muted,
    shuffle,
    repeat,
    play,
    pause,
    toggle,
    next: useCallback(() => advance(1), [advance]),
    previous,
    playTrack,
    seek,
    setVolume,
    toggleMute: useCallback(() => setMuted((value) => !value), []),
    toggleShuffle,
    cycleRepeat,
    loadPlaylist,
    unlock,
  };
}
