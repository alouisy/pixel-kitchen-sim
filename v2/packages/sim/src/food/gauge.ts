import { materialByIndex } from '@ga/content';
import type { FoodBody } from './body.js';
import { bottomCells } from './heat.js';

export interface DoneGauge {
  /** Bottom-layer average doneness, 0..255. */
  marker: number;
  perfectLo: number;
  perfectHi: number;
  burnAt: number;
}

/** Material of the first solid cell (the body's "dominant" material for gauge purposes), or 0. */
export function firstMaterial(body: FoodBody): number {
  const m = body.material;
  for (let i = 0; i < m.length; i++) if (m[i] !== 0) return m[i]!;
  return 0;
}

/** Cooking progress of the underside (what the rock cooks) plus the material's perfect band, all in 0..255. */
export function doneGauge(body: FoodBody): DoneGauge {
  const mat = materialByIndex(firstMaterial(body));
  const [lo, hi] = mat ? mat.thermal.perfect : [0.5, 0.8];
  let marker = 0;
  if (body.doneness) {
    const cells = bottomCells(body);
    let sum = 0;
    for (let k = 0; k < cells.length; k++) sum += body.doneness[cells[k]!]!;
    marker = cells.length > 0 ? Math.round(sum / cells.length) : 0;
  }
  return {
    marker,
    perfectLo: Math.round(lo * 255),
    perfectHi: Math.round(hi * 255),
    burnAt: Math.round((mat ? mat.thermal.charStart : 0.92) * 255),
  };
}
