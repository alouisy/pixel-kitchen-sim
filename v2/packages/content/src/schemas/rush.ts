import { z } from 'zod';

const id = z.string().regex(/^[a-z][a-z0-9_]*$/);

/** One thing a chef can hold. `chop` / `cook` describe how it turns into another item (data, so levels 2-10 are content work). */
export const ItemDefSchema = z.object({
  id,
  /** Result of chopping on a board. */
  chop: id.optional(),
  /** Result of an automatic station process. `burnWindow` seconds after cooking before it burns (0 = never burns). */
  cook: z
    .object({
      station: id,
      result: id,
      time: z.number().positive(),
      burnWindow: z.number().min(0),
    })
    .optional(),
  /** Finished component: may be put on a container when it can still lead to a recipe. */
  component: z.boolean(),
  /** Plate, bowl or cup. */
  container: z.boolean(),
});
export type ItemDef = z.infer<typeof ItemDefSchema>;

export const StationDefSchema = z.object({
  id,
  kind: z.enum(['counter', 'dispenser', 'processor', 'bin', 'pass']),
  /** Processors only: hold-to-chop board or automatic (fryer, stove...). */
  process: z.enum(['chop', 'auto']).optional(),
});
export type StationDef = z.infer<typeof StationDefSchema>;

export const RecipeSchema = z.object({
  id,
  container: id,
  /** Sorted set of finished components. Matching is exact on the set. */
  components: z.array(id).min(1),
  baseScore: z.number().int().positive(),
  /** Seconds before the ticket expires (before the player-count factor). */
  ticketTime: z.number().positive(),
  penalty: z.number().int().min(0),
  family: z.string(),
});
export type Recipe = z.infer<typeof RecipeSchema>;

export const BucketIdSchema = z.enum(['solo', 'duo', 'squad', 'party']);
export type BucketId = z.infer<typeof BucketIdSchema>;

const Stars = z.tuple([z.number().int().positive(), z.number().int().positive(), z.number().int().positive()]);

export const LevelSchema = z.object({
  id,
  nameKey: z.string(),
  durationSeconds: z.number().positive(),
  countdownSeconds: z.number().int().min(0),
  recipes: z.array(id).min(1),
  /** The second ticket waits for the first serve or this many seconds (the safe opening). */
  secondTicketAfterSeconds: z.number().min(0),
  pacing: z.object({
    minDelaySeconds: z.number().positive(),
    maxDelaySeconds: z.number().positive(),
    /** Percent chance of a rush burst when exactly one ticket is active. */
    burstChance: z.number().int().min(0).max(100),
    burstFactor: z.number().positive(),
    calmFactor: z.number().positive(),
    /** Base delay = clamp(avg ticket time * this, baseMin, baseMax). */
    baseFromTicketTime: z.number().positive(),
    baseMinSeconds: z.number().positive(),
    baseMaxSeconds: z.number().positive(),
  }),
  buckets: z.record(
    BucketIdSchema,
    z.object({
      players: z.tuple([z.number().int().min(1), z.number().int().min(1)]),
      rate: z.number().positive(),
      maxActive: z.number().int().min(1),
      ticketTimeMul: z.number().positive(),
    }),
  ),
  scoring: z.object({
    speedBonusCap: z.number().int().min(0),
    /** [consecutive on-time serves, multiplier in permille], ascending. */
    streakSteps: z.array(z.tuple([z.number().int().min(0), z.number().int().positive()])).min(1),
    expiredPenalty: z.number().int().min(0),
    wrongPenalty: z.number().int().min(0),
  }),
  stars: z.record(BucketIdSchema, Stars),
  tuning: z.object({
    chopSeconds: z.number().positive(),
    walkSpeed: z.number().positive(),
    dashSpeed: z.number().positive(),
    dashTicks: z.number().int().positive(),
    dashCooldownSeconds: z.number().positive(),
    reach: z.number().positive(),
    burnWarnSeconds: z.number().min(0),
  }),
});
export type LevelData = z.infer<typeof LevelSchema>;

export const LayoutStationSchema = z.object({
  id,
  def: id,
  /** Centre, metres. */
  x: z.number(),
  z: z.number(),
  w: z.number().positive(),
  d: z.number().positive(),
  /** Dispensers only. */
  dispenses: id.optional(),
  /** Enabled only from this bucket up (squad, party). Disabled ones behave as plain counters. */
  optional: BucketIdSchema.optional(),
});
export type LayoutStation = z.infer<typeof LayoutStationSchema>;

export const LayoutSchema = z.object({
  cell: z.number().positive(),
  bounds: z.object({ x0: z.number(), x1: z.number(), z0: z.number(), z1: z.number() }),
  stations: z.array(LayoutStationSchema).min(1),
  spawns: z.array(z.tuple([z.number(), z.number()])).min(1),
  /** Customer queue positions (render only), first = the one at the pass. */
  queue: z.array(z.tuple([z.number(), z.number()])),
});
export type Layout = z.infer<typeof LayoutSchema>;
