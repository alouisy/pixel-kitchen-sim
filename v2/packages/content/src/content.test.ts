import { describe, expect, it } from 'vitest';
import { MaterialSchema, materials } from './index.js';

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
