import { BoxGeometry, Color, DynamicDrawUsage, InstancedMesh, Matrix4, MeshBasicMaterial, Quaternion, Vector3, AdditiveBlending, type Scene } from 'three';

const M = new Matrix4();
const V = new Vector3();
const Q = new Quaternion();
const S = new Vector3();
const C = new Color();

export interface BurstOpts {
  color: number;
  /** Horizontal spread speed (m/s). */
  speed?: number;
  /** Initial upward speed (m/s). */
  up?: number;
  /** Seconds. */
  life?: number;
  /** Downward acceleration (m/s^2); negative floats up. */
  gravity?: number;
  /** Random position scatter radius (m). */
  scatter?: number;
}

/** Small instanced-cube particle puffs (crumbs, sparkles, hearts). Ring buffer of `count` cubes. */
export class BurstFx {
  private readonly mesh: InstancedMesh;
  private readonly pos: Float32Array;
  private readonly vel: Float32Array;
  private readonly age: Float32Array;
  private readonly life: Float32Array;
  private readonly grav: Float32Array;
  private next = 0;

  constructor(scene: Scene, private readonly count: number, size: number, additive = false) {
    const mat = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false });
    if (additive) mat.blending = AdditiveBlending;
    this.mesh = new InstancedMesh(new BoxGeometry(size, size, size), mat, count);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.pos = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    this.age = new Float32Array(count).fill(1e9);
    this.life = new Float32Array(count).fill(1);
    this.grav = new Float32Array(count);
    const zero = new Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < count; i++) {
      this.mesh.setMatrixAt(i, zero);
      this.mesh.setColorAt(i, C.set(0xffffff));
    }
    scene.add(this.mesh);
  }

  emit(x: number, y: number, z: number, n: number, o: BurstOpts): void {
    const speed = o.speed ?? 0.6;
    const scatter = o.scatter ?? 0.05;
    for (let k = 0; k < n; k++) {
      const i = this.next;
      this.next = (this.next + 1) % this.count;
      const a = Math.random() * Math.PI * 2;
      const r = Math.random();
      this.pos[i * 3] = x + (Math.random() - 0.5) * 2 * scatter;
      this.pos[i * 3 + 1] = y + (Math.random() - 0.5) * 2 * scatter;
      this.pos[i * 3 + 2] = z + (Math.random() - 0.5) * 2 * scatter;
      this.vel[i * 3] = Math.cos(a) * speed * r;
      this.vel[i * 3 + 1] = (o.up ?? 0.8) * (0.6 + Math.random() * 0.6);
      this.vel[i * 3 + 2] = Math.sin(a) * speed * r;
      this.age[i] = 0;
      this.life[i] = (o.life ?? 0.7) * (0.7 + Math.random() * 0.6);
      this.grav[i] = o.gravity ?? 3;
      this.mesh.setColorAt(i, C.set(o.color));
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt: number): void {
    for (let i = 0; i < this.count; i++) {
      const t = this.age[i]! / this.life[i]!;
      if (t >= 1) {
        S.set(0, 0, 0);
      } else {
        this.age[i] = this.age[i]! + dt;
        this.vel[i * 3 + 1] = this.vel[i * 3 + 1]! - this.grav[i]! * dt;
        this.pos[i * 3] = this.pos[i * 3]! + this.vel[i * 3]! * dt;
        this.pos[i * 3 + 1] = this.pos[i * 3 + 1]! + this.vel[i * 3 + 1]! * dt;
        this.pos[i * 3 + 2] = this.pos[i * 3 + 2]! + this.vel[i * 3 + 2]! * dt;
        const s = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
        S.set(s, s, s);
      }
      V.set(this.pos[i * 3]!, this.pos[i * 3 + 1]!, this.pos[i * 3 + 2]!);
      M.compose(V, Q, S);
      this.mesh.setMatrixAt(i, M);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
