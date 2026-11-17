import { BoxGeometry, Group, Mesh, MeshStandardMaterial, type Object3D } from 'three';
import { Palette, Vox, voxFromModel, type VoxModel } from './voxel.js';

export interface ItemLike {
  id: number;
  def: string;
  state: string;
  progress: number;
  contents: string[];
}

const SCALE: Record<string, number> = { plate: 1 / 26, bowl: 1 / 26, cup: 1 / 26, potato: 1 / 22, raw_fries: 1 / 13, cooked_fries: 1 / 13 };
const FRIES_ON_PLATE = 1 / 15;

/**
 * Item meshes from the V1 .vox models. Fries use the raw -> cooked -> charred ramp: the doneness / char bands are baked per vertex
 * (16 bands each, cached), so one doneness value per item drives its colour. Containers show their contents stacked on top.
 */
export class ItemFactory {
  private readonly cache = new Map<string, Vox>();
  private readonly friesRamp: number;

  constructor(
    private readonly palette: Palette,
    private readonly models: Record<string, VoxModel>,
  ) {
    this.friesRamp = palette.ramp('fries', '#f6e7b0', '#e6a82a', '#2a1a10');
  }

  private model(name: string): VoxModel | undefined {
    return this.models[`items/${name}`];
  }

  private friesVox(def: string, doneBand: number, charBand: number): Vox | null {
    const key = `${def}:${doneBand}:${charBand}`;
    let v = this.cache.get(key);
    if (!v) {
      const m = this.model(def === 'raw_fries' ? 'raw_fries' : 'cooked_fries');
      if (!m) return null;
      v = voxFromModel(m, this.palette, (hex) => (hex === '#000000' ? '#3a2a1a' : this.friesRamp));
      for (let i = 0; i < v.material.length; i++)
        if (v.material[i] === this.friesRamp) {
          v.doneness[i] = doneBand * 16 + 8;
          v.char[i] = charBand * 16 + 8;
        }
      this.cache.set(key, v);
    }
    return v;
  }

  private plain(name: string): Vox | null {
    let v = this.cache.get(name);
    if (!v) {
      const m = this.model(name);
      if (!m) return null;
      v = voxFromModel(m, this.palette, name === 'potato' ? (h) => (h === '#d7ccc8' ? '#cfa86a' : h === '#8d6e63' ? '#6e4a2e' : h) : undefined);
      this.cache.set(name, v);
    }
    return v;
  }

  private place(v: Vox, scale: number): Mesh {
    const m = v.mesh(scale, [v.w / 2, 0, v.d / 2]);
    return m;
  }

  /** (done, char) bands 0..15 for an item. */
  bands(it: ItemLike): [number, number] {
    if (it.state === 'cooking') return [Math.min(15, it.progress >> 4), 0];
    if (it.state === 'cooked') return [15, Math.min(15, Math.max(0, (it.progress - 120) >> 3))];
    if (it.state === 'burning') return [15, Math.min(15, 4 + (it.progress >> 5))];
    if (it.state === 'burnt') return [15, 15];
    return [0, 0];
  }

  /** Stable signature: rebuild the mesh only when this changes. */
  signature(it: ItemLike): string {
    const [d, c] = this.bands(it);
    return `${it.def}|${d}|${c}|${it.contents.join(',')}`;
  }

  build(it: ItemLike): Object3D {
    const g = new Group();
    const [d, c] = this.bands(it);
    if (it.def === 'raw_fries' || it.def === 'cooked_fries') {
      const v = this.friesVox(it.def, d, c);
      if (v) g.add(this.place(v, SCALE[it.def]!));
      else g.add(this.fallback());
      return g;
    }
    const v = this.plain(it.def);
    if (v) g.add(this.place(v, SCALE[it.def] ?? 1 / 20));
    else g.add(this.fallback());
    // Container contents sit on the plate.
    let n = 0;
    for (const comp of it.contents) {
      if (comp === 'cooked_fries') {
        const f = this.friesVox('cooked_fries', 15, c === 15 ? 15 : 0);
        if (f) {
          const m = this.place(f, FRIES_ON_PLATE);
          m.position.y = 0.06 + n * 0.12;
          g.add(m);
        }
      } else {
        const cv = this.plain(comp);
        if (cv) {
          const m = this.place(cv, 1 / 22);
          m.position.y = 0.06 + n * 0.1;
          g.add(m);
        }
      }
      n++;
    }
    return g;
  }

  private fallback(): Mesh {
    const m = new Mesh(new BoxGeometry(0.25, 0.25, 0.25), new MeshStandardMaterial({ color: 0xff00ff }));
    m.position.y = 0.125;
    return m;
  }
}
