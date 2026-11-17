# P2 brief: level 1 "Le Kiosque du Port" (V1 order loop on V2 tech)

Owner: Axel (French speaker, plays with a gamepad, not a PC gamer). The design source of truth is `docs/v2/03`, `04`, `05`, `06` (revised 2026-11-15). This brief makes those docs concrete for one level. Where it differs from the docs, this brief wins.

## 0. Goal and exit criteria
A first-time player opens `http://127.0.0.1:5173/`, picks "Le Kiosque du Port", and within 10 seconds understands they must cook and serve fries orders before the 3-minute timer ends. They can finish with at least 1★ without reading anything except on-screen prompts. On results they press A to replay instantly and try to beat their best. It must feel like an Overcooked-style rush (in genre only: original art, names and UI), at least as fun as V1's level 1.

Must ship:
1. Title screen (French UI by default, English if the browser is not French) with two cards: **"Niveau 1 · Le Kiosque du Port"** (default focus) and **"Mini-démo · Le petit-déjeuner de Mossback"** (the existing mini-game, kept working unchanged). Gamepad-navigable (D-pad / stick + A), mouse-clickable, keyboard (arrows + Enter).
2. Level 1 playable solo and couch co-op (1–4 local players, shared screen).
3. Results screen with score, stars, best score (localStorage), "Rejouer" (A / Enter / click) and "Menu".
4. `pnpm check` green, new tests for the order sim, a deterministic bot test, and screenshots in `v2/docs/p2/`.

Out of scope: online play, leaderboard backend, other levels, settings menus.

## 1. Architecture (keep the V2 rules)
- New sim module `packages/sim/src/rush/` (do not edit `kitchen/` except shared helpers you extract; the Mossback mini-game must keep working). Discrete item model exactly as in `docs/v2/05 §1`: items with `def`, `state`, integer `progress` (Q8 per step), `contents` for containers, `holder`. Stations with one socket.
- Runs in the existing sim Web Worker at 30 Hz fixed tick. All randomness via the shared xoshiro128** PRNG seeded per run. No `Math.random`, no floating trig in sim (the ESLint rule enforces this). Use integer ticks for every timer.
- Content as data in `packages/content` with zod schemas: `items`, `stations`, `recipes`, `levels/l01_kiosque/{level.json,layout.json}`. Port the V1 definitions for fries from `src/gameData.js` (`french_fries`: potato bin → cutting board → deep fryer → `cooked_fries` on a plate). Write the schemas generically so levels 2–10 become data work later; port all 13 V1 recipes' item/recipe data if it is cheap (validated, unused), but only fries is played.
- Render with the existing renderer: diorama camera, greedy mesher with AO, ramp shader. Item and station models come from `v2/content-src/vox/v1/` (`ingredient_bin_potato`, `cutting_board`, `fryer`, `plate_stack`, `trash_bin`, `table`, items `potato`, `raw_fries`, `cooked_fries`, `plate`). Cooking items use the raw → cooked → charred ramp with one doneness uniform per item.
- Client: new mode in `apps/client` (router by title screen choice and by URL `?level=1` / `?mode=giant`). Reuse `input.ts`, `audio.ts`, `hud.ts` patterns and `strings.ts` (add FR/EN keys; no hardcoded UI text).

## 2. Rules for level 1 (numbers go in level.json / tuning, these are starting values)
- Duration 180 s. A 3-2-1 "C'est parti !" countdown before the timer starts (chefs can already move).
- Recipe: **Frites** = plate + `cooked_fries`. Chain: grab potato from the crate → place on board → hold Action 1.6 s → `raw_fries` → place in fryer → auto-cook 5 s → `cooked` → burn window 6 s (ring pulses orange, then red, warning tick in the last 2 s) → `burnt` (bin only; no fire in level 1).
- Plates: a plate stack (infinite in level 1). Two ways to plate, as in V1: put the plate on a counter and drop fries on it, or hold the plate and grab the fries from the fryer (scoop). Serve the plate at the pass (the kiosk window).
- Tickets: max 2 active (solo: 2, since level 1 is the teaching level; duo 2, squad 3, party 4). First ticket appears at t=0, the second only after the first serve or after 25 s, whichever comes first (the safe first 30 seconds). After that use V1's `calculateNextOrderDelay` logic (`src/LevelManager.js:71`), ported to integer ticks with the PRNG: base delay from recipe time, rush burst 35% chance when one ticket is active, load easing, ±20% jitter, clamp 1.5–25 s. Ticket time 60 s solo (×1.25 bucket factor already included), see `docs/v2/03 §5` for the other buckets.
- Scoring (`docs/v2/03 §3.2`): base 100 + min(30, secondsLeft/2), × streak (×1, ×1.25, ×1.5, ×2 after 0/3/6/10 consecutive on-time serves). Expired ticket: −50 and the streak resets. Wrong dish (empty plate, burnt) is refused at the pass: plate stays in hand, −20, streak reset. Serve matches the ticket with the least time left.
- Stars: set thresholds from the bot (§6): 3★ ≈ 75% of bot max, 2★ ≈ 55%, 1★ ≈ 30%, per bucket (solo and duo at least; squad/party scaled). Put the final numbers in level.json.

## 3. Controls (gamepad first)
- Move: left stick / WASD / arrows. Chefs collide with counters and each other (reuse the circle-vs-AABB collision from `kitchen/play.ts`).
- **A / Space / left click: Prendre · Poser · Servir** (context). **X / E (hold): Couper** (on a board). **B / Shift: Dash** (short, 0.6 s cooldown).
- Target = the station in front of the chef within 1.1 m, with a gentle bias to the stick direction. The targeted station gets a soft outline/glow and a contextual prompt bubble with the glyph of the last used device ("Ⓐ Prendre", "Ⓧ Couper", "Clic gauche Prendre").
- **Mouse (V1 style):** left click on a station: if in reach, interact; otherwise the chef walks there automatically (grid A* on the layout, 0.5 m cells) and interacts on arrival. Hold right click on a board to chop. This gives a full mouse-only way to play.
- Couch co-op: on the title / level intro, each new gamepad joins by pressing A (up to 4, keyboard counts as one player). Each chef has a slot colour (existing `SLOT_COLORS`) and a coloured ring under its feet. The bucket comes from the number of joined players at countdown start.

## 4. Onboarding (no tutorial screens)
- Level intro card for 3 s (skippable with A): "Le Kiosque du Port · Sers un maximum de frites avant la fin du temps !" plus the 3 control glyphs.
- **Guide trail for the first order only:** a bouncing arrow over the next station in the chain (crate → board → fryer → plates → pass), driven by the state of the item closest to completion. Prompt bubbles appear the first 3 times each verb is possible, then only on the targeted station without the arrow. Never block input.
- If a fryer item reaches the burn window, its ring pulses and a small "Vite !" bubble appears the first time.

## 5. HUD and juice
- Top-left: ticket cards (V1 style, with the meal picture rendered from `meals/french_fries.vox`, component icons, timer bar green/yellow/red). New tickets slide in with a pop sound; expiring ones shake in the last 5 s.
- Top-right: big clock (mm:ss, turns red under 30 s with a tick sound each second of the last 10), score with a counting animation, streak badge ("Série ×1.5") that pulses on change.
- Station rings: cooking progress ring above the fryer (green fill, orange pulse, red); chop progress bar above the board.
- Serve: "ding" sound, coins/score number flying from the pass to the score, a short confetti burst of voxel cubes, the customer at the window reacts (a simple voxel customer with a happy hop). Wrong: error buzz, red flash on the plate. Expired: the ticket crumples and falls.
- Audio: reuse the V1 synth port in `audio.ts` (pop, place, chop, fry sizzle loop while the fryer has an item, ding, error). Add light seaside ambience (procedural waves and gulls with WebAudio noise, quiet).
- Pause: Start / Échap opens a small pause menu (Reprendre, Recommencer, Menu).

## 6. The level itself (the diorama is the point)
`layout.json` (gameplay truth, 0.5 m grid), kiosk interior about 7×5 m:
- Back wall side: potato crate (west), 2 counters, cutting board ×1 (+1 optional in squad/party), fryer ×2 (+1 optional), plate stack, bin. Front: the long serving counter with the pass (kiosk window) in the middle. A straight, inviting line crate → board → fryer → plates → pass, walk time ~6 s.
- No walled box: the kiosk is open on the pass side and on one side door. Around it build a voxel diorama with the existing mesher (1/8 m voxels for props): a wooden pier on blue water (animated vertex-wobble water plane with a fresnel tint), the kiosk with a striped awning and a hand-painted sign "Frites du Port", a moored sailboat, crates and rope coils, lamp posts, two or three gulls that hop and fly off, a lighthouse in the distance, soft fog to the horizon. Customers queue at the window (2–3 simple voxel figures; the front one is the one served).
- Lighting: warm sunny afternoon, hemisphere light (sky blue / sand bounce), sun with soft shadows, AO from the mesher, ACES tone mapping. Must read clearly in one second: food and chefs pop from the background.
- Build the props procedurally in code (`render/src/scenes/harbour/*.ts`) or as small .vox files; procedural is fine and faster.

## 7. Tests and tuning
- Unit tests: chop/cook/burn transitions, plating rules (container accepts only components that can lead to an available recipe, `docs/v2/05 §3`), serve matching, scoring and streak, expiry, pacing determinism (same seed → same ticket sequence).
- **Bot test:** a scripted bot that plays the level in the sim (solo and duo) with a near-optimal route, run for the full 180 s, records the score. Use it to set star thresholds and assert a minimum (bot solo ≥ 3★ threshold / 0.75 within rounding). Also assert the state hash after a full bot run is identical across two runs (determinism).
- Visual: Playwright screenshots (deviceScaleFactor 1 for your checks, 2 for the ones you save) of the title, the level intro, mid-service with 2 tickets and the guide arrow, and results. Save to `v2/docs/p2/`. Check no French string overflows at 1280×720 and 390×844.

## 8. Process
- Work on the current branch, small commits with clear messages. Do not push (the lead pushes).
- Run `pnpm check` before you finish. Report: what shipped, bot scores and the chosen star thresholds, screenshots paths, anything cut or deferred, and any known bugs.
