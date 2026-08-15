/**
 * Original instrumental loops, generated entirely with the Web Audio API.
 * Nothing here is recorded, so there is no sample licensing to worry about
 * and the whole soundtrack costs a few hundred bytes of data.
 */

export type Track = {
  name: string;
  mood: string;
  /** Root note in Hz. */
  tonic: number;
  /** Semitone offsets from the tonic. */
  scale: number[];
  bpm: number;
  wave: OscillatorType;
  hats: boolean;
  /** Sixteen step melody, as scale degrees. A null is a rest. */
  pattern: (number | null)[];
  /** Chord degrees played by the pad, one chord per bar. */
  chords: number[][];
  /** Slight character tweaks per track. */
  pluckDecay: number;
  padLevel: number;
};

export const TRACKS: Track[] = [
  {
    name: "Golden Highway",
    mood: "Warm and uplifting",
    tonic: 220, // A3
    scale: [0, 2, 4, 7, 9, 12, 14, 16], // major pentatonic
    bpm: 96,
    wave: "triangle",
    hats: false,
    pattern: [0, null, 2, 3, null, 2, 4, null, 3, null, 2, 0, null, 1, 2, null],
    chords: [
      [0, 4, 7],
      [5, 9, 12],
      [-3, 2, 5],
      [2, 5, 9],
    ],
    pluckDecay: 0.5,
    padLevel: 0.16,
  },
  {
    name: "Desert Groove",
    mood: "Rhythmic and dusk lit",
    tonic: 196, // G3
    scale: [0, 1, 4, 5, 7, 8, 11, 12], // a raga-leaning minor colour
    bpm: 116,
    wave: "sawtooth",
    hats: true,
    pattern: [0, 2, null, 3, 4, null, 3, 2, 5, null, 4, 3, 2, null, 1, 0],
    chords: [
      [0, 3, 7],
      [0, 3, 7],
      [-2, 3, 5],
      [-4, 3, 8],
    ],
    pluckDecay: 0.32,
    padLevel: 0.13,
  },
  {
    name: "Monsoon Lofi",
    mood: "Mellow and rainy",
    tonic: 174.61, // F3
    scale: [0, 3, 5, 7, 10, 12, 15, 17], // minor pentatonic
    bpm: 74,
    wave: "sine",
    hats: false,
    pattern: [0, null, null, 2, null, 3, null, null, 4, null, 3, null, 2, null, 1, null],
    chords: [
      [0, 3, 7, 10],
      [-2, 5, 8, 12],
      [-4, 3, 7, 10],
      [-2, 2, 7, 9],
    ],
    pluckDecay: 0.7,
    padLevel: 0.2,
  },
  {
    name: "Coastal Dusk",
    mood: "Breezy and calm",
    tonic: 261.63, // C4
    scale: [0, 2, 4, 5, 7, 9, 11, 12], // major
    bpm: 100,
    wave: "triangle",
    hats: true,
    pattern: [0, null, 4, null, 2, 4, null, 5, 4, null, 2, null, 1, 2, null, 0],
    chords: [
      [0, 4, 7, 11],
      [-3, 2, 5, 9],
      [-5, 0, 4, 7],
      [-1, 2, 7, 9],
    ],
    pluckDecay: 0.42,
    padLevel: 0.15,
  },
];

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD = 0.12;

export class MusicPlayer {
  private ctx: AudioContext;
  private out: GainNode;
  private bus: GainNode;
  private reverb: ConvolverNode | null = null;
  private wet: GainNode;

  private timer: number | null = null;
  private step = 0;
  private nextTime = 0;

  private index = 0;
  private playing = false;
  private muted = false;
  private volume = 0.55;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;

    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(ctx.destination);

    this.bus = ctx.createGain();
    this.bus.gain.value = 1;
    this.bus.connect(this.out);

    // A short synthesised plate, which is what stops the loops from sounding
    // like a ringtone.
    this.wet = ctx.createGain();
    this.wet.gain.value = 0.3;
    this.wet.connect(this.out);
    try {
      this.reverb = ctx.createConvolver();
      this.reverb.buffer = this.makeImpulse(2.1, 2.6);
      this.bus.connect(this.reverb);
      this.reverb.connect(this.wet);
    } catch {
      this.reverb = null;
    }
  }

  private makeImpulse(seconds: number, decay: number) {
    const rate = this.ctx.sampleRate;
    const len = Math.max(1, Math.floor(rate * seconds));
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
      }
    }
    return buf;
  }

  get track() {
    return TRACKS[this.index] ?? TRACKS[0];
  }

  get trackIndex() {
    return this.index;
  }

  get isPlaying() {
    return this.playing;
  }

  get isMuted() {
    return this.muted;
  }

  setMuted(m: boolean) {
    this.muted = m;
    this.applyGain();
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    this.applyGain();
  }

  private applyGain() {
    const target = this.playing && !this.muted ? this.volume : 0;
    const now = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.setTargetAtTime(target, now, 0.12);
  }

  play() {
    if (this.playing) return;
    this.playing = true;
    this.nextTime = this.ctx.currentTime + 0.08;
    this.applyGain();
    if (this.timer === null) {
      this.timer = window.setInterval(this.schedule, LOOKAHEAD_MS);
    }
  }

  pause() {
    if (!this.playing) return;
    this.playing = false;
    this.applyGain();
    // The scheduler keeps running briefly so the fade out is not cut off.
    window.setTimeout(() => {
      if (!this.playing && this.timer !== null) {
        window.clearInterval(this.timer);
        this.timer = null;
      }
    }, 400);
  }

  toggle() {
    if (this.playing) this.pause();
    else this.play();
  }

  setTrack(i: number) {
    const next = ((i % TRACKS.length) + TRACKS.length) % TRACKS.length;
    if (next === this.index) return;
    this.index = next;
    this.step = 0;
    this.nextTime = Math.max(this.nextTime, this.ctx.currentTime + 0.05);
  }

  next() {
    this.setTrack(this.index + 1);
  }

  prev() {
    this.setTrack(this.index - 1);
  }

  /* -------------------------------------------------------------- *
   * Lookahead scheduler. A timer wakes up often and queues any note
   * that falls inside the next slice of audio clock time, which keeps
   * the timing rock solid even when the main thread is busy.
   * -------------------------------------------------------------- */

  private schedule = () => {
    if (!this.playing) return;
    const t = this.track;
    const stepDur = 60 / t.bpm / 4;

    while (this.nextTime < this.ctx.currentTime + SCHEDULE_AHEAD) {
      this.playStep(this.step, this.nextTime, t, stepDur);
      this.nextTime += stepDur;
      this.step = (this.step + 1) % 64; // four bars
    }
  };

  private freq(t: Track, degree: number, octave = 0) {
    const len = t.scale.length;
    let d = degree;
    let oct = octave;
    while (d < 0) {
      d += len;
      oct -= 1;
    }
    while (d >= len) {
      d -= len;
      oct += 1;
    }
    const semis = t.scale[d] + oct * 12;
    return t.tonic * Math.pow(2, semis / 12);
  }

  private semis(t: Track, offset: number) {
    return t.tonic * Math.pow(2, offset / 12);
  }

  private playStep(step: number, time: number, t: Track, stepDur: number) {
    const inBar = step % 16;
    const bar = Math.floor(step / 16) % 4;

    // Melody pluck.
    const deg = t.pattern[inBar];
    if (deg !== null && deg !== undefined) {
      this.pluck(this.freq(t, deg, 1), time, t.pluckDecay, t.wave, 0.15);
      // A soft octave shadow gives the line some body.
      if (inBar % 4 === 0) {
        this.pluck(this.freq(t, deg, 2), time, t.pluckDecay * 0.6, "sine", 0.05);
      }
    }

    // Bass on the main beats.
    if (inBar % 4 === 0) {
      const root = t.chords[bar]?.[0] ?? 0;
      this.bass(this.semis(t, root - 12), time, stepDur * 3.4);
    }
    if (inBar === 10) {
      const root = t.chords[bar]?.[0] ?? 0;
      this.bass(this.semis(t, root - 12 + 7), time, stepDur * 1.6, 0.6);
    }

    // Pad chord once per bar.
    if (inBar === 0) {
      const chord = t.chords[bar] ?? [0, 4, 7];
      for (const c of chord) {
        this.pad(this.semis(t, c), time, stepDur * 15, t.padLevel / chord.length);
      }
    }

    // Kick and a light hand drum figure, which is what makes it move.
    if (inBar === 0 || inBar === 6 || inBar === 10) this.kick(time);
    if (inBar === 4 || inBar === 12) this.tabla(time, 1);
    if (inBar === 7 || inBar === 14) this.tabla(time, 0.6);

    if (t.hats && inBar % 2 === 1) {
      this.hat(time, inBar % 4 === 3 ? 0.05 : 0.028);
    }
  }

  private pluck(
    freq: number,
    time: number,
    decay: number,
    wave: OscillatorType,
    level: number,
  ) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = wave;
    osc.frequency.value = freq;

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(Math.min(7000, freq * 9), time);
    filter.frequency.exponentialRampToValueAtTime(Math.max(220, freq * 2), time + decay);
    filter.Q.value = 1.4;

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(level, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + decay);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.bus);

    osc.start(time);
    osc.stop(time + decay + 0.05);
  }

  private bass(freq: number, time: number, dur: number, level = 1) {
    const osc = this.ctx.createOscillator();
    const sub = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = "triangle";
    osc.frequency.value = freq;
    sub.type = "sine";
    sub.frequency.value = freq / 2;

    filter.type = "lowpass";
    filter.frequency.value = 460;

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.2 * level, time + 0.02);
    gain.gain.setTargetAtTime(0.0001, time + dur * 0.55, 0.16);

    osc.connect(filter);
    sub.connect(filter);
    filter.connect(gain);
    gain.connect(this.bus);

    osc.start(time);
    sub.start(time);
    osc.stop(time + dur + 0.3);
    sub.stop(time + dur + 0.3);
  }

  private pad(freq: number, time: number, dur: number, level: number) {
    const a = this.ctx.createOscillator();
    const b = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    a.type = "sine";
    b.type = "triangle";
    a.frequency.value = freq;
    b.frequency.value = freq;
    b.detune.value = 7;

    filter.type = "lowpass";
    filter.frequency.value = 1500;

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(level, time + dur * 0.28);
    gain.gain.setTargetAtTime(0.0001, time + dur * 0.62, dur * 0.2);

    a.connect(filter);
    b.connect(filter);
    filter.connect(gain);
    gain.connect(this.bus);

    a.start(time);
    b.start(time);
    a.stop(time + dur + 0.4);
    b.stop(time + dur + 0.4);
  }

  private kick(time: number) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.14);
    gain.gain.setValueAtTime(0.24, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.24);
    osc.connect(gain);
    // Percussion goes straight out, so the reverb does not smear the pulse.
    gain.connect(this.out);
    osc.start(time);
    osc.stop(time + 0.3);
  }

  /** A short pitched drum hit, in the spirit of a tabla stroke. */
  private tabla(time: number, level: number) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    osc.type = "sine";
    osc.frequency.setValueAtTime(320, time);
    osc.frequency.exponentialRampToValueAtTime(180, time + 0.09);
    filter.type = "bandpass";
    filter.frequency.value = 620;
    filter.Q.value = 3;
    gain.gain.setValueAtTime(0.14 * level, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.16);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.bus);
    osc.start(time);
    osc.stop(time + 0.2);
  }

  private hat(time: number, level: number) {
    const len = Math.floor(this.ctx.sampleRate * 0.05);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 7200;
    const gain = this.ctx.createGain();
    gain.gain.value = level;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.out);
    src.start(time);
  }

  dispose() {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    this.playing = false;
    try {
      this.out.disconnect();
    } catch {
      /* already torn down */
    }
  }
}
