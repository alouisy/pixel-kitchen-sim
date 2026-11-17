# 02 · The rush simulation

> Summary. This is the complete rule set of the Pixel Kitchen V2 rush sim (`v2/packages/sim/src/rush/`) for all 10 levels and 1-6 players: entities, item and station state machines, the interaction table, chef movement, throw, fire, dishes, tickets, scoring, twists, the public API, snapshot, hash, input format and replay format.
> It describes what the code does today (marked **Exists**) and what must change (marked **Target**). Where this doc and `01-architecture.md` agree on a name, the name is final (`01 §14`). The tick order of `01 §7.5` is binding; this doc expands it.
> Every number is in ticks (30 Hz) unless a unit is written. Seconds in content JSON are converted with `secs(s) = Math.round(s * 30)`.

## Table of contents
1. Current state vs target
2. Conventions and constants
3. Entities (TypeScript types)
4. Input command format, codec, replay format
5. Items and the item state machine
6. Stations: every kind, exact rules and timings
7. Interaction resolution and the interaction table
8. Chefs: targeting, movement, collision, dash
9. Throw
10. Fire
11. Dishes: plate stack, return, sink
12. The exact tick order
13. Tickets and pacing
14. Scoring, streak, expiry, wrong dish, stars
15. Scaling with 1-6 players
16. Twist modules
17. Public API, snapshot, state hash
18. Removing click-to-walk
19. Known bugs in the level 1 build, with causes
20. Acceptance tests

---

## 1. Current state vs target

| Area | Exists (`rush/sim.ts`, 913 lines, one class) | Target |
|---|---|---|
| Levels | Level 1 only; level data from `@ga/content` | 10 levels, same sim, level-specific behavior only through data and `TwistHooks` |
| Items | `raw chopped cooking cooked burning burnt`; holder `chef` or `socket` | adds `dirty clean`; holders `air floor belt`; bases (pizza base, bread slice) with assemblies |
| Stations | `counter dispenser processor(chop/auto) bin pass` | adds blender, sink, plate return, extinguisher, planter, conveyor, dumbwaiter |
| Buttons | A (edge), X (held), B (edge) | adds T throw (edge) |
| Mouse | click-to-walk (Dijkstra on `WalkGrid`) | click acts only within reach, else `TooFar` event |
| Kinematics | f64 with `+ - * /` and `sqrt` only (deterministic across engines) | unchanged (decision of `01 §5`); all counters, timers, scores, ids are integers |
| Snapshot | none (`view()`, `stateHash()` only) | `snapshot()` / `restore()` (section 17) |
| Replay | none | `RunLog` + binary codec (sections 4.5, 4.6) |
| Bots | click-to-walk | stick steering (section 18) |
| Hash | `stateHash()` includes click-walk fields | fields below (17.4) |

Files after the refactor (`01 §7.4`): `sim.ts state.ts chef.ts interact.ts items.ts tickets.ts scoring.ts throw.ts codec.ts stations/*.ts hooks/*.ts grid.ts pacing.ts bot.ts`. The refactor is gated by the level 1 golden hash (`09 §6.2`): it must not change.

Two reconciliations with `01` (binding here):
1. `playTick` semantics. Today `playTick++` runs before stations and tickets in a playing tick. `01 §7.5` lists it at step 10. To keep level 1 identical, implement it exactly as today: increment `playTick` at the **start of step 7** (the first thing in the playing part), and let `TimeLeft--` and the end check be at step 10. Ticket spawn thresholds below use the value after that increment.
2. Station kinds. `01 §7.3` lists `counter | dispenser | processor | bin | pass | sink | planter | dumbwaiter | conveyor`. This doc needs two more kinds: `extinguisher` and `return` (plate return). The blender is a `processor` with `process: 'multi'`. `03 §2.2` carries the extended `StationDef.kind` enum.

## 2. Conventions and constants

```ts
export const SIM_HZ = 30;                // @ga/shared
export const MAX_RUSH_PLAYERS = 6;
export const CHEF_RADIUS = 0.35;         // m (exists)
const secs = (s: number): number => Math.round(s * SIM_HZ);
```

| Constant | Value | Source |
|---|---|---|
| Countdown | `level.countdownSeconds` (3 s = 90 ticks) | level.json |
| Level duration | `level.durationSeconds` (180 s = 5400 ticks) | level.json |
| Walk speed | `tuning.walkSpeed` 4.0 m/s | level.json |
| Accel ramp | `ACCEL_RAMP_S = 0.08` s: velocity approaches target by `walkSpeed * dt / 0.08` per tick | code |
| Dash | `tuning.dashTicks` 7 ticks at `tuning.dashSpeed` 9.5 m/s; cooldown `tuning.dashCooldownSeconds` 0.6 s = 18 ticks counted from the dash start | level.json |
| Reach | `tuning.reach` 1.1 m, from chef centre to the station box edge | level.json |
| Chop | `tuning.chopSeconds` 1.6 s = 48 ticks; `ChopHit` event every 8th chop tick | level.json |
| Burn warning | `tuning.burnWarnSeconds` 2 s = 60 ticks before burnt | level.json |
| Wash | 60 ticks (2 s) | `Default (tunable)`, `tuning.washSeconds` (03) |
| Dirty return delay | 240 ticks (8 s) | `dishes.returnDelaySeconds` |
| Extinguish | 45 ticks (1.5 s) | `tuning.extinguishSeconds` |
| Fire ignite delay | 240 ticks (8 s) after an item becomes burnt on a heat station | `hazards.igniteAfterBurntSeconds` |
| Fire spread interval | 120 ticks (4 s) | `hazards.spreadSeconds` |
| Blend | 120 ticks (4 s) | `Default (tunable)`, `tuning.blendSeconds` |
| Blender clear | 15 ticks held X | constant |
| Throw | speed 0.4 m/tick, range `tuning.throwRange` 5.0 m (`Default (tunable)`), aim cone `dot >= 0.82`, cooldown 15 ticks, catch radius 0.6 m | section 9 |
| Floor item | pickup radius 0.8 m, despawn after 600 ticks | section 9 |
| Chef shove | 6 ticks at 3 m/s | section 8.5 |

Numeric rules (binding):
1. Kinematics (`x z vx vz fx fz`) are f64 and use only `+ - * /`, `Math.sqrt` (`fsqrt`), `Math.floor`, `Math.min/max`. No `Math.sin/cos/atan2/pow/hypot/random`. Facing is stored as a unit vector, never an angle.
2. Everything else is an integer: item ids, ticket ids, timers (`ticks`), `progress` (Q8, 0..256), score, streak, counters, PRNG state.
3. Progress is derived: `progress = Math.min(256, Math.floor(ticks * 256 / totalTicks))`.
4. All iteration over chefs is by ascending slot, over stations by ascending index, over items by ascending id, over tickets in array order. Never iterate a `Map` in insertion order for anything that changes state (the `items` Map is only used for lookup; ids are allocated by a counter).
5. The sim has two PRNG streams, both split from the seed: `pacing = new Prng(seed).split('rush')` (exists; spawn choice and delays) and `twist = new Prng(seed).split('twist')` (target; hooks only). Split order: `pacing` first. Adding a consumer to `pacing` changes every level, so nothing else draws from it.

## 3. Entities (TypeScript types)

Types in `rush/types.ts` unless noted. **Exists** types are shown as they are; additions are marked `// target`.

```ts
export type ItemState = 'raw' | 'chopped' | 'cooking' | 'cooked' | 'burning' | 'burnt' | 'dirty' | 'clean'; // dirty clean: target

export interface RushItem {
  id: number;
  def: string;
  state: ItemState;
  progress: number;          // Q8 of the current step
  ticks: number;             // integer counter behind progress
  contents: string[];        // containers/bases only: component defs, kept sorted (default JS string order)
  burnTicks: number;         // burn window in ticks once cooked (0 = never burns)
  holder: ItemHolder;
  x: number; z: number;      // target: only meaningful for holder air | floor | belt
  age: number;               // target: ticks on the floor (despawn at 600)
}
export type ItemHolder =
  | { kind: 'chef'; id: number }       // id = slot
  | { kind: 'socket'; id: number }     // id = station index (also dumbwaiter sockets)
  | { kind: 'air'; id: number }        // target; id = projectile index
  | { kind: 'floor'; id: number }      // target; id = 0
  | { kind: 'belt'; id: number };      // target; id = station index of the conveyor
```

```ts
// rush/sim.ts (runtime, internal)
export interface ChefRt {
  x: number; z: number; vx: number; vz: number;     // m, m/s
  fx: number; fz: number;                           // unit facing
  held: number;                                     // item id or -1
  dashLeft: number; dashCd: number; dashX: number; dashZ: number;
  shoveLeft: number; shoveX: number; shoveZ: number; // target
  throwCd: number;                                  // target
  lastButtons: number; lastClickSeq: number;
  chopping: boolean; target: number; verb: Verb; canChop: boolean;
  actTicks: number;                                 // target: consecutive ticks of X-hold action (wash/extinguish/blender clear)
}

export interface StationRt {
  index: number; id: string;
  def: string;               // effective def: disabled optional stations act as 'counter'
  kind: StationKind;         // 'counter'|'dispenser'|'processor'|'bin'|'pass'|'sink'|'planter'|'dumbwaiter'|'conveyor'|'extinguisher'|'return'
  process: 'chop' | 'auto' | 'multi' | undefined;
  enabled: boolean;
  x: number; z: number; box: Box;                   // box may move (twist 'rail', future)
  dispenses: string | undefined;
  socket: number;            // item id or -1
  // target fields (all integers)
  stock: number;             // dispenser stacks in dish cycle mode, else -1 (infinite)
  fire: number;              // 0 = no fire, else ticks since ignition (>=1)
  heatBurntTicks: number;    // ticks a burnt item has sat on this heat station
  mix: string[];             // blender internal contents (sorted)
  queue: number[];           // 'return': dirty item ids, FIFO
  growLeft: number;          // planter: ticks until ready, 0 = ready
  belt: number[];            // conveyor: item ids in order of position
  link: number;              // dumbwaiter: partner station index, else -1
  travelLeft: number;        // dumbwaiter: ticks until the socket item arrives at the partner, 0 = idle
  hasExtinguisher: boolean;  // 'extinguisher' kind
}

export interface TicketRt {
  id: number; recipe: string; left: number; total: number;
  dishes: string[];          // target: feast tickets, recipe ids; [] for normal tickets
  done: boolean[];           // target: parallel to dishes
}

export interface Projectile {                       // target
  item: number; x: number; z: number; vx: number; vz: number;
  left: number; total: number; thrower: number;
  destStation: number;       // -1 if floor/chef target
}
```

Views (exists, `RushView`, `ChefView`, `StationView`, `TicketView`, `ItemView`) keep their fields with these changes:
- `ChefView`: remove `walking`; add `throwReady: boolean`, `shoved: boolean`.
- `StationView`: add `fire: number` (0 none), `progress: number` of the socket item is already in `item.progress`; add `mix: string[]`, `stock: number`, `queue: number` (dirty count), `growLeft: number`, `belt: ItemView[]` with `pos` along the belt in Q8 (0..256), `travelLeft: number`.
- `RushView`: add `twist: TwistView` (`01 §7.4`), `floor: ItemView[]` with `x,z`, `air: Array<{ item: ItemView; x: number; z: number; t: number }>` (`t` = flight fraction 0..256 for the render arc), `feast: Array<{ ticket: number; done: boolean[] }>`.

`Verb` becomes `'none' | 'take' | 'place' | 'add' | 'scoop' | 'serve' | 'trash' | 'chop' | 'wash' | 'extinguish' | 'pickup' | 'harvest' | 'clear'` (the last five are target). `RefuseReason` becomes `'cannot_place' | 'cannot_add' | 'burnt' | 'hands_full' | 'nothing' | 'on_fire' | 'dirty' | 'not_ready' | 'locked' | 'full'`.

### 3.1 Events

Exists: `Countdown Go TimeUp Grabbed Placed Plated Trashed ChopHit ChopDone CookStart Cooked BurnWarning Burnt Dash Refused TicketNew TicketExpired Served WrongDish`. Remove nothing. Target additions (field names final):

```ts
| { kind: 'TooFar'; slot: number; station: number }
| { kind: 'Threw'; slot: number; def: string }
| { kind: 'Caught'; slot: number; def: string }                    // a chef caught a thrown item
| { kind: 'ThrowLanded'; station: number; def: string }            // station = -1 when it landed on the floor
| { kind: 'ItemLost'; def: string }                                // despawned floor item or fell off a belt
| { kind: 'Washed'; slot: number; station: number }
| { kind: 'Fire'; station: number }                                // ignition and each spread
| { kind: 'Extinguished'; station: number }
| { kind: 'Harvested'; slot: number; station: number; def: string }
| { kind: 'DishReturned'; station: number }                        // a dirty dish appeared at the return
| { kind: 'Blended'; station: number }
| { kind: 'Shoved'; slot: number; by: number }
| { kind: 'FeastProgress'; ticket: number; index: number; points: number }
| { kind: 'TwistTelegraph'; twist: string; inTicks: number }
```
`Served` gets an optional `feast: boolean`. Events carry no randomness and are returned in the order they happen in the tick.

## 4. Input command format, codec, replay format

### 4.1 `RushInput` (the wire and replay unit; one per slot per tick)

```ts
export interface RushInput {
  move: [number, number];   // i8 each, -127..127; x right, y towards +z (screen down)
  buttons: number;          // bitmask, bits 0..3
  click: number;            // station index under the mouse cursor, or -1
  clickSeq: number;         // u8; the click is acted on only when this differs from the last seen value
}
export const RB_A = 1;  // Grab / Drop / Serve        (edge: pressed = buttons & ~lastButtons)
export const RB_X = 2;  // Action: chop, wash, extinguish, clear blender   (level: held)
export const RB_B = 4;  // Dash                        (edge)
export const RB_T = 8;  // Throw                       (edge; ignored unless level.mechanics.throw)
export function idleRushInput(): RushInput { return { move: [0, 0], buttons: 0, click: -1, clickSeq: 0 }; }
```
`clickKind` (exists) is removed (18). The mouse cannot chop; the client maps right-mouse-hold to `RB_X` and left click to `click`.

### 4.2 Clamping on entry (Target)
`step` sanitizes every input before use (a malformed network frame never throws):
```ts
function sanitize(i: RushInput | undefined, nStations: number): RushInput {
  if (!i) return idleRushInput();
  const m = (v: number): number => (Number.isFinite(v) ? Math.max(-127, Math.min(127, Math.trunc(v))) : 0);
  const b = Number.isFinite(i.buttons) ? (i.buttons & 15) : 0;
  const c = Number.isInteger(i.click) && i.click >= 0 && i.click < nStations ? i.click : -1;
  return { move: [m(i.move?.[0] ?? 0), m(i.move?.[1] ?? 0)], buttons: b, click: c, clickSeq: (i.clickSeq | 0) & 255 };
}
```
A missing slot input means idle for that tick. During `phase === 'ended'` all inputs are treated as idle.

### 4.3 Edge rules
- `pressed = buttons & ~chef.lastButtons`; then `chef.lastButtons = buttons` (every tick, also in countdown).
- Stick: `mx = move[0]/127`, `mz = move[1]/127`; if length > 1 normalize to 1. Facing updates only when length > 0.2 and not dashing.
- A click is processed first, as an "A press" on station `click` with the reach test of 8.1. If a click was processed this tick, an A edge on the same tick is ignored (no double action).
- The client must hold a button for at least 1 whole tick (`01 §8.3` latching).

### 4.4 Binary codec (`rush/codec.ts`, 5 bytes per slot per tick, matches `01 §9.4`)

| Byte | Content |
|---|---|
| 0 | `move[0]` as i8 |
| 1 | `move[1]` as i8 |
| 2 | `buttons & 15` (high nibble reserved = 0) |
| 3 | `click` as u8, 255 = -1 (levels have at most 254 stations, validated in 03 §10) |
| 4 | `clickSeq` u8 |

```ts
export const INPUT_BYTES = 5;
export function encodeRushInput(i: RushInput, out: Uint8Array, offset: number): void {
  out[offset] = i.move[0] & 255; out[offset + 1] = i.move[1] & 255;
  out[offset + 2] = i.buttons & 15; out[offset + 3] = i.click < 0 ? 255 : i.click & 255; out[offset + 4] = i.clickSeq & 255;
}
export function decodeRushInput(s: Uint8Array, o: number): RushInput {
  const i8 = (v: number): number => (v > 127 ? v - 256 : v);
  return { move: [i8(s[o]!), i8(s[o + 1]!)], buttons: s[o + 2]! & 15, click: s[o + 3] === 255 ? -1 : s[o + 3]!, clickSeq: s[o + 4]! };
}
```
Decoded `move` of -128 is clamped to -127 by `sanitize`. Round trip is the identity for all valid inputs (property test).

### 4.5 `RunLog` (in memory; `01 §7.6`)
`RunLog = { config: RunConfig; frames: RushInput[][] }`, `frames[t][slot]` = the input applied by the step that makes `tick = t + 1`. `RunConfig = { simVersion, contentHash, levelId, players, seed }`. Optional extension fields (ignored by older readers): `difficulty: 'snack' | 'meal' | 'feast'` (default `'meal'`, see 15.3) and `assist: boolean` (default false; the extended-patience setting: ticket time x1.25, the run is unranked, `05`, `07`).

### 4.6 Binary replay file (`.pkr`, produced and parsed by `@ga/records`)

All integers little-endian.
```
offset  size  content
0       4     magic "PKR1"
4       2     headerLen (u16)
6       H     header: UTF-8 JSON { config: RunConfig, difficulty, ticks: number, finalHash: string, score: number, checkpoints: Array<[tick, hashHex]> }
6+H     ...   for slot 0..players-1, in order:
                u32 recordCount
                recordCount x { runLen: u16 (1..65535), 5 bytes encodeRushInput }
```
- Records are run-length encoded: consecutive identical 5-byte frames collapse. A run longer than 65535 splits.
- The sum of `runLen` of every slot equals `header.ticks`.
- `checkpoints`: `[tick, hash]` every 150 ticks (5 s) for desync debugging; verification only needs `finalHash`.
- Size estimate: idle slots compress to a few records; a 6-player 180 s run is under 40 KB before gzip.
- `verifyRun(log, claim, opts?)` (async, returns `Promise<VerifyResult>`, see 07 §6) re-simulates `ticks` steps from `config` and compares `hash()` and `score`; check `simVersion` and `contentHash` first.

## 5. Items and the item state machine

### 5.1 Item data model recap (`03 §3` has the fields)
An `ItemDef` is: `{ id, chop?, cook?: { station, result, time, burnWindow }, component, container }` plus target fields `base?: boolean`, `blend` (not on items, see assemblies in `03 §5`). Kinds of item, derived:

| Kind | Rule | Examples |
|---|---|---|
| Raw ingredient | `!component && !container`, has `chop` or `cook` | potato, patty, egg |
| Intermediate | has `cook`, produced by a chop or a process | raw_fries, onion_rings_coated, omelette_mix |
| Component | `component === true`: may be put on a container | cooked_fries, bun, chopped_tomato, smoothie_ready |
| Container | `container === true`: has `contents` | plate, bowl, cup |
| Base (target) | `container === true && base === true`: a container that morphs by assembly | pizza_base, bread_slice |
| Tool (target) | `extinguisher` | extinguisher |

`newItem(def, holder)` sets `state = 'raw'`, except: if `component && !cook` then `state = 'cooked'` (so bun, cheese, syrup, milk are "ready"). Containers start `raw` (or `clean` when `dishes.mode === 'cycle'`; see 11).

### 5.2 State machine (exact)

States and transitions. "Station-time" means the transition only advances while the item sits in a station socket (or a blender); an item in a chef's hands or on a counter does not advance, and keeps `ticks` (pause and resume).

```
                  chop done (board)                 place on matching auto station
   raw ─────────────────────────────▶ chopped ─────────────────────────────────┐
    │  (item def becomes d.chop)       (state 'chopped', progress 0)            │
    │                                                                            ▼
    └──────── place on matching auto station (def has cook) ───────────────▶ cooking
                                                                                │ ticks >= secs(cook.time)
                                                                                ▼
                                       result def d.cook.result:  state = result has its own `cook` ? 'raw' : 'cooked'
                                                                       burnTicks = secs(cook.burnWindow)
                                                                                │
                              (only if burnTicks > 0, only while on an auto station)
                                                                                ▼
                       cooked ── ticks >= burnTicks - burnWarn ──▶ burning ── ticks >= burnTicks ──▶ burnt   (terminal)
```
Rules:
1. **Chop** (board only, `ItemDef.chop` set, `state === 'raw'`): while X held, empty hands, the target is the board holding the item: `ticks++`, `progress = min(256, floor(ticks*256/chopTicks))`; `ChopHit` when `ticks % 8 === 0`; at `ticks >= chopTicks`: `def = d.chop`, `state = 'chopped'`, `ticks = 0`, `progress = 0`, `ChopDone`. Releasing X keeps the progress; resuming continues.
2. **Cook** (auto station `st.def === d.cook.station`, item `state` in `raw | chopped | cooking`, `contents.length === 0`): each playing tick: first tick sets `state = 'cooking'` and emits `CookStart`; `ticks++`; `progress` as rule 3 of section 2 with `total = secs(cook.time)`. At `ticks >= total`: `def = cook.result`, `ticks = 0`, `progress = 0`, `burnTicks = secs(cook.burnWindow)`, `state` = `rushItemById.get(result).cook ? 'raw' : 'cooked'`, `Cooked` event. A taken `cooking` item stays `cooking` with its `ticks`, and resumes from there when placed back on a matching station.
3. **Burn** (only on an auto station, `state` in `cooked | burning`, `burnTicks > 0`): `ticks++`, `progress = min(256, floor(ticks*256/burnTicks))`; when `state === 'cooked' && ticks >= burnTicks - burnWarn` -> `state = 'burning'`, `BurnWarning`; when `ticks >= burnTicks` -> `state = 'burnt'`, `progress = 256`, `Burnt`. A `burnt` item never changes again. A `cooked`/`burning` item taken off the station stops burning (its timer is paused) and cannot return to a heat station (`accepts` requires `d.cook`, and cooked results have none).
4. **Intermediate fix (Target, bug B2 in 19)**: today the cook step always sets `state = 'cooked'`, so a result that has its own `cook` (omelette_mix, pancake_batter, onion_rings_coated, coated_chicken_strips, pizza_base -> margherita raw) is refused by the next station. The rule above (`state = 'raw'` when the result has its own `cook`) fixes it. Level 1 is unaffected.
5. **Mixed items**: there is no `mixed` state. "Mixed" items are ordinary defs (`omelette_mix`, `pancake_batter`, `smoothie_ready`) produced by the mixer or blender; they follow rules 2-3 like any intermediate or component. A blend result is a `component` with `state = 'cooked'`, `burnTicks = 0`.
6. **Dirty and clean (target)**: only containers (`plate`, `bowl`, `cup`) use them. When `level.dishes.mode === 'cycle'`: a served container is deleted and a *dirty* container of the same def is scheduled for the return (11). `dirty` -> (sink, hold X 60 ticks) -> `clean`. A `clean` container behaves exactly like a new one. `dirty` containers: `contents` is always `[]`, cannot receive components (`Refused 'dirty'`), cannot be served (`Refused 'dirty'`), can be placed on counters, the sink and the bin (bin: no effect, verb `none`).
7. **Containers do not burn, cook or chop.** Bases (`pizza_base`) become a different def through an assembly (5.4), then follow the cook rule.

### 5.3 Container add rule (`canAdd`, exists; extended)
`canAdd(container, comp): 'ok' | 'burnt' | 'dirty' | 'no'`:
1. container def must have `container`; `comp` def must have `component`; else `'no'`.
2. `comp.state === 'cooking'` -> `'no'`. `comp.state === 'burnt'` -> `'burnt'`. container `state === 'dirty'` -> `'dirty'`.
3. If `container.contents` already includes `comp.def` -> `'no'` (no duplicates).
4. Let `merged = contents + comp.def`. For a plain container (`!base`): `'ok'` iff some recipe of this level (`level.recipes`) has `recipe.container === container.def` and `merged` is a subset of `recipe.components`. For a base: `'ok'` iff some assembly with `assembly.base === container.def` has `merged` as a subset of `assembly.needs`. Else `'no'`.
5. After adding to a base: if `merged` equals `assembly.needs` as a set, the base morphs at once: `def = assembly.result`, `contents = []`, `state = 'raw'`, `ticks = 0`, `progress = 0` (event `Plated`).

Add for a plain container: `contents = [...contents, comp.def].sort()` and the component item is deleted.

### 5.4 Assemblies and blends (Target data, `03 §5.2`)
- Assembly: `{ id, base: 'pizza_base', needs: ['shredded_mozzarella','tomato_sauce'], result: 'pizza_margherita_raw' }` and `{ base: 'bread_slice', needs: ['cheese_slice'], result: 'grilled_cheese_raw' }`.
- Blend (blender): `{ needs: ['sliced_banana','sliced_strawberry','milk'], result: 'smoothie_ready' }` and the same with `'yogurt'` instead of `'milk'` (V1 treats milk and yogurt as interchangeable). A blender recipe applies when `mix` equals `needs` as a set.

### 5.5 Item lifecycle and ids
Ids come from `nextItemId++` (starts at 1, never reused). An item is always in exactly one place: a chef (`held`), a socket (`StationRt.socket`), a projectile, the floor list, a belt list, a blender `mix` (as a def string, the item is deleted), or a `return` queue. Deleting an item removes it from `items`.

## 6. Stations: every kind, exact rules and timings

Common to all stations:
- `accepts(item)` decides placement; `interact` is the A resolution (section 7); `update` runs once per playing tick in index order (step 7).
- A station with `fire > 0` accepts nothing and refuses A with `Refused 'on_fire'`, except an extinguisher holder's X action.
- A station whose twist hook says `stationUsable === false` refuses everything with `Refused 'locked'`.
- Optional stations (`optional: 'squad' | 'party'`) not enabled for the run's bucket are built with `def = 'counter'` (exists). They must be rendered as plain counters (bug B1).
- Socket stations hold exactly one item (a container counts as one item with its contents).

### 6.1 Crate (`kind: 'dispenser'`, `dispenses` set)
- A, empty hands: `newItem(dispenses)` into the hands, `Grabbed`, verb `take`. Infinite supply.
- A, hands full: `Refused 'hands_full'`, verb `none`.

### 6.2 Plate / bowl / cup stack (`kind: 'dispenser'`, `dispenses` in `plate|bowl|cup`)
- `stock` is `-1` (infinite) in dish mode `infinite` (levels 1-3), else a count from `level.dishes` (11). A, empty hands, `stock !== 0`: new clean container, `stock--` when finite. `stock === 0` -> `Refused 'nothing'`.
- A, holding a clean empty container of the same def and `stock >= 0`: the item is deleted, `stock++`, verb `place`, event `Placed`.
- A, other hands: `Refused 'hands_full'`.

### 6.3 Counter (`kind: 'counter'`)
Generic socket rules (7.2). Accepts any item (including containers, dirty dishes, burnt items, the extinguisher).

### 6.4 Cutting board (`kind: 'processor'`, `process: 'chop'`)
- `accepts`: `d.chop` set and `state === 'raw'` and `contents.length === 0`.
- Chop per 5.2 rule 1. Only one chef can chop a given board at a time in practice because the target is a single station; if two chefs hold X on the same board both add 1 tick per tick (each chef's pass runs separately, in slot order).
- Take and scoop work as for a counter: a chopped item (`raw_fries`) can be taken; a chopped component (`chopped_tomato`) can be scooped by a container.

### 6.5 Auto cookers (`kind: 'processor'`, `process: 'auto'`)
Stations `stove` (also called grill/griddle), `fryer`, `toaster`, `oven`, `coating`, `mixer`, `press`. Rules 5.2 rules 2-3. Accepted items are those whose `cook.station === st.def` (data driven, `03 §4`). Default timings (from `items.json`, authoritative there):

| Station | Input -> output | Cook (s / ticks) | Burn window (s / ticks) | Heat |
|---|---|---|---|---|
| fryer | raw_fries -> cooked_fries | 5 / 150 | 6 / 180 | yes |
| fryer | onion_rings_coated -> cooked_onion_rings | 5 / 150 | 6 / 180 | yes |
| fryer | coated_chicken_strips -> cooked_chicken_tenders | 5 / 150 | 6 / 180 | yes |
| stove | patty, raw_bacon, omelette_mix, pancake_batter, grilled_cheese_raw -> cooked_* | 6 / 180 | 6 / 180 | yes |
| toaster | bread_slice -> toasted_bread | 3 / 90 | 4 / 120 | yes |
| oven | pizza_margherita_raw -> cooked_pizza_margherita | 12 / 360 | 8 / 240 | yes |
| coating | onion_rings_raw, raw_chicken_strips -> *_coated | 2 / 60 | 0 | no |
| mixer | egg -> omelette_mix; pancake_mix -> pancake_batter | 2 / 60 | 0 | no |
| press | pizza_dough -> pizza_base | 2 / 60 | 0 | no |

- "Heat" stations are the only ones that can ignite (section 10).
- The oven door and similar animations are render only.

### 6.6 Blender (`kind: 'processor'`, `process: 'multi'`; target, level 4+)
State: `mix: string[]` (internal), `socket` (output).
- A holding a component whose def appears in some blend's `needs`, while `socket === -1` and `mix` does not contain that def and `mix + def` is a subset of some blend's `needs`: the item is deleted, `mix = [...mix, def].sort()`, verb `add`, event `Plated`. Else `Refused 'cannot_add'`.
- When `mix` equals a blend's `needs` (as a set): `blendLeft = secs(tuning.blendSeconds)` (stored in `StationRt.growLeft`, reused counter), blender is "running". Each playing tick `blendLeft--`; at 0: `socket = newItem(blend.result)` (state `cooked`), `mix = []`, event `Blended`.
- A, empty hands, output present: take it (verb `take`). A, container in hands, output present: scoop (verb `scoop`).
- A, empty hands, `mix` non-empty and not running: `Refused 'nothing'`. X held, empty hands, `mix` non-empty and not running, 15 ticks: `mix = []`, verb `clear`.
- The blender accepts no other items and no containers on top.

### 6.7 Sink (`kind: 'sink'`; target, level 4+; needs `mechanics.wash`)
- `accepts`: dirty containers only, socket empty.
- Hold X, empty hands, target sink with a `dirty` item: `chef.actTicks++`, item `ticks++`, `progress = floor(ticks*256/washTicks)`; at `washTicks` (60): `state = 'clean'`, `ticks = 0`, event `Washed`. Releasing X keeps `ticks`.
- A, empty hands: take the item (dirty or clean). A, clean empty container in hands: refused (`cannot_place`).
- `tide` twist can lock it (`stationUsable`).

### 6.8 Plate return (`kind: 'return'`; target, level 4+)
- `queue: number[]` holds dirty container item ids (FIFO). Dirty containers appear when scheduled by a serve (11.2). Capacity 6: a 7th arrival is deleted with `ItemLost`.
- A, empty hands, queue non-empty: take `queue.shift()` into hands, verb `take`. Otherwise no action.
- Never accepts items.

### 6.9 Pass (`kind: 'pass'`)
Serving rules (7.3, 14). A holding a container with `state` not `dirty`: serve attempt. Not a container: `Refused 'cannot_place'`, no penalty (exists). Empty hands: verb `none`. Only while `phase === 'playing'` (during countdown the verb is `none`).

### 6.10 Bin (`kind: 'bin'`)
A with anything: containers (plate/bowl/cup) have `contents = []` and are kept in the hand (`Trashed`, verb `trash`); any other item is deleted and the hand is emptied (`Trashed`). Burnt items are accepted like everything else. A dirty container: verb `none` (nothing to empty). The extinguisher: `Refused 'cannot_place'` (it is a tool). Empty hands: verb `none`.

### 6.11 Extinguisher (`kind: 'extinguisher'`; target, level 6+; needs `mechanics.fire`)
- `hasExtinguisher: true` at start. A, empty hands, `hasExtinguisher`: a new item `extinguisher` in the hand, `hasExtinguisher = false`, verb `take`. A, holding the extinguisher, `!hasExtinguisher`: item deleted, `hasExtinguisher = true`, verb `place`.
- The extinguisher item can also rest on counters and be taken from them; it is never a component or a container. Only one exists per station (the flag keeps the count).
- Use: 10.4.

### 6.12 Planter (`kind: 'planter'`; target, level 9; needs `mechanics.harvest`)
- `dispenses` is the crop def; `growLeft` counts down per playing tick while `> 0`; the planter starts ready (`growLeft = 0`). Regrow time `layout.stations[i].props.growSeconds` (default 15 s = 450 ticks).
- A, empty hands, `growLeft === 0`: new raw crop in hands, `growLeft = growTicks`, `Harvested`, verb `harvest`. If `growLeft > 0`: `Refused 'not_ready'`. Hands full: `Refused 'hands_full'`.
- Planters never accept items.
- Sprinklers (`sprinklers` twist) may block movement near a planter but do not change its timer.

### 6.13 Conveyor (`kind: 'conveyor'`; target, level 10)
- Layout: `props: { speed (cm/s integer), length (cm), loop: 0|1, endStation: station index or -1 }`; the belt runs along the station box's long axis from `start` end to `end` end (`+x` or `+z` direction per `rot`).
- Each belt item has `pos` (cm, integer, in `item.x` as integer cm along the belt; `z` unused). Each playing tick `pos += round(speed / 30)` per item (use integer `speedPerTick = Math.round(speed / 30)` computed once).
- Place: A with an item (any), `belt` empty near the start or last item `pos >= 60`: item enters at `pos = 0`, holder `belt`. Else `Refused 'full'`.
- Take: A, empty hands: the belt item whose position is nearest to the chef's projection on the belt axis, within `reach`; take it.
- End: when `pos >= length`: if `loop === 1`, `pos -= length` (wraps; keeps order by pos). Else if `endStation >= 0` and that station accepts the item and its socket is empty: placed there; else the item is deleted with `ItemLost` (fell off).
- Chefs cannot walk on the belt (it is a solid station box).

### 6.14 Dumbwaiter (`kind: 'dumbwaiter'`; target, level 5)
- Two stations linked by layout `props.link = <partner index>`; `link` is symmetric. Each has a single socket.
- Placing an item on one (A with item, socket empty) sets `travelLeft = props.travelTicks` (default 90) on **the station you placed on**. Each playing tick `travelLeft--` while `> 0`. At 0: if the partner socket is empty the item moves there (holder socket id = partner), event `Placed` is not emitted, the partner gets `travelLeft = 0`; if the partner socket is occupied the item waits at `travelLeft = 1` (retries each tick).
- An item can be taken from its socket at any time (A, empty hands) only if `travelLeft === 0`; while in transit `Refused 'locked'`.

### 6.15 Pass copies
Levels with two passes (Party bucket) use `optional: 'party'` on the second `pass` station; a disabled pass is a counter.

## 7. Interaction resolution and the interaction table

### 7.1 Order of evaluation for one chef in step 4
1. `sanitize`, stick, `pressed`.
2. Dash start (8.4).
3. Velocity, movement and collision (8.2-8.3).
4. Target selection (8.1). `chef.verb = interact(slot, target, apply=false)`; `chef.canChop`, `canWash`, etc.
5. Click: if `click >= 0 && clickSeq !== lastClickSeq` (then `lastClickSeq = clickSeq`): if the station is within reach -> face it and `interact(apply=true)`, `chef.target = click`; else emit `TooFar`. A edge ignored this tick.
6. Else if `pressed & RB_A` and a target exists: face the target and `interact(apply=true)`. If `interact` returned verb `none` and the chef's hands are empty, try floor pickup (9.4).
7. T edge: throw (9.1).
8. X held: chop / wash / extinguish / clear (7.4).

### 7.2 Generic socket algorithm (counter, board, auto cookers, sink; `S`)
Given hand item `h` (or none) and socket item `s` (or none):

| Hands | Socket | Result |
|---|---|---|
| none | none | verb `none` |
| none | `s` | take: `s` into hands, socket emptied; `Grabbed`; verb `take` |
| `h` | none | if `accepts(st, h)`: place; `Placed`; verb `place`; else `Refused 'cannot_place'` |
| non-container component/intermediate `h` | container or base `s` | `canAdd(s, h)`: `ok` -> add into `s`, delete `h`, `Plated`, verb `add`; `burnt` -> `Refused 'burnt'`; `dirty` -> `Refused 'dirty'`; `no` -> `Refused 'cannot_add'` |
| container or base `h` | non-container `s` | `canAdd(h, s)`: `ok` -> scoop: add `s` into `h`, delete `s`, socket emptied, `Plated`, verb `scoop`; else as above |
| container `h` | container `s` | `Refused 'cannot_place'` |
| non-container `h` | non-container `s` | `Refused 'cannot_place'` |

Notes:
- A dirty `s` or `h` follows the container rows (`dirty` reasons). A scoop of a `burnt` item is `Refused 'burnt'`: players must bin the burnt item first (the HUD hint says so, bug B3).
- An `extinguisher` in hands: it is a non-container non-component, so only the `h / none` row applies (placing on counters) and `cannot_place` on occupied sockets.

### 7.3 Interaction table (hands x target x button)

| Hands | Target | Button | Result | Verb |
|---|---|---|---|---|
| empty | crate | A | new item in hands | take |
| empty | plate/bowl/cup stack | A | new clean container (stock rules 6.2) | take |
| empty | planter ready | A | harvest crop | harvest |
| empty | planter growing | A | `Refused 'not_ready'` | none |
| empty | counter/board/cooker/sink with item | A | take item (a cooking item pauses) | take |
| empty | blender with output | A | take output | take |
| empty | plate return with queue | A | take dirty dish | take |
| empty | extinguisher station | A | take extinguisher | take |
| empty | conveyor with item in reach | A | take nearest belt item | take |
| empty | floor item in 0.8 m, no station verb | A | pick up | pickup |
| item | empty counter | A | place | place |
| raw choppable | empty board | A | place | place |
| raw/chopped item with matching `cook.station` | empty cooker (not on fire) | A | place; cooking starts next step 7 | place |
| item | board/cooker that does not accept it | A | `Refused 'cannot_place'` | none |
| component | container/base in a socket | A | add (rules 5.3) | add |
| component | blender (accepted def) | A | add to `mix` | add |
| container | component in a socket | A | scoop | scoop |
| container | blender with output | A | scoop | scoop |
| dirty container | empty sink | A | place | place |
| clean empty container | its stack (cycle mode) | A | return to stack | place |
| container with contents | pass | A | serve (14) | serve |
| empty container | pass | A | `WrongDish` (14.4) | serve |
| non-container | pass | A | `Refused 'cannot_place'` | none |
| any item | bin | A | discard (containers are emptied, kept) | trash |
| extinguisher | extinguisher station | A | return it | place |
| any item | conveyor with room | A | place at the start | place |
| any item | dumbwaiter, empty socket | A | place, starts the trip | place |
| any item | station on fire | A | `Refused 'on_fire'` | none |
| any item | other occupied/unsuitable | A | `Refused` with reason | none |
| empty | board with raw choppable item | X held | chop progress (48 ticks) | chop |
| empty | sink with dirty dish | X held | wash (60 ticks) | wash |
| empty | blender with partial `mix` | X held | clear after 15 ticks | clear |
| extinguisher | station on fire | X held | extinguish (45 ticks) | extinguish |
| any item (mechanics.throw) | anything | T | throw (9) | none |
| any | any | B | dash (8.4), cooldown 18 ticks | none |
| any | any with `click >= 0` | click | as A, only within reach, else `TooFar` | as A |

### 7.4 X-held actions
Each tick, for each chef with `RB_X` held: determine the single action available for the **current target** (in this priority: extinguish, wash, chop, clear). If none, `chopping = false; actTicks = 0`. If the action changed from the last tick (different station), `actTicks = 0`. Progress lives on the item (chop, wash) or on the fire (`extinguish`: `chef.actTicks`, reset when X is released or the target changes), so releasing X keeps chop and wash progress but not extinguish progress. The chef faces the target while acting. Movement is allowed while holding X (the client decides whether to slow the stick; the sim does not).

## 8. Chefs: targeting, movement, collision, dash

### 8.1 Targeting (`findTarget`, exists)
For each station in index order: `p = clamp(chef, box)`; `d = dist(chef, p)`; skip if `d > reach (1.1)`; `dot = d > 1e-6 ? ((p-chef)/d) . (fx, fz) : 1`; skip if `dot < -0.1 && d > 0.1`; `score = d + (1 - dot) * 0.6`. The lowest score wins; ties go to the lower station index (strict `<`). Target (Target addition): if the chef holds the extinguisher, a station with `fire > 0` gets `score -= 2` so it wins. A click-selected target overrides (7.1 step 5) for that tick only.
Reach check for clicks: `distToBox(chef.x, chef.z, box) <= reach`. The same geometry is exported as `stationInReach(chef: { x: number; z: number }, box: Box, reach: number): boolean` from `@ga/sim` (pure, shared by `findTarget` and the client mouse handler, `05 §6`).

### 8.2 Movement (exists)
- Input vector `(mx, mz)`; target velocity `(mx*walkSpeed*k, mz*walkSpeed*k)` with `k = hooks.speedMulQ8(ctx, x, z) / 256` (default 1; the accel ramp uses the unscaled `walkSpeed`); `approach` each axis by `maxDelta = walkSpeed * dt / 0.08` per tick (`dt = 1/30`). While dashing: velocity = `dashDir * dashSpeed` and `dashLeft--`. While shoved: velocity = `shoveDir * 3.0` (dash start and shove cannot overlap: a shoved chef ignores B).
- Position update: `moveChef(slot, x + vx*dt, z + vz*dt)`.
- Facing: when stick length > 0.2 and not dashing: `(fx, fz) = (mx, mz) / len`. Initial facing `(0, -1)`.
- During `countdown` chefs can move and interact (except serving). During `ended` inputs are idle.

### 8.3 Collision (exists, expanded)
`moveChef` in order:
1. X axis: `x = clamp(nx, b.x0 + r, b.x1 - r)`, `z = old z`; for each station box in index order, `pushOutOfBox(x, z, r, box)` (circle vs AABB; centre-inside leaves by the nearest side). Then Z axis the same with the new x. Axis-separated, so chefs slide along counters.
1b. Static colliders: for each `layout.colliders[i]` (not interactable, never enabled/disabled) the `WalkGrid` marks its cells blocked once at construction; the circle is pushed out of the box like a station box, in array order after the stations. Thrown items skip colliders with `flyOver`.
2. Twist blockers: for each `layout.blockers[i]` that `hooks.isBlocked(ctx, centre)` reports active, push out like a station box. A chef standing inside a blocker when it activates is pushed out by the hook (16.2), not by collision.
3. Chef vs chef: for each other chef j in slot order, if `dist < 2r` push the mover to exactly `2r` away from j (degenerate overlap: `x += 2r`).
4. Clamp to bounds and re-push out of stations.
5. After all chefs moved (step 5 of the tick): `separateChefs`: for every pair `(i<j)` with `0 < d < 2r`, push each half the overlap along the axis.
Chefs are solid for each other (not ghosts). Chefs never overlap stations. `CHEF_RADIUS = 0.35`. Spawns: `layout.spawns[slot]` (at least 6 entries, validated). If two spawns overlap, `separateChefs` resolves it.

### 8.4 Dash (exists)
- On `pressed & RB_B` with `dashCd === 0 && dashLeft === 0` (and not shoved): `dashLeft = tuning.dashTicks (7)`, `dashCd = dashCooldownTicks (18)`, direction = normalized stick if length > 0.1 else current facing; `Dash` event.
- `dashCd` decrements by 1 per tick (before the press check). `dashReady = dashCd === 0`. Distance covered by one dash: about `7 * 9.5/30 = 2.2 m`.
- A dash does not interrupt chop; dashing chefs still respect collision. Items in hands stay.

### 8.5 Dash shove (Target)
During a dash tick, if the dashing chef's circle overlaps another chef whose `shoveLeft === 0` and who is not dashing (`dist < 2r + 0.05`): the other gets `shoveLeft = 6`, `shove = normalized(other - dasher)`, event `Shoved`. The shoved chef moves at 3.0 m/s for 6 ticks (collision still applies) and keeps its items. A shoved chef cannot start a dash; it can act otherwise. There is no damage.

## 9. Throw

Enabled when `level.mechanics.throw` is true (level 3+). T is ignored otherwise.

### 9.1 Launch
Preconditions: `pressed & RB_T`, chef holds an item, `throwCd === 0`, not dashing. Effects: `throwCd = 15`; the held item leaves the hand (holder `air`), `Threw`.
Aim (no trig; uses dot products with the facing unit vector `f`):
1. Candidates in the cone: `dot((p - chef)/d, f) >= 0.82` and `d <= tuning.throwRange` (5.0 m).
2. Priority 1: other chefs (slot order) in the cone; nearest wins, ties lower slot. Destination = that chef's position now.
3. Priority 2: stations that would accept the item now (`accepts` and empty socket, or a `pass` when the item is a non-dirty container, or a `bin`) in the cone; nearest centre wins, ties lower index. Destination = station centre; `destStation = index`.
4. Else: destination = `chef + f * 3.0`, flat landing, clamped to bounds.
Flight: start `p0 = chef + f * 0.4`; `d = dist(p0, dest)`; `total = max(2, ceil(d / 0.4))`; `v = (dest - p0) / total`; `left = total`.

### 9.2 Flight (step 6 each tick, projectiles in creation order)
`p += v; left--`. Then:
1. Catch: for each chef `j != thrower` in slot order with `dist(p, chef_j) <= 0.6`: if the chef's hands are empty -> the item goes into its hands (`Caught`), projectile removed. If its hands are full (or `j` is the thrower after 8 ticks) -> the item drops to the floor at the chef's feet (9.3 floor landing) and the projectile ends.
2. Items fly over stations (no collision en route).
3. When `left === 0` the item lands (9.3).

### 9.3 Landing
At the landing point `(x, z)`:
- If inside a station box (expanded by 0.05): by kind:
  - accepts and socket empty (counter, board, cooker, sink for dirty, blender for components? no: blender, planter, conveyor, dumbwaiter, dispenser, extinguisher, plate return and fire stations are NOT valid landing targets) -> placed in the socket; `ThrowLanded {station}`.
  - `pass` and a clean container with contents: serve (14) with the thrower as `slot`; a non-matching dish bounces to the floor with no penalty.
  - `bin`: trash rule (6.10); a container ends on the floor emptied.
  - anything else: floor.
- Floor landing: the point is pushed out of every station box with radius 0.2 and clamped to bounds; holder `{kind:'floor'}`, `age = 0`, `ThrowLanded {station: -1}`.

### 9.4 Floor items
- Pickup: A with empty hands when the chef's resolved verb is `none` (no station action) and a floor item is within 0.8 m (nearest, tie lower id): into hands, verb `pickup`, `Grabbed`.
- `age++` per playing tick; at 600 the item is deleted with `ItemLost`.
- Floor items do not block movement and cannot be scooped.
- A thrown container keeps its contents; a thrown cooking item keeps `ticks` (paused).

## 10. Fire

Enabled when `level.mechanics.fire` (level 6+) and the level has `hazards.fire`.

### 10.1 Ignition
Only heat stations (`stove`, `fryer`, `toaster`, `oven`) ignite. Each playing tick, for such a station whose socket holds a `burnt` item: `heatBurntTicks++`; otherwise `heatBurntTicks = 0`. When `heatBurntTicks >= secs(hazards.igniteAfterBurntSeconds)` (240): `fire = 1`, the socket item is deleted, `heatBurntTicks = 0`, event `Fire {station}`. Players can avoid ignition by taking the burnt item off (the burnt-item pickup resets the counter).

### 10.2 Burning station
`fire > 0`: `fire++` each tick. The station refuses all interaction (`Refused 'on_fire'`) except being extinguished. Its cooking stops (nothing in the socket).

### 10.3 Spread
When `fire > 0 && fire % secs(hazards.spreadSeconds) === 0` (every 120 ticks): every **flammable** neighbour with `fire === 0` gets `fire = 1` (its socket item is deleted), in ascending station index, events `Fire`. Neighbour = another station whose box is within `0.6 m` (box-to-box gap `<= 0.6`). Flammable kinds: `counter`, `processor`, `blender`, `planter`, `return`. Not flammable: `bin`, `pass`, `sink`, `dispenser`, `extinguisher`, `conveyor`, `dumbwaiter`. Fire does not hurt chefs, but a burning station is unusable and may block the route.

### 10.4 Extinguishing
The chef holds the extinguisher item and holds X while targeting a station with `fire > 0`: `actTicks++`; at `actTicks >= secs(tuning.extinguishSeconds)` (45): `fire = 0`, `Extinguished`, `actTicks = 0`. The station is then normal and empty. Releasing X or changing target resets `actTicks`.
No score penalty exists for fire; the cost is lost throughput. (Design option, not implemented: sink spray.)

## 11. Dishes: plate stack, return, sink

`level.dishes` (03 §6): `{ mode: 'infinite' | 'cycle', returnDelaySeconds, stock: { plate: n, bowl: n, cup: n } }`, default `{ mode: 'infinite' }`.

### 11.1 Infinite mode (levels 1-3)
Stacks are infinite (`stock = -1`); a served container is deleted; no dirty dishes.

### 11.2 Cycle mode (levels 4+)
- At construction each dispenser stack of container def `D` gets `stock = dishes.stock[D]` split evenly over the stacks of that def (remainder to the lowest index).
- On a successful serve (never on a wrong dish): the served container is deleted and an entry `{ def, due: playTick + secs(returnDelaySeconds) }` is appended to `state.dishDue`. Each playing tick in step 7: for each due entry (array order) with `due <= playTick`: create a `dirty` container of that def at the lowest-index `return` station's queue (if none, put it back as `stock++` on the lowest-index stack of that def, clean); event `DishReturned`.
- Dirty path: return queue -> hands -> sink -> wash 60 ticks -> clean -> back onto the stack (A, 6.2) or used directly.
- A `bin` never destroys a plate: dishes always survive, so the pool stays constant (`stock` + in-flight + dirty + clean items = initial stock).

## 12. The exact tick order

`step(inputs)` for one tick. Matches `01 §7.5`; `H1`/`H2` are the twist insertion points. Returns the events in order.

```
 1. tick = (tick + 1) >>> 0
 2. phase === 'countdown':
      if countdownTicks % 30 === 0 && countdownTicks > 0 -> Countdown { n: countdownTicks / 30 }
      countdownTicks--
      if countdownTicks <= 0: phase = 'playing'; Go; spawnTicket (first ticket, rng.int index); nextSpawnTick = 0
 3. H1: twist.onTickStart            (playing only)
 4. for slot = 0..players-1: updateChef(slot, sanitize(inputs[slot]) or idle if ended)
      (7.1: dash, move, collide, target/verb, click or A, T, X-actions)
 5. separateChefs()
 6. projectiles: for each in creation order: fly, catch, land            (playing only)
 7. (playing only) playTick++                                             <-- see section 1 reconciliation
    stations in index order: update():
      auto cookers (cook/burn), blender, conveyor, dumbwaiter, planter regrow,
      fire (ignite, age, spread), dish due -> return queue, floor item ageing
 8. tickets: advance `left--` and expire (in array order); then spawning (13.3); feast completion
 9. H2: twist.onTickEnd
10. timeLeft--; if timeLeft <= 0: timeLeft = 0; phase = 'ended'; TimeUp { score, stars }
11. return events
```
Binding details:
- Step 4 runs even in `countdown` and `ended` (in `ended` inputs are idle: chefs slide to rest, no actions).
- In `ended` nothing in 6-10 runs.
- Chef actions in step 4 see station state as left by step 7 of the previous tick; cooking progress therefore starts the tick after placement (level 1 behavior).
- Serving happens in step 4 (inside `interact`) or step 6 (thrown plates), never in 7-8.
- Steps 8's expiry runs before spawning, so a freed slot can be refilled the same tick.
- Event order inside a tick is chef order, then projectile order, then station order, then ticket order.

## 13. Tickets and pacing

### 13.1 Ticket
`TicketRt { id, recipe, left, total, dishes, done }`, `total = secs(recipe.ticketTime * level.ticketTimeBase * bucket.ticketTimeMul * diffTime)` (15.3), `left = total` at spawn. Ids from `nextTicketId++` (starts at 1). Each playing tick (step 8) every ticket does `left--`; at `left <= 0` it expires (13.5).

### 13.2 Recipe choice at spawn
If `level.openingTickets` is set and `spawned < openingTickets.length`, the recipe is `openingTickets[spawned]` and **no PRNG draw is made**. Otherwise `recipe = recipes[pacingRng.int(0, recipes.length - 1)]` over `level.recipes` in file order, uniform. (V1 does the same with `Math.random`.) Exactly one PRNG draw. Feast levels: see 16.4.

### 13.3 Spawn schedule (exact, exists)
State: `spawned`, `openingDone`, `nextSpawnTick` (in `playTick` units), `playTick`.
1. At the Go tick: `spawnTicket` (ticket 1); `nextSpawnTick = 0`. (`spawned = 1`.)
2. Opening (until `openingDone`): each tick after expiry processing, if `spawned >= 1 && active < maxActive && (active === 0 || playTick >= secs(level.secondTicketAfterSeconds))` then spawn a ticket, `openingDone = true`, `nextSpawnTick = playTick + delay()`. (For level 1: the second ticket arrives when the first is served or expired (active 0), or at `playTick >= 750`.)
3. After the opening: each tick if `active < maxActive && playTick >= nextSpawnTick` then spawn and `nextSpawnTick = playTick + delay()`.
`maxActive = level.buckets[bucket].maxActive`. `delay()` is called after the spawn (so `activeCount` includes the new ticket).

### 13.4 Pacing: port of V1 `calculateNextOrderDelay` to integer ticks (`pacing.ts`, exists)
```ts
export function nextOrderDelayTicks(level, recipes, bucket, activeCount, rng): number {
  const p = level.pacing;
  const avg = recipes.length ? sum(recipes.map(r => r.ticketTime)) / recipes.length : 30;  // seconds
  const base = Math.max(p.baseMinSeconds, Math.min(p.baseMaxSeconds, avg * p.baseFromTicketTime));
  let load = 1;
  if (activeCount === 1 && bucket.maxActive > 1) load = rng.int(0, 99) < p.burstChance ? p.burstFactor : p.calmFactor; // consumes 1 draw
  else if (activeCount > 1) load = 1 + (activeCount / bucket.maxActive) * 0.3;
  const jitter = (800 + rng.int(0, 400)) / 1000;                                       // always 1 draw: 0.800 .. 1.200
  const sec = (base / bucket.rate) * load * jitter;
  return Math.round(Math.max(p.minDelaySeconds, Math.min(p.maxDelaySeconds, sec)) * 30);
}
```
Draw order per call: (burst draw if `activeCount === 1 && maxActive > 1`), then jitter. Differences from V1 (intentional): the difficulty factor is replaced by `bucket.rate` and `difficulty` (15.3); the recipe weight is replaced by `recipe.ticketTime`; the explicit `newOrderDelay` override is not ported; `0.35` burst chance is `p.burstChance = 35`; V1's "fast completion shortens the next delay" (`min(timer, delay*0.5)`) is not ported (the opening rule covers it); V1's initial "generate maxActive orders at once" becomes the safe opening.

### 13.5 Expiry
When `left <= 0`: remove the ticket (array order, `splice`), `score = max(0, score - scoring.expiredPenalty)`, `streak = 0`, `expired++`, `TicketExpired { ticket, recipe, penalty }`. `recipe.penalty` in `recipes.json` is not used (all 50 today); `level.scoring.expiredPenalty` is. Validation warns when they differ (`03 §10`).

## 14. Scoring, streak, expiry, wrong dish, stars

### 14.1 Serve matching
A serve attempt: the hand holds a container `h` (not dirty). `comps = h.contents`. If `comps.length > 0`: among tickets (array order) with `recipe.container === h.def`, `recipe.components.length === comps.length`, every recipe component in `comps`: pick the ticket with the **smallest `left`** (ties: first in array). Feast tickets (16.4) match against their undone dishes in the same way.

### 14.2 Points
```
secondsLeft = floor(ticket.left / 30)
bonus       = min(scoring.speedBonusCap, floor(secondsLeft / 2))           // cap 30 at level 1
mult        = streakMultiplier(level, streak)                              // streak BEFORE this serve, permille
points      = floor((recipe.baseScore + bonus) * mult / 1000)
score += points; streak++; served++; ticket removed; container deleted (or dirty-scheduled, 11.2); hand emptied
event Served { slot, ticket, recipe, points, streak (after), multPermille: mult, secondsLeft }
```
`streakMultiplier(level, streak)`: start `1000`; for each `[n, mult]` in `scoring.streakSteps` ascending, if `streak >= n` then `mult` applies. Level 1: `[[0,1000],[3,1250],[6,1500],[10,2000]]`. A serve of the 4th consecutive correct dish (streak was 3) is the first at x1.25.

### 14.3 Streak
Resets to 0 on: a ticket expiring, a wrong dish. It does not reset on a refused non-container. Any served dish counts (there is no separate "late" check: a dish served at `left > 0` is on time by definition).

### 14.4 Wrong dish
At the pass with a container that matches no ticket (including empty containers): `score = max(0, score - scoring.wrongPenalty)` (20), `streak = 0`, `wrong++`, `WrongDish { slot, penalty }`, and **the container stays in the hands**. A loose non-container item at the pass: `Refused 'cannot_place'`, no penalty. A dirty container at the pass: `Refused 'dirty'`, no penalty.

### 14.5 Stars
Thresholds from `level.stars[bucket] = [s1, s2, s3]` (strictly ascending). `stars = score >= s3 ? 3 : score >= s2 ? 2 : score >= s1 ? 1 : 0`. Score is evaluated at `TimeUp`; the `view().stars` is live.
Level 1: solo `[740, 1350, 1850]`, duo `[1200, 2200, 3000]`, squad `[1800, 3300, 4500]`, party `[2400, 4400, 6000]`.
Authoring rule for new levels (used in `03 §9` and `08`): run the bots (`09 §5`), take the mean of the best-bot score `M` over 5 seeds for each bucket and set `s3 = round10(0.75 M)`, `s2 = round10(0.55 M)`, `s1 = round10(0.30 M)`. First guess without bots: take the duo row and multiply by solo 0.62, squad 1.5, party 2.0.

## 15. Scaling with 1-6 players

### 15.1 Bucket
`bucketForPlayers(level, players)`: first bucket in `solo, duo, squad, party` whose `players` range contains `players`; fallback `party`. Defaults: solo 1, duo 2, squad 3-4, party 5-6. Computed once at construction from the total slot count (local + remote). It never changes mid-run.

### 15.2 What the bucket changes
| Parameter | Source | Effect |
|---|---|---|
| `rate` | `buckets[b].rate` | divides the base delay between tickets (`13.4`) |
| `maxActive` | `buckets[b].maxActive` | cap of simultaneous tickets and burst rule |
| `ticketTimeMul` | `buckets[b].ticketTimeMul` | multiplies `recipe.ticketTime` (after `level.ticketTimeBase`, default 1; `RunConfig.assist` multiplies by a further 1.25) |
| optional stations | `layout.stations[].optional` | enabled when `bucketRank(bucket) >= bucketRank(optional)` with rank solo=duo=0, squad=1, party=2 |
| stars | `stars[b]` | thresholds |
| spawns | `layout.spawns[slot]` | 6 spawn points |
Level 1 values: solo rate 0.55 / maxActive 2 / time x1.25; duo 1.0 / 2 / 1.0; squad 1.6 / 3 / 0.95; party 2.2 / 4 / 0.9.

### 15.3 Difficulty (Target, `01 §7.6` `difficulty` field)
`RushOptions.difficulty: 'snack' | 'meal' | 'feast'`, default `'meal'`. `diff = 1.3 | 1.0 | 0.8`. Applied: ticket time `total = secs(ticketTime * ticketTimeMul * diff)`; delay `sec = (base / rate) * diff * load * jitter` (so snack gives longer tickets and slower arrivals). `Default (tunable)`. Records are kept for `meal` and `feast` only (`07`). `RunConfig.difficulty` is part of the log header.

### 15.4 Players
- `MAX_RUSH_PLAYERS = 6`. `players` is the number of slots; slot `i` uses `layout.spawns[i]`. Colors are by slot (render).
- Local seats up to 4 per machine, mixed with remote slots, all in one `step(inputs)` array; the sim does not know which is which.
- A leaver's slot receives `idleRushInput()` (stands still; `06` may define more). The bucket is unchanged.

## 16. Twist modules

### 16.1 Interface (final names from `01 §7.4`)
```ts
export type TwistKind = 'none' | 'split_counter' | 'tide' | 'dumbwaiter' | 'low_bridges' | 'crowd_lane' | 'gangway_tunnels' | 'sprinklers' | 'conveyor';
export interface TwistHooks {
  readonly kind: TwistKind;
  init(ctx: SimCtx): void;
  onTickStart?(ctx: SimCtx, events: RushEvent[]): void;   // step 3 (H1)
  onTickEnd?(ctx: SimCtx, events: RushEvent[]): void;     // step 9 (H2)
  isBlocked?(ctx: SimCtx, x: number, z: number): boolean; // used by collision
  stationUsable?(ctx: SimCtx, stationIndex: number): boolean;
  speedMulQ8?(ctx: SimCtx, x: number, z: number): number;  // Q8, 256 = 1.0, default 256; chef walk speed = walkSpeed * q / 256 (exact in f64)
  dashAllowed?(ctx: SimCtx, x: number, z: number): boolean; // default true; a dash start is refused and a running dash ends where false
  view(ctx: SimCtx): TwistView;
  hash(h: Hasher64): void;
  save(): Int32Array;
  load(data: Int32Array): void;
}
```
`update(tick)` in the brief is `onTickStart` / `onTickEnd` (the tick comes from `ctx.tick` and `ctx.playTick`).

### 16.2 What a hook may touch (whitelist)
Read: `ctx.level.twist.params`, `ctx.layout`, `ctx.tick`, `ctx.playTick`, stations, chefs, items.
Write (only through these helpers in `items.ts` / `chef.ts`, never by raw field writes that skip events):
- `ctx.pushChefOut(slot, blockerIndex)`: moves a chef to the nearest point outside a blocker box (deterministic nearest-side rule of `pushOutOfBox`).
- `ctx.setBlockerActive(i, bool)` (state lives in the hook's `Int32Array`; `isBlocked` reads it).
- `ctx.ejectChefs(box, stunTicks)`: moves every chef whose circle overlaps `box` to the nearest free cell centre outside it, in slot order (tie-break smaller z, then smaller x), keeps the held item, sets the stun and emits `ChefEjected`.
- `ctx.destroyItem(id)`, `ctx.moveItemToSocket(id, stationIndex)`, `ctx.emit(event)`.
- Its own PRNG `ctx.rng.twist`.
A hook must **not** change score, streak, tickets, timers, the pacing PRNG, or spawn items out of nowhere (planter/crate behavior belongs to stations). The ticket generator hook for feast tickets is the one exception (16.4).
Rules (from `01`): integer state only; every visible effect is an event plus a field of `TwistView`; telegraph every blocking or harmful change at least 60 ticks ahead; hooks never branch on level id; numbers come from `level.twist.params`.

### 16.3 Catalogue
Params are integers in `level.json: twist.params` (`03 §6`). `08` gives the per-level values.

| Kind | Level | State | Rule |
|---|---|---|---|
| `none` | 1, 2 | none | no-op |
| `split_counter` | 3 | none | no sim effect: a long counter row divides the kitchen and throwing crosses it. The layout carries the geometry; the hook only exposes `view()` zero. Needed so level 3's `mechanics.throw` is validated against `twist.kind` |
| `tide` | 4 | phase, countdown | cycle of `periodTicks` (1800): water is in during the last `durationTicks` (300). `stationUsable` returns false for stations listed by `params.lockedGroup` (stations with `props.group === 1`) while in. Telegraph `TwistTelegraph` at `telegraphTicks` (90) before |
| `dumbwaiter` | 5 | none | station logic (6.14) does the work; hook `view` reports trips in progress |
| `low_bridges` | 6 | phase, countdown | every `periodTicks` a bridge passes: `telegraphTicks` (90) ahead, then for `durationTicks` (120) the blocker `deck` is active: chefs inside are pushed out through `pushChefOut`; stations whose `props.group === 1` are unusable (`stationUsable` false) |
| `crowd_lane` | 7 | phase, countdown | waves of customers: blocker `lane` active for `durationTicks` every `periodTicks`, telegraph 90; chefs inside are pushed out toward the side with the lower index |
| `gangway_tunnels` | 8 | phase, countdown | tunnels: no gameplay blocking; `view.flags` bit 0 = dark (render dims, stations glow). Optional narrowness is layout geometry |
| `sprinklers` | 9 | phase, countdown, active mask | sprinkler groups (`props.group` on blocker boxes) turn on in turn: each blocker active `durationTicks` every `periodTicks`, phase-shifted by group; telegraph 90 |
| `conveyor` | 10 | none (station logic 6.13) | the belt is a station kind; the hook `view` is zero. Feast tickets (16.4) are enabled by `mechanics.feast` |

State for timed twists is `Int32Array [phase, ticksInPhase, ...]`, advanced in `onTickStart` only while `phase` of the run is `playing` and never reads the pacing PRNG. A twist that uses randomness draws from `ctx.rng.twist`.

### 16.4 Feast tickets (level 10, `mechanics.feast`)
A feast ticket carries `dishes: string[]` (3 recipe ids) and `done: boolean[]`. It is created at spawn time when the level `feast` block says so (`03 §6`: `feast: { every: 3, dishes: 3, bonus: 200 }`: every 3rd spawn is a feast). The recipes in `dishes` are drawn from `level.recipes` using `pacingRng` in order (one draw each). `total = secs(sum(ticketTime) * 0.75 * ticketTimeMul)`.
Serving: a container matching an undone dish of a feast ticket marks it done (first undone dish that matches wins; a normal ticket with the same recipe has priority only if its `left` is smaller than the feast's `left`). Points for that dish are computed as in 14.2 (with the feast ticket's `left`) but the ticket stays; `FeastProgress`. When all dishes are done: the ticket is removed, `served++` once, `streak++` once, and `bonus` points are added (`Served { feast: true }`). Expiry of a feast ticket counts once, with penalty `expiredPenalty` (`Default (tunable)`), and resets the streak.

## 17. Public API, snapshot, state hash

### 17.1 `RushSim`
```ts
export interface RushOptions { seed: number; players: number; level?: RushLevel; difficulty?: 'snack' | 'meal' | 'feast' }   // difficulty: target

export class RushSim {
  constructor(opts: RushOptions);                          // exists
  static create(opts: RushOptions): RushSim;               // target, alias of the constructor (also accepts levelId via rushLevelById)
  step(inputs: ReadonlyArray<RushInput | undefined>): RushEvent[];   // exists
  view(): RushView;                                        // exists, no side effects
  snapshot(): Uint8Array;                                  // target
  restore(data: Uint8Array): void;                         // target (01 §9.4: instance method)
  stateHash(): string;                                     // exists: 16 lowercase hex chars (Hasher64)
  hash(): string;                                          // target alias of stateHash
  // read-only state: tick, phase, score, streak, served, expired, wrong, timeLeft, bucket, players, stations, chefs, tickets
  // test/dev helpers (exist): giveItem, putItem, placeChef, stationIndex
  result(): RunResult;                                     // target: valid in phase 'ended'
}
/** Pure helper, also used by the client for mouse reach checks (05). */
export function stationInReach(chef: { x: number; z: number }, box: Box, reach: number): boolean;

/** Optional per-slot counters carried by RunResult (01 §7.6); the results screen (05) hides its per-seat table when absent. */
export interface SlotResult { slot: number; served: number; wrong: number; thrown: number }
```
`step` is the only mutator. `view()` copies; calling it any number of times between ticks never changes later behavior (tested).

### 17.2 Worker and driver
The worker loop (exists, `worker.ts`) steps at 30 Hz with `SIM_DT_MS` accumulators (max 5 catch-up steps), posting `{ type: 'rush', view, events, hash? }` every step with `hash` every 30 ticks. Protocol target messages are in `01 §8`. The sim never reads a clock.

### 17.3 Snapshot (Target)
`snapshot()` returns `Uint8Array`: byte 0 = `SNAPSHOT_VERSION` (1), the rest the UTF-8 bytes of `JSON.stringify(data)` where `data` is the plain-object form of all mutable state:
```
{ tick, phase, score, streak, served, expired, wrong, timeLeft, countdownTicks, playTick,
  spawned, openingDone, nextSpawnTick, nextItemId, nextTicketId,
  rngPacing: number[4], rngTwist: number[4],
  chefs: ChefRt[], stations: [{socket, stock, fire, heatBurntTicks, mix, queue, growLeft, belt, link, travelLeft, hasExtinguisher, enabled, x, z}],
  items: RushItem[] (sorted by id), tickets: TicketRt[], projectiles: Projectile[], dishDue: [{def, due}],
  twist: number[] }
```
JSON round-trips f64 exactly (shortest round-trip representation); `restore` also needs the same `RushOptions` (level, players, difficulty), which `RunConfig` supplies, so static data is rebuilt from content, not stored. A faster binary layout can replace the JSON later without changing the API. Test: `restore(snapshot())` then N steps gives the same `hash()` as N steps without it.

### 17.4 State hash (`stateHash`, 16 hex chars)
`Hasher64` calls in this exact order (every field integer-cast with `i32`/`u32` as shown; f64 via `f64`):
```
u32 tick, u32 phaseCode(0 countdown,1 playing,2 ended)
bytes rngPacing.getState().buffer, bytes rngTwist.getState().buffer           // twist stream: target
i32 score, streak, served, expired, wrong, timeLeft
i32 spawned, nextSpawnTick, playTick, openingDone(0|1)
i32 nextItemId, nextTicketId, countdownTicks
per chef (slot order): f64 x z vx vz fx fz; i32 held dashLeft dashCd shoveLeft throwCd; u32 lastButtons; i32 lastClickSeq
per station (index order): i32 socket stock fire heatBurntTicks growLeft travelLeft hasExtinguisher(0|1); i32 each of mix (via hashStr), queue ids, belt ids
per item (ascending id): i32 id; u32 hashStr(def); u32 stateCode(raw0 chopped1 cooking2 cooked3 burning4 burnt5 dirty6 clean7); i32 progress ticks burnTicks; i32 holderKindCode(chef0 socket1 air2 floor3 belt4) holderId; f64 x z; i32 age; u32 hashStr of each content
per ticket (array order): i32 id; u32 hashStr(recipe); i32 left total; per dish: u32 hashStr + i32 done
per projectile: i32 item; f64 x z vx vz; i32 left thrower destStation
per dishDue: u32 hashStr(def), i32 due
twist.hash(h)
```
Removed vs today: `c.sticky`, `lastClickSeq` stays, `walkTarget`, `path`. `hashStr` is FNV-1a over UTF-16 code units (`hashString` in `@ga/shared`). Level 1 hash changes once, at the commit that adds the target fields and removes the walk fields; the golden file is regenerated in that commit and `SIM_VERSION` bumped (`01 §7.6`).

## 18. Removing click-to-walk

Owner decision 5: players always move the chef themselves. A mouse click interacts only within reach.

Remove from the sim (`v2/packages/sim/src/rush/`):
1. `types.ts`: `RushInput.clickKind`; `ChefView.walking`. Keep `click`, `clickSeq`.
2. `sim.ts`: constants `STICK_CANCEL`, `WALK_TIMEOUT_TICKS`, `STUCK_TICKS`, `WAYPOINT_EPS`; `ChefRt` fields `walkTarget`, `walkKind`, `path`, `walkTicks`, `stuck`, `sticky`; methods `startWalk`, `clearWalk`; the "Click-to-walk" block, the "Walking steers" block, the stuck check and the `arrivedInteract` branch of `updateChef`; the `sticky` logic in targeting; `this.grid` and the `WalkGrid` construction; hash lines for `sticky`, `walkTarget`, `path`.
3. `grid.ts`: `WalkGrid` (and the `Box`, `pushOutOfBox`, `distToBox` helpers stay). Move `WalkGrid` to `rush/botNav.ts` for the bots only; it must not be imported by `sim.ts`.
4. `bot.ts`: replace `go(station)` (click) with steering: compute a path with `WalkGrid` (bot's own copy), set `move` toward the next waypoint (normalized to i8), press `RB_A` (edge, hold 2 ticks) when `view.chefs[slot].target` is the intended station and `verb !== 'none'`. Hold `RB_X` to chop as before. The bot reads only `view()`.
5. `rush.test.ts`: delete the tests `click-to-walk reaches a far station...`, `a right-click walk goes there...`, `stick input cancels a click-to-walk`; add: `click within reach acts`, `click out of reach emits TooFar and does nothing`, `click and A in the same tick act once`. The bot star-threshold test must be re-tuned (bot speed changes with steering; thresholds are rechecked with `09 §5`).
6. Client: `rushInput.ts`: stop sending `clickKind`; send `click` (station under the cursor from `pickStation`) and `clickSeq`; map left click to the click and right-mouse-hold to `RB_X`. `rushClient.ts`: on `TooFar` show the "trop loin" hint; remove the `walking` HUD state. Keep `pickStation` (mouse picking).
7. Worker protocol: no change (frames are `RushInput[]`).

## 19. Known bugs in the level 1 build, with causes

Read from the code at commit state of branch `claude/project-thread-662hnf`. Each bug lists symptom, cause, fix and the test that must prove it.

### B1. The first cutting board and the first fryer do not respond (high confidence)
- Symptom: on level 1 with 1 or 2 players, the leftmost board (x = -2.5) and the leftmost fryer (x = -0.5) look usable but chopping and frying do nothing.
- Cause: `layout.json` marks `board_2` and `fryer_3` as `optional: "squad"`. `RushSim` builds optional stations that are not enabled for the bucket as `def = 'counter'` (`sim.ts` constructor: `const def = enabled ? ls.def : 'counter'`). Solo (1) and duo (2) are below squad, so those two stations are counters: a potato can be placed (counters accept everything) but `canChop` requires `kind === 'processor'`, and a counter never cooks. They are the first board and the first fryer in x order (the layout lists `board_2` before `board_1`, `fryer_3` before `fryer_1`). The renderer cannot tell: `rushClient.ts` builds the scene with `layout.stations.map((s) => ({ ...s, enabled: true }))` and `HarbourScene` never reads `enabled`, so it draws a board and a fryer there. `StationView.enabled` exists in the view and is ignored (only the guide arrow uses it).
- Fix (target): (1) render disabled optional stations as plain counters (read `view.stations[i].enabled`; the scene must be created or updated after `rush-init`, when the bucket is known); (2) keep the sim rule (optional stations are counters below their bucket); (3) layout rule (`03 §10`): optional stations must be at the end of a row or visibly separated so the line stays readable; (4) test: with `players: 1`, `view().stations[board_2].def === 'counter'` and the scene draws a counter there.

### B2. Processed intermediates are refused by the next station (latent, hits levels 2-10)
- Cause: after any auto-station cook, `sim.ts` sets `state = 'cooked'`. `accepts` for auto stations requires `state` in `raw | chopped | cooking`, so `omelette_mix` (mixer result) is refused by the stove, and `onion_rings_coated` / `coated_chicken_strips` (coating result) are refused by the fryer.
- Fix: 5.2 rule 4 (`state = 'raw'` when the result has its own `cook`). Test: egg -> mixer -> stove -> cooked_omelette; onion -> board -> coating -> fryer.

### B3. The bin appears not to accept burnt items (not reproducible in the sim; probable causes in order)
- What the code does: `interact` for `kind === 'bin'` accepts any held item (deletes it; containers are emptied and kept). The test `the bin empties a plate but keeps it, and destroys other items` passes with a burnt item (`rush.test.ts` lines 145-155). So the sim accepts burnt items when the bin is the target and the hands hold the item.
- Probable cause 1 (targeting at the seam): the bin (x 3..4) and the plate stack (x 2..3) share the edge x = 3. A chef standing at x = 3.0 has identical distance and facing score to both, and ties resolve to the lower index; `plates` (index 6) beats `bin` (index 7). A press of A then hits the plate dispenser, which answers `Refused 'hands_full'` with the burnt item in hand. The player experiences "the bin refuses". Fix: keep the target when it already has a non-`none` verb for the held item (prefer, among near-equal scores within 0.05, the station whose verb is not `none`); and put the bin away from a dispenser edge in level layouts.
- Probable cause 2 (UX trap): with a plate in hand, the burnt fries in the fryer are refused (`Refused 'burnt'`, toast "Brûlé ! À la poubelle") and the burnt item cannot be removed while holding the plate; the bin only empties the plate, so the burnt item stays. Fix: with a container in hand, A on a socket holding a burnt item is allowed to swap nothing; add the rule "A on a burnt item with full hands does nothing but the HUD prompt says 'put down your plate'", and let the HUD guide arrow point to a free counter then the burnt item then the bin. Option: allow `trash` of a burnt item straight from a socket with the container in hand by Action (X held 0.5 s, verb `trash`) - `Default (tunable)`, not in the rule set above.
- Probable cause 3 (mouse): `pickStation` intersects the ray with the planes y = 1.0 and y = 0.5 and accepts hits within 0.12 m of a station box; the low bin model and the counter row beside it can resolve to a neighbour. With reach-only clicks (section 7) a wrong pick now also yields `TooFar`. Fix: pick by the rendered footprint (`Footprint`, `01 §10.3`).
- Verification step for the implementer: add a sim test that stands at x = 3.0 and presses A with burnt fries and asserts the target is the bin; add a client test that clicks the bin model centre.

### B4. Other findings to fix while here
- `recipe.penalty` is never read (13.5): the expiry penalty is `level.scoring.expiredPenalty`.
- Content gaps that make recipes unbuildable today: `grilled_cheese_raw`, `pizza_margherita_raw` and `smoothie_ready` have no producer (no assembly, no blender); `03 §5` adds them.
- `layout.spawns` has 4 entries for 6 possible players (validated rule: at least 6).
- `RushView.firstOrder` is the only onboarding signal; it must remain (`05`). `level.guide` (`03 §2.5`) is pure level data read by the client; the sim never reads it.

## 20. Acceptance tests

Add to `rush.test.ts` (unit) and `09` (golden):
1. Determinism: two runs with the same seed and the same bot inputs give equal `hash()`; different seeds differ; `restore(snapshot())` equals continuation.
2. Level 1 golden: `hash()` at ticks 300, 1800 and 5490 for seed 42 with 1 and 2 bots, committed in `09 §6.2`.
3. Tick order: a plate served at tick t is deleted before step 7 of tick t; a ticket expiring and the next spawn can occur in the same tick.
4. Chop 48 ticks, cook 150, burn warning at +120, burnt at +180 (exists).
5. Intermediate chain (B2) works.
6. Interaction table: one test per row of 7.3.
7. Throw: a thrown plate to an empty-handed teammate is caught; landing on a counter places it; a miss lands on the floor and despawns at 600 ticks.
8. Fire: a burnt item left 240 ticks ignites; it spreads at +120 to flammable neighbours only; 45 ticks of X with the extinguisher puts it out.
9. Dishes: with 4 plates and serves, the pool count is constant over a run; a dirty plate returns after 240 ticks.
10. Click: within reach acts, out of reach emits `TooFar`, click plus A the same tick acts once; no walking.
11. Input codec round trip (property test, 10^5 random inputs) and `.pkr` encode/decode identity.
12. Bucket scaling: players 1-6 map to solo, duo, squad, squad, party, party; optional stations enabled from squad; 6 chefs can spawn without overlap.
13. Twist: for each kind, the telegraph precedes the effect by at least 60 ticks.
