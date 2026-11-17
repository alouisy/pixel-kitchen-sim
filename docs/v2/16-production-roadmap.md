# 16 · Production Roadmap, revised

> **Revision note (2026-11-15).** After the first playtest, the plan is refocused on the order-rush loop. What's already done (P0 foundations, voxel art conversion, the greedy mesher and ramp shader, the voxel food prototype) is reused where it helps. Work is delegated: V1 fixes go to Haiku agents and V2 code to Sonnet agents, with specs written from these docs.

## 1. Phases

| Phase | Status | Goal | Exit criteria |
|---|---|---|---|
| P0 · Foundations | ✅ done | Workspace, deterministic sim worker, renderer, content schemas | `pnpm check` green |
| P1a · Voxel food toy | ✅ done, **archived** | Test voxel-by-voxel cooking | Playtest: fun for a tech demo, wrong for the loop, so it's dropped from gameplay |
| P1b · Giant mini-demo | ✅ in review | A guided 3-minute service around a Giant | Owner playtest decides whether Giants stay as a theme |
| **P2 · First real level (solo + couch)** | next | Level 1 "Le Kiosque du Port" with the V1 loop on V2 tech: tickets, chop, fry, plate, serve, score, streak, stars, instant restart, gamepad-first, French UI, the premium voxel look | A first-timer clears it with ≥ 1★ without help. Feels at least as fun as V1's level 1 (owner's call). |
| **P3 · Online multiplayer (2–6)** | | Rooms, invite links, P2P host-authoritative sync, voice, scaling by player count | 6 players across browsers, ≥ 98% runs without desync, playable at 120 ms |
| **P4 · Records** | | Verified runs (server re-simulation), leaderboards per level × bucket, PB and WR pace, share cards | A world record can be set, verified and shared |
| **P5 · Levels 2–5** | | Burger, cheeseburger, smoothie, pizza; twists: truck, split counter, tide, two floors | Each passes the level checklist ([06 §6](./06-level-design.md)) |
| **P6 · Levels 6–10 + polish** | | Fire, crowd lane, train, greenhouse, the Giant's banquet; audio, juice, accessibility | Public beta checklist |
| P7 · Public beta | | Launch on web portals, Daily Rush, streamer outreach | KPIs in [02 §6](./02-vision.md) |

## 2. Art direction decision point
At the end of **P2**, the owner compares level 1 in "premium voxel" against a quick mock of a more polished cartoon style (one screenshot, same layout) and decides. Until then, voxel stays the default because it's producible entirely from code and data.

## 3. Risks (updated)
| Risk | Mitigation |
|---|---|
| The V2 loop feels like "V1 with a new camera", not better | P2 exit criterion compares directly with V1. Polish the feel (juice, audio, readability) before adding content. |
| 6-player chaos becomes unreadable | Player colours and outlines, optional stations per bucket, playtests at 6 from P3 |
| P2P limits at 6 players (host uplink, voice mesh of 15 links) | Measured in P3. Plan B: the WebSocket relay or an SFU for voice ([10 §11](./10-multiplayer-and-netcode.md)). |
| Records get cheated | Server re-simulation of replays; only verified runs rank |
| Levels 6–10 end up weaker again | Each level has a signature twist, bot-measured tuning and the same checklist. Ship 8 great levels rather than 10 uneven ones if needed. |

## 4. Immediate next steps
1. Owner playtests the P1b Giant mini-demo, then decides whether Giants stay (as the level 10 theme) or go.
2. Brief and build **P2: level 1 "Le Kiosque du Port"** on the V2 tech.
3. Run `supabase/schema.sql` in Supabase before deploying V1 fixes.
