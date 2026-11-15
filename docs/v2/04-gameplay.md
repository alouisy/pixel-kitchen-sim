# 04 · Gameplay (Moment to Moment)

How Giant Appetite *feels* in the hands: the verbs, controls, movement tuning, the first ten minutes, and the game modes. Rules and numbers are in [03-game-design.md](./03-game-design.md).

---

## 1. The 30-second loop

```
LOOK  ─▶  "What does the Giant want? What's in reach?"   (thought bubble, Taste Card)
GO    ─▶  run, hop, dash; re-route with tools            (traversal)
GET   ─▶  carve or pick up an ingredient                 (harvest)
MAKE  ─▶  cut, heat, glaze, combine                      (voxel cooking)
SHOW  ─▶  serve at the Mouth / Platter / critter         (payoff and reaction)
```

A good service alternates **short loops** (critter orders, 15–30 s) with **long loops** (cravings, 60–90 s), and builds to **one big loop** (the Big Bite).

## 2. Verbs

| Verb | Description | Notes |
|---|---|---|
| **Move** | Analog run, 4.2 m/s | Acceleration 0.08 s to full speed, deceleration 0.06 s. Snappy, not floaty. |
| **Hop** | A small jump of 0.6 m, ~0.35 s airtime | Coyote time 100 ms, jump buffer 120 ms. For ledges of 1–2 fv blocks and comedic bounces. |
| **Dash** | A 0.18 s burst to 9 m/s, 1.2 s cooldown, uses 25 stamina | Cancels slip status. Bumping another chef with a dash knocks them back slightly (comedy, never griefing: no item drop). |
| **Grab / Drop** | A context action on the nearest valid target | One item in hand. Big items need Heavy Haul. |
| **Throw** | Hold to charge (0.1–0.8 s), release to throw | An arc preview line while charging. Catching is automatic if the receiver's hand is empty and they face it (±60°). |
| **Tool Primary** | Hold to use the tool continuously | Cleaver slices, Torch flames… |
| **Tool Alt** | Tap or hold, depending on the tool | Carve, ignite… |
| **Interact** | Station-specific (ring the bell, swap a tool, open the oven) | Same button as Grab, resolved by priority (§4). |
| **Ping** | Places a world marker with an auto-label ("Cheese here!", "Fire!", "Need hands!") | Context-aware. See [11-voice-and-communication.md §6](./11-voice-and-communication.md). |
| **Emote** | A radial menu of 8 emotes | High-five is a tandem emote (both chefs → a confetti burst). |

## 3. Controls

### 3.1 Gamepad (reference scheme)
| Input | Action |
|---|---|
| Left stick | Move |
| Right stick | Camera orbit (light, auto-recentering) |
| **A / ✕** | Grab / Drop / Interact |
| **B / ○** | Dash |
| **X / □** | Throw (hold to charge) |
| **RT / R2** | Tool Primary (analog: flame strength, slicing speed) |
| **LT / L2** | Tool Alt |
| **Y / △** | Hop |
| RB / R1 | Ping (hold for the ping wheel) |
| LB / L1 | Emote wheel |
| D-pad ↑ | Toggle the Taste Card |
| D-pad ↓ | Push-to-talk (if PTT is enabled) |
| Start | Pause (online: a personal menu, the game doesn't pause) |

### 3.2 Keyboard and mouse
| Input | Action |
|---|---|
| WASD | Move |
| Mouse | Aim the tool (cursor projects onto the world; the character turns toward it) |
| Right mouse drag or Q/E | Camera orbit |
| **E** / Space | Grab / Interact (Space = Hop if nothing is grabbable) |
| Shift | Dash |
| Left mouse | Tool Primary |
| Right mouse (tap) | Tool Alt |
| F (hold) | Throw |
| Middle mouse / Z | Ping |
| T | Emote wheel |
| V | Push-to-talk |
| Tab | Taste Card |

**The mouse aims the tool and does not steer the camera.** That's deliberate. Mouse-aimed carving and flame is the most precise and satisfying input in the game, and it frees the camera to be directed for spectacle.

### 3.3 Touch (mobile)
- Left virtual joystick: move (ported from V1's `_setupJoystickEvents`).
- Right side: a **context button cluster**: Grab (big), Tool (big, hold), Dash, Throw (drag-to-aim slingshot).
- Tool aim: auto-target with a drag-to-adjust reticle.
- Camera: fully automatic, with a two-finger orbit override.
- Ping and emote: a bottom-right radial.

All bindings can be remapped and are saved in settings.

## 4. Targeting and context resolution

V1 used a center-of-screen raycast. V2 is third-person, so it uses **soft targeting**:

1. Gather candidate targets within a **cone** in front of the chef (radius 1.4 m, 70° half-angle) plus the mouse-projected point on keyboard and mouse.
2. Score each candidate: `score = 1/distance + facingDot·0.5 + priority + stickiness(0.3 if it was last frame's target)`.
3. Priority order for Grab/Interact: **catchable item in flight › station interaction › held-item combine target › loose item › terrain grab**.
4. Highlight the winner with a **voxel outline pulse** in the chef's color (both players see each other's targets, faintly). This replaces V1's green slot highlight and `scale 1.1`.

**The tool aim reticle** is a separate ghost: the Cleaver shows the cut plane as a translucent sheet, the Torch shows the flame cone and a heat preview tint on the voxels it will affect.

## 5. Game feel ("juice") checklist

Every interaction must ship with **all** of these, or it isn't done:

| Layer | Example (Cleaver slice) |
|---|---|
| Anticipation | The blade lifts 2 frames before the cut |
| Impact | A 2-frame hit-stop (33 ms) on contact, voxel particles of the food's color |
| Sound | A crisp chop with pitch varying ±8% by material |
| Camera | Micro-shake (0.04 amplitude) on hard materials only |
| Object response | Both halves squash and stretch (GSAP elastic, kept from V1), slight separation impulse |
| Persistent trace | Cut faces show the interior color: you see the inside of the tomato |
| Haptics | A light rumble on gamepad, `navigator.vibrate(8)` on mobile |

The V1 roadmap's juice ideas (pickup pop, place squash, chop particles, smoke, dust at the feet) are all included.

## 6. The first ten minutes (onboarding)

Principle: **no text tutorials.** Every rule is taught by a situation (the V1 `visualSteps` panels are retired).

| Minute | Beat | Teaches |
|---|---|---|
| 0:00 | The link opens straight into the **Kitchen Lobby** (see [15-ux-onboarding-accessibility.md](./15-ux-onboarding-accessibility.md)). Pick a hat. Your nickname is pre-filled with a funny generated one. | Zero friction |
| 0:30 | **"Breakfast for Mossback"**: a tiny Giant tortoise (small, cute, low stakes) at the hub. A mushroom grows right in front of you. Its thought bubble shows a mushroom icon. | Grab and serve |
| 1:30 | The next craving is a *cooked* mushroom icon. The Torch chef has a glowing prompt. The heat gradient is visible. | Heating and doneness |
| 2:30 | It wants it *sliced and cooked*. A big mushroom needs the Cleaver. | Tool asymmetry |
| 3:30 | The mushroom is across a small gap. A cheese wall is next to it. Torch melts the cheese into a ramp. | Tools change terrain |
| 5:00 | A giant mushroom cap: Heavy Haul. Both chefs must lift it. | Tandem |
| 6:30 | Mossback yawns: belly drain starts, and the first critter mouse asks for fries. | Belly + critters |
| 8:00 | **First Big Bite.** The Feast Platter appears and the camera does the first cinematic. Always a guaranteed great reaction. | The payoff and the clip |
| 9:30 | Results, then "Share your first feast?" and "Invite a friend for chapter 1". | Social hooks |

In **solo**, the same script runs with tool swap prompts and Sous-Bot introduced at the Heavy Haul beat.

## 7. Modes

| Mode | Players | Summary | Launch |
|---|---|---|---|
| **Campaign** | 1–4 (designed for 2) | 6 chapters × 5 services + a boss. Online or couch. | V2.0 |
| **Daily Feast** | 1–2 | One seeded service per day, identical for everyone, one ranked attempt (unlimited practice). Share card. | V2.0 |
| **Free Service** | 1–4 | Any unlocked level with modifiers (Mutators, §8). | V2.0 |
| **Food Fight** | 2–4 (1v1, 2v2) | Versus, shared Giant ([03 §10](./03-game-design.md)). | V2.1 |
| **Stream Feast** | 1–2 + audience | Viewers vote on cravings and hazards via a web overlay ([13 §7](./13-social-and-virality.md)). | V2.1 |
| **Classic** | 1 | The V1 game, preserved at `/classic`. | V2.0 |

## 8. Mutators (replayability)

Unlocked through progression and combinable in Free Service. One is featured in the Daily Feast each week.

- **Butterfingers:** throwing is 2× stronger, catching is harder.
- **Spice World:** every material has +0.3 spicy. The Giant breathes fire on every bite.
- **Tiny Giant:** the Giant is chef-sized and runs around the kitchen (a chaos favorite).
- **Low Gravity:** hops are 3× higher and debris floats.
- **Blind Taste:** the Taste Card is disabled. Read the food.
- **Swap Hands:** tools swap between chefs every 45 s.
- **Mirror Crew:** chefs' movement inputs are mirrored onto each other (an advanced, hilarious voice-chat mutator).

## 9. Pause, disconnects and interruptions

- **Online:** nobody can pause the shared simulation. The personal menu overlays only your screen and your chef idles safely (they can't be stunned while in the menu: invulnerable, translucent).
- **Couch or solo:** a true pause.
- **Disconnect:** your chef becomes a "sleeping" statue for 30 s while the host waits. Then the service continues in "short-handed" tuning (solo scaling) with the tool auto-swappable by the remaining player. Reconnecting puts you back into your chef. See [10-multiplayer-and-netcode.md §8](./10-multiplayer-and-netcode.md).
