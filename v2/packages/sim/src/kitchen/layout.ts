import type { FoodBody, FoodStore } from '../food/index.js';

/*
 * Static test-kitchen layout in integer food voxels (1 fv = 1/16 m). World origin = kitchen centre, y up.
 * All rectangles are half-open cell ranges [x0, x0 + w) etc.
 */
export const FV_PER_M = 16;
export const KITCHEN_HALF_M = 4; // 8 x 8 m floor

export const TABLE = { x0: -32, z0: -48, w: 64, d: 16, top: 14 } as const;
export const ROCK = { x0: 8, z0: -46, w: 12, d: 12, y0: 14, top: 16 } as const;
export const PLATE = { cx: 26, cz: -41, r: 5, y: 14 } as const;

export const PAD_Z = -41;
export interface PadDef {
  material: 'mushroom' | 'potato' | 'bread_rock' | 'pepper' | 'cheese';
  x: number;
  z: number;
}
export const PADS: readonly PadDef[] = [
  { material: 'mushroom', x: -28, z: PAD_Z },
  { material: 'potato', x: -20, z: PAD_Z },
  { material: 'bread_rock', x: -12, z: PAD_Z },
  { material: 'pepper', x: -4, z: PAD_Z },
  { material: 'cheese', x: 3, z: PAD_Z },
];
/** Pad mat size in fv (square, centred on x,z). */
export const PAD_SIZE = 6;

/** Chef spawn (metres) and table collision (metres, table footprint grown by the chef radius). */
export const CHEF_RADIUS_M = 0.3;
export const SPAWN_M = { x: 0, z: 0 } as const;

export const MAX_BODIES = 40;
export const MAX_LIFT_CELLS = 384;
/** Rush mode: bodies smaller than this cannot be cut again (stops endless dicing). */
export const MIN_CUT_CELLS = 24;
/** Rush mode: same-material pieces within this gap (fv) of the grabbed one are lifted together. */
export const GROUP_GAP_FV = 2;
export const REACH_FV = 22; // 1.4 m
export const HELD_BOTTOM_Y = 16; // 1.0 m
export const HELD_AHEAD_FV = 9.6; // 0.6 m
export const HAND_AHEAD_FV = 4.8; // 0.3 m
export const HAND_Y = 16;
export const ROCK_POWER = 32;
export const TORCH_POWER = 40;
export const TORCH_LENGTH = 22;
export const TORCH_COS_HALF = 0.906;
export const CLEAVER_AIM_RADIUS = 6;

export const MAX_BODY_CELLS_Y = 24;

/** Highest solid local y + 1 in column (lx, lz), or -1 if the column is empty / outside. */
export function columnTop(body: FoodBody, lx: number, lz: number): number {
  const [dx, dy, dz] = body.dims;
  if (lx < 0 || lz < 0 || lx >= dx || lz >= dz) return -1;
  for (let y = dy - 1; y >= 0; y--) if (body.material[lx + dx * (y + dy * lz)] !== 0) return y + 1;
  return -1;
}

/** Lowest solid local y in column (lx, lz), or -1. */
export function columnBottom(body: FoodBody, lx: number, lz: number): number {
  const [dx, dy] = body.dims;
  for (let y = 0; y < dy; y++) if (body.material[lx + dx * (y + dy * lz)] !== 0) return y;
  return -1;
}

export function inRect(x: number, z: number, r: { x0: number; z0: number; w: number; d: number }): boolean {
  return x >= r.x0 && x < r.x0 + r.w && z >= r.z0 && z < r.z0 + r.d;
}

/** Cell-centre inside the plate disc. */
export function inPlate(x: number, z: number): boolean {
  const ex = x + 0.5 - PLATE.cx;
  const ez = z + 0.5 - PLATE.cz;
  return ex * ex + ez * ez <= PLATE.r * PLATE.r;
}

/**
 * Height (world fv) a thing placed over column cell (x, z) rests on: max of floor, table top, rock top and the top of any
 * other body's solid column there. Bodies are visited in ascending id order.
 */
export function supportHeightAt(
  store: FoodStore,
  x: number,
  z: number,
  ignoreBodyId: number,
  /** Ignore other bodies whose column top is above this height (used when settling, so bodies resting ON us don't count). */
  maxY: number = Infinity,
): number {
  let h = 0;
  if (inRect(x, z, TABLE) && TABLE.top > h) h = TABLE.top;
  if (inRect(x, z, ROCK) && ROCK.top > h) h = ROCK.top;
  for (const id of store.ids()) {
    if (id === ignoreBodyId) continue;
    const b = store.get(id)!;
    const t = columnTop(b, x - b.origin[0], z - b.origin[2]);
    if (t >= 0 && b.origin[1] + t > h && b.origin[1] + t <= maxY) h = b.origin[1] + t;
  }
  return h;
}

/** Origin.y for `body` (at its current x/z origin) so its lowest solid cells rest on the support surface. */
export function restingOriginY(store: FoodStore, body: FoodBody, onlyBelow = false): number {
  const [dx, , dz] = body.dims;
  let best = -1e9;
  let any = false;
  for (let lz = 0; lz < dz; lz++)
    for (let lx = 0; lx < dx; lx++) {
      const lb = columnBottom(body, lx, lz);
      if (lb < 0) continue;
      any = true;
      const maxY = onlyBelow ? body.origin[1] + lb : Infinity;
      const y = supportHeightAt(store, body.origin[0] + lx, body.origin[2] + lz, body.id, maxY) - lb;
      if (y > best) best = y;
    }
  return any ? best : body.origin[1];
}

/** True when any solid cell of `body` coincides with a solid cell of another body. */
export function overlapsOthers(store: FoodStore, body: FoodBody): boolean {
  const [dx, dy, dz] = body.dims;
  for (const id of store.ids()) {
    if (id === body.id) continue;
    const o = store.get(id)!;
    const [ox, oy, oz] = o.dims;
    const x0 = Math.max(body.origin[0], o.origin[0]);
    const x1 = Math.min(body.origin[0] + dx, o.origin[0] + ox);
    const y0 = Math.max(body.origin[1], o.origin[1]);
    const y1 = Math.min(body.origin[1] + dy, o.origin[1] + oy);
    const z0 = Math.max(body.origin[2], o.origin[2]);
    const z1 = Math.min(body.origin[2] + dz, o.origin[2] + oz);
    for (let z = z0; z < z1; z++)
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          if (
            body.material[x - body.origin[0] + dx * (y - body.origin[1] + dy * (z - body.origin[2]))] !== 0 &&
            o.material[x - o.origin[0] + ox * (y - o.origin[1] + oy * (z - o.origin[2]))] !== 0
          )
            return true;
        }
  }
  return false;
}
