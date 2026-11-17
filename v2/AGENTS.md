# AGENTS.md (read this first, every session)

Pixel Kitchen V2: a browser co-op order-rush cooking game. This directory (`v2/`) is a pnpm workspace.
You have no memory of past sessions. Everything you need is in the spec.

## Start here
1. Read `docs/v2/spec/00-README.md` (repo root `docs/`, one level above `v2/`). It has the reading order per task type.
2. Read the docs it tells you to read for your ticket. The ticket list is `docs/v2/spec/10-backlog.md`.
3. Where the spec and the older design docs `docs/v2/01-16` disagree, the spec wins.

## Golden rules
1. **Determinism.** The sim is a fixed 30 Hz tick, integer or Q8 state, one seeded PRNG, and a state hash. Same seed + same inputs = same hash, always.
2. **No `Math.random`, `Date`, `performance`, `crypto`, or float trig/exp/pow/log in `packages/sim` or `packages/shared`.** ESLint enforces it (only `sim/src/worker.ts` and tests are exempt). Use `@ga/shared` (`Prng`, `fsin`, `fcos`, `clamp`...).
3. **Strings:** every UI text goes through `apps/client/src/strings.ts` (`t('key')`), French and English. Never hardcode UI text.
4. **Package boundaries:** `shared` imports nothing; `content` imports `shared`; `sim` imports `shared` + `content`; `render` imports `shared` + `three` only (never `sim`); `client` imports all. See `spec/01 §2`.
5. **Content is data.** Levels, recipes, items and stations live in `packages/content/src/data/rush/` as JSON with zod schemas. Do not branch on a level id in sim code.
6. **Never break** the Mossback demo (`?mode=giant`, `apps/client/src/mossback.ts`, `sim/src/{kitchen,food,world}`) or any level that already works. Add or extend tests for what you touch.
7. **`pnpm check` must be green before you finish** (typecheck + lint + test + content validate). Do not disable a rule or skip a test to get green.
8. **Small commits**, one logical change each, message `area: summary` (e.g. `sim: add throw verb`). Do not push to the default branch. Do not commit unrelated files.
9. Do not add a dependency unless the spec or the ticket says so.
10. No `TODO` left silently: if you cut scope, say so in your final report.

## Commands (run from `v2/`)
| Command | What it does |
|---|---|
| `pnpm install` | install the workspace |
| `pnpm dev` | Vite dev server, http://127.0.0.1:5173 (COOP/COEP headers on) |
| `pnpm check` | `tsc -b` + eslint + vitest + content validate (the gate) |
| `pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm validate` | the four parts of `check` |
| `pnpm build` | production build to `apps/client/dist` |
| `pnpm vitest run packages/sim/src/rush` | run one folder or file |

URL flags: `?dev=1` dev tools, `?debug=1` overlay (tick, hash), `?level=1` skip the title, `?mode=giant` Mossback demo.

## Where things are
- `packages/shared`: PRNG (xoshiro128**), fmath, hashing, `SIM_HZ`.
- `packages/content`: zod schemas, item/station/recipe/level JSON, `rushLevelById`.
- `packages/sim`: `src/rush/` the order-rush sim (`RushSim`), `src/worker.ts` the Web Worker, `src/protocol.ts` messages.
- `packages/render`: three.js, voxel mesher, `scenes/harbour/` (level 1 diorama).
- `apps/client`: `src/main.ts` router, `src/rush/` screens/HUD/input, `src/strings.ts`.

## Before you say "done"
`pnpm check` green, new tests for new behavior, spec docs updated if you changed a contract, final report lists files changed, tests added, and anything not done.
