import {
  BoxGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PointLight,
  type Object3D,
} from 'three';
import { ChefRig, SLOT_COLORS } from './chef.js';
import { ParticlePool } from './fx.js';
import { HarbourApp } from './harbourApp.js';
import { ItemFactory, type ItemLike } from './items.js';
import { Awning, counterBase, deckChunk, lamppost, lighthouse, rowboat, sailboat, signBoard, stationModel, woodCrate } from './props.js';
import { Palette, Vox, type VoxModel } from './voxel.js';
import { Water } from './water.js';

export interface HarbourLayout {
  stations: Array<{ id: string; def: string; x: number; z: number; enabled: boolean }>;
  queue: Array<[number, number]>;
}

export interface HarbourView {
  phase: string;
  chefs: Array<{
    slot: number;
    x: number;
    z: number;
    fx: number;
    fz: number;
    held: ItemLike | null;
    target: number;
    chopping: boolean;
    dashing: boolean;
  }>;
  stations: Array<{ item: ItemLike | null }>;
  tickets: Array<{ leftTicks: number; totalTicks: number }>;
  timeLeftTicks: number;
}

export interface HarbourEvent {
  kind: string;
  slot?: number;
  station?: number;
}

const TOP = 0.9;

interface Customer {
  group: Group;
  armL: Group;
  armR: Group;
  legL: Group;
  legR: Group;
  slot: number;
  x: number;
  z: number;
  tx: number;
  tz: number;
  hop: number;
  leaving: boolean;
  seed: number;
}

interface Gull {
  group: Group;
  wingL: Mesh;
  wingR: Mesh;
  home: [number, number, number];
  state: 'idle' | 'fly' | 'away' | 'return';
  t: number;
  dir: [number, number];
  peck: number;
}

/** The harbour pier diorama: voxel props, water, stations, chefs, customers and light life (boats bob, a few gulls, awning, steam). */
export class HarbourScene {
  readonly palette = new Palette();
  readonly water = new Water();
  readonly fx: ParticlePool;
  private readonly items: ItemFactory;
  private readonly stationGroups: Group[] = [];
  private readonly stationItems: Array<{ holder: Group; sig: string; obj: Object3D | null; lift: number }> = [];
  private readonly chefs: ChefRig[] = [];
  private readonly heldViews: Array<{ sig: string; obj: Object3D | null }> = [];
  private readonly glows: Mesh[] = [];
  private readonly boats: Array<{ g: Group; base: [number, number, number]; ph: number; amp: number }> = [];
  private readonly awnings: Awning[] = [];
  private readonly bulbs: Mesh[] = [];
  private readonly lampLights: PointLight[] = [];
  private readonly customers: Customer[] = [];
  private readonly gulls: Gull[] = [];
  private readonly arrow = new Group();
  private guide = -1;
  private time = 0;
  private lastSteam = 0;
  private nextCustomerSlot = 0;
  private readonly passIndex: number;
  private readonly fryerIndices: number[] = [];
  private lowTimeFlicker = 0;

  constructor(
    private readonly app: HarbourApp,
    private readonly layout: HarbourLayout,
    models: Record<string, VoxModel>,
    private readonly chefCount: number,
  ) {
    const scene = app.scene;
    this.items = new ItemFactory(this.palette, models);
    this.fx = new ParticlePool(scene);
    scene.add(this.water.mesh);
    this.passIndex = layout.stations.findIndex((s) => s.def === 'pass');
    layout.stations.forEach((s, i) => {
      if (s.def === 'fryer') this.fryerIndices.push(i);
    });
    this.buildPier(scene);
    this.buildKiosk(scene);
    this.buildStations(scene, models);
    this.buildScenery(scene);
    this.buildCreatures(scene);
    for (let i = 0; i < chefCount; i++) {
      const rig = new ChefRig(i, this.palette);
      scene.add(rig.group);
      this.chefs.push(rig);
      this.heldViews.push({ sig: '', obj: null });
      const glow = new Mesh(
        new BoxGeometry(1.04, 0.05, 1.04),
        new MeshBasicMaterial({ color: SLOT_COLORS[i % SLOT_COLORS.length], transparent: true, opacity: 0.0, depthWrite: false }),
      );
      glow.visible = false;
      scene.add(glow);
      this.glows.push(glow);
    }
    // Guide arrow.
    const cone = new Mesh(new ConeGeometry(0.34, 0.7, 4), new MeshStandardMaterial({ color: 0xffd23f, emissive: 0xa07000 }));
    cone.rotation.x = Math.PI;
    this.arrow.add(cone);
    this.arrow.visible = false;
    scene.add(this.arrow);
    this.palette.refresh();
  }

  // ------------------------------------------------------------------ build

  private buildPier(scene: HarbourApp['scene']): void {
    const pal = this.palette;
    const tones: [string, string, string] = ['#a8773f', '#b98748', '#86592d'];
    for (const [x0, w] of [[-7, 64], [1, 64]] as const) {
      const m = deckChunk(pal, w, 64, tones);
      m.position.set(x0, 0, -3.5);
      scene.add(m);
    }
    const tail = deckChunk(pal, 20, 64, tones);
    tail.position.set(9, 0, -3.5);
    scene.add(tail);
    // Kiosk floor: lighter boards.
    const floor = deckChunk(pal, 64, 40, ['#d6ae74', '#cca468', '#b58c58']);
    floor.position.set(-4, 0.012, -2.5);
    scene.add(floor);
    // Pilings.
    const post = new Vox(3, 30, 3, pal).box(0, 0, 0, 3, 30, 3, '#5a3d22').box(0, 25, 0, 3, 28, 3, '#3d6f6a');
    const pm = post.mesh(0.125, [1.5, 28, 1.5]);
    for (let x = -7; x <= 9.5; x += 2.2)
      for (const z of [-3.4, 4.4]) {
        const p = pm.clone();
        p.position.set(x, 0.1, z);
        scene.add(p);
      }
    for (let z = -3.4; z <= 4.4; z += 2.6)
      for (const x of [-6.9, 9.9]) {
        const p = pm.clone();
        p.position.set(x, 0.1, z);
        scene.add(p);
      }
  }

  private buildKiosk(scene: HarbourApp['scene']): void {
    const pal = this.palette;
    const teal = '#3f8796';
    const cream = '#efe8d4';
    // Back wall (two chunks), vertical painted boards.
    for (const x0 of [-4.4, -0.0]) {
      const w = 35;
      const v = new Vox(w, 20, 3, pal);
      for (let x = 0; x < w; x++) for (let y = 0; y < 20; y++) for (let z = 0; z < 3; z++) v.set(x, y, z, Math.floor((x + (x0 < 0 ? 0 : 1)) / 3) % 2 === 0 ? teal : cream);
      v.box(0, 0, 0, w, 2, 3, '#2c5560').box(0, 18, 0, w, 20, 3, '#2c5560');
      const m = v.mesh(0.125, [0, 0, 0]);
      m.position.set(x0 + (x0 < 0 ? 0 : 0.0), 0.0, -2.9);
      scene.add(m);
    }
    // West half-wall with a door gap.
    for (const [z0, n] of [[-2.9, 16], [0.9, 16]] as const) {
      const v = new Vox(3, 12, n, pal);
      for (let z = 0; z < n; z++) for (let y = 0; y < 12; y++) for (let x = 0; x < 3; x++) v.set(x, y, z, Math.floor(z / 3) % 2 === 0 ? teal : cream);
      v.box(0, 10, 0, 3, 12, n, '#2c5560');
      const m = v.mesh(0.125, [0, 0, 0]);
      m.position.set(-4.5, 0, z0);
      scene.add(m);
    }
    // Door frame posts.
    for (const z of [-0.95, 0.95]) {
      const v = new Vox(3, 20, 3, pal).box(0, 0, 0, 3, 20, 3, '#8a5c32');
      const m = v.mesh(0.125, [1.5, 0, 1.5]);
      m.position.set(-4.4, 0, z);
      scene.add(m);
    }
    // Corner posts + serving shelf + awning posts.
    const postV = new Vox(3, 21, 3, pal).box(0, 0, 0, 3, 21, 3, '#8a5c32').box(0, 19, 0, 3, 21, 3, '#6d4524');
    const pm = postV.mesh(0.125, [1.5, 0, 1.5]);
    for (const [x, z] of [[-4.45, -2.9], [4.55, -2.9], [-4.45, 2.85], [4.7, 2.7], [4.7, -0.6]] as const) {
      const p = pm.clone();
      p.position.set(x, 0, z);
      scene.add(p);
    }
    const shelf = new Vox(6, 9, 24, pal).box(0, 0, 0, 6, 8, 24, teal).box(0, 8, 0, 6, 9, 24, '#e2c08a');
    const sm = shelf.mesh(0.1, [0, 0, 0]);
    sm.position.set(4.0, 0, -0.5);
    scene.add(sm);
    // Awnings.
    const north = new Awning(8.8, 1.1);
    north.mesh.position.set(0, 2.35, -2.3);
    north.mesh.rotation.x = -Math.PI / 2 + 0.45;
    scene.add(north.mesh);
    this.awnings.push(north);
    const east = new Awning(3.4, 1.0);
    east.mesh.position.set(5.15, 2.2, 1.05);
    east.mesh.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);
    east.mesh.rotation.order = 'YXZ';
    east.mesh.rotation.set(-Math.PI / 2 + 0.0, 0, 0);
    east.mesh.rotation.z = 0;
    east.mesh.rotation.x = -Math.PI / 2;
    east.mesh.rotation.y = 0;
    east.mesh.rotation.z = -Math.PI / 2;
    east.mesh.rotation.x = -Math.PI / 2 + 0.0;
    scene.add(east.mesh);
    this.awnings.push(east);
    // Sign on poles above the back wall.
    const sign = signBoard('Frites du Port', 3.6, 1.0);
    sign.position.set(0, 3.15, -2.75);
    scene.add(sign);
    for (const x of [-1.7, 1.7]) {
      const v = new Vox(2, 8, 2, pal).box(0, 0, 0, 2, 8, 2, '#6d4524');
      const m = v.mesh(0.125, [1, 0, 1]);
      m.position.set(x, 2.35, -2.8);
      scene.add(m);
    }
  }

  private buildStations(scene: HarbourApp['scene'], models: Record<string, VoxModel>): void {
    const pal = this.palette;
    const gold = (h: string): string => h;
    this.layout.stations.forEach((s) => {
      const g = new Group();
      g.position.set(s.x, 0, s.z);
      let lift = 0;
      const addBase = (body?: string): void => {
        const b = counterBase(pal, body);
        g.add(b);
      };
      switch (s.def) {
        case 'bin': {
          const m = stationModel(models, pal, 'stations/trash_bin', 1 / 14, gold);
          if (m) g.add(m);
          break;
        }
        case 'fryer': {
          addBase('#5d6b74');
          const m = stationModel(models, pal, 'stations/fryer', 1 / 20, gold);
          if (m) {
            m.position.y = TOP;
            g.add(m);
          }
          lift = 0.28;
          break;
        }
        case 'board': {
          addBase();
          const m = stationModel(models, pal, 'stations/cutting_board', 1 / 22, gold);
          if (m) {
            m.position.y = TOP;
            g.add(m);
          }
          lift = 0.04;
          break;
        }
        case 'plates': {
          addBase();
          const m = stationModel(models, pal, 'stations/plate_stack', 1 / 22, gold);
          if (m) {
            m.position.y = TOP;
            g.add(m);
          }
          break;
        }
        case 'crate': {
          addBase();
          const c = woodCrate(pal);
          c.position.y = TOP;
          g.add(c);
          const pot = stationModel(models, pal, 'items/potato', 1 / 22, (h) => (h === '#d7ccc8' ? '#cfa86a' : h === '#8d6e63' ? '#6e4a2e' : h));
          if (pot) {
            for (const [dx, dz, dy, ry] of [[-0.15, -0.1, 0.12, 0.3], [0.17, 0.05, 0.12, 1.2], [0, 0.18, 0.12, 2.1], [0.02, -0.02, 0.3, 0.7]] as const) {
              const p = pot.clone();
              p.position.set(dx, TOP + dy, dz);
              p.rotation.y = ry;
              g.add(p);
            }
          }
          break;
        }
        case 'pass': {
          addBase('#d9473a');
          const bell = new Vox(6, 4, 6, pal).box(0, 0, 0, 6, 1, 6, '#b8862b').box(1, 1, 1, 5, 3, 5, '#e8b73e').box(2, 3, 2, 4, 4, 4, '#f6d36a');
          const bm = bell.mesh(0.05, [3, 0, 3]);
          bm.position.set(0.1, TOP, -0.3);
          g.add(bm);
          // Painted order mat.
          const mat = new Mesh(new BoxGeometry(0.7, 0.02, 0.7), new MeshStandardMaterial({ color: 0xfff0c0 }));
          mat.position.y = TOP + 0.01;
          g.add(mat);
          break;
        }
        default:
          addBase();
      }
      scene.add(g);
      this.stationGroups.push(g);
      const holder = new Group();
      holder.position.set(s.x, TOP + lift, s.z);
      scene.add(holder);
      this.stationItems.push({ holder, sig: '', obj: null, lift });
    });
  }

  private buildScenery(scene: HarbourApp['scene']): void {
    const pal = this.palette;
    const light = lighthouse(pal);
    light.position.set(17, 0, -38);
    scene.add(light);
    const sail = sailboat(pal, '#2f5f9e', '#e9eff5');
    sail.position.set(7, -0.15, -7.5);
    sail.rotation.y = 0.25;
    scene.add(sail);
    this.boats.push({ g: sail, base: [7, -0.15, -7.5], ph: 0, amp: 1 });
    const sail2 = sailboat(pal, '#d9473a', '#f5f5f0');
    sail2.position.set(-13, -0.15, -13);
    sail2.rotation.y = -0.4;
    sail2.scale.setScalar(0.8);
    scene.add(sail2);
    this.boats.push({ g: sail2, base: [-13, -0.15, -13], ph: 1.9, amp: 0.8 });
    const row = rowboat(pal);
    row.position.set(-6.4, -0.1, 5.3);
    row.rotation.y = 0.5;
    scene.add(row);
    this.boats.push({ g: row, base: [-6.4, -0.1, 5.3], ph: 3.1, amp: 1.2 });
    // Lamps.
    for (const [x, z] of [[-6.6, -1.2], [9.0, -2.4], [9.0, 3.4]] as const) {
      const l = lamppost(pal);
      l.group.position.set(x, 0, z);
      scene.add(l.group);
      this.bulbs.push(l.bulb);
    }
    const pl = new PointLight(0xffd9a0, 0, 7, 2);
    pl.position.set(8.8, 3.2, 3.2);
    scene.add(pl);
    this.lampLights.push(pl);
    // Crates and barrels at the pier edge.
    for (const [x, z, s, ry] of [[-6.2, -2.6, 1.0, 0.1], [-5.3, -2.9, 0.8, 0.5], [-6.1, -2.4, 0.7, 1.0]] as const) {
      const c = woodCrate(pal);
      c.scale.multiplyScalar(s * 1.3);
      c.position.set(x, s === 0.7 ? 0.5 : 0, z);
      c.rotation.y = ry;
      scene.add(c);
    }
    const barrel = new Mesh(new CylinderGeometry(0.32, 0.3, 0.7, 10), new MeshStandardMaterial({ color: 0x7a4a22, roughness: 0.9 }));
    barrel.position.set(-6.4, 0.35, 0.5);
    barrel.castShadow = true;
    scene.add(barrel);
    // Bollards.
    for (const [x, z] of [[-6.8, 1.2], [-6.8, 3.4], [9.3, -1], [3.0, 4.2]] as const) {
      const b = new Mesh(new CylinderGeometry(0.12, 0.15, 0.35, 8), new MeshStandardMaterial({ color: 0x2e3a45 }));
      b.position.set(x, 0.18, z);
      scene.add(b);
    }
  }

  private buildCreatures(scene: HarbourApp['scene']): void {
    const pal = this.palette;
    // Gulls: body, head, beak, two wings.
    const spots: Array<[number, number, number]> = [[-6.9, 0.35, -3.0], [9.4, 0.35, -2.2], [6.6, 0.35, -3.2]];
    for (const home of spots) {
      const g = new Group();
      const body = new Vox(6, 4, 9, pal).box(0, 0, 0, 6, 4, 9, '#f6f6f2').box(0, 3, 0, 6, 4, 4, '#b9c3c9');
      const bm = body.mesh(0.06, [3, 0, 4.5]);
      g.add(bm);
      const head = new Vox(4, 4, 4, pal).box(0, 0, 0, 4, 4, 4, '#f9f9f6').set(0, 2, 3, '#222').set(3, 2, 3, '#222').box(1, 1, 4, 3, 2, 6, '#f2a93b');
      const hm = head.mesh(0.06, [2, 0, 2]);
      hm.position.set(0, 0.2, 0.28);
      g.add(hm);
      const wing = (side: number): Mesh => {
        const w = new Vox(10, 1, 6, pal).box(0, 0, 0, 10, 1, 6, '#c8d1d6').box(7, 0, 0, 10, 1, 6, '#3a4650');
        const m = w.mesh(0.06, [side > 0 ? 0 : 10, 0, 3]);
        m.position.set(side * 0.18, 0.2, 0);
        g.add(m);
        return m;
      };
      const wl = wing(-1);
      const wr = wing(1);
      wl.rotation.z = 0.15;
      wr.rotation.z = -0.15;
      g.position.set(home[0], home[1], home[2]);
      g.rotation.y = Math.random() * 6;
      scene.add(g);
      this.gulls.push({ group: g, wingL: wl, wingR: wr, home, state: 'idle', t: Math.random() * 5, dir: [1, 0], peck: 0 });
    }
    // Customer queue.
    for (let i = 0; i < Math.min(3, this.layout.queue.length); i++) this.spawnCustomer(scene, i, false);
  }

  private spawnCustomer(scene: HarbourApp['scene'], slot: number, walkIn: boolean): void {
    const pal = this.palette;
    const shirts = ['#e07a5f', '#81b29a', '#f2cc8f', '#6d8fd1', '#c27ba0', '#9acd6a'];
    const skins = ['#f1c9a5', '#d9a679', '#a9714b', '#f7d9bd'];
    const n = this.nextCustomerSlot++;
    const shirt = shirts[n % shirts.length]!;
    const skin = skins[(n * 3) % skins.length]!;
    const g = new Group();
    const mk = (v: Vox, pivot: [number, number, number]): Group => {
      const holder = new Group();
      holder.add(v.mesh(1 / 16, pivot));
      return holder;
    };
    const legL = mk(new Vox(4, 6, 4, pal).box(0, 0, 0, 4, 6, 4, '#4a4e69'), [2, 6, 2]);
    const legR = mk(new Vox(4, 6, 4, pal).box(0, 0, 0, 4, 6, 4, '#4a4e69'), [2, 6, 2]);
    legL.position.set(-0.15, 0.38, 0);
    legR.position.set(0.15, 0.38, 0);
    const torso = new Vox(11, 8, 6, pal).box(0, 0, 0, 11, 8, 6, shirt).mesh(1 / 16, [5.5, 0, 3]);
    torso.position.y = 0.38;
    const head = new Vox(9, 9, 8, pal).box(0, 0, 0, 9, 9, 8, skin);
    head.set(2, 4, 7, '#2a1d14').set(6, 4, 7, '#2a1d14').box(3, 2, 7, 6, 3, 8, '#d98c7c').box(0, 7, 0, 9, 9, 8, ['#3a2a1e', '#d8a24a', '#222', '#a8532b'][n % 4]!);
    const hm = head.mesh(1 / 16, [4.5, 0, 4]);
    hm.position.y = 0.38 + 0.5;
    const armL = mk(new Vox(3, 8, 3, pal).box(0, 2, 0, 3, 8, 3, shirt).box(0, 0, 0, 3, 2, 3, skin), [1.5, 7, 1.5]);
    const armR = mk(new Vox(3, 8, 3, pal).box(0, 2, 0, 3, 8, 3, shirt).box(0, 0, 0, 3, 2, 3, skin), [1.5, 7, 1.5]);
    armL.position.set(-0.4, 0.38 + 0.44, 0);
    armR.position.set(0.4, 0.38 + 0.44, 0);
    for (const o of [legL, legR, torso, hm, armL, armR]) g.add(o);
    const q = this.layout.queue[slot]!;
    const sx = walkIn ? q[0] + 3 : q[0];
    const c: Customer = { group: g, armL, armR, legL, legR, slot, x: sx, z: q[1], tx: q[0], tz: q[1], hop: 0, leaving: false, seed: n * 1.7 };
    g.position.set(c.x, 0, c.z);
    g.rotation.y = -Math.PI / 2;
    scene.add(g);
    this.customers.push(c);
  }

  // ------------------------------------------------------------------ API

  /** World position above station `i` (for HUD rings and prompts). */
  anchor(i: number, height = 1.5): { x: number; y: number; z: number } {
    const s = this.layout.stations[i]!;
    return { x: s.x, y: height, z: s.z };
  }

  setGuide(stationIndex: number): void {
    this.guide = stationIndex;
  }

  /** Impulse reactions to sim events. */
  onEvent(ev: HarbourEvent, view: HarbourView | null): void {
    const chef = ev.slot !== undefined ? this.chefs[ev.slot] : undefined;
    switch (ev.kind) {
      case 'ChopHit': {
        chef?.chopHit(this.time);
        const s = ev.station !== undefined ? this.layout.stations[ev.station] : undefined;
        if (s) this.fx.emit(s.x, TOP + 0.12, s.z, 6, { color: [0xd9b779, 0xf0e2b0, 0xcfa86a], speed: 0.9, up: 1.8, life: 0.55, gravity: 7, scatter: 0.2, size: 0.045 });
        break;
      }
      case 'Grabbed':
      case 'Placed':
      case 'Plated':
      case 'Trashed':
        chef?.triggerFlick();
        break;
      case 'Served': {
        chef?.triggerHop();
        chef?.triggerFlick();
        const p = this.layout.stations[this.passIndex]!;
        this.fx.emit(p.x + 0.6, 1.3, p.z, 36, { color: [0xff5d73, 0xffd23f, 0x6fd36f, 0x4cc9f0, 0xffffff], speed: 2.2, up: 4, life: 1.1, gravity: 7, scatter: 0.4, size: 0.07 });
        const front = this.customers.filter((c) => !c.leaving).sort((a, b) => a.slot - b.slot)[0];
        if (front) {
          front.hop = 0.9;
          front.leaving = true;
          for (const c of this.customers) if (!c.leaving && c.slot > front.slot) {
            c.slot--;
            const q = this.layout.queue[c.slot]!;
            c.tx = q[0];
            c.tz = q[1];
          }
          this.spawnCustomer(this.app.scene, Math.min(2, this.layout.queue.length - 1), true);
        }
        break;
      }
      case 'Burnt': {
        const s = ev.station !== undefined ? this.layout.stations[ev.station] : undefined;
        if (s) this.fx.emit(s.x, TOP + 0.4, s.z, 18, { color: [0x2a2a2a, 0x444444, 0x666666], speed: 0.4, up: 1.4, life: 1.2, gravity: -0.3, scatter: 0.2, size: 0.1 });
        break;
      }
      case 'TicketNew':
        break;
      default:
        break;
    }
    void view;
  }

  update(view: HarbourView, dt: number, time: number): void {
    this.time = time;
    this.water.update(time);
    for (const b of this.boats) {
      b.g.position.y = b.base[1] + Math.sin(time * 1.1 + b.ph) * 0.07 * b.amp;
      b.g.rotation.z = Math.sin(time * 0.9 + b.ph) * 0.035 * b.amp;
      b.g.rotation.x = Math.sin(time * 0.7 + b.ph * 2) * 0.02 * b.amp;
    }
    for (const a of this.awnings) a.update(time);
    // Lamp flicker toward the end of the run.
    const late = view.phase === 'playing' && view.timeLeftTicks < 30 * 30;
    this.lowTimeFlicker = late ? 1 : 0;
    for (const b of this.bulbs) {
      const m = b.material as MeshBasicMaterial;
      const f = late ? 0.55 + 0.45 * Math.abs(Math.sin(time * 23 + b.position.x) * Math.sin(time * 7.3)) : 1;
      m.color.setRGB(1 * f, 0.9 * f, 0.63 * f);
    }
    for (const l of this.lampLights) l.intensity = (late ? 1.2 : 0.6) * (this.lowTimeFlicker ? 0.7 + 0.3 * Math.sin(time * 31) : 1);

    // Chefs, held items, target glow.
    this.chefs.forEach((r, i) => (r.group.visible = i < view.chefs.length));
    let cx = 0;
    let cz = 0;
    view.chefs.forEach((c, i) => {
      const rig = this.chefs[i];
      if (!rig) return;
      rig.update({ x: c.x, z: c.z, fx: c.fx, fz: c.fz, carrying: !!c.held && !c.chopping, chopping: c.chopping, dashing: c.dashing }, dt, time);
      cx += c.x;
      cz += c.z;
      const hv = this.heldViews[i]!;
      const sig = c.held ? this.items.signature(c.held) : '';
      if (sig !== hv.sig) {
        if (hv.obj) rig.handAnchor.remove(hv.obj);
        hv.obj = c.held ? this.items.build(c.held) : null;
        if (hv.obj) rig.handAnchor.add(hv.obj);
        hv.sig = sig;
      }
      const glow = this.glows[i]!;
      if (c.target >= 0 && view.phase !== 'ended') {
        const s = this.layout.stations[c.target]!;
        glow.visible = true;
        glow.position.set(s.x, 0.93 + i * 0.002, s.z);
        (glow.material as MeshBasicMaterial).opacity = 0.28 + 0.18 * Math.sin(time * 6 + i);
      } else glow.visible = false;
    });
    const n = Math.max(1, view.chefs.length);
    this.app.mode = 'play';
    this.centroid.x = cx / n;
    this.centroid.z = cz / n;

    // Station items.
    view.stations.forEach((s, i) => {
      const si = this.stationItems[i]!;
      const sig = s.item ? this.items.signature(s.item) : '';
      if (sig !== si.sig) {
        if (si.obj) si.holder.remove(si.obj);
        si.obj = s.item ? this.items.build(s.item) : null;
        if (si.obj) si.holder.add(si.obj);
        si.sig = sig;
      }
    });
    // Steam over frying food.
    this.lastSteam += dt;
    if (this.lastSteam > 0.09) {
      this.lastSteam = 0;
      for (const fi of this.fryerIndices) {
        const it = view.stations[fi]?.item;
        const st = this.layout.stations[fi]!;
        if (it && (it.state === 'cooking' || it.state === 'cooked' || it.state === 'burning')) {
          this.fx.emit(st.x, TOP + 0.55, st.z, 1, { color: it.state === 'burning' ? 0x8a8a8a : 0xffffff, speed: 0.12, up: 0.6, life: 1.1, gravity: -0.15, scatter: 0.25, size: 0.07 });
        }
      }
    }
    this.updateCustomers(view, dt, time);
    this.updateGulls(view, dt, time);
    this.updateArrow(time);
    this.fx.update(dt);
    this.palette.flush();
  }

  readonly centroid = { x: 0, z: 0 };

  private updateArrow(time: number): void {
    if (this.guide < 0) {
      this.arrow.visible = false;
      return;
    }
    const s = this.layout.stations[this.guide]!;
    this.arrow.visible = true;
    this.arrow.position.set(s.x, 1.95 + Math.abs(Math.sin(time * 4)) * 0.25, s.z);
    this.arrow.rotation.y = time * 2;
  }

  private updateCustomers(view: HarbourView, dt: number, time: number): void {
    let urgency = 1;
    for (const t of view.tickets) urgency = Math.min(urgency, t.leftTicks / Math.max(1, t.totalTicks));
    if (view.tickets.length === 0) urgency = 1;
    for (let i = this.customers.length - 1; i >= 0; i--) {
      const c = this.customers[i]!;
      const dx = c.tx - c.x;
      const dz = c.tz - c.z;
      let walking = false;
      if (c.leaving) {
        c.hop -= dt;
        if (c.hop <= 0) {
          c.x += dt * 2.2;
          c.group.rotation.y += (Math.PI / 2 - c.group.rotation.y) * Math.min(1, dt * 8);
          walking = true;
          if (c.x > 11) {
            this.app.scene.remove(c.group);
            this.customers.splice(i, 1);
            continue;
          }
        }
      } else if (Math.hypot(dx, dz) > 0.05) {
        const d = Math.hypot(dx, dz);
        const step = Math.min(d, dt * 2.0);
        c.x += (dx / d) * step;
        c.z += (dz / d) * step;
        c.group.rotation.y = Math.atan2(dx, dz);
        walking = true;
      } else c.group.rotation.y += (-Math.PI / 2 - c.group.rotation.y) * Math.min(1, dt * 8);
      const front = !c.leaving && c.slot === 0;
      let y = 0;
      if (c.leaving && c.hop > 0) y = Math.abs(Math.sin((1 - c.hop / 0.9) * Math.PI * 2)) * 0.28;
      const sway = Math.sin(time * 1.3 + c.seed) * 0.02;
      c.group.position.set(c.x, y, c.z);
      c.group.rotation.z = sway;
      let armL = 0;
      let armR = 0;
      let legL = 0;
      let legR = 0;
      if (walking) {
        const p = time * 9 + c.seed;
        legL = Math.sin(p) * 0.7;
        legR = -legL;
        armL = -legL * 0.8;
        armR = -armL;
      } else if (c.leaving && c.hop > 0) {
        armL = armR = -2.6; // arms up
      } else if (front && urgency < 0.15) {
        armL = -1.15;
        armR = -1.15;
        legL = Math.max(0, Math.sin(time * 14)) * 0.5;
        c.armL.rotation.z = 0.9;
        c.armR.rotation.z = -0.9;
      } else if (front && urgency < 0.35) {
        legL = Math.max(0, Math.sin(time * 9)) * 0.45;
      }
      if (!(front && urgency < 0.15)) {
        c.armL.rotation.z = 0;
        c.armR.rotation.z = 0;
      }
      c.armL.rotation.x = armL;
      c.armR.rotation.x = armR;
      c.legL.rotation.x = legL;
      c.legR.rotation.x = legR;
    }
  }

  private updateGulls(view: HarbourView, dt: number, time: number): void {
    for (const g of this.gulls) {
      const grp = g.group;
      g.t += dt;
      const near = view.chefs.find((c) => Math.hypot(c.x - g.home[0], c.z - g.home[2]) < 2.0);
      switch (g.state) {
        case 'idle': {
          g.peck = Math.max(0, Math.sin(time * 3 + g.home[0]) - 0.6);
          grp.rotation.x = g.peck * 0.9;
          grp.position.y = g.home[1];
          g.wingL.rotation.z = 0.15;
          g.wingR.rotation.z = -0.15;
          if (near) {
            g.state = 'fly';
            g.t = 0;
            const dx = g.home[0] - near.x;
            const dz = g.home[2] - near.z;
            const d = Math.hypot(dx, dz) || 1;
            g.dir = [dx / d, dz / d];
            grp.rotation.y = Math.atan2(g.dir[0], g.dir[1]);
          }
          break;
        }
        case 'fly': {
          grp.rotation.x = 0;
          const t = g.t;
          grp.position.set(g.home[0] + g.dir[0] * t * 5, g.home[1] + t * 3.2 - 0.2 * t * t, g.home[2] + g.dir[1] * t * 5);
          const flap = Math.sin(time * 30) * 0.9;
          g.wingL.rotation.z = flap;
          g.wingR.rotation.z = -flap;
          if (t > 3.2) {
            g.state = 'away';
            g.t = 0;
            grp.visible = false;
          }
          break;
        }
        case 'away':
          if (g.t > 9) {
            g.state = 'return';
            g.t = 0;
            grp.visible = true;
          }
          break;
        case 'return': {
          const u = Math.min(1, g.t / 2.4);
          const fromX = g.home[0] - g.dir[0] * 9;
          const fromZ = g.home[2] - g.dir[1] * 9;
          grp.position.set(fromX + (g.home[0] - fromX) * u, g.home[1] + (1 - u) * 3, fromZ + (g.home[2] - fromZ) * u);
          grp.rotation.y = Math.atan2(-g.dir[0], -g.dir[1]);
          const flap = Math.sin(time * 26) * 0.8 * (1 - u * 0.7);
          g.wingL.rotation.z = flap;
          g.wingR.rotation.z = -flap;
          if (u >= 1) g.state = 'idle';
          break;
        }
      }
    }
  }
}

export type { CircleGeometry };
