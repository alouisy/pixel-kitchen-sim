import { describe, it } from 'vitest';
import { FoodStore, cutBody, fillBox, heatStep, type HeatSource } from './index.js';

describe('food perf (informational)', () => {
  it('cutBody on 12^3', () => {
    const store = new FoodStore();
    let total = 0;
    for (let i = 0; i < 200; i++) {
      const b = store.create([12, 12, 12], [0, 0, 0]);
      fillBox(b, [0, 0, 0], [11, 11, 11], 1);
      const t0 = performance.now();
      const r = cutBody(store, b, { n: [1, (i % 3) - 1, 1], d: 6 + (i % 5) });
      total += performance.now() - t0;
      for (const id of r.created) store.remove(id);
    }
    console.info(`perf: cutBody 12^3 avg ${(total / 200).toFixed(3)} ms`);
  });

  it('heatStep with 40 awake 10^3 bodies', () => {
    const store = new FoodStore();
    const sources: HeatSource[] = [];
    for (let i = 0; i < 40; i++) {
      const b = store.create([10, 10, 10], [i * 11, 0, 0]);
      fillBox(b, [0, 0, 0], [9, 9, 9], 1);
      sources.push({ bodyId: b.id, cells: 'bottom', power: 20 });
    }
    for (let i = 0; i < 20; i++) heatStep(store, sources);
    const t0 = performance.now();
    const N = 50;
    for (let i = 0; i < N; i++) heatStep(store, sources);
    console.info(`perf: heatStep 40x10^3 avg ${((performance.now() - t0) / N).toFixed(3)} ms`);
  });
});
