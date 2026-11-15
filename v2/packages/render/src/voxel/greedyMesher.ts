import type { MeshData, MeshInput } from './types.js';

/*
 * Greedy mesher with baked per-vertex AO.
 *
 * For each axis d (u = d+1, v = d+2, a cyclic permutation so e_u x e_v = +e_d) and each side (+1 / -1) we sweep
 * slices along d. A face exists where a solid cell has an empty/out-of-bounds neighbor on `side`.
 *
 * Quad corner order (in the face's (u,v) plane, before any winding flip):
 *   0 = (u0,   v0)    1 = (u0+w, v0)    2 = (u0+w, v0+h)    3 = (u0, v0+h)
 * i.e. CCW seen from +d. For side=+1 triangles are (0,1,2),(0,2,3) (CCW from outside); for side=-1 they are
 * reversed ((0,2,1),(0,3,2)). AO of corner k is stored in vertex k. When ao0+ao2 < ao1+ao3 the diagonal is
 * flipped to 1-3 (anisotropy fix) so the interpolation runs along the brighter diagonal.
 *
 * Merge key (24 bits): material | ao0..ao3 (2 bits each) | doneness band (4) | char band (4).
 */

// Reusable growable builders (module scratch; results are copied out).
let pos = new Float32Array(4096 * 3);
let nrm = new Int8Array(4096 * 3);
let atr = new Uint8Array(4096 * 4);
let idx = new Uint32Array(6144);
let mask = new Int32Array(64 * 64);
let vCount = 0;
let iCount = 0;

function ensureVerts(extra: number): void {
  const need = vCount + extra;
  if (need * 3 <= pos.length) return;
  let cap = pos.length / 3;
  while (cap < need) cap *= 2;
  const p = new Float32Array(cap * 3);
  p.set(pos);
  pos = p;
  const n = new Int8Array(cap * 3);
  n.set(nrm);
  nrm = n;
  const a = new Uint8Array(cap * 4);
  a.set(atr);
  atr = a;
}

function ensureIdx(extra: number): void {
  const need = iCount + extra;
  if (need <= idx.length) return;
  let cap = idx.length;
  while (cap < need) cap *= 2;
  const i = new Uint32Array(cap);
  i.set(idx);
  idx = i;
}

export function meshVolume(input: MeshInput): MeshData {
  const { dims, material } = input;
  const doneness = input.doneness ?? null;
  const char = input.char ?? null;
  const dx = dims[0];
  const dy = dims[1];
  const stride = [1, dx, dx * dy];
  vCount = 0;
  iCount = 0;
  let quadCount = 0;
  if (mask.length < 64 * 64) mask = new Int32Array(64 * 64);

  for (let d = 0; d < 3; d++) {
    const u = (d + 1) % 3;
    const v = (d + 2) % 3;
    const nd = dims[d]!;
    const nu = dims[u]!;
    const nv = dims[v]!;
    const sd = stride[d]!;
    const su = stride[u]!;
    const sv = stride[v]!;

    // Solid test in (d,u,v) coordinates, bounds-checked.
    const solid = (a: number, b: number, c: number): number =>
      a >= 0 && a < nd && b >= 0 && b < nu && c >= 0 && c < nv && material[a * sd + b * su + c * sv] !== 0 ? 1 : 0;

    for (let side = 1; side >= -1; side -= 2) {
      for (let i = 0; i < nd; i++) {
        const fi = i + side; // layer in front of the face
        // Build mask.
        let any = false;
        let n = 0;
        for (let j = 0; j < nv; j++) {
          for (let k = 0; k < nu; k++, n++) {
            const cell = i * sd + k * su + j * sv;
            const m = material[cell]!;
            if (m === 0 || solid(fi, k, j) === 1) {
              mask[n] = 0;
              continue;
            }
            // Corner AO. Corner (cu,cv): neighbors toward (su_,sv_) in the front layer.
            const l = solid(fi, k - 1, j);
            const r = solid(fi, k + 1, j);
            const dn = solid(fi, k, j - 1);
            const up = solid(fi, k, j + 1);
            const a0 = l && dn ? 0 : 3 - (l + dn + solid(fi, k - 1, j - 1));
            const a1 = r && dn ? 0 : 3 - (r + dn + solid(fi, k + 1, j - 1));
            const a2 = r && up ? 0 : 3 - (r + up + solid(fi, k + 1, j + 1));
            const a3 = l && up ? 0 : 3 - (l + up + solid(fi, k - 1, j + 1));
            const db = doneness ? doneness[cell]! >> 4 : 0;
            const cb = char ? char[cell]! >> 4 : 0;
            mask[n] = m | (a0 << 8) | (a1 << 10) | (a2 << 12) | (a3 << 14) | (db << 16) | (cb << 20);
            any = true;
          }
        }
        if (!any) continue;

        const dpos = side > 0 ? i + 1 : i;
        n = 0;
        for (let j = 0; j < nv; j++) {
          for (let k = 0; k < nu; ) {
            const key = mask[n]!;
            if (key === 0) {
              k++;
              n++;
              continue;
            }
            let w = 1;
            while (k + w < nu && mask[n + w] === key) w++;
            let h = 1;
            outer: while (j + h < nv) {
              const row = n + h * nu;
              for (let t = 0; t < w; t++) if (mask[row + t] !== key) break outer;
              h++;
            }
            for (let hh = 0; hh < h; hh++) {
              const row = n + hh * nu;
              for (let t = 0; t < w; t++) mask[row + t] = 0;
            }

            // Emit quad.
            ensureVerts(4);
            ensureIdx(6);
            const a0 = (key >> 8) & 3;
            const a1 = (key >> 10) & 3;
            const a2 = (key >> 12) & 3;
            const a3 = (key >> 14) & 3;
            const dOut = (((key >> 16) & 15) << 4) + 8;
            const cOut = (((key >> 20) & 15) << 4) + 8;
            const m = key & 255;
            const base = vCount;
            for (let c = 0; c < 4; c++) {
              const cu = k + (c === 1 || c === 2 ? w : 0);
              const cv = j + (c >= 2 ? h : 0);
              const o = (base + c) * 3;
              pos[o + d] = dpos;
              pos[o + u] = cu;
              pos[o + v] = cv;
              nrm[o] = 0;
              nrm[o + 1] = 0;
              nrm[o + 2] = 0;
              nrm[o + d] = side;
              const q = (base + c) * 4;
              atr[q] = m;
              atr[q + 1] = c === 0 ? a0 : c === 1 ? a1 : c === 2 ? a2 : a3;
              atr[q + 2] = dOut;
              atr[q + 3] = cOut;
            }
            vCount += 4;
            const flip = a0 + a2 < a1 + a3;
            const ii = iCount;
            if (side > 0) {
              if (!flip) {
                idx[ii] = base; idx[ii + 1] = base + 1; idx[ii + 2] = base + 2;
                idx[ii + 3] = base; idx[ii + 4] = base + 2; idx[ii + 5] = base + 3;
              } else {
                idx[ii] = base + 1; idx[ii + 1] = base + 2; idx[ii + 2] = base + 3;
                idx[ii + 3] = base + 1; idx[ii + 4] = base + 3; idx[ii + 5] = base;
              }
            } else if (!flip) {
              idx[ii] = base; idx[ii + 1] = base + 2; idx[ii + 2] = base + 1;
              idx[ii + 3] = base; idx[ii + 4] = base + 3; idx[ii + 5] = base + 2;
            } else {
              idx[ii] = base + 1; idx[ii + 1] = base + 3; idx[ii + 2] = base + 2;
              idx[ii + 3] = base + 1; idx[ii + 4] = base; idx[ii + 5] = base + 3;
            }
            iCount += 6;
            quadCount++;
            k += w;
            n += w;
          }
        }
      }
    }
  }

  return {
    positions: pos.slice(0, vCount * 3),
    normals: nrm.slice(0, vCount * 3),
    attrs: atr.slice(0, vCount * 4),
    indices: idx.slice(0, iCount),
    quadCount,
  };
}
