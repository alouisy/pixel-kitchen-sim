#!/usr/bin/env node
// One-off converter: V1 procedural voxel art -> MagicaVoxel .vox (see README.md).
// Run from the repo root:  node v2/tools/v1-to-vox/v1-to-vox.mjs
import * as THREE from 'three';
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as VB from '../../../src/voxelBuilder.js';
import { GRID_UNIT, CATALOG_ITEMS } from '../../../src/constants.js';
import { RECIPES } from '../../../src/gameData.js';
import { readVox } from './read-vox.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../..');
const OUT = resolve(ROOT, 'v2/content-src/vox/v1');
const VS = GRID_UNIT / 16; // V1 VOXEL_SIZE (16 voxels per GRID_UNIT)

// ---- 1. Monkey-patch the recorder in (before any factory runs) ----
const { VoxelBuilder } = VB;
VoxelBuilder.prototype.add = function (x, y, z, color) {
  (this.__voxels ??= []).push({ x, y, z, color });
  return this;
};
VoxelBuilder.prototype.buildMesh = function () {
  const mesh = new THREE.Mesh();
  mesh.userData.__voxels = this.__voxels ?? [];
  this.__voxels = [];
  return mesh;
};
// addBox() in V1 loops over this.add(), so it is recorded through the patched add().

// ---- 2. Capture ----
/** Returns { voxels: Map<key,{x,y,z,color}>, warnings, supersampled } for an Object3D. */
function capture(root) {
  const warnings = [];
  let supersampled = false;
  root.updateMatrixWorld(true);
  const map = new Map();
  let badRot = false;
  root.traverse((node) => {
    const vox = node.userData.__voxels;
    if (!vox || !vox.length) return;
    const m = node.matrixWorld;
    const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), sc = new THREE.Vector3();
    m.decompose(pos, quat, sc);
    // rotation check: normalized basis components must be 0 / +-1
    const e = m.elements;
    const cols = [[e[0], e[1], e[2], sc.x], [e[4], e[5], e[6], sc.y], [e[8], e[9], e[10], sc.z]];
    for (const [a, b, c, s] of cols) for (const v of [a, b, c]) {
      const n = Math.abs(v / s);
      if (Math.min(Math.abs(n), Math.abs(n - 1)) > 1e-3) badRot = true;
    }
    const n = [sc.x, sc.y, sc.z].map((s) => (s > 1.01 ? Math.ceil(s - 1e-6) : 1));
    if (n.some((k) => k > 1)) supersampled = true;
    const tmp = new THREE.Vector3();
    for (const v of vox) {
      for (let i = 0; i < n[0]; i++) for (let j = 0; j < n[1]; j++) for (let k = 0; k < n[2]; k++) {
        // local voxel centre (mirrors V1 add()), plus sub-cell offset in voxel units
        const ox = n[0] > 1 ? ((i + 0.5) / n[0] - 0.5) : 0;
        const oy = n[1] > 1 ? ((j + 0.5) / n[1] - 0.5) : 0;
        const oz = n[2] > 1 ? ((k + 0.5) / n[2] - 0.5) : 0;
        tmp.set((v.x + ox) * VS - GRID_UNIT / 2 + VS / 2,
                (v.y + oy) * VS - GRID_UNIT / 2 + VS / 2,
                (v.z + oz) * VS - GRID_UNIT / 2 + VS / 2).applyMatrix4(m);
        const X = Math.round(tmp.x / VS - 0.5), Y = Math.round(tmp.y / VS - 0.5), Z = Math.round(tmp.z / VS - 0.5);
        map.set(`${X},${Y},${Z}`, { x: X, y: Y, z: Z, color: v.color }); // last write wins
      }
    }
  });
  if (badRot) warnings.push('non-90-degree rotation: voxel positions were rounded');
  if (supersampled) warnings.push('scaled node supersampled');
  return { voxels: [...map.values()], warnings, supersampled };
}

// ---- 3. Asset list ----
const skipped = [];
const assets = []; // { name, category, voxels, warnings }
const toSnake = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();

function addAsset(category, name, make) {
  try {
    const obj = make();
    const r = capture(obj);
    if (!r.voxels.length) { skipped.push(`${category}/${name}: zero voxels`); return; }
    assets.push({ name, category, voxels: r.voxels, warnings: r.warnings });
    if (r.supersampled) console.log(`  [supersampled] ${category}/${name}`);
  } catch (err) {
    skipped.push(`${category}/${name}: threw ${err.message}`);
  }
}

// stations
const noArg = ['createTrashBinMesh', 'createFryerMesh', 'createCuttingBoardMesh', 'createStoveMesh', 'createSinkMesh',
  'createToasterMesh', 'createMixerMesh', 'createBlenderMesh', 'createDoughPressMesh', 'createPizzaOvenMesh',
  'createPlateStackMesh', 'createCupStackMesh', 'createBowlStackMesh', 'createExhaustHoodMesh', 'createPlantMesh',
  'createKitchenLampMesh', 'createCoatingStationMesh'];
for (const fn of noArg) {
  const name = toSnake(fn.replace(/^create/, '').replace(/Mesh$/, ''));
  addAsset('stations', name, () => VB[fn]());
}
addAsset('stations', 'table', () => VB.createTableMesh({})); // neighbors {n,e,s,w} all falsy => 4 legs

const catalog = Array.isArray(CATALOG_ITEMS) ? CATALOG_ITEMS : Object.values(CATALOG_ITEMS);
const binTypes = [...new Set(catalog.filter((c) => c.type === 'ingredient_source').map((c) => c.config?.ingredient).filter(Boolean))];
for (const t of binTypes) addAsset('stations', `ingredient_bin_${t}`, () => VB.createIngredientBinMesh(t));

// items
const itemIds = new Set(['plate', 'bowl', 'cup', 'pizza_base']);
const src = readFileSync(join(ROOT, 'src/voxelBuilder.js'), 'utf8');
const iconsStart = src.indexOf('const ICONS = {');
const iconsBlock = src.slice(iconsStart, src.indexOf('\nexport class VoxelBuilder'));
for (const m of iconsBlock.matchAll(/^    ([A-Za-z_][\w]*)\s*:\s*\{\s*$/gm)) itemIds.add(m[1]);
for (const r of Object.values(RECIPES)) for (const i of r.ingredients) itemIds.add(i);
for (const c of catalog) for (const v of Object.values(c.config?.result ?? {})) itemIds.add(v);
for (const c of catalog) for (const p of c.config?.processes ?? []) itemIds.add(p);
for (const t of binTypes) itemIds.add(t);

// detect V1's generic fallback box so we can flag ids without dedicated art
const fallbackSig = (() => {
  const r = capture(VB.createItemMesh('__no_such_item__'));
  return r.voxels.map((v) => `${v.x},${v.y},${v.z},${v.color}`).sort().join('|');
})();
for (const id of [...itemIds].sort()) {
  addAsset('items', id, () => VB.createItemMesh(id));
  const a = assets[assets.length - 1];
  if (a && a.category === 'items' && a.name === id) {
    const sig = a.voxels.map((v) => `${v.x},${v.y},${v.z},${v.color}`).sort().join('|');
    if (sig === fallbackSig) a.warnings.push('V1 has no dedicated art: generic fallback box');
  }
}

// meals (V1's createItemMesh keys meals by meal id and ignores contents/mealName; container is informational)
for (const [mealId, recipe] of Object.entries(RECIPES)) {
  const container = recipe.visualSteps?.find((s) => s.type === 'container')?.item ?? 'plate';
  addAsset('meals', mealId, () => VB.createItemMesh(mealId, recipe.ingredients, mealId));
  const a = assets[assets.length - 1];
  if (a && a.category === 'meals' && a.name === mealId) a.warnings.push(`container=${container}; V1 ignores contents arg, rendered via meal id`);
}

// ---- 4. Palette ----
const hex6 = (n) => n.toString(16).padStart(6, '0');
const counts = new Map();
for (const a of assets) for (const v of a.voxels) counts.set(v.color, (counts.get(v.color) ?? 0) + 1);
const rgbOf = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const hsl = ([r, g, b]) => {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  let h = 0;
  if (d) h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s: d ? d / (1 - Math.abs(2 * l - 1)) : 0, l };
};
let paletteColors; // array of [r,g,b]
let maxErr = 0;
let mapColor;
const distinct = [...counts.keys()];
if (distinct.length <= 255) {
  paletteColors = distinct.map(rgbOf);
} else {
  // weighted median cut
  let boxes = [distinct.map((c) => ({ rgb: rgbOf(c), w: counts.get(c) }))];
  while (boxes.length < 255) {
    let bi = -1, bs = 0, bax = 0;
    boxes.forEach((b, i) => {
      if (b.length < 2) return;
      for (let ax = 0; ax < 3; ax++) {
        const vals = b.map((p) => p.rgb[ax]);
        const range = Math.max(...vals) - Math.min(...vals);
        const score = range * Math.sqrt(b.reduce((s, p) => s + p.w, 0));
        if (score > bs) { bs = score; bi = i; bax = ax; }
      }
    });
    if (bi < 0) break;
    const b = boxes[bi].sort((p, q) => p.rgb[bax] - q.rgb[bax]);
    const tot = b.reduce((s, p) => s + p.w, 0);
    let acc = 0, cut = 1;
    for (let i = 0; i < b.length - 1; i++) { acc += b[i].w; cut = i + 1; if (acc >= tot / 2) break; }
    boxes.splice(bi, 1, b.slice(0, cut), b.slice(cut));
  }
  paletteColors = boxes.map((b) => {
    const tot = b.reduce((s, p) => s + p.w, 0);
    return [0, 1, 2].map((ax) => Math.round(b.reduce((s, p) => s + p.rgb[ax] * p.w, 0) / tot));
  });
}
// tidy sort: hue then lightness (greys first)
paletteColors.sort((a, b) => {
  const A = hsl(a), B = hsl(b);
  const ag = A.s < 0.08, bg = B.s < 0.08;
  if (ag !== bg) return ag ? -1 : 1;
  if (ag) return A.l - B.l;
  return A.h - B.h || A.l - B.l;
});
const nearestCache = new Map();
mapColor = (c) => {
  let r = nearestCache.get(c);
  if (r) return r;
  const [R, G, B] = rgbOf(c);
  let best = 0, bd = Infinity;
  paletteColors.forEach((p, i) => {
    const d = (p[0] - R) ** 2 + (p[1] - G) ** 2 + (p[2] - B) ** 2;
    if (d < bd) { bd = d; best = i; }
  });
  maxErr = Math.max(maxErr, Math.sqrt(bd));
  r = best + 1;
  nearestCache.set(c, r);
  return r;
};
for (const c of distinct) mapColor(c);

// ---- 5. .vox writer ----
function chunk(id, content, children = Buffer.alloc(0)) {
  const h = Buffer.alloc(12);
  h.write(id, 0, 'latin1'); h.writeInt32LE(content.length, 4); h.writeInt32LE(children.length, 8);
  return Buffer.concat([h, content, children]);
}
function writeVox(file, size, vox, palette) {
  const sz = Buffer.alloc(12); size.forEach((s, i) => sz.writeInt32LE(s, i * 4));
  const xyzi = Buffer.alloc(4 + vox.length * 4);
  xyzi.writeInt32LE(vox.length, 0);
  vox.forEach((v, k) => { xyzi[4 + k * 4] = v.x; xyzi[5 + k * 4] = v.y; xyzi[6 + k * 4] = v.z; xyzi[7 + k * 4] = v.i; });
  const rgba = Buffer.alloc(1024);
  palette.forEach(([r, g, b], i) => { rgba[i * 4] = r; rgba[i * 4 + 1] = g; rgba[i * 4 + 2] = b; rgba[i * 4 + 3] = 255; });
  const main = chunk('MAIN', Buffer.alloc(0), Buffer.concat([chunk('SIZE', sz), chunk('XYZI', xyzi), chunk('RGBA', rgba)]));
  const head = Buffer.alloc(8); head.write('VOX ', 0, 'latin1'); head.writeInt32LE(150, 4);
  writeFileSync(file, Buffer.concat([head, main]));
}

// ---- 6. Emit ----
rmSync(OUT, { recursive: true, force: true });
for (const c of ['stations', 'items', 'meals']) mkdirSync(join(OUT, c), { recursive: true });
const manifest = [];
const expected = [];
let totalVox = 0;
for (const a of assets) {
  // V1 (x, y-up, z) -> vox (x, -z, y) (proper rotation, no mirroring); shift to min 0
  const pts = a.voxels.map((v) => ({ x: v.x, y: -v.z, z: v.y, i: mapColor(v.color) }));
  const min = [Math.min(...pts.map((p) => p.x)), Math.min(...pts.map((p) => p.y)), Math.min(...pts.map((p) => p.z))];
  pts.forEach((p) => { p.x -= min[0]; p.y -= min[1]; p.z -= min[2]; });
  const size = [Math.max(...pts.map((p) => p.x)) + 1, Math.max(...pts.map((p) => p.y)) + 1, Math.max(...pts.map((p) => p.z)) + 1];
  if (size.some((s) => s > 256)) throw new Error(`${a.name}: size ${size} exceeds 256`);
  const file = `${a.category}/${a.name}.vox`;
  writeVox(join(OUT, file), size, pts, paletteColors);
  manifest.push({ name: a.name, category: a.category, file, size, voxelCount: pts.length, warnings: a.warnings });
  expected.push({ file, size, count: pts.length, sig: pts });
  totalVox += pts.length;
}
writeFileSync(join(OUT, 'palette.json'), JSON.stringify(paletteColors.map((c, k) => ({ index: k + 1, hex: '#' + hex6((c[0] << 16) | (c[1] << 8) | c[2]) })), null, 2) + '\n');
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

// ---- 7. Verify by re-reading ----
let bad = 0;
for (const e of expected) {
  const r = readVox(join(OUT, e.file));
  const ok = r.voxels.length === e.count && r.size.join() === e.size.join() && r.version === 150 &&
    r.palette.slice(0, paletteColors.length).every((p, i) => p.r === paletteColors[i][0] && p.g === paletteColors[i][1] && p.b === paletteColors[i][2]) &&
    r.voxels.every((v, k) => v.x === e.sig[k].x && v.y === e.sig[k].y && v.z === e.sig[k].z && v.i === e.sig[k].i);
  if (!ok) { bad++; console.error(`MISMATCH ${e.file}`); }
}

// ---- 8. Report ----
const per = (c) => manifest.filter((m) => m.category === c).length;
const warnCount = manifest.reduce((s, m) => s + m.warnings.length, 0) + skipped.length;
console.log('\n=== v1-to-vox summary ===');
console.log(`assets: stations=${per('stations')} items=${per('items')} meals=${per('meals')} (total ${manifest.length})`);
console.log(`total voxels: ${totalVox}`);
console.log(`palette: ${paletteColors.length} colors from ${distinct.length} distinct${distinct.length > 255 ? `, max RGB error ${maxErr.toFixed(2)}` : ' (exact)'}`);
console.log(`warnings: ${warnCount} (${skipped.length} skipped assets)`);
for (const s of skipped) console.log(`  SKIPPED ${s}`);
for (const m of manifest) for (const w of m.warnings) if (!w.startsWith('container=')) console.log(`  warn ${m.category}/${m.name}: ${w}`);
const top = [...manifest].sort((a, b) => b.voxelCount - a.voxelCount).slice(0, 3);
console.log('top 3 by voxels:'); top.forEach((m) => console.log(`  ${m.file}  ${m.voxelCount} voxels  size ${m.size.join('x')}`));
if (manifest.some((m) => m.voxelCount === 0)) { console.error('empty asset found'); bad++; }
const cb = readVox(join(OUT, 'stations/cutting_board.vox'));
console.log(`\ncutting_board top-down (vox x -> right, vox y rows; highest z index) size ${cb.size.join('x')}:`);
{
  const top2 = new Map();
  for (const v of cb.voxels) { const k = v.x + ',' + v.y; if (!top2.has(k) || top2.get(k).z < v.z) top2.set(k, v); }
  const sym = (i) => '.' + ''.repeat(0) && String.fromCharCode(33 + (i % 90));
  for (let y = 0; y < cb.size[1]; y++) {
    let row = '';
    for (let x = 0; x < cb.size[0]; x++) { const v = top2.get(x + ',' + y); row += v ? sym(v.i) : ' '; }
    console.log('  ' + row);
  }
}
const dirSize = (d) => readdirSync(d).reduce((s, f) => { const p = join(d, f); return s + (statSync(p).isDirectory() ? dirSize(p) : statSync(p).size); }, 0);
const bytes = dirSize(OUT);
console.log(`\noutput size: ${(bytes / 1024).toFixed(1)} KiB${bytes > 5 * 1024 * 1024 ? '  *** EXCEEDS 5 MB ***' : ''}`);
if (bad) { console.error(`${bad} verification failure(s)`); process.exit(1); }
console.log('verification: OK');
