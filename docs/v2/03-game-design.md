# 03 · Game Design (Systems)

This document defines the **rules** of Giant Appetite: entities, resources, the scoring model and how systems interact. Moment-to-moment feel and controls are in [04-gameplay.md](./04-gameplay.md). The voxel food simulation is in [05-interactions-and-cooking.md](./05-interactions-and-cooking.md).

All numbers are **starting tuning values**, held in `content/tuning/*.json` and meant to change through playtests.

---

## 1. System map

```
              ┌──────────────┐  cravings, mood  ┌─────────────┐
              │    GIANT     │ ───────────────▶ │    CREW     │
              │ belly, mood, │ ◀─────────────── │ 2 chefs, 2  │
              │ hazards      │  dishes, feeds   │ tools       │
              └──────┬───────┘                  └──────┬──────┘
           reshapes  │                                 │ harvest / carve / heat
                     ▼                                 ▼
              ┌──────────────┐  ingredients     ┌─────────────┐
              │ EDIBLE WORLD │ ───────────────▶ │ VOXEL FOOD  │
              │ terrain,     │ ◀─────────────── │ cut, heat,  │
              │ regrowth     │  heat, fire,     │ combine     │
              └──────────────┘  spills          └──────┬──────┘
                                                       │ evaluated by
                                                       ▼
                                                ┌─────────────┐
                                                │   PALATE    │──▶ score, stars, clip
                                                └─────────────┘
```

---

## 2. The crew

### 2.1 Chefs
- **1–4 chefs** per service. The game is **designed and tuned for 2**. Three or four players get "Party" tuning (§8).
- Each chef has: position, velocity, a **hand slot** (0 or 1 held item), a **tool** (one per chapter loadout), **stamina** for dash and heavy carry, and a **status** (normal, stunned, slipping, on fire, frozen, sticky).
- A chef can't die. Hazards cause short, funny loss of control (a 0.6–2.0 s stun, being knocked back, or dropping the held item).

### 2.2 Tools: the asymmetry engine
Every chef carries one **Tool** with a **primary** and an **alt** action. Tools act on *both* food and terrain. That double use is the key to the whole design: the same verb that cooks also builds paths.

Each chapter introduces a **Tool Pair**. In a duo, each player picks one at the start of a service, and they can swap at a **Tool Rack** (a 1.5 s interaction) from chapter 2 onward.

| Ch. | Tool A | Primary / Alt | Tool B | Primary / Alt | Co-op design intent |
|---|---|---|---|---|---|
| 1 | **Cleaver** | Slice (plane cut) / Chop-harvest (carve a chunk off terrain) | **Torch** | Flame jet (adds heat in a cone) / Ignite (lights fuel, ovens and fuses) | Basic division of labor: prep vs cook |
| 2 | **Frost Fan** | Freeze (removes heat, solidifies liquids into walkable ice) / Gust (pushes items and chefs) | **Whisk** | Whip (aerates: creams, batters, foams) / Drill (bores tunnels into soft terrain) | Temperature as a two-way puzzle; the other chef's path depends on you |
| 3 | **Ladle Cannon** | Sauce shot (paints voxels with sauce = flavor + glue) / Slurp (vacuums up liquids) | **Magnet Fork** | Tether (pull an item or chef from range) / Fling (launch a tethered item) | Ranged co-op: you build bridges of sauce, I fling ingredients across |
| 4 | **Rolling Pin** | Flatten (turns dough or terrain into sheets, makes ramps) / Roll (a charging tackle) | **Shaker** | Season cloud (an area flavor buff) / Spice burst (a small explosion that clears debris) | Terrain shaping plus flavor management |
| 5 | **Grow Spritzer** | Grow (makes plant voxels grow: bridges, ingredient regrowth) / Ripen (raises sweetness) | **Preserve Jar** | Seal (pauses the simulation on one item for 20 s) / Pickle (adds sour, stops spoilage) | Time management: one chef buys time, the other creates resources |
| 6 | **All tools** | Rack swaps are free (0.5 s) | | | Mastery: build your own pair per craving |

**Solo play:** a single chef carries *both* tools of the pair and swaps with a button (a 0.4 s animation). Tandem actions (§2.3) become available through **Sous-Bot**, a small helper that holds items still or carries the other end of heavy ingredients when pinged. Sous-Bot does nothing on its own initiative.

### 2.3 Tandem actions (rewarding coordination)
Tandem actions happen when **both tools act on the same target within 0.75 s of each other**, or when a task physically needs two chefs.

| Tandem | Trigger | Effect |
|---|---|---|
| **Flash Sear** | Torch heating while the Cleaver slices | The cut faces are seared instantly to "perfect" doneness (+15% quality on that item) |
| **Heavy Haul** | Grabbing a chunk over 6 voxel-units of volume | Needs 2 chefs, one at each end. Both move at 70% speed and must steer together. A solo player uses Sous-Bot. |
| **Ice Bridge** | Frost Fan on a liquid while the Whisk aerates it | Makes a meringue bridge that holds for 30 s instead of a 10 s ice bridge |
| **Sauce Slingshot** | Magnet Fork fling through a sauce-shot arc | The item gets glazed in flight (+sauce flavor, +shine) |
| **Rolling Pizza** | Rolling Pin flatten followed by a Spice burst on the same dough within 2 s | A crispy-edged base |

Tandems are **taught by Giants' cravings** ("I want something *flash-seared*!") rather than by tutorials.

---

## 3. The Giant: customer, clock and weather

Each service has **one Giant** (chapter 5's boss has two heads). A Giant is a huge, animated character that stands, sits or lies on the level. Parts of its body are often **part of the level** (you might cook on a tortoise's shell).

### 3.1 Belly (the clock)
- `belly` ranges from 0 to 100 and starts at 70.
- It drains at `drainRate` per second: base 0.35/s in chapter 1, rising to 0.6/s in chapter 6, so an untouched belly empties in about 2–3 minutes.
- **Feeding** anything edible at the Giant's **Mouth** or **Feast Platter** refills it by `volume × qualityFactor × craveBonus` (§5).
- **Belly bands:**
  - **Content** (60–100): calm. Normal critter order rate.
  - **Peckish** (30–60): the Giant grumbles. Small rumble events (screen shake, loose items roll).
  - **Hungry** (10–30): restless. Medium hazards (stomps, tail sweeps) every 20–30 s.
  - **HANGRY** (0–10): tantrum. A big hazard every 6–8 s and the Giant **steals** items from counters. Each entry into this band costs one **Patience Token**.
- The Giant has **3 Patience Tokens**. Losing all three makes the Giant **storm off** and the service ends early with partial results (soft fail, retry offered right away).

### 3.2 Mood
`mood` runs from -100 to +100 and is driven by recent dish quality (an exponential moving average, half-life 45 s). Mood changes:
- **Craving generosity:** at high mood, cravings get wider tolerance bands.
- **Critter generosity:** tips are multiplied by `1 + mood/200`.
- **Animation and vocal state:** the Giant hums, sways and gives thumbs up, or crosses its arms and taps a foot.
- **The Big Bite multiplier** (§6).

### 3.3 Cravings (the main orders)
A **Craving** is a target profile with a time window. The Giant has **one active craving** (two at high difficulty or with two-headed Giants), shown diegetically in a thought bubble and in a compact HUD card.

```jsonc
// content/cravings/ch1_crunchy_hot.json
{
  "id": "ch1_crunchy_hot",
  "prompt": "craving.crunchy_hot",           // i18n key: "Something CRUNCHY and HOT!"
  "window": 75,                              // seconds before it expires
  "requirements": [
    { "axis": "texture.crunchy", "min": 0.5, "weight": 1.0 },
    { "axis": "temp",            "min": 0.6, "weight": 0.8 }   // served hot
  ],
  "bonuses": [
    { "axis": "shape.height", "min": 0.8, "reward": 0.15, "hint": "tall" }
  ],
  "minVolume": 8                              // in voxel-units (§5.1)
}
```

- Cravings come from a **chapter pool**, picked by a seeded director that avoids repeats and keeps the requirement axes fresh.
- An **expired** craving lowers mood by 15. It doesn't cost belly directly: belly pressure is constant anyway.
- **Signature Cravings** are fixed named dishes ("Mossback's Mushroom Stack") that teach a specific technique. They have tighter requirements.

### 3.4 Hazards and weather
Giants generate **hazards** scaled by belly band and chapter. Every hazard has a **0.8–1.5 s telegraph** (shadow, sound or animation) that is readable from any camera angle.

| Hazard | Telegraph | Effect |
|---|---|---|
| Stomp | Foot shadow grows, a low rumble | Shockwave stuns chefs in a radius, items bounce |
| Tail sweep | Tail rises, a whoosh | Pushes everything in a lane off ledges |
| Sneeze | Nose wiggle, inhale sound | A gust: liquids splash, fire spreads in the gust direction |
| Grab | Hand shadow | Steals one item from a counter (HANGRY only) |
| Belly rumble | Low groan | Earthquake: unsupported voxels collapse (terrain physics, §4.3) |
| Roll-over | Long telegraph (3 s) | Whole-level tilt for 8 s: items slide (a chapter 1 boss move) |

---

## 4. The edible world

### 4.1 Terrain materials
Every terrain voxel has a **material**. Each material defines what it tastes like, how tools affect it, and whether it is harvestable.

| Material | Harvest → Item | Cleaver | Torch | Notes |
|---|---|---|---|---|
| Mushroom cap | `mushroom` chunk | ✓ | cooks in place (smells good, attracts critters) | Regrows: 1 voxel every 4 s near a stem |
| Bread rock | `bread` chunk | ✓ | toasts → crunchy | Load-bearing. Carving under it can collapse it. |
| Cheese cliff | `cheese` chunk | ✓ | **melts**: flows down, re-solidifies after 6 s as a *ramp* | The traversal tool of chapter 1 |
| Pepper ridge | `pepper` chunk | ✓ | **burns hot**: spreads fire fast | Spicy +0.9 |
| Sorbet ice | `sorbet` chunk | ✓ | melts into syrup liquid | Chapter 2 |
| Caramel | `caramel` chunk | hard (3× time) | softens → sticky floor (slows chefs) | |
| Kelp | `kelp` strands (noodles) | ✓ | dries → crunchy | Chapter 4 |
| Stone, Shell | not edible | ✗ | heats → becomes a **hot rock** cooking surface | Cooking surfaces in the wild |
| Giant (body) | not harvestable | ✗ | the Giant reacts (giggles if ticklish, shakes you off) | Easter eggs, no damage |

### 4.2 Regrowth and scarcity
- Each pantry zone has a **budget**: harvesting beyond it exposes inedible substrate. Regrowth rates are set per zone.
- This creates real **routing decisions**: the near cheese is nearly gone, so take the long path to the big wheel, or melt a ramp to the upper wheel?

### 4.3 Structural integrity (lightweight)
- Terrain uses a cheap **support check**, not real structural physics. After an edit, connected components of solid voxels that are not attached to an *anchor* voxel (bedrock, the Giant's body, flagged level geometry) **detach** and become a falling rigid body (merged into a dynamic voxel object).
- Detached chunks over 200 voxels shatter into ingredient-sized pieces on impact. That keeps it fun, not tedious.
- Design rule: **Level designers mark anchor regions**, so critical paths can't be destroyed into a soft-lock. A soft-lock guard regrows a bridge after 20 s if the pathfinder detects that the serving point is unreachable.

---

## 5. Food and the Palate (evaluation)

### 5.1 Units
- **Food voxel (fv):** 1/16 of a metre at chef scale. A chef is about 1.6 fv-metres, so a food voxel is about 6 cm "in-world".
- **Voxel-unit (vu):** 64 fv (a 4×4×4 block). Volumes in design data are expressed in vu so designers don't count voxels.

### 5.2 Flavor model
Each food material has a base **flavor vector**:

```
sweet, salty, sour, bitter, umami, spicy   ∈ [0,1]
texture: crunchy, creamy, chewy, juicy      ∈ [0,1]
```

Cooking modifies these per voxel based on **doneness** `d ∈ [0,1]` and **char** `c ∈ [0,1]`:

```
umami   += 0.3 · bell(d, 0.65, 0.2)        // Maillard peak around 65% doneness
sweet   += 0.2 · bell(d, 0.7, 0.2) · sugarContent
crunchy += 0.6 · smoothstep(0.75, 0.95, d) · crustable   // outer voxels only
bitter  += 0.9 · c
juicy   −= 0.8 · smoothstep(0.85, 1.0, d)
```

A **dish's profile** is the volume-weighted average over all its voxels, plus *texture contrast* (variance between surface and core voxels). Contrast is rewarded: "crispy outside, juicy inside".

### 5.3 Dish score
For a craving `C` and dish `D`:

```
requirementScore = Σ_i w_i · fit(D.axis_i, C.min_i, C.max_i) / Σ_i w_i
                   fit = 1 inside the band, linear falloff to 0 over a ±0.25 margin
quality          = 0.5 · donenessQuality + 0.3 · contrast + 0.2 · temperatureAtServe
presentation     = 0.4 · heightFit + 0.3 · colorVariety + 0.3 · symmetry    (Big Bite only)
grossness        = clamp(char·1.2 + rawMeat·2 + floorDirt·0.5, 0, 1)

dishScore = 100 · requirementScore · (0.6 + 0.4 · quality) · (1 − 0.7·grossness)
          + bonuses
```

- `donenessQuality` is the share of voxels in the material's "perfect" band.
- `floorDirt` counts voxels that touched the floor for more than 3 s. That's a genre-friendly "5-second rule" joke, made visible as dust specks.
- **Thresholds:** `≥ 85` Perfect, `≥ 65` Great, `≥ 40` Okay, `< 40` Yuck. Yuck still feeds the belly (half value), so players are never stuck.

### 5.4 Legibility
The design promise (pillar P3) is that **players never need to read numbers**:
- **The Taste Card**: while a chef holds or looks at a dish, a compact card shows the craving's axes as icons with fill bars, plus a single **predicted reaction emoji** (😋 / 🙂 / 😐 / 🤢).
- **Food color tells doneness** (see [07-art-direction.md §5](./07-art-direction.md)).
- Steam particles show temperature. Sparkles show a perfect band.

---

## 6. Critter orders (the tempo layer)

Small critters live on and around the Giant (mice in Mossback's moss, penguins on Queen Glacé). They place **fixed-recipe quick orders**, built from V1's recipe graph. This keeps the familiar order-juggling rhythm going between cravings.

- Order pacing uses V1's `calculateNextOrderDelay()` (difficulty factor, complexity factor, rush-hour burst, load easing, ±20% jitter), ported as is.
- Critter orders are **small** (2–4 vu) and evaluated against the recipe's *components* with tolerance: "fries" means potato material, cut into sticks (an aspect-ratio check), doneness 0.6–0.85 and crunchy ≥ 0.4.
- Serving a critter gives **Tips** (score and soft currency) and fills the **Critter Friendship** meter. At thresholds a critter **helps the crew** for 30 s: carries an item, stomps out a fire, or holds a Heavy Haul end.
- Critter orders do **not** feed the Giant. This creates the core tension: tips and helpers vs the belly.

---

## 7. A service, end to end

| Phase | Time | What happens |
|---|---|---|
| **Arrival** | 0:00–0:20 | Fly-in cinematic (skippable after the first time). The Giant settles. The first craving is shown. Chefs spawn at Camp. |
| **Service** | 0:20 → T−1:30 | Cravings rotate (window 60–90 s). Critter orders tick. Belly drains. Hazards scale with belly band. 1–2 scripted **Set Pieces** per level (the river of syrup rises, the Giant stands up and the camp tilts). |
| **Big Bite call** | T−1:30 | The Giant announces its **Grand Craving**, always a two-part brief ("TALL and SWEET with something CRUNCHY on top"). The **Feast Platter** (a large build volume, 12×12×24 fv) lights up. Hazards drop one band. |
| **The Big Bite** | T−0:00 or when served | The crew rings the Feast Bell (both must hold it for 1 s; it's a tandem). Cinematic Tasting (8–14 s, [08-characters-and-camera.md §6](./08-characters-and-camera.md)). Clip auto-captured. |
| **Results** | after | The Feast Score is broken down. Stars. Cookbook entries. Share card. |

Total length: **T = 5:00–7:00** depending on level.

### 7.1 Feast Score
```
FeastScore = Σ cravingScores
           + Σ critterTips
           + 3 × BigBiteDishScore × (1 + mood/100)
           + bellyUptimeBonus (seconds in Content band × 0.5)
           − patienceLost × 150
```

Stars use per-level thresholds (1★ = pass, 2★, 3★). A hidden 4th tier is the **Golden Spoon**: it needs a 3★ score *and* a Perfect Big Bite.

---

## 8. Player-count scaling

| Players | Tools | Belly drain | Critter rate | Hazard rate | Notes |
|---|---|---|---|---|---|
| 1 | Both (swap) + Sous-Bot | ×0.7 | ×0.6 | ×0.7 | Tandems via Sous-Bot |
| 2 | One each | ×1.0 | ×1.0 | ×1.0 | **Reference tuning** |
| 3 | 2 tools + 1 **Runner** (no tool, +25% speed, carries 2 small items) | ×1.3 | ×1.4 | ×1.1 | Party mode |
| 4 | 2 + 2 duplicates | ×1.6 | ×1.7 | ×1.2 | Party mode, a second Feast Platter opens |

## 9. Difficulty and assists

- **Difficulty** is set per crew at service start: *Snack* (easy), *Meal* (normal), *Feast* (hard). It scales drain, craving windows and hazard rate (for example ×0.75 / ×1.0 / ×1.25), extending V1's beginner/expert multipliers.
- **Assists** are independent toggles that don't block stars (accessibility first): slower simulation (×0.8 game speed), wider aim assist, no slip status, high-contrast doneness palette, "Giant never storms off".
- Leaderboards record difficulty and assist flags and show them as icons. They are never hidden.

## 10. Versus: Food Fight (secondary mode)

- 2 crews (1v1 or 2v2), mirrored camps on either side of **one Giant**, with a shared central pantry.
- Both crews answer the *same* craving. The Giant eats the best dish served within the window, and the faster crew gets +10%.
- A **Favor** tug-of-war bar replaces the belly. The first crew to full Favor, or the leader at 6:00, wins.
- Light interference only: steal from the shared pantry, Frost Fan gusts across the gap. You can't touch the other camp's stations. That keeps it playful, not griefy.

## 11. Data-driven everything

All of the above lives in content files validated by a JSON schema at build time:

```
content/
  tools/*.json        cravings/*.json     critters/*.json
  materials/*.json    giants/*.json       levels/<id>/level.json (+ chunks)
  recipes/*.json      hazards/*.json      tuning/{global,difficulty,party}.json
```

`scripts/validate-content.mjs` (from V1) grows into a full schema validator and must pass in CI.
