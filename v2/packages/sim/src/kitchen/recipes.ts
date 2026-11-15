import { materialByIndex } from '@ga/content';
import type { FoodBody } from '../food/index.js';
import { ASH_INDEX } from '../food/materialTable.js';

/*
 * Rush mode recipes (V1-style orders built from the toy's voxel ingredients). A dish is the set of bodies on the plate.
 * Each recipe lists exactly which ingredients it needs and whether each one must be cooked and/or cut.
 * Thresholds are tuned on the hot rock (measured in rush.test.ts with MEASURE=1): a whole mushroom is cooked after ~8 s and
 * burnt after ~16 s; three potato sticks are cooked after ~10 s; a pepper is cooked after ~9 s and burnt after ~28 s.
 */
export type IngredientId = 'mushroom' | 'potato' | 'bread_rock' | 'cheese' | 'pepper';

export interface IngredientReq {
  id: IngredientId;
  /** Must be cooked (average doneness >= COOKED_AT). Undefined: raw or cooked, both fine. */
  cooked?: true;
  /** Minimum number of pieces (cut with the cleaver). */
  pieces?: number;
}

export interface Recipe {
  id: string;
  ingredients: readonly IngredientReq[];
  points: number;
  /** Patience in seconds before the order expires. */
  patienceS: number;
  /** Service second from which the recipe can be ordered. */
  unlockS: number;
}

export const RECIPES: readonly Recipe[] = [
  { id: 'grilled_mushroom', ingredients: [{ id: 'mushroom', cooked: true }], points: 20, patienceS: 60, unlockS: 0 },
  { id: 'fries', ingredients: [{ id: 'potato', cooked: true, pieces: 3 }], points: 30, patienceS: 80, unlockS: 20 },
  {
    id: 'burger',
    ingredients: [{ id: 'bread_rock' }, { id: 'mushroom', cooked: true }],
    points: 40,
    patienceS: 75,
    unlockS: 45,
  },
  {
    id: 'cheeseburger',
    ingredients: [{ id: 'bread_rock' }, { id: 'mushroom', cooked: true }, { id: 'cheese' }],
    points: 50,
    patienceS: 85,
    unlockS: 75,
  },
  {
    id: 'spicy_burger',
    ingredients: [{ id: 'bread_rock' }, { id: 'mushroom', cooked: true }, { id: 'pepper', cooked: true }],
    points: 60,
    patienceS: 95,
    unlockS: 110,
  },
];

/** Average doneness from which an ingredient counts as cooked, and average char from which it is burnt. */
export const COOKED_AT: Record<string, number> = { mushroom: 0.5, potato: 0.3, pepper: 0.45, bread_rock: 0.35, cheese: 0.3 };
export const BURNT_AT: Record<string, number> = { mushroom: 0.6, potato: 0.6, pepper: 0.6, bread_rock: 0.5, cheese: 0.5 };
const cookedAt = (id: string): number => COOKED_AT[id] ?? 0.5;
const burntAt = (id: string): number => BURNT_AT[id] ?? 0.6;
/** A dish whose cells are more than this share of ash is burnt. */
export const ASH_LIMIT = 0.15;
/** Minimum cells of an ingredient for it to count (about half a fresh spawn), so a crumb is not a burger. */
export const MIN_CELLS: Record<IngredientId, number> = { mushroom: 100, potato: 130, bread_rock: 170, cheese: 30, pepper: 70 };

export type ServeProblem =
  | { kind: 'missing'; id: IngredientId }
  | { kind: 'extra'; id: string }
  | { kind: 'raw'; id: IngredientId }
  | { kind: 'burnt'; id: string }
  | { kind: 'not_cut'; id: IngredientId; pieces: number; need: number };

interface MatStat {
  cells: number;
  pieces: number;
  done: number;
  char: number;
}

export interface PlateSummary {
  mats: Map<string, MatStat>;
  cells: number;
  ash: number;
}

/** Per-ingredient totals for the bodies on the plate. A body counts as a piece of its majority (non-ash) material. */
export function summarize(bodies: readonly FoodBody[]): PlateSummary {
  const mats = new Map<string, MatStat>();
  let cells = 0;
  let ash = 0;
  for (const b of bodies) {
    const perBody = new Map<number, number>();
    for (let i = 0; i < b.material.length; i++) {
      const mi = b.material[i]!;
      if (mi === 0) continue;
      cells++;
      if (mi === ASH_INDEX) {
        ash++;
        continue;
      }
      const id = materialByIndex(mi)?.id ?? `m${mi}`;
      let s = mats.get(id);
      if (!s) mats.set(id, (s = { cells: 0, pieces: 0, done: 0, char: 0 }));
      s.cells++;
      s.done += b.doneness ? b.doneness[i]! / 255 : 0;
      s.char += b.char ? b.char[i]! / 255 : 0;
      perBody.set(mi, (perBody.get(mi) ?? 0) + 1);
    }
    let best = -1;
    let bestN = 0;
    for (const [mi, n] of [...perBody].sort((a, c) => a[0] - c[0])) if (n > bestN) [best, bestN] = [mi, n];
    if (best >= 0) mats.get(materialByIndex(best)?.id ?? `m${best}`)!.pieces++;
  }
  return { mats, cells, ash };
}

/** Problems preventing `summary` from fulfilling `recipe` (empty = match). Order: missing, extra, burnt, raw, not cut. */
export function checkRecipe(recipe: Recipe, summary: PlateSummary): ServeProblem[] {
  const out: ServeProblem[] = [];
  const wanted = new Set<string>(recipe.ingredients.map((r) => r.id));
  for (const r of recipe.ingredients) {
    const s = summary.mats.get(r.id);
    if (!s || s.cells < MIN_CELLS[r.id]) out.push({ kind: 'missing', id: r.id });
  }
  for (const [id, s] of [...summary.mats].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (!wanted.has(id) && s.cells >= 8) out.push({ kind: 'extra', id });
  }
  if (summary.cells > 0 && summary.ash / summary.cells > ASH_LIMIT) out.push({ kind: 'burnt', id: 'ash' });
  for (const r of recipe.ingredients) {
    const s = summary.mats.get(r.id);
    if (!s || s.cells < MIN_CELLS[r.id]) continue;
    if (s.char / s.cells >= burntAt(r.id)) out.push({ kind: 'burnt', id: r.id });
    else if (r.cooked && s.done / s.cells < cookedAt(r.id)) out.push({ kind: 'raw', id: r.id });
    if (r.pieces !== undefined && s.pieces < r.pieces) out.push({ kind: 'not_cut', id: r.id, pieces: s.pieces, need: r.pieces });
  }
  return out;
}

/** Cooking state of one body for the HUD gauge: 0..1 doneness and char averages. */
export function cookState(b: FoodBody): { done: number; char: number } {
  let n = 0;
  let d = 0;
  let c = 0;
  for (let i = 0; i < b.material.length; i++) {
    if (b.material[i] === 0) continue;
    n++;
    if (b.doneness) d += b.doneness[i]! / 255;
    if (b.char) c += b.char[i]! / 255;
  }
  return n ? { done: d / n, char: c / n } : { done: 0, char: 0 };
}
