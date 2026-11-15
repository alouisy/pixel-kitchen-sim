import { describe, expect, it } from 'vitest';
import { materialById } from '@ga/content';
import { FoodStore, carveSphere, cellCount, fillBox } from './index.js';

const MUSH = materialById('mushroom')!.index;

describe('carveSphere', () => {
  it('scoops a slab into one scoop plus one remainder', () => {
    const store = new FoodStore();
    const b = store.create([12, 3, 12], [0, 0, 0]);
    fillBox(b, [0, 0, 0], [11, 2, 11], MUSH);
    const total = cellCount(b);
    const r = carveSphere(store, b, [6, 2, 6], 2);
    expect(r.removedId).toBe(b.id);
    expect(r.scooped.length).toBe(1);
    expect(r.remainder.length).toBe(1);
    const sc = cellCount(store.get(r.scooped[0]!)!);
    expect(sc).toBeGreaterThan(0);
    expect(sc + cellCount(store.get(r.remainder[0]!)!) + r.crumbs).toBe(total);
  });

  it('severing carve gives two remainder bodies', () => {
    const store = new FoodStore();
    const b = store.create([15, 3, 3], [0, 0, 0]);
    fillBox(b, [0, 0, 0], [14, 2, 2], MUSH);
    const r = carveSphere(store, b, [7, 1, 1], 3); // r^2+r = 12 covers the full cross-section
    expect(r.remainder.length).toBe(2);
    expect(r.scooped.length).toBe(1);
  });

  it('no-op when nothing is within the sphere', () => {
    const store = new FoodStore();
    const b = store.create([3, 3, 3], [0, 0, 0]);
    fillBox(b, [0, 0, 0], [2, 2, 2], MUSH);
    expect(carveSphere(store, b, [50, 50, 50], 2).removedId).toBe(-1);
  });
});
