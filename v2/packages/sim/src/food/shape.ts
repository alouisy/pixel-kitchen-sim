import type { FoodBody } from './body.js';
import { surfaceMask } from './surface.js';

export interface ShapeMetrics {
  volume: number;
  surface: number;
  /** max y - min y + 1 over solid cells, in food voxels. */
  height: number;
  /** Bounding extents of solid cells, sorted descending. */
  extents: [number, number, number];
  /** extents[0] / max(1, extents[2]). */
  aspect: number;
}

const cache = new WeakMap<FoodBody, { version: number; m: ShapeMetrics }>();

/** Cached per body object, invalidated by version. Note: callers must not mutate the returned object. */
export function shapeMetrics(body: FoodBody): ShapeMetrics {
  const c = cache.get(body);
  if (c && c.version === body.version) return c.m;
  const [dx, dy] = body.dims;
  const mat = body.material;
  const surf = surfaceMask(body);
  let volume = 0;
  let surface = 0;
  let minX = 1e9, minY = 1e9, minZ = 1e9, maxX = -1, maxY = -1, maxZ = -1;
  for (let i = 0; i < mat.length; i++) {
    if (mat[i] === 0) continue;
    volume++;
    if (surf[i]) surface++;
    const x = i % dx;
    const y = Math.floor(i / dx) % dy;
    const z = Math.floor(i / (dx * dy));
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  const ex = volume ? [maxX - minX + 1, maxY - minY + 1, maxZ - minZ + 1] : [0, 0, 0];
  const height = volume ? maxY - minY + 1 : 0;
  ex.sort((a, b) => b - a);
  const m: ShapeMetrics = {
    volume,
    surface,
    height,
    extents: [ex[0]!, ex[1]!, ex[2]!],
    aspect: ex[0]! / Math.max(1, ex[2]!),
  };
  cache.set(body, { version: body.version, m });
  return m;
}
