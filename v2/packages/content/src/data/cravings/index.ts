import { CravingSchema, type Craving } from '../../schemas/craving.js';
import crunchyHot from './ch1_crunchy_hot.json';
import searedMushroom from './ch1_seared_mushroom.json';
import tallTower from './ch1_tall_tower.json';

const raw: unknown[] = [searedMushroom, crunchyHot, tallTower];

/** Validated at module load. */
export const cravings: readonly Craving[] = raw.map((c) => CravingSchema.parse(c));
