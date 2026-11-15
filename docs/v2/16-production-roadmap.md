# 16 · Production Roadmap, Risks and Kill Criteria

A plan for getting from documents to a public beta without betting everything on untested ideas. The rule: **prove the riskiest fun first, then the riskiest tech, then build content.**

Estimates assume **1–2 developers part-time** (about 20–30 h a week in total) plus freelance help for music and some art. Scale the calendar linearly if the team differs.

---

## 1. Phases

| Phase | Duration | Goal | Exit criteria |
|---|---|---|---|
| **P0 · Foundations** | 2 weeks | The `/v2` workspace, TS, Vite, bitECS, Rapier, the content schema, the `v1-to-vox` converter, CI | V1 art converted to `.vox`. An empty sim runs at 30 Hz in a worker. The determinism test harness runs. |
| **P1 · Toy: "Cut & Burn"** | 3 weeks | **The fun test of voxel food.** One chef, one Cleaver, one Torch, a hot rock and 4 materials in a gray box | 5 out of 6 playtesters spend over 3 minutes *playing with food* without being asked. They can read doneness without explanation. |
| **P2 · Toy: "Two Chefs"** | 3 weeks | **The netcode test.** 2 chefs online, grab, throw, Heavy Haul, VoxelOps replication, voice | Playable at 120 ms and 2% loss. No visible desync in 20 test sessions. Voice works across Chrome, Firefox and Safari. |
| **P3 · Vertical slice** | 8 weeks | Chapter 1, levels 1–3: Mossback, cravings, critters, the Big Bite cinematic, auto-clip, results, the lobby, invite links | 10 duos play blind. Median rating ≥ 4/5. ≥ 30% voluntarily export a clip. Time to kitchen < 20 s. |
| **P4 · Production alpha** | 12 weeks | Chapters 1–3 complete, progression, cookbook, crews, the Daily Feast, verified leaderboards, mobile | Closed beta ready. Performance budgets met on reference devices. |
| **P5 · Closed beta** | 6 weeks | 200–500 duos (Discord), telemetry, tuning, chapter 4 | Share rate ≥ 8%, invite conversion ≥ 45%, D7 ≥ 18% (duos) |
| **P6 · Public beta** | 8 weeks | Chapters 5–6, Food Fight, the streamer mode, web portals launch | Launch checklist (§5) |

**Total to public beta: about 42 weeks (about 10 months).** The vertical slice (P3) lands at about week 16: that's the point to decide whether to continue, pivot or fall back.

## 2. Workstream breakdown (P3 vertical slice)

| Workstream | Key deliverables | Doc |
|---|---|---|
| Simulation | Voxel food (cut, heat, fire, coats), terrain ops, the structural check, the Palate | [05](./05-interactions-and-cooking.md) |
| Game systems | Belly, mood, cravings, critters (the V1 pacer), director, scoring | [03](./03-game-design.md) |
| Netcode | Rooms, signaling, star sync, prediction, intents, VoxelOp replication, reconnect | [10](./10-multiplayer-and-netcode.md) |
| Voice | Mesh audio, VAD, mouth flaps, mute | [11](./11-voice-and-communication.md) |
| Rendering | Greedy meshing with AO, palette shader, food ramps, lighting rig, post stack, VFX basics | [07](./07-art-direction.md) |
| Characters | Chef puppet, procedural animation, Mossback puppet, 6 reactions, the Big Bite shots | [08](./08-characters-and-camera.md) |
| Levels | 3 levels of chapter 1 plus the lobby, the import pipeline, the validator | [06](./06-level-design.md) |
| UI | Lobby, pre-service, HUD, results, settings (core) | [15](./15-ux-onboarding-accessibility.md) |
| Social | Invite links, the auto-clip, local export, OG link previews | [13](./13-social-and-virality.md) |
| Audio | Chapter 1 music (4 stems), about 80 SFX, Mossback vocals | [14](./14-audio-and-music.md) |

## 3. Risk register

| # | Risk | Likelihood | Impact | Mitigation | Owner signal |
|---|---|---|---|---|---|
| R1 | **Voxel cooking is fiddly, not fun** | Medium | Critical | P1 tests this first. Snap-angle cuts. The fallback model in [05 §10](./05-interactions-and-cooking.md). | P1 playtest results |
| R2 | **Determinism breaks across browsers** | Medium | High | Integer simulation, the Rapier deterministic build, a lint ban on Math functions, a 3-browser CI replay test from P0 | A CI hash mismatch |
| R3 | **P2P connectivity failures** (strict NATs, corporate networks) | Medium | High | TURN fallback, the plan B relay transport ([10 §11](./10-multiplayer-and-netcode.md)) | Connect-failure rate > 5% |
| R4 | **Mobile performance** | High | Medium | Quality tiers, chunk LOD, simulation budgets, a 30 fps target on mobile, early device testing in P2 | Reference phone < 30 fps |
| R5 | **Scope creep** (6 chapters × 6 tools) | High | High | The vertical slice gate. Chapters 4–6 are cut-able. Tools are data-driven. | Burn-down at the P4 midpoint |
| R6 | **Big Bite reactions feel repetitive** | Medium | Medium | A reaction library with variants, highlight-driven selection, rare reactions (5%) | Telemetry: clip share rate dropping after service 5 |
| R7 | **Voice permission or quality issues** | Medium | Medium | Strong ping and quick-chat systems, voice is optional | Voice-enabled rate < 40% among friends |
| R8 | **Moderation load** (public rooms, clips) | Low (V2.0) | Medium | Friends-only at launch, generated titles, no free-text in clips, a report flow | Report volume |
| R9 | **Cost surprises** (TURN, clip storage) | Low | Medium | Rate limits, 90-day clip expiry, local-only export by default, check provider pricing | Monthly bill > the agreed cap |
| R10 | **The concept looks derivative** | Low | High | The positioning table in [02 §5](./02-vision.md). Lead marketing with the voxel food simulation and the Giants, which nobody else has. | Press and community feedback |

## 4. Kill and pivot criteria (pre-agreed)

- **After P1:** if voxel cooking fails its test twice (after one iteration), adopt the simplified fallback model and continue. *The Giants, the edible world and the duo tools still carry the concept.*
- **After P3:** if the vertical slice median rating is < 3.5/5 **and** under 15% export a clip, stop content production. Run a 4-week concept-refinement sprint on the weakest pillar (identified from playtest notes) before investing in P4.
- **Netcode:** if P2 can't meet its exit criteria in 2 extra weeks, switch to the plan B relay transport (budget: about €10/month VPS) rather than polishing P2P.

## 5. Public beta launch checklist

- [ ] All P5 KPI targets met, or explicitly waived.
- [ ] Performance budgets met on the reference devices ([09 §10](./09-technical-architecture.md)).
- [ ] ≥ 98% of services complete without an unrecovered desync (telemetry).
- [ ] Accessibility checklist ([15 §6](./15-ux-onboarding-accessibility.md)) complete.
- [ ] Localization complete in EN, FR, ES, with zero overflow in the screenshot CI.
- [ ] Legal: privacy notice (telemetry, voice P2P, clips), a minimal ToS, an age statement, clip takedown process.
- [ ] Press kit, trailer (60 s), 10 seed clips, a creator kit page.
- [ ] V1 preserved at `/classic` with its leaderboards (the H1–H8 fixes from [01 §2](./01-codebase-audit.md) applied).

## 6. Immediate next steps (this month)

1. **Push the local work to GitHub** (levels 6–10 and the newer code are only in the local folder) and fix the leaderboard level keys (audit H1 and H2).
2. Approve or adjust the concept (this doc set). The key decisions are listed in [README.md](./README.md#decisions-needed).
3. Start **P0**: the workspace scaffold and the `v1-to-vox` converter.
4. Build the **P1 "Cut & Burn" toy** and test it with 6 people before writing any more design.
