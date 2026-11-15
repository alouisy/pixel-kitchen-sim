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
| `apps/client` (`@ga/client`) | Vite app: boot, input sampling, sim worker wiring, debug overlay |
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
