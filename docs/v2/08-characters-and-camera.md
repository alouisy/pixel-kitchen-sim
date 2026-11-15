# 08 · Characters and Camera

This answers the open question from the brief: *first-person or third-person? Should partners see each other?*

**Decision: third-person, fully modeled voxel chefs, on a directed "diorama follow" camera, with each online player getting their own camera.** First-person is dropped as a mode, but its best quality (precision) is kept through mouse-aimed tools and a close "Focus" camera for fine work.

---

## 1. The perspective decision

| Criterion | First-person (V1) | Third-person, own camera | Shared single camera (top-down) |
|---|---|---|---|
| Seeing your partner (comedy, intent, coordination) | ✗ only when looking at them | ✓ always nearby on screen | ✓✓ |
| Clip-ability (a viewer understands the scene) | ✗ | ✓ | ✓✓ |
| Precision of tool aim | ✓✓ | ✓ (mouse aim, Focus cam) | ~ |
| Verticality and traversal readability | ~ | ✓✓ | ✗ (occlusion, depth ambiguity) |
| Immersion and scale (tiny chef, huge Giant) | ✓✓ | ✓✓ (low angles) | ✗ (the Giant becomes a map) |
| Online, independent movement | ✓ | ✓ | ✗ (a leash) |
| Couch co-op on one screen | ✗ (needs split-screen) | ~ | ✓✓ |
| Motion sickness | Risky | Low | None |
| Expressing identity (hats, emotes, voice mouth flaps) | ✗ | ✓✓ | ✓ |

**Result:**
- **Online:** third-person, one camera per player.
- **Couch:** a shared, auto-framing camera (the same rig in "group" mode). If players separate more than 22 m, it switches to a dynamic split (a split line along the axis between the players that merges back seamlessly).
- **Cinematics (the Big Bite, set pieces):** a director camera takes over everyone's view.

## 2. Camera rig: "Diorama Follow"

### 2.1 Default parameters (online, per player)
| Parameter | Value | Notes |
|---|---|---|
| Distance | 7.5 m (range 5–11 m) | Zoom on the right stick click or scroll |
| Pitch | 48° (range 30–65°) | Steeper in tight spaces |
| Yaw | Free orbit (right stick or Q/E), **auto-recenters** behind the chef's travel direction after 2.5 s without input | Gentle, never fights the player |
| FOV | 42° vertical | A narrow FOV gives the *miniature* look and compresses depth |
| Look-ahead | 0.8 m in the velocity direction | |
| Lag | Critically damped spring, ω = 9 | |
| **Partner bias** | If the partner is within 12 m, the framing target shifts 20% toward them | You almost always see each other |
| **Giant bias** | The yaw is softly attracted to keep the Giant's head in the upper third | The landmark stays visible |

### 2.2 Occlusion
- Voxel geometry between the camera and the chef is **cut away** (a cylindrical dither-fade in the shader, radius 1.2 m), never popped out. It's cheap and stylish, like a cutaway diorama.
- When the chef is under an overhang, the camera lowers its pitch and moves in (by sampling a 5-ray fan against the voxel world).

### 2.3 Focus camera
- Holding **Tool Primary on a target for more than 0.4 s** while stationary gently dollies in to 3.5 m and drops the pitch to 35°. That's the "precision cutting" view.
- Moving, or releasing the tool for 0.6 s, returns to the default. Players never toggle it manually, but it can be disabled in settings.

### 2.4 Couch group camera
- Frames the bounding sphere of all local chefs with a 2 m margin, distance clamped to 6–16 m.
- The yaw is fixed per level section (designer-authored "camera volumes"). Orbiting is disabled in group mode to avoid fights over the camera.

## 3. Chef character

### 3.1 Construction
- About 26 food voxels tall. Parts: **head** (with a sprite face), **body** (with apron), **two floating hands**, **two feet**, and a **hat**.
- **No arms or legs as limbs.** Hands and feet float, procedurally placed. This avoids skeletal rigging and IK, looks charming, and reads perfectly at 50 px tall.
- Total ≤ 1,800 voxels, meshed once per cosmetic combination and cached.

### 3.2 Procedural animation (no keyframe files for locomotion)
| Layer | Technique |
|---|---|
| Locomotion | Feet follow a step planner (a step every 0.32 s at full speed, lift height 0.12 m). The body bobs `sin(phase·2)·0.04` and leans into acceleration (≤ 12°). |
| Hands | They target **hold points** on the held item (two per item, authored or auto-computed from the bounding box). With empty hands, they swing counter to the feet. |
| Tool use | A short authored **pose curve** per tool action (a 6–12 key JSON spline per hand), blended over the procedural base. |
| Head | Looks at the current target, the partner when they ping, or the Giant during announcements. |
| Squash and stretch | On land, dash, grab and throw (GSAP-style tweens on scale, as in V1's juice). |
| Face | A sprite state machine: idle, focus, effort, happy, panic, dizzy, singed, laughing. Blinks every 2–5 s. |
| **Voice mouth flaps** | The mouth sprite is driven by the player's live microphone amplitude ([11 §5](./11-voice-and-communication.md)): 4 mouth shapes by RMS level. *A key comedy feature.* |

### 3.3 Status animations
Stunned (stars orbit the head), slipping (a windmill with the hands), on fire (running in panic, a smoke trail), frozen (ice-block voxel overlay, wiggling to break free), sticky (feet stretch when stepping), heavy haul (both chefs' hands on the item, a synchronized shuffle).

### 3.4 Customization
- **Hats** (the main identity), **aprons** (color and pattern), **face sets** (eye and mouth styles), **tool skins** (a cosmetic shape over the same function) and **trails** (dash particles).
- All cosmetics are earned through play ([12-progression.md](./12-progression.md)). They are cosmetic-only.
- **Readability rule:** the crew color (outline, apron trim, ping color) is always enforced, whatever the cosmetics.

## 4. Character controller (physics)

- A kinematic capsule (radius 0.28 m, height 1.4 m) on Rapier ([09-technical-architecture.md](./09-technical-architecture.md)).
- **Step-up:** automatic up to 0.25 m (2 terrain voxels), so voxel stairs feel smooth.
- **Slopes:** voxel terrain is rendered blocky, but collision uses a **smoothed collision proxy** on walkable surfaces (per-chunk heightfield-ish collision built from top faces), so running never snags.
- **Ground materials:** friction and speed modifiers per material (caramel sticky ×0.6, ice ×1.1 with slip, sauce ×0.9).
- **Chef vs chef:** a soft push (capsules separate over 0.15 s). There's no hard blocking, so nobody body-blocks a doorway.

## 5. Critters

- Small (8–12 fv), simple, with species per chapter (mice, penguins, lizards, crabs, bees, imps).
- They walk to the Critter Counter, show an order bubble, and do a happy hop or grumpy stomp when served.
- **Helpers:** at Friendship thresholds they follow a pinged command for 30 s using navmesh pathing. They're limited to carry, extinguish and hold.

## 6. Giants and the Big Bite cinematic

### 6.1 Giant puppet
- Parts with pivots (marker voxels), procedural layers: breathing, look-at (the head tracks the nearest chef holding food, which reads as "it wants it!"), blinking, and a **reaction library**.
- **Reaction library** (authored pose sequences, 1.5–4 s): delighted, swoon, chef's kiss, confused chew, spicy fire breath, brain freeze, sneeze, disgust (gag), tears of joy, dance, burp (wind gust), sleepy.
- The **reaction director** picks reactions from the `highlights[]` and the tier of the served dish ([05 §7](./05-interactions-and-cooking.md)), with rules like "`TOO_SPICY` always → fire breath, at a size scaled by spiciness".

### 6.2 The Big Bite: shot list (template)
A directed 8–14 s sequence. Everyone's camera is taken over and inputs are disabled.

| # | Shot | Duration | Camera |
|---|---|---|---|
| 1 | **The Ring:** both chefs ring the Feast Bell | 1.0 s | A low angle on the chefs, the Giant out of focus behind |
| 2 | **The Lift:** the Giant's hand lifts the platter | 1.5 s | Tracks up the dish, the tilt-shift DOF kicks in |
| 3 | **The Sniff:** the Giant smells, and the anticipation face plays | 1.0–2.0 s | A close-up on the Giant's eyes |
| 4 | **The Bite:** the jaw closes, crumbs explode | 0.8 s | A side angle, 4 frames of hit-stop, a camera punch |
| 5 | **The Chew:** a suspense beat with a drumroll, the length based on the tier (longer for extremes) | 1.0–3.0 s | A slow push-in |
| 6 | **The Reaction:** a reaction from the library | 1.5–4.0 s | A wide shot so the chefs are visible reacting in the foreground |
| 7 | **The Verdict:** a stamp appears ("PERFECT!" / "YUCK!"), with the dish name | 1.0 s | A freeze frame |

- Shot positions use **per-level camera anchors** with fallback auto-placement that avoids occlusion (raycasts against the voxel world).
- **The clip buffer:** these shots plus the 6 s of gameplay before the bell are what the auto-clip captures ([13-social-and-virality.md §3](./13-social-and-virality.md)).
- In online play, the cinematic is **simulation-timed by the host** and played locally on each client from a `BigBiteStart { seed, dishSnapshotId, reaction, shots }` message, so everyone sees the same thing in sync without streaming the camera.

## 7. Accessibility for camera and characters

- Camera shake intensity slider (0–100%). Hit-stop can be disabled. A reduced-motion setting skips cinematic swoops and uses cuts instead.
- Field of view slider (35–60°).
- An option for always-visible partner silhouettes through walls.
- Colorblind-safe crew colors, plus a shape emblem per crew slot (circle, triangle, square, star) on outlines and pings.
