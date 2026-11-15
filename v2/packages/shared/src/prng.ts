import { hashString } from './hash.js';

/** splitmix32 step: advances `state` holder and returns next output. */
function splitmix32(state: { s: number }): number {
  state.s = (state.s + 0x9e3779b9) >>> 0;
  let z = state.s;
  z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
  z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
  return (z ^ (z >>> 16)) >>> 0;
}

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

/** xoshiro128** seeded from a u32 via splitmix32. Deterministic across engines. */
export class Prng {
  private readonly s = new Uint32Array(4);

  constructor(seed: number) {
    const sm = { s: seed >>> 0 };
    for (let i = 0; i < 4; i++) this.s[i] = splitmix32(sm);
    // xoshiro must not have an all-zero state (practically impossible via splitmix32).
    if ((this.s[0]! | this.s[1]! | this.s[2]! | this.s[3]!) === 0) this.s[0] = 1;
  }

  nextU32(): number {
    const s = this.s;
    const s0 = s[0]!;
    const s1 = s[1]!;
    const s2 = s[2]!;
    const s3 = s[3]!;
    const result = Math.imul(rotl(Math.imul(s1, 5) >>> 0, 7), 9) >>> 0;
    const t = (s1 << 9) >>> 0;
    const n2 = (s2 ^ s0) >>> 0;
    const n3 = (s3 ^ s1) >>> 0;
    const n1 = (s1 ^ n2) >>> 0;
    const n0 = (s0 ^ n3) >>> 0;
    s[0] = n0;
    s[1] = n1;
    s[2] = (n2 ^ t) >>> 0;
    s[3] = rotl(n3, 11);
    return result;
  }

  /** Float in [0, 1) with 24 bits of precision. */
  nextFloat(): number {
    return (this.nextU32() >>> 8) / 16777216;
  }

  /** Integer in [min, maxInclusive]. */
  int(min: number, maxInclusive: number): number {
    const span = maxInclusive - min + 1;
    return min + (this.nextU32() % span);
  }

  /** Derive an independent stream named by `label`. Advances this stream by one value. */
  split(label: string): Prng {
    return new Prng((hashString(label) ^ this.nextU32()) >>> 0);
  }

  getState(): Uint32Array {
    return new Uint32Array(this.s);
  }

  static fromState(state: Uint32Array): Prng {
    const p = new Prng(0);
    for (let i = 0; i < 4; i++) p.s[i] = state[i]! >>> 0;
    return p;
  }
}
