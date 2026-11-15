import { Plane, Raycaster, Vector2, Vector3, type Camera, type Mesh } from 'three';

const FV = 16;
const I16_MAX = 32767;

export interface TableRectM {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  topY: number;
}

const toFv = (v: number): number => Math.max(-I16_MAX, Math.min(I16_MAX, Math.floor(v * FV)));

/** Mouse -> world aim point: food meshes first, then the table-top plane (inside the table), then the floor. */
export class AimPicker {
  private readonly rc = new Raycaster();
  private readonly ndc = new Vector2();
  private readonly hit = new Vector3();

  constructor(private readonly table: TableRectM) {}

  pick(clientX: number, clientY: number, width: number, height: number, camera: Camera, meshes: Mesh[]): [number, number, number] {
    this.ndc.set((clientX / width) * 2 - 1, -(clientY / height) * 2 + 1);
    camera.updateMatrixWorld();
    this.rc.setFromCamera(this.ndc, camera);
    const hits = this.rc.intersectObjects(meshes, false);
    if (hits.length > 0) {
      const p = hits[0]!.point;
      return [toFv(p.x), toFv(p.y), toFv(p.z)];
    }
    const t = this.table;
    if (this.rc.ray.intersectPlane(new Plane(new Vector3(0, 1, 0), -t.topY), this.hit)) {
      if (this.hit.x >= t.x0 && this.hit.x <= t.x1 && this.hit.z >= t.z0 && this.hit.z <= t.z1) {
        return [toFv(this.hit.x), toFv(t.topY), toFv(this.hit.z)];
      }
    }
    if (this.rc.ray.intersectPlane(new Plane(new Vector3(0, 1, 0), 0), this.hit)) {
      return [toFv(this.hit.x), 0, toFv(this.hit.z)];
    }
    return [0, 0, 0];
  }
}

/** Gamepad aim: 0.6 m in front of the chef at table height. */
export function padAim(chefX: number, chefZ: number, fx: number, fz: number, topY: number): [number, number, number] {
  return [toFv(chefX + fx * 0.6), toFv(topY), toFv(chefZ + fz * 0.6)];
}
