import { materialByIndex, type Craving, type CravingAxis } from '@ga/content';
import { TEMP_SCALE, type FoodBody } from './body.js';
import { ASH_INDEX } from './materialTable.js';
import { surfaceMask } from './surface.js';

export type Tier = 'perfect' | 'great' | 'okay' | 'yuck';

export interface DishEvaluation {
  profile: Record<CravingAxis, number>;
  quality: number;
  grossness: number;
  score: number;
  tier: Tier;
  highlights: string[];
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const bell = (x: number, mu: number, w: number) => {
  const t = (x - mu) / w;
  return Math.max(0, 1 - t * t);
};
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function fit(v: number, min: number | undefined, max: number | undefined): number {
  if (min !== undefined && v < min) return Math.max(0, 1 - (min - v) / 0.25);
  if (max !== undefined && v > max) return Math.max(0, 1 - (v - max) / 0.25);
  return 1;
}

/** Surface cells at or above this doneness count as "cooked" when judging the sear. */
export const COOKED_SURFACE_D = 0.5;
/** The sear check forgives a doneness this far outside the material's perfect band (the gauge itself does not). */
export const SEAR_TOLERANCE = 0.05;
/** A sear covering at least this share of the surface counts as full coverage. */
export const SEAR_FULL_COVERAGE = 0.15;

/**
 * 0..1: share of the cooked surface that sits in the material's perfect band, scaled down when only a sliver of the
 * surface is cooked at all. Raw food scores 0; burnt food scores 0 (its cooked cells are all past the band).
 */
function searScore(cookedSurf: number, perfectSurf: number, surfN: number): number {
  if (cookedSurf === 0 || surfN === 0) return 0;
  const coverage = Math.min(1, cookedSurf / (SEAR_FULL_COVERAGE * surfN));
  return (perfectSurf / cookedSurf) * coverage;
}

export function evaluateDish(bodies: readonly FoodBody[], craving: Craving): DishEvaluation {
  const fl = { sweet: 0, salty: 0, sour: 0, bitter: 0, umami: 0, spicy: 0 };
  const tx = { crunchy: 0, creamy: 0, chewy: 0, juicy: 0 };
  let solid = 0;
  let edibleN = 0;
  let inedible = 0;
  let ashN = 0;
  let tempSum = 0;
  let cookedSurf = 0;
  let perfectSurf = 0;
  let charSum = 0;
  let surfN = 0, coreN = 0;
  let surfCrunch = 0, coreCrunch = 0, surfJuicy = 0, coreJuicy = 0, surfD = 0, coreD = 0;
  let minY = 1e9, maxY = -1e9;

  for (const body of bodies) {
    const [dx, dy] = body.dims;
    const surf = surfaceMask(body);
    const mat = body.material;
    for (let i = 0; i < mat.length; i++) {
      const mi = mat[i]!;
      if (mi === 0) continue;
      solid++;
      const y = body.origin[1] + (Math.floor(i / dx) % dy);
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (mi === ASH_INDEX) ashN++;
      const m = materialByIndex(mi);
      if (!m || !m.edible) {
        inedible++;
        continue;
      }
      edibleN++;
      const d = body.doneness ? body.doneness[i]! / 255 : 0;
      const c = body.char ? body.char[i]! / 255 : 0;
      const isSurf = surf[i] === 1;
      const f = m.flavor;
      const t = m.texture;
      fl.sweet += (f.sweet ?? 0) + (f.sweet !== undefined && f.sweet > 0 ? 0.2 * bell(d, 0.7, 0.2) : 0);
      fl.salty += f.salty ?? 0;
      fl.sour += f.sour ?? 0;
      fl.bitter += (f.bitter ?? 0) + 0.9 * c;
      fl.umami += (f.umami ?? 0) + 0.3 * bell(d, 0.65, 0.2);
      fl.spicy += f.spicy ?? 0;
      let crunchy = (t.crunchy ?? 0) + (isSurf ? 0.6 * smoothstep(0.75, 0.95, d) : 0);
      const juicy = Math.max(0, (t.juicy ?? 0) - 0.8 * smoothstep(0.85, 1, d));
      if (crunchy < 0) crunchy = 0;
      tx.crunchy += crunchy;
      tx.creamy += t.creamy ?? 0;
      tx.chewy += t.chewy ?? 0;
      tx.juicy += juicy;
      if (body.temp) tempSum += body.temp[i]!;
      charSum += c;
      if (isSurf) {
        // Sear coverage is judged on the surface only: the core of a thick piece legitimately stays less cooked.
        if (d >= COOKED_SURFACE_D) {
          cookedSurf++;
          if (d >= m.thermal.perfect[0] - SEAR_TOLERANCE && d <= m.thermal.perfect[1] + SEAR_TOLERANCE) perfectSurf++;
        }
        surfN++;
        surfCrunch += crunchy;
        surfJuicy += juicy;
        surfD += d;
      } else {
        coreN++;
        coreCrunch += crunchy;
        coreJuicy += juicy;
        coreD += d;
      }
    }
  }

  const e = edibleN || 1;
  const height = solid ? maxY - minY + 1 : 0;
  const tempC = tempSum / e / TEMP_SCALE;
  const profile: Record<CravingAxis, number> = {
    'flavor.sweet': clamp(fl.sweet / e, 0, 1),
    'flavor.salty': clamp(fl.salty / e, 0, 1),
    'flavor.sour': clamp(fl.sour / e, 0, 1),
    'flavor.bitter': clamp(fl.bitter / e, 0, 1),
    'flavor.umami': clamp(fl.umami / e, 0, 1),
    'flavor.spicy': clamp(fl.spicy / e, 0, 1),
    'texture.crunchy': clamp(tx.crunchy / e, 0, 1),
    'texture.creamy': clamp(tx.creamy / e, 0, 1),
    'texture.chewy': clamp(tx.chewy / e, 0, 1),
    'texture.juicy': clamp(tx.juicy / e, 0, 1),
    temp: edibleN ? clamp(tempC / 60, 0, 1) : 0,
    'shape.height': clamp(height / 32, 0, 1),
    'doneness.perfect': searScore(cookedSurf, perfectSurf, surfN),
  };

  const grossShare = solid ? inedible / solid : 0;
  const charShare = edibleN ? charSum / edibleN : 0;
  const grossness = clamp(grossShare * 2 + charShare * 1.2, 0, 1);

  const contrast =
    coreN > 0 && surfN > 0
      ? Math.abs(surfCrunch / surfN - coreCrunch / coreN) + Math.abs(surfJuicy / surfN - coreJuicy / coreN)
      : 0;
  const quality = 0.5 * profile['doneness.perfect'] + 0.3 * Math.min(1, contrast) + 0.2 * profile.temp;

  let wSum = 0;
  let wFit = 0;
  for (const r of craving.requirements) {
    wSum += r.weight;
    wFit += r.weight * fit(profile[r.axis], r.min, r.max);
  }
  const reqScore = wSum > 0 ? wFit / wSum : 0;
  let score = 100 * reqScore * (0.7 + 0.3 * quality) * (1 - 0.7 * grossness);
  for (const b of craving.bonuses) if (fit(profile[b.axis], b.min, b.max) === 1) score += b.reward * 100;

  const highlights: string[] = [];
  if (solid < craving.minVolume * 64) {
    score *= 0.5;
    highlights.push('TOO_SMALL');
  }
  if (profile['doneness.perfect'] >= 0.7) highlights.push('PERFECT_SEAR');
  if (coreN > 0 && surfN > 0 && coreD / coreN < 0.2 && surfD / surfN > 0.6) highlights.push('RAW_CENTER');
  if (solid > 0 && ashN / solid > 0.5) highlights.push('MOSTLY_ASH');
  if (height >= 24) highlights.push('TALL_TOWER');
  if (profile['flavor.spicy'] > 0.8) highlights.push('TOO_SPICY');

  score = Math.round(score);
  const tier: Tier = score >= 85 ? 'perfect' : score >= 65 ? 'great' : score >= 40 ? 'okay' : 'yuck';
  return { profile, quality, grossness, score, tier, highlights };
}
