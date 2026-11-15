import {
  AdditiveBlending,
  ConeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  CircleGeometry,
  type Scene,
} from 'three';

export interface MarkerTarget {
  x: number;
  y: number;
  z: number;
  kind: 'pad' | 'rock' | 'mouth';
}

const RADIUS = { pad: 0.34, rock: 0.62, mouth: 0.95 } as const;

/** Bouncing 3D arrow above a target plus a pulsing outline ring and soft fill (tutorial guidance). */
export class TutorialMarker {
  private readonly group = new Group();
  private readonly arrow: Mesh;
  private readonly ring: Mesh;
  private readonly fill: Mesh;
  private readonly ringMat: MeshBasicMaterial;
  private readonly fillMat: MeshBasicMaterial;

  constructor(scene: Scene) {
    this.group.visible = false;
    this.arrow = new Mesh(new ConeGeometry(0.16, 0.38, 4), new MeshBasicMaterial({ color: 0xffd23f, depthTest: false, transparent: true }));
    this.arrow.rotation.x = Math.PI; // tip points down
    this.arrow.renderOrder = 30;
    this.ringMat = new MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.9, depthWrite: false, blending: AdditiveBlending });
    this.ring = new Mesh(new RingGeometry(0.9, 1, 40), this.ringMat);
    this.ring.renderOrder = 29;
    this.fillMat = new MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.2, depthWrite: false, blending: AdditiveBlending });
    this.fill = new Mesh(new CircleGeometry(0.9, 40), this.fillMat);
    this.fill.renderOrder = 28;
    this.group.add(this.arrow, this.ring, this.fill);
    scene.add(this.group);
  }

  update(time: number, target: MarkerTarget | null): void {
    if (!target) {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;
    this.group.position.set(target.x, target.y, target.z);
    const r = RADIUS[target.kind];
    const pulse = 1 + 0.1 * Math.sin(time * 6);
    const upright = target.kind === 'mouth';
    for (const m of [this.ring, this.fill]) {
      m.rotation.x = upright ? 0 : -Math.PI / 2;
      m.scale.setScalar(r * pulse);
      m.position.y = upright ? 0 : 0.012;
    }
    this.ringMat.opacity = 0.6 + 0.35 * Math.sin(time * 6);
    this.fillMat.opacity = 0.12 + 0.12 * (0.5 + 0.5 * Math.sin(time * 6));
    this.arrow.position.y = (upright ? 1.1 : 0.85) + 0.14 * Math.abs(Math.sin(time * 4)) * 2;
  }

  dispose(): void {
    this.group.removeFromParent();
  }
}
