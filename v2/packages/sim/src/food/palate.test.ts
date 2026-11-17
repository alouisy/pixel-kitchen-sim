import { describe, expect, it } from 'vitest';
import { cravings, materialById } from '@ga/content';
import { FoodStore, ensureThermal, evaluateDish, fillBox, type FoodBody } from './index.js';

const MUSH = materialById('mushroom')!.index;
const ASH = materialById('ash')!.index;
const craving = cravings.find((c) => c.id === 'ch1_seared_mushroom')!;

function dish(mat: number, doneness: number, char: number, temp = 0): FoodBody {
  const store = new FoodStore();
  const b = store.create([6, 4, 6], [0, 0, 0]);
  fillBox(b, [0, 0, 0], [5, 3, 5], mat);
  ensureThermal(b);
  b.doneness!.fill(doneness);
  b.char!.fill(char);
  b.temp!.fill(temp);
  return b;
}

describe('palate', () => {
  it('perfectly cooked beats raw and charred', () => {
    const perfect = evaluateDish([dish(MUSH, 170, 0, 200)], craving);
    const raw = evaluateDish([dish(MUSH, 0, 0)], craving);
    const charred = evaluateDish([dish(MUSH, 255, 255, 400)], craving);
    console.info(`palate: perfect=${perfect.score} raw=${raw.score} charred=${charred.score}`);
    expect(perfect.score).toBeGreaterThan(raw.score);
    expect(perfect.score).toBeGreaterThan(charred.score);
    expect(perfect.highlights).toContain('PERFECT_SEAR');
  });

  it('all ash is MOSTLY_ASH and yuck', () => {
    const r = evaluateDish([dish(ASH, 255, 255)], craving);
    expect(r.highlights).toContain('MOSTLY_ASH');
    expect(r.tier).toBe('yuck');
  });

  it('too small volume halves the score', () => {
    const store = new FoodStore();
    const b = store.create([2, 2, 2], [0, 0, 0]);
    fillBox(b, [0, 0, 0], [1, 1, 1], MUSH);
    expect(evaluateDish([b], craving).highlights).toContain('TOO_SMALL');
  });
});
