import { MaterialSchema, type Material } from '../../schemas/material.js';
import ash from './ash.json';
import breadRock from './bread_rock.json';
import cheese from './cheese.json';
import herbMoss from './herb_moss.json';
import mushroom from './mushroom.json';
import pepper from './pepper.json';
import potato from './potato.json';
import stone from './stone.json';

const raw: unknown[] = [mushroom, breadRock, cheese, pepper, potato, herbMoss, stone, ash];

/** Validated at module load (parse throws with a precise path on bad data). */
export const materials: readonly Material[] = raw.map((m) => MaterialSchema.parse(m));
