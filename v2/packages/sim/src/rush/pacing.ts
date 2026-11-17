import type { LevelData, Recipe } from '@ga/content';
import type { Prng } from '@ga/shared';
import { SIM_HZ } from '@ga/shared';

/**
 * V1's calculateNextOrderDelay (src/LevelManager.js) on integer ticks and the shared PRNG.
 * base delay from the recipes' ticket time, rush burst (35 %) when one ticket is active, load easing, +-20 % jitter, clamp.
 */
export function nextOrderDelayTicks(
  level: LevelData,
  recipes: ReadonlyArray<Recipe>,
  bucket: LevelData['buckets'][keyof LevelData['buckets']],
  activeCount: number,
  rng: Prng,
): number {
  const p = level.pacing;
  let avg = 0;
  for (const r of recipes) avg += r.ticketTime;
  avg = recipes.length > 0 ? avg / recipes.length : 30;
  const base = Math.max(p.baseMinSeconds, Math.min(p.baseMaxSeconds, avg * p.baseFromTicketTime));
  let load = 1;
  if (activeCount === 1 && bucket.maxActive > 1) load = rng.int(0, 99) < p.burstChance ? p.burstFactor : p.calmFactor;
  else if (activeCount > 1) load = 1 + (activeCount / bucket.maxActive) * 0.3;
  const jitter = (800 + rng.int(0, 400)) / 1000;
  const sec = (base / bucket.rate) * load * jitter;
  const clamped = Math.max(p.minDelaySeconds, Math.min(p.maxDelaySeconds, sec));
  return Math.round(clamped * SIM_HZ);
}
