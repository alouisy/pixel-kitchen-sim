import { MaterialSchema } from './schemas/material.js';
import { materials } from './data/materials/index.js';

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

if (errors.length > 0) {
  for (const e of errors) console.error(`ERROR ${e}`);
  process.exit(1);
}
console.log(`content OK: ${materials.length} materials (${materials.map((m) => m.id).join(', ')})`);
