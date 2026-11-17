import type { MeshInput } from './types.js';

/** Material indices from @ga/content: 1 mushroom, 5 potato, 4 pepper. */

/**
 * Demo volumes with a visible doneness gradient: bottom (y=0) fully cooked/charred, top raw.
 */
export function createDemoFoodVolume(kind: 'steak-like' | 'mushroom-like'): MeshInput {
  const dims: [number, number, number] = kind === 'steak-like' ? [20, 8, 14] : [18, 20, 18];
  const [dx, dy, dz] = dims;
  const material = new Uint8Array(dx * dy * dz);
  const doneness = new Uint8Array(dx * dy * dz);
  const char = new Uint8Array(dx * dy * dz);

  for (let z = 0; z < dz; z++) {
    for (let y = 0; y < dy; y++) {
      for (let x = 0; x < dx; x++) {
        let m = 0;
        if (kind === 'steak-like') {
          // Rounded slab: superellipse footprint, slightly thinner at the rim.
          const nx = (x + 0.5 - dx / 2) / (dx / 2);
          const nz = (z + 0.5 - dz / 2) / (dz / 2);
          const r = nx ** 4 + nz ** 4;
          const top = y < dy - 1 - (r > 0.5 ? 1 : 0);
          if (r <= 1 && top) m = ((x * 7 + z * 13 + y * 3) % 11 === 0 && y === dy - 2) ? 4 : 5;
        } else {
          const cx = x + 0.5 - dx / 2;
          const cz = z + 0.5 - dz / 2;
          const rr = cx * cx + cz * cz;
          if (y < 11 && rr <= 3.5 * 3.5) m = 5; // stem
          else if (y >= 8) {
            const cy = y - 8 + 0.5;
            if (rr + cy * cy * 2.2 <= 8.5 * 8.5 && cy >= 0) m = 1; // cap dome
          }
        }
        const i = x + dx * (y + dy * z);
        material[i] = m;
        if (m === 0) continue;
        const t = 1 - y / (dy - 1); // 1 at bottom, 0 at top
        doneness[i] = Math.round(255 * Math.min(1, t * 1.15));
        char[i] = t > 0.8 ? Math.round(255 * Math.min(1, (t - 0.8) * 5)) : 0;
      }
    }
  }
  return { dims, material, doneness, char };
}
