import { describe, expect, it } from 'vitest';
import { Prng } from '@ga/shared';
import { cravings } from '@ga/content';
import { FoodStore, bottomCells, cutBody, doneGauge, evaluateDish, heatStep, type FoodBody } from './index.js';
import { ROCK, ROCK_POWER, restingOriginY } from '../kitchen/layout.js';
import { spawnAtPad } from '../kitchen/spawn.js';

const craving = (id: string) => cravings.find((c) => c.id === id)!;
const MUSHROOM_PAD = 0;
const POTATO_PAD = 1;
const BREAD_PAD = 2;
/** Carrying time from the rock to the mouth (heat steps at 10 Hz, no source). */
const CARRY_STEPS = 30;

/** Spawn a pad ingredient, put it on the rock and cook it with the real heatStep until the bottom layer reaches `until`. */
function cookOnRock(pad: number, until: 'raw' | 'perfect' | 'seconds', seconds = 0): { store: FoodStore; body: FoodBody } {
  const store = new FoodStore();
  const body = spawnAtPad(store, pad, new Prng(1));
  body.origin[0] = ROCK.x0 + 2;
  body.origin[2] = ROCK.z0 + 2;
  body.origin[1] = restingOriginY(store, body);
  if (until === 'raw') return { store, body };
  const steps = until === 'seconds' ? seconds * 10 : 3000;
  for (let i = 0; i < steps; i++) {
    heatStep(store, [{ bodyId: body.id, cells: 'bottom', power: ROCK_POWER }]);
    if (until === 'perfect') {
      const g = doneGauge(body);
      if (g.marker >= (g.perfectLo + g.perfectHi) / 2) break;
    }
  }
  return { store, body };
}
function carry(store: FoodStore): void {
  for (let i = 0; i < CARRY_STEPS; i++) heatStep(store, []);
}
const score = (bodies: FoodBody[], id: string) => evaluateDish(bodies, craving(id));

describe('score tuning (bodies cooked on the rock through heatStep)', () => {
  it('gauge enters the perfect band several seconds after the food hits the rock, and stays there a few seconds', () => {
    const store = new FoodStore();
    const body = spawnAtPad(store, MUSHROOM_PAD, new Prng(1));
    body.origin[0] = ROCK.x0 + 2;
    body.origin[2] = ROCK.z0 + 2;
    body.origin[1] = restingOriginY(store, body);
    let enter = -1;
    let leave = -1;
    for (let step = 1; step <= 600; step++) {
      heatStep(store, [{ bodyId: body.id, cells: 'bottom', power: ROCK_POWER }]);
      const g = doneGauge(body);
      if (enter < 0 && g.marker >= g.perfectLo) enter = step / 10;
      if (leave < 0 && g.marker > g.perfectHi) leave = step / 10;
    }
    expect(enter).toBeGreaterThan(6);
    expect(enter).toBeLessThan(15);
    expect(leave - enter).toBeGreaterThanOrEqual(2.5);
  });

  it('seared mushroom: perfect >= 80, raw <= 30, burnt <= 25', () => {
    const seared = cookOnRock(MUSHROOM_PAD, 'perfect');
    carry(seared.store);
    const raw = cookOnRock(MUSHROOM_PAD, 'raw');
    carry(raw.store);
    const burnt = cookOnRock(MUSHROOM_PAD, 'seconds', 60);
    carry(burnt.store);
    const s = score([seared.body], 'ch1_seared_mushroom');
    const r = score([raw.body], 'ch1_seared_mushroom');
    const b = score([burnt.body], 'ch1_seared_mushroom');
    console.info(`seared profile perfect=${s.profile['doneness.perfect'].toFixed(2)} umami=${s.profile['flavor.umami'].toFixed(2)} quality=${s.quality.toFixed(2)}`);
    console.info(`seared mushroom: perfect=${s.score}/${s.tier} raw=${r.score}/${r.tier} burnt=${b.score}/${b.tier}`);
    expect(s.score).toBeGreaterThanOrEqual(80);
    expect(['great', 'perfect']).toContain(s.tier);
    expect(s.highlights).toContain('PERFECT_SEAR');
    expect(r.score).toBeLessThanOrEqual(30);
    expect(r.tier).toBe('yuck');
    expect(b.score).toBeLessThanOrEqual(25);
    expect(b.tier).toBe('yuck');
  });

  it('crunchy and hot: toasted bread served at once >= 65, raw bread and charcoal are worse', () => {
    const toast = cookOnRock(BREAD_PAD, 'perfect');
    carry(toast.store);
    const raw = cookOnRock(BREAD_PAD, 'raw');
    carry(raw.store);
    const coal = cookOnRock(BREAD_PAD, 'seconds', 60);
    carry(coal.store);
    const t = score([toast.body], 'ch1_crunchy_hot');
    const r = score([raw.body], 'ch1_crunchy_hot');
    const c = score([coal.body], 'ch1_crunchy_hot');
    console.info(`crunchy hot: perfect=${t.score}/${t.tier} raw=${r.score}/${r.tier} burnt=${c.score}/${c.tier}`);
    expect(t.score).toBeGreaterThanOrEqual(65);
    expect(r.score).toBeLessThan(40);
    expect(c.score).toBeLessThan(t.score - 20);
  });

  it('tall tower: three stacked mushroom halves >= 65, a single raw mushroom is not', () => {
    const store = new FoodStore();
    const halves: FoodBody[] = [];
    for (let k = 0; k < 3; k++) {
      const m = cookOnRock(MUSHROOM_PAD, 'perfect');
      const piece = cutBody(m.store, m.body, { n: [1, 0, 0], d: m.body.origin[0] + 4 }, 24);
      const half = m.store.get(piece.created[0]!)!;
      const copy = store.create([...half.dims], [0, 0, 100]);
      copy.material.set(half.material);
      copy.doneness = half.doneness!.slice();
      copy.char = half.char!.slice();
      copy.temp = half.temp!.slice();
      copy.origin[1] = restingOriginY(store, copy);
      halves.push(copy);
    }
    for (let i = 0; i < CARRY_STEPS; i++) heatStep(store, []);
    const tower = score(halves, 'ch1_tall_tower');
    const single = score([cookOnRock(MUSHROOM_PAD, 'raw').body], 'ch1_tall_tower');
    console.info(`tall tower: tower=${tower.score}/${tower.tier} single raw=${single.score}/${single.tier}`);
    expect(tower.score).toBeGreaterThanOrEqual(65);
    expect(single.score).toBeLessThan(40);
  });

  it('a raw potato is never better than a cooked one for the seared craving', () => {
    const raw = cookOnRock(POTATO_PAD, 'raw');
    const cooked = cookOnRock(POTATO_PAD, 'perfect');
    expect(score([cooked.body], 'ch1_seared_mushroom').score).toBeGreaterThanOrEqual(score([raw.body], 'ch1_seared_mushroom').score);
    expect(bottomCells(cooked.body).length).toBeGreaterThan(0);
  });
});
