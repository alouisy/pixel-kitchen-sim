import { describe, expect, it } from 'vitest';
import { Prng } from '@ga/shared';
import {
  FoodStore, bottomCells, carveSphere, cutBody, fillBox, fillSphere, heatStep, shapeMetrics, surfaceCells,
  type HeatSource,
} from './index.js';

const MATS = [1, 2, 3, 4, 5, 6, 7, 8];

function op(store: FoodStore, r: Prng): void {
  const ids = store.ids();
  const kind = r.int(0, 9);
  const pick = () => (ids.length ? store.get(ids[r.int(0, ids.length - 1)]!) : undefined);
  if (kind <= 1 || ids.length === 0) {
    if (ids.length > 30) return;
    const dims: [number, number, number] = [r.int(2, 10), r.int(2, 10), r.int(2, 10)];
    const b = store.create(dims, [r.int(-5, 5), r.int(0, 5), r.int(-5, 5)]);
    const mat = MATS[r.int(0, MATS.length - 1)]!;
    if (r.int(0, 1)) fillBox(b, [0, 0, 0], [dims[0] - 1, dims[1] - 1, dims[2] - 1], mat);
    else fillSphere(b, [r.int(0, dims[0]), r.int(0, dims[1]), r.int(0, dims[2])], r.int(1, 5), mat);
  } else if (kind <= 3) {
    const b = pick();
    if (!b) return;
    const n: [number, number, number] = [r.int(-4, 4), r.int(-4, 4), r.int(-4, 4)];
    if (n[0] === 0 && n[1] === 0 && n[2] === 0) n[0] = 1;
    cutBody(store, b, { n, d: r.int(-30, 30) });
  } else if (kind === 4) {
    const b = pick();
    if (!b) return;
    carveSphere(store, b, [b.origin[0] + r.int(0, b.dims[0]), b.origin[1] + r.int(0, b.dims[1]), b.origin[2] + r.int(0, b.dims[2])], r.int(1, 3));
  } else {
    const sources: HeatSource[] = [];
    const n = r.int(0, 3);
    for (let k = 0; k < n; k++) {
      const b = pick();
      if (!b) continue;
      const m = r.int(0, 2);
      sources.push({
        bodyId: b.id,
        cells: m === 0 ? 'bottom' : m === 1 ? 'all-surface' : surfaceCells(b).subarray(0, 5),
        power: r.int(-20, 60),
      });
      void bottomCells;
    }
    for (let k = 0; k < r.int(1, 8); k++) heatStep(store, sources);
  }
  for (const id of store.ids()) shapeMetrics(store.get(id)!);
}

function run(seed: number, store = new FoodStore(), ops = 400): FoodStore {
  const r = new Prng(seed);
  for (let i = 0; i < ops; i++) op(store, r);
  return store;
}

describe('food determinism', () => {
  it('same seed gives same hash, different seed differs', () => {
    expect(run(777).hash()).toBe(run(777).hash());
    expect(run(777).hash()).not.toBe(run(778).hash());
  });

  it('snapshot/restore round trips and continues identically', () => {
    const r1 = new Prng(5);
    const a = new FoodStore();
    for (let i = 0; i < 200; i++) op(a, r1);
    const b = new FoodStore();
    b.restore(a.snapshot());
    expect(b.hash()).toBe(a.hash());
    const r2 = new Prng(99);
    const r3 = new Prng(99);
    for (let i = 0; i < 200; i++) {
      op(a, r2);
      op(b, r3);
      expect(b.hash()).toBe(a.hash());
    }
  });
});
