# 12 · Progression Systems

Progression has three jobs: **teach** (new tools and materials at a digestible pace), **retain** (reasons to come back tomorrow), and **bond** (a shared history for the crew). It never sells power, and it never gates the *fun* behind grind.

---

## 1. The layers

| Layer | Scope | Unit | Feeds |
|---|---|---|---|
| **Campaign** | Per player, crew-shared runs | Stars ★ | Chapter unlocks, mutators |
| **Cookbook** | Per player | Discovered dishes and techniques | Cosmetics, titles, collection completion |
| **Crew** | Per duo or group | Crew XP, Crew Level | Crew banner, crew cosmetics, crew leaderboard |
| **Wardrobe** | Per player | Tips (soft currency) plus unlocks | Hats, aprons, faces, tool skins, trails |
| **Mastery** | Per level | Golden Spoons, best Feast Score | Prestige titles, leaderboards |
| **Daily and weekly** | Global | Daily Feast streak, weekly challenges | Tips, limited cosmetics (always re-obtainable later) |

## 2. Campaign structure

- **6 chapters × (5 services + 1 boss)** = 36 levels.
- A chapter unlocks the next one once its **boss** is beaten at 1★ *or* the player has **12★ in the chapter**. Two routes, so a crew that gets stuck on a boss can still continue.
- **Co-op progress sharing:** stars earned in a multiplayer service count for **every** participant, including invited guests who haven't reached that chapter. They get a **"Guest Pass"**: the level is playable when invited and stays unlocked for them for 7 days afterward. That's a direct incentive to invite friends who are further along, and it costs nothing.
- Chapter 1 is fully playable for any new player through an invite link, even before they've started the campaign. That's the viral entry point ([13 §2](./13-social-and-virality.md)).

### 2.1 Stars per level
- ★ 1–3 from Feast Score thresholds (per-level tuning in `level.json`).
- **Golden Spoon** (a hidden 4th tier): 3★ *plus* a Perfect Big Bite.
- **Level challenges** (3 per level, shown after the first clear): for example "Serve a Flash-Seared dish", "Never let Mossback get Hungry", "Win with less than 10 vu wasted". Each one gives Tips plus a cookbook stamp.

## 3. The Cookbook (collection)

Every served dish is **classified** by its profile and shape into an *archetype* and recorded:

```
Cookbook entry
  name:        "Seared Mushroom Tower"        (generated, see 13 §3.2)
  archetype:   tower / skewer / bowl / slab / stack / sculpture / mess
  materials:   mushroom ×3, bread rock, cheese_melt
  techniques:  FLASH_SEAR, GLUED, CRUST
  best score:  91 (Perfect)
  first made:  2026-12-03, with crew "Les Croquettes"
  thumbnail:   offscreen voxel render (V1's thumbnailHelper evolved)
```

- **Discovery goals:** about 120 *named* combinations ("signature dishes" authored by design, such as "Sorbet Volcano") are hidden in the archetype space. Finding one triggers a short fanfare and a cookbook page with flavor text from the Giant who first ate it.
- **Technique stamps:** about 30 techniques (crust, flash sear, glaze, meringue bridge…). Collecting all of a chapter's stamps unlocks that chapter's **chef title**.
- The Cookbook is **shareable**: each page has a share card ([13 §4](./13-social-and-virality.md)).

## 4. Crews (the social progression)

A **Crew** is a persistent group of 2–4 players with a name, banner and code. No accounts: a crew is identified by its **crew code** (8 characters), and membership is the list of member tokens that played with it.

- **Crew XP** comes from services played together (base 100 per service, plus a star bonus, plus a first-clear bonus).
- **Crew Level** (1–50) unlocks crew banners, banner patterns, a crew "kitchen flag" placed in Camp during services, and **duo emotes** (synchronized two-chef animations).
- **Crew history:** a timeline of services, best clips and cookbook discoveries made together. It's the "photo album" of the friendship, with a high emotional retention value.
- Players can belong to several crews (play with your partner, play with your siblings). The lobby suggests the crew matching the players present.

## 5. Wardrobe and Tips

- **Tips** come from critter orders, challenges, the Daily Feast and crew level-ups. Typical earnings are 150–300 per service.
- The **Wardrobe** shop rotates 6 items daily, plus a permanent catalog. Prices go from 300 (an apron color) to 2,500 (an animated hat).
- **No purchases with money in V2.** The economy is tuned so a regular player (3 sessions a week) unlocks something meaningful every session.
- **Earned-only prestige cosmetics** come from Golden Spoons, chapter completion and the Daily Feast top 10%. They can't be bought with Tips.
- **Cosmetics never affect gameplay or readability** (the crew-color enforcement in [08 §3.4](./08-characters-and-camera.md)).

## 6. Daily and weekly loops

| Loop | Content | Reward |
|---|---|---|
| **Daily Feast** | A seeded service (a level, a Giant and a mutator), the same for everyone. One ranked attempt, unlimited practice. | Tips, a share card, a streak |
| **Streak** | Consecutive days played in the Daily Feast. Streak freezes: one earned per 7 days. | Escalating Tips; streak-only hat colors at 7, 30 and 100 days |
| **Weekly Menu** | 3 challenges across levels ("Serve 10 spicy dishes", "Get 5 Golden Spoons") | A weekly cosmetic |
| **Seasonal Feast** (every 6–8 weeks) | A themed Giant variant (Harvest Mossback, Frost Fest Glacé), a limited craving pool, a seasonal cookbook page | Seasonal cosmetics (they come back next year) |

## 7. Pacing targets

| Milestone | Target time |
|---|---|
| First Big Bite | < 10 min |
| Chapter 1 complete (1★ boss) | 45–60 min |
| First crew level-up | Service 2 |
| Full campaign at 1★ | 6–8 h |
| Full campaign at 3★ | 15–20 h |
| All Golden Spoons | 40 h+ (a mastery tail) |
| Cookbook 100% | 30–50 h, with community sharing of discoveries |

## 8. Saving and syncing (no accounts)

- **Local first:** progress lives in IndexedDB (schema versioned, with migrations). This is V1's `SaveManager` approach, made robust.
- **Cloud backup** (optional, still no account): `POST /api/backup` stores an encrypted progress blob keyed by the player token. A **Recovery Code** (12 words, shown once, downloadable as a card) restores progress on another device. That covers "new phone" without email or OAuth.
- Crew progress is **server-side** (keyed by crew code), so it's naturally shared across members' devices.

## 9. Anti-frustration

- After 3 failures (0★) on the same level, offer an **Assist suggestion** (it's never forced). Assists never block stars ([03 §9](./03-game-design.md)).
- A boss can be skipped through the 12★ rule.
- Daily Feast ranked attempts can be "practiced" freely first, so pressure is opt-in.
