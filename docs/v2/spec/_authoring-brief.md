# Spec authoring brief (for the agents writing docs/v2/spec/)

## Purpose
`docs/v2/spec/` is the **implementation reference** for Pixel Kitchen V2. Coding agents will build the rest of the game autonomously from it, including fast, less capable models like Haiku. Those agents have no memory of past conversations. So every doc must be **explicit, concrete and unambiguous**:
- exact file paths;
- exact type and interface definitions in TypeScript;
- exact numbers;
- exact tick ordering;
- exact message formats;
- concrete examples;
- acceptance criteria.

If a coder would have to make a design decision, make it in the doc. Prefer tables, code blocks and numbered steps over prose. Never write "TBD" or "as appropriate". If something is unknown, choose a sensible default and mark it `Default (tunable)`.

The design docs `docs/v2/01–16` explain the *why*. The spec explains the *what and how*. Where they conflict, the spec wins, and these owner decisions win over both:

## Owner decisions (binding, as of 2026-11-17)
1. **Core loop = V1's order rush.**
   - Fixed recipe tickets against the clock. Recipes share steps (cheeseburger = burger + cheese, fries as a side).
   - Serve as many as possible in a fixed time. There is no game over.
   - Replay to beat records.
2. **Players.**
   - Up to **6 players online** (P2P WebRTC, host-authoritative, Supabase Realtime signaling).
   - Up to **4 local players** on one screen with gamepads.
   - Online and local players can mix, for example 2 PCs with 3 players each.
3. **10 handcrafted levels**, each a *place* with personality, never a walled box. The list is in `docs/v2/06-level-design.md §3`. A Giant appears only as the level 10 customer.
4. **Camera:** fixed diorama camera per level, Overcooked-style. The owner approved it. It doesn't follow the player, except for a gentle framing for multi-zone levels as each level spec defines.
5. **Controls:** gamepad first, plus keyboard, plus mouse.
   - **No click-to-walk.** The level 1 build has it, and it must be removed. Players always move their chef themselves, which is part of the skill.
   - A mouse left click interacts with the station under the cursor only if it is within reach of the player's chef. Otherwise it does nothing, apart from a small "trop loin" hint.
   - 3 action buttons: Grab/Drop/Serve, Action (hold: chop, wash, extinguish), Throw (from level 3). Plus Dash.
6. **Instant accessibility:** no tutorial screens. Each level teaches its one new mechanic through design, contextual prompts and a guide arrow on the first order.
7. **Aesthetic reference = the level 1 demo** ("Le Kiosque du Port", `v2/packages/render/src/scenes/harbour/`, screenshots in `v2/docs/p2/`): a bright diorama, a place visible beyond the playable area, soft shadows, living details (customers who react, light ambient life). Future work should go further than it:
   - a better chef character;
   - better station and asset designs than both V1 and the demo.

   **The art style is still open: voxel or smooth stylized 3D (toon low-poly).** The render layer must therefore be specified behind an **asset abstraction**, so the style can be switched without touching the sim or the gameplay. Voxel is the current default.
8. **The French UI is the default.** English is also supported, and all strings go through the strings table.
9. **Determinism is non-negotiable:**
   - fixed 30 Hz sim in a Web Worker;
   - integer or Q8 fixed-point state;
   - the shared xoshiro128** PRNG;
   - no `Math.random` or float trig in sim or shared;
   - a state hash.

   This enables netcode, replays and server-verified records.
10. **Known bugs in the level 1 build** (to list in the backlog):
    - the first cutting board and the first fryer don't work;
    - the bin doesn't accept burnt items.
11. Netlify hosting. No accounts or OAuth: identity is a nickname, a token and recovery codes, as in V1. Low-cost backend (Supabase free tier).

## Ground truth
Read the actual code before writing about it: `v2/` (pnpm workspace) and V1 in `src/`, `public/levels/`, `netlify/functions/`, `supabase/schema.sql`. Describe what exists, and say clearly what must change. Each doc has a section **"Current state vs target"**.

## Format rules
- English. Markdown. Each doc starts with a 3-line summary, then a table of contents.
- Use stable section numbers so other docs and backlog tickets can reference them (e.g. `spec/02 §4.3`).
- Code blocks use real TypeScript that compiles conceptually against the existing packages (`@ga/shared`, `@ga/sim`, `@ga/content`, `@ga/render`, `@ga/client`).
- No marketing language. No names of existing commercial games except "Overcooked-style" as a genre reference.
- Length: as long as needed to be complete, typically 600–2,000 lines per doc. Completeness beats brevity.

## Spec index (who writes what)
| File | Content |
|---|---|
| `00-README.md` | How to use the spec, reading order per task type, glossary, golden rules for coding agents, definition of done, commit and branch conventions |
| `01-architecture.md` | Workspace layout, package boundaries and allowed imports, sim worker and render thread, data flow per frame, protocol messages, determinism rules, build, dev server, deployment, performance budgets |
| `02-simulation.md` | The rush sim: entities, item and station state machines, tick order, interaction table, chop/cook/burn/fire/wash, plates, throw, dash, collision, tickets and pacing, scoring, streaks, stars, player-count scaling, twist hooks, sim API, state hash, replay format |
| `03-content.md` | Every zod schema field by field, the full item/station/recipe catalog for the 13 recipes with chains, level.json and layout.json formats, a how-to for adding content, and validation rules |
| `04-rendering-and-art.md` | Render architecture, the asset abstraction (voxel and smooth backends), the scene/diorama composition, lighting, water, the chef rig and every animation, station and item visual specs, VFX, the camera per level, the art style guide derived from the harbour demo, performance budgets |
| `05-client-ui-input-audio.md` | Router and screens, title/intro/HUD/pause/results, couch join, input mapping per device, contextual prompts, guide arrow, strings and i18n, audio engine and sound list, settings, accessibility |
| `06-multiplayer.md` | Rooms and invite links, signaling, WebRTC topology, host-authoritative lockstep or state sync (pick and specify exactly), message schemas, input delay, join/leave/reconnect, host migration (or not), desync detection, mixed local and online players, voice chat, testing with simulated latency |
| `07-backend-and-records.md` | Supabase schema, Netlify functions, identity, run submission, server re-simulation verification, leaderboards per level × bucket, anti-cheat, rate limits, the V1 coexistence at `/classic` |
| `08-levels.md` | The level spec template, then the full spec for all 10 levels: setting, layout grid, stations, recipes, twist mechanics with exact sim rules, pacing, star method, diorama dressing list, ambient life, music mood |
| `09-testing-and-quality.md` | Unit, bot and determinism tests, screenshot and overflow tests, perf tests, network tests, playtest checklists, CI |
| `10-backlog.md` | An ordered list of implementation tickets, each sized for one agent session: ID, title, depends-on, files, exact steps, acceptance criteria, tests. Written last, from docs 00–09. |
