/**
 * Engine and horn. Kept separate from the music so the two mute buttons are
 * genuinely independent.
 */
export class Sfx {
  private ctx: AudioContext;
  private out: GainNode;

  private engineGain: GainNode;
  private oscA: OscillatorNode;
  private oscB: OscillatorNode;
  private engineFilter: BiquadFilterNode;
  private windFilter: BiquadFilterNode;

  private windGain: GainNode;
  private windSource: AudioBufferSourceNode | null = null;

  private muted = false;
  private started = false;
  private speed = 1;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;

    this.out = ctx.createGain();
    this.out.gain.value = 0.9;
    this.out.connect(ctx.destination);

    // Two slightly detuned low oscillators through a low pass: the beating
    // between them is what makes it read as a running engine rather than a
    // held tone.
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = "lowpass";
    this.engineFilter.frequency.value = 320;
    this.engineFilter.Q.value = 4.5;

    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;

    this.oscA = ctx.createOscillator();
    this.oscA.type = "sawtooth";
    this.oscA.frequency.value = 62;

    this.oscB = ctx.createOscillator();
    this.oscB.type = "square";
    this.oscB.frequency.value = 62;
    this.oscB.detune.value = -14;

    const shaper = ctx.createWaveShaper();
    shaper.curve = this.softClip();
    shaper.oversample = "2x";

    this.oscA.connect(this.engineFilter);
    this.oscB.connect(this.engineFilter);
    this.engineFilter.connect(shaper);
    shaper.connect(this.engineGain);
    this.engineGain.connect(this.out);

    // Filtered noise for tyre roar and wind.
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = "bandpass";
    windFilter.frequency.value = 700;
    windFilter.Q.value = 0.7;
    windFilter.connect(this.windGain);
    this.windGain.connect(this.out);
    this.windFilter = windFilter;
  }

  private softClip() {
    const n = 1024;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * 1.9);
    }
    return curve;
  }

  /** Must be called from a user gesture, because browsers block audio first. */
  start() {
    if (this.started) return;
    this.started = true;
    const now = this.ctx.currentTime;

    this.oscA.start(now);
    this.oscB.start(now);

    const len = Math.floor(this.ctx.sampleRate * 2);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(this.windFilter);
    src.start(now);
    this.windSource = src;

    this.applyLevels();
  }

  setMuted(m: boolean) {
    this.muted = m;
    this.applyLevels();
  }

  get isMuted() {
    return this.muted;
  }

  /** `mul` is the speed multiplier the drive is currently running at. */
  setSpeed(mul: number) {
    this.speed = Math.max(0, mul);
    if (!this.started) return;
    const now = this.ctx.currentTime;
    const rpm = 48 + this.speed * 46;
    this.oscA.frequency.setTargetAtTime(rpm, now, 0.25);
    this.oscB.frequency.setTargetAtTime(rpm * 1.005, now, 0.25);
    this.engineFilter.frequency.setTargetAtTime(220 + this.speed * 300, now, 0.3);
    this.windFilter.frequency.setTargetAtTime(520 + this.speed * 720, now, 0.3);
    this.applyLevels();
  }

  private applyLevels() {
    if (!this.started) return;
    const now = this.ctx.currentTime;
    const on = this.muted ? 0 : 1;
    this.engineGain.gain.setTargetAtTime(
      on * (0.045 + Math.min(1.4, this.speed) * 0.07),
      now,
      0.2,
    );
    this.windGain.gain.setTargetAtTime(
      on * (0.006 + Math.min(1.4, this.speed) * 0.02),
      now,
      0.2,
    );
  }

  /** A cheerful two tone "pom poooom". */
  horn() {
    if (this.muted || !this.started) return;
    const now = this.ctx.currentTime;
    this.blast(now, 392, 0.18);
    this.blast(now + 0.2, 523.25, 0.42);
  }

  private blast(time: number, freq: number, dur: number) {
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 2600;

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.16, time + 0.02);
    gain.gain.setValueAtTime(0.16, time + dur - 0.06);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    // Three partials, which is what gives a horn its brassy edge.
    for (const [mult, level, type] of [
      [1, 1, "square"],
      [2, 0.42, "sawtooth"],
      [3, 0.18, "sine"],
    ] as const) {
      const osc = this.ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq * mult;
      const g = this.ctx.createGain();
      g.gain.value = level;
      osc.connect(g);
      g.connect(filter);
      osc.start(time);
      osc.stop(time + dur + 0.05);
    }

    filter.connect(gain);
    gain.connect(this.out);
  }

  dispose() {
    try {
      this.windSource?.stop();
      this.oscA.stop();
      this.oscB.stop();
      this.out.disconnect();
    } catch {
      /* already torn down */
    }
  }
}
