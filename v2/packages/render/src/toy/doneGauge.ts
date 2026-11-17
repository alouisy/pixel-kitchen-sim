import {
  CircleGeometry,
  ConeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  type Camera,
  type Scene,
} from 'three';

/** Structural copy of the sim's GaugeInfo (render has no sim dependency). Positions in metres. */
export interface GaugeLike {
  id: number;
  doneMarker: number;
  perfectLo: number;
  perfectHi: number;
  burnAt: number;
  x: number;
  y: number;
  z: number;
}

const WIDTH = 0.85;
const HEIGHT = 0.12;
const SEG_COLORS = [0xdcc89a, 0x4fd04a, 0xf08a24, 0x1a1512] as const;
const MAX = 6;

interface Slot {
  group: Group;
  segs: Mesh[];
  marker: Group;
  glow: Mesh;
}

function mat(color: number, opacity = 1): MeshBasicMaterial {
  return new MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false, depthWrite: false });
}

/** Billboarded doneness bars above food on the rock / under the torch: beige raw, green perfect, orange overcooked, black burnt. */
export class DoneGauges {
  private readonly slots: Slot[] = [];
  private readonly q = new Quaternion();

  constructor(scene: Scene) {
    const unit = new PlaneGeometry(1, 1);
    for (let i = 0; i < MAX; i++) {
      const group = new Group();
      group.visible = false;
      group.renderOrder = 20;
      const border = new Mesh(unit, mat(0x120d0a, 0.9));
      border.scale.set(WIDTH + 0.05, HEIGHT + 0.05, 1);
      border.renderOrder = 20;
      group.add(border);
      const segs = SEG_COLORS.map((c, k) => {
        const m = new Mesh(unit, mat(c));
        m.renderOrder = 21 + k;
        group.add(m);
        return m;
      });
      const glow = new Mesh(new CircleGeometry(0.2, 20), mat(0x7dff6a, 0));
      glow.renderOrder = 19;
      group.add(glow);
      const marker = new Group();
      const stem = new Mesh(unit, mat(0xffffff));
      stem.scale.set(0.028, HEIGHT + 0.1, 1);
      stem.renderOrder = 26;
      const tip = new Mesh(new ConeGeometry(0.05, 0.08, 3), mat(0xffffff));
      tip.rotation.z = Math.PI;
      tip.position.y = HEIGHT / 2 + 0.1;
      tip.renderOrder = 26;
      marker.add(stem, tip);
      marker.position.z = 0.001;
      group.add(marker);
      scene.add(group);
      this.slots.push({ group, segs, marker, glow });
    }
  }

  update(gauges: readonly GaugeLike[], camera: Camera, time: number): void {
    camera.getWorldQuaternion(this.q);
    for (let i = 0; i < MAX; i++) {
      const s = this.slots[i]!;
      const g = gauges[i];
      if (!g) {
        s.group.visible = false;
        continue;
      }
      s.group.visible = true;
      s.group.position.set(g.x, g.y, g.z);
      s.group.quaternion.copy(this.q);
      const hi = Math.max(g.perfectHi, g.perfectLo + 1);
      const burn = Math.max(g.burnAt, hi + 1);
      const edges = [0, g.perfectLo, hi, burn, 255];
      for (let k = 0; k < 4; k++) {
        const a = edges[k]! / 255;
        const b = edges[k + 1]! / 255;
        const seg = s.segs[k]!;
        seg.scale.set((b - a) * WIDTH, HEIGHT, 1);
        seg.position.set((a + b) / 2 * WIDTH - WIDTH / 2, 0, 0.0005 * (k + 1));
      }
      const inBand = g.doneMarker >= g.perfectLo && g.doneMarker <= g.perfectHi;
      const pulse = inBand ? 1 + 0.25 * Math.sin(time * 14) : 1;
      s.segs[1]!.scale.y = HEIGHT * pulse;
      (s.glow.material as MeshBasicMaterial).opacity = inBand ? 0.35 + 0.15 * Math.sin(time * 14) : 0;
      s.glow.position.set(((g.perfectLo + hi) / 2 / 255) * WIDTH - WIDTH / 2, 0, -0.001);
      s.glow.scale.set(2.2, 0.8, 1);
      s.marker.position.x = (Math.min(255, g.doneMarker) / 255) * WIDTH - WIDTH / 2;
    }
  }

  dispose(): void {
    for (const s of this.slots) s.group.removeFromParent();
  }
}
