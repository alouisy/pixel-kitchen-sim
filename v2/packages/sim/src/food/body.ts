import { Hasher64 } from '@ga/shared';

/** Max food body extent per axis, in food voxels. */
export const MAX_DIM = 24;
/** Metres per food voxel. */
export const FV = 1 / 16;
/** Temperatures are stored relative to a 20 degC ambient. */
export const AMBIENT_Q = 0;
/** 1 temperature unit = 0.25 degC. */
export const TEMP_SCALE = 4;

export interface FoodBody {
  /** Stable id assigned by FoodStore. */
  id: number;
  dims: [number, number, number];
  /** len = dx*dy*dz, idx = x + dx*(y + dy*z); 0 = empty. */
  material: Uint8Array;
  /** 0..255, lazily allocated on first heat. */
  doneness: Uint8Array | null;
  char: Uint8Array | null;
  /** TEMP_SCALE units relative to ambient, lazy. */
  temp: Int16Array | null;
  /** World position of cell (0,0,0)'s min corner, integer food voxels. */
  origin: [number, number, number];
  flags: number;
  /** Incremented on any structural change (cut, carve, material change). */
  version: number;
  /** Consecutive heat steps with no change (for sleeping). */
  calm: number;
}

export const FLAG_ASLEEP = 1;
export const FLAG_ON_FIRE = 2;
export const FLAG_HELD = 4;

export type Vec3 = [number, number, number];

export function createBody(id: number, dims: Vec3, origin: Vec3): FoodBody {
  for (let a = 0; a < 3; a++) {
    const d = dims[a]!;
    if (!Number.isInteger(d) || d < 1 || d > MAX_DIM) throw new RangeError(`bad body dim ${d}`);
  }
  return {
    id,
    dims: [dims[0], dims[1], dims[2]],
    material: new Uint8Array(dims[0] * dims[1] * dims[2]),
    doneness: null,
    char: null,
    temp: null,
    origin: [origin[0], origin[1], origin[2]],
    flags: 0,
    version: 0,
    calm: 0,
  };
}

/** Fill the inclusive local box [min, max], clipped to the body. */
export function fillBox(body: FoodBody, min: Vec3, max: Vec3, materialIndex: number): void {
  const [dx, dy, dz] = body.dims;
  const x0 = Math.max(0, min[0]);
  const y0 = Math.max(0, min[1]);
  const z0 = Math.max(0, min[2]);
  const x1 = Math.min(dx - 1, max[0]);
  const y1 = Math.min(dy - 1, max[1]);
  const z1 = Math.min(dz - 1, max[2]);
  for (let z = z0; z <= z1; z++)
    for (let y = y0; y <= y1; y++) {
      const row = dx * (y + dy * z);
      for (let x = x0; x <= x1; x++) body.material[x + row] = materialIndex;
    }
  body.version = (body.version + 1) >>> 0;
}

/** Fill cells whose integer distance^2 from `center` (local cell coords) is <= r^2 + r. */
export function fillSphere(body: FoodBody, center: Vec3, r: number, materialIndex: number): void {
  const [dx, dy, dz] = body.dims;
  const lim = r * r + r;
  for (let z = 0; z < dz; z++)
    for (let y = 0; y < dy; y++)
      for (let x = 0; x < dx; x++) {
        const ex = x - center[0];
        const ey = y - center[1];
        const ez = z - center[2];
        if (ex * ex + ey * ey + ez * ez <= lim) body.material[x + dx * (y + dy * z)] = materialIndex;
      }
  body.version = (body.version + 1) >>> 0;
}

export function cellCount(body: FoodBody): number {
  const m = body.material;
  let n = 0;
  for (let i = 0; i < m.length; i++) if (m[i] !== 0) n++;
  return n;
}

/** Allocate the lazy thermal arrays (zero-filled) if absent. */
export function ensureThermal(body: FoodBody): void {
  const n = body.material.length;
  if (body.doneness === null) body.doneness = new Uint8Array(n);
  if (body.char === null) body.char = new Uint8Array(n);
  if (body.temp === null) body.temp = new Int16Array(n);
}

export function bodyHash(body: FoodBody, h: Hasher64): void {
  h.u32(body.id);
  h.u32(body.dims[0]).u32(body.dims[1]).u32(body.dims[2]);
  h.i32(body.origin[0]).i32(body.origin[1]).i32(body.origin[2]);
  h.u32(body.version).u32(body.flags);
  h.bytes(body.material);
  if (body.doneness) h.bytes(body.doneness);
  else h.u32(0);
  if (body.char) h.bytes(body.char);
  else h.u32(0);
  if (body.temp) h.bytes(new Uint8Array(body.temp.buffer, body.temp.byteOffset, body.temp.byteLength));
  else h.u32(0);
}

const SNAP_MAGIC = 0x31534446; // 'FDS1'

/**
 * Owns all food bodies. Ids are monotonic and never reused.
 *
 * Snapshot layout (all little-endian, via DataView):
 *   u32 magic, u32 nextId, u32 bodyCount
 *   per body, in ascending id order:
 *     u32 id, u32 dx, u32 dy, u32 dz, i32 ox, i32 oy, i32 oz,
 *     u32 flags, u32 version, u32 calm,
 *     u32 mask (bit0 doneness, bit1 char, bit2 temp present),
 *     u8[n] material, then present arrays in order doneness u8[n], char u8[n], temp i16[n]
 * `calm` is part of the snapshot so a restored store continues identically.
 */
export class FoodStore {
  nextId = 1;
  private readonly bodies = new Map<number, FoodBody>();

  create(dims: Vec3, origin: Vec3): FoodBody {
    const b = createBody(this.nextId++, dims, origin);
    this.bodies.set(b.id, b);
    return b;
  }

  get(id: number): FoodBody | undefined {
    return this.bodies.get(id);
  }

  remove(id: number): boolean {
    return this.bodies.delete(id);
  }

  /** Live body ids, ascending. */
  ids(): number[] {
    return Array.from(this.bodies.keys()).sort((a, b) => a - b);
  }

  get size(): number {
    return this.bodies.size;
  }

  hash(): string {
    const h = new Hasher64();
    const ids = this.ids();
    h.u32(this.nextId).u32(ids.length);
    for (const id of ids) bodyHash(this.bodies.get(id)!, h);
    return h.digest();
  }

  snapshot(): Uint8Array {
    const ids = this.ids();
    let size = 12;
    for (const id of ids) {
      const b = this.bodies.get(id)!;
      const n = b.material.length;
      size += 44 + n + (b.doneness ? n : 0) + (b.char ? n : 0) + (b.temp ? 2 * n : 0);
    }
    const buf = new Uint8Array(size);
    const dv = new DataView(buf.buffer);
    let p = 0;
    const u32 = (v: number) => {
      dv.setUint32(p, v >>> 0, true);
      p += 4;
    };
    u32(SNAP_MAGIC);
    u32(this.nextId);
    u32(ids.length);
    for (const id of ids) {
      const b = this.bodies.get(id)!;
      u32(b.id);
      u32(b.dims[0]);
      u32(b.dims[1]);
      u32(b.dims[2]);
      for (let a = 0; a < 3; a++) {
        dv.setInt32(p, b.origin[a]!, true);
        p += 4;
      }
      u32(b.flags);
      u32(b.version);
      u32(b.calm);
      u32((b.doneness ? 1 : 0) | (b.char ? 2 : 0) | (b.temp ? 4 : 0));
      buf.set(b.material, p);
      p += b.material.length;
      if (b.doneness) {
        buf.set(b.doneness, p);
        p += b.doneness.length;
      }
      if (b.char) {
        buf.set(b.char, p);
        p += b.char.length;
      }
      if (b.temp) {
        for (let i = 0; i < b.temp.length; i++) {
          dv.setInt16(p, b.temp[i]!, true);
          p += 2;
        }
      }
    }
    return buf;
  }

  restore(buf: Uint8Array): void {
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    let p = 0;
    const u32 = () => {
      const v = dv.getUint32(p, true);
      p += 4;
      return v;
    };
    if (u32() !== SNAP_MAGIC) throw new Error('bad food snapshot');
    const nextId = u32();
    const count = u32();
    this.bodies.clear();
    for (let k = 0; k < count; k++) {
      const id = u32();
      const dims: Vec3 = [u32(), u32(), u32()];
      const origin: Vec3 = [0, 0, 0];
      for (let a = 0; a < 3; a++) {
        origin[a] = dv.getInt32(p, true);
        p += 4;
      }
      const b = createBody(id, dims, origin);
      b.flags = u32();
      b.version = u32();
      b.calm = u32();
      const mask = u32();
      const n = b.material.length;
      b.material.set(buf.subarray(p, p + n));
      p += n;
      if (mask & 1) {
        b.doneness = buf.slice(p, p + n);
        p += n;
      }
      if (mask & 2) {
        b.char = buf.slice(p, p + n);
        p += n;
      }
      if (mask & 4) {
        const t = new Int16Array(n);
        for (let i = 0; i < n; i++) {
          t[i] = dv.getInt16(p, true);
          p += 2;
        }
        b.temp = t;
      }
      this.bodies.set(id, b);
    }
    this.nextId = nextId;
  }
}
