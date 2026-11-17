# 09 · Testing and Quality

> How Pixel Kitchen V2 is tested: unit, sim, bot, determinism, content, screenshot/overflow, render-contract, perf, network and backend tests, playtest checklists, and CI.
> Sections 1-3 and the existing tests describe what exists in `v2/`; the rest is the target. Section 15 gives the known level 1 bugs with the regression tests that must be written.
> Every ticket in `10-backlog.md` names the tests from this doc it must add.

## Table of contents
1. Principles
2. Test layers and where tests live
3. Unit test conventions (write the failing test first)
4. Sim tests (existing and required)
5. Bot tests and star calibration
6. Determinism tests (golden hashes, replay, snapshot)
7. Content validation and per-level suites
8. Screenshot, overflow and smoke tests (Playwright)
9. Render tests and the asset backend contract
10. Performance tests
11. Network tests (simulated latency)
12. Backend and records tests
13. Playtest checklists
14. CI
15. Known bugs and their regression tests
16. Current state vs target

---

## 1. Principles

1. `pnpm check` (typecheck + lint + test + validate) is the gate and must stay under 90 s on a laptop. Slow suites (e2e, perf, long bot runs) have their own commands and CI jobs.
2. Tests never use wall time, `Math.random` or the network. The sim is driven tick by tick (`RushSim.step`, or `InlineSimDriver`, `01 §9.2`).
3. A bug fix starts with a failing test. A new rule ships with tests for the rule, its edge cases and its events.
4. Never weaken a test, a threshold or a lint rule to get green. If a golden hash changes, the commit message explains which rule changed (`01 §7.6` `SIM_VERSION`).
5. Fixed seeds only. Test seeds: `1`, `42`, `1337`, `0xC0FFEE` (named `SEEDS`).

## 2. Test layers and where tests live

| Layer | Tool | Location | Command | In `pnpm check`? |
|---|---|---|---|---|
| Unit (shared, content, sim, net, records) | Vitest, node | `packages/*/src/**/*.test.ts` (exists) | `pnpm test` | yes |
| Client logic (input mapping, strings, HUD formatting) | Vitest, node (no DOM) | `apps/client/src/**/*.test.ts` (target: add to `vitest.config.ts` include) | `pnpm test` | yes |
| Bot / star calibration | Vitest + script | `packages/sim/src/rush/*.test.ts`, `packages/sim/scripts/stars.ts` | `pnpm test`, `pnpm stars` | tests yes, script no |
| Determinism (golden, replay, snapshot) | Vitest | `packages/sim/src/rush/determinism.test.ts`, goldens in `packages/sim/src/rush/golden/*.json` | `pnpm test` | yes |
| Content | `pnpm validate` + Vitest | `packages/content/src/validate.ts`, `content.test.ts`, `levels.test.ts` | `pnpm validate` | yes |
| Render contract | Vitest (no GPU) | `packages/render/src/assets/contract.test.ts` | `pnpm test` | yes |
| Network | Vitest, in-memory transport | `packages/net/src/**/*.test.ts` | `pnpm test` | yes |
| Screenshot, overflow, smoke | Playwright (Chromium) | `v2/e2e/*.spec.ts` | `pnpm e2e` | no (CI job) |
| Perf | Vitest bench + Playwright | `packages/sim/src/rush/perf.test.ts`, `v2/e2e/perf.spec.ts` | `pnpm bench`, `pnpm e2e --grep perf` | sim perf yes (loose), rest no |

Target setup tickets: add `@playwright/test` as a root devDependency (the only dependency added by this doc), `v2/playwright.config.ts` (Chromium only, `webServer: pnpm dev`, viewports in 8.2), scripts `e2e`, `bench`, `stars` in `v2/package.json`, and widen `vitest.config.ts` `include` to `['packages/**/src/**/*.test.ts', 'apps/**/src/**/*.test.ts']`.

## 3. Unit test conventions

- File next to the code: `foo.ts` -> `foo.test.ts`. Name tests as behavior: `it('serves the ticket with the least time left')`.
- Sim tests use the helpers of `RushSim` (`giveItem`, `putItem`, `placeChef`, `stationIndex`) and a `run(sim, ticks, input?)` helper; assert on events and `view()`, not on private fields.
- One concept per test; no shared mutable state between tests (build a fresh `RushSim` each time).
- Time in tests is ticks: use `secs(n) = n * SIM_HZ`.
- Property tests (codec round trip, snapshot round trip) use a seeded `Prng` from `@ga/shared`, 200 cases, never `Math.random`.
- Coverage is not a gate; the required test list per area (below) is.
- Bug fix: commit 1 = failing test (may be marked in the message), commit 2 = fix.

## 4. Sim tests (`packages/sim/src/rush/rush.test.ts`, exists, 411 lines)

### 4.1 Existing groups (keep; adapt where owner decisions change behavior)

| Group | What it covers today |
|---|---|
| items, chop, cook, burn | chop 1.6 s while X held; progress kept on release; cook 5 s, warning, burn after 6 s; taken item pauses; processors refuse wrong items |
| plating rules | plate accepts cooked fries once, refuses raw/burnt/duplicates; two plating routes; bin empties a plate but keeps it; dispensers give only to empty hands |
| serving and scoring | `100 + min(30, secondsLeft/2)` at x1; empty plate or burnt item = -20, kept in hand, streak reset; loose ingredient refused; streak steps 3/6/10; least-time ticket first; expiry -50; end at 180 s with stars |
| ticket pacing | same seed same sequence; safe opening (ticket 2 after 25 s or first serve); never above bucket max; buckets and optional stations |
| movement | counters block; chefs collide; click-to-walk; right-click walk; stick cancels walk; dash distance and 0.6 s cooldown; targeting in front |
| bot | full run; hash identical across two runs; solo and duo clear 3 stars |

### 4.2 Changes required by owner decisions

- Remove the tests `click-to-walk reaches a far station and interacts on arrival`, `a right-click walk goes there without interacting...`, `stick input cancels a click-to-walk` (the feature is removed, `01 §7.8`).
- Add: `a click on a station within reach acts like A`; `a click on a station out of reach does nothing and emits TooFar`; `a click never moves the chef`; `click acts only when clickSeq changes`.
- Add for each new mechanic, in the ticket that introduces it: throw (item flies, lands on a counter/plate/pass, is lost on floor or water), wash (dirty plate returns), fire (starts, spreads, extinguish with held X), planter regrow, conveyor, dumbwaiter, each `TwistHooks` kind (`phase` sequence by tick, telegraph >= 60 ticks before effect, `isBlocked`/`stationUsable` results at exact ticks).
- Every `StationBehavior` has tests for `accepts`, `interact` (every verb and every refusal reason) and `update`.

### 4.3 Station smoke test (generic, all levels)

`packages/sim/src/rush/stations.test.ts`: for every level in `rushLevels`, for every bucket in `solo|duo|squad|party`, for every station in the layout: construct `RushSim` with that bucket's player count, then drive a scripted interaction that proves the station does its job by its **effective** def (dispenser gives its item; board chops; auto processor cooks and burns; bin trashes and accepts burnt items; pass accepts a matching plate; counter holds an item; disabled optional station behaves as a counter and the test says so). A station that does nothing for its def fails the test. This test would have caught the level 1 bugs (section 15).

## 5. Bot tests and star calibration

### 5.1 Generic bot (target, replaces the fries-only `RushBot`)

`packages/sim/src/rush/bot.ts` exports:

```ts
export type BotRole = 'all' | 'prep' | 'serve';
export class RushBot {
  constructor(slot: number, role?: BotRole);
  /** One input frame for this tick. Uses only the view and the stick/buttons a human has. No click-to-walk. */
  act(view: RushView, layout: Layout, level: LevelData): RushInput;
}
export function planRecipe(recipeId: string): Step[];   // from ItemDef.chop/cook chains and Recipe.components, no level-specific code
```

The bot builds a plan per ticket from the content data (item chains, station defs), walks with the stick along a path computed on its own `WalkGrid` copy, and uses A and X like a human. Roles split work for 2+ bots (`prep`: ingredients to components; `serve`: plates, assembly, pass). It must not read private sim state.

### 5.2 Required bot tests (per level, in `packages/sim/src/rush/bot.test.ts`)

For each level id in `LEVEL_ORDER` that has data:
1. `bot completes at least 3 tickets solo` (smoke, 180 s of ticks, seed 42).
2. `bot hash identical across two runs` (determinism).
3. `solo, duo, squad, party bots reach their 3-star threshold` once the level's stars are calibrated (thresholds 5.3).
4. `no ticket type is unreachable`: over a 600 s run per recipe in the level, the bot serves each recipe at least once (proves every recipe chain is physically doable, including at 6 players: no blocked corridor).

Runtime budget: whole file under 40 s (bots run the sim at full speed, not real time).

### 5.3 Star calibration rule

3 stars = 75 % of the bot max score for that bucket, 2 stars = 55 %, 1 star = 30 %, rounded to the nearest 10 (`design/06 §5`). The bot max is the mean of seeds `SEEDS` (4 runs). The values live in `level.json`; the test asserts `starThresholds` are within 5 % of these numbers computed live (so a rule change that shifts scoring forces a recalibration).

### 5.4 `pnpm stars`

`packages/sim/scripts/stars.ts` (run with `tsx`): for a level id (or all), runs the bots for each bucket, prints a table of mean/min/max score and the suggested `stars` array in JSON, ready to paste. It never edits files.

## 6. Determinism tests (`packages/sim/src/rush/determinism.test.ts`)

### 6.1 Double run
For every level, bucket and seed in `SEEDS`: run a scripted input stream (bot or fixed pattern) for the full duration twice in fresh `RushSim`s; the per-30-tick hashes and the final `RunResult` are identical.

### 6.2 Golden hashes
`packages/sim/src/rush/golden/<levelId>.<bucket>.json` stores `{ simVersion, contentHash, seed, hashes: { "30": "...", "300": "...", "end": "..." }, score }` for a fixed bot run. The test recomputes and compares. A mismatch fails with a message: "Rules changed. If intended: bump SIM_VERSION and run `pnpm vitest run -u determinism` (writes goldens), and say why in the commit." The golden for `l01_kiosque` exists before the first refactor ticket and is the gate for `01 §7.4`.

### 6.3 Replay
`InlineSimDriver` runs a `RunLog` recorded from a bot run; replaying the log gives the same final hash and score (this is the server verification path, `01 §9.5`). Also: truncating the log by one frame changes the hash; changing one input changes the hash or score.

### 6.4 Snapshot and state coverage
- `restore(snapshot())` at ticks 0, 1, 90, mid-run, end, then 300 more steps equals the uninterrupted run (hash equal).
- Field coverage: a test enumerates all state fields exposed by `RushState` (`01 §7.4`), perturbs each in a snapshot buffer copy, restores, and asserts `stateHash()` differs. A field absent from the hash fails.
- Property: `decodeRushInput(encode(x))` equals `x` for 200 random valid inputs.

### 6.5 Hygiene
- `view()` has no side effects: calling it 0, 1 or 5 times per tick yields identical hashes.
- Input independence: invalid inputs (NaN, out-of-range stick, bad `click`) never throw and are clamped.
- Static check (Vitest reading source files): no `Math.random`, `Date`, `performance`, banned `Math.*` in `packages/sim/src` and `packages/shared/src` outside `worker.ts` and tests (belt and braces next to ESLint), and no module-level `let` in `packages/sim/src/rush/` (except `golden/`).
- Cross-engine: the golden test also runs in CI under Node LTS and Node current (`09 §14`) to catch engine differences.

## 7. Content validation and per-level suites

`pnpm validate` (`packages/content/src/validate.ts`) already schema-checks and runs `rushCrossCheck()`. Add (target) to `rushCrossCheck` / `levels.test.ts`, for every level:

| # | Check |
|---|---|
| 1 | `level.json` and `layout.json` parse with their zod schemas |
| 2 | folder id is in `LEVEL_ORDER` and vice versa |
| 3 | every recipe in `level.recipes` exists; every item/station referenced exists |
| 4 | every recipe is obtainable: each component is reachable by a chain from a dispenser present in the layout (graph check over `ItemDef.chop/cook` and stations in the layout, in every bucket) |
| 5 | there is exactly one `pass`, at least one `bin`, and a `plates` (or equivalent container dispenser) when a recipe needs a container |
| 6 | `buckets` ranges contiguous and cover exactly 1..6; `stars` ascending for all four buckets |
| 7 | `layout.spawns.length >= 6`; spawns and station boxes inside `bounds`; no spawn inside a station box |
| 8 | station boxes do not overlap; at 6 players every station is reachable from every spawn on the `WalkGrid` (no blocked corridor; corridor width >= 2 x `CHEF_RADIUS` + margin) in every bucket (optional stations enabled or counters) |
| 9 | stations <= 254 (codec limit); station ids unique |
| 10 | `twist.kind` is a known `TwistKind`; `twist.params` has all keys its hook requires |
| 11 | `mechanics` flags consistent: a level with a `sink` station has `wash: true`; with a throw-dependent twist has `throw: true` |
| 12 | `camera` present; target inside bounds (zones too) |
| 13 | nameKey and every referenced UI string key exist in FR and EN (`strings.ts` key check) |
| 14 | every asset id used (`station/<def>`, `item/<def>`, `meal/<recipe>`) exists in the `AssetManifest` for both backends (or has a declared placeholder) |
| 15 | `contentHash(levelId)` is stable (computed twice equal) |

Per-level suite file `packages/sim/src/rush/levels/<levelId>.test.ts` (created by the level's ticket): the twist's exact timeline at given ticks; the new mechanic's first interaction; the optional-station buckets; bot 3-star check; golden hash.

## 8. Screenshot, overflow and smoke tests (Playwright)

### 8.1 Setup
`v2/e2e/*.spec.ts`; Chromium with `--use-gl=swiftshader` (software WebGL, works headless in CI). The dev server runs with `?dev=1` where `ff` fast-forward is needed. Output of kept screenshots: `v2/docs/shots/<spec>/<name>-<w>x<h>-<lang>.png` (not committed by CI; committed only when a ticket asks).

### 8.2 Matrix

| Dimension | Values |
|---|---|
| Viewport | 1280x720, 1920x1080, 390x844 (portrait phone), 844x390 (landscape phone) |
| Language | `fr`, `en` (set `localStorage['pk.lang']`, or `navigator.language` override) |
| Screens | title, level select, level intro, play (mid-service with 2 tickets and the guide arrow), pause, results, lobby (online), settings |
| Levels | every level that has data: play screen at `ff=600` ticks |

### 8.3 Overflow check (every screen, every combination)

```ts
export async function assertNoOverflow(page: Page): Promise<void> {
  const bad = await page.evaluate(() => {
    const out: string[] = [];
    const vw = innerWidth, vh = innerHeight;
    for (const el of document.querySelectorAll<HTMLElement>('body *')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || el.offsetParent === null && cs.position !== 'fixed') continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const clipsText = el.scrollWidth > el.clientWidth + 1 && cs.overflowX !== 'visible';
      const outside = r.right > vw + 1 || r.bottom > vh + 1 || r.left < -1 || r.top < -1;
      const textTruncated = el.children.length === 0 && el.textContent!.trim() !== '' && el.scrollWidth > el.clientWidth + 1;
      if (clipsText || textTruncated || (outside && !el.closest('[data-allow-offscreen]'))) out.push(`${el.tagName}.${el.className}: "${el.textContent!.trim().slice(0, 40)}"`);
    }
    return out;
  });
  expect(bad, bad.join('\n')).toEqual([]);
}
```

HUD elements that are meant to be off-screen carry `data-allow-offscreen`. Also assert no horizontal page scroll (`document.documentElement.scrollWidth <= innerWidth`).

### 8.4 Smoke tests
1. App loads at `/`, title visible, no console errors, no failed network requests (except allowed list), `crossOriginIsolated === true`.
2. `?mode=giant` loads the Mossback demo, reaches its first screen with no console errors (guards golden rule "never break Mossback").
3. For each level with data: title -> select -> intro -> play; after `ff`, `window.__pk.view.tick` advances; no console errors; `renderer.info.render.calls` within budget (`01 §12`).
4. Gamepad: inject a fake `navigator.getGamepads` (Playwright init script) with A pressed; assert the join/start flow works; stick moves a chef (position changes in `__pk.view`).
5. Mouse: click on a station within reach triggers an interaction event; click out of reach shows the "trop loin" hint and leaves the chef position unchanged (regression for owner decision 5).
6. Language switch updates every visible string (no raw keys: assert no text matches `/^[a-z]+(\.[a-z0-9_]+)+$/`).
7. Art style: run smoke 3 with `?art=smooth` for levels that have a smooth backend.

`window.__pk` is a test hook exposed only when `?dev=1` (view, tick, hash, level, mode); it is read-only.

### 8.5 Visual regression
Screenshots of the play screen per level at 1280x720 are compared to stored baselines in `v2/e2e/baselines/` with `toHaveScreenshot({ maxDiffPixelRatio: 0.02 })`. Baselines are per backend and refreshed deliberately (`pnpm e2e -u`) in tickets that change visuals. The camera is fixed per level, so these are stable (water and ambient animation are frozen by `?dev=1&freeze=1`, which sets the render clock to 0).

## 9. Render tests and the asset backend contract

`packages/render/src/assets/contract.test.ts` exports `assetBackendContract(name, factory)` and runs it for `voxel` and `smooth` (no GPU: three.js scene graph only, `WebGLRenderer` is not created). For every `AssetId` in the manifest each backend must:
1. create a visual without throwing (a missing asset returns a placeholder and does not throw);
2. station visuals fit the footprint contract (`01 §10.3`): bounding box inside `w x d` (+0.1 overhang above 1.2 m), height <= 1.0 m below the decoration line, `min.y >= 0`;
3. item visuals have longest side <= 0.35 m (0.45 m with contents); `set()` with states `raw`, `cooking`, `cooked`, `burning`, `burnt` changes some material parameter or geometry (burnt differs from cooked);
4. chef visual height 1.0-1.2 m, radius <= 0.35 m, `setPose` for every pose in `04` runs without NaN transforms;
5. `anchor('top')` agrees between backends within 0.05 m for the same station def;
6. `dispose()` releases geometries and materials (counted via three `dispose` spies); creating and disposing 100 visuals leaves the count of live geometries unchanged.

Greedy mesher unit tests (`greedyMesher.test.ts`, exists) stay. Diorama tests: `DIORAMAS[levelId]().build(...)` on a stub backend does not throw, registers its stations (count equals layout stations), and `update(view)` with a view from `InlineSimDriver` at several ticks does not throw.

## 10. Performance tests

### 10.1 Sim (`packages/sim/src/rush/perf.test.ts`, runs in `pnpm test` with loose bounds, and `pnpm bench` with real numbers)
For each level at `party` (6 players), run a bot for 180 s of ticks; measure per-step time with `process.hrtime.bigint()` (allowed in tests). Assert mean <= 1 ms and p99 <= 4 ms in `pnpm test` (2x headroom over the `01 §12` budgets for slow CI machines); `pnpm bench` prints the true numbers and fails at the exact budget values. Also assert `JSON.stringify(view()).length <= 16 KB`.

### 10.2 Browser (`v2/e2e/perf.spec.ts`, CI job)
At each level's play screen after `ff=1800`: collect `renderer.info` (calls, triangles, geometries, textures) via `__pk`, and measure 300 frames with `requestAnimationFrame` timestamps. Assert draw calls <= 250, triangles <= 400k, textures <= budget; frame p95 is **reported** (software GL in CI is slow) and asserted only on the `perf` runner label if one exists. Memory: replay a level 3 times (`ff` reset), assert JS heap growth <= 20 MB (`performance.memory` in Chromium).

### 10.3 Bundle size
`pnpm build` then a script `v2/scripts/size.mjs` reads `apps/client/dist/assets/*`, gzips, and asserts: entry JS to title <= 700 KB; assets of any single level <= 3 MB; first level total <= 2.5 MB (`01 §12`). Fails CI on regression.

## 11. Network tests (simulated latency)

All network tests run in Node with no browser, using in-memory transports and `InlineSimDriver`.

### 11.1 Lossy transport

```ts
export interface LinkProfile { latencyMs: number; jitterMs: number; loss: number /* 0..1, unreliable channel only */; reorder: number /* 0..1 */ }
export class LossyHub {
  constructor(seed: number);                                   // seeded Prng: deterministic
  transport(peerId: PeerId, link: LinkProfile): RunTransport;  // implements @ga/net RunTransport
  advance(ms: number): void;                                   // virtual clock: delivers due messages in order of (deliverAt, seq)
}
```

Time is virtual (`advance`), so tests are fast and reproducible.

### 11.2 Scenarios (each is a test; N = peers, one slot each unless noted)

| # | Scenario | Link profile | Assertion |
|---|---|---|---|
| 1 | 2 peers, LAN | 5 ms, 0 jitter, 0 loss | identical hashes at every 30 ticks for a full 180 s run |
| 2 | 2 peers, typical | 60 ms, 20 jitter, 1 % loss | same; no stall longer than the input-delay window |
| 3 | 6 peers (host + 5 guests) | 80 ms, 30 jitter, 2 % loss | same; all six final results equal |
| 4 | Mixed seats | peer A 3 local slots, peer B 3 local slots | slot allocation matches `allocateSlots`; hashes equal |
| 5 | Bad link | 250 ms, 100 jitter, 10 % loss, 5 % reorder | run completes, hashes equal; HUD status `lagging` raised |
| 6 | Late join | peer joins at tick 900 via snapshot | after restore hashes equal for the rest of the run |
| 7 | Leave | guest drops at tick 600 | others continue; leaver's slot idle; hashes equal among remaining |
| 8 | Desync injection | flip one byte in a guest's state at tick 450 | `onDesync` fires within 2 s of virtual time with the right tick |
| 9 | Host loss | host drops | behavior as `06` specifies (migration or clean end); no hang |
| 10 | Bandwidth | 6 peers | counted bytes per peer <= 30 KB/s over the run (`01 §12`) |

Exact expectations that depend on the netcode choice are completed in `06`; the scenario list and the harness are fixed here.

### 11.3 Manual network check
Chrome DevTools throttling profile "Fast 3G" and a real second device on the same Wi-Fi, 3 minutes, level 1: record any visible rubber-banding or stall in the playtest sheet (13.3).

## 12. Backend and records tests

- `@ga/records`: `verifyRun` accepts a valid log from the bot; rejects: altered score claim, altered input frame, wrong `simVersion`, wrong `contentHash`, truncated log, extra frames after `TimeUp`, impossible `players` (0, 7), unknown level.
- Netlify functions: run with Vitest by calling the handler with fake events and an in-memory store behind the same interface as Supabase: valid submission stores a row; duplicate submission is idempotent; bad token = 401; rate limit trips at the limit in `07`; oversize body = 413; nickname filter rejects listed words.
- Schema: SQL migrations apply on an empty Postgres in CI (`supabase db lint` or a plain `psql` job) and row-level-security tests assert an anonymous key cannot write rows directly.
- No test hits the real Supabase project.

## 13. Playtest checklists

Run before declaring a level or feature "playable". Record results in the ticket's final report. Each item is pass/fail.

### 13.1 Every level (desktop, gamepad)
- [ ] Recognizable without the UI (screenshot test passes, place is obvious).
- [ ] A new player with no instructions serves a first ticket within 60 s using only prompts and the guide arrow.
- [ ] One new mechanic at most; introduced safely (nothing punishing in the first 30 s).
- [ ] The twist is telegraphed >= 2 s before it affects play, and visibly changes the best route (bot and human runs differ).
- [ ] Works at 1, 2, 4 and 6 players: no blocked corridor, optional stations present, pacing feels fair (watch ticket pile-up).
- [ ] Reach and targeting: no station feels "unclickable"; the target glow is correct; mouse out of reach shows the hint.
- [ ] Burnt items go in the bin; the bin accepts them (section 15).
- [ ] Every station of the level works as its sign suggests (first and last of each type).
- [ ] Results: score, stars and best are right; Replay starts instantly with A.
- [ ] No text overflow in FR and EN at 1280x720 and 390x844.
- [ ] Frame rate >= 55 fps on the reference laptop; no hitch when a ticket spawns or a dish is served.
- [ ] Audio: every verb has a sound; ambience present and quiet; mute works.

### 13.2 Input devices
- [ ] Gamepad only (Xbox-style and PlayStation-style): join, move, A/X/Throw/Dash, pause, menu navigation, results, replay, all without keyboard or mouse.
- [ ] Keyboard only; mouse + keyboard (click interacts in reach only).
- [ ] 4 local players: 4 gamepads, or 1 keyboard + 3 pads; unplug and replug a pad mid-run does not crash or desync.
- [ ] Glyphs follow the last used device.

### 13.3 Online (6 players)
- [ ] Create a room, share the link, 5 others join from different networks; start; finish a level.
- [ ] Mixed: 2 machines with 3 local players each.
- [ ] A guest closes the tab mid-run: others continue.
- [ ] Join in progress works (if `06` allows it) and the joiner sees the correct state.
- [ ] Record submission after the run succeeds; the leaderboard shows it; a tampered request is rejected.
- [ ] 3 minutes at simulated 150 ms RTT stays playable.

### 13.4 Accessibility
- [ ] Color-blind check (deuteranopia and protanopia filters): cooked vs burnt, ticket timer bars and station states are distinguishable without hue alone.
- [ ] Text readable at 1280x720 on a TV distance equivalent (body >= 18 px, tickets >= 20 px).
- [ ] Reduced motion setting removes screen shake and flashing.
- [ ] No tutorial screen blocks input anywhere.

## 14. CI

### 14.1 GitHub Actions (`/.github/workflows/v2-ci.yml`, target; none exists yet)

Triggers: push and pull request touching `v2/**` or `docs/v2/spec/**`. Working directory `v2`. Node 22 LTS (matrix adds the current Node for the determinism job). pnpm via `pnpm/action-setup` with the version from `packageManager`.

| Job | Steps | Time budget |
|---|---|---|
| `check` | `pnpm install --frozen-lockfile`, `pnpm check` | < 5 min |
| `build` | `pnpm build`, `node scripts/size.mjs` | < 5 min |
| `determinism` (Node LTS and current) | `pnpm vitest run packages/sim/src/rush/determinism` | < 5 min |
| `e2e` | install Chromium, `pnpm e2e` (smoke, overflow, visual), upload `playwright-report` and screenshots as artifacts | < 15 min |
| `perf` (nightly and on label `perf`) | `pnpm bench`, `pnpm e2e --grep perf` | < 20 min |
| `stars` (manual dispatch) | `pnpm stars` for chosen levels, uploads the table | < 15 min |

`check`, `build`, `determinism`, `e2e` are required status checks for merging. Netlify deploy previews run on every pull request; the Playwright smoke can also be pointed at the preview URL (`BASE_URL` env) as a post-deploy check.

### 14.2 Local pre-push routine
`pnpm check` then, if render/client/levels were touched, `pnpm e2e --grep smoke`.

## 15. Known bugs and their regression tests

Owner decision 10 lists three bugs in the level 1 build. They go in the backlog; the tests below must be written first.

| # | Bug | Probable root cause (verified in the data) | Regression tests |
|---|---|---|---|
| 1 | The first cutting board does not work | In `packages/content/src/data/rush/levels/l01_kiosque/layout.json` the first board in the list is `board_2` with `"optional": "squad"`, placed at x = -2.5, the one next to the crate. In `solo` and `duo` games `RushSim` turns disabled optional stations into plain `counter`s (`def = enabled ? ls.def : 'counter'`), so the board the player meets first is a counter. The board at x = -1.5 (`board_1`) works. | (a) `stations.test.ts` (4.3) fails for `board_2` as a board in solo/duo unless the test states it is a counter; (b) new test `disabled optional stations are not rendered or highlighted as their def` (view `StationView.enabled === false`, render shows a counter model); (c) layout fix: optional stations must not sit between the crate and the first working station: reorder positions so the first board and first fryer on the route are always enabled; add content check "the first station of each processor def along the spawn-to-pass route is enabled in every bucket" (7, check 8 extension) |
| 2 | The first fryer does not work | Same cause: `fryer_3` (`optional: "squad"`, x = -0.5) is the first fryer along the line; in solo/duo it is a counter. `fryer_1` (x = 0.5) works. | same tests, for fryers |
| 3 | The bin does not accept burnt items | Not reproduced by reading the sim: in `RushSim.interact` the `bin` branch trashes any item in hand (a container is emptied and kept), burnt or not, and `accepts()` is not consulted. The bug is not reproduced in the sim; the three probable causes (`02 §19` B3, in order) are: (1) targeting at the `plates`/`bin` seam (`findTarget` tie goes to the lower index), (2) the UX trap of a plate in hand with a burnt item in the fryer, (3) mouse picking (`pickStation`) resolving to a neighbour. The ticket starts by reproducing it in the browser and in a sim test. | `the bin accepts a burnt item in hand` (event `Trashed`, hand empty); `a burnt item can be taken out of a fryer`; `a burnt item taken out of a fryer goes straight into the bin` (full chain, via stick-driven chef); `the bin accepts a plate holding a burnt component, empties it and keeps the plate`; e2e: hold a burnt item, click the bin in reach, item is gone; stations smoke test (4.3) bin case includes a burnt item |

For bug 3, whichever layer holds the cause, the first commit is the failing test in that layer.

Extra bug B2 (`02 §5.2` rule 4, `02 §19`): an auto-station output with its own `cook` was left `cooked` and refused by the next station, breaking chained cooking on levels 2-10. Regression tests: egg -> mixer -> stove -> `cooked_omelette`; onion -> board -> coating -> fryer; the per-level suites (§8) include one chained route per level that has one.

Also required by the owner decision on controls: remove click-to-walk (4.2) and the matching client code in `rushInput.ts` (`pickStation` path), with the e2e smoke 5 as acceptance.

## 16. Current state vs target

| Area | Today | Target |
|---|---|---|
| Unit tests | `shared.test.ts`, `content.test.ts`, `sim.test.ts` and `kitchen/food` tests (Mossback), `rush/rush.test.ts` (about 40 tests), `greedyMesher.test.ts` | + the tests in sections 4-12 |
| Vitest include | `packages/**/src/**/*.test.ts` only | + `apps/**/src/**/*.test.ts` |
| Bot | fries-only, click-to-walk; solo/duo 3-star test; hash twice | generic, stick-driven, every level and bucket |
| Determinism | hash equal across two bot runs of level 1 | goldens, replay via `InlineSimDriver`, snapshot round trip, field coverage, static source scan, two Node versions |
| Content checks | `rushCrossCheck()` (ids, pass exists, stars ascending) | the 15 checks of section 7 |
| Screenshots | manual Playwright runs saved to `v2/docs/p2/` (Playwright not in the repo) | `@playwright/test` in repo, matrix of section 8.2, overflow and smoke automated |
| Perf | none beyond the Mossback `perf.test.ts` | sim bench, browser counters, bundle size gate |
| Network | none | `LossyHub` and 10 scenarios |
| Backend | none | records and function tests |
| CI | none in the repo | `v2-ci.yml` with required checks |
| Known bugs | 3 open (section 15) | fixed with regression tests |
