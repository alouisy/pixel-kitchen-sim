import { z } from 'zod';

const unit = z.number().min(0).max(1);
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'expected #rrggbb');

export const MaterialSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/, 'expected snake_case'),
  index: z.number().int().min(1).max(255),
  flavor: z
    .object({
      sweet: unit,
      salty: unit,
      sour: unit,
      bitter: unit,
      umami: unit,
      spicy: unit,
    })
    .partial(),
  texture: z.object({ crunchy: unit, creamy: unit, chewy: unit, juicy: unit }).partial(),
  thermal: z.object({
    conductivity: z.number().int().min(1).max(64),
    cookStart: z.number(),
    perfect: z
      .tuple([unit, unit])
      .refine(([lo, hi]) => lo < hi, 'perfect[0] must be < perfect[1]'),
    charStart: unit,
  }),
  flammability: unit,
  density: z.number().positive(),
  colors: z.object({ raw: hex, cooked: hex, charred: hex }),
  cutSfx: z.enum(['soft', 'crisp', 'hard', 'squishy']),
  edible: z.boolean(),
  harvestable: z.boolean().default(false),
});

export type Material = z.infer<typeof MaterialSchema>;
