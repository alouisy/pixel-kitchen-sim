# 06 · Level Design

V1 levels are **floor plans**: an 8×8 room, walls, counters, stations. Every level is a rearrangement of the same box, which is exactly the limit that was flagged. V2 levels are **dioramas**: vertical, destructible, edible places built around a living Giant, with a story told in six minutes.

---

## 1. Principles

1. **The Giant is the landmark.** It is visible from everywhere, it orients the player, and it is often *the ground itself*.
2. **Three layers of space:** *Camp* (safe, stations), *Pantry* (harvestable, risky), *Links* (paths that the crew can create, change or destroy).
3. **Verticality by default.** At least 3 height tiers per level. Height carries a trade-off: high pantries are rich but far.
4. **Every tool has a reason to touch the terrain.** If the chapter's tools only cook, the level is wrong.
5. **The level changes during service.** At least one *Set Piece* and one *Giant-driven* transformation per level.
6. **Readable at a glance.** Silhouette-first composition: one hero shape (the Giant), one secondary (Camp), pantry clusters with distinct colors.
7. **No soft-locks.** Anchors, regrowth and a pathfinding watchdog guarantee that the Mouth and the Camp stay reachable.

## 2. Anatomy of a level

```
             ┌──────────────── GIANT ────────────────┐
             │  Mouth (serve)   Body zones (walkable, │
             │                  hazards, pantry)      │
             └───────▲──────────────────▲────────────┘
                     │ Link (ramp/bridge)│ Link (melt ramp)
   ┌─────────┐   ┌───┴────┐         ┌───┴─────┐
   │ PANTRY A│◀─▶│  CAMP  │◀──────▶│ PANTRY B │  (high tier, rich, far)
   │ (near,  │   │stations│  Link   │          │
   │  poor)  │   │ platter│(destroyable)        │
   └─────────┘   └────────┘         └─────────┘
                     ▲
                 Critter Counter
```

| Zone | Size (2 players) | Content |
|---|---|---|
| **Camp** | 8–12 m across | 6–10 stations, Feast Platter, Critter Counter, Tool Rack |
| **Pantries** | 2–4 zones, 4–10 m each | 1–3 materials each, a regrowth budget |
| **Links** | 3–8 | Static, destroyable, or player-created (melt ramps, ice bridges, sauce bridges) |
| **Giant body** | Varies | Walkable parts (shell, arm, hat), the Mouth, hazard sources |
| **Outskirts** | Decorative | A non-playable backdrop at reduced voxel density (the miniature diorama edge) |

**Typical walk times** (the tuning target): Camp ↔ nearest pantry 3–4 s, Camp ↔ far pantry 8–12 s, Camp ↔ Mouth 4–6 s. The longest critical-path loop should take ≤ 25 s without shortcuts.

## 3. Level archetypes

Variety comes from **structural archetypes**, not from new stations.

| Archetype | Structure | Example |
|---|---|---|
| **On the Giant** | Camp is on the Giant's back. The Giant moves, so the level tilts and travels. | *Mossback's Shell*: cook on a walking tortoise |
| **Around the Giant** | The Giant sits in the middle, pantries all around (a hub-and-spoke layout) | *Queen Glacé's Throne* |
| **Toward the Giant** | A linear path. The Giant is far away and you deliver by relay or catapult. | *The Long Spoon*: a 40 m conveyor of thrown dishes |
| **Inside the world** | A cave or burrow pantry. Light is limited and the Torch doubles as a lamp. | *Truffle Mines* |
| **Two Giants** | Two Mouths, conflicting cravings. The crew must split. | *Puff & Pastry* (the chapter 5 boss) |
| **Rising** | A liquid level rises (syrup tide, broth flood). Camp tiers are lost progressively. | *Broth Flood* |
| **Rotating** | The world rotates on a schedule (a lazy-Susan island, the Giant turning). Pantries come and go. | *Carousel of Crumbs* |
| **Build-it** | Little terrain at the start. Grow Spritzer chapters let players *grow* their links and pantries. | *Sky Orchard* |

## 4. Chapters and biomes

| Ch. | Biome | Giant | Tools | Materials introduced | Set-piece signature |
|---|---|---|---|---|---|
| 1 | **Mushroom Meadow** | *Old Mossback*, a hill-sized tortoise. Sleepy and kind. | Cleaver + Torch | mushroom, bread rock, cheese cliff, potato roots, herb moss | Mossback stands up mid-service: Camp tilts 15° |
| 2 | **Sorbet Peaks** | *Queen Glacé*, a frost giantess on an ice throne. Picky, dramatic. | Frost Fan + Whisk | sorbet ice, cream snow, berry crystals, meringue | A blizzard: visibility drops, frozen ground |
| 3 | **Pepper Dunes** | *Sizzlewyrm*, a long desert serpent. Impatient. | Ladle Cannon + Magnet Fork | pepper ridge, flatbread sand, date palms, sauce springs | Sandstorm conveyor; the serpent coils around Camp |
| 4 | **Ramen Reef** | *Captain Brine*, a whale wearing an island as a hat. Jovial. | Rolling Pin + Shaker | kelp noodles, egg coral, fish-cake reef, broth pools | Broth tide rises and falls; Captain Brine dives |
| 5 | **Sky Orchard** | *Puff & Pastry*, a two-headed cloud giant. Contradictory. | Grow Spritzer + Preserve Jar | cloud bread, apple islands, honey comb, wind | Islands drift apart; the Twins argue (split cravings) |
| 6 | **The Molten Pantry** | *Mother Hunger*, a volcano-sized giant, the "boss of bosses" | All tools | chocolate magma, obsidian sugar, every earlier material | The volcano erupts *food*: the level fills with ingredients during the finale |

Each chapter has **5 services + 1 boss service**. The boss is a 7-minute service with three Big Bites (phases).

## 5. Level pacing template

Every level follows an **intensity curve** authored as data:

```
intensity
  1.0 |                                 ┌──Big Bite──┐
  0.8 |                  ╭── SetPiece ──╯            │
  0.6 |        ╭─────────╯                           │
  0.4 |   ╭────╯                                     │
  0.2 |───╯ Arrival                                  │ Results
      └──────────────────────────────────────────────┴───── time
        0:00   1:00   2:00   3:00   4:00   5:00   6:00
```

```jsonc
// content/levels/ch1_l3/level.json (excerpt)
"director": {
  "duration": 360,
  "intensity": [[0,0.2],[45,0.4],[120,0.6],[200,0.85],[270,0.7],[290,1.0]],
  "setPieces": [{ "at": 200, "id": "mossback_stands", "telegraph": 6 }],
  "grandCravingAt": 270,
  "cravingPool": "ch1_mid", "critterPool": "ch1_mice",
  "hazardSet": "mossback"
}
```

The **Director** turns intensity into concrete rates (critter order delay via V1's pacer, hazard interval, craving window width). Designers tune curves, not timers.

## 6. Construction and data format

### 6.1 Units and grid
- **Terrain voxel:** 1/8 m (12.5 cm). A chef is about 13 terrain voxels tall (1.6 m).
- **Chunks:** 32×32×32 terrain voxels (4 m cubes).
- **Typical level bounds:** 64×24×64 m = 16×6×16 chunks, sparse, and usually ≤ 300 non-empty chunks.

### 6.2 Files
```
content/levels/ch1_l3/
  level.json          // metadata, director, spawns, anchors, links, giant placement
  terrain.vxl         // chunked, run-length-encoded voxels (material ids), zstd-compressed
  props.json          // station modules, decorative prefabs (references to .vox assets)
  lighting.json       // biome preset + overrides (see 07-art-direction.md)
  navhints.json       // optional authored nav overrides
```

### 6.3 Authoring workflow (V2.0, without a built-in editor)
1. **Block-out** in MagicaVoxel (free, widely used) at terrain resolution, using a reserved palette where *palette index = material id*. Big levels are split across several `.vox` scenes, one per region.
2. **Import:** `scripts/import-level.mjs` converts `.vox` files into `terrain.vxl` chunks, validates materials, and extracts *marker voxels* (reserved palette colors for spawns, anchors, sockets and the Giant's anchor) into `level.json`.
3. **Dress:** props and stations are placed in `props.json` with a **debug overlay** in-game (`?dev=1`): fly cam, click to place a prefab, write back to JSON through the Vite dev server. This is a tiny *proto-editor*, and the seed of the future editor (§9).
4. **Validate:** `npm run validate` checks reachability (a flood-fill nav check between Camp, every pantry and the Mouth), anchor coverage, the material budget and the station set against the tool chapter.

### 6.4 Level design checklist (per level)
- [ ] The Giant is readable from Camp at the default camera.
- [ ] There's a path from Camp to the Mouth that doesn't depend on destroyable voxels.
- [ ] Each chapter tool has at least 2 terrain uses on the critical path.
- [ ] There's at least one tandem opportunity worth > 10% of the max score.
- [ ] A Set Piece is telegraphed for ≥ 5 s.
- [ ] The Big Bite camera has clear sight lines from 3 angles ([08 §6](./08-characters-and-camera.md)).
- [ ] The level runs within the perf budget on the reference phone (§8).
- [ ] The intensity curve has been playtested with 3 duos and adjusted.

## 7. Worked example: *Mossback's Shell* (chapter 1, level 3)

**Fantasy:** "Our kitchen is a tea party on a walking tortoise."

- **Layout:** Camp sits on the flat top of Mossback's shell (tier 2, +6 m). A mushroom forest grows from the shell's moss (Pantry A, near, regrowing). A **cheese cliff** flanks the shell's left side (Pantry B, tier 1 below Camp). Bread-rock boulders lie on the meadow floor (Pantry C, tier 0, far).
- **Links:** a moss ramp (static) from the shell to the meadow. A cheese cliff ramp that the **Torch melts** into a slide-and-ramp shortcut. A fallen log bridge that **Mossback's tail sweep** can knock away (regrows at 20 s).
- **Mouth:** Mossback's head stretches back toward Camp every 40 s ("open wide!" moment). Serving in that 6 s window gives a ×1.2 bonus. Otherwise, use the Serving Chute.
- **Set Piece (3:20):** Mossback stands up and walks 10 m. Camp tilts 15°, loose items slide toward the edge, and the meadow pantry swaps for a new region (a river-bank pantry with potato roots).
- **Grand Craving (4:30):** "A tall MUSHROOM TOWER, crunchy on top!" Toasted bread rock on top of stacked seared mushrooms, glued with melted cheese.
- **Tandem moment:** a Giant Puffball mushroom (a 12 vu Heavy Haul). It's the biggest single scoring item if seared with a Flash Sear.

## 8. Performance budgets per level

| Item | Desktop | Mobile |
|---|---|---|
| Non-empty terrain chunks | ≤ 400 | ≤ 250 (outskirts LOD dropped) |
| Visible triangles (after greedy meshing) | ≤ 1.2 M | ≤ 400 k |
| Draw calls | ≤ 250 | ≤ 120 |
| Dynamic lights | 1 shadowed sun + ≤ 8 point lights (fires, ovens) | 1 sun + ≤ 4 |
| Particle budget | 6 k | 2 k |
| Level download (compressed) | ≤ 1.5 MB | same |

## 9. Toward a future editor

Not built in V2.0, but everything above is shaped for it:
- Levels are already data plus chunks. An editor is a UI over the same files.
- The `?dev=1` proto-editor already writes `props.json`.
- Supabase's `custom_levels` table and the `levels.mjs` / `rate.mjs` functions from V1 can store and rate V2 levels with a new `format_version` column.
- **Editor V2.x scope (proposed):** a "Diorama Kit" built from pre-made terrain blocks (a cliff, a mushroom cluster, a cheese wall), a Giant chosen from the roster, craving pools from presets, and a share link. Snapping blocks gives creators quality output without voxel-painting skills. That's the lesson from V1's editor: freeform tools give flat, boring maps.
