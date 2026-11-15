# 05 · Interactions and Voxel Cooking

This is the signature system of V2: **food is a voxel volume that you physically cut, heat and assemble.** This document specifies the data model, the algorithms, the stations and the budgets. Read [03-game-design.md §5](./03-game-design.md) first for the flavor model.

---

## 1. Design goals and anti-goals

**Goals**
- Any cut, anywhere, at any angle (within the voxel grid) gives a correct result.
- Heat visibly travels from the surface to the core. Over-cooking is visible before it's irreversible.
- The same rules apply to food in a chef's hand, on a station, on the floor and in the terrain.
- It's deterministic (integer math) so it can be networked and verified ([10-multiplayer-and-netcode.md](./10-multiplayer-and-netcode.md)).

**Anti-goals**
- No fluid dynamics inside food. Sauces are a *surface attribute*, not simulated liquid.
- No real-time soft-body physics. Food is rigid. "Squish" is a visual effect.
- No sub-voxel precision. If it's not on the grid, it doesn't exist.

---

## 2. Data model

### 2.1 Food object (`FoodBody`)

```ts
interface FoodBody {
  id: EntityId;                 // network-stable
  dims: [u8, u8, u8];           // bounding box in food voxels, max 24×24×24
  voxels: Uint8Array;           // material index per cell, 0 = empty  (dims product bytes)
  doneness: Uint8Array;         // 0..255 per cell (only allocated once heated)
  char: Uint8Array;             // 0..255 per cell (lazy)
  temp: Int16Array;             // in 0.25 °C steps, relative to ambient (lazy)
  coat: Uint8Array;             // surface coat id per cell: sauce, seasoning, glaze (lazy, sparse)
  flags: u16;                   // ASLEEP, ON_FIRE, FROZEN, DIRTY, HELD, IN_DISH, …
  transform: RigidTransform;    // from the physics engine
  version: u32;                 // bumped on every structural change (cut, merge)
}
```

- A typical ingredient is 6×6×6 to 12×12×12 (216–1,728 cells). The 24³ cap (13,824 cells) is for big Heavy Haul chunks and the Feast Platter contents.
- Lazy attribute arrays keep memory low: a raw carrot has no `temp`, `doneness` or `char` buffers until it's heated.
- `materials` is a global table of up to 255 entries (`content/materials/*.json`):

```jsonc
{
  "id": "mushroom", "index": 12,
  "flavor": { "umami": 0.5, "sweet": 0.05 },
  "texture": { "chewy": 0.4, "juicy": 0.5 },
  "thermal": { "conductivity": 18, "cookStart": 55, "perfect": [0.55, 0.8], "charStart": 0.92 },
  "flammability": 0.1, "density": 0.6,
  "colors": { "raw": "#c9a27e", "cooked": "#8a5a3c", "charred": "#2b1d18" },
  "cutSfx": "soft", "edible": true
}
```

### 2.2 Dish (`DishAssembly`)
A **dish** is a set of `FoodBody`s **glued** together on a *base* (a plate, a platter, or a food item that acts as a base, like bread).

- Glue happens when two bodies touch and **at least one contact cell has a sticky coat** (sauce, melted cheese, caramel), *or* when they're placed on a dish base.
- The dish is a compound rigid body. Its *evaluation* (§7) runs over the union of its bodies.
- Dishes can be **broken apart** by the Cleaver (a slice through the glue line) or by a hard impact (> 6 m/s), which is the comedy of dropping a tower.

### 2.3 Terrain
Terrain uses the *same* material table on a chunked world grid (see [09-technical-architecture.md §5](./09-technical-architecture.md)) at **half the food resolution** (1 terrain voxel = 2×2×2 food voxels). When a chunk of terrain is harvested, the carved region is **resampled ×2** into a new `FoodBody` (each terrain voxel becomes 8 food voxels with a little noise on surface cells for an organic look).

---

## 3. Cutting (Cleaver)

### 3.1 Player-facing behavior
- **Slice (primary, hold):** the chef raises the Cleaver and a translucent **cut plane** appears, oriented by aim (mouse) or by the chef's facing and right-stick tilt (gamepad). Releasing chops through the target along that plane.
- Plane orientation **snaps to 8 directions horizontally and 3 tilts** (0°, 45°, 90°). Gamepad players get good cuts without fiddly aiming. Keyboard and mouse players can hold Alt for free angles.
- **Dice (primary, mash):** each tap within 0.4 s of the last adds a cut rotated 90°. Three taps on a vegetable gives cubes.
- **Carve (alt):** on terrain, removes a sphere of radius 3 terrain voxels and turns it into a FoodBody in hand. On food, carves a scoop (a melon baller effect).

### 3.2 Algorithm
```
cut(body, plane):
  1. Transform the plane into the body's local voxel space.
  2. For every solid cell, classify its center: side = sign(dot(n, c) - d).
     (Integer: the plane is stored as n ∈ Z³ with |n| ≤ 4, d ∈ Z; exact and deterministic.)
  3. Split into A (side ≥ 0) and B (side < 0).
  4. Flood-fill (6-connectivity) each side to find connected components.
     A single cut can produce more than 2 pieces (cutting a U shape).
  5. Discard components smaller than 2 cells (they become particles: crumbs).
  6. Each component → a new FoodBody with a tight bounding box; copy the attribute arrays.
  7. Mark newly exposed faces as SURFACE for the crust rules (§4.3).
  8. Physics: give each piece a separation impulse along ±n (0.6 m/s).
Complexity: O(cells). Under 0.2 ms for 12³ in a worker.
```

### 3.3 Shape metrics (used by recipes and the Palate)
Computed once per `version` bump and cached:
- `volume` (cells), `surfaceRatio` (surface cells / volume)
- `aspect`: the principal axes of the voxel cloud (via its covariance), so "fries" = a long thin stick, "slice" = flat, "cube" = isotropic
- `height` (in fv, for the dish), `symmetryScore` (mirror overlap along the best vertical plane, Big Bite only)

---

## 4. Heat (Torch, stations, fire)

### 4.1 Heat sources
| Source | Mode | Typical power |
|---|---|---|
| Torch (primary) | A cone, 1.2 m, 25° half-angle. Raycasts against surface cells. | +6 °C per tick on hit cells, falling off with distance |
| Hot Rock / Grill | Contact with the bottom face | +3 °C per tick on contact cells |
| Oven station | Ambient, all surface cells | +1.5 °C per tick (even, slow, safe) |
| Fryer (oil pot) | Submerged cells | +4 °C per tick, plus "crust" bonus |
| Fire (a burning voxel) | Neighbors within 2 cells | +5 °C per tick, plus a spread roll |
| Frost Fan | A cone | −6 °C per tick |

### 4.2 Diffusion (deterministic, integer)
Runs at **10 Hz** (every 3rd tick of the 30 Hz simulation), only for bodies whose `ASLEEP` flag is clear.

```
for each solid cell i:
  Δ = Σ_{j ∈ N6(i), solid} (temp[j] − temp[i]) · k_ij      // k = min(cond_i, cond_j) / 64
    + (surface(i) ? (ambient − temp[i]) · loss / 64 : 0)
  temp'[i] = temp[i] + (Δ >> 3)

  if temp'[i] ≥ cookStart(mat):  doneness[i] += rate(mat, temp'[i])     (saturates at 255)
  if doneness[i] ≥ charStart:     char[i]     += charRate(temp'[i])
  if char[i] ≥ 230 and flammable: ignite(i)
```

- All quantities are integers. `rate()` comes from a 256-entry lookup table per material, so it's deterministic across browsers.
- A body goes **ASLEEP** when `max|Δ| < 1` for 2 s and there are no active sources. A sleeping cooked steak costs zero CPU.
- Budget: up to 48 awake bodies, ≤ 40,000 awake cells total, ≤ 2 ms per sim tick in the simulation worker.

### 4.3 Crust and texture
- A cell is a **crust candidate** if it is a surface cell and `doneness ≥ 0.75`. Crust cells add `crunchy` to the profile. Cutting a crusty body exposes non-crust interior faces, so slicing a toasted bread loaf gives crunchy edges and a soft middle. That's correct and readable.
- **Rest:** taking a body off heat keeps its interior cooking for a moment (carry-over heat falls naturally out of the diffusion). It's a real-cooking nugget that experts will exploit.

### 4.4 Fire
- An ignited voxel burns for 6–10 s (its material's fuel), adding heat to its neighbors and rolling to ignite flammable neighbors each 10 Hz step (`p = flammability · 0.15`).
- Fire spreads to **terrain** (pepper ridges and dry kelp go up fast) and **chefs** (status *On Fire*: running speed ×1.3, no grabbing, extinguish by dashing through liquid, a Frost Fan blast, or a teammate's hug: a tandem emote).
- Burnt-out voxels become `ash`, which is edible (bitter 1.0, grossness high), so burning a dish is a joke, not a dead end.
- Hard caps keep it safe: at most 400 burning voxels per level. Past that, the oldest fires burn out early.

---

## 5. Coats (Ladle, Shaker, melted things)

- `coat` holds a **coat id** on surface cells: `tomato_sauce`, `caramel`, `cheese_melt`, `salt`, `chili_flakes`, `syrup`…
- Each coat id adds its own flavor (weighted ×0.5 per coated cell, so coats are strong).
- **Sticky coats** (caramel, cheese_melt, thick sauces) act as glue for dish assembly.
- Visual: coated cells use the coat color on their top faces only, with a glossy material flag. This gives the cartoon "dripping sauce" look without a fluid sim.

---

## 6. Stations (the Camp)

Stations are **modules** placed by the level designer in the Camp. They are much less central than in V1: the world provides most of the cooking.

| Station | Function | Notes |
|---|---|---|
| **Feast Platter** | The Big Bite build volume (12×12×24 fv). Glue is automatic. | One per level (two in 4-player Party). |
| **Serving Mouth** | The Giant's mouth or a "chute" to it. Feeds belly and answers cravings. | Shown with a big diegetic marker. |
| **Critter Counter** | Where critters queue for quick orders. | 2–4 slots. |
| **Hot Rock** | A heated stone slab with contact heat. | Also exists as natural terrain (heated shells). |
| **Oil Pot** | Fryer. Accepts bodies up to 10³. | Liquid can splash on stomps, and splashing oil is flammable. |
| **Oven** | Even heat, door interaction, 4 slots. | Safest cooking, slowest. |
| **Plate Stack** | Gives plates (small dish bases). | Finite (6). Plates come back dirty after critter orders. A **Rinse Spring** cleans them: V1's dishwashing roadmap idea, kept light. |
| **Tool Rack** | Swap tools (from chapter 2). | 1.5 s (0.5 s in chapter 6). |
| **Compost** | Trash. Discarded food **feeds regrowth** of the nearest pantry zone (+1 regrowth tick per 8 vu). | Turns waste into strategy. |
| **Feast Bell** | Triggers the Big Bite (both chefs hold it for 1 s). | A tandem. |
| **Blender** (from chapter 3) | Turns food bodies into a liquid "coat source" (smoothie, sauce) you scoop with the Ladle. | The V1 blender reinterpreted. |

Station modules expose **sockets** (snap points for items, the evolution of V1's `GridSystem` slots) with tags (`heats`, `holdsLiquid`, `dishBase`).

---

## 7. Evaluation pipeline (the Palate)

When a dish is served:

```
1. Snapshot the dish's FoodBodies (they're frozen from that tick onward).
2. For each body, for each solid cell:
      accumulate flavor(material, doneness, char) + coat flavor, weighted by 1 cell
      accumulate texture; surface cells and core cells go to separate accumulators
3. profile = accumulators / cellCount
4. contrast = |surfaceTexture − coreTexture| (crunchy and juicy only)
5. shape metrics from the cached per-body metrics (height, colorVariety, symmetry)
6. dishScore = formula in 03-game-design.md §5.3
7. Emit DishServed { dishId, cravingId, profile, score, tier, highlights[] }
```

`highlights[]` are flags the reaction director uses ([08-characters-and-camera.md §6](./08-characters-and-camera.md)) and the clip titler uses ([13-social-and-virality.md §3](./13-social-and-virality.md)): `TOO_SPICY`, `PERFECT_SEAR`, `RAW_CENTER`, `TALL_TOWER`, `FLOOR_FOOD`, `ON_FIRE`, `MOSTLY_ASH`, `RAINBOW`, `TANDEM_HEAVY`…

The whole pipeline is a **pure function** of the dish snapshot. It runs on the host, re-runs in verification, and runs on clients only for *prediction* of the Taste Card.

---

## 8. The interaction table (successor of V1's matrix)

Resolved by the soft-targeting rules in [04-gameplay.md §4](./04-gameplay.md).

| Hand | Target | Button | Result |
|---|---|---|---|
| Empty | Loose FoodBody (≤ 6 vu) | Grab | Pick up |
| Empty | FoodBody > 6 vu | Grab | Heavy Haul (waits for a partner, Sous-Bot, or a critter helper) |
| Empty | Terrain (harvestable) | Tool Alt (Cleaver) | Carve, then the chunk goes into your hand |
| Empty | Station socket with an item | Grab | Take the item |
| Item | Empty socket / surface | Grab | Place (snaps to the socket; otherwise physics rest) |
| Item | Dish base / dish | Grab | Add to the dish (glue if sticky or base) |
| Item | Serving Mouth | Grab | Serve (feeds belly, evaluated against the craving) |
| Item | Critter | Grab | Serve the critter order |
| Item | Compost | Grab | Discard (regrowth) |
| Item | Teammate | Throw | Pass (auto-catch) |
| Any | FoodBody / terrain | Tool Primary | Tool effect (slice / heat / freeze…) |
| Any | Feast Bell | Grab (hold) | Tandem ring |
| Any | Tool Rack | Grab | Swap tool |

---

## 9. Performance and correctness budgets

| Item | Budget |
|---|---|
| Active FoodBodies per level | ≤ 160 (soft), 220 (hard; the oldest floor items despawn as crumbs) |
| Awake heat cells | ≤ 40,000 |
| Simulation worker time per 30 Hz tick | ≤ 4 ms on a 2019 mid-range laptop, ≤ 7 ms on a 2021 mid-range phone |
| Remesh of a FoodBody after a cut | ≤ 0.5 ms (greedy mesher in a worker, transferable buffers) |
| Remesh of a terrain chunk (32³) | ≤ 3 ms |
| Determinism | Bit-identical `FoodBody` hashes across Chrome, Firefox and Safari for a 10-minute recorded input log (a CI test) |

## 10. Fallback plan

If playtests show voxel cooking is too fiddly (see the kill criteria in [16-production-roadmap.md](./16-production-roadmap.md)), the fallback keeps the *look* and simplifies the *sim*: each FoodBody gets a single doneness value with a computed surface-to-core gradient for visuals, and cuts snap to preset patterns (halve, slice, dice). Data formats stay the same, so the fallback costs about one week.
