# Zen Journeys

Pick a travelling scene, let it fill the screen, and breathe.

Four journeys — a live view of Earth from orbit, a bus on a mountain road, a
car on an open highway, a train window — each with its own playlist of classic
Indian songs, its own colour, and a floating glass player that gets out of the
way after three seconds so the whole thing becomes a screensaver.

Works on a laptop, a phone and a television, installs as a Progressive Web App,
and keeps the display awake while a journey is playing.

## Running it

```bash
cd zen-journeys
npm install
npm run dev        # development, with hot reload
npm run build      # type check, then bundle to dist/
npm run preview    # serve the built bundle
npm run icons      # regenerate the app icons from scripts/make-icons.mjs
```

## What ships, and what does not

**No copyrighted media is bundled here.** That is a deliberate constraint, not
an omission, and the app is built to be fully usable under it:

- **Scenes.** Every journey falls back to a scene drawn in code on a canvas —
  a drifting star field over the limb of the Earth, a pseudo-3D road at golden
  hour, a countryside sliding past a carriage window. They need no files and no
  network, so the screen is never empty. The galaxy scene additionally embeds
  NASA's public live stream (NASA footage is public domain) and falls through to
  the canvas the moment the stream is offline, blocked or slow.
- **Music.** The playlists carry real song titles and artists as sample
  metadata, but no recordings. Each placeholder track is synthesised at runtime
  into a real WAV — a slow tonic-drone pad in a raga-like scale, deterministic
  per track — so seek, crossfade, shuffle, repeat and auto advance all work
  and can be judged before a single licensed file exists.

### Adding real content

Every piece of media is declared in two config files and nowhere else, so real
content drops in without touching a component.

**Video** — put files in `public/assets/video/` and uncomment the `video`
source in `src/config/scenes.ts`:

```ts
sources: [
  { kind: "video", src: "/assets/video/bus.mp4", label: "Mountain road" },
  { kind: "canvas", label: "Mountain road, drawn in code" }, // stays as the floor
],
```

Sources are tried top to bottom and the canvas entry is always last, so a video
that fails to load costs nothing. Videos should be muted-autoplay friendly and
seamlessly loopable; the music is a separate stream, so they need no audio.

**Audio** — put files in `public/assets/audio/` and fill in `src` in
`src/config/playlists.ts`:

```ts
{ id: "bs-1", title: "Suhana Safar…", artist: "Mukesh", src: "/assets/audio/suhana-safar.m4a", … }
```

The moment a track has a `src`, the synthesiser stops running for it. The
`duration` field is only a hint shown before the file loads; once loaded, the
player uses the length the file itself reports.

## Controls

| | |
|---|---|
| Space, K | play / pause |
| ← → | previous / next track (on the entry screen: change journey) |
| ↑ ↓ | volume |
| 1–4 | jump straight to a journey |
| Q | playlist drawer |
| S / R | shuffle / repeat |
| M | mute |
| F | fullscreen |
| Esc | back to the journeys |

Everything is reachable by pointer, touch and keyboard, with focus outlines
that grow in big-screen mode. Drag or swipe the entry carousel; a flick throws
further than a nudge.

## How it works

### The audio engine

`hooks/useAudioEngine.ts` wraps Howler in a playlist engine. The part worth
knowing about is the hand-off: a position ticker watches the playing track and
starts the *next* one 2.2 seconds before the current one ends, fading one up
while the other fades down. Tracks therefore overlap rather than stop, which is
most of what makes the app feel calm. `onend` remains wired as a safety net for
short files, for repeat-one, and for anything the ticker misses.

Switching journeys uses the same crossfade, so a scene change is one continuous
piece of sound rather than a cut.

### The scene stage

`components/SceneStage` layers backgrounds instead of choosing between them.
The canvas scene starts instantly at the bottom; a stream or video is mounted
above it and fades in *only once it is genuinely playing*, then the canvas loop
is torn down. A source that fails advances the chain. Nobody is ever shown an
error or a black rectangle.

### Motion

Framer Motion throughout, on one pair of easing curves, with transform and
opacity only. The entry carousel derives every card's scale, dim and parallax
from a single signed distance-from-centre value. Entering a journey is a
hand-off, not a route change: the selector pushes toward the viewer and
dissolves, a veil closes, the scene mounts behind it with the music already
rising, and the veil lifts.

Neighbour cards are dimmed with a black overlay rather than a CSS `brightness`
filter — the filter forces the rounded clip and the canvas onto separate layers,
which Chromium seams at the corners, and it costs far more per frame.

The operating system's reduce-motion setting is honoured everywhere: the
transitions stay, but become simple fades with no large movement, and the
canvas scenes slow to a drift rather than freezing (a still frame reads as
broken).

### Structure

```
src/
  App.tsx                  two screens and the doorway between them
  config/scenes.ts         the 4 journeys: colour, mood, sources, fallbacks
  config/playlists.ts      per journey playlists (placeholder song data)
  hooks/useAudioEngine.ts  Howler playlist engine with crossfade
  hooks/useIdleControls.ts auto hide controls and cursor
  hooks/useWakeLock.ts     keep the display awake during a journey
  hooks/useEnvironment.ts  reduced motion, big screen mode, compact, orientation
  audio/placeholderTones.ts  synthesised stand-in music
  audio/ambient.ts         optional engine hum / rail clatter / space tone
  scenes/procedural.ts     the canvas scenes
  components/…             MoodSelector, SceneStage, Player, PlaylistDrawer,
                           SceneSwitcher, Controls, ImmersiveScene
```

## Notes

- The NASA embed follows a channel rather than a single broadcast, so it
  survives the feed being restarted under a new video id. If it ever goes
  permanently blank, check `NASA_CHANNEL_ID` in `src/config/scenes.ts`; the
  canvas star field covers for it in the meantime.
- Fonts load from Google Fonts as a progressive enhancement. Every stack falls
  back to a system face, including for Devanagari, so the app is fully legible
  offline.
- The ambient realism layer is off by default and mixed far under the music.
