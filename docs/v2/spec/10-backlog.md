# 10 · Backlog: ordered implementation tickets

Ordered tickets that coding agents (including Haiku-class models) execute one by one, with no human in the loop except at the 🎮 playtest milestones.
Each ticket fits one agent session (about 200-800 changed lines) and lists the only spec sections the agent must read.
Mark a ticket done by changing `- [ ]` to `- [x]` in the status table below **in the same commit as the work**.

## Table of contents
1. Phases
2. How to pick the next ticket (rule for agents)
3. Conventions every ticket inherits
4. Status table
5. Dependency graph summary
6. Tickets (P1 ... P8)

## 1. Phases

| Phase | Name | Goal | Ends with |
|---|---|---|---|
| P1 | Level 1 quick wins | Fix the known level 1 bugs, remove click-to-walk, 6 spawns, lamp flicker | 🎮 Owner playtest A |
| P2 | Sim foundations | Registries, `RunConfig`, golden hash, codec, snapshot, generic bot, CI, content schemas and catalog | `pnpm check` green, golden hash committed |
| P3 | Art foundation | `AssetBackend`, voxel backend, diorama/camera/lighting, new chef, customers, smooth backend, style mock | 🎮 Owner playtest B (style decision) |
| P4 | Client foundations | Client folders, router, strings, settings, input, seats, title, level select, HUD, pause, results | 🎮 Owner playtest C |
| P5a | Levels 2-4 | Stove, throw + split counter, blender + sink + tide | 🎮 after L3, 🎮 after L4 |
| P5b | Levels 5-7 | Pizza + dumbwaiter, fire + coating + bridge, parallel chains + crowd lane | 🎮 after L5, 🎮 after L7 |
| P5c | Levels 8-10 | Batter chain + tunnels, planters + sprinklers, feast + conveyor + giant | 🎮 after L10 |
| P6 | Multiplayer | `@ga/net` in 06 §18 order (N1...), with the backend steps N8 needs (07 B1-B4, B8) | 🎮 after online 2-player, 🎮 after 6-player |
| P7 | Records | 07 §14 order (B5-B7, B9, B10, B12) and N11 | verified leaderboard works end to end |
| P8 | Polish and launch | VFX, ambient life, audio, a11y, perf, e2e, calibration, deploy | 🎮 Owner playtest final, launch checklist |

Phase P6 deliberately contains B1, B2, B3, B4 and B8 of 07 (the records core and the rooms function) because 06 N2 and N8 depend on them. P7 holds the remaining B steps.

## 2. How to pick the next ticket (rule for agents)

1. Open the status table (§4). Candidates are tickets with `- [ ]`.
2. A candidate is **ready** when every ticket in its `Depends on` is `- [x]`.
3. Pick the ready candidate with the **lowest ticket number**. Never skip ahead, except that a ticket whose `Depends on` is `-` and whose phase is the same as or earlier than the lowest open phase is always allowed.
4. **Stop at a 🎮 milestone.** If every ticket before a 🎮 line is done and the 🎮 line is not marked `[x]`, do not start later tickets. Report "waiting for owner playtest" and end the session. Only the owner marks a 🎮 line `[x]`.
5. Read only the spec sections in `Read first`, plus `v2/AGENTS.md` and `00-README.md §6 and §9` once per session.
6. Do the `Steps` in order. Run the commands in `Acceptance`. If an acceptance check fails and you cannot fix it inside the ticket scope, do not mark it done: leave `- [ ]`, add a one-line `BLOCKED:` note under the ticket in this file, and stop.
7. If a step is ambiguous, follow 00-README §11 (pick the simplest option consistent with the golden rules, mark it `Default (tunable)`, report it). Never invent new public interfaces: names come from 01 §14.
8. Commit once per ticket: message `T-XXX: <title>`, with `- [x]` flipped in the same commit. Do not push to the default branch.

## 3. Conventions every ticket inherits

- Paths are relative to the repository root. Commands run from `v2/`: `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm validate`, `pnpm check` (all of them). A ticket is done only if `pnpm check` passes (00-README §9) unless its Acceptance says otherwise.
- Sim and shared code: no `Math.random`, no `Math.sin/cos/pow`, no `Date.now`, integers for counters and timers (01 §5).
- Tests are named in each ticket; a ticket without its tests is not done.
- Hash changes: any ticket that intentionally changes the level 1 golden hash must say so in its Acceptance and re-baseline the golden file (09 §6.2) in the same commit. Otherwise the golden test must stay unchanged.
- Strings: every user-visible string goes through the strings table (05 §8), French first.
- Model hint: `haiku` means the steps are mechanical and fully specified; `sonnet` means some judgement inside the spec is needed.
- "Level suite" means the per-level tests of 09 §7 and the level's own acceptance section in 08.

## 4. Status table

One row per ticket and per owner milestone. Change `- [ ]` to `- [x]` in the same commit as the work. Only the owner marks a 🎮 row.


- [ ] **T-001** · Bot steers with the stick (no click-to-walk) (P1, sonnet)
- [ ] **T-002** · Remove click-to-walk from the sim, click acts in reach only (P1, sonnet)
- [ ] **T-003** · Client: remove click-to-walk, reach-only mouse, "Trop loin" hint (P1, sonnet)
- [ ] **T-004** · Level 1: station order and disabled optionals drawn as counters (B1) (P1, sonnet)
- [ ] **T-005** · Content check: first processor along the route is enabled in every bucket (P1, haiku)
- [ ] **T-006** · The bin accepts burnt items (B3), tests first (P1, sonnet)
- [ ] **T-007** · Level 1: 6 spawns, party extras, 6 chef slots (P1, sonnet)
- [ ] **T-008** · Lamp flicker cap (accessibility) (P1, haiku)
- [ ] **T-009** · Level 1 playtest build check (P1, haiku)
- [ ] **🎮 Playtest A** · level 1 fixes (owner only)
- [ ] **T-010** · Golden hash test for level 1 (P2, haiku)
- [ ] **T-011** · Split sim into state, chef, grid modules (pure refactor) (P2, sonnet)
- [ ] **T-012** · Extract interact, items, tickets, scoring modules and fix chained cooking (B2) (P2, sonnet)
- [ ] **T-013** · StationBehavior registry (P2, sonnet)
- [ ] **T-014** · TwistHooks registry and twist PRNG stream (P2, sonnet)
- [ ] **T-015** · Content schemas: mechanics flags, StationDef kinds, LevelData additions (P2, sonnet)
- [ ] **T-016** · Content catalog: items, assemblies, blends (P2, haiku)
- [ ] **T-017** · Content catalog: stations and recipes (13 recipes) (P2, haiku)
- [ ] **T-018** · Content validation: the 15 checks (P2, sonnet)
- [ ] **T-019** · LEVEL_ORDER and level registry (P2, haiku)
- [ ] **T-020** · RunConfig, SIM_VERSION, contentHash, difficulty (P2, sonnet)
- [ ] **T-021** · RunResult, result(), hash() alias, SlotResult (P2, haiku)
- [ ] **T-022** · Input: RB_T button and the 5-byte codec (P2, haiku)
- [ ] **T-023** · Snapshot and restore (P2, sonnet)
- [ ] **T-024** · State hash: target field layout (P2, sonnet)
- [ ] **T-025** · Six-player scaling and difficulty buckets (P2, haiku)
- [ ] **T-026** · Generic recipe-driven bot (P2, sonnet)
- [ ] **T-027** · Determinism suite: replay, static scan, hygiene (P2, sonnet)
- [ ] **T-028** · Worker protocol: RunConfig, driven clock, edge latching (P2, sonnet)
- [ ] **T-029** · CI, import boundaries, vitest include (P2, haiku)
- [ ] **T-030** · Mixed-mode refactor gate: 6-player golden and per-bucket goldens (P2, haiku)
- [ ] **T-040** · AssetBackend interfaces, manifest, selection (P3, sonnet)
- [ ] **T-041** · Voxel backend: port stations, items, meals from the harbour scene (P3, sonnet)
- [ ] **T-042** · RenderHost and LevelDiorama (level 1 extracted from HarbourScene) (P3, sonnet)
- [ ] **T-043** · CameraRig, per-level CameraSpec, portrait fix (P3, sonnet)
- [ ] **T-044** · Lighting rig and the 10 mood presets (P3, haiku)
- [ ] **T-045** · Chef skeleton, proportions, hats (voxel) (P3, sonnet)
- [ ] **T-046** · ChefAnimator: walk, carry, chop, interact, dash, hurt, wash, extinguish, throw (P3, sonnet)
- [ ] **T-047** · New chef in the level 1 diorama + customers (P3, sonnet)
- [ ] **T-048** · Smooth backend: builder, toon material, outline (P3, sonnet)
- [ ] **T-049** · Smooth backend: stations and props (P3, haiku)
- [ ] **T-050** · Smooth backend: items, meals, chef, customers (P3, haiku)
- [ ] **T-051** · Backend contract tests, parity, `?art=smooth` hash parity (P3, haiku)
- [ ] **T-052** · Style comparison mock: smooth 3D vs voxel, level 1 side by side (P3, sonnet)
- [ ] **🎮 Playtest B** · new chef and style decision (owner only)
- [ ] **T-053** · Apply the owner's style decision (P3, haiku)
- [ ] **T-060** · Client folder restructure (P4, haiku)
- [ ] **T-061** · Router and screen registry (P4, sonnet)
- [ ] **T-062** · Strings and i18n: French default, key scheme, CI check (P4, haiku)
- [ ] **T-063** · Storage: settings, progress, bindings, migration (P4, sonnet)
- [ ] **T-064** · Input: gamepad, keyboard schemes A and B, bindings (P4, sonnet)
- [ ] **T-065** · Mouse reach logic, glyph tables, contextual prompts (P4, sonnet)
- [ ] **T-066** · Seats and couch join (P4, sonnet)
- [ ] **T-067** · Title and level select screens (P4, sonnet)
- [ ] **T-068** · Intro card, couch join row, countdown (P4, sonnet)
- [ ] **T-069** · HUD split: tickets, clock, rings, toasts; guide arrow (P4, sonnet)
- [ ] **T-070** · Pause overlay and results screen (P4, sonnet)
- [ ] **T-071** · Settings screen and accessibility basics (P4, haiku)
- [ ] **T-072** · Classic V1 proxy and headers (07 B11) (P4, haiku)
- [ ] **T-073** · Playwright setup, screenshot matrix, overflow and smoke tests (P4, sonnet)
- [ ] **T-074** · Audio engine and the core sound list (P4, sonnet)
- [ ] **🎮 Playtest C** · menus, seats, HUD and level 1 (owner only)
- [ ] **T-100** · Level checks tool (`check-levels`) (P5a, sonnet)
- [ ] **T-101** · Star calibration tool and twist-aware bot mode (P5a, sonnet)
- [ ] **T-102** · Level 2 · Le Food Truck du Festival: content (P5a, sonnet)
- [ ] **T-103** · Level 2 diorama (festival truck) (P5a, sonnet)
- [ ] **T-104** · Throw mechanic (sim) (P5a, sonnet)
- [ ] **T-105** · Level 3 · Diner Route 66: split counter hook and content (P5a, sonnet)
- [ ] **T-106** · Throw: client controls, aim marker, render and sound (P5a, sonnet)
- [ ] **T-107** · Level 3 diorama (Route 66 diner) (P5a, haiku)
- [ ] **🎮 Playtest D** · levels 2 and 3 (and throw) (owner only)
- [ ] **T-108** · Dishes cycle, blender, sink, plate return (sim) (P5a, sonnet)
- [ ] **T-109** · Tide twist hook (P5a, sonnet)
- [ ] **T-110** · Level 4 · Bar à Smoothies: content (P5a, sonnet)
- [ ] **T-111** · Level 4 diorama and wash/blender feedback (P5a, haiku)
- [ ] **T-112** · Pizza chain: press, assemblies, oven (sim) (P5b, sonnet)
- [ ] **T-113** · Dumbwaiter station, twist hook, multi-zone camera (P5b, sonnet)
- [ ] **T-114** · Level 5 · Pizzeria sur les Toits: content (P5b, sonnet)
- [ ] **T-115** · Level 5 diorama (rooftop pizzeria) (P5b, haiku)
- [ ] **🎮 Playtest E** · levels 4 and 5 (owner only)
- [ ] **T-116** · Fire and extinguisher (sim) (P5b, sonnet)
- [ ] **T-117** · Coating station and low-bridges hook (P5b, sonnet)
- [ ] **T-118** · Level 6 · Friterie du Bateau-Mouche: content (P5b, sonnet)
- [ ] **T-119** · Level 6 diorama and fire visuals (P5b, haiku)
- [ ] **T-120** · Crowd-lane twist hook (P5b, haiku)
- [ ] **T-121** · Level 7 · Marché de Nuit: content (P5b, sonnet)
- [ ] **T-122** · Level 7 diorama (night market) (P5b, haiku)
- [ ] **🎮 Playtest F** · levels 6 and 7 (owner only)
- [ ] **T-123** · Mixer batter chain and gangway-tunnels hook (P5c, sonnet)
- [ ] **T-124** · Level 8 · Wagon-Restaurant: content (P5c, sonnet)
- [ ] **T-125** · Level 8 diorama (train wagons, tunnels) (P5c, haiku)
- [ ] **T-126** · Planter station (harvest, regrow) (P5c, sonnet)
- [ ] **T-127** · Sprinklers hook (P5c, haiku)
- [ ] **T-128** · Level 9 · Bistrot de la Serre: content (P5c, sonnet)
- [ ] **T-129** · Level 9 diorama (greenhouse bistro) (P5c, haiku)
- [ ] **T-130** · Conveyor station (sim) (P5c, sonnet)
- [ ] **T-131** · Feast tickets and the giant customer data (P5c, sonnet)
- [ ] **T-132** · Level 10 · Banquet du Géant: content (P5c, sonnet)
- [ ] **T-133** · Level 10 diorama, giant customer, feast HUD (P5c, sonnet)
- [ ] **T-134** · Cross-level checks: difficulty curve, goldens, no regressions (P5c, haiku)
- [ ] **🎮 Playtest G** · levels 8 to 10 and the full campaign (owner only)
- [ ] **T-140** · `@ga/net` skeleton: constants, protocol types, codec (N1) (P6, sonnet)
- [ ] **T-141** · `@ga/records` skeleton: RunLog, `.pkr` codec, replayKey, nickname (B1) (P6, sonnet)
- [ ] **T-142** · `verifyRun` with `InlineSimDriver` (B2) (P6, sonnet)
- [ ] **T-143** · Net-side sim driver on the worker (N3) (P6, sonnet)
- [ ] **T-144** · Host queue, sequencer, playout, confirmed log (N4) (P6, sonnet)
- [ ] **T-145** · SimulatedNetwork and the lockstep suite (N5) (P6, sonnet)
- [ ] **T-146** · Hash checker, desync detection and log-replay recovery (N6a) (P6, sonnet)
- [ ] **T-147** · Catch-up transfer: snapshot and log modes, reconnect (N6b) (P6, sonnet)
- [ ] **T-148** · WebRTC transport and LocalSignaling (N7a) (P6, sonnet)
- [ ] **T-149** · Multi-tab harness (N7b) (P6, sonnet)
- [ ] **T-150** · Supabase schema migration and CI schema test (B3) (P6, haiku)
- [ ] **T-151** · Netlify functions shared layer (B4) (P6, sonnet)
- [ ] **T-152** · Rooms and TURN functions, Realtime policies, gc and keep-alive (B8) (P6, sonnet)
- [ ] **T-153** · SupabaseSignaling and client net glue (N8) (P6, sonnet)
- [ ] **T-154** · Lobby: room state, ready-up, level and difficulty choice (N9a) (P6, sonnet)
- [ ] **T-155** · Start sequence, barrier, results hand-off, mixed couch run (N9b) (P6, sonnet)
- [ ] **🎮 Playtest H** · online 2-player (owner only)
- [ ] **T-156** · Leave, disconnect, spectators, late join, kick; host leaves aborts (N10) (P6, sonnet)
- [ ] **T-157** · Six-player validation: bandwidth, jitter, TURN-free path (P6, sonnet)
- [ ] **🎮 Playtest I** · online 6 players (owner only)
- [ ] **T-158** · Host migration (M) (P6, sonnet)
- [ ] **T-170** · Identity function, client API and Account screen (B5) (P7, sonnet)
- [ ] **T-171** · Runs endpoints: start, submit, status (B6a) (P7, sonnet)
- [ ] **T-172** · Background verifier and sweep (B6b) (P7, sonnet)
- [ ] **T-173** · Client run submission and net-result UI (N11) (P7, sonnet)
- [ ] **T-174** · Boards, personal bests and leaderboard screen (B7) (P7, sonnet)
- [ ] **T-175** · Friends and friends board scope (B9) (P7, haiku)
- [ ] **T-176** · Heuristics, admin and strikes (B10) (P7, sonnet)
- [ ] **T-177** · Replay retention and ghost playback hook (B12) (P7, sonnet)
- [ ] **T-178** · Records end-to-end test and deployment checks (P7, sonnet)
- [ ] **T-190** · VFX presets (P8, sonnet)
- [ ] **T-191** · Ambient life for all dioramas (P8, haiku)
- [ ] **T-192** · Quality tiers and performance gates (P8, sonnet)
- [ ] **T-193** · Ambience beds and adaptive music (P8, sonnet)
- [ ] **T-194** · Accessibility pass and axe checks (P8, sonnet)
- [ ] **T-195** · Debug overlay, telemetry events, net strings completeness (P8, haiku)
- [ ] **T-196** · Optional: relay fallback (phase R) (P8, sonnet)
- [ ] **T-197** · Optional: voice chat (phase V) (P8, sonnet)
- [ ] **T-198** · CI completion: e2e, schema, size, determinism on two Node versions (P8, haiku)
- [ ] **T-199** · Final calibration and regression sweep (P8, sonnet)
- [ ] **T-200** · Playtest checklists and launch docs (P8, haiku)
- [ ] **T-201** · Spec reconciliation (P8, haiku)
- [ ] **🎮 Playtest J** · final, launch decision (owner only)

## 5. Dependency graph summary

Text form: `A -> B` means B needs A. Per-ticket `Depends on` lines are authoritative; this table shows the shape.

| Phase | Tickets | Count | Needs before it starts | Unlocks |
|---|---|---|---|---|
| P1 | T-001 ... T-009 | 9 | nothing (T-001, T-008 start immediately) | all later work (golden hash baseline T-010) |
| P2 | T-010 ... T-030 | 21 | T-009 (P1 done, 🎮 A) | P3 (backends), P4 (client), levels (registries, content schemas), P6 (codec, snapshot, RunConfig) |
| P3 | T-040 ... T-053 | 14 | T-029 (CI), T-051 contracts inside the phase | P4 (new chef, camera), level dioramas (T-103+), style choice |
| P4 | T-060 ... T-074 | 15 | T-028 (worker protocol), T-047 (new chef in diorama), 🎮 B | levels (level select, HUD), P6 (screens), P7 (account, results) |
| P5a | T-100 ... T-111 | 12 | 🎮 C, T-053 (style decision) | P5b (throw, dishes, tide, phaseAt) |
| P5b | T-112 ... T-122 | 11 | T-110 (level 4 content) | P5c (fire, hooks pattern) |
| P5c | T-123 ... T-134 | 12 | T-122 (level 7 diorama) | P6 final checks (T-157 needs T-134), calibration T-199 |
| P6 | T-140 ... T-158 | 19 | 🎮 G (milestones block later tickets, rule 4); technically T-140 needs only T-029, T-022 and T-141 needs T-027 | P7 (rooms, signaling, run hand-off) |
| P7 | T-170 ... T-178 | 9 | T-172 needs T-142 and T-151; T-173 needs T-155 | P8 (records e2e, polish) |
| P8 | T-190 ... T-201 | 12 | T-178 (records e2e), T-158 (migration) | launch |

Key chains (the critical path):

```
T-001 -> T-002 -> T-003 (click-to-walk gone) -> T-009 -> 🎮 A
T-010 (golden) -> T-011 -> T-012 -> T-013 -> T-014 -> T-020 -> T-021 -> T-023 -> T-024 -> T-027 -> T-028
T-015 -> T-016 -> T-017 -> T-018 -> T-020 ; T-015 -> T-019
T-040 -> T-041 -> T-042 -> T-043 ; T-041 -> T-045 -> T-046 -> T-047 ; T-040 -> T-048 -> T-049 -> T-050 -> T-051 -> T-052 -> 🎮 B -> T-053
T-060 -> T-061 -> T-067 -> T-068 -> T-070 -> T-073 -> 🎮 C
T-100 + T-101 -> T-102 -> T-103 ; T-102 -> T-104 -> T-105 -> T-106/T-107 -> 🎮 D
T-105 -> T-108 -> T-110 (+ T-109) -> T-111 ; T-110 -> T-112 -> T-113 -> T-114 -> T-115 -> 🎮 E
T-115 -> T-116 -> T-117 -> T-118 -> T-119 ; T-120 -> T-121 -> T-122 -> 🎮 F
T-122 -> T-123 -> T-124 -> T-125 -> T-126 -> T-127 -> T-128 -> T-129 -> T-130 -> T-131 -> T-132 -> T-133 -> T-134 -> 🎮 G
T-140 -> T-143 -> T-144 -> T-145 -> T-146 -> T-147 -> T-154 -> T-155 -> 🎮 H -> T-156 -> T-157 -> 🎮 I -> T-158
T-141 -> T-142 -> T-145 ; T-150 -> T-151 -> T-152 -> T-153 -> T-154
T-142 + T-151 -> T-171 -> T-172 -> T-173 -> T-174 -> T-175/T-177 ; T-172 -> T-176 -> T-178
T-178 -> T-190 -> T-191 -> T-192 -> T-198 -> T-199 -> T-200 -> T-201 -> 🎮 J
```



## 6. Tickets

---
## Phase P1 · Level 1 quick wins

### T-001 · Bot steers with the stick (no click-to-walk)
- Phase: P1
- Depends on: -
- Model hint: sonnet
- Read first: 02 §18 (item 4), 09 §5.1
- Files: `v2/packages/sim/src/rush/botNav.ts` (new, holds a copy of `WalkGrid`), `v2/packages/sim/src/rush/bot.ts`, `v2/packages/sim/src/rush/rush.test.ts`
- Steps:
  1. Create `botNav.ts` by copying `WalkGrid` from `grid.ts` (leave the original in place for now; T-002 deletes it). Export `WalkGrid`.
  2. In `bot.ts` replace every `go(station)` click with steering: compute the path with the bot's `WalkGrid`, set `move` toward the next waypoint (normalised to i8), and press `RB_A` (edge, held 2 ticks) when `view.chefs[slot].target` is the intended station and the action is valid. Same for `RB_X` hold on boards.
  3. The bot must never set `click`, `clickSeq` or `clickKind`.
  4. Keep the public bot API (`RushBot`) unchanged so existing tests compile.
- Acceptance: `pnpm -C v2 test` green; solo and duo bot runs on level 1 still reach 3 stars; grep shows no `clickKind` in `bot.ts`.
- Tests: in `rush.test.ts` adjust the bot tests to assert `inputs.every(i => i.click === 0)`; keep the "hash twice" determinism test.

### T-002 · Remove click-to-walk from the sim, click acts in reach only
- Phase: P1
- Depends on: T-001
- Model hint: sonnet
- Read first: 02 §18, 02 §3.1 (events), 02 §7.1
- Files: `v2/packages/sim/src/rush/types.ts`, `v2/packages/sim/src/rush/sim.ts`, `v2/packages/sim/src/rush/grid.ts`, `v2/packages/sim/src/rush/rush.test.ts`
- Steps:
  1. Apply 02 §18 items 1-3 exactly: delete `RushInput.clickKind`, `ChefView.walking`, the walk constants, the `ChefRt` walk fields, `startWalk`, `clearWalk`, the click-to-walk and walking-steers blocks; move nothing else.
  2. Add the event `TooFar { slot, station }` to `RushEvent` (name is final per 02 §3.1).
  3. A click (when `click` is a station index and `clickSeq` changed) interacts with that station only if `stationInReach(chef, box, reach)` is true; otherwise emit `TooFar` and do nothing. Export `stationInReach` from the sim index.
  4. Remove the walk fields from `stateHash()` (02 §17.4 note). The level 1 hash changes once here: that is expected.
  5. Delete `WalkGrid` from `grid.ts` (it lives in `botNav.ts`).
- Acceptance: `pnpm -C v2 check` green; `grep -rn "walkTarget\|clickKind\|startWalk" v2/packages/sim/src` returns nothing.
- Tests: in `rush.test.ts` delete the three click-to-walk tests named in 02 §18 item 5 and add `click within reach acts`, `click out of reach emits TooFar and does nothing`, `click and A in the same tick act once`, `moving never starts from a click`.

### T-003 · Client: remove click-to-walk, reach-only mouse, "Trop loin" hint
- Phase: P1
- Depends on: T-002
- Model hint: sonnet
- Read first: 02 §18 item 6, 05 §6.4, 08 §3.11 item 1
- Files: `v2/apps/client/src/rush/rushInput.ts`, `v2/apps/client/src/rush/rushClient.ts`, `v2/apps/client/src/rush/rushHud.ts`, `v2/apps/client/src/strings.ts`, `v2/apps/client/src/rush/rushInput.test.ts` (new)
- Steps:
  1. In `rushInput.ts` stop sending `clickKind`; left click sends `click` (station under the cursor from `pickStation`) and increments `clickSeq` only when the station is within reach (use the exported `stationInReach`); otherwise raise a hint event instead. Right mouse hold sets `RB_X` only; right click does nothing else. Mouse movement alone never changes `move`.
  2. In `rushClient.ts` on `TooFar` (and on the client-side out-of-reach click) show a small "Trop loin" / "Too far" hint at the station for 1 s via the HUD toast mechanism.
  3. Delete the strings `help.walk` and the legend line "Clic : aller et agir"; add `hint.tooFar` (FR "Trop loin", EN "Too far").
  4. Fix the glyph so keyboard `grab` shows "Espace" (never "Clic gauche").
- Acceptance: `pnpm -C v2 check` green; `grep -rn "clickKind\|walkTarget\|aller et agir" v2/apps/client/src` returns nothing outside `mossback.ts`/`input.ts`; in the browser a click on a far station only shows "Trop loin".
- Tests: `rushInput.test.ts`: click out of reach sends no click and raises the hint; click in reach sets `click` and bumps `clickSeq` once; right hold sets `RB_X` only; mouse move leaves `move` at `[0,0]`.

### T-004 · Level 1: station order and disabled optionals drawn as counters (B1)
- Phase: P1
- Depends on: T-002
- Model hint: sonnet
- Read first: 08 §3.3 (table), 08 §1.4, 04 §1.2 item 1, 04 §11.1, 02 §19 B1
- Files: `v2/packages/content/src/data/rush/levels/l01_kiosque/layout.json`, `v2/packages/render/src/scenes/harbour/harbourScene.ts`, `v2/packages/render/src/scenes/harbour/harbourApp.ts`, `v2/apps/client/src/rush/rushClient.ts`, `v2/packages/render/src/scenes/harbour/harbourScene.test.ts` (new)
- Steps:
  1. Reorder and reposition the stations of `layout.json` exactly as the 08 §3.3 table (base stations first on the route: `board_1` at x = -2.5, `fryer_1` at x = -0.5; optionals after).
  2. `rushClient.ts`: stop mapping every layout station to `enabled: true`. Create (or rebuild) the scene after `rush-init`, when the first `view.stations` is known, and pass the effective `StationView.def`/`enabled`.
  3. `HarbourScene.buildStations` draws a station whose `enabled === false` as a plain counter (no steam, no ring, no item feedback), per 04 §11.1.
  4. Update level 1 tests that assert station indices (`rush.test.ts`, `content.test.ts`) to the new order.
  5. Re-baseline any level 1 hash test (the layout changed; the golden file is created in T-010).
- Acceptance: `pnpm -C v2 check` green; screenshot at solo shows counters at `board_2` and `fryer_3`; in solo and duo `board_1` and `fryer_1` respond to a chef in reach.
- Tests: `harbourScene.test.ts` with a stub backend: for 1 player `board_2` and `fryer_3` are built with `'counter'`; for 6 players they are built as `board` and `fryer`. Sim test `first board and first fryer on the route work in solo`.

### T-005 · Content check: first processor along the route is enabled in every bucket
- Phase: P1
- Depends on: T-004
- Model hint: haiku
- Read first: 09 §15 (bug 1 test (c)), 03 §10 (rules list), 09 §4.3
- Files: `v2/packages/content/src/validate.ts`, `v2/packages/content/src/content.test.ts`, `v2/packages/sim/src/rush/stations.test.ts` (new)
- Steps:
  1. In `validate.ts` add the rule: for each `processor` def present in a level, the first station of that def along the spawn-to-pass route (sorted by x from the crate side, `layout.route` if present, else by ascending x) must have no `optional` field. Fail with `level <id>: first <def> '<stationId>' is optional`.
  2. Add the generic station smoke test (09 §4.3): for each level and each of the buckets 1, 2, 4, 6 players, for every enabled station, place a chef in reach, give the minimal item and press the action; assert no `Refused`.
  3. Add a bin case with a burnt item to the smoke test.
- Acceptance: `pnpm -C v2 validate` and `pnpm -C v2 test` green.
- Tests: `content.test.ts` `first board and first fryer are never optional`; `stations.test.ts` as above for level 1 only (more levels are added by their tickets).

### T-006 · The bin accepts burnt items (B3), tests first
- Phase: P1
- Depends on: T-002
- Model hint: sonnet
- Read first: 02 §19 B3, 08 §3.11 item 3, 09 §15 (bug 3)
- Files: `v2/packages/sim/src/rush/rush.test.ts`, `v2/packages/sim/src/rush/sim.ts`, `v2/packages/sim/src/rush/grid.ts`, `v2/apps/client/src/rush/rushClient.ts`
- Steps:
  1. First commit-worthy step: add the failing-or-passing sim tests named below. Run them.
  2. Write the targeting test: chef at x = 3.0 (the `plates`/`bin` seam) holding burnt fries presses A: assert the target is the bin. If it fails, fix `findTarget` so that a held non-empty hand prefers a station that accepts the held item (`bin` always accepts), with ties broken by facing, then index.
  3. UX trap: with a plate in hand and a burnt item in the fryer, make the refusal toast read "Brûlé ! À la poubelle" and make pressing A on the bin with a plate holding burnt contents empty the plate and keep it (already true; assert it).
  4. Client picking: make `pickStation` prefer the bin box with an enlarged pick margin of 0.25 m for `bin` only.
  5. Verify serving a burnt item gives `WrongDish` and does not crash.
- Acceptance: `pnpm -C v2 check` green; manual: holding burnt fries and pressing A at the plates/bin seam trashes it.
- Tests: `the bin accepts a burnt item in hand`, `a burnt item can be taken out of a fryer`, `a burnt item taken out of a fryer goes straight into the bin` (stick-driven chef), `the bin accepts a plate holding a burnt component and keeps the plate`, `burnt item at the pass gives WrongDish`, `at the plates and bin seam the bin is targeted with a burnt item`.

### T-007 · Level 1: 6 spawns, party extras, 6 chef slots
- Phase: P1
- Depends on: T-004
- Model hint: sonnet
- Read first: 08 §3.3, 08 §3.11 item 4, 01 §7.7, 02 §15.4
- Files: `v2/packages/content/src/data/rush/levels/l01_kiosque/layout.json`, `v2/packages/sim/src/rush/sim.ts`, `v2/packages/sim/src/rush/types.ts`, `v2/packages/render/src/scenes/harbour/harbourScene.ts`, `v2/packages/shared/src/index.ts`, `v2/packages/content/src/validate.ts`
- Steps:
  1. Add `board_3`, `pass_2` (optional `party`) and the two extra spawns so `spawns.length >= 6` (08 §3.3).
  2. Set `MAX_PLAYERS = 6` in the sim; add two slot colours (render `SLOT_COLORS` to 6 entries, use the palette of 04 §3.3).
  3. Validation rule: `spawns.length >= 6` for every level (03 §10).
  4. Client seats stay at 4 local (05 §5); do not change client seat code.
- Acceptance: `pnpm -C v2 check` green; a 6-player bot run on level 1 starts with no chef overlap.
- Tests: `rush.test.ts` `six chefs spawn without overlap`, `bucket for players 1-6 is solo,duo,squad,squad,party,party`; `content.test.ts` `every level has at least 6 spawns`.

### T-008 · Lamp flicker cap (accessibility)
- Phase: P1
- Depends on: -
- Model hint: haiku
- Read first: 04 §1.2 item 6, 04 §7.5, 04 §18 item 8
- Files: `v2/packages/render/src/scenes/harbour/harbourScene.ts`, `v2/packages/render/src/scenes/harbour/lampFlicker.ts` (new), `v2/packages/render/src/scenes/harbour/lampFlicker.test.ts` (new)
- Steps:
  1. Extract the lamp intensity function into `lampFlicker.ts`: `lampIntensity(timeSec: number, lateRun: number): number` using the exact late-run behaviour of 04 §7.5 (no `sin(time*23)`/`sin(time*31)`).
  2. `harbourScene.ts` calls it.
- Acceptance: test passes: sampled over 10 s at 60 Hz, intensity never changes by more than 25 % at more than 3 Hz.
- Tests: `lampFlicker.test.ts`: `flicker stays within 3 Hz and 25 percent`, `no flicker before late run`.

### T-009 · Level 1 playtest build check
- Phase: P1
- Depends on: T-003, T-004, T-005, T-006, T-007, T-008
- Model hint: haiku
- Read first: 08 §3.14
- Files: `v2/docs/p2/level1-fixes-checklist.md` (new, a 12-line checklist the owner follows)
- Steps:
  1. Run `pnpm -C v2 build` and `pnpm -C v2 check`.
  2. Write the checklist from 08 §3.14 (board_1 and fryer_1 respond; counters at board_2 and fryer_3 in solo/duo; burnt item can be binned; no click walking; a far click shows "Trop loin"; 6 players can join in the bot harness; lamp does not strobe).
- Acceptance: build succeeds; checklist file exists.
- Tests: none.

### 🎮 Owner playtest A: level 1 fixes
Status is the checkbox of this milestone in §4. The owner confirms the checklist of `v2/docs/p2/level1-fixes-checklist.md` in the browser (keyboard and one gamepad). Agents do not continue past this line until it is `[x]`.

---
## Phase P2 · Sim foundations

### T-010 · Golden hash test for level 1
- Phase: P2
- Depends on: T-009
- Model hint: haiku
- Read first: 09 §6.1, 09 §6.2, 02 §20 item 2
- Files: `v2/packages/sim/src/rush/determinism.test.ts` (new), `v2/packages/sim/src/rush/golden/l01_kiosque.json` (new), `v2/packages/sim/src/rush/goldenTool.ts` (new, script that rewrites the golden file with `UPDATE_GOLDEN=1`)
- Steps:
  1. `determinism.test.ts`: `double run` (two runs, same seed and bot inputs, equal `hash()` at every 30th tick) for level 1 with 1 and 2 bots.
  2. `golden`: `hash()` at ticks 300, 1800 and 5490 for seed 42, 1 and 2 bots, read from `golden/l01_kiosque.json`. With `UPDATE_GOLDEN=1` the test rewrites the file instead of failing.
  3. Generate the golden file once and commit it.
- Acceptance: `pnpm -C v2 test` green; changing any sim constant makes the golden test fail with a clear message naming `UPDATE_GOLDEN=1`.
- Tests: the two tests above.

### T-011 · Split sim into state, chef, grid modules (pure refactor)
- Phase: P2
- Depends on: T-010
- Model hint: sonnet
- Read first: 02 §1 (files list and reconciliations), 01 §7.4 (file list)
- Files: `v2/packages/sim/src/rush/state.ts`, `chef.ts`, `grid.ts`, `sim.ts`, `index.ts`
- Steps:
  1. Move runtime types (`ChefRt`, `StationRt`, `ItemRt`, `TicketRt`) to `state.ts`. Move targeting, movement, collision, dash (02 §8) to `chef.ts` as pure functions taking the sim context.
  2. `sim.ts` keeps `RushSim`, the tick loop and orchestration. Exports in `index.ts` are unchanged.
  3. No behaviour change.
- Acceptance: `pnpm -C v2 check` green and the golden test **unchanged**.
- Tests: none new; the golden test is the gate.

### T-012 · Extract interact, items, tickets, scoring modules and fix chained cooking (B2)
- Phase: P2
- Depends on: T-011
- Model hint: sonnet
- Read first: 02 §5.2, 02 §5.3, 02 §7.1-7.3, 02 §13, 02 §14, 02 §19 B2
- Files: `v2/packages/sim/src/rush/interact.ts`, `items.ts`, `tickets.ts`, `scoring.ts`, `pacing.ts`, `sim.ts`, `rush.test.ts`
- Steps:
  1. Move the interaction resolution to `interact.ts` (table of 02 §7.3), the item state machine and `canAdd` to `items.ts`, ticket spawn/expiry to `tickets.ts`, points/streak/stars to `scoring.ts`.
  2. Implement rule 4 of 02 §5.2: after an auto-station cook, `state = 'raw'` when the result item has its own `cook` (B2 fix). Level 1 has no such item, so its hash is unchanged.
  3. Make `recipe.penalty` unused and keep `level.scoring.expiredPenalty` (02 §19 B4).
- Acceptance: `pnpm -C v2 check` green; golden unchanged.
- Tests: add a unit test with a synthetic content fixture: egg -> mixer -> stove -> `cooked_omelette`; onion -> board -> coating -> fryer reaches `cooked`. Name them `chained cooking mixer then stove`, `chained cooking coating then fryer`.

### T-013 · StationBehavior registry
- Phase: P2
- Depends on: T-012
- Model hint: sonnet
- Read first: 01 §7.4 (StationBehavior, rules), 02 §6.1-6.5, 02 §6.9-6.10
- Files: `v2/packages/sim/src/rush/stations/index.ts`, `stations/counter.ts`, `dispenser.ts`, `processor.ts`, `pass.ts`, `bin.ts`, `sim.ts`
- Steps:
  1. Define `StationBehavior` exactly as in 01 §7.4 and a registry `STATION_BEHAVIORS: Record<StationKind, StationBehavior>`.
  2. Move the per-kind code for `counter`, `dispenser`, `processor` (chop and auto), `bin`, `pass` out of `sim.ts` into the files above. `sim.ts` calls `STATION_BEHAVIORS[def.kind]`.
  3. Unknown kinds throw at construction (`Error('no behavior for kind X')`).
- Acceptance: `pnpm -C v2 check` green; golden unchanged; `sim.ts` has no `switch (kind)` on station kinds.
- Tests: `stations.test.ts` `every kind in the schema enum has a behavior except those added later (list)`; keep existing tests.

### T-014 · TwistHooks registry and twist PRNG stream
- Phase: P2
- Depends on: T-013
- Model hint: sonnet
- Read first: 01 §7.4 (TwistHooks), 02 §16.1, 02 §16.2, 08 §2.4
- Files: `v2/packages/sim/src/rush/hooks/index.ts`, `hooks/none.ts`, `sim.ts`, `ctx.ts` (new, `SimCtx`)
- Steps:
  1. Define `SimCtx` and `TwistHooks` with all members of 01 §7.4 plus the additions of 08 §2.4 (`speedMulQ8`, `dashAllowed`, `ejectChefs`), all optional with the documented defaults.
  2. Registry `TWIST_HOOKS: Record<TwistKind, TwistHooks>` with `none` only; unknown kind throws.
  3. Call each hook at its place in the tick (02 §12 steps) through `ctx`; with `none` nothing changes.
  4. Add the twist PRNG stream `rngTwist` (`Prng(seed).split('twist')`) and the `twist: Int32Array` state; include it in `stateHash` at the position of 02 §17.4 (this changes the golden hash once).
- Acceptance: `pnpm -C v2 check` green; golden **re-baselined in this commit** (`UPDATE_GOLDEN=1`), message says so.
- Tests: `hooks.test.ts`: `none hook never blocks`, `unknown twist kind throws`, `twist rng is separate from pacing rng` (changing twist draws does not change ticket spawns).

### T-015 · Content schemas: mechanics flags, StationDef kinds, LevelData additions
- Phase: P2
- Depends on: T-010
- Model hint: sonnet
- Read first: 03 §2.2, 03 §2.5, 03 §2.8, 08 §2.2, 08 §2.3, 01 §7.3
- Files: `v2/packages/content/src/schemas/rush.ts`, `v2/packages/content/src/data/rush/levels/l01_kiosque/level.json`, `v2/packages/content/src/content.test.ts`
- Steps:
  1. Extend `StationDefSchema.kind` with `sink | planter | dumbwaiter | conveyor | extinguisher | return` and `process: 'multi'` (03 §2.2).
  2. Extend `LevelSchema` with the fields of 03 §2.5 and 08 §2.2: `order`, `ticketTimeBase`, `twist`, `mechanics`, `lighting`, `musicMood`, `camera`, `guide`, `feast`, `stars` as specified. All new fields have the defaults listed there so existing JSON stays valid.
  3. Extend `LayoutStationSchema` per 08 §2.3 (`props`, `zone`, `optional`).
  4. Level 1 `level.json` gains the values of 08 §3.11 item 5 and the camera block of 08 §3.8.
- Acceptance: `pnpm -C v2 check` green; golden unchanged (data only).
- Tests: `content.test.ts` `level 1 has order 1 and twist none`, `schema rejects unknown twist kind`, `schema defaults fill missing mechanics`.

### T-016 · Content catalog: items, assemblies, blends
- Phase: P2
- Depends on: T-015
- Model hint: haiku
- Read first: 03 §4.1-4.4, 03 §5.1, 03 §5.2, 02 §5.4
- Files: `v2/packages/content/src/data/rush/items.json`, `assemblies.json` (new), `blends.json` (new), `v2/packages/content/src/data/rush/index.ts`, `content.test.ts`
- Steps:
  1. Add every item of 03 §4 (48 ids in total with the existing ones) with the exact fields given in the tables.
  2. Create `assemblies.json` and `blends.json` from 03 §5.1 and §5.2, validated by new zod schemas `AssemblySchema`, `BlendSchema` (03 §2.8).
  3. Export `rushAssemblies`, `rushBlends` from `index.ts`.
- Acceptance: `pnpm -C v2 validate` green; item count is 48.
- Tests: `content.test.ts` `48 items`, `every assembly input and output exists`, `every blend output exists`.

### T-017 · Content catalog: stations and recipes (13 recipes)
- Phase: P2
- Depends on: T-016
- Model hint: haiku
- Read first: 03 §5.3, 03 §6, 03 §2.3
- Files: `v2/packages/content/src/data/rush/stations.json`, `recipes.json`, `content.test.ts`
- Steps:
  1. Add every station def of 03 §5.3 (blender, sink, rack, plate return, extinguisher, planter, dumbwaiter, conveyor, coating, mixer, press, toaster, oven, ...), exactly as the table.
  2. Add the 13 recipes of 03 §6 with prep chains in `prep` fields as given.
  3. Do not touch levels.
- Acceptance: `pnpm -C v2 validate` green; golden unchanged.
- Tests: `13 recipes`, `every recipe component is producible by its listed chain` (walk the chain through items, assemblies, blends and station defs).

### T-018 · Content validation: the 15 checks
- Phase: P2
- Depends on: T-017
- Model hint: sonnet
- Read first: 03 §10, 09 §7
- Files: `v2/packages/content/src/validate.ts`, `v2/packages/content/src/validate.test.ts` (new)
- Steps:
  1. Implement each of the 15 checks of 09 §7 as a named function returning `string[]` errors; `pnpm validate` runs all and exits 1 on any error.
  2. Include the checks from T-005 and `spawns >= 6`.
  3. Add a negative fixture per check.
- Acceptance: `pnpm -C v2 validate` green on current content; each negative fixture fails with its check name.
- Tests: `validate.test.ts` one test per check (15).

### T-019 · LEVEL_ORDER and level registry
- Phase: P2
- Depends on: T-015
- Model hint: haiku
- Read first: 01 §7.2, 03 §14, 08 §1.5
- Files: `v2/packages/content/src/data/rush/index.ts`, `v2/packages/content/src/index.ts`, `content.test.ts`
- Steps:
  1. Export `LEVEL_ORDER: readonly string[]` (the 10 ids of 08 §1.5; the registry only loads those whose folder exists, and `LEVEL_ORDER` lists all 10), `levelIndex(id)`, and make `rushLevels` load from per-level folders by a generated static import list `levels/index.ts`.
  2. Add `levelAvailable(id)` returning whether the level data exists (levels 2-10 are false until added).
- Acceptance: `pnpm -C v2 check` green.
- Tests: `LEVEL_ORDER has 10 unique ids`, `level 1 is available`, `levelIndex of l01_kiosque is 0`.

### T-020 · RunConfig, SIM_VERSION, contentHash, difficulty
- Phase: P2
- Depends on: T-014, T-018, T-019
- Model hint: sonnet
- Read first: 01 §7.6, 02 §15.3, 02 §17.1
- Files: `v2/packages/shared/src/runConfig.ts` (new), `v2/packages/shared/src/index.ts`, `v2/packages/content/src/data/rush/contentHash.ts` (new), `v2/packages/sim/src/rush/sim.ts`, `v2/packages/sim/src/rush/version.ts` (new)
- Steps:
  1. Add `RunConfig` exactly as in 01 §7.6 (seed u32, levelId, players, difficulty, assist, slots) and `SIM_VERSION = 1` in `version.ts`.
  2. `contentHash()` = FNV-based 16-hex over canonical JSON of items, stations, recipes, assemblies, blends and every available level (sorted keys).
  3. `RushSim.create(config)` and `RushOptions.difficulty` with the effect of 02 §15.3 (snack/meal/feast scaling); default `meal` keeps level 1 unchanged.
- Acceptance: `pnpm -C v2 check` green; golden unchanged with `difficulty: 'meal'`.
- Tests: `runConfig.test.ts`: `contentHash is stable across two loads`, `contentHash changes when a recipe score changes (fixture)`, `difficulty snack lengthens ticket time`, `create(config) equals new RushSim(options)`.

### T-021 · RunResult, result(), hash() alias, SlotResult
- Phase: P2
- Depends on: T-020
- Model hint: haiku
- Read first: 02 §17.1, 01 §7.6 (RunResult)
- Files: `v2/packages/sim/src/rush/sim.ts`, `v2/packages/sim/src/rush/types.ts`, `v2/packages/sim/src/rush/index.ts`
- Steps:
  1. Add `RunResult` and `SlotResult` as in 01 §7.6/02 §17.1 and `result()` valid in phase `ended` (throws otherwise).
  2. Add per-slot counters (`served`, `wrong`, `thrown`); `hash()` aliases `stateHash()`.
  3. Per-slot counters are not hashed unless 02 §17.4 lists them (it does not).
- Acceptance: `pnpm -C v2 check` green; golden unchanged.
- Tests: `result() throws before the end`, `result totals equal sum of slots`.

### T-022 · Input: RB_T button and the 5-byte codec
- Phase: P2
- Depends on: T-002
- Model hint: haiku
- Read first: 02 §4.1, 02 §4.2, 02 §4.3, 02 §4.4
- Files: `v2/packages/sim/src/rush/types.ts`, `v2/packages/sim/src/rush/codec.ts` (new), `v2/packages/sim/src/rush/sim.ts`, `v2/packages/sim/src/rush/codec.test.ts` (new)
- Steps:
  1. Add `RB_T` to the button bits and clamping on entry (02 §4.2). Throw edge handling is a no-op until the throw ticket T-104 is implemented (the button is stored in `lastButtons` and hashed; the throw action itself is added by T-104).
  2. Implement `encodeRushInput` / `decodeRushInput` (5 bytes) exactly as 02 §4.4.
  3. Hash `lastButtons` as already specified (this does not change level 1 hash because T bit is 0).
- Acceptance: `pnpm -C v2 check` green; golden unchanged.
- Tests: `codec.test.ts`: round trip of 100000 random inputs (seeded PRNG), clamping of out-of-range move, `RB_T` bit position.

### T-023 · Snapshot and restore
- Phase: P2
- Depends on: T-014, T-021
- Model hint: sonnet
- Read first: 02 §17.3, 02 §17.4
- Files: `v2/packages/sim/src/rush/snapshot.ts` (new), `v2/packages/sim/src/rush/sim.ts`, `v2/packages/sim/src/rush/snapshot.test.ts` (new)
- Steps:
  1. Implement `snapshot()` and `restore()` exactly as the layout of 02 §17.3 (`SNAPSHOT_VERSION` = 1).
  2. `restore` requires a sim built from the same `RunConfig`; it throws `snapshot version` or `snapshot mismatch` otherwise.
- Acceptance: `pnpm -C v2 check` green.
- Tests: `snapshot.test.ts`: `restore(snapshot()) then N steps equals N steps` (N = 600, bot inputs, 1 and 6 players), `snapshot bytes are identical for equal states`, `restore into wrong config throws`.

### T-024 · State hash: target field layout
- Phase: P2
- Depends on: T-023
- Model hint: sonnet
- Read first: 02 §17.4, 09 §6.4
- Files: `v2/packages/sim/src/rush/sim.ts`, `v2/packages/sim/src/rush/hashFields.ts` (new), `v2/packages/sim/src/rush/determinism.test.ts`, golden file
- Steps:
  1. Move hashing to `hashFields.ts` and make it match 02 §17.4 field by field, in the order given.
  2. Add the "state coverage" test of 09 §6.4: serialize every mutable field of `RushSim` by reflection over `snapshot()` keys and assert each appears in the hash input list (a manually maintained allowlist in the test names the exceptions).
  3. Re-baseline the golden (message says so).
- Acceptance: `pnpm -C v2 check` green; golden re-baselined.
- Tests: `state coverage: every snapshot field is hashed or allowlisted`, `hash differs when any single chef field changes`.

### T-025 · Six-player scaling and difficulty buckets
- Phase: P2
- Depends on: T-007, T-020
- Model hint: haiku
- Read first: 02 §15.1, 02 §15.2, 02 §15.4
- Files: `v2/packages/sim/src/rush/sim.ts`, `v2/packages/sim/src/rush/pacing.ts`, `v2/packages/sim/src/rush/rush.test.ts`
- Steps:
  1. Verify and implement the bucket effects of 02 §15.2 for players 1-6 (optional stations enabled from squad, rate multipliers per bucket, active ticket counts).
  2. Chef slots beyond `players` are not created.
- Acceptance: `pnpm -C v2 check` green; golden unchanged for 1 and 2 players.
- Tests: `bucket scaling players 1-6`, `ticket rate is monotonic in players`.

### T-026 · Generic recipe-driven bot
- Phase: P2
- Depends on: T-001, T-017
- Model hint: sonnet
- Read first: 09 §5.1, 09 §5.2, 09 §5.3, 02 §18 item 4
- Files: `v2/packages/sim/src/rush/bot.ts`, `v2/packages/sim/src/rush/botPlan.ts` (new), `v2/packages/sim/src/rush/bot.test.ts` (new)
- Steps:
  1. Replace the fries-only bot by a bot that reads each ticket's recipe, expands it through recipe prep chains (03 §6.1) into a station plan, and drives the stick and buttons (A edge 2 ticks, X hold) using `botNav.ts` paths. Multiple bot chefs split tickets by slot order.
  2. Keep the `RushBot` export name.
  3. Add helper `runBot(levelId, players, seed, ticks)` returning `RunResult`.
- Acceptance: on level 1 solo and duo the bot reaches the 1-star threshold and the golden test still passes (the golden uses the same bot; re-baseline if its path changes and say so).
- Tests: `bot.test.ts`: `l01 solo reaches 1 star`, `l01 duo reaches 2 stars`, `bot is deterministic (hash twice)`.

### T-027 · Determinism suite: replay, static scan, hygiene
- Phase: P2
- Depends on: T-022, T-023, T-024
- Model hint: sonnet
- Read first: 09 §6.3, 09 §6.5, 01 §5.3
- Files: `v2/packages/sim/src/rush/inlineDriver.ts` (new, `InlineSimDriver`), `v2/packages/sim/src/rush/determinism.test.ts`, `v2/packages/sim/src/rush/hygiene.test.ts` (new)
- Steps:
  1. Implement `InlineSimDriver` (in-process `SimDriver`, 01 §9.2) that runs a `RunConfig` plus an input log and returns `RunResult` and final hash.
  2. Replay test: record a bot run as a `RunLog` (in memory, 01 §7.6) and replay through `InlineSimDriver`: equal hash at the end and at each 30th tick.
  3. Hygiene test: scan `packages/sim/src` and `packages/shared/src` source text for `Math.random`, `Math.sin`, `Math.cos`, `Math.pow`, `Date.now`, `performance.now` and fail on any hit outside comments.
- Acceptance: `pnpm -C v2 check` green.
- Tests: `replay equals live run`, `no forbidden APIs in sim and shared`.

### T-028 · Worker protocol: RunConfig, driven clock, edge latching
- Phase: P2
- Depends on: T-023
- Model hint: sonnet
- Read first: 01 §8.1, 01 §8.2, 01 §8.3, 01 §8.4
- Files: `v2/packages/sim/src/protocol.ts`, `v2/packages/sim/src/worker.ts`, `v2/packages/sim/src/workerCore.ts` (new, testable without `Worker`), `v2/apps/client/src/rush/rushClient.ts`, `v2/packages/sim/src/workerCore.test.ts` (new)
- Steps:
  1. Implement the messages of 01 §8.1: `rush-init {config, clock}`, `rush-advance`, `rush-snapshot-request`, `rush-restore`, `rush-ready`, `rush-error`. Keep `clock: 'realtime'` for offline play.
  2. Put the logic in `workerCore.ts` (pure, takes messages, returns messages); `worker.ts` is a thin adapter.
  3. Edge latching (01 §8.3): button edges sampled between ticks are OR-latched and delivered on the next tick.
  4. Client: `rushClient.ts` sends `RunConfig` instead of the old init.
- Acceptance: `pnpm -C v2 check` green; game still plays in the browser offline.
- Tests: `workerCore.test.ts`: `driven clock steps exactly N ticks on rush-advance`, `hash equals InlineSimDriver for the same log`, `edge pressed between ticks is delivered once`, `snapshot request then restore continues identically`.

### T-029 · CI, import boundaries, vitest include
- Phase: P2
- Depends on: T-010
- Model hint: haiku
- Read first: 01 §2.3, 01 §2.4, 09 §14.1, 09 §14.2
- Files: `.github/workflows/v2-ci.yml` (new), `v2/eslint.config.js`, `v2/vitest.config.ts`, `v2/package.json`
- Steps:
  1. Add `no-restricted-imports` rules from 01 §2.3 (sim, shared, content, render boundaries).
  2. Vitest `include` gains `apps/**/src/**/*.test.ts` and `tests/**/*.test.ts`.
  3. Workflow: on push and PR, node 20, pnpm install, `pnpm check`, plus a second node version job for the determinism suite (09 §14.1).
- Acceptance: `pnpm -C v2 lint` green; the workflow file validates with `actionlint` if available, otherwise by `python3 -c "import yaml;yaml.safe_load(open(...))"`.
- Tests: `v2/packages/render/src/boundary.test.ts` asserting render imports neither `@ga/sim` nor `@ga/content` (grep the source).

### T-030 · Mixed-mode refactor gate: 6-player golden and per-bucket goldens
- Phase: P2
- Depends on: T-026, T-027, T-025
- Model hint: haiku
- Read first: 09 §6.2
- Files: `v2/packages/sim/src/rush/golden/l01_kiosque.json`, `v2/packages/sim/src/rush/determinism.test.ts`
- Steps:
  1. Extend the golden test to bot runs with 1, 2, 4 and 6 players at ticks 300, 1800 and the end.
  2. Re-baseline with `UPDATE_GOLDEN=1`.
- Acceptance: `pnpm -C v2 test` green; golden file has 4 entries.
- Tests: `golden hashes for 1,2,4,6 players`.

---
## Phase P3 · Art foundation

### T-040 · AssetBackend interfaces, manifest, selection
- Phase: P3
- Depends on: T-029
- Model hint: sonnet
- Read first: 01 §10.1, 01 §10.2, 01 §10.3, 04 §4.1, 04 §4.4 (selection)
- Files: `v2/packages/render/src/assets/types.ts`, `assets/index.ts`, `assets/manifest.ts`, `assets/placeholder.ts`, `assets/selection.ts`, `assets/selection.test.ts`
- Steps:
  1. Create the interfaces of 01 §10.2 with the 04 §4.1 extension fields, verbatim.
  2. `manifest.ts`: the manifest ids of the parity table in 04 §4.4 (stations, 48 items, 13 meals, chef/default, customers, props empty for now).
  3. `placeholder.ts`: a box visual sized to the footprint contract (01 §10.3) for any id.
  4. `selection.ts`: `?art=smooth` > `localStorage['pk.art']` > `'voxel'` (04 §4.4); `createAssetBackend(kind)` returns the placeholder-backed backend until T-041.
- Acceptance: `pnpm -C v2 check` green.
- Tests: `selection.test.ts` for the three precedence cases; `manifest has 48 item ids and 13 meal ids`.

### T-041 · Voxel backend: port stations, items, meals from the harbour scene
- Phase: P3
- Depends on: T-040
- Model hint: sonnet
- Read first: 04 §4.2.1-4.2.5, 04 §11.3 (existing stations), 04 §12.1-12.4
- Files: `v2/packages/render/src/assets/voxel/voxel.ts`, `mesh.ts`, `items.ts`, `stations.ts`, `props.ts`, `v2/packages/render/src/scenes/harbour/voxel.ts` (becomes a re-export), `v2/packages/render/src/assets/voxel/voxelBackend.test.ts`
- Steps:
  1. `git mv` `Palette`, `Vox` and the existing builders from `scenes/harbour/voxel.ts`, `items.ts`, `props.ts` into `assets/voxel/` and keep the old paths as re-exports.
  2. Implement `AssetBackend` for voxel: `station(def)`, `item(id, state)`, `meal(id)`, with the per-item state ramps of 04 §12.2 (raw, cooked, charred).
  3. Provide every station/item/meal id of the manifest; ones without a hand-modelled design use a procedural voxel built from the colour and footprint given in 04 §11.3 and §12.1.
- Acceptance: `pnpm -C v2 check` green; level 1 renders unchanged in the browser (screenshot compare by eye is acceptable).
- Tests: `voxelBackend.test.ts`: every manifest id returns a visual whose bbox fits the footprint within 5 % (use a headless three).

### T-042 · RenderHost and LevelDiorama (level 1 extracted from HarbourScene)
- Phase: P3
- Depends on: T-041, T-004
- Model hint: sonnet
- Read first: 04 §2.1-2.3, 04 §5.1-5.3, 01 §10.4
- Files: `v2/packages/render/src/core/renderHost.ts`, `dioramas/index.ts`, `dioramas/fallback.ts`, `dioramas/l01_kiosque.ts`, `v2/packages/render/src/scenes/harbour/harbourApp.ts` (thin wrapper), `v2/apps/client/src/rush/rushClient.ts`
- Steps:
  1. `RenderHost` owns renderer, scene, resize and the frame loop; `update(view, dt)` order per 04 §2.3.
  2. `LevelDiorama` interface from 01 §10.4; `DIORAMAS` registry keyed by level id; `fallback.ts` draws a plain floor for ids without a diorama.
  3. Move all level 1 building and update code from `HarbourScene` into `dioramas/l01_kiosque.ts`, using the `AssetBackend` for stations/items. Keep the disabled-optional rule (T-004).
  4. `HarbourApp` becomes a wrapper that creates `RenderHost` with the diorama so the client keeps working.
- Acceptance: `pnpm -C v2 check` green; level 1 looks identical; `grep -n "harbour" v2/apps/client/src` shows only wrapper use.
- Tests: `renderHost.test.ts` with a stub backend: station kinds and enabled flags map to backend calls; unknown level id uses the fallback diorama.

### T-043 · CameraRig, per-level CameraSpec, portrait fix
- Phase: P3
- Depends on: T-042
- Model hint: sonnet
- Read first: 04 §8.1-8.6, 01 §10.5
- Files: `v2/packages/render/src/camera/cameraRig.ts`, `camera/fitDistance.ts`, `camera/cameraRig.test.ts`, `v2/packages/render/src/dioramas/l01_kiosque.ts`
- Steps:
  1. Implement `CameraSpec` extensions, `CameraRig`, `fitDistance` (04 §8.2, §8.3, §8.3.1), the landscape and portrait framing fix (04 §8.4) and the shake rules with reduced motion (04 §8.6). Multi-zone framing (04 §8.5) is implemented behind the spec (used from level 5).
  2. Level 1 diorama supplies its `CameraSpec` from the level data (T-015 camera block).
  3. Re-capture `v2/docs/p2/service-1280x720-v2.png` and `service-390x844-v2.png`.
- Acceptance: `pnpm -C v2 check` green; at 390x844 the kiosk fills well over half of the height.
- Tests: `cameraRig.test.ts`: `fitDistance` cases of 04 §18 item 3 (16:9 <= 15, portrait frame inside NDC), `stage centre within 2 percent`, `shake is zero with reduced motion`.

### T-044 · Lighting rig and the 10 mood presets
- Phase: P3
- Depends on: T-042
- Model hint: haiku
- Read first: 04 §7.1-7.5, 08 §2.5
- Files: `v2/packages/render/src/lighting/rig.ts`, `lighting/moods.ts`, `lighting/moods.test.ts`
- Steps:
  1. Implement `applyMood(host, mood)` and the `MOODS` table with all 10 presets, values exactly from 04 §7.2 and style deltas 04 §7.3.
  2. Station and chef readability lights (04 §7.4).
  3. Level 1 diorama uses `harbour_noon` through the rig.
- Acceptance: tests pass; level 1 still looks like the screenshots.
- Tests: `moods.test.ts` per mood: one shadow caster, <= 4 point lights, `hemi + 0.4 sun` in [2.2, 4.2], stage/background luminance contrast >= 25 %.

### T-045 · Chef skeleton, proportions, hats (voxel)
- Phase: P3
- Depends on: T-041
- Model hint: sonnet
- Read first: 04 §9.1-9.4, 04 §3.2, 04 §17 (chef style rules)
- Files: `v2/packages/render/src/rig/chefSkeleton.ts`, `assets/voxel/chef.ts`, `rig/chefSkeleton.test.ts`
- Steps:
  1. Implement the bone tree and proportions of 04 §9.2-9.3 (total height within 1.0-1.2 m, counter 0.9 m) and the rotation sign convention (04 §3.2).
  2. Voxel chef visual with the 6 slot colours and hats of 04 §9.4 (`AssetBackend.chef(slot, hat)`).
  3. The old chef module in `scenes/harbour/chef.ts` stays unused but compiled until T-047 switches; do not delete it yet.
- Acceptance: tests pass; a debug page `?dev=1&view=chef` (already exists or added in `rushClient.ts` dev hooks) shows all 6 chefs.
- Tests: `chefSkeleton.test.ts`: bone count and parent links, total height in range, 6 distinct slot colours.

### T-046 · ChefAnimator: walk, carry, chop, interact, dash, hurt, wash, extinguish, throw
- Phase: P3
- Depends on: T-045
- Model hint: sonnet
- Read first: 04 §9.5.1-9.5.5, 04 §9.6
- Files: `v2/packages/render/src/rig/chefAnimator.ts`, `rig/chefAnimator.test.ts`
- Steps:
  1. Implement `ChefAnimator` per the contract of 04 §9.5.5: layers and blending (9.5.1), state table (9.5.2), chop swing with the exact angles (9.5.3), face states (9.5.4).
  2. Implement `chefPoseFromView(chefView, events)` of 04 §9.6.
- Acceptance: tests pass.
- Tests: the cases of 04 §18 item 5: walk arms opposite to legs, chop contact right shoulder -0.55 within 0.01 and raised -2.35 at u = 0.70, chop priority table, all bone angles within [-3.2, 3.2].

### T-047 · New chef in the level 1 diorama + customers
- Phase: P3
- Depends on: T-046, T-042
- Model hint: sonnet
- Read first: 04 §9.6, 04 §10.1-10.3
- Files: `v2/packages/render/src/dioramas/l01_kiosque.ts`, `assets/voxel/customer.ts`, `rig/customerAnimator.ts`, `rig/customerAnimator.test.ts`
- Steps:
  1. Replace the old chef in the diorama by the new chef driven through `chefPoseFromView`; delete `scenes/harbour/chef.ts`.
  2. Customers: `customer/adult|child|elder` voxel visuals, moods and reactions of 04 §10.2, order bubble (10.3) default on.
  3. Held items attach to the chef hand anchor and render at the held scale of 04 §12.3.
- Acceptance: `pnpm -C v2 check` green; in the browser the chef visibly swings the tool when chopping and the face changes when hurt.
- Tests: `customerAnimator.test.ts`: mood transitions on ticket `left` thresholds of 04 §10.2.

### T-048 · Smooth backend: builder, toon material, outline
- Phase: P3
- Depends on: T-040
- Model hint: sonnet
- Read first: 04 §4.3.1, 04 §4.3.2, 04 §4.3.3, 04 §7.3 (smooth deltas)
- Files: `v2/packages/render/src/assets/smooth/builder.ts`, `toon.ts`, `outline.ts`, `smooth.test.ts`
- Steps:
  1. Implement the primitive builder API of 04 §4.3.1 (box, rounded box, cylinder, sphere, extrude helpers, merge by material).
  2. Toon material with the 3-band ramp (04 §4.3.2) and the inverted-hull outline (04 §4.3.3).
- Acceptance: tests pass.
- Tests: `smooth.test.ts`: builder merge produces one mesh per material, outline mesh count equals source mesh count, toon material ramp has 3 distinct bands.

### T-049 · Smooth backend: stations and props
- Phase: P3
- Depends on: T-048
- Model hint: haiku
- Read first: 04 §4.3.4, 04 §11.3, 04 §11.1
- Files: `v2/packages/render/src/assets/smooth/stations.ts`, `props.ts`, `assets/smooth/stations.test.ts`
- Steps:
  1. For every station id of the manifest implement a smooth visual from primitives using the per-station spec table of 04 §11.3 (colours from palette tokens, footprint contract 01 §10.3, anchors `top`, `ring`, `front`).
  2. Register them in `smoothBackend.stations`.
- Acceptance: tests pass.
- Tests: for every station id: bbox within footprint (5 %), anchors exist.

### T-050 · Smooth backend: items, meals, chef, customers
- Phase: P3
- Depends on: T-049, T-046
- Model hint: haiku
- Read first: 04 §4.3.4, 04 §12.1-12.4, 04 §9.2, 04 §10.1
- Files: `v2/packages/render/src/assets/smooth/items.ts`, `chef.ts`, `customer.ts`, `assets/smooth/items.test.ts`
- Steps:
  1. Smooth visuals for the 48 items and 13 meals (procedural recipes from 04 §12.1, colour ramps 12.2), the chef (same skeleton, smooth parts, 9.2) and customers.
  2. Register them in `smoothBackend`.
- Acceptance: tests pass.
- Tests: the same bbox and anchor tests for all items and meals; chef skeleton bone names equal the voxel chef.

### T-051 · Backend contract tests, parity, `?art=smooth` hash parity
- Phase: P3
- Depends on: T-050, T-041
- Model hint: haiku
- Read first: 04 §4.4, 04 §18 item 1, 09 §9
- Files: `v2/packages/render/src/assets/contract.test.ts`, `v2/apps/client/src/rush/artParity.test.ts`
- Steps:
  1. `contract.test.ts` runs for both backends: every manifest id returns a visual that fits its footprint, anchors exist, no duplicate material instances per id.
  2. `artParity.test.ts`: a bot run with `art` voxel and smooth hits equal sim hashes at 5 checkpoints (the render never touches the sim).
- Acceptance: `pnpm -C v2 check` green.
- Tests: the two files above.

### T-052 · Style comparison mock: smooth 3D vs voxel, level 1 side by side
- Phase: P3
- Depends on: T-051, T-047, T-043
- Model hint: sonnet
- Read first: 04 §4.4, 04 §17, 05 §3.1 (routes, `?art`)
- Files: `v2/apps/client/src/dev/styleCompare.ts` (new), `v2/apps/client/src/main.ts`, `v2/apps/client/src/dev/styleCompare.css`, `v2/docs/p3/style-compare.md` (new, 10 lines: how to open)
- Steps:
  1. Add route `?dev=1&view=style` that renders two `RenderHost` instances side by side (voxel left, smooth right) on level 1 with identical sim, 2 bot chefs and 3 customers, same camera, with a title above each and a toggle that swaps a single full-screen host between the two.
  2. Capture screenshots at 1280x720 into `v2/docs/p3/style-voxel.png` and `style-smooth.png` (Playwright script `tools/screenshot-style.mjs` if Playwright exists, otherwise the owner captures them).
  3. Write `style-compare.md` with the URL and the decision question: "voxel or smooth?" and the single setting that makes the choice permanent (`pk.art` default in `selection.ts`).
- Acceptance: both styles animate from the same sim; no console errors.
- Tests: `styleCompare.test.ts`: both hosts receive identical station lists from the same view.

### 🎮 Owner playtest B: new chef and style decision
- Status is the checkbox of this milestone in §4. The owner opens level 1, plays with the new chef (chop, carry, dash), opens `?dev=1&view=style`, writes `Decision: voxel|smooth` into `v2/docs/p3/style-compare.md` and marks the milestone.

### T-053 · Apply the owner's style decision
- Phase: P3
- Depends on: T-052, 🎮 Owner playtest B (must be `[x]`)
- Model hint: haiku
- Read first: 04 §4.4 (selection), 04 §17
- Files: `v2/packages/render/src/assets/selection.ts`, `v2/packages/render/src/assets/selection.test.ts`
- Steps:
  1. Read the owner's decision recorded in `v2/docs/p3/style-compare.md` under the heading `Decision:` (`voxel` or `smooth`). If the heading is empty, keep `voxel` and finish.
  2. Set the default in `selection.ts` to that value and change nothing else.
- Acceptance: `pnpm -C v2 check` green; the default art equals the recorded decision.
- Tests: `selection.test.ts` updated: default equals the decision.

---
## Phase P4 · Client foundations

### T-060 · Client folder restructure
- Phase: P4
- Depends on: T-028, T-047
- Model hint: haiku
- Read first: 05 §2.1, 05 §2.2
- Files: `v2/apps/client/src/{app,screens,hud,input,audio,i18n,storage}/` (new folders), moved files from `v2/apps/client/src/rush/`, `v2/apps/client/src/main.ts`
- Steps:
  1. With `git mv`: `rush/rushHud.ts` -> `hud/hud.ts`, `rush/rushInput.ts` -> `input/inputManager.ts`, `rush/rushClient.ts` -> `screens/playScreen.ts`, `rush/voxIcon.ts` -> `hud/voxIcon.ts`, `rush/rush.css` -> `hud/hud.css`, `audio.ts` -> `audio/engine.ts` (keep a re-export file `audio.ts` for `mossback.ts`).
  2. Keep `mossback.ts`, `input.ts`, `hud.ts` (the legacy Mossback files) untouched; the new HUD file name does not clash because it lives in `hud/`.
  3. Add the core types of 05 §2.2 (`Screen`, `AppState`) as stubs in `app/appState.ts`.
  4. Fix all imports. `rush/` ends empty and is removed.
- Acceptance: `pnpm -C v2 check` green; game plays as before.
- Tests: none new; existing tests move with the files.

### T-061 · Router and screen registry
- Phase: P4
- Depends on: T-060
- Model hint: sonnet
- Read first: 05 §3.1, 05 §3.2, 05 §2.3
- Files: `v2/apps/client/src/router.ts`, `v2/apps/client/src/main.ts`, `v2/apps/client/src/screens/bootScreen.ts`, `v2/apps/client/src/router.test.ts`, `v2/netlify.toml` (SPA fallback `/* -> /index.html`)
- Steps:
  1. Implement `parseRoute`, `routeToPath`, `navigate` (History API) exactly as 05 §3.1 including legacy `?mode=giant` and `?level=1`.
  2. Screen registry with `enter/exit/back` per screen; the Back button maps to the screen's `back` command (05 §3.2); Back during a run opens the pause overlay.
  3. `main.ts` boots the router; `/play/:levelId` loads the existing play screen; `/demo/mossback` loads the Mossback demo.
  4. Add the SPA redirect to `netlify.toml` (the `/classic` rule is added by T-073).
- Acceptance: `pnpm -C v2 check` green; `/play/l01_kiosque` opens the game directly.
- Tests: `router.test.ts` for every route, the legacy params, `/r/ABCD`, an unknown path (`notfound`) and a code with invalid characters.

### T-062 · Strings and i18n: French default, key scheme, CI check
- Phase: P4
- Depends on: T-060
- Model hint: haiku
- Read first: 05 §8.1, 05 §8.2, 05 §8.3, 05 §8.4, 05 §8.5
- Files: `v2/apps/client/src/i18n/fr.ts`, `en.ts`, `format.ts`, `v2/apps/client/src/strings.ts`, `v2/tools/check-strings.ts`, `v2/package.json`, `v2/apps/client/src/i18n/i18n.test.ts`
- Steps:
  1. Move rush strings into `fr.ts`/`en.ts` with the key scheme of 8.3 and the full core key list of 8.4. Mossback keys stay in the old object.
  2. Implement `t`, `tn` (plurals `.one/.other`), `tg` (glyph substitution), `lang`, `setLang` (runtime switch, 8.2). Language default is French even for English browsers; `?lang=` sets it once.
  3. Add `tools/check-strings.ts` with the 7 checks of 8.5 and wire it into `pnpm check`.
- Acceptance: `pnpm -C v2 check` green and the check script fails if you remove one EN key (verify, then restore).
- Tests: `i18n.test.ts`: French initial with `navigator.language = 'en-US'`, plurals one/other, placeholder parity, `setLang` updates `lang()`.

### T-063 · Storage: settings, progress, bindings, migration
- Phase: P4
- Depends on: T-060
- Model hint: sonnet
- Read first: 05 §10.1, 05 §10.2, 05 §11 (settings fields)
- Files: `v2/apps/client/src/storage/store.ts`, `settings.ts`, `progress.ts`, `v2/apps/client/src/storage/storage.test.ts`
- Steps:
  1. `store.ts`: guarded `localStorage` wrapper with in-memory fallback.
  2. `settings.ts`: zod `Settings` schema with the defaults of 05 §10.1, read/write `pk.settings.v1`; mirror `art` to `pk.art`.
  3. `progress.ts`: `pk.progress.v1` per level per bucket `{best, stars}`, stars computed from level thresholds; one-time migration of `pk.best.<level>.<bucket>`.
  4. `applySettings(settings)` per 05 §10.2 (volume, language, reduced motion, text scale, HUD size, colour-blind mode) as pure DOM class/CSS-variable changes.
- Acceptance: `pnpm -C v2 check` green.
- Tests: `storage.test.ts`: schema round trip, defaults on corrupt JSON, legacy migration gives the same best and stars, unavailable storage falls back to memory without throwing.

### T-064 · Input: gamepad, keyboard schemes A and B, bindings
- Phase: P4
- Depends on: T-022, T-063
- Model hint: sonnet
- Read first: 05 §6.1, 05 §6.2, 05 §6.3, 05 §6.6
- Files: `v2/apps/client/src/input/gamepad.ts`, `keyboard.ts`, `bindings.ts`, `inputManager.ts`, `menuNav.ts`, `v2/apps/client/src/input/input.test.ts`
- Steps:
  1. Implement sources and sampling per 05 §6.1 (latching, one frame per seat per tick, `blur` clears keys).
  2. Gamepad standard mapping and deadzone 0.18, diagonal clamp (6.2): A -> `RB_A`, B/RB -> `RB_B`, X/RT -> `RB_X`, Y/LT -> `RB_T`.
  3. Keyboard by physical `code` (AZERTY and QWERTY), schemes A and B at once (6.3), overrides from `pk.bindings.v1`.
  4. `menuNav.ts` per 6.6 (focus movement by stick, d-pad, arrows; confirm and back).
  5. Throw is dropped when `level.mechanics.throw` is false.
- Acceptance: `pnpm -C v2 check` green; two chefs on one keyboard work.
- Tests: `input.test.ts` the table-driven cases of 05 §12 item 3.

### T-065 · Mouse reach logic, glyph tables, contextual prompts
- Phase: P4
- Depends on: T-064, T-062, T-003
- Model hint: sonnet
- Read first: 05 §6.4, 05 §7.1, 05 §7.2
- Files: `v2/apps/client/src/input/mouse.ts`, `hud/glyphs.ts`, `hud/prompts.ts`, `v2/apps/client/src/hud/prompts.test.ts`
- Steps:
  1. Move the mouse code from T-003 into `mouse.ts` (reach hint, `pickStation` by footprint per 04 §15.4).
  2. `glyphs.ts`: glyph tables per device kind (keyboard with the AZERTY label of `KeyW` = `Z` via `navigator.keyboard.getLayoutMap` with fallback, Xbox, PlayStation, Switch swaps); `glyph(action, device)` always shows the real binding.
  3. `prompts.ts`: contextual prompt bubbles over the chef and the learning rule (shrink after 3 successes, counters in `pk.seen.v1`); no bubbles for remote chefs.
- Acceptance: `pnpm -C v2 check` green.
- Tests: `prompts.test.ts` and `glyphs.test.ts` per 05 §12 items 5 and 6 (learning rule, AZERTY label, PlayStation swap, no "Clic gauche" for grab on keyboard).

### T-066 · Seats and couch join
- Phase: P4
- Depends on: T-064
- Model hint: sonnet
- Read first: 05 §5, 01 §9.2 (`LocalSeat`)
- Files: `v2/apps/client/src/app/seats.ts`, `v2/apps/client/src/app/seats.test.ts`
- Steps:
  1. Implement `SeatManager` of 05 §5 with rules 1-9 (max 4, duplicate source rejected, slot and colour by join order, compaction between runs, ready-check start rule: all ready, 1 seat 6 s, force hold 1 s).
  2. Wire it to the input manager so `sample()` returns one frame per seat.
- Acceptance: `pnpm -C v2 check` green.
- Tests: `seats.test.ts` per 05 §12 item 4.

### T-067 · Title and level select screens
- Phase: P4
- Depends on: T-061, T-062, T-063, T-066, T-019
- Model hint: sonnet
- Read first: 05 §4.2, 05 §4.3, 05 §3.2
- Files: `v2/apps/client/src/screens/titleScreen.ts`, `levelSelectScreen.ts`, `v2/apps/client/src/screens/screens.css`, `v2/apps/client/src/screens/levelSelect.test.ts`
- Steps:
  1. Title: French default, "Jouer", "En ligne" (disabled until P6, label "Bientôt"), "Réglages", the 3D orbit title mode (04 §8.6), language toggle.
  2. Level select from `LEVEL_ORDER`: cards with name, stars per bucket, lock state (a level unlocks when the previous has at least 1 star; `?unlock=all` dev flag), unavailable levels (`levelAvailable` false) show "Bientôt".
  3. Pad focus navigation through `menuNav`; the source that confirms becomes seat 0.
- Acceptance: `pnpm -C v2 check` green; the title opens the game via level select.
- Tests: `levelSelect.test.ts`: lock rule, stars display from `pk.progress.v1`, unavailable card is not focusable-to-play.

### T-068 · Intro card, couch join row, countdown
- Phase: P4
- Depends on: T-066, T-067
- Model hint: sonnet
- Read first: 05 §4.4, 05 §4.5
- Files: `v2/apps/client/src/screens/introScreen.ts`, `screens/playScreen.ts`, `v2/apps/client/src/screens/intro.test.ts`
- Steps:
  1. Intro card: level name, setting, goal, new mechanic (`level.<id>.*` strings), seat row with join prompts, bucket name; no auto start (replace the 3 s auto start by the ready-check of 05 §5 rule 1/ §4.4).
  2. Countdown 3-2-1-Go (4.5) wired to the sim countdown phase.
  3. Starting the run sends a `RunConfig` with `players = seats.length`.
- Acceptance: `pnpm -C v2 check` green.
- Tests: `intro.test.ts`: ready rule with 1 and 3 seats, bucket label from the seat count.

### T-069 · HUD split: tickets, clock, rings, toasts; guide arrow
- Phase: P4
- Depends on: T-065, T-043
- Model hint: sonnet
- Read first: 05 §4.1, 05 §4.6, 05 §7.3, 04 §15.1-15.3
- Files: `v2/apps/client/src/hud/hud.ts`, `hud/tickets.ts`, `hud/clock.ts`, `hud/rings.ts`, `hud/toasts.ts`, `hud/guide.ts`, `v2/packages/render/src/fx/markers.ts`, `v2/apps/client/src/hud/guide.test.ts`
- Steps:
  1. Split `hud.ts` into the files above; behaviour identical, layout per 05 §4.1 for landscape and portrait.
  2. Implement `guideTarget(view, level.guide)` and the guide arrow marker (render `fx/markers.ts`, 04 §15.1) for the first order only, driven by `level.guide` data and the `firstOrder` view flag.
  3. Target glow and hover ring (04 §15.2).
- Acceptance: `pnpm -C v2 check` green; the level 1 first order shows the arrow in the browser.
- Tests: `guide.test.ts`: replay of the 11 level 1 guide rules with synthetic `RushView`s (05 §12 item 6).

### T-070 · Pause overlay and results screen
- Phase: P4
- Depends on: T-067, T-068
- Model hint: sonnet
- Read first: 05 §4.7, 05 §4.8, 05 §3.2
- Files: `v2/apps/client/src/screens/pauseOverlay.ts`, `screens/resultsScreen.ts`, `app/progressUpdate.ts`, `v2/apps/client/src/screens/results.test.ts`
- Steps:
  1. Pause: resume, restart, settings (`?from=pause`), quit to level select; Esc and pad Start; the sim is paused by not advancing (offline: `clock` realtime paused).
  2. Results: score, stars, served/expired/wrong, record flag, per-seat table when `SlotResult` is present, "Rejouer", "Niveau suivant", "Niveaux".
  3. On results update `pk.progress.v1` (best and stars) and unlock the next level.
- Acceptance: `pnpm -C v2 check` green.
- Tests: `results.test.ts`: stars thresholds, record detection, next-level unlock, per-seat table hidden without slots.

### T-071 · Settings screen and accessibility basics
- Phase: P4
- Depends on: T-063, T-070
- Model hint: haiku
- Read first: 05 §4.10, 05 §11
- Files: `v2/apps/client/src/screens/settingsScreen.ts`, `hud/a11y.css`, `v2/apps/client/src/screens/settings.test.ts`
- Steps:
  1. Settings screen: language, master/sfx/music volume, art style (writes `pk.art`, shows "redémarrage nécessaire"), reduced motion, text scale (100/125/150 %), colour-blind mode, key rebinding for schemes A and B.
  2. Implement the accessibility rules of 05 §11 that are DOM-only (focus order, aria-labels, contrast, no flashing > 3 Hz, reduced motion CSS).
- Acceptance: `pnpm -C v2 check` green.
- Tests: `settings.test.ts`: every setting round-trips and applies its CSS class or variable.

### T-072 · Classic V1 proxy and headers (07 B11)
- Phase: P4
- Depends on: T-061
- Model hint: haiku
- Read first: 07 §11.1, 07 §11.2, 07 §11.3, 07 §11.4
- Files: `v2/netlify.toml`, `netlify.toml` (root V1, only if 07 §11.4 says so), `v2/apps/client/src/screens/titleScreen.ts`, `v2/tests/netlify-config.test.ts`
- Steps:
  1. Add the `/classic` redirect/proxy and headers exactly as 07 §11.2-11.3.
  2. Apply the minimal V1 changes of 07 §11.4 (base URL / CORS) in the V1 tree.
  3. Title screen gets a small "Version classique" link (hard navigation).
- Acceptance: `pnpm -C v2 check` green.
- Tests: `netlify-config.test.ts` parses `v2/netlify.toml` and asserts the `/classic` rule precedes the SPA fallback.

### T-073 · Playwright setup, screenshot matrix, overflow and smoke tests
- Phase: P4
- Depends on: T-070, T-071
- Model hint: sonnet
- Read first: 09 §8.1, 09 §8.2, 09 §8.3, 09 §8.4
- Files: `v2/e2e/playwright.config.ts`, `v2/e2e/screens.spec.ts`, `v2/e2e/overflow.spec.ts`, `v2/e2e/smoke.spec.ts`, `v2/package.json`
- Steps:
  1. Add `@playwright/test`; config with the matrix of 09 §8.2 (1280x720 and 390x844, FR and EN) and the dev server as `webServer`.
  2. Screenshot spec for title, levels, intro (1 and 4 seats), countdown, HUD, pause, results.
  3. Overflow check of 09 §8.3 on every screen and combination.
  4. Smoke tests of 09 §8.4, including: click out of reach does not walk; a bot-less keyboard player can finish a short run.
  5. Scripts `pnpm e2e` and `pnpm e2e:update`; baselines committed under `v2/e2e/__screenshots__/`.
- Acceptance: `pnpm -C v2 e2e` green.
- Tests: the three spec files.

### T-074 · Audio engine and the core sound list
- Phase: P4
- Depends on: T-063, T-060
- Model hint: sonnet
- Read first: 05 §9.1, 05 §9.2
- Files: `v2/apps/client/src/audio/engine.ts`, `audio/recipes.ts`, `v2/apps/client/src/audio/audio.test.ts`
- Steps:
  1. Buses (master, sfx, music, amb), voice cap 24, per-sound cooldown, panning by station x, as 9.1.
  2. Implement every `SoundRecipe` of the 9.2 table as data; wire sim events to sounds in `screens/playScreen.ts`.
- Acceptance: `pnpm -C v2 check` green; the game has sound for chop, fry, serve, burn, dash.
- Tests: `audio.test.ts`: each recipe renders in an `OfflineAudioContext` (non-silent, peak <= 0.95, length <= dur + 0.1 s); voice cap and cooldown.

### 🎮 Owner playtest C: menus, seats, HUD and level 1
- Status is the checkbox of this milestone in §4. The owner goes title -> level select -> intro -> run -> results with keyboard and a gamepad, adds a second player on the intro, toggles FR/EN, and checks portrait layout.

---
## Phase P5 · Levels 2 to 10

Every level follows the same three-part pattern: system tickets (new station kinds, hooks), one **content ticket** (`level.json`, `layout.json`, strings, goldens, level suite, calibrated stars) and one **diorama ticket** (dressing, ambient life, lighting, camera). A level is playable before its diorama exists thanks to `dioramas/fallback.ts`. The design checklist of 08 §14.1 is reviewed at the owner playtest after the level.

### T-100 · Level checks tool (`check-levels`)
- Phase: P5a
- Depends on: T-018, T-053
- Model hint: sonnet
- Read first: 08 §14.2, 08 §1.3, 08 §1.4
- Files: `v2/tools/check-levels.ts`, `v2/tools/check-levels.test.ts`, `v2/package.json` (wire into `pnpm validate`)
- Steps:
  1. Implement the 10 pure checks of 08 §14.2 (overlaps, grid alignment, spawns = 6, corridor width by one-cell erosion, optional rule, recipe coverage in the base station set, zones, camera bounds at 16:9 and 4:3, stars ascending, pacing).
  2. Run it over every available level in `pnpm validate`; exit 1 on any failure with `<level>: <check>: <detail>`.
  3. One negative fixture per check.
- Acceptance: `pnpm -C v2 validate` green on level 1 (fix level 1 data only if a check finds a real violation, and note it).
- Tests: `check-levels.test.ts`: 10 negative fixtures plus level 1 passes.

### T-101 · Star calibration tool and twist-aware bot mode
- Phase: P5a
- Depends on: T-026, T-100
- Model hint: sonnet
- Read first: 08 §15, 09 §5.3, 09 §5.4
- Files: `v2/tools/calibrate-stars.ts`, `v2/packages/sim/src/rush/bot.ts`, `v2/packages/sim/src/rush/botPlan.ts`, `v2/package.json` (scripts `calibrate-stars`, `stars`), `v2/tools/calibrate-stars.test.ts`
- Steps:
  1. Implement `pnpm calibrate-stars <levelId>`: for solo, duo, squad, party run the bot on 20 seeds (`1000 + i`), take the median as `botMax`, write stars `0.30/0.55/0.75 x botMax` rounded to 50 with ascending enforcement into `level.json` (08 §15 step 3).
  2. Bot gets `mode: 'twist-aware' | 'twist-ignorant'` (reads `view.twist` ticks and avoids blocked stations only in aware mode); the tool prints the aware/ignorant ratio.
  3. `pnpm stars` runs calibration in check mode (no write) and fails if committed stars differ from the computed ones by more than 15 %.
- Acceptance: `pnpm -C v2 calibrate-stars l01_kiosque` runs in under 120 s and prints four lines.
- Tests: `calibrate-stars.test.ts`: rounding, ascending enforcement, median of a fixed list.

### T-102 · Level 2 · Le Food Truck du Festival: content
- Phase: P5a
- Depends on: T-100, T-101, T-017, T-067
- Model hint: sonnet
- Read first: 08 §4.1, 08 §4.3, 08 §4.4, 08 §4.6, 08 §4.7, 08 §4.10, 08 §4.12, 08 §14.3
- Files: `v2/packages/content/src/data/rush/levels/l02_foodtruck/level.json`, `layout.json`, `levels/index.ts`, `v2/apps/client/src/i18n/fr.ts`, `en.ts`, `v2/packages/sim/src/rush/levels/l02.test.ts`, `golden/l02_foodtruck.json`
- Steps:
  1. Write `level.json` and `layout.json` exactly from the 08 §4.3 grid and tables (stations, spawns = 6, queue, bounds, optional rule), recipes `french_fries` and `hamburger`, twist `none`, lighting `festival_dusk`, music mood from 08 §4.8, guide from 08 §4.10. Register in `levels/index.ts`.
  2. Strings: `level.l02_foodtruck.name|setting|goal|new` FR and EN.
  3. Run `pnpm validate` and fix data until the checks pass.
  4. Run `pnpm calibrate-stars l02_foodtruck` and commit the stars; generate the golden file with `UPDATE_GOLDEN=1` for 1, 2, 4, 6 players.
  5. Add level 2 to the station smoke test.
- Acceptance: `pnpm -C v2 check` green; level 2 is selectable and finishes with the bot at every bucket; the level 1 golden is unchanged.
- Tests: `l02.test.ts`: the 08 §4.12 cases, `burn window of the patty (180 cook, warn at +120, burnt at +180)`, `hamburger shares plate and pass with fries`, `no deadlock in a calm run with 1, 2, 4, 6 bots`.

### T-103 · Level 2 diorama (festival truck)
- Phase: P5a
- Depends on: T-102, T-044, T-047
- Model hint: sonnet
- Read first: 08 §4.2, 08 §4.8, 08 §4.9, 04 §5.1-5.3, 04 §14
- Files: `v2/packages/render/src/dioramas/l02_foodtruck.ts`, `dioramas/index.ts`, `assets/voxel/props.ts`, `assets/smooth/props.ts`, `lighting/moods.ts`, `v2/packages/render/src/dioramas/l02_foodtruck.test.ts`
- Steps:
  1. Build the diorama from the 08 §4.9 dressing list with both backends' props (`prop/l02_foodtruck/*` manifest ids), the 08 §4.8 camera spec and the `festival_dusk` mood; ambient life within budget (12 desktop / 6 mobile, 04 §14).
  2. Register in `DIORAMAS`; add the manifest ids.
- Acceptance: `pnpm -C v2 check` green; screenshots 1280x720 and 390x844 attached under `v2/docs/p5/l02-*.png`; backgrounds not walled (08 §1.3.2).
- Tests: `l02_foodtruck.test.ts`: all prop ids exist in the manifest, ambient entity count <= 12, camera spec fits bounds (reuse `fitDistance`).

### T-104 · Throw mechanic (sim)
- Phase: P5a
- Depends on: T-014, T-022, T-102
- Model hint: sonnet
- Read first: 02 §9.1-9.4, 02 §7.3 (throw rows), 02 §12 (step 6), 02 §3.1
- Files: `v2/packages/sim/src/rush/throw.ts`, `sim.ts`, `interact.ts`, `state.ts`, `types.ts`, `v2/packages/sim/src/rush/throw.test.ts`
- Steps:
  1. Implement launch (`RB_T` edge, `throwCd`), projectile flight in step 6 in creation order, landing on a counter/catcher/floor, and floor items with 600-tick despawn, exactly per 02 §9.
  2. Gate by `level.mechanics.throw`; the button is ignored when false.
  3. Events `Thrown`, `Caught`, `Landed`, `FloorItemExpired`; `SlotResult.thrown` counter.
  4. Projectiles are part of snapshot and hash (already in 02 §17.4 layout).
- Acceptance: `pnpm -C v2 check` green; goldens of levels 1 and 2 unchanged.
- Tests: `throw.test.ts`: thrown plate to an empty-handed teammate is caught; lands on a counter; miss lands on the floor and despawns at 600 ticks; throw ignored when the mechanic is off; snapshot round trip with a projectile in flight.

### T-105 · Level 3 · Diner Route 66: split counter hook and content
- Phase: P5a
- Depends on: T-104, T-102
- Model hint: sonnet
- Read first: 08 §5.1, 08 §5.3, 08 §5.4, 08 §5.5, 08 §5.6, 08 §5.7, 08 §5.10, 08 §5.12, 02 §16.1
- Files: `v2/packages/sim/src/rush/hooks/splitCounter.ts`, `hooks/index.ts`, `v2/packages/content/src/data/rush/levels/l03_diner/level.json`, `layout.json`, `levels/index.ts`, `v2/apps/client/src/i18n/fr.ts`, `en.ts`, `v2/packages/sim/src/rush/levels/l03.test.ts`, `golden/l03_diner.json`
- Steps:
  1. Implement the static `split_counter` hook (params `gapCells: 4`): the bar blocks walking, allows placing and throwing across, per 08 §5.5.
  2. Level data from the 08 §5.3 grid and 08 §5.4 tables: recipes `french_fries`, `hamburger`, `cheeseburger_combo`, mechanics `{ throw: true }`, guide for the first throw (08 §5.10).
  3. Strings, calibrate stars, golden for 1/2/4/6 players, station smoke test entry.
- Acceptance: `pnpm -C v2 check` green; bot completes level 3 at all buckets (it uses throw across the bar).
- Tests: `l03.test.ts`: the 08 §5.12 cases; `a cooked patty thrown across the bar lands on the south counter`; `the bar blocks walking but not a thrown item`; golden unchanged for levels 1-2.

### T-106 · Throw: client controls, aim marker, render and sound
- Phase: P5a
- Depends on: T-104, T-069, T-050
- Model hint: sonnet
- Read first: 05 §6.2 (Y/LT), 05 §6.3 (throw key), 05 §7.1 (throw prompt), 04 §9.5.2 (throw pose), 04 §13 (throw trail), 05 §9.2 (throw sounds)
- Files: `v2/apps/client/src/input/keyboard.ts`, `hud/prompts.ts`, `v2/packages/render/src/dioramas/l01_kiosque.ts` (shared projectile rendering moves to `v2/packages/render/src/fx/projectiles.ts`), `fx/projectiles.ts`, `fx/particles.ts`, `v2/apps/client/src/audio/recipes.ts`
- Steps:
  1. Render projectiles from `view.projectiles` (arc visual using the item visual, shadow blob on the ground, trail particles), and floor items from `view.floorItems`.
  2. Throw pose from `chefPoseFromView` on the `Thrown` event; aim marker: a faint landing circle at the predicted target (reuse `stationInReach` target rules of 02 §9.1).
  3. Prompt "Lancer" when holding an item and `mechanics.throw`; sounds `throw`, `catch`.
- Acceptance: `pnpm -C v2 check` green; in level 3 throwing across the bar is visible and audible.
- Tests: `projectiles.test.ts` (render): the arc height at t = 0.5 equals the sim apex; the shadow follows the ground position.

### T-107 · Level 3 diorama (Route 66 diner)
- Phase: P5a
- Depends on: T-105, T-103
- Model hint: haiku
- Read first: 08 §5.2, 08 §5.8, 08 §5.9, 04 §5.2
- Files: `v2/packages/render/src/dioramas/l03_diner.ts`, `dioramas/index.ts`, `assets/voxel/props.ts`, `assets/smooth/props.ts`, `lighting/moods.ts`, `v2/packages/render/src/dioramas/l03_diner.test.ts`
- Steps:
  1. Same recipe as T-103 for the 08 §5.9 dressing list, 08 §5.8 camera and mood.
- Acceptance: as T-103 with screenshots `v2/docs/p5/l03-*.png`.
- Tests: as T-103.

### 🎮 Owner playtest D: levels 2 and 3 (and throw)
- Status is the checkbox of this milestone in §4. The owner plays levels 2 and 3 solo and duo: stove burn window, hamburger and cheeseburger, throwing across the diner bar.

### T-108 · Dishes cycle, blender, sink, plate return (sim)
- Phase: P5a
- Depends on: T-013, T-105
- Model hint: sonnet
- Read first: 02 §6.6, 02 §6.7, 02 §6.8, 02 §11.1, 02 §11.2, 02 §7.3 (wash rows), 03 §5.2 (blends)
- Files: `v2/packages/sim/src/rush/stations/blender.ts`, `sink.ts`, `return.ts`, `stations/index.ts`, `sim.ts`, `items.ts`, `v2/packages/sim/src/rush/dishes.test.ts`
- Steps:
  1. Blender (`processor` `multi`): accepts up to 3 distinct inputs, starts at the third, 120 ticks, output per `blends.json`.
  2. Sink: hold X to wash a dirty plate (`mechanics.wash`), `dirty` to `clean` per 6.7; plate return: dirty plates reappear 240 ticks after serve (cycle mode, `mechanics.dishes = 'cycle'`).
  3. Infinite mode (levels 1-3) unchanged.
- Acceptance: `pnpm -C v2 check` green; goldens of levels 1-3 unchanged.
- Tests: `dishes.test.ts`: with 4 plates the pool count is constant over a run; a dirty plate returns after 240 ticks; the blender takes inputs in any order and cooks 120 ticks; washing needs X held for the specified ticks.

### T-109 · Tide twist hook
- Phase: P5a
- Depends on: T-014, T-100
- Model hint: sonnet
- Read first: 08 §6.5, 08 §2.4 (phaseAt, ejectChefs), 02 §16.1, 02 §16.2
- Files: `v2/packages/sim/src/rush/hooks/phase.ts`, `hooks/tide.ts`, `hooks/index.ts`, `v2/packages/sim/src/rush/hooks/tide.test.ts`
- Steps:
  1. Implement `phaseAt` exactly as 08 §2.4 in `phase.ts` (shared by all dynamic twists).
  2. Implement the tide hook: `TideRising/TideIn/TideOut` events, `speedMulQ8` in the flood zone, `isBlocked`/`ejectChefs` per 08 §6.5 with the params of the level.
- Acceptance: `pnpm -C v2 check` green.
- Tests: `tide.test.ts`: events fire at the exact ticks (first flood 1200 with warn 90), telegraph precedes the effect by >= 60 ticks, chefs in the flood zone slow to `slowQ8`, `phaseAt` table of cases.

### T-110 · Level 4 · Bar à Smoothies: content
- Phase: P5a
- Depends on: T-108, T-109
- Model hint: sonnet
- Read first: 08 §6.1, 08 §6.3, 08 §6.4, 08 §6.5, 08 §6.6, 08 §6.7, 08 §6.10, 08 §6.12
- Files: `v2/packages/content/src/data/rush/levels/l04_smoothies/level.json`, `layout.json`, `levels/index.ts`, `i18n/fr.ts`, `en.ts`, `v2/packages/sim/src/rush/levels/l04.test.ts`, `golden/l04_smoothies.json`
- Steps:
  1. Level data from the 08 §6.3 grid and 08 §6.4 tables: `salad`, `fruit_yogurt_bowl`, `smoothie`; mechanics `{ throw: true, wash: true, dishes: 'cycle' }`; twist `tide` with the params of 08 §6.2.
  2. Strings, calibrate stars (twist-aware vs ignorant ratio must be >= 1.10), goldens, smoke test entry.
- Acceptance: `pnpm -C v2 check` green; bot completes level 4 at all buckets.
- Tests: `l04.test.ts`: the 08 §6.12 cases, `smoothie chain banana strawberry milk blender cup`, `tide telegraph ticks`, goldens of levels 1-3 unchanged.

### T-111 · Level 4 diorama and wash/blender feedback
- Phase: P5a
- Depends on: T-110, T-103
- Model hint: haiku
- Read first: 08 §6.2, 08 §6.8, 08 §6.9, 04 §11.3 (blender, sink), 04 §13 (splash), 04 §6.1
- Files: `v2/packages/render/src/dioramas/l04_smoothies.ts`, `dioramas/index.ts`, `assets/voxel/props.ts`, `assets/smooth/props.ts`, `lighting/moods.ts`, `fx/particles.ts`, `v2/packages/render/src/dioramas/l04_smoothies.test.ts`
- Steps:
  1. Beach bar dressing, tide water plane animation with the telegraph (foam line 90 ticks before flooding), wash splash and blender whirl particles.
  2. Tide visual follows `view.twist` (never its own clock).
- Acceptance: as T-103 with `v2/docs/p5/l04-*.png`.
- Tests: `l04_smoothies.test.ts`: water level at telegraph, in, and out phases from a synthetic `TwistView`.

### T-112 · Pizza chain: press, assemblies, oven (sim)
- Phase: P5b
- Depends on: T-110
- Model hint: sonnet
- Read first: 02 §5.4, 02 §6.5 (oven), 03 §5.1, 03 §5.3 (press, oven), 08 §7.4
- Files: `v2/packages/sim/src/rush/items.ts`, `stations/processor.ts`, `v2/packages/content/src/data/rush/assemblies.json`, `v2/packages/sim/src/rush/assemblies.test.ts`
- Steps:
  1. Carrier items (`pizza_base` accepts `tomato_sauce` and `shredded_mozzarella` in any order, then becomes `pizza_margherita_raw`) via assemblies per 02 §5.4.
  2. Press station (`process: 'auto'` 60 ticks, no burn) and oven (360 ticks cook, 240 ticks burn window).
- Acceptance: `pnpm -C v2 check` green; earlier goldens unchanged.
- Tests: `assemblies.test.ts`: dough -> press -> base; both toppings in both orders; oven 360 ticks; raw pizza on a plate is refused; cooked pizza accepted by the pizza recipe.

### T-113 · Dumbwaiter station, twist hook, multi-zone camera
- Phase: P5b
- Depends on: T-112, T-043
- Model hint: sonnet
- Read first: 02 §6.14, 08 §7.5, 04 §8.5, 01 §7.4 (hooks), 08 §7.3
- Files: `v2/packages/sim/src/rush/stations/dumbwaiter.ts`, `hooks/dumbwaiter.ts`, `hooks/index.ts`, `v2/packages/render/src/camera/cameraRig.ts`, `v2/packages/sim/src/rush/hooks/dumbwaiter.test.ts`
- Steps:
  1. Dumbwaiter behavior: two linked stations (`link`), capacity 2, `travelTicks` 60, items move between decks; stairs slow chefs by `stairsSlowQ8` through `speedMulQ8`.
  2. Multi-zone camera framing per 04 §8.5: the rig frames the zone of the chefs with a gentle pan.
- Acceptance: `pnpm -C v2 check` green.
- Tests: `dumbwaiter.test.ts`: an item takes 60 ticks to travel, capacity 2 refuses a third, a thrown item can land on the dumbwaiter; `cameraRig.test.ts` zone pan stays within the bounds.

### T-114 · Level 5 · Pizzeria sur les Toits: content
- Phase: P5b
- Depends on: T-113
- Model hint: sonnet
- Read first: 08 §7.1, 08 §7.3, 08 §7.4, 08 §7.5, 08 §7.6, 08 §7.7, 08 §7.10, 08 §7.12
- Files: `v2/packages/content/src/data/rush/levels/l05_pizzeria/level.json`, `layout.json`, `levels/index.ts`, `i18n/fr.ts`, `en.ts`, `v2/packages/sim/src/rush/levels/l05.test.ts`, `golden/l05_pizzeria.json`
- Steps:
  1. Level data from the 08 §7.3 grid and 08 §7.4 tables: `pizza_margherita`, `salad`, `smoothie`; twist `dumbwaiter` with params 08 §7.2; zones for the two decks.
  2. Strings, stars, goldens, smoke test entry.
- Acceptance: `pnpm -C v2 check` green; bot completes level 5 at all buckets.
- Tests: `l05.test.ts`: 08 §7.12 cases, `pizza chain end to end`, `dumbwaiter route is faster than stairs for a pizza (aware bot beats ignorant by >= 10 percent)`.

### T-115 · Level 5 diorama (rooftop pizzeria)
- Phase: P5b
- Depends on: T-114, T-103
- Model hint: haiku
- Read first: 08 §7.2, 08 §7.8, 08 §7.9
- Files: `v2/packages/render/src/dioramas/l05_pizzeria.ts`, `dioramas/index.ts`, `assets/voxel/props.ts`, `assets/smooth/props.ts`, `lighting/moods.ts`, `v2/packages/render/src/dioramas/l05_pizzeria.test.ts`
- Steps:
  1. Dressing, two-deck framing with `CameraSpec` zones, dumbwaiter cable animation driven by `view.twist`/station `travelLeft`.
- Acceptance: as T-103 with `v2/docs/p5/l05-*.png`.
- Tests: as T-103.

### 🎮 Owner playtest E: levels 4 and 5
- Status is the checkbox of this milestone in §4. The owner plays the smoothie bar (blender, sink, tide) and the rooftop pizzeria (pizza chain, dumbwaiter, camera between decks), solo and duo.

### T-116 · Fire and extinguisher (sim)
- Phase: P5b
- Depends on: T-115
- Model hint: sonnet
- Read first: 02 §10.1-10.4, 02 §6.11, 02 §7.4
- Files: `v2/packages/sim/src/rush/fire.ts`, `stations/extinguisher.ts`, `sim.ts`, `stations/processor.ts`, `v2/packages/sim/src/rush/fire.test.ts`
- Steps:
  1. Ignition after a burnt item stays 240 ticks on a processor, burning station behavior, spread every 120 ticks to flammable neighbours, extinguish with 45 ticks of X holding the extinguisher (gated by `mechanics.fire`).
  2. Events `Ignited`, `FireSpread`, `Extinguished`; fire state is in snapshot/hash already.
- Acceptance: `pnpm -C v2 check` green; goldens unchanged.
- Tests: `fire.test.ts`: the cases of 02 §20 item 8, a burning station refuses items, fire off when the mechanic is false.

### T-117 · Coating station and low-bridges hook
- Phase: P5b
- Depends on: T-116, T-109
- Model hint: sonnet
- Read first: 03 §5.3 (coating), 08 §8.4, 08 §8.5, 08 §2.4
- Files: `v2/packages/content/src/data/rush/stations.json`, `v2/packages/sim/src/rush/hooks/lowBridges.ts`, `hooks/index.ts`, `v2/packages/sim/src/rush/hooks/lowBridges.test.ts`
- Steps:
  1. Verify the coating station (2 s auto, no burn) works through the generic processor path with the chained-cooking rule; fix if not (use B2 tests).
  2. Low bridges hook: events `BridgeApproaching/BridgeLock/BridgeClear`, upper-deck lock and stun per 08 §8.5.
- Acceptance: `pnpm -C v2 check` green.
- Tests: `lowBridges.test.ts`: event ticks (first impact 1500, warn 150, lock 120), stun 24 ticks, `onion -> board -> coating -> fryer` chain.

### T-118 · Level 6 · Friterie du Bateau-Mouche: content
- Phase: P5b
- Depends on: T-117
- Model hint: sonnet
- Read first: 08 §8.1, 08 §8.3, 08 §8.4, 08 §8.5, 08 §8.6, 08 §8.7, 08 §8.10, 08 §8.12
- Files: `v2/packages/content/src/data/rush/levels/l06_bateau/level.json`, `layout.json`, `levels/index.ts`, `i18n/fr.ts`, `en.ts`, `v2/packages/sim/src/rush/levels/l06.test.ts`, `golden/l06_bateau.json`
- Steps:
  1. Level data from 08 §8.3 and §8.4: recipes `french_fries`, `onion_rings`, `chicken_tenders_fries`; mechanics `{ throw: true, fire: true }`; twist `low_bridges`; extinguisher station and zones.
  2. Strings, stars, goldens, smoke entry (fire cases: ignite and extinguish through the smoke harness).
- Acceptance: `pnpm -C v2 check` green; bot completes level 6 at all buckets.
- Tests: `l06.test.ts`: 08 §8.12 cases, `a burnt item ignites its station after 240 ticks`, `bridge lock never covers plates, pass or bin (validated)`.

### T-119 · Level 6 diorama and fire visuals
- Phase: P5b
- Depends on: T-118, T-103
- Model hint: haiku
- Read first: 08 §8.2, 08 §8.8, 08 §8.9, 04 §11.5, 04 §13
- Files: `v2/packages/render/src/dioramas/l06_bateau.ts`, `fx/fire.ts`, `dioramas/index.ts`, `assets/voxel/props.ts`, `assets/smooth/props.ts`, `v2/packages/render/src/fx/fire.test.ts`
- Steps:
  1. River boat dressing with moving bank and bridges (bridges follow `view.twist`), fire VFX (flames, smoke, ember) per 04 §11.5 with the extinguisher foam.
- Acceptance: as T-103 with `v2/docs/p5/l06-*.png`; fire visible on a burning fryer.
- Tests: `fire.test.ts`: flame count scales with `fire` level, no flash > 3 Hz.

### T-120 · Crowd-lane twist hook
- Phase: P5b
- Depends on: T-109
- Model hint: haiku
- Read first: 08 §9.5, 08 §2.4
- Files: `v2/packages/sim/src/rush/hooks/crowdLane.ts`, `hooks/index.ts`, `v2/packages/sim/src/rush/hooks/crowdLane.test.ts`
- Steps:
  1. Implement `crowd_lane` with `phaseAt` (first wave 900, period 750, warn 75, wave 210) and `speedMulQ8` 64 in the lane zone; events `CrowdApproaching/CrowdIn/CrowdOut`; `dashAllowed` false in the lane during a wave.
- Acceptance: `pnpm -C v2 check` green.
- Tests: `crowdLane.test.ts`: event ticks, speed multiplier only inside the lane during the wave, dash refused during the wave.

### T-121 · Level 7 · Marché de Nuit: content
- Phase: P5b
- Depends on: T-120, T-118
- Model hint: sonnet
- Read first: 08 §9.1, 08 §9.3, 08 §9.4, 08 §9.5, 08 §9.6, 08 §9.7, 08 §9.10, 08 §9.12
- Files: `v2/packages/content/src/data/rush/levels/l07_marche/level.json`, `layout.json`, `levels/index.ts`, `i18n/fr.ts`, `en.ts`, `v2/packages/sim/src/rush/levels/l07.test.ts`, `golden/l07_marche.json`
- Steps:
  1. Level data from 08 §9.3-9.4: recipes `grilled_cheese_sandwich`, `blt_sandwich`, `hamburger`, `onion_rings`; toaster station; twist `crowd_lane`.
  2. Strings, stars, goldens, smoke entry.
- Acceptance: `pnpm -C v2 check` green; bot completes level 7 at all buckets.
- Tests: `l07.test.ts`: 08 §9.12 cases, `blt needs bacon stove, toaster and board`, `aware bot beats ignorant by 10 percent`.

### T-122 · Level 7 diorama (night market)
- Phase: P5b
- Depends on: T-121, T-103
- Model hint: haiku
- Read first: 08 §9.2, 08 §9.8, 08 §9.9, 04 §14
- Files: `v2/packages/render/src/dioramas/l07_marche.ts`, `dioramas/index.ts`, `assets/voxel/props.ts`, `assets/smooth/props.ts`, `lighting/moods.ts`, `v2/packages/render/src/dioramas/l07_marche.test.ts`
- Steps:
  1. Night lighting with readable prompts (08 §14.1), lanterns, crowd silhouettes marching on `CrowdApproaching/In/Out`.
- Acceptance: as T-103 with `v2/docs/p5/l07-*.png`; luminance contrast check passes at night.
- Tests: as T-103 plus `crowd walkers only exist during warn and wave`.

### 🎮 Owner playtest F: levels 6 and 7
- Status is the checkbox of this milestone in §4. The owner plays the river boat (fire, extinguisher, bridges) and the night market (parallel chains, crowd lane), duo and 4 players.

### T-123 · Mixer batter chain and gangway-tunnels hook
- Phase: P5c
- Depends on: T-122
- Model hint: sonnet
- Read first: 08 §10.4, 08 §10.5, 03 §5.2 (batter items), 08 §2.4
- Files: `v2/packages/sim/src/rush/hooks/gangwayTunnels.ts`, `hooks/index.ts`, `v2/packages/content/src/data/rush/stations.json`, `v2/packages/sim/src/rush/hooks/gangwayTunnels.test.ts`
- Steps:
  1. Verify the mixer (2 s auto) produces `pancake_batter`/`omelette_mix` which the stove accepts (B2 rule); fix content if not.
  2. Tunnel hook: events `TunnelApproaching/TunnelIn/TunnelOut`, gangway `speedMulQ8` 154 during tunnels, darkness flag in `TwistView` for render (`first 900, period 1500, warn 90, tunnel 300`).
- Acceptance: `pnpm -C v2 check` green.
- Tests: `gangwayTunnels.test.ts`: event ticks, slow factor in the gangway, `egg -> mixer -> stove -> cooked_omelette`.

### T-124 · Level 8 · Wagon-Restaurant: content
- Phase: P5c
- Depends on: T-123
- Model hint: sonnet
- Read first: 08 §10.1, 08 §10.3, 08 §10.4, 08 §10.5, 08 §10.6, 08 §10.7, 08 §10.10, 08 §10.12
- Files: `v2/packages/content/src/data/rush/levels/l08_wagon/level.json`, `layout.json`, `levels/index.ts`, `i18n/fr.ts`, `en.ts`, `v2/packages/sim/src/rush/levels/l08.test.ts`, `golden/l08_wagon.json`
- Steps:
  1. Level data from 08 §10.3-10.4: `pancakes`, `cheese_omelette`, `fruit_yogurt_bowl`, `smoothie`; twist `gangway_tunnels`; zones for wagons and gangway.
  2. Strings, stars, goldens, smoke entry.
- Acceptance: `pnpm -C v2 check` green; bot completes level 8 at all buckets.
- Tests: `l08.test.ts`: 08 §10.12 cases, `pancakes full chain`, `items cross the gangway by hand and by throw`.

### T-125 · Level 8 diorama (train wagons, tunnels)
- Phase: P5c
- Depends on: T-124, T-103
- Model hint: haiku
- Read first: 08 §10.2, 08 §10.8, 08 §10.9, 04 §6.3
- Files: `v2/packages/render/src/dioramas/l08_wagon.ts`, `dioramas/index.ts`, `assets/voxel/props.ts`, `assets/smooth/props.ts`, `lighting/moods.ts`, `v2/packages/render/src/dioramas/l08_wagon.test.ts`
- Steps:
  1. Scrolling scenery backdrop, tunnel darkness from `TwistView` with prompt readability lights (04 §7.4), wagon sway limited to the camera (never the sim, reduced-motion aware).
- Acceptance: as T-103 with `v2/docs/p5/l08-*.png`.
- Tests: as T-103 plus `sway amplitude is 0 with reduced motion`.

### T-126 · Planter station (harvest, regrow)
- Phase: P5c
- Depends on: T-125
- Model hint: sonnet
- Read first: 02 §6.12, 08 §11.4 (planter rules), 03 §5.3 (planter)
- Files: `v2/packages/sim/src/rush/stations/planter.ts`, `stations/index.ts`, `v2/packages/sim/src/rush/stations/planter.test.ts`
- Steps:
  1. Planter: `maxStock` 3, `startStock` 2, `regrowTicks` 240, take with A when stock > 0 (item raw), regrow timer `growLeft`, gated by `mechanics.harvest`; LayoutStation `props` integers override the defaults.
  2. Event `Harvested`; stock and `growLeft` hashed (already in layout).
- Acceptance: `pnpm -C v2 check` green; goldens unchanged.
- Tests: `planter.test.ts`: start stock 2, take 3 in a row refuses the third, regrow after 240 ticks, `bonusStock` handled by the sprinkler hook test (next ticket), snapshot round trip.

### T-127 · Sprinklers hook
- Phase: P5c
- Depends on: T-126, T-109
- Model hint: haiku
- Read first: 08 §11.5, 08 §2.4
- Files: `v2/packages/sim/src/rush/hooks/sprinklers.ts`, `hooks/index.ts`, `v2/packages/sim/src/rush/hooks/sprinklers.test.ts`
- Steps:
  1. Sprinklers: three offset timers, `SprinklerWarn/On/Off`, stun 15 ticks to chefs in the zone, `bonusStock` 1 to planters in the zone on `On`, per params of 08 §11.2.
- Acceptance: `pnpm -C v2 check` green.
- Tests: `sprinklers.test.ts`: event ticks for the 3 offsets, stun applies only inside the zone, planter stock + 1 capped at `maxStock`.

### T-128 · Level 9 · Bistrot de la Serre: content
- Phase: P5c
- Depends on: T-127
- Model hint: sonnet
- Read first: 08 §11.1, 08 §11.3, 08 §11.4, 08 §11.5, 08 §11.6, 08 §11.7, 08 §11.10, 08 §11.12
- Files: `v2/packages/content/src/data/rush/levels/l09_bistrot/level.json`, `layout.json`, `levels/index.ts`, `i18n/fr.ts`, `en.ts`, `v2/packages/sim/src/rush/levels/l09.test.ts`, `golden/l09_bistrot.json`
- Steps:
  1. Level data from 08 §11.3-11.4: `salad`, `pizza_margherita`, `chicken_tenders_fries`, `smoothie`; mechanics include `harvest`, `fire`; twist `sprinklers`.
  2. Strings, stars, goldens, smoke entry.
- Acceptance: `pnpm -C v2 check` green; bot completes level 9 at all buckets.
- Tests: `l09.test.ts`: 08 §11.12 cases, `planters supply a salad without a crate`, `aware bot beats ignorant by 10 percent`.

### T-129 · Level 9 diorama (greenhouse bistro)
- Phase: P5c
- Depends on: T-128, T-103
- Model hint: haiku
- Read first: 08 §11.2, 08 §11.8, 08 §11.9, 04 §11.3 (planter)
- Files: `v2/packages/render/src/dioramas/l09_bistrot.ts`, `dioramas/index.ts`, `assets/voxel/props.ts`, `assets/smooth/props.ts`, `lighting/moods.ts`, `v2/packages/render/src/dioramas/l09_bistrot.test.ts`
- Steps:
  1. Greenhouse dressing, planter growth stages from station stock, sprinkler spray VFX and puddle on `SprinklerOn`.
- Acceptance: as T-103 with `v2/docs/p5/l09-*.png`.
- Tests: as T-103 plus `planter visual stage equals stock`.

### T-130 · Conveyor station (sim)
- Phase: P5c
- Depends on: T-129
- Model hint: sonnet
- Read first: 02 §6.13, 08 §12.5
- Files: `v2/packages/sim/src/rush/stations/conveyor.ts`, `hooks/conveyor.ts`, `stations/index.ts`, `hooks/index.ts`, `v2/packages/sim/src/rush/stations/conveyor.test.ts`
- Steps:
  1. Ring of `ringSize` 32 slots advancing every `stepTicks` 8 (speeds to 5 at tick 3600 with a 90-tick warning), items placed on a belt slot move around, the chute at `chuteIndex` 25 delivers to the plates return; belt state hashed (layout lists `belt`).
  2. Events `BeltStep`, `BeltSpeedUp`, `BeltChute`.
- Acceptance: `pnpm -C v2 check` green.
- Tests: `conveyor.test.ts`: an item completes a full turn in `32 x 8` ticks, speed-up at the right tick with warning, snapshot round trip with items on the belt.

### T-131 · Feast tickets and the giant customer data
- Phase: P5c
- Depends on: T-130
- Model hint: sonnet
- Read first: 02 §16 (feast block), 02 §14.1, 08 §12.4 (feast), 04 §10.1 (giant), 03 §6 (feast field)
- Files: `v2/packages/sim/src/rush/tickets.ts`, `scoring.ts`, `types.ts`, `v2/packages/sim/src/rush/feast.test.ts`
- Steps:
  1. Feast ticket: `dishes: string[]` (3 recipes), `done: boolean[]`, spawned by `level.feast` (`every: 3, dishes: 3, bonus: 200`), serve matching marks the first undone matching dish, bonus when all three are done, expiry penalty once.
  2. `RushView` ticket gains `dishes` and `done` (the HUD change is in T-133).
- Acceptance: `pnpm -C v2 check` green; goldens of levels 1-9 unchanged.
- Tests: `feast.test.ts`: spawn index rule, each serve marks one dish, bonus once, ticket expires as a whole, snapshot round trip.

### T-132 · Level 10 · Banquet du Géant: content
- Phase: P5c
- Depends on: T-131
- Model hint: sonnet
- Read first: 08 §12.1, 08 §12.3, 08 §12.4, 08 §12.5, 08 §12.6, 08 §12.7, 08 §12.10, 08 §12.12
- Files: `v2/packages/content/src/data/rush/levels/l10_banquet/level.json`, `layout.json`, `levels/index.ts`, `i18n/fr.ts`, `en.ts`, `v2/packages/sim/src/rush/levels/l10.test.ts`, `golden/l10_banquet.json`
- Steps:
  1. Level data from 08 §12.3-12.4: `cheeseburger_combo`, `pizza_margherita`, `pancakes`, `chicken_tenders_fries`; 64 base / 72 party stations; twist `conveyor`; `feast` block; mechanics with throw, wash if listed there.
  2. Strings, stars, goldens, smoke entry.
- Acceptance: `pnpm -C v2 check` green; bot completes level 10 at all buckets within the CI time budget (`09 §10.1` loose bound).
- Tests: `l10.test.ts`: 08 §12.12 cases, `feast every 4th ticket from index 3`, `belt items reach the chute`.

### T-133 · Level 10 diorama, giant customer, feast HUD
- Phase: P5c
- Depends on: T-132, T-103
- Model hint: sonnet
- Read first: 08 §12.2, 08 §12.8, 08 §12.9, 04 §10.1, 04 §10.2, 05 §4.6 (tickets)
- Files: `v2/packages/render/src/dioramas/l10_banquet.ts`, `assets/voxel/customer.ts`, `assets/smooth/customer.ts`, `dioramas/index.ts`, `v2/apps/client/src/hud/tickets.ts`, `v2/packages/render/src/dioramas/l10_banquet.test.ts`
- Steps:
  1. Banquet hall dressing, conveyor belt visuals driven by station `belt`, the giant customer (size per 04 §10.1) reacting at the window, only in this level.
  2. HUD ticket for a feast shows three dish icons with done ticks and the bonus.
- Acceptance: as T-103 with `v2/docs/p5/l10-*.png`.
- Tests: `l10_banquet.test.ts`: belt item positions from slot index; `tickets.test.ts` feast render shows 3 dishes.

### T-134 · Cross-level checks: difficulty curve, goldens, no regressions
- Phase: P5c
- Depends on: T-133
- Model hint: haiku
- Read first: 08 §13, 08 §14.3, 09 §7
- Files: `v2/packages/sim/src/rush/levels/curve.test.ts`, `v2/tools/check-levels.ts`
- Steps:
  1. Encode the 08 §13 table and its 5 curve rules as a test over the loaded levels (duration, recipes count, active tickets duo, `ticketTimeBase`, station counts base/party).
  2. Test that adding level N does not change goldens of levels < N (compare the committed golden files with a fresh run).
  3. Run `pnpm stars` and commit any recalibration.
- Acceptance: `pnpm -C v2 check` green; `pnpm -C v2 stars` green.
- Tests: `curve.test.ts`: the 5 rules, `each level has exactly one new mechanic flag vs previous level`.

### 🎮 Owner playtest G: levels 8 to 10 and the full campaign
- Status is the checkbox of this milestone in §4. The owner plays levels 8 (tunnels), 9 (planters, sprinklers) and 10 (feast, conveyor, giant), then runs the full campaign unlock path from level select.

---
## Phase P6 · Multiplayer

Follows 06 §18 (N1...). The steps B1, B2, B3, B4 and B8 of 07 §14 are placed here because 06 N2 and N8 depend on them. Prerequisites N2 (RunConfig, snapshot, codec) were delivered in P2 (T-020, T-022, T-023, T-028).

### T-140 · `@ga/net` skeleton: constants, protocol types, codec (N1)
- Phase: P6
- Depends on: T-029, T-022
- Model hint: sonnet
- Read first: 06 §2, 06 §3, 06 §8.1, 06 §8.2, 06 §8.3, 06 §8.4
- Files: `v2/packages/net/package.json`, `src/index.ts`, `src/constants.ts`, `src/protocol.ts`, `src/codec.ts`, `test/codec.test.ts`, `v2/tsconfig.json` (reference), `v2/eslint.config.js` (net import boundary)
- Steps:
  1. Create the workspace package `@ga/net` with the layout of 06 §3 (only the files of this ticket now).
  2. `constants.ts` = `NET_CONST` of 06 §2 verbatim; `protocol.ts` = the wire types of 06 §8.1-8.3; `codec.ts` = binary `InputBatch`/`Frames` and JSON `ctl` encode/decode with the validation of 06 §8.4 (local 5-byte `RushInput` read/write identical to `encodeRushInput`).
  3. Add the lint boundary: `@ga/net` imports `@ga/shared` and types only from `@ga/sim`/`@ga/content`.
- Acceptance: `pnpm -C v2 check` green.
- Tests: `codec.test.ts` and `wire.test.ts` (the `writeInput` vs `encodeRushInput` identity for 100000 random inputs), exact byte sizes of 06 §8.2, truncated packets rejected.

### T-141 · `@ga/records` skeleton: RunLog, `.pkr` codec, replayKey, nickname (B1)
- Phase: P6
- Depends on: T-027, T-020
- Model hint: sonnet
- Read first: 07 §6.2, 07 §4.2, 02 §4.5, 02 §4.6, 01 §7.6
- Files: `v2/packages/records/package.json`, `src/index.ts`, `src/runlog.ts`, `src/pkr.ts`, `src/replayKey.ts`, `src/nickname.ts`, `src/pkr.test.ts`, `src/nickname.test.ts`, `v2/tsconfig.json`
- Steps:
  1. Create the package (`@ga/records` may import `@ga/shared`, `@ga/sim`, `@ga/content`).
  2. `.pkr` encode/decode exactly per 07 §6.2 / 02 §4.6 (header with `SIM_VERSION`, `contentHash`, `RunConfig`, frame body RLE, claimed result); `replayKey`; `sanitizeNickname` per 07 §4.2.
- Acceptance: `pnpm -C v2 check` green.
- Tests: `pkr.test.ts`: encode/decode identity (`.pkr` round trip), corrupted header rejected, RLE of idle frames; `nickname.test.ts`: the accepted and rejected examples of 07 §4.2.

### T-142 · `verifyRun` with `InlineSimDriver` (B2)
- Phase: P6
- Depends on: T-141, T-026
- Model hint: sonnet
- Read first: 07 §6.3, 07 §6.4, 07 §6.5, 09 §12
- Files: `v2/packages/records/src/verify.ts`, `src/verify.test.ts`, `src/index.ts`
- Steps:
  1. `verifyRun(pkr: Uint8Array): Promise<VerifyResult>` per 07 §6.3: check versions and `contentHash`, replay with `InlineSimDriver`, compare the final `RunResult` and hash with the claim; return `ok | mismatch | invalid | version`.
  2. Time and memory guard per 07 §6.4 (abort over the tick budget).
- Acceptance: `pnpm -C v2 check` green.
- Tests: `verify.test.ts`: a recorded bot run verifies; flipping one input byte gives `mismatch`; wrong `contentHash` gives `version`; truncated file gives `invalid`.

### T-143 · Net-side sim driver on the worker (N3)
- Phase: P6
- Depends on: T-140, T-028
- Model hint: sonnet
- Read first: 06 §10.1, 06 §10.2, 06 §10.3, 06 §10.4, 01 §9.2 (`SimDriver`, `ViewSource`)
- Files: `v2/apps/client/src/net/workerDriver.ts`, `v2/apps/client/src/net/localRun.ts`, `v2/apps/client/src/net/workerDriver.test.ts`
- Steps:
  1. `WorkerSimDriver` implementing `SimDriver` over the worker messages (`rush-init clock: 'driven'`, `rush-advance`, snapshot, restore, log request) with a message-port abstraction so tests can use `workerCore` directly.
  2. `localRun.ts`: the local singleplayer path of 06 §10.4 (realtime clock) behind the same `RunSession` interface; `playScreen` now starts runs through it.
  3. Hash reports every 30 ticks are forwarded (06 §10.2).
- Acceptance: `pnpm -C v2 check` green; singleplayer unchanged.
- Tests: `workerDriver.test.ts`: feeding a recorded log in frames yields the same hash as `InlineSimDriver`; a hash event every 30 ticks.

### T-144 · Host queue, sequencer, playout, confirmed log (N4)
- Phase: P6
- Depends on: T-143
- Model hint: sonnet
- Read first: 06 §9.1-9.7, 06 §7
- Files: `v2/packages/net/src/transport.ts` (with `MemoryTransport`), `inputQueue.ts`, `sequencer.ts`, `playout.ts`, `log.ts`, `test/inputQueue.test.ts`, `test/playout.test.ts`, `test/log.test.ts`
- Steps:
  1. Implement `Transport` + `MemoryTransport`, `HostInputQueue` (seq dedupe, gap fill, edge-preserving merge, depth cap), `HostSequencer`, `PlayoutBuffer` (start threshold, rates 0.9/1.0/1.5, stall detection, adaptive depth B), `ConfirmedLog` with `encodeBody` identical to the `.pkr` body.
- Acceptance: `pnpm -C v2 check` green.
- Tests: `inputQueue.test.ts`, `playout.test.ts` and `log.test.ts` with the assertions of 06 §17.2 for those files (including `ConfirmedLog.encodeBody equals the @ga/records .pkr body`).

### T-145 · SimulatedNetwork and the lockstep suite (N5)
- Phase: P6
- Depends on: T-144, T-142
- Model hint: sonnet
- Read first: 06 §17.1, 06 §17.2 (lockstep row), 09 §11.1, 09 §11.2
- Files: `v2/packages/net/src/simnet.ts`, `src/session.ts` (HostSession/ClientSession core, no WebRTC), `test/lockstep.test.ts`
- Steps:
  1. `SimulatedNetwork` (latency, jitter, loss, reorder with a seeded PRNG) wrapping `MemoryTransport`.
  2. Minimal `HostSession`/`ClientSession` that wire queue, sequencer, playout and an in-process `InlineSimDriver` per peer.
  3. Lockstep test: 6 virtual peers with bot inputs for 180 s of sim time on the four profiles of 06 §17.2; assert equal hashes at every 30th tick and no peer stalls past the limits stated there.
- Acceptance: `pnpm -C v2 test` green and the suite runs in under 60 s.
- Tests: `lockstep.test.ts` with all four profiles.

### T-146 · Hash checker, desync detection and log-replay recovery (N6a)
- Phase: P6
- Depends on: T-145
- Model hint: sonnet
- Read first: 06 §14.1, 06 §14.2, 06 §14.3 (log mode)
- Files: `v2/packages/net/src/hashcheck.ts`, `src/session.ts`, `test/resync.test.ts`
- Steps:
  1. `HashChecker` per 06 §14.1 (every 30 ticks, majority, host decision) and the host reaction of 14.2.
  2. Recovery through full-log replay (14.3 log mode); a second desync moves the peer to spectator.
- Acceptance: `pnpm -C v2 test` green.
- Tests: `resync.test.ts`: forced desync is detected within 30 ticks + RTT and recovered within 3 virtual seconds; double desync gives spectator.

### T-147 · Catch-up transfer: snapshot and log modes, reconnect (N6b)
- Phase: P6
- Depends on: T-146
- Model hint: sonnet
- Read first: 06 §14.3, 06 §12.4, 06 §12.5, 06 §9.5
- Files: `v2/packages/net/src/session.ts`, `src/room.ts`, `test/reconnect.test.ts`, `test/catchup.test.ts`
- Steps:
  1. Catch-up by snapshot + tail with the `bad_snapshot` fallback to log mode; reconnect with `rejoinSecret` and the 10 s grace.
- Acceptance: `pnpm -C v2 test` green.
- Tests: `reconnect.test.ts` (10 s disconnect, same hash; corrupted snapshot falls back to log), `catchup.test.ts` (late join mid-run).

### T-148 · WebRTC transport and LocalSignaling (N7a)
- Phase: P6
- Depends on: T-145
- Model hint: sonnet
- Read first: 06 §5.4, 06 §5.3, 06 §6.1, 06 §6.2, 06 §7
- Files: `v2/packages/net/src/webrtc.ts`, `src/signaling.ts` (interface + `LocalSignaling`), `test/signaling.test.ts`
- Steps:
  1. `WebRtcTransport` with the 2 data channels (`sim` unreliable unordered, `ctl` reliable) and ICE restart (06 §6.2).
  2. `Signaling` interface and `LocalSignaling` over `BroadcastChannel` with the offer rules of 06 §5.3.
- Acceptance: `pnpm -C v2 check` green (browser-only code guarded so Node tests import it).
- Tests: `signaling.test.ts`: two `LocalSignaling` peers exchange events in order; who-offers-to-whom rule (lower join index offers).

### T-149 · Multi-tab harness (N7b)
- Phase: P6
- Depends on: T-148, T-143
- Model hint: sonnet
- Read first: 06 §17.3, 06 §2 (bandwidth constants)
- Files: `v2/apps/client/harness.html`, `v2/apps/client/src/net/harness.ts`, `v2/apps/client/src/net/delayedTransport.ts`, `v2/apps/client/vite.config.ts`, `v2/e2e/harness.spec.ts`
- Steps:
  1. Harness page with `?n=&sig=local&sim=latency:..,jitter:..,loss:..`, iframes, `bot=<i>`, per-frame stats and the green/red banner (06 §17.3).
  2. `DelayedTransport` for real-timer latency/loss.
  3. Playwright spec: n=2, 60 s, banner green.
- Acceptance: `pnpm -C v2 e2e -g harness` green; manual n=3 in a browser works.
- Tests: `harness.spec.ts`; `delayedTransport.test.ts` drop rate within tolerance with a seeded PRNG.

### T-150 · Supabase schema migration and CI schema test (B3)
- Phase: P6
- Depends on: T-029
- Model hint: haiku
- Read first: 07 §2.1, 07 §2.2, 07 §2.3, 07 §2.4, 07 §2.5, 07 §2.6
- Files: `v2/supabase/migrations/0001_v2.sql`, `v2/supabase/README.md`, `v2/tools/check-schema.ts`, `v2/tools/check-schema.test.ts`
- Steps:
  1. Copy the DDL of 07 §2 into the migration (tables with `v2_` prefix, RLS, views, SQL functions, the two `realtime.messages` policies, scheduled maintenance).
  2. `check-schema.ts` parses the SQL (statement split) and asserts: every table has RLS enabled, every view has `revoke all`, the two policies exist.
- Acceptance: `pnpm -C v2 check` green.
- Tests: `check-schema.test.ts` with a bad fixture (table without RLS fails).

### T-151 · Netlify functions shared layer (B4)
- Phase: P6
- Depends on: T-150
- Model hint: sonnet
- Read first: 07 §3.1, 07 §5.1, 07 §5.2, 07 §5.3, 07 §4.1
- Files: `v2/netlify/functions/_shared/store.ts`, `auth.ts`, `ratelimit.ts`, `errors.ts`, `codes.ts`, `memoryStore.ts`, `v2/netlify/functions/_shared/shared.test.ts`, `v2/netlify.toml` (`[functions]` directory)
- Steps:
  1. `Store` interface with `MemoryStore` (tests) and the Supabase PostgREST implementation pattern from V1 `_supabase.mjs` (`supabaseRequest`).
  2. Error shape and codes (07 §5.1, §5.3), token auth (`X-Player-Token`), rate limiter with the limits table of 07 §5.2, recovery/friend code generators (07 §4.1).
- Acceptance: `pnpm -C v2 check` green; no network needed in tests.
- Tests: `shared.test.ts`: error shape, token hashing, rate limit window, code alphabet and checksum.

### T-152 · Rooms and TURN functions, Realtime policies, gc and keep-alive (B8)
- Phase: P6
- Depends on: T-151
- Model hint: sonnet
- Read first: 07 §3.3, 07 §3.7, 07 §2.5, 06 §4.1-4.3, 06 §6.1
- Files: `v2/netlify/functions/rooms.ts`, `turn.ts`, `gc.ts`, `keep-alive.ts`, `v2/netlify/functions/rooms.test.ts`
- Steps:
  1. `POST /api/rooms` (create with a 4-letter code from the 06 §4.1 alphabet), `GET /api/rooms/:code`, `POST /api/rooms/:code/host` (host change), `turn.ts` credentials (06 §6.1), JWT for Realtime per 06 §5.1.
  2. `gc.ts` (expired rooms) and `keep-alive.ts` (daily ping), scheduled per 07 §3.7.
- Acceptance: `pnpm -C v2 check` green.
- Tests: `rooms.test.ts` against `MemoryStore`: create, join info, code collision retry, expired room 404, host change requires the host token.

### T-153 · SupabaseSignaling and client net glue (N8)
- Phase: P6
- Depends on: T-152, T-148, T-065
- Model hint: sonnet
- Read first: 06 §5.1, 06 §5.2, 06 §5.5, 06 §4.2, 05 §4.9, 07 §3.2 (identity token for rooms)
- Files: `v2/packages/net/src/signaling.ts` (SupabaseSignaling), `v2/apps/client/src/net/api.ts`, `v2/apps/client/src/net/supabaseClient.ts`, `v2/apps/client/src/screens/onlineEntryScreen.ts`, `v2/apps/client/src/screens/joinScreen.ts`, `v2/apps/client/src/net/signaling.test.ts`
- Steps:
  1. `SupabaseSignaling` over Realtime broadcast channel `room:<code>` with the events of 06 §5.2 and the limits of 5.5; the Supabase URL and anon key come from `import.meta.env.VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
  2. Online entry screen: "Créer une salle", "Rejoindre" with code input and invite link copy (`/r/ABCD`); join screen for `/r/:code`.
  3. Enable the "En ligne" button on the title screen.
- Acceptance: `pnpm -C v2 check` green; with a configured Supabase two browsers reach the room (manual, documented in `v2/supabase/README.md`).
- Tests: `signaling.test.ts` with a fake channel: events serialize per 5.2, payload over limit is rejected, reconnect resubscribes.

### T-154 · Lobby: room state, ready-up, level and difficulty choice (N9a)
- Phase: P6
- Depends on: T-153, T-147
- Model hint: sonnet
- Read first: 06 §11.1, 06 §11.2, 06 §12.1, 06 §12.2, 06 §13, 05 §4.4 (seat row)
- Files: `v2/packages/net/src/room.ts`, `v2/apps/client/src/screens/lobbyScreen.ts`, `v2/apps/client/src/net/roomClient.ts`, `v2/apps/client/src/i18n/fr.ts`, `en.ts`, `v2/packages/net/test/room.test.ts`
- Steps:
  1. `RoomState` reducer (join, leave, ready, level, difficulty, kick, `allocateSlots` for mixed couch seats, max 6 slots).
  2. Lobby screen: roster with colour chips, ready toggles, host-only level and difficulty pickers, invite link, strings `net.*` FR and EN.
- Acceptance: `pnpm -C v2 check` green.
- Tests: `room.test.ts`: slot allocation for 2 peers x 3 chefs, 7th chef refused, host-only changes, ready rules of 11.2.

### T-155 · Start sequence, barrier, results hand-off, mixed couch run (N9b)
- Phase: P6
- Depends on: T-154
- Model hint: sonnet
- Read first: 06 §11.3, 06 §11.4, 06 §9.7, 06 §13, 06 §15
- Files: `v2/packages/net/src/session.ts`, `v2/apps/client/src/net/onlineRun.ts`, `v2/apps/client/src/screens/playScreen.ts`, `v2/apps/client/src/screens/resultsScreen.ts`, `v2/packages/net/test/mixed.test.ts`
- Steps:
  1. Implement the numbered start sequence of 06 §11.3 (host builds `RunConfig`, `runStart` barrier, synchronized countdown), local seats routed to their global slots, play through `WorkerSimDriver` in `driven` mode.
  2. At run end every peer stores the `RunLog` and returns to the lobby after results (11.4).
- Acceptance: `pnpm -C v2 check` green; two browsers play a full run from title to results (manual).
- Tests: `mixed.test.ts`: 2 peers x 3 chefs slot mapping and input routing; `start barrier` waits for all `ready` or times out per 11.3.

### 🎮 Owner playtest H: online 2-player
- Status is the checkbox of this milestone in §4. The owner and a second person (or two devices) create a room, join through the link, play level 1 and 3 together, refresh one client mid-run (reconnect), and finish at the results screen.

### T-156 · Leave, disconnect, spectators, late join, kick; host leaves aborts (N10)
- Phase: P6
- Depends on: T-155
- Model hint: sonnet
- Read first: 06 §12.2, 06 §12.3, 06 §12.5, 06 §12.6, 06 §12.7 (phase 1 behaviour)
- Files: `v2/packages/net/src/session.ts`, `src/room.ts`, `v2/apps/client/src/screens/playScreen.ts`, `v2/apps/client/src/i18n/fr.ts`, `en.ts`, `v2/packages/net/test/leave.test.ts`
- Steps:
  1. A peer that leaves or drops keeps its slots as idle chefs (inputs zeros); the run continues.
  2. Late join while running becomes spectator, or takes a free idle slot if the host allows it; kick and ban of 12.6.
  3. Host leaves: the run is aborted, everyone returns to the title with `net.roomClosed`.
- Acceptance: `pnpm -C v2 check` green.
- Tests: `leave.test.ts`: idle slot after leave keeps hash determinism across peers; late join spectator sees the same hash; host leave aborts all peers.

### T-157 · Six-player validation: bandwidth, jitter, TURN-free path
- Phase: P6
- Depends on: T-156, T-149, T-134
- Model hint: sonnet
- Read first: 06 §20 (items 1, 2, 3, 5, 8), 09 §11.2, 09 §13.3
- Files: `v2/e2e/net6.spec.ts`, `v2/apps/client/src/net/harness.ts`, `v2/packages/net/test/bandwidth.test.ts`
- Steps:
  1. Harness n=6 (six iframes with 1 chef each) with `latency:80,jitter:20,loss:0.03` for 180 s, then a second run with 2 iframes of 3 couch chefs each: banner green, no stall over 1 s.
  2. Bandwidth counters per peer in the harness; assert host uplink <= 20 KB/s and client uplink <= 3 KB/s (3 local chefs) or <= 1.5 KB/s (1 chef) in `bandwidth.test.ts` with `SimulatedNetwork`.
  3. Blackout test: a client with 2 s of blackout does not change the host tick rate and catches up within 3 s.
  4. Tamper test: mutate a client sim state; detection within 1.1 s + RTT.
- Acceptance: `pnpm -C v2 test` and `pnpm -C v2 e2e -g net6` green.
- Tests: `net6.spec.ts`, `bandwidth.test.ts`.

### 🎮 Owner playtest I: online 6 players
- Status is the checkbox of this milestone in §4. The owner organises 4 to 6 real players (two machines with 3 couch chefs each also count), plays levels 1, 3 and 7, tests host tab refresh and a Wi-Fi change.

### T-158 · Host migration (M)
- Phase: P6
- Depends on: T-157
- Model hint: sonnet
- Read first: 06 §12.7, 06 §5.2 (host-claim), 06 §9.5, 06 §14.3
- Files: `v2/packages/net/src/session.ts`, `src/room.ts`, `src/signaling.ts`, `v2/packages/net/test/migration.test.ts`, `v2/apps/client/src/i18n/fr.ts`, `en.ts`
- Steps:
  1. Rolling snapshot every `SNAPSHOT_EVERY_TICKS` on every peer, successor election, `host-claim { epoch, tick }`, survivor rewind when ahead, `hostChange`, ticker restart at T (06 §12.7 steps 1-8).
  2. Strings `net.hostLeft`.
  3. Replace the phase 1 abort of T-156 by migration (abort stays only when no successor exists).
- Acceptance: `pnpm -C v2 check` green.
- Tests: `migration.test.ts` (the full case of 06 §17.2: host killed at tick 1000, peers at different `ackTick`s, equal final hash, `verifyRun` ok).

---
## Phase P7 · Records

Follows 07 §14 (B5, B6, B7, B9, B10, B12; B1-B4, B8 and B11 are already done) plus 06 N11.

### T-170 · Identity function, client API and Account screen (B5)
- Phase: P7
- Depends on: T-151, T-071
- Model hint: sonnet
- Read first: 07 §3.2, 07 §4.1-4.4, 07 §5.2 (identity limits)
- Files: `v2/netlify/functions/identity.ts`, `v2/netlify/functions/identity.test.ts`, `v2/apps/client/src/online/api.ts`, `v2/apps/client/src/online/identity.ts`, `v2/apps/client/src/screens/accountScreen.ts`, `v2/apps/client/src/i18n/fr.ts`, `en.ts`
- Steps:
  1. Endpoints of 07 §3.2 (register nickname, rename, recover with recovery code, friend code) with the rules of 07 §4.2 and flows of 4.3; the token is shown to the server only as a hash.
  2. Client `api.ts` typed wrappers (types from `@ga/records`); `identity.ts` stores `pk.identity.v1`.
  3. Account screen: nickname, recovery codes display and copy, recover on another device, friend code.
- Acceptance: `pnpm -C v2 check` green.
- Tests: `identity.test.ts`: nickname rules (accepted, rejected, profanity filter list from 07 §4.2), unique nickname handling, recovery flow, rate limits.

### T-171 · Runs endpoints: start, submit, status (B6a)
- Phase: P7
- Depends on: T-142, T-151
- Model hint: sonnet
- Read first: 07 §3.4, 07 §6.1, 07 §9.1, 07 §9.2, 07 §9.3, 07 §9.6
- Files: `v2/netlify/functions/runs.ts`, `v2/netlify/functions/runs.test.ts`
- Steps:
  1. `POST /api/runs/start` (run token with `startedAt`, `snack` refused with `not_ranked`), `POST /api/runs` (validate `.pkr` size and header, store replay, dedupe by `replayKey`, claim of an existing run per 07 §9.3), `GET /api/runs/:id`, `GET /api/runs/:id/replay`.
  2. Timing rule of 9.2 (submission within the allowed window of the run token).
- Acceptance: `pnpm -C v2 check` green.
- Tests: `runs.test.ts` with `MemoryStore`: start then submit gives `202`; same replay twice gives `deduplicated: true`; submit without start rejected; too-large body rejected; assisted run is marked unranked.

### T-172 · Background verifier and sweep (B6b)
- Phase: P7
- Depends on: T-171
- Model hint: sonnet
- Read first: 07 §6.3, 07 §6.4, 07 §6.5, 07 §3.7 (verify-sweep)
- Files: `v2/netlify/functions/verify-run-background.ts`, `verify-sweep.ts`, `v2/netlify/functions/verify.test.ts`
- Steps:
  1. Background function loads the replay, runs `verifyRun`, writes status `verified | rejected | stale_version`, updates the best-per-team row; mismatch handling of 6.5.
  2. Scheduled sweep re-queues runs stuck in `verifying` for more than the timeout of 07 §6.5.
- Acceptance: `pnpm -C v2 check` green; bundle of the function is under the limit of 07 §6.4 (a size check in the test using the esbuild metafile, skip if esbuild unavailable).
- Tests: `verify.test.ts`: honest bot replay verified, tampered replay rejected with reason, stale `SIM_VERSION` marked `stale_version`, sweep requeues a stuck run.

### T-173 · Client run submission and net-result UI (N11)
- Phase: P7
- Depends on: T-172, T-155, T-170
- Model hint: sonnet
- Read first: 06 §15, 07 §6.1, 07 §9.3, 05 §4.8, 05 §4.9
- Files: `v2/apps/client/src/online/submit.ts`, `v2/apps/client/src/screens/resultsScreen.ts`, `v2/apps/client/src/net/onlineRun.ts`, `v2/apps/client/src/online/submit.test.ts`
- Steps:
  1. After a ranked run (not `snack`, not assisted) call `POST /api/runs/start` at run start (online: the host does and shares the token in `runStart`) and `POST /api/runs` at the end with the `.pkr` built from the `RunLog` (every peer may submit; dedupe makes it safe).
  2. Results screen shows status `Vérification...` then `Vérifié` or `Non classé` by polling `GET /api/runs/:id` (2 s, max 60 s).
  3. Offline or API errors never block the player: the result stays local.
- Acceptance: `pnpm -C v2 check` green; a 2-player online run appears verified in the status endpoint (manual with a configured backend, plus the integration test).
- Tests: `submit.test.ts`: payload built from a bot run verifies with `verifyRun`; offline failure leaves local progress intact; polling stops on terminal states.

### T-174 · Boards, personal bests and leaderboard screen (B7)
- Phase: P7
- Depends on: T-173
- Model hint: sonnet
- Read first: 07 §3.5, 07 §7.1-7.7, 07 §8.1
- Files: `v2/netlify/functions/boards.ts`, `v2/netlify/functions/boards.test.ts`, `v2/apps/client/src/screens/boardsScreen.ts`, `v2/apps/client/src/screens/levelSelectScreen.ts`, `v2/apps/client/src/online/pb.ts`
- Steps:
  1. `GET /api/boards/:levelId` with board key (level x players x difficulty), ranking and one-row-per-team rule, scopes `world|crew|friends|me` (07 §7.4), `/api/pb` sync.
  2. Boards screen (reachable from level select and from results): top 20, own row highlighted, scope tabs, legacy-version rows hidden per 7.6.
  3. Level select card shows the world record for the current bucket.
- Acceptance: `pnpm -C v2 check` green.
- Tests: `boards.test.ts`: ordering by score then earlier time, one row per team, scope filters, legacy rows excluded, PB merge keeps the max.

### T-175 · Friends and friends board scope (B9)
- Phase: P7
- Depends on: T-174
- Model hint: haiku
- Read first: 07 §3.6, 07 §8.2
- Files: `v2/netlify/functions/friends.ts`, `v2/netlify/functions/friends.test.ts`, `v2/apps/client/src/screens/accountScreen.ts`
- Steps:
  1. Endpoints of 07 §3.6 (add by friend code, list, remove) with rate limits; the Account screen lists friends; the `friends` board scope uses them.
- Acceptance: `pnpm -C v2 check` green.
- Tests: `friends.test.ts`: add, duplicate add idempotent, cannot add self, remove, scope query.

### T-176 · Heuristics, admin and strikes (B10)
- Phase: P7
- Depends on: T-172
- Model hint: sonnet
- Read first: 07 §9.4, 07 §9.5, 07 §9.7, 07 §3.7 (admin)
- Files: `v2/netlify/functions/_shared/heuristics.ts`, `admin.ts`, `v2/netlify/functions/heuristics.test.ts`
- Steps:
  1. Soft flags of 9.4 (inhumanly constant input rate, perfect cadence, etc. as listed), strikes of 9.5, admin endpoints (hide run, ban nickname) protected by `ADMIN_TOKEN`.
- Acceptance: `pnpm -C v2 check` green.
- Tests: `heuristics.test.ts`: each heuristic fires on a synthetic log and not on bot logs; three strikes hide a player.

### T-177 · Replay retention and ghost playback hook (B12)
- Phase: P7
- Depends on: T-174
- Model hint: sonnet
- Read first: 07 §10.3, 07 §6.2, 04 §9.6
- Files: `v2/netlify/functions/gc.ts`, `v2/apps/client/src/online/ghost.ts`, `v2/apps/client/src/screens/playScreen.ts`, `v2/netlify/functions/gc.test.ts`, `v2/apps/client/src/online/ghost.test.ts`
- Steps:
  1. Retention: keep replays for records and personal bests per 10.3, prune the rest.
  2. Ghost hook: download a verified replay and play it through a second `InlineSimDriver`-based view; render the ghost chefs translucent (a `ghost` flag on the chef visual) in a separate `RenderHost` layer; toggle in pause.
- Acceptance: `pnpm -C v2 check` green.
- Tests: `gc.test.ts` retention; `ghost.test.ts` ghost view equals the replay hash positions at tick 300.

### T-178 · Records end-to-end test and deployment checks
- Phase: P7
- Depends on: T-176, T-177, T-175, T-174
- Model hint: sonnet
- Read first: 07 §13.1, 07 §13.2, 09 §12
- Files: `v2/netlify/functions/e2e.records.test.ts`, `v2/docs/p7/backend-setup.md`
- Steps:
  1. One test that drives the in-memory handlers: register two players, start, submit an honest bot replay, run the verifier, read the board, submit a tampered replay and see it rejected, check rate limits.
  2. `backend-setup.md`: the exact steps and environment variables (Supabase URL, anon key, service key, `ADMIN_TOKEN`, TURN secret) to deploy, from 07 §10 and 11.
- Acceptance: `pnpm -C v2 check` green; every item of 07 §13.2 acceptance has a test or a documented manual step.
- Tests: the file above.

---
## Phase P8 · Polish and launch

### T-190 · VFX presets
- Phase: P8
- Depends on: T-178, T-111, T-119
- Model hint: sonnet
- Read first: 04 §13, 04 §11.6
- Files: `v2/packages/render/src/fx/particles.ts`, `fx/presets.ts`, `fx/fx.test.ts`
- Steps:
  1. `ParticlePool` v2 with shapes per 04 §13 and the named presets (steam, sizzle, chop chips, serve sparkle, burn smoke, splash, dash dust, throw trail, fire, confetti); budgets per quality tier.
  2. Wire interaction feedback of 04 §11.6 to sim events.
- Acceptance: `pnpm -C v2 check` green; no per-frame allocation (heap check in test).
- Tests: `fx.test.ts`: each preset spawns within its budget, pool never grows past the cap, reduced motion disables non-essential presets.

### T-191 · Ambient life for all dioramas
- Phase: P8
- Depends on: T-190
- Model hint: haiku
- Read first: 04 §14, 08 §14.1 (budget)
- Files: `v2/packages/render/src/dioramas/ambient.ts`, `dioramas/l01_kiosque.ts` ... `l10_banquet.ts`, `v2/packages/render/src/dioramas/ambient.test.ts`
- Steps:
  1. Shared ambient helpers (birds, boats, walkers, steam wisps, fireflies) with the 12 desktop / 6 mobile budget.
  2. Make sure each level's list of 08 §N.9 ambient items is present.
- Acceptance: tests pass.
- Tests: `ambient.test.ts`: every diorama's ambient count <= 12 (desktop) and <= 6 (mobile tier).

### T-192 · Quality tiers and performance gates
- Phase: P8
- Depends on: T-191
- Model hint: sonnet
- Read first: 04 §16, 09 §10.1, 09 §10.2, 09 §10.3, 01 §12
- Files: `v2/packages/render/src/core/quality.ts`, `v2/packages/sim/src/rush/perf.test.ts`, `v2/e2e/perf.spec.ts`, `v2/scripts/size.mjs`, `v2/package.json` (scripts `bench`, `size`)
- Steps:
  1. Quality tier table (low/medium/high) with auto selection from a 60-frame benchmark and a settings override.
  2. Sim perf test (loose bound in `pnpm test`, real numbers in `pnpm bench`), browser perf spec per level, bundle size script with the limits of 09 §10.3.
- Acceptance: `pnpm -C v2 size` and `pnpm -C v2 test` green.
- Tests: the three files above; `quality.test.ts` tier selection from synthetic frame times.

### T-193 · Ambience beds and adaptive music
- Phase: P8
- Depends on: T-074
- Model hint: sonnet
- Read first: 05 §9.3, 05 §9.4, 08 §2.5 (music moods)
- Files: `v2/apps/client/src/audio/ambience.ts`, `audio/music.ts`, `audio/audio.test.ts`
- Steps:
  1. Ambience per level (loop, 0.6 s cross-fade) and adaptive music by mood and `intensity` changing only on bar lines (rules of 9.3 and 9.4); the 10 moods from the level data.
- Acceptance: `pnpm -C v2 check` green.
- Tests: `intensity transitions only on bar lines`, `cross-fade length 0.6 s`, every level's mood has a recipe.

### T-194 · Accessibility pass and axe checks
- Phase: P8
- Depends on: T-073, T-071
- Model hint: sonnet
- Read first: 05 §11, 05 §12 item 10, 09 §8.3, 09 §13.4
- Files: `v2/e2e/a11y.spec.ts`, `v2/apps/client/src/hud/a11y.css`, `v2/apps/client/src/screens/*.ts`
- Steps:
  1. Add `@axe-core/playwright`; check title, levels, intro, pause, results, lobby, settings at 1280x720 and 390x844 with zero serious violations; fix the violations found.
  2. Verify tab order, reduced-motion HUD, text scale 150 % overflow, colour-blind palette.
- Acceptance: `pnpm -C v2 e2e -g a11y` green.
- Tests: `a11y.spec.ts`.

### T-195 · Debug overlay, telemetry events, net strings completeness
- Phase: P8
- Depends on: T-158
- Model hint: haiku
- Read first: 06 §18 (step P), 05 §3.1 (`?debug=1`)
- Files: `v2/apps/client/src/hud/debugOverlay.ts`, `v2/apps/client/src/net/telemetry.ts`, `v2/apps/client/src/i18n/fr.ts`, `en.ts`
- Steps:
  1. `?debug=1` overlay: tick, hash, mode, RTT, depth, desync count.
  2. Telemetry: local-only ring buffer of net events exposed on `window.__pk` (nothing sent anywhere).
  3. Ensure all `net.*` strings exist in FR and EN (the strings check enforces it).
- Acceptance: `pnpm -C v2 check` green.
- Tests: `debugOverlay.test.ts` renders fields from a stub state.

### T-196 · Optional: relay fallback (phase R)
- Phase: P8
- Depends on: T-158
- Model hint: sonnet
- Read first: 06 §6.3
- Files: `v2/packages/net/src/relay.ts`, `v2/netlify/functions/relay.ts`, `v2/packages/net/test/relay.test.ts`
- Steps:
  1. Implement the relay fallback only if TURN is unavailable, exactly per 06 §6.3. Skip this ticket (mark `[x]` with the note `SKIPPED: TURN available`) when the owner's TURN credentials work in the 6-player playtest.
- Acceptance: `pnpm -C v2 check` green or the skip note.
- Tests: `relay.test.ts` three peers through the relay with `SimulatedNetwork`.

### T-197 · Optional: voice chat (phase V)
- Phase: P8
- Depends on: T-158
- Model hint: sonnet
- Read first: 06 §16
- Files: `v2/packages/net/src/voice.ts`, `v2/apps/client/src/screens/lobbyScreen.ts`, `v2/packages/net/test/voice.test.ts`
- Steps:
  1. Implement 06 §16 exactly (mesh, Opus 24 kbps, push-to-talk default V key or right-stick click, mic permission only when pressing Voice in the lobby, speaking ring, off by default). Mark `SKIPPED` if the owner declines.
- Acceptance: `pnpm -C v2 check` green or the skip note.
- Tests: `voice.test.ts` with fake `RTCPeerConnection`: link count at 6 peers is 15, PTT gating, failure greys the indicator.

### T-198 · CI completion: e2e, schema, size, determinism on two Node versions
- Phase: P8
- Depends on: T-192, T-194, T-178
- Model hint: haiku
- Read first: 09 §14.1, 09 §14.2
- Files: `.github/workflows/v2-ci.yml`, `v2/package.json` (script `prepush`)
- Steps:
  1. Jobs: check, e2e (Playwright with browsers cached), determinism on Node 20 and 22, size, schema, stars (`pnpm stars`), network tests.
  2. `pnpm prepush` runs the local pre-push routine of 09 §14.2.
- Acceptance: workflow YAML parses; `pnpm -C v2 prepush` runs locally.
- Tests: none new.

### T-199 · Final calibration and regression sweep
- Phase: P8
- Depends on: T-198, T-134
- Model hint: sonnet
- Read first: 08 §15, 09 §5.3, 09 §15, 09 §4.2
- Files: `v2/packages/content/src/data/rush/levels/*/level.json` (stars only), `v2/packages/sim/src/rush/golden/*.json`, `v2/packages/sim/src/rush/regression.test.ts`
- Steps:
  1. Run `pnpm calibrate-stars` for all 10 levels and commit the numbers; re-baseline goldens (message lists why).
  2. `regression.test.ts` collects every known-bug regression of 09 §15 (B1, B2, B3, click-to-walk grep) in one file as a final safety net.
- Acceptance: `pnpm -C v2 check` and `pnpm -C v2 stars` green.
- Tests: `regression.test.ts`.

### T-200 · Playtest checklists and launch docs
- Phase: P8
- Depends on: T-199
- Model hint: haiku
- Read first: 09 §13.1, 09 §13.2, 09 §13.3, 09 §13.4, 00-README §9
- Files: `v2/docs/launch/playtest-checklist.md`, `v2/docs/launch/launch-checklist.md`, `v2/README.md`
- Steps:
  1. Copy the checklists of 09 §13 into a single file the owner can tick.
  2. Launch checklist: env vars set on Netlify (see `v2/docs/p7/backend-setup.md`), Supabase migration applied, TURN credentials, `/classic` works, headers COOP/COEP present, analytics none, privacy note, version tag.
  3. Update `v2/README.md` with run, test, build and deploy commands.
- Acceptance: files exist; `pnpm -C v2 build` succeeds.
- Tests: none.

### T-201 · Spec reconciliation
- Phase: P8
- Depends on: T-200
- Model hint: haiku
- Read first: 00-README §11, 00-README §12
- Files: `docs/v2/spec/00-README.md`, `docs/v2/spec/01-architecture.md` (§13), `02-simulation.md` (§1), `04-rendering-and-art.md` (§1), `05-client-ui-input-audio.md` (§1), `06-multiplayer.md` (§19), `07-backend-and-records.md` (§12), `09-testing-and-quality.md` (§16)
- Steps:
  1. In every "Current state vs target" table replace "Today" by the real state after the build (all rows done) and record any difference between the code and the spec found during the build under a new section "Deviations" at the end of the document.
- Acceptance: grep finds no row that says "none" for something that exists.
- Tests: none.

### 🎮 Owner playtest J: final, launch decision
- Status is the checkbox of this milestone in §4. The owner ticks `v2/docs/launch/playtest-checklist.md` (all 10 levels, 1 to 6 players, gamepad and keyboard, FR and EN, mobile portrait, online with the leaderboard) and decides the launch.

