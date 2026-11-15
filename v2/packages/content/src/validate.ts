import { MaterialSchema } from './schemas/material.js';
import { CravingSchema } from './schemas/craving.js';
import { cravings } from './data/cravings/index.js';
import { materials } from './data/materials/index.js';
import { GameTuningSchema } from './schemas/tuning.js';
import tuning from './data/tuning/game.json';

const errors: string[] = [];
const ids = new Set<string>();
const indices = new Set<number>();

for (const m of materials) {
  const r = MaterialSchema.safeParse(m);
  if (!r.success) errors.push(`material ${m.id}: ${r.error.message}`);
  if (ids.has(m.id)) errors.push(`duplicate material id: ${m.id}`);
  if (indices.has(m.index)) errors.push(`duplicate material index: ${m.index} (${m.id})`);
  ids.add(m.id);
  indices.add(m.index);
}

const cravingIds = new Set<string>();
for (const c of cravings) {
  const r = CravingSchema.safeParse(c);
  if (!r.success) errors.push(`craving ${c.id}: ${r.error.message}`);
  if (cravingIds.has(c.id)) errors.push(`duplicate craving id: ${c.id}`);
  cravingIds.add(c.id);
}

{
  const r = GameTuningSchema.safeParse(tuning);
  if (!r.success) errors.push(`tuning: ${r.error.message}`);
}

if (errors.length > 0) {
  for (const e of errors) console.error(`ERROR ${e}`);
  process.exit(1);
}
console.log(`content OK: ${materials.length} materials (${materials.map((m) => m.id).join(', ')})`);
console.log(`content OK: ${cravings.length} cravings (${cravings.map((c) => c.id).join(', ')})`);
