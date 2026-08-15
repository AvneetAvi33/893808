/*
  The optional realism layer: engine hum for the road scenes, rail clatter for
  the train, a faint tone for space. Synthesised with the Web Audio API so it
  costs no download, and mixed far under the music. Off by default — it should
  never surprise anyone who just wanted songs.
*/

import type { AmbientKind } from "../types";

/** Two seconds of brown noise, looped. Cheap, and warmer than white noise. */
function brownNoiseBuffer(context: AudioContext): AudioBuffer {
  const length = context.sampleRate * 2;
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.5;
  }
  // Crossfade the seam so the loop point is inaudible.
  const edge = Math.floor(context.sampleRate * 0.05);
  for (let i = 0; i < edge; i++) {
    const gain = i / edge;
    data[i] = data[i] * gain + data[length - edge + i] * (1 - gain);
  }
  return buffer;
}

export class AmbientLayer {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private nodes: AudioNode[] = [];
  private kind: AmbientKind | null = null;
  private enabled = false;
  private level = 0.18;

  private ensureContext(): AudioContext | null {
    if (this.context) return this.context;
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    this.context = new Ctor();
    this.master = this.context.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.context.destination);
    return this.context;
  }

  /** Swap to a different scene's ambience, fading rather than cutting. */
  setKind(kind: AmbientKind): void {
    if (kind === this.kind) return;
    this.kind = kind;
    if (this.enabled) this.rebuild();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (enabled) {
      this.rebuild();
      void this.context?.resume();
      this.fadeTo(this.level, 1.6);
    } else {
      this.fadeTo(0, 1.2);
      window.setTimeout(() => {
        if (!this.enabled) this.teardown();
      }, 1400);
    }
  }

  setLevel(level: number): void {
    this.level = Math.max(0, Math.min(1, level));
    if (this.enabled) this.fadeTo(this.level, 0.4);
  }

  private fadeTo(value: number, seconds: number): void {
    const context = this.context;
    if (!context || !this.master) return;
    const now = context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(value, now + seconds);
  }

  private rebuild(): void {
    const context = this.ensureContext();
    if (!context || !this.master || !this.kind) return;
    this.disconnectVoices();

    const noise = context.createBufferSource();
    noise.buffer = brownNoiseBuffer(context);
    noise.loop = true;

    const filter = context.createBiquadFilter();
    const noiseGain = context.createGain();

    if (this.kind === "engine") {
      // A low rumble under a narrow band of road noise, breathing slightly.
      filter.type = "lowpass";
      filter.frequency.value = 320;
      filter.Q.value = 0.7;
      noiseGain.gain.value = 0.5;

      const rumble = context.createOscillator();
      rumble.type = "sine";
      rumble.frequency.value = 58;
      const rumbleGain = context.createGain();
      rumbleGain.gain.value = 0.16;

      const wobble = context.createOscillator();
      wobble.type = "sine";
      wobble.frequency.value = 0.13;
      const wobbleDepth = context.createGain();
      wobbleDepth.gain.value = 5;
      wobble.connect(wobbleDepth).connect(rumble.frequency);

      rumble.connect(rumbleGain).connect(this.master);
      rumble.start();
      wobble.start();
      this.nodes.push(rumble, wobble, rumbleGain, wobbleDepth);
    } else if (this.kind === "rails") {
      // Bogie noise, plus the four-beat clack of joints passing underneath.
      filter.type = "bandpass";
      filter.frequency.value = 900;
      filter.Q.value = 0.6;
      noiseGain.gain.value = 0.32;

      const clackSource = context.createBufferSource();
      clackSource.buffer = brownNoiseBuffer(context);
      clackSource.loop = true;
      const clackFilter = context.createBiquadFilter();
      clackFilter.type = "bandpass";
      clackFilter.frequency.value = 220;
      clackFilter.Q.value = 3;
      const clackGain = context.createGain();
      clackGain.gain.value = 0;

      // Schedule a repeating da-dum, da-dum by ramping the clack gain.
      const period = 1.45;
      const start = context.currentTime + 0.1;
      for (let bar = 0; bar < 400; bar++) {
        for (const beat of [0, 0.17, 0.62, 0.79]) {
          const at = start + bar * period + beat;
          clackGain.gain.setValueAtTime(0.0001, at);
          clackGain.gain.exponentialRampToValueAtTime(0.5, at + 0.012);
          clackGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.1);
        }
      }
      clackSource.connect(clackFilter).connect(clackGain).connect(this.master);
      clackSource.start();
      this.nodes.push(clackSource, clackFilter, clackGain);
    } else {
      // Space: a felt-more-than-heard drone and a distant wash.
      filter.type = "lowpass";
      filter.frequency.value = 180;
      filter.Q.value = 0.5;
      noiseGain.gain.value = 0.22;

      const drone = context.createOscillator();
      drone.type = "sine";
      drone.frequency.value = 42;
      const droneGain = context.createGain();
      droneGain.gain.value = 0.12;
      drone.connect(droneGain).connect(this.master);
      drone.start();
      this.nodes.push(drone, droneGain);
    }

    noise.connect(filter).connect(noiseGain).connect(this.master);
    noise.start();
    this.nodes.push(noise, filter, noiseGain);
  }

  private disconnectVoices(): void {
    for (const node of this.nodes) {
      try {
        if ("stop" in node && typeof (node as AudioScheduledSourceNode).stop === "function") {
          (node as AudioScheduledSourceNode).stop();
        }
      } catch {
        /* already stopped */
      }
      node.disconnect();
    }
    this.nodes = [];
  }

  /** Full release: called when a scene is left, so nothing hums in the dark. */
  teardown(): void {
    this.disconnectVoices();
    this.master?.disconnect();
    this.master = null;
    void this.context?.close();
    this.context = null;
    // `kind` survives teardown so re-enabling picks the scene back up.
  }
}
