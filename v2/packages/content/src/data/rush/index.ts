import { ItemDefSchema, LayoutSchema, LevelSchema, RecipeSchema, StationDefSchema } from '../../schemas/rush.js';
import type { ItemDef, Layout, LevelData, Recipe, StationDef } from '../../schemas/rush.js';
import itemsJson from './items.json';
import stationsJson from './stations.json';
import recipesJson from './recipes.json';
import l01Level from './levels/l01_kiosque/level.json';
import l01Layout from './levels/l01_kiosque/layout.json';

/** Validated at module load. */
export const rushItems: ItemDef[] = itemsJson.map((i) => ItemDefSchema.parse(i));
export const rushStations: StationDef[] = stationsJson.map((s) => StationDefSchema.parse(s));
export const rushRecipes: Recipe[] = recipesJson.map((r) => RecipeSchema.parse(r));

export interface RushLevel {
  level: LevelData;
  layout: Layout;
}

export const rushLevels: RushLevel[] = [{ level: LevelSchema.parse(l01Level), layout: LayoutSchema.parse(l01Layout) }];

export const rushItemById = new Map(rushItems.map((i) => [i.id, i]));
export const rushStationById = new Map(rushStations.map((s) => [s.id, s]));
export const rushRecipeById = new Map(rushRecipes.map((r) => [r.id, r]));

export function rushLevelById(id: string): RushLevel | undefined {
  return rushLevels.find((l) => l.level.id === id);
}

/** Cross-reference errors (unknown ids). Empty when the data is consistent. Used by `validate` and tests. */
export function rushCrossCheck(): string[] {
  const errors: string[] = [];
  const need = (set: Map<string, unknown>, id: string, where: string): void => {
    if (!set.has(id)) errors.push(`${where}: unknown id "${id}"`);
  };
  if (rushItemById.size !== rushItems.length) errors.push('duplicate item id');
  if (rushRecipeById.size !== rushRecipes.length) errors.push('duplicate recipe id');
  for (const i of rushItems) {
    if (i.chop) need(rushItemById, i.chop, `item ${i.id}.chop`);
    if (i.cook) {
      need(rushItemById, i.cook.result, `item ${i.id}.cook.result`);
      need(rushStationById, i.cook.station, `item ${i.id}.cook.station`);
    }
  }
  for (const r of rushRecipes) {
    need(rushItemById, r.container, `recipe ${r.id}.container`);
    for (const c of r.components) need(rushItemById, c, `recipe ${r.id}`);
  }
  for (const { level, layout } of rushLevels) {
    for (const r of level.recipes) need(rushRecipeById, r, `level ${level.id}`);
    const ids = new Set<string>();
    for (const s of layout.stations) {
      if (ids.has(s.id)) errors.push(`level ${level.id}: duplicate station ${s.id}`);
      ids.add(s.id);
      need(rushStationById, s.def, `level ${level.id} station ${s.id}`);
      if (s.dispenses) need(rushItemById, s.dispenses, `level ${level.id} station ${s.id}`);
    }
    if (!layout.stations.some((s) => s.def === 'pass')) errors.push(`level ${level.id}: no pass`);
    for (const [b, stars] of Object.entries(level.stars)) {
      if (!(stars[0] < stars[1] && stars[1] < stars[2])) errors.push(`level ${level.id}: stars for ${b} not ascending`);
    }
  }
  return errors;
}
