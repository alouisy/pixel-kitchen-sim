import { Group, Mesh, MathUtils, type BufferGeometry, type MeshStandardMaterial, type Scene, type Vector3Like } from 'three';
import { meshVolume } from '../voxel/greedyMesher.js';
import { createRampTexture, createVoxelMaterial, type RampMaterial } from '../voxel/foodMaterial.js';
import { toBufferGeometry } from '../voxel/voxelMeshView.js';
import { BurstFx } from './burstFx.js';

export type Reaction = 'perfect' | 'great' | 'okay' | 'yuck';
const REACTION_S = 1.5;
/** Voxel edge of the Giant's procedural volumes, metres. */
const VS = 0.1;

const M = { skin: 1, shell: 2, shellDark: 3, shellLight: 4, white: 5, black: 6, mouth: 7, tongue: 8 } as const;
const PALETTE: RampMaterial[] = [
  [M.skin, '#d9bf8c'],
  [M.shell, '#5e8c3c'],
  [M.shellDark, '#3f6b2b'],
  [M.shellLight, '#92b856'],
  [M.white, '#f4f4ee'],
  [M.black, '#15110f'],
  [M.mouth, '#3a1418'],
  [M.tongue, '#c4566b'],
].map(([index, c]) => ({ index: index as number, colors: { raw: c as string, cooked: c as string, charred: c as string } }));

/** A solid box of one palette colour as a voxel mesh, centred on its own origin. Size in metres. */
function boxGeometry(w: number, h: number, d: number, mat: number): BufferGeometry {
  const dims: [number, number, number] = [Math.max(1, Math.round(w / VS)), Math.max(1, Math.round(h / VS)), Math.max(1, Math.round(d / VS))];
  const material = new Uint8Array(dims[0] * dims[1] * dims[2]).fill(mat);
  const g = toBufferGeometry(meshVolume({ dims, material }));
  g.scale(VS, VS, VS);
  g.translate((-dims[0] * VS) / 2, (-dims[1] * VS) / 2, (-dims[2] * VS) / 2);
  return g;
}

/**
 * Mossback, the placeholder Giant: a big friendly voxel tortoise head with its shell behind, built from a handful of boxes
 * through the greedy mesher. +z faces the kitchen. The mouth (jaw) opens when a chef carrying food comes close, and a short
 * reaction plays after each dish (perfect: bounce + squint + hearts, great: nod, okay: slow chew, yuck: head shake + green flash).
 */
export class GiantView {
  readonly group = new Group();
  private readonly material: MeshStandardMaterial;
  private readonly head = new Group();
  private readonly upper = new Group();
  private readonly jaw = new Group();
  private readonly lids: Mesh[] = [];
  private readonly pupils: Group[] = [];
  private readonly shell = new Group();
  private readonly hearts: BurstFx;
  private jawOpen = 0;
  private reaction: Reaction | null = null;
  private reactionT = 0;
  private hangry = false;

  /** `anchor`: floor position (metres) of the Giant's centre. `mouth`: world mouth point (metres). */
  constructor(
    scene: Scene,
    private readonly anchor: Vector3Like,
    private readonly mouth: Vector3Like,
  ) {
    this.material = createVoxelMaterial(createRampTexture(PALETTE));
    this.material.customProgramCacheKey = () => 'ga-giant-v1';
    this.group.position.set(anchor.x, 0, anchor.z);
    this.hearts = new BurstFx(scene, 60, 0.13);

    const add = (parent: Group, w: number, h: number, d: number, mat: number, x: number, y: number, z: number): Mesh => {
      const mesh = new Mesh(boxGeometry(w, h, d, mat), this.material);
      mesh.position.set(x, y, z);
      mesh.castShadow = mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };

    // Shell: stepped dome of moss plates behind the head.
    add(this.shell, 6.0, 0.9, 4.4, M.shellDark, 0, 0.95, -3.7);
    add(this.shell, 5.2, 0.8, 3.7, M.shell, 0, 1.8, -3.7);
    add(this.shell, 4.0, 0.7, 2.9, M.shell, 0, 2.55, -3.7);
    add(this.shell, 2.6, 0.5, 1.9, M.shellLight, 0, 3.15, -3.7);
    for (const [x, z] of [[-1.5, -2.7], [1.5, -2.7], [-1.5, -4.7], [1.5, -4.7], [0, -3.7]] as const) add(this.shell, 1.1, 0.12, 0.9, M.shellLight, x, 2.28, z);
    this.group.add(this.shell);

    // Body parts that stay put: neck and front legs.
    add(this.group, 2.2, 1.4, 1.6, M.skin, 0, 0.7, -1.4);
    add(this.group, 0.9, 0.8, 1.0, M.skin, -1.9, 0.4, -0.2);
    add(this.group, 0.9, 0.8, 1.0, M.skin, 1.9, 0.4, -0.2);

    // Head (animated as one group, pivot at the neck). The upper head tilts back and the jaw drops about the same hinge, so the
    // open mouth (dark cavity + tongue) is visible from the high camera.
    this.upper.position.set(0, 0.9, -0.9);
    add(this.upper, 3.0, 1.1, 2.2, M.skin, 0, 0.55, 0.9); // skull: y 0.9..2.0, z -1.1..1.1 in head space
    add(this.upper, 2.8, 0.07, 0.06, M.mouth, 0, 0.03, 2.0); // mouth seam
    add(this.upper, 0.2, 0.2, 0.08, M.black, -0.35, 0.35, 2.02);
    add(this.upper, 0.2, 0.2, 0.08, M.black, 0.35, 0.35, 2.02);
    this.jaw.position.set(0, 0.9, -0.9);
    add(this.jaw, 2.6, 0.5, 1.9, M.skin, 0, -0.25, 0.95);
    add(this.jaw, 2.4, 0.1, 1.7, M.mouth, 0, 0.0, 0.95);
    add(this.jaw, 1.8, 0.08, 1.2, M.tongue, 0, 0.06, 0.8);
    this.head.add(this.upper, this.jaw);
    for (const sx of [-1, 1]) {
      const eye = new Group();
      eye.position.set(sx * 0.85, 0.85, 1.9);
      add(eye, 0.8, 0.8, 0.35, M.white, 0, 0, 0.05);
      const pupil = new Group();
      pupil.position.z = 0.26;
      add(pupil, 0.4, 0.4, 0.1, M.black, 0, 0, 0);
      eye.add(pupil);
      const lid = add(eye, 0.86, 0.43, 0.4, M.skin, 0, 0.215, 0.05);
      lid.scale.y = 0.001;
      this.lids.push(lid);
      this.pupils.push(pupil);
      this.upper.add(eye);
    }
    this.group.add(this.head);
    scene.add(this.group);
  }

  /** Play a reaction to a served dish. */
  react(r: Reaction): void {
    this.reaction = r;
    this.reactionT = 0;
    if (r === 'perfect') {
      for (let i = 0; i < 14; i++) {
        this.hearts.emit(this.anchor.x + (Math.random() - 0.5) * 2.2, 2.3, this.anchor.z + 0.6, 1, {
          color: 0xff3b5c, speed: 0.25, up: 1.1, life: 1.4, gravity: -0.15, scatter: 0.15,
        });
      }
    }
  }

  setHangry(h: boolean): void {
    this.hangry = h;
  }

  /** `chef`: world position; `chefHolding`: carrying food (opens the mouth when close). */
  update(dt: number, time: number, chef: Vector3Like, chefHolding: boolean): void {
    const mouthD = Math.hypot(chef.x - this.mouth.x, chef.z - this.mouth.z);
    let jawTarget = chefHolding && mouthD < 2.0 ? 0.8 : 0;
    let squint = 0;
    let headY = 0.03 * Math.sin(time * 1.6);
    let rotX = 0;
    let rotY = 0;
    let flash = 0;

    if (this.reaction) {
      this.reactionT += dt;
      const t = this.reactionT;
      const k = Math.max(0, 1 - t / REACTION_S);
      switch (this.reaction) {
        case 'perfect':
          headY += Math.abs(Math.sin(t * Math.PI * 3)) * 0.28 * k;
          squint = Math.sin(Math.min(1, t / REACTION_S) * Math.PI);
          jawTarget = Math.max(jawTarget, 0.2 * k);
          break;
        case 'great':
          rotX = 0.22 * Math.sin(t * Math.PI * 4) * k;
          break;
        case 'okay':
          jawTarget = 0.18 + 0.18 * Math.sin(t * Math.PI * 4);
          break;
        case 'yuck':
          rotY = 0.32 * Math.sin(t * Math.PI * 8) * k;
          flash = k;
          break;
      }
      if (t >= REACTION_S) this.reaction = null;
    }
    if (this.hangry) rotY += 0.1 * Math.sin(time * 11);

    this.jawOpen += (jawTarget - this.jawOpen) * Math.min(1, dt * 12);
    this.jaw.rotation.x = this.jawOpen * 0.6;
    this.upper.rotation.x = -this.jawOpen * 0.5;
    this.head.position.y = headY;
    this.head.rotation.x = rotX;
    this.head.rotation.y = rotY;

    // Eyes follow the chef.
    const ex = MathUtils.clamp((chef.x - this.anchor.x) * 0.1, -0.16, 0.16);
    const ey = MathUtils.clamp((0.9 - 1.75) * 0.05 + (chef.z - this.anchor.z) * -0.01, -0.14, 0.1);
    for (const p of this.pupils) p.position.set(ex, ey, 0.26);
    for (const l of this.lids) l.scale.y = Math.max(0.001, squint * 0.9);

    // Tint: green flash on yuck, red glow when hangry.
    const red = this.hangry ? 0.12 + 0.08 * Math.sin(time * 8) : 0;
    this.material.emissive.setRGB(red + flash * 0.05, flash * 0.55, flash * 0.1);
    this.hearts.update(dt);
  }

  dispose(): void {
    this.group.removeFromParent();
  }
}
