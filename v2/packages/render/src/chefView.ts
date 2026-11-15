import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';

const SLOT_COLORS = [0xe4572e, 0x29a0b1, 0xf2c14e, 0x7fb069];

/** Placeholder chef: body, head and hat boxes, tinted by slot. */
export class ChefView {
  readonly group = new Group();
  private readonly mats: MeshStandardMaterial[] = [];

  constructor(slot: number) {
    const color = SLOT_COLORS[slot % SLOT_COLORS.length]!;
    const body = new Mesh(new BoxGeometry(0.7, 0.9, 0.5), new MeshStandardMaterial({ color }));
    body.position.y = 0.45;
    const head = new Mesh(new BoxGeometry(0.5, 0.5, 0.5), new MeshStandardMaterial({ color: 0xf1c9a5 }));
    head.position.y = 1.15;
    const hat = new Mesh(new BoxGeometry(0.55, 0.4, 0.55), new MeshStandardMaterial({ color: 0xffffff }));
    hat.position.y = 1.6;
    // Nose + hands on the +z side so the facing direction is readable.
    const nose = new Mesh(new BoxGeometry(0.14, 0.14, 0.2), new MeshStandardMaterial({ color: 0xe0a07c }));
    nose.position.set(0, 1.15, 0.3);
    const hands = new Mesh(new BoxGeometry(0.6, 0.16, 0.16), new MeshStandardMaterial({ color: 0xf1c9a5 }));
    hands.position.set(0, 0.95, 0.33);
    for (const m of [body, head, hat, nose, hands]) {
      this.mats.push(m.material as MeshStandardMaterial);
      m.castShadow = true;
      this.group.add(m);
    }
  }

  /** Fade the chef so it does not hide the table behind it (1 = opaque). */
  setOpacity(o: number): void {
    for (const m of this.mats) {
      const t = o < 0.999;
      if (m.transparent !== t) {
        m.transparent = t;
        m.depthWrite = !t;
        m.needsUpdate = true;
      }
      m.opacity = o;
    }
  }

  /** prev/curr are [x,y,z,yaw] at `offset` in each array. */
  setInterpolated(prev: Float32Array, curr: Float32Array, offset: number, alpha: number): void {
    const l = (i: number) => prev[offset + i]! + (curr[offset + i]! - prev[offset + i]!) * alpha;
    this.group.position.set(l(0), l(1), l(2));
    // Shortest-arc yaw interpolation (yaw wraps at +-PI).
    const a = prev[offset + 3]!;
    let d = curr[offset + 3]! - a;
    if (d > Math.PI) d -= 2 * Math.PI;
    else if (d < -Math.PI) d += 2 * Math.PI;
    this.group.rotation.y = a + d * alpha;
  }
}
