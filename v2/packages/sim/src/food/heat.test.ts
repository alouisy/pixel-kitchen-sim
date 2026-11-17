import { describe, expect, it } from 'vitest';
import { materialById } from '@ga/content';
import { FLAG_ASLEEP, FLAG_ON_FIRE, FoodStore, fillBox, heatStep, type FoodBody, type HeatSource } from './index.js';

const MUSH = materialById('mushroom')!.index;
const ASH = materialById('ash')!.index;
const ROCK = materialById('bread_rock')!.index;

function mush(store: FoodStore, dims: [number, number, number] = [6, 3, 6], mat = MUSH): FoodBody {
  const b = store.create(dims, [0, 0, 0]);
  fillBox(b, [0, 0, 0], [dims[0] - 1, dims[1] - 1, dims[2] - 1], mat);
  return b;
}

function layerAvg(b: FoodBody, y: number, arr: Uint8Array): number {
  const [dx, dy, dz] = b.dims;
  let s = 0;
  for (let z = 0; z < dz; z++) for (let x = 0; x < dx; x++) s += arr[x + dx * (y + dy * z)]!;
  return s / (dx * dz);
}

describe('heat', () => {
  const src = (id: number, power = 32): HeatSource[] => [{ bodyId: id, cells: 'bottom', power }];

  it('tune check: bottom cooks in 1-4 s with a gradient; long heating chars', () => {
    const store = new FoodStore();
    const b = mush(store);
    let stepsToCooked = -1;
    for (let s = 1; s <= 300; s++) {
      heatStep(store, src(b.id));
      if (stepsToCooked < 0 && layerAvg(b, 0, b.doneness!) >= 140) {
        stepsToCooked = s;
        const top = layerAvg(b, 2, b.doneness!);
        const bottom = layerAvg(b, 0, b.doneness!);
        console.info(`tune: bottom>=140 at step ${stepsToCooked}; bottom=${bottom.toFixed(1)} top=${top.toFixed(1)}`);
        expect(top).toBeLessThan(bottom);
      }
    }
    expect(stepsToCooked).toBeGreaterThanOrEqual(10);
    expect(stepsToCooked).toBeLessThanOrEqual(40);
    expect(layerAvg(b, 0, b.char!)).toBeGreaterThan(0);
    console.info(`tune: after 300 steps bottom char=${layerAvg(b, 0, b.char!).toFixed(1)} top doneness=${layerAvg(b, 2, b.doneness!).toFixed(1)}`);
  });

  it('sleeps after the source is removed', () => {
    const store = new FoodStore();
    const b = mush(store);
    for (let s = 0; s < 30; s++) heatStep(store, src(b.id));
    expect(b.flags & FLAG_ASLEEP).toBe(0);
    let slept = -1;
    for (let s = 0; s < 3000 && slept < 0; s++) {
      heatStep(store, []);
      if (b.flags & FLAG_ASLEEP) slept = s;
    }
    expect(slept).toBeGreaterThan(0);
    const snap = store.hash();
    heatStep(store, []);
    expect(store.hash()).toBe(snap);
    heatStep(store, src(b.id));
    expect(b.flags & FLAG_ASLEEP).toBe(0);
  });

  it('burns bread_rock to ash, bumping version', () => {
    const store = new FoodStore();
    const b = mush(store, [4, 2, 4], ROCK);
    const v0 = b.version;
    let sawBurn = false;
    for (let s = 0; s < 1500 && !sawBurn; s++) {
      const r = heatStep(store, src(b.id, 40));
      if (r.burned.includes(b.id)) {
        sawBurn = true;
        expect(b.flags & FLAG_ON_FIRE).toBeTruthy();
        expect(r.changedBodies).toContain(b.id);
      }
    }
    expect(sawBurn).toBe(true);
    expect(b.version).toBeGreaterThan(v0);
    expect(b.material.includes(ASH)).toBe(true);
    heatStep(store, []);
    expect(b.flags & FLAG_ON_FIRE).toBe(0);
  });

  it('negative power lowers temperatures', () => {
    const store = new FoodStore();
    const b = mush(store);
    for (let s = 0; s < 5; s++) heatStep(store, [{ bodyId: b.id, cells: 'all-surface', power: -20 }]);
    expect(Math.min(...b.temp!)).toBeLessThan(-50);
    expect(Math.max(...b.temp!)).toBeLessThanOrEqual(0);
  });
});
