import type { FoodBody, FoodStore, Vec3 } from './body.js';
import { splitComponents } from './split.js';

export interface CarveResult {
  removedId: number;
  scooped: number[];
  remainder: number[];
  crumbs: number;
}

/** Remove cells whose integer dist^2 (world cell coords) from `centerWorld` is <= r^2 + r. */
export function carveSphere(store: FoodStore, body: FoodBody, centerWorld: Vec3, r: number): CarveResult {
  const [dx, dy, dz] = body.dims;
  const lim = r * r + r;
  const group = new Uint8Array(body.material.length);
  let scoop = 0;
  let i = 0;
  for (let z = 0; z < dz; z++) {
    const ez = body.origin[2] + z - centerWorld[2];
    for (let y = 0; y < dy; y++) {
      const ey = body.origin[1] + y - centerWorld[1];
      for (let x = 0; x < dx; x++, i++) {
        if (body.material[i] === 0) continue;
        const ex = body.origin[0] + x - centerWorld[0];
        if (ex * ex + ey * ey + ez * ez <= lim) {
          scoop++;
          group[i] = 0;
        } else group[i] = 1;
      }
    }
  }
  if (scoop === 0) return { removedId: -1, scooped: [], remainder: [], crumbs: 0 };
  const r2 = splitComponents(store, body, group, 2);
  store.remove(body.id);
  return { removedId: body.id, scooped: r2.groups[0]!, remainder: r2.groups[1]!, crumbs: r2.crumbs };
}
