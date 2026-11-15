import { materials } from './data/materials/index.js';
import type { Material } from './schemas/material.js';

const byId = new Map<string, Material>(materials.map((m) => [m.id, m]));
const byIndex = new Map<number, Material>(materials.map((m) => [m.index, m]));

export function materialById(id: string): Material | undefined {
  return byId.get(id);
}

export function materialByIndex(index: number): Material | undefined {
  return byIndex.get(index);
}
