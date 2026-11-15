# 01 · Codebase Audit (V1 → V2)

> Scope: the GitHub `main` branch (commit `5703b64`, "easier player moving") **and** the local working copy `kitchen-sim-final`, which is ahead of GitHub. Every file under `src/`, `netlify/functions/`, `supabase/`, `scripts/` and `public/levels/` was read. The repo totals about 15,700 lines (JS, CSS, HTML, docs).
>
> Verdict scale: **KEEP** (carry over almost as is) · **IMPROVE** (keep the idea, rework the code) · **REPLACE** (keep the need, write a new system) · **DROP** (gone in V2).

---

## 1. Executive summary

V1 is a **competent single-player prototype** of the arcade-kitchen genre. It ships, it runs on mobile, it is localized in three languages, it has a level editor and an online leaderboard, and the backend is set up with care (no Supabase key on the client, RLS on). That is a solid base and more than most hobby projects reach.

It is also a **dead end for V2 as written**. That comes from three structural choices, not from code quality:

1. **Game state lives inside Three.js meshes** (`mesh.userData.contents`, `userData.processingState`, `userData.occupiedBy`). Nothing can be serialized, diffed, replayed or sent over a network without rewriting it. Multiplayer is impossible on top of this.
2. **The game is the camera.** Movement, interaction (camera-center raycast), held-item placement (child of the camera) and collision all assume one first-person camera. Third-person characters and a second player both break the core assumption.
3. **Content is encoded as special cases in code.** Pizza and grilled cheese are hardcoded "morphs" in `interaction.js`. Item kinds are guessed from strings (`type.includes('cooked')` in `items.js`). Recipes are exact sorted-array matches. Every new dish costs code, not data.

**Recommendation:** V2 is a **new codebase in `/v2`** (or a `v2` workspace package) that coexists with V1. V1 stays deployed and frozen except for fixes. V2 lifts the *assets*, *data*, *backend patterns* and a few *algorithms* from V1, and rewrites the runtime around a pure, deterministic, serializable simulation (see [09-technical-architecture.md](./09-technical-architecture.md)).

Roughly **25–30% of V1 survives in some form**: almost all of it is content, data, backend or tooling. Almost none of the runtime gameplay code does. That is the honest number, and it is the right call.

---

## 2. Repository health findings (fix these in V1 regardless)

| # | Finding | Evidence | Severity |
|---|---|---|---|
| H1 | **GitHub is behind the real project.** The local folder has levels 6–10, `GAME_LEVELS_ROADMAP.md`, about 780 changed lines in `voxelBuilder.js` and edits to `main.js`, `ui.js`, `i18nData.js`. `public/levels/game_roadmap.json` on GitHub lists only 5 levels. | `diff -rq` repo vs local | High: the open-source release doesn't match the game |
| H2 | **The global leaderboard ignores levels 6–10.** The official keys are hardcoded to `level:1..5` in two places, and the default allowed keys are `level:1..5`. Scores on levels 6–10 are rejected unless `ALLOWED_LEVEL_KEYS` is set in Netlify. | `netlify/functions/leaderboard.mjs:31,94`, `_supabase.mjs:20` | High |
| H3 | **Leaderboard aggregation silently truncates.** The global board loads `limit=2000` rows and sums them in memory. Past 2,000 entries, totals are wrong without any error. | `leaderboard.mjs` | Medium (grows with success) |
| H4 | **Scores are fully trusted from the client.** The only check is a clamp to `MAX_SCORE = 50000`. Anyone can `POST` a top score. | `leaderboard.mjs`, `onlineService.js` | Medium now, High once promoted |
| H5 | **The player token is a bearer secret sent in a query string** on `DELETE /levels?playerToken=…`. It ends up in access logs and proxies. | `onlineService.js:deleteCustomLevel` | Low |
| H6 | **Production ships a 3 MB source map** (`sourcemap: true`). | `vite.config.js`, `dist/assets/*.js.map` | Low |
| H7 | `validate-content.mjs` only checks the first 5 levels. | `roadmap.slice(0, 5)` | Low |
| H8 | `docs/*.md` describe a "v1.0 architecture" that no longer matches (GLTF preloading, `Processor progress 0.0–2.0`, Socket.io…). Docs and code have drifted. | `docs/GAME_SYSTEM_DESIGN.md` | Low |

---

## 3. File-by-file verdicts

### 3.1 Runtime core

| File | Lines | What it does | Verdict | Rationale |
|---|---:|---|---|---|
| `src/main.js` | 1,779 | Entry point, 16-state string state machine, menu routing, community levels, leaderboard UI, editor hub, FPS limiter, settings, the render loop | **REPLACE** | A god module with about 25 module-level `let` globals. It mixes app shell, game loop, networking calls and DOM. V2 splits this into `app/` (shell + routing), `game/` (session) and `ui/` (screens). The **FPS-cap and resolution-scale logic** (`applyResolutionSetting`, `setTargetFPS`) is worth porting as is. |
| `src/setup.js` | 77 | Scene, camera, renderer, three lights, fog | **IMPROVE** | Sensible defaults (ACES tone mapping, PCF shadows downgraded on mobile, warm key plus cool rim). V2 keeps the idea and moves to the lighting rig in [07-art-direction.md](./07-art-direction.md). |
| `src/controls.js` | 498 | PointerLock FPS controls, keyboard, gamepad, virtual joysticks for mobile | **IMPROVE** | The **gamepad deadzone handling and mobile twin-joystick code are good** and should be ported into the V2 input layer. PointerLock and FPS look are dropped. Input must become an *action map* producing serializable `InputFrame`s (needed for netcode). |
| `src/player.js` | 198 | Moves the camera object, AABB collision against every kitchen object, held item parented to the camera | **REPLACE** | Collision is O(n) over all objects each step. Bounds are a hardcoded 8×8 room (`KITCHEN_BOUNDS`). The "player" *is* the camera. V2 has a character controller on a physics engine. |
| `src/interaction.js` | 813 | Camera raycast targeting, the whole interaction matrix, timed processing, blender logic, pizza and grilled-cheese morphs | **REPLACE** | This is the heart of V1 and the hardest to evolve: a large `if/else` tree keyed by string types, with mesh mutation as state. The **interaction matrix itself (hand state × target state → action)** is a good design artifact and seeds the V2 verb table ([05-interactions-and-cooking.md](./05-interactions-and-cooking.md)). |
| `src/items.js` | 132 | Item factory, plate completion check, plate visuals | **REPLACE** | Item kind is guessed from substrings (`includes('cooked')`, `includes('base')`). Recipe matching needs an exact sorted list. V2 uses typed item definitions and tolerant dish evaluation. |
| `src/grid.js` | 69 | 2D occupancy grid per surface | **IMPROVE** | Simple and correct. The *idea* (surfaces expose snap slots) survives as "sockets" on station modules. The 2D grid itself is too limited for a 3D voxel world. |
| `src/LevelManager.js` | 295 | Level timer, order generation, scoring, stars | **IMPROVE** | `calculateNextOrderDelay()` is **the best gameplay code in the repo**: difficulty factor, recipe complexity, "rush hour" burst chance, load easing, ±20% jitter. Port it nearly verbatim as the *critter-order pacer* in V2. The class itself is coupled to `uiManager` and must become a pure system emitting events. |
| `src/world.js` | 646 | Builds the kitchen from level JSON, labels, smart tables, wall resizing | **REPLACE** | Assumes flat floor plus walls plus counters. The label grouping (one label per run of serving counters) reflects a known UX preference, so keep that rule. |
| `src/voxelBuilder.js` | 1,677 | ASCII voxel "icons", procedural voxel meshes for every station and item | **IMPROVE (high value)** | See §4. This is V1's main asset base. |
| `src/constants.js` | 182 | Gameplay constants and the editor catalog | **IMPROVE** | The catalog becomes data files (`content/stations/*.json`). |
| `src/ids.js` | 127 | Canonical IDs for meals and stations | **KEEP (pattern)** | A single source of truth for IDs is correct. V2 generates typed ID unions from content files. |
| `src/gameData.js` | 646 | Recipes with time, score, penalty, `visualSteps` and instructions in EN/FR/ES | **IMPROVE** | Keep the **recipe graph knowledge** (potato → raw_fries → cooked_fries…). It becomes the "prep chain" data that critter orders draw from. Move instructions out of recipe data into i18n. `visualSteps` are dropped: V2 teaches diegetically. |
| `src/utils/legacyMigration.js` | 128 | Renames legacy level keys | **DROP** | V2 has no legacy levels. |

### 3.2 UI, meta and services

| File | Lines | Verdict | Rationale |
|---|---:|---|---|
| `src/ui.js` | 854 | **REPLACE** | Imperative DOM with `innerHTML` templates, HUD plus menus in one class. V2 uses a small reactive UI layer (Preact plus signals, about 4 KB) and a separate in-world UI system. |
| `src/menuManager.js` | 324 | **IMPROVE** | The **gamepad-navigable menu focus logic** is worth keeping as a reference. Menus must be controller-friendly in V2 because couch co-op is a target. |
| `index.html` | 615 | **REPLACE** | All screens are static DOM in one file. |
| `style.css` | 2,372 | **IMPROVE** | Keep the visual identity tokens (colors, radii, fonts) as V2 design tokens. The rest is rewritten per component. The overflow-free responsive rule stays a hard constraint. |
| `src/i18nData.js` | 642 | **KEEP (content)** | EN/FR/ES strings are real value. Move them to `locales/{en,fr,es}.json`, use ICU message format, and add a CI check that fails on missing keys. |
| `src/saveManager.js` | 254 | **IMPROVE** | localStorage with a single key. V2 adds schema versioning and migrations, and splits *settings*, *profile* and *progress*. |
| `src/audioManager.js` | 127 | **KEEP (as a layer)** | Procedural WebAudio SFX (pop, place, chop noise burst…) is charming and weighs nothing. V2 keeps it as the "UI blips" layer and adds sampled, spatialized SFX and adaptive music ([14-audio-and-music.md](./14-audio-and-music.md)). |
| `src/onlineService.js` | 70 | **KEEP (pattern)** | A clean thin client over Netlify Functions. It extends with new endpoints. |
| `src/thumbnailHelper.js` | 192 | **IMPROVE** | Off-screen rendering of voxel thumbnails. Reuse it for the cookbook, share cards and level previews. |
| `src/editor.js` | 1,886 | **DROP for V2.0, revisit later** | Tightly coupled to the V1 flat layout model. V2 *architects* for a future editor (everything is data, levels are chunk files) but doesn't build one in the first release. See [06-level-design.md §9](./06-level-design.md). |

### 3.3 Backend

| File | Verdict | Rationale |
|---|---|---|
| `netlify/functions/_supabase.mjs` | **KEEP** | Server-side secret key, nickname sanitizing, token format validation: the right pattern. |
| `leaderboard.mjs` | **IMPROVE** | Fix H2, H3 and H4. Move aggregation into SQL (a materialized view or `GROUP BY`). Add run verification ([10-multiplayer-and-netcode.md §9](./10-multiplayer-and-netcode.md)). |
| `levels.mjs`, `rate.mjs` | **KEEP, dormant** | Community levels come back with the editor. The schema stays in place. |
| `keep-alive.mjs` | **KEEP** | Keeps the free Supabase project awake. Still needed. |
| `supabase/schema.sql` | **IMPROVE** | Add `crews`, `runs`, `feast_clips`, `daily_feasts`, `friend_codes` ([13-social-and-virality.md](./13-social-and-virality.md)). |

### 3.4 Content

| Asset | Verdict | Notes |
|---|---|---|
| 10 level JSON files | **DROP as levels, KEEP as reference** | Flat 8×8 rooms can't express V2 levels. Their *pacing data* (duration, `maxActiveOrders`, `orderTimeMultiplier`, star thresholds) is a useful starting point for tuning critter orders. |
| 13 recipes and their prep chains | **KEEP** | Repurposed as *critter orders* (the small, fast, recipe-based orders in V2). |
| Voxel art for about 60 items and 15 stations | **KEEP** | Converted to `.vox` ([§4](#4-the-voxel-pipeline-in-detail)). |
| Theme objects per level (`floorColor1`, `counterStyle`…) | **IMPROVE** | They become biome palettes. |

---

## 4. The voxel pipeline in detail

`voxelBuilder.js` is where V1's identity lives, and also its main performance problem.

**What is good**
- 16×16 ASCII "icon" art per item with a color key is a **delightful, diff-able, open-source-friendly authoring format**. People can contribute art in a pull request.
- A shared `PALETTE` gives the game a coherent look.
- Procedural station builders (`createFryerMesh`, `createPizzaOvenMesh`…) give everything a hand-made feel.

**What has to change**
1. **No hidden-face culling.** `VoxelBuilder.add()` clones a full `BoxGeometry` (24 vertices, 12 triangles) for *every* voxel, then merges. Faces between neighboring voxels are kept. A solid 10×10×10 block is about 12,000 triangles where a greedy mesher gives 12. V2 must use **greedy meshing with per-vertex ambient occlusion** (a classic voxel technique and almost free visually).
2. **A new material per mesh.** `buildMesh()` creates a fresh `MeshStandardMaterial` every time, so there is no batching and shaders recompile. V2 uses **one shared vertex-color material per render pass**, plus a palette texture.
3. **No geometry cache.** Every spawned tomato rebuilds its geometry. V2 caches by `(itemDef, state)` and uses `InstancedMesh` for repeated props.
4. **Items are opaque meshes.** V2 needs food to be a *voxel volume* that can be cut and heated ([05-interactions-and-cooking.md](./05-interactions-and-cooking.md)). So items stay voxel *data* at runtime, and meshes are derived from it.

**Migration path (automatable, about 1 day):** write `scripts/v1-to-vox.mjs`. It imports `voxelBuilder.js` in Node, runs each `create*Mesh` and `ICONS` entry through a fake `VoxelBuilder` that records `(x, y, z, color)` instead of building geometry, and writes MagicaVoxel `.vox` files plus a palette. That turns the whole V1 art base into V2 source assets that can be edited in MagicaVoxel or Goxel.

---

## 5. Design audit (not just code)

| V1 design decision | Assessment | V2 direction |
|---|---|---|
| **First-person camera** | Immersive solo, but it hides the most expressive thing in a co-op game: *your partner's body*. There is no slapstick, no reading of intent, no clip-worthy framing. It's also hard on mobile and causes motion sickness for some players. | Third-person characters with a shared-world camera. See [08-characters-and-camera.md](./08-characters-and-camera.md). |
| **Exact recipe matching** | Binary pass/fail. No room for creativity, no "how did you make *that*?" moments. | Tolerant evaluation and freeform "cravings". See [03-game-design.md](./03-game-design.md). |
| **Instant chopping, timed cooking with no burn state** | Low skill ceiling and few failure stories. The V1 roadmap already wanted spoilage and fire. | Continuous, visible voxel cooking with a gradient from raw to burnt. |
| **Flat rooms with walls and counters** | The person who owns the project already flagged this: every level is a variation of the same box. | Vertical, destructible, edible dioramas. See [06-level-design.md](./06-level-design.md). |
| **Level timer as a UI countdown** | Abstract. | A diegetic clock: the Giant's hunger. |
| **One item in hand** | A good genre constraint. Keep it. | Kept, plus a tool per chef. |
| **Difficulty = time multipliers (beginner/expert)** | Works and it's cheap. | Becomes the *Assist* system plus chef scaling. |
| **Leaderboard by level** | Fine, but solitary and easy to cheat. | Crew leaderboards, the Daily Feast, verified runs. |
| **Editor unlocked after level 5** | A nice reward, but it competes for dev time. | Deferred. The architecture stays editor-ready. |

---

## 6. What V2 inherits: the short list

1. Three.js and Vite, the Netlify plus Supabase stack and its security pattern.
2. The voxel art base (converted to `.vox`) and the palette.
3. EN/FR/ES localization content.
4. The order-pacing algorithm (`calculateNextOrderDelay`).
5. The recipe graph (13 recipes and their prep chains) as critter orders.
6. Gamepad deadzone handling, mobile twin-stick and menu focus navigation.
7. Procedural WebAudio SFX.
8. The nickname-only, token-based identity (no accounts, no OAuth), extended with friend codes and crew codes.
9. The thumbnail renderer.
10. The V1 game itself, kept live at `/classic` as a playable heritage mode.
