import { describe, expect, it } from 'vitest';
import { GameTuningSchema, MaterialSchema, gameTuning, materials } from './index.js';

describe('materials', () => {
  it('all bundled materials pass the schema with unique ids and indices', () => {
    expect(materials.length).toBe(8);
    for (const m of materials) expect(MaterialSchema.safeParse(m).success).toBe(true);
    expect(new Set(materials.map((m) => m.id)).size).toBe(materials.length);
    expect(new Set(materials.map((m) => m.index)).size).toBe(materials.length);
  });
  it('rejects bad data', () => {
    expect(MaterialSchema.safeParse({ ...materials[0], id: 'Bad Id' }).success).toBe(false);
    expect(
      MaterialSchema.safeParse({ ...materials[0], thermal: { ...materials[0]!.thermal, perfect: [0.8, 0.5] } }).success,
    ).toBe(false);
  });
});

describe('game tuning', () => {
  it('loads with ascending star thresholds and the briefed numbers', () => {
    expect(GameTuningSchema.safeParse(gameTuning).success).toBe(true);
    expect(gameTuning.stars).toEqual([300, 600, 900]);
    expect(gameTuning.serviceSeconds).toBe(180);
    expect(gameTuning.patience).toBe(3);
    expect(gameTuning.cutting).toMatchObject({ minCutCells: 48, crumbCells: 24, cooldownSeconds: 0.35 });
    expect(GameTuningSchema.safeParse({ ...gameTuning, stars: [1, 2] }).success).toBe(false);
  });
});

describe('rush content', () => {
  it('parses and cross-references', async () => {
    const m = await import('./index.js');
    expect(m.rushCrossCheck()).toEqual([]);
    expect(m.rushRecipes.length).toBe(13);
    expect(m.rushRecipeById.get('french_fries')?.components).toEqual(['cooked_fries']);
    const l1 = m.rushLevelById('l01_kiosque')!;
    expect(l1.level.durationSeconds).toBe(180);
    expect(l1.layout.stations.filter((s) => s.def === 'fryer').length).toBe(3);
  });
});
