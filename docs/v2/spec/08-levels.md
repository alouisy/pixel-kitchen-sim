# 08 · Levels: template and the ten campaign levels

> Status: implementation spec. Owner decisions in `_authoring-brief.md` win over `docs/v2/06-level-design.md`, which this file refines.
> Summary 1: §2 is the **level spec template** (every field a level needs: gameplay, twist, camera, diorama, ambient life, lighting, music, stars). §3 to §12 apply it to the 10 levels, each with an ASCII grid at 0.5 m cells, exact station coordinates, 6 spawn points, recipes, the twist as a tick-exact state machine, pacing, star method, camera, dressing, onboarding and an expert shortcut.
> Summary 2: §3 documents level 1 as built (`l01_kiosque`) plus the fixes (base-station order bug, bin refusing burnt items, click-to-walk removal). §13 is the difficulty curve table, §14 the checklist every level must pass, §15 the star calibration procedure, §16 "Current state vs target".

## Table of contents
1. Conventions (coordinates, grid legend, corridor rule, optional-station rule, ids)
2. The level spec template
   - 2.1 Files per level
   - 2.2 `level.json` additions
   - 2.3 `layout.json` additions
   - 2.4 Twist hook additions required by this document
   - 2.5 Lighting presets and music moods (shared tables)
   - 2.6 Section skeleton every level follows
3. Level 1 · Le Kiosque du Port (`l01_kiosque`), as built plus fixes
4. Level 2 · Le Food Truck du Festival (`l02_foodtruck`)
5. Level 3 · Le Diner de la Route 66 (`l03_diner`)
6. Level 4 · Le Bar à Smoothies de la Plage (`l04_smoothies`)
7. Level 5 · La Pizzeria sur les Toits (`l05_pizzeria`)
8. Level 6 · La Friterie du Bateau-Mouche (`l06_bateau`)
9. Level 7 · Le Marché de Nuit (`l07_marche`)
10. Level 8 · Le Wagon-Restaurant (`l08_wagon`)
11. Level 9 · Le Bistrot de la Serre (`l09_bistrot`)
12. Level 10 · Le Banquet du Géant (`l10_banquet`)
13. Difficulty curve table
14. Checklist every level must pass
15. Star calibration procedure (bot-measured)
16. Current state vs target

---

## 1. Conventions

### 1.1 Coordinates and the grid
- World axes: **+x east (screen right), +z south (toward the camera)**, y up. Metres. The layout origin is the centre of the playable rectangle, so `bounds = { x0: -W/4, x1: W/4, z0: -H/4, z1: H/4 }` for a grid of `W` columns by `H` rows.
- **Grid cell = 0.5 m** (`layout.cell`). Column `c` spans `x0 + 0.5c .. x0 + 0.5(c+1)`, row `r` spans `z0 + 0.5r .. z0 + 0.5(r+1)`. `W` and `H` are even so bounds stay on 0.5 m multiples.
- A normal station is **2 x 2 cells (1 m x 1 m)**: `{ x, z, w: 1, d: 1 }` with centre `x = x0 + 0.5(c + 1)`, `z = z0 + 0.5(r + 1)`. Other footprints are listed in the station table as `w x d` cells.
- A **spawn point** `(c, r)` is a cell *corner* with world position `(x0 + 0.5c, z0 + 0.5r)` (this is how level 1's `[-1, 0.5]` is expressed). The four cells around the corner must be free (checked by the script in §14).
- Reach is `tuning.reach = 1.1 m` (centre of chef to the station box edge, as built). Chef radius is `CHEF_RADIUS = 0.35 m`.

### 1.2 Grid legend (all grids in this file)
| Char | Meaning | Char | Meaning |
|---|---|---|---|
| `.` | open floor | `,` | floor inside a twist zone (still walkable unless the twist says otherwise) |
| `#` | static collider (solid, thrown items fly over it, `flyOver: true`) | `*` | spawn point (corner) |
| `1`..`9`, `$`, `%` | dispenser or planter, symbol = ingredient (per-level legend; `$` and `%` are the 10th and 11th) | `P` / `p` | plate, cup or bowl dispenser (`p` = optional) |
| `=` | plain counter | `B` `F` `S` `T` `O` `G` `M` `R` `N` | board, fryer, stove, toaster, oven, coating, mixer, press, blender |
| `W` | sink | `U` | dirty rack (receives returned dirty containers) |
| `X` | bin | `V` | pass (serving point) |
| `D` | dumbwaiter | `~` | conveyor cell |
| `^` | stairs | | |

**Lowercase letter = optional station** (active only from the bucket named in the station table). A disabled optional station **behaves and renders as a plain counter** (see 1.4).

### 1.3 Corridor and layout rules (binding for every level)
1. **Main corridors are at least 3 cells wide (1.5 m)**: two chefs (diameter 0.7 m each) walk side by side. Corridors on the main route between two stations of a chain are at least 4 cells (2 m) wherever the level geometry allows; 3 cells is allowed only for a designed choke (stairs, gangway, level 3 side gaps, level 8 gangway) and is called out in the level section.
2. **No walled boxes.** The playable area is bounded by `bounds` only. The boundary is visual (water, railings, a road edge) and is never a fully enclosing wall: at least one side shows the surrounding diorama through an open edge, a window, or a low railing (`#` colliders along the edge are at most 0.5 m tall in the render).
3. A chain reads left to right or along a wall: crate, prep, cook, plate, pass (design 06 §2).
4. Every station has at least one **access cell** inside the main (3-wide) corridor network. The §14 script checks this.
5. No dead ends deeper than 2 cells, so six chefs cannot trap each other.

### 1.4 Optional-station rule (fixes the level 1 bug)
Optional stations (`optional: 'squad' | 'party'`) obey three rules:
1. **They are never listed or placed before, or between, the base stations of the same chain.** The *first* board, fryer, stove, etc. in the layout (in file order and in screen order from the crate) must be a **base** station. Optional ones go after the base ones of their type, or take a counter slot at the end of a row.
2. **A disabled optional station is a counter**: `RushSim` already maps it to `def: 'counter'` (`sim.ts` constructor). The **render** must do the same (it must build the visual from the effective def, i.e. `StationView.def`, never from `layout.stations[i].def`). The level 1 build draws the disabled `board_2` and `fryer_3` as a board and a fryer while the sim treats them as counters: this is the cause of "the first cutting board and the first fryer don't respond".
3. A station that exists only in Party (`optional: 'party'`) is placed on a slot that is a *counter* in all other buckets, so the floor plan never changes shape with the player count.

### 1.5 Ids and files
| # | Level id (fixed, see `01 §7.2`) | FR name | EN name |
|---|---|---|---|
| 1 | `l01_kiosque` | Le Kiosque du Port | Harbour Kiosk |
| 2 | `l02_foodtruck` | Le Food Truck du Festival | Festival Food Truck |
| 3 | `l03_diner` | Le Diner de la Route 66 | Roadside Diner |
| 4 | `l04_smoothies` | Le Bar à Smoothies de la Plage | Beach Smoothie Bar |
| 5 | `l05_pizzeria` | La Pizzeria sur les Toits | Rooftop Pizzeria |
| 6 | `l06_bateau` | La Friterie du Bateau-Mouche | River Boat Fryhouse |
| 7 | `l07_marche` | Le Marché de Nuit | Night Market |
| 8 | `l08_wagon` | Le Wagon-Restaurant | Dining Car |
| 9 | `l09_bistrot` | Le Bistrot de la Serre | Greenhouse Bistro |
| 10 | `l10_banquet` | Le Banquet du Géant | The Giant's Banquet |

String keys: `level.<lNN>.name`, `level.<lNN>.tagline` (FR default, EN second; `05` owns the table).

### 1.6 Common assumptions about mechanics owned by other docs
These numbers are what the levels below are tuned against. If `02` changes them, the level tables here must be re-run through the bot (§15).

| Mechanic | Value used here | Owner |
|---|---|---|
| Sim rate | 30 Hz, `SIM_DT = 1/30`, 1 s = 30 ticks | `01 §5` |
| Walk speed / dash | 4.0 m/s, dash 9.5 m/s for 7 ticks, cooldown 0.6 s (as built) | `level.json tuning` |
| Chop | hold Action 1.6 s (48 ticks) | `02` |
| Cook times | per `items.json` (fries 5 s, patty 6 s, pizza 12 s, ...), burn window per item, `burnWarnSeconds` 2 | `03` |
| Wash | hold Action 2 s (60 ticks) per container; dirty container returns to the rack 240 ticks (8 s) after a serve | `02` |
| Fire (from level 6) | a burnt item left on a processor ignites it after 240 ticks; fire spreads to the 4 adjacent stations every 120 ticks; extinguished by holding Action (X) for 45 ticks while holding the extinguisher item and targeting the station | `02` |
| Throw (from level 3) | button `RB_T`; range `tuning.throwRange` = **5.0 m** (Default tunable), flight 12 ticks, lands on the first station in the aim cone with a free socket, else the item is lost | `02` |
| Harvest (level 9) | planter rules in §11.4 | this file |
| Tick order | `01 §7.5`; twist hooks run at H1 (before chefs) and H2 (after tickets) | `01` |

---

## 2. The level spec template

Every level is defined by the files in 2.1 and a section in this document following 2.6. A level is "done" when its section is complete **and** the §14 checklist passes.

### 2.1 Files per level
```
v2/packages/content/src/data/rush/levels/<levelId>/
  level.json        gameplay: recipes, duration, pacing, buckets, scoring, stars, tuning, mechanics, twist, camera, lighting id, music mood
  layout.json       stations, spawns, queue, bounds, zones, blockers, colliders
v2/packages/render/src/dioramas/<levelId>.ts          LevelDiorama factory (dressing, ambient life), registered in DIORAMAS (01 §10.4)
v2/packages/render/src/dioramas/lighting.ts           LIGHTING_PRESETS (2.5)
v2/packages/sim/src/rush/hooks/<twist>.ts             twist hook, only if the twist is new (01 §7.4)
```
A level without a diorama falls back to `dioramas/fallback.ts`, so it is playable before it is dressed.

### 2.2 `level.json` additions
Fields already in `LevelSchema` are unchanged. Fields added by this document (owned and zod-defined in `03`; defaults keep level 1 valid):

```ts
interface LevelDataAdditions {
  order: number;                       // 1..10
  /** Multiplier applied to every recipe.ticketTime on this level (before bucket ticketTimeMul). Default 1. */
  ticketTimeBase: number;
  mechanics: { throw: boolean; wash: boolean; fire: boolean; harvest: boolean; feast: boolean };
  twist: { kind: TwistKind; params: Record<string, number> };   // integers; ticks, cells, Q8 (256 = 1.0)
  camera: CameraSpec;                  // 01 §10.5
  lighting: string;                    // key of LIGHTING_PRESETS
  musicMood: string;                   // key of MUSIC_MOODS (05 owns the audio engine)
  /** Forces the first tickets' recipes (the onboarding, N.10); later tickets use the pacing PRNG. */
  openingTickets?: string[];
  /** `tuning` additions (Default tunable): throwRange 5.0 m, startStack 4 (containers per dispenser when wash is on), refillOnEmpty true. */
  tuningAdditions?: { throwRange: number; startStack: number; refillOnEmpty: boolean };
  /** Level 10 only. */
  feast?: { everyNth: number; fromTicketIndex: number; windowTicks: number; ticketTimeSeconds: number; bonusPermille: number; templates: string[][] };
}
```

Per-level field reference (what each level section must state):

| Field | Where in `level.json` | Section of a level |
|---|---|---|
| Recipes, new mechanic | `recipes`, `mechanics` | N.4 |
| Duration, countdown, second-ticket delay | `durationSeconds`, `countdownSeconds`, `secondTicketAfterSeconds` | N.6 |
| Pacing (`minDelaySeconds` ... `baseMaxSeconds`) | `pacing` | N.6 |
| Buckets (`rate`, `maxActive`, `ticketTimeMul`) | `buckets` | N.6 |
| Ticket time | `ticketTimeBase` x `recipe.ticketTime` x `ticketTimeMul` | N.6 |
| Stars per bucket | `stars` | N.7 |
| Twist | `twist` | N.5 |
| Camera | `camera` | N.8 |
| Forced first tickets | `openingTickets` | N.10 |
| Lighting, music | `lighting`, `musicMood` | N.8 |

Shared defaults for all levels: `countdownSeconds: 3`, bucket `rate` solo 0.55 / duo 1.0 / squad 1.6 / party 2.2, bucket `ticketTimeMul` 1.25 / 1.0 / 0.95 / 0.9, bucket `players` `[1,1] [2,2] [3,4] [5,6]`, `maxActive`: solo = `max(2, duo - 1)`, squad = duo + 1, party = duo + 2. `scoring` and `tuning` are the level 1 values (`speedBonusCap` 30, streak steps `[0,1000] [3,1250] [6,1500] [10,2000]`, `expiredPenalty` 50, `wrongPenalty` 20, `walkSpeed` 4.0, `reach` 1.1, `chopSeconds` 1.6) unless a level says otherwise.

### 2.3 `layout.json` additions
```ts
interface LayoutAdditions {
  /** Static solid obstacles. Not interactable. Thrown items fly over when flyOver is true. Metres, box centre + size. */
  colliders?: Array<{ id: string; x: number; z: number; w: number; d: number; flyOver: boolean }>;
  /** Twist zones (01 §7.3 `zones`): rectangles referenced by id from the twist hook. */
  zones?: Array<{ id: string; box: { x0: number; x1: number; z0: number; z1: number } }>;
  /** Customer queue positions, render only (as built). Level 10: where the Giant's head and hands are. */
  queue: Array<[number, number]>;
}
```
`blockers` in `01 §7.3` are the *dynamic* no-go areas produced by hooks and are not stored in layout.json. `colliders` are the static ones; the walk grid (`WalkGrid`) marks collider cells as blocked once at construction.

### 2.4 Twist hook additions required by this document
`01 §7.4` defines `TwistHooks` with `isBlocked` and `stationUsable`. The levels below need four more small capabilities. They are **additions to `TwistHooks`/`SimCtx`**, to be merged into `01 §7.4` and implemented in `02`; level data does not change if their implementation does.

```ts
interface TwistHooksAdditions {
  /** Q8 multiplier (256 = 1.0) applied to a chef's walk speed at (x, z). Pure function of hook state. Default 256. */
  speedMulQ8?(ctx: SimCtx, x: number, z: number): number;
  /** Whether Dash may start or continue at (x, z). Default true. */
  dashAllowed?(ctx: SimCtx, x: number, z: number): boolean;
}
interface SimCtxAdditions {
  /** Move every chef whose circle overlaps `box` to the nearest free cell centre outside it, in slot order, then stun it. Deterministic tie-break: smaller z, then smaller x. Keeps the held item. Emits ChefEjected. */
  ejectChefs(box: Box, stunTicks: number): void;
}
```
New `RushEvent` variants used by the levels: `TideRising/TideIn/TideOut`, `BridgeApproaching/BridgeLock/BridgeClear`, `CrowdApproaching/CrowdIn/CrowdOut`, `TunnelApproaching/TunnelIn/TunnelOut`, `SprinklerWarn/SprinklerOn/SprinklerOff`, `BeltSpeedWarn/BeltFast/BeltLost`, `DumbwaiterSent/DumbwaiterArrived`, `ChefEjected`. New `RefuseReason`: `flooded`, `locked`, `empty` (planter), `occupied` (belt cell).

Every dynamic twist follows the same phase pattern, which makes the hooks small and testable:
```ts
// state = Int32Array; phase 0 = idle, 1 = telegraph (warn), 2 = active
// All times are playTick values (ticks since "Go"). `nextEvent` is computed from params, never from the PRNG.
function phaseAt(playTick: number, first: number, period: number, warn: number, active: number): { phase: 0 | 1 | 2; ticksToNext: number; ticksIn: number } {
  if (playTick < first - warn) return { phase: 0, ticksToNext: first - warn - playTick, ticksIn: playTick };
  const k = Math.floor((playTick - (first - warn)) / period);
  const t = playTick - (first - warn) - k * period;       // 0..period-1 inside cycle k
  if (t < warn) return { phase: 1, ticksToNext: warn - t, ticksIn: t };
  if (t < warn + active) return { phase: 2, ticksToNext: warn + active - t, ticksIn: t - warn };
  return { phase: 0, ticksToNext: period - t, ticksIn: t - warn - active };
}
```
All twists in this file except 5 (dumbwaiter) and 10 (conveyor) are `phaseAt` with the params given in the level (`first` is the tick the **active** phase starts). Rule 4 of `01 §7.4` (telegraph at least 60 ticks) is satisfied by every `warn` value below (minimum 60).

### 2.5 Lighting presets and music moods (shared tables)
`LIGHTING_PRESETS` entry (render, `dioramas/lighting.ts`); numbers are starting values (Default, tunable). Level 1 is the as-built reference (`harbourApp.ts`: `SKY 0xbfe3f5`, fog 42..120, hemisphere `0xaedcff/0xe6cf9c` 1.15, sun `0xffe0ad` 2.6 at (-9, 16, 8), ACES exposure 1.05, PCF soft shadows 2048, shadow camera +-12, far 50).

```ts
interface LightingPreset {
  sky: number; fogNear: number; fogFar: number;
  hemiSky: number; hemiGround: number; hemiIntensity: number;
  sunColor: number; sunIntensity: number; sunPos: [number, number, number];
  exposure: number;
  /** Point lights, at most 6 per level desktop / 3 mobile (04 budget). */
  points: Array<{ color: number; intensity: number; distance: number; pos: [number, number, number]; flicker?: number }>;
  lut: string;                       // colour-grading LUT id (04)
}
```
| Preset id | sky / fog | hemi sky / ground / I | sun colour / I / pos | exposure | extra point lights | LUT mood |
|---|---|---|---|---|---|---|
| `harbour_noon` (L1, as built) | `0xbfe3f5`, 42..120 | `0xaedcff` / `0xe6cf9c` / 1.15 | `0xffe0ad` / 2.6 / (-9,16,8) | 1.05 | kiosk lamp `0xffd9a0` 0 -> 1.4 at dusk-only pulse (as built, off by day) | bright, minty water |
| `festival_dusk` (L2) | `0xf2b38a`, 30..90 | `0xffb88a` / `0x5a4a7a` / 0.95 | `0xffb070` / 1.9 / (-10,8,9) low | 1.1 | 6 string-light bulbs `0xffd27a` 0.8 d=5 flicker 0.1; truck window `0xfff0c8` 1.2 d=6 | warm, pink-orange, slight purple shadows |
| `route66_dusk` (L3) | `0xe9a679`, 35..100 | `0xf7c59a` / `0xb8683a` / 0.9 | `0xffa860` / 2.0 / (-12,7,6) | 1.1 | neon sign red `0xff3b5c` 1.4 d=7, neon cyan `0x38e1ff` 1.0 d=6, pump lights | hot, high contrast, desert sand |
| `beach_sunset` (L4) | `0xffc08a`, 38..110 | `0xffd7b0` / `0xf2c98a` / 1.0 | `0xff9d5c` / 2.1 / (10,6,-4) low from the sea | 1.08 | tiki torches `0xffa040` 0.9 d=4 flicker 0.2 | golden, teal water |
| `rooftop_night` (L5) | `0x1c2547`, 25..80 | `0x5a6db0` / `0x2a2240` / 0.8 | `0x9fb4ff` / 1.1 / (-6,14,6) moon | 1.15 | string lights `0xffd88a` 1.0 d=5 x4; oven glow `0xff7a2a` 1.6 d=4 (on when an oven cooks) | deep blue, warm pools |
| `river_afternoon` (L6) | `0xcfe6ee`, 40..120 | `0xc4e0f0` / `0x8aa07a` / 1.1 | `0xfff0cf` / 2.4 / (8,16,10) | 1.05 | fryer glow `0xffb040` 0.9 d=3; bridge shadow is a decal, not a light | soft, hazy green-blue |
| `market_night` (L7) | `0x1a1530`, 22..70 | `0x6a5a98` / `0x3a2418` / 0.75 | `0x8fa0ff` / 0.8 / (-5,14,5) weak | 1.2 | lanterns `0xffa24a` 1.1 d=4.5 x6 (brighten +40% in a crowd warn), stall bulbs | purple-orange, saturated |
| `train_day` / tunnel (L8) | `0xbcd8ee`, 40..110 | `0xd0e4f5` / `0x9a8a70` / 1.1 | `0xfff2d8` / 2.3 / (-8,14,6) | 1.05 | wagon lamps `0xffe2a8` 1.0 d=5 x4 (always on). **Tunnel**: sun x0.12, hemi x0.35, lamps x1.3, station emissive +60% over 30 ticks | bright mountain / dark tunnel |
| `greenhouse_noon` (L9) | `0xdff3e0`, 35..100 | `0xe8fff0` / `0x7aa860` / 1.3 | `0xfffbe8` / 2.2 / (-4,18,3), shadows through glass bars (a cookie texture) | 1.0 | none (sun only) + sprinkler rainbow sprite | fresh green, high key |
| `banquet_warm` (L10) | `0x2a1c1a`, 28..90 | `0xffd9a8` / `0x6a3a28` / 1.0 | `0xffcf90` / 1.6 / (0,14,2) chandelier-like | 1.12 | candelabras `0xffc060` 1.0 d=5 x6 flicker 0.15; Giant rim light `0xffe9c0` 0.9 (character rim) | warm, rich, theatrical |

`MUSIC_MOODS` (`05` owns stems and the engine; this table is the brief for each level). Every mood has three stems: `base` (always), `rush` (fades in when active tickets >= `maxActive - 1` or in the last 45 s), `final` (last 15 s, adds percussion and a 5% tempo lift).
| Mood id | BPM | Key / feel | Instruments (brief) |
|---|---|---|---|
| `harbour_breeze` (L1) | 96 | C major, easy | ukulele, accordion, soft brush kit, gull-like whistle motif |
| `festival_groove` (L2) | 112 | A minor to C, funky | muted guitar, slap bass, claps, distant crowd bed |
| `route66_rock` (L3) | 120 | E blues shuffle | twangy guitar, upright bass, snare brushes, neon hum |
| `beach_tropical` (L4) | 104 | F major, laid back | steel drum, marimba, shaker, wave bed |
| `rooftop_jazz` (L5) | 108 | D dorian, swing | piano trio, muted trumpet, city night bed |
| `river_waltz` (L6) | 126 | G major, brisk 6/8 feel | accordion, clarinet, snare roll for each bridge (synced to the telegraph) |
| `night_bazaar` (L7) | 116 | D phrygian dominant | oud, darbuka, bells, crowd murmur |
| `train_rails` (L8) | 124 | B-flat major, chugging | rhythm built on rail clacks (4/4 with a swung off-beat), banjo, harmonica; filtered during tunnels |
| `greenhouse_pastoral` (L9) | 100 | G major, bright | harp, pizzicato strings, flute, water drips |
| `banquet_epic` (L10) | 132 | C minor to C major | brass, timpani, plucked strings, a deep Giant "hum" bass layer |

### 2.6 Section skeleton every level follows
Level section `N` has these subsections, in this order, with these numbers:
`N.1` Identity · `N.2` Setting and mood · `N.3` Layout (grid, legend, stations, colliders, zones, spawns) · `N.4` Recipes and the new mechanic · `N.5` Twist (exact sim rules) · `N.6` Pacing and ticket time · `N.7` Stars · `N.8` Camera, lighting, music · `N.9` Diorama dressing and ambient life · `N.10` Onboarding (first 30 seconds) · `N.11` Expert shortcut · `N.12` Level-specific acceptance tests.

Ambient-life rules (all levels): ambient agents are **render-only**, never read or write sim state, use a render-local PRNG (`mulberry32(hash(levelId))`, not `Math.random` and not the sim PRNG; the level 1 gulls use `Math.random` today, to be replaced), and are capped at **12 animated agents on desktop, 6 on mobile** (customers at the pass excluded). Every dressing prop listed must exist in the voxel/smooth asset manifest under `prop.<levelId>.<name>`; the asset backend (`01 §10`) decides how it looks.

Customers: a queue of up to 3 customers at `queue` positions, first one at the pass. They walk in when the one ahead is served (as built), react to a serve (hop, hearts or a thumbs-up for on-time, a shrug for late) and leave. Customer looks are drawn from the shared `CustomerKind` pool plus the level's extra kinds listed in N.9.

---

## 3. Level 1 · Le Kiosque du Port (`l01_kiosque`)

**This level exists** (`v2/packages/content/src/data/rush/levels/l01_kiosque/`, `v2/packages/render/src/scenes/harbour/`). It is the reference for format and aesthetic. This section documents it as built, then the required changes.

### 3.1 Identity
| Field | Value |
|---|---|
| id / order | `l01_kiosque` / 1 |
| Mechanics flags | all false (`throw`, `wash`, `fire`, `harvest`, `feast`) |
| Twist | `{ kind: 'none', params: {} }` |
| New mechanic | Grab, chop (hold Action), fry (automatic), plate, serve |
| Unlock | `{ requires: null, minStars: 0 }` |

### 3.2 Setting and mood
A wooden kiosk, "Frites du Port", at the end of a sunny pier. Striped awning (red and white), teal counters, a hanging sign, water all around with sailboats, gulls, pilings. Mood: **bright, friendly, safe**. Nothing here can hurt you; the level exists so that the first minute is a pleasure.

### 3.3 Layout (as built, with the fixes applied)
Playable `16 x 10` cells: `bounds = { x0: -4, x1: 4, z0: -2.5, z1: 2.5 }`. Stations in a back row along the north edge (the kiosk counter, under the awning), the pass on the east edge, an open deck in the middle.

```
col  0000000000111111
     0123456789012345
r00  11BBbbFFFFffPPXX
r01  11BBbbFFFFffPPXX
r02  ................
r03  ................
r04  ..............bb
r05  ..............bb
r06  ..*.*.*.*.*.*.VV
r07  ..............VV
r08  ..............vv
r09  ..............vv
```

Legend: general symbols in 1.2. Digits for this level: `1` = potato.

**What changes versus the build as shipped** (bug cause found, see 3.12):
| Station | As built | Target |
|---|---|---|
| `board_2` | x = -2.5, first board in the file, `optional: squad` | **becomes `board_1`'s neighbour**: `board_1` at x = -2.5 (base), `board_2` at x = -1.5 (`optional: squad`) |
| `fryer_3` | x = -0.5, first fryer in the file, `optional: squad` | `fryer_1` at x = -0.5 (base), `fryer_2` at x = 0.5 (base), `fryer_3` at x = 1.5 (`optional: squad`) |
| `counter_e1` (3.5, 0) | plain counter | `board_3`, `optional: party` (a counter in other buckets, rule 1.4.3) |
| `counter_e2` (3.5, 2) | plain counter | `pass_2`, `optional: party` (the second serving pass, `03 §5`) |
| spawns | 4 | 6 (added `[-3, 0.5]` and `[2, 0.5]`) |
| station file order | optional first | base stations always first (rule 1.4.1), then optional |

Base stations in solo and duo: `crate_potato`, `board_1`, `fryer_1`, `fryer_2`, `plates`, `bin`, `pass` + counters. Squad adds `board_2`, `fryer_3`. Party adds `board_3`, `pass_2`.

| id | def | cell (c, r) | size (cells) | centre (x, z) m | box (w x d) m | dispenses | optional |
|---|---|---|---|---|---|---|---|
| `crate_potato` | crate | (0, 0) | 2 x 2 | (-3.5, -2) | 1 x 1 | `potato` |  |
| `board_1` | board | (2, 0) | 2 x 2 | (-2.5, -2) | 1 x 1 |  |  |
| `board_2` | board | (4, 0) | 2 x 2 | (-1.5, -2) | 1 x 1 |  | squad |
| `fryer_1` | fryer | (6, 0) | 2 x 2 | (-0.5, -2) | 1 x 1 |  |  |
| `fryer_2` | fryer | (8, 0) | 2 x 2 | (0.5, -2) | 1 x 1 |  |  |
| `fryer_3` | fryer | (10, 0) | 2 x 2 | (1.5, -2) | 1 x 1 |  | squad |
| `plates` | plates | (12, 0) | 2 x 2 | (2.5, -2) | 1 x 1 | `plate` |  |
| `bin` | bin | (14, 0) | 2 x 2 | (3.5, -2) | 1 x 1 |  |  |
| `board_3` | board | (14, 4) | 2 x 2 | (3.5, 0) | 1 x 1 |  | party |
| `pass` | pass | (14, 6) | 2 x 2 | (3.5, 1) | 1 x 1 |  |  |
| `pass_2` | pass | (14, 8) | 2 x 2 | (3.5, 2) | 1 x 1 |  | party |

Station order in `layout.json` is the order of this table (base stations before optional ones of the same def, rule 1.4.1). `w`/`d` in `layout.json` are the metre sizes in the "box" column.

Colliders: none. Walls: none. (The kiosk back wall and awning are render-only, north of `z0`.) Customer queue (as built, render only): `[5.8, 1]`, `[6.9, 1.7]`, `[8.0, 0.8]` (east of the pass, on the pier).

Spawn points (slot order = join order; slots 0..3 are as built):

| slot | corner (c, r) | position (x, z) m |
|---|---|---|
| 0 | (6, 6) | [-1, 0.5] |
| 1 | (8, 6) | [0, 0.5] |
| 2 | (4, 6) | [-2, 0.5] |
| 3 | (10, 6) | [1, 0.5] |
| 4 | (2, 6) | [-3, 0.5] |
| 5 | (12, 6) | [2, 0.5] |

### 3.4 Recipes and mechanic
| Recipe | Container | Components | Chain in this level |
|---|---|---|---|
| `french_fries` (100 pts, ticket 48 s) | plate | `cooked_fries` | `crate_potato` -> board (hold Action 48 ticks) -> fryer (5 s, burns 6 s after cooked, warning 2 s before) -> plate -> pass |

Level 1 teaches: taking from a dispenser, chopping on a board, the automatic fryer with its ring and burn warning, scooping onto a plate, serving, and the bin for a burnt item.

### 3.5 Twist
None. `TWIST_HOOKS.none` (no-op). The level is a straight line from crate to pass.

### 3.6 Pacing and ticket time
| Field | Value |
|---|---|
| `durationSeconds` | 180 |
| `countdownSeconds` | 3 |
| `secondTicketAfterSeconds` | 25 |
| `pacing.minDelaySeconds` / `maxDelaySeconds` | 1.5 / 25 |
| `pacing.burstChance` / `burstFactor` / `calmFactor` | 35 / 0.35 / 0.75 |
| `pacing.baseFromTicketTime` / `baseMinSeconds` / `baseMaxSeconds` | 0.3 / 4 / 15 |
| `ticketTimeBase` | 1.0 |
| `maxActive` solo / duo / squad / party | 2 / 2 / 3 / 4 |
| `rate` solo / duo / squad / party | 0.55 / 1.0 / 1.6 / 2.2 |
| `ticketTimeMul` solo / duo / squad / party | 1.25 / 1.0 / 0.95 / 0.9 |
| Ticket time (average over this level's recipes: french_fries) at duo | 48.0 s x 1.0 = **48.0 s**; solo 60.0 s, squad 45.6 s, party 43.2 s |
Level 1 values are exactly the shipped `level.json` (`secondTicketAfterSeconds: 25`, `pacing` as built).

### 3.7 Stars
| Bucket | 1 star | 2 stars | 3 stars |
|---|---|---|---|
| solo | 740 | 1350 | 1850 |
| duo | 1200 | 2200 | 3000 |
| squad | 1800 | 3300 | 4500 |
| party | 2400 | 4400 | 6000 |

Method: §15 (bot median x 0.30 / 0.55 / 0.75). Numbers above are **provisional** (Default, tunable) until the bots in `09` measure them.
Level 1 numbers are the shipped ones (hand-tuned). They are the anchor for the provisional ratios of the other levels (§15).

### 3.8 Camera, lighting, music
`level.json.camera` (`CameraSpec`, `01 §10.5`; same pitch and distance on every level so the chefs keep the same on-screen size):
```json
"camera": {
  "position": [0, 12.14, 9.22],
  "target": [0, 0.2, 0.2],
  "fov": 38,
  "lean": 0.1
}
```
Derivation: pitch 54 degrees, distance 15 m (`position = target + 15 x (0, sin 54, cos 54)` with focus z = 0.4). Fit check at 16:9: the visible ground half-width at 15 m is about 9.2 m and half-depth about 6.4 m; this level needs 5.6 m and 3.9 m (playable half-size + margin 1.6 m / 1.4 m), so the whole playable area and a margin are visible without zooming. `CameraRig` increases the distance for narrower aspect ratios (`04`). `lean` 0.1 = the camera focus shifts by 10% of the chef centroid offset, with critically damped smoothing; it never follows one chef.
Lighting preset `harbour_noon` (as built). Music mood `harbour_breeze`.

### 3.9 Diorama dressing and ambient life
Dressing list (all beyond the playable rectangle; as built unless marked **add**):
1. Pier deck planks (3 tones, lighter kiosk floor), pilings with teal bands every 2.2 m along both long edges.
2. Kiosk back wall in teal and white stripes, striped awning (red/white), sign board "Frites du Port" (a strings key: `level.l01.sign`).
3. Lamppost with a lamp (`PointLight 0xffd9a0`), a lighthouse in the far distance, a sailboat (blue/white, `base [7,-0.15,-7.5]`), a second sailboat (red/white `[-13,-0.15,-13]`), a rowboat `[-6.4,-0.1,5.3]`, all bobbing on a water plane with shimmer.
4. Wooden crates stacked at the west end, barrels with fish crates, a coiled rope, bollards.
5. A fishing net draped on the awning post, a bucket of fish **(add)**, a chalkboard menu "Frites 100" **(add)**.
6. A far skyline: a small fishing village with 6 houses (coarse voxels, fog) on the north horizon **(add)**.
7. Bunting across the front edge, 2 flags **(add)**.
Ambient life: 3 gulls (idle, peck, fly off when a chef dashes nearby, as built), boats bob, awning sways +-1 degree, steam from fryers, a fisherman NPC on the far pier line **(add)**, customers (3 in the queue, walk-in, reactions as built, kinds `sailor`, `child`, `tourist`).

### 3.10 Onboarding (first 30 seconds)
| Time | What happens | Prompt (FR) |
|---|---|---|
| 0 to 3 s | countdown 3-2-1, chefs idle at spawn | none |
| 3 s | **only one ticket** shows ("Frites"); the second ticket waits for the first serve or 25 s | |
| 3 s | guide arrow (bouncing yellow cone, as built) over `crate_potato` | "Prendre" when in reach |
| after grab | arrow moves to `board_1` | "Couper (maintenir)" |
| chopped | arrow to `fryer_1` | "Poser" |
| fryer starts | ring fills; the arrow hides, a ring prompt "Cuit !" at completion; the arrow moves to `plates` | "Prendre" |
| plate in hand | arrow to the fryer, then to `pass` | "Servir" |
Total scripted guidance covers the first order only. No tutorial screen. Inputs shown in the bottom-left hint box are device-specific (`05`) and **must not mention clicking to walk** (3.11).

### 3.11 Required changes (backlog items, in order)
1. **Remove click-to-walk** (owner decision 5). In `v2/apps/client/src/rush/rushInput.ts` remove `mouseClick` walking, `startWalk`, `RushInput.click/clickSeq/clickKind` as walk commands and `WALK_TIMEOUT_TICKS`; in `v2/packages/sim/src/rush/sim.ts` remove `walkTarget`, `walkKind`, `path`, `walkTicks`, `stuck` on `ChefRt` and the path-following code, keep `sticky` only if still needed for chop. A mouse left click becomes an **interact request on the station under the cursor, honoured only if the chef is within reach of that station** (`inReach`); otherwise the sim emits `Refused { reason: 'too_far' }` and the HUD shows a small "Trop loin" hint at the station. Right click does nothing. Remove the hint line "Clic : aller et agir" from the HUD. The golden hash for level 1 changes once (the input frame shape changes); re-baseline it in the same ticket.
2. **Base-station order fix** (3.3 table) and **render disabled optionals as counters** (1.4.2): `HarbourScene` must read the effective `StationView.def`.
3. **Bin accepts burnt items.** Required behaviour: holding a burnt item (or a container with burnt contents) and pressing A on the bin always trashes it (`Trashed` event), whatever the state. Reading `sim.ts`, the bin branch already accepts any held item, so the defect is upstream. Procedure for the implementer: (a) add the sim test `bin_accepts_burnt_item` (chef holds a `burnt` fries item, adjacent to the bin, press A, expect `Trashed` and empty hand); (b) if it passes, the bug is not reproduced in the sim and the cause is one of the three probable ones of `02 §19` B3, in order: (1) targeting at the seam: the bin shares the edge x = 3 with `plates`, ties go to the lower index, so A hits the dispenser (`hands_full`); (2) UX trap: with a plate in hand the burnt item in the fryer is refused and the bin only empties the plate, so the burnt item stays; (3) mouse picking: `pickStation` resolves to a neighbour of the low bin model. Fix as `02 §19` B3 says; (c) also verify that picking up a burnt item from a fryer works (`take`) and that serving a burnt item gives `WrongDish` and not a crash.
4. Party extras (`board_3`, `pass_2`) and the 2 extra spawns.
5. Level 1 `level.json` gains the additions of 2.2 with defaults: `order: 1`, `ticketTimeBase: 1`, `twist: none`, `lighting: 'harbour_noon'`, `musicMood: 'harbour_breeze'`, `camera` from the camera block in 3.8.

### 3.12 Root cause of the "first board / first fryer do not respond" bug
In `layout.json` the stations were listed as `board_2` (x = -2.5) then `board_1` (-1.5), and `fryer_3` (-0.5) then `fryer_1` (0.5), `fryer_2` (1.5). `board_2` and `fryer_3` are `optional: 'squad'`; in solo and duo the sim turns them into counters, but the render still draws a board and a fryer there. The leftmost board and fryer (the first one a player walks to) look usable and are counters. The fix is in 3.3 and 1.4.

### 3.13 Expert shortcut
Chop the next potato while the fryer is still cooking and **hold two stacked tasks**: with 2 chefs, chef A chops continuously while chef B shuttles between fryers and plates. Solo: start both base fryers back to back (fryer_1 then fryer_2 within 3 s), then plate from whichever finishes first; the 6 s burn window lets one chef serve a pair of tickets in one trip to the pass. A **dash from `plates` to `pass`** (9.5 m/s for 7 ticks, about 2.2 m) saves about 0.3 s per serve.

### 3.14 Level-specific acceptance tests
- Solo/duo: `board_1` (x = -2.5) and `fryer_1` (x = -0.5) respond to a chef in reach; the render shows counters at `board_2` and `fryer_3`.
- A burnt item can be binned; a burnt item at the pass is refused (`WrongDish`).
- No `click` walking exists in the input frame; a click out of reach shows "Trop loin".
- The golden bot run for solo, duo, squad, party reaches the 1-star threshold.

---

## 4. Level 2 · Le Food Truck du Festival (`l02_foodtruck`)

### 4.1 Identity
| Field | Value |
|---|---|
| id / order | `l02_foodtruck` / 2 |
| Mechanics flags | all false |
| Twist | `{ kind: 'none', params: {} }`; the "twist" is the geometry: a compact truck, the pass is the serving window |
| New mechanic | The stove and the **burn window** (a patty left on the stove burns 6 s after it is cooked); a second recipe sharing the plate |
| Unlock | `{ requires: 'l01_kiosque', minStars: 1 }` |

### 4.2 Setting and mood
A food truck parked at a music festival at dusk. Garlands of bulbs, a small stage with a band behind the truck, a crowd with glow sticks, tents and a Ferris wheel on the horizon. Mood: **warm, busy, celebratory**. The truck is a long interior: two counter lines facing each other with a 2 m aisle. It is readable because every chain runs along one wall.

### 4.3 Layout
Playable `18 x 8` cells (`bounds x -4.5..4.5, z -2..2`, a 9 m x 4 m truck interior). North wall: the cooking line. South wall: plates, assembly counters and the **window** (the pass). The truck's side wall is **open** on the west end (the back door, with the stage visible) and the south window faces the crowd; the roof is not rendered (the camera looks into the truck from above).

```
col  000000000011111111
     012345678901234567
r00  11BBFFff2233SSssXX
r01  11BBFFff2233SSssXX
r02  ..................
r03  ..................
r04  ....*.*.*.*.*.*...
r05  ..................
r06  PP====bbffssVVvv==
r07  PP====bbffssVVvv==
```

Legend: general symbols in 1.2. Digits for this level: `1` = potato; `2` = patty; `3` = bun.

| id | def | cell (c, r) | size (cells) | centre (x, z) m | box (w x d) m | dispenses | optional |
|---|---|---|---|---|---|---|---|
| `crate_potato` | crate | (0, 0) | 2 x 2 | (-4, -1.5) | 1 x 1 | `potato` |  |
| `board_1` | board | (2, 0) | 2 x 2 | (-3, -1.5) | 1 x 1 |  |  |
| `fryer_1` | fryer | (4, 0) | 2 x 2 | (-2, -1.5) | 1 x 1 |  |  |
| `fryer_2` | fryer | (6, 0) | 2 x 2 | (-1, -1.5) | 1 x 1 |  | squad |
| `crate_patty` | crate | (8, 0) | 2 x 2 | (0, -1.5) | 1 x 1 | `patty` |  |
| `crate_bun` | crate | (10, 0) | 2 x 2 | (1, -1.5) | 1 x 1 | `bun` |  |
| `stove_1` | stove | (12, 0) | 2 x 2 | (2, -1.5) | 1 x 1 |  |  |
| `stove_2` | stove | (14, 0) | 2 x 2 | (3, -1.5) | 1 x 1 |  | squad |
| `bin` | bin | (16, 0) | 2 x 2 | (4, -1.5) | 1 x 1 |  |  |
| `plates` | plates | (0, 6) | 2 x 2 | (-4, 1.5) | 1 x 1 | `plate` |  |
| `counter_s1` | counter | (2, 6) | 2 x 2 | (-3, 1.5) | 1 x 1 |  |  |
| `counter_s2` | counter | (4, 6) | 2 x 2 | (-2, 1.5) | 1 x 1 |  |  |
| `board_2` | board | (6, 6) | 2 x 2 | (-1, 1.5) | 1 x 1 |  | squad |
| `fryer_3` | fryer | (8, 6) | 2 x 2 | (0, 1.5) | 1 x 1 |  | party |
| `stove_3` | stove | (10, 6) | 2 x 2 | (1, 1.5) | 1 x 1 |  | party |
| `pass` | pass | (12, 6) | 2 x 2 | (2, 1.5) | 1 x 1 |  |  |
| `pass_2` | pass | (14, 6) | 2 x 2 | (3, 1.5) | 1 x 1 |  | party |
| `counter_s3` | counter | (16, 6) | 2 x 2 | (4, 1.5) | 1 x 1 |  |  |

Station order in `layout.json` is the order of this table (base stations before optional ones of the same def, rule 1.4.1). `w`/`d` in `layout.json` are the metre sizes in the "box" column.

Colliders: none (the aisle is 4 cells = 2 m everywhere; the "tight" feeling comes from length and from six chefs sharing one aisle). Customer queue outside the window (render only): `[2.0, 3.4]`, `[3.2, 3.8]`, `[4.4, 3.4]`.

Spawn points:

| slot | corner (c, r) | position (x, z) m |
|---|---|---|
| 0 | (6, 4) | [-1.5, 0] |
| 1 | (8, 4) | [-0.5, 0] |
| 2 | (10, 4) | [0.5, 0] |
| 3 | (12, 4) | [1.5, 0] |
| 4 | (4, 4) | [-2.5, 0] |
| 5 | (14, 4) | [2.5, 0] |

### 4.4 Recipes and the new mechanic
| Recipe | Container | Components | Chain in this level |
|---|---|---|---|
| `french_fries` (100, 48 s) | plate | `cooked_fries` | `crate_potato` -> board -> fryer -> plate -> pass |
| `hamburger` (130, 70 s) | plate | `bun`, `cooked_patty` | `crate_patty` -> stove (6 s, burn window 6 s, warning 2 s) -> plate; `crate_bun` -> plate; -> pass |

New mechanic: **the stove with a burn window**. The patty cooks 6 s (180 ticks); from then the ring turns orange and pulses for the final 2 s of the window (`burnWarnSeconds`), then the patty burns (turns black, steam turns grey). A burnt patty must go to the bin. Each recipe shares the plate and the pass with level 1, so only the stove is new. Hamburger reuses 50% of known steps (plate, pass, a crate with no prep).

### 4.5 Twist
`kind: 'none'`. No state, no hook. Design constraints enforced by the §14 script instead: (1) aisle width is exactly 4 cells; (2) the pass window is on the same wall as the plates so the plate-to-pass walk is under 4 m; (3) the cooking line (`1`,`2`,`3`, board, fryer, stove) never needs a chef to cross the aisle twice for one recipe.

### 4.6 Pacing and ticket time
| Field | Value |
|---|---|
| `durationSeconds` | 180 |
| `countdownSeconds` | 3 |
| `secondTicketAfterSeconds` | 22 |
| `pacing.minDelaySeconds` / `maxDelaySeconds` | 1.5 / 22 |
| `pacing.burstChance` / `burstFactor` / `calmFactor` | 35 / 0.35 / 0.75 |
| `pacing.baseFromTicketTime` / `baseMinSeconds` / `baseMaxSeconds` | 0.3 / 4 / 14 |
| `ticketTimeBase` | 0.95 |
| `maxActive` solo / duo / squad / party | 2 / 2 / 3 / 4 |
| `rate` solo / duo / squad / party | 0.55 / 1.0 / 1.6 / 2.2 |
| `ticketTimeMul` solo / duo / squad / party | 1.25 / 1.0 / 0.95 / 0.9 |
| Ticket time (average over this level's recipes: french_fries, hamburger) at duo | 59.0 s x 0.95 = **56.0 s**; solo 70.1 s, squad 53.2 s, party 50.4 s |

### 4.7 Stars
| Bucket | 1 star | 2 stars | 3 stars |
|---|---|---|---|
| solo | 800 | 1500 | 2050 |
| duo | 1300 | 2400 | 3300 |
| squad | 2000 | 3650 | 4950 |
| party | 2650 | 4850 | 6600 |

Method: §15 (bot median x 0.30 / 0.55 / 0.75). Numbers above are **provisional** (Default, tunable) until the bots in `09` measure them.

### 4.8 Camera, lighting, music
`level.json.camera` (`CameraSpec`, `01 §10.5`; same pitch and distance on every level so the chefs keep the same on-screen size):
```json
"camera": {
  "position": [0, 12.14, 9.22],
  "target": [0, 0.2, 0.2],
  "fov": 38,
  "lean": 0.1
}
```
Derivation: pitch 54 degrees, distance 15 m (`position = target + 15 x (0, sin 54, cos 54)` with focus z = 0.4). Fit check at 16:9: the visible ground half-width at 15 m is about 9.2 m and half-depth about 6.4 m; this level needs 6.1 m and 3.4 m (playable half-size + margin 1.6 m / 1.4 m), so the whole playable area and a margin are visible without zooming. `CameraRig` increases the distance for narrower aspect ratios (`04`). `lean` 0.1 = the camera focus shifts by 10% of the chef centroid offset, with critically damped smoothing; it never follows one chef.
Lighting `festival_dusk`. Music `festival_groove`.

### 4.9 Diorama dressing and ambient life
1. The truck body: white and teal, a cut-away long side (roof not drawn), a service window frame with a striped awning over the pass, menu board "Burgers / Frites", a roof sign (far, outside the frame) with a lit "FOOD".
2. A festival field: grass, a small **stage** 10 m behind the truck's west end with a 3-piece band (drummer, guitarist, singer; simple 2-frame loops), truss lights, speakers.
3. Garlands of bulbs strung from the truck to two poles (6 bulbs, flicker).
4. A **crowd** of 20 coarse voxel people on the south side (render instancing), arms up in time with the music.
5. Tents (3 colours), a Ferris wheel (slow rotation, lit), a balloon cluster, a drink stand, picnic benches, a generator box with a cable to the truck, trash bins, a portable toilet row at the far edge.
6. A gravel/dirt path, wheel ruts, a food truck neighbour (taco truck, far).
7. Glow sticks and confetti (a particle burst when the streak reaches x2).
Ambient life: crowd sways; the band plays; 3 festival-goers walk along the path (looping); balloons bob; a dog sits near the picnic bench; customers at the window: kinds `festival_kid`, `punk`, `granny` (extra kinds).

### 4.10 Onboarding (first 30 seconds)
`level.json.openingTickets = ['french_fries', 'hamburger']` (the first two tickets are forced; later tickets use the PRNG).
| Time | What happens |
|---|---|
| 3 s | ticket 1 `french_fries` (a known recipe, so the player can relax) |
| as soon as ticket 1 is served, or at 22 s | ticket 2 `hamburger` arrives (`secondTicketAfterSeconds: 22`) |
| hamburger ticket arrives | the guide arrow points at `crate_patty`, then `stove_1`; the prompt "Poser sur le feu" appears |
| patty cooking | ring fills green; at completion the arrow moves to the stove with "Prendre" |
| patty burning (if the player is slow) | at `burnWarnSeconds` the ring pulses orange and an exclamation shows above the stove; if it burns, the arrow points at `bin` with "Jeter" (so burning teaches the bin on a level where it costs only a few seconds) |
The hamburger guide arrow shows only once per profile (stored in the settings, `05`), replay shows no arrow.

### 4.11 Expert shortcut
**The stove is a buffer**: put the patty on, go chop and fry, come back within 12 s (6 s cook + 6 s window) and the patty is still good. Experts load the stove and fryer in one pass along the north line, then walk the aisle once to collect both and run to the window with a plate pre-loaded with a bun (carry plate, pick the patty from the stove into the plate: `scoop`). A dash down the aisle (about 2.2 m) from the stove end (`stove_1` at x = 2) to the window (`pass` at x = 2) saves 0.3 s.

### 4.12 Level-specific acceptance tests
- Aisle clear width is 4 cells everywhere; six spawns fit.
- A patty left on `stove_1` burns exactly `6 s + 6 s = 360 ticks` after it was placed (cook 180 + window 180).
- Squad: `stove_2`, `fryer_2`, `board_2` respond; solo/duo render counters in their place (1.4).
- `openingTickets` yields fries then hamburger in every bucket.

---

## 5. Level 3 · Le Diner de la Route 66 (`l03_diner`)

### 5.1 Identity
| Field | Value |
|---|---|
| id / order | `l03_diner` / 3 |
| Mechanics flags | `throw: true`, others false |
| Twist | `{ kind: 'split_counter', params: { gapCells: 4 } }` |
| New mechanic | **Throwing**; recipe families (hamburger -> cheeseburger combo) |
| Unlock | `{ requires: 'l02_foodtruck', minStars: 1 }` |

### 5.2 Setting and mood
A chrome-and-neon roadside diner in a desert at golden hour: a long U-shaped bar, stools, a jukebox, a pie case; outside, an empty highway, cacti, a classic car, a water tower. Mood: **sizzling, retro, a little theatrical**. The kitchen is split by the long diner bar.

### 5.3 Layout
Playable `24 x 14` cells (`x -6..6, z -3.5..3.5`, 12 m x 7 m). A **diner bar** (collider, 8 m x 2 m) runs east-west across the middle and divides the kitchen into a **north zone** (raw to cooked) and a **south zone** (plates, buns, cheese, assembly, pass). Both ends are open: **two side gaps of 4 cells (2 m)** at the west (cols 0-3) and east (cols 20-23). The aisles on both sides of the bar are 3 cells (1.5 m): two chefs side by side. Customers sit on the south side of the pass.

```
col  000000000011111111112222
     012345678901234567890123
r00  11BBbbFFffSSss22XXffss==
r01  11BBbbFFffSSss22XXffss==
r02  ........................
r03  ....*.*.*...............
r04  ........................
r05  ....################....
r06  ....################....
r07  ....################....
r08  ....################....
r09  ........................
r10  ....*.*.*...............
r11  ........................
r12  PP3344======VVvv====XXpp
r13  PP3344======VVvv====XXpp
```

Legend: general symbols in 1.2. Digits for this level: `1` = potato; `2` = patty; `3` = bun; `4` = cheese_slice. `#` = the diner bar collider.

| id | def | cell (c, r) | size (cells) | centre (x, z) m | box (w x d) m | dispenses | optional |
|---|---|---|---|---|---|---|---|
| `crate_potato` | crate | (0, 0) | 2 x 2 | (-5.5, -3) | 1 x 1 | `potato` |  |
| `board_1` | board | (2, 0) | 2 x 2 | (-4.5, -3) | 1 x 1 |  |  |
| `board_2` | board | (4, 0) | 2 x 2 | (-3.5, -3) | 1 x 1 |  | squad |
| `fryer_1` | fryer | (6, 0) | 2 x 2 | (-2.5, -3) | 1 x 1 |  |  |
| `fryer_2` | fryer | (8, 0) | 2 x 2 | (-1.5, -3) | 1 x 1 |  | squad |
| `stove_1` | stove | (10, 0) | 2 x 2 | (-0.5, -3) | 1 x 1 |  |  |
| `stove_2` | stove | (12, 0) | 2 x 2 | (0.5, -3) | 1 x 1 |  | squad |
| `crate_patty` | crate | (14, 0) | 2 x 2 | (1.5, -3) | 1 x 1 | `patty` |  |
| `bin_n` | bin | (16, 0) | 2 x 2 | (2.5, -3) | 1 x 1 |  |  |
| `fryer_3` | fryer | (18, 0) | 2 x 2 | (3.5, -3) | 1 x 1 |  | party |
| `stove_3` | stove | (20, 0) | 2 x 2 | (4.5, -3) | 1 x 1 |  | party |
| `counter_n1` | counter | (22, 0) | 2 x 2 | (5.5, -3) | 1 x 1 |  |  |
| `plates` | plates | (0, 12) | 2 x 2 | (-5.5, 3) | 1 x 1 | `plate` |  |
| `crate_bun` | crate | (2, 12) | 2 x 2 | (-4.5, 3) | 1 x 1 | `bun` |  |
| `crate_cheese` | crate | (4, 12) | 2 x 2 | (-3.5, 3) | 1 x 1 | `cheese_slice` |  |
| `counter_s1` | counter | (6, 12) | 2 x 2 | (-2.5, 3) | 1 x 1 |  |  |
| `counter_s2` | counter | (8, 12) | 2 x 2 | (-1.5, 3) | 1 x 1 |  |  |
| `counter_s3` | counter | (10, 12) | 2 x 2 | (-0.5, 3) | 1 x 1 |  |  |
| `pass` | pass | (12, 12) | 2 x 2 | (0.5, 3) | 1 x 1 |  |  |
| `pass_2` | pass | (14, 12) | 2 x 2 | (1.5, 3) | 1 x 1 |  | party |
| `counter_s4` | counter | (16, 12) | 2 x 2 | (2.5, 3) | 1 x 1 |  |  |
| `counter_s5` | counter | (18, 12) | 2 x 2 | (3.5, 3) | 1 x 1 |  |  |
| `bin_s` | bin | (20, 12) | 2 x 2 | (4.5, 3) | 1 x 1 |  |  |
| `plates_2` | plates | (22, 12) | 2 x 2 | (5.5, 3) | 1 x 1 | `plate` | party |

Station order in `layout.json` is the order of this table (base stations before optional ones of the same def, rule 1.4.1). `w`/`d` in `layout.json` are the metre sizes in the "box" column.

Colliders (metres, centre + size): `diner_bar` x = 0, z = 0, w = 8, d = 2 (cells cols 4..19, rows 5..8; box x -4..4, z -1..1), `flyOver: true`. Zones: none stored (the twist has no dynamic zone). Customer queue: `[0.5, 4.6]`, `[1.8, 5.0]`, `[3.1, 4.6]`.

Spawn points (3 chefs per zone, so both halves are staffed from the start):

| slot | corner (c, r) | position (x, z) m |
|---|---|---|
| 0 | (4, 3) | [-4, -2] |
| 1 | (6, 3) | [-3, -2] |
| 2 | (8, 3) | [-2, -2] |
| 3 | (4, 10) | [-4, 1.5] |
| 4 | (6, 10) | [-3, 1.5] |
| 5 | (8, 10) | [-2, 1.5] |

### 5.4 Recipes and the new mechanic
| Recipe | Container | Components | Chain in this level |
|---|---|---|---|
| `french_fries` (100, 48 s) | plate | `cooked_fries` | potato (N) -> board (N) -> fryer (N) -> **cross** -> plate (S) -> pass |
| `hamburger` (130, 70 s) | plate | `bun`, `cooked_patty` | patty (N) -> stove (N) -> **cross**; bun (S); plate (S) |
| `cheeseburger_combo` (160, 90 s) | plate | `bun`, `cheese_slice`, `cooked_fries`, `cooked_patty` | the hamburger plus `cheese_slice` (S crate) plus the fries |

Recipe family: hamburger -> cheeseburger combo (burger + cheese + fries). Everything that must **cross** the bar is a cooked item (`cooked_patty`, `cooked_fries`), always from north to south, so the crossing is one-directional and easy to teach.

New mechanic: **throw** (button `RB_T`). Hold an item, face the target, press Throw: the item flies over the bar and lands on a free station within range 5.0 m (flight 12 ticks, 0.4 s). The south landing pads are `counter_s1`, `counter_s2`, `counter_s3`.

### 5.5 Twist: split counter (static, `kind: 'split_counter'`)
**State:** none (`save()` returns an empty `Int32Array`). **Telegraph:** none (static geometry). **What it touches:** nothing at runtime; the hook only validates the layout at `init` (asserts the collider `diner_bar` exists and `flyOver` is true) and publishes `view().flags = 0`.

Exact geometry rules:
1. The bar blocks walking (`WalkGrid` marks cells cols 4..19, rows 5..8) but **not throws** (`flyOver`).
2. Walking route north to south through a gap, from the stove (`stove_1`, x = -0.5, north aisle z = -1.25) to `counter_s1` (x = -2.5, south aisle z = 1.25): about 10 m via the west gap (centre x = -5), 2.5 s at 4 m/s; about 15 m (3.8 s) via the east gap. A throw takes **0.4 s** flight plus one press.
3. Throw distance from a chef standing at z = -1.25 (north aisle, row 4) to a south pad at z = 3.0 is **4.25 m**, inside the 5.0 m range. A chef standing in the north aisle cannot reach any south station by hand (aisles are 2.5 m apart across the bar, reach 1.1 m).
4. Throw landing priority (from `02`): the first station in the aim cone (+-20 degrees) with a free socket within range; `counter_s1..3` are the only free-socket stations in that cone for a chef north of `crate_bun`, so the throw is predictable. A thrown item that finds no free socket is lost (event `ItemLost`), and the HUD shows the target ring turning red before release (the throw aim shows a ring on the chosen landing station).
5. Optional Squad/Party stations never sit on the south pads.

### 5.6 Pacing and ticket time
| Field | Value |
|---|---|
| `durationSeconds` | 210 |
| `countdownSeconds` | 3 |
| `secondTicketAfterSeconds` | 20 |
| `pacing.minDelaySeconds` / `maxDelaySeconds` | 1.5 / 20 |
| `pacing.burstChance` / `burstFactor` / `calmFactor` | 35 / 0.35 / 0.75 |
| `pacing.baseFromTicketTime` / `baseMinSeconds` / `baseMaxSeconds` | 0.3 / 4 / 13 |
| `ticketTimeBase` | 0.92 |
| `maxActive` solo / duo / squad / party | 2 / 3 / 4 / 5 |
| `rate` solo / duo / squad / party | 0.55 / 1.0 / 1.6 / 2.2 |
| `ticketTimeMul` solo / duo / squad / party | 1.25 / 1.0 / 0.95 / 0.9 |
| Ticket time (average over this level's recipes: french_fries, hamburger, cheeseburger_combo) at duo | 69.3 s x 0.92 = **63.8 s**; solo 79.7 s, squad 60.6 s, party 57.4 s |

### 5.7 Stars
| Bucket | 1 star | 2 stars | 3 stars |
|---|---|---|---|
| solo | 900 | 1650 | 2250 |
| duo | 1450 | 2650 | 3600 |
| squad | 2150 | 3950 | 5400 |
| party | 2900 | 5300 | 7200 |

Method: §15 (bot median x 0.30 / 0.55 / 0.75). Numbers above are **provisional** (Default, tunable) until the bots in `09` measure them.

### 5.8 Camera, lighting, music
`level.json.camera` (`CameraSpec`, `01 §10.5`; same pitch and distance on every level so the chefs keep the same on-screen size):
```json
"camera": {
  "position": [0, 12.14, 9.22],
  "target": [0, 0.2, 0.2],
  "fov": 38,
  "lean": 0.1
}
```
Derivation: pitch 54 degrees, distance 15 m (`position = target + 15 x (0, sin 54, cos 54)` with focus z = 0.4). Fit check at 16:9: the visible ground half-width at 15 m is about 9.2 m and half-depth about 6.4 m; this level needs 7.6 m and 4.9 m (playable half-size + margin 1.6 m / 1.4 m), so the whole playable area and a margin are visible without zooming. `CameraRig` increases the distance for narrower aspect ratios (`04`). `lean` 0.1 = the camera focus shifts by 10% of the chef centroid offset, with critically damped smoothing; it never follows one chef.
Lighting `route66_dusk`. Music `route66_rock`.

### 5.9 Diorama dressing and ambient life
1. Diner shell: chrome band, red and white checker floor (the playable floor is checker tiles), a big glass front on the south side (open to the road), a neon sign "DINER" (red) on the north wall with a cyan "OPEN", a pie case on the bar, 8 stools along the south face of the bar, a jukebox (animated lights) at the east gap.
2. Outside: an asphalt road with a dashed line, a gas pump pair with a lit sign, a classic convertible (red) parked, a water tower and a motel sign far away, saguaro cacti, rock mesas on the horizon, tumbleweeds, a road sign "Route 66".
3. Kitchen details: order-wheel clipboard, a hanging pans rail on the north wall, a stack of menus, a ketchup/mustard station, a retro wall clock.
4. A sun low on the horizon with a long shadow.
Ambient life: a **tumbleweed** rolls across the road every ~25 s (render timer), a car passes the road every ~20 s (headlights on), cacti sway slightly, the neon flickers, jukebox lights pulse with the music beat, a trucker customer and a cowboy and a couple at the stools as customers (kinds `trucker`, `cowboy`, `couple`).

### 5.10 Onboarding (first 30 seconds)
`openingTickets = ['french_fries', 'hamburger', 'cheeseburger_combo']` (the third is not guaranteed in the first 30 s; the first two are).
| Time | What happens |
|---|---|
| 3 s | ticket 1 `french_fries`; the arrow guides crate -> board -> fryer as in level 1 but ends at **`counter_s2` with the prompt "Lancer"** instead of walking around |
| first cooked fries in hand, standing in the north aisle | the throw ring appears on `counter_s2`; if the player walks toward a gap instead, nothing blocks them (the gap is the slow safe route) |
| after the first throw | prompt disappears; "Lancer" never shown again |
The first throw must be possible within 15 s of the start: `crate_potato`, `board_1` and `fryer_1` are within 4 m of each other on the north line, and `counter_s2` is the landing pad in line with `fryer_1`.

### 5.11 Expert shortcut
**Throw cooked items straight onto the assembly counters while the south chef assembles**: patties and fries cross in 0.4 s instead of 2.75 s. Experts **chain throw and dash**: throw the fries, then the patty, and the south chef's plate is complete before the north chef has taken a step. Also, throw from the stove directly (do not walk to the aisle centre: stand at the stove's south side row 4).

### 5.12 Level-specific acceptance tests
- Walking from the north aisle (x = -0.5) to the south aisle (x = -2.5) takes at least 2.5 s by path; a throw succeeds in at most 0.5 s including flight.
- A throw from every cell of the north aisle within 3 cells of `fryer_1` lands on a south pad (test over a grid of positions).
- No chef can be pushed into the bar by `separateChefs`.
- Side gaps are 4 cells wide, never blocked by stations.

---

## 6. Level 4 · Le Bar à Smoothies de la Plage (`l04_smoothies`)

### 6.1 Identity
| Field | Value |
|---|---|
| id / order | `l04_smoothies` / 4 |
| Mechanics flags | `throw: true`, `wash: true` |
| Twist | `{ kind: 'tide', params: { firstFloodTick: 1200, periodTicks: 1800, floodTicks: 300, warnTicks: 90, recedeTicks: 60, slowQ8: 154 } }` |
| New mechanic | **Blender** (multi-input station), **dirty containers and the sink** (wash) |
| Unlock | `{ requires: 'l03_diner', minStars: 1 }` |

### 6.2 Setting and mood
A bamboo beach hut on a white-sand beach at sunset, surfboards leaning on the wall, hammocks, palm trees, a sailboat on the horizon, small waves rolling in. Mood: **relaxed, sunny, laid back**, with a little tension from the tide.

### 6.3 Layout
Playable `22 x 14` cells (`x -5.5..5.5, z -3.5..3.5`, 11 m x 7 m). The **hut** is the north row (blenders, boards, crates). A central **assembly island** of three counters. The **bar window** (the pass) is on the south edge. The south-east corner is the **washing beach**: sinks and the dirty rack stand on sand that the tide covers (zone `flood`). The west and east sides are open (sea on the west, palms on the east).

```
col  0000000000111111111122
     0123456789012345678901
r00  112233NNnnBBbb4455XXnn
r01  112233NNnnBBbb4455XXnn
r02  ......................
r03  66..................PP
r04  66..................PP
r05  ......======..........
r06  77....======........PP
r07  77..................PP
r08  ....*.*.*.*.,,,,,,,,,,
r09  ............,,,,,,,,PP
r10  ....*.*.....,,,,,,,,PP
r11  ............,,,,,,,,,,
r12  ====..VVvv==,,WWwwUU,,
r13  ====..VVvv==,,WWwwUU,,
```

Legend: general symbols in 1.2. Digits for this level: `1` = banana; `2` = strawberry; `3` = milk; `4` = lettuce; `5` = tomato; `6` = granola; `7` = yogurt. Twist zones (shown as `,` where floor): `flood` (cols 12..21, rows 8..13).

| id | def | cell (c, r) | size (cells) | centre (x, z) m | box (w x d) m | dispenses | optional |
|---|---|---|---|---|---|---|---|
| `crate_banana` | crate | (0, 0) | 2 x 2 | (-5, -3) | 1 x 1 | `banana` |  |
| `crate_strawberry` | crate | (2, 0) | 2 x 2 | (-4, -3) | 1 x 1 | `strawberry` |  |
| `crate_milk` | crate | (4, 0) | 2 x 2 | (-3, -3) | 1 x 1 | `milk` |  |
| `blender_1` | blender | (6, 0) | 2 x 2 | (-2, -3) | 1 x 1 |  |  |
| `blender_2` | blender | (8, 0) | 2 x 2 | (-1, -3) | 1 x 1 |  | squad |
| `board_1` | board | (10, 0) | 2 x 2 | (0, -3) | 1 x 1 |  |  |
| `board_2` | board | (12, 0) | 2 x 2 | (1, -3) | 1 x 1 |  | squad |
| `crate_lettuce` | crate | (14, 0) | 2 x 2 | (2, -3) | 1 x 1 | `lettuce` |  |
| `crate_tomato` | crate | (16, 0) | 2 x 2 | (3, -3) | 1 x 1 | `tomato` |  |
| `bin` | bin | (18, 0) | 2 x 2 | (4, -3) | 1 x 1 |  |  |
| `blender_3` | blender | (20, 0) | 2 x 2 | (5, -3) | 1 x 1 |  | party |
| `crate_granola` | crate | (0, 3) | 2 x 2 | (-5, -1.5) | 1 x 1 | `granola` |  |
| `crate_yogurt` | crate | (0, 6) | 2 x 2 | (-5, 0) | 1 x 1 | `yogurt` |  |
| `plates` | plates | (20, 3) | 2 x 2 | (5, -1.5) | 1 x 1 | `plate` |  |
| `cups` | plates | (20, 6) | 2 x 2 | (5, 0) | 1 x 1 | `cup` |  |
| `bowls` | plates | (20, 9) | 2 x 2 | (5, 1.5) | 1 x 1 | `bowl` |  |
| `counter_i1` | counter | (6, 5) | 2 x 2 | (-2, -0.5) | 1 x 1 |  |  |
| `counter_i2` | counter | (8, 5) | 2 x 2 | (-1, -0.5) | 1 x 1 |  |  |
| `counter_i3` | counter | (10, 5) | 2 x 2 | (0, -0.5) | 1 x 1 |  |  |
| `counter_s1` | counter | (0, 12) | 2 x 2 | (-5, 3) | 1 x 1 |  |  |
| `counter_s2` | counter | (2, 12) | 2 x 2 | (-4, 3) | 1 x 1 |  |  |
| `pass` | pass | (6, 12) | 2 x 2 | (-2, 3) | 1 x 1 |  |  |
| `pass_2` | pass | (8, 12) | 2 x 2 | (-1, 3) | 1 x 1 |  | party |
| `counter_s3` | counter | (10, 12) | 2 x 2 | (0, 3) | 1 x 1 |  |  |
| `sink_1` | sink | (14, 12) | 2 x 2 | (2, 3) | 1 x 1 |  |  |
| `sink_2` | sink | (16, 12) | 2 x 2 | (3, 3) | 1 x 1 |  | squad |
| `rack` | rack | (18, 12) | 2 x 2 | (4, 3) | 1 x 1 |  |  |

Washing (`mechanics.wash`): the base set has `sink_1` and `rack`; a container returns dirty to `rack` 240 ticks after a serve (see 6.4 for the full rule).

Station order in `layout.json` is the order of this table (base stations before optional ones of the same def, rule 1.4.1). `w`/`d` in `layout.json` are the metre sizes in the "box" column.

Dispensers `plates` (plate), `cups` (cup), `bowls` (bowl) are three separate `plates`-def stations on the east edge. Colliders: none. Zone `flood`: x 0.5..5.5, z 0.5..3.5 (contains `sink_1`, `sink_2`, `rack` and open sand). Customer queue: `[-0.3, 4.4]`, `[1.0, 4.9]`, `[2.3, 4.4]` (on the boardwalk south of the bar).

Spawn points:

| slot | corner (c, r) | position (x, z) m |
|---|---|---|
| 0 | (4, 8) | [-3.5, 0.5] |
| 1 | (6, 8) | [-2.5, 0.5] |
| 2 | (8, 8) | [-1.5, 0.5] |
| 3 | (10, 8) | [-0.5, 0.5] |
| 4 | (4, 10) | [-3.5, 1.5] |
| 5 | (6, 10) | [-2.5, 1.5] |

### 6.4 Recipes and the new mechanic
| Recipe | Container | Components | Chain in this level |
|---|---|---|---|
| `salad` (110, 60 s) | plate | `chopped_lettuce`, `chopped_tomato` | lettuce -> board; tomato -> board; both on a plate |
| `fruit_yogurt_bowl` (110, 50 s) | bowl | `granola`, `sliced_banana`, `sliced_strawberry`, `yogurt` | banana -> board; strawberry -> board; granola and yogurt direct from crates; all into a bowl |
| `smoothie` (100, 42 s) | cup | `smoothie_ready` | banana + strawberry + milk -> **blender** (4 s = 120 ticks, no burn) -> `smoothie_ready` -> cup |

New station definitions needed in `03` (kind `processor`, `process: 'auto'` unless noted): `blender` (accepts up to 3 distinct inputs from `{banana, strawberry, milk}`, any order, starts when the third input is placed; the recipe chain is `03`'s), `sink` (kind `sink`), `rack` (kind `counter`, receives dirty containers).

New mechanics: (1) the **blender** takes several inputs; (2) **containers come back dirty**: 240 ticks after a serve the container (plate, bowl or cup) appears dirty on `rack`; a chef carries it to a `sink`, holds Action 60 ticks to wash, and the clean container is placed in the sink's socket for pickup (a clean stack is also created at the dispensers when none are left, see 6.5 rule 6). Dispensers `plates`, `cups`, `bowls` hold a **finite stack of 4** containers each at the start (Default tunable `tuning.startStack`); washed containers add to the dispenser stack when carried back and placed on it. This is what makes the sink matter.

### 6.5 Twist: the tide (`kind: 'tide'`)
**State** (`Int32Array`): `[phase, ticksInPhase, floodsDone]`. `phase`: 0 DRY, 1 WARN, 2 FLOOD. Parameters in `level.json` (all integer): `firstFloodTick` 1200, `periodTicks` 1800, `floodTicks` 300 (10 s), `warnTicks` 90 (3 s), `recedeTicks` 60 (render only), `slowQ8` 154 (0.6 x walk speed).

Exact rules (`phaseAt(playTick, 1200, 1800, 90, 300)`; `first` = start of FLOOD):
1. **Schedule:** floods begin at playTick 1200, 3000, 4800 (the level lasts 6300 ticks: three floods, the third ends at 5100). WARN begins 90 ticks earlier: 1110, 2910, 4710.
2. **WARN (90 ticks, 3 s):** event `TideRising { inTicks: 90 }` at the first tick; `view().twist = { phase: 1, ticksToNext }`. Render: waves reach further up the sand, the flood zone edge shows foam, the sink shows a wave icon, audio swell. No sim effect.
3. **FLOOD (300 ticks):** event `TideIn`. Effects: (a) `stationUsable(sink_*) = false`: a Grab/Drop/Action on a sink returns `Refused { reason: 'flooded' }`; (b) wash progress already accumulated on a sink is **kept** and resumes after the flood; (c) `speedMulQ8 = 154` for chefs whose centre is in zone `flood` (shallow water); (d) `dashAllowed` unchanged; (e) the `rack` stays usable (dirty containers can still be picked up and the rack keeps receiving returns); (f) items on stations are never washed away.
4. **End:** at FLOOD tick 300, event `TideOut`, phase 0; the render recedes the water over `recedeTicks` (60) with no sim effect.
5. **Touches:** `stationUsable` (sinks only), `speedMulQ8`, events; **no other state**. The hook never reads the PRNG.
6. **Starvation guard:** if a dispenser is empty and no clean container exists anywhere (stack 0, none held, none in sockets), the dispenser creates one clean container immediately and emits `ContainerRefill` (prevents a hard lock); a refill costs the team a streak reset. (Flag `tuning.refillOnEmpty: true`.)
7. Balance intent: 300 / 1800 = 16.7% of the time the sinks are down; the team must wash before the tide and keep a **clean stack** at the dispensers. Washing takes 60 ticks per container, so a full 4-stack needs 8 s of one chef's time.

### 6.6 Pacing and ticket time
| Field | Value |
|---|---|
| `durationSeconds` | 210 |
| `countdownSeconds` | 3 |
| `secondTicketAfterSeconds` | 20 |
| `pacing.minDelaySeconds` / `maxDelaySeconds` | 1.5 / 20 |
| `pacing.burstChance` / `burstFactor` / `calmFactor` | 35 / 0.35 / 0.75 |
| `pacing.baseFromTicketTime` / `baseMinSeconds` / `baseMaxSeconds` | 0.3 / 4 / 13 |
| `ticketTimeBase` | 0.9 |
| `maxActive` solo / duo / squad / party | 2 / 3 / 4 / 5 |
| `rate` solo / duo / squad / party | 0.55 / 1.0 / 1.6 / 2.2 |
| `ticketTimeMul` solo / duo / squad / party | 1.25 / 1.0 / 0.95 / 0.9 |
| Ticket time (average over this level's recipes: salad, fruit_yogurt_bowl, smoothie) at duo | 50.7 s x 0.9 = **45.6 s**; solo 57.0 s, squad 43.3 s, party 41.0 s |

### 6.7 Stars
| Bucket | 1 star | 2 stars | 3 stars |
|---|---|---|---|
| solo | 900 | 1700 | 2300 |
| duo | 1500 | 2700 | 3700 |
| squad | 2200 | 4050 | 5550 |
| party | 2950 | 5400 | 7400 |

Method: §15 (bot median x 0.30 / 0.55 / 0.75). Numbers above are **provisional** (Default, tunable) until the bots in `09` measure them.

### 6.8 Camera, lighting, music
`level.json.camera` (`CameraSpec`, `01 §10.5`; same pitch and distance on every level so the chefs keep the same on-screen size):
```json
"camera": {
  "position": [0, 12.14, 9.22],
  "target": [0, 0.2, 0.2],
  "fov": 38,
  "lean": 0.1
}
```
Derivation: pitch 54 degrees, distance 15 m (`position = target + 15 x (0, sin 54, cos 54)` with focus z = 0.4). Fit check at 16:9: the visible ground half-width at 15 m is about 9.2 m and half-depth about 6.4 m; this level needs 7.1 m and 4.9 m (playable half-size + margin 1.6 m / 1.4 m), so the whole playable area and a margin are visible without zooming. `CameraRig` increases the distance for narrower aspect ratios (`04`). `lean` 0.1 = the camera focus shifts by 10% of the chef centroid offset, with critically damped smoothing; it never follows one chef.
Lighting `beach_sunset`. Music `beach_tropical`.

### 6.9 Diorama dressing and ambient life
1. Bamboo hut with a palm-thatch roof edge (cut away), string of paper lanterns, a chalk menu "Smoothies 100".
2. Surfboards (4 colours) leaning on the west wall, a surf shop crate, a hammock between two palms (east), beach towels, a volleyball net far south, sandcastles, a lifeguard tower far east.
3. The sea on the west and south with a **wave line** whose position is driven by the tide phase (render reads `view.twist`), a pier stub, a sailboat on the horizon, distant islands.
4. Tiki torches (3, flicker), driftwood, beach umbrellas (2), a cooler box, flip-flops.
Ambient life: crabs (2) walk sideways near the water line and hide when the tide comes in; seagulls (2) glide; palm fronds sway; a surfer paddles out and rides a wave every ~30 s; beach-goers walk along the shore (3 agents); customers (kinds `surfer`, `tourist`, `kid`).

### 6.10 Onboarding (first 30 seconds)
`openingTickets = ['smoothie', 'salad']`.
| Time | What happens |
|---|---|
| 3 s | ticket 1 `smoothie` (42 s, the quickest): arrow `crate_banana` -> `blender_1` ("Poser"), `crate_strawberry`, `crate_milk` each ending in `blender_1`; ring shows the blend; arrow `cups` -> pickup -> `pass` |
| 8 s into the first serve | first serve completes, **a dirty cup appears on the rack 8 s later**; arrow points at the rack, then `sink_1` ("Laver (maintenir)") |
| flood | the first flood is at 40 s, after the wash has been learned; WARN at 37 s shows the wave icon once with a tooltip "Marée : l'évier est coupé" |
The first 30 s teach the blender; the first wash happens by about 20 s.

### 6.11 Expert shortcut
**Wash ahead of the tide**: at WARN, run the dirty rack through the sink and **stock the cup dispenser to 4** so a 10 s flood costs nothing. **Use the island**: bananas and strawberries are on the north line next to the blender, so one chef can feed `blender_1` in 3 grabs while another chops for the bowl. **Throw** a washed cup from the sink corner to the island pad `counter_i3` (about 4 m) instead of walking across the flooded zone at 0.6 speed.

### 6.12 Level-specific acceptance tests
- During FLOOD a hold-Action on `sink_1` yields `Refused('flooded')` and wash progress is not lost.
- `TideRising` is emitted exactly 90 ticks before `TideIn`, at playTick 1110, 2910, 4710.
- Chef speed in zone `flood` during FLOOD is 0.6 x 4.0 m/s (+-1 Q8 step).
- A bot with no washing logic cannot exceed the 1-star threshold in duo (the sink must matter); a bot that washes proactively exceeds the 2-star threshold.

---

## 7. Level 5 · La Pizzeria sur les Toits (`l05_pizzeria`)

### 7.1 Identity
| Field | Value |
|---|---|
| id / order | `l05_pizzeria` / 5 |
| Mechanics flags | `throw: true`, `wash: true` |
| Twist | `{ kind: 'dumbwaiter', params: { travelTicks: 60, capacity: 2, stairsSlowQ8: 217 } }` |
| New mechanic | **Long oven cook** (12 s cook, 8 s burn window); the press and the pizza assembly |
| Unlock | `{ requires: 'l04_smoothies', minStars: 1 }` |

### 7.2 Setting and mood
A pizzeria spread over two rooftop terraces of an old town at night: tiled roofs, chimneys, a church tower, string lights, a neon "Pizza" sign, stars. The upper terrace holds the wood-fired ovens, the lower terrace the dough, toppings and the pass. Mood: **cosy, romantic, a little busy**.

### 7.3 Layout
Playable `24 x 16` cells (`x -6..6, z -4..4`, 12 m x 8 m). Heights are render-only (the upper terrace is drawn 1.5 m higher); the sim plane is flat. The terraces are separated by a **low railing** (collider, `flyOver`) with a **stairs opening of 4 cells (2 m)** in the middle (zone `stairs`, speed x 0.85). A **dumbwaiter** pair of shafts runs along the east side. Both terraces open to the night sky and the old town skyline.

```
col  000000000011111111112222
     012345678901234567890123
r00  ==OOoooo==========DDDDXX
r01  ==OOoooo==========DDDDXX
r02  ........................
r03  ........................
r04  ........................
r05  ......==................
r06  ......==................
r07  ##########^^^^##########
r08  ##########^^^^##########
r09  1122bb====....WWUUDDDD..
r10  1122bb====....WWUUDDDDVV
r11  ......................VV
r12  ....*.*.*.*.*.*.......vv
r13  ......................vv
r14  33RR445566NN7788BBPPPPXX
r15  33RR445566NN7788BBPPPPXX
```

Legend: general symbols in 1.2. Digits for this level: `1` = banana; `2` = strawberry; `3` = pizza_dough; `4` = tomato_sauce; `5` = shredded_mozzarella; `6` = milk; `7` = lettuce; `8` = tomato. Twist zones (shown as `,` where floor): `stairs` (cols 10..13, rows 7..8).

| id | def | cell (c, r) | size (cells) | centre (x, z) m | box (w x d) m | dispenses | optional |
|---|---|---|---|---|---|---|---|
| `counter_u1` | counter | (0, 0) | 2 x 2 | (-5.5, -3.5) | 1 x 1 |  |  |
| `oven_1` | oven | (2, 0) | 2 x 2 | (-4.5, -3.5) | 1 x 1 |  |  |
| `oven_2` | oven | (4, 0) | 2 x 2 | (-3.5, -3.5) | 1 x 1 |  | squad |
| `oven_3` | oven | (6, 0) | 2 x 2 | (-2.5, -3.5) | 1 x 1 |  | party |
| `counter_u2` | counter | (8, 0) | 2 x 2 | (-1.5, -3.5) | 1 x 1 |  |  |
| `counter_u3` | counter | (10, 0) | 2 x 2 | (-0.5, -3.5) | 1 x 1 |  |  |
| `counter_u4` | counter | (12, 0) | 2 x 2 | (0.5, -3.5) | 1 x 1 |  |  |
| `counter_u5` | counter | (14, 0) | 2 x 2 | (1.5, -3.5) | 1 x 1 |  |  |
| `counter_u6` | counter | (16, 0) | 2 x 2 | (2.5, -3.5) | 1 x 1 |  |  |
| `dw_down_in` | dumbwaiter | (18, 0) | 2 x 2 | (3.5, -3.5) | 1 x 1 |  |  |
| `dw_up_out` | dumbwaiter | (20, 0) | 2 x 2 | (4.5, -3.5) | 1 x 1 |  |  |
| `bin_u` | bin | (22, 0) | 2 x 2 | (5.5, -3.5) | 1 x 1 |  |  |
| `catch_up` | counter | (6, 5) | 2 x 2 | (-2.5, -1) | 1 x 1 |  |  |
| `crate_banana` | crate | (0, 9) | 2 x 2 | (-5.5, 1) | 1 x 1 | `banana` |  |
| `crate_strawberry` | crate | (2, 9) | 2 x 2 | (-4.5, 1) | 1 x 1 | `strawberry` |  |
| `board_2` | board | (4, 9) | 2 x 2 | (-3.5, 1) | 1 x 1 |  | squad |
| `catch_low` | counter | (6, 9) | 2 x 2 | (-2.5, 1) | 1 x 1 |  |  |
| `counter_l1` | counter | (8, 9) | 2 x 2 | (-1.5, 1) | 1 x 1 |  |  |
| `sink_1` | sink | (14, 9) | 2 x 2 | (1.5, 1) | 1 x 1 |  |  |
| `rack` | rack | (16, 9) | 2 x 2 | (2.5, 1) | 1 x 1 |  |  |
| `dw_up_in` | dumbwaiter | (18, 9) | 2 x 2 | (3.5, 1) | 1 x 1 |  |  |
| `dw_down_out` | dumbwaiter | (20, 9) | 2 x 2 | (4.5, 1) | 1 x 1 |  |  |
| `pass` | pass | (22, 10) | 2 x 2 | (5.5, 1.5) | 1 x 1 |  |  |
| `pass_2` | pass | (22, 12) | 2 x 2 | (5.5, 2.5) | 1 x 1 |  | party |
| `crate_dough` | crate | (0, 14) | 2 x 2 | (-5.5, 3.5) | 1 x 1 | `pizza_dough` |  |
| `press` | press | (2, 14) | 2 x 2 | (-4.5, 3.5) | 1 x 1 |  |  |
| `crate_sauce` | crate | (4, 14) | 2 x 2 | (-3.5, 3.5) | 1 x 1 | `tomato_sauce` |  |
| `crate_mozz` | crate | (6, 14) | 2 x 2 | (-2.5, 3.5) | 1 x 1 | `shredded_mozzarella` |  |
| `crate_milk` | crate | (8, 14) | 2 x 2 | (-1.5, 3.5) | 1 x 1 | `milk` |  |
| `blender` | blender | (10, 14) | 2 x 2 | (-0.5, 3.5) | 1 x 1 |  |  |
| `crate_lettuce` | crate | (12, 14) | 2 x 2 | (0.5, 3.5) | 1 x 1 | `lettuce` |  |
| `crate_tomato` | crate | (14, 14) | 2 x 2 | (1.5, 3.5) | 1 x 1 | `tomato` |  |
| `board_1` | board | (16, 14) | 2 x 2 | (2.5, 3.5) | 1 x 1 |  |  |
| `cups` | plates | (18, 14) | 2 x 2 | (3.5, 3.5) | 1 x 1 | `cup` |  |
| `plates` | plates | (20, 14) | 2 x 2 | (4.5, 3.5) | 1 x 1 | `plate` |  |
| `bin_l` | bin | (22, 14) | 2 x 2 | (5.5, 3.5) | 1 x 1 |  |  |

Washing (`mechanics.wash`): the base set has `sink_1` and `rack`; a container returns dirty to `rack` 240 ticks after a serve (see 6.4 for the full rule).

Station order in `layout.json` is the order of this table (base stations before optional ones of the same def, rule 1.4.1). `w`/`d` in `layout.json` are the metre sizes in the "box" column.

Colliders: `railing_w` x -3.5, z 0, w 5, d 1 (cols 0..9, rows 7..8 box x -6..-1, z -0.5..0.5), `railing_e` x 3.5, z 0, w 5, d 1 (cols 14..23, box x 1..6). Both `flyOver: true`. Zone `stairs`: x -1..1, z -0.5..0.5. Customer queue (diners at tables east of the lower terrace, render only): `[7.2, 1.5]`, `[7.9, 2.3]`, `[8.6, 1.5]`.

Spawn points (all six on the lower terrace, where the work starts):

| slot | corner (c, r) | position (x, z) m |
|---|---|---|
| 0 | (4, 12) | [-4, 2] |
| 1 | (6, 12) | [-3, 2] |
| 2 | (8, 12) | [-2, 2] |
| 3 | (10, 12) | [-1, 2] |
| 4 | (12, 12) | [0, 2] |
| 5 | (14, 12) | [1, 2] |

### 7.4 Recipes and the new mechanic
| Recipe | Container | Components | Chain in this level |
|---|---|---|---|
| `pizza_margherita` (180, 105 s) | plate | `cooked_pizza_margherita` | `crate_dough` -> `press` (2 s) -> `pizza_base`; `+ tomato_sauce` (crate) `+ shredded_mozzarella` (crate) on a counter -> `pizza_margherita_raw`; **up** to an oven (12 s = 360 ticks, burn window 8 s); **down** to the pass |
| `salad` (110, 60 s) | plate | `chopped_lettuce`, `chopped_tomato` | lettuce, tomato -> board (lower) |
| `smoothie` (100, 42 s) | cup | `smoothie_ready` | banana + strawberry + milk -> `blender` (lower) |

Pizza assembly rule (defined in `03`): `pizza_base` is a carrier item that accepts `tomato_sauce` then `shredded_mozzarella` (any order) and becomes `pizza_margherita_raw` when it holds both; it is placed in an oven like any item. A cooked pizza goes on a plate (`cooked_pizza_margherita` is the component).

New mechanic: **the long cook**. A pizza stays in the oven 12 s while the chefs do other orders; a pizza forgotten for the 8 s burn window burns; ovens are far from the pass on purpose so planning matters. Fire is not active on this level.

### 7.5 Twist: the dumbwaiter (`kind: 'dumbwaiter'`)
Two one-way shafts (`shaft_up`, `shaft_down`), each with 2 slots. Stations: `dw_up_in` (lower, input of `shaft_up`) -> `dw_up_out` (upper); `dw_down_in` (upper, input of `shaft_down`) -> `dw_down_out` (lower). Each station is a `dumbwaiter` kind with a single socket.

**State** (`Int32Array`, 12 ints): for each shaft s in {0,1}: `count`, then two slots of `[itemId (-1 empty), arriveTick (playTick when it can leave the cab)]`.
Rules, run in the hook's `onTickEnd` (H2), shaft 0 then shaft 1:
1. **Send:** if the `*_in` socket holds an item and `count < capacity (2)`: move the item from the socket into the cab, `arriveTick = playTick + travelTicks (60)`, `count++`, event `DumbwaiterSent { shaft }`. Containers travel with their contents (a plate with food rides intact). Cooking and burning timers **pause** in transit (timers advance only on processors).
2. **Arrive:** for slots in index order with `playTick >= arriveTick`: if the `*_out` socket is empty, place the item there, free the slot, `count--`, event `DumbwaiterArrived { shaft }`; otherwise the item waits in the cab (blocks the shaft when full).
3. A chef interacts with the two end stations as with counters (`Grab` from `*_out`, `Drop` on `*_in`). `*_in` stations accept only one item at a time (the socket empties each tick when the cab has room).
4. **Stairs:** zone `stairs` applies `speedMulQ8 = 217` (0.85) so the free stairs are slightly slower than the open deck; dash stays allowed.
5. **Telegraph:** the shaft has a lit indicator and a bell on arrival (events); there is nothing harmful, so rule 4 of `01 §7.4` is vacuous.
6. **Touches:** the 4 station sockets, items (move between socket and cab), events. Hash: `save()` array. No PRNG.
7. Travel comparison: shaft = 60 ticks (2 s) with no walking; stairs = about 9 m of walking at 0.85 speed, about 2.6 s each way; throw over the railing = 12 ticks flight (expert shortcut 7.11).

### 7.6 Pacing and ticket time
| Field | Value |
|---|---|
| `durationSeconds` | 240 |
| `countdownSeconds` | 3 |
| `secondTicketAfterSeconds` | 20 |
| `pacing.minDelaySeconds` / `maxDelaySeconds` | 1.5 / 18 |
| `pacing.burstChance` / `burstFactor` / `calmFactor` | 40 / 0.35 / 0.75 |
| `pacing.baseFromTicketTime` / `baseMinSeconds` / `baseMaxSeconds` | 0.3 / 4 / 13 |
| `ticketTimeBase` | 0.9 |
| `maxActive` solo / duo / squad / party | 2 / 3 / 4 / 5 |
| `rate` solo / duo / squad / party | 0.55 / 1.0 / 1.6 / 2.2 |
| `ticketTimeMul` solo / duo / squad / party | 1.25 / 1.0 / 0.95 / 0.9 |
| Ticket time (average over this level's recipes: pizza_margherita, salad, smoothie) at duo | 69.0 s x 0.9 = **62.1 s**; solo 77.6 s, squad 59.0 s, party 55.9 s |
Pizza has the longest ticket (105 s x `ticketTimeBase` 0.90 = 94.5 s at duo).

### 7.7 Stars
| Bucket | 1 star | 2 stars | 3 stars |
|---|---|---|---|
| solo | 950 | 1750 | 2400 |
| duo | 1550 | 2850 | 3900 |
| squad | 2350 | 4300 | 5850 |
| party | 3100 | 5700 | 7800 |

Method: §15 (bot median x 0.30 / 0.55 / 0.75). Numbers above are **provisional** (Default, tunable) until the bots in `09` measure them.

### 7.8 Camera, lighting, music
`level.json.camera` (`CameraSpec`, `01 §10.5`; same pitch and distance on every level so the chefs keep the same on-screen size):
```json
"camera": {
  "position": [0, 12.14, 9.22],
  "target": [0, 0.2, 0.2],
  "fov": 38,
  "lean": 0.1,
  "zones": [
    { "zone": "upper", "position": [0, 12.14, 8.32], "target": [0, 0.2, -0.9], "fov": 38 },
    { "zone": "lower", "position": [0, 12.14, 10.22], "target": [0, 0.2, 1.0], "fov": 38 }
  ]
}
```
Derivation: pitch 54 degrees, distance 15 m (`position = target + 15 x (0, sin 54, cos 54)` with focus z = 0.4). Fit check at 16:9: the visible ground half-width at 15 m is about 9.2 m and half-depth about 6.4 m; this level needs 7.6 m and 5.4 m (playable half-size + margin 1.6 m / 1.4 m), so the whole playable area and a margin are visible without zooming. `CameraRig` increases the distance for narrower aspect ratios (`04`). `lean` 0.1 = the camera focus shifts by 10% of the chef centroid offset, with critically damped smoothing; it never follows one chef.
Two zone framings (gentle, 0.5 m radius ease, 1.2 s): `upper` target `[0, 0.2, -0.9]`, `lower` target `[0, 0.2, 1.0]`; the camera picks the zone of the chefs' centroid with hysteresis of 1 m. Lighting `rooftop_night`. Music `rooftop_jazz`.

### 7.9 Diorama dressing and ambient life
1. Two terraces with terracotta tiles, a stone parapet, a wooden pergola with string lights over the lower terrace, two brick wood-fired ovens with chimneys on the upper terrace, a neon sign "PIZZA" (red) on the north parapet.
2. The old town: 20 houses of 3 heights with lit windows (coarse voxels, fog), a church tower with a clock, chimneys with smoke, clotheslines, a distant bridge and river, a full moon and stars.
3. Planters with basil and geraniums, a rooftop table set for 2, a bicycle, an antenna, water tanks.
4. The dumbwaiter shafts: wooden boxes with a pulley and rope (the cab visibly rises).
Ambient life: pigeons (3) walk and flap, cats (1) walks along the parapet, a slow-flickering window light pattern, laundry sways, smoke curls, a passing couple on a facing roof, fireflies/embers from the ovens, church bell at 20 s intervals (audio only); customers (kinds `couple`, `waiter_friend`, `nonna`).

### 7.10 Onboarding (first 30 seconds)
`openingTickets = ['salad', 'pizza_margherita']`.
| Time | What happens |
|---|---|
| 3 s | ticket 1 `salad` (a familiar chain, learn the layout) |
| 15 s | ticket 2 `pizza_margherita` (`secondTicketAfterSeconds: 20`, or after the first serve) with a guide arrow: `crate_dough` -> `press` -> counter -> sauce -> mozzarella -> **`dw_up_in`** with the prompt "Envoyer en haut" -> arrow shows the upper terrace `oven_1` (camera eases up) -> `oven_1` "Poser" |
| oven started | ring fills slowly; a banner "12 s" is not shown; the arrow disappears |
| at completion | arrow to `oven_1`, then `dw_down_in`, then lower `dw_down_out`, then plate, then `pass` |
The long first cook (12 s) is the new idea: during it the player prepares the salad (ticket 1 or the next). The stairs are never forced; the dumbwaiter is the guided route because it is safe.

### 7.11 Expert shortcut
**Throw raw pizzas over the railing**: from the lower aisle at `catch_low`'s side, throw `pizza_margherita_raw` to `catch_up` (the counter against the railing on the upper terrace, x = -2.5, z = -1); a distance of about 2 m, 12 ticks, faster than the dumbwaiter (60 ticks + a placement). Also throw cooked pizzas down to `catch_low`. Experts keep an oven loaded constantly (the 12 s cook plus 8 s window gives a 20 s planning horizon).

### 7.12 Level-specific acceptance tests
- A plate with contents survives a dumbwaiter trip intact; burn timers do not advance in transit.
- Both stairs cells and the throw route work with 6 chefs (no deadlock: the stairs are 4 cells wide).
- A pizza placed in an oven completes at exactly 360 ticks and burns 240 ticks later.
- Chefs on the upper terrace and lower terrace are both visible in the frame at 16:9 and at 4:3.

---

## 8. Level 6 · La Friterie du Bateau-Mouche (`l06_bateau`)

### 8.1 Identity
| Field | Value |
|---|---|
| id / order | `l06_bateau` / 6 |
| Mechanics flags | `throw: true`, `wash: true`, `fire: true` |
| Twist | `{ kind: 'low_bridges', params: { firstImpactTick: 1500, periodTicks: 1200, warnTicks: 150, lockTicks: 120, stunTicks: 24 } }` |
| New mechanic | **Coating station**, **fire** (and holding Action to extinguish) |
| Unlock | `{ requires: 'l05_pizzeria', minStars: 1 }` |

### 8.2 Setting and mood
A paddle river boat cruising through a city: stone embankments, plane trees, quays with strollers, arched bridges passing overhead every 40 s. The galley is on the open deck; the fryers sit under a tall funnel on the **upper deck**, where the bridges pass. Mood: **lively, comic urgency** (the bridge horn is the star sound).

### 8.3 Layout
Playable `24 x 12` cells (`x -6..6, z -3..3`, 12 m x 6 m). The **upper deck** is the north-east block (zone `bridge`: fryers, the potato crate and the funnel). The **lower deck** (south) has plates, counters and the pass. The coating and boards are on the north-west (outside the bridge zone). The boat sides are low railings (colliders), open to the water and the quays. The funnel is a small solid collider.

```
col  000000000011111111112222
     012345678901234567890123
r00  1122BBbbGGgg33FFFFffff==
r01  1122BBbbGGgg33FFFFffff==
r02  ............,,,,,,,,,,,,
r03  ............,,,,,,,,,,,,
r04  ............,,,,,,,,,,,,
r05  ....*...*...,,,,,,##,,,,
r06  ......*...*.............
r07  ............*.*.........
r08  ........................
r09  ........................
r10  WWUUPP==VVvv==XX==wwbb==
r11  WWUUPP==VVvv==XX==wwbb==
```

Legend: general symbols in 1.2. Digits for this level: `1` = onion; `2` = raw_chicken; `3` = potato. Twist zones (shown as `,` where floor): `bridge` (cols 12..23, rows 0..5).

| id | def | cell (c, r) | size (cells) | centre (x, z) m | box (w x d) m | dispenses | optional |
|---|---|---|---|---|---|---|---|
| `crate_onion` | crate | (0, 0) | 2 x 2 | (-5.5, -2.5) | 1 x 1 | `onion` |  |
| `crate_chicken` | crate | (2, 0) | 2 x 2 | (-4.5, -2.5) | 1 x 1 | `raw_chicken` |  |
| `board_1` | board | (4, 0) | 2 x 2 | (-3.5, -2.5) | 1 x 1 |  |  |
| `board_2` | board | (6, 0) | 2 x 2 | (-2.5, -2.5) | 1 x 1 |  | squad |
| `coating_1` | coating | (8, 0) | 2 x 2 | (-1.5, -2.5) | 1 x 1 |  |  |
| `coating_2` | coating | (10, 0) | 2 x 2 | (-0.5, -2.5) | 1 x 1 |  | squad |
| `crate_potato` | crate | (12, 0) | 2 x 2 | (0.5, -2.5) | 1 x 1 | `potato` |  |
| `fryer_1` | fryer | (14, 0) | 2 x 2 | (1.5, -2.5) | 1 x 1 |  |  |
| `fryer_2` | fryer | (16, 0) | 2 x 2 | (2.5, -2.5) | 1 x 1 |  |  |
| `fryer_3` | fryer | (18, 0) | 2 x 2 | (3.5, -2.5) | 1 x 1 |  | squad |
| `fryer_4` | fryer | (20, 0) | 2 x 2 | (4.5, -2.5) | 1 x 1 |  | party |
| `counter_u1` | counter | (22, 0) | 2 x 2 | (5.5, -2.5) | 1 x 1 |  |  |
| `sink_1` | sink | (0, 10) | 2 x 2 | (-5.5, 2.5) | 1 x 1 |  |  |
| `rack` | rack | (2, 10) | 2 x 2 | (-4.5, 2.5) | 1 x 1 |  |  |
| `plates` | plates | (4, 10) | 2 x 2 | (-3.5, 2.5) | 1 x 1 | `plate` |  |
| `counter_w2` | counter | (6, 10) | 2 x 2 | (-2.5, 2.5) | 1 x 1 |  |  |
| `pass` | pass | (8, 10) | 2 x 2 | (-1.5, 2.5) | 1 x 1 |  |  |
| `pass_2` | pass | (10, 10) | 2 x 2 | (-0.5, 2.5) | 1 x 1 |  | party |
| `counter_w3` | counter | (12, 10) | 2 x 2 | (0.5, 2.5) | 1 x 1 |  |  |
| `bin` | bin | (14, 10) | 2 x 2 | (1.5, 2.5) | 1 x 1 |  |  |
| `counter_w4` | counter | (16, 10) | 2 x 2 | (2.5, 2.5) | 1 x 1 |  |  |
| `sink_2` | sink | (18, 10) | 2 x 2 | (3.5, 2.5) | 1 x 1 |  | squad |
| `board_3` | board | (20, 10) | 2 x 2 | (4.5, 2.5) | 1 x 1 |  | party |
| `counter_w6` | counter | (22, 10) | 2 x 2 | (5.5, 2.5) | 1 x 1 |  |  |

Washing (`mechanics.wash`): the base set has `sink_1` and `rack`; a container returns dirty to `rack` 240 ticks after a serve (see 6.4 for the full rule).

Station order in `layout.json` is the order of this table (base stations before optional ones of the same def, rule 1.4.1). `w`/`d` in `layout.json` are the metre sizes in the "box" column.

Colliders: `funnel` x 3.5, z -0.25, w 1, d 0.5 (cells cols 18..19, row 5), `flyOver: false` (it keeps a 3-cell aisle, rows 2..4, on the upper deck). Railings are render-only (the playable bound is the boat's edge). Zone `bridge`: x 0..6, z -3..0 (x 0..6, z -3..0). Customer queue (on the quay, south): `[-3.0, 4.2]`, `[-1.8, 4.6]`, `[-0.6, 4.2]`.

Spawn points (all on the lower deck, outside the zone):

| slot | corner (c, r) | position (x, z) m |
|---|---|---|
| 0 | (4, 5) | [-4, -0.5] |
| 1 | (6, 6) | [-3, 0] |
| 2 | (8, 5) | [-2, -0.5] |
| 3 | (10, 6) | [-1, 0] |
| 4 | (12, 7) | [0, 0.5] |
| 5 | (14, 7) | [1, 0.5] |

### 8.4 Recipes and the new mechanics
| Recipe | Container | Components | Chain in this level |
|---|---|---|---|
| `french_fries` (100, 48 s) | plate | `cooked_fries` | potato (upper) -> board -> fryer (upper) |
| `onion_rings` (110, 56 s) | plate | `cooked_onion_rings` | onion -> board (chop) -> `onion_rings_raw` -> **coating** (2 s) -> `onion_rings_coated` -> fryer (5 s, burn 6 s) |
| `chicken_tenders_fries` (150, 84 s) | plate | `cooked_chicken_tenders`, `cooked_fries` | chicken -> board -> `raw_chicken_strips` -> coating -> `coated_chicken_strips` -> fryer; plus fries |

New mechanics: (1) the **coating station** (2 s auto, no burn); (2) **fire**: a burnt item left on a processor for 240 ticks (8 s) ignites the station; fire spreads to adjacent stations every 120 ticks (4 s); a chef carrying the **extinguisher** item **holds Action 45 ticks** while targeting a burning station to put it out (02 §10.4); a burning station is unusable and a chef standing adjacent takes no damage (no health). The fire is a routing problem, not a punishment (a station out of order for several seconds).

### 8.5 Twist: low bridges (`kind: 'low_bridges'`)
**State** (`Int32Array`): `[phase, ticksInPhase, impactsDone]`. `phase`: 0 CLEAR, 1 WARN, 2 LOCK. Params: `firstImpactTick` 1500, `periodTicks` 1200, `warnTicks` 150 (5 s), `lockTicks` 120 (4 s), `stunTicks` 24 (0.8 s).

Rules (`phaseAt(playTick, 1500, 1200, 150, 120)`; `first` = start of LOCK):
1. **Schedule:** LOCK starts at playTick 1500, 2700, 3900, 5100 (four bridges; level length 6300 ticks). WARN starts 150 ticks earlier: 1350, 2550, 3750, 4950. The first bridge arrives 50 s in so the first minute is calm.
2. **WARN (150 ticks, 5 s):** event `BridgeApproaching { inTicks: 150 }`; `view().twist.ticksToNext` counts down; render: the bridge shadow slides toward the funnel zone, the zone cells show a yellow hatched overlay, a **horn at 150 and at 60 ticks to go**, the funnel lowers. No sim effect.
3. **LOCK start (H1, before chefs move):** event `BridgeLock`; `ctx.ejectChefs(zone bridge box expanded by CHEF_RADIUS, stunTicks 24)`: any chef whose circle overlaps the zone is moved to the nearest free cell centre **outside** the zone (smaller z, then smaller x on ties), stunned 24 ticks (cannot move or act; **keeps the held item**).
4. **During LOCK (120 ticks):** `isBlocked(x, z)` is true inside the zone (chefs cannot walk in); `stationUsable(i)` is false for every station whose box overlaps the zone (fryers 1-4, `crate_potato`): Grab, Drop and Action return `Refused { reason: 'locked' }`. **Processors keep running**: a fryer loaded before the lock keeps cooking, and its burn timer keeps running. Fire keeps spreading.
5. **End:** event `BridgeClear`; zone usable again; chefs may re-enter.
6. **Touches:** `isBlocked`, `stationUsable`, `ejectChefs`, events; items and processors untouched. No PRNG.
7. **Design check (fryer item: cooks 150 ticks, burns 180 ticks after that).** With LOCK starting at tick L: an item loaded in the last second of WARN (at L - 30) is cooked exactly when the lock ends (L + 120) and then has its full 180-tick burn window (perfect). An item loaded at WARN start (L - 150) is cooked at L and burns at L + 180, which is 60 ticks (2 s) after the lock ends: collect it at once. An item loaded earlier than WARN start burns during the lock unless collected first. This is the intended skill.

### 8.6 Pacing and ticket time
| Field | Value |
|---|---|
| `durationSeconds` | 210 |
| `countdownSeconds` | 3 |
| `secondTicketAfterSeconds` | 18 |
| `pacing.minDelaySeconds` / `maxDelaySeconds` | 1.5 / 18 |
| `pacing.burstChance` / `burstFactor` / `calmFactor` | 40 / 0.35 / 0.75 |
| `pacing.baseFromTicketTime` / `baseMinSeconds` / `baseMaxSeconds` | 0.3 / 4 / 12 |
| `ticketTimeBase` | 0.88 |
| `maxActive` solo / duo / squad / party | 3 / 4 / 5 / 6 |
| `rate` solo / duo / squad / party | 0.55 / 1.0 / 1.6 / 2.2 |
| `ticketTimeMul` solo / duo / squad / party | 1.25 / 1.0 / 0.95 / 0.9 |
| Ticket time (average over this level's recipes: french_fries, onion_rings, chicken_tenders_fries) at duo | 62.7 s x 0.88 = **55.1 s**; solo 68.9 s, squad 52.4 s, party 49.6 s |

### 8.7 Stars
| Bucket | 1 star | 2 stars | 3 stars |
|---|---|---|---|
| solo | 900 | 1700 | 2300 |
| duo | 1500 | 2700 | 3700 |
| squad | 2200 | 4050 | 5550 |
| party | 2950 | 5400 | 7400 |

Method: §15 (bot median x 0.30 / 0.55 / 0.75). Numbers above are **provisional** (Default, tunable) until the bots in `09` measure them.

### 8.8 Camera, lighting, music
`level.json.camera` (`CameraSpec`, `01 §10.5`; same pitch and distance on every level so the chefs keep the same on-screen size):
```json
"camera": {
  "position": [0, 12.14, 9.22],
  "target": [0, 0.2, 0.2],
  "fov": 38,
  "lean": 0.1
}
```
Derivation: pitch 54 degrees, distance 15 m (`position = target + 15 x (0, sin 54, cos 54)` with focus z = 0.4). Fit check at 16:9: the visible ground half-width at 15 m is about 9.2 m and half-depth about 6.4 m; this level needs 7.6 m and 4.4 m (playable half-size + margin 1.6 m / 1.4 m), so the whole playable area and a margin are visible without zooming. `CameraRig` increases the distance for narrower aspect ratios (`04`). `lean` 0.1 = the camera focus shifts by 10% of the chef centroid offset, with critically damped smoothing; it never follows one chef.
Lighting `river_afternoon`. Music `river_waltz` (a snare roll starts at WARN, synced to the horn).

### 8.9 Diorama dressing and ambient life
1. The boat: white and red hull with a wooden deck, a tall black funnel with a red band, a pilot house with a wheel and a captain (animated), hanging lifebuoys, benches, deck lights.
2. Embankments: stone walls with ring bollards, plane trees, quays with lamp posts, bookstalls, cafe terraces, apartment facades (5 storeys) on both banks, a cathedral on the horizon.
3. Bridges: 4 stone arch bridges rendered one at a time sliding over the boat at the impact ticks (a mesh whose position is a pure function of the twist phase: x travels from -30 to +30 over 270 ticks, centred over the zone at `LOCK` start, passing over in 120 ticks).
4. Water: wake foam behind, ripples, floating ducks.
Ambient life: ducks (4) paddle; strollers (6) walk the quays and wave at the boat; a rowing crew passes; birds (3) perch on the funnel and **fly off at WARN**; a dog on the quay barks at the bridge; customers (kinds `tourist`, `commuter`, `kid`) sit at the south bench.

### 8.10 Onboarding (first 30 seconds)
`openingTickets = ['french_fries', 'onion_rings']`.
| Time | What happens |
|---|---|
| 3 s | ticket 1 `french_fries`: potato -> board -> fryer on the upper deck (familiar) |
| 18 s | ticket 2 `onion_rings`: arrow to `crate_onion` -> `board_1` -> **`coating_1`** ("Enrober") -> fryer |
| burnt item (if it happens) | a fire icon on the station and the prompt "Éteindre (maintenir)" |
The first bridge is at 50 s, so a first-time player never meets the lock in the first 30 s. WARN shows a one-line banner "Pont ! Quittez le pont supérieur" the first time only.

### 8.11 Expert shortcut
**Load the fryers during WARN's last second, leave the zone, plate elsewhere**: all four fryers cook through the LOCK and the team collects the food when it reopens. Experts also **throw coated items from the coating line into the fryer line before WARN ends** (`coating_1` at x = -1.5 to `fryer_1` at x = 1.5, 4 m).

### 8.12 Level-specific acceptance tests
- A chef standing in the zone at LOCK start is ejected exactly once, keeps the held item, and is stunned 24 ticks.
- `BridgeApproaching` fires at playTick 1350, 2550, 3750, 4950 (150 ticks before `BridgeLock`).
- During LOCK `stationUsable(fryer_1) === false` and `fryer_1`'s item timer still advances.
- Extinguishing a burning fryer takes 45 ticks of held Action with the extinguisher item.

---

## 9. Level 7 · Le Marché de Nuit (`l07_marche`)

### 9.1 Identity
| Field | Value |
|---|---|
| id / order | `l07_marche` / 7 |
| Mechanics flags | `throw: true`, `wash: true`, `fire: true` |
| Twist | `{ kind: 'crowd_lane', params: { firstWaveTick: 900, periodTicks: 750, warnTicks: 75, waveTicks: 210, slowQ8: 64 } }` |
| New mechanic | **Several short chains in parallel** (4 recipes, each 1 to 3 steps), toaster |
| Unlock | `{ requires: 'l06_bateau', minStars: 1 }` |

### 9.2 Setting and mood
A lantern-lit night market in a narrow old street: two rows of stalls facing a central street where the crowd flows. Mood: **vivid, noisy, crowded, delicious** (purple night, orange lanterns, steam). The kitchen is two stalls, **West** (grill and toast) and **East** (veg, fryer, plating and the pass), with the crowd lane between them.

### 9.3 Layout
Playable `26 x 14` cells (`x -6.5..6.5, z -3.5..3.5`). West block cols 0..9, **lane cols 10..15 (6 cells = 3 m)** running north-south, East block cols 16..25. Staging counters at the lane edges (`stage_w1/2`, `stage_e1/2`) are hand-off and throw targets. The lane is open to the street at both ends (north and south).

```
col  00000000001111111111222222
     01234567890123456789012345
r00  112233SSss,,,,,,6677BBbb88
r01  112233SSss,,,,,,6677BBbb88
r02  ..........,,,,,,..........
r03  ..........,,,,,,..........
r04  ..........,,,,,,..*.....UU
r05  ..*...*.==,,,,,,==..*...UU
r06  ....*...==,,,,,,==....*.VV
r07  ........==,,,,,,==......VV
r08  ........==,,,,,,==......vv
r09  ..........,,,,,,........vv
r10  ..........,,,,,,........WW
r11  ..........,,,,,,........WW
r12  44TTtt55ss,,,,,,GGFFffPPXX
r13  44TTtt55ss,,,,,,GGFFffPPXX
```

Legend: general symbols in 1.2. Digits for this level: `1` = grilled_cheese_raw; `2` = raw_bacon; `3` = patty; `4` = bread_slice; `5` = bun; `6` = lettuce; `7` = tomato; `8` = onion. Twist zones (shown as `,` where floor): `lane` (cols 10..15, rows 0..13).

| id | def | cell (c, r) | size (cells) | centre (x, z) m | box (w x d) m | dispenses | optional |
|---|---|---|---|---|---|---|---|
| `crate_gc` | crate | (0, 0) | 2 x 2 | (-6, -3) | 1 x 1 | `grilled_cheese_raw` |  |
| `crate_bacon` | crate | (2, 0) | 2 x 2 | (-5, -3) | 1 x 1 | `raw_bacon` |  |
| `crate_patty` | crate | (4, 0) | 2 x 2 | (-4, -3) | 1 x 1 | `patty` |  |
| `stove_1` | stove | (6, 0) | 2 x 2 | (-3, -3) | 1 x 1 |  |  |
| `stove_2` | stove | (8, 0) | 2 x 2 | (-2, -3) | 1 x 1 |  | squad |
| `crate_bread` | crate | (0, 12) | 2 x 2 | (-6, 3) | 1 x 1 | `bread_slice` |  |
| `toaster_1` | toaster | (2, 12) | 2 x 2 | (-5, 3) | 1 x 1 |  |  |
| `toaster_2` | toaster | (4, 12) | 2 x 2 | (-4, 3) | 1 x 1 |  | squad |
| `crate_bun` | crate | (6, 12) | 2 x 2 | (-3, 3) | 1 x 1 | `bun` |  |
| `stove_3` | stove | (8, 12) | 2 x 2 | (-2, 3) | 1 x 1 |  | party |
| `stage_w1` | counter | (8, 5) | 2 x 2 | (-2, -0.5) | 1 x 1 |  |  |
| `stage_w2` | counter | (8, 7) | 2 x 2 | (-2, 0.5) | 1 x 1 |  |  |
| `stage_e1` | counter | (16, 5) | 2 x 2 | (2, -0.5) | 1 x 1 |  |  |
| `stage_e2` | counter | (16, 7) | 2 x 2 | (2, 0.5) | 1 x 1 |  |  |
| `crate_lettuce` | crate | (16, 0) | 2 x 2 | (2, -3) | 1 x 1 | `lettuce` |  |
| `crate_tomato` | crate | (18, 0) | 2 x 2 | (3, -3) | 1 x 1 | `tomato` |  |
| `board_1` | board | (20, 0) | 2 x 2 | (4, -3) | 1 x 1 |  |  |
| `board_2` | board | (22, 0) | 2 x 2 | (5, -3) | 1 x 1 |  | squad |
| `crate_onion` | crate | (24, 0) | 2 x 2 | (6, -3) | 1 x 1 | `onion` |  |
| `coating_1` | coating | (16, 12) | 2 x 2 | (2, 3) | 1 x 1 |  |  |
| `fryer_1` | fryer | (18, 12) | 2 x 2 | (3, 3) | 1 x 1 |  |  |
| `fryer_2` | fryer | (20, 12) | 2 x 2 | (4, 3) | 1 x 1 |  | squad |
| `plates` | plates | (22, 12) | 2 x 2 | (5, 3) | 1 x 1 | `plate` |  |
| `bin` | bin | (24, 12) | 2 x 2 | (6, 3) | 1 x 1 |  |  |
| `pass` | pass | (24, 6) | 2 x 2 | (6, 0) | 1 x 1 |  |  |
| `pass_2` | pass | (24, 8) | 2 x 2 | (6, 1) | 1 x 1 |  | party |
| `rack` | rack | (24, 4) | 2 x 2 | (6, -1) | 1 x 1 |  |  |
| `sink_1` | sink | (24, 10) | 2 x 2 | (6, 2) | 1 x 1 |  |  |

Washing (`mechanics.wash`): the base set has `sink_1` and `rack`; a container returns dirty to `rack` 240 ticks after a serve (see 6.4 for the full rule).

Station order in `layout.json` is the order of this table (base stations before optional ones of the same def, rule 1.4.1). `w`/`d` in `layout.json` are the metre sizes in the "box" column.

Colliders: none. Zone `lane`: x -1.5..1.5, z -3.5..3.5 (x -1.5..1.5, z -3.5..3.5). Customer queue (market goers at the east counter, render only): `[7.2, 0.6]`, `[7.9, 1.4]`, `[8.6, 0.6]`.

Spawn points (3 per stall):

| slot | corner (c, r) | position (x, z) m |
|---|---|---|
| 0 | (2, 5) | [-5.5, -1] |
| 1 | (4, 6) | [-4.5, -0.5] |
| 2 | (6, 5) | [-3.5, -1] |
| 3 | (18, 4) | [2.5, -1.5] |
| 4 | (20, 5) | [3.5, -1] |
| 5 | (22, 6) | [4.5, -0.5] |

### 9.4 Recipes and the new mechanic
| Recipe | Container | Components | Chain in this level |
|---|---|---|---|
| `grilled_cheese_sandwich` (110, 60 s) | plate | `grilled_cheese_cooked` | `crate_gc` -> stove (6 s, burn 6) (West) -> lane -> plate (East) |
| `blt_sandwich` (150, 84 s) | plate | `chopped_lettuce`, `chopped_tomato`, `cooked_bacon`, `toasted_bread` | bacon -> stove; bread -> toaster (3 s, burn 4); lettuce, tomato -> board (East) |
| `hamburger` (130, 70 s) | plate | `bun`, `cooked_patty` | patty -> stove; bun crate (West) |
| `onion_rings` (110, 56 s) | plate | `cooked_onion_rings` | onion -> board -> coating -> fryer (East only; no lane crossing) |

The new idea is **parallelism**: four chains, each short, with the West stall making three of them. Everything West makes must cross the lane to reach the plates (East), so the lane is the logistics bottleneck.

### 9.5 Twist: crowd lane (`kind: 'crowd_lane'`)
**State:** `[phase, ticksInPhase, wavesDone]`. Params: `firstWaveTick` 900, `periodTicks` 750, `warnTicks` 75 (2.5 s), `waveTicks` 210 (7 s), `slowQ8` 64 (0.25), dash blocked in the lane.
1. **Schedule** (`phaseAt(playTick, 900, 750, 75, 210)`; `first` = start of WAVE): waves start at 900, 1650, 2400, 3150, 3900, 4650, 5400, 6150 (8 waves in 6300 ticks). WARN starts 75 ticks earlier. In steady state the lane is busy 28% of the time.
2. **WARN (75 ticks):** event `CrowdApproaching { inTicks: 75 }`; render: the lanterns above the lane brighten by 40%, a bell rings, silhouettes appear at the north end of the lane. No sim effect.
3. **WAVE (210 ticks):** event `CrowdIn`. For a chef whose centre is in zone `lane`: `speedMulQ8 = 64` (1.0 m/s instead of 4.0) and `dashAllowed = false`. A lane crossing (3 m) takes 3.0 s instead of 0.75 s. Chefs are **never blocked or ejected** (no softlock). Held items are safe.
4. **Thrown items are unaffected** (they fly over the crowd), and stations `stage_w*`, `stage_e*` lie outside the lane (cols 8-9 and 16-17), so staging and throwing work during a wave.
5. **End:** event `CrowdOut`.
6. **Render of the crowd** (no sim state): 3 files of 5 walkers cross from north to south over `waveTicks`; positions are pure functions of `ticksInPhase`, so replays match.
7. **Touches:** `speedMulQ8`, `dashAllowed`, events. No PRNG.

### 9.6 Pacing and ticket time
| Field | Value |
|---|---|
| `durationSeconds` | 210 |
| `countdownSeconds` | 3 |
| `secondTicketAfterSeconds` | 18 |
| `pacing.minDelaySeconds` / `maxDelaySeconds` | 1.5 / 17 |
| `pacing.burstChance` / `burstFactor` / `calmFactor` | 40 / 0.35 / 0.75 |
| `pacing.baseFromTicketTime` / `baseMinSeconds` / `baseMaxSeconds` | 0.3 / 4 / 12 |
| `ticketTimeBase` | 0.88 |
| `maxActive` solo / duo / squad / party | 3 / 4 / 5 / 6 |
| `rate` solo / duo / squad / party | 0.55 / 1.0 / 1.6 / 2.2 |
| `ticketTimeMul` solo / duo / squad / party | 1.25 / 1.0 / 0.95 / 0.9 |
| Ticket time (average over this level's recipes: grilled_cheese_sandwich, blt_sandwich, hamburger, onion_rings) at duo | 67.5 s x 0.88 = **59.4 s**; solo 74.2 s, squad 56.4 s, party 53.5 s |

### 9.7 Stars
| Bucket | 1 star | 2 stars | 3 stars |
|---|---|---|---|
| solo | 1050 | 1950 | 2650 |
| duo | 1700 | 3150 | 4300 |
| squad | 2600 | 4750 | 6450 |
| party | 3450 | 6300 | 8600 |

Method: §15 (bot median x 0.30 / 0.55 / 0.75). Numbers above are **provisional** (Default, tunable) until the bots in `09` measure them.

### 9.8 Camera, lighting, music
`level.json.camera` (`CameraSpec`, `01 §10.5`; same pitch and distance on every level so the chefs keep the same on-screen size):
```json
"camera": {
  "position": [0, 12.14, 9.22],
  "target": [0, 0.2, 0.2],
  "fov": 38,
  "lean": 0.1
}
```
Derivation: pitch 54 degrees, distance 15 m (`position = target + 15 x (0, sin 54, cos 54)` with focus z = 0.4). Fit check at 16:9: the visible ground half-width at 15 m is about 9.2 m and half-depth about 6.4 m; this level needs 8.1 m and 4.9 m (playable half-size + margin 1.6 m / 1.4 m), so the whole playable area and a margin are visible without zooming. `CameraRig` increases the distance for narrower aspect ratios (`04`). `lean` 0.1 = the camera focus shifts by 10% of the chef centroid offset, with critically damped smoothing; it never follows one chef.
Lighting `market_night`. Music `night_bazaar`.

### 9.9 Diorama dressing and ambient life
1. Stalls: two rows of striped canopies (West red/orange, East teal/yellow), hanging paper lanterns across the lane (6 strings, flicker), hand-painted signs "Croque", "Burgers", "Beignets d'oignon".
2. The street: wet cobblestones with puddle reflections (a plane with fake specular), a fountain far south, neon signs of shops in the background (tall narrow buildings with balconies), drying laundry, bicycles, stacked crates, a fortune-teller stall.
3. Steam vents, incense smoke, string lights on the buildings, a moon behind clouds.
Ambient life: the **crowd** (the wave) plus 8 idle strollers at the street ends, a cat on a crate, moths around lanterns (6 particles), a street musician at the south end, a vendor shouting (audio), customers at the pass (kinds `student`, `grandpa`, `tourist`).

### 9.10 Onboarding (first 30 seconds)
`openingTickets = ['grilled_cheese_sandwich', 'hamburger']`.
| Time | What happens |
|---|---|
| 3 s | ticket 1 `grilled_cheese_sandwich`: arrow `crate_gc` -> `stove_1` -> then to **`stage_w1`** ("Poser ici pour passer") -> arrow switches to the East stall `plates` -> `stage_e1` "Prendre" -> `pass` |
| 18 s | ticket 2 `hamburger` using the same lane route |
| first wave | 30 s; WARN at 27.5 s with a first-time banner "La foule traverse !" |
The 30 s without a wave teaches the stage counters, which are the route that later avoids the crowd.

### 9.11 Expert shortcut
**Hand off through the stage counters and throw across the lane**: West chefs drop cooked items on `stage_w1/2`, East chefs take them from `stage_e1/2` by a throw (3 m, 0.4 s) and never cross the lane; this works in a wave. Experts stay in their stall for a whole wave and only cross in the 28 s gap.

### 9.12 Level-specific acceptance tests
- Crossing time through the lane during a wave is 3.0 s (+-0.1); outside waves 0.75 s.
- `CrowdApproaching` fires at playTick 825, 1575, 2325, ... (75 ticks before `CrowdIn`).
- No path requires crossing the lane during a wave for the ticket mix to be completable (the stage counters make it possible).
- All four recipes can be completed by a duo with 2 chefs (one per stall).

---

## 10. Level 8 · Le Wagon-Restaurant (`l08_wagon`)

### 10.1 Identity
| Field | Value |
|---|---|
| id / order | `l08_wagon` / 8 |
| Mechanics flags | `throw: true`, `wash: true`, `fire: true` |
| Twist | `{ kind: 'gangway_tunnels', params: { firstTunnelTick: 900, periodTicks: 1500, warnTicks: 90, tunnelTicks: 300, slowQ8: 154 } }` |
| New mechanic | **Batter chain** (mixer -> stove) for pancakes and omelettes |
| Unlock | `{ requires: 'l07_marche', minStars: 1 }` |

### 10.2 Setting and mood
A dining car on a mountain railway: alpine meadows, viaducts, pine forests, tunnels. Two wagons: the **kitchen wagon** (west) and the **dining wagon** (east, with the pass) joined by a short **gangway**. Mood: **cosy, rhythmic, a little wobbly** (the clack of the rails keeps the beat), with tunnels dimming the light and making the stations glow.

### 10.3 Layout
Playable `28 x 12` cells (`x -7..7, z -3..3`, 14 m x 6 m). Two wagons of 6.5 m each with a 1 m partition between them. The partition has a **gangway opening of 3 cells (1.5 m, rows 5..7)**, the designed choke of the level (still two chefs side by side). The long sides are open windows (the camera looks in from above and the train passes mountains on both sides). A pair of **hatch counters** (`hatch_a1`, `hatch_b1`, 0.5 m x 1 m) either side of the partition are hand-off and throw pads.

```
col  0000000000111111111122222222
     0123456789012345678901234567
r00  1122MMmmSSss.##.66778899PPPP
r01  1122MMmmSSss.##.66778899PPPP
r02  ...........=.##.=...........
r03  ...........=.##.=...........
r04  .............##.............
r05  ....*...*....,,...*...*.....
r06  ......*......,,.....*.......
r07  .............,,.............
r08  .............##.............
r09  .............##.............
r10  334455NNBBss.##.PPWWUUVVvvXX
r11  334455NNBBss.##.PPWWUUVVvvXX
```

Legend: general symbols in 1.2. Digits for this level: `1` = egg; `2` = pancake_mix; `3` = banana; `4` = strawberry; `5` = milk; `6` = syrup; `7` = cheese_slice; `8` = granola; `9` = yogurt. Twist zones (shown as `,` where floor): `gangway` (cols 13..14, rows 5..7).

| id | def | cell (c, r) | size (cells) | centre (x, z) m | box (w x d) m | dispenses | optional |
|---|---|---|---|---|---|---|---|
| `crate_egg` | crate | (0, 0) | 2 x 2 | (-6.5, -2.5) | 1 x 1 | `egg` |  |
| `crate_pancake_mix` | crate | (2, 0) | 2 x 2 | (-5.5, -2.5) | 1 x 1 | `pancake_mix` |  |
| `mixer_1` | mixer | (4, 0) | 2 x 2 | (-4.5, -2.5) | 1 x 1 |  |  |
| `mixer_2` | mixer | (6, 0) | 2 x 2 | (-3.5, -2.5) | 1 x 1 |  | squad |
| `stove_1` | stove | (8, 0) | 2 x 2 | (-2.5, -2.5) | 1 x 1 |  |  |
| `stove_2` | stove | (10, 0) | 2 x 2 | (-1.5, -2.5) | 1 x 1 |  | squad |
| `hatch_a1` | counter | (11, 2) | 1 x 2 | (-1.25, -1.5) | 0.5 x 1 |  |  |
| `crate_banana` | crate | (0, 10) | 2 x 2 | (-6.5, 2.5) | 1 x 1 | `banana` |  |
| `crate_strawberry` | crate | (2, 10) | 2 x 2 | (-5.5, 2.5) | 1 x 1 | `strawberry` |  |
| `crate_milk` | crate | (4, 10) | 2 x 2 | (-4.5, 2.5) | 1 x 1 | `milk` |  |
| `blender_1` | blender | (6, 10) | 2 x 2 | (-3.5, 2.5) | 1 x 1 |  |  |
| `board_1` | board | (8, 10) | 2 x 2 | (-2.5, 2.5) | 1 x 1 |  |  |
| `stove_3` | stove | (10, 10) | 2 x 2 | (-1.5, 2.5) | 1 x 1 |  | party |
| `hatch_b1` | counter | (16, 2) | 1 x 2 | (1.25, -1.5) | 0.5 x 1 |  |  |
| `crate_syrup` | crate | (16, 0) | 2 x 2 | (1.5, -2.5) | 1 x 1 | `syrup` |  |
| `crate_cheese` | crate | (18, 0) | 2 x 2 | (2.5, -2.5) | 1 x 1 | `cheese_slice` |  |
| `crate_granola` | crate | (20, 0) | 2 x 2 | (3.5, -2.5) | 1 x 1 | `granola` |  |
| `crate_yogurt` | crate | (22, 0) | 2 x 2 | (4.5, -2.5) | 1 x 1 | `yogurt` |  |
| `plates` | plates | (24, 0) | 2 x 2 | (5.5, -2.5) | 1 x 1 | `plate` |  |
| `bowls` | plates | (26, 0) | 2 x 2 | (6.5, -2.5) | 1 x 1 | `bowl` |  |
| `cups` | plates | (16, 10) | 2 x 2 | (1.5, 2.5) | 1 x 1 | `cup` |  |
| `sink_1` | sink | (18, 10) | 2 x 2 | (2.5, 2.5) | 1 x 1 |  |  |
| `rack` | rack | (20, 10) | 2 x 2 | (3.5, 2.5) | 1 x 1 |  |  |
| `pass` | pass | (22, 10) | 2 x 2 | (4.5, 2.5) | 1 x 1 |  |  |
| `pass_2` | pass | (24, 10) | 2 x 2 | (5.5, 2.5) | 1 x 1 |  | party |
| `bin` | bin | (26, 10) | 2 x 2 | (6.5, 2.5) | 1 x 1 |  |  |

Washing (`mechanics.wash`): the base set has `sink_1` and `rack`; a container returns dirty to `rack` 240 ticks after a serve (see 6.4 for the full rule).

Station order in `layout.json` is the order of this table (base stations before optional ones of the same def, rule 1.4.1). `w`/`d` in `layout.json` are the metre sizes in the "box" column.

Colliders: `partition_n` (cols 13..14, rows 0..4; x 0, z -1.75, w 1, d 2.5; box x -0.5..0.5, z -3..-0.5) and `partition_s` (cols 13..14, rows 8..11; x 0, z 2, w 1, d 2; box x -0.5..0.5, z 1..3), both `flyOver: true`. Zone `gangway`: x -0.5..0.5, z -0.5..1 (x -0.5..0.5, z -0.5..1.0). Customer queue (passengers at the dining wagon pass, render only): `[3.0, 4.2]`, `[4.3, 4.6]`, `[5.6, 4.2]`.

Spawn points (3 chefs in the kitchen wagon, 3 in the dining wagon):

| slot | corner (c, r) | position (x, z) m |
|---|---|---|
| 0 | (4, 5) | [-5, -0.5] |
| 1 | (6, 6) | [-4, 0] |
| 2 | (8, 5) | [-3, -0.5] |
| 3 | (18, 5) | [2, -0.5] |
| 4 | (20, 6) | [3, 0] |
| 5 | (22, 5) | [4, -0.5] |

### 10.4 Recipes and the new mechanic
| Recipe | Container | Components | Chain in this level |
|---|---|---|---|
| `pancakes` (120, 84 s) | plate | `cooked_pancakes`, `syrup` | `crate_pancake_mix` -> `mixer` (2 s) -> `pancake_batter` -> stove (6 s, burn 6) (kitchen wagon) -> **gangway** -> plate + `crate_syrup` (dining wagon) |
| `cheese_omelette` (110, 64 s) | plate | `cheese_slice`, `cooked_omelette` | `crate_egg` -> mixer -> `omelette_mix` -> stove -> gangway -> plate + `crate_cheese` |
| `fruit_yogurt_bowl` (110, 50 s) | bowl | `granola`, `sliced_banana`, `sliced_strawberry`, `yogurt` | banana, strawberry -> board (kitchen); granola, yogurt (dining) |
| `smoothie` (100, 42 s) | cup | `smoothie_ready` | banana + strawberry + milk -> blender (kitchen) -> gangway -> cup (dining) |

The **batter chain** (mixer -> stove) is the new idea: an intermediate item that is itself a prerequisite for a timed cook. Everything the kitchen wagon makes must go through the gangway or a hatch to reach the plates and the pass.

### 10.5 Twist: gangway and tunnels (`kind: 'gangway_tunnels'`)
**State:** `[phase, ticksInPhase, tunnelsDone]`. Params: `firstTunnelTick` 900, `periodTicks` 1500, `warnTicks` 90, `tunnelTicks` 300 (10 s), `slowQ8` 154 (0.6).
1. **Schedule** (`phaseAt(playTick, 900, 1500, 90, 300)`; `first` = start of TUNNEL): tunnels start at 900, 2400, 3900, 5400 (a 6600-tick level: four tunnels). WARN starts 90 ticks earlier.
2. **WARN (90 ticks):** event `TunnelApproaching { inTicks: 90 }`; render: a dark portal approaches on the horizon, a whistle sounds; the lamps brighten.
3. **TUNNEL (300 ticks):** event `TunnelIn`. Effects: (a) chefs whose centre is in zone `gangway` get `speedMulQ8 = 154` (the car lurches) and `dashAllowed = false`; (b) `view().twist.flags` bit 0 set = **dark**: the render dims the world over 30 ticks (lighting preset `train_day` multipliers in 2.5) and station emissive rises; the HUD ticket text keeps its normal contrast. **No other sim effect** (lights are readability only: all prompts, rings and the guide arrow stay at full brightness, and station colours remain distinguishable by silhouette).
4. **End:** event `TunnelOut`; brightness returns over 30 ticks.
5. **Touches:** `speedMulQ8`, `dashAllowed`, `view().flags`, events. No PRNG.
6. The choke: in normal conditions six chefs can pass in pairs (1.5 m); in a tunnel the passage takes 2.5 s per chef pair instead of 1.5 s.
7. Hatch route: throw from `hatch_a1` (x = -1.25) to `hatch_b1` (x = 1.25), 2.5 m, 12 ticks, unaffected by tunnels.

### 10.6 Pacing and ticket time
| Field | Value |
|---|---|
| `durationSeconds` | 220 |
| `countdownSeconds` | 3 |
| `secondTicketAfterSeconds` | 18 |
| `pacing.minDelaySeconds` / `maxDelaySeconds` | 1.5 / 17 |
| `pacing.burstChance` / `burstFactor` / `calmFactor` | 40 / 0.35 / 0.75 |
| `pacing.baseFromTicketTime` / `baseMinSeconds` / `baseMaxSeconds` | 0.3 / 4 / 12 |
| `ticketTimeBase` | 0.86 |
| `maxActive` solo / duo / squad / party | 3 / 4 / 5 / 6 |
| `rate` solo / duo / squad / party | 0.55 / 1.0 / 1.6 / 2.2 |
| `ticketTimeMul` solo / duo / squad / party | 1.25 / 1.0 / 0.95 / 0.9 |
| Ticket time (average over this level's recipes: pancakes, cheese_omelette, fruit_yogurt_bowl, smoothie) at duo | 60.0 s x 0.86 = **51.6 s**; solo 64.5 s, squad 49.0 s, party 46.4 s |

### 10.7 Stars
| Bucket | 1 star | 2 stars | 3 stars |
|---|---|---|---|
| solo | 1050 | 1950 | 2650 |
| duo | 1700 | 3150 | 4300 |
| squad | 2600 | 4750 | 6450 |
| party | 3450 | 6300 | 8600 |

Method: §15 (bot median x 0.30 / 0.55 / 0.75). Numbers above are **provisional** (Default, tunable) until the bots in `09` measure them.

### 10.8 Camera, lighting, music
`level.json.camera` (`CameraSpec`, `01 §10.5`; same pitch and distance on every level so the chefs keep the same on-screen size):
```json
"camera": {
  "position": [0, 12.14, 9.22],
  "target": [0, 0.2, 0.2],
  "fov": 38,
  "lean": 0.1,
  "zones": [
    { "zone": "kitchen", "position": [-1.0, 12.14, 9.22], "target": [-1.0, 0.2, 0.2], "fov": 38 },
    { "zone": "dining", "position": [1.0, 12.14, 9.22], "target": [1.0, 0.2, 0.2], "fov": 38 }
  ]
}
```
Derivation: pitch 54 degrees, distance 15 m (`position = target + 15 x (0, sin 54, cos 54)` with focus z = 0.4). Fit check at 16:9: the visible ground half-width at 15 m is about 9.2 m and half-depth about 6.4 m; this level needs 8.6 m and 4.4 m (playable half-size + margin 1.6 m / 1.4 m), so the whole playable area and a margin are visible without zooming. `CameraRig` increases the distance for narrower aspect ratios (`04`). `lean` 0.1 = the camera focus shifts by 10% of the chef centroid offset, with critically damped smoothing; it never follows one chef.
Two zone framings (gentle): `kitchen` target `[-1.0, 0.2, 0.2]`, `dining` target `[1.0, 0.2, 0.2]`, easing 1.5 s with 1.5 m hysteresis, so both wagons stay in the frame at 16:9 for the playable area (+-7 m needs +-9.2 m visible; with +-1 m offset the decorative margin is cut, not the playable area). Lighting `train_day` with the tunnel multipliers. Music `train_rails` (the low-pass filter closes at WARN and opens at `TunnelOut`).

### 10.9 Diorama dressing and ambient life
1. Wagon shells: wood panelling, brass lamps, curtains tied back, a luggage rack, a table cloth on the pass shelf, a coat hook rail, a samovar/coffee machine on the kitchen wall, a map of the line.
2. Scenery: a scrolling landscape (alpine meadow, pine forest, a lake, a viaduct, snow peaks) at 3 depths with parallax; a locomotive visible on curves; telegraph poles passing every 2 s.
3. Tunnels: a black portal mesh and rock walls sliding in; sparks.
4. Couplings and the gangway bellows (accordion) with a rubber floor plate, a small sign "Attention marche".
Ambient life: the wagons sway 0.5 degree with the beat; coffee steam; passengers in the dining wagon (4 seated, eating, waving at cows); cows and a shepherd in the meadow; a conductor walking along the platform on a station stop (once, at 60% of the level); customers (kinds `commuter`, `hiker`, `grandma`).

### 10.10 Onboarding (first 30 seconds)
`openingTickets = ['pancakes', 'smoothie']`.
| Time | What happens |
|---|---|
| 3 s | ticket 1 `pancakes`: arrow `crate_pancake_mix` -> `mixer_1` ("Mixer") -> `stove_1` -> then to **`hatch_a1`** ("Poser") ... a second player/arrow shows `hatch_b1` "Prendre" -> `plates` -> `crate_syrup` -> `pass` |
| 18 s | ticket 2 `smoothie` (a known chain) |
| first tunnel | at 30 s: WARN at 28.5 s banner "Tunnel !" |
Solo players are guided through the gangway (the hatch is not the first route taught).

### 10.11 Expert shortcut
**Use the hatch**: drop or throw cooked items on `hatch_a1`, pick them up at `hatch_b1`; the team never uses the gangway. Experts run **one chef per wagon permanently** and only use the gangway to swap. In a tunnel the hatch is unaffected.

### 10.12 Level-specific acceptance tests
- The gangway is 3 cells wide, never blocked; six chefs can transit without deadlock (test: 3 chefs west -> east and 3 east -> west simultaneously).
- `TunnelApproaching` fires at playTick 810, 2310, 3810, 5310.
- In a tunnel all rings and prompts are still legible (screenshot test with a contrast threshold).
- Chef speed in zone `gangway` during TUNNEL is 0.6 x 4.0 m/s.

---

## 11. Level 9 · Le Bistrot de la Serre (`l09_bistrot`)

### 11.1 Identity
| Field | Value |
|---|---|
| id / order | `l09_bistrot` / 9 |
| Mechanics flags | `throw: true`, `wash: true`, `fire: true`, `harvest: true` |
| Twist | `{ kind: 'sprinklers', params: { periodTicks: 1500, warnTicks: 60, onTicks: 120, stunTicks: 15, offset1: 600, offset2: 1100, offset3: 1600, bonusStock: 1 } }` |
| New mechanic | **Harvest planters** instead of crates for produce (stock, regrow timer) |
| Unlock | `{ requires: 'l08_wagon', minStars: 1 }` |

### 11.2 Setting and mood
A Victorian glass greenhouse turned bistro: iron arches, climbing plants, a central pond with a fountain, hanging baskets, mist. Mood: **fresh, verdant, bright**, with a faint hiss of sprinklers. Everything from earlier levels is combined here; the planters make the kitchen scattered on purpose.

### 11.3 Layout
Playable `26 x 16` cells (`x -6.5..6.5, z -4..4`, 13 m x 8 m). Produce comes from **planters** (`planter` stations, digit-marked), the rest from crates. The central **pond** (collider, `flyOver`) is an island; the ring around it is 2 m wide. Three **sprinkler zones** (`spr_1`, `spr_2`, `spr_3`) cover the north-west, the south-west and the central-south aisle. The glass walls are open to the garden on the south and east.

```
col  00000000001111111111222222
     01234567890123456789012345
r00  1122BBbb33RR4455OOooPPXX..
r01  1122BBbb33RR4455OOooPPXX..
r02  ,,,,,,....................
r03  ,,,,,,....................
r04  66,,,,..*.*.*...........UU
r05  66,,,,..................UU
r06  66,,,,....######........VV
r07  66........######,,,,,,..VV
r08  11........######,,,,,,..vv
r09  11,,,,,,..######,,,,,,..vv
r10  ==,,,,,,......,,,,,,,,..XX
r11  ==,,,,*,......,,,,,,,,..XX
r12  ,,,,,,,,*.*...,,,,,,,,....
r13  ,,,,,,,,......,,,,,,,,....
r14  778899NNnnPPGGFFff$$WWww22
r15  778899NNnnPPGGFFff$$WWww22
```

Legend: general symbols in 1.2. Digits for this level: `1` = tomato; `2` = lettuce; `3` = pizza_dough; `4` = tomato_sauce; `5` = shredded_mozzarella; `6` = potato; `7` = banana; `8` = strawberry; `9` = milk; `$` = raw_chicken. Digit stations named `planter_*` are **planters** (def `planter`), the others are crates. Twist zones (shown as `,` where floor): `spr_1` (cols 0..5, rows 0..6), `spr_2` (cols 0..7, rows 9..15), `spr_3` (cols 14..21, rows 7..13).

| id | def | cell (c, r) | size (cells) | centre (x, z) m | box (w x d) m | dispenses | optional |
|---|---|---|---|---|---|---|---|
| `planter_tomato_1` | planter | (0, 0) | 2 x 2 | (-6, -3.5) | 1 x 1 | `tomato` |  |
| `planter_lettuce_1` | planter | (2, 0) | 2 x 2 | (-5, -3.5) | 1 x 1 | `lettuce` |  |
| `board_1` | board | (4, 0) | 2 x 2 | (-4, -3.5) | 1 x 1 |  |  |
| `board_2` | board | (6, 0) | 2 x 2 | (-3, -3.5) | 1 x 1 |  | squad |
| `crate_dough` | crate | (8, 0) | 2 x 2 | (-2, -3.5) | 1 x 1 | `pizza_dough` |  |
| `press` | press | (10, 0) | 2 x 2 | (-1, -3.5) | 1 x 1 |  |  |
| `crate_sauce` | crate | (12, 0) | 2 x 2 | (0, -3.5) | 1 x 1 | `tomato_sauce` |  |
| `crate_mozz` | crate | (14, 0) | 2 x 2 | (1, -3.5) | 1 x 1 | `shredded_mozzarella` |  |
| `oven_1` | oven | (16, 0) | 2 x 2 | (2, -3.5) | 1 x 1 |  |  |
| `oven_2` | oven | (18, 0) | 2 x 2 | (3, -3.5) | 1 x 1 |  | squad |
| `plates` | plates | (20, 0) | 2 x 2 | (4, -3.5) | 1 x 1 | `plate` |  |
| `bin_n` | bin | (22, 0) | 2 x 2 | (5, -3.5) | 1 x 1 |  |  |
| `planter_potato_1` | planter | (0, 4) | 2 x 2 | (-6, -1.5) | 1 x 1 | `potato` |  |
| `planter_potato_2` | planter | (0, 6) | 2 x 2 | (-6, -0.5) | 1 x 1 | `potato` | squad |
| `planter_tomato_2` | planter | (0, 8) | 2 x 2 | (-6, 0.5) | 1 x 1 | `tomato` | squad |
| `counter_w1` | counter | (0, 10) | 2 x 2 | (-6, 1.5) | 1 x 1 |  |  |
| `planter_banana` | planter | (0, 14) | 2 x 2 | (-6, 3.5) | 1 x 1 | `banana` |  |
| `planter_strawberry` | planter | (2, 14) | 2 x 2 | (-5, 3.5) | 1 x 1 | `strawberry` |  |
| `crate_milk` | crate | (4, 14) | 2 x 2 | (-4, 3.5) | 1 x 1 | `milk` |  |
| `blender_1` | blender | (6, 14) | 2 x 2 | (-3, 3.5) | 1 x 1 |  |  |
| `blender_2` | blender | (8, 14) | 2 x 2 | (-2, 3.5) | 1 x 1 |  | squad |
| `cups` | plates | (10, 14) | 2 x 2 | (-1, 3.5) | 1 x 1 | `cup` |  |
| `coating` | coating | (12, 14) | 2 x 2 | (0, 3.5) | 1 x 1 |  |  |
| `fryer_1` | fryer | (14, 14) | 2 x 2 | (1, 3.5) | 1 x 1 |  |  |
| `fryer_2` | fryer | (16, 14) | 2 x 2 | (2, 3.5) | 1 x 1 |  | squad |
| `crate_chicken` | crate | (18, 14) | 2 x 2 | (3, 3.5) | 1 x 1 | `raw_chicken` |  |
| `sink_1` | sink | (20, 14) | 2 x 2 | (4, 3.5) | 1 x 1 |  |  |
| `sink_2` | sink | (22, 14) | 2 x 2 | (5, 3.5) | 1 x 1 |  | squad |
| `planter_lettuce_2` | planter | (24, 14) | 2 x 2 | (6, 3.5) | 1 x 1 | `lettuce` | party |
| `rack` | rack | (24, 4) | 2 x 2 | (6, -1.5) | 1 x 1 |  |  |
| `pass` | pass | (24, 6) | 2 x 2 | (6, -0.5) | 1 x 1 |  |  |
| `pass_2` | pass | (24, 8) | 2 x 2 | (6, 0.5) | 1 x 1 |  | party |
| `bin_e` | bin | (24, 10) | 2 x 2 | (6, 1.5) | 1 x 1 |  |  |

Washing (`mechanics.wash`): the base set has `sink_1` and `rack`; a container returns dirty to `rack` 240 ticks after a serve (see 6.4 for the full rule).

Station order in `layout.json` is the order of this table (base stations before optional ones of the same def, rule 1.4.1). `w`/`d` in `layout.json` are the metre sizes in the "box" column.

Colliders: `pond` x 0, z 0, w 3, d 2 (cells cols 10..15, rows 6..9; box x -1.5..1.5, z -1..1), `flyOver: true`. Zones (metres): `spr_1` x -6.5..-3.5, z -4..-0.5, `spr_2` x -6.5..-2.5, z 0.5..4, `spr_3` x 0.5..4.5, z -0.5..3. Customer queue (east terrace, render only): `[7.4, 0.8]`, `[8.1, 1.6]`, `[8.8, 0.8]`.

Spawn points:

| slot | corner (c, r) | position (x, z) m |
|---|---|---|
| 0 | (8, 4) | [-2.5, -2] |
| 1 | (10, 4) | [-1.5, -2] |
| 2 | (12, 4) | [-0.5, -2] |
| 3 | (6, 11) | [-3.5, 1.5] |
| 4 | (8, 12) | [-2.5, 2] |
| 5 | (10, 12) | [-1.5, 2] |

### 11.4 Recipes and the new mechanic
| Recipe | Container | Components | Chain in this level |
|---|---|---|---|
| `salad` (110, 60 s) | plate | `chopped_lettuce`, `chopped_tomato` | lettuce planter, tomato planter -> board |
| `pizza_margherita` (180, 105 s) | plate | `cooked_pizza_margherita` | dough -> press -> + sauce + mozzarella -> oven (12 s) -> plate |
| `chicken_tenders_fries` (150, 84 s) | plate | `cooked_chicken_tenders`, `cooked_fries` | potato planter -> board -> fryer; chicken crate -> board -> coating -> fryer |
| `smoothie` (100, 42 s) | cup | `smoothie_ready` | banana, strawberry planters + milk crate -> blender |

**Planter rules** (`StationDef.kind = 'planter'`, `LayoutStation.props` integers): `maxStock` 3, `startStock` 2, `regrowTicks` 240 (8 s).
1. A planter holds `stock` 0..3 of its `dispenses` item. Grab with an empty hand takes one (`stock--`, event `Harvested`); with `stock = 0`, Grab returns `Refused { reason: 'empty' }`.
2. Regrow: while `stock < maxStock`, an integer `growTicks` counts up; at `regrowTicks` it resets to 0 and `stock++`.
3. Planter state per station: `[stock, growTicks]` (2 ints) in the station state, hashed.
4. A planter is **never** a socket for dropped items (Drop on a planter returns `Refused('cannot_place')`).
5. Visual stage = `stock` (0 = bare soil, 3 = full plant).
6. Production capacity: one planter gives a steady 1 item per 8 s plus the stock buffer of 2 at start, so the base set cannot sustain constant demand; Squad and Party unlock extra planters (`planter_potato_2`, `planter_tomato_2`, `planter_lettuce_2`).

### 11.5 Twist: sprinklers (`kind: 'sprinklers'`)
Three independent sprinklers, `spr_1..3`, each a `phaseAt` cycle with `first` = start of ON: `first_i = offset_i` (600, 1100, 1600), `period` 1500, `warn` 60 (2 s), `active` 120 (4 s). **State:** per sprinkler `[phase, ticksInPhase, cyclesDone]` (9 ints).
1. **Schedule** (ON start): `spr_1` at 600, 2100, 3600, 5100, 6600; `spr_2` at 1100, 2600, 4100, 5600; `spr_3` at 1600, 3100, 4600, 6100 (the level is 6900 ticks). WARN starts 60 ticks earlier. At most one sprinkler is ON at any time (the offsets are 500 apart and ON lasts 120).
2. **WARN (60 ticks):** event `SprinklerWarn { id, inTicks: 60 }`; render: the sprinkler head wobbles, drips, a hiss, the zone shows blue puddle decals. No sim effect.
3. **ON (120 ticks):** event `SprinklerOn { id }`. At the first tick (H1) `ctx.ejectChefs(zone box, stunTicks 15)`: chefs inside are moved outside and stunned 15 ticks (0.5 s, they keep the held item). During ON: `isBlocked` true inside the zone; `stationUsable` false for every station overlapping the zone (planters, boards, etc.: `Refused('locked')`). Processors keep running.
4. **End of ON:** event `SprinklerOff`. **Watering bonus:** every planter overlapping the zone gets `stock = min(maxStock, stock + 1)` and `growTicks = 0` (the sprinkler pays back what it blocks).
5. **Touches:** `isBlocked`, `stationUsable`, `ejectChefs`, planter `stock/growTicks` (through the planter functions), events. No PRNG.
6. The zones avoid the oven, press, pass, fryer line and the plate dispensers; they cover planters (`spr_1`: tomato_1, lettuce_1, board line, potato_1; `spr_2`: banana, strawberry, milk), and the central aisle (`spr_3`).

### 11.6 Pacing and ticket time
| Field | Value |
|---|---|
| `durationSeconds` | 230 |
| `countdownSeconds` | 3 |
| `secondTicketAfterSeconds` | 16 |
| `pacing.minDelaySeconds` / `maxDelaySeconds` | 1.5 / 16 |
| `pacing.burstChance` / `burstFactor` / `calmFactor` | 45 / 0.35 / 0.75 |
| `pacing.baseFromTicketTime` / `baseMinSeconds` / `baseMaxSeconds` | 0.3 / 4 / 11 |
| `ticketTimeBase` | 0.85 |
| `maxActive` solo / duo / squad / party | 3 / 4 / 5 / 6 |
| `rate` solo / duo / squad / party | 0.55 / 1.0 / 1.6 / 2.2 |
| `ticketTimeMul` solo / duo / squad / party | 1.25 / 1.0 / 0.95 / 0.9 |
| Ticket time (average over this level's recipes: salad, pizza_margherita, chicken_tenders_fries, smoothie) at duo | 72.8 s x 0.85 = **61.8 s**; solo 77.3 s, squad 58.7 s, party 55.7 s |

### 11.7 Stars
| Bucket | 1 star | 2 stars | 3 stars |
|---|---|---|---|
| solo | 1150 | 2150 | 2900 |
| duo | 1900 | 3450 | 4700 |
| squad | 2800 | 5150 | 7050 |
| party | 3750 | 6900 | 9400 |

Method: §15 (bot median x 0.30 / 0.55 / 0.75). Numbers above are **provisional** (Default, tunable) until the bots in `09` measure them.

### 11.8 Camera, lighting, music
`level.json.camera` (`CameraSpec`, `01 §10.5`; same pitch and distance on every level so the chefs keep the same on-screen size):
```json
"camera": {
  "position": [0, 12.14, 9.22],
  "target": [0, 0.2, 0.2],
  "fov": 38,
  "lean": 0.1
}
```
Derivation: pitch 54 degrees, distance 15 m (`position = target + 15 x (0, sin 54, cos 54)` with focus z = 0.4). Fit check at 16:9: the visible ground half-width at 15 m is about 9.2 m and half-depth about 6.4 m; this level needs 8.1 m and 5.4 m (playable half-size + margin 1.6 m / 1.4 m), so the whole playable area and a margin are visible without zooming. `CameraRig` increases the distance for narrower aspect ratios (`04`). `lean` 0.1 = the camera focus shifts by 10% of the chef centroid offset, with critically damped smoothing; it never follows one chef.
Lighting `greenhouse_noon`. Music `greenhouse_pastoral`.

### 11.9 Diorama dressing and ambient life
1. Glass house: iron arch ribs every 3 m, a gabled glass roof (rendered as a very light transparent plane with a mullion pattern; the sun casts barred shadows), a brick base wall, a wrought-iron door.
2. Vegetation: hanging baskets, ferns, palms in pots, climbing vines on the arches, a lemon tree, a banana plant (at the banana planter), flower beds, wooden benches, a watering can, a stack of terracotta pots, a wheelbarrow.
3. Pond and fountain with lily pads and koi.
4. The garden outside: lawn, a hedge maze, a stone path, a gazebo, a distant manor.
Ambient life: butterflies (4), koi (3) swimming, bees on flowers, a gardener NPC watering outside, mist drifting at the roof, a sparrow on a beam, sprinkler rainbow sprite during ON; customers (kinds `botanist`, `elder`, `child`).

### 11.10 Onboarding (first 30 seconds)
`openingTickets = ['salad', 'smoothie']`.
| Time | What happens |
|---|---|
| 3 s | ticket 1 `salad`; arrow `planter_tomato_1` ("Récolter") -> `planter_lettuce_1` -> board -> plate -> pass |
| after the first harvest | the planter plant shrinks one stage and a small timer ring regrows (8 s) |
| 20 s | the first sprinkler (`spr_1`) is at tick 600 (20 s): WARN at 18 s shows the hatched zone, a banner "Arrosage !" the first time only; the arrow avoids the zone |
| 30 s | `smoothie` introduces `planter_banana`, `planter_strawberry` in `spr_2` before its first run at 36.7 s |
The first sprinkler hits only `spr_1` (the tutorial's own planters), so the first lesson is "go elsewhere for 4 s", with a bonus when it ends.

### 11.11 Expert shortcut
**Harvest, then step out**: harvest all of a zone's planters at WARN (the stock buffer lets you take 2 items), leave, and collect the watering bonus (+1 stock) when ON ends. Throw produce over the pond from `planter_potato_1` to the fryer line (about 5 m, within range) to avoid the 2 m ring walk.

### 11.12 Level-specific acceptance tests
- A planter at `stock = 0` refuses Grab with `empty`; stock never exceeds 3.
- A sprinkler ejects a chef exactly once per cycle; the chef keeps its item.
- At most one sprinkler is ON at the same tick (assert over the 6900-tick level).
- `SprinklerWarn` events fire 60 ticks before `SprinklerOn`.
- A bot that ignores sprinklers loses points versus one that respects them (the twist changes the best route).

---

## 12. Level 10 · Le Banquet du Géant (`l10_banquet`)

### 12.1 Identity
| Field | Value |
|---|---|
| id / order | `l10_banquet` / 10 |
| Mechanics flags | `throw: true`, `wash: true`, `fire: true`, `harvest: false`, `feast: true` |
| Twist | `{ kind: 'conveyor', params: { ringSize: 32, stepTicks: 8, fastStepTicks: 5, speedUpTick: 3600, warnTicks: 90, chuteIndex: 25 } }` |
| New mechanic | **Feast tickets** (3 dishes served together for a bonus); the conveyor |
| Unlock | `{ requires: 'l09_bistrot', minStars: 1 }` |

### 12.2 Setting and mood
A kitchen built on a giant banquet table in a vast candle-lit hall; the **Giant** is the customer, sitting at the east end with a huge head and hands that lean into the frame. A lazy-Susan **conveyor ring** circles a central dish. Mood: **epic, theatrical, warm and funny**. The Giant reacts to every serve (the spectacle). If playtests show the finale is more fun without the Giant, the setting changes and the mechanic stays (design 03 §10).

### 12.3 Layout
Playable `28 x 18` cells (`x -7..7, z -4.5..4.5`, 14 m x 9 m). The perimeter holds the stations (four sides). In the middle: a **banquet table centrepiece** (collider, `flyOver`) surrounded by the **conveyor ring**, 32 cells of 0.5 m. Aisles around the ring are 3 cells (1.5 m) north and south, 7 cells (3.5 m) west and east, so the east/west sides are comfortable for six chefs and north/south are the choke lanes. The pass is on the east edge facing the Giant.

```
col  0000000000111111111122222222
     0123456789012345678901234567
r00  11BBbbFFff22GG33SSss4455XX==
r01  11BBbbFFff22GG33SSss4455XX==
r02  66........................==
r03  66...*.*.............*....==
r04  RR........................99
r05  RR.......~~~~~~~~~~.......99
r06  77.......~########~.......MM
r07  77.......~########~.......MM
r08  88.......~########~.......VV
r09  88.......~########~.......VV
r10  OO.......~########~.......vv
r11  OO.......~########~.......vv
r12  oo.......~~~~~~~~~~.......PP
r13  oo........................PP
r14  ==...*.*.............*....UU
r15  ==........................UU
r16  ..SSss$$========PPppWWffXX..
r17  ..SSss$$========PPppWWffXX..
```

Legend: general symbols in 1.2. Digits for this level: `1` = potato; `2` = raw_chicken; `3` = patty; `4` = bun; `5` = cheese_slice; `6` = pizza_dough; `7` = tomato_sauce; `8` = shredded_mozzarella; `9` = pancake_mix; `$` = syrup.

| id | def | cell (c, r) | size (cells) | centre (x, z) m | box (w x d) m | dispenses | optional |
|---|---|---|---|---|---|---|---|
| `crate_potato` | crate | (0, 0) | 2 x 2 | (-6.5, -4) | 1 x 1 | `potato` |  |
| `board_1` | board | (2, 0) | 2 x 2 | (-5.5, -4) | 1 x 1 |  |  |
| `board_2` | board | (4, 0) | 2 x 2 | (-4.5, -4) | 1 x 1 |  | squad |
| `fryer_1` | fryer | (6, 0) | 2 x 2 | (-3.5, -4) | 1 x 1 |  |  |
| `fryer_2` | fryer | (8, 0) | 2 x 2 | (-2.5, -4) | 1 x 1 |  | squad |
| `crate_chicken` | crate | (10, 0) | 2 x 2 | (-1.5, -4) | 1 x 1 | `raw_chicken` |  |
| `coating` | coating | (12, 0) | 2 x 2 | (-0.5, -4) | 1 x 1 |  |  |
| `crate_patty` | crate | (14, 0) | 2 x 2 | (0.5, -4) | 1 x 1 | `patty` |  |
| `stove_1` | stove | (16, 0) | 2 x 2 | (1.5, -4) | 1 x 1 |  |  |
| `stove_2` | stove | (18, 0) | 2 x 2 | (2.5, -4) | 1 x 1 |  | squad |
| `crate_bun` | crate | (20, 0) | 2 x 2 | (3.5, -4) | 1 x 1 | `bun` |  |
| `crate_cheese` | crate | (22, 0) | 2 x 2 | (4.5, -4) | 1 x 1 | `cheese_slice` |  |
| `bin_n` | bin | (24, 0) | 2 x 2 | (5.5, -4) | 1 x 1 |  |  |
| `counter_n1` | counter | (26, 0) | 2 x 2 | (6.5, -4) | 1 x 1 |  |  |
| `crate_dough` | crate | (0, 2) | 2 x 2 | (-6.5, -3) | 1 x 1 | `pizza_dough` |  |
| `press` | press | (0, 4) | 2 x 2 | (-6.5, -2) | 1 x 1 |  |  |
| `crate_sauce` | crate | (0, 6) | 2 x 2 | (-6.5, -1) | 1 x 1 | `tomato_sauce` |  |
| `crate_mozz` | crate | (0, 8) | 2 x 2 | (-6.5, 0) | 1 x 1 | `shredded_mozzarella` |  |
| `oven_1` | oven | (0, 10) | 2 x 2 | (-6.5, 1) | 1 x 1 |  |  |
| `oven_2` | oven | (0, 12) | 2 x 2 | (-6.5, 2) | 1 x 1 |  | squad |
| `counter_w1` | counter | (0, 14) | 2 x 2 | (-6.5, 3) | 1 x 1 |  |  |
| `counter_e1` | counter | (26, 2) | 2 x 2 | (6.5, -3) | 1 x 1 |  |  |
| `crate_pancake_mix` | crate | (26, 4) | 2 x 2 | (6.5, -2) | 1 x 1 | `pancake_mix` |  |
| `mixer` | mixer | (26, 6) | 2 x 2 | (6.5, -1) | 1 x 1 |  |  |
| `pass` | pass | (26, 8) | 2 x 2 | (6.5, 0) | 1 x 1 |  |  |
| `pass_2` | pass | (26, 10) | 2 x 2 | (6.5, 1) | 1 x 1 |  | party |
| `plates_e` | plates | (26, 12) | 2 x 2 | (6.5, 2) | 1 x 1 | `plate` |  |
| `rack` | rack | (26, 14) | 2 x 2 | (6.5, 3) | 1 x 1 |  |  |
| `stove_3` | stove | (2, 16) | 2 x 2 | (-5.5, 4) | 1 x 1 |  |  |
| `stove_4` | stove | (4, 16) | 2 x 2 | (-4.5, 4) | 1 x 1 |  | squad |
| `crate_syrup` | crate | (6, 16) | 2 x 2 | (-3.5, 4) | 1 x 1 | `syrup` |  |
| `counter_s1` | counter | (8, 16) | 2 x 2 | (-2.5, 4) | 1 x 1 |  |  |
| `counter_s2` | counter | (10, 16) | 2 x 2 | (-1.5, 4) | 1 x 1 |  |  |
| `counter_s3` | counter | (12, 16) | 2 x 2 | (-0.5, 4) | 1 x 1 |  |  |
| `counter_s4` | counter | (14, 16) | 2 x 2 | (0.5, 4) | 1 x 1 |  |  |
| `plates_s` | plates | (16, 16) | 2 x 2 | (1.5, 4) | 1 x 1 | `plate` |  |
| `plates_s2` | plates | (18, 16) | 2 x 2 | (2.5, 4) | 1 x 1 | `plate` | party |
| `sink_1` | sink | (20, 16) | 2 x 2 | (3.5, 4) | 1 x 1 |  |  |
| `fryer_3` | fryer | (22, 16) | 2 x 2 | (4.5, 4) | 1 x 1 |  | party |
| `bin_s` | bin | (24, 16) | 2 x 2 | (5.5, 4) | 1 x 1 |  |  |

Washing (`mechanics.wash`): the base set has `sink_1` and `rack`; a container returns dirty to `rack` 240 ticks after a serve (see 6.4 for the full rule).

Station order in `layout.json` is the order of this table (base stations before optional ones of the same def, rule 1.4.1). `w`/`d` in `layout.json` are the metre sizes in the "box" column.

**Conveyor stations:** `belt_00` .. `belt_31`, `def: 'conveyor'` (kind `conveyor`), each **0.5 m x 0.5 m** (`w: 0.5, d: 0.5`) with one socket, on the ring cells below in index order (clockwise from the north-west corner). Cell `i` centre: `x = -7 + 0.5 (c + 0.5)`, `z = -4.5 + 0.5 (r + 0.5)`.
| Indices | Cells (col, row) |
|---|---|
| 0..9 | row 5, cols 9 to 18 (north side, moving east) |
| 10..16 | col 18, rows 6 to 12 (east side, moving south) |
| 17..25 | row 12, cols 17 to 9 (south side, moving west) |
| 26..31 | col 9, rows 11 to 6 (west side, moving north) |
Chute: index 25 (cell (9, 12), south-west corner). Ring box: x -2.5..2.5, z -2..2.

Colliders: `banquet_table` x 0, z 0, w 4, d 3 (cells cols 10..17, rows 6..11; box x -2..2, z -1.5..1.5), `flyOver: true`. Belt cells are solid for walking (they are stations). Customer queue (the Giant, render only, not three queued customers): `[8.6, 0.2]` = the Giant's face, `[8.0, -1.4]` = left hand, `[8.0, 1.8]` = right hand.

Spawn points:

| slot | corner (c, r) | position (x, z) m |
|---|---|---|
| 0 | (5, 3) | [-4.5, -3] |
| 1 | (7, 3) | [-3.5, -3] |
| 2 | (5, 14) | [-4.5, 2.5] |
| 3 | (7, 14) | [-3.5, 2.5] |
| 4 | (21, 3) | [3.5, -3] |
| 5 | (21, 14) | [3.5, 2.5] |

### 12.4 Recipes and the new mechanic
| Recipe | Container | Components | Chain in this level |
|---|---|---|---|
| `cheeseburger_combo` (160, 90 s) | plate | `bun`, `cheese_slice`, `cooked_fries`, `cooked_patty` | fries (N-W), patty (N), bun and cheese (N-E), plate (E/S) |
| `pizza_margherita` (180, 105 s) | plate | `cooked_pizza_margherita` | dough -> press -> sauce + mozzarella (W side) -> oven (W) |
| `pancakes` (120, 84 s) | plate | `cooked_pancakes`, `syrup` | pancake mix (E) -> mixer (E) -> stove (S-W) + syrup (S) |
| `chicken_tenders_fries` (150, 84 s) | plate | `cooked_chicken_tenders`, `cooked_fries` | chicken -> board -> coating -> fryer (N) + fries |

**Feast tickets** (`mechanics.feast`): from ticket index 3, every 4th ticket (indices 3, 7, 11, ...) is a **feast** drawn from `level.feast.templates` (by the `pacing` PRNG). A feast is one ticket slot that shows **three dishes**; ticket time `ticketTimeSeconds` 200 s x `ticketTimeBase` x bucket `ticketTimeMul`.
```json
"feast": { "everyNth": 4, "fromTicketIndex": 3, "windowTicks": 450, "ticketTimeSeconds": 200, "bonusPermille": 500,
  "templates": [
    ["cheeseburger_combo", "pizza_margherita", "pancakes"],
    ["chicken_tenders_fries", "cheeseburger_combo", "pancakes"],
    ["pizza_margherita", "chicken_tenders_fries", "pancakes"]
  ] }
```
Rules (the exact scoring is owned by `02`; these are the level inputs):
1. Each dish is served at any `pass` in any order; a correct dish scores as a normal serve (base + speed bonus x streak) and ticks that dish off.
2. The **window** starts at the first dish served (450 ticks = 15 s). If all three dishes are served within the window, the feast is **complete**: bonus = `bonusPermille` (500 = +50%) of the sum of the three base scores, once, and the streak counts one on-time serve.
3. If the window runs out with dishes missing, or the ticket time expires, the **remaining dishes are forfeited** and the usual `expiredPenalty` (50) applies once; dishes already served keep their points.
4. A wrong dish at the pass is `WrongDish` as usual.
5. A feast occupies one `maxActive` slot.

### 12.5 Twist: the conveyor (`kind: 'conveyor'`)
Two parts: `STATION_BEHAVIORS.conveyor` (sockets) and `TWIST_HOOKS.conveyor` (chute and speed-up).
**Station rules** (`conveyor.update`, once per playing tick, for all belt stations as a group, from `belt_00`):
1. Let `step` = `stepTicks` (8) until the speed-up, then `fastStepTicks` (5). On ticks where `playTick % step == 0` the belt **advances**.
2. Advance algorithm (deterministic): if the ring has no empty cell and no item sits on the chute: every item moves one cell clockwise (the ring rotates). Otherwise: find the lowest-index empty cell `e`; for `k = 1..31`, take cell `i = (e - k) mod 32`; if cell `i` holds an item and cell `(i + 1) mod 32` is empty (after earlier moves in this advance), move the item to `i + 1`. An item whose next cell is occupied waits (items bunch up behind a blocked one).
3. **The chute:** an item that sits on cell 25 at the start of an advance is **destroyed** instead of moving to cell 26 (event `BeltLost { def }`, the item is removed with `removeItem`); a container's contents go with it. A chef can still take an item from cell 25 during the `step` ticks it sits there.
4. **Chef interaction:** the belt cells are stations: Grab takes the item on the targeted cell; Drop places the held item on the targeted cell if empty (otherwise `Refused('occupied')`). Targeting uses the normal `findTarget` nearest-station rule with reach 1.1 m; because a belt cell is 0.5 m wide a chef at the ring edge reaches about 5 cells. A chef holds one item at a time as always.
5. **Speed:** at `step = 8` an item moves 0.5 m per 8 ticks = 1.875 m/s; a lap is 32 x 8 = 256 ticks (8.5 s); the west-to-east transfer along the north side (from cell 0 to cell 9, 4.5 m) takes 72 ticks (2.4 s); walking the same 5 m round the table takes about 1.5 s plus the loop, so the belt's value is that it **frees a chef**, not that it is faster.
**Hook rules** (state `[phase, ticksInPhase, lostCount]`, phase 0 NORMAL, 1 WARN, 2 FAST):
6. At playTick `speedUpTick - warnTicks` = 3510: phase 1, event `BeltSpeedWarn { inTicks: 90 }`; render: belt lights flash, the Giant says "Plus vite!" (a speech bubble). At 3600: phase 2, event `BeltFast`; `step` becomes 5 (3.0 m/s, a lap of 160 ticks). The belt stays fast until the end.
7. `lostCount` increments on every `BeltLost` (shown in the results screen as "Plats perdus").
8. **Touches:** the 32 belt sockets (advance), items (destroy at the chute), `lostCount`, `view().twist` (phase, `ticksToNext`). No PRNG. Hash: the sockets are part of station state; `lostCount` and phase are in `save()`.

### 12.6 Pacing and ticket time
| Field | Value |
|---|---|
| `durationSeconds` | 240 |
| `countdownSeconds` | 3 |
| `secondTicketAfterSeconds` | 16 |
| `pacing.minDelaySeconds` / `maxDelaySeconds` | 1.5 / 16 |
| `pacing.burstChance` / `burstFactor` / `calmFactor` | 45 / 0.35 / 0.75 |
| `pacing.baseFromTicketTime` / `baseMinSeconds` / `baseMaxSeconds` | 0.3 / 4 / 11 |
| `ticketTimeBase` | 0.85 |
| `maxActive` solo / duo / squad / party | 4 / 5 / 6 / 7 |
| `rate` solo / duo / squad / party | 0.55 / 1.0 / 1.6 / 2.2 |
| `ticketTimeMul` solo / duo / squad / party | 1.25 / 1.0 / 0.95 / 0.9 |
| Ticket time (average over this level's recipes: cheeseburger_combo, pizza_margherita, pancakes, chicken_tenders_fries) at duo | 90.8 s x 0.85 = **77.1 s**; solo 96.4 s, squad 73.3 s, party 69.4 s |
Feast ticket time: 200 s x 0.85 = 170 s at duo.

### 12.7 Stars
| Bucket | 1 star | 2 stars | 3 stars |
|---|---|---|---|
| solo | 1350 | 2450 | 3350 |
| duo | 2150 | 3950 | 5400 |
| squad | 3250 | 5950 | 8100 |
| party | 4300 | 7900 | 10800 |

Method: §15 (bot median x 0.30 / 0.55 / 0.75). Numbers above are **provisional** (Default, tunable) until the bots in `09` measure them.
A feast complete earns about 1.6 x the points of three separate dishes' base, so the scores are the highest of the campaign.

### 12.8 Camera, lighting, music
`level.json.camera` (`CameraSpec`, `01 §10.5`; same pitch and distance on every level so the chefs keep the same on-screen size):
```json
"camera": {
  "position": [0, 12.14, 9.22],
  "target": [0, 0.2, 0.2],
  "fov": 38,
  "lean": 0.1
}
```
Derivation: pitch 54 degrees, distance 15 m (`position = target + 15 x (0, sin 54, cos 54)` with focus z = 0.4). Fit check at 16:9: the visible ground half-width at 15 m is about 9.2 m and half-depth about 6.4 m; this level needs 8.6 m and 5.9 m (playable half-size + margin 1.6 m / 1.4 m), so the whole playable area and a margin are visible without zooming. `CameraRig` increases the distance for narrower aspect ratios (`04`). `lean` 0.1 = the camera focus shifts by 10% of the chef centroid offset, with critically damped smoothing; it never follows one chef.
The camera shows the whole table; the Giant's head and hands are partly inside the frame on the east edge (render-only, no gameplay content there). Lighting `banquet_warm`. Music `banquet_epic` (the Giant hum layer swells on a feast completion).

### 12.9 Diorama dressing and ambient life
1. The table: a huge wooden plank table, a white cloth hanging at the edges, candelabras (6) on the table edges, giant cutlery as scenery at the corners (a fork the size of a lamppost), a goblet, a loaf of bread as a wall, a salt shaker tower, a bowl of fruit.
2. The hall: stone pillars, tapestries, chandeliers (far, partly visible), a fireplace glowing on the north horizon, a dog bone the size of a log under the table edge.
3. **The Giant** (render-only multi-part puppet, voxel density 1/4 m, 1/8 m for face and hands): head with a beard, eyes 1.5 m wide, jaw, two hands that rest on the table; expressions: neutral, hungry (ticket pending), delighted (serve), shocked (wrong dish), and a roar at a feast complete; blinking, breathing, looks toward the pass when a plate is delivered.
4. Banners and bunting in the Giant's colours; a tiny throne cushion; wine barrels.
Ambient life: candle flames flicker, dust motes in the light shafts, a mouse (1) sneaks along the table edge and steals a crumb (render only), moths around the candles; the Giant's reactions are driven by sim events (`Served`, `WrongDish`, feast completion), not by sim state.

### 12.10 Onboarding (first 30 seconds)
`openingTickets = ['cheeseburger_combo', 'pancakes']`; the first feast is ticket index 3 and appears well after the first minute.
| Time | What happens |
|---|---|
| 3 s | ticket 1 `cheeseburger_combo` (a recipe family the player knows). The Giant says "Faim !" with a bubble |
| 6 s | the guide arrow shows the belt: drop cooked fries on a belt cell on the north side, then pick them up on the east side at a cell near `plates_e` (prompt "Poser sur le tapis") |
| 18 s | ticket 2 `pancakes` |
| the first feast | at ticket 3 (about 60 s): the ticket card shows three icons with a "Festin" banner and the 15 s window bar after the first dish |
The belt is taught early in a safe way (a lost item costs little because the first tickets are generous).

### 12.11 Expert shortcut
**Treat the belt as a one-way courier**: West-side chefs (pizza, dough) drop raw pizzas on the west cells (26..31), the oven side chef picks them up and the plate chef takes cooked ones from the east side (10..16), never walking round. Experts time the **chute**: an item that goes by unclaimed is lost, so they drop only what the receiving chef will grab. After the speed-up they drop at 5-tick spacing and let the belt shuffle ingredients to the pass.

### 12.12 Level-specific acceptance tests
- A belt item reaches cell 25 and is destroyed after its `step` ticks; `BeltLost` increments `lostCount`.
- A fully loaded ring (32 items) rotates (no deadlock) and an empty-cell ring compacts.
- `BeltSpeedWarn` fires at playTick 3510, `BeltFast` at 3600.
- A feast completes iff its three dishes are served within 450 ticks of the first; the bonus is added once.
- Six chefs can stand around the ring without blocking the aisles (north/south aisles are 3 cells).

---

## 13. Difficulty curve table

| # | Level | Duration (s) | Recipes | New mechanic | Twist | Active tickets (duo) | Ticket time (avg, duo, s) | Chain length (steps) | Chefs' routes crossing | Stations (base / party) | Duo 3-star (provisional) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Le Kiosque du Port | 180 | 1 | grab, chop, fry | none | 2 | 48 | 3 | none | 7 / 11 | 3000 |
| 2 | Food Truck du Festival | 180 | 2 | stove, burn window | compact (none) | 2 | 56 | 3 | none | 12 / 18 | 3300 |
| 3 | Diner Route 66 | 210 | 3 | throw, recipe family | split counter | 3 | 64 | 4 | N to S over the bar | 17 / 24 | 3600 |
| 4 | Bar à Smoothies | 210 | 3 | blender, wash | tide | 3 | 46 | 4 | sink zone only | 22 / 27 | 3700 |
| 5 | Pizzeria sur les Toits | 240 | 3 | long oven cook | dumbwaiter | 3 | 62 | 6 | stairs / dumbwaiter / throw | 32 / 36 | 3900 |
| 6 | Friterie du Bateau-Mouche | 210 | 3 | coating, fire | low bridges | 4 | 55 | 5 | upper to lower deck | 17 / 24 | 3700 |
| 7 | Marché de Nuit | 210 | 4 | parallel chains | crowd lane | 4 | 59 | 4 | W to E across the lane | 22 / 28 | 4300 |
| 8 | Wagon-Restaurant | 220 | 4 | batter chain | gangway tunnels | 4 | 52 | 5 | wagon to wagon | 22 / 26 | 4300 |
| 9 | Bistrot de la Serre | 230 | 4 | harvest planters | sprinklers | 4 | 62 | 6 | scattered planters | 24 / 33 | 4700 |
| 10 | Banquet du Géant | 240 | 4 | feast tickets | conveyor | 5 | 77 | 6 | around and across the belt | 64 / 72 | 5400 |

Curve rules the table must keep (checked by the §14 script and by playtests):
1. Active tickets (duo) are non-decreasing: 2, 2, 3, 3, 3, 4, 4, 4, 4, 5. Solo is `max(2, duo - 1)`, Squad `duo + 1`, Party `duo + 2`.
2. `ticketTimeBase` falls 1.00, 0.95, 0.92, 0.90, 0.90, 0.88, 0.88, 0.86, 0.85, 0.85, which shortens every ticket on later levels; the average ticket time in the table also varies with the recipe mix (pizza and feast levels are longer in absolute seconds).
3. Exactly one new mechanic per level (column "New mechanic"); the twist is the level's personality, never a second mechanic. Twists that cost the player something first act after 20 s at the earliest: tide 40 s (level 4), bridge 50 s (6), crowd 30 s (7), tunnel 30 s (8), sprinkler 20 s on the tutorial planters only (9), belt speed-up 120 s (10; the belt itself is harmless). Levels 1, 2, 3 and 5 have no harmful dynamic twist.
4. Recipes reuse at least 50% of a known recipe's steps (design 03 §2.1): hamburger after fries (plate, pass), cheeseburger after hamburger, smoothie after the blender, pizza after salad prep.
5. Player-count: every level is completable by 1 chef (solo bucket, rate 0.55) and at 6 (party) with the optional stations; a level's Party stations all replace counters (1.4).

---

## 14. Checklist every level must pass

### 14.1 Design checklist (reviewed by a human)
- [ ] The level is recognizable without the UI (a screenshot test with the HUD hidden: the place reads in one second).
- [ ] Exactly one new mechanic, introduced safely in the first 30 s (section N.10 is filled).
- [ ] The twist changes the best route (verified by comparing a twist-aware bot with a twist-ignorant bot: the aware one scores at least 10% more at duo).
- [ ] The twist is telegraphed at least 60 ticks (2 s) before any harmful change (`TwistView.ticksToNext`, `01 §7.4` rule 4).
- [ ] There is at least one expert shortcut (N.11) that saves at least 1.5 s per use and does not break the intended route.
- [ ] Not a walled box: at least one open edge shows the surroundings; no fully enclosing wall (1.3.2).
- [ ] The diorama dressing list (N.9) is built, the ambient-life budget is respected (12 desktop / 6 mobile).
- [ ] Lighting preset and music mood set; prompts, rings and the guide arrow stay readable in every lighting state (tunnel, night).
- [ ] Stars are set per bucket from the bot measurement (§15) and pass the ascending check.
- [ ] Customers react to serve, late serve and wrong dish; the queue has 3 slots.

### 14.2 Automated layout checks (target script `v2/tools/check-levels.ts`, run by `pnpm validate` and CI)
Each check is a pure function of `layout.json` and `level.json`; failing any is a CI error.
1. **Overlaps:** no two stations overlap; no station overlaps a collider; every station and collider is inside `bounds`.
2. **Grid alignment:** all stations and colliders are on the 0.5 m grid (`x - w/2` and `z - d/2` multiples of 0.5 from `x0`, `z0`).
3. **Spawns:** exactly 6 spawn points; the four cells around each corner are free (not a station, not a collider).
4. **Corridor width:** erode the walkable cell set by one cell (a cell survives only if its 3 x 3 neighbourhood is walkable and inside bounds). Every station must have a surviving cell within 2 cells of its box, and all surviving cells in that neighbourhood must be in one connected component (so every station is reachable along a 1.5 m wide path).
5. **Optional rule:** for each station def, the first station of that def in file order is not optional; every optional station occupies a slot that is a counter when disabled; `optional: 'squad'` stations come before `optional: 'party'` of the same def in file order.
6. **Recipe coverage:** for every recipe in `level.recipes`, every item in its chain has a producing station (dispenser/planter, board, processor with the right `process`, container dispenser) in the **base** (solo/duo) station set; a pass exists; a bin exists; levels with `mechanics.wash` have a `sink` and a `rack` in the base set.
7. **Zones:** every zone referenced by the twist exists in `layout.zones`; stations that must stay usable in a twist are outside its zone (levels 6, 9: no plates dispenser, pass or bin inside a zone).
8. **Cameras:** the playable `bounds` plus a 1.0 m margin projects inside the viewport at 16:9 and 4:3 for the level's `CameraSpec` (portrait is handled by `CameraRig` widening the distance, `04`).
9. **Stars:** `stars[b]` ascending for all four buckets, and Party >= Squad >= Duo >= Solo for each tier.
10. **Pacing:** `maxActive` per bucket follows 2.2; `secondTicketAfterSeconds <= 25`.

### 14.3 Automated simulation checks (`@ga/sim` tests, `09`)
- Golden hash per level and bucket (solo, duo, squad, party) from a fixed bot and seed; stable across refactors.
- The level completes 100% of its tickets in a calm test (high `ticketTimeBase`) with 1, 2, 4 and 6 bots: no deadlock.
- Twist events fire at the exact ticks given in section N.5 (tests listed in N.12).
- The bot reaches the 1-star threshold at all four buckets, and the 3-star threshold at duo with the calibrated bot.
- Adding level N does not change the hash of any level < N (`01 §7`).

---

## 15. Star calibration procedure (bot-measured)

**Method (design 06 §5, made exact):**
1. Each level has a scripted **route bot** (`v2/packages/sim/src/rush/bot.ts` generalised per level in the bot catalogue of `09`: one bot per recipe chain, one scheduler assigning tickets to chefs, a twist-aware mode and a twist-ignorant mode).
2. For each bucket (solo with 1 chef, duo 2, squad 4, party 6) run the twist-aware bot on **20 fixed seeds** (`seed = 1000 + i`). `botMax[bucket]` = the **median** score.
3. Stars: **3 stars = 0.75 x botMax, 2 stars = 0.55 x botMax, 1 star = 0.30 x botMax**, each rounded to the nearest 50 (ascending is enforced; if rounding collides, add 50). The hidden fourth tier "Chef Étoilé" = 0.95 x botMax (stored later in `13`/`07`, not in `level.json`).
4. A tool `pnpm calibrate-stars <levelId>` writes the numbers into `level.json`, and prints the twist-aware versus twist-ignorant ratio (must be >= 1.10, the 14.1 check).
5. Humans: playtest with 1, 2, 4 and 6 players; if fewer than 15% of first-time duos reach 1 star, or more than 5% of first-time duos reach 3, scale the whole row by up to 15% and record the date in the git message.

**Provisional numbers** (Default, tunable) used until the bots exist: duo 3-star anchor per level, then `solo = 0.62 x`, `squad = 1.5 x`, `party = 2.0 x` of the duo 3-star, and `2-star = 0.733 x`, `1-star = 0.40 x` of each bucket's 3-star (these ratios reproduce level 1's shipped numbers). The anchors: L1 3000, L2 3300, L3 3600, L4 3700, L5 3900, L6 3700, L7 4300, L8 4300, L9 4700, L10 5400. The level sections list the resulting numbers.

---

## 16. Current state vs target

| Area | Current (build) | Target (this document) |
|---|---|---|
| Levels | `rushLevels` has 1 level (`l01_kiosque`) | 10 levels, ids in 1.5, registry `LEVEL_ORDER` (`01 §7.2`) |
| Level 1 optional order | `board_2` and `fryer_3` (optional) are first in the file and in screen order, drawn as real stations while counters in sim | base stations first (3.3), render the effective def (1.4.2) |
| Level 1 bin | refuses burnt items in play (cause not located; the sim bin branch accepts any held item) | always accepts; test `bin_accepts_burnt_item` (3.11) |
| Click-to-walk | present (`rushInput.ts` click, sim `walkTarget`/`path`) | removed; click interacts only within reach, else "Trop loin" (3.11) |
| Spawns | 4 per level | 6 per level |
| Optional buckets | squad only in level 1 | squad and party stations and a second pass in every level |
| Layout fields | `cell, bounds, stations, spawns, queue` | plus `colliders`, `zones` (2.3) |
| Level fields | no twist, camera, lighting, music, ticket time base | `twist, camera, lighting, musicMood, ticketTimeBase, mechanics, order, openingTickets, feast` (2.2) |
| Station kinds | counter, dispenser, processor, bin, pass | plus sink, planter, dumbwaiter, conveyor; defs: blender, sink, rack, dumbwaiter, belt cell, planter (levels 4, 5, 9, 10) |
| Twist hooks | none | 8 twist kinds (`01 §7.3`), hook additions `speedMulQ8`, `dashAllowed`, `ejectChefs` (2.4) |
| Diorama | `HarbourScene` hard-wired for level 1 | `DIORAMAS[levelId]` per level, level 1 migrated (`01 §10.4`) |
| Camera | harbour constants in `HarbourApp` (fov 38, pitch 54 degrees, distance 15, lean 0.12 / 0.10) | `CameraSpec` per level (2.5, N.8) |
| Ambient life | gulls use `Math.random` | render-local PRNG, budgets 12 / 6 |
| Stars | level 1 hand-tuned only | bot-measured per level and bucket (§15) |
| Bot | `bot.ts` handles fries only | one chain bot per recipe, twist-aware (`09`) |

### 16.1 Implementation order (feeds `10-backlog.md`)
1. Level 1 fixes (3.11) and the 6 spawns.
2. Level registry and data-model additions (2.2, 2.3, `03`).
3. Level checks script (14.2).
4. Level 2 (no new sim code), then level 3 (throw), level 4 (sink, blender, tide), level 5 (dumbwaiter), level 6 (fire, low bridges), level 7 (crowd lane), level 8 (gangway tunnels, mixer chain), level 9 (planters, sprinklers), level 10 (conveyor, feast tickets).
5. Each level: layout and level JSON, twist hook (if new), diorama, lighting, music cue, bot calibration, acceptance tests (N.12).
