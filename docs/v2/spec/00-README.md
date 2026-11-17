# Pixel Kitchen V2 Implementation Spec: README

> This is the entry point of `docs/v2/spec/`, the implementation reference for Pixel Kitchen V2.
> It tells a coding agent which docs to read for which task, defines the vocabulary, the golden rules, the definition of done, and the commit and branch conventions.
> Spec docs 01-09 describe what exists and what to build; `10-backlog.md` cuts the work into tickets.

## Table of contents
1. What this spec is
2. Document index
3. Reading order per task type
4. Binding owner decisions
5. Glossary
6. Golden rules for coding agents
7. Repository map (one screen)
8. Commands
9. Definition of done
10. Commit, branch and PR conventions
11. How to change the spec
12. Current state vs target

---

## 1. What this spec is

Pixel Kitchen V2 is a browser co-op cooking game. Players cook fixed recipe tickets against a clock (an order rush, Overcooked-style as a genre reference), serve as many as possible in a fixed time, and replay to beat records. There is no game over.

- Code lives in `v2/` (pnpm workspace). V1 (repo root `src/`, `public/`, `netlify/`, `supabase/`) is the previous game; it stays untouched and will be served at `/classic`.
- Today `v2/` contains: level 1 "Le Kiosque du Port" (the order rush, the aesthetic reference), a mini-game "Le petit-déjeuner de Mossback" (the voxel-food demo, must keep working), and the packages underneath.
- The target is: 10 handcrafted levels, up to 6 players online (P2P), up to 4 local players, server-verified records.

The older design docs `docs/v2/01-16` explain the *why*. This spec explains the *what and how*. **Precedence: owner decisions (section 4) > spec > design docs.**

Who reads this: autonomous coding agents, including fast models, with no memory of earlier sessions. So every spec doc gives exact paths, exact types, exact numbers and acceptance criteria. If you find yourself having to make a design decision that the spec does not make, stop, choose the most conservative default, write it down in your final report, and flag it (section 11).

## 2. Document index

| File | Content | Read when |
|---|---|---|
| `00-README.md` | this file | always, first |
| `01-architecture.md` | workspace layout, package boundaries, threads, data flow, protocol, determinism, generalizing the sim to N levels, multiplayer boundary, asset abstraction boundary, build, deploy, budgets, **shared interface names** | always, second |
| `02-simulation.md` | the rush sim in full: tick order, state machines, interactions, scoring, API, state hash, replay format | touching `packages/sim` |
| `03-content.md` | zod schemas, item/station/recipe catalog, level formats, how to add content | touching `packages/content` or adding a level/recipe |
| `04-rendering-and-art.md` | render architecture, asset abstraction, chef rig, stations, VFX, camera, art style guide | touching `packages/render` or visuals |
| `05-client-ui-input-audio.md` | router, screens, HUD, input mapping, prompts, strings/i18n, audio, settings, accessibility | touching `apps/client` |
| `06-multiplayer.md` | rooms, signaling, WebRTC, netcode, join/leave, mixed local+online, voice | touching net code |
| `07-backend-and-records.md` | Supabase schema, Netlify functions, identity, run submission, verification, leaderboards, `/classic` | touching backend |
| `08-levels.md` | level template and the spec of all 10 levels | building a level |
| `09-testing-and-quality.md` | unit, bot, determinism, screenshot, perf, network tests, playtest checklists, CI | writing or running tests; every ticket |
| `10-backlog.md` | ordered tickets, one agent session each | picking work |
| `_authoring-brief.md` | the brief the spec authors followed (owner decisions in full) | reference only |

Section references use the form `spec/02 §4.3` (doc 02, section 4.3). Design-doc references use `design/05 §1` (= `docs/v2/05-interactions-and-cooking.md` section 1).

## 3. Reading order per task type

Always read `v2/AGENTS.md`, this file, and `01-architecture.md` §1-§6 first. Then:

| Task type | Read next (in order) |
|---|---|
| Sim change (new verb, station, rule) | `02` (whole), `03` §item/station schemas, `09` §4-§6 |
| New or changed level | `08` (template + that level), `03` (level formats, how-to), `02` §twist hooks, `04` §camera + diorama, `09` §7, §13 |
| New recipe / item / station content | `03` (catalog, how-to), `02` §interaction table, `04` §station and item visuals, `09` §7 |
| Rendering, art, asset backend | `04` (whole), `01` §10 (asset boundary), `09` §8-§9 |
| HUD, screens, input, strings, audio | `05` (whole), `03` §strings keys if any, `09` §8 |
| Multiplayer, rooms, netcode | `06` (whole), `01` §9 (boundary), `02` §sim API + state hash + replay, `09` §11 |
| Backend, records, leaderboards | `07` (whole), `02` §replay format, `01` §9.5, `09` §12 |
| Tests, CI, perf | `09` (whole), `01` §5, §12 |
| Bug fix | the doc of the owning package, then `09` §3 (write the failing test first) |

Known bugs in the level 1 build are listed in `10-backlog.md` and in `09` §15 (with the regression tests that must be written).

## 4. Binding owner decisions

These win over every other document. Full text in `_authoring-brief.md`; short form:

1. **Core loop = V1's order rush.** Fixed recipe tickets, shared steps (cheeseburger = burger + cheese, fries as a side), serve as many as possible in a fixed time, no game over, replay for records.
2. **Players:** up to **6 online** (P2P WebRTC, host-authoritative, Supabase Realtime signaling); up to **4 local** on one screen with gamepads; local and online can mix (for example 2 PCs with 3 players each; total per run is at most 6).
3. **10 handcrafted levels**, each a place with personality (list: `design/06 §3`, spec: `08`). A Giant appears only as the level 10 customer.
4. **Camera:** fixed diorama camera per level. It does not follow the player, except a gentle framing for multi-zone levels as each level spec defines.
5. **Controls:** gamepad first, plus keyboard, plus mouse. **No click-to-walk** (the level 1 build has it: remove it). A mouse click interacts with the station under the cursor only if it is within reach of the chef; otherwise nothing happens except a small "trop loin" hint. Three action buttons: Grab/Drop/Serve, Action (hold: chop, wash, extinguish), Throw (from level 3). Plus Dash.
6. **Instant accessibility:** no tutorial screens. Each level teaches its one new mechanic through design, contextual prompts and a guide arrow on the first order.
7. **Aesthetic reference = the level 1 demo** (`v2/packages/render/src/scenes/harbour/`, screenshots in `v2/docs/p2/`). Go further: a better chef, better stations and assets. **Art style is open (voxel or smooth stylized 3D)**: the render layer sits behind an asset abstraction. Voxel is the current default.
8. **French UI by default**, English supported, all strings through the strings table.
9. **Determinism is non-negotiable:** fixed 30 Hz sim in a Web Worker, integer or Q8 state, shared xoshiro128** PRNG, no `Math.random` or float trig in sim or shared, a state hash.
10. **Known bugs of the level 1 build** are in the backlog: the first cutting board and the first fryer do not work (root cause found: `spec/09 §15`), the bin does not accept burnt items.
11. **Hosting:** Netlify. No accounts or OAuth: identity is a nickname, a token and recovery codes (as V1). Supabase free tier backend.

## 5. Glossary

| Term | Meaning |
|---|---|
| Tick | One step of the sim. Fixed 30 Hz (`SIM_HZ = 30`, `SIM_DT_MS = 1000/30`). All timers are integer ticks. |
| Sim | `packages/sim`. Pure game logic, no DOM, no clock, no `Math.random`. Class `RushSim` for the order rush. |
| Worker | The Web Worker (`packages/sim/src/worker.ts`) that owns the wall clock and drives the sim. The only file in sim allowed to read time. |
| Main thread | Renders, reads input, plays audio, owns UI and (target) network I/O. |
| View | `RushView`: a read-only snapshot of the sim for rendering and HUD, posted by the worker. |
| Event | `RushEvent`: something that happened in a tick (served, chopped, burnt...). Drives sound, VFX, HUD. Not part of the state. |
| Input frame | `RushInput`: one chef's input for one tick (stick, buttons, click). |
| Slot | A chef index 0..5 in a run. Local and online players all map to slots. |
| Seat | A human at a slot on this machine (`LocalSeat`, spec/01 §9). |
| Run | One play of one level: `RunConfig` (seed, level, player count, content hash) + the input log. |
| Ticket | An order the customers want: a recipe with a time limit. |
| Recipe | A container plus a set of finished components (matched exactly as a set). |
| Item | Anything a chef can hold or a station can contain: ingredient, component, container (plate, bowl, cup). |
| Station | A fixed object in the level: counter, dispenser (crate), processor (board, fryer, stove...), bin, pass (serving window), sink. |
| Pass | The serving window where dishes are handed to customers. |
| Bucket | Player-count class: `solo` (1), `duo` (2), `squad` (3-4), `party` (5-6). Scales pacing, ticket time, stars, optional stations. |
| Level | A data pair `level.json` + `layout.json` (+ dressing). `RushLevel` in `@ga/content`. |
| Twist | A level's signature mechanic (tide, bridges, conveyor...). Implemented as data parameters + a hook in the sim (spec/01 §7.4). |
| Diorama | The decorative 3D scene around the playable area of a level (render only, no gameplay). |
| Asset backend | A render implementation of `AssetBackend` (`voxel` or `smooth`). |
| State hash | 64-bit hash of all mutable sim state, `RushSim.stateHash()`. Used by tests, netcode desync detection and record verification. |
| Replay | `RunConfig` + ordered input frames. Re-simulating it reproduces the exact result. |
| Host | In an online room, the peer whose sim is authoritative. |
| Q8 | Fixed point with 8 fractional bits (256 = 1.0). Item `progress` is Q8 of the current step. |
| Mossback demo | The mini-game at `?mode=giant`. Legacy sim in `sim/src/{kitchen,food,world.ts}`. Must keep working. |
| `pnpm check` | The gate: `tsc -b`, eslint, vitest, content validate. |

## 6. Golden rules for coding agents

1. **Determinism.** Same seed + same inputs must give the same state hash. See `01 §5`.
2. **No `Math.random`, `Date`, `performance`, `crypto`, or float `sin/cos/tan/exp/pow/log/atan2/hypot` in `packages/sim` or `packages/shared`.** Lint enforces it; do not add an eslint-disable. Use `@ga/shared`.
3. **Iterate in a fixed order.** Arrays in index order; `Map`/`Set` only when keys are sorted before iteration (as `stateHash` does for items).
4. **No state outside the sim state.** Anything that changes gameplay must be in the state hash.
5. **Strings:** all UI text through `apps/client/src/strings.ts`. Add FR and EN together.
6. **Package boundaries** (`01 §2.3`): do not import upward or sideways. `render` never imports `sim`.
7. **Content is data.** Do not write `if (levelId === ...)` in sim code. Add a field to the schema and a hook (`01 §7`).
8. **Never break** the Mossback demo or an already working level. Run `pnpm check` and the screenshot test (`09 §8`).
9. **`pnpm check` green before you finish.** Never weaken a lint rule, a test or a threshold to get green.
10. **Write the test first for bugs;** add tests for every new rule (`09 §3`).
11. **Small commits.** One logical change per commit.
12. **Do not add dependencies** unless the spec or ticket lists them.
13. **No marketing words, no names of commercial games** (except "Overcooked-style" as a genre reference) in code, strings or docs.
14. **If the spec is wrong or silent, do not guess silently.** Section 11.

## 7. Repository map (one screen)

```
pixel-kitchen-sim/
  docs/v2/                 design docs 01-16 (the why)
  docs/v2/spec/            THIS SPEC (the what and how)
  src/ public/ netlify/ supabase/   V1 (untouched, to be served at /classic)
  v2/                      the V2 workspace (pnpm)
    AGENTS.md              short rules file every agent reads first
    package.json           scripts: dev build typecheck test lint validate check
    packages/shared        PRNG, fmath, hash, ids, time constants
    packages/content       zod schemas + JSON data (items, stations, recipes, levels)
    packages/sim           RushSim, worker, protocol, loop, legacy Mossback sim
    packages/render        three.js, voxel mesher, harbour diorama
    apps/client            Vite app: router, rush client, HUD, input, audio, strings
    content-src/vox/v1     .vox models imported from V1
    tools/v1-to-vox        V1 model converter
    docs/p2-brief-kiosque.md   the level 1 brief; docs/p2/ screenshots
```

Full tree and rules: `01 §2`.

## 8. Commands

Run from `v2/`.

| Command | Does |
|---|---|
| `pnpm install` | install |
| `pnpm dev` | Vite dev server on http://127.0.0.1:5173 with COOP/COEP headers |
| `pnpm check` | `pnpm typecheck && pnpm lint && pnpm test && pnpm validate` |
| `pnpm typecheck` | `tsc -b` (project references) |
| `pnpm lint` | `eslint .` |
| `pnpm test` | `vitest run` (all `packages/**/src/**/*.test.ts`) |
| `pnpm validate` | `pnpm --filter @ga/content validate` (schemas + cross references) |
| `pnpm build` | `pnpm -r build` (client to `apps/client/dist`) |
| `pnpm vitest run <path>` | one file or folder |

Commands added by the spec (tickets create them): `pnpm e2e` (Playwright, `09 §8`), `pnpm stars` (star calibration, `09 §5.4`), `pnpm bench` (sim perf, `09 §10`).

## 9. Definition of done

A ticket is done when **all** of these hold:

1. Acceptance criteria in the ticket are met, each demonstrated by a test or a stated manual check.
2. `pnpm check` is green from a clean `pnpm install`.
3. New behavior has tests in the right layer (`09 §2`). A bug fix has a regression test that failed before the fix.
4. Determinism: if you touched `packages/sim` or `packages/content`, the determinism suite (`09 §6`) passes, and the level 1 golden hash did not change **unless** the ticket says the rules changed (then update the golden file in the same commit and say why).
5. If you touched UI or render: screenshots at 1280x720 and 390x844 in FR and EN show no overflow (`09 §8`), and the Mossback demo and level 1 still load.
6. No new `any`, no `@ts-ignore`, no eslint-disable, no skipped test, no `console.log` left in committed code (the `?debug=1` overlay is fine).
7. All new UI strings exist in FR and EN in `strings.ts`.
8. Docs: if you changed a contract (type, message, JSON field), the spec doc that owns it is updated in the same commit.
9. Final report to the caller: what changed (files), tests added, commands run with results, anything cut or deferred, anything surprising.

## 10. Commit, branch and PR conventions

- **Branch:** work on the branch you were given. If none: `claude/<ticket-id>-<slug>`. Never commit to the default branch directly, never force-push, never rewrite history.
- **Commit message:** `area: imperative summary` in 72 chars or fewer. Areas: `sim`, `content`, `render`, `client`, `shared`, `net`, `records`, `backend`, `levels`, `tests`, `docs`, `build`. Optional body explains why. Reference the ticket id in the body (`Ticket: T-042`).
- **One logical change per commit.** A new level is several commits (content, sim hook, diorama, strings, tests), not one.
- **Do not commit** generated files (`dist/`, `node_modules/`, `*.tsbuildinfo`, `dist-types/`), screenshots other than those the spec asks to keep (`v2/docs/p2/` and `v2/docs/shots/`), or secrets.
- **Attribution:** end commit messages and PR descriptions with the attribution lines your harness gives you.
- **Pull request:** title `area: summary`; body = what, why, tests run, screenshots for UI changes, known gaps.
- **Do not push** unless the ticket or the lead says so.

## 11. How to change the spec

- A contract change (type, message, JSON field, tick order) edits the owning doc **in the same commit** as the code.
- If the spec contradicts the code: the spec is the target; the section "Current state vs target" of each doc says which differences are intended. If a difference is not listed, treat the code as correct, fix the spec in the same commit, and mention it in your report.
- If the spec is silent: pick the simplest option consistent with the golden rules, mark it in the doc as `Default (tunable)`, and report it.
- Never leave "TBD" in a spec doc.

## 12. Current state vs target

| Area | Today (in `v2/`) | Target |
|---|---|---|
| Levels | 1 (`l01_kiosque`) | 10 |
| Players | 1-4 local, one screen | 4 local + up to 6 total including online |
| Online | none | P2P WebRTC, host-authoritative (`06`) |
| Records | `localStorage` best score | server-verified leaderboards per level x bucket (`07`) |
| Mouse | click-to-walk (to remove) | click interacts in reach only |
| Art | voxel only, harbour scene hardcoded | `AssetBackend` abstraction, voxel default, smooth optional |
| Tests | sim/shared/content unit tests, bot test | + determinism golden, screenshot, perf, network, per-level suites (`09`) |
| CI | none in repo | GitHub Actions + Netlify previews (`09 §14`) |
