import type { FoodBody, FoodStore, Vec3 } from './body.js';
import { splitComponents } from './split.js';

/** Plane in world food-voxel coordinates: side A where n . (2p+1) - 2d >= 0 for cell p. */
export interface CutPlane {
  n: Vec3;
  d: number;
}

export interface CutResult {
  removedId: number;
  created: number[];
  crumbs: number;
  crumbAt: Array<[number, number, number]>;
}

export function cutBody(store: FoodStore, body: FoodBody, plane: CutPlane, minCells = 2): CutResult {
  const [dx, dy, dz] = body.dims;
  const [nx, ny, nz] = plane.n;
  const n2 = body.material.length;
  const group = new Uint8Array(n2);
  const ox = body.origin[0];
  const oy = body.origin[1];
  const oz = body.origin[2];
  const twoD = 2 * plane.d;
  let countA = 0;
  let countB = 0;
  let i = 0;
  for (let z = 0; z < dz; z++) {
    const tz = nz * (2 * (oz + z) + 1);
    for (let y = 0; y < dy; y++) {
      const ty = tz + ny * (2 * (oy + y) + 1) - twoD;
      for (let x = 0; x < dx; x++, i++) {
        if (body.material[i] === 0) continue;
        const s = ty + nx * (2 * (ox + x) + 1);
        if (s >= 0) countA++;
        else {
          group[i] = 1;
          countB++;
        }
      }
    }
  }
  if (countA === 0 || countB === 0) return { removedId: -1, created: [], crumbs: 0, crumbAt: [] };
  const r = splitComponents(store, body, group, 2, minCells);
  store.remove(body.id);
  return { removedId: body.id, created: [...r.groups[0]!, ...r.groups[1]!], crumbs: r.crumbs, crumbAt: r.crumbAt };
}

const HORIZ: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];

/**
 * Snap an aim to a plane through the centre of `cellWorld`.
 * dir 0..7: horizontal normal direction (45 degree steps); tilt 0 vertical plane, 1 = 45 degrees (ny = 1),
 * 2 = horizontal plane (n = (0,1,0)).
 */
export function planeFromAim(cellWorld: Vec3, dir: number, tilt: 0 | 1 | 2): CutPlane {
  const h = HORIZ[dir & 7]!;
  let n: Vec3;
  if (tilt === 2) n = [0, 1, 0];
  else if (tilt === 1) n = [h[0], 1, h[1]];
  else n = [h[0], 0, h[1]];
  const sum = n[0] * (2 * cellWorld[0] + 1) + n[1] * (2 * cellWorld[1] + 1) + n[2] * (2 * cellWorld[2] + 1);
  return { n, d: Math.floor(sum / 2) };
}
