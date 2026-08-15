import * as THREE from "three";

/**
 * A shader sky dome rather than a flat CSS gradient. It gives a real horizon,
 * a sun disc that the bloom pass can catch, and drifting cirrus, and it is
 * also what the environment map is baked from, so the car's paint and chrome
 * reflect the same sky you can see.
 */

const VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;

varying vec3 vDir;

uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uHaze;
uniform vec3 uSunColor;
uniform vec3 uSunDir;
uniform float uTime;
uniform float uCloud;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p *= 2.02;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec3 dir = normalize(vDir);
  float h = dir.y;

  // Vertical gradient from the horizon up to the zenith.
  float t = clamp(h, 0.0, 1.0);
  vec3 col = mix(uHorizon, uZenith, pow(t, 0.55));

  // Warm haze packed against the horizon line. Tight, so the band of sky the
  // chase camera actually shows still has colour in it rather than reading as
  // one flat wash.
  float haze = exp(-max(h, 0.0) * 13.0);
  col = mix(col, uHaze, haze * 0.84);

  // A second, wider warm lift keeps the transition from haze to blue smooth.
  float lift = exp(-max(h, 0.0) * 4.5);
  col = mix(col, uHaze * 0.96, lift * 0.20);

  // Below the horizon the dome fades into the same haze as the fog, so the
  // ground plane and the sky meet without a seam.
  if (h < 0.0) {
    col = mix(col, uHaze * 0.97, clamp(-h * 5.0, 0.0, 1.0));
  }

  // Cirrus, stretched by the inverse height so it lies flat like real cloud.
  float above = smoothstep(0.008, 0.20, h);
  if (above > 0.001) {
    vec2 cp = dir.xz / (abs(h) + 0.14);
    cp *= 0.55;
    cp += vec2(uTime * 0.004, uTime * 0.0016);
    float c = fbm(cp * 1.7);
    c = smoothstep(0.52, 0.92, c);
    float c2 = smoothstep(0.60, 1.0, fbm(cp * 3.4 + 11.0));
    float amount = clamp(c * 0.75 + c2 * 0.4, 0.0, 1.0) * above * uCloud;
    vec3 cloudCol = mix(vec3(1.02, 0.97, 0.92), uHaze * 1.15, haze);
    col = mix(col, cloudCol, amount * 0.72);
  }

  // Sun: a tight disc plus three falloffs for the atmospheric bloom around it.
  vec3 sd = normalize(uSunDir);
  float d = max(dot(dir, sd), 0.0);
  float disc = smoothstep(0.99955, 0.99985, d);
  float glow =
    pow(d, 900.0) * 0.9 +
    pow(d, 120.0) * 0.22 +
    pow(d, 16.0) * 0.09 +
    pow(d, 4.0) * 0.035;
  col += uSunColor * (glow + disc * 7.0);

  gl_FragColor = vec4(col, 1.0);
}
`;

export type Sky = {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  setSun: (dir: THREE.Vector3) => void;
};

export function makeSky(): Sky {
  const geo = new THREE.SphereGeometry(1, 48, 32);
  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    toneMapped: true,
    uniforms: {
      uZenith: { value: new THREE.Color("#2f74c9") },
      uHorizon: { value: new THREE.Color("#7cb6e0") },
      uHaze: { value: new THREE.Color("#ffcf9a") },
      uSunColor: { value: new THREE.Color("#ffd9a0").multiplyScalar(1.25) },
      uSunDir: { value: new THREE.Vector3(-0.5, 0.20, -0.84).normalize() },
      uTime: { value: 0 },
      uCloud: { value: 0.85 },
    },
  });

  const mesh = new THREE.Mesh(geo, material);
  mesh.scale.setScalar(1400);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();

  return {
    mesh,
    material,
    setSun: (dir) => {
      (material.uniforms.uSunDir.value as THREE.Vector3).copy(dir).normalize();
    },
  };
}

/**
 * Bake the sky into a prefiltered environment map. Done once at start up: the
 * reflections it gives the car paint and chrome are the single biggest step
 * from "coloured plastic" to "painted metal".
 */
export function bakeEnvironment(
  renderer: THREE.WebGLRenderer,
  sky: Sky,
): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const scene = new THREE.Scene();
  const clone = new THREE.Mesh(sky.mesh.geometry, sky.material.clone());
  clone.scale.setScalar(100);
  clone.frustumCulled = false;
  scene.add(clone);

  // A dull ground disc so the lower hemisphere is not pitch black, which is
  // what makes reflections in the lower body panels look right.
  const ground = new THREE.Mesh(
    new THREE.SphereGeometry(99, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color("#9a8560"),
      side: THREE.BackSide,
    }),
  );
  scene.add(ground);

  const target = pmrem.fromScene(scene, 0, 1, 400);

  // The geometry is shared with the live sky dome, so only the clone's
  // material and the helper ground are disposed here.
  (clone.material as THREE.Material).dispose();
  ground.geometry.dispose();
  (ground.material as THREE.Material).dispose();
  pmrem.dispose();

  return target.texture;
}
