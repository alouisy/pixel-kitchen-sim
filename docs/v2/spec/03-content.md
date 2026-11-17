# 03 · Content: schemas, catalog, level formats, how-tos, validation

> Summary. This doc documents every zod schema in `v2/packages/content/src/schemas/` field by field, the full catalog of items, stations and recipes for V1's 13 recipes (as data tables matching `v2/packages/content/src/data/rush/*.json`), the exact `level.json` and `layout.json` formats with an annotated level 1, step-by-step how-tos (add a recipe, a station type, a level) and the validation rules.
> **Exists** = in the repo today. **Target** = must be added; every target field has a default so level 1 stays valid. The sim rules that use this data are in `02-simulation.md`.
> Tables of items, stations and recipes are authoritative copies of the JSON files; if they differ, the JSON files win and this doc is fixed in the same commit.

## Table of contents
1. Current state vs target
2. Zod schemas, field by field (rush)
3. Zod schemas of the archived food experiment (materials, cravings, tuning)
4. Catalog: items
5. Catalog: assemblies, blends, stations
6. Catalog: recipes and prep chains for the 13 recipes
7. `level.json` format
8. `layout.json` format
9. Annotated example: level 1 (`l01_kiosque`)
10. Validation rules
11. How-to: add a recipe
12. How-to: add a station type
13. How-to: add a level
14. File and loader map

---

## 1. Current state vs target

| Area | Exists | Target |
|---|---|---|
| Rush schemas | `ItemDef`, `StationDef`, `Recipe`, `LevelData`, `Layout`, `LayoutStation`, `BucketId` in `schemas/rush.ts` | adds `AssemblySchema`, `BlendSchema`; extends the others (all optional with defaults) |
| Data | 41 items, 13 stations, 13 recipes, 1 level (`l01_kiosque`) | + `assemblies.json`, `blends.json`, 9 more levels |
| Loader | `data/rush/index.ts` parses at module load; `rushLevels` is a hard-coded array of one level | a level registry with `LEVEL_ORDER` (`01 §7.2`); `rushLevelById` stays |
| Cross-check | `rushCrossCheck()` (unknown ids, duplicates, a pass, ascending stars) | the full rule list in section 10 |
| Validate script | `src/validate.ts` (materials, cravings, tuning, rush cross-check), exits 1 on errors | same script, more rules; run as `pnpm validate` in CI |

Level 1 bug note (details in `02 §19`): `layout.json` marks `board_2` and `fryer_3` `optional: "squad"`; this is valid data, but the client must draw disabled optional stations as counters. Content cannot fix it; rule 8 of section 10 prevents confusing layouts for new levels.

## 2. Zod schemas, field by field (rush)

All in `v2/packages/content/src/schemas/rush.ts`. `id` below means `z.string().regex(/^[a-z][a-z0-9_]*$/)` (lower snake_case, starts with a letter).

### 2.1 `ItemDefSchema` (exists) -> `ItemDef`

| Field | Type | Required | Meaning |
|---|---|---|---|
| `id` | `id` | yes | unique item id; also the asset key |
| `chop` | `id` | no | result def of chopping on a board (must exist) |
| `cook` | object | no | automatic process (below) |
| `cook.station` | `id` | yes in `cook` | station def id that runs it (must exist in `stations.json`) |
| `cook.result` | `id` | yes in `cook` | result item def |
| `cook.time` | number > 0 | yes in `cook` | seconds to cook (sim: `round(time*30)` ticks) |
| `cook.burnWindow` | number >= 0 | yes in `cook` | seconds after cooking before it burns; 0 = never burns |
| `component` | boolean | yes | finished component that may go on a container |
| `container` | boolean | yes | plate, bowl, cup, or a base |
| `base` (target) | boolean, default false | no | with `container`: a base that morphs through an assembly (pizza_base, bread_slice) |
| `tool` (target) | boolean, default false | no | tools (extinguisher): never component or container, shown differently |

Invariants (validated): `component && container` is not allowed; a `cook` item is neither `component` nor `container` (except `bread_slice`, a base with `cook`); `base` implies `container`; `chop` result must not be `component: false` without a `cook` unless it is an end item of an assembly input (validation rule 14).

### 2.2 `StationDefSchema` (exists) -> `StationDef`

| Field | Type | Required | Meaning |
|---|---|---|---|
| `id` | `id` | yes | station def id (also `ItemDef.cook.station`) |
| `kind` | enum | yes | exists: `counter dispenser processor bin pass`; target adds `sink planter dumbwaiter conveyor extinguisher return` (`02 §1`) |
| `process` | enum | no, processors only | exists: `chop auto`; target adds `multi` (blender) |
| `heat` (target) | boolean, default false | no | can ignite when an item burns on it (stove, fryer, toaster, oven) |
| `flammable` (target) | boolean, default derived | no | default true for `counter processor planter return`, false otherwise; used by fire spread (`02 §10.3`) |

### 2.3 `RecipeSchema` (exists) -> `Recipe`

| Field | Type | Required | Meaning |
|---|---|---|---|
| `id` | `id` | yes | unique recipe id (also the dish asset key and strings key `recipe.<id>`) |
| `container` | `id` | yes | item def of the container (`plate`, `bowl`, `cup`) |
| `components` | `id[]`, min 1 | yes | finished components; matched as a set (store sorted) |
| `baseScore` | int > 0 | yes | points before bonuses |
| `ticketTime` | number > 0 | yes | seconds before the ticket expires, before bucket and difficulty factors |
| `penalty` | int >= 0 | yes | reserved: the sim uses `level.scoring.expiredPenalty` (`02 §13.5`); keep equal to it |
| `family` | string | yes | grouping (`fries burger salad sandwich breakfast pizza`) |

### 2.4 `BucketIdSchema` (exists)
`z.enum(['solo', 'duo', 'squad', 'party'])`.

### 2.5 `LevelSchema` (exists) -> `LevelData`

| Field | Type | Meaning |
|---|---|---|
| `id` | `id` | `l<NN>_<slug>` (section 13) |
| `nameKey` | string | strings key, `level.l01.name` |
| `durationSeconds` | number > 0 | play time (ticks = `*30`) |
| `countdownSeconds` | int >= 0 | countdown before Go |
| `recipes` | `id[]`, min 1 | recipe ids available (ticket pool, file order matters for the PRNG) |
| `secondTicketAfterSeconds` | number >= 0 | safe opening: ticket 2 waits for a serve or this long |
| `pacing.minDelaySeconds` / `maxDelaySeconds` | number > 0 | clamp of the delay between tickets |
| `pacing.burstChance` | int 0..100 | percent chance of a burst when exactly one ticket is active |
| `pacing.burstFactor` | number > 0 | load factor on a burst (0.35) |
| `pacing.calmFactor` | number > 0 | load factor when no burst (0.75) |
| `pacing.baseFromTicketTime` | number > 0 | base delay = clamp(avg ticketTime * this, baseMin, baseMax) |
| `pacing.baseMinSeconds` / `baseMaxSeconds` | number > 0 | clamp of the base delay |
| `buckets` | record `BucketId -> {...}` | one entry per bucket (all four required by validation) |
| `buckets.<b>.players` | tuple `[int>=1, int>=1]` | inclusive player range |
| `buckets.<b>.rate` | number > 0 | order rate factor (divides the delay) |
| `buckets.<b>.maxActive` | int >= 1 | simultaneous tickets |
| `buckets.<b>.ticketTimeMul` | number > 0 | multiplies `recipe.ticketTime` |
| `scoring.speedBonusCap` | int >= 0 | cap of `floor(secondsLeft/2)` bonus |
| `scoring.streakSteps` | array of `[int>=0, int>0]`, min 1 | `[consecutive serves, multiplier permille]`, ascending |
| `scoring.expiredPenalty` | int >= 0 | points lost per expired ticket |
| `scoring.wrongPenalty` | int >= 0 | points lost per wrong dish |
| `stars` | record `BucketId -> [int>0, int>0, int>0]` | 1/2/3 star thresholds per bucket |
| `tuning.chopSeconds` | number > 0 | chop duration (1.6) |
| `tuning.walkSpeed` | number > 0 | m/s (4.0) |
| `tuning.dashSpeed` | number > 0 | m/s (9.5) |
| `tuning.dashTicks` | int > 0 | dash duration in ticks (7) |
| `tuning.dashCooldownSeconds` | number > 0 | 0.6 |
| `tuning.reach` | number > 0 | m (1.1) |
| `tuning.burnWarnSeconds` | number >= 0 | burning warning before burnt (2) |

Target additions to `LevelSchema` (all optional with the default shown; `01 §7.3` lists the first five):

| Field | Type | Default | Meaning |
|---|---|---|---|
| `order` | int 1..10 | required for campaign levels | campaign position |
| `mechanics` | `{ throw, wash, fire, harvest, feast: boolean }` | all false | verbs/systems active |
| `twist` | `{ kind: TwistKind; params: Record<string, int> }` | `{ kind: 'none', params: {} }` | signature mechanic (`02 §16`) |
| `camera` | `CameraSpec` | harbour values | fixed camera (`01 §10.5`) |
| `unlock` | `{ requires: id \| null; minStars: 0..3 }` | `{ requires: null, minStars: 0 }` | campaign gating (UI) |
| `tuning.washSeconds` | number > 0 | 2 | sink wash |
| `tuning.blendSeconds` | number > 0 | 4 | blender |
| `tuning.extinguishSeconds` | number > 0 | 1.5 | extinguisher |
| `dishes` | `{ mode: 'infinite'\|'cycle'; returnDelaySeconds: number; stock: { plate?: int; bowl?: int; cup?: int } }` | `{ mode: 'infinite', returnDelaySeconds: 8, stock: {} }` | dish cycle (`02 §11`) |
| `hazards` | `{ fire?: { igniteAfterBurntSeconds: number; spreadSeconds: number } }` | `{}` | fire parameters; required when `mechanics.fire` |
| `feast` | `{ every: int>=2; dishes: int 2..4; bonus: int>=0 }` | absent | feast tickets; required when `mechanics.feast` |

### 2.6 `LayoutStationSchema` (exists) -> `LayoutStation`

| Field | Type | Required | Meaning |
|---|---|---|---|
| `id` | `id` | yes | unique within the level; the sim and tests look stations up by id |
| `def` | `id` | yes | station def id |
| `x`, `z` | number | yes | centre, metres |
| `w`, `d` | number > 0 | yes | footprint width (x) and depth (z), metres |
| `dispenses` | `id` | dispensers/planters | item def produced |
| `optional` | `BucketId` | no | enabled only from this bucket up (squad, party); disabled = plain counter |
| `rot` (target) | 0, 90, 180, 270 | no | render only |
| `zone` (target) | string | no | multi-zone levels: camera and routing zone id |
| `props` (target) | record string -> int | no | integer params for the twist or station: `growSeconds`, `link`, `travelTicks`, `speed`, `length`, `loop`, `endStation`, `group` |

### 2.7 `LayoutSchema` (exists) -> `Layout`

| Field | Type | Meaning |
|---|---|---|
| `cell` | number > 0 | grid size, metres (0.5); all stations snap to it |
| `bounds` | `{ x0, x1, z0, z1 }` | playable rectangle |
| `stations` | `LayoutStation[]`, min 1 | order matters: it defines station indices and the tie-break of targeting |
| `spawns` | `[x, z][]`, min 1 | one per slot; validated: at least 6 |
| `queue` | `[x, z][]` | customer positions (render only), first = at the pass |
| `zones` (target) | `Array<{ id, box }>` | zone boxes for multi-zone levels |
| `blockers` (target) | `Array<{ id, box, group?: int }>` | hook-controlled no-go boxes (`02 §16`) |

`box` = `{ x0, x1, z0, z1 }`.

### 2.8 Target schemas

```ts
export const AssemblySchema = z.object({
  id,
  /** The base item def (container: true, base: true). */
  base: id,
  /** Components that complete the base (a set; stored sorted). */
  needs: z.array(id).min(1),
  /** The def the base becomes when complete. */
  result: id,
});
export const BlendSchema = z.object({
  id,
  /** Components in the blender (a set; stored sorted). */
  needs: z.array(id).min(1).max(4),
  result: id,
});
```
`CameraSpec` is defined in `01 §10.5`.

## 3. Zod schemas of the archived food experiment

These belong to the voxel food prototype (`packages/sim/src/food`, `kitchen`), which stays in the repo as an experiment and is not used by the rush game. They are documented for completeness; do not extend them.

### 3.1 `MaterialSchema` (`schemas/material.ts`)
| Field | Type | Meaning |
|---|---|---|
| `id` | snake_case string | material id |
| `index` | int 1..255 | palette index (unique) |
| `flavor` | partial `{ sweet, salty, sour, bitter, umami, spicy }`, each 0..1 | taste vector |
| `texture` | partial `{ crunchy, creamy, chewy, juicy }`, each 0..1 | texture vector |
| `thermal.conductivity` | int 1..64 | heat diffusion rate |
| `thermal.cookStart` | number | temperature where cooking starts |
| `thermal.perfect` | tuple `[lo, hi]` of 0..1, `lo < hi` | perfect doneness band |
| `thermal.charStart` | 0..1 | char threshold |
| `flammability` | 0..1 | |
| `density` | number > 0 | |
| `colors` | `{ raw, cooked, charred }` hex `#rrggbb` | colour ramp |
| `cutSfx` | `soft crisp hard squishy` | sound |
| `edible` | boolean | |
| `harvestable` | boolean, default false | |
Bundled: 8 (`ash potato cheese bread_rock herb_moss pepper mushroom stone`).

### 3.2 `CravingSchema` (`schemas/craving.ts`)
| Field | Type | Meaning |
|---|---|---|
| `id` | snake_case string | |
| `prompt` | non-empty string | strings key |
| `window` | number > 0 | seconds |
| `requirements` | array min 1 of `{ axis, min?, max?, weight > 0 }` | `axis` in `CRAVING_AXES` (13 axes: six flavors, four textures, `temp`, `shape.height`, `doneness.perfect`) |
| `bonuses` | array of `{ axis, min?, max?, reward 0..1, hint }` | |
| `minVolume` | number >= 0 | |
Bundled: 3 (`ch1_seared_mushroom ch1_tall_tower ch1_crunchy_hot`).

### 3.3 `GameTuningSchema` (`schemas/tuning.ts`)
`serviceSeconds`, `stars` (3 positive numbers), `belly` `{ start 0..100, drainPerSecond >= 0, bandContent, bandPeckish, bandHungry, maxRefill > 0, cellsPerBelly > 0 }`, `patience` int >= 1, `mood` `{ expire perfect great okay yuck hangry }`, `timeBonusCap >= 0`, `cutting` `{ minCutCells >= 1, crumbCells >= 1, cooldownSeconds >= 0 }`, `tutorial.doneSeconds >= 0`. Used by the experiment only; `pnpm validate` still parses it.

## 4. Catalog: items

`data/rush/items.json`, 41 items (exists). Columns: `chop` = result on the board; `cook` = `station -> result (time s, burn window s)`; Flags: C = component, K = container.

### 4.1 Raw ingredients (dispensed by crates)
| id | chop | cook | Flags |
|---|---|---|---|
| potato | raw_fries | | |
| tomato | chopped_tomato | | |
| lettuce | chopped_lettuce | | |
| onion | onion_rings_raw | | |
| banana | sliced_banana | | |
| strawberry | sliced_strawberry | | |
| raw_chicken | raw_chicken_strips | | |
| patty | | stove -> cooked_patty (6, 6) | |
| raw_bacon | | stove -> cooked_bacon (6, 6) | |
| bread_slice | | toaster -> toasted_bread (3, 4) | (target: K, base) |
| egg | | mixer -> omelette_mix (2, 0) | |
| pancake_mix | | mixer -> pancake_batter (2, 0) | |
| pizza_dough | | press -> pizza_base (2, 0) | |

### 4.2 Intermediates (made by chop or process)
| id | cook | Note |
|---|---|---|
| raw_fries | fryer -> cooked_fries (5, 6) | from potato |
| onion_rings_raw | coating -> onion_rings_coated (2, 0) | from onion |
| onion_rings_coated | fryer -> cooked_onion_rings (5, 6) | |
| raw_chicken_strips | coating -> coated_chicken_strips (2, 0) | from raw_chicken |
| coated_chicken_strips | fryer -> cooked_chicken_tenders (5, 6) | |
| omelette_mix | stove -> cooked_omelette (6, 6) | |
| pancake_batter | stove -> cooked_pancakes (6, 6) | |
| grilled_cheese_raw | stove -> grilled_cheese_cooked (6, 6) | made by assembly (5.1) |
| pizza_base | (target: K, base; no cook) | from press; becomes margherita raw by assembly |
| pizza_margherita_raw | oven -> cooked_pizza_margherita (12, 8) | made by assembly (5.1) |

### 4.3 Components (C)
`cooked_fries cooked_patty cooked_bacon toasted_bread cooked_onion_rings cooked_chicken_tenders cooked_omelette cooked_pancakes grilled_cheese_cooked cooked_pizza_margherita` (results of cooks), `chopped_tomato chopped_lettuce sliced_banana sliced_strawberry` (results of chops), and ready ingredients dispensed straight: `bun cheese_slice syrup milk yogurt granola tomato_sauce shredded_mozzarella`, plus `smoothie_ready` (made by the blender, 5.2).

### 4.4 Containers (K) and tools
`plate`, `bowl`, `cup` (K). Target: `pizza_base`, `bread_slice` (K + base), `extinguisher` (tool).

## 5. Catalog: assemblies, blends, stations

### 5.1 Assemblies (target, `data/rush/assemblies.json`)
| id | base | needs | result |
|---|---|---|---|
| pizza_raw | pizza_base | shredded_mozzarella, tomato_sauce | pizza_margherita_raw |
| grilled_cheese_assembly | bread_slice | cheese_slice | grilled_cheese_raw |

```json
[
  { "id": "pizza_raw", "base": "pizza_base", "needs": ["shredded_mozzarella", "tomato_sauce"], "result": "pizza_margherita_raw" },
  { "id": "grilled_cheese_assembly", "base": "bread_slice", "needs": ["cheese_slice"], "result": "grilled_cheese_raw" }
]
```

### 5.2 Blends (target, `data/rush/blends.json`)
```json
[
  { "id": "smoothie_milk", "needs": ["milk", "sliced_banana", "sliced_strawberry"], "result": "smoothie_ready" },
  { "id": "smoothie_yogurt", "needs": ["sliced_banana", "sliced_strawberry", "yogurt"], "result": "smoothie_ready" }
]
```
(V1: required banana + strawberry + milk, with yogurt interchangeable with milk.) The blender is `kind: processor, process: multi`.

### 5.3 Stations (`data/rush/stations.json`; the first 13 exist)
| id | kind | process | heat | Notes |
|---|---|---|---|---|
| crate | dispenser | | | ingredient crate; the layout names what it `dispenses` |
| plates | dispenser | | | plate/bowl/cup stacks (def `plates`; the layout `dispenses` plate/bowl/cup); same def for all three |
| counter | counter | | | any item |
| board | processor | chop | | 48 ticks |
| fryer | processor | auto | yes | |
| stove | processor | auto | yes | V1 stove top, grill, griddle |
| toaster | processor | auto | yes | |
| oven | processor | auto | yes | pizza |
| coating | processor | auto | | V1 coating station (no coating mix item in V2) |
| mixer | processor | auto | | V1 stand mixer |
| press | processor | auto | | V1 dough press |
| bin | bin | | | |
| pass | pass | | | |
| blender (target) | processor | multi | | |
| sink (target) | sink | | | |
| plate_return (target) | return | | | |
| extinguisher (target) | extinguisher | | | |
| planter (target) | planter | | | |
| conveyor (target) | conveyor | | | |
| dumbwaiter (target) | dumbwaiter | | | |

Station -> level introduction (`design/06 §3`): L1 crate board fryer plates bin pass counter; L2 stove; L3 (throw); L4 blender sink plate_return; L5 oven press dumbwaiter; L6 coating extinguisher; L7 toaster; L8 mixer; L9 planter; L10 conveyor. Cup/bowl stacks use `plates` with `dispenses: cup|bowl`.

## 6. Catalog: recipes and prep chains for the 13 recipes

`data/rush/recipes.json` (exists, 13 recipes). `Score` = `baseScore`, `Time` = `ticketTime` (s), `Pen` = `penalty`. V1 columns are from `src/gameData.js` (timeLimit s / baseScore) for reference; V2 values are the data.

| id | container | components | Score | Time | Pen | family | V1 time/score |
|---|---|---|---|---|---|---|---|
| french_fries | plate | cooked_fries | 100 | 48 | 50 | fries | 75 / 60 |
| salad | plate | chopped_lettuce, chopped_tomato | 110 | 60 | 50 | salad | 90 / 75 |
| hamburger | plate | bun, cooked_patty | 130 | 70 | 50 | burger | 100 / 100 |
| cheeseburger_combo | plate | bun, cheese_slice, cooked_fries, cooked_patty | 160 | 90 | 50 | burger | 130 / 120 |
| onion_rings | plate | cooked_onion_rings | 110 | 56 | 50 | fries | 80 / 70 |
| chicken_tenders_fries | plate | cooked_chicken_tenders, cooked_fries | 150 | 84 | 50 | fries | 120 / 120 |
| blt_sandwich | plate | chopped_lettuce, chopped_tomato, cooked_bacon, toasted_bread | 150 | 84 | 50 | sandwich | 120 / 110 |
| grilled_cheese_sandwich | plate | grilled_cheese_cooked | 110 | 60 | 50 | sandwich | 85 / 80 |
| pancakes | plate | cooked_pancakes, syrup | 120 | 84 | 50 | breakfast | 120 / 90 |
| cheese_omelette | plate | cheese_slice, cooked_omelette | 110 | 64 | 50 | breakfast | 90 / 80 |
| fruit_yogurt_bowl | bowl | granola, sliced_banana, sliced_strawberry, yogurt | 110 | 50 | 50 | breakfast | 70 / 70 |
| smoothie | cup | smoothie_ready | 100 | 42 | 50 | breakfast | 60 / 65 |
| pizza_margherita | plate | cooked_pizza_margherita | 180 | 105 | 50 | pizza | 150 / 150 |

(Components are stored sorted.)

### 6.1 Prep chains (the route a player takes; stations in order)

Notation: `source` = crate, `board` = chop (hold X, 1.6 s), `X(t)` = auto cook with time t s, `[b]` burn window s, `plate` = add to container, `pass` = serve.

| Recipe | Chain per component |
|---|---|
| french_fries | potato crate -> board (raw_fries) -> fryer (cooked_fries 5 [6]) -> plate -> pass |
| salad | lettuce crate -> board (chopped_lettuce) ; tomato crate -> board (chopped_tomato) ; both -> plate -> pass |
| hamburger | patty crate -> stove (cooked_patty 6 [6]) ; bun crate (bun) ; both -> plate -> pass |
| cheeseburger_combo | hamburger chain + cheese crate (cheese_slice) + fries chain; all four -> plate -> pass |
| onion_rings | onion crate -> board (onion_rings_raw) -> coating (onion_rings_coated 2) -> fryer (cooked_onion_rings 5 [6]) -> plate -> pass |
| chicken_tenders_fries | raw_chicken crate -> board (raw_chicken_strips) -> coating (coated_chicken_strips 2) -> fryer (cooked_chicken_tenders 5 [6]) ; fries chain ; both -> plate -> pass |
| blt_sandwich | bread_slice crate -> toaster (toasted_bread 3 [4]) ; raw_bacon crate -> stove (cooked_bacon 6 [6]) ; lettuce -> board ; tomato -> board ; all four -> plate -> pass |
| grilled_cheese_sandwich | bread_slice crate + cheese_slice crate -> combine on the bread (assembly `grilled_cheese_assembly` -> grilled_cheese_raw) -> stove (grilled_cheese_cooked 6 [6]) -> plate -> pass |
| pancakes | pancake_mix crate -> mixer (pancake_batter 2) -> stove (cooked_pancakes 6 [6]) ; syrup crate (syrup) ; both -> plate -> pass |
| cheese_omelette | egg crate -> mixer (omelette_mix 2) -> stove (cooked_omelette 6 [6]) ; cheese crate ; both -> plate -> pass |
| fruit_yogurt_bowl | banana -> board (sliced_banana) ; strawberry -> board (sliced_strawberry) ; yogurt crate ; granola crate ; all four -> bowl -> pass |
| smoothie | banana -> board ; strawberry -> board ; milk (or yogurt) crate ; the three into the blender (4 s) -> smoothie_ready -> cup (scoop) -> pass |
| pizza_margherita | pizza_dough crate -> press (pizza_base 2) ; tomato_sauce crate ; mozzarella crate ; sauce + mozzarella onto the base (assembly `pizza_raw`) -> oven (cooked_pizza_margherita 12 [8]) -> plate -> pass |

Family reuse (design rule: each new recipe reuses at least 50 % of a known chain): fries -> onion rings (+ coating) -> tenders & fries (+ chicken); hamburger -> cheeseburger_combo (+ cheese + fries); salad -> BLT; omelette -> pancakes (mixer -> stove).

### 6.2 Crate dispensers by level (`dispenses` values)
Every raw ingredient and ready component not produced by a process needs a crate (or planter on level 9): `potato tomato lettuce onion banana strawberry raw_chicken patty raw_bacon bread_slice egg pancake_mix pizza_dough bun cheese_slice syrup milk yogurt granola tomato_sauce shredded_mozzarella`. Stacks: `plate`, `bowl`, `cup` via `plates`.

## 7. `level.json` format

File: `v2/packages/content/src/data/rush/levels/<levelId>/level.json`. Parsed by `LevelSchema`. Real JSON (no comments). Field semantics are in section 2.5. Rules of thumb:
- `recipes`: ids from `recipes.json`; every recipe must be buildable from the level's stations (validation rule 12).
- `pacing`: copy level 1 (`1.5 / 25 / 35 / 0.35 / 0.75 / 0.3 / 4 / 15`) unless playtests say otherwise.
- `buckets`: `solo [1,1]`, `duo [2,2]`, `squad [3,4]`, `party [5,6]`; ranges must be contiguous and cover exactly 1..6.
- `scoring`: `speedBonusCap 30`, `streakSteps [[0,1000],[3,1250],[6,1500],[10,2000]]`, penalties 50 and 20.
- `stars`: per bucket (`02 §14.5` for how to set them).
- `tuning`: copy level 1; per-level changes are allowed but the walk and dash numbers should stay equal across the campaign so skills carry over.

## 8. `layout.json` format

File: `.../<levelId>/layout.json`. Parsed by `LayoutSchema`. Coordinates: metres; x to the right, z towards the viewer (screen down); the origin is the centre of the playable area. Rules:
1. Everything snaps to `cell` (0.5 m): `x, z` of a 1 x 1 station are on `.5` or `.0` multiples of 0.5; `w, d` multiples of 0.5.
2. `stations` are listed in a stable, meaningful order: indices drive targeting tie-breaks (lower index wins). Never place two stations so that a chef at their seam is equally near and the lower index is the wrong one (`02 §19` B3): separate the bin and a dispenser by at least one counter.
3. Main corridors are at least 2 chef widths (1.4 m) wide.
4. `spawns`: at least 6, on free floor, at least 0.8 m apart.
5. Optional stations (`optional`) are grouped at the end of a row, and a disabled optional station must still look correct as a counter (render rule).
6. `queue`: customer positions beyond the pass, render only.

## 9. Annotated example: level 1 (`l01_kiosque`)

### 9.1 `level.json` (comments are explanatory; the real file has none)
```jsonc
{
  "id": "l01_kiosque",                 // folder name; also the registry key
  "nameKey": "level.l01.name",         // strings table key
  "durationSeconds": 180,              // 5400 ticks of play
  "countdownSeconds": 3,               // 90 ticks before Go
  "recipes": ["french_fries"],         // ticket pool; one recipe on level 1
  "secondTicketAfterSeconds": 25,      // ticket 2 after a serve, a miss, or 25 s
  "pacing": {
    "minDelaySeconds": 1.5, "maxDelaySeconds": 25,
    "burstChance": 35, "burstFactor": 0.35, "calmFactor": 0.75,
    "baseFromTicketTime": 0.3, "baseMinSeconds": 4, "baseMaxSeconds": 15
  },
  "buckets": {                         // player-count scaling (02 section 15)
    "solo":  { "players": [1, 1], "rate": 0.55, "maxActive": 2, "ticketTimeMul": 1.25 },
    "duo":   { "players": [2, 2], "rate": 1.0,  "maxActive": 2, "ticketTimeMul": 1.0 },
    "squad": { "players": [3, 4], "rate": 1.6,  "maxActive": 3, "ticketTimeMul": 0.95 },
    "party": { "players": [5, 6], "rate": 2.2,  "maxActive": 4, "ticketTimeMul": 0.9 }
  },
  "scoring": {
    "speedBonusCap": 30,
    "streakSteps": [[0, 1000], [3, 1250], [6, 1500], [10, 2000]],   // [serves in a row, permille]
    "expiredPenalty": 50, "wrongPenalty": 20
  },
  "stars": {
    "solo": [740, 1350, 1850], "duo": [1200, 2200, 3000],
    "squad": [1800, 3300, 4500], "party": [2400, 4400, 6000]
  },
  "tuning": {
    "chopSeconds": 1.6, "walkSpeed": 4.0, "dashSpeed": 9.5, "dashTicks": 7,
    "dashCooldownSeconds": 0.6, "reach": 1.1, "burnWarnSeconds": 2
  },

  // ---- target fields (absent in today's file; defaults make level 1 identical) ----
  "order": 1,
  "mechanics": { "throw": false, "wash": false, "fire": false, "harvest": false, "feast": false },
  "twist": { "kind": "none", "params": {} },
  "camera": { "position": [0, 9, 8], "target": [0, 0, 0], "fov": 38, "lean": 0.2 },   // use the harbour values from render
  "unlock": { "requires": null, "minStars": 0 },
  "dishes": { "mode": "infinite", "returnDelaySeconds": 8, "stock": {} }
}
```

### 9.2 `layout.json` (today's file, annotated; 11 stations)
```jsonc
{
  "cell": 0.5,
  "bounds": { "x0": -4, "x1": 4, "z0": -2.5, "z1": 2.5 },        // 8 x 5 m playable area
  "stations": [                                                   // index = position in this array
    { "id": "crate_potato", "def": "crate",  "x": -3.5, "z": -2, "w": 1, "d": 1, "dispenses": "potato" },  // 0
    { "id": "board_2",      "def": "board",  "x": -2.5, "z": -2, "w": 1, "d": 1, "optional": "squad" },    // 1  counter below squad (bug B1)
    { "id": "board_1",      "def": "board",  "x": -1.5, "z": -2, "w": 1, "d": 1 },                         // 2
    { "id": "fryer_3",      "def": "fryer",  "x": -0.5, "z": -2, "w": 1, "d": 1, "optional": "squad" },    // 3  counter below squad
    { "id": "fryer_1",      "def": "fryer",  "x":  0.5, "z": -2, "w": 1, "d": 1 },                         // 4
    { "id": "fryer_2",      "def": "fryer",  "x":  1.5, "z": -2, "w": 1, "d": 1 },                         // 5
    { "id": "plates",       "def": "plates", "x":  2.5, "z": -2, "w": 1, "d": 1, "dispenses": "plate" },   // 6
    { "id": "bin",          "def": "bin",    "x":  3.5, "z": -2, "w": 1, "d": 1 },                         // 7  shares the edge x=3 with plates (bug B3)
    { "id": "counter_e1",   "def": "counter","x":  3.5, "z":  0, "w": 1, "d": 1 },                         // 8
    { "id": "pass",         "def": "pass",   "x":  3.5, "z":  1, "w": 1, "d": 1 },                         // 9  the serving window
    { "id": "counter_e2",   "def": "counter","x":  3.5, "z":  2, "w": 1, "d": 1 }                          // 10
  ],
  "spawns": [[-1, 0.5], [0, 0.5], [-2, 0.5], [1, 0.5]],           // 4 today; must grow to >= 6 (rule 7)
  "queue": [[5.8, 1], [6.9, 1.7], [8.0, 0.8]]                     // customers in line beyond the pass (render only)
}
```
Target edit of this file (ticket in `10`): add two spawns (`[2, 0.5]`, `[-3, 0.5]`), add `"order"`, `"mechanics"`, `"twist"`, `"camera"` to `level.json`, and reorder nothing (indices are part of the golden hash).

## 10. Validation rules

Implemented in `v2/packages/content/src/validate.ts` (script) and `rushCrossCheck()` / a new `validateRushContent(): string[]` in `data/rush/index.ts`. `pnpm validate` exits 1 on any error and prints `ERROR <rule>: <detail>`. Rules:

**Schema and ids**
1. Every JSON file parses with its zod schema (`ItemDef`, `StationDef`, `Recipe`, `Assembly`, `Blend`, `LevelData`, `Layout`, plus the archived ones).
2. Ids are unique within items, stations, recipes, assemblies, blends and levels (exists for items and recipes; add the rest).
3. Level folder name equals `level.id`; the id matches `/^l\d{2}_[a-z0-9]+$/`; the 10 campaign ids are exactly those in `01 §7.2`; `order` is 1..10, unique.

**References**
4. `item.chop`, `item.cook.result`, `item.cook.station`, `recipe.container`, `recipe.components[]`, `level.recipes[]`, `layout station.def`, `layout station.dispenses`, assembly/blend ids all exist (exists, extend).
5. A `layout station.dispenses` is set exactly for `kind` dispenser or planter, and for `plates` it is a container def.

**Data consistency**
6. `recipe.components` is sorted ascending and has no duplicates.
7. Every bucket in `level.buckets` and `level.stars` exists for all four ids; `players` ranges are contiguous, start at 1, end at 6; `stars` strictly ascending per bucket (exists for stars); `streakSteps` ascending in both fields and its first entry is `[0, 1000]`.
8. Layout geometry: every station box lies inside `bounds`; no two station boxes overlap; every `x, z, w, d` is a multiple of `cell`; at most 254 stations; `spawns.length >= 6`; every spawn is at least `0.35` from every box and from the bounds; spawns are at least 0.7 m apart; there is exactly one or more `pass`; the bin is not adjacent (box gap < 0.05) to a `dispenser` of a different row edge unless separated by a counter (rule 2 of section 8: warning, not error).
9. `optional` stations: there is at least one non-optional station of the same def (a level never depends on an optional station to be completable).
10. Reach: for every non-optional station, there is a free standing point (a circle of radius 0.35 inside bounds, outside all boxes) within `tuning.reach` of the station box (computed on the 0.25 m grid).

**Recipes and levels**
11. Mechanics gates: `mechanics.fire` requires `hazards.fire` and an `extinguisher` station; `mechanics.wash` requires `dishes.mode = 'cycle'`, a `sink`, a `return` and a stack for each container used; `mechanics.harvest` requires a `planter`; `mechanics.feast` requires `feast` and at least `dishes` recipes; `mechanics.throw` is true only for levels with `order >= 3`.
12. Buildability: for every recipe in `level.recipes` every component must be producible from the level's stations: a component is producible if (a) a crate/planter dispenses it, or (b) it is the `chop`/`cook` result/`blend`/`assembly` result of an item that is producible and whose station exists in the layout (non-optional, or enabled at squad). The container (`plate`, `bowl`, `cup`) needs a stack. The pass must exist.
13. `canAdd` closure: for every recipe, every proper subset of `components` is a valid partial plate (follows automatically from the definition), and no two recipes in one level have the same container and components.
14. Chains: following `chop`/`cook` links from any raw item ends at a component or a base (no cycles; max chain length 4).
15. Every level: `durationSeconds` between 120 and 300; `maxActive >= 1`; every `ticketTimeMul * ticketTime >= 25 s`; `secondTicketAfterSeconds <= 40`.
16. Twist: `twist.kind` in `TwistKind`; its required `params` and layout `props` are present (a table per kind in `08`); `blockers` exist when the kind needs them.
17. Warnings (not errors): `recipe.penalty !== level.scoring.expiredPenalty`; star thresholds that are not multiples of 10; a recipe never reachable by any bucket because of optional stations.

**Content hash**
18. `contentHash(levelId)` (`01 §7.6`) is computed from the canonical JSON of items, stations, recipes, assemblies, blends and that level; `pnpm validate` prints it per level and the golden test (`09 §6.2`) stores the one for level 1.

## 11. How-to: add a recipe

Example: add `bacon_cheeseburger` (hamburger family).
1. Check the components exist in `items.json`: `bun`, `cooked_patty`, `cheese_slice`, `cooked_bacon`. If a component is missing, add its items first (steps 1-3 of section 12 for stations).
2. Add to `data/rush/recipes.json` (components sorted alphabetically):
   ```json
   { "id": "bacon_cheeseburger", "container": "plate", "components": ["bun", "cheese_slice", "cooked_bacon", "cooked_patty"], "baseScore": 150, "ticketTime": 85, "penalty": 50, "family": "burger" }
   ```
   Score and time: base on the number of prep steps: about `+10` points and `+6` seconds per extra step over the closest family member.
3. Add the strings: `recipe.bacon_cheeseburger` (fr and en) in `apps/client/src/strings.ts`.
4. Add the dish asset id `meals/bacon_cheeseburger` to the asset manifest (`04`); until the asset exists the render shows the placeholder.
5. Add the id to `level.recipes` of each level that offers it. Appending is safe; inserting changes the PRNG ticket sequence of that level (and its golden hash).
6. Run `pnpm validate` (rule 12 proves buildability) and `pnpm test`; regenerate golden hashes only for levels you changed and bump `SIM_VERSION` (`01 §7.6`).
7. Recheck the star thresholds with the bots (`02 §14.5`).

## 12. How-to: add a station type

Example: add a `grill_press` (a heat cooker).
1. `data/rush/stations.json`: add `{ "id": "grill_press", "kind": "processor", "process": "auto", "heat": true }`. If it needs a new `kind` (e.g. `steamer` with a new rule): extend `StationDefSchema.kind` in `schemas/rush.ts`, add a file `stations/<kind>.ts` in the sim implementing `StationBehavior` (`accepts`, `interact`, `update`), register it in `STATION_BEHAVIORS`, document its rules in `02 §6`.
2. `items.json`: for each item the station processes add `"cook": { "station": "grill_press", "result": "...", "time": N, "burnWindow": N }` (data driven: no sim change for a new `auto` cooker).
3. `layout.json`: place it (`def: "grill_press"`) with `w`, `d`, grid snapped.
4. Strings: `station.grill_press` (fr, en) and any prompts.
5. Render: add a `StationVisual` entry for `grill_press` in each art backend manifest (`04`); gameplay does not depend on the model; the footprint contract is `w x d` of the layout box.
6. Audio: reuse `ding`/`tick` unless a new cue is added (`05`).
7. `pnpm validate`; add a sim test that places an item and checks the timings; regenerate goldens and bump `SIM_VERSION` if an existing level uses it.

## 13. How-to: add a level

1. Pick the id: `l<NN>_<slug>` from `01 §7.2`; create the folder `v2/packages/content/src/data/rush/levels/<id>/`.
2. Copy `l01_kiosque/level.json` and edit: `id`, `nameKey`, `order`, `durationSeconds`, `recipes`, `buckets`, `mechanics`, `twist` (`kind` + params from `08`), `camera`, `dishes`, `hazards`, `feast`, `unlock`. Keep `pacing`, `scoring`, `tuning` unless the level spec (`08`) says otherwise.
3. Write `layout.json` per section 8: bounds, stations (with `optional` for squad and party copies), at least 6 spawns, queue, `zones`/`blockers` for the twist. Draw the grid on paper first; check corridors (rule 3 of section 8).
4. Register the level: import both JSON files in `data/rush/index.ts` and append `{ level: LevelSchema.parse(...), layout: LayoutSchema.parse(...) }` to `rushLevels` (or add it to the registry map once it exists, `01 §7.2`); add the id to `LEVEL_ORDER`.
5. Add strings (`level.lNN.name`, tutorial prompts), the diorama (`04`: `DIORAMAS[levelId]`), the camera spec, music mood (`05`).
6. If it introduces a mechanic, check the matching rules in `02` are implemented (twist hook, station kinds) and add the new items and stations first (sections 11, 12).
7. `pnpm validate` until clean. Run the bots on 1, 2, 4 and 6 players; set stars (`02 §14.5`); write the level golden hash into `09 §6.2`.
8. Playtest checklist (`design/06 §6`), then update `08-levels.md` with the final values.

## 14. File and loader map

| File | Role |
|---|---|
| `v2/packages/content/src/schemas/rush.ts` | all rush zod schemas and inferred types |
| `.../data/rush/items.json`, `stations.json`, `recipes.json` | catalog (exist); `assemblies.json`, `blends.json` (target) |
| `.../data/rush/levels/<id>/level.json`, `layout.json` | per level |
| `.../data/rush/index.ts` | parses at load; exports `rushItems rushStations rushRecipes rushLevels rushItemById rushStationById rushRecipeById rushLevelById rushCrossCheck` (+ target `rushAssemblies`, `rushBlends`, `LEVEL_ORDER`, `levelIndex`, `contentHash`) |
| `.../src/validate.ts` | the `pnpm validate` script |
| `.../src/content.test.ts` | schema and cross-reference tests (13 recipes, level 1 values) |
| `.../src/index.ts` | package exports (`@ga/content`) |
