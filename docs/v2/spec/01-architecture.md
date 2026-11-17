# 01 · Architecture

> The architecture of Pixel Kitchen V2: workspace and package boundaries, threads and data flow, the worker protocol, determinism rules, how the rush sim generalizes from 1 level to 10, where the multiplayer layer sits, the render asset abstraction, build and deploy, performance budgets.
> Section 1-6 describe what exists in `v2/` today (real paths, real names). Sections 7-12 specify the target. Section 13 lists the differences. Section 14 fixes the shared interface names the other docs reuse.
> Precedence: owner decisions (`00 §4`) > this spec > `docs/v2/09-technical-architecture.md` and `docs/v2/10-multiplayer-and-netcode.md`.

## Table of contents
1. Purpose and scope
2. Workspace layout and package boundaries
3. Toolchain and configuration (as it is)
4. Runtime: threads, data flow per frame, protocol as it is
5. Determinism rules
6. The rush sim as it is (API, tick order)
7. Generalizing the rush sim from level 1 to N levels
8. Worker protocol: target
9. The multiplayer layer: boundary and interfaces
10. The render asset abstraction boundary
11. Build, dev server, deployment
12. Performance budgets
13. Current state vs target
14. Shared interface names

---

## 1. Purpose and scope

This doc is the map. It answers: where does code live, who may import whom, what runs on which thread, what crosses a thread boundary and in what shape, what must be deterministic, and which interfaces glue the sim, the render layer, the network layer and the backend together without any of them knowing each other's internals.

Not here (other docs): the rules of the rush (`02`), the JSON formats (`03`), art and animation (`04`), screens and input (`05`), the netcode algorithm (`06`), the database (`07`), per-level design (`08`).

Conventions: paths are relative to the repo root unless they start with `v2/` or a package name; `@ga/*` are workspace package names; code blocks marked **(exists)** are copied from the code, blocks marked **(target)** are new.

## 2. Workspace layout and package boundaries

### 2.1 The tree (exists, with target additions marked)

```
v2/
  AGENTS.md                         (target, written with this spec)
  package.json                      scripts: dev build typecheck test lint validate check
  pnpm-workspace.yaml               packages: apps/*, packages/*
  tsconfig.base.json                strict TS, project references
  tsconfig.json                     references: shared, content, sim, render, client (target: + net, records)
  eslint.config.js                  determinism rule for sim + shared (target: + import-boundary rules)
  vitest.config.ts                  include: packages/**/src/**/*.test.ts (target: + apps/**, tests/**)
  netlify.toml                      build, publish, COOP/COEP headers (target: functions, redirects)
  content-src/vox/v1/               .vox models (items, stations, meals) + palette.json + manifest.json
  tools/v1-to-vox/                  Node scripts converting V1 models (not linted)
  docs/p2-brief-kiosque.md          level 1 brief; docs/p2/*.png screenshots
  packages/
    shared/src/                     prng.ts fmath.ts hash.ts ids.ts time.ts index.ts shared.test.ts
    content/src/
      schemas/                      rush.ts material.ts craving.ts tuning.ts
      data/rush/                    items.json stations.json recipes.json index.ts
        levels/l01_kiosque/         level.json layout.json
      data/materials data/cravings data/tuning     (Mossback demo content)
      loaders.ts validate.ts index.ts content.test.ts
    sim/src/
      rush/                         types.ts sim.ts grid.ts pacing.ts bot.ts index.ts rush.test.ts
      kitchen/ food/ world.ts ...   legacy Mossback sim (bitecs world, voxel food)
      worker.ts protocol.ts loop.ts types.ts components.ts index.ts
    render/src/
      renderApp.ts camera.ts chefView.ts ground.ts      (Mossback render)
      voxel/                        greedyMesher.ts mesherPool.ts mesher.worker.ts voxelMeshView.ts foodMaterial.ts types.ts demo.ts
      toy/                          Mossback views (kitchenScene, foodView, giantView, fx)
      scenes/harbour/               harbourApp.ts harbourScene.ts chef.ts items.ts props.ts voxel.ts water.ts fx.ts
    net/                            (target) @ga/net: transport interfaces, lockstep, codecs
    records/                        (target) @ga/records: RunLog codec, verifyRun, submission schema
  apps/client/
    index.html  vite.config.ts
    src/
      main.ts                       router: ?mode=giant -> mossback.ts, else rush/rushClient.ts
      sim.worker.ts                 re-exports @ga/sim/worker
      mesher.worker.ts              re-exports the render mesher worker
      mossback.ts hud.ts aim.ts     Mossback client
      rush/ rushClient.ts rushHud.ts rushInput.ts voxIcon.ts rush.css
      audio.ts input.ts strings.ts  shared client modules
      net/                          (target) WebRTC + Supabase signaling adapters
  netlify/functions/                (target) records API (spec/07)
```

### 2.2 Package responsibilities

| Package | Name | Contains | Runs in | Must not contain |
|---|---|---|---|---|
| `packages/shared` | `@ga/shared` | `Prng` (xoshiro128**), `fsin/fcos/clamp/lerp/toFx/fxMul/fsqrt`, `Hasher64`, `hashString`, `EntityId`, `SIM_HZ`, `SIM_DT_MS`, `SIM_DT` | anywhere (worker, main, Node) | DOM, three, clocks, `Math.random`, non-basic float math |
| `packages/content` | `@ga/content` | zod schemas and JSON data: items, stations, recipes, levels, layouts; validation; `rushLevelById` etc. | anywhere | simulation logic, DOM, three |
| `packages/sim` | `@ga/sim` | `RushSim` and rush types/events/views; `WalkGrid`; `RushBot`; the worker; the protocol types; legacy Mossback sim | worker (and Node for tests/verification) | DOM, three, rendering, network, clocks (except `worker.ts`), `Math.random` |
| `packages/render` | `@ga/render` | three.js scenes, voxel mesher, asset backends, dioramas, chef/station/item visuals, camera rig, VFX | main thread | gameplay rules, `@ga/sim` imports, `@ga/content` imports, network |
| `packages/net` (target) | `@ga/net` | peer/transport interfaces, lockstep scheduler, input and message codecs, slot allocation, desync detection | main thread (and Node for tests) | DOM and WebRTC specifics (those are behind `RunTransport`), sim logic |
| `packages/records` (target) | `@ga/records` | `RunLog` codec, `verifyRun`, submission schema, hash helpers | client, Node (Netlify functions) | DOM |
| `apps/client` | `@ga/client` | Vite app: router, screens, HUD, input devices, audio, strings, WebRTC and Supabase adapters, wiring | main thread | gameplay rules, sim internals |

### 2.3 Allowed imports (binding)

Rows import columns. `Y` = allowed, `T` = `import type` only, `-` = forbidden.

| from \ to | shared | content | sim | render | net | records | three | zod | bitecs |
|---|---|---|---|---|---|---|---|---|---|
| shared | n/a | - | - | - | - | - | - | - | - |
| content | Y | n/a | - | - | - | - | - | Y | - |
| sim | Y | Y | n/a | - | - | - | - | - | Y |
| render | Y | - | - | n/a | - | - | Y | - | - |
| net | Y | T | T | - | n/a | - | - | - | - |
| records | Y | Y | Y | - | - | n/a | - | Y | - |
| client | Y | Y | Y | Y | Y | Y | Y | - | - |

Notes:
- `render` does not import `sim` or `content`. It consumes structural types it defines itself (`SceneView`, `SceneEvent`, `ItemLike`, section 10), which `RushView` satisfies. The client does the mapping. This keeps the art backend replaceable and keeps three.js out of the worker bundle.
- `net` uses sim types (`RushInput`, `RushEvent`, `RunConfig`) as types only. Messages are encoded to bytes by `net` codecs, never structured-cloned over a data channel.
- `content` may import `shared` (for hashing the content) but nothing else of ours.
- Nothing imports `apps/client`. Nothing in `packages/*` imports `three` except `render`.

### 2.4 Enforcement (target ticket `T-ARCH-LINT`)

Add to `v2/eslint.config.js`, one block per package, using `no-restricted-imports`:

```js
const forbid = (...names) => ({
  'no-restricted-imports': ['error', { patterns: names.map((n) => ({ group: [n, `${n}/*`], message: `Package boundary: see docs/v2/spec/01 §2.3` })) }],
});
// content: forbid sim, render, net, three
{ files: ['packages/content/src/**/*.ts'], rules: forbid('@ga/sim', '@ga/render', '@ga/net', '@ga/records', 'three') },
{ files: ['packages/shared/src/**/*.ts'],  rules: forbid('@ga/content', '@ga/sim', '@ga/render', '@ga/net', '@ga/records', 'three') },
{ files: ['packages/sim/src/**/*.ts'],     rules: forbid('@ga/render', '@ga/net', '@ga/records', 'three') },
{ files: ['packages/render/src/**/*.ts'],  rules: forbid('@ga/sim', '@ga/content', '@ga/net', '@ga/records') },
```

Acceptance: a deliberate bad import in each package makes `pnpm lint` fail (checked once by hand, not committed). `pnpm check` stays green.

Also: each package's `package.json` `dependencies` must list exactly what it imports (today `render` lists `@ga/shared` and `three` only; keep it).

## 3. Toolchain and configuration (as it is)

| Item | Value | File |
|---|---|---|
| Package manager | pnpm 10.28.0, workspace | `v2/package.json`, `pnpm-workspace.yaml` |
| Language | TypeScript 5.9, `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `isolatedModules`, target/lib ES2022, `moduleResolution: Bundler`, `composite`, `emitDeclarationOnly` | `tsconfig.base.json` |
| Typecheck | `tsc -b` (project references: shared, content, sim, render, client) | `tsconfig.json` |
| Lint | ESLint 10 flat config, `typescript-eslint` recommended, `globals` browser+node; ignores `dist`, `dist-types`, `node_modules`, `tools/` | `eslint.config.js` |
| Determinism lint | in `packages/sim/src/**` and `packages/shared/src/**` (except `sim/src/worker.ts` and `*.test.ts`): bans `Math.random sin cos tan exp pow log atan2 hypot`, `globalThis.Date/performance/crypto`, and the globals `Date`, `performance`, `crypto` | `eslint.config.js` |
| Tests | Vitest 5, `environment: 'node'`, `include: ['packages/**/src/**/*.test.ts']` | `vitest.config.ts` |
| Content validation | `tsx src/validate.ts` in `@ga/content`: schema-parses materials, cravings, tuning; `rushCrossCheck()` | `packages/content/src/validate.ts` |
| Bundler | Vite 8, `worker.format = 'es'`, `build.target = 'es2022'`, COOP/COEP headers on dev and preview | `apps/client/vite.config.ts` |
| Rendering | three 0.187 | `apps/client/package.json`, `packages/render/package.json` |
| Sim ECS (legacy only) | bitecs 0.4 (used by the Mossback `SimWorld`, not by `RushSim`) | `packages/sim/package.json` |
| Hosting | Netlify; separate site with base dir `v2`; `command = "pnpm install && pnpm build"`, `publish = "apps/client/dist"`; headers `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp` on `/*` | `netlify.toml` |

`pnpm check` = `pnpm typecheck && pnpm lint && pnpm test && pnpm validate`. All four must pass.

Package `exports` are source files (`"." : "./src/index.ts"`), so there is no per-package build step; Vite and `tsx` consume TypeScript directly. `@ga/sim` also exports `./worker` (`src/worker.ts`); `@ga/render` also exports `./mesher-worker`.

## 4. Runtime: threads, data flow per frame, protocol as it is

### 4.1 Threads

```
MAIN THREAD (apps/client)                                  SIM WORKER (packages/sim/src/worker.ts)
  rushClient.ts  requestAnimationFrame loop                  owns the wall clock (performance.now, setInterval 8 ms)
   |- sample input (pads, keyboard, mouse)  ---rush-input--->  fixed 30 Hz accumulator (max 5 steps per wake)
   |- HarbourScene.update(view), RushHud.update(view)  <--rush-  RushSim.step(inputs) x N  -> events
   |- AudioManager (events -> sounds)                          RushSim.view() + stateHash() every 30 ticks
  mesher workers (render/src/voxel/mesher.worker.ts)  (Mossback food meshing only today)
```

- The sim worker is created with `new Worker(new URL('../sim.worker.ts', import.meta.url), { type: 'module' })` in `apps/client/src/rush/rushClient.ts`. `apps/client/src/sim.worker.ts` only re-exports `@ga/sim/worker`.
- The worker is the only place in `packages/sim` that reads a clock. `FixedStepLoop` (`sim/src/loop.ts`) is the legacy driver for the Mossback sim; the rush path in `worker.ts` has its own inline accumulator (same rule: elapsed capped at 250 ms, at most 5 steps per wake, remainder dropped).
- A future network layer lives on the main thread (WebRTC is not available in workers). See section 9.

### 4.2 Data flow per rendered frame (rush, as it is)

1. `rushClient.ts` `frame()` runs on `requestAnimationFrame`.
2. It polls devices (`pollPads`, keyboard, mouse via `sampleSource` in `rush/rushInput.ts`) and builds one `RushInput` per joined source.
3. It posts `{ type: 'rush-input', frames }` to the worker (the worker keeps only the latest `frames`; it applies the same frame to every tick it runs before the next message).
4. The worker's timer fires every 8 ms, adds elapsed time, runs up to 5 `RushSim.step(inputs)` calls, collects their `RushEvent`s, and if at least one step ran posts `{ type: 'rush', view, events, hash? }` (`hash` set when `tick % 30 === 0`).
5. The main thread keeps the latest `RushView` and queues events. The frame calls `scene.update(view, dt, time)`, `hud.update(view, dt)`, `hud.updateWorldUi(...)`, plays audio from events, and `app.render(dt, time, centroid)`.
6. Chefs are interpolated on the main thread between received views (the worker sends no alpha; "alpha is recomputed by the main thread from its own receive clock").

Known weakness (fixed in section 8.3): the worker applies the latest frame to all ticks of a batch, so an edge-triggered button press that begins and ends between two worker wakeups can be lost. Target: edge latching.

### 4.3 Protocol today (`packages/sim/src/protocol.ts`, exists)

```ts
export type MainToWorker =
  | { type: 'init'; seed: number; chefSlots: number; arenaHalf?: number }      // Mossback
  | { type: 'input'; frame: InputFrame }                                       // Mossback
  | { type: 'command'; command: SimCommand }                                   // Mossback
  | { type: 'pause'; paused: boolean }                                         // both
  | { type: 'dev-teleport'; x: number; z: number }                             // Mossback, dev only
  | { type: 'rush-init'; seed: number; players: number; levelId: string; ff?: number }
  | { type: 'rush-input'; frames: RushInput[] }
  | { type: 'stop' };

export type WorkerToMain =
  | { type: 'rush'; view: RushView; events: RushEvent[]; hash?: string }
  | { type: 'state'; tick: number; alpha: number; chefs: Float32Array; hash?: string }   // Mossback
  | { type: 'events'; events: SimEvent[] }                                              // Mossback
  | { type: 'food'; tick: number; upserts: FoodUpsert[]; moves: Array<{ id: number; origin: [number, number, number] }>; removed: number[] }
  | { type: 'hud'; tick: number; hud: HudState }                                        // Mossback
  | { type: 'game'; tick: number; game: GameHud };                                      // Mossback
```

The Mossback messages (`init`, `input`, `command`, `dev-teleport`, `state`, `events`, `food`, `hud`, `game`) are legacy: leave them untouched until the Mossback demo is retired by an owner decision. Only the `rush-*` messages are extended (section 8).

`ff` (fast-forward) in `rush-init` is a dev/screenshot aid: it runs that many idle ticks before the first view.

### 4.4 Router (exists)

`apps/client/src/main.ts`: `?mode=giant` dynamic-imports `mossback.js`; anything else dynamic-imports `rush/rushClient.js`. `rushClient.ts` implements modes `loading | title | intro | play | results` and flags `?dev=1`, `?debug=1`, `?level=1` (skip title). It hardcodes `LEVEL_ID = 'l01_kiosque'`, `MAX_PLAYERS = 4` (`rush/rushInput.ts`) and creates `HarbourApp`/`HarbourScene` directly. Target changes are in `05` (router, screens) and section 10 here (scene creation through a registry).

## 5. Determinism rules

The rush sim is a pure function of `(RunConfig, input log)`. This enables local replay, netcode, and server-verified records.

### 5.1 Hard rules (apply to `packages/sim`, `packages/shared`; `packages/content` data loading is also deterministic)

1. **Fixed tick:** 30 Hz, `SIM_HZ = 30`. `RushSim.step()` takes inputs for exactly one tick and never reads time. Every duration is an integer count of ticks: `secs(s) = Math.round(s * SIM_HZ)` computed once at construction.
2. **Randomness only from `Prng`** (`@ga/shared`, xoshiro128**, seeded via splitmix32). `RushSim` seeds `new Prng(seed).split('rush')`. Each subsystem that needs randomness takes its own split stream, created in a fixed order at construction (`split('pacing')`, `split('twist')`, ...). Never call a stream conditionally in a way that depends on non-sim data.
3. **Allowed float operations** (IEEE-754 exactly specified, identical in every engine): `+ - * /`, `Math.sqrt`, `Math.floor`, `Math.ceil`, `Math.round`, `Math.abs`, `Math.min`, `Math.max`, `Math.imul`, comparisons, bit ops. **Banned:** `Math.random sin cos tan exp pow log atan2 hypot asin acos sinh...`, `**` with non-integer exponent, `Date`, `performance`, `crypto`, `toFixed`/`toString` of floats as state. For sine/cosine use `fsin`/`fcos` from `@ga/shared` (polynomial, error < 1e-6).
4. **State representation.** All rule state (timers, progress, scores, tickets, streak, item and station state, twist state) is integer. Item `progress` is Q8 (0..256) of the current step. **Default (tunable):** chef kinematics (position, velocity, facing, dash vectors) are `float64` computed only with the allowed ops in rule 3, and are hashed with `Hasher64.f64`. Snapshots store them as exact `Float64`. A later ticket may convert them to Q10 integers; do not do it without a ticket because it changes every golden hash.
5. **Iteration order:** arrays in index order; chefs by slot; stations by layout index; tickets in spawn order; items by ascending id (`Map` keys are sorted before hashing or iterating when order can affect results). Never rely on `Map`/`Set` insertion order for anything that is hashed.
6. **No hidden state:** everything that can change a future tick is in the state hash (section 5.2). No module-level mutable variables in `packages/sim/src/rush/` (a lint-free convention, checked by review and by the snapshot round-trip test in `09 §6`).
7. **Inputs are the only external data.** `RushInput` values are clamped by the sim on entry (`move` to i8 range, `click` to a valid station index or -1).
8. **Content is part of the input.** `RunConfig.contentHash` (section 7.6) pins the content version; a run is invalid on a build with a different `contentHash`.
9. **`worker.ts` is the only sim file that may read a clock** (exempt in `eslint.config.js`). Tests are exempt from the lint rule but must not rely on wall time or `Math.random` either.
10. **Seeds come from outside.** The client creates the seed (`(Date.now() & 0x7fffffff) | 1` today) and passes it in `rush-init`; online, the host chooses it and broadcasts it in the room start message (`06`).

### 5.2 State hash

`RushSim.stateHash(): string` (exists) feeds a `Hasher64` (`@ga/shared`) with, in this order: tick, phase code, PRNG state bytes, score, streak, served, expired, wrong, timeLeft, spawned, nextSpawnTick, playTick, openingDone, nextItemId, nextTicketId, countdownTicks; per chef: sticky target, position/velocity/facing as `f64`, held item id, dash counters, last buttons, last click sequence, walk target, path; per station: socket item id; all items sorted by id (id, def hash, state code, progress, ticks, burnTicks, holder kind and id, contents hashes); all tickets (id, recipe hash, left, total). The worker posts it every 30 ticks (`hash` field of the `rush` message).

Rules for extending it (binding for every ticket that adds state): add the new field to `stateHash()` **in the same commit**, append at the end of its group (never reorder existing fields, so partial diffs stay readable), and add it to `snapshot()`/`restore()` (section 9.4). A test (`09 §6.4`) mutates every public state field via a snapshot and asserts the hash changes, so a forgotten field fails CI.

### 5.3 Replay and verification contract

`RunLog = { config: RunConfig; frames: RushInput[][] }` where `frames[t][slot]` is the input applied at tick `t+1`. Re-simulating `config` with `frames` must yield the same final `stateHash()` and the same `RunResult`. Defined in sections 7.6 and 9.5; the binary format is owned by `02` (replay format) and implemented in `@ga/records`.

## 6. The rush sim as it is (`packages/sim/src/rush/`)

### 6.1 Files (exists)

| File | Lines | Role |
|---|---|---|
| `types.ts` | 129 | `RushItem`, `RushInput`, `RB_A/RB_X/RB_B`, `idleRushInput`, `RushPhase`, `Verb`, `RefuseReason`, `RushEvent`, `ItemView`, `ChefView`, `StationView`, `TicketView`, `RushView` |
| `sim.ts` | 913 | `RushSim`, `RushOptions`, `bucketForPlayers`, `streakMultiplier`, `CHEF_RADIUS` |
| `grid.ts` | 155 | `Box`, `pushOutOfBox`, `distToBox`, `WalkGrid` (cell 0.5 m, deterministic Dijkstra, 8 neighbours, integer costs, ties by lower cell index) |
| `pacing.ts` | 28 | `nextOrderDelayTicks` (V1's `calculateNextOrderDelay` on integer ticks and the PRNG) |
| `bot.ts` | 169 | `RushBot`, `BotRole` (`all`, `prep`, `serve`): scripted player, fries-specific |
| `rush.test.ts` | 411 | chop/cook/burn, plating, serving and scoring, pacing, movement, bot |

### 6.2 Public API of `RushSim` (exists)

```ts
export interface RushOptions { seed: number; players: number; level?: RushLevel /* defaults to 'l01_kiosque' */ }

export class RushSim {
  readonly level: LevelData; readonly layout: Layout; readonly bucket: BucketId; readonly players: number;
  readonly recipes: Recipe[]; readonly stations: StationRt[]; readonly chefs: ChefRt[];
  readonly items: Map<number, RushItem>; readonly tickets: TicketRt[]; readonly grid: WalkGrid;
  tick: number; phase: RushPhase; score: number; streak: number; served: number; expired: number; wrong: number;
  constructor(opts: RushOptions);
  step(inputs: ReadonlyArray<RushInput | undefined>): RushEvent[];   // one tick
  view(): RushView;                                                  // read-only snapshot for render/HUD
  stateHash(): string;
  starThresholds(): [number, number, number];
  starCount(): 0 | 1 | 2 | 3;
  canAdd(container: RushItem, comp: RushItem): 'ok' | 'burnt' | 'no';
  // test helpers: giveItem, putItem, placeChef, stationIndex
}
```

`bucketForPlayers(level, players)` scans `solo, duo, squad, party` and returns the first bucket whose `players: [min, max]` contains the count (fallback `party`). `streakMultiplier(level, streak)` uses `level.scoring.streakSteps`.

### 6.3 Tick order as it is (`RushSim.step`)

1. `tick++` (u32 wrap).
2. If `phase === 'countdown'`: emit `Countdown {n}` on whole seconds, decrement `countdownTicks`; at 0 set `phase = 'playing'`, emit `Go`, spawn the first ticket.
3. For each chef slot in order `0..players-1`: `updateChef(slot, inputs[slot])` (inputs ignored when `phase === 'ended'`). This does targeting, A (edge) take/place/serve, X (held) chop, B (edge) dash, click handling, click-walk pathing, movement and collision against stations (`pushOutOfBox`).
4. `separateChefs()` (circle-vs-circle push apart).
5. If `phase === 'playing'`: `playTick++`; `updateStations(events)` (auto-cook, burn warning, burn); `updateTickets(events)` (spawn by `nextSpawnTick`, expire); `timeLeft--`; at 0 set `phase = 'ended'`, emit `TimeUp {score, stars}`.
6. Return the events.

`02` owns the target tick order (adds throw, projectiles, twist hooks, fire, washing). The insertion points for the new systems are fixed in section 7.5 and `02` must keep them.

### 6.4 Content shape the sim reads (exists, `packages/content/src/schemas/rush.ts`)

`ItemDef` (`id, chop?, cook? {station,result,time,burnWindow}, component, container`), `StationDef` (`id, kind: counter|dispenser|processor|bin|pass, process?: chop|auto`), `Recipe` (`id, container, components[], baseScore, ticketTime, penalty, family`), `LevelData` (`id, nameKey, durationSeconds, countdownSeconds, recipes[], secondTicketAfterSeconds, pacing{...}, buckets{solo,duo,squad,party: {players, rate, maxActive, ticketTimeMul}}, scoring{speedBonusCap, streakSteps, expiredPenalty, wrongPenalty}, stars{bucket:[1,2,3]}, tuning{chopSeconds, walkSpeed, dashSpeed, dashTicks, dashCooldownSeconds, reach, burnWarnSeconds}`), `Layout` (`cell, bounds, stations[{id, def, x, z, w, d, dispenses?, optional?}], spawns[], queue[]`). Level 1 data: 49 items, 13 recipes, 13 station defs in JSON; one level `l01_kiosque` (180 s, bounds x -4..4, z -2.5..2.5, 11 stations). Full schemas in `03`.

## 7. Generalizing the rush sim from level 1 to N levels

Goal: levels 2-10 are content work plus a bounded set of reusable mechanics, never forks of the sim. Adding level N must not change the behavior (or the state hash) of levels 1..N-1.

### 7.1 What is already generic, what is not

| Already generic (keep) | Level-1-specific or limited (change) |
|---|---|
| `RushSim` takes `RushLevel` (`level.json` + `layout.json`) | `RushOptions.level` defaults to `rushLevelById('l01_kiosque')` (default stays for tests only) |
| Items, recipes, stations are data (`ItemDef.chop`, `.cook`, station `kind` and `process`) | `rushLevels` in `content/src/data/rush/index.ts` is a hand-written one-element array |
| Buckets, pacing, scoring, stars, tuning are per level in `level.json` | `rushClient.ts`: `LEVEL_ID = 'l01_kiosque'`, `level.layout` read at module load |
| Optional stations by bucket (`LayoutStation.optional`) | `MAX_PLAYERS = 4` in `rush/rushInput.ts`; `SLOT_COLORS` has 4 entries |
| `WalkGrid` built from the layout | Click-to-walk (`RushInput.click`, `clickKind`, `startWalk`, `WALK_TIMEOUT_TICKS`): to remove (owner decision 5) |
| Worker `startRush(seed, players, levelId, ff)` takes any level id | `bot.ts` is fries-only (`cooked_fries`, potato -> board -> fryer) |
| | `rushClient.ts`: `s.def === 'fryer'` for the sizzle sound; `HarbourScene` is the only scene |
| | `StationDef.kind` has 5 kinds; no sink, planter, dumbwaiter, conveyor, no throw, wash, fire |
| | `RushSim` is one 913-line class |
| | No twist mechanism |

### 7.2 Level registry (content)

1. Level folders: `v2/packages/content/src/data/rush/levels/<levelId>/` with `level.json` and `layout.json`; `<levelId>` is `l<NN>_<slug>`: `l01_kiosque`, `l02_foodtruck`, `l03_diner`, `l04_smoothies`, `l05_pizzeria`, `l06_bateau`, `l07_marche`, `l08_wagon`, `l09_bistrot`, `l10_banquet`. Slugs are fixed here so every doc uses them.
2. `levels/index.ts` (target) exports `LEVEL_ORDER: readonly string[]` (the ids above, in campaign order) and `rushLevels: RushLevel[]` built from explicit static JSON imports (explicit, because `tsx` (validate) and Vitest do not support `import.meta.glob`). A test (`09 §7`) fails if a folder exists that is not in `LEVEL_ORDER` or the reverse.
3. API (extends `@ga/content`, exists for the first two):
   ```ts
   export function rushLevelById(id: string): RushLevel | undefined;      // exists
   export const rushLevels: RushLevel[];                                  // exists (1 element today)
   export const LEVEL_ORDER: readonly string[];                           // target
   export function levelIndex(id: string): number;                        // target, 0-based, -1 if unknown
   export function contentHash(levelId?: string): string;                 // target, section 7.6
   ```
4. Adding a level never touches `packages/sim` unless it introduces a new mechanic (7.3, 7.4). The how-to is in `03`.

### 7.3 Data model additions (owned by `03`, listed here so sim and render agree)

`LevelData` gains (all with defaults so level 1 JSON stays valid; `03` has the zod definitions):

| Field | Type | Meaning | Default |
|---|---|---|---|
| `order` | int | position in the campaign, 1..10 | n/a (required) |
| `mechanics` | `{ throw: boolean; wash: boolean; fire: boolean; harvest: boolean; feast: boolean }` | which optional verbs/systems are active | all false |
| `twist` | `{ kind: TwistKind; params: Record<string, number> }` | the signature mechanic and its integer parameters (seconds are converted to ticks by the hook) | `{ kind: 'none', params: {} }` |
| `camera` | `CameraSpec` | fixed camera per level (section 10.5) | harbour values |
| `unlock` | `{ requires: string \| null; minStars: 0..3 }` | campaign gating (UI only, `05`) | `{ requires: null, minStars: 0 }` |
| `ticketTimeBase` | number | multiplier on every `recipe.ticketTime` of the level, before the bucket `ticketTimeMul` (`08 §2.2`) | 1 |
| `openingTickets` | `string[]` (optional) | recipe ids forced for the first tickets; later tickets use the pacing PRNG | absent |
| `guide` | optional | first-order guide arrow data (`03`) | absent |

`TwistKind = 'none' | 'split_counter' | 'tide' | 'dumbwaiter' | 'low_bridges' | 'crowd_lane' | 'gangway_tunnels' | 'sprinklers' | 'conveyor'` (levels 1,2 -> `none`; 3 -> `split_counter`; 4 -> `tide`; 5 -> `dumbwaiter`; 6 -> `low_bridges`; 7 -> `crowd_lane`; 8 -> `gangway_tunnels`; 9 -> `sprinklers`; 10 -> `conveyor`; see `design/06 §3`, `08`).

`StationDef.kind` grows to: `counter | dispenser | processor | bin | pass | sink | planter | dumbwaiter | conveyor | extinguisher | return` (target; each new kind arrives with the level that needs it). The blender is not a kind: it is a `processor` with `process: 'multi'` (`02 §6.6`). `08` also needs the defs `sink` (kind `sink`), `rack` (the dirty rack, kind `counter`, receives returned dirty containers) and `planter` (kind `planter`); `03` defines them. `LayoutStation` gains optional `rot` (0, 90, 180, 270, render only), `zone` (string, for multi-zone levels), `props` (free numeric params for the twist, integers).

`Layout` gains `zones?: Array<{ id: string; box: Box }>`, `blockers?: Array<{ id: string; box: Box }>` (hook-controlled dynamic no-go areas, 7.4) and `colliders?: Array<{ id: string; x: number; z: number; w: number; d: number; flyOver: boolean }>` (static solid obstacles, marked blocked in the `WalkGrid` once at construction; thrown items pass over when `flyOver`).

The `tuning` block gains `throwRange` (metres, `Default (tunable)` 5.0), used by `02 §9`.

### 7.4 Station behavior and twist hooks (sim)

Refactor `sim.ts` into modules **without changing level 1 behavior**. Gate: the level 1 golden hash (`09 §6.2`) is identical before and after every refactor ticket.

Target layout of `packages/sim/src/rush/`:

```
sim.ts            RushSim orchestration: constructor, step(), view(), snapshot/restore, stateHash
state.ts          RushState (all mutable state in plain integer/f64 fields), createState(), hashState(), snapshotState()
types.ts          unchanged names
chef.ts           targeting, buttons, dash, movement, collision, separation
interact.ts       the interaction table (verb resolution) calling station behaviors
stations/         one file per StationKind: counter.ts dispenser.ts processor.ts bin.ts pass.ts sink.ts planter.ts dumbwaiter.ts conveyor.ts + index.ts (registry)
items.ts          item creation/removal, container rules (canAdd), cook/chop/burn timers
tickets.ts        spawn, expire, match, pacing (uses pacing.ts)
scoring.ts        points, streak, stars
throw.ts          projectiles (level 3+)
hooks/            twist hooks: none.ts split_counter.ts tide.ts ... + index.ts (registry)
codec.ts          encodeRushInput / decodeRushInput (section 9.4)
grid.ts pacing.ts bot.ts
```

**Station behavior interface (target):**

```ts
export interface StationBehavior {
  readonly kind: StationKind;
  /** True if `item` may be placed on this station now. */
  accepts(ctx: SimCtx, st: StationRt, item: RushItem): boolean;
  /** Resolve a chef's A press on this station. Mutates state, pushes events. Returns the verb for the HUD. */
  interact(ctx: SimCtx, slot: number, st: StationRt, apply: boolean, events: RushEvent[]): Verb;
  /** Called once per playing tick per station of this kind, in station index order. */
  update?(ctx: SimCtx, st: StationRt, events: RushEvent[]): void;
}
export const STATION_BEHAVIORS: Readonly<Record<StationKind, StationBehavior>>;
```

**Twist hook interface (target):**

```ts
export interface TwistHooks {
  readonly kind: TwistKind;
  /** Called once at construction after stations exist. Create integer state here. */
  init(ctx: SimCtx): void;
  /** Start of every playing tick (insertion point H1, before chefs move). */
  onTickStart?(ctx: SimCtx, events: RushEvent[]): void;
  /** After stations and tickets update (insertion point H2). */
  onTickEnd?(ctx: SimCtx, events: RushEvent[]): void;
  /** Whether a chef may stand at (x, z) now (called by collision; must be a pure function of hook state). */
  isBlocked?(ctx: SimCtx, x: number, z: number): boolean;
  /** Whether a station may be used now (e.g. sink while the tide is in). Pure function of hook state. */
  stationUsable?(ctx: SimCtx, stationIndex: number): boolean;
  /** Q8 multiplier (256 = 1.0) on a chef's walk speed at (x, z). Pure function of hook state. Default 256. */
  speedMulQ8?(ctx: SimCtx, x: number, z: number): number;
  /** Whether Dash may start or continue at (x, z). Default true. */
  dashAllowed?(ctx: SimCtx, x: number, z: number): boolean;
  /** Telegraph for HUD/render: what is about to happen, in ticks. Part of RushView.twist. */
  view(ctx: SimCtx): TwistView;
  hash(h: Hasher64): void;
  save(): Int32Array;
  load(data: Int32Array): void;
}
export const TWIST_HOOKS: Readonly<Record<TwistKind, () => TwistHooks>>;

export type TwistView = { kind: TwistKind; phase: number; ticksToNext: number; ticksInPhase: number; flags: number };
```

Rules for hooks:
1. A hook may read `ctx.level.twist.params`, `ctx.tick`, `ctx.playTick`, its own split PRNG stream `ctx.rng.twist`, stations and items; it may mutate items/stations only through the same functions chefs use (`items.ts`), never directly in a way that skips events.
2. A hook holds **integer state only**, in a single `Int32Array` returned by `save()`, hashed by `hash()`.
3. Every effect the player must see is both an event (`RushEvent` variant, e.g. `{ kind: 'TideRising'; inTicks: number }`) and a field of `RushView.twist` so late joiners and replays render the same thing.
4. Telegraph: any harmful or blocking change is announced at least 60 ticks (2 s) before it applies, via `TwistView.ticksToNext` (`design/06 §6`).
5. The hook for `none` is a no-op and is used by levels 1 and 2.
6. Hooks never branch on level id. Level-specific numbers are `twist.params` entries (documented per level in `08`).

**`SimCtx`** is the object passed to behaviors and hooks: `{ level, layout, bucket, players, tick, playTick, rng: { pacing: Prng; twist: Prng }, state: RushState, items: ItemStore, stations: StationRt[], chefs: ChefRt[], tickets: TicketStore, emit(e: RushEvent): void, ejectChefs(box: Box, stunTicks: number): void }`. `ejectChefs` moves every chef overlapping `box` to the nearest free cell centre outside it (slot order; tie-break smaller z, then smaller x), keeps the held item, stuns it and emits `ChefEjected`. It is internal to `@ga/sim` (not exported from the package index).

### 7.5 Target tick order (outline; `02` expands it and may not reorder it)

```
 1. tick++
 2. countdown handling (Countdown/Go events, first ticket)
 3. H1: twist.onTickStart            (playing only)
 4. chefs in slot order: targeting, buttons (A grab/drop/serve, X action held, T throw, B dash), mouse click-in-reach, movement + collision (uses twist.isBlocked)
 5. separateChefs
 6. projectiles (thrown items fly, land, or are lost)
 7. playTick++ (first thing in the playing part, as today), then stations in index order: STATION_BEHAVIORS[kind].update (cook, burn, fire spread, wash progress, planter regrow, conveyor advance, dumbwaiter)
 8. tickets: spawn (PRNG 'pacing'), expire, feast completion
 9. H2: twist.onTickEnd
10. timeLeft--, end check (TimeUp)
11. return events
```

Today's step order (6.3) maps onto it with steps 3, 6, 9 empty. `playTick++` stays at the start of step 7 (as `02 §12` implements it) so level 1 keeps its hash; only `timeLeft--` and the end check sit at step 10. The golden hash gate catches an off-by-one.

### 7.6 Run configuration, content hash, version

```ts
/** Everything that defines a run, besides the inputs. (target, @ga/sim `rush/types.ts`) */
export interface RunConfig {
  simVersion: number;      // SIM_VERSION constant in @ga/sim, bumped when any rule changes
  contentHash: string;     // contentHash(levelId): hash of canonical JSON of items, stations, recipes, level, layout
  levelId: string;
  players: number;         // 1..6, total slots (local + remote)
  seed: number;            // u32
  difficulty?: 'snack' | 'meal' | 'feast';   // default 'meal' (`02 §15.3`)
  assist?: boolean;        // default false: extended patience (ticket time x1.25), run is unranked (`05`, `07`)
}
export interface RunResult { levelId: string; bucket: BucketId; score: number; stars: 0 | 1 | 2 | 3; served: number; expired: number; wrong: number; ticks: number; hash: string; perSlot?: SlotResult[]; }   // perSlot optional (`02 §17.1`)
export interface RunLog { config: RunConfig; frames: RushInput[][] }   // frames[t][slot], applied at tick t+1
```

- `SIM_VERSION` starts at 1 and is bumped by any ticket that changes rule behavior; golden hashes (`09 §6.2`) are regenerated in that commit. Leaderboard rows (`07`) are keyed by `(levelId, bucket)` and store `simVersion`; rows from older versions stay visible but flagged.
- `contentHash(levelId)`: `Hasher64` over `JSON.stringify` of the sorted-key canonical form of `rushItems`, `rushStations`, `rushRecipes` and that level's `level` + `layout`. It is computed in `@ga/content`, which may import `@ga/shared`.
- `players` is the total number of slots in the run, 1..6, regardless of how many are local or remote.

### 7.7 Players and buckets

- `MAX_PLAYERS = 6` (move to `@ga/sim` as `export const MAX_RUSH_PLAYERS = 6`; the client imports it). Local seats are limited to 4 per machine (`MAX_LOCAL_SEATS = 4`, client).
- `SLOT_COLORS` (render, `scenes/harbour/chef.ts`, 4 entries today) grows to 6 distinct colors; `04` lists them.
- Validation (`03`, `pnpm validate`): every level's `buckets` ranges are contiguous and cover exactly 1..6; every `layout.spawns` has at least 6 entries; every level has `stars` for all four buckets, strictly ascending.
- The bucket is computed from `players` (total) once at construction. It does not change mid-run, including when a peer leaves (`06` decides what a leaver's chef does).

### 7.8 Input generalization

Owner decision 5 changes `RushInput`. Target shape (the sim-side rules are in `02`; this is the contract):

```ts
export interface RushInput {
  move: [number, number];        // i8 stick, x right, y towards +z (screen down)
  buttons: number;               // RB_A | RB_X | RB_B | RB_T
  click: number;                 // station index under the mouse cursor, or -1
  clickSeq: number;              // u8, increments per click; acted on when it changes
}
export const RB_A = 1;   // Grab / Drop / Serve  (edge)
export const RB_X = 2;   // Action: chop, wash, extinguish (level, held)
export const RB_B = 4;   // Dash (edge)
export const RB_T = 8;   // Throw (edge, level 3+ only; ignored when level.mechanics.throw is false)
```

- `clickKind` is removed. `WALK_TIMEOUT_TICKS`, `STUCK_TICKS`, `WAYPOINT_EPS`, `startWalk`, `ChefRt.walkTarget/walkKind/path/walkTicks/stuck` are removed; `WalkGrid` stays only if a later feature needs it (bots, customer paths in render do not use the sim grid); if unused after the removal, delete it in a separate commit.
- A click acts like pressing A on that station **only if** the station is within reach of the chef (`level.tuning.reach` from the chef edge to the station box, same test as `findTarget`). Otherwise the sim emits `RushEvent { kind: 'TooFar'; slot: number; station: number }` and does nothing else. The client shows the "trop loin" hint on `TooFar`. The mouse cannot trigger chop: hold X (the client may map right-click-hold to RB_X).
- `RushEvent` gains: `TooFar`, `Threw {slot, def}`, `ThrowLanded {station|-1, def}`, `ItemLost {def}`, `Washed {slot, station}`, `Fire {station}`, `Extinguished {station}`, `TwistTelegraph {kind, inTicks}`; exact fields are owned by `02`.
- `RushBot` (`bot.ts`) must stop using click-to-walk and drive the chef with the stick (it already uses only what a human has; it switches to `move` steering over a path computed on the bot's own `WalkGrid` copy). Generalized bot: `09 §5`.

## 8. Worker protocol: target

All names below are final. Only the `rush-*` family and `pause`/`stop` are used by the rush client.

### 8.1 Messages

```ts
export type RushClock = 'realtime' | 'driven';

export type MainToWorker =
  | /* ...legacy unchanged... */
  | { type: 'rush-init'; config: RunConfig; clock: RushClock; ff?: number }
  | { type: 'rush-input'; frames: RushInput[] }                    // realtime clock: latest input per slot, edge-latched (8.3)
  | { type: 'rush-advance'; steps: RushInput[][] }                 // driven clock: run exactly steps.length ticks, steps[t][slot]
  | { type: 'rush-snapshot-request'; reqId: number }
  | { type: 'rush-restore'; snapshot: Uint8Array; tick: number }
  | { type: 'rush-log-request'; reqId: number }
  | { type: 'pause'; paused: boolean }
  | { type: 'stop' };

export type WorkerToMain =
  | /* ...legacy unchanged... */
  | { type: 'rush-ready'; simVersion: number; contentHash: string }               // reply to rush-init
  | { type: 'rush'; view: RushView; events: RushEvent[]; hash?: string }          // after every batch of steps
  | { type: 'rush-snapshot'; reqId: number; tick: number; snapshot: Uint8Array }  // transferred buffer
  | { type: 'rush-log'; reqId: number; log: RunLog }
  | { type: 'rush-error'; code: 'unknown_level' | 'content_mismatch' | 'bad_snapshot' | 'bad_input'; message: string };
```

Changes from today: `rush-init` carries a `RunConfig` instead of loose fields (the old `seed/players/levelId` fields are removed in the same commit as the client change; there is a single client, no compatibility shim is needed); `clock`, `rush-advance`, snapshot, log and error messages are new; `rush-ready` lets the client check `contentHash`.

### 8.2 Clocks

| `clock` | Who decides when ticks run | Used for |
|---|---|---|
| `realtime` | the worker's own 8 ms timer and accumulator (as today, 250 ms elapsed cap, max 5 steps per wake) | local play, solo or couch; the host of an online room when it is also the clock authority |
| `driven` | the main thread, by sending `rush-advance` with exactly the inputs per tick (the worker never runs a tick on its own) | lockstep guests and hosts (`06`), replays, ghost runs, tests, screenshots with `ff` |

Both modes call the same `RushSim.step`. In `driven` mode the worker posts one `rush` message per `rush-advance` message (events concatenated over its ticks, view after the last tick). The `rush` message always carries `view.tick` so the main thread knows where the sim is.

### 8.3 Edge latching (fix)

In `realtime` mode the worker keeps, per slot, `pendingEdges` (bits of `RB_A | RB_B | RB_T`). On every `rush-input` message it ORs the edge bits of the new frame into `pendingEdges`. On each tick it builds the input as `frame.buttons | pendingEdges` (for edge bits only) and then clears `pendingEdges`. Level bits (`RB_X`) are taken from the latest frame. `RushSim` already detects edges by comparing with `lastButtons`; the latch guarantees a press shorter than the worker wake interval still produces a rising edge across two ticks (the worker clears the edge bit on the tick after it was applied, so the sim sees 0 then 1 then 0 as needed). The log stores the latched inputs actually applied per tick, so replays match.

### 8.4 Batching and transfer

- One `rush` message per worker wake that ran at least one tick (as today).
- `RushView` is structured-cloned; budget in section 12. Do not add large arrays to it. Per-frame data that never changes (layout) is sent once (client reads it from `@ga/content`).
- `rush-snapshot.snapshot` and `rush-restore.snapshot` are `Uint8Array` buffers transferred, not copied.

## 9. The multiplayer layer: boundary and interfaces

`06` specifies the netcode (topology, lockstep or state sync, message schemas, join and leave, voice). This section fixes **where it sits** and the interfaces every other layer may depend on. The sim worker never learns that a network exists.

### 9.1 Principles

1. **The sim is network-agnostic.** `RushSim` and the worker take inputs and produce views. No `peerId`, no latency, no sockets inside `@ga/sim`.
2. **Networking runs on the main thread** (WebRTC is not available in workers). It lives in `@ga/net` (pure logic, testable in Node) and `apps/client/src/net/` (WebRTC, Supabase Realtime signaling adapters that need the DOM/browser).
3. **The UI talks to two small interfaces only:** `ViewSource` (where views and events come from) and `InputSink` (where local inputs go). Local play, host, and guest differ only in which objects are plugged in.
4. **Slots are global.** A run has `players` slots, 0..5. Each slot is driven by exactly one human (or an idle placeholder). A machine owns a set of slots (its local seats). Slot assignment is decided by the host and is part of the room state.
5. **The same code verifies records** on the server (`@ga/records` + `InlineSimDriver`, 9.5).

### 9.2 Interfaces (target; names are final)

```ts
// ---- @ga/sim (types) ----
export interface RushUpdate { view: RushView; events: RushEvent[]; hash?: string }
export type Unsub = () => void;

/** Where views and events come from. Implemented by SimDriver (own sim) and by NetSession (remote view, if the netcode uses state sync). */
export interface ViewSource {
  subscribe(cb: (u: RushUpdate) => void): Unsub;
}

/** Where local input goes. */
export interface InputSink {
  setInput(slot: number, frame: RushInput): void;
}

/** Façade over one running sim. */
export interface SimDriver extends ViewSource, InputSink {
  start(config: RunConfig, clock: RushClock): Promise<void>;     // resolves after rush-ready
  advance(steps: RushInput[][]): void;                            // driven clock only
  snapshot(): Promise<Uint8Array>;
  restore(snapshot: Uint8Array, tick: number): void;
  log(): Promise<RunLog>;
  pause(paused: boolean): void;
  stop(): void;
}
```

Implementations of `SimDriver`:

| Class | Package | Where it runs | Use |
|---|---|---|---|
| `WorkerSimDriver` | `apps/client/src/sim/workerSimDriver.ts` | main thread, talks to the sim worker with the 8.1 messages | the game |
| `InlineSimDriver` | `@ga/sim` (`rush/inlineDriver.ts`) | in-process, calls `RushSim` directly, no worker, no clock (`driven` only) | unit tests, bots, network tests, server verification, ghost generation |

```ts
// ---- @ga/net ----
export type PeerId = string;

/** One P2P datachannel mesh or star, hidden behind this interface. WebRTC adapter lives in apps/client/src/net/webrtcTransport.ts. */
export interface RunTransport {
  readonly selfId: PeerId;
  peers(): PeerId[];
  send(to: PeerId | 'all', channel: 'reliable' | 'unreliable', data: Uint8Array): void;
  onMessage(cb: (from: PeerId, channel: 'reliable' | 'unreliable', data: Uint8Array) => void): Unsub;
  onPeerJoin(cb: (peer: PeerId) => void): Unsub;
  onPeerLeave(cb: (peer: PeerId) => void): Unsub;
  /** Round-trip time estimate in ms (for the HUD and for input delay). */
  rtt(peer: PeerId): number;
  close(): void;
}

/** Signaling + room directory (Supabase Realtime in production). */
export interface SignalingClient {
  createRoom(opts: { levelId: string; maxPlayers: number }): Promise<RoomInfo>;
  joinRoom(code: string): Promise<RoomInfo>;
  signal(to: PeerId, payload: SignalPayload): void;
  onSignal(cb: (from: PeerId, payload: SignalPayload) => void): Unsub;
  onRoomChange(cb: (room: RoomInfo) => void): Unsub;
  leave(): void;
}

export interface RoomInfo { code: string; hostId: PeerId; levelId: string; maxPlayers: number; members: RoomMember[]; started: boolean }
export interface RoomMember { peerId: PeerId; nickname: string; seats: number; slots: number[] }   // slots assigned by the host
export type SignalPayload = { kind: 'offer' | 'answer'; sdp: string } | { kind: 'ice'; candidate: string };

/** Slot allocation: pure function used by the host. Total slots <= 6; a member with k seats gets k consecutive free slots in join order. */
export function allocateSlots(members: ReadonlyArray<{ peerId: PeerId; seats: number }>, maxSlots: number): Map<PeerId, number[]> | 'full';

/** The session object the UI sees. */
export interface NetSession extends ViewSource, InputSink {
  readonly role: 'host' | 'guest';
  readonly room: RoomInfo;
  readonly localSlots: number[];
  /** Host only: choose seed, send RunConfig, start. */
  startRun(levelId: string): Promise<void>;
  onRunStart(cb: (config: RunConfig, slotMap: Map<PeerId, number[]>) => void): Unsub;
  onPeerStatus(cb: (peer: PeerId, status: 'connected' | 'lagging' | 'left') => void): Unsub;
  onDesync(cb: (info: { tick: number; mine: string; theirs: string; peer: PeerId }) => void): Unsub;
  leave(): void;
}
```

```ts
// ---- apps/client ----
export type InputSourceDesc = { kind: 'kb' } | { kind: 'pad'; index: number };
/** A human at this machine: the input source and the slot it drives. Up to MAX_LOCAL_SEATS (4). */
export interface LocalSeat { slot: number; source: InputSourceDesc; name: string; color: number }

/** Orchestrates one play of one level: wires seats, input, a SimDriver, optionally a NetSession, and exposes a ViewSource to the UI. */
export interface RunSession {
  readonly mode: 'local' | 'host' | 'guest';
  readonly config: RunConfig;
  readonly seats: LocalSeat[];
  readonly view: ViewSource;
  start(): Promise<void>;
  pause(paused: boolean): void;
  result(): RunResult | null;          // non-null after phase 'ended'
  log(): Promise<RunLog>;
  dispose(): void;
}
export function createRunSession(opts: { mode: 'local' | 'host' | 'guest'; config?: RunConfig; seats: LocalSeat[]; net?: NetSession; driver: SimDriver }): RunSession;
```

### 9.3 How the pieces connect

```
LOCAL (solo or couch)
  input devices -> RunSession.setInput(slot, frame) -> WorkerSimDriver --rush-input--> worker (clock: realtime)
  worker --rush--> WorkerSimDriver --RushUpdate--> ViewSource -> scene, HUD, audio

ONLINE, lockstep (if 06 chooses it; guests and host identical)
  local devices -> NetSession.setInput(slot, frame) -> encode (codec.ts) -> RunTransport.send(...)
  NetSession collects all slots' inputs for tick T (with input delay) -> WorkerSimDriver.advance(steps)  (clock: driven)
  worker --rush--> WorkerSimDriver --RushUpdate--> NetSession (hash compare) -> ViewSource -> UI

ONLINE, state sync (if 06 chooses it)
  host: as LOCAL plus NetSession sends views/events to guests
  guest: no local sim; NetSession.subscribe emits RushUpdate decoded from the host; local input goes to the host
```

In every case the UI and the renderer consume `RushUpdate` and produce `RushInput`; they do not know which case they are in. `06` picks lockstep or state sync and fills in `NetSession`; whichever it picks, the `SimDriver`, `ViewSource`, `InputSink`, `RunTransport` and `SignalingClient` interfaces above do not change.

### 9.4 What the sim must provide for netcode (target)

1. **Binary input codec** (`packages/sim/src/rush/codec.ts`), 5 bytes per slot per tick:
   ```ts
   export const INPUT_BYTES = 5;
   export function encodeRushInput(i: RushInput, out: Uint8Array, offset: number): void;   // move x,y as i8; buttons u8; click as u8 (255 = -1; stations <= 254); clickSeq u8
   export function decodeRushInput(src: Uint8Array, offset: number): RushInput;
   ```
   Round trip must be identity for all valid inputs (property test, `09 §6`). Level definitions must have at most 254 stations (validated).
2. **`RushSim.snapshot(): Uint8Array` and `RushSim.restore(data: Uint8Array): void`**: all state in a versioned binary layout (version byte, then the same fields as `stateHash()` plus everything needed to resume: item table, stations, chefs including `Float64` kinematics, tickets, PRNG states, twist `Int32Array`). `restore(snapshot())` followed by N steps must equal N steps without the round trip (hash equal). Join-in-progress and any resync use it.
3. **Deterministic given inputs only:** `step` must not depend on how many views were requested between ticks (`view()` has no side effects; test in `09 §6`).
4. **Input validation** in `step`: any `RushInput` from the network is clamped on entry. A malformed frame never throws.
5. **Per-slot idle on disconnect:** `idleRushInput()` is the placeholder input; `06` decides what a leaver's chef does (default: stand still).
6. **Hash cadence:** the worker posts `hash` every 30 ticks (1 s). `NetSession` exchanges `{tick, hash}` at that cadence and fires `onDesync` on mismatch (`06`).

### 9.5 Records and verification boundary

- The client builds a `RunLog` after the run (`WorkerSimDriver.log()`, which asks the worker with `rush-log-request`), and submits `{ log, nickname-token }` to a Netlify function (`07`).
- The function (Node, bundled by esbuild) imports `@ga/records`, which uses `InlineSimDriver` to re-simulate `log.config` + `log.frames`, compares the resulting `RunResult.hash` and `score` with the claim, and checks `simVersion` and `contentHash` against the server build. `RunLog` size: 5 bytes x slots x ticks (a 6-player 180 s run is about 162 KB raw; compressed with `CompressionStream('gzip')` or an equivalent in Node, it is expected to be under 40 KB; `02` defines the compact format).
- For this to work, `@ga/sim` and `@ga/content` must load in Node with no DOM: true today for everything except `sim/src/worker.ts` (never imported by the verifier).
- Online runs: the host's `RunLog` is submitted with the list of participants; `07` decides how the other peers' tokens are credited.
- Everything above is data flow only; `07` owns the schema, rate limits and anti-cheat.

### 9.6 Decided here vs decided in other docs

| Decision | Owner |
|---|---|
| Sim and worker are network-agnostic; net on main thread; the interfaces in 9.2 | **this doc** |
| `SimDriver` clocks (`realtime`, `driven`), snapshot, log, input codec | **this doc** |
| Lockstep vs state sync, input delay, tick scheduling, rollback or not | `06` |
| Message formats on the datachannel, reliable vs unreliable usage | `06` |
| Join in progress, leave, reconnect, host migration or not | `06` |
| Voice chat | `06` |
| Room codes, invite links, Supabase channel names | `06` (signaling), `07` (tables) |
| Replay compact format, record rows, verification limits | `02` (format), `07` (rows) |

## 10. The render asset abstraction boundary

Owner decision 7: the art style (voxel or smooth stylized 3D) is open. Everything that decides how a station, item, chef, customer or prop **looks** is behind `AssetBackend`. Gameplay, sim, HUD and the level layout never depend on a style. `04` details the visuals; this section fixes the interface and the rules.

### 10.1 Rules

1. All visual creation in `packages/render` goes through an `AssetBackend`. Scene code (dioramas, chef rigs, VFX) never imports `.vox` parsing or mesh builders directly; it calls the backend.
2. A backend is selected by `ArtStyle`: `'voxel'` (default) or `'smooth'`. Selection: URL `?art=smooth`, else `localStorage['pk.art']`, else `'voxel'`. Switching requires a page reload (no hot swap).
3. Both backends read the same `AssetManifest` ids and honor the same **footprint contract** (10.3). Gameplay never changes with style: station boxes come from `layout.json`, not from the model.
4. A missing asset never throws: the backend returns a placeholder (a colored box sized to the footprint with the id in debug mode) and logs once.
5. Animation state is data (`ChefPose`, `ItemVisualState`, `StationVisualState`), pushed into visuals each frame by the scene. Visuals own their animation clocks (floats are fine in render).
6. Render code uses structural view types (`SceneView`, `SceneEvent`); it does not import `@ga/sim`.

### 10.2 Interfaces (target, `packages/render/src/assets/types.ts`)

```ts
export type ArtStyle = 'voxel' | 'smooth';
export type AssetKind = 'station' | 'item' | 'meal' | 'chef' | 'customer' | 'prop';
/** 'station/fryer', 'item/cooked_fries', 'meal/hamburger', 'chef/default', 'customer/adult', 'prop/harbour/sailboat'. */
export type AssetId = `${AssetKind}/${string}`;

export interface AssetEntry {
  id: AssetId;
  /** Voxel backend: path of the .vox under content-src/vox. Smooth backend: path of the glb/procedural recipe id. */
  voxel?: string;
  smooth?: string;
  /** Meters. The model is scaled to fit this box (stations: the layout box, items: held size). */
  footprint: { w: number; h: number; d: number };
}
export interface AssetManifest { version: 1; entries: Record<AssetId, AssetEntry> }

export interface Vec3Like { x: number; y: number; z: number }

export interface Visual { readonly root: Object3D; dispose(): void }

export interface ItemLike { id: number; def: string; state: string; progress: number; contents: string[] }  // exists in harbour/items.ts
export interface ItemVisual extends Visual {
  /** Called when the item changes (state, doneness progress Q8, contents). Cheap when nothing changed. */
  set(item: ItemLike): void;
}

export interface StationVisualState {
  enabled: boolean; active: boolean; highlight: 0 | 1 | 2; item: ItemLike | null;
  // 04-ext (optional, `04 §` interface additions)
  fire?: 0 | 1 | 2; warn?: boolean; hasExtinguisher?: boolean; mix?: string[]; stock?: number /* -1 infinite */;
  dirty?: number; growLeft?: number; bump?: number /* 0..1 */; lidOpen?: boolean;
}
export interface StationVisual extends Visual {
  set(s: StationVisualState, time: number): void;
  /** Anchor points in world space for HUD and VFX: 'top' (item socket), 'ring' (progress ring), 'front' (prompt). */
  anchor(name: 'top' | 'ring' | 'front'): Vec3Like;
}

export interface ChefLook {
  slot: number; color: number; hat: number; name?: string;
  skin?: number; emblem?: number;                // 04-ext (optional)
}
export interface ChefPose {
  /** 0..1 walk speed fraction; `phase` advances while walking. */
  walk: number; phase: number; chopping: boolean; dashing: boolean; carrying: boolean;
  throwT: number /* 0..1 over the throw animation, 0 = none */; happy: number; hurt: number;
  // 04-ext (optional)
  washing?: boolean; extinguishing?: boolean; flickT?: number; chopClock?: number;
  held?: 'none' | 'light' | 'plate' | 'extinguisher'; speed?: number;
}
export interface ChefVisual extends Visual {
  setLook(look: ChefLook): void;
  setPose(pose: ChefPose, dt: number): void;
  /** Where the held item attaches (hands). */
  holdAnchor(): Object3D;
}

export type CustomerKind = 'adult' | 'child' | 'elder' | 'giant';
export interface CustomerVisual extends Visual {
  setMood(mood: 'waiting' | 'impatient' | 'happy' | 'angry'): void;
  update(dt: number, time: number): void;
  // 04-ext (optional)
  setFacing?(yaw: number): void; setWalk?(speed: number): void; celebrate?(): void;
  setPatience?(frac: number): void; setOrder?(recipeId: string | null): void;
}

export interface PropVisual extends Visual { update?(dt: number, time: number): void }

export interface StyleProfile {
  style: ArtStyle;
  /** Lighting defaults a diorama may override: hemisphere, sun, shadow radius, exposure. */
  lighting: { skyHex: number; groundHex: number; hemiIntensity: number; sunHex: number; sunIntensity: number; exposure: number; shadowRadius: number; shadowMapSize: number };
  outline: { enabled: boolean; widthPx: number; colorHex: number };
  /** True when food doneness is driven by the ramp shader (voxel) or a material uniform (smooth). Informational. */
  doneness: 'ramp' | 'uniform';
}

export interface AssetBackend {
  readonly style: ArtStyle;
  load(manifest: AssetManifest, onProgress?: (done: number, total: number) => void): Promise<void>;
  station(defId: string, footprint: { w: number; d: number }): StationVisual;
  item(defId: string): ItemVisual;
  meal(recipeId: string): ItemVisual;
  chef(look: ChefLook): ChefVisual;
  customer(kind: CustomerKind, seed: number): CustomerVisual;
  prop(id: string, params?: Record<string, number>): PropVisual;
  profile(): StyleProfile;
  dispose(): void;
}

export function createAssetBackend(style: ArtStyle): AssetBackend;       // packages/render/src/assets/index.ts
```

Files (target): `packages/render/src/assets/types.ts` (above), `assets/index.ts` (`createAssetBackend`), `assets/voxel/` (wraps today's `scenes/harbour/voxel.ts`, `items.ts`, `props.ts`, `chef.ts`, mesher), `assets/smooth/` (toon low-poly: procedural geometry and/or glTF, MeshToonMaterial-style gradient ramp, outline pass), `assets/placeholder.ts`, `assets/contract.test.ts` (runs the same test suite against both backends, `09 §9`).

### 10.3 Footprint contract

- A `StationVisual` fits inside the station's layout box (`w x d` from `layout.json`) and a height of at most 1.0 m for counters (items on top use `anchor('top')`). It may overhang by at most 0.1 m for decoration (awnings, hoods) above 1.2 m. It never extends below y = 0.
- Both backends place `anchor('top')` at the same relative position for a given `defId` (center of the top face). Item visuals are positioned there by the scene, not by the backend.
- `ItemVisual` held-size is at most 0.35 m on its longest side, at most 0.45 m for a container with contents. `ChefVisual` is 1.0-1.2 m tall including hat, radius at most 0.35 m (`CHEF_RADIUS`).
- Doneness: an `ItemVisual` shows `raw -> cooked -> charred` from `ItemLike.state` and `progress`. It must show `burnt` clearly distinct from `cooked` in both styles (also readable for color-blind players: a darker, smoky, textured look, not only a hue change).

### 10.4 Dioramas

Level scenery is behind a second small interface so levels 2-10 add files, not edits to a shared class. Today `HarbourScene` (`scenes/harbour/harbourScene.ts`, 741 lines) mixes stations, chefs, customers, gulls, water and effects for level 1 only.

```ts
export interface SceneView {                   // structural, RushView satisfies it
  phase: string;
  chefs: Array<{ slot: number; x: number; z: number; fx: number; fz: number; held: ItemLike | null; target: number; chopping: boolean; dashing: boolean }>;
  stations: Array<{ item: ItemLike | null }>;
  tickets: Array<{ leftTicks: number; totalTicks: number }>;
  timeLeftTicks: number;
  twist?: { kind: string; phase: number; ticksToNext: number; ticksInPhase: number; flags: number };
}
export interface SceneEvent { kind: string; slot?: number; station?: number }

export interface LevelRenderSpec {
  levelId: string;
  stations: Array<{ id: string; def: string; x: number; z: number; w: number; d: number; rot: number; enabled: boolean }>;
  queue: Array<[number, number]>;
  camera: CameraSpec;
  maxPlayers: number;
}

export interface LevelDiorama {
  /** Builds scenery, stations, customers, ambient life. Uses only the backend for visuals. */
  build(spec: LevelRenderSpec, backend: AssetBackend, host: DioramaHost): void;
  update(view: SceneView, dt: number, time: number): void;
  onEvent(ev: SceneEvent, view: SceneView | null): void;
  setGuide(stationIndex: number): void;                 // guide arrow, -1 = none
  anchor(stationIndex: number, height?: number): Vec3Like;
  /** Mean chef position for camera lean. */
  readonly centroid: { x: number; z: number };
  dispose(): void;
}
export type DioramaFactory = () => LevelDiorama;
export const DIORAMAS: Record<string /* levelId */, DioramaFactory>;   // packages/render/src/dioramas/index.ts
```

`DioramaHost` gives the diorama the three `Scene`, the `AssetBackend` and a `CameraRig`. `HarbourScene` becomes `dioramas/l01_kiosque.ts` implementing `LevelDiorama` (its logic is kept; only the constructor/wiring changes and it requests visuals through the backend). The client creates a diorama with `DIORAMAS[levelId]()`, never `new HarbourScene` directly. A level without a registered diorama falls back to a plain-floor diorama (`dioramas/fallback.ts`) so a new level is playable before it is dressed.

### 10.5 Camera

Fixed diorama camera per level (owner decision 4). `CameraSpec` is level data (`level.json`, `03`):

```ts
export interface CameraSpec {
  position: [number, number, number];    // meters
  target: [number, number, number];
  fov: number;                           // degrees (harbour: 38)
  /** Fraction (0..0.2) the focus leans toward the chef centroid, per axis. Harbour (as built): 0.12 on x, 0.1 on z. Scalar default 0.1 (applies to both axes). */
  lean: number;
  /** Multi-zone levels only: framings the camera eases between, chosen by centroid zone. */
  zones?: Array<{ zone: string; position: [number, number, number]; target: [number, number, number]; fov: number }>;
  // 04-ext (optional, defined in `04`)
  frame?: { x0: number; x1: number; z0: number; z1: number };   // rectangle that must stay visible
  minDistance?: number; maxDistance?: number;                    // defaults 15 / 40
  portrait?: { pitchDeg: number; margin: number; centerY: number };
}
```

`CameraRig` (`packages/render/src/cameraRig.ts`, replaces `HarbourApp`'s inline camera code and the Mossback-only `DioramaCamera`) applies the spec with critically damped smoothing. It does not follow a single chef. Details in `04`.

### 10.6 Consuming sim output

The client maps `RushUpdate` to render calls: `diorama.update(view, dt, time)` (the structural `SceneView` is satisfied by `RushView`), `diorama.onEvent(ev, view)` for each `RushEvent`. The render package never sees `RushSim`. HUD overlays use `diorama.anchor(i, h)` plus `app.project(x, y, z)` as in today's `rushClient.ts`.

## 11. Build, dev server, deployment

### 11.1 Dev

- `pnpm dev` runs Vite in `apps/client` on `http://127.0.0.1:5173` (default port) with COOP/COEP headers so `crossOriginIsolated` is true (needed for `SharedArrayBuffer`, which later render-state sharing may use; not required by the rush path today).
- Flags: `?dev=1` (dev tools such as `ff` fast-forward), `?debug=1` (overlay: tick, state hash, mode; target adds fps, sim ms, RTT, frame hash timeline), `?level=<n|id>` (skip title; target accepts 1..10 or a level id), `?mode=giant` (Mossback), `?art=voxel|smooth` (target).
- `.vox` assets are loaded as URLs with `import.meta.glob('../../../../content-src/vox/v1/{items,stations,meals}/*.vox', { query: '?url', import: 'default', eager: true })` (exists in `rushClient.ts`); target moves this into the voxel backend (`assets/voxel/`).

### 11.2 Build

- `pnpm build` = `pnpm -r build` -> `vite build` in `apps/client` -> `apps/client/dist`. Workers are emitted as ES modules (`worker.format: 'es'`).
- Code splitting (target): `main.ts` stays a tiny router. Chunks: `rush` (client, HUD, scenes of the current level loaded on demand via dynamic `import()` per diorama), `net` (loaded only when the player opens the online lobby), `mossback` (as today). Dioramas for levels not yet reached are never downloaded.

### 11.3 Deploy (Netlify)

- Separate Netlify site with **base directory `v2`** (`v2/netlify.toml`): `command = "pnpm install && pnpm build"`, `publish = "apps/client/dist"`.
- Headers on `/*`: `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp` (exists). Consequence (binding): every cross-origin subresource must be CORS-enabled or send `Cross-Origin-Resource-Policy: cross-origin`. Do not add third-party scripts, fonts or images. Self-host everything. WebSocket (Supabase Realtime) and WebRTC are not blocked by COEP.
- Target additions to `v2/netlify.toml` (from `07`):
  ```toml
  [functions]
    directory = "netlify/functions"
    node_bundler = "esbuild"
  [[redirects]]            # V1 at /classic is a separate build; exact wiring in spec/07
    from = "/classic/*"
    to = "/classic/:splat"
    status = 200
  ```
- Environment variables (names are final; values set in the Netlify UI, never committed): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (functions only), `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (client; exposed by design, protected by row-level security in `07`).
- Preview deploys per pull request are on. Production = default branch.
- No accounts or OAuth. Identity = nickname + device token + recovery codes (`07`).

### 11.4 CI

Defined in `09 §14`. Minimum gate on every push: install, `pnpm check`, build, Playwright smoke (`09 §8`).

## 12. Performance budgets

Targets are for a 2019 mid-range laptop with integrated GPU (desktop) and a 2021 mid-range Android phone (mobile, view-only UI scaled; gamepad play is desktop-first). All numbers are `Default (tunable)`; the CI perf tests (`09 §10`) assert the ones marked **CI**.

| Budget | Desktop | Mobile | Check |
|---|---|---|---|
| Frame rate in play | 60 fps | 30 fps locked acceptable | manual + `?debug=1` |
| Main-thread frame time (render + HUD + input) | p95 <= 10 ms | p95 <= 20 ms | `?debug=1`, Playwright trace |
| Sim step, 6 players, any level, mean | <= 0.5 ms | <= 1.5 ms | **CI** (`pnpm bench`, node, desktop budget x2 headroom) |
| Sim step p99 | <= 2 ms | <= 5 ms | **CI** |
| `RushView` clone per post (6 chefs, 40 stations, 6 tickets) | <= 16 KB | same | **CI** (JSON length proxy) |
| Worker -> main posts | <= 60/s | same | by design (one per wake) |
| Draw calls per frame in a level | <= 250 | <= 150 | **CI** (renderer.info in Playwright) |
| Triangles per frame | <= 400k | <= 200k | **CI** |
| Textures + geometry memory | <= 150 MB | <= 100 MB | manual |
| JS heap after 3 consecutive runs | grows <= 20 MB | <= 20 MB | Playwright (replay x3) |
| JS to title screen (gzip) | <= 700 KB (three.js included) | same | **CI** (size-limit style script) |
| Assets to first playable level (gzip) | <= 2.5 MB total | same | **CI** |
| Each further level's assets (gzip) | <= 3 MB | same | **CI** |
| Time from link to title | < 3 s p75 broadband | < 6 s | manual |
| Level load (replay to first frame) | <= 2 s | <= 4 s | Playwright |
| Network, online, per peer | <= 30 KB/s up, <= 30 KB/s down at 6 players | same | `09 §11` |
| Online input-to-visible-action latency (LAN) | <= 150 ms | n/a | `09 §11` |
| Memory (whole tab) | <= 600 MB | <= 350 MB | manual |

Rules:
- Voxel mesh budget per level: <= 250k triangles for the diorama after greedy meshing; stations and items use shared geometry (instancing where the backend can).
- No per-frame allocations in `update` loops of visuals (reuse vectors).
- The sim must not allocate per tick in hot paths beyond event arrays (reuse arrays; `view()` allocates, and is called once per worker wake).
- A level that exceeds a CI budget is not "done" (`00 §9`).

## 13. Current state vs target

| # | Area | Current state (in `v2/`) | Target | Where specified |
|---|---|---|---|---|
| 1 | Levels | 1 level (`l01_kiosque`), hand-written `rushLevels` array | 10 levels, `LEVEL_ORDER`, per-level folders | 7.2, `03`, `08` |
| 2 | Sim structure | `RushSim` one 913-line class | modules per concern, `StationBehavior` registry, `TwistHooks` registry, golden-hash-gated refactor | 7.4 |
| 3 | Twists, throw, wash, fire, harvest | none | `mechanics` flags + `TwistHooks` | 7.3-7.5, `02` |
| 4 | Input | click-to-walk (`click`, `clickKind`, `startWalk`), 3 buttons (`RB_A/X/B`) | click acts only in reach, `TooFar` event, `RB_T` throw, no walking | 7.8 |
| 5 | Players | `MAX_PLAYERS = 4`, 4 slot colors, buckets already cover 1-6 in level 1 data | 6 slots, 6 colors, spawns >= 6, validated bucket coverage | 7.7 |
| 6 | Worker protocol | `rush-init {seed, players, levelId, ff}`, `rush-input`, `rush` | `RunConfig`, `clock` (`realtime`/`driven`), `rush-advance`, snapshot, log, `rush-ready`, `rush-error`, edge latching | 8 |
| 7 | Determinism | lint rule on sim + shared; state hash every 30 ticks; chef kinematics are f64 | + golden hash files, snapshot/restore, replay verify, `SIM_VERSION`, `contentHash` | 5, 7.6, `09 §6` |
| 8 | Multiplayer | none; one client talks to one worker | `@ga/net` interfaces, `SimDriver`, `ViewSource`, `InputSink`, `RunSession`, `RunTransport`, `SignalingClient` | 9, `06` |
| 9 | Records | `localStorage` best per level and bucket (`pk.best.<level>.<bucket>`) | `RunLog` + server re-simulation in `@ga/records` | 9.5, `07` |
| 10 | Render | `HarbourApp`/`HarbourScene` hardcoded; voxel only; `SLOT_COLORS` x4 | `AssetBackend` (voxel default, smooth optional), `LevelDiorama` registry, `CameraRig`, `CameraSpec` per level | 10 |
| 11 | Client | `LEVEL_ID` constant; `s.def === 'fryer'` sizzle; one title screen with 2 cards | level select from `LEVEL_ORDER`, data-driven audio hooks, router for online lobby | `05` |
| 12 | Bot | fries-only, uses click-to-walk | generic recipe-driven bot driving the stick, runs on every level | 7.8, `09 §5` |
| 13 | Boundaries | by convention; `render` already independent of `sim` and `content` | enforced by eslint `no-restricted-imports` | 2.4 |
| 14 | Tests | sim/shared/content unit tests and a fries bot test; `vitest` only for `packages/**` | + client, e2e (Playwright), perf, network, per-level suites | `09` |
| 15 | Deploy | `netlify.toml` build + COOP/COEP headers | + functions, redirects, env vars, preview deploys | 11.3, `07` |
| 16 | Known level 1 bugs | first cutting board and first fryer unusable; bin refuses burnt items | fixed with regression tests | `09 §15` |

## 14. Shared interface names

These names are final. Other docs reuse them verbatim. Owner doc in parentheses; a name marked **(exists)** is already in the code.

**Sim and content types**
- `RushSim` (exists), `RushOptions` (exists), `stationInReach` (new, pure helper), `SlotResult`, `RushInput` (exists, reshaped 7.8), `RushEvent` (exists, extended), `RushView` (exists), `RushItem`, `ItemView`, `ChefView`, `StationView`, `TicketView` (exist), `RushPhase`, `Verb`, `RefuseReason` (exist), `RB_A`, `RB_X`, `RB_B` (exist), `RB_T` (new), `idleRushInput` (exists), `bucketForPlayers`, `streakMultiplier` (exist), `CHEF_RADIUS` (exists), `MAX_RUSH_PLAYERS`, `MAX_LOCAL_SEATS`
- `RunConfig`, `RunResult`, `RunLog`, `SIM_VERSION`, `contentHash` (7.6)
- `TwistKind`, `TwistHooks`, `TwistView`, `TWIST_HOOKS`, `StationBehavior`, `STATION_BEHAVIORS`, `SimCtx`, `RushState` (7.4)
- `encodeRushInput`, `decodeRushInput`, `INPUT_BYTES` (9.4)
- `LevelData`, `Layout`, `LayoutStation`, `ItemDef`, `StationDef`, `Recipe`, `BucketId` (exist, `@ga/content`), `RushLevel` (exists), `LEVEL_ORDER`, `levelIndex`, `rushLevelById` (exists), `rushLevels` (exists), `CameraSpec` (10.5)

**Worker protocol**
- `MainToWorker`, `WorkerToMain` (exist); messages `rush-init`, `rush-input`, `rush-advance`, `rush-snapshot-request`, `rush-restore`, `rush-log-request`, `rush-ready`, `rush`, `rush-snapshot`, `rush-log`, `rush-error`, `pause`, `stop`; `RushClock` = `'realtime' | 'driven'`

**Driver and session layer**
- `RushUpdate`, `Unsub`, `ViewSource`, `InputSink`, `SimDriver`, `WorkerSimDriver`, `InlineSimDriver`, `RunSession`, `createRunSession`, `LocalSeat`, `InputSourceDesc`

**Network layer (`@ga/net`)**
- `PeerId`, `RunTransport`, `SignalingClient`, `SignalPayload`, `RoomInfo`, `RoomMember`, `NetSession`, `allocateSlots`

**Records (`@ga/records`)**
- `verifyRun` (signature owned by `07`: `verifyRun(log: RunLog, claim: { score: number; hash: string }, opts?: VerifyOptions): Promise<VerifyResult>; see 07 §6`), `RunLog`, `RunResult`

**Render asset boundary (`@ga/render`)**
- `ArtStyle`, `AssetKind`, `AssetId`, `AssetEntry`, `AssetManifest`, `AssetBackend`, `createAssetBackend`, `Visual`, `ItemLike` (exists), `ItemVisual`, `StationVisual`, `StationVisualState`, `ChefLook`, `ChefPose`, `ChefVisual`, `CustomerKind`, `CustomerVisual`, `PropVisual`, `StyleProfile`
- `SceneView`, `SceneEvent`, `LevelRenderSpec`, `LevelDiorama`, `DioramaFactory`, `DIORAMAS`, `DioramaHost`, `CameraRig`, `Vec3Like` (exists in `camera.ts`)

**Existing render names that stay** (`@ga/render`): `HarbourApp`, `HarbourScene` (become the level 1 diorama internals), `SLOT_COLORS` (grows to 6), `parseVox`, `VoxModel`, `Palette`, `Vox`, `meshVolume`, `RenderApp` (Mossback), `DioramaCamera` (Mossback).
