# 02 · V2 Vision (revised 2026-11-15)

> **Revision note.** The first version of this doc proposed "Giant Appetite": food simulated voxel by voxel, open-ended cravings and Giants as the clock. The project owner playtested the first prototype and reset the direction: **V2 must keep the essence of V1**. That essence is fixed recipes served against the clock, replaying to beat records, playing together, and world leaderboards. The Giants and the voxel food simulation are now optional ideas. They stay only where they make that loop more fun. This doc replaces the earlier vision.

## 1. The pitch

**One line:** *The arcade kitchen rush you can play with up to 6 friends from a link, free in the browser, chasing world records on 10 handcrafted kitchens full of character.*

**What stays from V1 (the essence):**
- **Orders against the clock.** Tickets arrive, each one a precise recipe. You prep, cook, assemble and serve before it expires. As many orders as possible before the timer ends.
- **Recipes that share their steps.** A cheeseburger is a burger plus cheese. Fries complete a combo. Learning one recipe makes the next one easy, and the challenge comes from juggling them.
- **Replay to get faster.** Every level is a puzzle in *routing and coordination* that rewards practice. Personal bests matter.
- **Competition.** Leaderboards and world records per level and per team size.
- **Instant to understand.** Anyone can start a level and know what to do within seconds.

**What V2 adds:**
- **Multiplayer for up to 6 players**, online from a link and on one screen with gamepads.
- **Characters you can see**, in third person, so co-op chaos becomes visible and funny.
- **Kitchens with personality**: 10 handcrafted places (a harbour kiosk, a festival food truck, a train dining car, a rooftop pizzeria…), each with one signature twist, instead of walled boxes.
- **A premium look**: the same voxel identity, rebuilt with real lighting, soft shadows and diorama-like scenes.
- **Credible records**: runs are verified by replaying them on the server, so world records mean something.

**Our edge:** the genre exists, but its leaders are paid console and PC games. **Free, instant, in the browser, multiplayer** is a real difference. We don't need to reinvent the genre. We need to execute it extremely well and make it shareable.

## 2. Pillars

| # | Pillar | Test question |
|---|---|---|
| P1 | **Simple to start, deep to master** | "Can a first-timer play level 1 without explanation? Does a veteran still find time to save on level 10?" |
| P2 | **Every second counts** | "Does this feature make the run faster or slower to optimize, in an interesting way?" |
| P3 | **Better together, fine alone** | "Is it fun at 1, 2, 4 and 6 players?" |
| P4 | **Every kitchen is a place** | "Would a screenshot of this level be recognizable without the UI?" |
| P5 | **Records you can trust and share** | "Can a player prove and show off this score?" |
| P6 | **Link to play** | "Did this add a step between the link and the kitchen?" |

## 3. What we keep, adapt or drop from the first V2 docs

| Idea | Status | Why |
|---|---|---|
| Third-person characters, per-player camera, shared camera for couch play | **Keep** | Seeing your teammates is half the fun of co-op |
| Deterministic simulation, P2P netcode, run verification | **Keep** (extended to 6 players) | Needed for multiplayer and trusted records |
| Premium voxel art direction, diorama look | **Keep, to be confirmed** on a polished sample level | Our signature, and producible from code |
| Voice chat, pings, emotes | **Keep** | Coordination is the core skill |
| Clips and share cards | **Keep, refocused on records** ("New world record on Level 7!") | Virality through competition |
| Voxel-by-voxel food simulation (free cuts, heat diffusion) | **Drop from gameplay.** Keep the cooking colour ramp as a visual effect. | Too fiddly, and it fights the "fast and readable" loop |
| Open-ended cravings judged by taste | **Drop** | Orders must be precise to be optimizable |
| Asymmetric tools per chef | **Drop** | Adds learning cost; every chef can do everything, as in V1 |
| Giants | **Optional theme.** Possibly the customer of the finale level or a recurring VIP. | Only if it serves the gameplay |
| Edible, destructible terrain | **Drop as a system.** It survives as one level twist (harvest ingredients from planters in the greenhouse level). | |

## 4. Audience and platforms
- **Audience:** friends, couples, families and streamers who like quick co-op party games, plus score-chasers and speedrunners who want world records.
- **Platforms:** web desktop (keyboard and mouse or gamepad) first, web mobile and tablet second, couch co-op in one tab with up to 4 gamepads (6 if the hardware allows), and later possibly a Discord Activity and Steam.

## 5. Session shape
- A level run lasts **3–5 minutes**.
- A sitting is 5–10 runs, often the same level replayed to improve.
- The campaign is **10 levels** with a real difficulty curve (20 only if quality holds). Mastery means 3 stars on all levels, then records.

## 6. Success criteria (public beta)

| Metric | Target |
|---|---|
| First-time player completes level 1 with ≥ 1 star, no tutorial | ≥ 85% |
| Average replays of the same level per session | ≥ 2.5 |
| Runs played with ≥ 2 players | ≥ 50% |
| Invite conversion (invited player finishes a run) | ≥ 45% |
| D7 retention | ≥ 18% |
| Services finished without desync | ≥ 98% |

## 7. Title
"Giant Appetite" no longer describes the game. Recommendation: keep the existing brand, **Pixel Kitchen**, and call the release **Pixel Kitchen 2** (or "Pixel Kitchen: Rush"). It's to be decided before any public announcement.
