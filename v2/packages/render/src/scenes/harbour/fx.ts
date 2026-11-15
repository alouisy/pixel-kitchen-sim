import { BoxGeometry, Color, DynamicDrawUsage, InstancedMesh, MeshBasicMaterial, Object3D, type Scene } from 'three';

export interface EmitOpts {
  color: number | number[];
  speed?: number;
  up?: number;
  life?: number;
  gravity?: number;
  scatter?: number;
  size?: number;
}

/** Pooled voxel-cube particles: steam, chop bits, confetti, smoke. Purely visual (uses Math.random). */
export class ParticlePool {
  private readonly mesh: InstancedMesh;
  private readonly px: Float32Array;
  private readonly vel: Float32Array;
  private readonly life: Float32Array;
  private readonly maxLife: Float32Array;
  private readonly grav: Float32Array;
  private readonly size: Float32Array;
  private readonly tmp = new Object3D();
  private next = 0;

  constructor(scene: Scene, private readonly max = 400) {
    this.mesh = new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial({ color: 0xffffff }), max);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.px = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max).fill(1);
    this.grav = new Float32Array(max);
    this.size = new Float32Array(max);
    const c = new Color();
    for (let i = 0; i < max; i++) {
      this.mesh.setColorAt(i, c.set(0xffffff));
      this.tmp.scale.setScalar(0);
      this.tmp.updateMatrix();
      this.mesh.setMatrixAt(i, this.tmp.matrix);
    }
    scene.add(this.mesh);
  }

  emit(x: number, y: number, z: number, n: number, o: EmitOpts): void {
    const col = new Color();
    for (let k = 0; k < n; k++) {
      const i = this.next;
      this.next = (this.next + 1) % this.max;
      const sc = o.scatter ?? 0.1;
      this.px[i * 3] = x + (Math.random() - 0.5) * sc;
      this.px[i * 3 + 1] = y;
      this.px[i * 3 + 2] = z + (Math.random() - 0.5) * sc;
      const sp = o.speed ?? 1;
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * sp;
      this.vel[i * 3] = Math.cos(a) * r;
      this.vel[i * 3 + 1] = (o.up ?? 1) * (0.6 + Math.random() * 0.8);
      this.vel[i * 3 + 2] = Math.sin(a) * r;
      this.life[i] = this.maxLife[i] = (o.life ?? 0.7) * (0.7 + Math.random() * 0.6);
      this.grav[i] = o.gravity ?? 4;
      this.size[i] = (o.size ?? 0.05) * (0.7 + Math.random() * 0.6);
      const pick = Array.isArray(o.color) ? o.color[Math.floor(Math.random() * o.color.length)]! : o.color;
      this.mesh.setColorAt(i, col.set(pick));
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt: number): void {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i]! <= 0) continue;
      this.life[i] = this.life[i]! - dt;
      const o = i * 3;
      this.vel[o + 1] = this.vel[o + 1]! - this.grav[i]! * dt;
      this.px[o] = this.px[o]! + this.vel[o]! * dt;
      this.px[o + 1] = this.px[o + 1]! + this.vel[o + 1]! * dt;
      this.px[o + 2] = this.px[o + 2]! + this.vel[o + 2]! * dt;
      const t = Math.max(0, this.life[i]! / this.maxLife[i]!);
      this.tmp.position.set(this.px[o]!, this.px[o + 1]!, this.px[o + 2]!);
      this.tmp.scale.setScalar(this.life[i]! > 0 ? this.size[i]! * (0.4 + t) : 0);
      this.tmp.rotation.set(t * 6, t * 4, 0);
      this.tmp.updateMatrix();
      this.mesh.setMatrixAt(i, this.tmp.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
