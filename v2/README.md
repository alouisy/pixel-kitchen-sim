# Giant Appetite V2

Browser co-op voxel cooking game. Design docs: `../docs/v2/`. This directory is self-contained and
deployed as a separate Netlify site (base dir `v2`, see `netlify.toml`). V1 at the repo root is untouched.

## Run

```
pnpm install
pnpm dev        # Vite dev server (COOP/COEP headers on, so crossOriginIsolated is true)
pnpm check      # typecheck + lint + test + content validate
pnpm build      # builds apps/client/dist
```

## Package map

| Package | Role |
|---|---|
| `apps/client` (`@ga/client`) | Vite app: boot, input sampling, sim worker wiring, aim picking, DOM HUD (debug overlay with `?debug=1`) |
| `packages/shared` (`@ga/shared`) | xoshiro128** PRNG, deterministic `fsin/fcos`, Q8 fixed-point, `Hasher64`, ids, tick constants |
| `packages/content` (`@ga/content`) | zod schemas, JSON content (`src/data/`), validator (`pnpm validate`), typed loaders |
| `packages/sim` (`@ga/sim`) | Pure deterministic simulation (bitECS), `FixedStepLoop`, message protocol, worker entry (`@ga/sim/worker`) |
| `packages/render` (`@ga/render`) | Three.js `RenderApp`, `DioramaCamera`, placeholder `ChefView` and ground |

Packages are source-only TypeScript (`exports` point at `src/index.ts`); Vite and Vitest consume the source
directly, and `tsc -b` type-checks via project references (declarations go to `dist-types/`, gitignored).
Dependency direction: `client -> render, sim -> shared`; `content` is standalone for now.

## Determinism rules (`packages/sim`, `packages/shared`)

- No `Math.random`, `Math.sin/cos/tan/exp/pow/log/atan2/hypot`, `Date`, `performance`, `crypto`. ESLint enforces
  this (`eslint.config.js`). Use `@ga/shared` `Prng` and `fsin/fcos`. Only `packages/sim/src/worker.ts` may read a clock.
- Allowed float ops: `+ - * /`, `Math.sqrt`, `Math.floor`, `Math.imul`. Use `>>> 0` / `| 0` to keep integers wrapped.
- Heat, doneness and similar quantities are Q8 fixed-point integers (`toFx`, `fxMul`).
- Iterate entities in ascending entity-id order. **Never iterate a `Map`/`Set` in simulation code where order
  matters across peers** (insertion order differs between peers); this is not lintable, so review for it.
- Component storage is per `SimWorld` (no module-level mutable state in sim).
- The state hash (`SimWorld.stateHash()`) covers tick, PRNG state and all component arrays; snapshots must
  restore to an identical hash.

## Determinism-sensitive test

Unit tests run in Node (V8) only. A cross-browser replay test (Playwright on Chromium, Firefox and WebKit,
replaying a recorded input log and comparing state hashes) is planned for P1; it is the real guard against
engine-specific float differences.

## Play the Cut & Burn toy

The P1 toy ([roadmap](../docs/v2/16-production-roadmap.md)): one chef, a Cleaver, a Torch, a hot rock and four ingredients in a
small test kitchen.

```
pnpm install
pnpm dev                      # http://localhost:5173  (add ?debug=1 for the tick/hash/fps overlay)
# or: pnpm build && pnpm --filter @ga/client preview
```

| Input | Action |
|---|---|
| WASD / left stick | move (the chef faces the last pushed direction, in 45 degree steps) |
| Mouse / (gamepad: 0.6 m ahead) | aim |
| Left click / RT | use tool: Cleaver cuts on click, Torch burns while held |
| E or Space / A | grab, place, or interact (spawn from a pad, taste on the plate) |
| Q / Y | swap Cleaver and Torch |
| R / X | cut angle: vertical, 45 degrees, flat |
| H | toggle the help panel (it hides itself after 20 s) |

How to play: stand at the table, press E near a coloured pad to spawn an ingredient (mushroom, potato, bread rock, pepper),
press E again to pick it up, carry it to the stone slab and press E to put it down. Drop food on the round plate and press
E again to taste it against the craving shown top-left; you get a score, a tier and highlight chips, then the next craving.
Held items cannot be heated; anything over 384 voxels is too heavy to lift; the kitchen holds 40 pieces.

What to look for:

- **Doneness gradient on cut faces.** Cook something on the rock, then cut it (flat or 45 degree cuts show it best) and
  look at the faces: the cooked-to-raw gradient runs from the heated side to the cold side.
- **Char.** Leave food on the rock or under the torch long enough and the surface darkens to the charred colour.
- **Burning bread to ash.** Keep bread rock on the rock or under the torch and it turns to ash cells (grey).
- **Steam** rises from anything that has just changed doneness; the **rock light** brightens whenever something sits on it.

Determinism: the toy runs entirely in `packages/sim` (`SimWorld` + `kitchen/`); `kitchen/kitchen.test.ts` has the scripted
1,200-tick session (spawn, carry, cook on the rock, taste) checked for score, repeat-run hash and snapshot/restore hash.
