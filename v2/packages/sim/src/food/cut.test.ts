import { describe, expect, it } from 'vitest';
import { materialById } from '@ga/content';
import { FoodStore, cellCount, cutBody, ensureThermal, fillBox, planeFromAim, type FoodBody } from './index.js';

const MUSH = materialById('mushroom')!.index;

function box(store: FoodStore, dims: [number, number, number], origin: [number, number, number] = [0, 0, 0]): FoodBody {
  const b = store.create(dims, origin);
  fillBox(b, [0, 0, 0], [dims[0] - 1, dims[1] - 1, dims[2] - 1], MUSH);
  return b;
}

describe('cutBody', () => {
  it('splits a 10^3 box at x=4.5 into two 500-cell bodies', () => {
    const store = new FoodStore();
    const b = box(store, [10, 10, 10], [3, 0, 2]);
    // world cells x in 3..12; plane through x = 8 boundary: n=(1,0,0), 2d = 2*8 -> cells centred at wx+0.5 >= 8
    const r = cutBody(store, b, { n: [1, 0, 0], d: 8 });
    expect(r.removedId).toBe(b.id);
    expect(r.created.length).toBe(2);
    expect(store.get(b.id)).toBeUndefined();
    const [a, c] = r.created.map((id) => store.get(id)!);
    expect(cellCount(a!)).toBe(500);
    expect(cellCount(c!)).toBe(500);
    expect(a!.origin).toEqual([8, 0, 2]);
    expect(a!.dims).toEqual([5, 10, 10]);
    expect(c!.origin).toEqual([3, 0, 2]);
    expect(c!.dims).toEqual([5, 10, 10]);
  });

  it('a U-shape cut across its arms yields 3 bodies', () => {
    const store = new FoodStore();
    const b = store.create([9, 6, 3], [0, 0, 0]);
    fillBox(b, [0, 0, 0], [8, 1, 2], MUSH); // base
    fillBox(b, [0, 2, 0], [1, 5, 2], MUSH); // left arm
    fillBox(b, [7, 2, 0], [8, 5, 2], MUSH); // right arm
    const r = cutBody(store, b, { n: [0, 1, 0], d: 3 }); // horizontal plane y=3
    expect(r.created.length).toBe(3);
    expect(r.created.map((id) => cellCount(store.get(id)!)).sort((x, y) => x - y)).toEqual([18, 18, 66]);
  });

  it('non-intersecting plane is a no-op', () => {
    const store = new FoodStore();
    const b = box(store, [4, 4, 4]);
    const r = cutBody(store, b, { n: [1, 0, 0], d: 100 });
    expect(r).toEqual({ removedId: -1, created: [], crumbs: 0, crumbAt: [] });
    expect(store.get(b.id)).toBe(b);
  });

  it('carries attribute arrays over per world cell', () => {
    const store = new FoodStore();
    const b = box(store, [6, 4, 5], [-2, 1, 3]);
    ensureThermal(b);
    for (let i = 0; i < b.material.length; i++) {
      b.doneness![i] = (i * 7) & 255;
      b.char![i] = (i * 3) & 255;
      b.temp![i] = i - 50;
    }
    const world = new Map<string, [number, number, number]>();
    for (let z = 0; z < 5; z++)
      for (let y = 0; y < 4; y++)
        for (let x = 0; x < 6; x++) {
          const i = x + 6 * (y + 4 * z);
          world.set(`${x - 2},${y + 1},${z + 3}`, [b.doneness![i]!, b.char![i]!, b.temp![i]!]);
        }
    const plane = planeFromAim([0, 2, 5], 1, 1);
    const r = cutBody(store, b, plane);
    expect(r.created.length).toBeGreaterThanOrEqual(2);
    let seen = 0;
    for (const id of r.created) {
      const nb = store.get(id)!;
      const [dx, dy, dz] = nb.dims;
      for (let z = 0; z < dz; z++)
        for (let y = 0; y < dy; y++)
          for (let x = 0; x < dx; x++) {
            const i = x + dx * (y + dy * z);
            if (nb.material[i] === 0) continue;
            const key = `${nb.origin[0] + x},${nb.origin[1] + y},${nb.origin[2] + z}`;
            expect([nb.doneness![i], nb.char![i], nb.temp![i]]).toEqual(world.get(key));
            seen++;
          }
    }
    expect(seen + r.crumbs).toBe(120);
  });

  it('planeFromAim passes through the cell centre', () => {
    const p = planeFromAim([5, 2, 7], 0, 0);
    expect(p).toEqual({ n: [1, 0, 0], d: 5 });
    expect(planeFromAim([5, 2, 7], 3, 2).n).toEqual([0, 1, 0]);
    expect(planeFromAim([5, 2, 7], 2, 1).n).toEqual([0, 1, 1]);
  });
});
