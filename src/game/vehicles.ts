import * as THREE from "three";
import { CAR_PAINTS, pick, rand } from "./palette";
import { GEO } from "./props";

/* ------------------------------------------------------------------ *
 * A rounded box. Car bodies built from sharp boxes always look like toys,
 * so everything on wheels uses this instead.
 * ------------------------------------------------------------------ */

function roundedRect(s: THREE.Shape, w: number, h: number, r: number) {
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
}

export function roundedBox(
  w: number,
  h: number,
  d: number,
  r: number,
  bevel = 0.05,
) {
  const b = Math.min(bevel, w / 2.2, h / 2.2, d / 2.2);
  const s = new THREE.Shape();
  roundedRect(s, w - b * 2, h - b * 2, Math.max(0.01, r - b));
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: Math.max(0.01, d - b * 2),
    bevelEnabled: true,
    bevelThickness: b,
    bevelSize: b,
    bevelOffset: 0,
    bevelSegments: 3,
    curveSegments: 8,
  });
  geo.translate(0, 0, -(d / 2 - b));
  geo.computeVertexNormals();
  return geo;
}

/* ------------------------------------------------------------------ *
 * Shared vehicle materials.
 * ------------------------------------------------------------------ */

export function paintMaterial(color: string) {
  // Clearcoat over a base coat is what makes a car read as painted metal
  // rather than coloured plastic.
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(color),
    roughness: 0.42,
    metalness: 0.12,
    clearcoat: 0.8,
    clearcoatRoughness: 0.11,
    envMapIntensity: 0.95,
    sheen: 0.1,
  });
}

const chrome = new THREE.MeshPhysicalMaterial({
  color: new THREE.Color("#dfe4e8"),
  roughness: 0.14,
  metalness: 1,
  envMapIntensity: 1.5,
});

const glass = new THREE.MeshPhysicalMaterial({
  color: new THREE.Color("#16232c"),
  roughness: 0.07,
  metalness: 0.25,
  envMapIntensity: 1.8,
  clearcoat: 1,
  clearcoatRoughness: 0.03,
});

const rubber = new THREE.MeshStandardMaterial({
  color: new THREE.Color("#15161a"),
  roughness: 0.88,
  metalness: 0.02,
});

const trimDark = new THREE.MeshStandardMaterial({
  color: new THREE.Color("#22242a"),
  roughness: 0.6,
  metalness: 0.3,
});

const tailLight = new THREE.MeshStandardMaterial({
  color: new THREE.Color("#ff3b24"),
  emissive: new THREE.Color("#ff2a12"),
  emissiveIntensity: 4.0,
  roughness: 0.3,
});

const headLight = new THREE.MeshStandardMaterial({
  color: new THREE.Color("#fff6df"),
  emissive: new THREE.Color("#ffeec4"),
  emissiveIntensity: 1.0,
  roughness: 0.15,
  metalness: 0.1,
});

const indicator = new THREE.MeshStandardMaterial({
  color: new THREE.Color("#ff9a1f"),
  emissive: new THREE.Color("#ff8c00"),
  emissiveIntensity: 1.6,
  roughness: 0.35,
});

const marigold = new THREE.MeshStandardMaterial({
  color: new THREE.Color("#ff9b1c"),
  roughness: 0.72,
  emissive: new THREE.Color("#c95c00"),
  emissiveIntensity: 0.35,
  flatShading: true,
});

const marigoldRed = new THREE.MeshStandardMaterial({
  color: new THREE.Color("#e23c2c"),
  roughness: 0.72,
  emissive: new THREE.Color("#8c1a0c"),
  emissiveIntensity: 0.3,
  flatShading: true,
});

function m(
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  cast = true,
  receive = false,
) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

/* ------------------------------------------------------------------ *
 * Wheels. One geometry set, reused by every vehicle.
 * ------------------------------------------------------------------ */

const TYRE = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 22);
TYRE.rotateZ(Math.PI / 2);
const HUB = new THREE.CylinderGeometry(0.2, 0.2, 0.28, 16);
HUB.rotateZ(Math.PI / 2);
const NUT = new THREE.CylinderGeometry(0.035, 0.035, 0.3, 6);
NUT.rotateZ(Math.PI / 2);

function makeWheel(radius: number, width: number) {
  const g = new THREE.Group();
  const t = m(TYRE, rubber);
  t.scale.set(width / 0.26, radius / 0.36, radius / 0.36);
  g.add(t);

  const h = m(HUB, chrome);
  h.scale.set((width * 1.05) / 0.28, radius / 0.36, radius / 0.36);
  g.add(h);

  // A few nuts, which catch the sun as the wheel turns.
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const n = m(NUT, chrome);
    n.scale.set((width * 1.1) / 0.3, 1, 1);
    n.position.set(0, Math.cos(a) * radius * 0.3, Math.sin(a) * radius * 0.3);
    g.add(n);
  }
  return g;
}

/* ------------------------------------------------------------------ *
 * The hero: a cream Ambassador, chunky and rounded.
 * ------------------------------------------------------------------ */

export type HeroCar = {
  group: THREE.Group;
  /** Turned by distance travelled. */
  wheels: THREE.Group[];
  /** Front wheels also steer. */
  steerWheels: THREE.Group[];
  body: THREE.Group;
  brakeLights: THREE.MeshStandardMaterial;
  halfWidth: number;
};

export function makeHeroCar(): HeroCar {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const cream = paintMaterial("#e8dfc8");
  cream.clearcoatRoughness = 0.09;
  // The hero needs its own tail lamp material so braking does not light up
  // every other vehicle on the road as well.
  const heroTail = tailLight.clone();

  const W = 1.86;
  const L = 4.5;

  // Lower body: wide, rounded, with a slight tumblehome from the scale.
  const lower = m(roundedBox(W, 0.82, L, 0.34, 0.09), cream);
  lower.position.y = 0.74;
  body.add(lower);

  // The Ambassador's rounded shoulder line.
  const shoulder = m(roundedBox(W * 0.99, 0.5, L * 0.9, 0.24, 0.08), cream);
  shoulder.position.set(0, 1.11, -0.06);
  body.add(shoulder);

  // Bonnet and boot, slightly lower than the cabin.
  const bonnet = m(roundedBox(W * 0.92, 0.3, 1.5, 0.16, 0.06), cream);
  bonnet.position.set(0, 1.3, 1.42);
  body.add(bonnet);

  const boot = m(roundedBox(W * 0.9, 0.3, 1.15, 0.16, 0.06), cream);
  boot.position.set(0, 1.3, -1.62);
  body.add(boot);

  // Cabin: the tall, upright greenhouse.
  const cabin = m(roundedBox(W * 0.86, 0.78, 2.25, 0.3, 0.08), cream);
  cabin.position.set(0, 1.72, -0.18);
  body.add(cabin);

  const roof = m(roundedBox(W * 0.8, 0.12, 2.1, 0.24, 0.05), cream);
  roof.position.set(0, 2.12, -0.2);
  body.add(roof);

  // Glass. Slightly larger than the cabin cut so it reads as inset panes.
  const windscreen = m(roundedBox(W * 0.78, 0.6, 0.1, 0.12, 0.04), glass, false);
  windscreen.position.set(0, 1.78, 0.92);
  windscreen.rotation.x = -0.34;
  body.add(windscreen);

  const rearGlass = m(roundedBox(W * 0.74, 0.52, 0.1, 0.12, 0.04), glass, false);
  rearGlass.position.set(0, 1.78, -1.3);
  rearGlass.rotation.x = 0.38;
  body.add(rearGlass);

  for (const sx of [-1, 1]) {
    const side = m(roundedBox(0.08, 0.5, 1.9, 0.12, 0.03), glass, false);
    side.position.set(sx * W * 0.435, 1.8, -0.2);
    body.add(side);
  }

  // Fenders swelling over the wheels.
  for (const sx of [-1, 1]) {
    for (const sz of [1.34, -1.32]) {
      const f = m(roundedBox(0.3, 0.62, 1.5, 0.28, 0.07), cream);
      f.position.set(sx * (W / 2 - 0.03), 0.86, sz);
      body.add(f);
    }
  }

  // Running boards.
  for (const sx of [-1, 1]) {
    const sill = m(roundedBox(0.22, 0.16, 2.3, 0.07, 0.04), trimDark);
    sill.position.set(sx * (W / 2 - 0.02), 0.52, -0.1);
    body.add(sill);
  }

  // Chrome bumpers, front and rear, with overriders.
  for (const [sz, sgn] of [
    [L / 2 - 0.02, 1],
    [-L / 2 + 0.02, -1],
  ] as const) {
    const bump = m(roundedBox(W * 1.0, 0.2, 0.24, 0.09, 0.05), chrome);
    bump.position.set(0, 0.64, sz);
    body.add(bump);
    for (const ox of [-0.46, 0.46]) {
      const over = m(roundedBox(0.16, 0.42, 0.2, 0.07, 0.04), chrome);
      over.position.set(ox, 0.76, sz + sgn * 0.02);
      body.add(over);
    }
  }

  // Grille and headlamps.
  const grille = m(roundedBox(W * 0.74, 0.34, 0.12, 0.08, 0.04), chrome);
  grille.position.set(0, 1.02, L / 2 - 0.04);
  body.add(grille);
  for (let i = 0; i < 6; i++) {
    const bar = m(GEO.BOX, trimDark, false);
    bar.scale.set(W * 0.7, 0.025, 0.06);
    bar.position.set(0, 0.9 + i * 0.05, L / 2 + 0.01);
    body.add(bar);
  }
  for (const sx of [-1, 1]) {
    const bez = m(GEO.CYL, chrome);
    bez.scale.set(0.23, 0.1, 0.23);
    bez.rotation.x = Math.PI / 2;
    bez.position.set(sx * 0.64, 1.12, L / 2 - 0.03);
    body.add(bez);

    const lamp = m(GEO.SPH, headLight, false);
    lamp.scale.set(0.19, 0.19, 0.1);
    lamp.position.set(sx * 0.64, 1.12, L / 2 + 0.03);
    body.add(lamp);

    const ind = m(roundedBox(0.22, 0.1, 0.08, 0.04, 0.03), indicator, false);
    ind.position.set(sx * 0.72, 0.9, L / 2 + 0.0);
    body.add(ind);
  }

  // Tail lamps, which glow and bloom from the chase camera.
  for (const sx of [-1, 1]) {
    const t = m(roundedBox(0.34, 0.2, 0.1, 0.06, 0.03), heroTail, false);
    t.position.set(sx * 0.66, 1.06, -L / 2 - 0.01);
    body.add(t);
    const surround = m(roundedBox(0.42, 0.28, 0.1, 0.08, 0.04), chrome, false);
    surround.position.set(sx * 0.66, 1.06, -L / 2 + 0.01);
    body.add(surround);
  }

  const plate = m(roundedBox(0.72, 0.2, 0.06, 0.03, 0.02), new THREE.MeshStandardMaterial({
    color: new THREE.Color("#f2efe4"),
    roughness: 0.7,
  }), false);
  plate.position.set(0, 0.86, -L / 2 - 0.02);
  body.add(plate);

  // Marigold garland across the boot, the small Indian touch that reads
  // clearly from the high camera.
  const garland = new THREE.Group();
  garland.position.set(0, 1.46, -1.72);
  for (let i = 0; i < 15; i++) {
    const t = i / 14;
    const bead = m(GEO.ICO, i % 3 === 0 ? marigoldRed : marigold, false);
    bead.scale.setScalar(0.075 + Math.sin(t * Math.PI) * 0.02);
    bead.position.set(
      -0.72 + t * 1.44,
      Math.sin(t * Math.PI) * 0.05,
      Math.sin(t * Math.PI) * 0.06,
    );
    bead.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
    garland.add(bead);
  }
  body.add(garland);

  // Roof rack with a strapped trunk, the look of a long journey.
  const rack = new THREE.Group();
  rack.position.set(0, 2.2, -0.2);
  for (const sx of [-0.62, 0.62]) {
    const rail = m(roundedBox(0.06, 0.06, 1.8, 0.03, 0.02), chrome);
    rail.position.set(sx, 0.06, 0);
    rack.add(rail);
  }
  for (const sz of [-0.8, 0, 0.8]) {
    const cross = m(roundedBox(1.3, 0.05, 0.05, 0.02, 0.02), chrome);
    cross.position.set(0, 0.06, sz);
    rack.add(cross);
  }
  const luggage = m(roundedBox(0.86, 0.24, 0.8, 0.07, 0.04), new THREE.MeshStandardMaterial({
    color: new THREE.Color("#8a5a34"),
    roughness: 0.85,
  }));
  luggage.position.set(0, 0.22, -0.35);
  rack.add(luggage);
  const strap = m(GEO.BOX, trimDark, false);
  strap.scale.set(0.92, 0.04, 0.08);
  strap.position.set(0, 0.35, -0.35);
  rack.add(strap);
  body.add(rack);

  // Wing mirrors.
  for (const sx of [-1, 1]) {
    const stalk = m(GEO.CYL, chrome);
    stalk.scale.set(0.03, 0.22, 0.03);
    stalk.rotation.z = sx * 1.1;
    stalk.position.set(sx * (W / 2 + 0.09), 1.72, 0.72);
    body.add(stalk);
    const cup = m(roundedBox(0.14, 0.12, 0.08, 0.04, 0.02), cream);
    cup.position.set(sx * (W / 2 + 0.24), 1.78, 0.72);
    body.add(cup);
  }

  // Exhaust.
  const pipe = m(GEO.CYL, trimDark, false);
  pipe.scale.set(0.06, 0.3, 0.06);
  pipe.rotation.x = Math.PI / 2;
  pipe.position.set(-0.6, 0.56, -L / 2 - 0.06);
  body.add(pipe);

  // Wheels.
  const wheels: THREE.Group[] = [];
  const steerWheels: THREE.Group[] = [];
  for (const sz of [1.34, -1.32]) {
    for (const sx of [-1, 1]) {
      const holder = new THREE.Group();
      holder.position.set(sx * (W / 2 - 0.06), 0.42, sz);
      const w = makeWheel(0.42, 0.3);
      holder.add(w);
      root.add(holder);
      wheels.push(w);
      if (sz > 0) steerWheels.push(holder);
    }
  }

  return {
    group: root,
    wheels,
    steerWheels,
    body,
    brakeLights: heroTail,
    halfWidth: W / 2 + 0.12,
  };
}

/* ------------------------------------------------------------------ *
 * Traffic. Four silhouettes so the road never looks like a clone army.
 * ------------------------------------------------------------------ */

export type TrafficBody = {
  group: THREE.Group;
  /** Half width used by the dodging logic. */
  half: number;
  /** Length along the road, used for the overtaking clearance. */
  length: number;
  wheels: THREE.Group[];
  repaint: () => void;
};

function sedan(): TrafficBody {
  const g = new THREE.Group();
  const paint = paintMaterial(pick(CAR_PAINTS));
  const W = 1.76;
  const L = 4.1;

  const lower = m(roundedBox(W, 0.7, L, 0.3, 0.08), paint);
  lower.position.y = 0.72;
  g.add(lower);

  const cabin = m(roundedBox(W * 0.88, 0.62, 2.0, 0.3, 0.07), paint);
  cabin.position.set(0, 1.34, -0.2);
  g.add(cabin);

  const gl = m(roundedBox(W * 0.9, 0.44, 1.9, 0.22, 0.05), glass, false);
  gl.position.set(0, 1.42, -0.2);
  g.add(gl);

  for (const [sz, mat] of [
    [-L / 2 - 0.01, tailLight],
    [L / 2 + 0.01, headLight],
  ] as const) {
    for (const sx of [-1, 1]) {
      const lamp = m(roundedBox(0.3, 0.16, 0.08, 0.05, 0.03), mat, false);
      lamp.position.set(sx * 0.6, 1.0, sz);
      g.add(lamp);
    }
  }
  for (const sz of [L / 2 - 0.04, -L / 2 + 0.04]) {
    const b = m(roundedBox(W * 0.98, 0.16, 0.2, 0.07, 0.04), trimDark);
    b.position.set(0, 0.62, sz);
    g.add(b);
  }

  const wheels: THREE.Group[] = [];
  for (const sz of [1.25, -1.25]) {
    for (const sx of [-1, 1]) {
      const w = makeWheel(0.38, 0.28);
      w.position.set(sx * (W / 2 - 0.05), 0.4, sz);
      g.add(w);
      wheels.push(w);
    }
  }
  return {
    group: g,
    half: W / 2,
    length: L,
    wheels,
    repaint: () => paint.color.set(pick(CAR_PAINTS)),
  };
}

function hatchback(): TrafficBody {
  const g = new THREE.Group();
  const paint = paintMaterial(pick(CAR_PAINTS));
  const W = 1.66;
  const L = 3.4;

  const lower = m(roundedBox(W, 0.68, L, 0.3, 0.08), paint);
  lower.position.y = 0.7;
  g.add(lower);

  const cabin = m(roundedBox(W * 0.9, 0.7, 2.0, 0.34, 0.07), paint);
  cabin.position.set(0, 1.32, -0.42);
  g.add(cabin);

  const gl = m(roundedBox(W * 0.92, 0.5, 1.86, 0.26, 0.05), glass, false);
  gl.position.set(0, 1.4, -0.42);
  g.add(gl);

  for (const sx of [-1, 1]) {
    const t = m(roundedBox(0.18, 0.3, 0.08, 0.05, 0.03), tailLight, false);
    t.position.set(sx * 0.66, 1.16, -L / 2 - 0.01);
    g.add(t);
    const h = m(roundedBox(0.3, 0.14, 0.08, 0.05, 0.03), headLight, false);
    h.position.set(sx * 0.56, 0.98, L / 2 + 0.01);
    g.add(h);
  }

  const wheels: THREE.Group[] = [];
  for (const sz of [1.05, -1.05]) {
    for (const sx of [-1, 1]) {
      const w = makeWheel(0.34, 0.26);
      w.position.set(sx * (W / 2 - 0.04), 0.36, sz);
      g.add(w);
      wheels.push(w);
    }
  }
  return {
    group: g,
    half: W / 2,
    length: L,
    wheels,
    repaint: () => paint.color.set(pick(CAR_PAINTS)),
  };
}

/** Three wheeled auto rickshaw in the familiar yellow and green. */
function autoRickshaw(): TrafficBody {
  const g = new THREE.Group();
  const yellow = paintMaterial("#f2c010");
  const green = paintMaterial("#1f7a3f");
  const W = 1.34;
  const L = 2.5;

  const body = m(roundedBox(W, 0.86, L * 0.86, 0.34, 0.07), green);
  body.position.set(0, 0.72, -0.1);
  g.add(body);

  const hood = m(roundedBox(W * 0.72, 0.62, 0.9, 0.3, 0.06), green);
  hood.position.set(0, 0.78, L / 2 - 0.35);
  g.add(hood);

  // Canopy.
  const canopy = m(roundedBox(W * 1.02, 0.9, L * 0.8, 0.3, 0.06), yellow);
  canopy.position.set(0, 1.52, -0.16);
  g.add(canopy);

  const top = m(roundedBox(W * 1.06, 0.12, L * 0.84, 0.22, 0.05), yellow);
  top.position.set(0, 1.99, -0.16);
  g.add(top);

  const back = m(roundedBox(W * 0.9, 0.5, 0.08, 0.12, 0.03), glass, false);
  back.position.set(0, 1.6, -L * 0.5);
  g.add(back);

  const screen = m(roundedBox(W * 0.78, 0.46, 0.08, 0.1, 0.03), glass, false);
  screen.position.set(0, 1.6, 0.72);
  screen.rotation.x = -0.2;
  g.add(screen);

  for (const sx of [-1, 1]) {
    const t = m(roundedBox(0.14, 0.14, 0.08, 0.05, 0.03), tailLight, false);
    t.position.set(sx * 0.46, 0.92, -L * 0.53);
    g.add(t);
  }
  const lamp = m(GEO.SPH, headLight, false);
  lamp.scale.set(0.15, 0.15, 0.1);
  lamp.position.set(0, 1.02, L / 2 + 0.06);
  g.add(lamp);

  const wheels: THREE.Group[] = [];
  const front = makeWheel(0.3, 0.2);
  front.position.set(0, 0.32, L / 2 - 0.02);
  g.add(front);
  wheels.push(front);
  for (const sx of [-1, 1]) {
    const w = makeWheel(0.32, 0.22);
    w.position.set(sx * (W / 2 - 0.02), 0.34, -0.62);
    g.add(w);
    wheels.push(w);
  }
  return { group: g, half: W / 2, length: L, wheels, repaint: () => {} };
}

/** Decorated goods lorry, tall and slow. */
function lorry(): TrafficBody {
  const g = new THREE.Group();
  const cabPaint = paintMaterial(pick(["#1f6fb5", "#c9342b", "#2f8f5f", "#e08a10"]));
  const boxPaint = paintMaterial(pick(["#e8dcc0", "#d94f45", "#2f6f9f", "#f0b429"]));
  const W = 2.3;
  const L = 7.4;

  const chassis = m(roundedBox(W * 0.9, 0.3, L * 0.94, 0.08, 0.05), trimDark);
  chassis.position.y = 0.62;
  g.add(chassis);

  const cab = m(roundedBox(W, 1.5, 2.0, 0.24, 0.08), cabPaint);
  cab.position.set(0, 1.55, L / 2 - 1.05);
  g.add(cab);

  const screen = m(roundedBox(W * 0.86, 0.72, 0.1, 0.12, 0.04), glass, false);
  screen.position.set(0, 1.9, L / 2 - 0.06);
  screen.rotation.x = -0.12;
  g.add(screen);

  // Sun visor over the windscreen, very typical of Indian lorries.
  const visor = m(roundedBox(W * 1.02, 0.1, 0.42, 0.06, 0.03), cabPaint);
  visor.position.set(0, 2.32, L / 2 - 0.2);
  visor.rotation.x = 0.22;
  g.add(visor);

  const bed = m(roundedBox(W, 1.7, L * 0.6, 0.14, 0.06), boxPaint);
  bed.position.set(0, 1.72, -1.2);
  g.add(bed);

  // Painted side bands.
  for (const sx of [-1, 1]) {
    const band = m(GEO.BOX, new THREE.MeshStandardMaterial({
      color: new THREE.Color("#f2e2b0"),
      roughness: 0.8,
    }), false);
    band.scale.set(0.04, 0.26, L * 0.58);
    band.position.set(sx * (W / 2 + 0.01), 1.9, -1.2);
    g.add(band);
  }

  // Tarpaulin over the load.
  const tarp = m(roundedBox(W * 0.98, 0.5, L * 0.58, 0.24, 0.06), new THREE.MeshStandardMaterial({
    color: new THREE.Color("#3f5f8f"),
    roughness: 0.95,
  }));
  tarp.position.set(0, 2.66, -1.2);
  g.add(tarp);

  for (const sx of [-1, 1]) {
    const t = m(roundedBox(0.2, 0.5, 0.1, 0.05, 0.03), tailLight, false);
    t.position.set(sx * 0.9, 1.3, -L / 2 + 0.02);
    g.add(t);
  }

  const wheels: THREE.Group[] = [];
  for (const sz of [L / 2 - 1.1, -0.6, -1.8]) {
    for (const sx of [-1, 1]) {
      const w = makeWheel(0.55, 0.34);
      w.position.set(sx * (W / 2 - 0.08), 0.58, sz);
      g.add(w);
      wheels.push(w);
    }
  }
  return {
    group: g,
    half: W / 2,
    length: L,
    wheels,
    repaint: () => {
      cabPaint.color.set(pick(["#1f6fb5", "#c9342b", "#2f8f5f", "#e08a10"]));
      boxPaint.color.set(pick(["#e8dcc0", "#d94f45", "#2f6f9f", "#f0b429"]));
    },
  };
}

/** State transport bus. */
function bus(): TrafficBody {
  const g = new THREE.Group();
  const paint = paintMaterial(pick(["#c9342b", "#1f6fb5", "#2f8f5f"]));
  const W = 2.4;
  const L = 8.4;

  const body = m(roundedBox(W, 2.5, L, 0.32, 0.09), paint);
  body.position.y = 1.7;
  g.add(body);

  const stripe = m(GEO.BOX, new THREE.MeshStandardMaterial({
    color: new THREE.Color("#f2efe2"),
    roughness: 0.75,
  }), false);
  stripe.scale.set(W + 0.03, 0.3, L * 0.99);
  stripe.position.y = 1.16;
  g.add(stripe);

  // Window band down both sides.
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const w = m(roundedBox(0.08, 0.72, 0.98, 0.1, 0.03), glass, false);
      w.position.set(sx * (W / 2 + 0.01), 2.2, -L / 2 + 1.2 + i * 1.2);
      g.add(w);
    }
  }
  const screen = m(roundedBox(W * 0.9, 0.95, 0.1, 0.16, 0.04), glass, false);
  screen.position.set(0, 2.24, L / 2 + 0.01);
  g.add(screen);
  const rear = m(roundedBox(W * 0.86, 0.8, 0.1, 0.14, 0.04), glass, false);
  rear.position.set(0, 2.3, -L / 2 - 0.01);
  g.add(rear);

  const board = m(roundedBox(W * 0.7, 0.28, 0.08, 0.04, 0.03), new THREE.MeshStandardMaterial({
    color: new THREE.Color("#1a1a1a"),
    emissive: new THREE.Color("#e0a020"),
    emissiveIntensity: 0.8,
    roughness: 0.6,
  }), false);
  board.position.set(0, 2.86, L / 2 + 0.01);
  g.add(board);

  for (const sx of [-1, 1]) {
    const t = m(roundedBox(0.22, 0.3, 0.1, 0.05, 0.03), tailLight, false);
    t.position.set(sx * 0.92, 1.0, -L / 2 - 0.02);
    g.add(t);
  }

  const wheels: THREE.Group[] = [];
  for (const sz of [2.7, -2.2, -3.3]) {
    for (const sx of [-1, 1]) {
      const w = makeWheel(0.52, 0.32);
      w.position.set(sx * (W / 2 - 0.08), 0.55, sz);
      g.add(w);
      wheels.push(w);
    }
  }
  return {
    group: g,
    half: W / 2,
    length: L,
    wheels,
    repaint: () => paint.color.set(pick(["#c9342b", "#1f6fb5", "#2f8f5f"])),
  };
}

export const TRAFFIC_BUILDERS = [
  sedan,
  sedan,
  hatchback,
  hatchback,
  autoRickshaw,
  lorry,
  bus,
] as const;
