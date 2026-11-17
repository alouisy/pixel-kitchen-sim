import type { Mesh, Scene } from 'three';
import { MesherPool } from '../voxel/mesherPool.js';
import { createVoxelMaterial, createRampTexture, type RampMaterial } from '../voxel/foodMaterial.js';
import { VoxelMeshView } from '../voxel/voxelMeshView.js';
import type { MeshData } from '../voxel/types.js';
import type { MeshStandardMaterial } from 'three';

export interface FoodUpsertLike {
  id: number;
  dims: [number, number, number];
  origin: [number, number, number];
  material: Uint8Array;
  doneness: Uint8Array | null;
  char: Uint8Array | null;
}

interface Rec {
  dims: [number, number, number];
  origin: [number, number, number];
  /** Our own copy (the transferred buffers belong to the mesher). */
  material: Uint8Array;
  lastThermalAt: number;
}

/** Owns the food meshes: mesher pool, shared voxel material, per-body bookkeeping used by previews and VFX. */
export class FoodView {
  readonly material: MeshStandardMaterial;
  private readonly pool: MesherPool;
  private readonly view: VoxelMeshView;
  private readonly recs = new Map<number, Rec>();
  private clock = 0;

  constructor(scene: Scene, materials: readonly RampMaterial[], workerFactory: () => Worker, readonly voxelSize = 1 / 16) {
    this.material = createVoxelMaterial(createRampTexture(materials));
    this.pool = new MesherPool(workerFactory);
    this.view = new VoxelMeshView(scene, this.material, voxelSize);
  }

  /** Sim messages: upserts remesh, moves reposition, removals wait until this message's new meshes are ready. */
  apply(upserts: FoodUpsertLike[], moves: Array<{ id: number; origin: [number, number, number] }>, removed: number[]): void {
    const pending: Promise<void>[] = [];
    for (const u of upserts) {
      this.recs.set(u.id, {
        dims: u.dims,
        origin: u.origin,
        material: u.material.slice(),
        lastThermalAt: u.doneness ? this.clock : -1e9,
      });
      const id = u.id;
      pending.push(
        this.pool.request(id, { dims: u.dims, material: u.material, doneness: u.doneness, char: u.char }).then((data: MeshData | null) => {
          const rec = this.recs.get(id);
          if (data && rec) this.view.upsert(id, data, rec.origin);
        }),
      );
    }
    for (const m of moves) {
      const rec = this.recs.get(m.id);
      if (!rec) continue;
      rec.origin = m.origin;
      this.view.setOrigin(m.id, m.origin);
    }
    if (removed.length > 0) {
      const drop = (): void => {
        for (const id of removed) {
          this.recs.delete(id);
          this.view.remove(id);
        }
      };
      if (pending.length > 0) {
        for (const id of removed) this.recs.delete(id);
        void Promise.all(pending).then(() => {
          for (const id of removed) this.view.remove(id);
        });
      } else drop();
    }
  }

  get bodyCount(): number {
    return this.recs.size;
  }

  tick(dt: number): void {
    this.clock += dt;
  }

  meshes(exceptId = -1): Mesh[] {
    return this.view.meshList(exceptId);
  }

  /** Ids of all known bodies with their bbox in food voxels, for VFX emitters. */
  hotBodies(windowS = 2): Array<{ origin: [number, number, number]; dims: [number, number, number] }> {
    const out: Array<{ origin: [number, number, number]; dims: [number, number, number] }> = [];
    for (const r of this.recs.values()) if (this.clock - r.lastThermalAt <= windowS) out.push(r);
    return out;
  }

  /** True when any body (other than `exceptId`) rests on/over the rect's top surface (used to light the hot rock). */
  anyOver(rect: { x0: number; z0: number; w: number; d: number; top: number }, exceptId = -1): boolean {
    for (const [id, r] of this.recs) {
      if (id === exceptId) continue;
      if (r.origin[1] > rect.top || r.origin[1] + r.dims[1] <= rect.top) continue;
      if (r.origin[0] >= rect.x0 + rect.w || r.origin[0] + r.dims[0] <= rect.x0) continue;
      if (r.origin[2] >= rect.z0 + rect.d || r.origin[2] + r.dims[2] <= rect.z0) continue;
      return true;
    }
    return false;
  }

  /** Same rule as the sim's cleaver: solid cell nearest to `aim` (food voxels) within `radius`. Returns world cell coords. */
  nearestCell(aim: [number, number, number], radius: number, exceptId = -1): [number, number, number] | null {
    let best: [number, number, number] | null = null;
    let bestD = radius * radius + 1e-9;
    for (const [id, r] of this.recs) {
      if (id === exceptId) continue;
      const [dx, dy, dz] = r.dims;
      let i = 0;
      for (let z = 0; z < dz; z++)
        for (let y = 0; y < dy; y++)
          for (let x = 0; x < dx; x++, i++) {
            if (r.material[i] === 0) continue;
            const vx = r.origin[0] + x + 0.5 - aim[0];
            const vy = r.origin[1] + y + 0.5 - aim[1];
            const vz = r.origin[2] + z + 0.5 - aim[2];
            const d2 = vx * vx + vy * vy + vz * vz;
            if (d2 < bestD) {
              bestD = d2;
              best = [r.origin[0] + x, r.origin[1] + y, r.origin[2] + z];
            }
          }
    }
    return best;
  }

  dispose(): void {
    this.pool.dispose();
    this.view.dispose();
  }
}
