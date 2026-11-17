# 05 · Client UI, Input and Audio

> **Summary.**
> 1. Specifies the client app (`v2/apps/client`): the History API router, every screen (title, level select with stars for 10 levels, intro card with couch join, countdown, HUD, pause, results, online entry points), the input mapping per device (gamepad standard mapping, keyboard by physical codes so AZERTY and QWERTY both work, mouse that interacts only within reach with **no click-to-walk**, touch reserved for later), contextual prompts and glyphs, and the guide arrow rules.
> 2. Specifies the strings/i18n system (French default, English supported, key naming, plurals, CI checks), the procedural audio engine with the complete sound list and recipes, adaptive music, settings with every `localStorage` key, and accessibility.
> 3. Names come from `01-architecture.md §9.2 / §14` (`RunSession`, `LocalSeat`, `InputSourceDesc`, `ViewSource`, `InputSink`, `SimDriver`), `02-simulation.md` (`RushInput`, `RB_*`, events incl. `TooFar`) and `04-rendering-and-art.md` (`RenderHost`, `CameraRig`, `LevelDiorama`).

## Table of contents

1. Current state vs target
2. Client architecture
3. Router and screen flow
4. Screens
   - 4.1 HUD layout (landscape and portrait)
   - 4.2 Title
   - 4.3 Level select
   - 4.4 Intro card and couch join
   - 4.5 Countdown
   - 4.6 In-game HUD elements
   - 4.7 Pause
   - 4.8 Results
   - 4.9 Online entry points
   - 4.10 Settings screen
5. Couch join flow
6. Input
   - 6.1 Pipeline and latching
   - 6.2 Gamepad
   - 6.3 Keyboard (two schemes, physical codes)
   - 6.4 Mouse (no click-to-walk)
   - 6.5 Touch (later)
   - 6.6 Menu navigation
7. Contextual prompts, glyphs, guide arrow
8. Strings and i18n
9. Audio
   - 9.1 Engine
   - 9.2 Sound list and recipes
   - 9.3 Ambience beds
   - 9.4 Adaptive music
10. Settings and persistence
11. Accessibility
12. Acceptance criteria and tests

---

## 1. Current state vs target

| Area | Today (`v2/apps/client/src`) | Target |
|---|---|---|
| Router | `main.ts`: `?mode=giant` loads `mossback.ts`, otherwise `rush/rushClient.ts`. Level and screens by module state (`mode: 'loading' | 'title' | 'intro' | 'play' | 'results'`). | History API router with real URLs (§3), one `Screen` object per screen. `?mode=giant` redirects to `/demo/mossback`. |
| Levels | `LEVEL_ID = 'l01_kiosque'` constant, title shows level 1 + the Mossback demo card. | Level select with 10 levels, locks and stars (§4.3). |
| Players | `joined: Source[]`, max 4, kb + pads, joining in the intro by pressing A / Space. | `LocalSeat[]` (`01 §9.2`), keyboard schemes A and B, join/leave rules (§5). |
| Input | `rushInput.ts`: WASD/arrows + Space + E/X + Shift; pads: A=0 grab, X/RT action, B/RB dash. Left click = **walk and act** (`clickKind`), right click = walk + chop. `input.ts` is the legacy Mossback input. | No click-to-walk. Click acts only within reach. Throw added. Details §6. Mossback keeps `input.ts` untouched. |
| Glyphs | `strings.ts glyph()`: on keyboard `grab` shows "Clic gauche" although the key is Space; legend says "Clic : aller et agir". | Glyph tables per device (§7.2) that always show the real binding. |
| HUD | `rushHud.ts`: DOM overlay `.rh`, tickets top-left, clock/score/streak top-right, legend bottom-left, bubbles, rings, toasts, flash, menu overlay `.rm`. | Same DOM approach kept and extended (§4). |
| Strings | `strings.ts` (331 lines), `fr`/`en` objects, `t(key, vars)`, language by `navigator.language` (anything not `fr` gives English). Mostly Mossback keys plus ~60 rush keys. | French default (owner decision 8), key naming scheme, plurals, runtime switch, CI parity check (§8). |
| Audio | `audio.ts`: 11 sounds, master 0.3, sizzle loop, waves + gull ambience, one bus. | Buses, sound list of §9.2, music, panning, voice limits, per-sound cooldown. |
| Storage | `pk.best.<level>.<bucket>` (score only) via a try/catch `store`. | `pk.settings.v1`, `pk.progress.v1`, ... (§10) with migration of `pk.best.*`. |
| Accessibility | none beyond colour/text. | §11. |

Known problems to fix in passing: `hint.menu.kb` text says "Entrée ou clic" while Space also validates; `intro.joinKb` says "Space or Enter" (fine) but the join happens on click too; `help.walk` string must be deleted (click-to-walk is removed); the intro auto-starts after 3 s which is too short with several players (§4.4).

---

## 2. Client architecture

### 2.1 Folders (target)

```
apps/client/src/
  main.ts                    // boot: storage, i18n, router.start()
  router.ts                  // parseRoute, navigate, Screen registry
  app/
    appState.ts              // AppState: settings, progress, identity (reads storage)
    runSession.ts            // createRunSession (01 §9.2)
    seats.ts                 // LocalSeat management, join/leave (§5)
  screens/
    bootScreen.ts titleScreen.ts levelSelectScreen.ts introScreen.ts playScreen.ts
    pauseOverlay.ts resultsScreen.ts onlineEntryScreen.ts joinScreen.ts settingsScreen.ts creditsScreen.ts
  hud/
    hud.ts                   // RushHud (from rush/rushHud.ts), split in tickets.ts, clock.ts, prompts.ts, rings.ts, toasts.ts
    prompts.ts glyphs.ts guide.ts
  input/
    inputManager.ts          // sources, seats, RushInput sampling
    gamepad.ts keyboard.ts mouse.ts touch.ts bindings.ts menuNav.ts
  audio/
    engine.ts recipes.ts music.ts ambience.ts
  i18n/                      // strings.ts re-exports; fr.ts en.ts format.ts
  storage/
    store.ts settings.ts progress.ts
  strings.ts                 // public entry (AGENTS.md rule 3): t, tn, tg, glyph, lang, setLang
  mossback.ts input.ts hud.ts aim.ts   // legacy Mossback demo, untouched
  rush/                      // old files are moved into the folders above with git mv; rush/ ends empty
```

### 2.2 Core types

```ts
export type ScreenId = 'boot' | 'title' | 'levels' | 'intro' | 'play' | 'results' | 'online' | 'join' | 'lobby' | 'settings' | 'credits' | 'mossback';

export interface Screen {
  readonly id: ScreenId;
  enter(ctx: ScreenContext, params: RouteParams): void | Promise<void>;
  /** Called every animation frame while active. dt in seconds. */
  frame(now: number, dt: number): void;
  /** Menu command from any seat (keyboard, pad). Return true if handled. */
  onMenu(cmd: MenuCmd, seat: number | null): boolean;
  exit(): void;
}

export interface ScreenContext {
  host: RenderHost;            // 04 §2.2
  audio: AudioEngine;          // §9
  input: InputManager;         // §6
  state: AppState;             // settings, progress, identity
  navigate(path: string, opts?: { replace?: boolean }): void;
  hud: RushHud;
}
export type MenuCmd = 'up' | 'down' | 'left' | 'right' | 'accept' | 'back' | 'pause' | 'secondary';
```

### 2.3 Frame loop (single `requestAnimationFrame`)

1. `dt = min((now - last)/1000, 0.1)`; poll input (`input.poll(now)`): gamepads, device detection, menu commands, join presses.
2. Route menu commands to the active screen (`onMenu`) and the pause overlay.
3. If a run is active: `sink.setInput(slot, frame)` for each local seat (idle frames when not `playing`), per `01 §8`.
4. `screen.frame(now, dt)`: updates the diorama (`host.update(view, dt, time)`), HUD, audio parameters (sizzle, ambience, music intensity).
5. `host.render()`.

The sim runs in its own worker at 30 Hz; the client only consumes `RushUpdate` through `ViewSource.subscribe`.

---

## 3. Router and screen flow

### 3.1 Routes (History API; Netlify SPA fallback `/* -> /index.html` except `/classic`, owned by `07`)

| Path | Screen | Params |
|---|---|---|
| `/` | `title` | |
| `/levels` | `levels` | |
| `/play/:levelId` | `intro` then `play` then `results` (one route, internal phases) | `levelId` in `LEVEL_ORDER`; unknown id -> `/levels` |
| `/online` | `online` | |
| `/r/:code` | `join` (code prefilled, `06 §4`) | `code` 4 letters A-Z |
| `/lobby` | `lobby` (`06 §11`), reached by redirect only | |
| `/settings` | `settings` | `?from=pause` returns to the pause overlay |
| `/credits` | `credits` | |
| `/demo/mossback` | loads `mossback.ts` (legacy demo) | |
| `/classic` | V1, hard navigation (full page load) | |

Query flags (kept): `?dev=1` dev tools (`window.__pk`), `?debug=1` overlay (tick, hash, mode), `?art=voxel|smooth` (`04 §4.4`), `?lang=fr|en` (sets `pk.settings.v1.lang` once), `?unlock=all` (dev only, ignored unless `dev=1`). Legacy: `?mode=giant` -> `replace('/demo/mossback')`; `?level=1` -> `replace('/play/l01_kiosque')`.

```ts
export type Route =
  | { id: 'title' } | { id: 'levels' } | { id: 'play'; levelId: string }
  | { id: 'online' } | { id: 'join'; code: string } | { id: 'lobby' }
  | { id: 'settings'; from?: 'pause' } | { id: 'credits' } | { id: 'mossback' } | { id: 'notfound' };
export function parseRoute(loc: { pathname: string; search: string }): Route;   // pure, unit-tested
export function routeToPath(r: Route): string;
```

`navigate(path)` uses `history.pushState` and calls the screen swap; the browser Back button maps to the `back` command of the current screen (title: no-op; levels: title; intro: levels; play: opens the pause overlay and pushes the state back; results: levels). `popstate` during a run opens the pause overlay and re-pushes the play path so Back never destroys a run by accident.

### 3.2 Screen flow

```
boot ──▶ title ──▶ levels ──▶ intro(levelId) ──▶ play: countdown ─▶ playing ─▶ ended ─▶ results
  │         │                      ▲                  │  ▲ pause overlay (Esc/Start)       │
  │         ├─▶ online ─▶ lobby ───┘ (06)             │  └───────────────────────────────┘ │
  │         ├─▶ settings                               └────────── Rejouer ─▶ intro (same seats)
  │         ├─▶ credits                                results ─▶ levels | next level intro | title
  │         └─▶ /demo/mossback
  └─ /r/CODE ─▶ join ─▶ lobby
```

| From | Event | To |
|---|---|---|
| boot | assets loaded (`AssetBackend.load`, models, strings) | the route's screen (default title) |
| title | Jouer | levels |
| title | Jouer en ligne | online |
| levels | select level (unlocked) | `/play/:id` -> intro |
| intro | all joined seats ready, or auto-start rule (§4.4) | countdown |
| countdown | sim `Go` event | playing |
| playing | Esc / Start / window blur / `visibilitychange` hidden | pause overlay (offline: sim paused; online: overlay only, `06`) |
| playing | sim `TimeUp` event | ended: 1.5 s hold, then results |
| results | Rejouer | intro (same level, same seats, new seed) |
| results | Niveau suivant (unlocked) | intro (next level) |
| results | Niveaux | levels |

Screen transitions: 200 ms cross-fade of the HUD layer (CSS `opacity`), the 3D scene stays (title/levels use the title orbit camera, `04 §8.6`). With reduced motion: 0 ms.

---

## 4. Screens

All screens are DOM layers over the single `<canvas id="game">`. Common style (from `rush.css`): `--ink #fff7e6`, `--muted #cfd9de`, `--accent #ffd23f`, `--card rgba(18,38,48,0.82)`, `--teal #3f8796`; cards `border-radius 22px`, gold border `2px rgba(255,210,63,0.55)`; buttons `rm-btn` with `focused` state (accent background, scale 1.04). Font: system UI stack, weights 700/800/900. Minimum hit target 44 x 44 px.

### 4.1 HUD layout

Safe areas: every HUD container uses `padding: max(12px, env(safe-area-inset-*))`. `hud.safeInsets(): { top, bottom, left, right }` (CSS px, measured from the bounding boxes of the visible HUD blocks) feeds `CameraRig.setViewport(w, h, safe)` (`04 §8.3`) after every resize and when the ticket count changes.

| Element | Landscape (>= 900 px wide or aspect >= 1.2) | Portrait (aspect < 0.9) | Tablet / in-between |
|---|---|---|---|
| Tickets | column top-left, width `clamp(150px, 19vw, 230px)`, gap 8 | horizontal row at the top, each card `22vw`, max 4 visible, scroll-free (older ones shrink to icon + bar when > 4) | column, `22vw` |
| Clock + score + streak | top-right, clock `clamp(34px, 5vw, 58px)` | top bar right of the tickets, clock 34 px | as landscape |
| Controls legend | bottom-left card, 3 rows (§4.6) | hidden (shown once as a chip row for 6 s at the start of the first run) | hidden when height <= 640 |
| Seat chips (couch) | bottom, one chip per local seat with symbol, colour, carried item icon, dash pip | same, 2 x 2 grid at the bottom | bottom row |
| Prompts, rings, bars | world-anchored (project) | same | same |
| Toast | centre bottom at 14 % | at 22 % (above the bottom area) | 14 % |
| Touch controls (later) | n/a | bottom 22 % reserved | |

Default insets used by the camera: landscape `{ top: 0, bottom: 0, left: 0.19 W, right: 0 }` is **not** applied (the HUD overlaps the scene's empty corners); only portrait applies `{ top: 0.17 H, bottom: 0.06 H }` (0.22 H with touch controls). Rationale: in landscape the stage never reaches the top-left corner because the frame has margin; in portrait the HUD rows would cover the kiosk.

### 4.2 Title

- Backdrop: the level 1 diorama in title orbit mode (`host.setTitleMode(true)`), chefs hidden, no HUD.
- Card (`wide`): wordmark "Pixel Kitchen" (accent, `clamp(26px, 5vw, 46px)`), subtitle `title.subtitle`.
- Buttons (vertical list, focus order): `title.play` (Jouer), `title.online` (Jouer en ligne), `title.settings` (Réglages), `title.credits`, `title.classic` (Version classique, goes to `/classic`), `title.demo` (Mini-démo, `/demo/mossback`, shown only with `?dev=1` or after 3 stars somewhere; Default (tunable): always shown, in the footer as a small link).
- Footer: language switcher (FR | EN chips, writes `pk.settings.v1.lang`), mute button, version `v{SIM_VERSION}`.
- First-run language hint: if `navigator.language` does not start with `fr`, a one-line toast "English available: Settings > Language / Anglais disponible : Réglages > Langue" (bilingual) once (flag `pk.seen.v1.langHint`).
- Input: arrows/WASD/D-pad/left stick to move focus, Enter/Space/A to accept, mouse hover/click works. The first key press or click unlocks audio (`AudioEngine.unlock()`).

### 4.3 Level select

Layout: grid of 10 level cards. Landscape: 5 x 2, each card `min(18vw, 220px)` wide; portrait: 2 columns x 5 rows, vertical scroll (the focused card scrolls into view). Title orbit stays behind with a dark overlay.

Card content (`LevelCardView`):

| Part | Spec |
|---|---|
| Number | large "1"... "10" top-left badge |
| Thumbnail | 16:9 image `content-src/thumbs/<levelId>.webp` (480 x 270, rendered from the diorama), locked levels desaturated + lock icon |
| Name | `level.<id>.name` (FR/EN) |
| Setting line | `level.<id>.setting` (small) |
| Stars | 3 star icons for the **best result in the bucket that matches the current seat count** (solo/duo/squad/party, `bucketForPlayers`); a small dots row under it shows the 4 buckets (filled = at least 1 star) |
| Best | `levels.best` "Record : {n}" when > 0 |
| Badges | "Nouveau" on the first unlocked unplayed level; the recipe icons (first 3 recipes) |
| Lock text | `levels.locked` "Obtiens {n} {stars} au niveau {k}" (uses `unlock.requires`, `unlock.minStars` from `level.json`) |

Unlock rule: `unlock: { requires: id | null; minStars }` from the level (`03`). A level is unlocked when `requires === null` or the progress for `requires` has at least `minStars` stars **in any bucket**. Default data (tunable, in `08`): level k requires level k-1 with 1 star. Online: the **host's** unlocks decide which levels the host can start; guests can play any level the host picks. `?dev=1&unlock=all` unlocks everything.

Interaction: D-pad/stick/arrows move the focus on the grid (left/right within a row, up/down between rows, wrapping disabled); accept on an unlocked card goes to `/play/:id`; accept on a locked card shakes the card and plays `ui_error`; back returns to the title. Mouse hover sets focus, click accepts. Header: `levels.title` "Choisis ton service", seat count chip ("2 chefs" using `tn`) and a "Jouer en ligne" shortcut.

### 4.4 Intro card and couch join

The intro is shown on top of the live diorama with every joined seat's chef standing at the layout `spawns` (the sim is `rush-init`ed paused, as the demo does). Camera in play mode.

Card (`rm-card`, width `min(560px, 94vw)`):
1. Title `level.<id>.name`, subtitle `level.<id>.goal` (one sentence about the objective).
2. Setting line and the **one new mechanic** teaser `level.<id>.new` (e.g. level 3: "Nouveau : lancer les ingrédients par-dessus le comptoir"). No tutorial screens (owner decision 6).
3. **Control chips for the first seat** (device-aware, §7.2): Grab/Drop/Serve, Action (hold), Dash, and Throw when `level.mechanics.throw`.
4. **Seat row**: 4 slots; each shows chef colour, emblem, name, device icon (keyboard scheme A, scheme B, pad number), a ready tick; empty slots show `+` and the join hint.
5. Join hint line: `intro.join` ("Ⓐ sur une manette pour rejoindre") + `intro.joinKb` ("Clavier : Espace ou Entrée") built with the real glyphs.
6. Primary button `intro.go` ("Appuyer pour démarrer").

Start rule (replaces the 3 s auto-start): the run starts when
- every joined seat has pressed its grab input after the last join change (**ready check**), or
- there is exactly 1 seat and 6 s passed since the card opened with no join (Default (tunable)), or
- any seat holds grab for 1 s (force start).
Every join/leave resets the 6 s timer and clears ready marks. Back (`B`/Esc) from seat 1 returns to the level select; from another seat it makes that seat leave.

### 4.5 Countdown

Sim phase `countdown` (3 s, events `Countdown {n}` then `Go`). The HUD center text shows `3`, `2`, `1` (`clamp(54px, 12vw, 130px)`, weight 900, white with soft shadow, animation `rh-cd 0.9 s ease-out`), then `go.text` ("C'est parti !", accent). Audio: `countdown_tick` per number, `countdown_go` on `Go`. Chef input is idle during the countdown (the client sends idle frames; the sim already ignores nothing, so the client must not send movement before `playing`). The guide arrow and the ticket column appear at `Go`.

### 4.6 In-game HUD elements (exact behaviour, from `rushHud.ts`)

| Element | Behaviour |
|---|---|
| Clock | `fmtClock(ticks)` = `m:ss` of `ceil(ticks/30)`; class `low` and throb (1 s, scale 1.08) when `timeLeftTicks <= 900` (30 s); tick sound each second in the last 10 s (`timeLeftTicks <= 300`) |
| Score | `t('hud.pts', {n})`, eased count-up `shown += (score - shown) * min(1, dt*8)`, snaps within 1 |
| Streak | chip `hud.streak` "Série ×{m}", `m = multPermille/1000` with locale decimal (`,` in French); class `on` (red) when `multPermille > 1000`; pulse animation on change |
| Tickets | one card per `TicketView`: recipe icon (96 px canvas from the `meal` model, or a rendered icon from the active backend), recipe name `recipe.<id>`, component chips (the recipe's steps as small icons, one per component), time bar `width = leftTicks/totalTicks`; classes: `low` (< 50 %, orange `#f4a259`), `crit` (< 25 % or <= 5 s, red `#e4572e`, shake 0.35 s); enter animation `tk-in` (slide from the left 0.35 s), exit `tk-out` (fall + rotate 0.6 s) when the ticket leaves. A non-colour cue: crit cards show a `!` badge, low cards a clock badge |
| Seat chips | per local seat: emblem in the slot colour, held item icon (or empty), dash pip (filled when `dashReady`); hidden in solo |
| Verb prompt | §7.1 |
| Ring (fryer and other heat stations) | `.ring` 54 px SVG at anchor height 1.95: green while cooking, orange pulse when cooked and `progress > 100`, red pulse when burning; icon inside (check / warning / flame) |
| Chop bar | `.cbar` 70 x 10 px at height 1.35 above a board with a chopping item (`progress/256`) |
| Wash bar | same bar above a sink while washing; extinguish bar above a burning station (`actTicks/45`, client-estimated from time held) |
| Floating score | `+N` flying from the pass to the score (`flyScore`, 0.9 s), `-N` red rising 60 px for penalties |
| Toast | bottom, 1.8 s, `aria-live="polite"` |
| Red flash | vignette `rgba(228,87,46,0.55)` 0.4 s on `WrongDish` (disabled by reduced motion / flash setting) |
| "Hurry!" hint | one-time bubble `hint.hurry` above the first burning item per run |
| Legend (landscape) | bottom-left card, 3 rows for the first seat's device: grab, action (hold), dash (+ throw when enabled); after the player has used each verb 3 times (`pk.seen.v1`), the row collapses to a glyph chip only; whole card hidden once all rows collapsed |
| Trop loin hint | on `TooFar` (any local slot) and on a client-side out-of-reach click: the station flashes grey (0.3 s) and a small bubble `hint.tooFar` "Trop loin" shows above it for 1.2 s |

### 4.7 Pause

Open: `Escape`, `P`, pad Start (button 9), window `blur`, `visibilitychange` hidden (offline only; online the overlay opens but the sim keeps running, with the line `pause.online` "La partie continue en ligne"). `RunSession.pause(true)` offline.

Card: title `pause.title` (+ "(Chef 2)" when opened by a non-first seat); items, in order: `btn.resume`, `btn.restart` (confirm if > 20 s played: second press within 2 s, text changes to `btn.confirm`), `btn.settings` (opens the settings screen as a sub-view and returns), `btn.menu` (to the level select; online: leave the room with a confirm). Resume: accept on the first item, `Esc`/Start/B again. Controls hint line below the buttons shows the glyphs of §7.2 for the seat that paused. Gamepad disconnect during a run opens this overlay with the message `pause.padLost` "Manette {n} déconnectée : reconnecte-la ou appuie sur Ⓐ".

### 4.8 Results

Shown 1.5 s after `TimeUp` (the HUD fades out, the diorama stays, camera lingers). Card contents (animation timings exact):

| Order | Element | Timing |
|---|---|---|
| 1 | Title `results.title` "Service terminé", subtitle = bucket name `results.bucket.<id>` (Solo / Duo / Escouade / Fête, with player count) | immediate |
| 2 | Stars: 3 big stars; earned ones animate `in` (scale 1.4 -> 1, `rh-pulse 0.5 s`), delay `0.25 + i*0.25` s, sound `star_1..3` | 0.25-0.75 s |
| 3 | Score: count-up from 0 over 1.2 s, label `results.score` | 0.3-1.5 s |
| 4 | Record banner `results.record` "Nouveau record !" (green, throbbing) or `results.best` "Record : {n}" | 1.5 s |
| 5 | Rows: dishes served `results.served`, expired `results.expired`, wrong `results.wrong`, best streak `results.streak` (if present in `RunResult`), `results.next` "Prochaine étoile : {n}" or `results.max` "Trois étoiles !" | 1.6 s |
| 6 | Per-seat table (only if `RunResult` has per-slot counters, else hidden): emblem, name, dishes served | 1.8 s |
| 7 | Record status line (online/verified): `results.verified` / `results.unverified` (`07`) | when known |
| 8 | Buttons: `btn.replay` (default focus), `btn.next` "Niveau suivant" (only if unlocked, i.e. this run reached the required stars), `btn.levels`, `btn.menu` | after 0.9 s (`guardMs 900`) |

Persistence on entry: `progress.record(levelId, bucket, score, stars)` keeps the max score and max stars per bucket. Unlocks produce a banner `results.unlocked` "Niveau {n} débloqué : {name}". Confetti (`04 §13`) on 3 stars. Seats can still join/leave here (§5); `Rejouer` keeps all seats.

### 4.9 Online entry points

- **Title -> `online` screen**: card with nickname field (prefilled from identity `pk.identity.v1`, edit and save), buttons `online.create` "Créer une salle", `online.join` "Rejoindre avec un code" (4 letter input, auto-uppercase, accepts paste of a full `/r/ABCD` URL), `online.back`. Local seats are chosen **in the lobby** (`06 §13`): a member declares how many local seats it brings (1-4).
- **Invite link `/r/ABCD`**: goes straight to `join` with the code prefilled; if a nickname exists, joins immediately and goes to the lobby (`06 §4`, `§12.1`).
- **Level select**: a corner button "Jouer en ligne"; while in a room the level select shows only for the host (`room.levelId` change), guests see the host's pick.
- **Lobby UI, readiness, disconnect banners, desync messages** are specified in `06 §11 / §12 / §14`; this doc only defines the strings namespace `lobby.*` / `online.*` (§8.4) and the shared components (seat chip, colour/emblem, glyph chips).
- The **in-run** differences: pause is an overlay only; `Rejouer` is host-only (guests see "En attente de l'hôte"); remote chefs show their nickname above the heel ring (billboard text, 0.18 m, same colour as the slot).

### 4.10 Settings screen

Reachable from the title, the pause overlay and `/settings`. Sections and controls (all keys in §10.1): Language (FR/EN), Audio (master, effects, music, ambience sliders 0-100 step 5, mute toggle), Graphics (art style voxel/smooth with note "redémarrage nécessaire", quality auto/low/medium/high, screen shake on/off, reduced motion auto/on/off), Controls (show bindings per device, rebind, vibration on/off, hold-to-toggle Action, mouse hint on/off), Accessibility (text size 100/125/150 %, high contrast, colour-blind symbols always on/auto, hints always/learning/never, guide arrow on/off, extended patience (marks runs unranked), less clutter), Data (export progress JSON, reset progress with confirm, reset settings). Layout: a left list of sections, a right panel; on portrait a single column. Every change applies immediately and is saved on change (debounced 300 ms).

---

## 5. Couch join flow

Up to 4 local seats (`MAX_LOCAL_SEATS`, `01 §14`); online total max 6 (`MAX_RUSH_PLAYERS`); `06 §13` combines them.

```ts
export interface SeatManager {
  readonly seats: LocalSeat[];                       // 01 §9.2: { slot, source, name, color }
  join(source: InputSourceDesc): LocalSeat | 'full' | 'taken';
  leave(slot: number): void;
  sourceOf(slot: number): InputSourceDesc;
  clear(): void;
  onChange(cb: () => void): Unsub;
}
```

Rules:
1. A seat is created by pressing the **join input** of a source while a screen that allows joining is shown (title -> next screen remembers it, level select, intro, results). Join inputs: pad `A` (button 0), keyboard scheme A: `Space` / `E` / left click on the canvas, keyboard scheme B: `Enter`.
2. Slots are assigned in join order 0..3; colour and emblem by slot (`04 §3.3`); default name `Chef {n}` (`seat.name`), seat 0 uses the saved nickname if any.
3. **Pre-join at the title/level select**: the source that accepts "Jouer" becomes seat 0 (so a pad user never needs to press twice); on the intro the player may add more.
4. A pad is bound by `pad.index` (and `pad.id` for reconnects). Keyboard schemes A and B count as two sources; the mouse belongs to scheme A (the keyboard + mouse seat), or to the only keyboard seat.
5. Leaving: on the intro, pressing `back` (pad B, `Esc` is pause/back for everyone so it is not used; scheme A leaves with `Backspace`, scheme B with `Delete`) on a seat > 0 removes it; seat 0 `back` returns to the level select. A disconnected pad keeps its seat for 30 s (the run pauses); after that or on accept of a prompt the seat is freed.
6. Slot stability: leaving seat k does not renumber others during a run (a run is fixed at start). Between runs seats are compacted (0..n-1) and the colours follow the new slots.
7. Mixed local + online: the lobby (`06`) maps local seats to global slots with `allocateSlots`; the seat chip colour comes from the global slot.
8. The intro and the results show the seat row (§4.4) so joining is always visible. No join is possible while `playing`.
9. When the seat count changes between runs the sim is re-inited with `players = seats.length` (bucket changes; the intro shows the bucket name: `intro.bucket` "Mode {name}").

---

## 6. Input

### 6.1 Pipeline and latching

```ts
export interface InputManager {
  poll(now: number): void;                                       // gamepads, device detection, menu queue, join presses
  seats(): SeatManager;
  /** One RushInput per local seat; `playing=false` returns idleRushInput(). */
  sample(seat: LocalSeat, now: number, ctx: SampleContext): RushInput;
  drainMenu(): Array<{ cmd: MenuCmd; seat: number | null }>;
  drainJoins(): InputSourceDesc[];
  lastDevice(seat: number): DeviceKind;                          // for glyphs
  rumble(seat: number, strong: number, weak: number, ms: number): void;
  onDeviceChange(cb: (seat: number, d: DeviceKind) => void): Unsub;
}
export interface SampleContext {
  view: RushView | null; layout: LevelRenderSpec; pick: (x: number, y: number) => number; // RenderHost.pick
  reach: number;                                                                           // level.tuning.reach
}
export type DeviceKind = 'kb-a' | 'kb-b' | 'pad-xbox' | 'pad-ps' | 'pad-switch' | 'pad-generic' | 'touch';
```

`RushInput` is the sim's (`01 §7.8`, `02 §4.1`): `{ move: [i8, i8], buttons: RB_A|RB_X|RB_B|RB_T, click: number, clickSeq: number }` (no `clickKind`).

Mapping (the four logical actions): **Grab/Drop/Serve** -> `RB_A` (edge); **Action** -> `RB_X` (held: chop, wash, extinguish, clear blender); **Throw** -> `RB_T` (edge; only sent when `level.mechanics.throw`, otherwise the key does nothing); **Dash** -> `RB_B` (edge).

Edge latching (`01 §8.3`): a pressed edge button stays set for at least 55 ms (`MIN_HOLD_MS`) so a quick tap spans at least one 30 Hz tick. Held `RB_X` follows the physical state exactly, except in **hold-to-toggle** mode (§11): the first press latches `RB_X` on, the next press (or leaving the target or any other button) releases it.

Stick: `x`, `y` in -1..1, `y` down = +z; radial deadzone 0.18 with rescale `(|v| - 0.18) / 0.82`; diagonal vectors clamped to length 1; converted `toI8(v) = clamp(round(v * 127), -127, 127)`. Keyboard directions combine (left+right cancel) and normalise.

Idle frames are sent to every seat when the run is not `playing`, when the pause overlay is open, or when the window lost focus. Releasing everything on `blur` is mandatory (clears the pressed key set).

### 6.2 Gamepad (standard mapping)

Read `navigator.getGamepads()` each frame; only pads with `mapping === 'standard'` are accepted as seats (non-standard pads show `join.padUnsupported` "Manette non reconnue" once).

| Action | Button / axis (standard index) | Notes |
|---|---|---|
| Move | left stick axes 0, 1; D-pad 12 up, 13 down, 14 left, 15 right | stick + D-pad summed then clamped |
| Grab/Drop/Serve (`RB_A`) | 0 (bottom face: A / Cross / B on Switch) | also menu Accept and Join |
| Dash (`RB_B`) | 1 (right face: B / Circle / A on Switch) or 5 (RB/R1) | menu Back |
| Action (`RB_X`, hold) | 2 (left face: X / Square / Y on Switch) or 7 (RT/R2 when value > 0.4) | |
| Throw (`RB_T`) | 3 (top face: Y / Triangle / X on Switch) or 6 (LT/L2) | |
| Pause | 9 (Start) | any seat |
| Mute | 8 (Back/Select) | |
| Menu move | left stick (threshold 0.6, first repeat 380 ms then every 160 ms), D-pad edges | |
| Menu accept / back | 0 / 1 | |
| Right stick, bumpers 4, stick clicks | unused (reserved) | |

Glyph set by `pad.id`: contains `054c` or `PlayStation`/`DualShock`/`DualSense` -> `pad-ps` (✕ ○ □ △, Options); contains `Nintendo`/`057e` -> `pad-switch` (face labels swapped as in the table above); contains `Xbox`/`045e` -> `pad-xbox` (Ⓐ Ⓑ Ⓧ Ⓨ); else `pad-generic` (same as Xbox).

Rumble (`pad.vibrationActuator?.playEffect('dual-rumble', ...)`, only if the setting `vibration` is on and the actuator exists): `Burnt` 0.2 s (strong 0.4), `TicketExpired` 0.15 s weak, `Served` 0.08 s weak 0.3, `Fire` 0.3 s strong 0.5, bump `Shoved` 0.2 s strong 0.6. Never during menus.

Connection: `gamepadconnected` shows a toast `pad.connected` ("Manette {n} connectée"); an unbound pad that presses A joins (§5). `gamepaddisconnected` for a seat during a run pauses (§4.7).

### 6.3 Keyboard (physical codes; AZERTY and QWERTY)

All bindings use `KeyboardEvent.code` (physical position), so the same positions work on AZERTY (ZQSD) and QWERTY (WASD) without detection. Labels shown to the player come from the layout map (§7.2).

| Action | Scheme A (default seat) | Scheme B (second keyboard seat) |
|---|---|---|
| Move | `KeyW` `KeyA` `KeyS` `KeyD` (arrow keys also move **only while scheme B is not joined**) | `ArrowUp` `ArrowLeft` `ArrowDown` `ArrowRight` |
| Grab/Drop/Serve | `Space` | `Enter` |
| Action (hold) | `KeyE` (also `KeyX`) | `ShiftRight` |
| Throw | `KeyF` | `Slash` |
| Dash | `ShiftLeft` | `Period` |
| Join | `Space`, `KeyE`, left click | `Enter` |
| Leave (intro only) | `Backspace` | `Delete` |
| Pause | `Escape`, `KeyP` (global) | same global keys |
| Mute | `KeyM` (global) | |

(Defaults, tunable; remappable in settings, stored in `pk.bindings.v1`.) Scheme B is offered as a join option only when at least one other source is already joined or the player presses `Enter` first on the intro (then it becomes the first seat with scheme B).

Rules: `preventDefault` on `Space`, arrows, `Tab`, `Backspace`, `Enter` while a run or menu is active; never on browser shortcuts (Ctrl/Alt/Meta combos are ignored). Auto-repeat events are ignored for edge buttons (`e.repeat`). Key state clears on `blur` and `visibilitychange`. `KeyM`/`Escape` are processed globally, not per seat. Ghosting: scheme A uses keys on the left, scheme B on the right of the keyboard to reduce rollover problems; when two keyboard seats are active the legend shows the warning chip `kb.ghosting` once (Default (tunable)).

### 6.4 Mouse (no click-to-walk)

Owner decision 5: **the mouse never moves the chef**. It only interacts with a station in reach.

- Mouse belongs to the keyboard seat of scheme A (or to the only keyboard seat). It is ignored for pad seats.
- **Left click** on the canvas: `station = host.pick(x, y)` (`04 §15.4`, layout-box picking). If `station >= 0` and the station is **within reach** of this seat's chef (`stationInReach(chefView, station, reach)`, same function as the sim's `findTarget`, imported from `@ga/sim`; the sim stays authoritative) then the client sets `click = station; clickSeq = (clickSeq + 1) & 0xff` for exactly one frame. Otherwise nothing is sent and the "trop loin" hint (§4.6) is shown (if `station >= 0`) or nothing happens (empty floor). If `RB_A` is pressed in the same tick the sim acts once (`02 §4`).
- **Right mouse button hold** maps to `RB_X` (Action) on the chef's current target (it does not choose a target; the chef must be in position). Context menu is suppressed on the canvas only.
- Hover feedback: moving the cursor over a station shows the hover ring (`04 §15.2`): green if in reach, grey if not; 2 s after the last movement it hides. The cursor is `pointer` over a reachable station, `not-allowed` over a station out of reach, `default` otherwise.
- The mouse wheel, middle button and drag do nothing in game.
- Keyboard use after mouse use switches the displayed device; mouse movement switches glyphs to "keyboard + mouse" labels (§7.2).
- `TooFar` events (from the sim, any slot of this machine) also show the hint, so the behaviour is identical when the click originates from a replay or a remote peer test.
- The legacy code paths `clickKind`, `walkTarget`, "Clic : aller et agir", right-click walking, `pickStation` with y-planes 1.0/0.5 and the 0.12 m slack are **removed**.

### 6.5 Touch (later; reserved)

Not built now; the structure is reserved so the layout does not change later.
- Detect `pointer: coarse` or the first `touchstart`: device kind `touch`, seat 0 only.
- Floating stick on the left half (appears where the thumb lands, radius 56 px, same deadzone and `RushInput.move`); right side four buttons in a diamond: Grab (large, bottom), Action (hold, right), Throw (top), Dash (left), each >= 64 px with 12 px gaps; pause button top-center; the bottom 22 % of the portrait viewport is reserved for them (`safe.bottom`, §4.1).
- Tap on a station within reach = click; out of reach = hint. No drag-to-walk.
- Module `input/touch.ts` exports the same `sample` interface; disabled behind `settings.touch`.

### 6.6 Menu navigation

`MenuCmd` sources: keyboard `ArrowUp/Down/Left/Right` and `KeyW/A/S/D` (up/left/down/right), `Enter`/`NumpadEnter`/`Space` accept, `Escape` back (and pause in game), `Backspace` back; pad D-pad/stick/A/B; mouse hover focus + click. Focus is managed by the `Menu` component (list or grid): `setFocus(i)` wraps in lists, not in grids; `guardMs` blocks accept for the first 250 ms after opening (900 ms on results) so a held key does not trigger a button. Any seat can navigate menus; on the intro and results, accept/back from a seat are interpreted as ready/leave (§4.4).

---

## 7. Contextual prompts, glyphs, guide arrow

### 7.1 Prompts

One verb bubble per **local** chef, anchored over the chef's `target` station at 1.85 m (`LevelDiorama.anchor(target, 1.85)`), never for remote chefs.

Show when `chef.target >= 0 && (chef.verb !== 'none' || chef.canChop) && phase !== 'ended'`. Content:

| `ChefView.verb` | Glyph | String key |
|---|---|---|
| `take`, `pickup`, `harvest` | grab | `verb.take` (harvest: `verb.harvest`) |
| `place`, `add`, `scoop` | grab | `verb.place`, `verb.add`, `verb.scoop` |
| `serve` | grab | `verb.serve` |
| `trash` | grab | `verb.trash` |
| `chop` | action | `verb.chop` |
| `wash` | action | `verb.wash` |
| `extinguish` | action | `verb.extinguish` |
| `clear` | action | `verb.clear` |
| `take` with `canChop` | action then grab: two chips `[action] Couper` `[grab] Prendre` | `verb.chop`, `verb.take` |
| holding an item, throw enabled, no target | throw chip near the chef's hands (height 1.5 above the chef) | `verb.throw` (only the first 3 times per player, `pk.seen.v1`) |

Rules:
1. Bubble: dark pill with accent border, glyph chip then text; border tinted with the seat colour; transform `translate(x, y) translate(-50%, -100%)` at integer pixels.
2. Position updates every frame; opacity fades in 0.1 s; hidden when the projected point is off screen or behind the camera.
3. Two chefs targeting the same station: the second bubble is offset 28 px vertically.
4. **Learning rule**: after a verb has been executed successfully 3 times by that seat (counted from sim events `Grabbed`/`Placed`/`ChopDone`/... keyed by verb), its bubble shrinks to the glyph chip only. Setting `hints`: `always` (never shrink), `learning` (default), `never` (no bubbles; the guide arrow and rings still show).
5. A refused action shows a short shake of the bubble and a toast for a reason (`Refused.reason` to `toast.refused.<reason>`: `cannot_place`, `cannot_add`, `burnt` ("Brûlé ! Direction la poubelle"), `hands_full`, `nothing`, `on_fire`, `dirty`, `not_ready`, `locked`, `full`).
6. Remote or replay views never create bubbles.

### 7.2 Glyphs

```ts
export type GlyphAction = 'grab' | 'action' | 'throw' | 'dash' | 'pause' | 'move' | 'accept' | 'back';
export function glyph(action: GlyphAction, device: DeviceKind, lang?: Lang): string;   // text for a chip
export function glyphHtml(action: GlyphAction, device: DeviceKind): HTMLElement;         // chip element (class rchip)
export function setKeyLabels(map: Map<string, string>): void;                            // from navigator.keyboard.getLayoutMap()
```

Gamepad glyphs (text):

| Action | xbox / generic | ps | switch |
|---|---|---|---|
| grab (button 0) | Ⓐ | ✕ | Ⓑ |
| dash (button 1) | Ⓑ | ○ | Ⓐ |
| action (button 2) | Ⓧ | □ | Ⓨ |
| throw (button 3) | Ⓨ | △ | Ⓧ |
| pause | Start | Options | + |
| move | Stick | Stick | Stick |
| accept / back | Ⓐ / Ⓑ | ✕ / ○ | Ⓑ / Ⓐ |

Keyboard glyphs are the **printed key label of the physical code** from `navigator.keyboard.getLayoutMap()` (`KeyW` -> `Z` on AZERTY, `W` on QWERTY); fallback table when the API is missing (Firefox/Safari): QWERTY labels, and if `navigator.language` starts with `fr` and the layout map is unavailable, AZERTY labels for `KeyW -> Z`, `KeyA -> Q`, `KeyQ -> A`, `KeyZ -> W`, `KeyM -> ,` (Default (tunable)). Special labels: `Space` -> `Espace`/`Space`, `ShiftLeft` -> `Maj`/`Shift`, `ShiftRight` -> `Maj D`/`R Shift`, `Enter` -> `Entrée`/`Enter`, `Escape` -> `Échap`/`Esc`, arrows `← ↑ → ↓`, `Slash` -> label from the map.

Per device (scheme A): grab `Espace`, action `E`, throw `F`, dash `Maj`, move `Z Q S D` (shown as `ZQSD` or `WASD`), pause `Échap`. With the mouse active (last input was the mouse), the grab glyph is `Espace / Clic` and the action glyph `E / Clic droit`.

The device shown for a seat is the **last device that produced input for that seat** (`InputManager.lastDevice(seat)`), updated per frame; the legend, bubbles and intro chips re-render on change (`setDevice`).

### 7.3 Guide arrow

Purpose: teach the first order without a tutorial screen (owner decision 6). The arrow is the world marker of `04 §15.1`.

Visibility rules (all must hold):
1. `settings.guideArrow === true` (default true).
2. The level is **unplayed** by this profile for the current bucket (`progress.bestStars(levelId, bucket) === 0`) **or** `level.guide.always` is true.
3. `view.firstOrder === true` (no successful serve yet in this run), or while `level.guide.steps` for later mechanics apply (`step.until` event not yet seen: e.g. level 3 "throw" is guided once).
4. `phase === 'playing'` and not paused.
5. One arrow per local seat that has a computed target, tinted with the seat colour (40 %); arrows of different seats never overlap (`04 §15.1`).

Target computation: a pure function in `hud/guide.ts`:

```ts
export interface GuideRule {
  /** What the seat holds: item def, a def list, 'none', 'any', or a predicate string id. */
  held: { def?: string | string[]; state?: ItemState; contents?: 'empty' | 'nonEmpty' | 'any' } | 'none' | 'any';
  /** Optional condition on the stations (first match wins). */
  when?: { station: string /* def */; item?: { def?: string; state?: ItemState | 'notBurnt'; present?: boolean } };
  /** Target: the first enabled station with this def (and optional item condition). */
  target: { def: string; item?: { def?: string; state?: ItemState | 'notBurnt'; present?: boolean } };
}
export function guideTarget(view: RushView, slot: number, rules: GuideRule[]): number;   // station index or -1; first matching rule wins
```

Level 1 rules (equivalent to the demo's `guideTarget`, order matters):

| # | held | when | target |
|---|---|---|---|
| 1 | `burnt` item (any def, state `burnt`) | | `bin` |
| 2 | `potato` | | `board` with no item |
| 3 | `raw_fries` | | `fryer` with no item |
| 4 | `plate`, `contents` nonEmpty | | `pass` |
| 5 | `plate`, empty | `fryer` has `cooked_fries` not burnt | that fryer |
| 6 | `plate`, empty | no cooked fries | `fryer` with an item (go wait) |
| 7 | none | `fryer` has `cooked_fries` not burnt | `plates` |
| 8 | none | `board` has `raw_fries` | that board |
| 9 | none | `board` has `potato` | that board |
| 10 | none | `fryer` has an item | `plates` |
| 11 | none | | `crate` (dispenser of the first ingredient) |

Levels 2-10 define `level.guide` (`03`): `{ always?: boolean; steps: GuideRule[]; until?: Array<{ event: string }> }`; the default is "first order only". The rules only read the `RushView` (so they work offline and in replays). Disabled stations are skipped (`StationView.enabled`).

---

## 8. Strings and i18n

### 8.1 Rules

1. **Every user-visible text goes through `t()`** (`AGENTS.md` rule 3): HUD, menus, toasts, `aria-label`s, `title` attributes, in-world sign text (drawn on canvas textures included), level and recipe names. No literal user text in `.ts` files (the lint rule `no-ui-literals` flags string literals assigned to `textContent`, `innerHTML`, `title`, `aria-label`, `placeholder` outside `strings/`).
2. **French is the default** (owner decision 8): `defaultLang = 'fr'`. English is supported. The active language is `settings.lang` (`'fr' | 'en'`), initial `'fr'` regardless of the browser language (the bilingual hint of §4.2 tells English speakers). `?lang=en` sets it once.
3. `fr` is the source of truth for the **key set**; `en` is typed `Record<StringKey, string>`, so a missing English key is a compile error.
4. Text lengths: English and French strings for the same key must not differ by more than 60 % in length for button/chip keys (CI warns); layouts must handle +40 % growth (overflow tests, `09`).

### 8.2 API (`apps/client/src/strings.ts`, re-exporting `i18n/`)

```ts
export type Lang = 'fr' | 'en';
export type StringKey = keyof typeof fr;
export let lang: Lang;                                               // current
export function setLang(l: Lang): void;                              // updates `lang`, document.documentElement.lang, localStorage, emits onLangChange
export function onLangChange(cb: (l: Lang) => void): Unsub;
export function t(key: StringKey, vars?: Record<string, string | number>): string;
export function tn(key: StringKey, n: number, vars?: Record<string, string | number>): string;   // plural: looks up `${key}.zero|one|other`
export function tg(key: StringKey, device: DeviceKind, vars?: Record<string, string | number>): string; // fills {grab} {action} {throw} {dash} {pause} {move} with glyph(...)
export function fmtNumber(n: number): string;                        // Intl.NumberFormat(lang)
export function fmtClock(ticks: number): string;                     // m:ss, same in both languages
export function fmtMult(permille: number): string;                   // "1,5" or "1.5"
export function cravingText(promptKey: string): string;              // legacy Mossback, kept
export function applyI18n(root: ParentNode): void;                   // updates every [data-i18n] / [data-i18n-aria] element under root
```

Interpolation: `{name}` replaced by `vars.name`; unknown placeholders stay visible in dev (`console.warn` once) and are stripped in production. Missing key: returns the key (dev: warns). Plurals follow CLDR for these two languages: French `one` for `n` in {0, 1}, English `one` for `n === 1`; categories used: `one`, `other` (`zero` optional). Keys with plural forms are written `levels.stars.one` / `levels.stars.other`. Runtime language switch re-renders the open screen (`onLangChange` -> `screen.refresh()`; static DOM uses `data-i18n="key"`).

### 8.3 Key naming

`<scope>.<thing>[.<variant>]`, lowercase ASCII, dot separated, camelCase inside a segment (`tooFar`). Scopes:

| Scope | Content | Example |
|---|---|---|
| `title.*` | title screen | `title.play` |
| `btn.*` | generic buttons | `btn.resume` |
| `levels.*` | level select UI | `levels.locked` |
| `level.<id>.*` | per-level text; `<id>` is the short id `l01` ... `l10` | `level.l01.name`, `.setting`, `.goal`, `.new` |
| `intro.*`, `countdown.*`, `go.*` | intro card, countdown | `intro.join` |
| `hud.*` | in-game HUD | `hud.streak` |
| `verb.*` | prompt verbs (one per `Verb`) | `verb.chop` |
| `hint.*` | contextual hints | `hint.tooFar` |
| `toast.*` | transient messages | `toast.refused.burnt` |
| `pause.*`, `results.*`, `settings.*`, `online.*`, `lobby.*`, `join.*`, `pad.*`, `kb.*`, `seat.*` | screens and devices | `results.record` |
| `recipe.<id>` | recipe names (`recipe.french_fries`) | |
| `item.<id>` | item names (all ids of `03`) | `item.cooked_fries` |
| `station.<defId>` | station names (aria labels, dev) | `station.fryer` |
| `a11y.*` | screen-reader texts | `a11y.ticketNew` |
| `error.*` | error screens | `error.webgl` |
| `credits.*` | credits | |

The legacy Mossback keys (`title.name`, `tuto.*`, `craving.*`, `tool.*`, `tier.*`, `hl.*`, `results.*` used by `mossback.ts`) **stay exactly as they are** (the demo must not break); new rush keys never reuse a legacy key with a different meaning. Rush keys that exist today keep their name (`rt.title`, `card.*`, `intro.*`, `go.text`, `hud.streak`, `verb.*`, `hint.hurry`, `recipe.french_fries`, `toast.wrong|late|burnt|refused`, `res.*`, `help.*`) and are migrated in one ticket to the scheme above with an alias table `LEGACY_ALIASES` (old key -> new key) checked by CI; `help.walk` is deleted.

### 8.4 Core key list (FR | EN)

Apostrophes are typographic (`’`) in the files; shown straight here. `{n}` etc. are variables.

**Generic and title**

| Key | FR | EN |
|---|---|---|
| `title.name` (new rush key: `title.game`) | Pixel Kitchen | Pixel Kitchen |
| `title.subtitle` | Choisis ton service | Pick your service |
| `title.play` | Jouer | Play |
| `title.online` | Jouer en ligne | Play online |
| `title.settings` | Réglages | Settings |
| `title.credits` | Crédits | Credits |
| `title.classic` | Version classique | Classic version |
| `title.demo` | Mini-démo : le petit-déjeuner de Mossback | Mini demo: Mossback’s Breakfast |
| `btn.resume` | Reprendre | Resume |
| `btn.restart` | Recommencer | Restart |
| `btn.confirm` | Sûr ? Appuie encore | Sure? Press again |
| `btn.replay` | Rejouer | Play again |
| `btn.next` | Niveau suivant | Next level |
| `btn.levels` | Niveaux | Levels |
| `btn.menu` | Menu | Menu |
| `btn.settings` | Réglages | Settings |
| `btn.back` | Retour | Back |
| `btn.sound.on` / `btn.sound.off` | Son : activé / Son : coupé | Sound: on / Sound: off |
| `hint.menu.pad` | {accept} valider · croix directionnelle : choisir | {accept} confirm · d-pad: choose |
| `hint.menu.kb` | Entrée, Espace ou clic : valider · flèches : choisir | Enter, Space or click: confirm · arrows: choose |

**Level select**

| Key | FR | EN |
|---|---|---|
| `levels.title` | Choisis ton service | Pick your service |
| `levels.best` | Record : {n} | Best: {n} |
| `levels.locked` | Obtiens {n} sur le niveau {k} | Earn {n} on level {k} |
| `levels.stars.one` / `.other` | {n} étoile / {n} étoiles | {n} star / {n} stars |
| `levels.new` | Nouveau | New |
| `levels.online` | Jouer en ligne | Play online |
| `levels.chefs.one` / `.other` | {n} chef / {n} chefs | {n} chef / {n} chefs |

**Levels** (`level.<id>.name` / `.setting`; `.goal` and `.new` are written with each level in `08`; level 1 given below)

| Key | FR | EN |
|---|---|---|
| `level.l01.name` | Le Kiosque du Port | The Harbour Kiosk |
| `level.l01.setting` | Frites, tickets et mer bleue | Fries, tickets and blue sea |
| `level.l01.goal` | Sers un maximum de frites avant la fin du temps ! | Serve as many fries as you can before time runs out! |
| `level.l01.new` | Prends, coupe, fris, dresse, sers. | Grab, chop, fry, plate, serve. |
| `level.l02.name` | Le Food Truck du Festival | The Festival Food Truck |
| `level.l03.name` | Le Diner de la Route 66 | The Route 66 Diner |
| `level.l04.name` | Le Bar à Smoothies de la Plage | The Beach Smoothie Bar |
| `level.l05.name` | La Pizzeria sur les Toits | The Rooftop Pizzeria |
| `level.l06.name` | La Friterie du Bateau-Mouche | The River Boat Fryhouse |
| `level.l07.name` | Le Marché de Nuit | The Night Market |
| `level.l08.name` | Le Wagon-Restaurant | The Dining Car |
| `level.l09.name` | Le Bistrot de la Serre | The Greenhouse Bistro |
| `level.l10.name` | Le Banquet du Géant | The Giant’s Banquet |
| `level.lNN.setting` | one short line each (written in `08`, e.g. l02 "Un camion, une scène, la foule", l03 "Néons et désert") | the English counterpart |

**Intro, countdown, HUD**

| Key | FR | EN |
|---|---|---|
| `intro.join` | {join} sur une manette pour rejoindre | {join} on a controller to join |
| `intro.joinKb` | Clavier : Espace ou Entrée | Keyboard: Space or Enter |
| `intro.go` | Appuie pour démarrer | Press to start |
| `intro.ready` | Prêt | Ready |
| `intro.waiting` | En attente des autres chefs… | Waiting for the other chefs… |
| `intro.bucket` | Mode {name} | {name} mode |
| `seat.name` | Chef {n} | Chef {n} |
| `go.text` | C’est parti ! | Let’s go! |
| `hud.pts` | {n} pts | {n} pts |
| `hud.streak` | Série ×{m} | Streak ×{m} |
| `hud.time` | Temps | Time |
| `hint.hurry` | Vite ! | Hurry! |
| `hint.tooFar` | Trop loin | Too far |
| `hint.throw` | Lancer par-dessus le comptoir | Throw it across the counter |
| `help.grab` | Prendre / Poser / Servir | Take / Place / Serve |
| `help.action` | Action (maintenir) | Action (hold) |
| `help.throw` | Lancer | Throw |
| `help.dash` | Dash | Dash |
| `help.move` | Se déplacer | Move |

**Verbs** (prompts)

| Key | FR | EN |
|---|---|---|
| `verb.take` | Prendre | Take |
| `verb.place` | Poser | Place |
| `verb.add` | Ajouter | Add |
| `verb.scoop` | Servir dans l’assiette | Scoop onto plate |
| `verb.serve` | Servir | Serve |
| `verb.trash` | À la poubelle | Bin it |
| `verb.chop` | Couper | Chop |
| `verb.wash` | Laver | Wash |
| `verb.extinguish` | Éteindre | Extinguish |
| `verb.harvest` | Cueillir | Harvest |
| `verb.clear` | Vider | Clear |
| `verb.throw` | Lancer | Throw |
| `verb.dash` | Dash | Dash |

**Toasts**

| Key | FR | EN |
|---|---|---|
| `toast.wrong` | Mauvais plat ! −{n} | Wrong dish! −{n} |
| `toast.late` | Ticket expiré ! −{n} | Ticket expired! −{n} |
| `toast.burnt` | Brûlé ! Direction la poubelle | Burnt! Into the bin |
| `toast.fire` | Feu ! Attrape l’extincteur | Fire! Grab the extinguisher |
| `toast.refused.cannot_place` | On ne peut pas poser ça ici | Can’t place that here |
| `toast.refused.cannot_add` | Ça ne va pas avec ça | That doesn’t go with this |
| `toast.refused.burnt` | Cet article est brûlé | That item is burnt |
| `toast.refused.hands_full` | Tes mains sont pleines | Your hands are full |
| `toast.refused.nothing` | Rien à faire ici | Nothing to do here |
| `toast.refused.on_fire` | Ça brûle ! | It’s on fire! |
| `toast.refused.dirty` | C’est sale : lave-le d’abord | It’s dirty: wash it first |
| `toast.refused.not_ready` | Pas encore prêt | Not ready yet |
| `toast.refused.locked` | Indisponible | Unavailable |
| `toast.refused.full` | Plein | Full |
| `toast.padConnected` | Manette {n} connectée | Controller {n} connected |

**Pause and results**

| Key | FR | EN |
|---|---|---|
| `pause.title` | Pause | Paused |
| `pause.by` | Pause par {name} | Paused by {name} |
| `pause.online` | La partie continue en ligne | The game continues online |
| `pause.padLost` | Manette {n} déconnectée : reconnecte-la ou appuie sur {accept} | Controller {n} disconnected: reconnect it or press {accept} |
| `results.title` | Service terminé | Service over |
| `results.score` | Score | Score |
| `results.record` | Nouveau record ! | New record! |
| `results.best` | Record : {n} | Best: {n} |
| `results.served` | Plats servis | Dishes served |
| `results.expired` | Tickets expirés | Tickets expired |
| `results.wrong` | Mauvais plats | Wrong dishes |
| `results.streak` | Meilleure série | Best streak |
| `results.next` | Prochaine étoile : {n} | Next star: {n} |
| `results.max` | Trois étoiles ! | Three stars! |
| `results.unlocked` | Niveau {n} débloqué : {name} | Level {n} unlocked: {name} |
| `results.verified` | Score vérifié | Score verified |
| `results.unverified` | Score non classé | Unranked score |
| `results.bucket.solo` / `.duo` / `.squad` / `.party` | Solo / Duo / Escouade / Fête | Solo / Duo / Squad / Party |

**Online** (strings used by `06`)

| Key | FR | EN |
|---|---|---|
| `online.title` | Jouer en ligne | Play online |
| `online.nickname` | Pseudo | Nickname |
| `online.create` | Créer une salle | Create a room |
| `online.join` | Rejoindre avec un code | Join with a code |
| `online.code` | Code de la salle | Room code |
| `online.invite` | Copier le lien d’invitation | Copy invite link |
| `online.copied` | Lien copié | Link copied |
| `online.waitHost` | En attente de l’hôte | Waiting for the host |
| `lobby.title` | Salle {code} | Room {code} |
| `lobby.ready` | Prêt | Ready |
| `lobby.start` | Lancer la partie | Start |
| `lobby.seats` | Chefs sur cet écran | Chefs on this screen |
| `lobby.lagging` | {name} a du mal à suivre… | {name} is lagging… |
| `lobby.left` | {name} est parti | {name} left |
| `join.padUnsupported` | Manette non reconnue | Controller not recognised |

**Settings and accessibility** (labels; one `settings.<id>` and `settings.<id>.help` per setting of §10.1)

| Key | FR | EN |
|---|---|---|
| `settings.title` | Réglages | Settings |
| `settings.lang` | Langue | Language |
| `settings.audio` | Audio | Audio |
| `settings.volMaster` / `volSfx` / `volMusic` / `volAmbience` | Général / Effets / Musique / Ambiance | Master / Effects / Music / Ambience |
| `settings.art` | Style graphique | Art style |
| `settings.art.voxel` / `.smooth` | Voxel / Lisse | Voxel / Smooth |
| `settings.art.restart` | Redémarrage nécessaire | Restart needed |
| `settings.quality` | Qualité | Quality |
| `settings.shake` | Secousses d’écran | Screen shake |
| `settings.reducedMotion` | Mouvement réduit | Reduced motion |
| `settings.highContrast` | Contraste élevé | High contrast |
| `settings.textScale` | Taille du texte | Text size |
| `settings.symbols` | Symboles des joueurs | Player symbols |
| `settings.hints` | Aides à l’écran | On-screen hints |
| `settings.hints.always` / `.learning` / `.never` | Toujours / Quand j’apprends / Jamais | Always / While learning / Never |
| `settings.guideArrow` | Flèche de guidage | Guide arrow |
| `settings.holdToggle` | Action en bascule (pas besoin de maintenir) | Toggle Action (no need to hold) |
| `settings.vibration` | Vibration | Vibration |
| `settings.patience` | Patience prolongée (score non classé) | Extended patience (unranked score) |
| `settings.clutter` | Interface allégée | Less clutter |
| `settings.reset` | Réinitialiser | Reset |
| `settings.export` | Exporter ma progression | Export my progress |
| `a11y.ticketNew` | Nouvelle commande : {recipe} | New order: {recipe} |
| `a11y.served` | {recipe} servi : {n} points | {recipe} served: {n} points |
| `a11y.expired` | Commande expirée : {recipe} | Order expired: {recipe} |
| `a11y.burning` | Attention, ça brûle | Warning, something is burning |
| `a11y.fire` | Un feu a pris | A fire started |
| `a11y.countdown` | {n} | {n} |
| `a11y.canvas` | Cuisine de jeu : {level} | Game kitchen: {level} |
| `error.webgl` | Ton navigateur ne peut pas afficher le jeu (WebGL requis). | Your browser can’t display the game (WebGL required). |

**Recipes** (13): `recipe.french_fries` Frites / Fries; `recipe.hamburger` Hamburger / Hamburger; `recipe.cheeseburger_combo` Cheeseburger et frites / Cheeseburger and fries; `recipe.chicken_tenders_fries` Poulet croustillant et frites / Chicken tenders and fries; `recipe.onion_rings` Rondelles d’oignon / Onion rings; `recipe.grilled_cheese_sandwich` Croque au fromage / Grilled cheese; `recipe.blt_sandwich` Sandwich BLT / BLT sandwich; `recipe.cheese_omelette` Omelette au fromage / Cheese omelette; `recipe.pancakes` Pancakes / Pancakes; `recipe.pizza_margherita` Pizza margherita / Margherita pizza; `recipe.salad` Salade / Salad; `recipe.smoothie` Smoothie / Smoothie; `recipe.fruit_yogurt_bowl` Bol fruits et yaourt / Fruit and yogurt bowl. **Items** (`item.<id>`, all 48 ids of `03`) and **stations** (`station.<defId>`) follow the same rule; their FR/EN values live in `strings/fr.ts` and `strings/en.ts` and are checked for completeness by CI against the content ids.

### 8.5 CI checks (`tools/check-strings.ts`, part of `pnpm check`)

1. Key parity `fr` vs `en` (also enforced by the type).
2. Placeholders: the set of `{vars}` in `fr[key]` equals that of `en[key]`.
3. Every `recipe.<id>`, `item.<id>`, `station.<id>`, `level.<id>.name|setting|goal|new` exists for every content id (`rushRecipes`, `rushItems`, `rushStations`, `LEVEL_ORDER`).
4. Plural keys come in `.one` + `.other` pairs.
5. No unused keys (scan `t('...')`, `tn('...')`, `tg('...')`, `data-i18n`), allow-list for dynamic prefixes (`toast.refused.`, `verb.`, `level.`, `recipe.`, `item.`, `results.bucket.`).
6. No literal UI text rule (`no-ui-literals`).
7. Length warning: `en`/`fr` ratio outside [0.4, 1.6] on `btn.*`, `verb.*`, `hud.*`.

---

## 9. Audio

### 9.1 Engine (`audio/engine.ts`)

Procedural WebAudio only (no files), ported from `audio.ts` and extended. The context is created on the first user input (autoplay policy): `AudioEngine.unlock()` is called by the first `keydown`, `pointerdown`, or gamepad button.

```
sources ─▶ [sfx bus | ui bus | amb bus | music bus] ─▶ master gain ─▶ DynamicsCompressor ─▶ destination
                                       ▲ ducking: music gain -6 dB for 0.3 s on bell/served
```

| Item | Value |
|---|---|
| Master volume | `settings.volMaster` (default 0.8) x base 0.3 (exists: `volume = 0.3`) |
| Buses | `sfx` (`volSfx` 1.0), `ui` (follows `volSfx`), `amb` (`volAmbience` 0.7), `music` (`volMusic` 0.6); each a `GainNode`; mute sets master to 0 with a 30 ms ramp |
| Compressor | threshold -14 dB, knee 12, ratio 4, attack 0.003, release 0.25 |
| Noise buffers | 2 s each: white, pink (Voss-McCartney), brown (integrated white, leaky 0.02), created once on unlock, shared |
| Polyphony | max 24 simultaneous one-shot voices; when exceeded, the lowest-priority oldest voice is stopped with a 10 ms ramp |
| Priority | 3 = ticket/serve/fire/timeup, 2 = cook/burn/chop_done, 1 = grab/place/dash, 0 = footstep/ui |
| Cooldown | per sound `cooldownMs` (below); a call within the cooldown is dropped (except priority 3) |
| Variation | `rate`/detune jitter +-3 % on repeated sounds (`Math.random` is allowed in audio), `chop_hit` cycles 3 pitches |
| Panning | positional sounds take `pan = clamp(ndcX * 0.6, -0.6, 0.6)` from `RenderHost.project(station)`; created with `StereoPannerNode` |
| Pause | `suspend()` the context when the document is hidden; the sizzle/ambience/music gains duck to 0 while the pause overlay is open (they resume on resume) |
| Unlock failure | if the context stays `suspended`, retry on every input until running |

```ts
export type SoundId = typeof SOUND_IDS[number];
export interface PlayOpts { pan?: number; gain?: number; rate?: number }
export class AudioEngine {
  unlock(): void;
  play(id: SoundId, opts?: PlayOpts): void;
  setBusVolume(bus: 'master' | 'sfx' | 'music' | 'amb', v: number): void;
  setMuted(m: boolean): void; toggleMuted(): boolean; get isMuted(): boolean;
  setLoop(id: LoopId, level: number): void;          // 0..1 continuous loops (sizzle, fire, wash, spray, waves, wind)
  setAmbience(levelId: string | null): void;         // §9.3
  music: MusicEngine;                                // §9.4
  tick(dt: number): void;                            // ambience gull scheduling etc.
}
```

Recipe format (`audio/recipes.ts`):

```ts
type Env = { attack?: number; decay: 'exp' | 'lin' };            // peak gain at `at + attack`, then decay to 0.001 (exp) or 0 (lin) over `dur`
type Layer =
  | { k: 'osc'; wave: OscillatorType; f: [from: number, to: number]; curve?: 'exp' | 'lin'; at?: number; dur: number; gain: number; env: Env; detune?: number }
  | { k: 'noise'; color: 'white' | 'pink' | 'brown'; filter?: { type: BiquadFilterType; f: [number, number]; q?: number }; at?: number; dur: number; gain: number; env: Env }
  | { k: 'seq'; wave: OscillatorType; notes: Array<[freq: number, at: number, dur: number]>; gain: number; env: Env; slideTo?: number };
interface SoundRecipe { id: SoundId; bus: 'sfx' | 'ui'; layers: Layer[]; cooldownMs: number; voices: number; priority: 0 | 1 | 2 | 3; pan?: boolean }
```

`f: [a, b]` is a frequency ramp from `a` to `b` over `dur` (exponential unless `curve: 'lin'`). `attack` default 0.003 s. All `gain` values are relative to the bus (final level = gain x bus x master).

### 9.2 Sound list and recipes

"exists" = same numbers as `audio.ts` today (keep them exactly). Others are `Default (tunable)`.

**UI (bus `ui`)**

| Id | When | Recipe | cd ms |
|---|---|---|---|
| `ui_move` | focus change | osc sine 520 -> 560, dur 0.04, gain 0.25 | 40 |
| `ui_accept` | accept | seq square [660 @0 0.05, 990 @0.05 0.08], gain 0.2 | 60 |
| `ui_back` | back | osc triangle 520 -> 330 lin, dur 0.1, gain 0.3 | 60 |
| `ui_error` | locked, refused menu | osc sawtooth 150 -> 100 lin, dur 0.25, gain 0.35 (this is also `error`) | 100 |
| `ui_join` | seat joins | seq triangle [523 @0 0.07, 784 @0.07 0.12], gain 0.35 | 100 |
| `ui_leave` | seat leaves | seq triangle [784 @0 0.07, 523 @0.07 0.12], gain 0.3 | 100 |
| `ui_ready` | ready ticked | osc sine 880 -> 1320, dur 0.1, gain 0.3 | 80 |
| `ui_toggle` | settings toggle | osc square 700, dur 0.03, gain 0.15 | 50 |
| `ui_pause` | pause open | seq triangle [440 @0 0.06, 330 @0.06 0.1], gain 0.3 | 120 |
| `ui_resume` | pause close | seq triangle [330 @0 0.06, 440 @0.06 0.1], gain 0.3 | 120 |

**Run flow (bus `sfx`)**

| Id | When | Recipe | cd ms | pr |
|---|---|---|---|---|
| `tick` (exists) | countdown number, last 10 s, burn warning | osc square 1500, dur 0.05, gain 0.12, exp decay to 0.01 over 0.04 | 0 | 2 |
| `countdown_go` | `Go` | exists `happy`: seq square [523.25 @0 0.12, 659.25 @0.1 0.12, 783.99 @0.2 0.12, 1046.5 @0.3 0.45], gain 0.12 | 0 | 3 |
| `happy` (exists) | serve, 3-star | as `countdown_go` | 0 | 3 |
| `sad` (exists) | `TimeUp` with 0 stars | seq sawtooth [196 @0 0.28 slide->170, 155.56 @0.3 0.55 slide->110], gain 0.18 | 0 | 3 |
| `star_1` / `star_2` / `star_3` | results stars | seq triangle: 1: [784 @0 0.2]; 2: [784, 988 @0.12]; 3: [784, 988, 1175 @0.24], each 0.25 s, gain 0.3 + sparkle noise (white highpass 6000, dur 0.15, gain 0.08) | 0 | 3 |
| `record` | new record | seq square [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568] step 0.09, last note 0.6 s, gain 0.14 | 0 | 3 |
| `timeup` | `TimeUp` | noise white bandpass 800 q 1 dur 0.5 gain 0.2 (buzzer) + osc square 220 -> 110 dur 0.5 gain 0.15 | 0 | 3 |

**Kitchen (bus `sfx`, positional unless noted)**

| Id | When | Recipe | cd ms | pr |
|---|---|---|---|---|
| `pop` (exists) | `Grabbed`, `ChopDone`, `Dash` start | sine 600 -> 1200, dur 0.1, gain 1.0 -> 0.01 (exp) | 30 | 1 |
| `place` (exists) | `Placed`, `Plated`, `CookStart` | triangle 300 -> 100 lin, dur 0.1, gain 0.8 -> 0.01 lin | 30 | 1 |
| `plate_clink` | `Plated` (add on top of `place`) | osc triangle 2400 -> 2000 dur 0.12 gain 0.15 + osc sine 3200 dur 0.08 gain 0.08 at 0.02 | 60 | 1 |
| `chop_hit` (exists `chop`) | `ChopHit` (every 8 ticks) | noise white, from a random offset, dur 0.1, gain 0.5 -> 0.01 exp; cycles pitch via a highpass 900 / 1200 / 1500 | 100 | 2 |
| `chop_done` | `ChopDone` | `pop` + seq triangle [880 @0 0.06, 1175 @0.06 0.1], gain 0.2 | 100 | 2 |
| `cook_start` | `CookStart` (fryer) | noise pink bandpass 2500 q 0.8, dur 0.35, gain 0.0001 -> 0.3 -> 0.01 | 150 | 2 |
| `cooked` / `ding` (exists) | `Cooked`, `Served` | triangle 880 -> 1318.5 (jump at 0.09), dur 0.9, gain 0.55 -> 0.01 exp | 100 | 3 |
| `burn_warn` | `BurnWarning` | seq square [1500 @0 0.05, 1500 @0.12 0.05, 1500 @0.24 0.05], gain 0.12 (3 fast beeps) | 400 | 2 |
| `burnt` | `Burnt` | `error` + noise brown lowpass 600 dur 0.5 gain 0.3 | 300 | 3 |
| `error` (exists) | `WrongDish`, `Refused`, `TicketExpired` | sawtooth 150 -> 100 lin, dur 0.3, gain 0.5 -> 0.01 lin | 120 | 3 |
| `hiss` (exists) | `Trashed` | noise white highpass 4500, dur 0.5, gain 0.0001 -> 0.35 (0.05 s) -> 0.01 (0.45 s) | 100 | 1 |
| `bin_clunk` | `Trashed` lid | osc triangle 160 -> 70 dur 0.12 gain 0.4 | 100 | 1 |
| `dash` | `Dash` | noise white bandpass 1200 -> 3200 (filter sweep over 0.18 s) q 0.9, dur 0.2, gain 0.25 | 150 | 1 |
| `throw` | `Threw` | noise pink bandpass 600 -> 1800 dur 0.25 gain 0.25 + osc sine 400 -> 900 dur 0.2 gain 0.1 | 120 | 1 |
| `catch` | `Caught` | `place` + osc sine 700 dur 0.05 gain 0.2 | 80 | 1 |
| `thud` | `ThrowLanded` on the floor | osc sine 120 -> 50 dur 0.15 gain 0.5 + noise brown dur 0.1 gain 0.2 | 80 | 1 |
| `bump` | `Shoved` | osc square 140 -> 80 lin dur 0.15 gain 0.3 | 150 | 2 |
| `footstep` | chef walk cycle zero crossing | noise brown lowpass 500, dur 0.04, gain 0.08, +-20 % rate; local seats only, other chefs gain x0.4 | 180 | 0 |
| `wash_loop` (loop) | washing | noise white bandpass 3500 q 0.6 gain 0.12 + lfo 6 Hz on gain depth 0.05 | | |
| `wash_done` | `Washed` | `sparkle` seq sine [1760 @0 0.06, 2093 @0.05 0.08] gain 0.2 | 100 | 2 |
| `fire_ignite` | `Fire` | noise brown lowpass 900 dur 0.6 gain 0.0001 -> 0.5 -> 0.01 + osc sawtooth 90 -> 60 dur 0.4 gain 0.15 | 300 | 3 |
| `fire_loop` (loop) | any `fire > 0` | noise brown lowpass 700 gain 0.18 with random crackle: every 80-200 ms a noise burst (white highpass 3000 dur 0.02 gain 0.12) | | |
| `spray_loop` (loop) | extinguishing | noise white highpass 2500 gain 0.22 | | |
| `extinguished` | `Extinguished` | noise white highpass 4000 dur 0.6 gain 0.3 decaying + seq triangle [523 @0.1 0.1, 659 @0.2 0.1] gain 0.15 | 200 | 3 |
| `sizzle_loop` (exists) | fryer/stove cooking count | noise white bandpass 3200 q 0.7, gain `min(0.32, count * 0.1)` smoothed `setTargetAtTime(..., 0.15)` | | |
| `blender_loop` (loop) | blender running | osc sawtooth 180 gain 0.08 + noise white bandpass 900 gain 0.1 | | |
| `harvest` | `Harvested` | `pop` + noise pink highpass 3000 dur 0.08 gain 0.1 | 80 | 1 |
| `dumbwaiter` | travel start / arrive | osc triangle 220 -> 330 dur 0.4 gain 0.15 / ding at arrival (`bell_small`) | 200 | 1 |
| `conveyor_loop` (loop) | conveyor with items | noise brown lowpass 400 gain 0.06 + osc square 40 gain 0.04 | | |
| `twist_warn` | `TwistTelegraph` | seq square [440 @0 0.12, 440 @0.2 0.12, 660 @0.4 0.3] gain 0.15 | 1000 | 3 |

**Tickets and customers (bus `sfx`)**

| Id | When | Recipe | cd ms | pr |
|---|---|---|---|---|
| `bell` (exists) | `TicketNew` | seq triangle [1568 @0 0.5], gain 0.3; plus sine 2093 @0.02 dur 0.6 gain 0.2 | 150 | 3 |
| `served` | `Served` | `ding` + `happy` (the client plays both, as the demo) | 100 | 3 |
| `streak_up` | streak multiplier step | seq square rising by one semitone per step from 523.25: n notes (n = step index 1..5) step 0.05, gain 0.1 | 100 | 2 |
| `wrong_dish` | `WrongDish` | `error` + red flash | 120 | 3 |
| `ticket_expired` | `TicketExpired` | seq sawtooth [330 @0 0.15, 247 @0.15 0.25], gain 0.2 | 150 | 3 |
| `customer_happy` | customer celebrates | seq sine [880 @0 0.06, 1175 @0.07 0.1], gain 0.15 (chirp) | 120 | 1 |
| `customer_angry` | customer turns `angry` | osc sawtooth 260 -> 190 dur 0.2 gain 0.12 | 800 | 1 |
| `gull` (exists) | ambience schedule | two sine chirps: [0.00: 1700 -> 2500 lin 0.2 s] and [0.22: 2300 -> 1500 lin 0.2 s], gain 0.0001 -> 0.05 (0.04 s) -> 0.001 (0.22 s) | 0 | 0 |

### 9.3 Ambience beds (bus `amb`, loop per level, cross-fade 0.6 s)

| Level | Bed | Recipe |
|---|---|---|
| 1 harbour (exists) | waves + gulls | noise lowpass 650 Hz gain 0.05, LFO 0.11 Hz depth 0.035; gull every 9 + rand * 14 s |
| 2 festival | crowd murmur + distant bass | noise pink bandpass 700 q 0.5 gain 0.05 with LFO 0.3 Hz; osc sine 55 pulsing at the music BPM gain 0.02 (muffled bass) |
| 3 diner | desert wind + neon hum | noise pink highpass 400 lowpass 1800 gain 0.04 LFO 0.07 Hz; osc sine 100 gain 0.015; occasional truck pass (noise brown sweep 8 s every 40 s) |
| 4 beach | waves + gentle gulls | as level 1 with lowpass 800 and gull every 14-30 s |
| 5 rooftop night | city hush + crickets | noise pink lowpass 500 gain 0.03; crickets: osc sine 4300 gated at 12 Hz bursts every 3 s gain 0.012 |
| 6 river boat | water lap + engine | noise brown lowpass 500 gain 0.05 LFO 0.2; osc sawtooth 62 lowpass 200 gain 0.02; bridge pass: noise sweep 2 s on `TwistTelegraph` |
| 7 night market | crowd + sizzle bed | noise pink bandpass 900 q 0.6 gain 0.06, random laughter chirps (sine 600-900) every 6-12 s gain 0.01 |
| 8 train | track rumble | noise brown lowpass 300 gain 0.06 with clack: osc square 90 for 0.02 s every 0.55 s gain 0.05; tunnel: lowpass 300 -> 120 and gain x1.5 while the twist flag `tunnel` |
| 9 greenhouse | birds + drip | sine chirps (2000-3200 Hz, 0.06 s) every 1-4 s gain 0.02; drips (sine 1200 -> 700 dur 0.05) every 2-5 s gain 0.03; sprinkler: noise white highpass 3000 gain 0.1 during the twist |
| 10 banquet | hall reverb + giant steps | noise brown lowpass 250 gain 0.04; giant footstep (osc sine 45 dur 0.3 gain 0.15) every 12 s |

### 9.4 Adaptive music (`audio/music.ts`)

A procedural step sequencer (no samples). Scheduler: `setInterval` 25 ms, lookahead 0.12 s, 16 steps per bar (sixteenth notes), swing 0 (levels 2, 7 swing 0.12).

```ts
export interface MusicMood { id: string; bpm: number; root: number /* midi */; scale: number[] /* semitone offsets */; bass: string; arp: string; lead: string; drums: string; wave: { bass: OscillatorType; arp: OscillatorType; lead: OscillatorType }; swing?: number }
```

Pattern strings: 16 characters per bar, `.` = rest, digits `1-7` = scale degree, `-` = hold; several bars separated by `|`.

Instruments (exact):
- Kick: sine 130 -> 45 over 0.12 s, gain 0.5 -> 0.001; on drum string `K`.
- Snare: noise white bandpass 1800 q 0.7 dur 0.1 gain 0.25 + triangle 190 dur 0.08 gain 0.12; `S`.
- Hat: noise white highpass 7000 dur 0.035 gain 0.08; `h`.
- Bass: `bass.wave` through lowpass 500, gain 0.25, note dur = step length x 1.8.
- Arp: `arp.wave` gain 0.1, dur step x 0.8, octave +1.
- Lead: `lead.wave` gain 0.08, vibrato 5 Hz depth 6 cents, octave +1.

Intensity (driven each frame by `music.setIntensity(i)`, 0..3, changes at the next bar line):

| i | Condition (client computes) | Layers |
|---|---|---|
| 0 | menus, countdown, intro | bass + hat |
| 1 | playing, <= 1 active ticket | + kick |
| 2 | playing, >= 2 active tickets or streak >= 2 | + arp + snare |
| 3 | `timeLeftTicks <= 900` (last 30 s) or any `fire` | + lead; tempo x 1.06 |

`timeLeftTicks <= 300` (last 10 s): tempo x 1.10 and a rising filter on the arp. Ducking: the music bus drops -4 dB for 0.25 s on `TicketNew` and -6 dB for 0.4 s on `Served`. Results: stop the loop at the next beat, play the stars stinger (`star_n`/`record`), then a calm 4-bar loop (intensity 0 of the level mood at 0.85 x bpm). Title and level select: a calm loop of mood `title` (bpm 92).

Level moods (Default (tunable); intent per `14-audio-and-music.md`: energetic, not stressful, 100-128 BPM service tempo):

| Mood | bpm | root (MIDI) | scale | waves bass/arp/lead | feel |
|---|---|---|---|---|---|
| `title` | 92 | 62 (D) | major pentatonic `0,2,4,7,9` | tri / sine / sine | calm and sunny |
| 1 `harbour` | 108 | 60 (C) | major `0,2,4,5,7,9,11` | tri / square / square | breezy |
| 2 `festival` | 118 | 57 (A) | mixolydian `0,2,4,5,7,9,10`, swing 0.12 | saw / square / saw | party |
| 3 `diner` | 112 | 55 (G) | blues-ish `0,3,5,6,7,10` | saw / tri / square | twangy shuffle |
| 4 `beach` | 104 | 62 (D) | lydian `0,2,4,6,7,9,11` | tri / sine / tri | chill, sunset |
| 5 `rooftop` | 110 | 64 (E) | dorian `0,2,3,5,7,9,10` | tri / square / sine | warm night |
| 6 `river` | 106 | 58 (Bb) | major `0,2,4,5,7,9,11` | tri / tri / square | lazy cruise, steady |
| 7 `market` | 120 | 52 (E, low) | phrygian dominant `0,1,4,5,7,8,10`, swing 0.12 | saw / square / tri | busy, spicy |
| 8 `train` | 124 | 60 (C) | minor `0,2,3,5,7,8,10` | saw / square / square | driving, rhythmic (clack on the 8ths) |
| 9 `greenhouse` | 100 | 65 (F) | major pentatonic | sine / tri / sine | airy |
| 10 `banquet` | 116 | 50 (D, low) | harmonic minor `0,2,3,5,7,8,11` | saw / square / saw | big and playful |

Each mood has 4 bars of pattern per layer in `audio/moods.ts` (example for `harbour`: bass `1.1.5.1.1.1.5.4.|` repeated with degree changes `4`, `5`, `6`; arp `1357135713571357`; drums `K...S...K.K.S...` hats on every `h` offbeat). Patterns follow these rules: bass on beats 1 and 3 plus an offbeat; arp loops chord tones; lead plays a 2-bar motif repeated; no pattern longer than 4 bars.

---

## 10. Settings and persistence

### 10.1 `localStorage` keys (all prefixed `pk.`; every read is guarded, every write try/catch, in-memory fallback when storage is unavailable)

| Key | Content | Notes |
|---|---|---|
| `pk.settings.v1` | `Settings` JSON (below) | validated with zod on read; unknown fields dropped; invalid -> defaults |
| `pk.progress.v1` | `Progress` JSON | per level per bucket `{ best, stars }` |
| `pk.bindings.v1` | `{ kbA?: Partial<Bindings>; kbB?: Partial<Bindings> }` | overrides of §6.3 |
| `pk.seen.v1` | `{ verbs: Record<string, number>; langHint?: true; mouseHint?: true; padHint?: true }` | counters for the learning rule (§7.1) |
| `pk.art` | `'voxel' \| 'smooth'` | read by the renderer (`04 §4.4`); mirrors `settings.art` |
| `pk.identity.v1` | `{ nickname, token, ... }` | owned by `07` (nickname, token, recovery codes); `05` only reads `nickname` |
| `pk.best.<levelId>.<bucket>` | score string | **legacy** (exists); migrated once into `pk.progress.v1` (stars recomputed from the level thresholds) and then left untouched |
| `pk.lastLevel` | levelId | focus on the level select |
| `pk.lastSeats` | `{ sources: InputSourceDesc[] }` | suggestion only (never auto-joins) |

```ts
export interface Settings {
  v: 1;
  lang: 'fr' | 'en';                        // default 'fr'
  volMaster: number; volSfx: number; volMusic: number; volAmbience: number;   // 0..1 defaults 0.8, 1.0, 0.6, 0.7
  muted: boolean;                            // default false
  art: 'voxel' | 'smooth';                   // default 'voxel'
  quality: 'auto' | 'low' | 'medium' | 'high'; // default 'auto'
  screenShake: boolean;                      // default true
  reducedMotion: 'auto' | 'on' | 'off';      // default 'auto' (follows prefers-reduced-motion)
  highContrast: 'auto' | 'on' | 'off';       // default 'auto' (prefers-contrast: more)
  textScale: 1 | 1.25 | 1.5;                 // default 1
  symbols: 'auto' | 'always';                // default 'always' (player emblems visible on chefs and HUD)
  hints: 'always' | 'learning' | 'never';    // default 'learning'
  guideArrow: boolean;                       // default true
  holdToggle: boolean;                       // default false
  vibration: boolean;                        // default true
  mouseHint: boolean;                        // default true (hover ring + tooFar hint)
  extendedPatience: boolean;                 // default false; true marks runs unranked (RunConfig flag `assist`, see 07)
  lessClutter: boolean;                      // default false (hides order bubbles, ambient particles x0.5)
  touch: boolean;                            // default false (reserved)
}
export interface Progress { v: 1; levels: Record<string, Partial<Record<'solo' | 'duo' | 'squad' | 'party', { best: number; stars: 0 | 1 | 2 | 3 }>>> }
```

```ts
export const store: { get(k: string): string | null; set(k: string, v: string): void; remove(k: string): void };   // never throws
export function loadSettings(): Settings;       // merge defaults, validate
export function saveSettings(s: Settings): void; // debounced 300 ms
export const progress: {
  get(levelId: string, bucket: BucketId): { best: number; stars: 0 | 1 | 2 | 3 };
  record(levelId: string, bucket: BucketId, score: number, stars: number): { newRecord: boolean; unlocked: string[] };
  bestStars(levelId: string, bucket?: BucketId): number;      // max over buckets when omitted
  isUnlocked(levelId: string): boolean;                       // uses level.unlock
  migrateLegacy(): void;                                      // pk.best.* -> pk.progress.v1, once
};
```

Cross-tab: a `storage` event reloads settings and applies them. Reset buttons clear only the keys they own. Export produces `pixel-kitchen-progress.json` (progress + settings, no identity token).

### 10.2 Applying settings

| Setting | Applied by |
|---|---|
| `lang` | `setLang` + `applyI18n` |
| vol* / muted | `AudioEngine.setBusVolume/setMuted` immediately |
| `art` | writes `pk.art`; shows `settings.art.restart` |
| `quality` | `RenderHost.setQuality` (immediate except `auto`, which applies at the next level load, `04 §16`) |
| `screenShake`, `reducedMotion` | `CameraRig` shake gate, particle counts x0.4, UI animations off (`<html data-motion="reduced">`), water amplitude x0.4, lamp pulse constant, guide arrow still |
| `highContrast` | `<html data-contrast="high">` CSS variables (§11) |
| `textScale` | `<html style="font-size: calc(16px * var(--ts))">` and HUD sizes in `rem`/`clamp` |
| `symbols` | emblem decal on chefs, symbol on seat chips |
| `hints`, `guideArrow`, `mouseHint` | prompts and guide logic (§7) |
| `holdToggle` | `InputManager.sample` latching |
| `vibration` | `InputManager.rumble` gate |
| `extendedPatience` | `RunConfig.assist = true` (ticket time x1.25), results show `results.unverified` (`07`) |

---

## 11. Accessibility

1. **Colour is never the only cue.**
   - Players: slot colour + emblem (circle, triangle, square, star, diamond, heart) on the chef's apron, seat chips, prompts and results (`04 §3.3`).
   - Tickets: low state adds a clock badge, critical adds a `!` badge and a shake; the time bar also shrinks.
   - Cooking rings: icon inside (check, warning triangle, flame); burnt food is rough/dark/smoking and gets an ash icon when held (`04 §12.1`).
   - Hover ring: shape and cursor change as well as colour.
2. **Reduced motion** (setting `on`, or `auto` + `prefers-reduced-motion: reduce`): no screen shake, no camera lean (lean 0), no HUD slide/pulse animations (instant), confetti/steam particles x0.4, water amplitude x0.4, lamp pulse constant, guide arrow static, happy-hop spin removed, results stars appear without scaling.
3. **Flash safety**: no element changes luminance by > 25 % more than 3 times per second; the red damage flash is one fade (0.4 s) at most once per 1.5 s; setting "flash" is covered by `reducedMotion` (flash disabled).
4. **High contrast** (`data-contrast="high"`): HUD panels opaque (`#0c1820`), borders 3 px white, text >= 7:1, bubbles and rings get a white outline; in-world the stage floor and stations get +12 % lightness difference (smooth: outline width x1.5).
5. **Text size** 100 / 125 / 150 %: all HUD text uses `rem`; the layout tests (`09`) run at 150 % (no overlap; tickets shrink to icon + bar if needed).
6. **Hold-to-toggle Action**: removes the need to hold X (chop/wash/extinguish) for players with limited dexterity (§6.1). **Extended patience**: ticket time x1.25, marks runs unranked.
7. **Input**: every action is on both keyboard and gamepad; full remapping for keyboard (`pk.bindings.v1`); one-handed layout: scheme A only needs the left hand plus the mouse; menus never require a hold or a double press (except the optional restart confirm, which can be cancelled).
8. **Screen readers**: HUD is real DOM. The ticket column is `role="list"`, items `role="listitem"` with an `aria-label` "recipe, seconds left"; a visually hidden `<div aria-live="polite">` announces `a11y.ticketNew`, `a11y.served`, `a11y.expired`, `a11y.burning`, `a11y.fire` (throttled to 1 per 1.5 s, priority to fire); the canvas has `role="img"` and `aria-label` `a11y.canvas`; menus are `<button>`s in a `role="dialog"` with focus trap and `aria-modal`; results announce the score once. Gameplay itself is visual (not claimed fully screen-reader playable).
9. **Focus**: visible focus ring (3 px accent) on every button; focus never leaves the open dialog; `Esc` closes dialogs; the focused item is restored after closing.
10. **Targets and sizes**: >= 44 x 44 px; bubbles >= 14 px text; minimum contrast 4.5:1 for all text.
11. **Audio**: important events have a visual twin (rings, bubbles, toasts, shake-free flash), and `lessClutter` removes ambient noise sources; separate sliders; a global mute `M` / pad Back. Optional **visual sound cues**: when on, a cooking-complete or fire event off-screen edge shows a small arrow icon at the screen border (Default (tunable): off).
12. **Language**: `lang` attribute set on `<html>`; both languages fully covered.
13. **Time pressure aids**: the game never auto-fails (no game over); pause is always available offline; the guide arrow and prompts can be forced `always`.
14. **Photosensitive-safe moods**: no strobing neon; neon flicker <= 2 Hz (`04 §14`).

---

## 12. Acceptance criteria and tests

1. **Router**: `parseRoute`/`routeToPath` unit tests for every route including legacy `?mode=giant`, `?level=1`, `/r/ABCD`, unknown paths; Back during a run opens the pause overlay.
2. **Click-to-walk removed**: grep test (`09`) finds no `clickKind`, `walkTarget`, "aller et agir" in `apps/client/src` (outside `mossback.ts`/`input.ts`); a unit test of `sample()` shows: click on a station out of reach sends no `click` and raises the hint; click within reach sets `click` and increments `clickSeq` once; right mouse hold sets `RB_X` only; moving the mouse alone never changes `move`.
3. **Input mapping**: table-driven tests with fake `Gamepad` (standard mapping: A -> `RB_A`, B/RB -> `RB_B`, X/RT -> `RB_X`, Y/LT -> `RB_T`, deadzone 0.18, diagonal clamp) and fake key events using `code` values (`KeyW` etc.), identical results under simulated AZERTY and QWERTY layout maps; scheme A and B at the same time produce independent frames; `blur` clears all held keys; throw is dropped when `level.mechanics.throw` is false.
4. **Couch join**: tests with `SeatManager`: 4 seats max, duplicate source rejected, slot/colour by order, compaction between runs, ready-check start rule (all ready, 1-seat 6 s, force hold 1 s).
5. **Glyphs**: `glyph()` returns the real binding for each device kind (including the AZERTY label of `KeyW` = `Z` with a fake layout map) and the PlayStation/Switch swaps; no string "Clic gauche" for grab on keyboard unless the mouse was the last device.
6. **Prompts and guide**: `guideTarget` unit tests replay the 11 level 1 rules with synthetic `RushView`s; learning rule shrinks a bubble after 3 successes; no bubbles for remote chefs.
7. **Strings**: `pnpm check` runs `check-strings` (§8.5); switching language at runtime updates the open screen without reload; French is the initial language with an English browser.
8. **Audio**: unit tests render each `SoundRecipe` into an `OfflineAudioContext` (non-silent, peak <= 0.95 after the compressor, length <= its `dur` + 0.1 s); voice cap 24 respected; the cooldown drops repeated calls; music `intensity` transitions only on bar lines.
9. **Settings**: schema round trip, defaults on corrupt JSON, legacy `pk.best.*` migration yields the same best score and computed stars, storage unavailable falls back to memory without throwing.
10. **Accessibility**: axe-core check (Playwright) on title, levels, intro, pause, results at 1280 x 720 and 390 x 844 shows zero serious violations; tab order reaches every button; reduced-motion run shows no `animation-duration > 0` on HUD elements; text scale 150 % has no overflow.
11. **Screens (Playwright screenshots)**: title, levels (locked + stars states), intro with 1 and 4 seats, countdown, HUD with 4 tickets (landscape and portrait), pause, results (0 and 3 stars, record), online entry; each at 1280 x 720 and 390 x 844, French and English; compare against reviewed baselines (`09 §8`).
