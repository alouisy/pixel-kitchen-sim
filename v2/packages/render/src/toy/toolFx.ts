import {
  AdditiveBlending,
  BoxGeometry,
  DoubleSide,
  DynamicDrawUsage,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  Vector3,
  type Scene,
} from 'three';

const H = Math.SQRT1_2;
/** Facing index -> horizontal (x, z). Mirrors the sim's table (and planeFromAim's direction order). */
export const FACING_DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [H, H], [0, 1], [-H, H], [-1, 0], [-H, -H], [0, -1], [H, -H],
];

const UP_Z = new Vector3(0, 0, 1);

/** Translucent sheet showing the cleaver's cut plane through the aimed cell (tilt 0 vertical, 1 = 45 degrees, 2 flat). */
export class CleaverPreview {
  private readonly mesh: Mesh;
  private readonly q = new Quaternion();
  private readonly n = new Vector3();

  constructor(scene: Scene, color: number, private readonly voxelSize = 1 / 16) {
    this.mesh = new Mesh(
      new PlaneGeometry(0.9, 0.9),
      new MeshBasicMaterial({ color, transparent: true, opacity: 0.25, side: DoubleSide, depthWrite: false }),
    );
    this.mesh.visible = false;
    this.mesh.renderOrder = 5;
    scene.add(this.mesh);
  }

  /** `cell` = world food-voxel coords of the aimed solid cell, or null to hide. */
  update(visible: boolean, cell: [number, number, number] | null, facing: number, tilt: number): void {
    if (!visible || !cell) {
      this.mesh.visible = false;
      return;
    }
    const f = FACING_DIRS[facing & 7]!;
    if (tilt === 2) this.n.set(0, 1, 0);
    else if (tilt === 1) this.n.set(f[0], 1, f[1]);
    else this.n.set(f[0], 0, f[1]);
    this.n.normalize();
    this.q.setFromUnitVectors(UP_Z, this.n);
    this.mesh.quaternion.copy(this.q);
    const vs = this.voxelSize;
    this.mesh.position.set((cell[0] + 0.5) * vs, (cell[1] + 0.5) * vs, (cell[2] + 0.5) * vs);
    this.mesh.visible = true;
  }
}

interface Particles {
  mesh: InstancedMesh;
  pos: Float32Array;
  vel: Float32Array;
  age: Float32Array;
  life: Float32Array;
  next: number;
}

function makeParticles(scene: Scene, count: number, size: number, color: number, opacity: number, additive: boolean): Particles {
  const mat = new MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
  if (additive) mat.blending = AdditiveBlending;
  const mesh = new InstancedMesh(new BoxGeometry(size, size, size), mat, count);
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.frustumCulled = false;
  const zero = new Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < count; i++) mesh.setMatrixAt(i, zero);
  scene.add(mesh);
  return {
    mesh,
    pos: new Float32Array(count * 3),
    vel: new Float32Array(count * 3),
    age: new Float32Array(count).fill(1e9),
    life: new Float32Array(count).fill(1),
    next: 0,
  };
}

const tmpM = new Matrix4();
const tmpV = new Vector3();
const tmpQ = new Quaternion();
const tmpS = new Vector3();

function writeParticles(p: Particles, scaleFn: (t: number) => number): void {
  const n = p.age.length;
  for (let i = 0; i < n; i++) {
    const t = p.age[i]! / p.life[i]!;
    if (t >= 1) tmpS.set(0, 0, 0);
    else {
      const s = scaleFn(t);
      tmpS.set(s, s, s);
    }
    tmpV.set(p.pos[i * 3]!, p.pos[i * 3 + 1]!, p.pos[i * 3 + 2]!);
    tmpM.compose(tmpV, tmpQ, tmpS);
    p.mesh.setMatrixAt(i, tmpM);
  }
  p.mesh.instanceMatrix.needsUpdate = true;
}

/** Orange additive particle cone (<= 300 instanced cubes) from the hand toward the aim while the torch is held. */
export class TorchFx {
  private readonly p: Particles;
  private acc = 0;
  private readonly dir = new Vector3();
  private readonly side1 = new Vector3();
  private readonly side2 = new Vector3();

  constructor(scene: Scene, private readonly lengthM = 22 / 16, private readonly halfAngle = 0.4363) {
    this.p = makeParticles(scene, 300, 0.035, 0xff8a2a, 0.9, true);
  }

  /** hand/aim in metres. */
  update(dt: number, active: boolean, hand: Vector3, aim: Vector3): void {
    const p = this.p;
    const n = p.age.length;
    this.dir.copy(aim).sub(hand);
    if (this.dir.lengthSq() < 1e-8) this.dir.set(0, 0, 1);
    this.dir.normalize();
    this.side1.set(-this.dir.z, 0, this.dir.x);
    if (this.side1.lengthSq() < 1e-6) this.side1.set(1, 0, 0);
    this.side1.normalize();
    this.side2.crossVectors(this.dir, this.side1).normalize();
    if (active) {
      this.acc += dt * 220;
      while (this.acc >= 1) {
        this.acc -= 1;
        const i = p.next;
        p.next = (p.next + 1) % n;
        const ang = Math.random() * this.halfAngle;
        const rot = Math.random() * Math.PI * 2;
        const sp = this.lengthM * (0.9 + Math.random() * 0.5) / 0.35;
        const a = Math.tan(ang);
        tmpV.copy(this.dir).addScaledVector(this.side1, Math.cos(rot) * a).addScaledVector(this.side2, Math.sin(rot) * a).normalize();
        p.pos[i * 3] = hand.x;
        p.pos[i * 3 + 1] = hand.y;
        p.pos[i * 3 + 2] = hand.z;
        p.vel[i * 3] = tmpV.x * sp;
        p.vel[i * 3 + 1] = tmpV.y * sp;
        p.vel[i * 3 + 2] = tmpV.z * sp;
        p.age[i] = 0;
        p.life[i] = 0.3 + Math.random() * 0.1;
      }
    } else this.acc = 0;
    for (let i = 0; i < n; i++) {
      if (p.age[i]! >= p.life[i]!) continue;
      p.age[i] = p.age[i]! + dt;
      p.pos[i * 3] = p.pos[i * 3]! + p.vel[i * 3]! * dt;
      p.pos[i * 3 + 1] = p.pos[i * 3 + 1]! + p.vel[i * 3 + 1]! * dt + 0.2 * dt; // flames drift up a little
      p.pos[i * 3 + 2] = p.pos[i * 3 + 2]! + p.vel[i * 3 + 2]! * dt;
    }
    writeParticles(p, (t) => 1.6 - 1.4 * t);
  }
}

/** Rising white translucent cubes (<= 400) above hot bodies. */
export class SteamFx {
  private readonly p: Particles;
  private acc = 0;

  constructor(scene: Scene, private readonly voxelSize = 1 / 16) {
    this.p = makeParticles(scene, 400, 0.035, 0xffffff, 0.3, false);
  }

  update(dt: number, emitters: ReadonlyArray<{ origin: [number, number, number]; dims: [number, number, number] }>): void {
    const p = this.p;
    const n = p.age.length;
    if (emitters.length > 0) {
      this.acc += dt * Math.min(60, 12 * emitters.length);
      while (this.acc >= 1) {
        this.acc -= 1;
        const e = emitters[Math.floor(Math.random() * emitters.length)]!;
        const i = p.next;
        p.next = (p.next + 1) % n;
        const vs = this.voxelSize;
        p.pos[i * 3] = (e.origin[0] + Math.random() * e.dims[0]) * vs;
        p.pos[i * 3 + 1] = (e.origin[1] + e.dims[1]) * vs;
        p.pos[i * 3 + 2] = (e.origin[2] + Math.random() * e.dims[2]) * vs;
        p.vel[i * 3] = (Math.random() - 0.5) * 0.06;
        p.vel[i * 3 + 1] = 0.25 + Math.random() * 0.2;
        p.vel[i * 3 + 2] = (Math.random() - 0.5) * 0.06;
        p.age[i] = 0;
        p.life[i] = 1.2 + Math.random() * 0.8;
      }
    } else this.acc = 0;
    for (let i = 0; i < n; i++) {
      if (p.age[i]! >= p.life[i]!) continue;
      p.age[i] = p.age[i]! + dt;
      p.pos[i * 3] = p.pos[i * 3]! + p.vel[i * 3]! * dt;
      p.pos[i * 3 + 1] = p.pos[i * 3 + 1]! + p.vel[i * 3 + 1]! * dt;
      p.pos[i * 3 + 2] = p.pos[i * 3 + 2]! + p.vel[i * 3 + 2]! * dt;
    }
    writeParticles(p, (t) => 0.6 + 1.4 * t * (1 - t) * 2);
  }
}
