import * as THREE from "three";
import {
  HOUSE_ROOFS,
  HOUSE_WALLS,
  SHOP_WALLS,
  TOWER_WALLS,
  CAR_PAINTS,
  pick,
  rand,
  randInt,
} from "./palette";
import { makeAwning, makeFacade, makeSignboard } from "./textures";

/**
 * Every roadside object is a small group of primitives. Each prototype exposes
 * a `randomize` hook that is called when the object is recycled to the far end
 * of the track, which is what makes a fixed pool feel like an endless town.
 */
export type Prop = {
  group: THREE.Group;
  randomize: () => void;
  /** Half footprint across the road, used to keep things off the tarmac. */
  half: number;
};

/* ------------------------------------------------------------------ *
 * Shared geometry and material caches. Nothing is allocated once the
 * drive has started.
 * ------------------------------------------------------------------ */

const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 16);
const CYL_LOW = new THREE.CylinderGeometry(1, 1, 1, 8);
const CONE = new THREE.ConeGeometry(1, 1, 4);
const CONE_R = new THREE.ConeGeometry(1, 1, 12);
const ICO = new THREE.IcosahedronGeometry(1, 0);
const ICO1 = new THREE.IcosahedronGeometry(1, 1);
const SPH = new THREE.SphereGeometry(1, 14, 10);

export const GEO = { BOX, CYL, CYL_LOW, CONE, CONE_R, ICO, ICO1, SPH };

function std(
  color: string | number,
  o: Partial<THREE.MeshStandardMaterialParameters> = {},
) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color as THREE.ColorRepresentation),
    roughness: 0.82,
    metalness: 0.0,
    ...o,
  });
}

/** Materials that never vary, shared by every instance that uses them. */
const M = {
  darkGlass: std("#20303c", { roughness: 0.16, metalness: 0.35 }),
  concrete: std("#aaa294", { roughness: 0.95, envMapIntensity: 0.35 }),
  darkRoof: std("#3a3630", { roughness: 0.88 }),
  trunk: std("#6b4a30", { roughness: 0.95, flatShading: true }),
  leafDark: std("#2f6b38", { roughness: 0.9, flatShading: true }),
  darkMetal: std("#4a4f55", { roughness: 0.45, metalness: 0.7 }),
  gold: std("#e0a52b", { roughness: 0.22, metalness: 0.95 }),
  bulb: std("#fff0cc", {
    emissive: new THREE.Color("#ffd28a"),
    emissiveIntensity: 1.5,
    roughness: 0.4,
  }),
  asphalt: std("#57534f", { roughness: 0.96, envMapIntensity: 0.25 }),
  paint: std("#e8e2d2", { roughness: 0.7 }),
  cloud: std("#ffffff", {
    roughness: 1,
    flatShading: true,
    emissive: new THREE.Color("#ffe9cf"),
    emissiveIntensity: 0.18,
  }),
  wire: std("#4a423a", { roughness: 0.85, metalness: 0.1 }),
};

function mesh(
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  cast = true,
  receive = true,
) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

/* ------------------------------------------------------------------ *
 * House: body, pyramid roof, windows, door, a small parapet detail.
 * ------------------------------------------------------------------ */

export function makeHouse(): Prop {
  const g = new THREE.Group();
  const wall = std(pick(HOUSE_WALLS), { roughness: 0.86 });
  const roof = std(pick(HOUSE_ROOFS), { roughness: 0.8, flatShading: true });

  const w = 4.4;
  const d = 4.0;
  const h = 3.0;

  const body = mesh(BOX, wall);
  body.scale.set(w, h, d);
  body.position.y = h / 2;
  g.add(body);

  // Plinth, which grounds the building instead of letting it float.
  const plinth = mesh(BOX, M.concrete);
  plinth.scale.set(w + 0.5, 0.3, d + 0.5);
  plinth.position.y = 0.15;
  g.add(plinth);

  const r = mesh(CONE, roof);
  r.scale.set(w * 0.83, 1.7, d * 0.83);
  r.position.y = h + 0.85;
  r.rotation.y = Math.PI / 4;
  g.add(r);

  // Eaves overhang.
  const eave = mesh(BOX, roof);
  eave.scale.set(w + 0.6, 0.16, d + 0.6);
  eave.position.y = h + 0.08;
  g.add(eave);

  for (const sx of [-1, 1]) {
    const win = mesh(BOX, M.darkGlass, false);
    win.scale.set(1.1, 1.0, 0.1);
    win.position.set(sx * 1.1, 1.85, d / 2 + 0.02);
    g.add(win);
    const sill = mesh(BOX, M.concrete, false);
    sill.scale.set(1.35, 0.12, 0.26);
    sill.position.set(sx * 1.1, 1.3, d / 2 + 0.06);
    g.add(sill);
  }

  const door = mesh(BOX, std("#5a3b26", { roughness: 0.8 }), false);
  door.scale.set(0.9, 1.5, 0.1);
  door.position.set(0, 0.9, d / 2 + 0.02);
  g.add(door);

  // Water tank on the roof, a very Indian rooftop silhouette.
  const tank = mesh(CYL, std("#2f6f8f", { roughness: 0.6 }));
  tank.scale.set(0.34, 0.5, 0.34);
  tank.position.set(w * 0.28, h + 1.55, -d * 0.2);
  g.add(tank);

  return {
    group: g,
    half: w / 2 + 0.6,
    randomize: () => {
      wall.color.set(pick(HOUSE_WALLS));
      roof.color.set(pick(HOUSE_ROOFS));
      g.rotation.y = rand(-0.12, 0.12);
      const s = rand(0.85, 1.25);
      g.scale.set(s, rand(0.9, 1.2) * s, s);
    },
  };
}

/* ------------------------------------------------------------------ *
 * Tower: a multi storey block with a lit facade texture, roof plant and
 * a parapet. These give the skyline its density.
 * ------------------------------------------------------------------ */

export function makeTower(): Prop {
  const g = new THREE.Group();
  const cols = randInt(3, 5);
  const rows = randInt(5, 9);
  const facade = makeFacade(
    pick(TOWER_WALLS),
    rand(0.18, 0.45),
    cols,
    rows,
    Math.random() * 1000,
  );

  const mat = new THREE.MeshStandardMaterial({
    map: facade.map,
    emissiveMap: facade.emissiveMap,
    emissive: new THREE.Color("#ffffff"),
    emissiveIntensity: 0.9,
    roughness: 0.78,
    metalness: 0.02,
  });

  const w = 5.0;
  const d = 4.6;
  const h = rows * 1.55;

  const body = mesh(BOX, mat);
  body.scale.set(w, h, d);
  body.position.y = h / 2;
  g.add(body);

  const parapet = mesh(BOX, M.concrete);
  parapet.scale.set(w + 0.35, 0.5, d + 0.35);
  parapet.position.y = h + 0.2;
  g.add(parapet);

  const cap = mesh(BOX, M.darkRoof);
  cap.scale.set(w + 0.1, 0.16, d + 0.1);
  cap.position.y = h + 0.42;
  g.add(cap);

  // Roof clutter: stair head, tanks, a dish. Reads as a real building.
  const head = mesh(BOX, M.concrete);
  head.scale.set(1.5, 1.2, 1.5);
  head.position.set(-w * 0.24, h + 1.05, -d * 0.2);
  g.add(head);

  for (let i = 0; i < 2; i++) {
    const t = mesh(CYL, std(i ? "#2f6f8f" : "#a83f3f", { roughness: 0.62 }));
    t.scale.set(0.4, 0.6, 0.4);
    t.position.set(w * (0.2 + i * 0.14), h + 0.75, d * (0.18 - i * 0.32));
    g.add(t);
  }

  const dish = mesh(SPH, M.paint);
  dish.scale.set(0.55, 0.28, 0.55);
  dish.position.set(w * 0.05, h + 0.7, d * 0.3);
  dish.rotation.x = -0.5;
  g.add(dish);

  const antenna = mesh(CYL_LOW, M.darkMetal);
  antenna.scale.set(0.05, 3.2, 0.05);
  antenna.position.set(-w * 0.24, h + 3.2, -d * 0.2);
  g.add(antenna);

  return {
    group: g,
    half: w / 2 + 0.7,
    randomize: () => {
      g.rotation.y = rand(-0.08, 0.08);
      const s = rand(0.9, 1.3);
      g.scale.set(s, rand(0.75, 1.35), s);
      mat.emissiveIntensity = rand(0.7, 1.15);
    },
  };
}

/* ------------------------------------------------------------------ *
 * Shop: body, striped awning, hoarding, small step.
 * ------------------------------------------------------------------ */

export function makeShop(): Prop {
  const g = new THREE.Group();
  const wall = std(pick(SHOP_WALLS), { roughness: 0.86 });
  const w = 4.6;
  const d = 3.4;
  const h = 2.6;

  const body = mesh(BOX, wall);
  body.scale.set(w, h, d);
  body.position.y = h / 2;
  g.add(body);

  const roof = mesh(BOX, M.darkRoof);
  roof.scale.set(w + 0.4, 0.3, d + 0.4);
  roof.position.y = h + 0.15;
  g.add(roof);

  const front = mesh(BOX, M.darkGlass, false);
  front.scale.set(w * 0.74, 1.5, 0.1);
  front.position.set(0, 1.05, d / 2 + 0.03);
  g.add(front);

  const awnMat = new THREE.MeshStandardMaterial({
    map: makeAwning("#e05a4a", "#f7ede0"),
    roughness: 0.9,
    side: THREE.DoubleSide,
  });
  const awn = mesh(BOX, awnMat);
  awn.scale.set(w * 0.94, 0.1, 1.5);
  awn.position.set(0, 2.05, d / 2 + 0.62);
  awn.rotation.x = -0.28;
  g.add(awn);

  const signMat = new THREE.MeshStandardMaterial({
    map: makeSignboard("#1f4f8f", "#f7e6a8", Math.random() * 500),
    roughness: 0.75,
    emissive: new THREE.Color("#2a2010"),
    emissiveIntensity: 0.5,
  });
  const sign = mesh(BOX, signMat, false);
  sign.scale.set(w * 0.9, 0.75, 0.12);
  sign.position.set(0, h - 0.15, d / 2 + 0.09);
  g.add(sign);

  const step = mesh(BOX, M.concrete);
  step.scale.set(w * 0.8, 0.16, 0.8);
  step.position.set(0, 0.08, d / 2 + 0.4);
  g.add(step);

  return {
    group: g,
    half: w / 2 + 0.8,
    randomize: () => {
      wall.color.set(pick(SHOP_WALLS));
      g.rotation.y = rand(-0.1, 0.1);
      const s = rand(0.9, 1.15);
      g.scale.setScalar(s);
    },
  };
}

/* ------------------------------------------------------------------ *
 * Temple: tapering stack with a shikhara and a gold finial.
 * ------------------------------------------------------------------ */

export function makeTemple(): Prop {
  const g = new THREE.Group();
  const stone = std("#e8d8bc", { roughness: 0.9 });
  const trim = std("#c9612f", { roughness: 0.8 });

  const base = mesh(BOX, stone);
  base.scale.set(6.0, 0.7, 5.4);
  base.position.y = 0.35;
  g.add(base);

  const hall = mesh(BOX, stone);
  hall.scale.set(5.0, 2.4, 4.4);
  hall.position.y = 1.9;
  g.add(hall);

  const band = mesh(BOX, trim);
  band.scale.set(5.2, 0.28, 4.6);
  band.position.y = 3.2;
  g.add(band);

  // Tiers of the tower, each smaller than the last.
  let w = 3.2;
  let y = 3.5;
  for (let i = 0; i < 5; i++) {
    const t = mesh(BOX, i % 2 ? trim : stone);
    t.scale.set(w, 0.62, w * 0.9);
    t.position.set(0, y + 0.31, -0.4);
    g.add(t);
    y += 0.62;
    w *= 0.82;
  }

  const spire = mesh(CONE_R, stone);
  spire.scale.set(1.05, 1.6, 1.05);
  spire.position.set(0, y + 0.8, -0.4);
  g.add(spire);

  const finial = mesh(SPH, M.gold);
  finial.scale.setScalar(0.34);
  finial.position.set(0, y + 1.78, -0.4);
  g.add(finial);

  const kalash = mesh(CONE_R, M.gold);
  kalash.scale.set(0.16, 0.5, 0.16);
  kalash.position.set(0, y + 2.2, -0.4);
  g.add(kalash);

  // Flanking pillars at the entrance.
  for (const sx of [-1.7, 1.7]) {
    const p = mesh(CYL, stone);
    p.scale.set(0.26, 2.3, 0.26);
    p.position.set(sx, 1.85, 2.4);
    g.add(p);
  }

  return {
    group: g,
    half: 3.4,
    randomize: () => {
      g.rotation.y = rand(-0.08, 0.08);
      const s = rand(0.9, 1.15);
      g.scale.setScalar(s);
    },
  };
}

/* ------------------------------------------------------------------ *
 * Planting.
 * ------------------------------------------------------------------ */

export function makeTree(): Prop {
  const g = new THREE.Group();
  const leafMat = std("#3d8244", { roughness: 0.92, flatShading: true });

  const trunk = mesh(CYL, M.trunk);
  trunk.scale.set(0.22, 2.0, 0.22);
  trunk.position.y = 1.0;
  g.add(trunk);

  const blobs: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const b = mesh(ICO, i % 2 === 0 ? leafMat : M.leafDark);
    b.scale.setScalar(1.35 - i * 0.2);
    b.position.set(rand(-0.5, 0.5), 2.5 + i * 0.6, rand(-0.5, 0.5));
    b.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
    g.add(b);
    blobs.push(b);
  }

  return {
    group: g,
    half: 1.3,
    randomize: () => {
      leafMat.color.setHSL(0.28 + rand(-0.05, 0.05), rand(0.35, 0.55), rand(0.28, 0.4));
      g.rotation.y = rand(0, Math.PI * 2);
      const s = rand(0.75, 1.5);
      g.scale.set(s, s * rand(0.85, 1.25), s);
      for (const b of blobs) b.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
    },
  };
}

export function makePalm(): Prop {
  const g = new THREE.Group();
  const trunk = new THREE.Group();
  // Segmented, slightly curving trunk.
  let y = 0;
  for (let i = 0; i < 6; i++) {
    const seg = mesh(CYL_LOW, M.trunk);
    seg.scale.set(0.17 - i * 0.012, 0.75, 0.17 - i * 0.012);
    seg.position.set(i * i * 0.03, y + 0.37, 0);
    seg.rotation.z = -i * 0.03;
    trunk.add(seg);
    y += 0.72;
  }
  g.add(trunk);

  const crown = new THREE.Group();
  crown.position.set(0.55, y + 0.1, 0);
  const frondMat = std("#4f9b52", { roughness: 0.9, flatShading: true });
  for (let i = 0; i < 9; i++) {
    const f = mesh(CONE, frondMat);
    f.scale.set(0.3, 2.1, 0.12);
    const a = (i / 9) * Math.PI * 2;
    f.position.set(Math.cos(a) * 0.85, -0.35, Math.sin(a) * 0.85);
    f.rotation.set(Math.sin(a) * 1.05, -a, Math.cos(a) * -1.05);
    crown.add(f);
  }
  const coco = mesh(SPH, std("#6b5230", { roughness: 0.9 }));
  coco.scale.setScalar(0.18);
  coco.position.set(0, -0.2, 0.2);
  crown.add(coco);
  g.add(crown);

  return {
    group: g,
    half: 1.6,
    randomize: () => {
      frondMat.color.setHSL(0.3 + rand(-0.03, 0.03), rand(0.32, 0.48), rand(0.3, 0.4));
      g.rotation.y = rand(0, Math.PI * 2);
      const s = rand(0.85, 1.35);
      g.scale.setScalar(s);
    },
  };
}

export function makeHedge(): Prop {
  const g = new THREE.Group();
  const mat = std("#3f7a45", { roughness: 0.95, flatShading: true });
  const body = mesh(BOX, mat);
  body.scale.set(3.4, 0.75, 0.9);
  body.position.y = 0.38;
  g.add(body);
  // Rough top so it does not read as a plain slab.
  for (let i = 0; i < 5; i++) {
    const b = mesh(ICO, mat);
    b.scale.setScalar(rand(0.35, 0.55));
    b.position.set(-1.4 + i * 0.7, 0.78, rand(-0.15, 0.15));
    b.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
    g.add(b);
  }
  return {
    group: g,
    half: 1.8,
    randomize: () => {
      mat.color.setHSL(0.29 + rand(-0.04, 0.04), rand(0.35, 0.5), rand(0.24, 0.34));
      g.rotation.y = rand(-0.06, 0.06);
      g.scale.set(rand(0.8, 1.4), rand(0.8, 1.2), 1);
    },
  };
}

/* ------------------------------------------------------------------ *
 * Street furniture.
 * ------------------------------------------------------------------ */

export function makeStreetLamp(side: number): Prop {
  const g = new THREE.Group();

  const base = mesh(CYL, M.concrete);
  base.scale.set(0.24, 0.3, 0.24);
  base.position.y = 0.15;
  g.add(base);

  const pole = mesh(CYL, M.darkMetal);
  pole.scale.set(0.09, 6.4, 0.09);
  pole.position.y = 3.2;
  g.add(pole);

  // Curved arm built from short segments.
  const arm = new THREE.Group();
  arm.position.y = 6.3;
  for (let i = 0; i < 4; i++) {
    const s = mesh(CYL, M.darkMetal);
    s.scale.set(0.065, 0.5, 0.065);
    s.position.set(-side * (0.1 + i * 0.32), 0.32 - i * 0.075, 0);
    s.rotation.z = side * (0.5 + i * 0.28);
    arm.add(s);
  }
  g.add(arm);

  const head = mesh(BOX, M.darkMetal);
  head.scale.set(0.75, 0.16, 0.34);
  head.position.set(-side * 1.42, 6.45, 0);
  head.rotation.z = side * 0.08;
  g.add(head);

  const bulb = mesh(BOX, M.bulb, false, false);
  bulb.scale.set(0.5, 0.05, 0.2);
  bulb.position.set(-side * 1.42, 6.34, 0);
  g.add(bulb);

  return {
    group: g,
    half: 0.4,
    randomize: () => {},
  };
}

export function makePowerPole(spacing: number): Prop {
  const g = new THREE.Group();

  const pole = mesh(CYL, std("#8a7f70", { roughness: 0.95 }));
  pole.scale.set(0.16, 8.5, 0.16);
  pole.position.y = 4.25;
  g.add(pole);

  for (let i = 0; i < 2; i++) {
    const cross = mesh(BOX, M.trunk);
    cross.scale.set(2.4 - i * 0.7, 0.12, 0.14);
    cross.position.y = 7.6 - i * 0.85;
    g.add(cross);
  }

  // Wires sag forward to the next pole. Spacing is fixed, so each pole can
  // carry its own span and the line still looks continuous.
  const wireMat = M.wire;
  for (const [ox, oy] of [
    [-1.05, 7.66],
    [0, 7.66],
    [1.05, 7.66],
    [-0.75, 6.81],
    [0.75, 6.81],
  ]) {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(ox, oy, 0),
      new THREE.Vector3(ox, oy - 0.85, -spacing / 2),
      new THREE.Vector3(ox, oy, -spacing),
    );
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 10, 0.016, 5, false),
      wireMat,
    );
    tube.castShadow = false;
    g.add(tube);
  }

  return { group: g, half: 1.4, randomize: () => {} };
}

/** Painted kilometre stone at the verge. */
export function makeMilestone(): Prop {
  const g = new THREE.Group();
  const body = mesh(BOX, M.paint);
  body.scale.set(0.5, 0.7, 0.26);
  body.position.y = 0.35;
  g.add(body);
  const top = mesh(CYL, std("#f2a007", { roughness: 0.7 }));
  top.scale.set(0.25, 0.22, 0.13);
  top.rotation.x = Math.PI / 2;
  top.position.y = 0.7;
  g.add(top);
  return { group: g, half: 0.4, randomize: () => {} };
}

/** Roadside hoarding on two legs. */
export function makeBillboard(): Prop {
  const g = new THREE.Group();
  const panelMat = new THREE.MeshStandardMaterial({
    map: makeSignboard("#c9342b", "#fff2cc", Math.random() * 900),
    roughness: 0.7,
    emissive: new THREE.Color("#3a2a10"),
    emissiveIntensity: 0.6,
    side: THREE.DoubleSide,
  });
  for (const sx of [-1.5, 1.5]) {
    const leg = mesh(CYL, M.darkMetal);
    leg.scale.set(0.11, 3.6, 0.11);
    leg.position.set(sx, 1.8, 0);
    g.add(leg);
  }
  const panel = mesh(BOX, panelMat);
  panel.scale.set(4.6, 1.6, 0.16);
  panel.position.y = 4.2;
  g.add(panel);
  const frame = mesh(BOX, M.darkMetal);
  frame.scale.set(4.8, 0.12, 0.2);
  frame.position.y = 3.34;
  g.add(frame);
  return {
    group: g,
    half: 2.6,
    randomize: () => {
      g.rotation.y = rand(-0.25, 0.25);
    },
  };
}

/* ------------------------------------------------------------------ *
 * Parking lot with a row of parked cars.
 * ------------------------------------------------------------------ */

function tinyCar(): { group: THREE.Group; paint: THREE.MeshStandardMaterial } {
  const g = new THREE.Group();
  const paint = std("#d94f45", { roughness: 0.28, metalness: 0.32 });
  const body = mesh(BOX, paint);
  body.scale.set(1.6, 0.55, 3.3);
  body.position.y = 0.62;
  g.add(body);
  const cabin = mesh(BOX, paint);
  cabin.scale.set(1.42, 0.5, 1.7);
  cabin.position.set(0, 1.07, -0.15);
  g.add(cabin);
  const glass = mesh(BOX, M.darkGlass, false);
  glass.scale.set(1.46, 0.36, 1.74);
  glass.position.set(0, 1.12, -0.15);
  g.add(glass);
  for (const sx of [-0.82, 0.82]) {
    for (const sz of [1.1, -1.1]) {
      const w = mesh(CYL, std("#1c1c1e", { roughness: 0.9 }));
      w.scale.set(0.34, 0.22, 0.34);
      w.rotation.z = Math.PI / 2;
      w.position.set(sx, 0.34, sz);
      g.add(w);
    }
  }
  return { group: g, paint };
}

export function makeParkingLot(): Prop {
  const g = new THREE.Group();

  const kerb = mesh(BOX, M.concrete);
  kerb.scale.set(13.4, 0.22, 9.4);
  kerb.position.y = 0.11;
  g.add(kerb);

  const slab = mesh(BOX, M.asphalt, false);
  slab.scale.set(13, 0.3, 9);
  slab.position.y = 0.15;
  g.add(slab);

  for (let i = 0; i < 7; i++) {
    const line = mesh(BOX, M.paint, false);
    line.scale.set(0.12, 0.02, 4.2);
    line.position.set(-5.4 + i * 1.8, 0.305, -1.6);
    g.add(line);
  }

  const paints: THREE.MeshStandardMaterial[] = [];
  for (let i = 0; i < 5; i++) {
    const car = tinyCar();
    car.group.scale.setScalar(0.82);
    car.group.position.set(-4.5 + i * 1.8, 0.3, -1.7);
    car.group.rotation.y = rand(-0.05, 0.05);
    g.add(car.group);
    paints.push(car.paint);
  }

  return {
    group: g,
    half: 7,
    randomize: () => {
      for (const p of paints) p.color.set(pick(CAR_PAINTS));
      g.rotation.y = rand(-0.05, 0.05);
    },
  };
}

/* ------------------------------------------------------------------ *
 * Clouds and distant ridges.
 * ------------------------------------------------------------------ */

export function makeCloud(): Prop {
  const g = new THREE.Group();
  const blobs: THREE.Mesh[] = [];
  const n = randInt(4, 7);
  for (let i = 0; i < n; i++) {
    const b = new THREE.Mesh(ICO1, M.cloud);
    b.castShadow = false;
    b.receiveShadow = false;
    b.scale.set(rand(3, 6.5), rand(1.6, 2.8), rand(2.5, 5));
    b.position.set(rand(-9, 9), rand(-1.2, 1.2), rand(-5, 5));
    b.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
    g.add(b);
    blobs.push(b);
  }
  return {
    group: g,
    half: 12,
    randomize: () => {
      for (const b of blobs) {
        b.scale.set(rand(3, 6.5), rand(1.6, 2.8), rand(2.5, 5));
        b.position.set(rand(-9, 9), rand(-1.2, 1.2), rand(-5, 5));
      }
      g.scale.setScalar(rand(0.7, 1.5));
    },
  };
}

/**
 * A ridge line for the horizon. Built once from a displaced plane and moved
 * very slowly so it parallaxes behind the town.
 */
export function makeRidge(width: number, seed: number): THREE.Mesh {
  const segs = 60;
  const geo = new THREE.PlaneGeometry(width, 34, segs, 1);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    // Whole harmonics only, so the left and right edges match and two copies
    // can be tiled side by side while the ridge drifts.
    const TAU = Math.PI * 2;
    const h =
      Math.sin(TAU * 3 * t + seed) * 5.5 +
      Math.sin(TAU * 7 * t + seed * 2.3) * 2.6 +
      Math.sin(TAU * 1 * t + seed * 0.7) * 7.0;
    // Top row only, so the base stays level with the ground.
    pos.setY(i, 17 + h);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#6d7f7a"),
    roughness: 1,
    metalness: 0,
    flatShading: true,
    fog: true,
  });
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = false;
  m.receiveShadow = false;
  return m;
}
