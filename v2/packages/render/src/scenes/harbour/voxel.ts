import { BufferGeometry, Mesh, type DataTexture, type Material } from 'three';
import { createRampTexture, createVoxelMaterial } from '../../voxel/foodMaterial.js';
import { meshVolume } from '../../voxel/greedyMesher.js';
import { toBufferGeometry } from '../../voxel/voxelMeshView.js';

/** Colour registry: every distinct colour gets a ramp index (1..255). Static props use the same colour for raw / cooked / charred. */
export class Palette {
  private readonly hexes: string[] = [];
  private readonly map = new Map<string, number>();
  private readonly extra: Array<{ index: number; colors: { raw: string; cooked: string; charred: string } }> = [];
  private dirty = false;
  private tex: DataTexture | null = null;
  private mat: Material | null = null;

  /** Index of a plain colour (#rrggbb). */
  idx(hex: string): number {
    const h = hex.toLowerCase();
    let i = this.map.get(h);
    if (i === undefined) {
      i = this.hexes.length + this.extra.length + 1;
      if (i > 255) throw new Error('palette full');
      this.map.set(h, i);
      this.hexes.push(h);
      this.dirty = true;
    }
    return i;
  }

  /** A cooking colour: raw -> cooked -> charred driven by the mesher's doneness / char bands. */
  ramp(name: string, raw: string, cooked: string, charred: string): number {
    const key = `ramp:${name}`;
    let i = this.map.get(key);
    if (i === undefined) {
      i = this.hexes.length + this.extra.length + 1;
      if (i > 255) throw new Error('palette full');
      this.map.set(key, i);
      this.extra.push({ index: i, colors: { raw, cooked, charred } });
      this.dirty = true;
    }
    return i;
  }

  private build(): DataTexture {
    const all = [
      ...this.hexes.map((h) => ({ index: this.map.get(h)!, colors: { raw: h, cooked: h, charred: h } })),
      ...this.extra,
    ];
    return createRampTexture(all);
  }

  texture(): DataTexture {
    if (!this.tex) this.tex = this.build();
    return this.tex;
  }

  /** The one shared material. Colours registered later are picked up by `refresh`. */
  material(): Material {
    if (!this.mat) this.mat = createVoxelMaterial(this.texture());
    return this.mat;
  }

  /** Re-upload the ramp in place after registering more colours (meshes keep their material). */
  /** Upload new colours if any were registered since the last call. */
  flush(): void {
    if (this.dirty) this.refresh();
  }

  refresh(): void {
    this.dirty = false;
    const fresh = this.build();
    const t = this.texture();
    (t.image.data as Uint8Array).set(fresh.image.data as Uint8Array);
    t.needsUpdate = true;
    fresh.dispose();
  }
}

/** A small editable voxel volume (dims <= 64). Origin is its min corner; y is up. */
export class Vox {
  readonly material: Uint8Array;
  readonly doneness: Uint8Array;
  readonly char: Uint8Array;

  constructor(
    readonly w: number,
    readonly h: number,
    readonly d: number,
    private readonly palette: Palette,
  ) {
    const n = w * h * d;
    this.material = new Uint8Array(n);
    this.doneness = new Uint8Array(n);
    this.char = new Uint8Array(n);
  }

  private i(x: number, y: number, z: number): number {
    return x + this.w * (y + this.h * z);
  }

  set(x: number, y: number, z: number, hexOrIndex: string | number): this {
    if (x < 0 || y < 0 || z < 0 || x >= this.w || y >= this.h || z >= this.d) return this;
    this.material[this.i(x, y, z)] = typeof hexOrIndex === 'number' ? hexOrIndex : this.palette.idx(hexOrIndex);
    return this;
  }

  clear(x: number, y: number, z: number): this {
    if (x < 0 || y < 0 || z < 0 || x >= this.w || y >= this.h || z >= this.d) return this;
    this.material[this.i(x, y, z)] = 0;
    return this;
  }

  /** Inclusive-exclusive box [x0,x1) x [y0,y1) x [z0,z1). */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: string | number): this {
    const idx = typeof c === 'number' ? c : this.palette.idx(c);
    for (let z = z0; z < z1; z++)
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) if (x >= 0 && y >= 0 && z >= 0 && x < this.w && y < this.h && z < this.d) this.material[this.i(x, y, z)] = idx;
    return this;
  }

  get(x: number, y: number, z: number): number {
    if (x < 0 || y < 0 || z < 0 || x >= this.w || y >= this.h || z >= this.d) return 0;
    return this.material[this.i(x, y, z)]!;
  }

  geometry(): BufferGeometry {
    return toBufferGeometry(meshVolume({ dims: [this.w, this.h, this.d], material: this.material, doneness: this.doneness, char: this.char }));
  }

  /**
   * Mesh scaled by `size` m per voxel. `pivot` (in voxels) becomes the mesh origin so rotations happen around it.
   */
  mesh(size: number, pivot: [number, number, number] = [0, 0, 0], shadows = true): Mesh {
    const g = this.geometry();
    g.translate(-pivot[0], -pivot[1], -pivot[2]);
    g.computeBoundingSphere();
    g.computeBoundingBox();
    const m = new Mesh(g, this.palette.material());
    m.scale.setScalar(size);
    m.castShadow = shadows;
    m.receiveShadow = shadows;
    return m;
  }
}

export interface VoxModel {
  size: [number, number, number];
  /** x,y,z (z up in the file), palette index (1-based) */
  voxels: Array<[number, number, number, number]>;
  palette: string[];
}

/** Parse a MagicaVoxel .vox file (z is up in the file; we map it to y up). */
export function parseVox(buf: ArrayBuffer): VoxModel {
  const dv = new DataView(buf);
  const u8 = new Uint8Array(buf);
  const tag = (o: number): string => String.fromCharCode(u8[o]!, u8[o + 1]!, u8[o + 2]!, u8[o + 3]!);
  if (tag(0) !== 'VOX ') throw new Error('not a vox file');
  let size: [number, number, number] = [0, 0, 0];
  const voxels: VoxModel['voxels'] = [];
  const palette: string[] = [];
  const walk = (o: number, end: number): void => {
    while (o + 12 <= end) {
      const id = tag(o);
      const n = dv.getInt32(o + 4, true);
      const m = dv.getInt32(o + 8, true);
      const body = o + 12;
      if (id === 'SIZE') size = [dv.getInt32(body, true), dv.getInt32(body + 4, true), dv.getInt32(body + 8, true)];
      else if (id === 'XYZI') {
        const k = dv.getInt32(body, true);
        for (let i = 0; i < k; i++) voxels.push([u8[body + 4 + i * 4]!, u8[body + 5 + i * 4]!, u8[body + 6 + i * 4]!, u8[body + 7 + i * 4]!]);
      } else if (id === 'RGBA') {
        for (let i = 0; i < 256; i++) {
          const r = u8[body + i * 4]!;
          const g = u8[body + i * 4 + 1]!;
          const b = u8[body + i * 4 + 2]!;
          palette.push(`#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`);
        }
      }
      if (id === 'MAIN') walk(body + n, body + n + m);
      o += 12 + n + m;
    }
  };
  walk(8, buf.byteLength);
  return { size, voxels, palette };
}

/** Vox model -> editable Vox (file z becomes y up, file y becomes z). `recolor` may remap a hex. */
export function voxFromModel(model: VoxModel, palette: Palette, recolor?: (hex: string) => string | number): Vox {
  const [sx, sy, sz] = model.size;
  const v = new Vox(sx, sz, sy, palette);
  for (const [x, y, z, ci] of model.voxels) {
    const hex = model.palette[ci - 1] ?? '#ff00ff';
    v.set(x, z, y, recolor ? recolor(hex) : hex);
  }
  return v;
}
