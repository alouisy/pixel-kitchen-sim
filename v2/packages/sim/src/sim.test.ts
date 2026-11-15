import { describe, expect, it } from 'vitest';
import { Prng } from '@ga/shared';
import { FixedStepLoop } from './loop.js';
import { INPUT_FRAME_BYTES, decodeInputFrame, encodeInputFrame, type InputFrame } from './types.js';
import { SimWorld } from './world.js';

function script(seed: number, ticks: number): InputFrame[] {
  const r = new Prng(seed);
  return Array.from({ length: ticks }, (_, i) => ({
    tick: i + 1,
    move: [r.int(-127, 127), r.int(-127, 127)],
    aim: [r.int(-32768, 32767), 0, r.int(-32768, 32767)],
    buttons: r.int(0, 0xffff),
    analog: { tool: r.int(0, 255) },
    seq: i & 0xffff,
  }));
}

function run(seed: number, inputs: InputFrame[], slots = 2): SimWorld {
  const w = new SimWorld({ seed, chefSlots: slots, phase: 'service' });
  for (const f of inputs) w.step([f, inputs[(f.tick * 7) % inputs.length]]);
  return w;
}

describe('determinism', () => {
  const inputs = script(99, 600);
  it('same seed + inputs gives identical hash; different seed differs', () => {
    expect(run(1, inputs).stateHash()).toBe(run(1, inputs).stateHash());
    expect(run(1, inputs).stateHash()).not.toBe(run(2, inputs).stateHash());
  });
  it('different inputs give a different hash', () => {
    expect(run(1, inputs).stateHash()).not.toBe(run(1, script(100, 600)).stateHash());
  });
});

describe('snapshot', () => {
  it('round-trips and stays in lockstep', () => {
    const inputs = script(5, 300);
    const a = run(3, inputs.slice(0, 150));
    const b = SimWorld.restore(a.snapshot());
    expect(b.stateHash()).toBe(a.stateHash());
    expect(b.tick).toBe(a.tick);
    for (const f of inputs.slice(150)) {
      a.step([f, f]);
      b.step([f, f]);
    }
    expect(b.stateHash()).toBe(a.stateHash());
  });
});

describe('movement', () => {
  it('reaches ~4.2 m/s after 30 ticks of full right', () => {
    const w = new SimWorld({ seed: 1, chefSlots: 1, phase: 'service' });
    const f: InputFrame = { tick: 0, move: [127, 0], aim: [0, 0, 0], buttons: 0, analog: { tool: 0 }, seq: 0 };
    for (let i = 0; i < 30; i++) w.step([f]);
    expect(w.readChefVelocity(0).x).toBeCloseTo(4.2, 3);
  });
  it('clamps to the arena', () => {
    const w = new SimWorld({ seed: 1, chefSlots: 1, phase: 'service' });
    const f: InputFrame = { tick: 0, move: [127, 127], aim: [0, 0, 0], buttons: 0, analog: { tool: 0 }, seq: 0 };
    for (let i = 0; i < 600; i++) w.step([f]);
    const s = w.readChefStates();
    expect(s[0]).toBe(20);
    expect(s[2]).toBe(20);
  });
  it('emits a tick event every 30 ticks', () => {
    const w = new SimWorld({ seed: 1, chefSlots: 1 });
    let n = 0;
    for (let i = 0; i < 90; i++) n += w.step([undefined]).length;
    expect(n).toBe(3);
  });
});

describe('InputFrame codec', () => {
  it('round-trips', () => {
    const f: InputFrame = { tick: 4000000000, move: [-128, 127], aim: [-32768, 32767, 5], buttons: 65535, analog: { tool: 200 }, seq: 65000 };
    const dv = encodeInputFrame(f);
    expect(dv.byteLength).toBe(INPUT_FRAME_BYTES);
    expect(decodeInputFrame(dv)).toEqual(f);
  });
});

describe('FixedStepLoop', () => {
  it('runs capped steps and returns alpha', () => {
    const w = new SimWorld({ seed: 1, chefSlots: 1 });
    const loop = new FixedStepLoop(w);
    expect(loop.advance(50, () => [])).toBeCloseTo(0.5, 5);
    expect(w.tick).toBe(1);
    loop.advance(10_000, () => []);
    expect(w.tick).toBe(6);
  });
});
