# 06 · Level Design, revised

> **Revision note (2026-11-15).** The order-rush loop is back at the centre. The goal stays the same as in the first version: **no more walled boxes**. Every kitchen is a *place* with a signature twist that changes the routing, built as a voxel diorama. We aim for **10 very polished levels** with a real curve (20 only if the quality holds).

## 1. Principles
1. **A place, not a room.** A recognizable setting (harbour, train, rooftop), visible beyond the playable area: the diorama look of [07](./07-art-direction.md).
2. **One twist per level**, serving the routing ([03 §7](./03-game-design.md)). Never purely cosmetic, never random.
3. **Readable in one second.** Stations are grouped by chain (prep → cook → plate → pass) so the "flow" of the kitchen reads at a glance.
4. **Built for 2–4, scalable to 6.** Optional stations and a second pass light up in Squad and Party ([03 §5](./03-game-design.md)). Corridors are at least 2 chefs wide on main routes.
5. **Mastery has room.** There is always at least one non-obvious faster route (a throw across a gap, a counter used as a buffer, using the twist). That's what record-chasers find.
6. **First 10 seconds teach.** The level's new mechanic is used safely before the pressure rises.

## 2. Anatomy
```
[Crates / planters] → [Prep: boards, mixers] → [Cook: stove, fryer, oven] → [Assembly counters + plates] → [PASS]
                                                                          ↖ [Sink + dirty-plate return] ↙
```
- Size: 10×8 m to 16×12 m playable, plus a decorative surrounding diorama of 40×40 m.
- Main loop walk time (crate → pass) of 6–10 s at 2 players. The twist modulates it.
- **Heights:** the playable floor is mostly flat for readability, except in the "vertical" level. Height is used generously in the *surroundings* (cliffs, masts, buildings) for visual character.

## 3. The 10 levels (campaign v1 proposal)

| # | Name (FR / EN) | Setting | Recipes | New mechanic | Signature twist |
|---|---|---|---|---|---|
| 1 | **Le Kiosque du Port** / Harbour Kiosk | A wooden kiosk on a sunny pier, boats and gulls | Fries | Grab, chop, fry, plate, serve | None: a straight, inviting line from crate to pass |
| 2 | **Le Food Truck du Festival** / Festival Food Truck | A truck at a music festival at dusk, garlands, crowd | Fries, hamburger | Grill timing, burn window | Compact truck: tight space, the pass is the truck window |
| 3 | **Le Diner de la Route 66** / Roadside Diner | A neon diner in a desert landscape | Hamburger, cheeseburger, fries | Recipe families, throwing | **Split counter**: a long counter divides the kitchen; throwing over it saves seconds |
| 4 | **Le Bar à Smoothies de la Plage** / Beach Smoothie Bar | A beach hut with surfboards and sunset | Smoothie, fruit bowl, salad | Blender (multi-input), dirty plates and cups, the sink | **Tide**: the sink area on the sand floods for 10 s every 60 s, so you can't wash during the tide |
| 5 | **La Pizzeria sur les Toits** / Rooftop Pizzeria | A rooftop above an old town at night | Pizza margherita, salad, smoothie | Long oven cooks | **Two floors**: prep downstairs, ovens upstairs, a dumbwaiter carries items between them |
| 6 | **La Friterie du Bateau-Mouche** / River Boat Fryhouse | A boat cruising a river, bridges passing overhead | Onion rings, tenders & fries, fries | Coating station, **fire** | **Low bridges**: when a bridge passes (telegraphed), the upper deck must be cleared for 4 s |
| 7 | **Le Marché de Nuit** / Night Market | Lantern-lit market stalls | Grilled cheese, BLT, hamburger, onion rings | Several short chains in parallel | **Crowd lane**: customers cross the central lane in waves; time your crossings |
| 8 | **Le Wagon-Restaurant** / Dining Car | A train crossing mountains, tunnels | Pancakes, omelette, fruit bowl, smoothie | Batter (mixer → stove) | **Two wagons + tunnels**: the passage between wagons is a narrow gangway, and tunnels dim the light (stations glow) |
| 9 | **Le Bistrot de la Serre** / Greenhouse Bistro | A glass greenhouse full of plants | Salad, pizza, tenders & fries, smoothie | **Harvest planters** instead of crates (regrow timers) | Planters are scattered; sprinklers turn on periodically (a no-go zone) |
| 10 | **Le Banquet du Géant** / The Giant's Banquet | A kitchen built on a Giant's banquet table, the Giant as customer | Cheeseburger combo, pizza, pancakes, tenders & fries | **Feast tickets** (3 dishes served together) | **Conveyor**: a lazy-Susan belt around the table carries items (a free courier, or lost at its end) |

- Recipes reuse V1's 13. Levels 1–5 mirror V1's well-liked first five in their recipe progression, and 6–10 are redesigned around stronger twists, addressing the feedback that V1's levels 6–10 felt like filler.
- **Giants** appear only as the level 10 customer (and as background cameos elsewhere). If playtests show the finale is more fun without it, the setting changes and the mechanic stays.

## 4. Level data
```
content/levels/l03_diner/
  level.json      // recipes, duration, pacing, star thresholds per bucket, twist params, spawn points
  layout.json     // stations (def, position, rotation, optional bucket), counters, walls, colliders
  scene.vxl       // decorative voxel diorama (chunked), made in MagicaVoxel and imported
  lighting.json   // preset and overrides
```
- `layout.json` is the gameplay truth (grid-snapped, 0.5 m), so it stays easy to tune by hand and suits a future editor.
- `scene.vxl` is pure decoration and collision-free except for marked walls. That's how we get character without hurting readability.

## 5. Tuning process per level
1. Block out the layout in the `?dev=1` proto-editor (place stations, write layout.json).
2. Play with bots: scripted "optimal-ish" route bots measure the max achievable score per bucket and give a first guess at star thresholds (3★ ≈ 75% of the bot max, 2★ ≈ 55%, 1★ ≈ 30%).
3. Playtest with 1, 2, 4 and 6 humans, then adjust pacing and thresholds per bucket.
4. Dress the diorama (scene.vxl, lighting, ambient life: gulls, crowd, trains).
5. Check: readable in one second, no blocked corridors at 6 players, the twist telegraphed ≥ 2 s ahead, performance budget OK.

## 6. Level checklist
- [ ] Recognizable without the UI (screenshot test).
- [ ] One new mechanic at most, introduced safely.
- [ ] The twist changes the best route (verified with bot and human runs).
- [ ] Works at 1, 2, 4 and 6 players (optional stations placed).
- [ ] At least one expert shortcut.
- [ ] Star thresholds set per bucket from data.
- [ ] Performance: within [09 §10](./09-technical-architecture.md) budgets on the reference phone.

## 7. Future editor
Same as before: everything is data, the `?dev=1` proto-editor writes `layout.json`, and V1's `custom_levels` backend can store V2 levels with a format version. A community editor comes after the 10 campaign levels are done.
