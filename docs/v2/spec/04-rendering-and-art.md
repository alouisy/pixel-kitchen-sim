# 04 · Rendering and Art

> **Summary.**
> 1. `packages/render` draws the game from `RushView` and `RushEvent` only. Every visual goes through an `AssetBackend` (`voxel` today, `smooth` toon low-poly later), so the art style can change without touching the sim, the HUD or a level layout.
> 2. This doc fixes the render architecture, both backends, the diorama composition rules, the lighting presets for the 10 level moods, the per-level fixed camera (with the portrait fix), the new chef (proportions, hats, 6 colours, every animation), station, item, customer, VFX and ambient specs, budgets and an art style guide.
> 3. Names of shared interfaces come from `01-architecture.md §10 and §14`. This doc extends a few of them with **optional** fields (marked `04-ext`); `01 §10.2` and `03` must mirror those fields.

## Table of contents

1. Current state vs target
2. Render architecture
3. Units, coordinates, palette tokens
4. The asset abstraction
   - 4.1 Interfaces and 04 extensions
   - 4.2 Voxel backend (exact)
   - 4.3 Smooth backend
   - 4.4 Selection, parity, contract tests
5. Diorama composition rules
6. Water, sky, fog, backdrops
7. Lighting rig and mood presets
8. Camera
9. The chef
10. Customers
11. Stations
12. Items and plates
13. VFX
14. Ambient life
15. In-world markers (guide arrow, target glow, anchors)
16. Performance budgets and quality tiers
17. Art style guide
18. Acceptance criteria and tests

---

## 1. Current state vs target

### 1.1 What exists (read from `v2/packages/render/src`)

| Area | File | What it does today |
|---|---|---|
| Renderer, lights, fog, camera, shake | `scenes/harbour/harbourApp.ts` | `HarbourApp`: ACES tone mapping exposure 1.05, `PCFSoftShadowMap`, sky `0xbfe3f5`, `Fog(sky, 42, 120)`, hemisphere `0xaedcff/0xe6cf9c` 1.15, sun `0xffe0ad` 2.6 at (-9,16,8), shadow 2048, ortho box ±12, camera fov 38, pitch 54 deg, distance `max(15, 5.6/(tanV*aspect))`, 12 % / 10 % lean toward the chef centroid, title orbit mode. |
| Level 1 diorama | `scenes/harbour/harbourScene.ts` (741 lines) | `HarbourScene`: pier, kiosk, stations, scenery, gulls, customers, chefs, held items, target glow, guide arrow, steam, lamp flicker. Level 1 only, hard-coded. |
| Voxel API | `scenes/harbour/voxel.ts` | `Palette`, `Vox`, `parseVox`, `voxFromModel`. |
| Props | `scenes/harbour/props.ts` | `deckChunk`, `counterBase`, `woodCrate`, `sailboat`, `rowboat`, `lamppost`, `lighthouse`, `signBoard`, `Awning`, `stationModel`. |
| Chef | `scenes/harbour/chef.ts` | `ChefRig`: 6 voxel parts at 1/16 m, about 1.96 m tall, walk/carry/chop/flick/hop. |
| Items | `scenes/harbour/items.ts` | `ItemFactory`: V1 `.vox` models, fries ramp, plate contents stacked. |
| FX | `scenes/harbour/fx.ts` | `ParticlePool`: 400 instanced cubes, `emit`. |
| Water | `scenes/harbour/water.ts` | `Water`: 240 m plane, 120 segments, vertex wobble, fresnel, glints, fog. |
| Mesher | `voxel/greedyMesher.ts`, `foodMaterial.ts`, `mesherPool.ts`, `mesher.worker.ts` | Greedy mesher with baked AO, one shared ramp material. |
| Mossback demo | `renderApp.ts`, `camera.ts`, `chefView.ts`, `toy/*` | Separate renderer. Must keep working (do not touch). |

### 1.2 Gaps to close (each becomes backlog tickets)

1. **Stations are drawn from the layout `def`, not from `view.stations[i].enabled`.** `HarbourScene.buildStations` is called with `enabled: true` for every station (`rushClient.ts` maps `layout.stations.map(s => ({...s, enabled: true}))`) and never reads `view.stations[i].enabled`. The sim treats a disabled optional station (`board_2`, `fryer_3`, `optional: "squad"`) as a plain `counter` (`02`: "disabled optional stations act as 'counter'"). The render draws them as a working board and fryer. That is the cause of the level 1 bug "the first board and the first fryer don't work": they are the leftmost board and fryer in the row, the two optional ones. **Rule (binding): a station whose `view.stations[i].enabled === false` is drawn as a plain counter (`backend.station('counter', ...)`), with no item feedback, no steam, no ring.** See §11.1.
2. Camera: no per-level data; `HarbourApp` computes it from magic numbers. In portrait (390x844, `docs/p2/service-390x844.png`) the fit uses only the horizontal extent, so the kiosk fills about 25 % of the height and the rest is empty water. Fixed in §8.4.
3. The chef is 1.96 m tall (counter 0.9 m), blocky, with arms swinging in the same direction as the same-side leg, no elbows, no face states, no wash/extinguish/throw/dash/hurt poses. Replaced in §9.
4. Style is hard-wired to voxels. Replaced by `AssetBackend` (§4).
5. `ParticlePool` uses `Math.random` (fine in render) but only cubes and no per-effect presets. §13.
6. Lamp flicker uses `sin(time*23)` and `sin(time*31)`: more than 3 flashes per second. Must be capped (§18, accessibility cap in `05`).
7. `HarbourScene` mixes build and update for one level. It becomes `dioramas/l01_kiosque.ts` implementing `LevelDiorama` (`01 §10.4`).
8. Screen shake uses `Math.random`/`sin` on the camera and ignores reduced motion. §8.6.

### 1.3 Target file layout (`packages/render/src`)

```
index.ts                      // re-exports
core/renderHost.ts            // RenderHost: WebGLRenderer, Scene, resize, quality tier, frame
core/quality.ts               // QualityTier table (section 16)
core/palette.ts               // ART_PALETTE tokens (section 3.3)
camera/cameraRig.ts           // CameraRig (replaces HarbourApp camera code), fit(), zones, shake
lighting/rig.ts               // applyMood(host, mood), MOODS table (section 7)
lighting/moods.ts             // LightingMood objects for the 10 levels
env/water.ts                  // Water (moved from scenes/harbour/water.ts)
env/sky.ts, env/backdrop.ts   // Backdrop kinds (section 6)
assets/types.ts               // 01 §10.2 interfaces + 04-ext fields
assets/index.ts               // createAssetBackend
assets/manifest.ts            // the AssetManifest for all ids (section 4.4)
assets/placeholder.ts
assets/voxel/                 // voxel.ts (Vox, Palette, parseVox), mesh.ts, items.ts, props.ts, stations.ts, chef.ts, customer.ts
assets/smooth/                // builder.ts, toon.ts, outline.ts, stations.ts, items.ts, chef.ts, customer.ts, props.ts, gltf.ts
rig/chefSkeleton.ts           // backend-independent bone tree (section 9.3)
rig/chefAnimator.ts           // ChefAnimator: ChefPose -> bone transforms (section 9.5)
rig/customerAnimator.ts
dioramas/index.ts             // DIORAMAS
dioramas/fallback.ts          // plain floor
dioramas/l01_kiosque.ts       // ex HarbourScene
dioramas/lNN_*.ts             // one file per level (08)
fx/particles.ts               // ParticlePool v2 (section 13)
fx/markers.ts                 // guide arrow, target glow, hover ring
voxel/*                       // mesher, ramp material (unchanged API)
renderApp.ts camera.ts chefView.ts toy/*   // Mossback demo, untouched
```

Moves are done with `git mv` so history is kept. `scenes/harbour/index.ts` keeps re-exporting `HarbourApp`, `HarbourScene` until the client is switched (`01 §14`: "existing render names that stay").

---

## 2. Render architecture

### 2.1 Layers

```
RunSession (client)  ──RushUpdate──▶  ViewSource
                                         │ view, events
                         apps/client  ───▼───────────────────────────────┐
                         frame(): diorama.update(view,dt,t), onEvent(ev) │
                                                                          ▼
 RenderHost ── owns ──▶ WebGLRenderer, Scene, CameraRig, QualityTier
     │
     ├─ lighting/rig.applyMood(host, mood)
     ├─ AssetBackend  (voxel | smooth)       ← the ONLY place that decides how things look
     └─ LevelDiorama  (DIORAMAS[levelId]())  ← composition, ambient life, customers, stations, chefs
```

Rules:
1. `packages/render` imports `three`, `@ga/shared`, and (type-only) nothing from `@ga/sim` or `@ga/content`. Views are structural (`SceneView`, `SceneEvent`, `LevelRenderSpec`, `01 §10.4`).
2. The diorama never creates meshes itself for stations, items, chefs, customers or named props: it calls the backend. Pure scenery that is part of the level mood (water, sky, ground plane, light shafts) may use `env/*`.
3. Float math, `Math.sin`, `Math.random` are allowed in render. For reproducible screenshots every render-side random source uses `visualRng(seed)` (mulberry32, seeded with `levelId` hash + slot). `Math.random` is only allowed in particle spread and audio.
4. One `requestAnimationFrame` loop in the client. `RenderHost.render(dt, time)` is the only call that draws.
5. The view is sampled at 30 Hz but rendered at display rate: chef positions are smoothed (§9.6); everything else animates from `time`.

### 2.2 `RenderHost`

```ts
export interface RenderHostOptions { canvas: HTMLCanvasElement; quality: 'auto' | QualityTierId; art: ArtStyle }
export class RenderHost {
  readonly renderer: WebGLRenderer;
  readonly scene: Scene;
  readonly cameraRig: CameraRig;
  backend: AssetBackend;
  diorama: LevelDiorama | null;
  constructor(o: RenderHostOptions);
  async loadLevel(spec: LevelRenderSpec, mood: LightingMood): Promise<void>; // disposes the previous diorama, builds the new one
  update(view: SceneView, dt: number, time: number): void;   // diorama.update + cameraRig.update
  event(ev: SceneEvent, view: SceneView | null): void;
  render(): void;                                            // renderer.render
  project(x: number, y: number, z: number): { x: number; y: number } | null; // CSS px, null when behind the camera
  pick(clientX: number, clientY: number): number;            // station index under the cursor by rendered footprint, -1 if none (05 §6)
  setTitleMode(on: boolean): void;                           // slow orbit for the title / level select backdrop
  setQuality(id: QualityTierId): void;
  dispose(): void;
}
```

`renderer` settings (exact, from the harbour): `antialias: true`, `powerPreference: 'high-performance'`, `toneMapping = ACESFilmicToneMapping`, `outputColorSpace = SRGBColorSpace`, `shadowMap.enabled = true`, `shadowMap.type = PCFSoftShadowMap`, `setPixelRatio(min(devicePixelRatio, tier.maxDpr))`. Exposure comes from the mood (§7).

### 2.3 Per-frame order inside `RenderHost.update`

1. `diorama.update(view, dt, time)` (water time, boats, chefs via `ChefVisual.setPose`, held items, station visuals, customers, ambient, guide arrow, particles).
2. `cameraRig.update(diorama.centroid, dt, time)`.
3. `lighting.update(view, time)` (late-run lamp behaviour, §7.5).
4. `renderer.render(scene, camera)`.

`pick()` and `project()` use the camera matrices of the last render.

---

## 3. Units, coordinates, palette tokens

### 3.1 World

| Item | Value |
|---|---|
| Unit | 1 = 1 metre |
| Axes | x right, y up, z towards the camera (screen down). The camera looks towards -z. |
| Floor of the playable area | y = 0 (top of the deck/floor boards) |
| Counter top | y = 0.90 (`TOP`) |
| Station footprint | `w x d` from `layout.json` (1 x 1 m for all level 1 stations); station centre = `(x, z)` |
| Chef | 1.2 m tall including hat (tunable 1.0-1.2, `01 §10.3`); collision radius 0.35 (`CHEF_RADIUS`) |
| Facing | unit vector `(fx, fz)`; yaw = `atan2(fx, fz)`; the face is on the local +z side |
| Water plane | y = -0.4 |

### 3.2 Rotation sign convention for bones (binding)

All bones face +z. For an arm or leg hanging down from its pivot, a **negative** `rotation.x` swings it **forward** (towards +z); a **positive** one swings it backward. This is the convention of the existing `ChefRig` (carry pose = -1.3) and is used by every number in §9.

### 3.3 Palette tokens (`core/palette.ts`)

One table feeds both backends. The voxel backend registers the hex in `Palette.idx(hex)`; the smooth backend feeds it to `toonMaterial(token)`. Tokens (hex from the harbour code unless marked new):

```ts
export const ART_PALETTE = {
  // structure
  wood_light:  '#e2c08a', wood:       '#a8773f', wood_mid: '#b98748', wood_dark: '#5a3d22', wood_post: '#8a5c32', wood_post_top: '#6d4524',
  floor_light: '#d6ae74', floor_mid:  '#cca468', floor_dark: '#b58c58',
  teal:        '#3f8796', teal_dark:  '#2c5560', teal_deep:  '#357685', cream: '#efe8d4',
  red:         '#d9473a', white:      '#fbfbf6', off_white:  '#f1f1ea',
  steel:       '#5d6b74', steel_dark: '#2c3e48', iron: '#2e3a45', iron_dark: '#1f2830',
  brass:       '#e8b73e', brass_dark: '#b8862b', brass_light: '#f6d36a',
  // water and sky
  sea_deep:    '#1b6f9a', sea_shallow: '#39b3c9', sky: '#bfe3f5', sky_haze: '#cfeaf7',
  // people
  skin:        '#f1c9a5', skin_2: '#d9a679', skin_3: '#a9714b', skin_4: '#f7d9bd', skin_blush: '#d98c7c',
  hair_dark:   '#3a2a1e', hair_blond: '#d8a24a', hair_black: '#222222', hair_red: '#a8532b',
  pants:       '#35405a', shoe: '#2a2f3d', eye: '#2a1d14',
  // food ramps are in section 12
  // UI accent (shared with CSS, 05)
  accent:      '#ffd23f', warn: '#f4a259', danger: '#e4572e', ok: '#6fd36f',
  // new tokens for levels 2-10 live in 08, same naming rule: material_variant
} as const;
export type PaletteToken = keyof typeof ART_PALETTE;
```

Six player colours (extends `SLOT_COLORS`, which has 4 today):

| Slot | Colour name | Hex | Emblem (colour-blind safe) |
|---|---|---|---|
| 0 | red | `0xe4572e` | circle |
| 1 | teal | `0x29a0b1` | triangle |
| 2 | yellow | `0xf2c14e` | square |
| 3 | green | `0x7fb069` | star |
| 4 | violet (04-ext) | `0x8e6bd8` | diamond |
| 5 | pink (04-ext) | `0xf28ab2` | heart |

`SLOT_COLORS` and `SLOT_EMBLEMS` are exported from `core/palette.ts`; `LocalSeat.color` (`01 §9.2`) holds the hex.

---

## 4. The asset abstraction

### 4.1 Interfaces and 04 extensions

The interfaces of `01 §10.2` (`ArtStyle`, `AssetId`, `AssetManifest`, `AssetBackend`, `Visual`, `ItemVisual`, `StationVisual`, `StationVisualState`, `ChefLook`, `ChefPose`, `ChefVisual`, `CustomerKind`, `CustomerVisual`, `PropVisual`, `StyleProfile`) are binding and not repeated. `04-ext` adds **optional** fields so older code keeps compiling:

```ts
// assets/types.ts additions (all optional)
export interface StationVisualState {            // 01 fields: enabled, active, highlight, item
  fire?: 0 | 1 | 2;                              // 0 none, 1 small (ticks since ignition < 120), 2 big (>= 120). Derived from StationView.fire
  warn?: boolean;                                // item is 'cooked' with progress > 100, or 'burning': burn warning
  hasExtinguisher?: boolean;                     // 'extinguisher' kind: the unit is on the wall
  mix?: string[];                                // blender contents
  stock?: number;                                // dispenser stacks, -1 infinite
  dirty?: number;                                // sink / return: dirty dish count
  growLeft?: number;                             // planter: ticks until ready, 0 ready
  bump?: number;                                 // 0..1 impulse set by the diorama on ChopHit/Placed/Grabbed (visual shake), decays in the visual
  lidOpen?: boolean;                             // bin
}
export interface ChefPose {                      // 01 fields: walk, phase, chopping, dashing, carrying, throwT, happy, hurt
  washing?: boolean;                             // verb 'wash' with X held
  extinguishing?: boolean;                       // holds the extinguisher item with X held
  flickT?: number;                               // 0..1 over 0.22 s, 0 = none (place / serve flick)
  chopClock?: number;                            // seconds since the last ChopHit event (visual clock), for the swing phase
  held?: 'none' | 'light' | 'plate' | 'extinguisher'; // what is carried (changes the hand pose)
  speed?: number;                                // m/s, informational
}
export interface ChefLook {                      // 01 fields: slot, color, hat, name
  skin?: number;                                 // 0..3 index into skin tokens
  emblem?: number;                               // 0..5, defaults to slot
}
export interface CustomerVisual {                // 01 has setMood, update
  setFacing(yaw: number): void;
  setWalk(speed: number): void;                  // 0 = standing; > 0 walking cycle speed in m/s
  celebrate(): void;                             // happy hop (0.9 s)
  setPatience(frac: number): void;               // 0..1 drives the order bubble ring (section 10.3)
  setOrder(recipeId: string | null): void;       // order bubble icon, null hides it
}
```

`hat` in `ChefLook` is the index into `HATS` (§9.4). The `AssetBackend` methods are called at level load, not per frame; per-frame work is `set`/`setPose`/`update` on the returned visuals.

### 4.2 Voxel backend (exact)

The voxel backend is today's code reorganised under `assets/voxel/`. Its builder API and constants are binding so any agent can add a model that matches.

#### 4.2.1 `Palette` (file `assets/voxel/voxel.ts`, from `scenes/harbour/voxel.ts`)

```ts
class Palette {
  idx(hex: string): number;                                        // plain colour -> ramp index 1..255 (case-insensitive, deduped). Throws 'palette full' past 255
  ramp(name: string, raw: string, cooked: string, charred: string): number; // cooking colour index; same texture, 3 rows
  texture(): DataTexture;                                          // 256 x 3 RGBA8 ramp (row 0 raw, row 1 cooked, row 2 charred; x = index). Unknown index = magenta
  material(): Material;                                            // ONE shared MeshStandardMaterial (roughness 0.85, metalness 0) patched with the ramp shader
  flush(): void;                                                   // re-upload the texture if colours were registered since last call (call once per frame)
  refresh(): void;                                                 // force re-upload
}
```

Budget: 255 distinct colours per `Palette`, shared by the whole level (props, stations, chefs, customers, items). Each level documents its colour count in `08`; if a level exceeds 255, use a second `Palette` for static scenery (a second material, still one draw call per chunk). Plain colours have raw = cooked = charred.

#### 4.2.2 `Vox` (editable volume, dims <= 64 on each axis, `y` up)

```ts
class Vox {
  constructor(w: number, h: number, d: number, palette: Palette);
  set(x: number, y: number, z: number, hexOrIndex: string | number): this;   // out of range ignored
  clear(x: number, y: number, z: number): this;
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: string | number): this; // [x0,x1) x [y0,y1) x [z0,z1); c = 0 carves
  get(x: number, y: number, z: number): number;                                // palette index, 0 empty
  geometry(): BufferGeometry;                                                  // greedy mesh with AO attributes
  mesh(size: number, pivot?: [number, number, number], shadows?: boolean): Mesh; // scaled by `size` m per voxel; `pivot` (voxels) becomes the origin; castShadow = receiveShadow = shadows (default true)
  readonly material: Uint8Array; readonly doneness: Uint8Array; readonly char: Uint8Array; // per-cell arrays, idx = x + w*(y + h*z)
}
```

Mesh vertex attributes: `position` (voxel units), `normal`, `aAttr` = `[materialIndex, ao 0..3, doneness band centre, char band centre]` (uint8 x4). Greedy merge key (24 bits): material, 4 corner AO values (2 bits each), doneness band (4 bits), char band (4 bits). AO factor per corner: `[0.5, 0.65, 0.8, 1.0]` for AO 0..3. A per-voxel hash jitters the colour by +-4 % (`1 + (hash(cell) - 0.5) * 0.08`), evaluated per fragment. Cooking colour: `mix(mix(raw, cooked, smoothstep(0.15, 0.85, done)), charred, smoothstep(0.1, 0.9, char))` with `done = doneBand/255`, `char = charBand/255`.

Doneness is baked per voxel (`Vox.doneness[i]`, `Vox.char[i]`, 0..255, band = value >> 4, 16 bands); items cache one `Vox` per `(def, doneBand, charBand)`. Rebuild an item mesh only when `signature` changes (`ItemFactory.signature`).

Heavy meshing (large chunks) goes through `MesherPool` (workers, key-coalesced); small props (<= 64^3) may mesh on the main thread at level load. Never mesh per frame.

#### 4.2.3 `.vox` import

`parseVox(buf)` reads MagicaVoxel `VOX ` files (chunks `SIZE`, `XYZI`, `RGBA`, `MAIN` children). The file's z is up: `voxFromModel(model, palette, recolor?)` maps file z to y-up and file y to z (`new Vox(sx, sz, sy)`; `v.set(x, z, y, hex)`). Palette index 1 = first RGBA entry. `recolor(hex)` may return a hex or a ramp index (used to turn a model's fries colour into the fries ramp, `#000000` mapped to `#3a2a1a`). Models live in `v2/content-src/vox/v1/{items,stations,meals}/*.vox` (V1 models, 48 items, 41 stations, 13 meals) and are loaded with `import.meta.glob(... { query: '?url' })`.

#### 4.2.4 Voxel sizes in use (metres per voxel)

| Thing | Size | Notes |
|---|---|---|
| Deck boards, pier props (`P`) | 1/8 = 0.125 | `deckChunk(w, d)` 2 voxels thick, boards 3 voxels wide with 1 voxel gaps |
| Counter base | 0.1, 10 x 9 x 10 voxels | 1 m x 0.9 m, body 8 voxels + top 1 voxel, 1 voxel dark skirt |
| Chef (new) | 1/24 = 0.0417 | §9.2 |
| Customer (new) | 1/24 | §10 |
| Items | 1/22 (plate-size 1/26, potato 1/22, raw/cooked fries 1/13, fries on plate 1/15) | from the table in `items.ts`, default `1/20` |
| Station models | fryer 1/20, board 1/22, plate stack 1/22, bin 1/14 | V1 models |
| Gull | 0.06 | |
| Lighthouse tower / rock | 0.3 | 14 x 56 x 14 tower |

Rule: **a prop's voxel size is chosen so its smallest meaningful detail is 1 voxel; never mix more than 3 voxel sizes in one frame region (set dressing 0.125, interactive things 1/24-1/16, props at 0.3 only far away).**

#### 4.2.5 Voxel backend implementation of `AssetBackend`

| Method | Implementation |
|---|---|
| `load(manifest)` | fetch and parse every `voxel` path of the manifest, fill `models: Record<string, VoxModel>`, create the `Palette`, register ramps. Missing file: log once, placeholder box. |
| `station(defId, fp)` | `counterBase` + `.vox` station model (or procedural, §11), scaled so the footprint contract holds (`01 §10.3`); returns a `StationVisual` whose `set()` updates the active feedback of §11. |
| `item(defId)` / `meal(id)` | `ItemFactory`-style: cache `Vox` by signature, `set(item)` swaps the mesh. |
| `chef(look)` | builds the shared skeleton (§9.3) and fills the parts with `Vox` meshes (§9.2 voxel dims). |
| `customer(kind, seed)` | same skeleton family, smaller parts, hair and clothes from the seed. |
| `prop(id, params)` | `PROPS` registry: `harbour/sailboat`, `harbour/rowboat`, `harbour/lamppost`, `harbour/lighthouse`, `harbour/crate`, `harbour/barrel`, `harbour/bollard`, `harbour/gull`, `harbour/sign`, `harbour/awning`, `harbour/deck`, ... one function per id taken from `props.ts`. |
| `profile()` | `{ style: 'voxel', lighting: harbour values, outline: { enabled: false }, doneness: 'ramp' }` |

### 4.3 Smooth backend

Toon low-poly built from code primitives, no external assets required. A glTF loader may replace any piece later (§4.3.5).

#### 4.3.1 Builder API (`assets/smooth/builder.ts`)

```ts
export interface PrimOpts { color: PaletteToken | string; pos?: [number, number, number]; rot?: [number, number, number]; scale?: [number, number, number]; outline?: boolean; cast?: boolean; emissive?: number }
export class SmoothBuilder {
  readonly root: Group;
  roundedBox(w: number, h: number, d: number, r: number, o: PrimOpts): Mesh;   // r = corner radius (0.02-0.08); implemented with BoxGeometry + vertex push, segments 3 per edge
  cylinder(rTop: number, rBottom: number, h: number, o: PrimOpts, seg?: number): Mesh; // seg default 14
  sphere(r: number, o: PrimOpts, wSeg?: number, hSeg?: number): Mesh;                   // default 14 x 10
  capsule(r: number, len: number, o: PrimOpts): Mesh;                                   // CapsuleGeometry, 4 cap segments, 10 radial
  cone(r: number, h: number, o: PrimOpts, seg?: number): Mesh;
  torus(R: number, r: number, o: PrimOpts): Mesh;                                       // 8 x 16
  extrude(shape: Shape, depth: number, bevel: number, o: PrimOpts): Mesh;               // flat signs, tickets, fish
  group(pos?: [number, number, number]): Group;                                         // pivot groups for bones
}
```

Limits: a station <= 1,500 triangles, an item <= 400, a chef <= 3,500 (all parts), a customer <= 2,200, a prop <= 6,000 (static props are merged per material, §16).

#### 4.3.2 Toon material (`assets/smooth/toon.ts`)

```ts
export function toonMaterial(color: PaletteToken | string, opts?: { emissive?: number; rim?: number; doneness?: boolean }): Material;
```

- Base class `MeshToonMaterial` with a shared `gradientMap`: a `DataTexture` 4 x 1, `NearestFilter`, values `[0.52, 0.74, 0.90, 1.0] * 255` (greyscale, 4 bands).
- Colour: token hex lifted by `toonLift`: HSL saturation +8 %, lightness +3 %, so smooth colours sit slightly above the voxel look.
- Rim light: `onBeforeCompile` adds `rim * pow(1 - dot(N, V), 3)` times the sky colour, default `rim = 0.12`, 0 for far props. `customProgramCacheKey` fixed (`'ga-toon-v1'`).
- Materials are cached by `(token, emissive, rim, doneness)`; the scene should use at most 60 distinct toon materials.
- Doneness materials (`doneness: true`) expose uniforms `uDone`, `uChar` (0..1) and the three ramp colours; one material instance per `ItemVisual` (items are few).

#### 4.3.3 Outline (`assets/smooth/outline.ts`)

Inverted hull: a second mesh sharing the geometry, `BackSide`, `MeshBasicMaterial` colour = base colour darkened to 45 % lightness, vertices pushed along normals in the vertex shader by `uOutlineWidth` (world metres: 0.012 for chefs, 0.010 for items, 0.014 for stations). Outlines only on interactive things (stations, items, chefs, customers within 8 m of the focus); never on scenery. `StyleProfile.outline = { enabled: true, widthPx: 2.5, colorHex: 0x2a1d14 }` (information only; the width is in metres in the shader).

#### 4.3.4 Smooth backend implementation

| Method | Implementation |
|---|---|
| `station(defId, fp)` | `smooth/stations.ts`: a function per station def returning `StationVisual`. Shapes in §11 (smooth column). |
| `item(defId)` | `smooth/items.ts`: primitive recipe per item id (§12.2), `set(item)` updates uniforms (no rebuild) except container contents. |
| `chef(look)` | `smooth/chef.ts`: parts of §9.2 smooth column on the shared skeleton. |
| `customer` | `smooth/customer.ts`. |
| `prop(id)` | `smooth/props.ts`: same ids as the voxel backend. A missing smooth prop falls back to the voxel prop (both backends can run in one scene; documented fallback) and logs once. |

#### 4.3.5 Optional glTF loader (`assets/smooth/gltf.ts`)

```ts
export interface GltfOverride { id: AssetId; url: string; scale?: number; anchors?: { top?: string; ring?: string; front?: string }; bones?: Partial<Record<ChefBoneName, string>> }
export async function loadGltfOverrides(list: GltfOverride[]): Promise<Map<AssetId, Object3D>>;
```

- Optional. The manifest `AssetEntry.smooth` may be `procedural:<id>` (default) or `gltf:<url>`. A `gltf:` entry that fails to load falls back to the procedural recipe.
- Only **CC0** packs are allowed (for example Kenney, Quaternius). Each pack goes under `v2/apps/client/public/assets/smooth/<pack>/` with its `LICENSE.txt`; the pack and the files used are listed in `docs/v2/ASSET-LICENSES.md`.
- On load, every mesh material is replaced by `toonMaterial(<nearest palette token>)` (nearest by RGB distance to the glTF base colour) and outlines are added. Node names `anchor_top`, `anchor_ring`, `anchor_front` (or the override map) define anchors. The model is scaled to the footprint (`01 §10.3`).
- A glTF chef must expose the bone names of §9.3 (`bone_armL` ...) or it is rejected (animation would break); chefs stay procedural by default.
- Size limits: <= 200 KB per model after Draco/meshopt, <= 2 MB per level.

### 4.4 Selection, parity, contract tests

- Selection (`01 §10.1`): `?art=smooth` > `localStorage['pk.art']` > `'voxel'`. Reload to switch. The settings screen (05 §10) writes `pk.art` and shows "redémarrage nécessaire". (05 also stores the same value inside `pk.settings.v1`; `pk.art` is the single source the render reads, settings mirrors it.)
- **Switching style must not change**: sim state, view, events, layout boxes, HUD, input, camera spec, level timing. Only meshes, materials, outline, particle shape and `StyleProfile.lighting` deltas change.
- Parity table (every row must exist in both backends):

| Manifest id group | Voxel source | Smooth source |
|---|---|---|
| `station/*` (counter, crate variants, plates, cups, bowls, board, fryer, stove, toaster, oven, coating, mixer, press, blender, sink, bin, pass, planter, dumbwaiter, conveyor, extinguisher, return) | `.vox` + procedural voxel | procedural primitives |
| `item/*` (48 ids) | `.vox` | procedural recipes |
| `meal/*` (13) | `.vox` | procedural (plate + composed contents) |
| `chef/default` | voxel | procedural |
| `customer/adult|child|elder|giant` | voxel | procedural |
| `prop/<level>/*` | voxel | procedural (or voxel fallback) |

- `assets/contract.test.ts` (run for both backends in Vitest with `three` headless, no GL): for every manifest id, the backend returns a visual whose bounding box fits the footprint contract (`01 §10.3`, tolerance 5 %), anchors `top/ring/front` exist for stations, `dispose()` frees geometries, a missing id returns the placeholder without throwing, triangle counts are within §4.3.1 limits (smooth) and `ItemVisual.set` called with every `(state)` does not throw. Details in `09 §9`.

---

## 5. Diorama composition rules

Derived from the level 1 harbour (`harbourScene.ts`): a small playable stage inside a larger, visible place.

### 5.1 Zones (distance from the layout `bounds`)

| Zone | Range from `bounds` | Content | Level 1 example |
|---|---|---|---|
| Z0 Stage | inside `bounds` (level 1: x -4..4, z -2.5..2.5) | stations, chefs, floor. Flat, lighter, higher contrast than the rest. | Kiosk floor `floor_light` boards at y +0.012 |
| Z1 Apron | 0 - 2 m | the structure that frames the stage (walls on at most two sides), the customer queue, pass shelf, crates, posts, awning | pier deck, kiosk walls, serving shelf, queue at `layout.queue` (x 5.8-8.0) |
| Z2 Near surroundings | 2 - 12 m | the first hero set pieces inside the camera frame: boats, stalls, rooftops, planters; ambient life | sailboats at (7,-7.5) and (-13,-13), rowboat (-6.4, 5.3), lamps, bollards, pilings |
| Z3 Mid | 12 - 40 m | one landmark silhouette, off axis | lighthouse at (17, 0, -38) |
| Z4 Horizon | > 40 m | fog band and sky colour (`Fog(sky, 42, 120)`) | water fading into `0xbfe3f5` |

### 5.2 Rules (binding for all 10 levels)

1. **Never a walled box.** At most two of the four sides of Z0 are closed by structure; the other sides show Z2 and Z3. Back wall plus a half-wall with a door gap is the harbour pattern.
2. **One landmark** (Z3) on the upper third, off the vertical centre line (rule of thirds), recognisable as a silhouette from the title orbit.
3. **Colour accents.** Every camera frame contains at least three saturated accents from the level palette (harbour: red awning, blue sail, teal walls) over a calm base (sea, wood). Saturated colour is reserved for scenery on Z1-Z2; Z0 stays warm neutral so food and chefs pop.
4. **Contrast hierarchy.** Luminance order: items and chefs (brightest, outlined in smooth) > stations > floor > Z1 > Z2 > Z3 (lowest, hazy by fog).
5. **Height.** Z0 is flat. Verticality lives in Z1-Z3 (masts, poles, buildings). Nothing taller than 1.2 m stands in front (towards +z) of a station row inside Z0 (camera sight line).
6. **Occlusion.** No scenery between the camera and Z0 above y = 0.4 m. Foreground dressing (pilings, bollards, barrel) sits on the stage rim at the camera side and is lower than 0.5 m, except posts at the corners.
7. **Life budget.** At least 3 independent ambient loops visible (boats bob, awning flutter, gulls, water), at least 1 that reacts to the players (gulls flee, customers cheer) (§14).
8. **Readable floor grid.** The floor shows the 0.5 m cell implicitly (board seams every 3 voxels = 0.375 m) so players judge distance; no pattern may blur the chef's silhouette.
9. **Shadows.** The sun casts soft shadows onto the stage; every Z1 structure that shades the stage is placed so shadows never cover a station top fully (shadow of the awning must not darken a station by more than 35 %).
10. **Portrait safety.** Z1-Z2 dressing must extend to the **portrait dressing rectangle** (§8.4): the stage extended by `0.8 x` its half-depth towards +z and -z and by 2 m in x. No empty water or sky may be visible inside the portrait frame at 390 x 844.
11. **Customers** stand on the Z1 queue points of `layout.queue`, facing the pass, never inside Z0 (`queue` points are outside `bounds`; level 1: x >= 5.8).
12. **Dressing list.** Each level spec (`08`) lists dressing as `{ prop id, position, rotation, scale, zone, ambient? }`; the diorama file is the code form of that list.

### 5.3 `LevelDiorama` implementation skeleton

```ts
export class KiosqueDiorama implements LevelDiorama {
  private stations: Array<{ def: string; effDef: string; enabled: boolean; visual: StationVisual; holder: Group; itemSig: string; item: ItemVisual | null }> = [];
  build(spec: LevelRenderSpec, backend: AssetBackend, host: DioramaHost): void {
    // 1. env (water/sky/backdrop) 2. static structure (merged) 3. stations: backend.station(effDef(spec, i), {w,d}) at (x,z) rot
    // 4. props + ambient 5. chefs: backend.chef(look) for slot 0..maxPlayers-1 (hidden until view.chefs.length > slot)
    // 6. customers 7. markers (guide arrow, target glow)
  }
  update(view: SceneView & { stations: Array<{ item: ItemLike | null; enabled?: boolean; fire?: number }> }, dt: number, time: number): void { /* section 11.1 swap rule, chefs, items, customers, ambient */ }
}
```

`effDef(spec, i) = spec.stations[i].enabled ? spec.stations[i].def : 'counter'`. `LevelRenderSpec.stations[i].enabled` is the initial value; `update` re-reads `view.stations[i].enabled` every frame and swaps the visual when it changed (§11.1).

---

## 6. Water, sky, fog, backdrops

### 6.1 Water (`env/water.ts`, exact harbour values)

`Water(size = 240, segments = 120)`: `PlaneGeometry` rotated -90 degrees about x, at y = -0.4, `ShaderMaterial`.

- Vertex: `w = sin(x*0.9 + t*1.3)*0.5 + sin(y*1.1 - t*1.0)*0.5 + sin((x+y)*0.5 + t*0.7)*0.5`; `z += w * 0.07` (plane-local z = up); `vWave = w`.
- Fragment: `base = mix(uDeep, uShallow, clamp(0.5 + vWave*0.25, 0, 1))`; `fres = pow(1 - clamp(view.y, 0, 1), 3)`; `col = mix(base, uSky, fres*0.75) + glint`; glint = `smoothstep(0.93, 1.0, sin(wx*7.1 + t*1.7 + sin(wz*1.3)) * sin(wz*6.3 - t*1.3)) * 0.22`; fog: `mix(col, uFog, smoothstep(42, 120, dist))`.
- Uniforms default: `uDeep 0x1b6f9a`, `uShallow 0x39b3c9`, `uSky 0xcfeaf7`, `uFog 0xbfe3f5`.
- The mood may override the four colours and the wave amplitude (`0.07`) via `WaterParams`.
- Smooth style: same shader, plus a 2-band toon quantisation of `base` (`floor(x*4)/4` blended 50 %) and foam rings where props meet water (flat white `RingGeometry` decals with opacity 0.5, scale pulse 1.0-1.15 at 0.6 Hz). Foam rings also exist in voxel style (they are decals, not voxels): one per boat and per piling row.
- Reduced motion (`05 §11`): wave amplitude x0.4 and time scale x0.5.

### 6.2 Fog and sky

`scene.background = Color(mood.sky)`, `scene.fog = new Fog(mood.fog.color, mood.fog.near, mood.fog.far)`; sky and fog colour are equal so the horizon dissolves. Harbour: near 42, far 120.

### 6.3 Backdrop kinds (`env/backdrop.ts`)

Levels pick one in `LightingMood.backdrop`. Each kind is a function `createBackdrop(host, params): { update(dt, time): void }`.

| Kind | Used by | Content |
|---|---|---|
| `water` | 1 harbour, 4 beach, 6 river boat | water plane (§6.1) |
| `sand` | 3 diner (desert) | large low-poly sand plane with 3 dune bands (tinted `#e8c98f`, `#d9b277`, `#c99d63`), heat shimmer off, far mesas silhouettes at 60-100 m |
| `city` | 2 festival (hills and crowd), 5 rooftop, 7 night market | ring of building blocks 20-80 m with lit window decals (emissive quads), parallax-free |
| `scroll` | 6 boat banks, 8 train | ground textures translating at `speed` m/s along x (bridges, tunnels are `twist` visuals in `08`) |
| `glasshouse` | 9 greenhouse | big transparent panes (opacity 0.12, additive-free), plants silhouettes outside, sky above |
| `table` | 10 giant's banquet | enormous tablecloth plane (checker 1 m) and giant props at scale 5-8, fog starts at 30 |

Common rules: backdrops never cast shadows, never write depth beyond `far = 200` of the camera, contain no animated element faster than 0.5 Hz except water.

---

## 7. Lighting rig and mood presets

### 7.1 Rig (`lighting/rig.ts`)

```ts
export interface LightingMood {
  id: string;                                         // 'sunny_harbour' ...
  backdrop: 'water' | 'sand' | 'city' | 'scroll' | 'glasshouse' | 'table';
  sky: number;                                        // background and fog colour
  fog: { near: number; far: number };
  hemi: { sky: number; ground: number; intensity: number };
  sun: { color: number; intensity: number; position: [number, number, number]; target: [number, number, number]; shadowHalfSize: number; shadowFar: number; radius: number; bias: number; normalBias: number };
  exposure: number;
  fill?: { color: number; intensity: number; position: [number, number, number] };   // optional second directional light, no shadow
  points?: Array<{ color: number; intensity: number; distance: number; decay: number; position: [number, number, number]; flickers?: boolean }>; // <= 4
  emissiveBoost?: number;                             // multiplier on emissive props (night levels)
  water?: Partial<WaterParams>;
}
export function applyMood(host: RenderHost, mood: LightingMood, tier: QualityTier): void;
```

Fixed parts: one `HemisphereLight`, one shadow-casting `DirectionalLight` (`sun`), optionally one non-shadow fill, up to 4 `PointLight`s (no shadows). Shadow map size from the tier (§16): 2048 high / 1536 medium / 1024 low. `sun.shadow.camera` is the orthographic box `±shadowHalfSize`, near 1, far `shadowFar`; `sun.target` at the mood target. `normalBias` is mandatory for voxel faces (acne). The sun direction must keep shadows falling **towards the camera-left and slightly towards the viewer** (sun at -x, +y, +z of the stage): this keeps the shadow of each station row on the floor in front of it where it reads as depth, never hiding the item on top.

### 7.2 Presets for the 10 moods

Level 1 values are the exact code values (`harbourApp.ts`); other rows are `Default (tunable)`. Colours as hex without `0x`.

| # | Mood id | Sky/fog | Fog near/far | Hemi (sky/ground/int) | Sun (colour/int/pos) | Exposure | Extra |
|---|---|---|---|---|---|---|---|
| 1 | `sunny_harbour` | bfe3f5 | 42/120 | aedcff / e6cf9c / 1.15 | ffe0ad / 2.6 / (-9,16,8) | 1.05 | one lamp point light, intensity 0 (0.6 at play, 1.2 in the last 30 s), see §7.5 |
| 2 | `festival_dusk` | f3b58a | 30/90 | ffc9a0 / 6b5a8a / 0.9 | ffb36b / 2.0 / (-10,10,9) | 1.10 | fill b48cff 0.5 at (9,8,-4); 4 string-light points ffd9a0 0.9 distance 6; emissiveBoost 1.4 |
| 3 | `desert_diner_noon` | f6dcae | 50/150 | ffe9c4 / d9a86a / 1.05 | fff0c8 / 3.0 / (-7,18,10) | 1.00 | neon: 2 point lights ff4d8d and 4dd2ff, 0.8, distance 5; emissiveBoost 1.6 on neon only |
| 4 | `beach_sunset` | ffc08f | 36/110 | ffd2a8 / 5ec2c9 / 0.95 | ff9f5a / 2.3 / (-12,7,6) | 1.08 | water uDeep 1f7fa8, uShallow 5ad3d6; shadows long (shadowFar 60) |
| 5 | `rooftop_night` | 1a2547 | 24/80 | 5a6fb0 / 2a2f4a / 0.75 | b9c8ff / 1.1 / (-8,14,8) | 1.20 | 4 warm points ffc27a 1.4 distance 7 (oven glow); emissiveBoost 1.8; city windows |
| 6 | `river_golden` | e9d6a3 | 34/100 | fff0c8 / 7fae7a / 1.0 | ffd78a / 2.4 / (-9,13,8) | 1.05 | bridge shadows are scripted by the twist diorama (moving shadow quad, opacity 0.35) |
| 7 | `night_market` | 2b1d3a | 22/70 | 8c78c4 / 3a2a4a / 0.8 | ffc98a / 1.2 / (-8,12,7) | 1.20 | 4 lantern points ff9a4a 1.6 distance 6, flicker 2 Hz amplitude 0.15; emissiveBoost 2.0 |
| 8 | `train_day` | cfe6f2 | 38/110 | cfe8ff / 9fb58a / 1.1 | fff2d0 / 2.4 / (-8,15,9) | 1.05 | tunnel: `exposure` lerps to 0.55 and `hemi.intensity` to 0.4 in 0.6 s while the twist flag `tunnel` is set; station emissive x1.5 (`emissiveBoost` animated) |
| 9 | `greenhouse_bright` | e4f3e0 | 40/120 | e8ffe6 / 8cc28a / 1.25 | fffbe0 / 2.2 / (-6,18,6) | 1.00 | sprinkler: no light change; god-ray quads (additive, opacity 0.12) |
| 10 | `banquet_candle` | 3a2a2a | 30/90 | ffd7b0 / 7a5a4a / 0.95 | ffcf8a / 1.9 / (-9,13,8) | 1.10 | 2 candle points ffb35a 1.8 distance 8 (flicker 3 Hz amplitude 0.1); giant shadow quad optional |

Hard constraints: shadow-casting lights = 1; point lights <= 4; total fragment-shader lights <= 6; `hemi.intensity + sun.intensity*0.4` must stay within 2.2-4.2 so the exposure is comparable between levels; background luminance must differ from the stage floor luminance by at least 25 % (contrast test, §18).

### 7.3 Style deltas

`StyleProfile.lighting` of the smooth backend overrides: `hemi.intensity x1.1`, `sun.intensity x0.9`, `sun.radius x0.8` (crisper toon shadows), `exposure -0.03`. The mood table is style independent; the backend's profile multiplies it.

### 7.4 Station and chef readability lights

No per-object lights. Emissive materials only: active fryer glow `#ffb45a` emissive 0.35 pulse, stove coil `#ff6a2a`, lamp bulbs `#ffe6a0`.

### 7.5 Late-run behaviour (exact, replaces the flicker of the demo)

When `view.phase === 'playing' && view.timeLeftTicks < 900` (30 s): lamp bulbs and lamp point lights **pulse** with `f = 0.7 + 0.3 * sin(time * 2 * PI * 1.5)` (1.5 Hz, below the 3 Hz flash limit of `05 §11`); with reduced motion on, `f = 0.85` constant. No other light changes. The clock turns red in the HUD (`05`).

---

## 8. Camera

### 8.1 Principle

Fixed per level (owner decision 4): the camera frames the whole stage. It does not follow one chef. It leans toward the chef centroid by `spec.lean` (default 0.1; harbour **0.12** x and 0.1 z as coded; `01 §10.5` says 0.2 for the harbour: the code value 0.12 is binding for level 1, and `01`/`03` should show 0.12). Multi-zone levels ease between listed framings.

### 8.2 `CameraSpec` (from `01 §10.5`) and the 04 extensions

```ts
export interface CameraSpec {
  position: [number, number, number];   // landscape reference position, metres
  target: [number, number, number];
  fov: number;                          // vertical degrees
  lean: number;                         // 0..0.2
  zones?: Array<{ zone: string; position: [number, number, number]; target: [number, number, number]; fov: number }>;
  // 04-ext (optional)
  frame?: { x0: number; x1: number; z0: number; z1: number };  // rectangle that must stay fully visible; default = stage bounds expanded by (1.6 in x, 1.0 in z)
  minDistance?: number;                 // default 15
  maxDistance?: number;                 // default 40
  portrait?: { pitchDeg: number; margin: number; centerY: number };  // defaults { pitchDeg: pitch + 10, margin: 0.4, centerY: 0.5 }
}
```

`level.json.camera` is this object (`03`). Level 1 values (exact, from `harbourApp.ts`: pitch 54 degrees, distance 15, focus (0, 0.2, 0.4 - 0.2 = 0.2) ... position = `(0, 15*sin54, 0.4 + 15*cos54)` and the look-at `(0, 0.2, 0.2)`):

```json
"camera": { "position": [0, 12.14, 9.22], "target": [0, 0.2, 0.2], "fov": 38, "lean": 0.12,
            "frame": { "x0": -5.6, "x1": 5.6, "z0": -3.5, "z1": 3.5 }, "minDistance": 15 }
```

The direction `target - position` defines pitch and yaw; `position` only fixes the reference distance (the rig re-computes the distance, §8.3).

### 8.3 `CameraRig` (`camera/cameraRig.ts`)

```ts
export class CameraRig {
  readonly camera: PerspectiveCamera;                 // near 0.1, far 200
  setSpec(spec: CameraSpec, stage: { x0: number; x1: number; z0: number; z1: number }): void;
  setViewport(width: number, height: number, safe: { top: number; bottom: number; left: number; right: number }): void; // CSS px; safe = HUD insets (05 §4.1)
  update(centroid: { x: number; z: number }, dt: number, time: number): void;
  shake(amount: number): void;                        // metres, decays exp(-5 dt); ignored when reduced motion
  setTitleMode(on: boolean): void;
  project(x: number, y: number, z: number): { x: number; y: number } | null;
  readonly aspect: number;
}
```

Per-frame computation (deterministic given inputs):
1. `dir = normalize(target - position)`; `pitch = asin(-dir.y)`; `yaw` from `dir.xz`.
2. `portrait = aspect < 0.9`. If portrait: `pitch = deg2rad(spec.portrait.pitchDeg)` (default +10 degrees, max 70), `margin = portrait.margin`.
3. `focus` = `target` + lean: `focus.x = target.x + lean * centroid.x`, `focus.z = target.z + lean * 0.83 * centroid.z`, smoothed with `focus += (goal - focus) * (1 - exp(-4 dt))` (k = 4, as the harbour).
4. `distance = fitDistance(frame, pitch, yaw, fov, aspect, safe)` (§8.3.1), clamped to `[minDistance, maxDistance]`.
5. Camera position = `focus - dir(pitch, yaw) * distance`; `lookAt(focus)`.
6. Screen centre shift (portrait and any layout with HUD insets): `camera.setViewOffset(W, H, 0, (0.5 - centerY) * H, W, H)` so the stage centre lands at `centerY` of the viewport height (default 0.5; the HUD safe area moves it, §8.4).
7. Shake: after step 5, `camera.position += (sin(t*71), cos(t*63), 0) * amount` (the harbour pattern; deterministic, no random), `amount *= exp(-5 dt)`, cut below 0.002.

#### 8.3.1 `fitDistance`

Project the 8 corners of the box `frame x [0, 2.2]` (floor level and 2.2 m high to include tall posts) with the candidate camera and binary search the distance in `[8, 60]` (24 iterations) for the smallest distance where every corner has `|ndcX| <= 1 - padX` and `|ndcY| <= 1 - padY`, with `padX = (safe.left + safe.right) / (2 W) + 0.02` and `padY` likewise from `safe.top/bottom`. If `fit < minDistance` use `minDistance` (level 1 landscape 16:9 gives about 9.1 and is clamped to 15, matching the demo exactly).

### 8.4 Landscape and portrait/mobile framing fix

Problem (screenshot `service-390x844.png`): the demo derives distance from horizontal extent only and keeps the 54 degree pitch; in portrait the stage becomes a thin strip in the middle of the screen, with about 60 % of the viewport empty water.

Fix (all four are required):
1. **Fit both axes** with `fitDistance` (§8.3.1) instead of the width-only formula, so portrait never zooms out more than needed.
2. **Raise the pitch** by `portrait.pitchDeg - pitch` (default +10 degrees, i.e. 64 degrees): a steeper view spreads the stage depth over more screen height.
3. **Centre the stage in the free area** between the HUD blocks: `centerY` (default 0.5) is replaced at runtime by the middle of the free vertical band: `centerY = (safe.top + (H - safe.bottom)) / (2 H)`; with the portrait HUD (tickets row 17 % at top, prompts and touch area 22 % at the bottom) this gives about 0.52.
4. **Dress the portrait frame**: the diorama (§5.2 rule 10) must fill the portrait dressing rectangle, so wider-than-tall frames never show bare backdrop. Acceptance (§18): in the 390 x 844 screenshot, bare water/sky/ground without any object must be < 25 % of pixels outside HUD areas.
5. Minimum chef size: in portrait the chef height on screen must be >= 5.5 % of the viewport height (about 46 px at 844). If the fit would make it smaller, `maxDistance` clamps and the stage crops 0.3 m at the sides rather than shrinking (the stations row is never cropped: the frame rectangle's station extent is a hard constraint, only its margin may crop).

### 8.5 Multi-zone levels

`zones` lists framings (e.g. level 5 two floors, level 8 two wagons). The active framing is chosen by the zone of `centroid` (zone rectangles come from `LayoutStation.zone`, `03`). The rig blends `position/target/fov` to the active zone with `k = 3` (exp smoothing, about 0.7 s). The camera never moves farther than the union of zone frames; with chefs in two zones it uses the zone containing the **majority** of chefs, ties choose the lower zone index. Gentle only: a transition must never exceed 6 m/s of focus speed (clamp).

### 8.6 Title mode and shake rules

- `setTitleMode(true)`: `orbit += dt * 0.05`; `look = (1.2, 0.6, 0.2)`; `d = max(18, 8.5 / (tanV * aspect))`; position = `(look.x + sin(0.55 + sin(orbit) * 0.35) * d * 0.55, 6.5 + d * 0.25, look.z + d * 0.9)` (exact harbour). Used behind title, level select, results.
- Shake is only triggered by `TicketExpired` (0.06 m), never by routine events. Reduced motion: ignored.
- Camera never rolls; fov is constant per spec (no zoom effects).

---
## 9. The chef

### 9.1 Design goals

A readable, charming chef that reads at 40 px tall in portrait: big head, chunky torso, a tall toque as the iconic silhouette, a coloured scarf and apron per player, a face that shows effort and joy, elbows and a knife. All motion is procedural from `ChefPose`; no keyframe assets.

### 9.2 Proportions and parts (metres, binding; `Default (tunable)` within 1.0-1.2 m total)

| Part | Size w x h x d | Position (body-local, feet at y=0) | Colour tokens |
|---|---|---|---|
| Shoes (x2) | 0.13 x 0.07 x 0.20 | child of leg, at the bottom, +0.03 forward | `shoe` |
| Legs (x2) | 0.12 x 0.22 x 0.12 (hip pivot at the top) | hip pivots at (+-0.10, 0.22, 0) | `pants` |
| Torso (jacket) | 0.40 x 0.30 x 0.26 | pivot (waist) at (0, 0.22, 0); mesh from 0 to 0.30 above the pivot | `white`; scarf band 0.05 high at the top in the slot colour; double row of 2+2 buttons `off_white` |
| Apron | 0.30 x 0.24 x 0.03 on the torso front (+z) | torso-local (0, 0.02, 0.145) | slot colour; chest emblem 0.07 square (off_white) at the top centre |
| Neck | 0.12 x 0.04 x 0.10 | torso-local (0, 0.30, 0) | `skin` |
| Head | 0.40 w x 0.36 h x 0.34 d, rounded | pivot (neck) at torso-local (0, 0.32, 0); mesh centred 0.17 above the pivot | `skin` (4 tones, `ChefLook.skin`) |
| Face | eyes 0.045 x 0.06, mouth 0.10 wide | on the head front (+z), eyes at head-local (+-0.085, 0.19, 0.17), mouth (0, 0.09, 0.17); cheeks 0.05 `skin_blush` | `eye`, `skin_blush` |
| Hat | see 9.4 | pivot at head-local (0, 0.33, 0) | `white` + slot colour band |
| Arms (x2) | upper 0.09 x 0.14 x 0.09, forearm 0.08 x 0.12 x 0.08 (elbow at 0.14 below the shoulder) | shoulder pivots at torso-local (+-0.25, 0.26, 0) | `white` sleeve, forearm cuff slot colour 0.02, hand sphere r 0.055 `skin` |
| Heel ring | torus R 0.42 r 0.03 (flat), under the feet at y 0.02 | root | slot colour, opacity 0.9 |
| Blob shadow | cylinder r 0.34 h 0.01 | root y 0.012 | black opacity 0.18 (kept in addition to the real shadow so the chef reads in shade) |

Total height: 0.22 (legs) + 0.30 (torso) + 0.04 (neck overlap) + 0.36 (head) + hat up to 0.38 => 1.20 m (toque). Width at the shoulders 0.40 + arms 0.50.

**Voxel backend** (voxel size 1/24 m = 0.0417): legs 3 x 5 x 3 voxels each with a 3 x 2 x 4 shoe; torso 10 x 7 x 6; head 10 x 9 x 8 with a 1-voxel nose bump at (5,3,8) and eyes 1 x 2 voxels; arms 2 x 3 x 2 upper + 2 x 3 x 2 lower with a 2 x 2 x 2 hand; hat dims in 9.4. Same colour tokens. Each part is a separate mesh attached to its bone group (pivot passed to `Vox.mesh(size, pivot)`).

**Smooth backend**: torso `roundedBox(0.40, 0.30, 0.26, r 0.07)`, head `roundedBox(0.40, 0.36, 0.34, r 0.14)`, legs `capsule(0.055, 0.12)`, shoes `roundedBox(0.13, 0.07, 0.20, 0.03)`, arms `capsule(0.045, 0.10)` x2 per arm, hands `sphere(0.055)`, eyes `sphere(0.03)` scaled (1, 1.3, 0.6), outline on all body parts (0.012 m), toon lift on skin.

### 9.3 Skeleton (backend independent, `rig/chefSkeleton.ts`)

```ts
export type ChefBoneName =
  | 'root' | 'body' | 'hipL' | 'hipR' | 'torso' | 'neck' | 'head' | 'hatPivot'
  | 'shoulderL' | 'shoulderR' | 'elbowL' | 'elbowR' | 'handL' | 'handR'
  | 'toolSocket' | 'holdAnchor';
export interface ChefSkeleton {
  bones: Record<ChefBoneName, Object3D>;
  face: { eyeL: Object3D; eyeR: Object3D; mouths: Record<'neutral' | 'open' | 'smile' | 'o', Object3D> };
  knife: Object3D;               // attached to toolSocket, hidden by default
  extinguisher: Object3D;        // attached to handR, hidden by default
  emblem: Object3D;
}
export function createChefSkeleton(): ChefSkeleton;   // creates the Object3D tree with the pivots of the table below
```

Tree and pivots (local positions in metres):

| Bone | Parent | Local position | Rotation axes used |
|---|---|---|---|
| `root` | scene | world (x, 0, z), yaw | y |
| `body` | root | (0, 0, 0) | x (lean), position.y (bob), scale |
| `hipL` / `hipR` | body | (-0.10 / +0.10, 0.22, 0) | x |
| `torso` | body | (0, 0.22, 0) | x (lean), y (twist), z |
| `neck` | torso | (0, 0.30, 0) | (none, parent of head) |
| `head` | neck | (0, 0.02, 0) | x (nod), y (look), z (tilt) |
| `hatPivot` | head | (0, 0.33, 0) | x, z (hat wobble) |
| `shoulderL` / `shoulderR` | torso | (-0.25 / +0.25, 0.26, 0) | x (swing), z (out), y (twist) |
| `elbowL` / `elbowR` | shoulder | (0, -0.14, 0) | x only (negative = forearm forward) |
| `handL` / `handR` | elbow | (0, -0.12, 0) | none |
| `toolSocket` | handR | (0, -0.02, 0.04) | knife attaches here |
| `holdAnchor` | torso | (0, 0.12, 0.30) | held item parent (world-ish: 0.44 m above the floor when torso is upright) |

`ChefVisual.holdAnchor()` returns `bones.holdAnchor`. A held item is placed with its base at the anchor (item origin = bottom centre).

### 9.4 Hats and colours

`ChefLook.hat` indexes `HATS`. Default hat per slot (changeable in the lobby later): `[0, 1, 2, 3, 4, 5]`. The slot colour is always visible on the scarf, apron trim, hat band and heel ring (readability rule, `08-characters-and-camera.md`).

| Index | Name | Voxel dims (1/24) | Smooth recipe | Colours |
|---|---|---|---|---|
| 0 | `toque` | band 9 x 2 x 8 + puff 11 x 6 x 10 (+ 1-voxel dome 7 x 1 x 8) | cylinder band r0.19 h0.07 + sphere puff r0.2 squashed y0.9 at +0.2 and 3 small bumps | white, band slot colour |
| 1 | `cap` | crown 9 x 3 x 8 + brim 7 x 1 x 4 forward | sphere half r0.19 + flat roundedBox brim 0.16 x 0.02 x 0.12 | slot colour, brim slot dark (x0.75) |
| 2 | `bandana` | 9 x 2 x 8 tight on the head + knot 2 x 2 x 2 behind | torus-ish band + two tails | slot colour with off_white dots (2 voxels) |
| 3 | `beanie` | dome 9 x 4 x 8 + pompom 3 x 3 x 3 | hemisphere r0.2 + sphere r0.045 | slot colour, pompom off_white |
| 4 | `headband` | band 9 x 1 x 8, hair tuft 3 x 2 x 3 on top | thin torus + small sphere tuft | slot colour, tuft `hair_dark` |
| 5 | `beret` | flat disc 10 x 2 x 9 offset left 1 voxel | flattened sphere r0.2 y0.35, tilt z 0.15 | slot colour, stalk 1 x 1 x 1 |

Hat wobble: while moving, `hatPivot.rotation.z = -sinφ * 0.05 * walk` and `rotation.x = 0.04 * sin(2φ) * walk` (soft lag; none for headband/bandana). Hat bounces +0.01 m at landing from the happy hop.

### 9.5 Animation specification

All angles in radians, times in seconds. `φ` = `pose.phase`. `m = clamp(pose.walk, 0, 1)`. `dt` is frame time. Easing functions (exact):

```ts
const easeOutQuad = (u: number) => 1 - (1 - u) * (1 - u);
const easeInQuad  = (u: number) => u * u;
const easeInCubic = (u: number) => u * u * u;
const easeInOutSine = (u: number) => 0.5 - 0.5 * Math.cos(Math.PI * u);
const easeOutBack = (u: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); };
const smooth = (cur: number, goal: number, k: number, dt: number) => cur + (goal - cur) * (1 - Math.exp(-k * dt)); // exp smoothing
```

#### 9.5.1 Layers and blending

`ChefAnimator.update(pose, dt, time) -> BonePose` has three layers applied in this order, later layers overwrite earlier ones on the channels they own:

1. **Base** (always): idle / walk / carry / dash.
2. **Action** (exclusive, at most one): chop, wash, extinguish, throw, flick. Weight `wa` eases to 1 in 0.08 s (`smooth(k=28)`) and back to 0 in 0.12 s (`k=19`). Arm bone channels = `lerp(base, action, wa)`.
3. **Reaction** (additive, can overlap): happy hop, hurt/bump. Added on top of the result.

Priority when several flags are set (action layer): `throwT > 0` > `extinguishing` > `washing` > `chopping` > `flickT > 0`. `dashing` is base layer and cancels `chopping`/`washing` visuals (the sim stops them).

#### 9.5.2 State table

| State | Trigger (pose) | Legs | Arms (shoulder x / z, elbow x) | Torso / head / body | Extras and timing |
|---|---|---|---|---|---|
| **Idle** | `walk < 0.05` and no flags | hips x 0 (smooth to 0, k 14) | shoulder x 0.04 + 0.03 sin(1.1 t), z +-0.10 (hanging, slightly out), elbow -0.12 | torso scaleY `1 + 0.012 sin(2.2 t)`; head z `0.03 sin(0.9 t)`; body y 0 | blink every 2.6-5.2 s (`visualRng`), eyes scaleY 0.1 for 0.12 s; idle look-around every ~8 s: head y to +-0.5 in 0.8 s (easeInOutSine), hold 0.6 s, back 0.8 s; mouth `neutral` |
| **Walk** | `walk >= 0.05` | hipL x `+0.75 sinφ m`, hipR x `-0.75 sinφ m` | shoulderL x `-0.90 sinφ m`, shoulderR x `+0.90 sinφ m` (opposite to the same-side leg, fixes the demo), z +-0.10, elbow `-0.25 - 0.20 max(0, -sinφ) m` for L (mirrored for R) | body y `|sinφ| 0.045 m`; body scaleY `1 + 0.025 cos(2φ) m`, scaleXZ the inverse; torso y twist `0.10 sinφ m`, x lean `0.06 m`; head y `-0.5 * torso twist`, x nod `0.03 cos(2φ) m` | `φ` advances `dt (6 + speed 2.2)` (speed in m/s); footfall tick at `sinφ` zero crossings (audio `footstep`, §05 audio, throttled to 1 per 0.18 s); mouth `neutral` |
| **Carry** | `carrying` (`held` is `light` or `plate`) | as walk | shoulders x `-1.30`, z `+-0.18`, elbow `-0.45`; walk swing amplitude x 0.08; slight bob `0.015 sin(2φ)` | torso x lean `0.03 + 0.06 m`; head x `-0.04` | weight smooth `k 14` from walk arms to carry arms (0.12 s); plates: shoulders x `-1.45`, elbows `-0.25` (arms straighter), item sway `holdAnchor.rotation.z = 0.04 sin(φ)` |
| **Chop** | `chopping` | feet planted (hips x 0), body y dips | right: shoulder x per curve below, elbow per curve, right shoulder z `-0.05`; left (holds the item): shoulder x `-0.95`, elbow `-0.40`, push `-0.04 * impact`; knife visible | torso x `0.12 + 0.10 * impact`, head x `0.06 + 0.04 * impact` (nod lags 0.03 s), body y `-0.015 * impact`; mouth `o` while chopping | see 9.5.3 |
| **Wash** | `washing` | planted | both shoulders x `-0.95`, z +-0.12, elbowL `-0.50 + 0.35 sin(ω t)`, elbowR `-0.50 - 0.35 sin(ω t)`, shoulder y L `+0.20 sin(ω t)`, R `-0.20 sin(ω t)`, `ω = 20` (3.2 Hz) | torso x `0.14`, head x `0.15` (looking down), body y `0.010 sin(2ω t)`; mouth `neutral` | bubbles (§13) 3 per second at the sink top, soap-white `#ffffff` + `#bfe9ff` |
| **Extinguish** | `extinguishing` | feet planted, hips x `+-0.15` (wide stance) | right shoulder x `-1.45` (aiming at the target), right elbow `-0.10`; left shoulder x `-1.10`, elbow `-0.35` (on the hose); extinguisher visible in the right hand | torso x `-0.04` (lean back), head x `0.0`; body recoil z `-0.012 sin(60 t)` (9.5 Hz); mouth `o` | foam spray (§13), 12 particles/s, from `holdAnchor` + 0.25 m forward to the target |
| **Throw** | `throwT` 0..1 over 0.45 s | planted, hipR x `-0.2` (step) | no wind-up (the sim has already launched the item): `t 0..0.07`: both shoulders from -1.30 to `-1.75` (`easeOutBack`), elbow `-0.05`; `0.07..0.17`: hold; `0.17..0.45`: return to base (`easeInOutSine`) | torso y twist `-0.18` toward the throw side during the hold, x `0.0`; mouth `o` | the item flight is rendered from `RushView.air` (arc height 0.8 m, `t/256`); a tiny whoosh trail of 4 white quads on release |
| **Dash** | `dashing` | hips alternate at `ω 14 rad/s`, amplitude 0.9, feet leave the ground (body y +0.04) | shoulders x `+0.90` (swept back), z `+-0.10`, elbows `-0.3` | body x pitch `0.35` (smooth k 30), squash: scaleY 0.92 and scaleZ 1.12 for the first 0.05 s; torso x 0.10; head x `-0.15` (looks ahead) | dust puffs 2 per 0.05 s at the feet (sand `#e9d7b0`, §13); 3 speed lines (flat quads) behind, fade 0.15 s; the heel ring pulses dim while `dashReady` is false (opacity 0.35, back to 0.9 at ready, pop scale 1.15 for 0.15 s) |
| **Serve / place flick** | `flickT > 0` (0.22 s) | unchanged | right shoulder x `base - 0.9 * sin(π u)`, left `base - 0.5 * sin(π u)` where `u = 1 - flickT`; first half eased with `easeOutQuad` | torso x `+0.05 sin(π u)` | triggered by `Grabbed`, `Placed`, `Plated`, `Trashed`, `Served` events of that slot |
| **Happy hop** | `happy` 0..1 over 0.55 s | tucked: hips x `-0.5 sin(π u)` | both shoulders x `-2.6 sin(π u)` (arms up), z `+-0.25` | body y `0.35 sin(π u)`; at `u > 0.9` squash scaleY 0.88 for 0.08 s; mouth `smile` for 0.8 s; if streak >= 3 a full 360 degree yaw spin: `yaw += 2π easeInOutSine(u)` | triggered by `Served` of that slot; confetti is a scene effect (§13) |
| **Hurt / bump** | `hurt` 0..1 (decays over 0.35 s from the scene) | hips x `+-0.3` (stumble) | shoulders flail: x `-0.6 + 0.6 sin(14 t) * hurt`, z `+-0.5 hurt` | body recoils 0.12 m opposite to the push (the scene offsets `root` visually only, `hurt * 0.12`), torso x `-0.2 hurt`; mouth `o` | if `hurt >= 0.6` for > 0.5 s (a stun, future): 3 yellow stars orbit the head at r 0.25, 1.5 rad/s |

#### 9.5.3 Chop swing (Minecraft-like repeated tool swing)

The sim emits `ChopHit` every 8 ticks (`CHOP_HIT_EVERY = 8` = 0.2667 s) while X is held on a board. The swing is a repeated loop of period `P = 8/30` s locked to that event so the blade lands on the sound.

```ts
const P = 8 / 30;
const LEAD = 0.03;                                    // visual lead so contact coincides with the audio (ChopHit arrives one frame late)
const u = ((pose.chopClock! + LEAD) % P) / P;         // 0 = contact (the instant of the event), 0.12 = rebound, 0.70 = raised, 1.0 = next contact
// right shoulder x:
//  u in [0,    0.12): lerp(-0.55, -0.85, easeOutQuad(u/0.12))        // rebound
//  u in [0.12, 0.70): lerp(-0.85, -2.35, easeInOutSine((u-0.12)/0.58)) // raise
//  u in [0.70, 1.00): lerp(-2.35, -0.55, easeInCubic((u-0.70)/0.30))   // strike (accelerating)
// right elbow x: contact -0.30 -> raised -1.00 (same u curve, same easing)
const impact = Math.pow(1 - Math.min(1, u / 0.35), 2);  // 1 at contact, 0 by u = 0.35
```

Before the first `ChopHit` of a session (`chopClock` undefined) the visual free-runs with contact scheduled at `+P` from the chop start. If `chopping` stays true with no hit for > 0.5 s (blocked or waiting), freeze at `u = 0.70` (raised) with idle breathing.

Knife: `knife` object visible with scale easing 0 -> 1 in 0.06 s when entering the state; `knife.rotation.x = +1.15` relative to the forearm (blade pointing forward/down), blade length 0.22 m, handle `wood_dark`, blade `#dfe6ea` / `#aab4ba`.

On contact (`ChopHit`): the diorama calls `station.bump = 1` (board shakes: position y -0.012 for 0.05 s then settles, exponential, 0.08 s), `chopBits` particles (§13, 5 per hit), item squash on the board (scaleY 0.9 for 0.06 s), audio `chop_hit` (05). `ChopDone`: 12 bits burst + `ding` pop sparkle on the item.

#### 9.5.4 Face

Mouths: `neutral` (small line), `open` (talking, unused for now), `smile` (happy), `o` (effort). Eyes: ellipses; blink scale; during `Hurt` eyes squeeze (scaleY 0.3, 0.2 s). Eye highlight: smooth backend adds a white 0.012 sphere on each eye; voxel adds one lighter voxel.

#### 9.5.5 The animator contract

```ts
export interface BonePose { /* for each ChefBoneName: position?: [x,y,z]; rotation?: [x,y,z]; scale?: [x,y,z]; plus: mouth: 'neutral'|'open'|'smile'|'o'; blink: number; knife: number; extinguisher: number; yawSpin: number; rootOffset: [x,y,z] } */ }
export class ChefAnimator {
  constructor(seed: number);                     // seed = slot + level hash, drives blink/fidget via visualRng
  update(pose: ChefPose, dt: number, time: number): BonePose;   // pure of Three.js; unit-testable
}
export function applyBonePose(sk: ChefSkeleton, b: BonePose): void;
```

`ChefAnimator` has no Three.js dependency, so it is unit-tested (`chefAnimator.test.ts`: walk symmetry, chop contact at `u = 0`, state priorities, all angles within [-3.2, 1.2]).

### 9.6 Driving a chef from the sim (diorama side)

Per chef slot, each frame, from `view.chefs[i]` (30 Hz data):
1. Position smoothing as in the demo: `k = 1 - exp(-28 dt)`; yaw smoothing `k = 1 - exp(-20 dt)` toward `atan2(fx, fz)` with angle wrap.
2. `speed = |dPos| / dt`, smoothed `k = 14`; `walk = min(1, speed / 3)`; `phase += dt * (6 + speed * 2.2)`.
3. `carrying = held && !chopping`; `held` kind: `plate` if `held.def` is `plate | bowl | cup`, `extinguisher` for that def, else `light`.
4. `chopClock = time - lastChopHitTime` (set by `onEvent('ChopHit', slot)`).
5. `washing = verb === 'wash' && X held` (the client passes the X-held state of its local seats; for remote chefs derive from `ChefView.verb === 'wash'` and `chopping` flag, which the sim sets for any X action: `ChefView.chopping` is true for all X actions, the verb tells which); `extinguishing = verb === 'extinguish'`.
6. Events: `Grabbed|Placed|Plated|Trashed|Served` -> `flickT`; `Served` -> `happy`; `Dash` (visual only, dashing flag already drives it); `Threw` -> `throwT`; `Shoved` -> `hurt`.
7. Held item: parent its `ItemVisual.root` under `holdAnchor`; rebuild only when `signature` changes.
8. Visibility: chef i visible iff `i < view.chefs.length`.

---

## 10. Customers

### 10.1 Sizes and parts

Same skeleton family as the chef without hat pivot (`createCustomerSkeleton`, same bone names minus `toolSocket`, `holdAnchor`).

| Kind | Height | Differences |
|---|---|---|
| `adult` | 1.05 m | torso 0.34 x 0.28 x 0.22; random hair (4 tokens), shirt (6 colours from the harbour list `e07a5f 81b29a f2cc8f 6d8fd1 c27ba0 9acd6a`), skin (4), pants `#4a4e69` |
| `child` | 0.80 m | head 0.34 (relatively bigger), legs 0.16, always looks up at the pass |
| `elder` | 0.98 m | slight forward lean 0.12, grey hair `#c9c9c9`, cane prop (right hand) |
| `giant` | 6.0 m (level 10 only) | scale 5.7 of `adult`, hands 1.4 m, a plate-sized pass: eyes and mouth are 3x bigger for readability; uses its own animations in `08` (level 10); never outlined thicker than 0.05 m |

`customer(kind, seed)`: `seed` indexes the colour lists (`n = seed`; shirt `n % 6`, skin `(3n) % 4`, hair `n % 4`) exactly like the demo.

### 10.2 Moods and reactions

Mood is derived by the diorama from `urgency = min(leftTicks/totalTicks)` over active tickets (front customer only):

| Mood | Condition | Animation |
|---|---|---|
| `waiting` | urgency >= 0.35 or not first in the queue | idle sway `rotation.z = 0.02 sin(1.3 t + seed)`, glance at the pass every 6 s |
| `impatient` | front customer, urgency < 0.35 | foot tap: hip L x `max(0, sin(9 t)) * 0.45`, arms folded (shoulders x -0.8, z 0.5, elbows -1.2), eyes narrowed |
| `angry` | front customer, urgency < 0.15 | arms up shaking: shoulders x -1.15, z +-0.9 with jitter `0.06 sin(30 t)`, tap `max(0, sin(14 t)) * 0.5`, face `o`, red anger vein sprite (`!!`) every 0.7 s |
| `happy` | `Served` (front customer) | `celebrate()`: hop `|sin(u 2π)| 0.28 m` over 0.9 s, arms up -2.6, heart sprite rising 0.8 m; then walks out (speed 2.2 m/s, toward +x, rotation eased `k 8`) and is removed at x > 11 |

Walk cycle (any customer with `setWalk(speed > 0)`): hips `±0.7 sin(9 t + seed)`, arms `∓0.56 sin(...)`. Queue advance: customers move at 2.0 m/s to their new queue point; the new one spawns at `queue[last] + 3 m` in x and walks in.

### 10.3 Order bubble (optional, default on)

A billboard sprite 0.5 x 0.4 m above the front 2 customers (y = height + 0.35): white rounded card, recipe icon (rendered from `meal` visual to a 64 px canvas, cached per recipe) and a patience ring (green > 50 %, orange > 25 %, red below, plus a shape cue: tick / dot / exclamation, so colour is not the only cue). Updated by `setPatience`. It duplicates the HUD ticket for immersion; it is hidden with the accessibility option "less clutter" (`05 §11`).

---

## 11. Stations

### 11.1 Binding rules

1. **`enabled` rule (bug fix).** The diorama builds station `i` with `backend.station(effDef, {w,d})` where `effDef = view.stations[i].enabled ? layoutDef : 'counter'`. It re-checks `view.stations[i].enabled` every `update` and when it changes it disposes the old visual and builds the new one in place (same position and rotation, same item holder). `StationVisualState.enabled` also dims a disabled visual if a backend renders it anyway. Disabled stations show no steam, ring, glow, prompt or particles. The `LevelRenderSpec.stations[i].enabled` value only seeds the first build (it is the bucket-correct value if the client builds the spec from the run's first `RushView`; the client must build the scene **after** the first `rush` message of the run, or pass `enabled` from `layout.optional` and the player count).
2. Footprint contract (`01 §10.3`): inside the layout box `w x d`, <= 1.0 m high for counters, `anchor('top')` = centre of the top face (item socket).
3. Rotation: `LevelRenderSpec.stations[i].rot` (0 = front towards +z). The front of every station is the side the chef uses.
4. All stations share the **counter base** (§11.2) unless stated.
5. Station colours come from the level's palette tokens; the defaults below are the harbour values. A level may recolour the base (`counterBase(body, top)`), never the silhouette.
6. Silhouette identity: stations are distinguishable by silhouette alone at 40 px (colour-blind safe).

### 11.2 Counter base (all benchtop stations)

1 x 0.9 x 1 m. Voxel: `counterBase(pal, body = '#3f8796', top = '#e2c08a')`: 10 x 9 x 10 voxels at 0.1 m; body 8 voxels, 1 voxel dark skirt `#2c3e48`, 1 voxel top; vertical grooves every 3rd voxel colour `#357685`. Smooth: `roundedBox(1.0, 0.82, 1.0, r 0.04)` body `teal`, top slab `roundedBox(1.02, 0.08, 1.02, r 0.03)` `wood_light`, skirt `roundedBox(1.0, 0.06, 1.0)` `steel_dark`, 3 groove strips (0.02 wide) `teal_deep`.

### 11.3 Per-station visual spec

`topY` = height of `anchor('top')`. "Active" = `StationVisualState.active` (processing) as set by the diorama from the item state: board active when `view.chefs[*].chopping` on it; fryer/stove/toaster/oven/coating/mixer/press active when the socket item is `cooking | cooked | burning`; blender when `mix.length > 0`; sink when a chef washes; others never.

| Station def (kind) | Silhouette and size | Colours (voxel / smooth) | topY | Active feedback | Warn / burn / fire |
|---|---|---|---|---|---|
| `counter` (counter) | plain base | `teal` body, `wood_light` top | 0.90 | none; `highlight` rim | fire on counter: flames only |
| `crate` (dispenser, one per ingredient) | open wood crate 0.9 x 0.30 x 0.9 on the base, filled with 4-6 copies of the ingredient item (rotated 0.3, 1.2, 2.1, 0.7 rad as the demo) | `wood #9a6a35`, slats `#b58047`, floor `#6b4a2a` | 0.90 + 0.30 contents rim | item bob when a chef is within reach: contents scaleY pulse 1.0-1.05 at 1.5 Hz; on `Grabbed` the top item pops up 0.12 m (0.15 s) and the pile refills (scale 0 -> 1 in 0.2 s) | none |
| `plates` (dispenser) | stack of 5 plates (0.44 dia, 0.03 each) | `white` plates, rim `off_white` | 0.90 + 0.15 | top plate lifts on `Grabbed` (0.1 m, 0.12 s); stack height reflects `stock` when finite (5 max visible) | none |
| `cups`, `bowls` (dispenser) | stack of cups (r 0.11) / bowls (r 0.2) | `white` / `cream` | 0.90 + 0.20 | as plates | none |
| `board` (processor chop) | slab 0.8 x 0.05 x 0.6 on the base, a knife stuck upright at the back-left corner when idle | slab `#e2c08a`, knife `#dfe6ea` + handle `#6b4426` | 0.90 + 0.04 | board shakes on `bump` (y -0.012, 0.08 s); chop bits (§13); item squash; knife hidden while a chef chops (the chef holds it) | none |
| `fryer` (processor auto) | steel tank (one basket) 0.82 x 0.30 x 0.82 with a sloped handle at the front, oil window front | body `steel #5d6b74` + black basket `#1f2830` handle `#b8862b` | 0.90 + 0.28 (basket lift) | oil surface colour `#e8a21c` gets bubbles: cooking 6/s, cooked 3/s, burning 8/s grey smoke; basket lifts 0.04 m when `cooked`; emissive glow `#ffb45a` 0.35 pulsing 1 Hz while `cooking`; steam (white, §13) 1 per 0.09 s; item inside is the basket content | `warn` (cooked, progress > 100): glow turns orange `#f4a259` pulsing 2 Hz, basket jiggle +-0.01 m at 12 Hz; `burning`: red `#e4572e` pulse 4 Hz, grey smoke, `Burnt` event -> black smoke burst 18 particles; `fire`: flames (§11.5) |
| `stove` (processor auto) | 2-ring hob 0.9 x 0.12 x 0.9, a pan (r 0.28) on the active ring, handle forward | hob `iron`, rings `#444`, pan `#3b4350` | 0.90 + 0.12 | active ring glows `#ff6a2a` emissive 0.6, sizzle shimmer, steam 1 per 0.12 s | as fryer |
| `toaster` (processor auto) | 0.5 x 0.3 x 0.3 box, two slots, lever on the side | body `red`/chrome | 0.90 + 0.30 | slot glow `#ff7a1a`; lever down while active; pops the item up 0.12 m at `Cooked` (0.15 s `easeOutBack`) | smoke from slots when `burning` |
| `oven` (processor auto) | wide pizza oven 0.9 x 0.7 x 0.8: arched mouth, chimney | brick `#b5533a`, mouth `#2a1a10`, fire inside `#ff9a3a` | 0.90 + 0.18 (peel shelf) | flame flicker in the mouth (emissive quad, 2 Hz), chimney smoke 1 per 0.3 s | door glow red when `warn`; `fire` on the shelf |
| `coating` (processor auto) | two trays (flour and crumbs) 0.8 x 0.10 x 0.4 each | `cream`, `#d9b779` | 0.90 + 0.10 | dust puffs (white, 1 per 0.2 s) | none |
| `mixer` (processor auto) | bowl r 0.3 with a spiral hook, stand | bowl `steel`, body `red` | 0.90 + 0.35 | bowl rotates 2 rad/s, hook orbits, batter swirl texture offset | none |
| `press` (processor auto) | dough press, two plates, lever | `steel`, handle `red` | 0.90 + 0.25 | upper plate descends 0.12 m in 0.3 s while active | none |
| `blender` (processor multi) | jar 0.3 x 0.5 x 0.3 on a motor base | jar glass `#cfeaf7` 0.55 opacity, base `red` | 0.90 + 0.55 | blade spins 30 rad/s while `mix` full and X not held; liquid colour from `mix` (banana `#f5e17a` + strawberry `#e8546a` -> pink `#f08aa0`); vibration +-0.006 m at 20 Hz; `Blended` -> `ding` sparkle | none |
| `sink` (sink) | steel basin 0.9 x 0.25 x 0.6 + tap arched 0.4 high | `steel`, water `#7fd0ea` | 0.90 + 0.05 (basin rim; dirty dishes stack visible) | washing: water stream (blue quads), bubbles (§13), dishes rattle; `dirty` count drives the pile height (max 5 visible) | none (not flammable) |
| `bin` (bin) | trash can r 0.3 h 0.8, tilted lid | `#1f6b3a` green (voxel model `trash_bin` at 1/14 stays), lid `#175a2f` | 0.90 (opening) | lid flap opens 0.5 rad for 0.25 s on `Trashed`; shakes (+-0.02 m, 0.2 s) and a red `x` sprite on `Refused` with reason `burnt` or other; burnt items put in the bin make a small smoke puff | none |
| `pass` (pass) | red counter with a golden bell and an order mat 0.7 x 0.02 x 0.7 | base `red #d9473a`, bell `brass`, mat `#fff0c0` | 0.90 + 0.01 | bell tilts 0.3 rad and rings on `Served` (0.4 s damped); confetti (§13); mat flashes green (`ok`) 0.3 s on `Served`, red on `WrongDish` | none |
| `planter` (planter) | soil box 0.9 x 0.25 x 0.9 with plants | soil `#6a4a2e`, leaves `#5aa05a` | 0.90 + 0.25 | growth: plant scale 0.3 -> 1.0 with `growLeft`; ready: harvest glow (soft yellow pulse) and sparkle; after harvest the plant scales to 0.3 | flammable: flames |
| `dumbwaiter` (dumbwaiter) | small lift hatch 0.8 x 0.9 x 0.8 with a rope and pulley | wood `wood_mid`, rope `cream` | 0.90 | the platform slides down/up 0.9 m over `travelLeft` ticks; arrow chevrons on the rim | none |
| `conveyor` (conveyor) | belt strip 1 x 0.12 x L, rollers every 0.25 m | belt `#3b4350`, chevrons `warn` | 0.90 + 0.12 | belt texture scrolls at `props.speed`; items from `view.belt[]` placed at `pos/256 * L`; end gap shows a drop arrow | none |
| `extinguisher` (extinguisher) | wall-mounted red cylinder 0.14 x 0.45 + hose, bracket on the station | `red`, `#2c3e48` nozzle | 0.90 + 0.5 | when `hasExtinguisher` false the cylinder is hidden and the bracket shows an empty outline | none |
| `return` (return) | hatch with a tray stack of dirty dishes | `steel`, trays `cream` | 0.90 + stack | a dirty dish slides in on `DishReturned` (0.3 s), stack height = `dirty` | none |

### 11.4 Progress rings and bars (anchor heights)

The rings are DOM elements (`05 §4`), anchored with `diorama.anchor(i, h)`: ring at **h = 1.95** (fryer and heat stations), chop bar at **h = 1.35**, verb prompt at **h = 1.85**, "Hurry!" hint at **h = 2.4**. Ring behaviour (exact, from `rushHud.ts`): `frac = state === 'cooking' ? progress/256 : 1 - progress/256`; green while cooking; orange and pulse 0.5 s when `cooked && progress > 100`; red pulse 0.25 s when `burning`. The 3D side adds the station glow of §11.3 in the same colours so the state is readable without the HUD. Colour-blind cue: icon inside the ring (check = done, triangle with `!` = warn, flame = burning), specified in `05 §4.4`.

### 11.5 Fire

`StationVisualState.fire` (1 small, 2 big, from `StationView.fire`: 1 for `fire < 120`, 2 after the first spread tick):
- Flames: 3 billboard flame sprites (flat teardrop shapes, 0.25-0.45 m high; voxel style uses 3 stacked voxel cones in `#ff7a1a`, `#ffb02e`, `#ffe27a`), scaling `0.8 + 0.2 sin(8 t + i)`, and 14 ember particles per second rising 0.8 m (orange to black).
- Big fire (`fire = 2`): flames 0.6 m, 6 flames, black smoke column 6 per second, a point light (`#ff7a1a`, intensity 1.5, distance 3, flicker 2.5 Hz amplitude 0.25) from the fire light pool (max 2 simultaneously, nearest first).
- Station is charred: base colour x0.55 (voxel: second ramp row, smooth: `uChar = 0.6`).
- `Extinguished`: a white steam burst (20 particles) and the charring fades over 2 s.
- Audio: `fire_loop` (05) while any station burns.
- Burning stations get a pulsing outline `danger` (smooth) or a red rim sprite on the floor (voxel) at 3 Hz.

### 11.6 Interaction feedback on any station

- `highlight` 1 = target of a local chef (glow plate 1.04 x 0.05 x 1.04 m, slot colour, opacity `0.28 + 0.18 sin(6 t + slot)`, at y 0.93, as in the demo); 2 = hovered by the mouse (§15).
- `bump` = 1 on `Placed`/`Plated`/`Grabbed`: the item pops 0.05 m and settles in 0.12 s; the station base scale 1.0 -> 1.015 -> 1.0 (0.1 s).

---

## 12. Items and plates

### 12.1 Item state visuals

`ItemLike.state` = `raw | chopped | cooking | cooked | burning | burnt`, `progress` = Q8 (0..256) of the current step. The doneness and char bands (exact, `ItemFactory.bands`):

```ts
function bands(it: ItemLike): [done: number, char: number] {          // each 0..15
  if (it.state === 'cooking') return [Math.min(15, it.progress >> 4), 0];
  if (it.state === 'cooked')  return [15, Math.min(15, Math.max(0, (it.progress - 120) >> 3))];
  if (it.state === 'burning') return [15, Math.min(15, 4 + (it.progress >> 5))];
  if (it.state === 'burnt')   return [15, 15];
  return [0, 0];                                                       // raw, chopped
}
signature(it) = `${it.def}|${done}|${char}|${it.contents.join(',')}`   // rebuild only when it changes
```

Voxel: bands are baked per voxel (ramp shader). Smooth: `uDone = done/15`, `uChar = char/15` on the item's material (no rebuild); `signature` only changes for container contents.

Visual rules for every cookable item (both styles):

| State | Look |
|---|---|
| `raw` | ramp row 0, matte |
| `chopped` | sliced/cut variant shape (potato -> `raw_fries` sticks) and ramp row 0 |
| `cooking` | row 0 -> row 1 by `done`; tiny bubbles around it when in a fryer (§11.3) |
| `cooked` | ramp row 1, glossy highlight (smooth: rim 0.2), a 0.1 s sparkle at the moment of `Cooked` |
| `burning` | row 1 -> row 2 by `char`, thin grey smoke (1 per 0.25 s) |
| `burnt` | row 2, **plus** speckle: +-20 % per-voxel/cell darkness (voxel: shader cell hash x3; smooth: noise texture 8 x 8 multiply) and a steady smoke wisp. Distinct from `cooked` in shape contrast (surface bumps), not only hue (colour-blind safe). Hold items of state `burnt` show a small skull-free "ash" icon sprite `x` above (0.12 m) so the bin rule is learnable. |

### 12.2 Ramp colours (raw / cooked / charred)

| Item | raw | cooked | charred |
|---|---|---|---|
| fries (`raw_fries`, `cooked_fries`) | `#f6e7b0` | `#e6a82a` | `#2a1a10` (exact, code) |
| patty | `#c9605a` | `#7a4a2e` | `#1f1511` |
| bacon | `#e58b8b` | `#a34a3a` | `#1f1511` |
| bread / toast | `#f0dfb8` | `#d9a85a` | `#2a1a10` |
| onion rings | `#efe0b4` | `#d9923a` | `#2a1a10` |
| chicken (tenders) | `#f1d7c0` | `#d8923f` | `#2a1a10` |
| omelette, pancakes | `#f6e7a6` / `#f0d9a0` | `#e8c35a` / `#cf9a4a` | `#2a1a10` |
| pizza | `#f0d6a8` | `#d9a24a` crust, cheese `#f7e28a` | `#2a1a10` |
| potato (raw only) | `#cfa86a` (recolour of `#d7ccc8`) with `#6e4a2e` eyes | n/a | n/a |

### 12.3 Held and station item scale

Held size <= 0.35 m longest side, container with contents <= 0.45 m (`01 §10.3`). Scales (voxel, from the table in `items.ts`): plate/bowl/cup `1/26`, potato `1/22`, `raw_fries`/`cooked_fries` `1/13`, fries on a plate `1/15`, other `1/20`. Items sit on a station at `anchor('top')`; `lift` (fryer 0.28, board 0.04) is part of the station visual's `top` anchor, not of the item.

### 12.4 Plates and stacked contents

Plate: disc 0.42 m diameter, 0.03 high (smooth `cylinder(0.21, 0.19, 0.03)` + rim torus; voxel `.vox` plate at 1/26), `white` with `off_white` rim. Contents are placed on the plate in `ItemLike.contents` order (the sim keeps them sorted; the render sorts by layout class below for stable stacking):

| Class | Items | Rule | Heights (m) |
|---|---|---|---|
| `base` | bun (bottom), bread_slice, pizza_base | centred, first | 0.04 |
| `layer` | patty, cheese_slice, lettuce, chopped_tomato, bacon, egg, omelette | stacked above the previous layer | patty 0.05, cheese 0.015, lettuce 0.02, tomato 0.02, bacon 0.015 |
| `top` | bun (top) | last | 0.07 |
| `pile` | fries, onion rings, tenders | placed at (+0.08, 0, 0) in a pile, y base 0.03 | 0.10 |
| `liquid` | smoothie in cup | cup centred | 0.20 |

Stack offset: each stacked item adds its height; a +-0.01 m deterministic x/z jitter from `visualRng(def hash)` makes the stack look hand-made. A finished recipe (contents match a known `meal`) may be shown as the single `meal/<id>` visual instead of components once the container holds all of its components (`signature` includes `contents`; the factory prefers `meal` when `rushRecipeById` matches, passed as `recipeIdFor(contents)` by the client).

Dirty plates (`state 'dirty'`, `02`): plate tinted `#9a8a6a` with 3 brown speckles; clean returns to white with a sparkle 0.2 s.

---

## 13. VFX

### 13.1 Particle pool v2 (`fx/particles.ts`)

Superset of today's `ParticlePool` (instanced, one draw call, 400 default). New API:

```ts
export interface EmitOpts {
  color: number | number[]; speed?: number; up?: number; life?: number; gravity?: number; scatter?: number; size?: number;
  shape?: 'cube' | 'quad' | 'blob';           // default per style: voxel 'cube', smooth 'blob' (icosahedron detail 0, 20 triangles)
  drag?: number;                              // 0..4 velocity damping per second, default 0
  dir?: [number, number, number];             // base direction for cones (spray); speed spreads around it with `spread`
  spread?: number;                            // radians, with dir
  fade?: boolean;                             // alpha to 0 over life (quad/blob only; needs transparent material), default false
}
export class ParticlePool { constructor(scene: Scene, max?: number); emit(x: number, y: number, z: number, n: number, o: EmitOpts): void; update(dt: number): void; }
```

Budgets: 600 instances (`high`), 400 (`medium`), 200 (`low`); at reduced motion counts x0.4. `Math.random` allowed. Instances use `MeshBasicMaterial` (unlit, per-instance colour) so VFX stay bright in night moods.

### 13.2 Catalog (exact presets; `n` per emit, others as `EmitOpts`)

| Effect | Trigger | n | color | speed | up | life (s) | gravity | scatter | size (m) |
|---|---|---|---|---|---|---|---|---|---|
| `chopBits` | `ChopHit` at the board top + 0.12 | 5 (+7 at `ChopDone`) | item bits `#d9b779 #f0e2b0 #cfa86a` (from the item) | 0.9 | 1.8 | 0.55 | 7 | 0.2 | 0.045 |
| `steam` | every 0.09 s per frying/cooked/burning station at top + 0.55 | 1 | `#ffffff` (burning `#8a8a8a`) | 0.12 | 0.6 | 1.1 | -0.15 | 0.25 | 0.07 |
| `smokeBurst` | `Burnt` at top + 0.4 | 18 | `#2a2a2a #444444 #666666` | 0.4 | 1.4 | 1.2 | -0.3 | 0.2 | 0.10 |
| `confetti` | `Served` at the pass + (0.6, 1.3, 0) | 36 | `#ff5d73 #ffd23f #6fd36f #4cc9f0 #ffffff` | 2.2 | 4 | 1.1 | 7 | 0.4 | 0.07 |
| `dust` | `Dash` feet, 2 per 0.05 s | 2 | `#e9d7b0` | 0.5 | 0.4 | 0.35 | 1 | 0.15 | 0.06 |
| `sparkle` | `Cooked`, `ChopDone`, clean dish | 8 | `#fff7c2 #ffffff #ffe27a` | 1.0 | 1.2 | 0.5 | 2 | 0.2 | 0.04 |
| `bubbles` | frying (6/s), washing (3/s) | 1 | `#fff5c8` (oil), `#ffffff #bfe9ff` (soap) | 0.15 | 0.5 | 0.7 | -0.3 | 0.25 | 0.035 |
| `foam` | extinguishing, 12/s | 1 | `#ffffff #e8f6ff` | 3.2 (cone) | 0.1 | 0.45 | 1 | 0.05 | 0.06, spread 0.25 rad, `dir` toward target |
| `splash` | item or object falls in water; boat bump | 12 | `#ffffff #bfe9ff` | 1.2 | 2.2 | 0.6 | 8 | 0.2 | 0.05 |
| `embers` | fire, 14/s | 1 | `#ff7a1a #ffb02e #333333` | 0.3 | 1.0 | 0.9 | -0.4 | 0.3 | 0.04 |
| `heart` | customer happy | 1 sprite | `#ff5d73` | rises 0.8 m over 0.9 s | | | | | 0.18 |
| `poof` | `TicketExpired` at the pass | 14 | `#bbbbbb #dddddd` | 1.0 | 0.6 | 0.6 | 0 | 0.3 | 0.09 |
| `star` | hurt >= 0.6, streak up | 6 | `#ffd23f` | 1.4 | 2.5 | 0.7 | 6 | 0.1 | 0.06 |

Non-particle effects: score numbers are DOM (`05`), the red damage flash is DOM, the countdown is DOM. In-world sprites (heart, `!!`, `x`, stars, order bubble) are billboard quads from one shared canvas atlas (512 x 128, glyphs drawn with `CanvasRenderingContext2D`, `NearestFilter` in voxel style, `LinearFilter` in smooth).

---

## 14. Ambient life

Rules: every level has at least 3 loops from the table; each loop is cheap (transform only, no allocation), never faster than 3 Hz, and never occludes Z0.

| Loop | Spec (exact for the harbour) |
|---|---|
| Boats bob | `y = base.y + sin(1.1 t + ph) 0.07 amp`; `rotation.z = sin(0.9 t + ph) 0.035 amp`; `rotation.x = sin(0.7 t + 2 ph) 0.02 amp` (amp 1, 0.8, 1.2 for the three harbour boats) |
| Awning flutter | `z += sin(x 2.2 + 2.4 t) 0.035 * (y < 0 ? 1 : 0.2) * (edge + 0.2)` with `edge = max(0, 0.5 - y)`; 40 x 3 segments |
| Gulls | 3 gulls at `[-6.9,0.35,-3.0] [9.4,0.35,-2.2] [6.6,0.35,-3.2]`; state machine `idle -> fly -> away -> return`: idle peck `max(0, sin(3t + home.x) - 0.6) * 0.9` rad; flee when a chef is within 2.0 m: direction away from the chef, flight `pos = home + dir * t * 5` with `y += 3.2 t - 0.2 t^2`, wing flap `sin(30 t) * 0.9`, hidden after 3.2 s, away 9 s, return over 2.4 s from `home - dir * 9` with `y` `(1-u) * 3` and flap `sin(26 t) 0.8 (1 - 0.7u)` |
| Water | §6.1 |
| Lamp life | late-run pulse §7.5 |
| Foam rings | 0.6 Hz scale pulse around boats and pilings |
| Level extras | smoke from chimneys (1 particle per 0.3 s), clouds (flat quads drifting at 0.3 m/s, wrap at +-60 m), fish jumping every 12-20 s (`visualRng`), bunting sway `sin(1.6 t + i) 0.05`, neon flicker (limited to 2 Hz, §05 accessibility), crowd bob (festival: 30 instanced low figures with `y = |sin(2.5 t + i)| 0.05`), passing scenery (train / river, `scroll` backdrop) |

Reactive life: gulls flee chefs; customers react (§10); boats bump (a boat within 1.5 m of the dash path of a chef gives +0.02 rotation impulse, optional); steam and lamp react to play state.

---

## 15. In-world markers

### 15.1 Guide arrow

A pointer above the station the player should use next (rules in `05 §7`). Mesh: cone `r 0.34, h 0.7, 4 radial` pointing down (voxel: a diamond made of 3 stacked voxel slices 0.12 m; the demo uses `ConeGeometry`), material `MeshStandardMaterial` colour `accent #ffd23f`, emissive `#a07000`. Motion: `y = 1.95 + |sin(4 t)| * 0.25`, `rotation.y = 2 t`. One arrow per local seat that has a guide target; arrow k is tinted with the slot colour at 40 % and offset 0.15 m in x per index so two arrows over one station do not overlap. Hidden when `target < 0`. Reduced motion: no bounce (`y = 2.05`), spin 0.5 rad/s.

### 15.2 Target glow and hover ring

Target glow: see §11.6. Hover ring (mouse): a flat rounded rectangle 1.08 x 1.08 m outline at y 0.93, colour `ok` when the station is within reach of the local chef (same shared test as the sim, `05 §6.4`), `#9aa5ab` at 60 % opacity when too far; appears only for the keyboard+mouse seat while the cursor moves over a station; hides after 2 s without mouse movement.

### 15.3 Anchors

`LevelDiorama.anchor(i, h = 1.5)` = `(station.x, h, station.z)`; HUD heights in §11.4. `RenderHost.project(x,y,z)` converts to CSS pixels (`(v.x*0.5+0.5)*innerWidth`, `(-v.y*0.5+0.5)*innerHeight`, null when `v.z > 1`).

### 15.4 Pick by footprint

`RenderHost.pick(clientX, clientY)`: ray from the camera through the cursor, intersect planes y = 0.9 and y = 0.5 (counter top and low stations), return the station whose layout box (expanded by 0.08 m) contains the point, preferring the nearest to the camera ray at y = 0.9; ties by smaller index. This uses the **layout box**, not the model, so both styles pick identically (fixes the neighbour mis-pick noted in `02`).

---

## 16. Performance budgets and quality tiers

Targets: 60 fps on an integrated GPU (Intel Iris Xe class) at 1920 x 1080 (`high`), 60 fps at 1280 x 720 CSS px on a mid phone (`low`), no frame > 25 ms in a 10-minute soak. Numbers are budgets for tests (`09`).

| Budget | high | medium | low |
|---|---|---|---|
| Max device pixel ratio | 2 | 1.5 | 1 (1.25 phones) |
| Shadow map | 2048 | 1536 | 1024 |
| Draw calls (frame) | <= 220 | <= 160 | <= 110 |
| Triangles (frame) | <= 320k | <= 220k | <= 140k |
| Static diorama triangles | <= 200k | | |
| Dynamic (chefs 6 + customers 6 + items) triangles | <= 60k (voxel) / <= 45k (smooth) | | |
| Particles (instances) | 600 | 400 | 200 |
| Point lights | <= 4 | <= 3 | <= 2 |
| Outlines (smooth) | on | on | off (flat shading only) |
| Water segments | 120 | 80 | 40 |
| Unique materials | <= 24 (voxel: 1 shared + water + sprites), <= 60 (smooth) | | |
| Textures | <= 12, total <= 16 MB GPU | | |
| Memory (JS heap after load) | <= 250 MB | | |
| Load time to first frame (cold, broadband) | <= 3.0 s; level swap <= 1.2 s | | |
| Per-frame JS in `update` | <= 3 ms | <= 3 ms | <= 3 ms |

Rules to meet them:
1. **Merge statics.** Static scenery meshes (deck, walls, posts, crates, props) sharing a material are merged with `mergeGeometries` after build (`mergeStatic(root)`); repeated identical props use `InstancedMesh`.
2. **One voxel material** for the whole level (`Palette.material()`); ramp updates through `Palette.flush()` once per frame at most.
3. **No allocation in `update`**: reuse vectors, no `new` in per-frame paths, no string building except when a signature changes.
4. Meshing off the main thread (`MesherPool`) for chunks > 32^3; the level load awaits it.
5. Shadows: only stations, chefs, customers, big props cast; small props (bollards, barrel) do not. Shadow camera box = stage + 2 m (harbour ±12).
6. Auto quality (`quality: 'auto'`): measure the average frame time over 120 frames after load; > 20 ms -> step down one tier; > 30 ms at `low` -> disable outlines and halve particles; re-evaluate only at level load or from the settings screen (never mid-run).
7. Pause rendering when `document.hidden` (the client pauses the run, `05`).
8. Dispose rules: `LevelDiorama.dispose()` disposes all geometries, materials, textures it created; `RenderHost.loadLevel` must leave `renderer.info.memory.geometries` within +5 % of its value before the first load (leak test, `09`).

---

## 17. Art style guide

The one-page rules every level, asset and effect follows. The reference is the level 1 harbour (`v2/docs/p2/*.png`).

### 17.1 Feeling

Bright, warm, readable diorama; toy-like; always sunny-ish mood with a distinct time of day per level. Soft shadows. Saturated scenery, calmer stage, clear food.

### 17.2 Palette

- Base per level: 1 neutral wood/stone family + 1 sea/sky family + 2-3 accents (§5.2 rule 3). Keep the whole level inside the tokens of `ART_PALETTE` plus its own level tokens (<= 40 per level, voxel limit 255 incl. shades).
- Food colours are always the **brightest and most saturated** objects on the stage.
- Player slot colours are never used on scenery; the six slot colours are reserved.
- Shade rule: every material has at most 3 tones (base, shade at -18 % lightness, highlight at +10 %); voxel gets them from AO and per-voxel jitter, smooth from the 4-band ramp.
- Contrast: chef silhouette vs floor luminance difference >= 35 %; text on in-world signs >= 4.5:1.

### 17.3 Shapes

- Voxel: chunky; the smallest visible detail is one voxel; edges are not bevelled; round things are approximated with at most 8 steps; no thin (1 voxel) floating parts except antennae, ropes and blades.
- Smooth: rounded boxes with radius 0.03-0.08 m, capsules for limbs, spheres for heads/food; no sharp realistic detail, no textures except flat decals and the single noise map; facet counts as in §4.3.1.
- Proportions: big heads, short legs, thick props (a fryer is wider than realistic), oversize tools. Silhouette first: every station and item must be recognisable as a black shape.
- Outline (smooth only): dark brown `#2a1d14` at 0.010-0.014 m on interactive things.

### 17.4 Lighting and shadow

Single sun + hemisphere; sun from the upper left front; shadows soft (radius 3.5 harbour), never pitch black (hemisphere ground colour lifts them to >= 35 % of lit value). No bloom, no SSAO, no post-processing (budget and portability).

### 17.5 Motion

Squash and stretch on every interaction (3-8 % scale, 0.05-0.12 s); easing always (never linear except constant spins); idle loops never stop (breathing, sway); anticipation is skipped on input-driven actions to keep the controls snappy (latency over style), but follow-through is mandatory (rebound, settle).

### 17.6 Do and don't

| Do | Don't |
|---|---|
| Put the landmark on a third line | Centre the landmark behind the chef |
| Give each station a unique silhouette | Rely on colour alone to tell stations apart |
| Dress the whole portrait frame | Leave bare water/sky inside the frame |
| Use the palette tokens | Add a one-off hex in a level |
| Keep Z0 warm neutral | Use saturated slot colours or red on Z0 floors |
| Animate with `time` and easing | Animate with linear tweens or random jitter per frame |
| Keep flash rate <= 3 Hz | Flicker lights faster than 3 Hz |
| Use fog to hide the world edge | Show the edge of the water plane or a backdrop seam |
| Reuse props across levels with a recolour | Create a 255-colour palette per prop |
| Make burnt food dark, rough and smoking | Make burnt food only a hue shift |

### 17.7 New asset checklist

Footprint fits (§11.1); anchors present; both backends done (or smooth falls back to the voxel prop, logged); tokens only; triangle/voxel budget respected; contrast test; silhouette test at 40 px; added to `assets/manifest.ts`; contract test green.

---

## 18. Acceptance criteria and tests

1. **Backend parity.** `assets/contract.test.ts` passes for `voxel` and `smooth` (§4.4). Starting the game with `?art=smooth` plays level 1 with identical sim hashes to `?art=voxel` for the same seed and inputs (`09` determinism test only hashes the sim; the test asserts that no render module imports `@ga/sim`, enforced by the lint rule of `01 §2.4`).
2. **Disabled stations (regression for the level 1 bug).** With 1 player on level 1, the stations `board_2` and `fryer_3` (`enabled === false`) render as plain counters: a Vitest test with a stub backend asserts `backend.station` was called with `'counter'` for those indices; a Playwright screenshot at 1 player shows 1 board and 2 fryers; with 3 players it shows 2 boards and 3 fryers (swap happens when `view.stations[i].enabled` flips, no reload).
3. **Camera.** Unit tests for `fitDistance`: level 1 at 16:9 returns <= 15 (clamped to 15), at 390 x 844 the whole `frame` rectangle plus posts projects inside NDC with the HUD insets; the stage centre lands within 2 % of `centerY`; chef height on screen >= 5.5 % of the viewport height at 390 x 844 and >= 7 % at 1280 x 720.
4. **Portrait.** Screenshot `390x844` of every level: bare backdrop (pixels equal to the sky/water-only mask) < 25 % of non-HUD pixels. Overflow tests of `09 §8`.
5. **Chef.** `chefAnimator.test.ts`: (a) walk: left arm and left leg have opposite signs; (b) chop contact at `u = 0` gives right shoulder `-0.55` within 0.01 and raised `-2.35` at `u = 0.70`; (c) chop priority table; (d) all bone angles within [-3.2, 1.2]; (e) height of the skeleton with each hat <= 1.20 m; (f) the six `SLOT_COLORS` are pairwise distinct (CIE76 distance >= 25) and every slot has a unique emblem.
6. **Lighting.** Every `LightingMood`: one shadow caster, <= 4 points, `hemi.intensity + 0.4 sun.intensity` in [2.2, 4.2], stage/background luminance contrast >= 25 %.
7. **Budgets.** Perf smoke (`09 §7`): level 1 with 4 chefs, 3 customers, 3 fryers cooking: draw calls <= 220, triangles <= 320k on `high` (read `renderer.info`), no per-frame allocation (heap sampled over 600 frames stays within +2 MB).
8. **Flicker.** No light or emissive changes brightness by more than 25 % at more than 3 Hz (checked by sampling the mood table functions over 10 s).
9. **Style guide.** A reviewer checklist (`09`) lists §17.6 and §17.7; each new level PR attaches 3 screenshots: 1280x720, 390x844, title orbit.
10. **Existing screenshots** `v2/docs/p2/service-1280x720.png` and `service-390x844.png` are re-captured after the camera work and committed beside the old ones as `service-*-v2.png` to show the fix.
