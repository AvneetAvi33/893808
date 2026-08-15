# Anant — अनंत

An endless golden hour drive across India, in a single self contained HTML file.

A cream Ambassador cruises forever down a highway while a low poly Indian town
rolls past. The car drives itself and steers around slower traffic. The scenery
shifts as the journey crosses regions. There is a music player with four
original instrumentals, plus engine and horn sound effects. Every note and
every texture is generated in code, so the whole thing is one file with no
assets, no server and no third party media.

## Running it

`anant.html` in the repository root is the built game. Open it in a browser and
that is it: no server, no sibling files, nothing to install. It works on
desktop and mobile.

To rebuild it from source:

```bash
npm install
npm run build              # type check, then bundle
cp dist/index.html anant.html
```

For development with hot reload:

```bash
npm run dev
```

## How it works

### The endless road

The car never moves forward. The world scrolls toward the camera instead, and
every repeating object is pooled and recycled, so nothing is allocated or
destroyed once the drive starts.

Each frame adds `base speed × speed multiplier × delta` to a running distance
and shifts every world object toward the camera by the same amount. When an
object passes behind the camera it is sent back to the far end of the band and
given fresh random properties. A fixed set of eleven ground tiles, a few dozen
buildings and a handful of vehicles produce a town that never repeats.

Ground tiles work the same way. The asphalt texture repeats a whole number of
times per tile, so a tile can be teleported to the far end with no visible seam.

### Traffic and self driving

Three lanes, and traffic that travels slower than the hero, so the car
constantly catches up and has to get around it.

Spawning guarantees at least one open lane in every fresh stretch, and never
stacks two vehicles too closely in the same lane. That is not enough on its
own: vehicles travel at different speeds, so a stretch that was open when it
spawned closes up later. Three things handle the rest.

1. **Lane choice by score, not by veto.** Every candidate line across the road
   is scored by how much clear road it has ahead, offset by how far the car
   would have to move, how far it would sit from a lane centre, and how far
   from the middle of the carriageway. Overtaking emerges from that: the clear
   lane simply scores best. The current line carries a bonus so the car commits
   to a manoeuvre rather than dithering.
2. **Crossings are checked for survivability.** A two lane move takes close to
   a second, and in that second the car covers a lot of road. So the test is
   not "is that lane occupied" but "would we reach the thing in it before we
   are past it".
3. **Car following.** Whatever is still in the way after all that sets the
   speed. The car eases onto its bumper and holds station until a gap opens.

Traffic speeds are fractions of the *requested* cruising speed, never of the
braked speed. Scaling them with the brake would slow the traffic by the same
amount the car slowed, and the gap would never stop closing.

Verified by simulating eight minutes of driving at both the default and maximum
speed settings: no contact, no lean outside its clamp, and the car still
averages roughly three quarters of the requested speed with regular overtakes.

### Look

- Physically based materials throughout. The car uses a clearcoat over a base
  coat, which is most of the difference between "painted metal" and "coloured
  plastic".
- A shader sky dome, not a CSS gradient. It gives a real horizon and a sun disc
  the bloom pass can catch, and it is baked once into a prefiltered environment
  map, so the paint and chrome reflect the same sky you can see.
- Two sun directions on purpose: the shading light sits high enough for long
  but sane shadows, while the drawn sun disc sits near the horizon where its
  glow belongs.
- ACES filmic tone mapping, soft shadows, multisampled HDR buffer, bloom, and a
  final grade pass with a vignette and a whisper of grain.
- Distant ridges opt out of scene fog so their aerial haze can be dialled in
  directly, which keeps them visible past the fog's far plane.
- Every texture is drawn into a small canvas at start up: asphalt colour,
  roughness and normal from one shared height field; ground cover; lit building
  facades with a matching emissive map; awnings; hoardings; dust; contact
  shadows.

### Audio

Two independent classes over the Web Audio API, so the two mute controls do not
interfere.

- **Music.** Four original loops defined only as data: a tonic, a scale, a
  tempo, a waveform, a sixteen step melody and a chord cycle. A lookahead
  scheduler queues notes slightly ahead of the audio clock, stepping in
  sixteenths: a plucked melody, a bass on the main beats, a sustained pad once
  per bar, a kick and tabla figure, and hats on the rhythmic tracks. A short
  synthesised plate reverb sits across it.
- **Effects.** A warm engine from two detuned oscillators through a low pass
  and a soft clipper, plus filtered noise for road wind, both tied to the speed
  slider. A two tone horn built from three partials.

All of it starts on the first tap, because browsers block audio until then.

## Controls

| Control | Action |
| --- | --- |
| Speed slider | 0.2× to 1.5× |
| Pause / play | Freezes the whole animation |
| Horn | Two tone horn (`H`) |
| Mute | Effects only, separate from the music (`M`) |
| Space | Pause / play |
| ← / → | Previous / next song |

## Layout

```
src/
  main.tsx            entry; injects the Google Fonts link at runtime
  index.css           Tailwind theme and the HUD card styling
  ui/App.tsx          title card and heads up display
  ui/icons.tsx        inline SVG icons
  game/Game.ts        scene, pools, frame loop, driving logic
  game/ground.ts      recycled road tiles
  game/props.ts       the town: houses, towers, shops, temples, planting
  game/vehicles.ts    hero Ambassador and four traffic silhouettes
  game/sky.ts         sky dome shader and the baked environment map
  game/textures.ts    every canvas generated texture
  game/palette.ts     colour sets and the regions of the journey
  audio/MusicPlayer.ts
  audio/Sfx.ts
```

## Notes on things that bite

- **Fonts are injected with JavaScript**, not written into the HTML head. The
  single file bundler tries to inline anything it finds as a `<link>`, and a
  remote URL cannot be inlined, so it would fail the build.
- **The root container is pinned to the viewport** with fixed positioning and
  explicit viewport units. A container that collapses to zero height inside an
  embed is the classic blank screen. Every size read has a fallback, and the
  canvas is re measured on the first animation frame after start.
- **Every frame is wrapped in a try and catch**, and the region lookup is
  defensive about a non finite distance. One bad frame cannot stop the game.
- **The car's lean comes from its actual sideways velocity**, clamped, never
  from the distance to its target lane. Deriving it from the gap makes a two
  lane jump produce a huge angle for one frame and the car appears to flip.
- **`composer.setSize` already scales by the pixel ratio** and resizes every
  pass, so passes must not be resized again by hand.
