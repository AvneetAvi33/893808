import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

import {
  GROUND_SPAN,
  LANES,
  ROAD_HALF,
  TILE_COUNT,
  TILE_LEN,
  makeGround3D,
} from "./ground";
import {
  Prop,
  makeBillboard,
  makeCloud,
  makeHedge,
  makeHouse,
  makeMilestone,
  makePalm,
  makeParkingLot,
  makePowerPole,
  makeRidge,
  makeShop,
  makeStreetLamp,
  makeTemple,
  makeTower,
  makeTree,
} from "./props";
import {
  HeroCar,
  TRAFFIC_BUILDERS,
  TrafficBody,
  makeHeroCar,
} from "./vehicles";
import {
  Region,
  clamp,
  damp,
  mixHex,
  pick,
  rand,
  randInt,
  regionAt,
  regionBlend,
} from "./palette";
import { makeContactShadow, makeSmokeTexture } from "./textures";
import { bakeEnvironment, makeSky } from "./sky";

/* ------------------------------------------------------------------ *
 * World constants.
 * ------------------------------------------------------------------ */

/** Metres per second at speed multiplier 1. */
const BASE_SPEED = 30;
/** Everything recycles inside this band. */
const SPAN = GROUND_SPAN;
/** Anything past this depth has gone behind the camera. */
const Z_BEHIND = 25;

const LOOKAHEAD = 42;
/** Bumper to bumper length of the hero car. */
const HERO_LENGTH = 4.5;
/** How far past a vehicle the car must be before it may cut back in. */
const REAR_MARGIN = 2.5;
const LANE_SPACING = 25;

/** Chase camera rig: high and steep, but with the horizon still in frame. */
const CAM_Y = 11.8;
const CAM_Z = 16.5;
const LOOK_Y = 0.9;
const LOOK_Z = -13.5;

/** Direction the shading sun comes from. */
const SUN_DIR = new THREE.Vector3(-0.5, 0.42, -0.76).normalize();
/** Where the sun disc is drawn in the sky. Kept lower than the shading sun so
 *  its glow sits in the visible band of sky without stretching shadows to the
 *  horizon. */
const SKY_SUN_DIR = new THREE.Vector3(-0.42, 0.052, -0.906).normalize();

export type FrameInfo = {
  km: number;
  city: string;
  state: string;
  kmh: number;
};

type Scattered = {
  obj: THREE.Object3D;
  prop: Prop;
  /** Called when the object is sent back to the far end. */
  place: (region: Region) => void;
};

type TrafficSlot = {
  pivot: THREE.Group;
  body: TrafficBody;
  shadow: THREE.Mesh;
  lane: number;
  /** Fraction of the hero's speed this vehicle travels at. */
  speedFrac: number;
  spin: number;
};

type Puff = {
  sprite: THREE.Sprite;
  life: number;
  ttl: number;
  vy: number;
  vx: number;
  size: number;
};

/* ------------------------------------------------------------------ *
 * A small colour grade: vignette and a whisper of grain. Applied in the
 * linear pass before the tone map, which keeps it from crushing highlights.
 * ------------------------------------------------------------------ */

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uVignette: { value: 0.7 },
    uGrain: { value: 0.022 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uVignette;
    uniform float uGrain;
    varying vec2 vUv;

    void main() {
      vec4 c = texture2D(tDiffuse, vUv);

      vec2 p = (vUv - 0.5) * vec2(1.0, 0.92);
      float v = 1.0 - dot(p, p) * uVignette;
      v = clamp(v, 0.0, 1.0);
      c.rgb *= mix(1.0, v * v, 0.55);

      // Very slight warm lift in the shadows, the way film behaves.
      c.rgb += vec3(0.012, 0.007, 0.002) * (1.0 - smoothstep(0.0, 0.35, c.g));

      float g = fract(sin(dot(vUv * 1024.0 + uTime, vec2(12.9898, 78.233))) * 43758.5453);
      c.rgb += (g - 0.5) * uGrain;

      gl_FragColor = c;
    }
  `,
};

/* ------------------------------------------------------------------ */

export class Game {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private composer!: EffectComposer;
  private bloom!: UnrealBloomPass;
  private grade!: ShaderPass;

  private sky = makeSky();
  private sun = new THREE.DirectionalLight(0xffe0ab, 3.9);
  private hemi = new THREE.HemisphereLight(0xa8ccf5, 0x7a6440, 0.7);
  private fog = new THREE.Fog(0xffcf9a, 120, 300);

  private tiles: THREE.Group[] = [];
  private groundMaterial!: THREE.MeshStandardMaterial;
  private scatter: Scattered[] = [];
  private lamps: THREE.Group[] = [];
  private poles: THREE.Group[] = [];
  private stones: THREE.Group[] = [];
  private clouds: { group: THREE.Group; prop: Prop }[] = [];
  private ridgeLayers: { group: THREE.Group; width: number; speed: number; mat: THREE.MeshStandardMaterial; base: number }[] = [];

  private hero!: HeroCar;
  private heroPivot = new THREE.Group();
  private heroShadow!: THREE.Mesh;
  private traffic: TrafficSlot[] = [];

  private puffs: Puff[] = [];
  private puffCursor = 0;

  // Motion state.
  private distance = 0;
  private speedMul = 1;
  private brake = 1;
  private paused = true;
  private running = false;
  private raf = 0;
  private last = 0;
  private elapsed = 0;
  private needsMeasure = true;

  private carX = 0;
  private targetX = 0;
  private prevCarX = 0;
  private lean = 0;
  private yaw = 0;
  private steer = 0;
  private wheelSpin = 0;
  private camX = 0;

  /** True while the title card is up: the world drifts, the counter does not. */
  private idle = true;
  private smokeTimer = 0;
  private hudTimer = 0;
  private loggedError = false;

  private tmpColor = new THREE.Color();
  private groundColor = new THREE.Color("#8fae52");
  private hazeColor = new THREE.Color("#ffcf9a");
  private sunColor = new THREE.Color("#ffd9a0");
  private hills = 0.5;

  private onFrame: (info: FrameInfo) => void;

  constructor(canvas: HTMLCanvasElement, onFrame: (info: FrameInfo) => void) {
    this.canvas = canvas;
    this.onFrame = onFrame;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
      stencil: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    const { w, h } = this.measure();
    this.camera = new THREE.PerspectiveCamera(this.fovFor(w / h), w / h, 1, 4000);
    this.camera.position.set(0, CAM_Y, CAM_Z);
    this.camera.lookAt(0, LOOK_Y, LOOK_Z);

    this.scene.fog = this.fog;

    this.buildWorld();
    this.buildPost(w, h);
    this.renderer.setSize(w, h, false);

    // One warm up render so the first visible frame is not a black flash.
    this.renderer.compile(this.scene, this.camera);
  }

  /* ---------------------------------------------------------------- *
   * Sizing. Every read has a fallback, because a container that has
   * collapsed to zero inside an embed is the classic blank screen bug.
   * ---------------------------------------------------------------- */

  private measure() {
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(
      1,
      Math.round(rect.width || this.canvas.clientWidth || window.innerWidth || 1280),
    );
    const h = Math.max(
      1,
      Math.round(rect.height || this.canvas.clientHeight || window.innerHeight || 720),
    );
    return { w, h };
  }

  private fovFor(aspect: number) {
    // Portrait phones need a wider lens or the road fills the whole frame.
    if (!Number.isFinite(aspect) || aspect <= 0) return 50;
    if (aspect < 0.7) return 66;
    if (aspect < 1.05) return 59;
    if (aspect < 1.5) return 52;
    return 48;
  }

  resize = () => {
    const { w, h } = this.measure();
    const aspect = w / h;
    this.camera.aspect = aspect;
    this.camera.fov = this.fovFor(aspect);
    this.camera.updateProjectionMatrix();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    // setSize already scales by the composer's pixel ratio and resizes every
    // pass, so the passes must not be resized again by hand.
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(w, h);
  };

  /* ---------------------------------------------------------------- *
   * Post processing chain.
   * ---------------------------------------------------------------- */

  private buildPost(w: number, h: number) {
    const dpr = this.renderer.getPixelRatio();
    const target = new THREE.WebGLRenderTarget(
      Math.max(1, Math.round(w * dpr)),
      Math.max(1, Math.round(h * dpr)),
      {
        type: THREE.HalfFloatType,
        // Multisampling inside the HDR buffer, since the composer bypasses
        // the renderer's own antialiasing.
        samples: dpr > 1.5 ? 2 : 4,
      },
    );

    this.composer = new EffectComposer(this.renderer, target);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.34, 0.7, 0.95);
    this.composer.addPass(this.bloom);

    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);

    this.composer.addPass(new OutputPass());
  }

  /* ---------------------------------------------------------------- *
   * World construction. Everything below runs once.
   * ---------------------------------------------------------------- */

  private buildWorld() {
    // Sun ahead and to the left. Everything ends up rim lit and the shadows
    // stretch back toward the camera.
    const sunDir = SUN_DIR;
    this.sky.setSun(SKY_SUN_DIR);
    this.scene.add(this.sky.mesh);

    const env = bakeEnvironment(this.renderer, this.sky);
    this.scene.environment = env;
    this.scene.environmentIntensity = 0.75;

    this.sun.position.copy(sunDir).multiplyScalar(120);
    this.sun.target.position.set(0, 0, -30);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -48;
    sc.right = 48;
    sc.top = 48;
    sc.bottom = -48;
    sc.near = 40;
    sc.far = 230;
    sc.updateProjectionMatrix();
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.045;
    this.sun.shadow.radius = 1.6;
    this.scene.add(this.sun, this.sun.target);

    this.scene.add(this.hemi);
    this.scene.add(new THREE.AmbientLight(0xffe6c4, 0.18));

    // A cool fill from the opposite side keeps the shadow sides from going
    // muddy, which is the usual giveaway of a single light setup.
    const fill = new THREE.DirectionalLight(0xbcd8ff, 0.55);
    fill.position.set(60, 40, 50);
    this.scene.add(fill);

    this.buildGround();
    this.buildRidges();
    this.buildTown();
    this.buildHero();
    this.buildTraffic();
    this.buildSmoke();
    this.buildClouds();
  }

  private buildGround() {
    const kit = makeGround3D();
    this.groundMaterial = kit.groundMaterial;
    this.tiles = kit.tiles;
    for (let i = 0; i < TILE_COUNT; i++) {
      this.tiles[i].position.z = 25 - i * TILE_LEN;
      this.scene.add(this.tiles[i]);
    }
  }

  private buildRidges() {
    const layers = [
      { z: -980, scale: 3.4, tint: 0.60, speed: 0.010, width: 2600 },
      { z: -700, scale: 2.0, tint: 0.42, speed: 0.020, width: 2100 },
    ];
    for (const l of layers) {
      const group = new THREE.Group();
      const base = makeRidge(l.width, l.z * 0.01 + 3);
      const mat = base.material as THREE.MeshStandardMaterial;
      // Ridges opt out of scene fog so their aerial haze can be dialled in
      // directly. That keeps them visible past the fog's far plane.
      mat.fog = false;
      mat.userData.tint = l.tint;
      const copyA = base;
      const copyB = new THREE.Mesh(base.geometry, mat);
      copyB.position.x = l.width;
      group.add(copyA, copyB);
      group.position.z = l.z;
      group.scale.y = l.scale;
      this.scene.add(group);
      this.ridgeLayers.push({ group, width: l.width, speed: l.speed, mat, base: l.scale });
    }
  }

  private addScatter(
    prop: Prop,
    place: (region: Region) => void,
    z: number,
  ) {
    prop.group.position.z = z;
    this.scene.add(prop.group);
    const s: Scattered = { obj: prop.group, prop, place };
    this.scatter.push(s);
    return s;
  }

  /**
   * Random position off the tarmac, on either verge. Several candidates are
   * tried and the roomiest one wins, so buildings and trees stop growing
   * through each other when the pool recycles.
   */
  private verge(prop: Prop, near: number, far: number) {
    const z = prop.group.position.z;
    let bestX = 0;
    let bestScore = -Infinity;

    for (let attempt = 0; attempt < 5; attempt++) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const x = side * (ROAD_HALF + near + Math.random() * (far - near) + prop.half);

      let score = Infinity;
      for (const other of this.scatter) {
        if (other.prop === prop || !other.obj.visible) continue;
        const dz = Math.abs(other.obj.position.z - z);
        if (dz > 26) continue;
        const dx = Math.abs(other.obj.position.x - x);
        // How much clear ground is left between the two footprints.
        const gap = Math.hypot(dx, dz * 0.55) - (other.prop.half + prop.half);
        if (gap < score) score = gap;
      }

      if (score > bestScore) {
        bestScore = score;
        bestX = x;
      }
      if (score > 1.5) break;
    }

    prop.group.position.x = bestX;
  }

  private buildTown() {
    const spread = () => -Math.random() * SPAN + 30;

    // Towers and houses share slots: which one shows depends on how urban the
    // current region is, so a city stretch grows taller as you enter it.
    for (let i = 0; i < 12; i++) {
      const p = makeTower();
      this.addScatter(
        p,
        (region) => {
          p.group.visible = Math.random() < region.urban;
          this.verge(p, 4.0, 18);
          p.randomize();
        },
        spread(),
      );
      this.verge(p, 4.0, 18);
      p.randomize();
    }

    for (let i = 0; i < 16; i++) {
      const p = makeHouse();
      this.addScatter(
        p,
        (region) => {
          p.group.visible = Math.random() > region.urban * 0.55;
          this.verge(p, 2.4, 13);
          p.randomize();
        },
        spread(),
      );
      this.verge(p, 2.4, 13);
      p.randomize();
    }

    for (let i = 0; i < 9; i++) {
      const p = makeShop();
      this.addScatter(
        p,
        () => {
          this.verge(p, 2.6, 7);
          p.randomize();
        },
        spread(),
      );
      this.verge(p, 2.6, 7);
      p.randomize();
    }

    for (let i = 0; i < 3; i++) {
      const p = makeTemple();
      this.addScatter(
        p,
        () => {
          this.verge(p, 2.6, 11);
          p.randomize();
        },
        spread(),
      );
      this.verge(p, 2.6, 11);
      p.randomize();
    }

    for (let i = 0; i < 3; i++) {
      const p = makeParkingLot();
      this.addScatter(
        p,
        () => {
          this.verge(p, 2.2, 7);
          p.randomize();
        },
        spread(),
      );
      this.verge(p, 2.2, 7);
      p.randomize();
    }

    for (let i = 0; i < 26; i++) {
      const p = makeTree();
      this.addScatter(
        p,
        (region) => {
          p.group.visible = Math.random() > region.palmBias;
          this.verge(p, 1.2, 34);
          p.randomize();
        },
        spread(),
      );
      this.verge(p, 1.2, 34);
      p.randomize();
    }

    for (let i = 0; i < 12; i++) {
      const p = makePalm();
      this.addScatter(
        p,
        (region) => {
          p.group.visible = Math.random() < region.palmBias;
          this.verge(p, 1.1, 22);
          p.randomize();
        },
        spread(),
      );
      this.verge(p, 1.1, 22);
      p.group.visible = false;
      p.randomize();
    }

    for (let i = 0; i < 10; i++) {
      const p = makeHedge();
      this.addScatter(
        p,
        () => {
          this.verge(p, 0.4, 1.6);
          p.randomize();
        },
        spread(),
      );
      this.verge(p, 0.4, 1.6);
      p.randomize();
    }

    for (let i = 0; i < 4; i++) {
      const p = makeBillboard();
      this.addScatter(
        p,
        () => {
          this.verge(p, 3.5, 12);
          p.randomize();
        },
        spread(),
      );
      this.verge(p, 3.5, 12);
      p.randomize();
    }

    // Street lamps march down both footpaths on a fixed rhythm.
    const lampCount = Math.ceil(SPAN / LANE_SPACING);
    for (let i = 0; i < lampCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const p = makeStreetLamp(side);
      p.group.position.set(side * (ROAD_HALF + 1.5), 0, 25 - i * LANE_SPACING);
      p.group.rotation.y = side < 0 ? 0 : Math.PI;
      this.scene.add(p.group);
      this.lamps.push(p.group);
    }

    // Power line down the left verge. Each pole carries the span to the next.
    const poleCount = Math.ceil(SPAN / LANE_SPACING);
    for (let i = 0; i < poleCount; i++) {
      const p = makePowerPole(LANE_SPACING);
      p.group.position.set(-(ROAD_HALF + 5.4), 0, 25 - i * LANE_SPACING);
      this.scene.add(p.group);
      this.poles.push(p.group);
    }

    for (let i = 0; i < 6; i++) {
      const p = makeMilestone();
      p.group.position.set(ROAD_HALF + 1.1, 0, 25 - i * (SPAN / 6));
      this.scene.add(p.group);
      this.stones.push(p.group);
    }
  }

  private buildClouds() {
    for (let i = 0; i < 14; i++) {
      const p = makeCloud();
      for (const child of p.group.children) {
        const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
        mat.fog = false;
      }
      p.group.position.set(rand(-800, 800), rand(24, 72), rand(-1000, -620));
      p.randomize();
      this.scene.add(p.group);
      this.clouds.push({ group: p.group, prop: p });
    }
  }

  private buildHero() {
    this.hero = makeHeroCar();
    // Models are built facing +Z; the drive is toward -Z, so the model is
    // turned inside a pivot that stays world aligned for lean and yaw.
    this.hero.group.rotation.y = Math.PI;
    this.heroPivot.add(this.hero.group);
    this.heroPivot.position.set(0, 0, 0);
    this.scene.add(this.heroPivot);

    const shadowTex = makeContactShadow();
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.5,
      toneMapped: false,
    });
    this.heroShadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shadowMat);
    this.heroShadow.rotation.x = -Math.PI / 2;
    this.heroShadow.scale.set(3.4, 6.4, 1);
    this.heroShadow.position.y = 0.035;
    this.heroShadow.renderOrder = 2;
    this.heroPivot.add(this.heroShadow);
  }

  private buildTraffic() {
    const shadowTex = makeContactShadow();
    // Fixed mix, built once. Nothing is constructed after the drive begins.
    const plan = [0, 1, 2, 3, 4, 5, 6, 1];
    for (let i = 0; i < plan.length; i++) {
      const build = TRAFFIC_BUILDERS[plan[i] % TRAFFIC_BUILDERS.length];
      const body = build();
      body.group.rotation.y = Math.PI;

      const pivot = new THREE.Group();
      pivot.add(body.group);

      const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({
          map: shadowTex,
          transparent: true,
          depthWrite: false,
          opacity: 0.45,
          toneMapped: false,
        }),
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.scale.set(body.half * 3.4, body.length * 1.5, 1);
      shadow.position.y = 0.035;
      shadow.renderOrder = 2;
      pivot.add(shadow);

      this.scene.add(pivot);

      const slot: TrafficSlot = {
        pivot,
        body,
        shadow,
        lane: 1,
        speedFrac: 0.6,
        spin: 0,
      };
      this.traffic.push(slot);
      this.respawnTraffic(slot, -45 - i * 34);
    }
  }

  private buildSmoke() {
    const tex = makeSmokeTexture();
    for (let i = 0; i < 44; i++) {
      const mat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        opacity: 0,
        color: new THREE.Color("#c9b493"),
        fog: true,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      sprite.renderOrder = 3;
      this.scene.add(sprite);
      this.puffs.push({ sprite, life: 0, ttl: 1, vy: 0, vx: 0, size: 1 });
    }
  }

  /* ---------------------------------------------------------------- *
   * Traffic placement. The rule that makes the drive always solvable:
   * never let all three lanes be blocked in the same stretch of road,
   * and never stack two vehicles in one lane too closely.
   * ---------------------------------------------------------------- */

  private respawnTraffic(slot: TrafficSlot, startZ?: number) {
    const SAME_LANE_GAP = 30 + slot.body.length * 1.6;
    const WINDOW = 34;

    let z = startZ ?? -170 - Math.random() * 90;

    for (let attempt = 0; attempt < 10; attempt++) {
      const candidates: number[] = [];

      for (let lane = 0; lane < LANES.length; lane++) {
        let ok = true;
        for (const other of this.traffic) {
          if (other === slot) continue;
          const dz = Math.abs(other.pivot.position.z - z);
          if (other.lane === lane && dz < SAME_LANE_GAP) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;

        // Would this choice close the last open lane nearby?
        const occupied = new Set<number>([lane]);
        for (const other of this.traffic) {
          if (other === slot) continue;
          if (Math.abs(other.pivot.position.z - z) < WINDOW) occupied.add(other.lane);
        }
        if (occupied.size >= LANES.length) continue;

        candidates.push(lane);
      }

      if (candidates.length) {
        slot.lane = pick(candidates);
        slot.pivot.position.set(LANES[slot.lane], 0, z);
        this.dressTraffic(slot);
        return;
      }
      z -= 24;
    }

    // Fallback: drop it far enough back that it cannot pinch anything.
    slot.lane = randInt(0, LANES.length - 1);
    slot.pivot.position.set(LANES[slot.lane], 0, z - 60);
    this.dressTraffic(slot);
  }

  private dressTraffic(slot: TrafficSlot) {
    slot.body.repaint();
    // Heavy vehicles are the slow ones, which is what forces the overtakes.
    const heavy = slot.body.length > 6;
    slot.speedFrac = heavy ? rand(0.46, 0.62) : rand(0.64, 0.88);
    slot.pivot.rotation.y = rand(-0.012, 0.012);
  }

  /* ---------------------------------------------------------------- *
   * The hero's automatic dodging.
   * ---------------------------------------------------------------- */

  /**
   * Metres of open road ahead of a car sitting at `x`, capped at the planning
   * horizon. Zero means something is already alongside or right in front.
   *
   * The depth test uses each vehicle's real length, not just its centre point.
   * Comparing centres alone lets the car cut back in while it is still
   * alongside a bus, which is exactly where a sideswipe comes from.
   */
  private roomAhead(x: number) {
    const horizon = this.lookahead();
    const behind = HERO_LENGTH / 2 + REAR_MARGIN;
    let room = horizon;

    for (const t of this.traffic) {
      const z = t.pivot.position.z;
      if (z > behind) continue;
      const clearance = this.hero.halfWidth + t.body.half + 0.55;
      if (Math.abs(x - t.pivot.position.x) >= clearance) continue;
      const gap = -z - (t.body.length + HERO_LENGTH) / 2;
      if (gap < room) room = Math.max(0, gap);
    }
    return room;
  }

  /** Speed the world is scrolling at, as a multiple of the base speed. */
  private driveRate() {
    return this.idle ? 0.34 : this.speedMul;
  }

  /**
   * How far ahead to plan. It has to grow with speed, or at the top of the
   * slider the car spots a lorry too late to get around it.
   */
  private lookahead() {
    return LOOKAHEAD * clamp(0.8 + this.driveRate() * 0.75, 0.9, 2.1);
  }

  /** Top sideways speed, in metres per second. */
  private maxLateral() {
    return 5.2 * (0.6 + 0.5 * this.driveRate());
  }

  /**
   * True when sliding to `x` would put the car through something before it
   * got there.
   *
   * Checking the destination alone is not enough: a two lane move takes close
   * to a second, and in that second the car covers a lot of road. If a lorry
   * is sitting in the lane being crossed, the car arrives at its bumper part
   * way through the manoeuvre. So the test is not "is that lane occupied" but
   * "would we reach the thing in it before we are past".
   */
  private crossingBlocked(x: number) {
    const dx = Math.abs(x - this.carX);
    if (dx < 0.5) return false;

    const seconds = dx / this.maxLateral();
    const speed = BASE_SPEED * this.driveRate();
    const lo = Math.min(this.carX, x);
    const hi = Math.max(this.carX, x);
    const behind = HERO_LENGTH / 2 + REAR_MARGIN;

    for (const t of this.traffic) {
      if (t.pivot.position.z > behind) continue;
      const clearance = this.hero.halfWidth + t.body.half + 0.55;
      const tx = t.pivot.position.x;
      // Is it inside the strip of road we would sweep across?
      if (tx + clearance <= lo || tx - clearance >= hi) continue;

      const gap = -t.pivot.position.z - (t.body.length + HERO_LENGTH) / 2;
      const closing = speed * (1 - t.speedFrac);
      if (gap < closing * seconds + 4) return true;
    }
    return false;
  }

  private followSpeed() {
    // Braking distance scales with speed, so the easing window has to as well.
    // A fixed window is plenty at a crawl and far too short at full tilt.
    const scale = Math.max(0.6, this.driveRate());
    const near = 6 * scale;
    const far = 36 * scale;

    let want = 1;
    for (const t of this.traffic) {
      const z = t.pivot.position.z;
      if (z > 2 || z < -far - t.body.length) continue;
      const clearance = this.hero.halfWidth + t.body.half + 0.35;
      if (Math.abs(this.carX - t.pivot.position.x) >= clearance) continue;

      // Bumper to bumper gap.
      const gap = -z - (t.body.length + HERO_LENGTH) / 2;
      const ease = clamp((gap - near) / (far - near), 0, 1);
      let v = t.speedFrac + (1 - t.speedFrac) * ease;
      // Inside the safety margin, actively fall back rather than just match.
      if (gap < near * 0.6) v = Math.min(v, t.speedFrac * 0.8);
      want = Math.min(want, v);
    }
    return want;
  }

  /**
   * Pick where across the road to aim for.
   *
   * Rather than a yes/no "is this lane blocked", every candidate line is
   * scored by how much open road it has, offset by how far the car would have
   * to move, how far it would sit from a lane centre, and how far from the
   * middle of the carriageway. That makes overtaking emerge naturally: the
   * clear lane simply scores best.
   */
  private chooseTarget() {
    const limit = ROAD_HALF - this.hero.halfWidth - 0.25;
    const horizon = this.lookahead();

    const score = (x: number) => {
      let offLane = Number.POSITIVE_INFINITY;
      for (const lane of LANES) offLane = Math.min(offLane, Math.abs(x - lane));
      return (
        (this.roomAhead(x) / horizon) * 100 -
        Math.abs(x - this.carX) * 2.5 -
        offLane * 6 -
        Math.abs(x) * 1.2
      );
    };

    // Staying on the current line gets a bonus, so the car commits to a
    // manoeuvre instead of dithering between two near equal options.
    let bestX = this.targetX;
    let best = this.crossingBlocked(this.targetX)
      ? Number.NEGATIVE_INFINITY
      : score(this.targetX) + 7;

    for (let x = -limit; x <= limit + 1e-6; x += 0.15) {
      if (this.crossingBlocked(x)) continue;
      const sc = score(x);
      if (sc > best) {
        best = sc;
        bestX = x;
      }
    }

    this.targetX = clamp(bestX, -limit, limit);
    return this.roomAhead(this.targetX) > 1;
  }

  /* ---------------------------------------------------------------- *
   * Controls.
   * ---------------------------------------------------------------- */

  /**
   * Begin rendering. Called as soon as the canvas exists so the title card
   * has a live scene behind it, and again when the user actually sets off.
   */
  start() {
    if (!this.running) {
      this.running = true;
      this.paused = false;
      this.last = performance.now();
      this.needsMeasure = true;
      this.raf = requestAnimationFrame(this.tick);
    }
  }

  /** Leaves the title card and ramps up to the chosen speed. */
  launch() {
    this.idle = false;
    this.last = performance.now();
    this.needsMeasure = true;
  }

  setPaused(p: boolean) {
    this.paused = p;
    if (!p) this.last = performance.now();
  }

  setSpeed(mul: number) {
    this.speedMul = clamp(mul, 0.1, 2);
  }

  /** Current world speed, for the engine sound. */
  get speed() {
    return this.driveRate() * this.brake;
  }

  dispose() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    // Geometries and materials are shared between pooled objects, so they are
    // left to the garbage collector rather than disposed one by one; releasing
    // the renderer frees the GPU side of all of them at once.
    this.composer.dispose?.();
    this.renderer.dispose();
  }

  /* ---------------------------------------------------------------- *
   * Frame loop. Wrapped so that a single bad frame can never stop the
   * whole game.
   * ---------------------------------------------------------------- */

  private tick = (now: number) => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.tick);

    // A tab that has been in the background hands back a huge delta.
    const dt = Math.min(0.05, Math.max(0.0005, (now - this.last) / 1000));
    this.last = now;

    try {
      if (this.needsMeasure) {
        this.needsMeasure = false;
        this.resize();
      }
      this.update(dt);
      this.composer.render();
    } catch (err) {
      if (!this.loggedError) {
        this.loggedError = true;
        console.error("Anant: recovered from a frame error", err);
      }
    }
  };

  private update(dt: number) {
    const active = this.paused ? 0 : 1;
    this.elapsed += dt;

    const region = regionAt(this.distance);

    // Pick a line through the traffic, then set the speed from whatever is
    // still in the way after that choice.
    this.chooseTarget();
    this.brake = damp(this.brake, this.followSpeed(), 0.16, dt);

    const drive = this.driveRate();
    // `cruise` is how far the car would travel at the requested speed; `move`
    // is how far it actually travels after the follow-distance brake. Traffic
    // speeds are fractions of `cruise`, never of `move`: if they scaled with
    // the brake as well, easing off would slow the traffic by the same amount
    // and the car could never stop closing on the vehicle in front.
    const cruise = BASE_SPEED * drive * dt * active;
    const move = cruise * this.brake;
    if (!this.idle) this.distance += move;

    this.updateWorld(move);
    this.updateTraffic(move, cruise, dt);
    this.updateHero(move, dt);
    this.updateSmoke(move, dt);
    this.updateRegion(dt);
    this.updateCamera(dt);

    this.sky.material.uniforms.uTime.value = this.elapsed;
    this.grade.uniforms.uTime.value = this.elapsed;
    this.sky.mesh.position.set(this.camera.position.x, 0, this.camera.position.z);
    this.sky.mesh.updateMatrix();

    this.hudTimer += dt;
    if (this.hudTimer > 0.1) {
      this.hudTimer = 0;
      this.onFrame({
        km: this.distance / 1000,
        city: region.city,
        state: region.state,
        kmh: BASE_SPEED * drive * this.brake * 3.6 * active,
      });
    }
  }

  private updateWorld(move: number) {
    if (move === 0) return;

    for (const tile of this.tiles) {
      tile.position.z += move;
      if (tile.position.z > 25 + TILE_LEN / 2) tile.position.z -= SPAN;
    }

    const region = regionAt(this.distance);

    for (const s of this.scatter) {
      s.obj.position.z += move;
      if (s.obj.position.z > Z_BEHIND + 20) {
        s.obj.position.z -= SPAN + rand(0, 12);
        s.place(region);
      }
    }

    for (const arr of [this.lamps, this.poles, this.stones]) {
      const span =
        arr === this.stones ? SPAN : Math.ceil(SPAN / LANE_SPACING) * LANE_SPACING;
      for (const o of arr) {
        o.position.z += move;
        if (o.position.z > 25 + LANE_SPACING / 2) o.position.z -= span;
      }
    }

    // Ridges and clouds sit at effectively infinite distance, so they only
    // parallax sideways instead of scrolling with the road.
    for (const layer of this.ridgeLayers) {
      layer.group.position.x -= move * layer.speed;
      if (layer.group.position.x < -layer.width) {
        layer.group.position.x += layer.width;
      }
    }

    for (const c of this.clouds) {
      c.group.position.x -= move * 0.05;
      if (c.group.position.x < -900) {
        c.group.position.x = 900;
        c.group.position.y = rand(24, 72);
        c.prop.randomize();
      }
    }
  }

  private updateTraffic(move: number, cruise: number, dt: number) {
    for (const t of this.traffic) {
      // Each vehicle travels its own distance; what shows on screen is the
      // difference between that and the hero's.
      const travelled = cruise * t.speedFrac;
      t.pivot.position.z += move - travelled;

      // Wheels turn at the vehicle's own ground speed, not the closing speed.
      t.spin += travelled / 0.38;
      for (const w of t.body.wheels) w.rotation.x = t.spin;

      // Ease into the lane centre so the fallback placement never snaps.
      t.pivot.position.x = damp(t.pivot.position.x, LANES[t.lane], 0.25, dt);

      if (t.pivot.position.z > Z_BEHIND + 12 || t.pivot.position.z < -SPAN) {
        this.respawnTraffic(t);
      }
    }
  }

  private updateHero(move: number, dt: number) {
    // Cap the sideways speed so the car can never snap across the road.
    const rate = this.driveRate();
    const maxLateral = this.maxLateral();
    const dx = clamp(this.targetX - this.carX, -maxLateral * dt, maxLateral * dt);
    this.prevCarX = this.carX;
    this.carX += dx;

    this.heroPivot.position.x = this.carX;

    // A gentle bob, so the car never looks welded to the tarmac.
    const bob = Math.sin(this.elapsed * 6.1) * 0.012 + Math.sin(this.elapsed * 9.7) * 0.006;
    this.heroPivot.position.y = bob * (0.4 + rate * 0.6);

    // Lean comes from the actual sideways velocity, never from the gap to the
    // target. Deriving it from the gap makes a two lane jump flip the car.
    const vx = dt > 0 ? (this.carX - this.prevCarX) / dt : 0;
    const targetLean = clamp(-vx * 0.055, -0.3, 0.3);
    const targetYaw = clamp(-vx * 0.045, -0.14, 0.14);
    this.lean = damp(this.lean, targetLean, 0.08, dt);
    this.yaw = damp(this.yaw, targetYaw, 0.07, dt);
    this.heroPivot.rotation.z = this.lean;
    this.heroPivot.rotation.y = this.yaw;

    // Front wheels point where the car is actually heading.
    this.steer = damp(this.steer, clamp(-vx * 0.16, -0.42, 0.42), 0.06, dt);
    for (const w of this.hero.steerWheels) w.rotation.y = -this.steer;

    this.wheelSpin += move / 0.42;
    for (const w of this.hero.wheels) w.rotation.x = this.wheelSpin;

    // Brake lamps brighten when the road ahead forces a slow down.
    const braking = this.brake < 0.93 ? 1 : 0;
    this.hero.brakeLights.emissiveIntensity = damp(
      this.hero.brakeLights.emissiveIntensity,
      braking ? 9 : 3.6,
      0.08,
      dt,
    );
  }

  private updateSmoke(move: number, dt: number) {
    // Spawn rate follows speed: standing still, the car stops kicking up dust.
    this.smokeTimer -= dt;
    const rate = 0.055 / Math.max(0.15, this.driveRate() * this.brake);
    if (move > 0 && this.smokeTimer <= 0) {
      this.smokeTimer = rate;
      for (const side of [-1, 1]) {
        const p = this.puffs[this.puffCursor];
        this.puffCursor = (this.puffCursor + 1) % this.puffs.length;
        p.life = 0;
        p.ttl = rand(0.85, 1.35);
        p.vy = rand(0.55, 1.25);
        p.vx = side * rand(0.25, 0.8);
        p.size = rand(0.34, 0.6);
        p.sprite.visible = true;
        p.sprite.position.set(
          this.carX + side * 0.86 + rand(-0.1, 0.1),
          0.22,
          -1.35 + rand(-0.2, 0.2),
        );
        p.sprite.scale.setScalar(p.size);
        p.sprite.material.opacity = 0.28;
      }
    }

    for (const p of this.puffs) {
      if (!p.sprite.visible) continue;
      p.life += dt;
      const t = p.life / p.ttl;
      if (t >= 1) {
        p.sprite.visible = false;
        p.sprite.material.opacity = 0;
        continue;
      }
      // Drift with the world so the dust stays on the road behind the car.
      p.sprite.position.z += move;
      p.sprite.position.y += p.vy * dt;
      p.sprite.position.x += p.vx * dt;
      p.sprite.scale.setScalar(p.size * (1 + t * 2.2));
      p.sprite.material.opacity = 0.26 * (1 - t) * (1 - t);
    }
  }

  private updateRegion(dt: number) {
    const { from, to, t } = regionBlend(this.distance);

    mixHex(from.ground, to.ground, t, this.tmpColor);
    this.groundColor.lerp(this.tmpColor, 1 - Math.exp(-dt * 0.9));
    this.groundMaterial.color.copy(this.groundColor);

    mixHex(from.haze, to.haze, t, this.tmpColor);
    this.hazeColor.lerp(this.tmpColor, 1 - Math.exp(-dt * 0.9));
    this.fog.color.copy(this.hazeColor);
    (this.sky.material.uniforms.uHaze.value as THREE.Color).copy(this.hazeColor);

    mixHex(from.sun, to.sun, t, this.tmpColor);
    this.sunColor.lerp(this.tmpColor, 1 - Math.exp(-dt * 0.9));
    this.sun.color.copy(this.sunColor);
    (this.sky.material.uniforms.uSunColor.value as THREE.Color)
      .copy(this.sunColor)
      .multiplyScalar(1.25);

    // Ridges take their colour from the haze so they read as distant rock.
    const hillTarget = from.hills + (to.hills - from.hills) * t;
    this.hills = damp(this.hills, hillTarget, 1.4, dt);
    for (const layer of this.ridgeLayers) {
      layer.group.scale.y = layer.base * (0.30 + this.hills * 0.9);
      layer.mat.color
        .set("#6d7f86")
        .lerp(this.hazeColor, layer.mat.userData.tint as number);
    }
  }

  private updateCamera(dt: number) {
    // The camera trails the car sideways but never changes height, so the
    // framing stays consistent no matter how hard the car is dodging.
    this.camX = damp(this.camX, this.carX * 0.42, 0.22, dt);

    // A slow breathing motion, small enough to feel rather than see.
    const sway = Math.sin(this.elapsed * 0.31) * 0.22;
    const rise = Math.sin(this.elapsed * 0.23 + 1.1) * 0.16;

    this.camera.position.set(this.camX + sway, CAM_Y + rise, CAM_Z);
    this.camera.lookAt(this.carX * 0.55, LOOK_Y, LOOK_Z);

    // Keep the shadow frustum walking with the car so it stays crisp.
    this.sun.target.position.set(this.carX * 0.5, 0, -30);
    this.sun.position
      .copy(SUN_DIR)
      .multiplyScalar(120)
      .add(this.sun.target.position);
    this.sun.target.updateMatrixWorld();
  }
}
