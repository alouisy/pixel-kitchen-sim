import {
  CanvasTexture,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NearestFilter,
  PlaneGeometry,
  SRGBColorSpace,
  type Object3D,
} from 'three';
import { Palette, Vox, voxFromModel, type VoxModel } from './voxel.js';

const P = 0.125; // 1/8 m voxels for props

/** A plank deck chunk (w x d voxels, 2 thick) with alternating boards. */
export function deckChunk(pal: Palette, w: number, d: number, tones: [string, string, string]): Mesh {
  const v = new Vox(w, 2, d, pal);
  for (let z = 0; z < d; z++) {
    const board = Math.floor(z / 3);
    const gap = z % 3 === 2;
    for (let x = 0; x < w; x++) {
      const tone = tones[(board + Math.floor((x + board * 7) / 11)) % 2]!;
      v.set(x, 0, z, tones[2]!);
      v.set(x, 1, z, gap ? tones[2]! : tone);
    }
  }
  return v.mesh(P, [0, 2, 0]);
}

/** Counter body 1 m x 0.9 m: painted sides, light wooden top. */
export function counterBase(pal: Palette, body = '#3f8796', top = '#e2c08a'): Mesh {
  const v = new Vox(10, 9, 10, pal).box(0, 0, 0, 10, 8, 10, body).box(0, 0, 0, 10, 1, 10, '#2c3e48').box(0, 8, 0, 10, 9, 10, top);
  for (let i = 1; i < 10; i += 3) v.box(i, 1, 0, i + 1, 8, 1, '#357685');
  return v.mesh(0.1, [5, 0, 5]);
}

export function woodCrate(pal: Palette): Mesh {
  const v = new Vox(9, 5, 9, pal).box(0, 0, 0, 9, 5, 9, '#9a6a35').box(1, 1, 1, 8, 5, 8, 0);
  v.box(0, 0, 0, 9, 1, 9, '#7a5128');
  for (let y = 1; y < 5; y += 2) v.box(0, y, 0, 9, y + 1, 1, '#b58047').box(0, y, 8, 9, y + 1, 9, '#b58047');
  v.box(1, 1, 1, 8, 2, 8, '#6b4a2a');
  return v.mesh(0.09, [4.5, 0, 4.5]);
}

export function stationModel(models: Record<string, VoxModel>, pal: Palette, name: string, scale: number, recolor?: (h: string) => string | number): Mesh | null {
  const m = models[name];
  if (!m) return null;
  const v = voxFromModel(m, pal, recolor);
  return v.mesh(scale, [v.w / 2, 0, v.d / 2]);
}

/** Hull + deck + mast + sail. Bows along +x. */
export function sailboat(pal: Palette, hull: string, trim: string): Group {
  const g = new Group();
  const L = 44;
  const W = 17;
  const h = new Vox(L, 9, W, pal);
  for (let x = 0; x < L; x++) {
    const t = x / (L - 1);
    const half = Math.max(1, Math.round((W / 2) * Math.min(1, 1.5 * (1 - t) + 0.25) * Math.min(1, 0.45 + t * 3)));
    for (let z = 0; z < W; z++) {
      if (Math.abs(z - (W - 1) / 2) > half) continue;
      for (let y = 0; y < 8; y++) {
        const rise = Math.floor(t * 3);
        if (y < 2 - 0 && Math.abs(z - (W - 1) / 2) > half - 2) continue;
        const col = y >= 5 ? trim : y === 4 ? '#f5f5f0' : hull;
        h.set(x, y + (y > 5 ? rise : 0), z, col);
      }
    }
  }
  for (let x = 4; x < L - 4; x++) for (let z = 4; z < W - 4; z++) h.set(x, 7, z, '#c79a5b');
  const hm = h.mesh(P, [L / 2, 0, W / 2]);
  hm.position.y = -0.2;
  g.add(hm);
  const mast = new Vox(2, 44, 2, pal).box(0, 0, 0, 2, 44, 2, '#8a5c32');
  const mm = mast.mesh(P, [1, 0, 1]);
  mm.position.set(-0.6, 0.6, 0);
  g.add(mm);
  const sail = new Vox(1, 38, 28, pal);
  for (let y = 0; y < 38; y++) {
    const wd = Math.round(28 * (1 - y / 38));
    for (let z = 0; z < wd; z++) sail.set(0, y, z, y % 9 === 0 ? '#e6e6e0' : '#fbfbf6');
  }
  const sm = sail.mesh(P, [0, 0, 0]);
  sm.position.set(-0.6, 1.4, -0.12);
  sm.rotation.y = -Math.PI / 2;
  g.add(sm);
  return g;
}

export function rowboat(pal: Palette): Group {
  const g = new Group();
  const L = 22;
  const W = 11;
  const v = new Vox(L, 5, W, pal);
  for (let x = 0; x < L; x++) {
    const t = x / (L - 1);
    const half = Math.round((W / 2) * Math.min(1, 1.2 * (1 - t) + 0.15) * Math.min(1, 0.5 + t * 3));
    for (let z = 0; z < W; z++) {
      if (Math.abs(z - (W - 1) / 2) > half) continue;
      for (let y = 0; y < 5; y++) {
        const edge = Math.abs(z - (W - 1) / 2) > half - 1;
        if (y < 3 || edge || x < 2) v.set(x, y, z, y === 4 ? '#f2f2ea' : '#d6603a');
      }
    }
  }
  const m = v.mesh(P, [L / 2, 0, W / 2]);
  m.position.y = -0.15;
  g.add(m);
  return g;
}

export function lamppost(pal: Palette): { group: Group; bulb: Mesh } {
  const g = new Group();
  const v = new Vox(3, 26, 3, pal).box(0, 0, 0, 3, 26, 3, '#2e3a45').box(0, 0, 0, 3, 2, 3, '#1f2830');
  v.box(-0, 22, 0, 3, 24, 3, '#2e3a45');
  g.add(v.mesh(P, [1.5, 0, 1.5]));
  const head = new Vox(5, 5, 5, pal).box(0, 0, 0, 5, 1, 5, '#2e3a45').box(0, 4, 0, 5, 5, 5, '#2e3a45');
  const hm = head.mesh(P, [2.5, 0, 2.5]);
  hm.position.y = 3.15;
  g.add(hm);
  const bulb = new Mesh(new CylinderGeometry(0.2, 0.2, 0.4, 8), new MeshBasicMaterial({ color: 0xffe6a0 }));
  bulb.position.y = 3.4;
  g.add(bulb);
  return { group: g, bulb };
}

export function lighthouse(pal: Palette): Group {
  const g = new Group();
  const rock = new Vox(40, 6, 40, pal);
  for (let z = 0; z < 40; z++)
    for (let x = 0; x < 40; x++) {
      const dx = x - 19.5;
      const dz = z - 19.5;
      const r = Math.sqrt(dx * dx + dz * dz);
      const hgt = Math.round(6 - r / 4);
      for (let y = 0; y < hgt; y++) rock.set(x, y, z, y > 3 ? '#8a8f86' : '#6c7068');
    }
  const rm = rock.mesh(0.3, [20, 0, 20]);
  rm.position.y = -0.5;
  g.add(rm);
  const tower = new Vox(14, 56, 14, pal);
  for (let y = 0; y < 52; y++) {
    const r = 6.5 - y * 0.045;
    for (let z = 0; z < 14; z++)
      for (let x = 0; x < 14; x++) {
        const d = Math.sqrt((x - 6.5) ** 2 + (z - 6.5) ** 2);
        if (d <= r) tower.set(x, y, z, Math.floor(y / 8) % 2 === 0 ? '#f4f1ea' : '#d9473a');
      }
  }
  for (let z = 0; z < 14; z++)
    for (let x = 0; x < 14; x++) {
      const d = Math.sqrt((x - 6.5) ** 2 + (z - 6.5) ** 2);
      if (d <= 5.5) tower.set(x, 52, z, '#2a2f3a');
      if (d <= 3.5) for (let y = 53; y < 56; y++) tower.set(x, y, z, '#ffe9a6');
    }
  const tm = tower.mesh(0.3, [7, 0, 7]);
  tm.position.y = 0.6;
  g.add(tm);
  return g;
}

/** Painted sign board with canvas text. */
export function signBoard(text: string, w = 3.2, h = 0.9): Mesh {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 144;
  const g = c.getContext('2d')!;
  g.fillStyle = '#2f6f7d';
  g.fillRect(0, 0, 512, 144);
  g.fillStyle = '#e8c27a';
  g.fillRect(8, 8, 496, 128);
  g.fillStyle = '#2f6f7d';
  g.fillRect(14, 14, 484, 116);
  g.fillStyle = '#fff4d8';
  g.font = 'bold 66px Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 76);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.magFilter = NearestFilter;
  const m = new Mesh(new PlaneGeometry(w, h), new MeshStandardMaterial({ map: tex, roughness: 0.8 }));
  m.castShadow = true;
  return m;
}

/** Striped awning that flaps lightly. Flat plane (w x depth), update() ripples the free edge. */
export class Awning {
  readonly mesh: Mesh;
  private readonly base: Float32Array;

  constructor(w: number, depth: number, c1 = '#d9473a', c2 = '#fbf6ea') {
    const cv = document.createElement('canvas');
    cv.width = 64;
    cv.height = 8;
    const g = cv.getContext('2d')!;
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 === 0 ? c1 : c2;
      g.fillRect(i * 8, 0, 8, 8);
    }
    const tex = new CanvasTexture(cv);
    tex.colorSpace = SRGBColorSpace;
    tex.magFilter = NearestFilter;
    tex.repeat.set(w / 2, 1);
    tex.wrapS = 1000; // RepeatWrapping
    const geo = new PlaneGeometry(w, depth, 40, 3);
    this.mesh = new Mesh(geo, new MeshStandardMaterial({ map: tex, side: DoubleSide, roughness: 0.9 }));
    this.mesh.castShadow = true;
    this.base = new Float32Array(geo.attributes.position!.array as Float32Array);
  }

  update(time: number): void {
    const pos = this.mesh.geometry.attributes.position!;
    const a = pos.array as Float32Array;
    for (let i = 0; i < pos.count; i++) {
      const y = this.base[i * 3 + 1]!;
      const edge = Math.max(0, 0.5 - y / 1);
      a[i * 3 + 2] = this.base[i * 3 + 2]! + Math.sin(this.base[i * 3]! * 2.2 + time * 2.4) * 0.035 * (y < 0 ? 1 : 0.2) * (edge + 0.2);
    }
    pos.needsUpdate = true;
  }
}

export type { Object3D };
