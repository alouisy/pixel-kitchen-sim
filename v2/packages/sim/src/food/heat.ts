import {
  AMBIENT_Q,
  FLAG_ASLEEP,
  FLAG_ON_FIRE,
  ensureThermal,
  type FoodBody,
  type FoodStore,
} from './body.js';
import { ASH_INDEX, BURNS, CHAR_START_Q, COND, COOK_START_Q } from './materialTable.js';
import { surfaceMask } from './surface.js';

export interface HeatSource {
  bodyId: number;
  cells: 'bottom' | 'all-surface' | Uint32Array;
  /** TEMP units added per step to each targeted cell; negative freezes. */
  power: number;
}

export interface HeatStepReport {
  changedBodies: number[];
  burned: number[];
}

export const TEMP_MIN = -800;
export const TEMP_MAX = 1600;
const SLEEP_AFTER = 20;

/** Solid cells whose -y neighbour is empty or outside the bbox. */
export function bottomCells(body: FoodBody): Uint32Array {
  const [dx, dy, dz] = body.dims;
  const out: number[] = [];
  let i = 0;
  for (let z = 0; z < dz; z++)
    for (let y = 0; y < dy; y++)
      for (let x = 0; x < dx; x++, i++) {
        if (body.material[i] === 0) continue;
        if (y === 0 || body.material[i - dx] === 0) out.push(i);
      }
  return Uint32Array.from(out);
}

export function surfaceCells(body: FoodBody): Uint32Array {
  const mask = surfaceMask(body);
  const out: number[] = [];
  for (let i = 0; i < mask.length; i++) if (mask[i]) out.push(i);
  return Uint32Array.from(out);
}

/** Surface cells whose centre lies within the cone (apex `origin`, unit `dir`, `length`, in world food voxels). */
export function cellsInCone(
  body: FoodBody,
  origin: [number, number, number],
  dir: [number, number, number],
  length: number,
  cosHalfAngle: number,
): Uint32Array {
  const [dx, dy] = body.dims;
  const mask = surfaceMask(body);
  const out: number[] = [];
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const x = i % dx;
    const y = Math.floor(i / dx) % dy;
    const z = Math.floor(i / (dx * dy));
    const vx = body.origin[0] + x + 0.5 - origin[0];
    const vy = body.origin[1] + y + 0.5 - origin[1];
    const vz = body.origin[2] + z + 0.5 - origin[2];
    const t = vx * dir[0] + vy * dir[1] + vz * dir[2];
    if (t < 0 || t > length) continue;
    const len = Math.sqrt(vx * vx + vy * vy + vz * vz);
    if (t >= cosHalfAngle * len) out.push(i);
  }
  return Uint32Array.from(out);
}

// Scratch buffers (fully overwritten before every read; no state carries between calls).
const scratch = new Int16Array(24 * 24 * 24);
const burnScratch = new Int32Array(24 * 24 * 24);

function clampT(v: number): number {
  return v < TEMP_MIN ? TEMP_MIN : v > TEMP_MAX ? TEMP_MAX : v;
}

export function heatStep(store: FoodStore, sources: readonly HeatSource[]): HeatStepReport {
  const targeted = new Set<number>();
  for (const s of sources) {
    const body = store.get(s.bodyId);
    if (!body) continue;
    ensureThermal(body);
    body.flags &= ~FLAG_ASLEEP;
    body.calm = 0;
    targeted.add(body.id);
    const cells = s.cells === 'bottom' ? bottomCells(body) : s.cells === 'all-surface' ? surfaceCells(body) : s.cells;
    const t = body.temp!;
    for (let k = 0; k < cells.length; k++) {
      const i = cells[k]!;
      if (body.material[i] === 0) continue;
      t[i] = clampT(t[i]! + s.power);
    }
  }

  const changedBodies: number[] = [];
  const burned: number[] = [];
  const ids = store.ids();
  for (const id of ids) {
    const body = store.get(id)!;
    if (body.flags & FLAG_ASLEEP) continue;
    if (body.temp === null) {
      // Never heated: nothing to simulate; sleep immediately.
      body.flags |= FLAG_ASLEEP;
      continue;
    }
    const r = stepBody(body, targeted.has(id));
    if (r & 1) changedBodies.push(id);
    if (r & 2) burned.push(id);
  }
  return { changedBodies, burned };
}

/** Returns bit0 = doneness/char/material changed, bit1 = burned. */
function stepBody(body: FoodBody, wasTargeted: boolean): number {
  const [dx, dy, dz] = body.dims;
  const sy = dx;
  const sz = dx * dy;
  const mat = body.material;
  const T = body.temp!;
  const D = body.doneness!;
  const C = body.char!;
  const surf = surfaceMask(body);
  const out = scratch;
  const burnList = burnScratch;
  let nBurn = 0;
  let maxAbs = 0;
  let changed = false;
  let i = 0;
  for (let z = 0; z < dz; z++) {
    const zEdge = z === 0 || z === dz - 1;
    for (let y = 0; y < dy; y++) {
      const yzEdge = zEdge || y === 0 || y === dy - 1;
      for (let x = 0; x < dx; x++, i++) {
        const m = mat[i]!;
        if (m === 0) {
          out[i] = 0;
          continue;
        }
        const ti = T[i]!;
        const ci = COND[m]!;
        let acc = 0;
        let mj: number;
        if (yzEdge || x === 0 || x === dx - 1) {
          if (x > 0 && (mj = mat[i - 1]!) !== 0) acc += (T[i - 1]! - ti) * Math.min(ci, COND[mj]!);
          if (x < dx - 1 && (mj = mat[i + 1]!) !== 0) acc += (T[i + 1]! - ti) * Math.min(ci, COND[mj]!);
          if (y > 0 && (mj = mat[i - sy]!) !== 0) acc += (T[i - sy]! - ti) * Math.min(ci, COND[mj]!);
          if (y < dy - 1 && (mj = mat[i + sy]!) !== 0) acc += (T[i + sy]! - ti) * Math.min(ci, COND[mj]!);
          if (z > 0 && (mj = mat[i - sz]!) !== 0) acc += (T[i - sz]! - ti) * Math.min(ci, COND[mj]!);
          if (z < dz - 1 && (mj = mat[i + sz]!) !== 0) acc += (T[i + sz]! - ti) * Math.min(ci, COND[mj]!);
        } else {
          if ((mj = mat[i - 1]!) !== 0) acc += (T[i - 1]! - ti) * Math.min(ci, COND[mj]!);
          if ((mj = mat[i + 1]!) !== 0) acc += (T[i + 1]! - ti) * Math.min(ci, COND[mj]!);
          if ((mj = mat[i - sy]!) !== 0) acc += (T[i - sy]! - ti) * Math.min(ci, COND[mj]!);
          if ((mj = mat[i + sy]!) !== 0) acc += (T[i + sy]! - ti) * Math.min(ci, COND[mj]!);
          if ((mj = mat[i - sz]!) !== 0) acc += (T[i - sz]! - ti) * Math.min(ci, COND[mj]!);
          if ((mj = mat[i + sz]!) !== 0) acc += (T[i + sz]! - ti) * Math.min(ci, COND[mj]!);
        }
        if (surf[i]) acc += (AMBIENT_Q - ti) * 8;
        const nt = ti + Math.floor(acc / 512);
        out[i] = nt;
        const ch = nt > ti ? nt - ti : ti - nt;
        if (ch > maxAbs) maxAbs = ch;
        // Cooking and charring read only this cell's own state.
        const cs = COOK_START_Q[m]!;
        if (nt >= cs) {
          const d0 = D[i]!;
          if (d0 < 255) {
            D[i] = Math.min(255, d0 + Math.min(8, 1 + ((nt - cs) >> 6)));
            changed = true;
          }
          const c0 = C[i]!;
          if (D[i]! >= CHAR_START_Q[m]! && nt >= cs + 160 && c0 < 255) {
            C[i] = Math.min(255, c0 + Math.min(8, 1 + ((nt - cs - 160) >> 6)));
            changed = true;
          }
        }
        if (C[i] === 255 && BURNS[m] === 1) burnList[nBurn++] = i;
      }
    }
  }
  T.set(out.subarray(0, mat.length));
  // Burn after diffusion so neighbour conductivities above used pre-burn materials.
  for (let k = 0; k < nBurn; k++) mat[burnList[k]!] = ASH_INDEX;
  if (nBurn > 0) {
    body.version = (body.version + 1) >>> 0;
    body.flags |= FLAG_ON_FIRE;
    changed = true;
  } else body.flags &= ~FLAG_ON_FIRE;

  if (maxAbs <= 1 && !wasTargeted) {
    body.calm++;
    if (body.calm >= SLEEP_AFTER) {
      body.flags |= FLAG_ASLEEP;
      body.flags &= ~FLAG_ON_FIRE;
    }
  } else body.calm = 0;
  return (changed ? 1 : 0) | (nBurn > 0 ? 2 : 0);
}
