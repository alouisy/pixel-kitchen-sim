const FNV_PRIME = 0x01000193;
const FNV_OFFSET = 0x811c9dc5;
const MURMUR_SEED = 0x9747b28c;

/** FNV-1a 32-bit of a string's UTF-16 code units. */
export function hashString(s: string): number {
  let h = FNV_OFFSET;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, FNV_PRIME) >>> 0;
  }
  return h >>> 0;
}

const f64Buf = new Float64Array(1);
const f64Bytes = new Uint8Array(f64Buf.buffer);
// Little-endian byte order is assumed for the Float64Array view (true on every target browser).

/** 64-bit hash as two independent 32-bit lanes: FNV-1a (A) and a murmur3-style mix (B). */
export class Hasher64 {
  private a = FNV_OFFSET;
  private b = MURMUR_SEED;

  private byte(v: number): void {
    this.a = Math.imul(this.a ^ (v & 0xff), FNV_PRIME) >>> 0;
  }

  u32(v: number): this {
    v = v >>> 0;
    // Lane A: four bytes, little-endian.
    this.byte(v);
    this.byte(v >>> 8);
    this.byte(v >>> 16);
    this.byte(v >>> 24);
    // Lane B: murmur3 block mix.
    let k = Math.imul(v, 0xcc9e2d51);
    k = ((k << 15) | (k >>> 17)) >>> 0;
    k = Math.imul(k, 0x1b873593);
    let h = (this.b ^ k) >>> 0;
    h = ((h << 13) | (h >>> 19)) >>> 0;
    this.b = (Math.imul(h, 5) + 0xe6546b64) >>> 0;
    return this;
  }

  i32(v: number): this {
    return this.u32(v | 0);
  }

  f64(v: number): this {
    f64Buf[0] = v;
    for (let i = 0; i < 8; i += 4) {
      this.u32(
        (f64Bytes[i]! | (f64Bytes[i + 1]! << 8) | (f64Bytes[i + 2]! << 16) | (f64Bytes[i + 3]! << 24)) >>> 0,
      );
    }
    return this;
  }

  bytes(u8: Uint8Array): this {
    for (let i = 0; i < u8.length; i++) {
      this.byte(u8[i]!);
      let k = Math.imul(u8[i]! + 1, 0xcc9e2d51);
      k = ((k << 15) | (k >>> 17)) >>> 0;
      k = Math.imul(k, 0x1b873593);
      let h = (this.b ^ k) >>> 0;
      h = ((h << 13) | (h >>> 19)) >>> 0;
      this.b = (Math.imul(h, 5) + 0xe6546b64) >>> 0;
    }
    // Mix in the length so concatenation boundaries matter.
    return this.u32(u8.length);
  }

  /** 16 lowercase hex chars. Lane B is finalized with murmur3 fmix32. */
  digest(): string {
    let h = this.b;
    h ^= h >>> 16;
    h = Math.imul(h, 0x85ebca6b) >>> 0;
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35) >>> 0;
    h ^= h >>> 16;
    return hex32(this.a) + hex32(h >>> 0);
  }
}

function hex32(v: number): string {
  return (v >>> 0).toString(16).padStart(8, '0');
}
