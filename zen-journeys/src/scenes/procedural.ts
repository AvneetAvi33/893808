/*
  Scenes drawn in code.

  Every journey falls back to one of these when its video is missing, blocked or
  still loading, so the screen is never empty and nothing here needs a licence.
  They are deliberately calm: slow drift, no cuts, nothing that demands
  attention. Canvas 2D throughout, one animation frame loop per scene, and no
  allocation inside the loop.
*/

import type { SceneId } from "../types";

export interface SceneHandle {
  stop: () => void;
}

interface Palette {
  skyTop: string;
  skyHorizon: string;
  sun: string;
  ridgeFar: string;
  ridgeMid: string;
  ridgeNear: string;
  road: string;
  roadEdge: string;
  markings: string;
  haze: string;
}

const PALETTES: Record<"bus" | "car" | "train", Palette> = {
  bus: {
    skyTop: "#1b1420",
    skyHorizon: "#e0904e",
    sun: "#ffcf94",
    ridgeFar: "#4a3448",
    ridgeMid: "#31243a",
    ridgeNear: "#1b1526",
    road: "#2b2430",
    roadEdge: "#463949",
    markings: "#e8d3ae",
    haze: "#d9853f",
  },
  car: {
    skyTop: "#0f2430",
    skyHorizon: "#e87a3c",
    sun: "#ffb06a",
    ridgeFar: "#2c4a4c",
    ridgeMid: "#1d3436",
    ridgeNear: "#122225",
    road: "#1f292c",
    roadEdge: "#37494c",
    markings: "#e5d9c4",
    haze: "#c9663a",
  },
  train: {
    skyTop: "#141a16",
    skyHorizon: "#c9a97e",
    sun: "#e8d3a4",
    ridgeFar: "#4c5748",
    ridgeMid: "#333c31",
    ridgeNear: "#1e241d",
    road: "#1a1f19",
    roadEdge: "#2a3227",
    markings: "#d8cbb0",
    haze: "#a3b58c",
  },
};

/** Deterministic value noise, so a ridgeline is the same shape every frame. */
function noise1d(x: number, seed: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const hash = (n: number) => {
    const v = Math.sin((n * 127.1 + seed * 311.7) * 43758.5453);
    return v - Math.floor(v);
  };
  // Smootherstep: the first and second derivatives vanish at both ends, which
  // is the difference between rolling hills and a jagged audio waveform.
  const smooth = f * f * f * (f * (f * 6 - 15) + 10);
  return hash(i) * (1 - smooth) + hash(i + 1) * smooth;
}

/**
 * Height of a ridge at `x`, where one unit of x is one large landform. Three
 * octaves: the big shape, a shoulder, and a little roughness on top.
 */
function ridgeHeight(x: number, seed: number): number {
  return (
    noise1d(x, seed) * 0.62 +
    noise1d(x * 2.3, seed + 9) * 0.26 +
    noise1d(x * 5.1, seed + 21) * 0.12
  );
}

/** Shared frame loop: sizing, device pixel ratio, tab visibility, teardown. */
function runLoop(
  canvas: HTMLCanvasElement,
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number, time: number) => void,
): SceneHandle {
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return { stop: () => undefined };

  let width = 0;
  let height = 0;
  let frame = 0;
  let last = performance.now();
  let time = 0;
  let running = true;

  const resize = () => {
    // Cap the pixel ratio: a 4K TV gains nothing from a 3x buffer here.
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  };

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  const tick = (now: number) => {
    if (!running) return;
    // Clamped so returning to a backgrounded tab never jumps the world forward.
    const delta = Math.min((now - last) / 1000, 0.05);
    last = now;
    time += delta;
    draw(ctx, width, height, time);
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);

  const onVisibility = () => {
    if (document.visibilityState === "visible") {
      last = performance.now();
      if (running) frame = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(frame);
    }
  };
  document.addEventListener("visibilitychange", onVisibility);

  return {
    stop: () => {
      running = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    },
  };
}

/* -------------------------------------------------------------------------
   Galaxy: a drifting star field over the limb of the Earth
------------------------------------------------------------------------- */

function galaxyScene(canvas: HTMLCanvasElement, slow: number): SceneHandle {
  // A soft bloom sprite, drawn once. Painting the halo as a rectangle is what
  // turns a star field into a field of little squares on a high density screen.
  const bloom = document.createElement("canvas");
  bloom.width = 64;
  bloom.height = 64;
  const bloomCtx = bloom.getContext("2d");
  if (bloomCtx) {
    const gradient = bloomCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(196, 206, 255, 0.55)");
    gradient.addColorStop(0.4, "rgba(150, 165, 255, 0.16)");
    gradient.addColorStop(1, "rgba(150, 165, 255, 0)");
    bloomCtx.fillStyle = gradient;
    bloomCtx.fillRect(0, 0, 64, 64);
  }

  const STAR_COUNT = 420;
  const stars = Array.from({ length: STAR_COUNT }, () => ({
    x: Math.random(),
    y: Math.random(),
    // Depth drives size, brightness and drift speed together.
    depth: 0.2 + Math.random() * 0.8,
    phase: Math.random() * Math.PI * 2,
    twinkle: 0.4 + Math.random() * 1.6,
  }));

  return runLoop(canvas, (ctx, width, height, time) => {
    ctx.fillStyle = "#04030a";
    ctx.fillRect(0, 0, width, height);

    // Two slow nebula washes, drifting against each other.
    const drift = Math.sin(time * 0.03 * slow) * 0.06;
    const nebulaA = ctx.createRadialGradient(
      width * (0.28 + drift),
      height * 0.3,
      0,
      width * 0.28,
      height * 0.3,
      Math.max(width, height) * 0.75,
    );
    nebulaA.addColorStop(0, "rgba(96, 84, 190, 0.30)");
    nebulaA.addColorStop(0.5, "rgba(52, 40, 110, 0.12)");
    nebulaA.addColorStop(1, "rgba(4, 3, 10, 0)");
    ctx.fillStyle = nebulaA;
    ctx.fillRect(0, 0, width, height);

    const nebulaB = ctx.createRadialGradient(
      width * (0.78 - drift),
      height * 0.62,
      0,
      width * 0.78,
      height * 0.62,
      Math.max(width, height) * 0.6,
    );
    nebulaB.addColorStop(0, "rgba(150, 92, 190, 0.20)");
    nebulaB.addColorStop(1, "rgba(4, 3, 10, 0)");
    ctx.fillStyle = nebulaB;
    ctx.fillRect(0, 0, width, height);

    // Stars drift sideways, wrapping, at a speed set by their depth.
    for (const star of stars) {
      const speed = 0.0035 * star.depth * slow;
      const x = ((star.x - time * speed) % 1 + 1) % 1;
      const px = x * width;
      const py = star.y * height;
      const brightness =
        0.35 + 0.65 * star.depth * (0.7 + 0.3 * Math.sin(time * star.twinkle + star.phase));
      const size = Math.max(1, star.depth * 1.7);
      if (star.depth > 0.8) {
        // The brightest few carry a halo.
        const halo = size * 7;
        ctx.globalAlpha = brightness * 0.75;
        ctx.drawImage(bloom, px - halo / 2, py - halo / 2, halo, halo);
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = `rgba(232, 234, 255, ${brightness.toFixed(3)})`;
      ctx.fillRect(px, py, size, size);
    }

    // The Earth's limb across the bottom, with its atmosphere lit on one edge.
    // Sized from the height alone, so the curve reads the same on a phone in
    // portrait and on a very wide television.
    const radius = height * 1.15;
    const horizonY = height * 1.9;
    const sway = Math.sin(time * 0.02 * slow) * width * 0.01;

    ctx.save();
    ctx.beginPath();
    ctx.arc(width * 0.5 + sway, horizonY, radius, 0, Math.PI * 2);
    ctx.clip();

    const earth = ctx.createLinearGradient(0, horizonY - radius, 0, height);
    earth.addColorStop(0, "rgba(78, 120, 180, 0.95)");
    earth.addColorStop(0.45, "rgba(26, 52, 96, 0.97)");
    earth.addColorStop(1, "rgba(8, 14, 30, 1)");
    ctx.fillStyle = earth;
    ctx.fillRect(0, horizonY - radius, width, height);

    // City lights on the night side, drifting with the planet.
    for (let i = 0; i < 90; i++) {
      const along = (i * 0.137 + time * 0.004 * slow) % 1;
      const angle = Math.PI + along * Math.PI;
      const spread = radius * (1 + ((i * 37) % 11) * 0.004);
      const lx = width * 0.5 + sway + Math.cos(angle) * spread;
      const ly = horizonY + Math.sin(angle) * spread;
      if (ly < -20 || ly > height + 20) continue;
      ctx.fillStyle = `rgba(255, 214, 150, ${(0.1 + ((i * 13) % 7) * 0.03).toFixed(2)})`;
      ctx.fillRect(lx, ly + 6 + ((i * 7) % 5), 1.4, 1.4);
    }
    ctx.restore();

    // Atmospheric rim: a thin bright arc just above the surface.
    ctx.save();
    ctx.beginPath();
    ctx.arc(width * 0.5 + sway, horizonY, radius + 2, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(2.5, height * 0.016);
    const glow = ctx.createLinearGradient(0, horizonY - radius - 40, 0, horizonY - radius + 40);
    glow.addColorStop(0, "rgba(120, 190, 255, 0)");
    glow.addColorStop(0.5, "rgba(175, 220, 255, 0.95)");
    glow.addColorStop(1, "rgba(90, 150, 230, 0.2)");
    ctx.strokeStyle = glow;
    ctx.stroke();
    ctx.restore();
  });
}

/* -------------------------------------------------------------------------
   Bus and car: a pseudo-3D road, scanline by scanline
------------------------------------------------------------------------- */

interface RoadOptions {
  palette: Palette;
  /** World units per second. */
  speed: number;
  /** How hard the road bends, in screen widths. */
  curviness: number;
  /** Ridge amplitude as a fraction of the screen height. */
  mountains: number;
  /** Spacing of the posts along the verge, in world units. */
  postSpacing: number;
  sunHeight: number;
}

function roadScene(canvas: HTMLCanvasElement, options: RoadOptions, slow: number): SceneHandle {
  const { palette } = options;
  let travel = 0;

  // Asphalt shades, resolved once: the scanline loop runs a few hundred times
  // a frame and has no business building colour strings.
  const SHADES = 48;
  const asphalt = Array.from({ length: SHADES }, (_, i) =>
    shade(palette.road, -0.06 + (i / (SHADES - 1)) * 0.26),
  );

  return runLoop(canvas, (ctx, width, height, time) => {
    const horizon = height * 0.46;
    travel += options.speed * slow * (1 / 60);

    // Sky ---------------------------------------------------------------
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, palette.skyTop);
    sky.addColorStop(0.72, palette.haze);
    sky.addColorStop(1, palette.skyHorizon);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, horizon + 1);

    // Two slow sine waves, so the road never repeats an obvious S-bend. The
    // camera sits on the road, so the bend grows with distance and is zero at
    // the bottom of the screen.
    const bend =
      (Math.sin(travel * 0.05) + Math.sin(travel * 0.031 + 1.7) * 0.6) * options.curviness;
    const centreAt = (t: number) => width * 0.5 + bend * width * 0.42 * (1 - t) * (1 - t);
    const halfWidthAt = (t: number) => width * (0.008 + t * 0.42);
    const vanishX = centreAt(0);

    // Sun ---------------------------------------------------------------
    const sunY = horizon - height * options.sunHeight;
    const sunR = Math.min(width, height) * 0.09;
    const sunGlow = ctx.createRadialGradient(vanishX, sunY, 0, vanishX, sunY, sunR * 5);
    sunGlow.addColorStop(0, "rgba(255, 214, 160, 0.55)");
    sunGlow.addColorStop(1, "rgba(255, 214, 160, 0)");
    ctx.fillStyle = sunGlow;
    ctx.fillRect(vanishX - sunR * 5, sunY - sunR * 5, sunR * 10, sunR * 10);
    ctx.beginPath();
    ctx.arc(vanishX, sunY, sunR, 0, Math.PI * 2);
    ctx.fillStyle = palette.sun;
    ctx.fill();

    // Ridgelines --------------------------------------------------------
    // `landform` is how wide one hill is, as a fraction of the screen: nearer
    // ranges are both larger on screen and quicker to slide past.
    const layers = [
      { colour: palette.ridgeFar, landform: 0.85, amp: options.mountains, seed: 3, lift: 0.02 },
      {
        colour: palette.ridgeMid,
        landform: 0.62,
        amp: options.mountains * 0.72,
        seed: 17,
        lift: 0.008,
      },
      {
        colour: palette.ridgeNear,
        landform: 0.44,
        amp: options.mountains * 0.5,
        seed: 41,
        lift: 0,
      },
    ];
    for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
      const layer = layers[layerIndex];
      const wavelength = width * layer.landform;
      const shift = travel * (0.6 + layerIndex * 1.4) + bend * width * 0.1;
      ctx.beginPath();
      ctx.moveTo(0, horizon + 2);
      const step = 5;
      for (let x = 0; x <= width + step; x += step) {
        const h = ridgeHeight((x + shift) / wavelength, layer.seed);
        ctx.lineTo(x, horizon - h * height * layer.amp - height * layer.lift + 2);
      }
      ctx.lineTo(width, horizon + 2);
      ctx.closePath();
      ctx.fillStyle = layer.colour;
      ctx.fill();
    }

    // Ground and road ---------------------------------------------------
    const ground = ctx.createLinearGradient(0, horizon, 0, height);
    ground.addColorStop(0, palette.ridgeNear);
    ground.addColorStop(1, "#0b0a0d");
    ctx.fillStyle = ground;
    ctx.fillRect(0, horizon, width, height - horizon);

    for (let y = Math.floor(horizon) + 1; y < height; y++) {
      const t = (y - horizon) / (height - horizon);
      const centre = centreAt(t);
      const half = halfWidthAt(t);
      // Depth is 1/t, which is what makes the markings foreshorten correctly.
      const depth = 1 / Math.max(t, 0.004) + travel;

      // Asphalt, banded very slightly so the surface is not a flat fill.
      const band = 0.5 + 0.5 * Math.sin(depth * 1.7);
      const shadeIndex = Math.min(
        SHADES - 1,
        Math.max(0, Math.round((t * 0.7 + band * 0.3) * (SHADES - 1))),
      );
      ctx.fillStyle = asphalt[shadeIndex];
      ctx.fillRect(centre - half, y, half * 2, 1);

      // Verges.
      ctx.fillStyle = palette.roadEdge;
      const verge = Math.max(1.5, half * 0.045);
      ctx.fillRect(centre - half - verge, y, verge, 1);
      ctx.fillRect(centre + half, y, verge, 1);

      // Centre dashes. Skipped right at the horizon, where a dash would be
      // thinner than a pixel and would only shimmer.
      if (t > 0.03 && (depth * 0.32) % 1 < 0.42) {
        const dashHalf = Math.max(0.6, half * 0.018);
        ctx.globalAlpha = 0.55 + t * 0.35;
        ctx.fillStyle = palette.markings;
        ctx.fillRect(centre - dashHalf, y, dashHalf * 2, 1);
        ctx.globalAlpha = 1;
      }
    }

    // Verge posts, drawn from far to near so nearer ones overlap correctly.
    const spacing = options.postSpacing;
    const firstPost = Math.ceil(travel / spacing);
    for (let index = firstPost + 26; index >= firstPost; index--) {
      const depth = index * spacing - travel;
      if (depth <= 0.6) continue;
      const t = 1 / depth;
      if (t > 1) continue;
      const y = horizon + t * (height - horizon);
      const centre = centreAt(t);
      const half = halfWidthAt(t);
      const postHeight = t * height * 0.14;
      const postWidth = Math.max(1, t * width * 0.008);
      ctx.fillStyle = "#0d0c10";
      for (const side of [-1, 1]) {
        const x = centre + side * (half + half * 0.16);
        ctx.fillRect(x - postWidth / 2, y - postHeight, postWidth, postHeight);
      }
    }

    // Warm haze pooling at the horizon, and a soft vignette.
    const haze = ctx.createLinearGradient(0, horizon - height * 0.06, 0, horizon + height * 0.16);
    haze.addColorStop(0, hexToRgba(palette.haze, 0));
    haze.addColorStop(0.4, hexToRgba(palette.haze, 0.22));
    haze.addColorStop(1, hexToRgba(palette.haze, 0));
    ctx.fillStyle = haze;
    ctx.fillRect(0, horizon - height * 0.06, width, height * 0.22);

    vignette(ctx, width, height, 0.5);

    // A barely-there breathing of the exposure, so nothing looks frozen.
    ctx.fillStyle = `rgba(0, 0, 0, ${(0.03 + 0.02 * Math.sin(time * 0.35 * slow)).toFixed(3)})`;
    ctx.fillRect(0, 0, width, height);
  });
}

/* -------------------------------------------------------------------------
   Train: the countryside sliding past a window
------------------------------------------------------------------------- */

function trainScene(canvas: HTMLCanvasElement, slow: number): SceneHandle {
  const palette = PALETTES.train;
  let travel = 0;

  return runLoop(canvas, (ctx, width, height, time) => {
    travel += 120 * slow * (1 / 60);
    // The carriage rocks; everything is drawn against this offset.
    const rock = slow > 0.5 ? Math.sin(time * 4.1) * 1.6 + Math.sin(time * 7.7) * 0.7 : 0;
    const horizon = height * 0.58 + rock;

    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, palette.skyTop);
    sky.addColorStop(0.75, "#8a7d5e");
    sky.addColorStop(1, palette.skyHorizon);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, horizon + 1);

    // Three bands of landscape at increasing speed: the parallax does the work.
    const bands = [
      { colour: palette.ridgeFar, speed: 0.12, amp: 0.13, drop: 0.0, seed: 5 },
      { colour: palette.ridgeMid, speed: 0.4, amp: 0.09, drop: 0.05, seed: 23 },
      { colour: palette.ridgeNear, speed: 1.1, amp: 0.06, drop: 0.12, seed: 47 },
    ];
    for (const band of bands) {
      const shift = travel * band.speed;
      // Nearer bands are drawn with shorter landforms as well as faster
      // scrolling, which is what sells the depth between them.
      const wavelength = width * (0.9 - band.speed * 0.55);
      ctx.beginPath();
      ctx.moveTo(0, height);
      for (let x = 0; x <= width + 8; x += 8) {
        const h = ridgeHeight((x + shift) / wavelength, band.seed);
        ctx.lineTo(x, horizon + height * band.drop - h * height * band.amp);
      }
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fillStyle = band.colour;
      ctx.fill();
    }

    // The near verge, rushing past fast enough to blur into streaks. Each one
    // is longer, faster and brighter the closer it is to the bottom of the
    // frame, which is most of what makes a window feel like a train window.
    const vergeTop = horizon + height * 0.14;
    for (let i = 0; i < 34; i++) {
      const jitter = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
      const depth = 0.12 + jitter * 0.88; // 0 far, 1 right under the window
      const y = vergeTop + depth * depth * (height - vergeTop);
      const speed = 2 + depth * 11;
      const length = 40 + depth * 300;
      const spread = width + length * 2;
      const raw = (i * 149.3 - travel * speed) % spread;
      const x = raw < 0 ? raw + spread : raw;
      // Lit from the same sky as everything else, so they read as grass and
      // gravel catching the last light rather than as scratches.
      ctx.fillStyle = `rgba(168, 180, 148, ${(0.05 + depth * 0.1).toFixed(3)})`;
      ctx.fillRect(x - length, y, length, 1.5 + depth * 6);
    }

    // Telephone poles: the metronome of a train window. Drawn with the wires
    // between them, because the sag is most of what the eye recognises.
    const poleSpacing = Math.max(220, width * 0.19);
    const poleCount = Math.ceil(width / poleSpacing) + 2;
    const span = poleCount * poleSpacing;
    const scroll = travel * 1.9;
    const poleTop = horizon - height * 0.2 + rock;
    const poleBottom = horizon + height * 0.06;
    const positions: number[] = [];
    for (let i = 0; i < poleCount; i++) {
      // Wraps right to left; the modulo keeps the set finite as travel grows.
      positions.push(
        span - ((((i * poleSpacing + scroll) % span) + span) % span) - poleSpacing,
      );
    }
    positions.sort((a, b) => a - b);

    ctx.strokeStyle = "rgba(21, 26, 19, 0.85)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < positions.length - 1; i++) {
      const from = positions[i];
      const to = positions[i + 1];
      if (to - from > poleSpacing * 1.5) continue; // across the wrap seam
      for (const offset of [6, 16]) {
        ctx.beginPath();
        ctx.moveTo(from + 2, poleTop + offset);
        ctx.quadraticCurveTo(
          (from + to) / 2,
          poleTop + offset + height * 0.035,
          to + 2,
          poleTop + offset,
        );
        ctx.stroke();
      }
    }

    ctx.fillStyle = "#151a13";
    for (const px of positions) {
      ctx.fillRect(px, poleTop, 5, poleBottom - poleTop);
      ctx.fillRect(px - 16, poleTop + 4, 37, 3.5);
      ctx.fillRect(px - 12, poleTop + 14, 29, 3);
    }

    vignette(ctx, width, height, 0.5);

    // The inside of the carriage: soft dark edges top and bottom.
    const interior = ctx.createLinearGradient(0, 0, 0, height);
    interior.addColorStop(0, "rgba(8, 7, 6, 0.75)");
    interior.addColorStop(0.14, "rgba(8, 7, 6, 0)");
    interior.addColorStop(0.86, "rgba(8, 7, 6, 0)");
    interior.addColorStop(1, "rgba(8, 7, 6, 0.8)");
    ctx.fillStyle = interior;
    ctx.fillRect(0, 0, width, height);
  });
}

/* -------------------------------------------------------------------------
   Helpers
------------------------------------------------------------------------- */

function vignette(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  strength: number,
): void {
  const gradient = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.28,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.78,
  );
  gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
  gradient.addColorStop(1, `rgba(0, 0, 0, ${strength})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function hexToRgba(hex: string, alpha: number): string {
  const value = parseInt(hex.slice(1), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Lighten (positive) or darken (negative) a hex colour by a small amount. */
function shade(hex: string, amount: number): string {
  const value = parseInt(hex.slice(1), 16);
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  const r = clamp(((value >> 16) & 255) * (1 + amount));
  const g = clamp(((value >> 8) & 255) * (1 + amount));
  const b = clamp((value & 255) * (1 + amount));
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Start the canvas scene for a journey. `reducedMotion` does not freeze the
 * picture — a still image would read as broken — it slows everything to a
 * drift and stops the train from rocking.
 */
export function startProceduralScene(
  canvas: HTMLCanvasElement,
  scene: SceneId,
  reducedMotion = false,
): SceneHandle {
  const slow = reducedMotion ? 0.25 : 1;
  switch (scene) {
    case "galaxy":
      return galaxyScene(canvas, slow);
    case "bus":
      return roadScene(
        canvas,
        {
          palette: PALETTES.bus,
          speed: 26,
          curviness: 0.32,
          mountains: 0.34,
          postSpacing: 0.85,
          sunHeight: 0.02,
        },
        slow,
      );
    case "car":
      return roadScene(
        canvas,
        {
          palette: PALETTES.car,
          speed: 38,
          curviness: 0.13,
          mountains: 0.16,
          postSpacing: 1.4,
          sunHeight: 0.01,
        },
        slow,
      );
    case "train":
      return trainScene(canvas, slow);
  }
}
