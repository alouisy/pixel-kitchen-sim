# 09 · Technical Architecture

> **Revision note (2026-11-15).** Unchanged overall. The simulation now models discrete items and stations ([05](./05-interactions-and-cooking.md)) instead of voxel food bodies, which makes it lighter. Up to 6 chef slots. The voxel mesher is used for level dioramas and item models.

**Principles** (they extend the existing project preferences: simple, low-cost, maintainable, Netlify-hosted, no account system):

1. **Simulation is pure data.** No game state in Three.js objects (this is V1's main flaw). The renderer *reads* the simulation; it never owns it.
2. **Deterministic core.** Same inputs give the same outputs, bit for bit, in every browser. This enables netcode, replays, run verification and debugging.
3. **Everything is content.** Tools, materials, cravings, Giants and levels are data files with schemas.
4. **Threads by responsibility:** main (render, input, UI, network I/O), a simulation worker, and a mesher worker pool.
5. **The serverless edge stays serverless.** Netlify Functions plus Supabase, as in V1. Real-time play is peer-to-peer, so there is no game server bill.

---

## 1. Stack

| Layer | Choice | Why | Alternative considered |
|---|---|---|---|
| Language | **TypeScript** (strict) | The simulation and protocol need types; there are many contributors | Keep JS: rejected because the protocol and ECS schemas are error-prone without types |
| Build | **Vite** (kept) + pnpm workspaces | V1 already uses Vite; it's fast | |
| Rendering | **Three.js** (upgraded from r160 to current) with `WebGLRenderer` (WebGL2) | Kept from V1. Mature. WebGL2 is everywhere, including iOS Safari. | WebGPU renderer: planned as an opt-in once Safari support is broadly stable; materials are written to make that switch easy |
| ECS | **bitECS** (structure-of-arrays, typed arrays) | Typed arrays make snapshots and serialization trivial and fast | A custom ECS; miniplex (object-based, harder to snapshot) |
| Physics | **Rapier 3D, deterministic build** (WASM) | Cross-platform determinism mode, snapshot and restore, character controller | cannon-es (not deterministic), a custom solution (a big cost) |
| UI | **Preact + @preact/signals** (about 5 KB) | Replaces V1's `innerHTML` UI with components; tiny | Svelte (also good, but a different build), plain DOM (V1's pain) |
| Audio | WebAudio (V1's procedural synth kept) + **Howler-free custom mixer** | See [14-audio-and-music.md](./14-audio-and-music.md) | |
| Networking | **WebRTC DataChannels** (P2P, host-authoritative) + **Supabase Realtime** for signaling and presence | No game servers; Supabase is already in the stack | Colyseus or PartyKit servers (cleaner NAT story, but a running cost). Kept as plan B in [10 §11](./10-multiplayer-and-netcode.md). |
| Voice | WebRTC audio on the same peer connections | [11-voice-and-communication.md](./11-voice-and-communication.md) | |
| Persistence | IndexedDB (progress, cookbook, clips cache), localStorage (settings only) | V1's single localStorage blob doesn't scale to clips and the cookbook | |
| Backend | **Netlify Functions + Supabase Postgres** (kept), Supabase Storage or Cloudflare R2 for clips | The V1 pattern: secret key on the server, RLS on | |
| Testing | Vitest (simulation, content), Playwright (determinism across Chromium, Firefox and WebKit, run in CI only) | Determinism *must* be checked automatically. Manual play testing stays with the project owner. | |

## 2. Repository layout (V1 and V2 coexisting)

```
/                         ← unchanged V1 during V2 development (deployed as today)
/v2/
  package.json            ← pnpm workspace root for V2
  apps/
    client/               ← the game app (Vite): boot, routing, screens, wiring
  packages/
    sim/                  ← PURE deterministic simulation: ECS, systems, voxel food, terrain, director
                            (no DOM, no Three.js, no Math.random, no Date)
    content/              ← JSON schemas, content data, the validator, generated TS types
    net/                  ← protocol, codecs, transport (WebRTC + signaling), sync logic
    render/               ← Three.js scene, voxel meshing, materials, VFX, cameras
    voice/                ← mic capture, peer audio, VAD, filters, mouth-flap analyser
    ui/                   ← Preact components, design tokens (ported from V1 style.css)
    audio/                ← mixer, SFX, adaptive music
    shared/               ← math (fixed-point helpers), PRNG, ids, logging
  functions/              ← Netlify Functions for V2 (the V1 ones keep working at the root)
  tools/                  ← v1-to-vox, import-level, build-assets, replay-verify CLI
  content-src/            ← .vox sources, level block-outs
```

**At public beta:** V1 moves to `/classic` (path-based on the same Netlify site via redirects), and `/v2` becomes the root app. Until then the V2 preview deploys on a Netlify branch deploy.

## 3. Runtime threads

```
┌──────────────────────── MAIN THREAD ────────────────────────┐
│ Input ▶ InputFrame ─────────────┐                            │
│ Net I/O (RTCPeerConnection) ◀───┼──▶ MessagePort ◀──────┐    │
│ Render (Three.js) ◀── RenderState (SharedArrayBuffer*) ─┤    │
│ UI (Preact) ◀── signals ◀── SimEvents ──────────────────┤    │
│ Audio, Voice                                            │    │
└─────────────────────────────────────────────────────────┼────┘
┌──────────────── SIM WORKER ─────────────────────┐       │
│ fixed 30 Hz tick: inputs → systems → events      │◀──────┘
│ Rapier (WASM), voxel food, terrain edits, director│
│ host: authoritative; client: prediction + reconcile│
└──────────────────────┬──────────────────────────┘
                       │ dirty voxel volumes
┌──────────────────────▼──────────────────────────┐
│ MESHER POOL (2–4 workers): greedy mesh + AO      │──▶ transferable buffers ▶ main
└─────────────────────────────────────────────────┘
```

\* **SharedArrayBuffer** needs cross-origin isolation (`COOP: same-origin`, `COEP: require-corp`) set in `netlify.toml` headers. If isolation isn't available (some embeds, such as a Discord Activity, may restrict it), fall back to transferring a compact RenderState via `postMessage` every tick (about 20–60 KB per tick, which is fine).

**Why the network lives on the main thread:** `RTCPeerConnection` isn't available in workers. Packets are forwarded to the sim worker through a `MessagePort`, which adds under 1 ms.

## 4. Simulation core (`packages/sim`)

### 4.1 Tick
- A **fixed 30 Hz** simulation (33.3 ms). Rendering interpolates between the last two states. Heat diffusion runs every 3rd tick (10 Hz).
- Tick order (deterministic, as written):
  ```
  1. applyInputs(tick)          // InputFrame per chef
  2. intentResolution           // grab / place / tool targets (soft targeting, 04 §4)
  3. toolSystem                 // cuts, heat sources, carve ops → emits VoxelOps
  4. voxelOpApply               // terrain + FoodBody edits (ordered by (tick, chefSlot, seq))
  5. physicsStep (Rapier)       // bodies, character controllers
  6. heatSystem (every 3rd)     // diffusion, doneness, char, fire
  7. structuralSystem           // terrain detach checks around this tick's edits
  8. stationSystem              // ovens, oil pots, plates, compost
  9. giantSystem                // belly, mood, cravings, hazards (seeded)
 10. critterSystem              // orders (V1's pacer), helpers
 11. directorSystem             // intensity, set pieces, Big Bite
 12. scoringSystem              // DishServed → score
 13. eventFlush                 // SimEvents → main thread
  ```

### 4.2 Determinism rules (enforced by lint rules plus a CI test)
- No `Math.random`, `Date`, `performance.now` or `Math.sin/cos/exp/pow` inside `packages/sim`. Use `shared/prng` (xoshiro128\*\*, seeded per service and split per system) and `shared/fmath` (lookup tables and polynomial approximations).
- Voxel food and terrain values are integers (see [05 §4.2](./05-interactions-and-cooking.md)).
- Floating point is allowed only in Rapier (deterministic build) and in transforms, where basic IEEE-754 ops (`+ − × ÷ sqrt`) are deterministic across engines.
- Iterate entities in **entity-id order**, never `Map`/`Set` insertion order across peers.
- **State hash:** every 30 ticks, a 64-bit hash of (ECS component arrays + voxel version counters + a sampled-cell hash + the Rapier snapshot hash). It's used by netcode desync detection and CI.

### 4.3 State and serialization
- `WorldState = { ecs: bitECS SoA buffers, foodBodies: Map<id, FoodBody>, terrain: ChunkStore, rapier: Uint8Array snapshot, prng: state, director: state }`.
- **Full snapshot** (for join-in-progress and host migration): typically 300–900 KB uncompressed, 60–200 KB after zstd (WASM) or `CompressionStream('gzip')`.
- **Replay** = initial seed + level id + content hash + the ordered `InputFrame` log + host-authoritative event confirmations. It's about 15 KB per minute for 2 players.

## 5. Voxel world (`sim` + `render`)

### 5.1 Terrain store
- Chunks of 32³ cells, material `u8`. **Palette-compressed** per chunk (1, 2, 4 or 8 bits per cell depending on the number of distinct materials) plus an RLE on serialization.
- Edits are **VoxelOps** (`{ kind: carve|fill|melt|grow, shape: sphere|box|plane, params, material, seed }`), applied identically on every peer, so the network sends ops, not voxels.
- Each chunk has a `version`. A mesher job is dispatched when the version changes (coalesced per frame).

### 5.2 Meshing
- **Greedy meshing with per-vertex AO** (the standard 3-neighbor corner rule). Quads are merged only when material, AO and doneness band are equal.
- **Vertex format** (16 bytes): position (3 × u8 local + chunk offset uniform), normal index (u8), material id (u8), AO (2 bits), doneness and char (u8 each, food only), coat id (u8).
- The shader looks up material ramps in a **palette texture** (256 materials × 12 shades), so a single material and a single shader serve all voxel geometry. This fixes V1's material-per-mesh problem.
- Food bodies under 4,096 cells re-mesh in under 0.5 ms. Terrain chunks re-mesh in under 3 ms.

### 5.3 Collision
- Terrain collision is built per chunk as a Rapier **compound of merged boxes** (greedy box decomposition from the same mesher pass), rebuilt on version change.
- Food bodies use **convex hull approximation** for under 512 cells and box compounds above.

## 6. Rendering (`packages/render`)

- One `WebGLRenderer`, the post-processing chain from [07 §3.2](./07-art-direction.md), and a frame graph kept small (forward rendering plus a few fullscreen passes).
- **Instancing:** props, particles, critters and repeated stations use `InstancedMesh`.
- **Quality tiers** (auto-detected by a 2 s GPU benchmark at boot, overridable): *Low* (mobile), *Medium*, *High*, *Ultra*. Tiers change shadow cascades, post effects, particle budgets, render scale (V1's resolution setting logic is ported) and the FPS cap (V1's 30/60/unlimited options are kept).
- **Render state interpolation:** transforms are lerped/slerped between sim ticks using `alpha = accumulator / tickDuration`.

## 7. Input

- An **action map** (data-driven bindings) produces an `InputFrame` per tick:
  ```ts
  interface InputFrame { tick: u32; move: [i8, i8]; aim: [i16, i16, i16] /* world point, quantized */;
                         buttons: u16 /* bitfield */; analog: { tool: u8 }; seq: u16 }
  ```
- Devices: keyboard and mouse, gamepad (the V1 deadzone code is ported), touch (the V1 virtual joysticks are ported). Several local gamepads map to local chef slots for couch play.

## 8. Application shell and UI

- **Routes:** `/` (title or lobby), `/k/:roomCode` (join link), `/daily`, `/clip/:id` (a shared clip page, which can also render without the game bundle), `/classic`.
- **Screens:** Lobby, Map (chapter select), Pre-Service, In-Service HUD, Results, Cookbook, Wardrobe, Settings, Photo Mode.
- The UI talks to the game only through **signals** (reading) and **commands** (writing), never by touching the simulation.
- **i18n:** `locales/{en,fr,es}.json` (V1 strings migrated), ICU MessageFormat, with a CI check for missing keys and an overflow screenshot test per language.

## 9. Backend (Netlify + Supabase)

| Function | Purpose | Notes |
|---|---|---|
| `POST /api/runs` | Submit a finished run (score, replay blob hash, crew) | Plausibility checks inline; queued for verification |
| `bg: verify-run` (a Netlify Background Function, up to 15 min) | Re-simulate the replay headless with `packages/sim` and compare the final hash and score | Only for top-100 and Daily Feast entries ([10 §9](./10-multiplayer-and-netcode.md)) |
| `GET /api/leaderboards` | Per-level, daily, crew boards | **SQL aggregation** (fixes the V1 2,000-row limit) |
| `POST /api/crews`, `GET /api/crews/:code` | Crew identity (code-based, no accounts) | |
| `POST /api/clips` | Upload a published clip (≤ 6 MB) and metadata, return a share id | Optional storage; local export always works without it |
| `GET /clip/:id` (an Edge Function) | An HTML page with Open Graph and Twitter card meta and a video embed | Link previews on X and others |
| `GET /api/og/:id.png` | A dynamic share image (satori + resvg-wasm) | Cached at the CDN |
| `GET /api/turn` | Short-lived TURN credentials | Rate-limited per token |
| `keep-alive` | Kept from V1 | |

**Supabase Realtime** carries lobby presence and WebRTC signaling messages on channels named `room:<code>`. No game traffic goes through it.

**Schema additions** (to `supabase/schema.sql`): `crews`, `crew_members`, `runs` (+ `verified` and `verification_hash`), `daily_feasts`, `clips`, `friend_codes`, `reports`, plus telemetry `events` (opt-out, no PII).

## 10. Performance targets

| Target | Desktop (2019 mid-range laptop, integrated GPU) | Mobile (2021 mid-range Android, iPhone 11) |
|---|---|---|
| Frame rate | 60 fps (High) | 30 fps locked (Low or Medium), 60 on capable devices |
| Sim tick | ≤ 4 ms in a worker | ≤ 7 ms |
| Main thread frame | ≤ 10 ms | ≤ 20 ms |
| Memory | ≤ 600 MB | ≤ 350 MB |
| Initial download (to lobby) | ≤ 2.5 MB gz (code + core assets), streaming the rest | same |
| Level load | ≤ 3 s after download | ≤ 5 s |
| Time to kitchen from link | < 20 s at p75 | < 25 s |

**Code splitting:** the lobby bundle (UI, net, voice, a minimal renderer for chef previews) loads first. Sim, Rapier WASM and the level stream in while players pick hats. That's how the 20-second target is reached.

## 11. Security, privacy and abuse

- Identity stays V1-style: a random device token and a nickname. Crew codes and friend codes are shareable identifiers (see [13](./13-social-and-virality.md)). **No accounts, no OAuth, no emails.**
- Tokens are sent only in headers or bodies, never in query strings (fixes V1 finding H5).
- Rate limiting per token and IP on every function (a Supabase table with a sliding window, or Netlify's rate-limit config).
- Nickname and crew-name filter (a word list in EN/FR/ES plus leetspeak normalization). Clip titles come from the generator, not from free text.
- No microphone audio ever leaves peer-to-peer connections. Clips include voice only if every crew member has opted in ([11 §8](./11-voice-and-communication.md)).

## 12. Observability

- Opt-out telemetry events: `service_start`, `service_end`, `share_export`, `invite_sent`, `invite_join`, `desync`, `disconnect`, `perf_sample` (fps p50/p5, sim ms, quality tier). Each event carries an anonymous session id only.
- Client error reporting via `window.onerror` to a Netlify function that stores the last 1,000 errors.
- A **`?debug=1` overlay**: sim tick time, net RTT, packet loss, snapshot size, desync hash timeline, voxel counts.
