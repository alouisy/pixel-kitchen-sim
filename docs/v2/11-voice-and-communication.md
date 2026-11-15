# 11 · Voice and Communication

Co-op games live or die by communication. Giant Appetite treats voice as a **gameplay and comedy feature** (mouth flaps, proximity, filters), not just a utility. It also gives non-voice players a full language of pings, quick chat and emotes, so nobody is left out.

---

## 1. Goals

1. Voice works **with zero setup** for friends: one permission prompt, then it just works.
2. Voice makes the game **funnier**: your chef's mouth moves when you talk, and optional voice filters make you sound like a chipmunk chef.
3. **Safe by default:** it's off with strangers, one-tap mute per person, and nothing is ever recorded without everyone's consent.
4. **Accessible:** the ping and quick-chat system is expressive enough to finish any level without voice.

## 2. Technical design

### 2.1 Transport
- A **WebRTC audio track** on the *same* `RTCPeerConnection` used for game data ([10 §1](./10-multiplayer-and-netcode.md)), in a full mesh for ≤ 4 players. No extra signaling.
- **Codec:** Opus, mono, 48 kHz, `maxaveragebitrate=32000`, DTX (discontinuous transmission) on, so silence costs almost nothing. In-band FEC on for loss resilience.
- **Processing:** `getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })`. The browser's built-in AEC matters a lot for players using laptop speakers.

### 2.2 Audio graph (per remote peer)
```
RemoteTrack ─▶ MediaStreamSource ─▶ [VoiceFilter?] ─▶ Gain (per-user volume / mute)
                                                    ─▶ Panner (proximity, optional)
                                                    ─▶ VoiceBus ─▶ Master ─▶ destination
                       └──▶ AnalyserNode ─▶ mouth-flap amplitude (§5)
```
- **Ducking:** while voice is active on the VoiceBus, the music bus ducks by −4 dB (a 120 ms attack, 400 ms release).
- **Proximity mode** (optional, off by default for 2 players, suggested for 4): `PannerNode` with an HRTF model and an inverse distance model (ref 3 m, max 25 m, minimum gain 0.35, so you can always hear your partner faintly). It adds a lot of "I'm coming!" fun in big levels.

### 2.3 Chrome / Firefox / Safari quirks to plan for
- Remote WebRTC audio in Chrome sometimes needs to be attached to a (muted) `<audio>` element before the WebAudio graph produces sound. This is a known workaround, encapsulated in `packages/voice`.
- iOS Safari: the `AudioContext` must be resumed in a user gesture (already handled in V1's `AudioManager.resume()`). The mic route can switch the output to the earpiece, so set `playsinline` and test it with Bluetooth headsets.
- Device change (`devicechange` event): hot-swap the mic and output without renegotiation (`replaceTrack`).

## 3. Modes and controls

| Setting | Options | Default (friends) | Default (strangers, V2.1) |
|---|---|---|---|
| Voice | On / Off | **On** (after the permission prompt) | Off |
| Transmit | Open mic (VAD) / Push-to-talk / Toggle | Open mic | Push-to-talk |
| VAD sensitivity | Slider plus a live meter | Auto (calibrated in the lobby) | — |
| Proximity | Off / On | Off for 2, On for 3–4 | Off |
| Voice filter | None, Chipmunk, Giant, Robot Sous-Chef, Underwater | None | None |
| Per-player volume and mute | 0–200%, mute | 100% | 100% |

- **Voice activity detection:** RMS above an adaptive noise floor (estimated from the 10th percentile over 3 s) with a 150 ms hang time. It gates *transmission* (via `track.enabled`) so background noise doesn't flap mouths.
- **Push-to-talk keys:** V (keyboard), D-pad ↓ (gamepad), a mic button (touch).

## 4. Permission UX

- Never ask for the mic on page load. Ask in the **Lobby** with a friendly in-world prompt: a chef holds a voxel microphone. "Want to talk to your crew? Your browser will ask."
- If it's denied: show the ping and quick-chat tutorial card. Re-enable it later from settings, with a link explaining how to reset the permission per browser.
- A **mic test** in the lobby: your own chef's mouth flaps when you speak. That's instant feedback, and fun.

## 5. Mouth flaps and speaking indicators

- Each remote voice's `AnalyserNode` (fftSize 512) gives an RMS at 30 Hz. It's mapped to **4 mouth sprites** (closed, small, open, wide) with hysteresis. Your own chef uses the local mic analyser.
- A **speaking ring** (a soft pulse in the chef's crew color) shows under the chef, on the HUD chef chip and on the off-screen partner indicator.
- If someone has voice off, a small 🔇 shows on their chip, so the partner knows to use pings.
- Clip rendering (§8) keeps mouth flaps *even when voice isn't recorded*, which is still funny on mute.

## 6. Non-voice communication

### 6.1 Smart pings (the primary tool)
One button. What it does depends on the target under the reticle:

| Target | Ping label (auto, localized) | Icon |
|---|---|---|
| Harvestable terrain | "Cheese here!" (material name) | Material icon |
| A FoodBody | "Take this!" or "This is ready!" (if in the perfect band) | Hand / star |
| A fire | "FIRE!" | 🔥 |
| A station | "Use the oven!" | Station icon |
| A Heavy Haul item | "Need hands!" | 🤝 |
| The partner | "Come here!" | Arrow |
| Empty ground | "Go here" | Marker |
| The Giant | "It wants…" (reads the craving aloud with a short voice line) | Bubble |

- Pings last 6 s, show **edge-of-screen arrows** when off-screen, and play a short chime in the pinger's crew pitch.
- Hold the ping button for a **ping wheel**: Yes, No, Wait, Hurry, Thanks, Sorry, Swap tools, I'll cook.
- Spam protection: at most 3 pings per 2 s per player. Beyond that, pings are silent.

### 6.2 Quick chat
Eight phrases on the ping wheel (above), shown as speech bubbles over the chef **and voiced by a chef "gibberish voice"** (a short procedural babble in the player's chosen voice pitch, in the spirit of mumbled animal-speak). It's charming and works across languages: the bubble text is shown in *each viewer's* language.

### 6.3 Emotes
A radial of 8 emotes (wave, cheer, facepalm, dance, point, chef's kiss, panic, high-five). **High-five is a tandem:** both chefs within 2 m doing it within 1 s gives a confetti burst and +2 mood on the Giant.

### 6.4 Text chat
- Lobby and results only (not during service: typing during play is a bad experience and a moderation burden).
- 120 characters max. Filtered with the same word list as nicknames.

## 7. Safety and moderation

- **Mute** any player instantly (from the HUD chip or the pause menu). The mute persists for that player's token across sessions (stored locally).
- **Block:** mutes, hides pings and emotes, and prevents future joins to your rooms (stored locally plus a server-side block list per token).
- **Report:** a lightweight report (`POST /api/reports`) with a reason and the last 60 s of the *event log* (no audio). Reports matter mostly once public rooms exist (V2.1).
- Voice with strangers is **opt-in per session**, and push-to-talk is the default there.
- No voice is stored on any server. Voice is peer-to-peer only (TURN relays carry encrypted SRTP and can't decode it).
- Age: the game is aimed at ages 10+. Public rooms (V2.1) default to voice off and require a "13+" self-declaration to enable voice with strangers. **This needs a legal review before V2.1** (local child-safety rules vary).

## 8. Voice in clips (consent)

- **By default, clips include game audio only** (SFX and music). Mouth flaps are kept visually.
- A crew can opt in to **"Record crew voices in clips"**: *every* member must toggle it on in the lobby, and it shows as a 🎙️ icon in the HUD during the service. Any member turning it off removes voice from future clips immediately.
- When it's on, the local clip recorder mixes the VoiceBus into the clip's audio. Remote voices are captured locally from what you hear, so no extra network traffic.

## 9. Bandwidth and performance

- With DTX, talking voice is about 32 kbps per stream and silence is about 1 kbps. For 4 players in a mesh, each peer sends 3 streams: under 100 kbps up when everyone talks at once.
- CPU: 3 decode streams plus analysers are negligible on desktop and about 2–3% of a mid-range phone CPU.
- If packet loss exceeds 10% for 5 s, voice drops to 16 kbps and the UI shows a small "poor connection" hint on that player's chip.

## 10. Implementation checklist

- [ ] `packages/voice`: capture, VAD, transmit gating, per-peer graph, filters (AudioWorklet pitch shift for Chipmunk and Giant, a ring modulator for Robot, a low-pass plus wobble for Underwater).
- [ ] Renegotiation-free track add and remove (`addTransceiver` at connect time with direction `inactive`, switched to `sendrecv` when enabled).
- [ ] Mouth-flap analyser exposed as a signal per chef slot.
- [ ] Lobby mic test UI, permission flows, an explainer for denied permission.
- [ ] Ping system in the sim (pings are sim events, so they replay and appear in clips).
- [ ] Safety: mute, block, report; a strangers-default profile.
- [ ] A clip voice consent flow.
