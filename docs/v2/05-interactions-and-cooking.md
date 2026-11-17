# 05 · Interactions and Cooking, revised

> **Revision note (2026-11-15).** The voxel-by-voxel food simulation (free cuts, heat diffusion, Palate) is **removed from gameplay**. It stays in `v2/packages/sim/src/food/` as an experiment and its colour-ramp shader is reused as a visual. Gameplay uses discrete, readable item states, as in V1, implemented on the deterministic V2 simulation.

## 1. Data model (pure sim, serializable)

```ts
type ItemId = number;
interface Item {
  id: ItemId;
  def: string;               // 'potato', 'chopped_potato', 'cooked_fries', 'plate', 'cup'…
  state: 'raw' | 'chopped' | 'cooking' | 'cooked' | 'burning' | 'burnt' | 'dirty' | 'clean';
  progress: number;          // Q8 fixed point, 0..256 per state step (chop, cook, burn)
  contents: string[];        // containers only: component defs, sorted
  holder: { kind: 'chef' | 'socket' | 'air' | 'floor'; id: number };
  pos: [number, number, number]; // for air/floor only (thrown or dropped)
}
interface Station {
  id: number; def: string;   // 'board', 'stove', 'fryer', 'oven', 'blender', 'sink', 'crate:potato', 'pass', 'bin', 'counter'
  socket: ItemId | -1;       // one item (or container) on top
  fire: number;              // 0 = no fire, else ticks burning
  enabled: boolean;          // optional stations depend on the player-count bucket
}
```
State lives in the ECS / plain typed structures, never in Three.js meshes (V1's main flaw, see the [audit](./01-codebase-audit.md)).

## 2. Content: item and station definitions
```jsonc
// content/items/potato.json
{ "id": "potato", "chop": "chopped_potato" }
// content/items/chopped_potato.json
{ "id": "chopped_potato", "cook": { "station": "fryer", "result": "cooked_fries", "time": 5, "burnWindow": 5 } }
// content/stations/fryer.json
{ "id": "fryer", "accepts": ["chopped_potato", "onion_rings_coated", "coated_chicken_strips"], "auto": true }
```
V1's processor configs (`processes`, `result`, `processingTime`) map one-to-one onto this, so the conversion is scripted.

## 3. Interaction table

| Hands | Target | Button | Result |
|---|---|---|---|
| Empty | Crate / dispenser | Grab | New item in hands |
| Empty | Item in a socket | Grab | Take it (a cooking item can be taken at any time; cooking pauses) |
| Item | Empty socket (counter, board, station that accepts it) | Grab | Place it. Auto stations start cooking. |
| Ingredient (finished component) | Container in a socket | Grab | Add it to the container if the result can still lead to a known recipe (otherwise refuse, with an error sound) |
| Container | Finished component in a socket | Grab | Scoop it into the container |
| Container with contents | Pass | Grab | Serve: matched against the active tickets (best match = the ticket with the least time left among exact matches) |
| Anything | Bin | Grab | Discard (containers are emptied, not destroyed) |
| Empty | Board with a raw choppable item | Action (hold) | Chop progress, 1.6 s |
| Empty | Sink with a dirty plate | Action (hold) | Wash, 2 s |
| Extinguisher | Fire | Action (hold) | Puts the fire out over 1.5 s |
| Item | Teammate (in range, facing) | Throw | Pass |

**"Could lead to a known recipe" check:** adding X to a container is allowed only if `contents ∪ {X}` is a subset of at least one recipe available in the level. It prevents useless plates, and it's V1's implicit behaviour made explicit.

## 4. Cooking and burning
- Auto stations advance `progress` every tick while an accepted item sits in the socket.
- `cooking → cooked` at 100%. Then a **burn timer** starts (`burnWindow`): the ring pulses orange, then red, with a warning sound in the last 2 s. Then `burnt`.
- From level 6, `burnt` stays on the heat for 8 more seconds, then the station **catches fire**. Fire spreads to adjacent counters every 4 s. It's put out with the extinguisher (Action, hold), or by the sink's water spray in some levels.
- **Visual:** item meshes use the voxel colour ramp (raw → cooked → charred) driven by the item's single doneness value. This is the shader built for the prototype, now reused with a uniform per item instead of per-voxel data.

## 5. Plates and dishes
- Plates and cups are finite per level (4–8). After a serve, the plate comes back **dirty** at the return hatch 8 s later (from level 4). The sink cleans them.
- Containers render their contents stacked in V1's `INGREDIENT_RENDER_ORDER` (bun bottom, patty, cheese, lettuce, bun top…), kept from V1.

## 6. Determinism and networking
- Integer progress (Q8), fixed 30 Hz tick, deterministic order. This is the same rule set as the P0 simulation, so the netcode, replays and run verification in [10](./10-multiplayer-and-netcode.md) apply unchanged. The bandwidth is even lower than in the voxel version: no VoxelOps, just item and station state deltas.

## 7. What the voxel food prototype taught us
Free cutting and heat gradients look impressive, but in an order-rush game they create micro-tasks without clear goals (the "375 million pieces" problem from the playtest). The ramp shader and the greedy mesher are kept. The simulation is archived.
