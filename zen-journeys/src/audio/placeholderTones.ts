/*
  Placeholder music, synthesised in code.

  The playlists ship with no audio files, because no classic Indian recording
  can be bundled here legally. Rather than wire the player to silence — which
  would make crossfade, seek and auto advance impossible to see working — each
  placeholder track is rendered here into a real WAV: a slow, tonic-drone pad
  in a raga-like scale, deterministic per track id, so a given song always
  sounds like itself.

  The moment a track gets a real `src` in `config/playlists.ts`, none of this
  runs for it.
*/

const SAMPLE_RATE = 22_050;
const DURATION_SECONDS = 52;
/** Rendered in slices this long so a long render never blocks a frame. */
const SLICE_SECONDS = 2;
const CACHE_LIMIT = 6;

/** Scale degrees in semitones, loosely after Bhupali, Malkauns, Yaman, Kafi. */
const SCALES = [
  [0, 2, 4, 7, 9],
  [0, 3, 5, 8, 10],
  [0, 2, 4, 6, 7, 9, 11],
  [0, 2, 3, 5, 7, 9, 10],
  [0, 1, 4, 5, 7, 8, 11],
];

/** Small, fast, seeded PRNG so a track id maps to one fixed rendering. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

interface Voice {
  freq: number;
  start: number;
  end: number;
  gain: number;
  /** Fraction of the note spent easing in, and easing out. */
  attack: number;
  release: number;
}

/** Lay out the drone and the slow melody before rendering a single sample. */
function composition(seed: number): { voices: Voice[]; root: number } {
  const rand = mulberry32(seed);
  const scale = SCALES[Math.floor(rand() * SCALES.length)];
  const root = 128 + Math.floor(rand() * 8) * 7.5; // ~128-180 Hz
  const voices: Voice[] = [];

  // Tanpura-like bed: tonic, fifth, octave, held for the whole piece.
  for (const [ratio, gain] of [
    [0.5, 0.16],
    [1, 0.13],
    [1.5, 0.085],
    [2, 0.05],
  ]) {
    voices.push({
      freq: root * ratio,
      start: 0,
      end: DURATION_SECONDS,
      gain,
      attack: 0.12,
      release: 0.25,
    });
  }

  // A slow melody that overlaps itself, so notes always bleed into each other.
  let at = rand() * 2;
  while (at < DURATION_SECONDS - 4) {
    const length = 3.5 + rand() * 3.5;
    const degree = scale[Math.floor(rand() * scale.length)];
    const octave = rand() < 0.3 ? 2 : 1;
    const freq = root * octave * Math.pow(2, degree / 12);
    voices.push({
      freq,
      start: at,
      end: Math.min(at + length, DURATION_SECONDS),
      gain: 0.075 + rand() * 0.04,
      attack: 0.35,
      release: 0.55,
    });
    // Overlap the next entry with the tail of this one.
    at += length * (0.45 + rand() * 0.3);
  }

  return { voices, root };
}

/** Raised-cosine envelope: no clicks at either end of a note. */
function envelope(t: number, voice: Voice): number {
  const length = voice.end - voice.start;
  const local = t - voice.start;
  if (local < 0 || local > length) return 0;
  const attack = length * voice.attack;
  const release = length * voice.release;
  if (local < attack) return 0.5 - 0.5 * Math.cos((Math.PI * local) / attack);
  const fromEnd = length - local;
  if (fromEnd < release) return 0.5 - 0.5 * Math.cos((Math.PI * fromEnd) / release);
  return 1;
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVEfmt ");
  view.setUint32(16, 16, true); // PCM header length
  view.setUint16(20, 1, true); // format: PCM
  view.setUint16(22, 1, true); // channels: mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, clamped * 32767, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

const nextFrame = () =>
  new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 0);
  });

async function render(seed: number): Promise<Blob> {
  const total = SAMPLE_RATE * DURATION_SECONDS;
  const samples = new Float32Array(total);
  const { voices } = composition(seed);

  // One-pole lowpass, to take the glare off the tone.
  let lowpass = 0;
  const lowpassCoefficient = 0.22;

  const sliceLength = SAMPLE_RATE * SLICE_SECONDS;
  for (let offset = 0; offset < total; offset += sliceLength) {
    const end = Math.min(offset + sliceLength, total);
    for (let i = offset; i < end; i++) {
      const time = i / SAMPLE_RATE;
      let value = 0;
      for (const voice of voices) {
        if (time < voice.start || time > voice.end) continue;
        const amplitude = envelope(time, voice) * voice.gain;
        if (amplitude <= 0) continue;
        const phase = 2 * Math.PI * voice.freq * time;
        // Fundamental plus a whisper of the second and third partials.
        value +=
          amplitude *
          (Math.sin(phase) + 0.16 * Math.sin(phase * 2) + 0.07 * Math.sin(phase * 3));
      }
      // Slow breathing, ~14 second cycle.
      value *= 0.85 + 0.15 * Math.sin((2 * Math.PI * time) / 14);
      lowpass += lowpassCoefficient * (value - lowpass);
      samples[i] = lowpass;
    }
    if (end < total) await nextFrame();
  }

  // A short feedback delay for air. Applied in place, cheaply.
  const delay = Math.floor(SAMPLE_RATE * 0.37);
  for (let i = delay; i < total; i++) samples[i] += samples[i - delay] * 0.3;

  // Fade the very edges so looping or stopping never clicks.
  const edge = SAMPLE_RATE * 2;
  for (let i = 0; i < edge; i++) {
    const gain = 0.5 - 0.5 * Math.cos((Math.PI * i) / edge);
    samples[i] *= gain;
    samples[total - 1 - i] *= gain;
  }

  return encodeWav(samples, SAMPLE_RATE);
}

const cache = new Map<string, string>();
const pending = new Map<string, Promise<string>>();

/**
 * A blob URL of synthesised audio for a track that has no licensed file yet.
 * Repeated calls for the same track return the same URL.
 */
export function placeholderTrackUrl(trackId: string): Promise<string> {
  const cached = cache.get(trackId);
  if (cached) return Promise.resolve(cached);

  const inFlight = pending.get(trackId);
  if (inFlight) return inFlight;

  const job = render(hashString(trackId))
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      cache.set(trackId, url);
      // Keep only the most recent handful; blob URLs hold memory until revoked.
      while (cache.size > CACHE_LIMIT) {
        const oldest = cache.keys().next().value as string | undefined;
        if (oldest === undefined) break;
        const stale = cache.get(oldest);
        if (stale) URL.revokeObjectURL(stale);
        cache.delete(oldest);
      }
      return url;
    })
    .finally(() => pending.delete(trackId));

  pending.set(trackId, job);
  return job;
}

/** Release every synthesised clip. Called when the app tears an engine down. */
export function releasePlaceholderTracks(): void {
  for (const url of cache.values()) URL.revokeObjectURL(url);
  cache.clear();
}
