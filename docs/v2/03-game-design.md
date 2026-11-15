# 03 · Game Design (Systems), revised

> **Revision note (2026-11-15).** This replaces the "Giant Appetite" systems (belly, cravings, tools, voxel Palate). V2 is built on V1's order-rush loop, extended for 6 players, records and better levels. All numbers are starting values in `content/tuning/*.json`.

---

## 1. Core loop

```
ORDER TICKET appears ──▶ PREP (chop, mix) ──▶ COOK (fry, grill, bake, blend) ──▶ ASSEMBLE on plate/cup/bowl
        ▲                                                                              │
        │                                                                              ▼
  next ticket ◀── SCORE (base + speed bonus + streak tip) ◀──────────────── SERVE at the pass
```

A level is a fixed duration (180–300 s). The goal is to serve as many correct orders as possible. There's no "game over": the run always lasts the full timer (as in V1), and stars and records come from the final score.

## 2. Recipes

### 2.1 Recipe model (from V1, made data-driven)
A recipe is a **set of finished components on a container**. Components come from **prep chains**: `source → (chop) → (cook) → component`.

```jsonc
// content/recipes/cheeseburger.json
{
  "id": "cheeseburger",
  "container": "plate",
  "components": ["bun", "cooked_patty", "cheese_slice"],
  "baseScore": 120,
  "ticketTime": 95,          // seconds before the ticket expires (before level multipliers)
  "family": "burger"         // used for "same family" teaching and UI grouping
}
```

- Matching is **exact on the set of components** (order doesn't matter, as in V1), with **no hidden quality score**. Fast and predictable is what makes runs optimizable.
- The 13 V1 recipes and their chains are kept and migrated: fries, salad, hamburger, cheeseburger combo, onion rings, chicken tenders & fries, BLT, grilled cheese, pancakes, cheese omelette, fruit & yogurt bowl, smoothie, pizza margherita.
- **Recipe families** are a design tool. Each new recipe in the campaign should reuse at least 50% of a known recipe's steps (hamburger → cheeseburger → bacon cheeseburger). That's how complexity grows without a learning wall.

### 2.2 Item states (discrete, readable)
`raw → chopped → cooking → cooked → burning → burnt`.

| Station | Input → output | Time (s) | Notes |
|---|---|---|---|
| Cutting board | raw → chopped | 1.6 (hold Action) | Several chefs can't share one board; that's a routing choice |
| Grill / stove | → cooked | 5–8 | Auto-cooks once placed. A **burn window** of 6 s, then burnt. |
| Fryer | → cooked | 4–6 | Burn window 5 s |
| Oven | → cooked | 10–14 | Long cook, a door you open and close. Burn window 8 s. |
| Mixer / blender | multi-input → mixed | 3–5 | Accepts several ingredients |
| Sink (from level 4) | dirty plate → clean plate | 2 (hold Action) | Plates come back dirty 8 s after a serve |

- **Cooking is shown by a ring above the station** (filling green, then pulsing orange, then red) and by the item colour itself (the voxel ramp from raw to cooked to charred, kept from the prototype as a visual).
- **Burnt items** must go in the bin. From level 6, a pan left burning for 8 more seconds **catches fire**. Fire spreads to adjacent counters every 4 s and is put out with the extinguisher. That's V1's roadmap "chaos" idea, introduced late.

## 3. Orders

### 3.1 Ticket flow
- A level defines `availableRecipes`, `maxActiveOrders` and pacing parameters.
- **Pacing:** V1's `calculateNextOrderDelay()` is kept as is: difficulty factor, recipe complexity factor, "rush hour" burst chance, load easing and ±20% jitter.
- Each ticket shows the recipe picture, its components as small icons, and a **timer bar** (green above 50%, yellow above 25%, red below).
- **An expired ticket** is a failure: −50% of its base score, and the streak resets.

### 3.2 Serving and scoring
```
orderScore = baseScore
           + speedBonus        (min(30, secondsLeft / 2)), the V1 formula with the cap raised from 20
           × streakMultiplier  (×1.0, ×1.25, ×1.5, ×2.0 after 0/3/6/10 consecutive on-time orders)
wrongDish  = −20 points, the plate is rejected (it stays in your hands), streak reset
```
- **The streak multiplier** is the main skill expression for experts: keep serving on time without misses.
- **Serving order is free.** Players choose which ticket to fulfil, which matters for optimization.

### 3.3 Stars and records
- Three star thresholds **per level and per player-count bucket** (§5). A hidden 4th tier, **"Chef Étoilé"**, sits at roughly the 95th percentile of beta scores.
- Personal best, friends best and world record are stored per level × bucket (see [13](./13-social-and-virality.md) and [10 §9](./10-multiplayer-and-netcode.md) for verification).

## 4. Chefs and controls (all chefs are equal)

- Every chef can do everything. **No classes, no tools.** Accessibility first.
- **Hands:** one item (or one container with its contents), as in V1.
- **Verbs (3 buttons + move):** **Grab/Drop/Serve** (context), **Action** (hold: chop, wash, extinguish), **Throw** (from level 3; teach it when it starts to matter), plus **Dash**.
- **Contextual help:** a small prompt above the target ("Ⓐ Prendre", "Ⓧ Couper"). No tutorial screens.

## 5. Player-count scaling (1–6)

Levels are built for 2–4 players and **scale** at runtime:

| Bucket | Players | Order rate | maxActiveOrders | Ticket time | Station copies active |
|---|---|---|---|---|---|
| Solo | 1 | ×0.55 | −1 | ×1.25 | base set |
| Duo | 2 | ×1.0 | base | ×1.0 | base set |
| Squad | 3–4 | ×1.6 | +1 | ×0.95 | + optional stations unlock |
| Party | 5–6 | ×2.2 | +2 | ×0.9 | all stations, second serving pass opens |

- **Optional stations:** each level places extra boards, fryers or a second pass that appear only in Squad and Party, so 6 players aren't crammed around one board.
- **Leaderboards are separate per bucket.** A solo record and a 6-player record are different achievements.

## 6. Difficulty curve (campaign of 10)

| Level band | New concept | Recipes | Pressure |
|---|---|---|---|
| 1–2 | Grab, chop, fry, plate, serve | 1–2 short chains | 2 active tickets, generous timers |
| 3–4 | Cook timing, burn window, combos, plates come back dirty | Families (burger → cheeseburger) | 3 tickets |
| 5–6 | Long cooks (oven), multi-input (blender), throwing, fire | 3 recipes in parallel | 3–4 tickets, rush bursts |
| 7–8 | The level twist matters to the route (split kitchens, moving parts) | 3–4 recipes | 4 tickets |
| 9–10 | Everything combined, the finale set piece | 4+ recipes, long chains | 4–5 tickets, tight timers |

**Rule:** each level introduces **at most one** new mechanic, and lets players use it safely in its first 30 seconds.

## 7. Level twists (gameplay-serving personality)

Each level has **one signature twist** that changes the routing. It's never cosmetic only and never random:

| Twist | Effect on routing |
|---|---|
| **Split kitchen** | Two zones linked by a hatch or a passage; throwing or passing across matters |
| **Timed passage** | A door, drawbridge or tunnel that opens and closes on a visible rhythm |
| **Moving station** | A station on a rail or turntable that changes which side is close |
| **Harvest planters** | Ingredients grow in planters (no crates) and regrow on a timer |
| **Vertical kitchen** | Two floors linked by stairs and a dumbwaiter |
| **Crowd lane** | Customers cross a lane periodically; the shortest path isn't always open |
| **Conveyor** | A belt carries items; use it as a free courier or lose items at its end |

## 8. Difficulty settings and assists
- **Difficulty** (Snack / Meal / Feast) scales ticket time and order rate (×1.3 / ×1.0 / ×0.8), extending V1's beginner/expert settings. **Records are kept for Meal and Feast only**, so they stay comparable.
- **Assists** (never block stars, flagged on scores): slower game speed, no burning, longer tickets, colour-blind palettes.

## 9. Versus (later, V2.1)
**Kitchen Duel:** 2 teams, mirrored kitchens, the same order stream. The best score after 4 minutes wins. Light interference only, such as sending a "rush ticket" to the other team on a 5-streak.

## 10. Optional theme layer: customers and the finale
- Customers are visible at the pass (small voxel characters reacting to speed). That's personality, not a system.
- **The finale (level 10)** can be "Le Banquet du Géant": a Giant is the customer, orders come as large multi-dish **"feast tickets"** (3 dishes served together for a big bonus), and its reactions are the spectacle. The Giant concept survives exactly where it serves the gameplay. If playtests show it doesn't add fun, it becomes a normal finale.
