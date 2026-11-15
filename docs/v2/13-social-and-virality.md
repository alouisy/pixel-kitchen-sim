# 13 · Social Features and Virality

Virality isn't a feature you bolt on. It's what happens when **(a)** the game produces moments worth showing, **(b)** showing them costs one tap, and **(c)** the people who see them can join in seconds. Giant Appetite is designed around those three conditions.

```
   MOMENT (Big Bite, disaster, discovery)
        │  auto-captured, auto-titled
        ▼
   ARTIFACT (clip, card, daily grid)   ── 1 tap ──▶  X / TikTok / Discord / WhatsApp
        │                                                │
        │                                       viewer sees it, clicks the link
        ▼                                                ▼
   LINK (/clip/:id or /k/:room) ───────────────▶ PLAYING in < 20 s, no install, no account
        │                                                │
        └────────────── new player creates moments ◀─────┘
```

---

## 1. The viral moments (what people share)

Designed sources of shareable content, in rough order of expected share rate:

| Moment | Why it's shareable | Built-in support |
|---|---|---|
| **The Big Bite reaction** | A directed, funny, emotional payoff, every service | Auto-clip, auto-title, cinematic camera |
| **Disasters** (the cheese cliff fire, a tower collapse, the Giant sneezing the kitchen away) | Slapstick, "you had to be there" | The rolling clip buffer: "Clip that!" button anytime |
| **Weird dishes** (a 2-metre ash tower the Giant loved) | Creativity, absurdity | Photo mode, Cookbook cards |
| **Duo chaos with voice** (screaming "PULL IT!", mouth flaps) | Personality, relatable couple and friend dynamics | Mouth flaps, opt-in voice in clips |
| **The Daily Feast result** | Competition, a daily ritual (in the style of daily word-game share grids) | The emoji grid share card |
| **Cookbook discoveries** | "Secret recipe" hunting | Discovery cards, community hunts |
| **Streamer-audience chaos** | Twitch and YouTube, audience participation | Stream Feast mode (§7) |

## 2. Invite flow: link to kitchen in under 20 seconds

1. The host taps **Invite**, which copies `https://<domain>/k/K7QPX` and opens the native share sheet (`navigator.share`) on mobile.
2. The link preview (Open Graph) shows the **host's chef and hat in the Kitchen Lobby** and the text "Sam is cooking for a Giant. Jump in!" (from the dynamic OG image, [09 §9](./09-technical-architecture.md)).
3. The friend clicks. A lobby-first bundle loads (about 1.2 MB) with **no title screen**. They land directly in the lobby as a chef with an auto-generated funny nickname ("Sir Crumbleton") and a random hat, editable in place.
4. Voice prompt (optional). They're in the kitchen with their friend. The rest of the game streams in during hat selection.

**Rules:**
- No "create an account", no tutorial gate, no "download". If the friend is new, **chapter 1 level 1 is available immediately** whatever the host's progress (the Guest Pass, [12 §2](./12-progression.md)).
- If the room is full or expired, offer "Start your own kitchen" with a 1-tap invite back.

## 3. Clips

### 3.1 Capture
- A **rolling buffer** of the last **15 seconds** of gameplay, rendered from the player's own canvas.
- **Implementation:** `canvas.captureStream(30)` plus game audio (from the master bus via `MediaStreamAudioDestinationNode`) fed into a `MediaRecorder` in 1-second segments, keeping the last 15. WebCodecs `VideoEncoder` is used where available for smaller, faster H.264 MP4 output that X and TikTok accept more reliably than WebM.
- **The Big Bite clip** is captured automatically: 6 s before the bell, plus the cinematic. It's rendered at 720p, with a 9:16 vertical crop variant composed from the cinematic camera (the shots are authored to be crop-safe).
- **The "Clip that!" button** (a gamepad combo, the C key, or a touch button) saves the last 15 s anytime. Both players can clip independently.
- Budget: encoding cost ≤ 2 ms per frame on desktop. On low-tier mobile, capture drops to 480p at 24 fps.

### 3.2 Auto-titles
A generator combines the dish's `highlights[]`, profile and shape into a title, in the viewer's language:

```
[adjective from highlights] + [archetype noun] + [optional "of" + emotion/Giant]
  TOO_SPICY + tower   → "Volcanic Tower of Regret"
  PERFECT_SEAR + slab → "Immaculate Mushroom Slab"
  MOSTLY_ASH + stack  → "The Ashen Monument"
  RAINBOW + bowl      → "Glorious Rainbow Bowl"
```

- Hand-written word lists per language (EN/FR/ES), about 60 adjectives and 20 nouns each, with grammatical gender handled in FR and ES.
- The title is stamped on the clip's final frame, along with the crew name, score tier and the game's logo and URL.

### 3.3 Export and share
- **Local export** (always available, no server): download MP4 or WebM, or use `navigator.share({ files })` on mobile to share straight to apps.
- **Publish** (optional): upload to clip storage (≤ 6 MB) via `POST /api/clips`, which returns `https://<domain>/clip/abc123`. That page:
  - plays the clip with proper `og:video` and `twitter:player` meta, so it plays inline in feeds where supported;
  - shows a big **"Cook with a friend"** button that creates a room and invite;
  - expires after 90 days unless it's featured.
- **One-tap intents:** X (`https://twitter.com/intent/tweet?text=…&url=…`), WhatsApp, Telegram, Reddit, copy link. Prefilled text is short and in the player's language, and players can edit it.

## 4. Share cards (static)

Generated as PNG through an offscreen render plus a Canvas 2D layout (local) or `/api/og/:id.png` (server, for link previews):

| Card | Content |
|---|---|
| **Results** | Level, stars, Feast Score, crew, a dish thumbnail, the title |
| **Cookbook page** | Dish render, name, techniques, "discovered by" |
| **Daily Feast** | An emoji grid (below), the score, the streak, no spoilers |
| **Photo Mode** | A free-framed tilt-shift screenshot with optional frames and stickers |

### Daily Feast emoji grid (spoiler-free)
```
Giant Appetite · Daily Feast #142 🐢
🍄🔥🍄🍄🧊  ← each craving: icon of tier (🔥 Perfect, 🍄 Great, 🧊 Okay, 💀 Yuck)
⭐⭐⭐ · 2,840 pts · Top 12%
🔥 streak 9
<domain>/daily
```

## 5. Social graph without accounts

- **Friend codes:** each player has a short friend code (`CRUMB-7KQ2`) derived server-side from their token (not reversible). Adding a friend's code stores a mutual link.
- **Presence:** friends online, in a lobby, or in a service, shown in the lobby with a **"Join"** button. It uses Supabase Realtime presence on a `friends:<tokenhash>` channel, only for players who opted in to showing presence.
- **Crews** ([12 §4](./12-progression.md)) are the main social unit. Crew pages are public (`/crew/:code`) and show the banner, level, best clips and cookbook highlights. They make good shareable profiles.
- Everything is token-based. Losing the device without a Recovery Code loses identity, which is the accepted trade-off of the no-account rule.

## 6. Competition

| Board | Scope | Notes |
|---|---|---|
| Level leaderboards | Per level, per player count (solo, duo, party) | ✓ Verified only by default |
| Daily Feast | Per day, global and among friends | Verified (re-simulated) |
| Crew leaderboard | Crew XP and total Golden Spoons, weekly reset | Social prestige |
| **"Hall of Flame"** | Community-voted funniest Big Bite clips of the week | Featured on the title screen, a cosmetic reward |
| **"Most Cursed Dish"** | The weekly lowest-scoring dish *that the Giant still ate* | Celebrates failure, a comedy engine |

Voting: one vote per token per day, on published clips only, with rate limiting and a minimum-account-age rule (token age ≥ 3 days) to resist brigading.

## 7. Streamer features (Stream Feast, V2.1)

Streamers are the biggest multiplier for co-op party games. Giant Appetite gives them a reason to choose it:

- **Audience votes:** a streamer enables Stream Feast and gets an **overlay URL** (`/overlay/:room`) for OBS and an **audience URL** (`/vote/:room`) to post in chat. Viewers vote every 60 s among 3 options: the next craving, a hazard ("Sneeze!"), or a mutator for 30 s.
- **No Twitch or YouTube API needed** for V2.1 (it's web-based voting, no OAuth). A chat-command integration (bot reading `!sneeze`) could come later.
- A **streamer-safe mode** hides room codes and nicknames of non-crew players, uses a DMCA-safe music flag (all music is original anyway), and adds a delay to on-screen join codes.
- A **Creator kit** page: a press kit, logos, clip templates, the 9:16 auto-crop and a "streamer of the week" feature.

## 8. Launch and promotion plan (V2 beta)

1. **Pre-launch (6 weeks):** devlog clips of the voxel cooking simulation ("we made food you can actually burn from the outside in") on X, TikTok, Reddit (r/gamedev, r/IndieGaming, r/webgames) and Bluesky. The simulation *itself* is the hook for the dev community.
2. **Closed beta (Discord):** 200–500 duos via invite codes. Measure share rate and invite conversion. Iterate on clip titles and Big Bite reactions (the content most likely to travel).
3. **Public beta:** launch on itch.io (a web build), CrazyGames and Poki (web game portals with large audiences), and a Show HN or Product Hunt post. Run a "Hall of Flame" launch competition.
4. **Streamer outreach:** target small and mid co-op streamers (50–2,000 viewers) with the Stream Feast mode. They're more likely to engage, and their audiences convert to duos.
5. **Discord Activity** (if approved, [02 §6](./02-vision.md)): this puts the game *inside* the place where friend groups already talk.

## 9. Measuring virality

| KPI | Definition | Beta target |
|---|---|---|
| **K-factor** | invites accepted per player × the conversion of invitees into players who finish a service | ≥ 0.5 (organic growth needs paid or press help below 1, but every 0.1 helps) |
| Share rate | sessions with ≥ 1 export or publish | ≥ 8% |
| Clip CTR | `/clip/:id` visits that click "Cook with a friend" | ≥ 6% |
| Invite conversion | `/k/:room` opens that finish a service | ≥ 45% |
| Time to kitchen | link click to controllable chef | < 20 s p75 |
| Duo D7 | crews playing again within 7 days | ≥ 18% |

All are measured with the privacy-light telemetry of [09 §12](./09-technical-architecture.md). No third-party trackers.
