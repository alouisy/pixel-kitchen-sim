import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';

const SLOT_COLORS = [0xe4572e, 0x29a0b1, 0xf2c14e, 0x7fb069];

/** Placeholder chef: body, head and hat boxes, tinted by slot. */
export class ChefView {
  readonly group = new Group();

  constructor(slot: number) {
    const color = SLOT_COLORS[slot % SLOT_COLORS.length]!;
    const body = new Mesh(new BoxGeometry(0.7, 0.9, 0.5), new MeshStandardMaterial({ color }));
    body.position.y = 0.45;
    const head = new Mesh(new BoxGeometry(0.5, 0.5, 0.5), new MeshStandardMaterial({ color: 0xf1c9a5 }));
    head.position.y = 1.15;
    const hat = new Mesh(new BoxGeometry(0.55, 0.4, 0.55), new MeshStandardMaterial({ color: 0xffffff }));
    hat.position.y = 1.6;
    for (const m of [body, head, hat]) {
      m.castShadow = true;
      this.group.add(m);
    }
  }

  /** prev/curr are [x,y,z,yaw] at `offset` in each array. */
  setInterpolated(prev: Float32Array, curr: Float32Array, offset: number, alpha: number): void {
    const l = (i: number) => prev[offset + i]! + (curr[offset + i]! - prev[offset + i]!) * alpha;
    this.group.position.set(l(0), l(1), l(2));
    this.group.rotation.y = l(3);
  }
}
