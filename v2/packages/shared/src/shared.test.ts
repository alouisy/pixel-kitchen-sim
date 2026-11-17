import { describe, expect, it } from 'vitest';
import { Hasher64, Prng, fsin, fcos, fxMul, toFx } from './index.js';

describe('Prng', () => {
  it('known sequence for seed 12345', () => {
    const p = new Prng(12345);
    const got = Array.from({ length: 5 }, () => p.nextU32());
    expect(got).toEqual(KNOWN);
  });
  it('same seed gives identical sequences', () => {
    const a = new Prng(7);
    const b = new Prng(7);
    for (let i = 0; i < 1000; i++) expect(a.nextU32()).toBe(b.nextU32());
  });
  it('split is reproducible and independent of label', () => {
    const a = new Prng(9).split('heat');
    const b = new Prng(9).split('heat');
    const c = new Prng(9).split('fire');
    expect(a.nextU32()).toBe(b.nextU32());
    expect(new Prng(9).split('heat').nextU32()).not.toBe(c.nextU32());
  });
  it('state round-trips', () => {
    const a = new Prng(3);
    a.nextU32();
    const b = Prng.fromState(a.getState());
    expect(b.nextU32()).toBe(a.nextU32());
  });
  it('float in [0,1) and int in range', () => {
    const p = new Prng(1);
    for (let i = 0; i < 1000; i++) {
      const f = p.nextFloat();
      expect(f >= 0 && f < 1).toBe(true);
      const n = p.int(-3, 4);
      expect(n >= -3 && n <= 4).toBe(true);
    }
  });
});

describe('fmath', () => {
  it('fsin/fcos error < 1e-6 over [-10pi, 10pi]', () => {
    let max = 0;
    const N = 200000;
    for (let i = 0; i <= N; i++) {
      const x = -10 * Math.PI + (20 * Math.PI * i) / N;
      max = Math.max(max, Math.abs(fsin(x) - Math.sin(x)), Math.abs(fcos(x) - Math.cos(x)));
    }
    expect(max).toBeLessThan(1e-6);
  });
  it('Q8 helpers', () => {
    expect(toFx(1.5)).toBe(384);
    expect(fxMul(toFx(0.5), toFx(0.5))).toBe(64);
  });
});

describe('Hasher64', () => {
  const h = (n: number) => new Hasher64().u32(n).i32(-5).f64(1.5).bytes(new Uint8Array([1, 2, 3])).digest();
  it('is stable and 16 hex chars', () => {
    expect(h(1)).toBe(h(1));
    expect(h(1)).toMatch(/^[0-9a-f]{16}$/);
  });
  it('differs for different inputs', () => {
    expect(h(1)).not.toBe(h(2));
    expect(new Hasher64().f64(1.5).digest()).not.toBe(new Hasher64().f64(1.6).digest());
  });
});

// Recorded from the reference implementation (seed 12345).
const KNOWN = [518667457, 440444462, 4232892992, 3757857622, 3939018813];
