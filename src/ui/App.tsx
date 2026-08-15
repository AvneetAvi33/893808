import { useCallback, useEffect, useRef, useState } from "react";
import { FrameInfo, Game } from "../game/Game";
import { MusicPlayer, TRACKS } from "../audio/MusicPlayer";
import { Sfx } from "../audio/Sfx";
import {
  IconChevron,
  IconHorn,
  IconMute,
  IconNext,
  IconNote,
  IconPause,
  IconPin,
  IconPlay,
  IconPrev,
  IconSound,
} from "./icons";

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const audioRef = useRef<{ ctx: AudioContext; music: MusicPlayer; sfx: Sfx } | null>(
    null,
  );

  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [sfxMuted, setSfxMuted] = useState(false);
  const [musicPlaying, setMusicPlaying] = useState(true);
  const [trackIndex, setTrackIndex] = useState(0);
  const [listOpen, setListOpen] = useState(false);
  const [info, setInfo] = useState<FrameInfo>({
    km: 0,
    city: "Jaipur",
    state: "Rajasthan",
    kmh: 0,
  });

  /* ---------------------------------------------------------------- *
   * Scene set up. The game is built as soon as the canvas exists so the
   * first frame after "Start driving" is already warm.
   * ---------------------------------------------------------------- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let game: Game | null = null;
    try {
      game = new Game(canvas, setInfo);
    } catch (err) {
      console.error("Anant: could not start the renderer", err);
      return;
    }
    gameRef.current = game;
    // The scene runs behind the title card, so the very first thing anyone
    // sees is already the drive.
    game.start();

    const onResize = () => game?.resize();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      game?.dispose();
      gameRef.current = null;
    };
  }, []);

  /* ---------------------------------------------------------------- *
   * Everything audio has to be created inside the first user gesture.
   * ---------------------------------------------------------------- */
  const begin = useCallback(() => {
    if (started) return;
    setStarted(true);

    gameRef.current?.start();
    gameRef.current?.launch();
    gameRef.current?.setSpeed(speed);

    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();
      void ctx.resume();

      const music = new MusicPlayer(ctx);
      const sfx = new Sfx(ctx);
      sfx.start();
      sfx.setSpeed(speed);
      music.play();

      audioRef.current = { ctx, music, sfx };
      setMusicPlaying(true);
      setTrackIndex(music.trackIndex);
    } catch (err) {
      console.warn("Anant: audio unavailable", err);
    }
  }, [started, speed]);

  useEffect(() => {
    return () => {
      audioRef.current?.music.dispose();
      audioRef.current?.sfx.dispose();
      void audioRef.current?.ctx.close();
      audioRef.current = null;
    };
  }, []);

  // Keep the engine note tied to the speed slider.
  useEffect(() => {
    gameRef.current?.setSpeed(speed);
    audioRef.current?.sfx.setSpeed(paused ? 0.12 : speed);
  }, [speed, paused]);

  const togglePause = () => {
    const next = !paused;
    setPaused(next);
    gameRef.current?.setPaused(next);
  };

  const toggleSfx = () => {
    const next = !sfxMuted;
    setSfxMuted(next);
    audioRef.current?.sfx.setMuted(next);
  };

  const toggleMusic = () => {
    const m = audioRef.current?.music;
    if (!m) return;
    m.toggle();
    setMusicPlaying(m.isPlaying);
  };

  const selectTrack = (i: number) => {
    const m = audioRef.current?.music;
    if (!m) {
      setTrackIndex(i);
      return;
    }
    m.setTrack(i);
    if (!m.isPlaying) m.play();
    setTrackIndex(m.trackIndex);
    setMusicPlaying(m.isPlaying);
  };

  const stepTrack = (dir: 1 | -1) => {
    const m = audioRef.current?.music;
    if (!m) {
      setTrackIndex((t) => (t + dir + TRACKS.length) % TRACKS.length);
      return;
    }
    if (dir === 1) m.next();
    else m.prev();
    if (!m.isPlaying) m.play();
    setTrackIndex(m.trackIndex);
    setMusicPlaying(m.isPlaying);
  };

  // Keyboard shortcuts, which make it feel finished on a desktop.
  useEffect(() => {
    if (!started) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.code === "Space") {
        e.preventDefault();
        togglePause();
      } else if (e.code === "KeyH") {
        audioRef.current?.sfx.horn();
      } else if (e.code === "KeyM") {
        toggleSfx();
      } else if (e.code === "ArrowRight") {
        stepTrack(1);
      } else if (e.code === "ArrowLeft") {
        stepTrack(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const km = Math.max(0, info.km);
  const whole = Math.floor(km);
  const frac = Math.floor((km - whole) * 100)
    .toString()
    .padStart(2, "0");

  const track = TRACKS[trackIndex] ?? TRACKS[0];

  return (
    <div className="anant-root font-body text-ink select-none">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* A faint warm veil at the very bottom, so the HUD always has contrast. */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40"
        style={{
          background:
            "linear-gradient(to top, rgba(60,36,10,0.20), rgba(60,36,10,0))",
        }}
      />

      {started && (
        <>
          <div className="fade pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2 sm:inset-x-5 sm:top-5">
          {/* Distance and place -------------------------------------- */}
          <div className="pointer-events-auto shrink-0">
            <div className="card rounded-3xl px-3.5 py-2.5 sm:px-5 sm:py-4">
              <div className="flex items-baseline gap-1">
                <span className="font-display text-3xl font-extrabold leading-none tracking-tight sm:text-5xl">
                  {whole.toLocaleString()}
                </span>
                <span className="font-display text-lg font-bold leading-none text-ink-soft">
                  .{frac}
                </span>
                <span className="ml-1 text-xs font-semibold uppercase tracking-[0.16em] text-ink-soft">
                  km
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-1.5 sm:mt-2">
                <IconPin className="text-marigold-deep" />
                <span className="text-sm font-bold leading-none">{info.city}</span>
                <span className="text-xs leading-none text-ink-soft">
                  · {info.state}
                </span>
              </div>
              <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
                {Math.round(info.kmh)} km/h
              </div>
            </div>
          </div>

          {/* Music ---------------------------------------------------- */}
          <div className="pointer-events-auto flex min-w-0 flex-col items-end gap-2">
            <div className="card flex max-w-full items-center gap-1 rounded-full py-1.5 pl-2 pr-1.5 sm:pl-2.5">
              <button
                type="button"
                onClick={() => setListOpen((v) => !v)}
                className="btn min-w-0 gap-2 px-1 py-1 text-left sm:px-1.5"
                aria-expanded={listOpen}
                aria-label="Choose a song"
              >
                <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-marigold/20 text-marigold-deep">
                  <IconNote className="text-[13px]" />
                  {musicPlaying && (
                    <span className="pulse absolute inset-0 rounded-full ring-2 ring-marigold/50" />
                  )}
                </span>
                <span className="hidden min-w-0 sm:block">
                  <span className="block truncate text-[13px] font-bold leading-tight">
                    {track.name}
                  </span>
                  <span className="block truncate text-[10px] font-medium uppercase tracking-[0.12em] text-ink-soft">
                    {musicPlaying ? "Now playing" : "Paused"}
                  </span>
                </span>
                <IconChevron
                  className={`shrink-0 text-ink-soft transition-transform ${
                    listOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              <div className="mx-0.5 h-7 w-px bg-ink/10" />

              <button
                type="button"
                onClick={() => stepTrack(-1)}
                aria-label="Previous song"
                className="btn hidden h-8 w-8 text-ink-soft hover:bg-ink/5 hover:text-ink sm:inline-flex"
              >
                <IconPrev className="text-[13px]" />
              </button>
              <button
                type="button"
                onClick={toggleMusic}
                aria-label={musicPlaying ? "Pause music" : "Play music"}
                className="btn h-9 w-9 bg-marigold text-white shadow-[0_4px_12px_-3px_rgba(180,110,10,0.7)] hover:bg-marigold-deep"
              >
                {musicPlaying ? (
                  <IconPause className="text-[13px]" />
                ) : (
                  <IconPlay className="translate-x-[1px] text-[13px]" />
                )}
              </button>
              <button
                type="button"
                onClick={() => stepTrack(1)}
                aria-label="Next song"
                className="btn h-8 w-8 text-ink-soft hover:bg-ink/5 hover:text-ink"
              >
                <IconNext className="text-[13px]" />
              </button>
            </div>

            {listOpen && (
              <div className="rise card thin-scroll max-h-[52vh] w-[15.5rem] max-w-[78vw] overflow-y-auto rounded-3xl p-2">
                <div className="px-2.5 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-ink-soft">
                  Songs for the road
                </div>
                {TRACKS.map((t, i) => {
                  const active = i === trackIndex;
                  return (
                    <button
                      key={t.name}
                      type="button"
                      onClick={() => selectTrack(i)}
                      className={`btn w-full justify-start rounded-2xl px-2.5 py-2 text-left ${
                        active ? "bg-marigold/18" : "hover:bg-ink/5"
                      }`}
                    >
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] ${
                          active
                            ? "bg-marigold text-white"
                            : "bg-ink/8 text-ink-soft"
                        }`}
                      >
                        {active && musicPlaying ? (
                          <IconPause className="text-[11px]" />
                        ) : (
                          <IconPlay className="translate-x-[1px] text-[11px]" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-bold leading-tight">
                          {t.name}
                        </span>
                        <span className="block truncate text-[11px] leading-tight text-ink-soft">
                          {t.mood}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          </div>

          {/* Drive controls ------------------------------------------- */}
          <div className="fade absolute inset-x-0 bottom-0 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-5">
            <div className="card flex w-full max-w-md items-center gap-2 rounded-full p-1.5 sm:gap-3 sm:p-2">
              <button
                type="button"
                onClick={togglePause}
                aria-label={paused ? "Resume the drive" : "Pause the drive"}
                className="btn h-11 w-11 shrink-0 bg-ink text-white hover:bg-ink/85"
              >
                {paused ? (
                  <IconPlay className="translate-x-[1px]" />
                ) : (
                  <IconPause />
                )}
              </button>

              <label className="flex min-w-0 flex-1 items-center gap-2 px-1">
                <span className="sr-only">Speed</span>
                <input
                  className="anant-slider w-full"
                  type="range"
                  min={0.2}
                  max={1.5}
                  step={0.01}
                  value={speed}
                  style={
                    {
                      "--fill": `${((speed - 0.2) / 1.3) * 100}%`,
                    } as React.CSSProperties
                  }
                  onChange={(e) => setSpeed(parseFloat(e.target.value))}
                  aria-label="Speed"
                />
                <span className="w-9 shrink-0 text-right text-[11px] font-bold tabular-nums text-ink-soft">
                  {speed.toFixed(1)}x
                </span>
              </label>

              <button
                type="button"
                onClick={() => audioRef.current?.sfx.horn()}
                className="btn h-11 shrink-0 gap-1.5 bg-marigold px-3 text-[13px] font-extrabold text-white shadow-[0_5px_14px_-4px_rgba(180,110,10,0.8)] hover:bg-marigold-deep sm:px-4"
              >
                <IconHorn />
                <span className="hidden sm:inline">Horn</span>
              </button>

              <button
                type="button"
                onClick={toggleSfx}
                aria-label={sfxMuted ? "Unmute effects" : "Mute effects"}
                className={`btn h-11 w-11 shrink-0 ${
                  sfxMuted
                    ? "bg-ink/10 text-ink-soft"
                    : "bg-ink/5 text-ink hover:bg-ink/10"
                }`}
              >
                {sfxMuted ? <IconMute /> : <IconSound />}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Title card ------------------------------------------------- */}
      {!started && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(110% 80% at 50% 46%, rgba(38,20,4,0.30) 0%, rgba(30,16,2,0.62) 55%, rgba(22,11,0,0.80) 100%)",
              backdropFilter: "blur(7px) saturate(1.1)",
              WebkitBackdropFilter: "blur(7px) saturate(1.1)",
            }}
          />
          <div className="relative flex w-full max-w-md flex-col items-center text-center">
            <div
              className="rise font-deva text-7xl font-extrabold leading-none sm:text-8xl"
              style={{
                background:
                  "linear-gradient(160deg,#fff0c2 0%,#f5b93d 42%,#c97a12 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                filter: "drop-shadow(0 6px 18px rgba(120,64,4,0.45))",
              }}
            >
              अनंत
            </div>

            <div
              className="rise mt-3 font-display text-[2.6rem] font-extrabold leading-none tracking-tight text-white sm:text-5xl"
              style={{
                animationDelay: "90ms",
                textShadow: "0 4px 22px rgba(70,38,4,0.55)",
              }}
            >
              Anant
            </div>

            <p
              className="rise mt-4 max-w-xs text-[15px] font-medium leading-relaxed text-white/95"
              style={{
                animationDelay: "180ms",
                textShadow: "0 2px 12px rgba(60,32,4,0.6)",
              }}
            >
              An endless golden hour drive across India. Sit back, the road takes
              care of itself.
            </p>

            <button
              type="button"
              onClick={begin}
              className="rise btn mt-9 h-14 w-full max-w-[17rem] bg-marigold px-8 font-display text-lg font-extrabold text-white shadow-[0_16px_40px_-14px_rgba(140,80,4,0.95)] hover:bg-marigold-deep"
              style={{ animationDelay: "260ms" }}
            >
              Start driving
            </button>

            <div
              className="rise mt-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/75"
              style={{ animationDelay: "340ms" }}
            >
              Sound on for the full journey
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
