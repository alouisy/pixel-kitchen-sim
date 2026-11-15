import type { FoodBody, FoodStore, Vec3 } from './body.js';

export interface SplitResult {
  /** Created body ids per group, in creation order. */
  groups: number[][];
  crumbs: number;
}

/**
 * Shared by cut and carve. `group[i]` is the group label (0..groupCount-1) of cell i (ignored for empty cells).
 * For each group in order, 6-connected components are found by iterative flood fill (seeds in increasing linear
 * index), components under 2 cells become crumbs, the rest become tight-bounding-box bodies.
 * Does NOT remove the source body from the store.
 */
export function splitComponents(
  store: FoodStore,
  src: FoodBody,
  group: Uint8Array,
  groupCount: number,
): SplitResult {
  const [dx, dy, dz] = src.dims;
  const n = src.material.length;
  const sy = dx;
  const sz = dx * dy;
  const mat = src.material;
  const visited = new Uint8Array(n);
  const stack = new Int32Array(n);
  const comp = new Int32Array(n);
  const groups: number[][] = [];
  let crumbs = 0;

  for (let g = 0; g < groupCount; g++) {
    const made: number[] = [];
    groups.push(made);
    for (let seed = 0; seed < n; seed++) {
      if (mat[seed] === 0 || group[seed] !== g || visited[seed]) continue;
      let sp = 0;
      let cn = 0;
      let minX = dx;
      let minY = dy;
      let minZ = dz;
      let maxX = -1;
      let maxY = -1;
      let maxZ = -1;
      stack[sp++] = seed;
      visited[seed] = 1;
      while (sp > 0) {
        const i = stack[--sp]!;
        comp[cn++] = i;
        const x = i % dx;
        const y = ((i / dx) | 0) % dy;
        const z = (i / sz) | 0;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        if (z < minZ) minZ = z;
        if (z > maxZ) maxZ = z;
        let j: number;
        if (x > 0) {
          j = i - 1;
          if (!visited[j] && mat[j] !== 0 && group[j] === g) {
            visited[j] = 1;
            stack[sp++] = j;
          }
        }
        if (x < dx - 1) {
          j = i + 1;
          if (!visited[j] && mat[j] !== 0 && group[j] === g) {
            visited[j] = 1;
            stack[sp++] = j;
          }
        }
        if (y > 0) {
          j = i - sy;
          if (!visited[j] && mat[j] !== 0 && group[j] === g) {
            visited[j] = 1;
            stack[sp++] = j;
          }
        }
        if (y < dy - 1) {
          j = i + sy;
          if (!visited[j] && mat[j] !== 0 && group[j] === g) {
            visited[j] = 1;
            stack[sp++] = j;
          }
        }
        if (z > 0) {
          j = i - sz;
          if (!visited[j] && mat[j] !== 0 && group[j] === g) {
            visited[j] = 1;
            stack[sp++] = j;
          }
        }
        if (z < dz - 1) {
          j = i + sz;
          if (!visited[j] && mat[j] !== 0 && group[j] === g) {
            visited[j] = 1;
            stack[sp++] = j;
          }
        }
      }
      if (cn < 2) {
        crumbs += cn;
        continue;
      }
      const ndims: Vec3 = [maxX - minX + 1, maxY - minY + 1, maxZ - minZ + 1];
      const nb = store.create(ndims, [src.origin[0] + minX, src.origin[1] + minY, src.origin[2] + minZ]);
      if (src.doneness) nb.doneness = new Uint8Array(nb.material.length);
      if (src.char) nb.char = new Uint8Array(nb.material.length);
      if (src.temp) nb.temp = new Int16Array(nb.material.length);
      const ndx = ndims[0];
      const ndy = ndims[1];
      for (let k = 0; k < cn; k++) {
        const i = comp[k]!;
        const x = i % dx;
        const y = ((i / dx) | 0) % dy;
        const z = (i / sz) | 0;
        const o = x - minX + ndx * (y - minY + ndy * (z - minZ));
        nb.material[o] = mat[i]!;
        if (src.doneness) nb.doneness![o] = src.doneness[i]!;
        if (src.char) nb.char![o] = src.char[i]!;
        if (src.temp) nb.temp![o] = src.temp[i]!;
      }
      nb.flags = src.flags & ~(1 | 2); // not asleep / not burning; pieces re-evaluate
      made.push(nb.id);
    }
  }
  return { groups, crumbs };
}

