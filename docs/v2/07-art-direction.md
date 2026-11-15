# 07 · Art Direction

**Direction name: "Edible Diorama".** Keep the voxel identity, but move it from *flat-shaded blocks in a white room* to *a hand-made miniature world you want to eat*. Think stop-motion sets, tilt-shift photography of tabletop models, and pastry-shop windows.

---

## 1. Visual pillars

| # | Pillar | Means | Anti-pattern |
|---|---|---|---|
| A1 | **Miniature** | It reads like a physical model: soft shadows, ambient occlusion in crevices, shallow depth of field in photo and cinematic moments, scale cues (tiny chefs, giant food) | Flat lighting, infinite gray floors |
| A2 | **Appetizing** | Food colors are saturated and warm, with visible gradients (crust, char, juice) and gloss on coats | Muddy browns, uniform colors |
| A3 | **Readable** | Gameplay information comes from silhouette and value first, color second. Chefs and the Giant always pop from the background. | Busy textures, noisy palettes |
| A4 | **Alive** | Everything breathes: grass sways, steam rises, the Giant blinks and critters fidget | Static props |
| A5 | **Voxel-honest** | The grid stays visible. No smoothing or marching cubes. Detail comes from voxel density hierarchy and lighting, not from hiding the voxels. | "Voxel" that looks like low-poly |

## 2. Voxel density hierarchy

Different sizes of voxel per role keep detail where the eye goes:

| Role | Voxel size | Why |
|---|---|---|
| Food and held items | 1/16 m (6.25 cm) | The most inspected objects; they're cut and cooked |
| Chefs | 1/16 m | They match food, so held items look natural |
| Terrain and props | 1/8 m | 8× fewer voxels for big areas |
| Giants | 1/4 m (and 1/8 m for face and hands) | Enormous; they read as a "different scale" being |
| Outskirts and backdrop | 1/2 m, with fog | The cheap diorama edge |

Mixing densities is a *feature*: the Giant's coarse voxels make it look ancient and huge next to fine-grained chefs.

## 3. Lighting

### 3.1 Rig
- **Key light:** one directional sun with a cascaded shadow map (2 cascades desktop, 1 mobile) and soft PCF. Warm (3,500–5,500 K depending on biome).
- **Sky fill:** a hemisphere light (sky color above, bounce color below, taken from the biome's dominant ground material). This replaces V1's flat `AmbientLight(0.6)`.
- **Baked voxel AO:** per-vertex ambient occlusion computed during greedy meshing (the 3-neighbor corner rule). It's practically free at runtime and does 60% of the "miniature" look. **This is the most important visual upgrade over V1.**
- **Local lights:** fires, ovens and the Torch flame are point lights with a budget (§8), plus emissive voxels.
- **Rim light:** kept from V1 (a cool back light), now only on characters via a fresnel term in the character shader. Chefs separate from the background.

### 3.2 Post-processing stack (desktop / mobile)
| Effect | Desktop | Mobile | Notes |
|---|---|---|---|
| ACES tone mapping | ✓ | ✓ | Kept from V1 |
| Color grading LUT per biome | ✓ | ✓ | A 32³ LUT, cheap |
| Bloom (threshold on emissive) | ✓ | low-res | Fire, sparkles, perfect-doneness glints |
| Tilt-shift DOF | Photo mode and cinematics only | Photo mode only | *The* miniature effect, kept out of gameplay for readability |
| Outline pass (characters and the held item only) | ✓ | ✓ (cheap inverted hull) | Readability in chaos |
| SSAO | Optional "Ultra" | ✗ | Baked AO covers most of it |
| Vignette and grain | Subtle | Subtle | |

### 3.3 Biome lighting presets
| Biome | Sun | Sky / bounce | LUT mood |
|---|---|---|---|
| Mushroom Meadow | 4,800 K, low morning angle | Mint sky / moss green | Soft, golden, cozy |
| Sorbet Peaks | 6,500 K, high | Lavender / cream | Pastel, bright, high key |
| Pepper Dunes | 3,800 K, harsh | Orange / sand | Warm, contrasty, heat haze |
| Ramen Reef | Caustics, 5,500 K | Teal / coral | Underwater-ish, with a light-shaft sprite layer |
| Sky Orchard | 5,800 K | Sky blue / cloud white | Airy, saturated fruit accents |
| Molten Pantry | Magma under-light | Purple / chocolate | Dramatic, emissive-heavy |

## 4. Palette

- **Master palette:** 128 colors (MagicaVoxel-compatible, 255 slots with 127 reserved for materials and markers). It extends V1's `PALETTE` constants: wood, metal, tomato, lettuce, bun and so on all keep their hues.
- **Each material has 3 ramps** of 4 shades each: *raw*, *cooked* and *charred*. Per-voxel color is interpolated from `doneness` and `char` in the shader, with a tiny per-voxel hash jitter (±4% value) so surfaces don't look flat.
- **Chef colors:** 8 high-saturation crew colors (aprons, outlines, pings, UI). They're chosen to be colorblind-separable (they pass a deuteranopia and protanopia simulation check), and no biome uses them as a dominant color.
- **UI palette:** derived from the V1 CSS identity (kept, per the established visual identity) and extended with chef colors.

## 5. Food rendering (the hero)

Food is what players screenshot. Its shader gets extra care:
1. **Doneness gradient:** raw → cooked → charred ramps per voxel (above). A sliced steak shows rings: a charred edge, a brown band and a pink core.
2. **Gloss:** coated cells (sauce, glaze, melted cheese) use a lower roughness and a wet-specular lobe.
3. **Juiciness sparkle:** cells in the perfect band twinkle (a small emissive sparkle sprite, rate-limited). This is the visual for "perfect".
4. **Steam:** hot bodies emit voxel steam particles whose rate is proportional to the temperature over ambient.
5. **Cut faces:** freshly cut surfaces are 10% lighter for 2 s, then settle. It's a subtle "fresh cut" read.
6. **Crumbs:** cuts and impacts spawn tiny cube particles in the material color. They persist for 4 s, then fade.

## 6. Characters (look)

Details are in [08-characters-and-camera.md](./08-characters-and-camera.md). Visual summary:
- **Chibi proportions**, 1:1.3 head-to-body. About 26 fv tall (1.6 m in-world).
- **Floating hands** (no arms) and stubby legs. Expressive, cheap to animate, and readable at small screen sizes.
- **Faces are sprites on a voxel head:** 2D pixel-art eyes and mouths swapped from an atlas (16×16 per expression). That gives a cartoon range of emotion from a tiny budget.
- **Hats are the identity:** a big, readable silhouette per player (toque, beanie, mushroom cap, crown, propeller…).

## 7. The Giants (look)

- Each Giant is a **multi-part voxel puppet** (head, jaw, eyes and lids, torso, limbs, tail), with procedural animation: breathing scale, look-at, blinking, jaw open.
- **Readability over detail:** big shapes, a strong silhouette, 2–3 dominant colors that contrast with the biome.
- **Face scale:** eyes about 1.5 m wide, so expressions read from anywhere in the level.
- Giants are **lit with an extra rim** so they separate from the sky.

## 8. Effects (VFX)

| Effect | Implementation | Budget |
|---|---|---|
| Fire | Voxel billboards (instanced cubes with a flipbook color ramp) plus a point light per cluster (a merged light) | 400 burning voxels, 8 lights |
| Steam and smoke | Instanced soft cubes, additive alpha | 2,000 particles |
| Crumbs and debris | Instanced cubes with simple physics (no collision except the floor plane) | 1,500 |
| Liquids (terrain pools, oil) | Voxel liquid cells + a stylized top surface (vertex-wobbled quads, fresnel) | per level |
| Melting cheese and caramel | Voxels moved by a cellular-automaton step ("falling sand") at 10 Hz, then re-solidified | ≤ 2,000 moving cells |
| Shockwaves (stomps) | A ring decal plus a radial dust burst | |
| Thought bubbles | A world-space sprite with an icon atlas | |

## 9. UI art direction

- **In-world UI first:** thought bubbles, critter speech bubbles, station rings and ping markers. The HUD is minimal.
- **HUD:** top left, the current craving card (icons only). Top right, the belly meter shaped like the Giant's face, so its expression is the meter state. Bottom, chef chips with the voice indicator.
- **Labels:** off by default (the established preference: a clean first launch). Compact, never overlapping, one label per run of identical counters.
- **Typography:** keep the V1 UI typeface for menus. A pixel font *only* for in-world labels, loaded via the `FontFace` API and scoped to canvas text, never applied globally (a known constraint from V1).
- **Responsive rule:** no UI element may overflow its frame at any supported resolution or language (FR and ES strings are about 30% longer than EN). This is a CI screenshot check (§10).

## 10. Asset pipeline

```
MagicaVoxel / Goxel (.vox)  ──▶  scripts/build-assets.mjs  ──▶  public/assets/
   chefs, giants, props,          • palette check (only the master palette)
   food models                    • greedy mesh + AO bake (props: static GLB-like binary)
                                  • food: kept as voxel data (.fvx), meshed at runtime
                                  • thumbnails (offscreen render, reusing V1's thumbnailHelper)
                                  • atlas: face sprites, icons
V1 voxelBuilder.js ──▶ scripts/v1-to-vox.mjs (one-off) ──▶ .vox sources
```

- Every asset is **source-controlled as `.vox`**, which suits open-source contributions.
- **Rigs:** Giant and chef part pivots are defined by marker voxels (reserved palette colors) in the `.vox` file, extracted at build time. No 3D package needed.

## 11. Reference board (moods, not imitation)

- Tabletop model photography and tilt-shift miniatures.
- Stop-motion food sets in animated films (the general texture and warmth, not any specific film's designs).
- Pastry and bakery window displays (color and gloss).
- Japanese food sample models (*sampuru*: hyper-real plastic food) for gloss and appetizing color.

**Rule:** we reference *materials, lighting and moods*, never characters or designs from existing games or films.

## 12. What changes from V1, visually

| V1 | V2 |
|---|---|
| White and pastel rooms, gray fog at 5–20 m | Biomes with color-graded skies and diorama edges |
| Flat shading, no AO | Baked voxel AO, a hemisphere light, a fresnel rim |
| One voxel size everywhere | A density hierarchy per role |
| Food as static meshes | Food as simulated voxels with doneness ramps |
| Floating station labels by default | Diegetic bubbles, labels opt-in |
| No characters | Expressive chefs and huge Giants |
