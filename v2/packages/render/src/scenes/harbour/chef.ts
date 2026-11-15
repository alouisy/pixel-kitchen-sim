import { CylinderGeometry, Group, Mesh, MeshBasicMaterial, RingGeometry } from 'three';
import { Palette, Vox } from './voxel.js';

export const SLOT_COLORS = [0xe4572e, 0x29a0b1, 0xf2c14e, 0x7fb069];
const hex = (n: number): string => `#${(n + 0x1000000).toString(16).slice(1)}`;
const S = 1 / 16;

export interface ChefPose {
  x: number;
  z: number;
  fx: number;
  fz: number;
  carrying: boolean;
  chopping: boolean;
  dashing: boolean;
}

/**
 * Chibi voxel chef built from a handful of meshed parts: legs, torso, head, hat, two arms with hands and a knife.
 * Everything animates procedurally on the client from sim state (walk bob and arm swing, carry pose, chop swing, place flick, happy hop).
 */
export class ChefRig {
  readonly group = new Group();
  private readonly body = new Group();
  private readonly legL: Group;
  private readonly legR: Group;
  private readonly armL: Group;
  private readonly armR: Group;
  private readonly knife: Group;
  readonly handAnchor = new Group();
  private readonly ring: Mesh;
  private px = 0;
  private pz = 0;
  private yaw = 0;
  private phase = 0;
  private speed = 0;
  private flick = 0;
  private hop = 0;
  private chopT = 0;
  private lastChopHit = -10;
  private init = false;

  constructor(slot: number, palette: Palette) {
    const col = hex(SLOT_COLORS[slot % SLOT_COLORS.length]!);
    const skin = '#f1c9a5';
    const white = '#fbfbf6';
    const pants = '#35405a';
    // Legs (pivot at the hip).
    const leg = (): Group => {
      const v = new Vox(4, 6, 4, palette).box(0, 1, 0, 4, 6, 4, pants).box(0, 0, 0, 4, 1, 5, '#2a2f3d');
      const g = new Group();
      const m = v.mesh(S, [2, 6, 2]);
      g.add(m);
      return g;
    };
    this.legL = leg();
    this.legR = leg();
    this.legL.position.set(-0.17, 0.4, 0);
    this.legR.position.set(0.17, 0.4, 0);
    // Torso with a coloured scarf and apron.
    const t = new Vox(12, 8, 7, palette).box(0, 0, 0, 12, 8, 7, white).box(0, 6, 0, 12, 7, 7, col).box(3, 0, 6, 9, 5, 7, '#e9e9e0').box(5, 2, 6, 7, 3, 7, col);
    const torso = t.mesh(S, [6, 0, 3.5]);
    torso.position.set(0, 0.4, 0);
    // Head: face on +z.
    const h = new Vox(10, 9, 9, palette).box(0, 0, 0, 10, 9, 9, skin);
    h.set(2, 4, 8, '#2a1d14').set(7, 4, 8, '#2a1d14').set(3, 2, 8, '#d98c7c').set(4, 2, 8, '#d98c7c').set(5, 2, 8, '#d98c7c').set(6, 2, 8, '#d98c7c');
    h.set(4, 3, 8, '#e0a07c').set(5, 3, 8, '#e0a07c');
    const head = h.mesh(S, [5, 0, 4.5]);
    head.position.set(0, 0.4 + 8 * S, 0);
    // Hat.
    const hv = new Vox(12, 8, 11, palette).box(1, 0, 1, 11, 3, 10, white).box(0, 3, 0, 12, 8, 11, white).box(1, 7, 1, 11, 8, 10, '#f1f1ea');
    const hat = hv.mesh(S, [6, 0, 5.5]);
    hat.position.set(0, 0.4 + 17 * S - 0.02, 0);
    // Arms (pivot at the shoulder).
    const arm = (): Group => {
      const v = new Vox(4, 8, 4, palette).box(0, 2, 0, 4, 8, 4, white).box(0, 0, 0, 4, 2, 4, skin);
      const g = new Group();
      g.add(v.mesh(S, [2, 7, 2]));
      return g;
    };
    this.armL = arm();
    this.armR = arm();
    this.armL.position.set(-0.43, 0.4 + 7 * S, 0);
    this.armR.position.set(0.43, 0.4 + 7 * S, 0);
    // Knife in the right hand.
    const kv = new Vox(2, 9, 4, palette).box(0, 0, 0, 2, 3, 2, '#6b4426').box(0, 3, 0, 1, 9, 4, '#dfe6ea').box(1, 3, 0, 2, 9, 4, '#aab4ba');
    this.knife = new Group();
    const km = kv.mesh(S, [1, 0, 2]);
    km.position.set(0, -0.5, 0.0);
    km.rotation.x = Math.PI / 2;
    km.position.set(0, -0.5, 0.2);
    this.knife.add(km);
    this.knife.visible = false;
    this.armR.add(this.knife);
    this.handAnchor.position.set(0, 0.95, 0.5);
    for (const o of [this.legL, this.legR, torso, head, hat, this.armL, this.armR, this.handAnchor]) this.body.add(o);
    this.group.add(this.body);
    // Slot-colour ring under the feet.
    this.ring = new Mesh(new RingGeometry(0.4, 0.5, 28), new MeshBasicMaterial({ color: SLOT_COLORS[slot % SLOT_COLORS.length], transparent: true, opacity: 0.9, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.02;
    this.group.add(this.ring);
    const shadow = new Mesh(new CylinderGeometry(0.34, 0.34, 0.01, 18), new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18, depthWrite: false }));
    shadow.position.y = 0.012;
    this.group.add(shadow);
  }

  /** Quick place / serve arm flick. */
  triggerFlick(): void {
    this.flick = 0.22;
  }

  /** Happy hop (successful serve). */
  triggerHop(): void {
    this.hop = 0.55;
  }

  /** Called on each ChopHit so the swing lands on the sound. */
  chopHit(time: number): void {
    this.lastChopHit = time;
  }

  update(p: ChefPose, dt: number, time: number): void {
    if (!this.init) {
      this.px = p.x;
      this.pz = p.z;
      this.init = true;
    }
    const k = 1 - Math.exp(-dt * 28);
    const nx = this.px + (p.x - this.px) * k;
    const nz = this.pz + (p.z - this.pz) * k;
    const sp = dt > 0 ? Math.hypot(nx - this.px, nz - this.pz) / dt : 0;
    this.px = nx;
    this.pz = nz;
    this.speed += (sp - this.speed) * (1 - Math.exp(-dt * 14));
    const target = Math.atan2(p.fx, p.fz);
    let d = target - this.yaw;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    this.yaw += d * (1 - Math.exp(-dt * 20));
    this.group.position.set(this.px, 0, this.pz);
    this.group.rotation.y = this.yaw;

    const moving = Math.min(1, this.speed / 3);
    this.phase += dt * (6 + this.speed * 2.2);
    const swing = Math.sin(this.phase) * moving;
    this.legL.rotation.x = swing * 0.8;
    this.legR.rotation.x = -swing * 0.8;
    let hopY = 0;
    if (this.hop > 0) {
      this.hop -= dt;
      const u = 1 - Math.max(0, this.hop) / 0.55;
      hopY = Math.sin(u * Math.PI) * 0.35;
    }
    const bob = Math.abs(Math.sin(this.phase)) * 0.045 * moving;
    this.body.position.y = bob + hopY;
    this.body.rotation.x = p.dashing ? 0.35 : 0;

    let armLx = swing * 0.9;
    let armRx = -swing * 0.9;
    let armRz = 0;
    let armLz = 0;
    this.knife.visible = false;
    if (p.chopping) {
      // Tool swing: raise, slam on the hit, bounce back. Phase locked to the sim's hit every 8 ticks.
      this.chopT += dt;
      const period = 8 / 30;
      const u = ((time - this.lastChopHit) % period + period) % period / period;
      const down = u < 0.25 ? 1 - u / 0.25 : (u - 0.25) / 0.75; // 1 = raised
      armRx = -0.5 - 1.7 * (1 - Math.pow(1 - down, 2)) * 0.9 - 0.3;
      armLx = -1.0;
      this.knife.visible = true;
      this.body.rotation.x = 0.12 + 0.12 * (1 - down);
    } else if (p.carrying) {
      armLx = -1.3 + Math.sin(this.phase) * 0.06 * moving;
      armRx = -1.3 - Math.sin(this.phase) * 0.06 * moving;
      armLz = 0.18;
      armRz = -0.18;
    }
    if (this.flick > 0) {
      this.flick -= dt;
      const f = Math.sin((Math.max(0, this.flick) / 0.22) * Math.PI);
      armRx -= 0.9 * f;
      armLx -= 0.5 * f;
    }
    this.armL.rotation.set(armLx, 0, armLz);
    this.armR.rotation.set(armRx, 0, armRz);
  }

  setRingPulse(on: boolean, time: number): void {
    (this.ring.material as MeshBasicMaterial).opacity = on ? 0.6 + 0.4 * Math.sin(time * 10) : 0.9;
  }
}
