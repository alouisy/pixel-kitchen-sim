import { materials } from '@ga/content';
import { TEMP_SCALE } from './body.js';

export interface MatInfo {
  cond: number;
  cookStartQ: number;
  charStartQ: number;
  burnsToAsh: boolean;
  edible: boolean;
}

const EMPTY: MatInfo = Object.freeze({ cond: 1, cookStartQ: 32767, charStartQ: 255, burnsToAsh: false, edible: false });

/** Per material index (0..255) thermal table; frozen at module init. */
export const MAT_TABLE: readonly MatInfo[] = (() => {
  const t: MatInfo[] = new Array<MatInfo>(256).fill(EMPTY);
  for (const m of materials) {
    t[m.index] = Object.freeze({
      cond: m.thermal.conductivity,
      cookStartQ: Math.round((m.thermal.cookStart - 20) * TEMP_SCALE),
      charStartQ: Math.round(m.thermal.charStart * 255),
      burnsToAsh: m.flammability >= 0.3 || m.id === 'bread_rock',
      edible: m.edible,
    });
  }
  return Object.freeze(t);
})();

function indexOf(id: string): number {
  const m = materials.find((x) => x.id === id);
  if (!m) throw new Error(`missing material ${id}`);
  return m.index;
}

export const ASH_INDEX = indexOf('ash');
export const MUSHROOM_INDEX = indexOf('mushroom');

/** Flat typed lookups (index = material index) for hot loops. */
export const COND = new Uint8Array(256);
export const COOK_START_Q = new Int16Array(256);
export const CHAR_START_Q = new Uint8Array(256);
export const BURNS = new Uint8Array(256);
for (let i = 0; i < 256; i++) {
  const t = MAT_TABLE[i]!;
  COND[i] = t.cond;
  COOK_START_Q[i] = Math.min(32767, t.cookStartQ);
  CHAR_START_Q[i] = t.charStartQ;
  BURNS[i] = t.burnsToAsh ? 1 : 0;
}
