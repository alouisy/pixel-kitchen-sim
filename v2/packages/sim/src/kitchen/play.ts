import { Prng, fsqrt } from '@ga/shared';
import { cravings } from '@ga/content';
import {
  FLAG_HELD,
  FoodStore,
  cellCount,
  cellsInCone,
  cutBody,
  evaluateDish,
  heatStep,
  planeFromAim,
  type FoodBody,
  type HeatSource,
} from '../food/index.js';
import { BTN_GRAB, BTN_SWAP, BTN_TILT, BTN_TOOL, type HudState, type InputFrame, type SimEvent, type ToolKind } from '../types.js';
import {
  CLEAVER_AIM_RADIUS,
  FV_PER_M,
  HAND_AHEAD_FV,
  HAND_Y,
  HELD_AHEAD_FV,
  HELD_BOTTOM_Y,
  MAX_BODIES,
  MAX_LIFT_CELLS,
  PADS,
  PLATE,
  REACH_FV,
  ROCK,
  ROCK_POWER,
  TORCH_COS_HALF,
  TORCH_LENGTH,
  TORCH_POWER,
  columnBottom,
  columnTop,
  inPlate,
  inRect,
  overlapsOthers,
  restingOriginY,
} from './layout.js';
import { spawnAtPad } from './spawn.js';

const H = 0.7071067811865476;
/** Facing index 0..7 -> horizontal unit vector (x, z); matches planeFromAim's direction table. */
export const FACE_X: readonly number[] = [1, H, 0, -H, -1, -H, 0, H];
export const FACE_Z: readonly number[] = [0, H, 1, H, 0, -H, -1, -H];
/** Chef yaw so local +z points along the facing (precomputed: no atan2 in sim). */
export const FACE_YAW: readonly number[] = [
  1.5707963267948966, 0.7853981633974483, 0, -0.7853981633974483,
  -1.5707963267948966, -2.356194490192345, 3.141592653589793, 2.356194490192345,
];
/** Index [(sx+1)*3 + (sz+1)] -> facing. -1 = no push. */
const FACING_FROM_SIGNS = [5, 4, 3, 6, -1, 2, 7, 0, 1];
const STICK_THRESHOLD = 48;
export const DEFAULT_FACING = 6;
const MAX_SETTLE_PASSES = 8;

export interface FoodUpsertData {
  id: number;
  dims: [number, number, number];
  origin: [number, number, number];
  material: Uint8Array;
  doneness: Uint8Array | null;
  char: Uint8Array | null;
}
export interface FoodDeltaData {
  upserts: FoodUpsertData[];
  moves: Array<{ id: number; origin: [number, number, number] }>;
  removed: number[];
}

/** Everything the Cut & Burn toy adds on top of chef movement. Owned and stepped by SimWorld. */
export class KitchenSim {
  readonly store = new FoodStore();
  cravingIdx = 0;
  readonly tool: Uint8Array; // 0 cleaver, 1 torch
  readonly tilt: Uint8Array;
  readonly facing: Uint8Array;
  readonly held: Int32Array;
  readonly lastButtons: Uint16Array;
  /** Per-slot torch cone this tick (valid when torchOn). hand xyz + unit dir xyz. */
  readonly torchOn: Uint8Array;
  private readonly torchCone: Float64Array;

  private readonly dirtyMesh = new Set<number>();
  private readonly dirtyMove = new Set<number>();
  private removedIds: number[] = [];
  private settleDirty = false;

  constructor(
    readonly slots: number,
    public rng: Prng,
  ) {
    this.tool = new Uint8Array(slots);
    this.tilt = new Uint8Array(slots);
    this.facing = new Uint8Array(slots).fill(DEFAULT_FACING);
    this.held = new Int32Array(slots).fill(-1);
    this.lastButtons = new Uint16Array(slots);
    this.torchOn = new Uint8Array(slots);
    this.torchCone = new Float64Array(slots * 6);
  }

  get currentCravingId(): string {
    return cravings[this.cravingIdx % cravings.length]!.id;
  }

  hud(slot: number): HudState {
    return {
      tool: this.tool[slot] === 1 ? 'torch' : 'cleaver',
      tilt: this.tilt[slot] as 0 | 1 | 2,
      cravingId: this.currentCravingId,
      heldId: this.held[slot]!,
      facing: this.facing[slot]!,
      torchOn: this.torchOn[slot] === 1,
    };
  }

  toolOf(slot: number): ToolKind {
    return this.tool[slot] === 1 ? 'torch' : 'cleaver';
  }

  markAllDirty(): void {
    for (const id of this.store.ids()) this.dirtyMesh.add(id);
  }

  /** Bodies whose mesh/thermal data or position changed since the last drain (ascending ids). */
  drainDelta(): FoodDeltaData {
    const upserts: FoodUpsertData[] = [];
    const moves: FoodDeltaData['moves'] = [];
    for (const id of [...this.dirtyMesh].sort((a, b) => a - b)) {
      const b = this.store.get(id);
      if (!b) continue;
      upserts.push({
        id,
        dims: [b.dims[0], b.dims[1], b.dims[2]],
        origin: [b.origin[0], b.origin[1], b.origin[2]],
        material: b.material.slice(),
        doneness: b.doneness ? b.doneness.slice() : null,
        char: b.char ? b.char.slice() : null,
      });
    }
    for (const id of [...this.dirtyMove].sort((a, b) => a - b)) {
      if (this.dirtyMesh.has(id)) continue;
      const b = this.store.get(id);
      if (b) moves.push({ id, origin: [b.origin[0], b.origin[1], b.origin[2]] });
    }
    const removed = this.removedIds;
    this.dirtyMesh.clear();
    this.dirtyMove.clear();
    this.removedIds = [];
    return { upserts, moves, removed };
  }

  /** Per-chef input handling. cx/cz in metres. Call once per chef per tick, ascending slot. */
  updateChef(slot: number, input: InputFrame | undefined, cx: number, cz: number, events: SimEvent[]): void {
    const buttons = input ? input.buttons & 0xffff : 0;
    const last = this.lastButtons[slot]!;
    const pressed = buttons & ~last;
    this.lastButtons[slot] = buttons;

    if (input) {
      const mx = input.move[0];
      const mz = input.move[1];
      const sx = mx >= STICK_THRESHOLD ? 1 : mx <= -STICK_THRESHOLD ? -1 : 0;
      const sz = mz >= STICK_THRESHOLD ? 1 : mz <= -STICK_THRESHOLD ? -1 : 0;
      const f = FACING_FROM_SIGNS[(sx + 1) * 3 + (sz + 1)]!;
      if (f >= 0) this.facing[slot] = f;
    }
    const face = this.facing[slot]!;
    const px = cx * FV_PER_M;
    const pz = cz * FV_PER_M;
    const fx = FACE_X[face]!;
    const fz = FACE_Z[face]!;

    if (pressed & BTN_SWAP) {
      this.tool[slot] = this.tool[slot] === 1 ? 0 : 1;
      events.push({ kind: 'ToolSwapped', slot, tool: this.toolOf(slot) });
    }
    if (pressed & BTN_TILT) this.tilt[slot] = (this.tilt[slot]! + 1) % 3;
    if (pressed & BTN_GRAB) this.grab(slot, px, pz, fx, fz, events);

    // Held body follows the chef.
    const heldId = this.held[slot]!;
    if (heldId >= 0) {
      const b = this.store.get(heldId);
      if (b) {
        const ox = Math.floor(px + fx * HELD_AHEAD_FV - b.dims[0] * 0.5 + 0.5);
        const oz = Math.floor(pz + fz * HELD_AHEAD_FV - b.dims[2] * 0.5 + 0.5);
        this.setOrigin(b, ox, HELD_BOTTOM_Y, oz);
      } else this.held[slot] = -1;
    }

    // Tools.
    const toolHeld = (buttons & BTN_TOOL) !== 0;
    this.torchOn[slot] = 0;
    if (toolHeld && input) {
      const ax = input.aim[0];
      const ay = input.aim[1];
      const az = input.aim[2];
      if (this.tool[slot] === 0) {
        if (pressed & BTN_TOOL) this.cleaverCut(ax, ay, az, face, this.tilt[slot] as 0 | 1 | 2);
      } else {
        const hx = px + fx * HAND_AHEAD_FV;
        const hz = pz + fz * HAND_AHEAD_FV;
        let dx = ax - hx;
        let dy = ay - HAND_Y;
        let dz = az - hz;
        const len = fsqrt(dx * dx + dy * dy + dz * dz);
        if (len < 1e-6) {
          dx = fx;
          dy = 0;
          dz = fz;
        } else {
          dx /= len;
          dy /= len;
          dz /= len;
        }
        this.torchOn[slot] = 1;
        const o = slot * 6;
        this.torchCone[o] = hx;
        this.torchCone[o + 1] = HAND_Y;
        this.torchCone[o + 2] = hz;
        this.torchCone[o + 3] = dx;
        this.torchCone[o + 4] = dy;
        this.torchCone[o + 5] = dz;
      }
    }
  }

  /** After all chefs: settle falling bodies, then heat on every `heatEvery`-th tick. */
  afterChefs(tick: number, heatEvery: number): void {
    if (this.settleDirty) this.settle();
    if (tick % heatEvery !== 0) return;
    const sources: HeatSource[] = [];
    const ids = this.store.ids();
    for (const id of ids) {
      const b = this.store.get(id)!;
      if (b.flags & FLAG_HELD) continue;
      if (this.onRock(b)) sources.push({ bodyId: id, cells: 'bottom', power: ROCK_POWER });
      for (let s = 0; s < this.slots; s++) {
        if (!this.torchOn[s]) continue;
        const o = s * 6;
        const c = this.torchCone;
        if (!this.coneMayHit(b, c[o]!, c[o + 1]!, c[o + 2]!)) continue;
        const cells = cellsInCone(b, [c[o]!, c[o + 1]!, c[o + 2]!], [c[o + 3]!, c[o + 4]!, c[o + 5]!], TORCH_LENGTH, TORCH_COS_HALF);
        if (cells.length > 0) sources.push({ bodyId: id, cells, power: TORCH_POWER });
      }
    }
    const report = heatStep(this.store, sources);
    for (const id of report.changedBodies) this.dirtyMesh.add(id);
  }

  private coneMayHit(b: FoodBody, hx: number, hy: number, hz: number): boolean {
    // Conservative reject: the bbox must come within the cone length of the apex.
    const [bx, by, bz] = b.dims;
    const cx = Math.max(b.origin[0], Math.min(hx, b.origin[0] + bx));
    const cy = Math.max(b.origin[1], Math.min(hy, b.origin[1] + by));
    const cz = Math.max(b.origin[2], Math.min(hz, b.origin[2] + bz));
    const ex = cx - hx;
    const ey = cy - hy;
    const ez = cz - hz;
    return ex * ex + ey * ey + ez * ez <= (TORCH_LENGTH + 1) * (TORCH_LENGTH + 1);
  }

  /** Any bottom-most solid cell sits at rock-top height inside the rock footprint. */
  onRock(b: FoodBody): boolean {
    const [dx, dy, dz] = b.dims;
    if (b.origin[1] > ROCK.top || b.origin[1] + dy < ROCK.top) return false;
    if (b.origin[0] >= ROCK.x0 + ROCK.w || b.origin[0] + dx <= ROCK.x0) return false;
    if (b.origin[2] >= ROCK.z0 + ROCK.d || b.origin[2] + dz <= ROCK.z0) return false;
    for (let lz = 0; lz < dz; lz++)
      for (let lx = 0; lx < dx; lx++) {
        const lb = columnBottom(b, lx, lz);
        if (lb >= 0 && b.origin[1] + lb === ROCK.top && inRect(b.origin[0] + lx, b.origin[2] + lz, ROCK)) return true;
      }
    return false;
  }

  /** Bodies resting on the plate, directly or stacked on such bodies. Ascending ids. */
  bodiesOnPlate(): FoodBody[] {
    const inSet = new Set<number>();
    const ids = this.store.ids();
    const bodies = ids.map((id) => this.store.get(id)!).filter((b) => !(b.flags & FLAG_HELD));
    for (const b of bodies) {
      const [dx, , dz] = b.dims;
      let hit = false;
      for (let lz = 0; lz < dz && !hit; lz++)
        for (let lx = 0; lx < dx; lx++) {
          const lb = columnBottom(b, lx, lz);
          if (lb >= 0 && b.origin[1] + lb === PLATE.y && inPlate(b.origin[0] + lx, b.origin[2] + lz)) {
            hit = true;
            break;
          }
        }
      if (hit) inSet.add(b.id);
    }
    let grew = true;
    while (grew) {
      grew = false;
      for (const b of bodies) {
        if (inSet.has(b.id)) continue;
        const [dx, , dz] = b.dims;
        let rests = false;
        for (let lz = 0; lz < dz && !rests; lz++)
          for (let lx = 0; lx < dx && !rests; lx++) {
            const lb = columnBottom(b, lx, lz);
            if (lb < 0) continue;
            const wy = b.origin[1] + lb;
            for (const aid of inSet) {
              const a = this.store.get(aid)!;
              if (columnTop(a, b.origin[0] + lx - a.origin[0], b.origin[2] + lz - a.origin[2]) >= 0 &&
                  a.origin[1] + columnTop(a, b.origin[0] + lx - a.origin[0], b.origin[2] + lz - a.origin[2]) === wy) {
                rests = true;
                break;
              }
            }
          }
        if (rests) {
          inSet.add(b.id);
          grew = true;
        }
      }
    }
    return bodies.filter((b) => inSet.has(b.id));
  }

  private setOrigin(b: FoodBody, x: number, y: number, z: number): void {
    if (b.origin[0] === x && b.origin[1] === y && b.origin[2] === z) return;
    b.origin[0] = x;
    b.origin[1] = y;
    b.origin[2] = z;
    this.dirtyMove.add(b.id);
  }

  private removeBody(id: number): void {
    this.store.remove(id);
    this.removedIds.push(id);
    this.dirtyMesh.delete(id);
    this.dirtyMove.delete(id);
    this.settleDirty = true;
  }

  private settle(): void {
    this.settleDirty = false;
    for (let pass = 0; pass < MAX_SETTLE_PASSES; pass++) {
      let moved = false;
      for (const id of this.store.ids()) {
        const b = this.store.get(id)!;
        if (b.flags & FLAG_HELD) continue;
        const y = restingOriginY(this.store, b, true);
        if (y < b.origin[1]) {
          this.setOrigin(b, b.origin[0], y, b.origin[2]);
          moved = true;
        }
      }
      if (!moved) break;
    }
  }

  private grab(slot: number, px: number, pz: number, fx: number, fz: number, events: SimEvent[]): void {
    const heldId = this.held[slot]!;
    if (heldId >= 0) {
      this.place(slot, heldId, px, pz);
      return;
    }
    // (a) nearest liftable body in front of the chef (bodies resting on the plate are for tasting, not lifting).
    const onPlate = new Set(this.bodiesOnPlate().map((b) => b.id));
    let bestId = -1;
    let bestD = Infinity;
    const reach2 = REACH_FV * REACH_FV;
    for (const id of this.store.ids()) {
      if (onPlate.has(id)) continue;
      const b = this.store.get(id)!;
      if (b.flags & FLAG_HELD) continue;
      const [dx, dy, dz] = b.dims;
      for (let z = 0; z < dz; z++)
        for (let x = 0; x < dx; x++) {
          let solid = false;
          for (let y = 0; y < dy; y++)
            if (b.material[x + dx * (y + dy * z)] !== 0) {
              solid = true;
              break;
            }
          if (!solid) continue;
          const vx = b.origin[0] + x + 0.5 - px;
          const vz = b.origin[2] + z + 0.5 - pz;
          const d2 = vx * vx + vz * vz;
          if (d2 > reach2 || d2 >= bestD) continue;
          // within +-70 degrees: dot >= cos(70) * dist; cos(70) ~ 0.342
          const dot = vx * fx + vz * fz;
          if (d2 > 1 && !(dot > 0 && dot * dot >= 0.117 * d2)) continue;
          bestD = d2;
          bestId = id;
        }
    }
    if (bestId >= 0) {
      const b = this.store.get(bestId)!;
      if (cellCount(b) > MAX_LIFT_CELLS) {
        events.push({ kind: 'TooHeavy', slot, bodyId: bestId });
        return;
      }
      b.flags |= FLAG_HELD;
      this.held[slot] = bestId;
      this.settleDirty = true;
      return;
    }
    // (b) ingredient pad.
    let padBest = -1;
    let padD = Infinity;
    for (let i = 0; i < PADS.length; i++) {
      const vx = PADS[i]!.x + 0.5 - px;
      const vz = PADS[i]!.z + 0.5 - pz;
      const d2 = vx * vx + vz * vz;
      if (d2 <= reach2 && d2 < padD) {
        padD = d2;
        padBest = i;
      }
    }
    if (padBest >= 0) {
      if (this.store.size >= MAX_BODIES) {
        events.push({ kind: 'SpawnRefused', slot, reason: 'max_bodies' });
        return;
      }
      const b = spawnAtPad(this.store, padBest, this.rng);
      this.dirtyMesh.add(b.id);
      return;
    }
    // (c) tasting plate.
    const pvx = PLATE.cx + 0.5 - px;
    const pvz = PLATE.cz + 0.5 - pz;
    if (pvx * pvx + pvz * pvz <= reach2) this.taste(slot, events);
  }

  private place(slot: number, heldId: number, px: number, pz: number): void {
    const b = this.store.get(heldId);
    this.held[slot] = -1;
    if (!b) return;
    b.flags &= ~FLAG_HELD;
    b.calm = 0;
    b.flags &= ~1; // wake
    this.settleDirty = true;
    const hx = b.origin[0];
    const hz = b.origin[2];
    this.setOrigin(b, hx, restingOriginY(this.store, b), hz);
    if (overlapsOthers(this.store, b)) {
      // Refuse: drop at the chef's feet instead.
      const fx = Math.floor(px - b.dims[0] * 0.5 + 0.5);
      const fz = Math.floor(pz - b.dims[2] * 0.5 + 0.5);
      this.setOrigin(b, fx, 0, fz);
      this.setOrigin(b, fx, restingOriginY(this.store, b), fz);
    }
  }

  private taste(slot: number, events: SimEvent[]): void {
    const bodies = this.bodiesOnPlate();
    if (bodies.length === 0) {
      events.push({ kind: 'PlateEmpty', slot });
      return;
    }
    const craving = cravings[this.cravingIdx % cravings.length]!;
    const ev = evaluateDish(bodies, craving);
    for (const b of bodies) this.removeBody(b.id);
    this.cravingIdx = (this.cravingIdx + 1) % cravings.length;
    events.push({ kind: 'DishServed', slot, cravingId: craving.id, score: ev.score, tier: ev.tier, highlights: ev.highlights });
  }

  private cleaverCut(ax: number, ay: number, az: number, face: number, tilt: 0 | 1 | 2): void {
    let bestBody: FoodBody | undefined;
    let bestCell: [number, number, number] = [0, 0, 0];
    let bestD = CLEAVER_AIM_RADIUS * CLEAVER_AIM_RADIUS + 1e-9;
    for (const id of this.store.ids()) {
      const b = this.store.get(id)!;
      if (b.flags & FLAG_HELD) continue;
      const [dx, dy, dz] = b.dims;
      // bbox reject
      if (
        ax < b.origin[0] - CLEAVER_AIM_RADIUS || ax > b.origin[0] + dx + CLEAVER_AIM_RADIUS ||
        ay < b.origin[1] - CLEAVER_AIM_RADIUS || ay > b.origin[1] + dy + CLEAVER_AIM_RADIUS ||
        az < b.origin[2] - CLEAVER_AIM_RADIUS || az > b.origin[2] + dz + CLEAVER_AIM_RADIUS
      )
        continue;
      let i = 0;
      for (let z = 0; z < dz; z++)
        for (let y = 0; y < dy; y++)
          for (let x = 0; x < dx; x++, i++) {
            if (b.material[i] === 0) continue;
            const vx = b.origin[0] + x + 0.5 - ax;
            const vy = b.origin[1] + y + 0.5 - ay;
            const vz = b.origin[2] + z + 0.5 - az;
            const d2 = vx * vx + vy * vy + vz * vz;
            if (d2 < bestD) {
              bestD = d2;
              bestBody = b;
              bestCell = [b.origin[0] + x, b.origin[1] + y, b.origin[2] + z];
            }
          }
    }
    if (!bestBody) return;
    const plane = planeFromAim(bestCell, face, tilt);
    const r = cutBody(this.store, bestBody, plane);
    if (r.removedId < 0) return;
    this.removedIds.push(r.removedId);
    this.dirtyMesh.delete(r.removedId);
    this.dirtyMove.delete(r.removedId);
    // Juice: nudge the two halves 1 fv apart along the plane normal's horizontal part (flat cuts stay put). Settling then lets a
    // tilted-cut wedge slide down its face. A nudge that would overlap a neighbour is skipped.
    const nx = tilt === 2 ? 0 : Math.round(FACE_X[face]!);
    const nz = tilt === 2 ? 0 : Math.round(FACE_Z[face]!);
    for (const id of r.created) {
      this.dirtyMesh.add(id);
      const nb = this.store.get(id)!;
      nb.flags &= ~FLAG_HELD;
      if (nx === 0 && nz === 0) continue;
      const first = nb.material.findIndex((m) => m !== 0);
      const [bdx, bdy] = nb.dims;
      const cx = nb.origin[0] + (first % bdx);
      const cy = nb.origin[1] + (Math.floor(first / bdx) % bdy);
      const cz = nb.origin[2] + Math.floor(first / (bdx * bdy));
      const sideA = plane.n[0] * (2 * cx + 1) + plane.n[1] * (2 * cy + 1) + plane.n[2] * (2 * cz + 1) - 2 * plane.d >= 0;
      const sgn = sideA ? 1 : -1;
      const ox = nb.origin[0];
      const oz = nb.origin[2];
      nb.origin[0] = ox + sgn * nx;
      nb.origin[2] = oz + sgn * nz;
      if (overlapsOthers(this.store, nb)) {
        nb.origin[0] = ox;
        nb.origin[2] = oz;
      } else this.dirtyMove.add(id);
    }
    this.settleDirty = true;
  }
}
