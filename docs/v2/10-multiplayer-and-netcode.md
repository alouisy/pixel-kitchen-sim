# 10 · Multiplayer and Network Synchronization

**Model:** peer-to-peer WebRTC, **host-authoritative** (the room creator's browser runs the authoritative simulation), with **client-side prediction for your own chef**, **interpolation for everything else**, and **deterministic replication of voxel operations**. Signaling and presence go through Supabase Realtime. There's no game server to pay for.

Targets: 2 players (reference), up to 4. Playable up to 150 ms RTT and 3% packet loss. "Feels local" under 80 ms RTT.

---

## 1. Topology

```
            Supabase Realtime (signaling, presence, lobby state)
                 ▲            ▲            ▲
                 │ SDP/ICE    │            │
        ┌────────┴───┐   ┌────┴─────┐  ┌───┴──────┐
        │  HOST      │◀─▶│ CLIENT B │  │ CLIENT C │
        │ (authority)│◀──┼──────────┼─▶│          │
        └─────┬──────┘   └──────────┘  └──────────┘
              │  star topology for game data (host ↔ each client)
              │  mesh topology for voice (everyone ↔ everyone, ≤ 4)
        TURN relay (fallback for about 10–15% of pairs behind strict NAT)
```

- **Game data: a star.** The host talks to each client. Clients never talk game data to each other.
- **Voice: a full mesh.** With at most 4 peers that's 6 links, fine for Opus at 24–32 kbps.
- **Couch plus online:** one browser can host 2 local chefs *and* online friends. Local chefs are simply extra input slots on that peer.

## 2. Session lifecycle

```
CREATE ROOM ──▶ LOBBY ──▶ PRE-SERVICE ──▶ SERVICE ──▶ RESULTS ──▶ (LOBBY | next SERVICE)
     │            │  join by link/code      load + sync    play         share
     └─ room code (5 chars) + link /k/K7QPX
```

1. **Create:** the host calls `POST /api/rooms`, which returns `{ roomCode, channelJwt }`. The code alphabet avoids ambiguous characters (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`), and codes expire after 2 h without presence.
2. **Join:** opening `/k/K7QPX` calls `GET /api/rooms/K7QPX/join`, which returns `{ channelJwt }`. The client then subscribes to `room:K7QPX` and announces presence `{ token-hash, nickname, hat, slot? }`.
3. **Connect:** the host and joiner exchange SDP and ICE through the channel. The data channels and the audio track come up. Typically 1.5–4 s.
4. **Lobby:** a shared 3D lobby scene (the Kitchen Lobby) where chefs walk around, try hats and talk. Lobby state (selected level, tools, difficulty, ready flags) is host-authoritative and replicated as reliable messages.
5. **Pre-service:** the host sends `ServiceStart { levelId, contentHash, seed, difficulty, mutators, slots }`. Everyone loads. A barrier waits until all peers report `Loaded` (timeout 30 s, then start without them; they join as reconnecting).
6. **Service:** the simulation runs (§4).
7. **Results:** the host sends `ServiceEnd { results, replayHash }`. Each peer submits its run record ([§9](#9-run-verification-and-leaderboards)).

> **About Supabase keys.** V1's rule is "the browser never receives a Supabase key". Realtime needs a client connection, so V2 refines the rule: the browser gets the project's **publishable (anon) key**, which is public by design, plus a **short-lived JWT signed by a Netlify Function** whose claims are limited to one room (`room: K7QPX`, 2 h expiry). Realtime Authorization policies on `realtime.messages` allow only private channels that match the claim. Database tables still have **no** anon policies, so every table read and write keeps going through Functions with the secret key, as in V1. If that refinement isn't acceptable, the fallback is the WebSocket relay of §11, which then also carries signaling.

## 3. Channels

| Channel | WebRTC config | Content |
|---|---|---|
| `ctrl` | reliable, ordered | Lobby, service start and end, intents results, VoxelOps, DishServed and other sim events, chat, pings |
| `state` | unreliable, unordered (`maxRetransmits: 0`) | Snapshots (host → client), inputs (client → host) |
| `bulk` | reliable, ordered, low priority | Full snapshots for join and reconnect, chunk diffs, clip thumbnails |
| audio track | Opus | Voice ([11](./11-voice-and-communication.md)) |

Messages are **binary**, encoded with a small schema-driven codec (`packages/net/codec`): varints, quantized floats and bit-packed flags. There is no JSON on hot paths.

## 4. Simulation sync

### 4.1 Clocks and ticks
- The host's sim tick is authoritative at **30 Hz**.
- Clients keep an estimate of the host tick using NTP-style ping samples (an RTT filter over the last 16 samples, discarding the top 25%).
- **Input lead:** clients stamp inputs with `hostTick + ceil(RTT/2 / 33 ms) + 1`, so inputs arrive just in time.
- **Interpolation delay** for remote entities: `100 ms` by default, adaptive between 66 and 200 ms based on jitter.

### 4.2 Inputs (client → host)
- An `InputFrame` (about 10 bytes, [09 §7](./09-technical-architecture.md)) per tick. Each packet carries the **last 4 frames** for redundancy against loss (about 40 bytes × 30 Hz ≈ 1.2 KB/s).
- The host buffers inputs per chef. Missing input for a tick means **repeat the last input** (movement only; button edges aren't repeated).

### 4.3 Snapshots (host → client)
- **Rate:** 20 Hz (every 1.5 ticks, alternating 1 and 2 ticks). It goes up to 30 Hz when RTT is under 40 ms and bandwidth allows.
- **Content:** delta-compressed against the client's last **acknowledged** snapshot (the ack piggybacks on input packets).
  - Chefs: position (quantized to 1 cm), yaw (u8), velocity (i8 ×3), status, held item id, tool state.
  - Dynamic FoodBodies and props: id, position (1 cm), rotation (smallest-three, 10 bits per component), sleeping flag. Only bodies that changed beyond a threshold are sent.
  - Giant: pose state id, phase, look target, belly, mood (u8 each).
  - Director and craving state: id and timers (only when they change, otherwise skipped).
- **Interest management:** bodies over 30 m from the client's chef *and* off-camera are sent at 5 Hz. Sleeping bodies aren't sent.
- **Typical size:** 300–900 bytes, so **8–18 KB/s per client** down (64–144 kbps).

### 4.4 Your own chef: prediction and reconciliation
- The client runs a **local Rapier character controller** for its own chef against a local copy of the static world plus the latest snapshot of dynamic colliders.
- It keeps a ring buffer of `(tick, input, predictedState)`.
- When a snapshot with the server state for your chef at tick `t` arrives: compare. If the error exceeds 5 cm, rewind to the server state and **replay the unacknowledged inputs**. The visual error is smoothed over 100 ms (an exponential blend of the render offset) to avoid snapping.

### 4.5 Interactions: optimistic and authoritative
Interactions are **intents** that the host resolves:

```
client: Intent { seq, tick, kind: GRAB, targetId }
host:   IntentResult { seq, ok, reason?, resultingState }
```

| Intent | Client prediction | On deny |
|---|---|---|
| Grab | The item is attached to your hands right away | A **"fumble"** animation: the item pops out of your hands back to where the host has it. It's a funny, diegetic disguise for a misprediction. |
| Place or add to dish | Shown placed immediately | The item jumps back into your hands with a "nope" wiggle |
| Throw | Throw arc shown locally. The item's flight is host-simulated, and the client blends to it within 100 ms. | Rare |
| Tool (cut) | The **anticipation pose plays** (blade raise, 3 frames ≈ 100 ms). The actual cut appears when the host's `VoxelOp` arrives. | — |
| Tool (heat, freeze) | Flame and frost VFX show instantly. Voxel heat effects come from host-replicated sources (§4.6). | — |
| Ring the Feast Bell | Local press animation. A tandem needs host confirmation. | |

**Contested grabs** (both chefs grab the same item in the same window): the host decides by input tick, then slot order. The loser gets the fumble animation. It's never frustrating because it's visibly funny.

### 4.6 Voxel replication (the key trick)
Voxels are **never streamed in bulk during play**. Instead:

1. The host's tool system emits **VoxelOps** (`carve`, `slice`, `melt`, `grow`, `fill`), each `{ opId, tick, targetId, shape params (integers), seed }`, typically 12–24 bytes.
2. VoxelOps go over the **reliable `ctrl` channel**, and every peer applies them **in `opId` order** to its local copy. Because the voxel code is deterministic and integer-based, every peer gets identical voxels.
3. **Heat:** heat *sources* are replicated (`HeatSource { bodyId, kind, power, startTick, endTick }` plus Torch aim points sampled at 10 Hz). Every peer runs the same deterministic diffusion. The host sends **per-body hashes** of `(doneness, char)` once a second for awake bodies.
4. **Desync repair:** if a client's body hash differs, it requests `BodyState { id }` and receives the compressed FoodBody (0.3–4 KB) over `bulk`. Terrain chunks have the same mechanism with chunk hashes (every 5 s, only for chunks edited in the last 30 s).

A cut costs about 20 bytes on the network instead of about 2 KB of voxel data. A whole service usually replicates under 100 KB of VoxelOps.

### 4.7 Events
Sim events (DishServed, CravingStart, HazardTelegraph, BigBiteStart, CritterOrder…) are reliable messages tagged with a tick. Clients schedule their presentation at `tick + interpolationDelay`, so the sound, VFX and animation line up with the interpolated world.

## 5. Bandwidth budget (2 players)

| Flow | Down (client) | Up (client) |
|---|---|---|
| Snapshots | 8–18 KB/s | — |
| Inputs and acks | — | 1.2 KB/s |
| ctrl (ops, events, intents) | 0.5–2 KB/s | 0.3 KB/s |
| Voice (Opus 32 kbps) | 4 KB/s per peer | 4 KB/s per peer |
| **Total** | **~15–25 KB/s** | **~6 KB/s** |

**Host uplink with 3 clients:** about 3 × 20 = 60 KB/s ≈ 0.5 Mbps. Any home connection handles this. Mobile hosting is allowed but the UI suggests a desktop host when one is available (the "Best host" auto-pick, §7).

## 6. NAT traversal

- STUN: public STUN servers plus the TURN provider's STUN.
- **TURN:** a managed provider (for example Cloudflare's TURN service or Metered). Short-lived credentials come from `GET /api/turn`, rate-limited per token. Expect about 10–15% of sessions to relay. **Check current provider pricing before launch.** At 25 KB/s per relayed client, a 6-minute service is about 9 MB per relayed player.
- ICE restarts on network change (Wi-Fi ↔ 4G) are handled automatically, with a 5 s grace period before declaring a disconnect.

## 7. Host selection and migration

- **Default host:** the room creator.
- **Best host:** before the service starts, peers exchange a small capability report (device class, a CPU benchmark score, measured RTTs). If another peer is clearly better (a desktop vs the creator's phone), the lobby proposes "Let Sam host this service?" and the switch happens automatically between services (it's free then).
- **Mid-service migration (V2.0):** the host sends a compressed **backup snapshot** every 10 s to the designated backup peer (about 60–200 KB, ≈ 10–20 KB/s averaged). If the host drops:
  1. Peers detect it (no packets for 3 s, plus Realtime presence leave).
  2. The backup peer promotes itself, restores the snapshot, and re-establishes the star with the remaining peers. The game rewinds up to 10 s, shown as a short "Kitchen rewind!" visual with a VHS effect, so it reads as a feature, not a bug.
  3. If no backup is available (a 2-player game where the host left), the remaining player continues **solo** from the backup snapshot, with solo tuning.

## 8. Disconnects, reconnects and joining in progress

- A **disconnected client's** chef freezes as a sleeping statue (non-colliding for others after 5 s). Their held item drops.
- **Reconnect** within 2 minutes using the same token: the client gets a full snapshot over `bulk` (60–200 KB), fast-forwards, and takes control again.
- **New players joining mid-service:** not in V2.0 (they wait in the lobby, with a "spectate" view through snapshots). V2.1 allows joining with a full snapshot plus a scaling change.
- **Tuning switch:** when the active player count changes, the director re-applies the scaling table ([03 §8](./03-game-design.md)) over 5 s.

## 9. Run verification and leaderboards

The host is a player's browser, so **the host could cheat**. That matters only for leaderboards. Defense in depth:

1. **Plausibility (inline, every run):** the score is within level bounds, the duration matches, there are no impossible event rates, and the run's content hash matches the deployed content.
2. **Dual attestation:** *every* peer submits its own run record: `{ runId, myInputLogHash, observedEventLogHash, finalStateHash }`. The server checks that all peers agree on the event log and state hashes. A mismatch, or a single-peer submission for a multiplayer run, means "unverified" (still saved, just not ranked).
3. **Re-simulation (async, top entries only):** for the top 100 per board and every Daily Feast entry, the host uploads the full replay (about 15 KB per minute). A Netlify **Background Function** re-runs `packages/sim` headless in Node with the same seed, content and inputs, and checks the final hash. If they match, the run is ✓ Verified.
4. Boards show ✓ Verified, an assist icon and difficulty. The default view is Verified only.

This also fixes V1's trusted-client leaderboard (finding H4).

## 10. Testing the netcode

- A **network conditioner** built into the client (`?net=lag120,loss3,jitter30`) that wraps the data channels.
- A **headless bot clients** CLI (`tools/netbot`) that connect to a room and replay recorded inputs, for soak tests (100 services per night in CI).
- **Desync dashboards:** every desync event uploads the tick, the hash timeline and the last 300 ticks of inputs (opt-out telemetry), with replay-to-repro tooling.
- **Acceptance gates** for beta: ≥ 98% of services complete without an unrecovered desync; median reconcile error under 2 cm; a misprediction fumble rate under 1 per 5 minutes at 100 ms RTT.

## 11. Plan B: an authoritative relay server

If P2P proves unreliable in the wild (too many TURN failures, or mobile hosts struggling), the protocol supports swapping the transport for a **WebSocket relay or authoritative server** without changing the game:
- `packages/net` abstracts `Transport` (WebRTC P2P | WebSocket relay).
- The sim runs headless in Node already (for verification), so an authoritative server is the same code on a small VPS, or a room-based provider (Cloudflare Durable Objects, PartyKit or Colyseus).
- Rough cost at small scale: one small VPS (about €5–10/month) handles 50–100 concurrent services, since the simulation runs only for active rooms.

## 12. Matchmaking (later)

- **V2.0:** friends only (links, codes, crew invites).
- **V2.1, "Open Kitchens":** a public room list via Realtime presence (`lobby:public`), filtered by language and region (rough, from the timezone), with **voice off by default with strangers** and a quick-chat-only option.
- Food Fight versus uses the same rooms. There is no ranked matchmaking in scope.
