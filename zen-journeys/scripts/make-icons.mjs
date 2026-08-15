/*
  Generates the app icons.

  A tiny PNG encoder rather than a build dependency: the artwork is a handful
  of gradients, and pulling in an image library to draw four circles would be
  the wrong trade. Run with `npm run icons` after changing the design.
*/

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "public", "icons");

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(width, height, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // colour type: RGBA
  // Each scanline is prefixed with its filter byte; filter 0 is "none".
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const start = y * (width * 4 + 1);
    raw[start] = 0;
    rgba.copy(raw, start + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** The same drawing as the SVG below, rasterised by hand. */
function draw(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const set = (x, y, r, g, b, a = 255) => {
    const i = (y * size + x) * 4;
    // Source-over, so the layers below show through the soft edges.
    const alpha = a / 255;
    pixels[i] = Math.round(pixels[i] * (1 - alpha) + r * alpha);
    pixels[i + 1] = Math.round(pixels[i + 1] * (1 - alpha) + g * alpha);
    pixels[i + 2] = Math.round(pixels[i + 2] * (1 - alpha) + b * alpha);
    pixels[i + 3] = 255;
  };

  const centre = size / 2;
  // A planet limb low in the frame, with its atmosphere lit above it.
  const planetY = size * 1.16;
  const planetR = size * 0.78;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Ground: a very dark indigo, lifting slightly towards the top left.
      const lift = 1 - (x / size) * 0.3 - (y / size) * 0.2;
      set(x, y, Math.round(10 * lift), Math.round(9 * lift), Math.round(18 * lift));

      const dx = x - centre;
      const dy = y - planetY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < planetR) {
        // Inside the planet: a blue that deepens away from the edge.
        const depth = (planetR - distance) / planetR;
        set(
          x,
          y,
          Math.round(70 - depth * 60),
          Math.round(110 - depth * 90),
          Math.round(170 - depth * 130),
        );
      }

      // Atmospheric rim, a few pixels of glow either side of the limb.
      const rim = Math.abs(distance - planetR);
      const rimWidth = size * 0.035;
      if (rim < rimWidth) {
        const strength = (1 - rim / rimWidth) ** 2;
        set(x, y, 150, 205, 255, Math.round(strength * 235));
      }
    }
  }

  // A scatter of fixed stars, so every build produces the same icon.
  const stars = [
    [0.18, 0.16, 1.6],
    [0.32, 0.3, 1],
    [0.52, 0.12, 2.1],
    [0.71, 0.24, 1.3],
    [0.84, 0.14, 1],
    [0.24, 0.44, 1.1],
    [0.63, 0.4, 1.5],
    [0.88, 0.38, 1],
  ];
  for (const [sx, sy, weight] of stars) {
    const px = Math.round(sx * size);
    const py = Math.round(sy * size);
    const radius = Math.max(1, Math.round((weight * size) / 190));
    for (let y = py - radius; y <= py + radius; y++) {
      for (let x = px - radius; x <= px + radius; x++) {
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const d = Math.hypot(x - px, y - py) / radius;
        if (d > 1) continue;
        set(x, y, 235, 238, 255, Math.round((1 - d) * 255));
      }
    }
  }

  return pixels;
}

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="planet" cx="50%" cy="116%" r="78%">
      <stop offset="70%" stop-color="#0a1930"/>
      <stop offset="100%" stop-color="#4a7bb0"/>
    </radialGradient>
    <linearGradient id="rim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#96cdff" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#5a96e6" stop-opacity="0.2"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="#08070b"/>
  <circle cx="256" cy="594" r="399" fill="url(#planet)"/>
  <circle cx="256" cy="594" r="399" fill="none" stroke="url(#rim)" stroke-width="9"/>
  <g fill="#ebeeff">
    <circle cx="92" cy="82" r="4.3"/><circle cx="164" cy="154" r="2.7"/>
    <circle cx="266" cy="61" r="5.6"/><circle cx="363" cy="123" r="3.5"/>
    <circle cx="430" cy="72" r="2.7"/><circle cx="123" cy="225" r="3"/>
    <circle cx="322" cy="205" r="4"/><circle cx="451" cy="195" r="2.7"/>
  </g>
</svg>
`;

mkdirSync(outDir, { recursive: true });
for (const size of [192, 512]) {
  writeFileSync(join(outDir, `icon-${size}.png`), encodePng(size, size, draw(size)));
}
writeFileSync(join(outDir, "icon.svg"), SVG);
console.log(`icons written to ${outDir}`);
