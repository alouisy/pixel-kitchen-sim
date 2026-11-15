# 15 · UX, Onboarding and Accessibility

## 1. UX principles

1. **Diegetic first.** Information lives in the world (thought bubbles, food color, steam, the Giant's face). The HUD is for what can't be in the world.
2. **Clean by default.** Optional clutter (station labels, numeric meters) is *off* on first launch and opt-in in settings. This is an established preference from V1.
3. **Controller-complete.** Every screen is fully usable with a gamepad (needed for couch play). V1's `menuManager` focus logic is the reference.
4. **No overflow, ever.** Every UI string fits its frame in EN, FR and ES at every supported resolution down to 360×640. This is a hard constraint, checked in CI with screenshots.
5. **Respect the established identity.** Menus keep V1's typeface and color tokens. Pixel fonts are scoped to in-world labels only (loaded via `FontFace` for canvas text, never global CSS).

## 2. Screen flow

```
                 ┌──────────────┐
  /k/:room ─────▶│ KITCHEN LOBBY│◀───── / (returning player)
                 │ (3D, social) │
                 └──┬────┬────┬─┘
        Map (chapters)  Daily  Wardrobe / Cookbook / Crew / Settings
                 │
           PRE-SERVICE (level card, tool pick, difficulty, mutators)
                 │
            SERVICE (HUD)  ──▶  BIG BITE  ──▶  RESULTS  ──▶ share / next / lobby
```

- **The Kitchen Lobby is the main menu.** It's a small 3D space (a cozy camp at the edge of Mossback's meadow) where chefs walk around. Menus are *places*: the Map is a table with a world map, the Wardrobe is a coat rack, the Cookbook is a lectern, and the Daily Feast is a bell. Menus also work as plain overlays (Tab or Start opens a list view) for speed and accessibility.
- **First launch from a direct URL** (not an invite): a 3-second title card, then the lobby. No splash screens, no publisher logos.

## 3. HUD layout (in service)

```
┌───────────────────────────────────────────────────────────────┐
│ [Craving card: icons]                     [Belly = Giant face] │
│                                                               │
│                         (world)                               │
│                                                               │
│ [Critter orders mini]                                         │
│                  [Chef chips: you · partner (voice ring, 🔇)] │
└───────────────────────────────────────────────────────────────┘
```

- **Craving card:** 2–4 icons with fill bars (they fill as the dish you hold matches), plus the remaining window as a ring around the card.
- **Belly meter:** the Giant's face icon changes expression by band, with a thin ring meter around it. It pulses when in the Hungry band.
- **Critter mini-orders:** up to 4 small cards (recipe icon plus a timer ring).
- **Chef chips:** name, hat icon, tool icon, speaking ring, connection quality dot.
- **Taste Card** (contextual): appears next to the held dish with a predicted reaction emoji ([03 §5.4](./03-game-design.md)).
- **Safe areas:** 5% margins. Scales with a "HUD size" setting (80–130%).

## 4. Onboarding details

- The first ten minutes are scripted as in [04-gameplay.md §6](./04-gameplay.md).
- **Contextual prompts:** a button glyph appears over the relevant object the *first* 3 times a verb is possible, then never again (tracked per verb). Glyphs adapt to the last-used device (keyboard, Xbox, PlayStation, Switch Pro, touch).
- **New tool introductions** (chapter starts) are a 20-second "test kitchen" vignette: a safe mini-area where the tool does its thing on food and terrain, with the Giant watching.
- **Guest onboarding (invited friend):** the invited player gets the same prompts *inside the host's level*. The host gets a small banner: "Sam is new! Prompts are shown for them."

## 5. Settings (complete list)

| Group | Settings |
|---|---|
| **Gameplay** | Difficulty default, assists (game speed 80%, aim assist strength, no slip, Giant never storms off, longer craving windows), auto-recenter camera, Focus camera on/off, hold-to-toggle conversions (every hold becomes a toggle) |
| **Controls** | Full remapping per device, sensitivity, invert axes, vibration strength, touch layout size and opacity |
| **Video** | Quality tier (auto, low, medium, high, ultra), render scale, FPS cap (30/60/unlimited, kept from V1), shadows, camera shake, hit-stop, reduced motion, FOV, HUD size, labels on/off (off by default) |
| **Accessibility** | Colorblind modes (deuteranopia, protanopia, tritanopia) plus the high-contrast doneness palette, crew shape emblems, partner silhouettes through walls, visual sound indicators, subtitles (Giants, quick chat), text size, dyslexia-friendly font for menus (optional) |
| **Audio** | Master, music, SFX, Giant, voice volumes; mono; voice settings ([11 §3](./11-voice-and-communication.md)) |
| **Social** | Show online presence to friends, allow invites from (friends / crew / anyone with the link), record crew voices in clips (consent), streamer-safe mode |
| **Language** | EN, FR, ES at launch (from V1). Pipeline ready for DE, PT-BR, IT, JA. |
| **Data** | Recovery code, export or import progress, telemetry opt-out, delete local data (with a confirmation) |

## 6. Accessibility commitments (launch checklist)

- [ ] Finish the full campaign at 1★ with assists on and voice off (a playtest requirement).
- [ ] No information is conveyed by color alone (doneness also uses steam and sparkle; crews also use shapes; pings also use icons).
- [ ] Every timed hold has a toggle alternative.
- [ ] Every flashing effect stays under 3 flashes per second (photosensitivity).
- [ ] Subtitles and captions for all vocal content.
- [ ] One-handed play preset (gamepad: all actions remapped to the left half plus auto-targeting).
- [ ] Screen-reader labels on every DOM menu (the lobby's list view is fully accessible).
- [ ] Mobile minimum touch target of 44×44 pt.

## 7. Localization

- Strings migrate from `src/i18nData.js` to `locales/*.json` (with ICU plurals and gender for FR and ES clip titles).
- **Text expansion budget:** design every label for +35% length. FR is the longest of the 3 launch languages.
- Giants and critters speak an invented language, so voice localization costs nothing.
- In-world text (signs, labels) uses icons whenever possible.
