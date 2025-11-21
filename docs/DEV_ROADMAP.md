# 🗺️ Pixel Kitchen Simulator - Version 2.0 Roadmap

This document outlines the definitive development path for Version 2.0.
**Goal:** Transform the game from a functional prototype into a chaotic, cooperative, competitive kitchen management experience with high replayability and social connection.

**Core Philosophy:**
1.  **Equitable Competition:** No pay-to-win. Skill-based mastery.
2.  **Cooperative Chaos:** Multiplayer is about communication and task delegation.
3.  **Juicy Feedback:** The game must feel responsive and alive.

---

## 🗓️ Phase 1: Gameplay Depth (The "Chaos" Update)
*Goal: Remove boolean states. Introduce time-pressure, consequences, and resource management loops.*

### 1.1 Progressive Cooking & Spoilage System
**User Story:** As a player, I need to monitor food on the stove, because it changes state over time, so I can serve perfect food or accidentally burn the kitchen down.

- [ ] **Implement Float-Based Cooking State**
    - **Vision:** Replace the instant `raw` -> `cooked` logic with a continuous timer.
    - **Implementation:**
        - Modify `Processor` stations to hold a `progress` (0.0 to 2.0) float.
        - **0.0 - 0.9:** Raw (cannot pick up cooked variant).
        - **1.0 - 1.2:** **Perfect** (Score multiplier: 1.2x). Visual: Golden sparkle.
        - **1.2 - 1.5:** Cooked (Standard score).
        - **1.5 - 1.9:** **Burnt** (Product changes to "Burnt Matter" item). Cannot be served. Must be trashed.
        - **2.0+:** **Fire Hazard**.
    - **UI:** Add a World-Space Canvas (floating progress bar) above every active cooking station. Green zone (Perfect), Yellow (Cooked), Red (Burning).

- [ ] **Fire Propagation & Extinguisher**
    - **Vision:** Negligence leads to disaster. Fire spreads and blocks access.
    - **Implementation:**
        - If a station reaches 2.0 progress, instantiate `FireParticles` and lock the station interactions.
        - Every 3 seconds, fire checks grid neighbors (`GridSystem`). If neighbor is flammable (Counter/Table), spread fire.
        - **New Item:** `Fire Extinguisher`.
        - **Interaction:** Player holds 'Interact' while aiming at fire to reduce fire health.
        - **Penalty:** Fire deducts score every second it is active.

### 1.2 The Dishwashing Loop
**User Story:** As a player, I must clean returned plates, because I have a limited supply of crockery, so that I can continue serving food.

- [ ] **Finite Plate Supply & Returns**
    - **Vision:** Plates aren't infinite. They cycle.
    - **Implementation:**
        - Set a level limit (e.g., 4 Plates total).
        - When an order is successfully served, the `ServingWindow` spawns a `Dirty Plate` item after 5 seconds.
        - **New Station:** `Return Window` (where dirty plates appear).

- [ ] **Sink Mechanics**
    - **Vision:** Washing requires time and interaction.
    - **Implementation:**
        - Player places `Dirty Plate` in `Sink`.
        - Player must **Hold Interact** for 3 seconds to process.
        - Visuals: Water particles, scrubbing animation (wobble).
        - Result: `Dirty Plate` becomes `Plate`.

### 1.3 "Juice" & Visual Polish
**User Story:** As a player, I want the game to feel responsive, so that performing actions feels satisfying.

- [ ] **Procedural Recoil (Squash & Stretch)**
    - **Vision:** Items pop when picked up.
    - **Implementation:**
        - Use `GSAP`. On `pickup()`: Scale item to `1.2` then elastic ease back to `1.0`.
        - On `place()`: Scale y to `0.8` (squash) then elastic ease to `1.0`.

- [ ] **Particle System Framework**
    - **Vision:** Debris and effects communicate state.
    - **Implementation:**
        - Create a pooled `ParticleSystem` class (instanced mesh for performance).
        - **Chopping:** Emit cube particles (color of ingredient) when timer ticks.
        - **Frying:** Emit white/grey smoke particles rising.
        - **Running:** Small dust clouds at player feet when velocity > 0.

---

## 🗓️ Phase 2: Social Infrastructure (The Backend)
*Goal: Identify users and build the social graph necessary for multiplayer.*

### 2.1 User Authentication & Profile
**User Story:** As a player, I want to have a unique identity, so I can save my stats and be recognized by friends.

- [ ] **Authentication System**
    - **Vision:** Simple, low-friction login.
    - **Implementation:**
        - Use **Firebase Auth** or **Supabase**. Support: Email/Pass + Guest Login.
        - Generate a unique 6-character `FriendCode` (e.g., `#A9X2`).
        - Store: `Username`, `AvatarColor` (tint for player model), `TotalScore`.

### 2.2 Friend System
**User Story:** As a player, I want to manage a friends list, so I can easily invite people to games later.

- [ ] **Friend Management UI**
    - **Vision:** A social tab in the main menu.
    - **Implementation:**
        - **Search:** Input field for `FriendCode`.
        - **Add:** Sends request. Appears in target's "Pending" list.
        - **List:** Display friends with **Online/Offline/In-Game** status (Real-time updates via Firestore/Supabase subscriptions).
        - **Delete:** Remove relationship.

### 2.3 Competitive Leaderboards
**User Story:** As a player, I want to compare my scores, so I can prove I am the best chef.

- [ ] **Global & Friends Leaderboards**
    - **Vision:** High scores per level.
    - **Implementation:**
        - Database table: `LevelID | UserID | Score | Stars | Date`.
        - **UI:** In Level Selection screen, show "Global Top 10" and "Friends Ranking".
        - **Logic:** Submit score at `EndLevel` only if the game was not modified/cheated (simple hash verification).

---

## 🗓️ Phase 3: Real-Time Multiplayer (Co-op V1)
*Goal: Two or more players in the same kitchen, working together.*

### 3.1 Network Architecture
**User Story:** As a developer, I need a robust sync architecture to ensure players see the same thing.

- [ ] **Socket.io / WebSocket Server Setup**
    - **Vision:** Host-Authoritative or Relay architecture.
    - **Implementation:**
        - **Tech:** Node.js + Socket.io (Client & Server).
        - **Lobby:** One player creates a "Room" (RoomID). Others join via RoomID (or invite from Friends list).
        - **State:**
            - **Host:** Owns the `LevelManager` and `activeOrders`. Calculates physics/timers. Broadcasts snapshots (20Hz).
            - **Client:** Sends Inputs (Movement vector, Interact button press) to Host. Interpolates visuals based on snapshots.

### 3.2 Player Synchronization
**User Story:** As a player, I want to see my friend moving and interacting in real-time.

- [ ] **Player Entity Replication**
    - **Implementation:**
        - Spawn `RemotePlayer` prefab for connected users.
        - Sync `position`, `rotation`, and `heldItem`.
        - Apply **Linear Interpolation (Lerp)** to position updates to smooth out network jitter.
        - Display `Username` floating text above heads.

### 3.3 World State Synchronization
**User Story:** As a player, if I chop a tomato, my friend sees it get chopped.

- [ ] **Interaction Events**
    - **Implementation:**
        - Network Events: `PLAYER_PICKUP`, `PLAYER_DROP`, `STATION_PROCESS_START`, `STATION_PROCESS_END`.
        - When Host processes an interaction, broadcast the result (e.g., "Station X now has item Y") to all clients.
        - Clients override local state with Host state to prevent desync.

- [ ] **Shared Order Queue**
    - **Implementation:**
        - Host generates orders.
        - Host broadcasts `NEW_ORDER` (ID, Recipe, Timer) and `ORDER_UPDATE` events.
        - Clients render the UI cards based on this data.

---

## 🗓️ Phase 4: Communication & Social Polish
*Goal: Enable coordination between players.*

### 4.1 Voice Chat (VoIP)
**User Story:** As a player, I want to talk to my teammates to coordinate dishes instantly.

- [ ] **WebRTC Voice Implementation**
    - **Vision:** Low-latency, peer-to-peer audio.
    - **Implementation:**
        - Use **PeerJS** (wraps WebRTC).
        - When joining a Socket.io room, exchange PeerIds.
        - Establish Audio Mesh (everyone connects to everyone).
        - **UI:** Microphone Mute toggle. Visual indicator (wave) above player head when speaking.

### 4.2 In-Game Chat
**User Story:** As a player without a mic, I want to send quick messages or text.

- [ ] **Text Chat & Quick Comms**
    - **Vision:** Chat box and a "Ping" system.
    - **Implementation:**
        - **Chat Box:** `Enter` to type. Broadcasts text to Room. Fade out after 10s.
        - **Ping System:** Press Middle Mouse / D-Pad Up to spawn a "Look Here!" marker at the cursor location.
        - **Quick Phrases:** Wheel menu (Need Plates!, Fire!, Serving!).

---

## 🗓️ Phase 5: Future/Matchmaking (V2 Multiplayer)
*Goal: Play with strangers.*

- [ ] **Matchmaking Queue**
    - **Implementation:** Server-side queue. Group players by region and roughly by `TotalScore` (Skill).
    - **Logic:** When 2-4 players are found, create a temporary room and auto-join them.

---