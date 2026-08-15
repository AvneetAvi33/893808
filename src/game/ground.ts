import * as THREE from "three";
import { makeAsphalt, makeGround } from "./textures";
import { rand } from "./palette";

export const TILE_LEN = 30;
export const TILE_COUNT = 11;
export const GROUND_SPAN = TILE_LEN * TILE_COUNT;

/** Lane centres. Three lanes, all travelling the same way. */
export const LANES = [-2.7, 0, 2.7] as const;
export const ROAD_HALF = 4.9;
const KERB_H = 0.16;
const WALK_W = 1.7;
const GRASS_W = 190;

export type GroundKit = {
  tiles: THREE.Group[];
  /** Shared so the region tint can be applied in one place. */
  groundMaterial: THREE.MeshStandardMaterial;
};

/**
 * Ground is built as a ring of identical tiles laid end to end. Because the
 * asphalt texture repeats a whole number of times per tile, the seams are
 * invisible and a tile can be teleported to the far end without a visible cut.
 */
export function makeGround3D(): GroundKit {
  const asphalt = makeAsphalt();
  const soil = makeGround();

  const roadMaterial = new THREE.MeshStandardMaterial({
    map: asphalt.map,
    roughnessMap: asphalt.roughnessMap,
    normalMap: asphalt.normalMap,
    normalScale: new THREE.Vector2(0.14, 0.14),
    color: new THREE.Color("#7b7674"),
    roughness: 1.0,
    metalness: 0.0,
    envMapIntensity: 0.22,
  });

  const groundMaterial = new THREE.MeshStandardMaterial({
    map: soil.map,
    normalMap: soil.normalMap,
    normalScale: new THREE.Vector2(0.22, 0.22),
    color: new THREE.Color("#8fae52"),
    roughness: 1.0,
    metalness: 0.0,
    envMapIntensity: 0.22,
  });

  const paint = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#efeade"),
    roughness: 0.55,
    metalness: 0.0,
    emissive: new THREE.Color("#4a453c"),
    emissiveIntensity: 0.12,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  const paintYellow = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#e8b845"),
    roughness: 0.6,
    emissive: new THREE.Color("#4a3714"),
    emissiveIntensity: 0.12,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  const kerbMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#cfc4ae"),
    roughness: 0.95,
    envMapIntensity: 0.3,
  });
  const kerbRed = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#c4564a"),
    roughness: 0.9,
  });
  const walkMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#a89c88"),
    roughness: 1.0,
    envMapIntensity: 0.22,
  });
  const gravelMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#7a6a50"),
    roughness: 1.0,
    envMapIntensity: 0.2,
  });

  const BOX = new THREE.BoxGeometry(1, 1, 1);

  // Terrain profile: flat next to the road, gently undulating further out, so
  // the world does not read as one enormous billiard table.
  const grassGeo = new THREE.PlaneGeometry(GRASS_W, TILE_LEN, 120, 1);
  grassGeo.rotateX(-Math.PI / 2);
  {
    const pos = grassGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const a = Math.abs(x);
      const r = Math.min(1, Math.max(0, (a - 14) / 40));
      const ramp = r * r * (3 - 2 * r);
      const h =
        Math.sin(x * 0.085) * 1.5 +
        Math.sin(x * 0.031 + 1.7) * 3.2 +
        Math.sin(x * 0.21 + 0.4) * 0.55;
      pos.setY(i, h * ramp - 0.02);
    }
    grassGeo.computeVertexNormals();
  }

  const roadGeo = new THREE.PlaneGeometry(ROAD_HALF * 2, TILE_LEN, 1, 1);
  roadGeo.rotateX(-Math.PI / 2);

  const tiles: THREE.Group[] = [];

  for (let i = 0; i < TILE_COUNT; i++) {
    const tile = new THREE.Group();

    const grass = new THREE.Mesh(grassGeo, groundMaterial);
    grass.receiveShadow = true;
    grass.position.y = -0.02;
    tile.add(grass);

    const road = new THREE.Mesh(roadGeo, roadMaterial);
    road.receiveShadow = true;
    road.position.y = 0.01;
    tile.add(road);

    const add = (
      mat: THREE.Material,
      sx: number,
      sy: number,
      sz: number,
      x: number,
      y: number,
      z: number,
      cast = false,
    ) => {
      const m = new THREE.Mesh(BOX, mat);
      m.scale.set(sx, sy, sz);
      m.position.set(x, y, z);
      m.castShadow = cast;
      m.receiveShadow = true;
      tile.add(m);
      return m;
    };

    for (const s of [-1, 1]) {
      // Kerb, with the painted band Indian roads use on the verge.
      add(kerbMat, 0.36, KERB_H * 2, TILE_LEN, s * (ROAD_HALF + 0.18), KERB_H, 0, true);
      for (let k = 0; k < 12; k++) {
        add(
          k % 2 ? kerbRed : kerbMat,
          0.375,
          0.08,
          TILE_LEN / 12 - 0.12,
          s * (ROAD_HALF + 0.18),
          KERB_H + 0.15,
          -TILE_LEN / 2 + TILE_LEN / 24 + (k * TILE_LEN) / 12,
        );
      }
      // Footpath and the dusty strip beyond it.
      add(
        walkMat,
        WALK_W,
        KERB_H * 2,
        TILE_LEN,
        s * (ROAD_HALF + 0.36 + WALK_W / 2),
        KERB_H - 0.02,
        0,
      );
      add(
        gravelMat,
        1.6,
        0.06,
        TILE_LEN,
        s * (ROAD_HALF + 0.36 + WALK_W + 0.8),
        0.03,
        0,
      );

      // Solid edge line just inside the kerb.
      add(paint, 0.16, 0.02, TILE_LEN, s * (ROAD_HALF - 0.32), 0.025, 0);
    }

    // Yellow line on the median side of the carriageway.
    add(paintYellow, 0.14, 0.02, TILE_LEN, -ROAD_HALF + 0.62, 0.025, 0);

    // Dashed lane dividers between the three lanes.
    for (const lx of [-1.35, 1.35]) {
      for (let d = 0; d < 6; d++) {
        add(
          paint,
          0.14,
          0.02,
          2.4,
          lx,
          0.025,
          -TILE_LEN / 2 + 1.6 + d * (TILE_LEN / 6),
        );
      }
    }

    // Zebra crossing on every other tile.
    if (i % 4 === 0) {
      for (let b = 0; b < 11; b++) {
        add(paint, 0.52, 0.02, 3.0, -ROAD_HALF + 0.7 + b * 0.82, 0.028, -TILE_LEN / 2 + 5);
      }
      // Stop line ahead of it.
      add(paint, ROAD_HALF * 2 - 0.5, 0.02, 0.34, 0, 0.028, -TILE_LEN / 2 + 7.2);
    }

    // Patchwork repairs, which stop the tarmac from looking printed.
    if (i % 3 === 1) {
      const patch = new THREE.Mesh(
        BOX,
        new THREE.MeshStandardMaterial({
          color: new THREE.Color("#57534f"),
          roughness: 0.98,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        }),
      );
      patch.scale.set(rand(1.4, 2.8), 0.02, rand(3, 7));
      patch.position.set(rand(-3, 3), 0.022, rand(-8, 8));
      patch.rotation.y = rand(-0.1, 0.1);
      patch.receiveShadow = true;
      tile.add(patch);
    }

    tiles.push(tile);
  }

  return { tiles, groundMaterial };
}
