# 06 · Multiplayer (online co-op, couch mix, netcode)

> **Summary.** Up to 6 chefs online over WebRTC data channels in a star around the host, plus up to 4 local chefs per browser. Netcode model: **host-sequenced deterministic lockstep** (the host decides, per tick, the one confirmed input set; every peer runs the same `RushSim` on that stream, and nobody ever waits for a slow peer except that peer itself). Signaling goes through Supabase Realtime, rooms use 4-letter codes (`/r/ABCD`), desyncs are caught by the sim state hash once per second and healed by replaying the input log.
> Everything here is new work. Today the repo has only the single-player rush worker (`v2/packages/sim/src/worker.ts`) and no network code. Names follow [01](./01-architecture.md) and [02](./02-simulation.md): `RunConfig`, `RunLog`, `RunResult`, `SIM_VERSION`, `contentHash`, `RushInput` (5 bytes), the worker messages of 01 §8.1, `@ga/records`, `verifyRun`, `.pkr` (`PKR1`).

## Table of contents
1. [Netcode decision](#1-netcode-decision)
2. [Constants](#2-constants)
3. [Package layout and boundaries](#3-package-layout-and-boundaries)
4. [Rooms, codes, invite links](#4-rooms-codes-invite-links)
5. [Signaling over Supabase Realtime](#5-signaling-over-supabase-realtime)
6. [STUN, TURN and the relay fallback](#6-stun-turn-and-the-relay-fallback)
7. [Topology and channels](#7-topology-and-channels)
8. [Wire types and encodings](#8-wire-types-and-encodings)
9. [Lockstep core: sequencer, playout buffer, tick sync](#9-lockstep-core-sequencer-playout-buffer-tick-sync)
10. [Sim worker integration](#10-sim-worker-integration)
11. [Lobby flow](#11-lobby-flow)
12. [Join, leave, late join, reconnect, host leaves](#12-join-leave-late-join-reconnect-host-leaves)
13. [Mixed couch and online players](#13-mixed-couch-and-online-players)
14. [Desync detection and recovery](#14-desync-detection-and-recovery)
15. [Run end and record submission hand-off](#15-run-end-and-record-submission-hand-off)
16. [Voice chat (separate phase)](#16-voice-chat-separate-phase)
17. [Network testing](#17-network-testing)
18. [Implementation order](#18-implementation-order)
19. [Current state vs target](#19-current-state-vs-target)
20. [Acceptance criteria](#20-acceptance-criteria)

---

## 1. Netcode decision

**Chosen: host-sequenced deterministic lockstep ("confirmed-frame stream").** Not rollback, not state sync.

Justification (10 lines):
1. `RushSim` is already deterministic (xoshiro PRNG, no `Math.random`, `stateHash()` exists). A deterministic sim makes input replication far cheaper and simpler than state replication.
2. State sync + prediction needs a per-tick state stream plus a rollback re-sim of the local chef. 02 §17.3 provides `snapshot()/restore()` (JSON, tens of KB), which is fine for occasional catch-up but too heavy to stream at 20 Hz. Lockstep streams only inputs and uses snapshots rarely.
3. The same input log is the replay file for server verification ([07 §6](./07-backend-and-records.md#6-run-submission-and-server-re-verification)). One input codec (`encodeRushInput`, 02 §4.4), one test suite.
4. Classic lockstep stalls everyone when one peer is slow. Here the **host sequences**: it builds tick N from whatever inputs have arrived, repeats a chef's last input if nothing arrived, and **never waits**. A lagging peer only delays itself (its inputs apply late, its screen buffers).
5. No fixed "input delay" is added on top of the network: client input is applied when it reaches the host. Latency felt by a client chef = RTT + playout buffer (about 3 ticks). On 40 ms RTT that is about 180 ms, acceptable for a cooking game with no aiming. The host's own chefs have about 1 tick latency.
6. Late join, reconnect and host migration use **snapshot + log tail** (`RushSim.snapshot()/restore()`, 02 §17.3, then re-simulate the few frames since). **Fallback and desync repair: replay the whole input log** from tick 0 (about 5,500 ticks, well under 2 s). Both paths are deterministic.
7. Bandwidth is tiny: about 2.5 KB/s per client down, 1 KB/s up. Host uplink with 5 clients is about 12 KB/s.
8. The cost: the sim must stay bit-exact on every browser (rules in [01](./01-architecture.md) and [02](./02-simulation.md)). The hash check in §14 makes violations visible within 1 s.
9. Rejected alternative A: lockstep with fixed input delay and all-peer waiting. One bad connection freezes 5 players. Rejected.
10. Rejected alternative B: host-authoritative state sync + client prediction. Better local-chef feel, but needs per-tick snapshots, rollback and float-state reconciliation, which costs more than the rest of this doc and fits a cooking game worse.

**Authority:** the host owns *ordering* only. All peers (host included) run the identical sim; the host's hash is the reference in a dispute.

---

## 2. Constants

Put in `v2/packages/net/src/constants.ts`. All `Default (tunable)` unless stated.

```ts
export const NET_CONST = {
  PROTOCOL_VERSION: 1,           // bump on any wire change; mismatched peers are rejected
  MAX_CHEFS: 6,                  // total chefs in a room (all peers, all local players)
  MAX_LOCAL_PER_PEER: 4,
  MAX_PEERS: 6,                  // a peer owns >= 1 chef
  SIM_HZ: 30,                    // same as @ga/shared SIM_HZ
  TICK_MS: 1000 / 30,
  INPUT_SEND_REDUNDANCY: 4,      // samples per InputBatch (last 4 ticks)
  FRAMES_MAX_PER_PACKET: 24,
  HOST_QUEUE_MAX: 3,             // per-chef input queue depth before merge/drop
  PLAYOUT_DEFAULT_TICKS: 3,      // B, the jitter buffer target
  PLAYOUT_MIN_TICKS: 2,
  PLAYOUT_MAX_TICKS: 10,
  PING_INTERVAL_MS: 500,
  HASH_EVERY_TICKS: 30,          // 1 report per second
  HASH_RING: 600,                // host keeps this many own hashes
  SNAPSHOT_EVERY_TICKS: 150,     // each peer keeps a rolling snapshot every 5 s (migration), last 2 kept
  SNAPSHOT_KEEP: 2,
  STALL_BANNER_MS: 500,          // show "waiting for network" after this long without frames
  PEER_TIMEOUT_MS: 3000,         // no sim-channel packet for this long = peer considered gone
  RECONNECT_GRACE_MS: 120_000,
  LOAD_BARRIER_MS: 20_000,
  CODE_TTL_MS: 2 * 60 * 60 * 1000,
  ROOM_FULL_CODE_ALPHABET: 'ABCDEFGHJKLMNPQRSTUVWXYZ', // 24 letters, no I, no O
  CODE_LENGTH: 4,
  CHAT_MAX_CHARS: 140,
} as const;
```

---

## 3. Package layout and boundaries

New workspace package `@ga/net` at `v2/packages/net/` (add to `pnpm-workspace.yaml` implicitly via `packages/*`; add path to `tsconfig.json` references).

```
v2/packages/net/
  package.json            name @ga/net, exports "." -> ./src/index.ts
  src/
    index.ts
    constants.ts          NET_CONST (§2)
    protocol.ts           all wire TS types (§8)
    codec.ts              binary + JSON encode/decode (§8); local 5-byte RushInput read/write (identical layout to 02 §4.4)
    transport.ts          Transport interface + MemoryTransport
    simnet.ts             SimulatedNetwork (latency/jitter/loss) (§17)
    signaling.ts          Signaling interface + SupabaseSignaling + LocalSignaling (§5)
    webrtc.ts             WebRtcTransport (RTCPeerConnection, 2 data channels)
    inputQueue.ts         HostInputQueue (§9.2)
    sequencer.ts          HostSequencer (§9.3)
    playout.ts            PlayoutBuffer (§9.4)
    log.ts                ConfirmedLog + frame-body RLE for log transfer (§9.5)
    hashcheck.ts          HashChecker (§14)
    room.ts               RoomState reducer, lobby logic (§11)
    session.ts            HostSession and ClientSession: glue (§12)
    voice.ts              phase V only (§16)
  test/                   vitest, uses MemoryTransport + SimulatedNetwork
```

Allowed imports (01 §3 matrix): `@ga/net` may import `@ga/shared`, and **types only** from `@ga/sim` (`RushInput`, `RunConfig`, `RunResult`) and `@ga/content` (`BucketId`). It must **not** import `@ga/records`, `three`, DOM render code or `bitecs`. So `codec.ts` has its own 5-byte `RushInput` reader/writer with exactly the layout of 02 §4.4 (`wire.test.ts`, a test file, imports `encodeRushInput` from `@ga/sim` and asserts byte equality), and `log.ts` has its own per-slot RLE with exactly the body layout of the `.pkr` file in 02 §4.6 (the test asserts equality with the `@ga/records` body). `webrtc.ts`, `signaling.ts` (Supabase part) and `voice.ts` use browser APIs; the rest is pure TS and runs under Node in vitest.

The replay file (`.pkr`), `verifyRun` and `SIM_VERSION` checks live in `@ga/records` and `@ga/sim`; the client (which may import everything) builds the `.pkr` from the `RunLog` it gets with `rush-log-request` ([07 §6](./07-backend-and-records.md#6-run-submission-and-server-re-verification)).

Client glue lives in `v2/apps/client/src/net/` (screens call `HostSession`/`ClientSession`; see [05](./05-client-ui-input-audio.md)).

---

## 4. Rooms, codes, invite links

### 4.1 Room code
- 4 letters from `ABCDEFGHJKLMNPQRSTUVWXYZ` (24 letters, I and O removed): 331,776 codes. Case-insensitive on input, stored upper-case.
- A small blocklist of unwanted 4-letter words lives in `v2/netlify/functions/_shared/codes.ts` (`BLOCKED_CODES: Set<string>`); a generated code in the set is regenerated.
- The server generates the code (`POST /api/rooms`, [07 §3](./07-backend-and-records.md#3-netlify-functions)). It retries up to 8 times on a collision with a live room.
- A code is live while `now < expires_at`. `expires_at` = creation + 2 h, extended by heartbeat (`POST /api/rooms/:code/heartbeat` every 60 s from the host) to at most 12 h.

### 4.2 Links
| URL | Behaviour |
|---|---|
| `https://<domain>/r/ABCD` | Invite link. Client router (`/r/:code`) opens the **Join screen** with the code prefilled and starts the join flow (§12.1) immediately after the nickname is confirmed (nickname is already known for returning players, so it is instant). |
| `https://<domain>/?room=ABCD` | Same as above (fallback for hosts that strip paths). |
| Manual | "Join room" button on the title screen with a 4-letter input. |

- The Netlify site needs a SPA fallback: in `v2/netlify.toml` add `[[redirects]] from = "/r/*" to = "/index.html" status = 200`.
- Invite button: `navigator.share({ title, text, url })` where available, else copy to clipboard and toast the string `strings.net.inviteCopied`.
- Invalid or expired code: the join screen shows `strings.net.roomNotFound` and a "Create your own room" button.
- Room full (total chefs would exceed 6): `strings.net.roomFull` plus a "Watch" button (spectator, §12.5).

### 4.3 Room record (server, tiny)
The server only knows `{ code, host_player_id, created_at, expires_at, status }`. All live room state (roster, level, ready) is in the host's browser ([07 §2](./07-backend-and-records.md#2-supabase-schema) `v2_rooms`).

---

## 5. Signaling over Supabase Realtime

### 5.1 Auth model
- The browser holds the project's **publishable (anon) key** (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`; public by design) and a **room JWT** returned by `POST /api/rooms` (host) or `POST /api/rooms/:code/join` (guest). The JWT is HS256, signed by the Netlify function with the Supabase JWT secret, expires in 2 h, claims:
  ```json
  { "aud": "authenticated", "role": "authenticated", "sub": "<playerId or guest-uuid>", "room": "ABCD", "exp": 0 }
  ```
- The client calls `supabase.realtime.setAuth(jwt)`, then joins a **private** broadcast channel. Policies on `realtime.messages` (SQL in [07 §2.5](./07-backend-and-records.md#25-realtime-authorization)) allow read/write only on topic `room:<claim room>`.
- No table has an anon policy. Everything else still goes through Netlify functions.
- Use `@supabase/realtime-js` directly (not the full `supabase-js`) to keep the bundle small: `new RealtimeClient(url + '/realtime/v1', { params: { apikey: anonKey } })`.

### 5.2 Channel and events
- Topic: `room:ABCD` (upper-case code). Channel config: `{ config: { private: true, broadcast: { self: false, ack: false }, presence: { key: peerId } } }`.
- `peerId`: 8 random lowercase hex chars generated per tab session (`crypto.getRandomValues`). Host's peerId is announced in presence with `isHost: true`.

Presence payload (tracked once subscribed):
```ts
export interface SignalPresence {
  peerId: string;
  isHost: boolean;
  nickname: string;       // <= 24 chars
  playerId: string | null;// public player uuid, null for guests
  protocol: number;       // NET_CONST.PROTOCOL_VERSION
  joinedAt: number;       // Date.now()
}
```

Broadcast events (all payloads JSON). `to` addresses one peer; receivers ignore events whose `to` is not their `peerId` (except `to: '*'`).
```ts
export type SignalMsg =
  | { event: 'join-request'; from: string; to: string /* host peerId */; nickname: string; playerId: string | null;
      localPlayers: number; simVersion: number; protocol: number }
  | { event: 'join-accept';  from: string; to: string; rejoinSecret: string }   // host -> joiner, then joiner offers
  | { event: 'join-reject';  from: string; to: string; reason: RejectReason }
  | { event: 'sdp';  from: string; to: string; kind: 'offer' | 'answer'; sdp: string; purpose: 'game' | 'voice' }
  | { event: 'ice';  from: string; to: string; candidate: RTCIceCandidateInit; purpose: 'game' | 'voice' }
  | { event: 'bye';  from: string; to: string | '*' }
  | { event: 'host-claim'; from: string; to: '*'; epoch: number; tick: number };   // host migration, §12.7

export type RejectReason =
  | 'room_full' | 'run_in_progress_spectate_only' | 'version_mismatch' | 'banned' | 'host_busy' | 'bad_request';
```

### 5.3 Who offers to whom
- Star topology: **only the joiner creates the offer, and only toward the host.** The host never offers. This avoids glare (simultaneous offers) entirely.
- Voice (§16) uses separate peer connections, `purpose: 'voice'`, offered by the peer with the lexicographically smaller `peerId`.
- ICE candidates arriving before the remote description is set are queued and applied after `setRemoteDescription`.
- Trickle ICE on; `iceCandidatePoolSize: 2`.

### 5.4 `Signaling` interface (so tests and the harness can swap implementations)
```ts
export interface Signaling {
  readonly peerId: string;
  connect(code: string, jwt: string, presence: SignalPresence): Promise<void>;
  send(msg: SignalMsg): void;
  onMessage(cb: (msg: SignalMsg) => void): void;
  onPresence(cb: (peers: SignalPresence[]) => void): void; // full roster on every sync/join/leave
  disconnect(): void;
}
```
Implementations: `SupabaseSignaling` (production), `LocalSignaling` (BroadcastChannel `pk2-signal-<code>`, used by the multi-tab harness, no network, no JWT), `MemorySignaling` (unit tests).

### 5.5 Limits
Supabase Realtime free tier: 200 concurrent connections, 100 messages/s project-wide, 2 M messages/month ([07 §10](./07-backend-and-records.md#10-costs-on-free-tiers)). Signaling uses about 20 messages per join and 0 during play, so this is ample. Presence is the only chatter. **Game data never uses Realtime** except the optional relay fallback (§6.3).

---

## 6. STUN, TURN and the relay fallback

### 6.1 ICE servers
`GET /api/turn` (auth required, rate-limited 30/h per player) returns:
```ts
export interface TurnResponse { iceServers: RTCIceServer[]; ttlSeconds: number }
```
Order of preference, implemented in `v2/netlify/functions/turn.ts`:
1. **Cloudflare Realtime TURN** (free tier, generous egress; check current limits at launch). Env `CF_TURN_KEY_ID`, `CF_TURN_API_TOKEN`. The function calls `POST https://rtc.live.cloudflare.com/v1/turn/keys/${CF_TURN_KEY_ID}/credentials/generate-ice-servers` with body `{ "ttl": 14400 }` and returns the result. Credentials are short-lived (4 h).
2. **Metered.ca free plan** if Cloudflare env vars are absent but `METERED_API_KEY` + `METERED_APP` are set: `GET https://${METERED_APP}.metered.live/api/v1/turn/credentials?apiKey=...`.
3. **STUN only** if neither is configured: `[{ urls: 'stun:stun.cloudflare.com:3478' }, { urls: 'stun:stun.l.google.com:19302' }]`.

The STUN pair above is **always** appended to the list, so a TURN outage never removes STUN.

Client rules: fetch ICE servers once per room join (host: on create). `RTCPeerConnection` config `{ iceServers, iceTransportPolicy: 'all', bundlePolicy: 'max-bundle' }`. If the game connection is not `connected` after **8 s**, retry once with `iceTransportPolicy: 'relay'` (forces TURN). A second failure shows `strings.net.connectFailed` with the actionable text "A strict firewall may block direct play. Try another network, or play with fewer players." and offers the relay fallback if available.

### 6.2 ICE restart
On `iceconnectionstate === 'disconnected'` the **joiner** (offerer) waits 2 s, then calls `createOffer({ iceRestart: true })` through signaling. After `PEER_TIMEOUT_MS` (3 s) of silence on the sim channel the peer is treated as gone (§12.3); the connection can still recover within the reconnect grace.

### 6.3 Relay fallback (optional phase R, only if TURN is unavailable)
When no TURN is configured or the forced-relay attempt fails, rooms of **at most 3 chefs** may fall back to **frames and inputs over the Supabase Realtime channel**:
- Packets batch **2 ticks** (15 packets/s) and use the same binary layouts base64-encoded in event `data` (`{ event: 'relay', from, to, b64 }`).
- Load: host sends 15 msg/s per client (broadcast = 1 message to all, so 15 msg/s total), each client sends 15 msg/s. With 3 chefs this is 45 msg/s, under the 100 msg/s project limit. Hence the cap of 3 chefs, and a global kill switch `RELAY_ENABLED` env (default off).
- The latency is higher (RTT through the Realtime cluster) and playout default becomes B = 5.
This is phase R in §18; skip until the rest works.

---

## 7. Topology and channels

```
                 Supabase Realtime (signaling + presence only)
                      ^           ^           ^
                      |           |           |
              +-------+--+   +----+-----+  +--+-------+
              |  HOST    |<->| CLIENT B |  | CLIENT C |      game data = STAR:
              | sequencer|<--+----------+->|          |      host <-> each client only
              +----------+   +----------+  +----------+
   voice (phase V) = separate full mesh of peer connections
```

Each client has **one** `RTCPeerConnection` to the host for game data with **two** data channels, created by the joiner:

| Label | Options | Content |
|---|---|---|
| `sim` | `{ ordered: false, maxRetransmits: 0 }`, `negotiated: true, id: 0` | Binary: `InputBatch`, `Frames`, `Ping`, `Pong` (§8.2) |
| `ctl` | `{ ordered: true }` (reliable), `negotiated: true, id: 1` | JSON strings: lobby, run control, hash reports, log transfer, chat (§8.3) |

`negotiated: true` with fixed ids avoids `ondatachannel` races. `binaryType = 'arraybuffer'` on `sim`.

`Transport` abstraction (so the same session code runs on WebRTC, memory and simulated networks):
```ts
export type ChannelName = 'sim' | 'ctl';
export interface Transport {
  /** Host side: many peers. Client side: only the host peer id. */
  send(to: string, channel: 'sim', data: Uint8Array): void;
  send(to: string, channel: 'ctl', data: string): void;
  onData(cb: (from: string, channel: ChannelName, data: Uint8Array | string) => void): void;
  onPeerOpen(cb: (peerId: string) => void): void;
  onPeerClose(cb: (peerId: string) => void): void;
  /** bytes buffered for a peer on `sim`; sessions drop frame packets when > 64 KB (congestion). */
  bufferedAmount(peerId: string): number;
  close(peerId?: string): void;
}
```

---

## 8. Wire types and encodings

All integers little-endian. `DataView` based. Encoders/decoders in `v2/packages/net/src/codec.ts`; every function has a round-trip test.

### 8.1 Shared value types
```ts
import type { RushInput } from '@ga/sim';
import type { BucketId } from '@ga/content';

/** Index 0..5 of a chef in the sim (`RushSim.chefs[slot]`). */
export type Slot = number;

/**
 * One chef's input for one tick is exactly `RushInput` (02 §4.1), 5 bytes on the wire (02 §4.4):
 * [move[0]:i8][move[1]:i8][buttons:u8 (bits 0..3: A, X, B, T)][click:u8, 255 = -1][clickSeq:u8].
 * There is no `clickKind` (click-to-walk is removed, owner decision 5): a mouse click is an interact on `click`
 * that the sim only acts on when the station is in reach, and the client maps right-mouse-hold to the X bit.
 * `net` re-implements the 5-byte layout locally (no runtime import of sim) and must stay byte-identical.
 */
export const INPUT_BYTES = 5;                       // same value as @ga/sim INPUT_BYTES
export function writeInput(i: RushInput, out: Uint8Array, offset: number): void;
export function readInput(src: Uint8Array, offset: number): RushInput;
export const IDLE_INPUT: RushInput;                 // { move:[0,0], buttons:0, click:-1, clickSeq:0 } (== idleRushInput())
```
`clickSeq` is a u8 and the sim treats it as u8 equality, so wrapping is safe. `step` sanitizes everything it receives (02 §4.2), and the net decoder additionally rejects `click` values above 254 other than 255.

### 8.2 Binary messages on `sim` (unreliable)

First byte is the type.

```ts
export const enum SimMsgType { InputBatch = 1, Frames = 2, Ping = 3, Pong = 4 }
```

**InputBatch** (client -> host), one per local sim sample period (30 Hz), carries the last `INPUT_SEND_REDUNDANCY` (4) sample-ticks of all of the peer's local slots:
```
u8   type = 1
u8   slotCount            (1..4)
u8[] slotIds              (slotCount bytes)
u32  ackTick              (client has received and applied-or-queued every frame with tick < ackTick)
u16  firstSeq             (seq of the oldest sample-tick in this packet; seq is per peer, +1 per sample-tick, wraps)
u8   sampleCount          (1..4)
then sampleCount groups, oldest first; each group = slotCount x 5 B RushInput in slotIds order
```
```ts
export interface InputBatch { slotIds: Slot[]; ackTick: number; firstSeq: number; samples: RushInput[][] /* [sampleTick][slotIndex] */ }
```
Size with 3 local chefs and 4 samples: 1+1+3+4+2+1 + 4*3*5 = 72 B, at 30 Hz = 2.2 KB/s. With 1 chef: 1+1+1+4+2+1+20 = 30 B = 0.9 KB/s.

**Frames** (host -> client), one per host tick per client at most:
```
u8   type = 2
u32  firstTick            (tick number of the first frame in the packet)
u8   count                (1..FRAMES_MAX_PER_PACKET)
frame[0]: FULL  -> for every slot 0..N-1 in order: 5 B RushInput   (N = runStart.config.players)
frame[i>0]: u8 changedMask (bit s set = slot s differs from the same slot in frame i-1), then 5 B per set bit, ascending slot
```
```ts
export interface FramesPacket { firstTick: number; frames: RushInput[][] /* [frameIdx][slot], fully expanded */ }
```
The first frame of every packet is **full** so a lost earlier packet never breaks decoding. The host sends each client all frames from `max(client.ackTick, host.tick - FRAMES_MAX_PER_PACKET + 1)` to the newest confirmed tick, every tick. Under no loss at 100 ms RTT this is about 4 frames per packet. Typical size: the full first frame (6 x 5 = 30 B) plus 3 delta frames of 1 + ~3 x 5 = 16 B = about 78 B x 30 Hz = 2.3 KB/s per client. Host uplink at 5 clients is about 12 KB/s.
If `ackTick` is more than 24 ticks behind, the host stops sending `Frames` to that peer and uses reliable catch-up instead (`catchupChunk`, §14.3) until the peer's `ackTick` is within 4 ticks of live.

**Ping / Pong** (every 500 ms, client -> host -> client):
```
Ping: u8 type=3, u32 clientTimeMs (performance.now() truncated), u16 seq
Pong: u8 type=4, u32 clientTimeMs (echoed), u16 seq, u32 hostTick (host's newest confirmed tick when answering)
```
The client computes `rttMs = nowMs - clientTimeMs`, smoothed: `rtt = rtt * 0.8 + sample * 0.2` (first sample sets it). The RTT drives the UI indicator (§9.6) and the initial B.

### 8.3 JSON messages on `ctl` (reliable)

One JSON object per message: `{ "t": "<type>", ... }`. Max message size 16 KB (chunk anything larger).

```ts
export type RejectReason = /* defined in §5.2 */ never; // re-exported from protocol.ts, listed once there

export interface PeerInfo {
  peerId: string;
  nickname: string;
  playerId: string | null;
  isHost: boolean;
  ready: boolean;
  connected: boolean;
  /** Chefs this peer controls. Empty for spectators. */
  slots: Slot[];
  looks: ChefLook[];          // one per slot, same order
  rttMs: number;              // host's measurement, 0 for the host itself
  spectator: boolean;
}
export interface ChefLook { hat: number; color: number }   // u8 ids from the chef catalog ([04])

/** 02 §15.3. Only `meal` and `feast` are ranked ([07 §1](./07-backend-and-records.md#1-principles-and-names)). */
export type Difficulty = 'snack' | 'meal' | 'feast';

export interface RoomState {
  code: string;
  epoch: number;                  // host migration counter, starts 0
  phase: 'lobby' | 'starting' | 'running' | 'results';
  hostPeerId: string;
  successorPeerId: string | null; // first connected non-host peer by join order, §12.7
  levelId: string;
  difficulty: Difficulty;
  peers: PeerInfo[];
  maxChefs: number;               // 6
  runId: string | null;
}

export type SlotAssign = { slot: Slot; peerId: string; look: ChefLook; nickname: string; playerId: string | null };

// ---- client -> host
export type ClientCtl =
  | { t: 'hello'; protocol: number; simVersion: number; nickname: string; playerId: string | null;
      localPlayers: number; looks: ChefLook[]; rejoinSecret: string | null; ackTick?: number /* migration, §12.7 */ }
  | { t: 'ready'; ready: boolean }
  | { t: 'setLocal'; localPlayers: number; looks: ChefLook[] }   // lobby only
  | { t: 'setNick'; nickname: string }
  | { t: 'chat'; text: string }
  | { t: 'loaded'; runId: string }
  | { t: 'hash'; runId: string; tick: number; hash: string }       // hash = RushSim.stateHash(), 16 hex chars
  | { t: 'catchupRequest'; runId: string }                      // client is far behind: ask for snapshot + tail (§14.3)
  | { t: 'leave' };

// ---- host -> client(s)
export type HostCtl =
  | { t: 'welcome'; peerId: string; rejoinSecret: string; room: RoomState }
  | { t: 'reject'; reason: RejectReason }
  | { t: 'room'; room: RoomState }                // full state on every change
  | { t: 'chat'; from: string; text: string }
  | { t: 'runStart'; runId: string; config: RunConfig; slots: SlotAssign[]; startsInMs: number }
  | { t: 'runGo'; runId: string }                  // barrier released, frames start flowing from tick 0
  | { t: 'runEnd'; runId: string; ticks: number; result: RunResult }
  /** Catch-up announcement. `mode: 'snapshot'`: body = snapshot bytes, then the frame tail [snapshotTick, toTick). `mode: 'log'`: body = frames [0, toTick). */
  | { t: 'resync'; runId: string; reason: 'desync' | 'catchup' | 'reconnect' | 'lateJoin';
      mode: 'snapshot' | 'log'; snapshotTick: number; toTick: number; snapshotBytes: number; chunks: number }
  | { t: 'catchupChunk'; runId: string; index: number; of: number; b64: string }   // <= 8 KB raw per chunk
  | { t: 'kick'; reason: 'host' | 'desync' | 'timeout' }
  | { t: 'hostChange'; epoch: number; hostPeerId: string };

```
`RunConfig` is the type of 01 §7.6 / 02 §4.5: `{ simVersion, contentHash, levelId, players, seed, difficulty?, assist? }`. The host builds it (`simVersion = SIM_VERSION`, `contentHash = contentHash(levelId)` from `@ga/content`); a peer whose own `SIM_VERSION` or `contentHash` differs replies with a version error (§11.3 step 3). `RunResult` is the sim's result type (01 §7.6; it may carry optional per-slot counters, see [07 §6.2](./07-backend-and-records.md#62-replay-container-format)). `config.assist` (5's "extended patience", ticket time x1.25) is chosen by the **host** in the lobby (toggle "Extended patience"); guests see a badge, and an assisted run is flagged and **not ranked** ([07 §9.6](./07-backend-and-records.md#96-assisted-and-unranked-runs)). `difficulty: 'snack'` is also unranked.

`seed` is a u32 chosen by the host with `crypto.getRandomValues` (this is the only place randomness is allowed; it happens outside the sim).

### 8.4 Validation
Every inbound message is validated before use: type tag known, ranges (`localPlayers` 1..4, `text.length <= 140`, `slotIds` valid and owned by the sender, `tick` within `[0, 20000]`). Invalid messages are dropped and counted; 20 invalid messages from a peer kick it. A client may only send `InputBatch` for slots the host assigned to its `peerId`.

---

## 9. Lockstep core: sequencer, playout buffer, tick sync

### 9.1 Roles at runtime
| | Host | Client |
|---|---|---|
| Runs `RushSim` | yes, at the **confirm frontier** (as soon as each tick is confirmed) | yes, **delayed**: plays confirmed ticks from its playout buffer |
| Decides tick contents | yes (`HostSequencer`) | no |
| Own chefs' input | sampled each tick, pushed straight into its own queue (1 tick latency) | sent as `InputBatch` |
| Stored | full `ConfirmedLog` | full `ConfirmedLog` (as received) |

### 9.2 `HostInputQueue` (one per slot)
Holds `RushInput`s received from the owning peer, in `seq` order.
- `push(seq, samples)`: dedupe by `seq` using a u16 wrap-aware compare; ignore seq <= lastAcceptedSeq. A gap (lost packets that redundancy did not cover) is filled by repeating the previous sample (no edges).
- `pop(): RushInput`:
  1. If the queue is empty: return `last` (repeat; if no input ever arrived, `IDLE_INPUT` with `clickSeq` copied from `last`).
  2. If depth > `HOST_QUEUE_MAX` (3): pop **two**, merge (rule below), return the merge. This is how the queue catches up after a burst or clock drift.
  3. Else pop one.
  `last` is updated to the returned sample.
- **Merge(a, b)** (a older, b newer): `move = b.move`; `buttons = (a.buttons & (RB_A | RB_B | RB_T)) | b.buttons` (edge-triggered buttons are not lost), then X (level-held) follows `b`: `buttons = (buttons & ~RB_X) | (b.buttons & RB_X)`; `click, clickSeq` = `b`'s (if both ticks held a click, the older one is dropped; accepted).
- Samples from a peer that has left or whose slot is unassigned are never queued; `pop()` returns `IDLE`.

### 9.3 `HostSequencer`
```ts
export interface SequencerDeps {
  now(): number;                                  // performance.now
  onFrame(tick: number, frame: RushInput[]): void; // -> sim worker, log, network
}
export class HostSequencer {
  constructor(private slotsCount: number, private deps: SequencerDeps) {}
  tick = 0;                  // next tick to confirm
  /** Called on every ticker beat (30 Hz, from the ticker worker, §10.3). */
  beat(): void {
    const frame: RushInput[] = [];
    for (let s = 0; s < this.slotsCount; s++) frame.push(this.queues[s]!.pop());   // local slots push before beat
    this.deps.onFrame(this.tick, frame);
    this.tick++;
  }
}
```
Exact order inside one host beat:
1. Local chefs sample their devices and push into their `HostInputQueue`s (same code path as a remote peer, `seq` from a local counter).
2. `beat()` pops one sample per slot -> `frame`.
3. `frame` appended to `ConfirmedLog`.
4. `frame` sent to the host's own sim worker (`rush-advance { steps: [frame] }`, §10.1).
5. For each connected client: build and send the `Frames` packet.
6. If `tick % HASH_EVERY_TICKS === 0` after applying: record host hash (comes back from the worker, §10.2) into the ring.
7. If `phase` becomes `ended`: stop beats, send `runEnd` (§15).

The host **never waits** for any client. The beat is driven by a ticker (§10.3) that catches up at most 5 ticks per wakeup; if the host tab stalls for more than 5 ticks the surplus is dropped (a run on a stalled host loses time, equally for everyone, and the log stays consistent because the log only contains ticks that were actually confirmed).

### 9.4 `PlayoutBuffer` (client)
The client receives `FramesPacket`s, stores frames by tick, and releases them to its sim worker at 30 Hz.
```ts
export class PlayoutBuffer {
  nextTick = 0;                       // next tick to hand to the sim
  targetDepth = NET_CONST.PLAYOUT_DEFAULT_TICKS;   // B
  private frames = new Map<number, RushInput[]>();
  private acc = 0;
  private started = false;
  ack(): number { return this.contiguousEnd; }     // ackTick: every tick < ack is stored
  receive(p: FramesPacket, arrivalMs: number): void { /* store, update jitter, advance contiguousEnd */ }
  /** Call every main-thread frame or ticker beat; returns the frames to simulate now (0..maxCatchup). */
  pull(nowMs: number): { tick: number; frame: RushInput[] }[] { /* rules below */ }
}
```
`pull` rules (all numbers `Default (tunable)`):
1. `depth = contiguousEnd - nextTick` (frames available to play).
2. Not started: start when `depth >= targetDepth`. Until then return `[]` and the UI shows the countdown "Connecting" state.
3. Playback rate `r`: `depth <= targetDepth - 2` -> 0.9; `depth >= targetDepth + 3` -> 1.5; else 1.0. (`depth === 0` means stall: return `[]`; if stalled > `STALL_BANNER_MS` raise `onStall(true)`, cleared on the next frame played.)
4. `acc += (nowMs - lastMs) * r`; while `acc >= TICK_MS` and a frame for `nextTick` exists and fewer than 4 frames returned: release it, `acc -= TICK_MS`, `nextTick++`. Cap `acc` at `2 * TICK_MS` when stalled to avoid a burst after long stalls (the burst still happens through rule 3's 1.5x rate until depth recovers).
5. **Jitter estimate** (RFC 3550 style) on each `receive`: `expected = (p.firstTick - lastFirstTick) * TICK_MS`, `D = (arrivalMs - lastArrivalMs) - expected`, `jitter += (|D| - jitter) / 16`.
6. **Adapt B** at most once per 2 s: `B* = clamp(ceil((2 * jitter + 15) / TICK_MS), PLAYOUT_MIN_TICKS, PLAYOUT_MAX_TICKS)`; move `targetDepth` by at most 1 toward `B*` per adaptation. Initial B: from the first RTT sample, `clamp(ceil(rtt / TICK_MS / 2) + 2, 2, 10)`, and 3 if no sample yet.
7. When playback was never started, or after a resync, `nextTick` is set to the first tick supplied by the log.

`ackTick` for `InputBatch` = `contiguousEnd`. Frames before `nextTick` are deleted.

### 9.5 `ConfirmedLog`
Per-run, in memory on every peer. Frames are stored packed (5 bytes per slot per tick) in a growable `Uint8Array`:
```ts
export class ConfirmedLog {
  constructor(readonly players: number);
  get length(): number;                                  // ticks stored
  append(tick: number, frame: RushInput[]): void;        // tick must equal length, else throw
  frames(from: number, to: number): RushInput[][];       // [t][slot], for rush-advance
  truncate(toTick: number): void;                        // migration (§12.7)
  /** Per-slot run-length body, byte-identical to the body of a .pkr file (02 §4.6): per slot u32 recordCount + { u16 runLen, 5 B input }. */
  encodeBody(from: number, to: number): Uint8Array;
  static decodeBody(body: Uint8Array, players: number, ticks: number): RushInput[][];
}
```
A client appends in `pull` order (contiguous by construction). Memory: 5,500 ticks x 6 x 5 B = 165 KB worst case. At the end of the run the client still takes the authoritative `RunLog` from its worker (`rush-log-request`) for the `.pkr` ([07 §6.1](./07-backend-and-records.md#61-client-flow-all-peers-see-06-15)); the `ConfirmedLog` is for the network and must equal it (asserted in tests).

### 9.6 Tick sync and clocks
- There is **no wall-clock sync between peers**. Ticks are the shared clock. A client's sim tick `c` always satisfies `c <= hostConfirmedTick`.
- Host-relative lag shown in the debug overlay: `lagTicks = latestReceivedTick - nextTick + 1` (about B) plus `rtt/2/TICK_MS`.
- UI network indicator (HUD, `?debug=1` shows numbers): green RTT < 80 ms, amber 80..150 ms, red > 150 ms or stalled.
- Chef input latency budget (for tests): `rtt + B * TICK_MS` ms. At rtt 60 and B 3 = 160 ms.

### 9.7 What the client does between frames
Render interpolation is unchanged from the single-player client: it draws the latest `RushView` the worker posts. Because views jump forward in bursts when catching up, the renderer must tolerate tick jumps (no per-tick assumptions). Event sounds are played from `events` of each posted batch; when a batch spans more than 6 ticks (catch-up), only the **last 6 ticks of events** play sounds (older events are skipped to avoid a sound burst; they still affect the sim).

---

## 10. Sim worker integration

The existing `worker.ts` owns a wall-clock timer for single-player (`startRush`). Online play needs a second mode where the **caller supplies the ticks**. Add to `v2/packages/sim/src/protocol.ts`:

### 10.1 New messages
```ts
// MainToWorker additions
| { type: 'rush-net-init'; seed: number; players: number; levelId: string; difficulty?: 'meal' | 'feast' }
| { type: 'rush-advance'; frames: RushInput[][] }       // each frame = one RushInput per slot, in tick order
| { type: 'rush-snapshot-request' }                      // reserved, unused in V2.0

// WorkerToMain additions
| { type: 'rush-net'; view: RushView; events: RushEvent[]; ticksRun: number;
    hashes: Array<{ tick: number; hash: string }>; ended: boolean }
```
Behaviour in `worker.ts`:
- `rush-net-init`: `stop()`, construct `RushSim({ seed, players, level: rushLevelById(levelId), difficulty })`, **no timer**, post an initial `rush-net` (tick 0 view, `ticksRun: 0`).
- `rush-advance`: for each frame call `rush.step(frame)`. Collect events. After each step where `rush.tick % 30 === 0`, push `{ tick: rush.tick, hash: rush.stateHash() }`. After the whole batch post one `rush-net` message. A batch may hold up to 600 frames (fast-forward). Fast-forward batches post the view and **drop events** (`events: []`) when `frames.length > 6`... except `TimeUp`, which is always kept so the end of run is never lost.
- The tick-after convention: `hashes[].tick` is `rush.tick` **after** the step (so tick 30 means 30 steps done). The same convention applies to `HashReport.tick` (§14).

`rush-net` mode contains no clock reads; the determinism lint rule keeps passing.

### 10.2 Hash timing
Host and client both get hashes from the worker, so the hash includes everything `stateHash()` hashes today (tick, phase, RNG state, score, chefs, stations' sockets, items, tickets). Spec [02](./02-simulation.md) guarantees that `stateHash()` covers all mutable state; if 02 adds state, 02 must extend the hash in the same change.

### 10.3 Ticker (host only)
Web page timers throttle in hidden tabs. The host's confirm beat comes from a dedicated worker `v2/apps/client/src/net/ticker.worker.ts` which is allowed to read `performance.now()` (add it to the determinism lint exemption next to `worker.ts`):
```ts
// ticker.worker.ts
let last = 0, acc = 0, id: number | undefined;
self.onmessage = (e) => {
  if (e.data === 'start') { last = performance.now(); acc = 0; id = setInterval(tick, 8) as unknown as number; }
  if (e.data === 'stop' && id !== undefined) clearInterval(id);
};
function tick() {
  const now = performance.now(); acc += Math.min(now - last, 250); last = now;
  let n = 0; while (acc >= 1000 / 30 && n < 5) { acc -= 1000 / 30; n++; self.postMessage(1); }
  if (acc >= 1000 / 30) acc %= 1000 / 30;
}
```
The host shows a persistent banner `strings.net.keepVisible` when `document.hidden` (a hidden host tab may still be throttled by the browser; clients just see buffering).
Clients use `requestAnimationFrame` plus a 25 ms `setInterval` fallback to call `playout.pull()`, because they can tolerate throttling (they catch up with the 1.5x rule and 4 frames per pull; a long hidden period triggers `resync` with `reason: 'catchup'`, §14.3).

### 10.4 Local singleplayer path
Single-player and local-couch-only games keep using `rush-init` / `rush-input` unchanged (their own timer). Do not route offline play through the net layer. Both paths share `RushSim` and are covered by the same determinism tests.

---

## 11. Lobby flow

State machine of `RoomState.phase`:
```
lobby --(host presses Start, all ready)--> starting --(barrier done)--> running --(TimeUp)--> results --(host: Play again / Back)--> lobby
```

### 11.1 Lobby screen (content for [05](./05-client-ui-input-audio.md))
- Roster: one card per peer with nickname, chef preview (`ChefLook`), ready check, RTT dot, local-player badge (`x2`).
- Host-only controls: **level picker** (the 10 levels, [08](./08-levels.md)), **difficulty** (Meal/Feast), **Start**, kick (x on a card), "Make host" is not offered (no manual migration in V2.0).
- Guest controls: Ready toggle, look picker, "Add local player" (`+`, up to 4 total per peer, limited by room capacity), Leave.
- Invite panel: the code `ABCD` in large letters, the link, a Copy button, a Share button.
- Chat: one-line text input, 140 chars, last 50 messages. No profanity filter in V2.0 beyond the nickname filter in [07 §4.2](./07-backend-and-records.md#42-nickname-rules).

### 11.2 Rules
1. The host picks `levelId` and `difficulty`. Any of the 10 levels can be picked in a room; levels the guest has not unlocked are playable (guest pass, records still count). Changing level or difficulty resets all guests' `ready` to false (the host's is implicit).
2. **Start** is enabled when `connected peers >= 1`, every non-host, non-spectator peer is `ready`, and total chefs `1..6`. If a peer is not ready the host sees "Waiting for Sam"; pressing Start while holding Shift is not a thing: the host can instead press **Start anyway** after 10 s of waiting, which moves unready peers to spectators for this run.
3. Chef count in the run = sum of `localPlayers` of ready peers. The bucket (Solo/Duo/Squad/Party) follows from it via `bucketForPlayers` ([02](./02-simulation.md)); the lobby shows the bucket name.
4. Slot assignment (host, at Start): sort peers by join order (host first); give each peer consecutive slots equal to its `localPlayers`. Example: host 2 local, B 1, C 3 -> slots 0-1 host, 2 B, 3-5 C.

### 11.3 Start sequence (numbered, exact)
1. Host validates and sets `room.phase = 'starting'`, picks `seed` (u32 random), `runId` (uuid v4), computes `slots`, `contentHash`.
2. Host sends `runStart { ..., startsInMs: 0 }` to all, then broadcasts `room`.
3. Every peer (host too) creates the sim worker with `rush-net-init`, loads render assets, and replies `loaded { runId }`. A peer whose `buildId` or `contentHash` differs from the host's replies `loaded` never: it sends `leave` and shows `strings.net.versionMismatch` with a Reload button (this can only occur if a deploy happened mid-session).
4. Barrier: the host waits until all peers sent `loaded` or `LOAD_BARRIER_MS` (20 s) elapsed. Peers that did not load stay in the run (their slots idle until they catch up via `Frames`; they are shown as `connected: true, loading`).
5. Host sends `runGo { runId }`, sets `phase = 'running'`, starts the ticker, and tick 0 is confirmed at the next beat. The sim's own 3-second countdown phase is part of ticks 0..89 (`countdownSeconds: 3`), so every peer shows "3, 2, 1, Go" from the sim events.
6. Clients start `PlayoutBuffer` on the first `Frames` packet; they show "Get ready" until playout starts (about 100..250 ms of buffering).

### 11.4 Results and back to lobby
`runEnd` -> each peer shows the results screen from its own sim (identical) -> after 3 s the host's "Play again" (same level) or "Lobby" buttons appear. Guests see "Waiting for host". Guests may press Leave anytime.

---

## 12. Join, leave, late join, reconnect, host leaves

### 12.1 Join (new peer, lobby phase)
1. Joiner calls `POST /api/rooms/ABCD/join` with its token (or without, for a guest): response `{ jwt, hostPlayerId, iceServers }` or error `room_not_found` (404) / `room_expired` (410).
2. Joiner connects `SupabaseSignaling` and tracks presence. It waits up to 3 s for a presence entry with `isHost: true`; if none, show `strings.net.hostAbsent` and retry every 2 s up to 10 times.
3. Joiner sends `join-request` to the host's `peerId`.
4. Host checks: protocol equal, `buildId` equal, total chefs + `localPlayers` <= 6, not banned, phase. Reply `join-accept { rejoinSecret }` (random 16 bytes hex, stored in `HostSession.rejoin[peerId]`) or `join-reject { reason }`.
5. On accept, the joiner creates the `RTCPeerConnection` (§7), creates both negotiated channels, makes an offer, sends `sdp`. Host answers. ICE via `ice` events.
6. When `ctl` opens, joiner sends `hello`. Host replies `welcome { peerId, rejoinSecret, room }` and broadcasts `room`.
7. Typical total time 1.5..4 s. The joiner's `rejoinSecret` is stored in `sessionStorage['pk2.rejoin.ABCD']`.

### 12.2 Leave (graceful)
Client sends `leave` (and `bye` on signaling), closes connections. Host removes the peer from the roster. If phase is `lobby`: slots disappear. If `running`: the peer's slots become **idle** (`IDLE` sample each tick, `HostInputQueue.pop()` returns `IDLE`). The run continues and still counts on the leaderboard under the original player count bucket (documented in [07 §7](./07-backend-and-records.md#7-leaderboards)); a `droppedSlots` array is included in the replay header for display only.

### 12.3 Unexpected loss
Detection on the host: `RTCPeerConnection.connectionState` `failed`, the `ctl` channel closing, or no packet on `sim` for `PEER_TIMEOUT_MS` (3 s). Then the peer is marked `connected: false`, its queues drain to `IDLE`, the roster shows "reconnecting...", and the reconnect window of `RECONNECT_GRACE_MS` (120 s) starts. In `lobby` phase the grace is 10 s, then the peer is removed.

### 12.4 Reconnect
1. The client's `RTCPeerConnection` failed or its tab reloaded. It still has `rejoinSecret` (sessionStorage) and the room code (in the URL or `localStorage['pk2.lastRoom']` with timestamp < 2 h).
2. It runs §12.1 steps 1..5 but its `join-request` is followed on `ctl` by `hello { rejoinSecret }`.
3. The host matches `rejoinSecret` to the old `PeerInfo` (the secret must match exactly), restores its slots, and sends `welcome` then `resync { reason: 'reconnect', toTick: H, chunks }` + `logChunk`s (§14.3).
4. The client rebuilds its sim from the log (`rush-net-init` then `rush-advance` with all frames up to `H`), then continues with live `Frames`. Total typically 1..3 s.
5. After the grace expires, the slots stay idle for the rest of the run and the peer can only spectate (it may rejoin as spectator).

### 12.5 Late join (new peer while `phase = 'running'`)
A run's player count is fixed at construction, so a new peer **cannot get a chef** mid-run. It is accepted as a **spectator** (`PeerInfo.spectator = true`, no slots), receives the log (`resync` + `logChunk`) and live `Frames`, and watches. It becomes a normal player at the next lobby. The host decides nothing: the same handshake applies, and the room shows "Sam is watching". Spectators do not count toward `MAX_CHEFS` but toward a cap of 12 peers total, spectators use `ctl` and `sim` the same way and send no `InputBatch`. (`NET_CONST.MAX_PEERS` counts player peers only; the 12 cap is `MAX_PEERS_INCLUDING_SPECTATORS = 12` in constants.)

### 12.6 Kick and ban
Host `kick { peerId }` sends `kick { reason: 'host' }`; the peer's `rejoinSecret` is revoked and its `playerId` is blocked from re-joining this room for its lifetime. No cross-room ban in V2.0.

### 12.7 Host leaves: host migration (specified behaviour)
Because every peer holds the full `ConfirmedLog`, a new host can resume the stream without a snapshot.

**Successor:** `RoomState.successorPeerId` = first connected non-host, non-spectator peer by join order. Recomputed and broadcast on each roster change.

**In lobby/results phases:** if the host leaves, the successor becomes host immediately (steps 3..6 below without the log work); the room code stays valid (the new host calls `POST /api/rooms/:code/host` to transfer, [07 §3](./07-backend-and-records.md#3-netlify-functions)). If no peer remains, the room ends.

**During a run:**
1. Detection (all peers): host connection closes, or no packets for 3 s, or the signaling presence of `isHost` disappears.
2. Each client pauses playout and shows `strings.net.hostLeft` ("Host left. Switching host...").
3. The successor broadcasts signaling `host-claim { epoch: epoch + 1, tick: T }` where `T` = its `ConfirmedLog.frames.length` (its next unconfirmed tick). Other survivors accept the claim from the peer whose `peerId` equals the last announced `successorPeerId`. If the successor itself has vanished, the next peer in the join order claims after a 2 s extra wait (each in order; first claim with the highest epoch wins).
4. Each other survivor opens a new `RTCPeerConnection` to the new host (offer to it, §5.3) and sends `hello { rejoinSecret: <its old secret> }`... the new host does not know old secrets, so for a migration the new host accepts any survivor whose `playerId`/`peerId` appears in its last `RoomState` copy. (Every peer received `RoomState` broadcasts, so it has the roster.)
5. When a survivor connects, the new host compares ticks: let `Tc` = the survivor's `ackTick` carried in `hello` (add field `ackTick?: number`; clients put their `contiguousEnd` there).
   - If `Tc <= T`: the survivor is behind or equal. The new host just starts sending `Frames` from `Tc` (catch-up path if more than 24 behind).
   - If `Tc > T`: the survivor saw frames the new host did not. The survivor **truncates its log to T** and **rebuilds its sim from the log** (`rush-net-init` + `rush-advance` with frames 0..T-1). Deterministic, about 1..2 s. Frames between `T` and `Tc` that only that survivor saw are discarded: the new host's log is the truth.
6. When every survivor connected (or 8 s passed; stragglers join as reconnecting), the new host broadcasts `hostChange { epoch, hostPeerId }`, starts the ticker at tick `T`, and the run continues. The old host's chefs are idle (the old host may rejoin as a normal client within the grace).
7. If no successor exists (the host was the only peer, or all other peers are spectators) the run ends and every peer sees `strings.net.roomClosed`.
8. The run remains valid for the leaderboard: the replay is the new host's log. The `final` claim comes from the sim as usual. A migration is recorded in the replay header as `migrations: number` (informational).

Phase 1 behaviour before migration is implemented: **host leaves = the run is aborted and everyone returns to the title screen** with `strings.net.roomClosed`. Migration is step M in §18.

---

## 13. Mixed couch and online players

- A **peer** is one browser tab. It owns 1..4 **local chefs** (couch players, each with a gamepad or the keyboard, per [05](./05-client-ui-input-audio.md)). Total chefs across all peers is at most 6.
- Chef identity is the **slot**. `SlotAssign.slot` is the index in `RushSim.chefs`; the peer sends one `InputSample` per owned slot per tick.
- The input mapping (device -> local player index 0..3) is purely client side. The peer builds `RushInput` per local player, converts to `InputSample`, and tags with the slot id from `RunStart.slots`.
- Host with local chefs: the host's local slots go through the same `HostInputQueue` path (§9.3 step 1).
- Examples: "2 PCs with 3 players each" = host peer (slots 0-2) + client peer (slots 3-5); the bucket is Party. "1 PC with 4 couch players + 2 remote friends" = host (0-3), B (4), C (5).
- Couch join/leave **during a run** is not supported (player count is fixed). In the lobby, a peer changes its count with `setLocal` until the room is at capacity.
- Online runs ignore the single-player "local pause": there is no pause online. The pause key opens the in-run menu without stopping the sim and shows `strings.net.noPauseOnline`.
- Leaderboard credit ([07 §7](./07-backend-and-records.md#7-leaderboards)): all local chefs on a peer are credited to that peer's `playerId` (one identity per browser). A couch group of 4 on a single browser is a team of one identity with `slots: [0,1,2,3]`.

---

## 14. Desync detection and recovery

### 14.1 Detection
- Every `HASH_EVERY_TICKS` (30) ticks, the worker returns `{ tick, hash }` (§10.1). Each client sends `ctl` `hash { runId, tick, hash }` for each tick that is a multiple of 30. The host sends nothing: it compares.
- `HashChecker` on the host keeps its own `Map<tick, hash>` ring (`HASH_RING` = 600 entries = 20 s). On `hash` from a client: if the tick is in the ring and the hashes differ: **desync(peer, tick)**. If the tick is older than the ring: ignore (the peer is lagging terribly and will be caught up by the catch-up path anyway).
- Clients being behind the host is normal: they report tick 30 when the host is at tick 150; the ring handles it.

### 14.2 Reaction (host)
1. Log `desync` telemetry (`{ runId, peerId, tick, buildId, ua }`, fed to the opt-out telemetry of [09](./09-testing-and-quality.md)).
2. Mark the peer `resyncing` and send `resync { reason: 'desync', toTick: H, chunks }`, then `logChunk`s, where `H` = host's current confirmed tick.
3. A peer that desyncs **twice in 60 s** is moved to **spectator** for the rest of the run: its slots go idle, it shows `strings.net.desyncSpectate`. This stops a single browser with a bug from thrashing.
4. If **two or more** distinct peers desync within 5 s of each other the host assumes *its own* state is suspect: it logs `host_suspect` telemetry, still treats itself as truth, and continues (documented limitation; a hash disagreement between several clients and the host is a test failure to fix, not a runtime condition to resolve).

### 14.3 Log transfer (used by desync, reconnect, catch-up, late join)
- Host builds `body = ConfirmedLog.toReplayBody()` for ticks `[0, H)` (full log; the log is small: about 20..40 KB deflated for a 5,500-tick 6-chef run).
- Split into raw 8 KB chunks, base64-encode each into `logChunk { index, of, b64 }`, send over `ctl` (reliable, ordered).
- Client: on `resync`, **stop playout**, reset `PlayoutBuffer.nextTick = 0`, `rush-net-init` (same seed/level/players as `runStart`), reassemble chunks, `decodeReplayBody`, `rush-advance` with all frames in batches of 300 frames (to keep the worker responsive), set `PlayoutBuffer.nextTick = H`, resume. Frames for ticks >= H arrive on `sim` as normal (the host keeps sending `Frames` from `H` during the transfer; the client buffers them).
- While transferring, the host skips `Frames` for that peer for ticks < H only if the peer's `ackTick` is < `H - 24`; otherwise it keeps sending.
- Expected duration: transfer 40 KB over a reliable channel is under 1 s; re-sim 5,500 ticks takes about 0.3..1.5 s (the 02 sim budget is under 0.3 ms per tick). A 2 s spinner `strings.net.resyncing` covers it.
- `catchup` is triggered by the client itself (`logRequest`) when its playout buffer is more than 90 ticks (3 s) behind the host (a hidden tab, a long freeze).

---

## 15. Run end and record submission hand-off

1. The sim posts `TimeUp` (phase `ended`). The host stops the ticker after confirming that tick and sends `runEnd { runId, ticks, final }`, where `final` is read from the host's `RushView` (`score, stars, served, expired, wrong`) plus `RushSim.stateHash()`.
2. Each client compares its own final state to `final` (hash equality). Mismatch: treat as desync (§14.2) once.
3. Each peer, **independently**, builds the replay container ([07 §6.2](./07-backend-and-records.md#62-replay-container-format)) from its own log and submits it with `POST /api/runs` using its own token ([07 §3.4](./07-backend-and-records.md#34-runs)). The server dedupes identical replays by hash (`v2_runs.replay_hash` unique) and attaches each submitter as a participant. This means the host cannot silently omit teammates, and a guest without a token simply does not submit.
4. The `runToken` for submission comes from `POST /api/runs/start`, which **each peer** calls when `runGo` arrives (best effort, fire and forget; if it fails the run is unranked, never blocking play).
5. Results screen shows "Verifying..." then "Verified, rank #N" or "Not verified" from `GET /api/runs/:id`.

---

## 16. Voice chat (separate phase)

Optional, phase V of §18; the game must be fully playable and tested without it. Spec only the minimum:
- Separate `RTCPeerConnection` per peer pair (full mesh, up to 15 links at 6 peers, `purpose: 'voice'` signaling events from §5.2). Never mix with the game connection, so voice trouble cannot affect gameplay.
- Opus via `getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })`; sender max bitrate 24 kbps (`RTCRtpSender.setParameters`). Upload at 5 listeners is about 120 kbps.
- UX: **Push-to-talk default** (key V or gamepad right-stick click; "open mic" is a setting), mute per player, a speaking indicator ring on the chef card (from `AnalyserNode`, local only, not networked), a global voice volume slider.
- Mic permission is asked only when the player presses the **Voice** button in the lobby, never automatically.
- Off by default in rooms with spectators-only peers; no recording; no voice in clips.
- If TURN is required the voice link also relays (about 24 kbps x2 per relayed pair).
- Failure to connect voice just greys out the indicator for that peer.
Details beyond this are in [../11-voice-and-communication.md](../11-voice-and-communication.md) (intent).

---

## 17. Network testing

### 17.1 `SimulatedNetwork` (unit and integration tests, Node)
`v2/packages/net/src/simnet.ts` implements `Transport` in memory with a deterministic scheduler:
```ts
export interface LinkConfig {
  latencyMs: number;        // one-way base
  jitterMs: number;         // uniform +/- added per packet
  lossRate: number;         // 0..1 per packet, `sim` channel only (ctl is reliable: it adds retransmit delay of 1 RTT per loss instead)
  reorder: boolean;         // allow reordering on `sim` (default true via jitter)
  duplicateRate: number;
  bandwidthBytesPerSec?: number;
}
export class SimulatedNetwork {
  constructor(seed: number, defaultLink: LinkConfig);
  /** Advance virtual time by dt ms, delivering due packets. No real timers: tests are deterministic and fast. */
  advance(dtMs: number): void;
  now(): number;
  transportFor(peerId: string): Transport;
  setLink(a: string, b: string, cfg: Partial<LinkConfig>): void;
  disconnect(a: string, b: string): void;
  reconnect(a: string, b: string): void;
}
```
It uses `Prng` from `@ga/shared` (seeded) for jitter and loss, so a failing test reproduces exactly. All net classes take a `now()` function and never read the clock directly, so tests drive virtual time.

### 17.2 Required test suites (`v2/packages/net/test/`)
| File | What it asserts |
|---|---|
| `codec.test.ts` | Round-trip of every message; `InputBatch` and `Frames` exact byte sizes from §8.2; first frame full; truncated packets rejected |
| `inputQueue.test.ts` | seq dedupe, gap fill, merge rule keeps A/B edges, depth cap |
| `playout.test.ts` | Start threshold, rates 0.9/1.0/1.5, stall detection, B adaptation under synthetic jitter |
| `lockstep.test.ts` | 6 virtual peers with random bot inputs (reuse `rush/bot.ts` style), 180 s run, **all hashes equal** at every 30th tick on: ideal link; 60 ms +/- 20 jitter; 120 ms +/- 40 and 3% loss; 200 ms and 8% loss; asserts no peer ever blocks another (host tick count unaffected by a 2 s blackout of one peer) |
| `resync.test.ts` | Force a desync (mutate one peer's sim state), expect detection within 30 ticks + RTT and recovery to equal hashes within 3 virtual seconds; double desync -> spectator |
| `reconnect.test.ts` | Disconnect a peer 10 s, reconnect with `rejoinSecret`, catches up, same hash |
| `migration.test.ts` | Kill the host at tick 1,000 with peers at different `ackTick`s; successor takes over; all survivors reach the same final hash; replay verifies with `verifyReplay` |
| `mixed.test.ts` | 2 peers x 3 local chefs; slot mapping and input routing |

All suites run under `pnpm test` (vitest root config) and finish in under 60 s total.

### 17.3 Local multi-tab harness (browser)
- Dev page `v2/apps/client/harness.html` + `src/net/harness.ts`, served by vite at `/harness.html`. Query: `?n=3&sig=local&sim=latency:80,jitter:20,loss:0.03`.
- It opens **n iframes** of the main client (`/?room=LOCAL&sig=local&harness=1&bot=<i>`) side by side in a grid, each with its own worker and its own WebRTC connection. Signaling uses `LocalSignaling` (BroadcastChannel), so no Supabase or Netlify is needed. ICE with no STUN works on loopback (`iceServers: []` when `sig=local`).
- `sim=` wraps the `Transport` with `DelayedTransport` (real timers: it delays and drops outgoing packets before they reach the data channel with the same latency/jitter/loss model as `SimulatedNetwork`), because loopback RTT is about 0 ms.
- `bot=<i>` makes that frame drive its chefs with the scripted bot from `rush/bot.ts` so a human is not needed.
- The harness shows per-frame: tick, RTT, depth, hash, desync count, and a global green/red banner "all hashes equal".
- Acceptance: n=6, `latency:80,jitter:20,loss:0.03`, 3 minutes, banner stays green and no iframe stalls more than 1 s.

### 17.4 Manual playtest checklist (kept in [09](./09-testing-and-quality.md))
Two real devices on different networks; one on mobile hotspot; host with throttled CPU (devtools 4x) and a hidden tab for 10 s; Wi-Fi to 4G switch mid-run; close the host tab mid-run (migration); refresh a client mid-run (reconnect).

---

## 18. Implementation order

Each step is shippable and tested before the next. Steps map to backlog tickets in [10](./10-backlog.md).

| Step | Work | Done when |
|---|---|---|
| N1 | `@ga/net` skeleton, `constants.ts`, `protocol.ts`, `codec.ts` + `codec.test.ts` | Codec tests green |
| N2 | `@ga/sim/verify` replay body codec and `SIM_BUILD_ID`, `contentHashFor` ([07 §6](./07-backend-and-records.md#6-run-submission-and-server-re-verification)) | Replay round-trip and a recorded bot run re-simulates to the same hash |
| N3 | `rush-net-init` / `rush-advance` in the sim worker | A test feeds frames to the worker and gets the same hash as the in-process `RushSim` |
| N4 | `HostInputQueue`, `HostSequencer`, `PlayoutBuffer`, `ConfirmedLog` with `MemoryTransport` | `inputQueue` and `playout` tests green |
| N5 | `SimulatedNetwork` and `lockstep.test.ts` | 6 peers, 3 profiles, hashes equal |
| N6 | `HashChecker`, log transfer, `resync.test.ts`, `reconnect.test.ts` | Tests green |
| N7 | `webrtc.ts` + `LocalSignaling` + harness page | Harness n=2 plays a bot run, all hashes equal in a real browser |
| N8 | Server: rooms, JWT, TURN functions ([07 §3](./07-backend-and-records.md#3-netlify-functions)), Realtime policies, `SupabaseSignaling` | Two real browsers on two machines join `/r/ABCD` |
| N9 | Lobby UI, ready-up, level/difficulty choice, runStart barrier, results hand-off ([05](./05-client-ui-input-audio.md)) | Full flow from title to results with 3 players, one with 2 couch chefs |
| N10 | Host-leaves phase 1: abort to title with message; disconnect/leave handling with idle slots; spectators and late join | Manual checklist items pass |
| N11 | Run submission (client side) and the net-result UI ([07 §6](./07-backend-and-records.md#6-run-submission-and-server-re-verification)) | A 2-player online run appears verified on the leaderboard |
| M | Host migration (§12.7) + `migration.test.ts` | Killing the host tab mid-run lets the others finish |
| R (optional) | Relay fallback (§6.3) | 3 players play with `iceTransportPolicy` blocked |
| V (optional) | Voice (§16) | 3 players talk with push-to-talk |
| P | Polish: debug overlay `?debug=1`, telemetry events, `strings.net.*` EN and FR | Strings table has all keys |

---

## 19. Current state vs target

| Area | Current (repo, 2026-11-17) | Target (this doc) |
|---|---|---|
| Net code | None. No `@ga/net`, no WebRTC, no signaling, no Supabase client in `v2/` | Package and files in §3 |
| Sim worker | `worker.ts` `startRush` runs a wall-clock `setInterval` (8 ms) with `acc >= SIM_DT_MS`, up to 5 steps; inputs via `rush-input` (`RushInput[]`, one per chef, latest wins); hash every 30 ticks via `rush.stateHash()` posted with the view | Add `rush-net-init` + `rush-advance` (§10); keep the existing path for offline |
| Input type | `RushInput { move:[i8,i8], buttons, click, clickSeq, clickKind }` with `RB_A/X/B`; click-to-walk exists (`clickKind 0/1`) | Wire form `InputSample` (§8.1). Owner decision 5: click-to-walk is removed; `clickKind` stays on the wire (`flags` bit0) until [02](./02-simulation.md) deletes it, then the bit stays reserved. Add `RB_T` (throw) when level 3 lands |
| Hash | `RushSim.stateHash()` hashes tick, phase, RNG state, score/streak/served/expired/wrong/timeLeft, spawn counters, all chef fields (as `f64`), station sockets, items, tickets | Same function is the lockstep checksum. Chef position uses `f64` (not Q8). Cross-browser safe as long as only `+ - * /` and `sqrt` are used (no `Math.sin/cos/pow` in sim); lint rule exists |
| Brief says "integer or Q8 state" | `ChefRt` uses `f64` | [02](./02-simulation.md) decides whether to convert; the net layer works with either, provided the determinism test in §17.2 passes on Chrome, Firefox and Safari |
| Seed | `Prng(seed).split('rush')` | Host-chosen u32 in `runStart.seed` |
| Players | `RushOptions.players`, bucket via `bucketForPlayers` | Same, 1..6 |
| Difficulty | Not in `RushOptions` | `RushOptions.difficulty?: 'meal' \| 'feast'` added by [02](./02-simulation.md); net just carries it |
| Backend | V1 Netlify functions only | [07](./07-backend-and-records.md) |
| Design docs | `docs/v2/10` describes host-authoritative state sync with prediction, voxel ops, snapshots | **Superseded by this doc**: lockstep. Reusable from 10: topology, STUN/TURN, rooms, reconnect grace, voice mesh, test ideas |

---

## 20. Acceptance criteria

1. `pnpm test` runs all §17.2 suites green, deterministic across 20 runs with different seeds.
2. In the harness, 6 iframes with `latency:80,jitter:20,loss:0.03` for a full 180 s run: all hash reports equal, banner green.
3. A client with a 2 s network blackout does not change the host's tick rate or any other client's screen; it catches up within 3 s of recovery.
4. Killing the host tab mid-run (after step M) lets all survivors finish with an identical final hash within 10 s of the kill.
5. A tampered client (state mutated in devtools) is detected within 1.1 s plus RTT and repaired or moved to spectator as specified.
6. Joining via `/r/ABCD` on a second device reaches the lobby in under 5 s on a normal network (TURN not needed) and in under 12 s through TURN.
7. A 2 PCs x 3 chefs room finishes a run and the run verifies on the server ([07 §6](./07-backend-and-records.md#6-run-submission-and-server-re-verification)).
8. Bandwidth, measured in the harness for 6 chefs: host uplink <= 25 KB/s total, client uplink <= 3 KB/s (3 local chefs) or <= 1.5 KB/s (1 chef).
