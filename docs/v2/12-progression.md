# 12 · Progression, revised

> **Revision note (2026-11-15).** Progression now serves the record-chasing loop: stars to unlock, records to chase, cosmetics to show off. No cookbook of freeform dishes, no tools.

## 1. Layers
| Layer | Unit | Purpose |
|---|---|---|
| **Campaign** | Stars (★ 1–3 per level) | Unlock the next level, teach the curve |
| **Mastery** | "Chef Étoilé" tier, personal bests | Long-term goal per level |
| **Records** | Personal best, friends best, world record, per level × player bucket | Competition, replay |
| **Wardrobe** | Hats, aprons, colours, emotes earned through play | Identity, visible in co-op |
| **Daily Rush** | Daily level and modifier, streak | Daily return |
| **Crews** (optional) | A named group of regular teammates with a shared board | Social glue for duos and squads |

## 2. Unlocks
- Level N+1 unlocks with **1★ on level N** (as in V1), or at **12★ total**, so a stuck group can still move on.
- **Co-op unlock sharing:** stars earned in a group count for every member. A guest gets a Guest Pass for that level for 7 days. This is an incentive to invite friends.
- Level 1 is always playable from an invite link, whatever the guest's progress.

## 3. Records (the core long-term loop)
- Per level, per bucket (Solo, Duo, Squad 3–4, Party 5–6), per difficulty (Meal, Feast).
- The results screen shows PB, friends rank and world rank, and a **"best moments" replay** of the run (camera follows the top scorer). Records can be shared as a card or a clip ([13](./13-social-and-virality.md)).
- **Verified only:** world records require server re-simulation of the run's replay ([10 §9](./10-multiplayer-and-netcode.md)).
- **Ghost pace:** during a run, an optional indicator compares your score at this second with your PB and the WR.

## 4. Wardrobe
- Unlocks come from stars (every 3★), Chef Étoilé tiers, Daily Rush streaks and record placements (top 100 badge). There are no purchases in V2.
- Cosmetics never hurt readability: each player's colour (outline, apron trim, ping colour) is always enforced.

## 5. Saving (no accounts)
Local-first in IndexedDB, plus an optional cloud backup with a Recovery Code, as described before. Records are server-side, keyed by the player token.

## 6. Pacing targets
| Milestone | Target |
|---|---|
| Level 1 first clear | < 4 min from first launch |
| All 10 levels at 1★ | 2–3 h |
| All 10 at 3★ | 8–12 h |
| Chef Étoilé everywhere and record chasing | open-ended |
