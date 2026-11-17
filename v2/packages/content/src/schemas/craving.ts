import { z } from 'zod';

export const CRAVING_AXES = [
  'flavor.sweet',
  'flavor.salty',
  'flavor.sour',
  'flavor.bitter',
  'flavor.umami',
  'flavor.spicy',
  'texture.crunchy',
  'texture.creamy',
  'texture.chewy',
  'texture.juicy',
  'temp',
  'shape.height',
  'doneness.perfect',
] as const;

const axis = z.enum(CRAVING_AXES);
const unit = z.number().min(0).max(1);

export const CravingSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/, 'expected snake_case'),
  prompt: z.string().min(1),
  window: z.number().positive(),
  requirements: z
    .array(z.object({ axis, min: unit.optional(), max: unit.optional(), weight: z.number().positive() }))
    .min(1),
  bonuses: z.array(z.object({ axis, min: unit.optional(), max: unit.optional(), reward: z.number().min(0).max(1), hint: z.string() })),
  minVolume: z.number().min(0),
});

export type Craving = z.infer<typeof CravingSchema>;
export type CravingAxis = (typeof CRAVING_AXES)[number];
