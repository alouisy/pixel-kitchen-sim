# v1-to-vox

One-off converter from V1's procedural voxel art (`src/voxelBuilder.js`) to MagicaVoxel `.vox` (v150) source files for V2.
See `docs/v2/01-codebase-audit.md` section 4 and `docs/v2/07-art-direction.md` section 10.

## What it does

1. Monkey-patches `VoxelBuilder.prototype.add` / `buildMesh` so factories record `(x, y, z, color)` instead of building geometry.
2. Runs every station factory, `createTableMesh({})`, `createIngredientBinMesh(<each ingredient_source ingredient>)`, `createItemMesh(<every item id>)` and `createItemMesh(<each meal id>)`.
3. Applies each node's `matrixWorld` (position / rotation / scale) to the voxel centres and rounds back to integer voxels. Nodes scaled above 1.01 are supersampled (the table is scaled 1.8x in Y, so it is 29 voxels tall). Non-90-degree rotations log a warning.
4. Builds ONE shared palette (exact if at most 255 distinct colors, otherwise weighted median-cut with the max RGB error reported), sorted greys first then by hue and lightness.
5. Writes the `.vox` files, `palette.json` and `manifest.json`, re-reads every file with `read-vox.mjs`, and exits 1 on any mismatch.

Item ids come from the `ICONS` block of `voxelBuilder.js` (regex over the source text), `RECIPES[*].ingredients`, `CATALOG_ITEMS` processor `processes`/`result` values, bin ingredients, plus `plate`, `bowl`, `cup`, `pizza_base`.

## Run

From the repo root (needs `npm install` at the root for `three`):

    node v2/tools/v1-to-vox/v1-to-vox.mjs

Output goes to `v2/content-src/vox/v1/{stations,items,meals}/`, plus `palette.json` and `manifest.json` (it is wiped and regenerated each run).

## Axis mapping

V1 is Y-up; MagicaVoxel is Z-up. Mapping: V1 `(x, y, z)` becomes vox `(x, -z, y)` (a proper rotation, so models are not mirrored), then all coords are shifted so the minimum is 0 on each axis (i.e. `voxY = maxZ_v1 - z`). V1 +z (toward the viewer) therefore points toward vox -Y. Palette entry `i` in the RGBA chunk is color index `i+1`.

## Known limitations

- Origins are not preserved (each model is shifted to min 0); V1 per-factory position offsets only matter between nodes of one asset.
- V1's `createItemMesh` ignores `contents` / `mealName`; meals are rendered by meal id (V1 maps the id to its Title Case branch). The manifest notes the inferred container.
- Items are rendered in isolation; ingredient-specific stage variants beyond what V1 draws are not generated.
- Supersampling nearest-rounds scaled nodes; gaps are not possible but edges are blocky. Non-uniform scales other than the table are untested.
- Ids with no dedicated V1 art get V1's generic fallback box; the manifest flags these.
- Standalone script: no package.json here; it resolves `three` from the root `node_modules`.
