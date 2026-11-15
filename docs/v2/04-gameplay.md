# 04 · Gameplay (Moment to Moment), revised

> **Revision note (2026-11-15).** Simplified for the order-rush loop: no tools, three buttons, gamepad first, the mouse click to grab kept from V1. Rules and numbers are in [03-game-design.md](./03-game-design.md).

## 1. The 20-second loop
```
READ a ticket ─▶ GRAB an ingredient ─▶ CHOP / COOK ─▶ PLATE ─▶ SERVE ─▶ next ticket
```
The skill is in **routing** (who does what, in which order), **timing** (pulling food before it burns) and **coordination** (passing, throwing, not blocking each other).

## 2. Verbs
| Verb | Behavior |
|---|---|
| Move | 4.6 m/s, snappy (0.08 s to full speed) |
| Dash | 0.18 s burst, 1.0 s cooldown. Bumping a teammate nudges them (no item drop). |
| **Grab / Drop / Serve** | Context: pick up, put down, combine onto a container, serve at the pass, use a dispenser |
| **Action (hold)** | Chop, wash, extinguish. Shows a progress ring. |
| Throw (from level 3) | Hold to aim with a preview arc, release. Teammates catch automatically if their hands are empty and they face it. |
| Emote and ping | Radial menus (optional) |

## 3. Controls
| Action | Gamepad | Keyboard + mouse | Touch |
|---|---|---|---|
| Move | Left stick | WASD **or arrows** | Left joystick |
| Grab / Drop / Serve | **A** | **Left click** (like V1) or Space | Big right button |
| Action (hold) | **X** | **Right click** (hold) or E | Second button (hold) |
| Throw | **RB** (hold, release) | F (hold) | Drag-to-aim button |
| Dash | **B** | Shift | Small button |
| Ping / Emote | LB / d-pad | Middle click / T | Radial |
| Pause | Start | Esc | ‖ |

- **Targeting** (third person): the nearest valid target in front of the chef (cone of 1.6 m, ±80°) gets an outline in the player's colour. With the mouse, the hovered target wins if it's in reach. This is generous on purpose.
- Glyphs in prompts follow the last device used.

## 4. Game feel checklist (every interaction)
Anticipation, a 2-frame hit-stop on chop, voxel crumbs in the ingredient's colour, squash and stretch on pickup and place (V1's GSAP juice), a sound with ±8% pitch variation, light haptics. Serving triggers a customer reaction and a score pop with the streak multiplier.

## 5. Onboarding: the level teaches
- **No tutorial screens.** Level 1 is designed so the only possible first action is right in front of you (a potato crate next to a cutting board next to a fryer next to the pass), with contextual prompts the first 3 times each verb is possible.
- Each later level shows **one card** at its start for its single new mechanic (an icon and a 5-word sentence, such as "Les assiettes reviennent sales !"), then lets players try it safely during the first 30 s.

## 6. Modes
| Mode | Players | Launch |
|---|---|---|
| **Campaign** (10 levels, stars) | 1–6 online, 1–4 couch | V2.0 |
| **Record runs** (any unlocked level, leaderboard-eligible) | 1–6 | V2.0 |
| **Daily Rush** (a daily level and modifier, one ranked attempt, share card) | 1–6 | V2.0 |
| **Kitchen Duel** (versus) | 2–6 | V2.1 |
| **Classic** (the V1 game at `/classic`) | 1 | V2.0 |

## 7. During a run (UX)
- **Tickets** (top-left, in a row): recipe picture, component icons and a timer bar.
- **Score and streak** (top-centre), **time left** (top-right).
- **Record pace** (optional, top-right under the timer): your current score against your personal best and the world record at the same second. That's the speedrun hook: "+120 vs PB".
- **Results:** score breakdown, stars, PB or record flags, "Rejouer" (one button, instant restart: every second between runs matters for replayability), and Share.

## 8. Pause and disconnects
- Online: no pause. The menu overlays your screen only and your chef idles.
- Couch and solo: true pause.
- Disconnect: your chef freezes for 30 s, then the run continues with the scaling of the new player count. A rejoin within the run is allowed. Runs with a disconnect are still valid for records in the final bucket's player count (see [10 §8](./10-multiplayer-and-netcode.md)).
