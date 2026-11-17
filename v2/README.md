# Giant Appetite V2

Browser co-op voxel cooking game. Design docs: `../docs/v2/`. This directory is self-contained and
deployed as a separate Netlify site (base dir `v2`, see `netlify.toml`). V1 at the repo root is untouched.

## Comment jouer

**Objectif.** Mossback, un Géant tortue, a faim. Pendant **3 minutes**, prépare ce qu'il demande (la carte en haut à gauche)
et donne-le-lui dans la bouche avant que son ventre ne se vide : plus le plat est réussi, plus tu marques de points et plus
son ventre se remplit. S'il passe trop souvent en mode « affamé » (3 cœurs), il part bouder et le service s'arrête.
Étoiles : 300 / 600 / 900 points. Le meilleur score est gardé dans le navigateur.

**Recette de base.**
1. Va devant un tapis coloré (le champignon est le premier) et **prends** un ingrédient.
2. **Pose-le sur la pierre chaude** : une jauge apparaît au-dessus. Beige = cru, **vert = parfait**, orange = trop cuit, noir = brûlé.
   Un « ding » retentit quand c'est doré à point.
3. **Reprends-le** (tous les morceaux qui se touchent viennent ensemble) et **sers-le** devant la bouche de Mossback.
4. Le **couteau** coupe (il faut au moins 48 cellules) ; le **chalumeau** brunit la surface tant que tu le maintiens.

| Action | Manette | Clavier + souris |
|---|---|---|
| Bouger | Stick gauche (ou croix) | WASD / ZQSD (position physique) ou flèches |
| Prendre / Poser / Servir | Ⓐ | Clic gauche (ou Espace / E) |
| Utiliser l'outil (maintenir) | Ⓧ (ou RT) | Clic droit maintenu |
| Changer d'outil | Ⓨ | Q |
| Angle de coupe | RB | R |
| Passer le tutoriel | Ⓑ maintenu 1 s | Échap maintenu 1 s |
| Pause | Start | Échap |
| Son coupé / activé | | M |

L'outil vise tout seul le morceau devant toi (manette, ou souris immobile depuis 2 s) ; avec la souris, le curseur choisit
la cible. Le tutoriel (5 étapes, sans chrono) se lance au premier « Jouer » ; « Tutoriel » le relance à tout moment.

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

## Le jeu : "Le petit-déjeuner de Mossback" (notes de dev)

Premier mini-jeu jouable construit sur le toy Cut & Burn : `title -> tutorial -> service -> results` (machine à états dans
`packages/sim/src/kitchen/game.ts`, nombres d'équilibrage dans `packages/content/src/data/tuning/game.json`).

```
pnpm install
pnpm dev                      # http://localhost:5173  (?debug=1 : overlay tick/hash/fps, ?dev=1 : window.__ga pour les tests)
# ou : pnpm build && pnpm --filter @ga/client preview
```

- **Sim** : `Game` (phases, ventre/humeur/patience du Géant, envies mélangées par un Prng, tutoriel guidé par événements),
  `KitchenSim` (prise d'un tas entier de morceaux contigus, service à la bouche de Mossback, auto-visée, règles de coupe :
  >= 48 cellules pour couper, morceaux < 24 cellules = miettes, délai 0,35 s). Les commandes de phase passent par
  `SimWorld.command()` (`startTutorial`, `startService`, `toTitle`, `skipTutorial`) ; tout est dans le hash et le snapshot.
- **Render** : `GiantView` (tortue voxel procédurale), `DoneGauges` (jauge de cuisson 3D), `TutorialMarker` (flèche + contour),
  `BurstFx` (miettes, étincelles, coeurs), secousse d'écran, caméra à 6 m biaisée de 25 % vers la bouche du Géant.
- **Client** : `input.ts` (clavier + souris + manette, dernier périphérique utilisé), `hud.ts` (DOM : cartes, menus navigables à
  la manette), `audio.ts` (synthé WebAudio porté de la V1), `strings.ts` (`t(key)`, FR par défaut, EN si
  `navigator.language` ne commence pas par `fr`).
- **Test de fumée** : `?dev=1` expose `window.__ga` (`teleport(x, z)`, `command(c)`, `game()`), jamais actif sans le drapeau.
- Équilibrage des plats : `packages/sim/src/food/scoreTuning.test.ts` cuit de vrais corps sur la pierre avec `heatStep` et
  vérifie les paliers (champignon saisi >= 80, cru <= 30, brûlé <= 25...).

