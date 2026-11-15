/*
 * Procedural WebAudio synth, ported from V1 (src/audioManager.js): oscillators and noise only, no audio files.
 * The AudioContext is created on the first user input (autoplay policy). Master volume 0.3.
 */
export type Sound = 'pop' | 'place' | 'chop' | 'ding' | 'error' | 'happy' | 'sad' | 'tick' | 'hiss' | 'gull' | 'bell';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private sizzleGain: GainNode | null = null;
  private sizzleCount = 0;
  private muted = false;
  private ambience = false;
  private ambienceGain: GainNode | null = null;
  private gullTimer = 0;
  readonly volume = 0.3;

  get isMuted(): boolean {
    return this.muted;
  }

  /** Create / resume the context. Call from a user-input handler. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.ctx.destination);
      this.noise = this.makeNoise(2);
      this.startSizzle();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    if (this.ambience) this.setAmbience(true);
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : this.volume;
  }

  toggleMuted(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  private makeNoise(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const n = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** Looping filtered-noise sizzle, silent until `setSizzle(count > 0)`. */
  private startSizzle(): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 3200;
    filter.Q.value = 0.7;
    this.sizzleGain = ctx.createGain();
    this.sizzleGain.gain.value = 0;
    src.connect(filter);
    filter.connect(this.sizzleGain);
    this.sizzleGain.connect(this.master!);
    src.start();
  }

  /** Quiet seaside ambience: procedural waves (filtered noise with a slow swell) and an occasional gull. */
  setAmbience(on: boolean): void {
    this.ambience = on;
    if (!this.ctx || !this.master) return;
    if (on && !this.ambienceGain) {
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 650;
      const g = ctx.createGain();
      g.gain.value = 0.05;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.11;
      const lg = ctx.createGain();
      lg.gain.value = 0.035;
      lfo.connect(lg);
      lg.connect(g.gain);
      lfo.start();
      src.connect(lp);
      lp.connect(g);
      g.connect(this.master);
      src.start();
      this.ambienceGain = g;
    }
    if (this.ambienceGain) this.ambienceGain.gain.setTargetAtTime(on ? 0.05 : 0, this.ctx.currentTime, 0.3);
  }

  /** Call every frame with dt seconds: schedules the occasional gull. */
  tickAmbience(dt: number): void {
    if (!this.ambience) return;
    this.gullTimer -= dt;
    if (this.gullTimer <= 0) {
      this.gullTimer = 9 + Math.random() * 14;
      this.play('gull');
    }
  }

  /** Number of foods sizzling on the rock (0 = silence). */
  setSizzle(count: number): void {
    if (count === this.sizzleCount) return;
    this.sizzleCount = count;
    if (this.sizzleGain && this.ctx) {
      this.sizzleGain.gain.setTargetAtTime(Math.min(0.32, count * 0.1), this.ctx.currentTime, 0.15);
    }
  }

  play(name: Sound): void {
    if (this.muted || !this.ctx || !this.master) return;
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    const ctx = this.ctx;
    const t = ctx.currentTime;
    switch (name) {
      case 'pop': {
        const { osc, gain } = this.voice('sine');
        osc.frequency.setValueAtTime(600, t);
        osc.frequency.exponentialRampToValueAtTime(1200, t + 0.1);
        gain.gain.setValueAtTime(1, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
        osc.start(t);
        osc.stop(t + 0.1);
        break;
      }
      case 'place': {
        const { osc, gain } = this.voice('triangle');
        osc.frequency.setValueAtTime(300, t);
        osc.frequency.linearRampToValueAtTime(100, t + 0.1);
        gain.gain.setValueAtTime(0.8, t);
        gain.gain.linearRampToValueAtTime(0.01, t + 0.1);
        osc.start(t);
        osc.stop(t + 0.1);
        break;
      }
      case 'chop': {
        const src = ctx.createBufferSource();
        src.buffer = this.noise;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.5, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
        src.connect(g);
        g.connect(this.master);
        src.start(t, Math.random(), 0.1);
        break;
      }
      case 'ding': {
        const { osc, gain } = this.voice('triangle');
        osc.frequency.setValueAtTime(880, t);
        osc.frequency.setValueAtTime(1318.5, t + 0.09);
        gain.gain.setValueAtTime(0.55, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.9);
        osc.start(t);
        osc.stop(t + 0.9);
        break;
      }
      case 'error': {
        const { osc, gain } = this.voice('sawtooth');
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.linearRampToValueAtTime(100, t + 0.3);
        gain.gain.setValueAtTime(0.5, t);
        gain.gain.linearRampToValueAtTime(0.01, t + 0.3);
        osc.start(t);
        osc.stop(t + 0.3);
        break;
      }
      case 'happy': // C5 E5 G5 C6
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.note(f, t + i * 0.1, i === 3 ? 0.45 : 0.12));
        break;
      case 'sad': // two falling wah notes
        this.note(196, t, 0.28, 'sawtooth', 0.18, 170);
        this.note(155.56, t + 0.3, 0.55, 'sawtooth', 0.18, 110);
        break;
      case 'bell': {
        this.note(1568, t, 0.5, 'triangle', 0.3);
        this.note(2093, t + 0.02, 0.6, 'sine', 0.2);
        break;
      }
      case 'gull': {
        for (const [d, f0, f1] of [[0, 1700, 2500], [0.22, 2300, 1500]] as const) {
          const { osc, gain } = this.voice('sine');
          osc.frequency.setValueAtTime(f0, t + d);
          osc.frequency.linearRampToValueAtTime(f1, t + d + 0.2);
          gain.gain.setValueAtTime(0.0001, t + d);
          gain.gain.exponentialRampToValueAtTime(0.05, t + d + 0.04);
          gain.gain.exponentialRampToValueAtTime(0.001, t + d + 0.22);
          osc.start(t + d);
          osc.stop(t + d + 0.25);
        }
        break;
      }
      case 'tick': {
        const { osc, gain } = this.voice('square');
        osc.frequency.setValueAtTime(1500, t);
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.04);
        osc.start(t);
        osc.stop(t + 0.05);
        break;
      }
      case 'hiss': {
        const src = ctx.createBufferSource();
        src.buffer = this.noise;
        const f = ctx.createBiquadFilter();
        f.type = 'highpass';
        f.frequency.value = 4500;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.35, t + 0.05);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.45);
        src.connect(f);
        f.connect(g);
        g.connect(this.master);
        src.start(t, Math.random(), 0.5);
        break;
      }
    }
  }

  private voice(type: OscillatorType): { osc: OscillatorNode; gain: GainNode } {
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    osc.type = type;
    osc.connect(gain);
    gain.connect(this.master!);
    return { osc, gain };
  }

  private note(freq: number, time: number, duration: number, type: OscillatorType = 'square', vol = 0.12, slideTo?: number): void {
    const { osc, gain } = this.voice(type);
    osc.frequency.setValueAtTime(freq, time);
    if (slideTo) osc.frequency.linearRampToValueAtTime(slideTo, time + duration);
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + duration);
    osc.start(time);
    osc.stop(time + duration);
  }
}
