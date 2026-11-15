# Pixel Kitchen V2: "Giant Appetite". Design Document Set

> Status: **proposal for review**. Documentation only: no game code has been written.
> Date: 2026-11-15. Based on a full audit of the V1 codebase (GitHub `main` plus the newer local working copy).

## The idea in 30 seconds

*Two tiny chefs carve, torch and toss an edible voxel world to feed colossal, moody Giants, and every feast ends with a reaction worth clipping.*

- **The world is the pantry:** cheese cliffs, bread boulders and pepper ridges are terrain you harvest *and* reshape.
- **Food is simulated voxel by voxel:** cut along any plane, and watch heat travel from the crust to the core. Burnt outside and raw inside is a real outcome you can see.
- **Duo asymmetry:** each chef carries one tool (Cleaver or Torch, then new pairs per chapter) that works on both food and terrain. The best dishes need both of you.
- **The Giant is the clock and the customer:** its belly drains, its mood shifts, its cravings are open-ended briefs ("something CRUNCHY and HOT"), and a hangry Giant stomps the level.
- **Every service ends with the Big Bite:** a directed tasting cinematic, auto-clipped and auto-titled, ready to share. The link opens straight into your kitchen in under 20 seconds, with no install and no account.

## Documents

| # | Document | What it covers |
|---|---|---|
| 01 | [Codebase audit](./01-codebase-audit.md) | Keep, improve, replace or drop for every V1 file, repo health findings, the design audit |
| 02 | [Vision](./02-vision.md) | Pitch, pillars, positioning against neighbor games, audience, platforms, success metrics |
| 03 | [Game design](./03-game-design.md) | Systems: crew, tools, tandems, the Giant (belly, mood, cravings, hazards), edible world, the Palate, scoring, scaling, versus |
| 04 | [Gameplay](./04-gameplay.md) | Verbs, controls (gamepad, keyboard and mouse, touch), targeting, game feel, the first 10 minutes, modes, mutators |
| 05 | [Interactions and voxel cooking](./05-interactions-and-cooking.md) | The FoodBody data model, the cutting and heat algorithms, fire, coats, stations, evaluation, budgets, fallback |
| 06 | [Level design](./06-level-design.md) | Diorama anatomy, archetypes, the 6 biomes and Giants, pacing curves, data format, pipeline, a worked example |
| 07 | [Art direction](./07-art-direction.md) | "Edible Diorama": voxel density hierarchy, lighting, palette, food shading, VFX, UI art, asset pipeline |
| 08 | [Characters and camera](./08-characters-and-camera.md) | The first- vs third-person decision, the camera rig, procedural chef animation, Giants, the Big Bite shot list |
| 09 | [Technical architecture](./09-technical-architecture.md) | Stack, repo layout, threads, the deterministic sim, voxel meshing, rendering, backend, performance targets |
| 10 | [Multiplayer and netcode](./10-multiplayer-and-netcode.md) | P2P host-authoritative model, prediction, intents, voxel op replication, host migration, run verification |
| 11 | [Voice and communication](./11-voice-and-communication.md) | WebRTC voice, VAD, proximity, filters, mouth flaps, pings, quick chat, safety, clip consent |
| 12 | [Progression](./12-progression.md) | Campaign, cookbook, crews, wardrobe, dailies, pacing, saves without accounts |
| 13 | [Social and virality](./13-social-and-virality.md) | Viral loop, invite flow, auto-clips, share cards, friend codes, competition, streamers, launch plan, KPIs |
| 14 | [Audio and music](./14-audio-and-music.md) | Mixer, sound design, adaptive music driven by the Giant |
| 15 | [UX, onboarding and accessibility](./15-ux-onboarding-accessibility.md) | Screen flow, HUD, onboarding, full settings list, accessibility commitments, localization |
| 16 | [Production roadmap](./16-production-roadmap.md) | Phases P0–P6, risk register, kill criteria, launch checklist, next steps |

**Suggested reading order:** 02 → 03 → 04 → 05 for the concept, 01 → 09 → 10 for the tech, and 16 for the plan.

## Constraints carried over from V1

These come from the project's established preferences and are respected throughout:
- **Netlify hosting** (not Vercel), simple, low-cost, maintainable infrastructure.
- **No accounts or OAuth.** A nickname plus a device token, extended with friend codes, crew codes and an optional recovery code.
- **Clean first launch:** optional clutter such as labels is off by default.
- **The established UI identity is preserved.** Pixel fonts are scoped to in-world labels only. No overflow in any language.
- **V1 and V2 coexist:** V2 is built in `/v2`, and V1 moves to `/classic` at the public beta.

## Decisions needed

| # | Decision | Recommendation |
|---|---|---|
| D1 | Adopt the "Giant Appetite" concept (edible world, voxel food simulation, Giants, duo tools)? | **Yes**, gated by the P1 "Cut & Burn" fun test |
| D2 | Third-person characters with per-player cameras (and a shared camera for couch play), dropping first-person | **Yes** ([08 §1](./08-characters-and-camera.md)) |
| D3 | P2P WebRTC with Supabase Realtime signaling. This needs the public Supabase key plus a room-scoped JWT on the client, a refinement of V1's "no key in the browser" rule. | **Yes**, with the relay server as plan B ([10 §2 note](./10-multiplayer-and-netcode.md)) |
| D4 | Discord Activity as a later distribution channel (Discord handles sign-in inside Discord) | Decide after the public beta |
| D5 | Final title | "Giant Appetite" (check trademark and domain availability) |
| D6 | Repo layout: a `/v2` pnpm workspace inside this repo vs a new repo | **Same repo**, `/v2` workspace |
