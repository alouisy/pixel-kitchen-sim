# Pixel Kitchen V2: Design Document Set

> Status: **revised on 2026-11-15** after the owner's first playtest.
> The first proposal ("Giant Appetite": voxel-simulated food, open cravings, Giants as the clock) went too far from what made V1 fun. **V2 now keeps V1's essence** and builds on it.

## The idea in 30 seconds

*The arcade kitchen rush you can play with up to 6 friends from a link, free in the browser, chasing world records on 10 handcrafted kitchens full of character.*

- **V1's loop, kept:** precise recipe tickets against the clock, recipes sharing their steps (a cheeseburger is a burger plus cheese), as many orders as possible before time runs out.
- **Replay and records:** personal bests, friends and world records per level and team size, verified by server re-simulation.
- **Up to 6 players** online from a link, or on one screen with gamepads. You see every chef in third person.
- **Instantly accessible:** three buttons, gamepad first, mouse click to grab like V1, no tutorial screens. Level 1 teaches by design.
- **10 very polished levels** with a real difficulty curve and a signature twist each (a harbour kiosk, a festival truck, a split diner counter, a rooftop pizzeria on two floors, a train dining car…), never a walled box.
- **Premium voxel look** (lighting, soft shadows, dioramas), to be confirmed against a cartoon alternative after the first level.
- Giants survive only as an optional theme (the level 10 customer) if they make the game more fun.

## Implementation spec (for coding agents)
The **[implementation spec](./spec/00-README.md)** in `docs/v2/spec/` is the reference every coding agent follows: architecture, simulation, content, rendering and art, client/UI/input/audio, multiplayer, backend and records, the 10 levels, testing, and an ordered backlog of 134 tickets ([10-backlog](./spec/10-backlog.md)). Agents start with [`v2/AGENTS.md`](../../v2/AGENTS.md). Where the spec and these design docs differ, the spec wins.

## Documents

| # | Document | Status |
|---|---|---|
| 01 | [Codebase audit](./01-codebase-audit.md) | Valid |
| 02 | [Vision](./02-vision.md) | **Rewritten** |
| 03 | [Game design](./03-game-design.md) | **Rewritten**: recipes, orders, scoring, streaks, scaling 1–6, curve, twists |
| 04 | [Gameplay](./04-gameplay.md) | **Rewritten**: verbs, controls, onboarding, modes |
| 05 | [Interactions and cooking](./05-interactions-and-cooking.md) | **Rewritten**: discrete item and station model, interaction table |
| 06 | [Level design](./06-level-design.md) | **Rewritten**: the 10 levels, anatomy, tuning process |
| 07 | [Art direction](./07-art-direction.md) | Valid, with a revision note |
| 08 | [Characters and camera](./08-characters-and-camera.md) | Valid, with a revision note |
| 09 | [Technical architecture](./09-technical-architecture.md) | Valid, with a revision note |
| 10 | [Multiplayer and netcode](./10-multiplayer-and-netcode.md) | Valid, with a revision note (6 players) |
| 11 | [Voice and communication](./11-voice-and-communication.md) | Valid, with a revision note |
| 12 | [Progression](./12-progression.md) | **Rewritten** |
| 13 | [Social and virality](./13-social-and-virality.md) | Valid, with a revision note (records first) |
| 14 | [Audio and music](./14-audio-and-music.md) | Valid, with a revision note |
| 15 | [UX, onboarding and accessibility](./15-ux-onboarding-accessibility.md) | Valid, with a revision note |
| 16 | [Production roadmap](./16-production-roadmap.md) | **Rewritten** |

Sections of docs 07–15 that still mention cravings, tools, the Big Bite or voxel food simulation describe the earlier proposal. Where they differ, the revision notes and the rewritten docs win.

## Constraints carried over from V1
Netlify hosting, no accounts or OAuth (nickname, token, codes), a clean first launch, the established UI identity, no overflow in any language, and V1 kept playable at `/classic`.

## Decisions
| # | Decision | Status |
|---|---|---|
| D1 | Keep V1's order-rush loop as the core | **Decided** by the owner |
| D2 | Third-person chefs, up to 6 players online | **Decided** |
| D3 | P2P WebRTC with Supabase Realtime signaling and a room-scoped JWT | Accepted |
| D4 | Art style: premium voxel vs polished cartoon | **Open**: decide after level 1 (P2) |
| D5 | Giants as the level 10 theme | **Open**: decide after the Giant mini-demo playtest |
| D6 | Title: "Pixel Kitchen 2" vs another | Open |
