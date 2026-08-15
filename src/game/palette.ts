import * as THREE from "three";

/** Deterministic-ish helpers. Plain Math.random is fine for scenery. */
export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const randInt = (a: number, b: number) => Math.floor(rand(a, b + 1));
export const pick = <T,>(arr: readonly T[]): T =>
  arr[Math.floor(Math.random() * arr.length)];
export const clamp = (v: number, a: number, b: number) =>
  v < a ? a : v > b ? b : v;
/** Frame rate independent easing: reach `t` with a half life of `hl` seconds. */
export const damp = (cur: number, target: number, hl: number, dt: number) =>
  target + (cur - target) * Math.pow(2, -dt / hl);

/* ------------------------------------------------------------------ *
 * Colour sets. Bright and candy-like, but desaturated just enough that
 * the physically based lighting does not blow them out.
 * ------------------------------------------------------------------ */

export const HOUSE_WALLS = [
  "#f0846b", "#4fb3a6", "#f2c14e", "#a58bd6", "#7fd6a2",
  "#6fb6e8", "#f091b8", "#f2a05c", "#eae0cc", "#d95f5f",
] as const;

export const HOUSE_ROOFS = [
  "#8c4a3c", "#37545e", "#a8632c", "#5d4a7a", "#3f7a5c",
  "#2f5f86", "#8c3f60", "#7a4a2c", "#6b6154",
] as const;

export const TOWER_WALLS = [
  "#e6d3b0", "#dcbf98", "#cbb08f", "#e8d8c4", "#c9a887",
  "#e4c9a4", "#d6b9a0", "#c8a9b0", "#b8c4b0",
] as const;

export const SHOP_WALLS = [
  "#f5b942", "#4aa8c9", "#e8705c", "#7bbf6a", "#c78ad6",
  "#f2e2c4", "#e0975a",
] as const;

export const CAR_PAINTS = [
  "#d94f45", "#2f6fb5", "#f0b429", "#3f9e73", "#e8e4dc",
  "#5a5f6b", "#c9563f", "#7a4fa8", "#f28c4c", "#2b3a4a",
] as const;

/* ------------------------------------------------------------------ *
 * Regions. Each stretch of the drive gets its own ground tint, haze and
 * planting mix, so the journey visibly changes without swapping scenes.
 * ------------------------------------------------------------------ */

export type Region = {
  city: string;
  state: string;
  /** Ground tint. */
  ground: string;
  /** Distance fog and sky haze near the horizon. */
  haze: string;
  /** Sun tint for this stretch. */
  sun: string;
  /** How much of the planting is palms rather than broadleaf trees. */
  palmBias: number;
  /** Density of tall buildings against low houses, 0..1. */
  urban: number;
  /** Ridge line height on the horizon. */
  hills: number;
};

export const REGIONS: readonly Region[] = [
  {
    city: "Jaipur",
    state: "Rajasthan",
    ground: "#c9a86b",
    haze: "#ffcf9a",
    sun: "#ffd9a0",
    palmBias: 0.1,
    urban: 0.45,
    hills: 0.55,
  },
  {
    city: "Amritsar",
    state: "Punjab",
    ground: "#8fae52",
    haze: "#ffe0b4",
    sun: "#ffe3ad",
    palmBias: 0.05,
    urban: 0.4,
    hills: 0.12,
  },
  {
    city: "Varanasi",
    state: "Uttar Pradesh",
    ground: "#9fa860",
    haze: "#ffcfa2",
    sun: "#ffd08a",
    palmBias: 0.18,
    urban: 0.7,
    hills: 0.08,
  },
  {
    city: "Lonavla",
    state: "Western Ghats",
    ground: "#3f7a3f",
    haze: "#dfe6c8",
    sun: "#fff0c8",
    palmBias: 0.3,
    urban: 0.22,
    hills: 1.0,
  },
  {
    city: "Panaji",
    state: "Goa",
    ground: "#6fa85a",
    haze: "#ffdcbe",
    sun: "#ffd7a8",
    palmBias: 0.85,
    urban: 0.3,
    hills: 0.35,
  },
  {
    city: "Mysuru",
    state: "Karnataka",
    ground: "#79a24e",
    haze: "#ffe2bc",
    sun: "#ffe0b0",
    palmBias: 0.5,
    urban: 0.5,
    hills: 0.45,
  },
];

/** Metres of travel before the next region takes over. */
export const REGION_SPAN = 2600;

/**
 * Look up the region for a distance. Defensive on purpose: a NaN or an out of
 * range index here would return undefined, and reading a property off it every
 * frame would kill the animation loop.
 */
export function regionAt(distance: number): Region {
  const fallback = REGIONS[0];
  if (!Number.isFinite(distance)) return fallback;
  const raw = Math.floor(Math.abs(distance) / REGION_SPAN);
  if (!Number.isFinite(raw)) return fallback;
  const idx = ((raw % REGIONS.length) + REGIONS.length) % REGIONS.length;
  return REGIONS[idx] ?? fallback;
}

/** Blend factor into the next region, so transitions are gradual. */
export function regionBlend(distance: number) {
  if (!Number.isFinite(distance)) return { from: REGIONS[0], to: REGIONS[0], t: 0 };
  const from = regionAt(distance);
  const to = regionAt(distance + REGION_SPAN);
  const local = (Math.abs(distance) % REGION_SPAN) / REGION_SPAN;
  // Hold steady for most of the stretch, then cross fade over the last fifth.
  const t = clamp((local - 0.8) / 0.2, 0, 1);
  return { from, to, t };
}

const _a = new THREE.Color();
const _b = new THREE.Color();
export function mixHex(from: string, to: string, t: number, out: THREE.Color) {
  _a.set(from);
  _b.set(to);
  return out.copy(_a).lerp(_b, t);
}
