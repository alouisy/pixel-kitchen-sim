# 02 · V2 Vision: "Giant Appetite"

> Working title: **Giant Appetite** (the brand can stay *Pixel Kitchen: Giant Appetite*). Alternatives are at the end of this doc.

## 1. The pitch

**One line:** *Two tiny chefs carve, torch and toss an edible voxel world to feed colossal, moody Giants, and every feast ends with a reaction worth clipping.*

**One paragraph:** The world is a patchwork of edible landscapes: mushroom meadows, sorbet glaciers, pepper dunes, kelp-noodle reefs. Wandering across it are the Giants, enormous creatures who get *grumpy* when hungry, and a grumpy Giant reshapes the land. You and a friend are a crew of thumb-sized chefs. Each of you carries one signature tool (a Cleaver that cuts *anything*, a Torch that heats *anything*). You harvest the terrain itself, cook food that is simulated voxel by voxel (a steak really is burnt outside and raw inside), and build dishes on a giant platter. The Giant's belly is the clock. Its cravings are your orders. Its reaction to your final dish is the payoff: a cinematic tasting moment that the game captures, names and turns into a share-ready clip.

## 2. Why change the concept at all

Adding multiplayer to V1 would produce *a browser version of a known genre*. That is a crowded shelf, it's hard to stand out on it, and it invites direct comparison with games that have ten times the budget. The project's real assets are different:

- **Voxels are a simulation medium, not just a look.** Minecraft, Teardown and Noita show that players love worlds where *every pixel/voxel is real*. No cooking game does this with food.
- **The browser is a superpower for co-op.** "Click this link and you're in my kitchen" beats any console invite flow. Instant, free, no install: that's the distribution edge.
- **A small team can't win on content volume, but it can win on systems.** Systemic food plus systemic terrain gives emergent stories (the "we accidentally set the cheese cliff on fire and it melted onto the Giant's head" story) with a modest asset budget.

So V2 bets on **systemic, destructible, edible worlds plus duo asymmetry plus built-in spectacle.**

## 3. Design pillars

Each pillar comes with a test. Every feature has to pass at least one test and break none.

| # | Pillar | Means | Test question |
|---|---|---|---|
| P1 | **The world is the pantry** | Ingredients come out of the level itself. Terrain is food, and food is terrain. | "Could this ingredient be a place instead of a crate?" |
| P2 | **Two hands, one dish** | Every good dish needs both chefs. Asymmetric tools and tandem actions make coordination the main skill. | "Is this more fun with a partner than alone?" |
| P3 | **Food you can read at a glance** | Doneness, flavor and shape are visible on the food itself. No hidden numbers. | "Can a spectator tell what went wrong from a screenshot?" |
| P4 | **Every feast is a show** | Each service ends with a designed, camera-directed payoff. The game frames your best (or worst) moment for you. | "Would someone post this 10-second clip?" |
| P5 | **Link to play** | From URL to cooking together in under 20 seconds, on any device with a browser. | "Did this add a step between the link and the kitchen?" |
| P6 | **Chaos from systems, not from confusion** | Mayhem has to be *caused* (fire spreads, the Giant stomps) and *readable*, never random or unclear. | "When it went wrong, did players laugh or feel cheated?" |

## 4. The core fantasy, in four beats

1. **Scout:** "The Giant wants something *crunchy and spicy*. There's a pepper ridge over there, and the bread-rock cliff is crunchy if we toast it…"
2. **Harvest and prep:** The Cleaver chef carves a chunk of pepper ridge. The Torch chef melts a cheese stalactite into a bridge so you can carry it back.
3. **Cook and build:** The steak goes on the hot rock. You both watch the gradient creep from pink to brown. "PULL IT, PULL IT!" You stack a tower on the Feast Platter.
4. **The Big Bite:** The camera swoops. The Giant lifts your dish, sniffs, chews… and breathes fire because it was spicier than planned. Four stars, and a clip titled *"Volcanic Regret Tower"*.

## 5. What is new compared with the genre

| Genre convention | Giant Appetite |
|---|---|
| Ingredient crates | **Harvest the terrain**: cheese cliffs, bread boulders, mushroom forests |
| Discrete states (raw/chopped/cooked) | **Per-voxel simulation**: cut along any plane, heat spreads, char is visible |
| Exact recipe tickets | **Cravings**: target taste and shape profiles with many valid answers, plus quick fixed-recipe critter orders for tempo |
| A countdown timer | **A Giant's belly**: hunger drains, mood shifts, and a hangry Giant reshapes the level |
| Symmetric chefs | **Asymmetric tools** per chef, changing each chapter (inspired by the per-chapter ability pairs in *It Takes Two*) |
| Flat kitchen floor plans | **Vertical, destructible dioramas** where players re-route paths with their tools |
| End-of-level scoreboard | **The Big Bite**: a directed tasting cinematic, auto-clipped and auto-titled |

### Neighbors and how we differ (honest positioning)

| Game | What we share | What we don't |
|---|---|---|
| *Overcooked* | Co-op kitchen time pressure | No crate-and-ticket loop, no symmetric chefs, no flat kitchens; food is simulated, not stateful |
| *It Takes Two* | Per-chapter asymmetric abilities, duo-first design | Not a narrative platformer; replayable score-attack services |
| *Unrailed!* | Co-op on a voxel world you harvest | We cook and present rather than build a track; destruction is edible |
| *Battle Chef Brigade* | Gathering from the world, judged by flavor | Real-time 3D co-op, systemic voxels, no match-3 |
| *Teardown* / *Noita* | Every voxel is simulated | Cozy, comedic, cooperative tone |
| *PlateUp!* | Kitchen systems depth | We are action and spectacle first, not management and layout |

## 6. Audience and platforms

- **Primary audience:** pairs: friends, couples, siblings, streamers with a co-host. Ages 10+. They already play duo co-op games and like to share clips.
- **Secondary:** solo players for the Daily Feast and score-chasing; families on one screen with two controllers.
- **Platforms, in order:**
  1. **Web on desktop** (Chrome, Edge, Firefox, Safari 17+), keyboard and mouse or gamepad. This is the lead platform.
  2. **Web on mobile and tablet** (touch twin-stick, reduced simulation budgets). Full feature parity except voice push-to-talk ergonomics.
  3. **Couch co-op** in one browser tab with two gamepads (shared camera). Great for streaming.
  4. **Discord Activity** (an embedded web app in voice channels): voice is already there and friends are already together. It's a distribution channel that fits perfectly. *Note:* Activities need Discord's own sign-in inside Discord, which is separate from our nickname-only rule. It is optional, later, and needs an explicit decision.
  5. **Steam (desktop wrapper, Tauri)**: only if web traction proves out.

## 7. Session shape

- **A Service** (one level run) lasts **5–7 minutes**: short enough for "one more", long enough for a story.
- **A sitting** is 3–5 services, about 30 minutes.
- **The campaign** is 6 chapters × 5 services, plus a boss service per chapter: about 6–8 hours to see everything and 20+ hours to master everything.
- **The Daily Feast** is one seeded service a day, the same for everyone, with a share card.

## 8. Tone

**Cozy-chaotic.** Warm, tactile, funny, never mean. Giants are moody but lovable: think a sleepy grandparent who becomes a toddler when hungry. No violence, no fail-shame: a disaster is a *funny* outcome, and the game celebrates it ("Most Charred Dish of the Week").

## 9. Success criteria for V2

| Metric | Target at public beta |
|---|---|
| Time from link click to in-kitchen (warm cache) | < 20 s at p75 |
| Share rate (sessions that export at least one clip or card) | ≥ 8% |
| Invite conversion (invited player finishes a service) | ≥ 45% |
| D7 retention, duos | ≥ 18% |
| Median service rating (in-game thumbs up after a service) | ≥ 80% positive |
| Netcode: services finished without a desync or disconnect | ≥ 98% |

## 10. What we are explicitly *not* doing in V2.0

- Accounts or OAuth (identity stays nickname, token and codes; see [13-social-and-virality.md](./13-social-and-virality.md)).
- Monetization of any kind. Cosmetics could be monetized later, never power.
- The level editor (architected for, not built; see [06-level-design.md §9](./06-level-design.md)).
- Matchmaking with strangers at launch (friends and links first; see [10-multiplayer-and-netcode.md](./10-multiplayer-and-netcode.md)).
- More than 4 players.

## 11. Title alternatives

| Title | Note |
|---|---|
| **Giant Appetite** | Clear, describes the hook. Recommended. |
| Big Bite | Short and punchy, but generic and harder to search. |
| Feast of Giants | Evocative, a little epic for a cozy tone. |
| Crumbs | Names the chefs ("Crumbs" are the tiny cooks), cute, and hard to search. |

Before committing, check trademark and domain availability for the chosen title.
