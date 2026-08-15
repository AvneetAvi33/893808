import * as THREE from "three";

/**
 * Every texture in the game is drawn into a small canvas at start up. There
 * are no image files anywhere, which keeps the build to a single HTML file and
 * keeps the whole thing free of third party art.
 */

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  return { c, ctx };
}

function finish(
  c: HTMLCanvasElement,
  opts: {
    repeat?: [number, number];
    srgb?: boolean;
    aniso?: number;
  } = {},
) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (opts.repeat) t.repeat.set(opts.repeat[0], opts.repeat[1]);
  t.colorSpace = opts.srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = opts.aniso ?? 8;
  t.needsUpdate = true;
  return t;
}

/* ------------------------------------------------------------------ *
 * Value noise, used to give flat surfaces a believable grain.
 * ------------------------------------------------------------------ */

function hash2(x: number, y: number, seed: number) {
  let h = x * 374761393 + y * 668265263 + seed * 1442695040;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function smooth(t: number) {
  return t * t * (3 - 2 * t);
}

/** Tileable value noise sampled in a `period` sized cell grid. */
function valueNoise(x: number, y: number, period: number, seed: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const wrap = (v: number) => ((v % period) + period) % period;
  const x0 = wrap(xi);
  const y0 = wrap(yi);
  const x1 = wrap(xi + 1);
  const y1 = wrap(yi + 1);
  const u = smooth(xf);
  const v = smooth(yf);
  const a = hash2(x0, y0, seed);
  const b = hash2(x1, y0, seed);
  const c = hash2(x0, y1, seed);
  const d = hash2(x1, y1, seed);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

/** Multi octave tileable noise in 0..1. */
function fbm(
  px: number,
  py: number,
  size: number,
  octaves: number,
  baseCells: number,
  seed: number,
) {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let cells = baseCells;
  for (let o = 0; o < octaves; o++) {
    sum +=
      amp * valueNoise((px / size) * cells, (py / size) * cells, cells, seed + o * 91);
    norm += amp;
    amp *= 0.5;
    cells *= 2;
  }
  return sum / norm;
}

/** Turn a greyscale height field into a tangent space normal map. */
function heightToNormal(
  height: Float32Array,
  size: number,
  strength: number,
): HTMLCanvasElement {
  const { c, ctx } = canvas(size, size);
  const img = ctx.createImageData(size, size);
  const at = (x: number, y: number) =>
    height[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      // Normalise (-dx, -dy, 1).
      const len = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = (1 / len) * 0.5 * 255 + 127.5;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/* ------------------------------------------------------------------ *
 * Asphalt: colour, roughness and normal, all from one height field so the
 * grain lines up. This is what sells the road as a real surface.
 * ------------------------------------------------------------------ */

export function makeAsphalt() {
  const S = 256;
  const height = new Float32Array(S * S);
  const { c: colC, ctx: colCtx } = canvas(S, S);
  const { c: rghC, ctx: rghCtx } = canvas(S, S);

  const colImg = colCtx.createImageData(S, S);
  const rghImg = rghCtx.createImageData(S, S);

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      // Coarse patchiness plus fine chippings.
      const coarse = fbm(x, y, S, 3, 3, 11);
      const grit = fbm(x, y, S, 3, 24, 57);
      const h = grit * 0.6 + coarse * 0.4;
      height[y * S + x] = h;

      // Mid grey with a slight warm cast. Real tarmac in low sun is much
      // lighter than the black people expect, and a black road reads as a
      // hole cut in the scene.
      const base = 126 + coarse * 11 + (grit - 0.5) * 12;
      const i = (y * S + x) * 4;
      colImg.data[i] = Math.max(0, Math.min(255, base * 1.03));
      colImg.data[i + 1] = Math.max(0, Math.min(255, base * 1.0));
      colImg.data[i + 2] = Math.max(0, Math.min(255, base * 0.98));
      colImg.data[i + 3] = 255;

      // Polished wheel tracks read smoother than loose chippings.
      const r = Math.max(0, Math.min(255, (0.72 + (grit - 0.5) * 0.3) * 255));
      rghImg.data[i] = r;
      rghImg.data[i + 1] = r;
      rghImg.data[i + 2] = r;
      rghImg.data[i + 3] = 255;
    }
  }
  colCtx.putImageData(colImg, 0, 0);
  rghCtx.putImageData(rghImg, 0, 0);

  const nrmC = heightToNormal(height, S, 9);
  return {
    map: finish(colC, { srgb: true, repeat: [4, 12], aniso: 16 }),
    roughnessMap: finish(rghC, { repeat: [4, 12], aniso: 16 }),
    normalMap: finish(nrmC, { repeat: [4, 12], aniso: 16 }),
  };
}

/* ------------------------------------------------------------------ *
 * Ground cover: dry grass and earth, mottled so it never looks like paint.
 * ------------------------------------------------------------------ */

export function makeGround() {
  const S = 256;
  const height = new Float32Array(S * S);
  const { c: colC, ctx: colCtx } = canvas(S, S);
  const img = colCtx.createImageData(S, S);

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const clump = fbm(x, y, S, 4, 5, 3);
      const blade = fbm(x, y, S, 2, 22, 71);
      height[y * S + x] = blade * 0.35 + clump * 0.65;

      // Kept close to white so the material colour can tint it per region.
      const v = 0.72 + (clump - 0.5) * 0.42 + (blade - 0.5) * 0.16;
      const i = (y * S + x) * 4;
      img.data[i] = Math.max(0, Math.min(255, v * 255 * 1.02));
      img.data[i + 1] = Math.max(0, Math.min(255, v * 255));
      img.data[i + 2] = Math.max(0, Math.min(255, v * 255 * 0.86));
      img.data[i + 3] = 255;
    }
  }
  colCtx.putImageData(img, 0, 0);
  const nrmC = heightToNormal(height, S, 3.5);
  return {
    map: finish(colC, { srgb: true, repeat: [26, 5], aniso: 16 }),
    normalMap: finish(nrmC, { repeat: [26, 5], aniso: 16 }),
  };
}

/* ------------------------------------------------------------------ *
 * Building facades. One canvas gives the colour map, a matching one gives
 * the emissive map so only the lit windows glow.
 * ------------------------------------------------------------------ */

export type Facade = { map: THREE.Texture; emissiveMap: THREE.Texture };

export function makeFacade(
  wallColor: string,
  windowLitFraction: number,
  cols: number,
  rows: number,
  seed: number,
): Facade {
  const cw = 32;
  const ch = 32;
  const W = cols * cw;
  const H = rows * ch;
  const { c: colC, ctx } = canvas(W, H);
  const { c: emC, ctx: em } = canvas(W, H);

  ctx.fillStyle = wallColor;
  ctx.fillRect(0, 0, W, H);
  em.fillStyle = "#000000";
  em.fillRect(0, 0, W, H);

  // Concrete mottling so the wall is not a flat swatch.
  for (let i = 0; i < 2600; i++) {
    const x = hash2(i, 1, seed) * W;
    const y = hash2(i, 2, seed) * H;
    const a = hash2(i, 3, seed) * 0.06;
    ctx.fillStyle = hash2(i, 4, seed) > 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`;
    ctx.fillRect(x, y, 2 + hash2(i, 5, seed) * 6, 2 + hash2(i, 6, seed) * 5);
  }

  for (let r = 0; r < rows; r++) {
    // Floor slab band between storeys.
    ctx.fillStyle = "rgba(0,0,0,0.09)";
    ctx.fillRect(0, r * ch + ch - 4, W, 3);
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.fillRect(0, r * ch + ch - 1, W, 1);

    for (let cIdx = 0; cIdx < cols; cIdx++) {
      const x = cIdx * cw + 7;
      const y = r * ch + 6;
      const w = cw - 14;
      const h = ch - 16;

      // Recessed frame.
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(x - 2, y - 2, w + 4, h + 4);

      const lit = hash2(cIdx, r, seed) < windowLitFraction;
      if (lit) {
        const warm = 0.5 + hash2(cIdx, r, seed + 7) * 0.5;
        const g = ctx.createLinearGradient(x, y, x, y + h);
        g.addColorStop(0, `rgb(255,${Math.round(214 + warm * 26)},${Math.round(150 + warm * 60)})`);
        g.addColorStop(1, `rgb(${Math.round(238 + warm * 12)},188,120)`);
        ctx.fillStyle = g;
        ctx.fillRect(x, y, w, h);

        const e = 0.35 + warm * 0.5;
        em.fillStyle = `rgb(${Math.round(255 * e)},${Math.round(196 * e)},${Math.round(120 * e)})`;
        em.fillRect(x, y, w, h);
      } else {
        // Dark glass with a sky reflection sliding down it.
        const g = ctx.createLinearGradient(x, y, x + w, y + h);
        g.addColorStop(0, "#5f7f96");
        g.addColorStop(0.45, "#33485a");
        g.addColorStop(1, "#22303c");
        ctx.fillStyle = g;
        ctx.fillRect(x, y, w, h);
      }

      // Mullion.
      ctx.fillStyle = "rgba(20,16,12,0.35)";
      ctx.fillRect(x + w / 2 - 1, y, 2, h);

      // A few balconies, which read well from the high camera.
      if (hash2(cIdx, r, seed + 31) > 0.72) {
        ctx.fillStyle = "rgba(255,255,255,0.22)";
        ctx.fillRect(x - 3, y + h, w + 6, 4);
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.fillRect(x - 3, y + h + 4, w + 6, 2);
      }
    }
  }

  return {
    map: finish(colC, { srgb: true, aniso: 8 }),
    emissiveMap: finish(emC, { srgb: true, aniso: 8 }),
  };
}

/* ------------------------------------------------------------------ *
 * Sprites and decals.
 * ------------------------------------------------------------------ */

/** Soft white dot for the tyre smoke puffs. */
export function makeSmokeTexture() {
  const S = 128;
  const { c, ctx } = canvas(S, S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, "rgba(255,255,255,0.95)");
  g.addColorStop(0.35, "rgba(255,252,244,0.5)");
  g.addColorStop(0.7, "rgba(255,248,236,0.16)");
  g.addColorStop(1, "rgba(255,248,236,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);

  // Break the perfect circle so puffs do not look like identical blobs.
  ctx.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2;
    const r = S * (0.3 + hash2(i, 9, 5) * 0.2);
    const rr = S * 0.06 * hash2(i, 3, 8);
    ctx.beginPath();
    ctx.arc(S / 2 + Math.cos(a) * r, S / 2 + Math.sin(a) * r, rr, 0, Math.PI * 2);
    ctx.fill();
  }
  return finish(c, { srgb: true });
}

/** Soft elliptical darkening used as a contact shadow under vehicles. */
export function makeContactShadow() {
  const S = 128;
  const { c, ctx } = canvas(S, S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, "rgba(0,0,0,0.62)");
  g.addColorStop(0.45, "rgba(0,0,0,0.32)");
  g.addColorStop(0.75, "rgba(0,0,0,0.09)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return finish(c, { srgb: true });
}

/** Striped awning cloth for the roadside shops. */
export function makeAwning(a: string, b: string) {
  const { c, ctx } = canvas(64, 64);
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 ? a : b;
    ctx.fillRect(i * 8, 0, 8, 64);
  }
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.fillRect(0, 52, 64, 12);
  return finish(c, { srgb: true, repeat: [1, 1] });
}

/** Painted hoarding above a shop, in the spirit of a hand lettered board. */
export function makeSignboard(bg: string, ink: string, seed: number) {
  const { c, ctx } = canvas(256, 64);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(0, 56, 256, 8);
  ctx.fillStyle = ink;
  // Abstract lettering: blocks that read as words from the game camera.
  let x = 16;
  const words = 2 + Math.floor(hash2(seed, 1, 4) * 2);
  for (let w = 0; w < words && x < 226; w++) {
    const glyphs = 3 + Math.floor(hash2(seed, w, 12) * 5);
    for (let g = 0; g < glyphs && x < 236; g++) {
      const gw = 8 + hash2(seed, w * 10 + g, 3) * 8;
      const gh = 20 + hash2(seed, w * 10 + g, 6) * 12;
      ctx.fillRect(x, 34 - gh / 2, gw, gh);
      x += gw + 4;
    }
    x += 14;
  }
  return finish(c, { srgb: true, repeat: [1, 1] });
}
