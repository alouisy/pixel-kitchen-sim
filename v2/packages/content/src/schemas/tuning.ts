import { z } from 'zod';

/** Game-flow numbers (docs/v2/03 §3). Read by the sim; edit the JSON, not the code. */
export const GameTuningSchema = z.object({
  serviceSeconds: z.number().positive(),
  /** Score needed for 1, 2 and 3 stars. */
  stars: z.tuple([z.number().positive(), z.number().positive(), z.number().positive()]),
  belly: z.object({
    start: z.number().min(0).max(100),
    drainPerSecond: z.number().min(0),
    bandContent: z.number(),
    bandPeckish: z.number(),
    bandHungry: z.number(),
    maxRefill: z.number().positive(),
    cellsPerBelly: z.number().positive(),
  }),
  patience: z.number().int().min(1),
  mood: z.object({
    expire: z.number(),
    perfect: z.number(),
    great: z.number(),
    okay: z.number(),
    yuck: z.number(),
    hangry: z.number(),
  }),
  timeBonusCap: z.number().min(0),
  cutting: z.object({
    minCutCells: z.number().int().min(1),
    crumbCells: z.number().int().min(1),
    cooldownSeconds: z.number().min(0),
  }),
  tutorial: z.object({ doneSeconds: z.number().min(0) }),
});

export type GameTuning = z.infer<typeof GameTuningSchema>;
