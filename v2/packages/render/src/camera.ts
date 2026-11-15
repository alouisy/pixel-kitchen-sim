import { PerspectiveCamera } from 'three';

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

/** "Diorama Follow" defaults (docs/v2/08 §2.1). Critically damped spring, omega = 9. */
export const DIORAMA = { fov: 42, distance: 7.5, pitchDeg: 48, omega: 9 } as const;

export class DioramaCamera {
  readonly camera = new PerspectiveCamera(DIORAMA.fov, 1, 0.1, 200);
  private readonly pos = { x: 0, y: 0, z: 0 };
  private readonly vel = { x: 0, y: 0, z: 0 };
  private initialised = false;
  private readonly offsetY = DIORAMA.distance * Math.sin((DIORAMA.pitchDeg * Math.PI) / 180);
  private readonly offsetZ = DIORAMA.distance * Math.cos((DIORAMA.pitchDeg * Math.PI) / 180);

  update(target: Vec3Like, dt: number): void {
    if (!this.initialised) {
      this.pos.x = target.x;
      this.pos.y = target.y;
      this.pos.z = target.z;
      this.initialised = true;
    }
    const w = DIORAMA.omega;
    for (const k of ['x', 'y', 'z'] as const) {
      // Exact critically damped spring step (semi-implicit form, stable for any dt).
      const x = this.pos[k] - target[k];
      const v = this.vel[k];
      const e = Math.exp(-w * dt);
      const tmp = (v + w * x) * dt;
      this.pos[k] = target[k] + (x + tmp) * e;
      this.vel[k] = (v - w * tmp) * e;
    }
    this.camera.position.set(this.pos.x, this.pos.y + this.offsetY, this.pos.z + this.offsetZ);
    this.camera.lookAt(this.pos.x, this.pos.y, this.pos.z);
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
