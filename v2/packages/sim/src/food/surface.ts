import type { FoodBody } from './body.js';

const cache = new WeakMap<FoodBody, { version: number; mask: Uint8Array }>();

/** 1 for solid cells with any 6-neighbour empty or outside the bbox. Cached per (body, version). */
export function surfaceMask(body: FoodBody): Uint8Array {
  const c = cache.get(body);
  if (c && c.version === body.version) return c.mask;
  const [dx, dy, dz] = body.dims;
  const m = body.material;
  const sy = dx;
  const sz = dx * dy;
  const mask = new Uint8Array(m.length);
  let i = 0;
  for (let z = 0; z < dz; z++)
    for (let y = 0; y < dy; y++)
      for (let x = 0; x < dx; x++, i++) {
        if (m[i] === 0) continue;
        if (
          x === 0 || x === dx - 1 || y === 0 || y === dy - 1 || z === 0 || z === dz - 1 ||
          m[i - 1] === 0 || m[i + 1] === 0 || m[i - sy] === 0 || m[i + sy] === 0 || m[i - sz] === 0 || m[i + sz] === 0
        )
          mask[i] = 1;
      }
  cache.set(body, { version: body.version, mask });
  return mask;
}
