import {
  AdditiveBlending,
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  type Material,
  type Scene,
} from 'three';
import { meshVolume } from '../voxel/greedyMesher.js';
import type { MeshInput } from '../voxel/types.js';
import { VoxelMeshView } from '../voxel/voxelMeshView.js';

/** Static layout in integer food voxels (x/z/y cell ranges, y up). Supplied by the client from the sim's layout. */
export interface KitchenDesc {
  voxelSize: number;
  table: { x0: number; z0: number; w: number; d: number; top: number };
  rock: { x0: number; z0: number; w: number; d: number; y0: number; top: number };
  plate: { cx: number; cz: number; r: number; y: number };
  pads: ReadonlyArray<{ x: number; z: number; size: number; color: number }>;
  /** Material ramp indices used for the static voxel volumes. */
  woodMaterial: number;
  stoneMaterial: number;
}

const TABLE_ID = -1;
const ROCK_ID = -2;

function tableVolume(d: KitchenDesc): MeshInput {
  const { w, d: dd, top } = d.table;
  const dims: [number, number, number] = [w, top, dd];
  const material = new Uint8Array(w * top * dd);
  const set = (x: number, y: number, z: number) => {
    material[x + w * (y + top * z)] = d.woodMaterial;
  };
  for (let z = 0; z < dd; z++)
    for (let y = top - 2; y < top; y++) for (let x = 0; x < w; x++) set(x, y, z); // 2 fv top slab
  const leg = 3;
  for (const lx of [1, w - 1 - leg])
    for (const lz of [1, dd - 1 - leg])
      for (let y = 0; y < top - 2; y++) for (let z = 0; z < leg; z++) for (let x = 0; x < leg; x++) set(lx + x, y, lz + z);
  return { dims, material };
}

function rockVolume(d: KitchenDesc): MeshInput {
  const { w, d: dd, y0, top } = d.rock;
  const h = top - y0;
  const material = new Uint8Array(w * h * dd);
  for (let z = 0; z < dd; z++)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const corner = (x === 0 || x === w - 1) && (z === 0 || z === dd - 1);
        if (corner && y === h - 1) continue; // chamfer the top corners
        material[x + w * (y + h * z)] = d.stoneMaterial;
      }
  return { dims: [w, h, dd], material };
}

/**
 * Static toy kitchen props: voxel table + hot rock (meshed once, baked AO), flat ingredient pads, the tasting plate and
 * a warm light over the rock that brightens as things cook on it.
 */
export class KitchenScene {
  readonly group = new Group();
  private readonly statics: VoxelMeshView;
  private readonly light: PointLight;
  private readonly ember: Mesh;
  private hot = 0;

  constructor(scene: Scene, voxelMaterial: Material, private readonly desc: KitchenDesc) {
    const vs = desc.voxelSize;
    scene.add(this.group);
    this.statics = new VoxelMeshView(scene, voxelMaterial, vs);
    const t = desc.table;
    this.statics.upsert(TABLE_ID, meshVolume(tableVolume(desc)), [t.x0, 0, t.z0]);
    const r = desc.rock;
    this.statics.upsert(ROCK_ID, meshVolume(rockVolume(desc)), [r.x0, r.y0, r.z0]);

    for (const p of desc.pads) {
      const s = p.size * vs;
      const mat = new Mesh(new BoxGeometry(s, 0.012, s), new MeshStandardMaterial({ color: p.color, roughness: 0.9 }));
      mat.position.set((p.x + 0.5) * vs, t.top * vs + 0.006, (p.z + 0.5) * vs);
      mat.receiveShadow = true;
      this.group.add(mat);
    }
    const pl = desc.plate;
    const plate = new Mesh(
      new CylinderGeometry(pl.r * vs, pl.r * vs * 0.92, 0.02, 32),
      new MeshStandardMaterial({ color: 0xf4efe6, roughness: 0.35 }),
    );
    plate.position.set((pl.cx + 0.5) * vs, pl.y * vs + 0.01, (pl.cz + 0.5) * vs);
    plate.receiveShadow = plate.castShadow = true;
    this.group.add(plate);
    const rim = new Mesh(
      new CylinderGeometry(pl.r * vs * 0.78, pl.r * vs * 0.78, 0.024, 32),
      new MeshStandardMaterial({ color: 0xe3dccf, roughness: 0.4 }),
    );
    rim.position.copy(plate.position);
    rim.position.y += 0.002;
    this.group.add(rim);

    const cx = (r.x0 + r.w / 2) * vs;
    const cz = (r.z0 + r.d / 2) * vs;
    this.ember = new Mesh(
      new PlaneGeometry(r.w * vs * 0.8, r.d * vs * 0.8),
      new MeshBasicMaterial({ color: 0xff6a1f, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }),
    );
    this.ember.rotation.x = -Math.PI / 2;
    this.ember.position.set(cx, r.top * vs + 0.004, cz);
    this.group.add(this.ember);

    this.light = new PointLight(0xff8a3c, 0.1, 0, 2);
    this.light.position.set(cx, r.top * vs + 0.55, cz);
    this.group.add(this.light);
  }

  /** hot: 0 (nothing on the rock) .. 1. Smoothed by the caller or here per frame. */
  update(dt: number, target: number, time: number): void {
    this.hot += (target - this.hot) * Math.min(1, dt * 4);
    const flicker = 1 + 0.08 * Math.sin(time * 17) * Math.sin(time * 5.3);
    this.light.intensity = (0.08 + 0.7 * this.hot) * flicker;
    (this.ember.material as MeshBasicMaterial).opacity = 0.02 + 0.14 * this.hot * flicker;
  }

  dispose(): void {
    this.statics.dispose();
  }
}
