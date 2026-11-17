import { Prng, fsqrt } from '@ga/shared';
import { gameTuning as T, materialByIndex } from '@ga/content';
import {
  FLAG_HELD,
  FoodStore,
  cellCount,
  cellsInCone,
  cutBody,
  doneGauge,
  evaluateDish,
  firstMaterial,
  heatStep,
  planeFromAim,
  type FoodBody,
  type HeatSource,
} from '../food/index.js';
import { ASH_INDEX } from '../food/materialTable.js';
import {
  BTN_AUTOAIM,
  BTN_GRAB,
  BTN_SWAP,
  BTN_TILT,
  BTN_TOOL,
  type GameHud,
  type GaugeInfo,
  type HudState,
  type InputFrame,
  type PromptKind,
  type SimEvent,
  type ToolKind,
} from '../types.js';
import {
  AUTOAIM_RANGE_FV,
  CLEAVER_AIM_RADIUS,
  FV_PER_M,
  GIANT_REACH_FV,
  HAND_AHEAD_FV,
  HAND_Y,
  HELD_AHEAD_FV,
  HELD_BOTTOM_Y,
  MAX_BODIES,
  MAX_GROUP,
  MAX_LIFT_CELLS,
  MOUTH_FV,
  MOUTH_M,
  PADS,
  REACH_FV,
  ROCK,
  ROCK_POWER,
  TABLE,
  TORCH_COS_HALF,
  TORCH_LENGTH,
  TORCH_POWER,
  columnBottom,
  inFront,
  inRect,
  overlapsOthers,
  restingOriginY,
} from './layout.js';
import { Game, bellyBand, starsFor } from './game.js';
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
const CLEAVER_COOLDOWN_TICKS = Math.ceil(T.cutting.cooldownSeconds * 30);
const GAUGE_LINGER_TICKS = 45;
const MAX_GAUGES = 6;

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

/** Everything the game adds on top of chef movement: food, tools, carrying, serving, and the Game state machine. */
export class KitchenSim {
  readonly store = new FoodStore();
  readonly game: Game;
  readonly tool: Uint8Array; // 0 cleaver, 1 torch
  readonly tilt: Uint8Array;
  readonly facing: Uint8Array;
  /** Primary held body id per slot (-1 = nothing). */
  readonly held: Int32Array;
  /** Held pile: member count per slot, member ids (primary first) and offsets from the primary's origin. */
  readonly groupN: Uint8Array;
  readonly groupIds: Int32Array;
  readonly groupOff: Int32Array;
  readonly cleaverCd: Uint8Array;
  readonly lastButtons: Uint16Array;
  /** Per-slot torch cone this tick (valid when torchOn). hand xyz + unit dir xyz. */
  readonly torchOn: Uint8Array;
  private readonly torchCone: Float64Array;
  /** Resolved tool aim per slot in food voxels (derived each tick, not part of the hash). */
  private readonly aimOut: Float64Array;
  /** Presentation only: tick at which a torch last hit each body. */
  private readonly torchedAt = new Map<number, number>();
  private nowTick = 0;

  private readonly dirtyMesh = new Set<number>();
  private readonly dirtyMove = new Set<number>();
  private removedIds: number[] = [];
  private settleDirty = false;

  constructor(
    readonly slots: number,
    public rng: Prng,
    gameRng: Prng,
  ) {
    this.game = new Game(gameRng);
    this.tool = new Uint8Array(slots);
    this.tilt = new Uint8Array(slots);
    this.facing = new Uint8Array(slots).fill(DEFAULT_FACING);
    this.held = new Int32Array(slots).fill(-1);
    this.groupN = new Uint8Array(slots);
    this.groupIds = new Int32Array(slots * MAX_GROUP).fill(-1);
    this.groupOff = new Int32Array(slots * MAX_GROUP * 3);
    this.cleaverCd = new Uint8Array(slots);
    this.lastButtons = new Uint16Array(slots);
    this.torchOn = new Uint8Array(slots);
    this.torchCone = new Float64Array(slots * 6);
    this.aimOut = new Float64Array(slots * 3);
  }

  get currentCravingId(): string {
    return this.game.craving().id;
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

  /** Bodies currently carried by `slot` (primary first). */
  heldBodies(slot: number): FoodBody[] {
    const out: FoodBody[] = [];
    for (let i = 0; i < this.groupN[slot]!; i++) {
      const b = this.store.get(this.groupIds[slot * MAX_GROUP + i]!);
      if (b) out.push(b);
    }
    return out;
  }

  /** Remove every body and reset per-chef state (used when a phase starts). */
  resetWorld(): void {
    for (const id of this.store.ids()) this.removeBody(id);
    this.held.fill(-1);
    this.groupN.fill(0);
    this.groupIds.fill(-1);
    this.groupOff.fill(0);
    this.torchOn.fill(0);
    this.lastButtons.fill(0);
    this.tool.fill(0);
    this.tilt.fill(0);
    this.facing.fill(DEFAULT_FACING);
    this.cleaverCd.fill(0);
    this.torchedAt.clear();
    this.settleDirty = false;
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

  // ------------------------------------------------------------------ targeting

  private mouthInRange(px: number, pz: number, fx: number, fz: number): boolean {
    return inFront(MOUTH_FV.x - px, MOUTH_FV.z - pz, fx, fz, GIANT_REACH_FV);
  }

  private rockInRange(px: number, pz: number, fx: number, fz: number): boolean {
    return inFront(ROCK.x0 + ROCK.w / 2 - px, ROCK.z0 + ROCK.d / 2 - pz, fx, fz, REACH_FV);
  }

  /** Nearest free (not carried) body with a solid cell in front of the chef, or -1. */
  private bodyInFront(px: number, pz: number, fx: number, fz: number): number {
    let bestId = -1;
    let bestD = Infinity;
    for (const id of this.store.ids()) {
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
          if (d2 >= bestD || !inFront(vx, vz, fx, fz, REACH_FV)) continue;
          bestD = d2;
          bestId = id;
        }
    }
    return bestId;
  }

  /** Nearest ingredient pad in front of the chef, or -1. The tutorial's first step only offers the mushroom pad. */
  private padInFront(px: number, pz: number, fx: number, fz: number): number {
    const onlyMushroom = this.game.phase === 'tutorial' && this.game.tutorialStep === 0;
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < PADS.length; i++) {
      if (onlyMushroom && PADS[i]!.material !== 'mushroom') continue;
      const vx = PADS[i]!.x + 0.5 - px;
      const vz = PADS[i]!.z + 0.5 - pz;
      const d2 = vx * vx + vz * vz;
      if (d2 < bestD && inFront(vx, vz, fx, fz, REACH_FV)) {
        bestD = d2;
        best = i;
      }
    }
    return best;
  }

  /** Floating prompt for the chef's current context: what the grab button would do, and where (metres). */
  prompt(slot: number, cx: number, cz: number): { kind: PromptKind; x: number; y: number; z: number } | null {
    const phase = this.game.phase;
    if (phase !== 'tutorial' && phase !== 'service') return null;
    const px = cx * FV_PER_M;
    const pz = cz * FV_PER_M;
    const face = this.facing[slot]!;
    const fx = FACE_X[face]!;
    const fz = FACE_Z[face]!;
    if (this.held[slot]! >= 0) {
      if (this.mouthInRange(px, pz, fx, fz)) return { kind: 'serve', x: MOUTH_M.x, y: MOUTH_M.y + 0.9, z: MOUTH_M.z };
      if (this.rockInRange(px, pz, fx, fz)) {
        return { kind: 'place', x: (ROCK.x0 + ROCK.w / 2) / FV_PER_M, y: ROCK.top / FV_PER_M + 0.5, z: (ROCK.z0 + ROCK.d / 2) / FV_PER_M };
      }
      return null;
    }
    const id = this.bodyInFront(px, pz, fx, fz);
    if (id >= 0) {
      const b = this.store.get(id)!;
      return {
        kind: 'take',
        x: (b.origin[0] + b.dims[0] / 2) / FV_PER_M,
        y: (b.origin[1] + b.dims[1]) / FV_PER_M + 0.35,
        z: (b.origin[2] + b.dims[2] / 2) / FV_PER_M,
      };
    }
    const pad = this.padInFront(px, pz, fx, fz);
    if (pad >= 0) {
      const p = PADS[pad]!;
      return { kind: 'take', x: (p.x + 0.5) / FV_PER_M, y: TABLE.top / FV_PER_M + 0.5, z: (p.z + 0.5) / FV_PER_M };
    }
    return null;
  }

  /** Presentation data for gauges: bodies on the rock or recently torched. Ascending ids. */
  gauges(): GaugeInfo[] {
    const out: GaugeInfo[] = [];
    for (const id of this.store.ids()) {
      const b = this.store.get(id)!;
      if (b.flags & FLAG_HELD) continue;
      const mat = materialByIndex(firstMaterial(b));
      if (!mat || !mat.edible) continue;
      const torched = this.nowTick - (this.torchedAt.get(id) ?? -1e9) <= GAUGE_LINGER_TICKS;
      if (!torched && !this.onRock(b)) continue;
      const g = doneGauge(b);
      out.push({
        id,
        doneMarker: g.marker,
        perfectLo: g.perfectLo,
        perfectHi: g.perfectHi,
        burnAt: g.burnAt,
        x: (b.origin[0] + b.dims[0] / 2) / FV_PER_M,
        y: (b.origin[1] + b.dims[1]) / FV_PER_M + 0.12,
        z: (b.origin[2] + b.dims[2] / 2) / FV_PER_M,
      });
      if (out.length >= MAX_GAUGES) break;
    }
    return out;
  }

  /** Everything the DOM HUD needs for chef `slot` standing at (cx, cz) metres. */
  gameHud(slot: number, cx: number, cz: number): GameHud {
    const g = this.game;
    const phase = g.phase;
    const step = g.tutorialStep;
    let target: GameHud['target'] = null;
    if (phase === 'tutorial') {
      if (step === 0) {
        const p = PADS.find((q) => q.material === 'mushroom')!;
        target = { x: (p.x + 0.5) / FV_PER_M, y: TABLE.top / FV_PER_M, z: (p.z + 0.5) / FV_PER_M, kind: 'pad' };
      } else if (step === 1 || step === 2) {
        target = { x: (ROCK.x0 + ROCK.w / 2) / FV_PER_M, y: ROCK.top / FV_PER_M, z: (ROCK.z0 + ROCK.d / 2) / FV_PER_M, kind: 'rock' };
      } else if (step === 3) target = { x: MOUTH_M.x, y: MOUTH_M.y, z: MOUTH_M.z, kind: 'mouth' };
    }
    const best = g.bestDish;
    return {
      phase,
      tutorialStep: step,
      timeLeft: g.timeLeft,
      belly: g.belly,
      band: bellyBand(g.belly),
      mood: g.mood,
      patience: g.patience,
      cravingId: g.craving().id,
      cravingTimeLeft: phase === 'service' ? g.cravingTimeLeft : g.craving().window,
      cravingWindow: g.craving().window,
      score: g.score,
      served: g.served,
      bestDishScore: best.score,
      bestDishCravingId: best.cravingId,
      bestDishTier: best.tier,
      endReason: g.endReason,
      stars: starsFor(g.score),
      target,
      prompt: this.prompt(slot, cx, cz),
      gauges: phase === 'tutorial' || phase === 'service' ? this.gauges() : [],
      aim: [this.aimOut[slot * 3]!, this.aimOut[slot * 3 + 1]!, this.aimOut[slot * 3 + 2]!],
      heldCount: this.groupN[slot]!,
    };
  }

  /** Aim point (food voxels) at the nearest free body in front of the chef: its bbox centre. Null if none. */
  private autoAim(px: number, pz: number, fx: number, fz: number): [number, number, number] | null {
    let best: FoodBody | null = null;
    let bestD = Infinity;
    for (const id of this.store.ids()) {
      const b = this.store.get(id)!;
      if (b.flags & FLAG_HELD) continue;
      const cx = b.origin[0] + b.dims[0] / 2;
      const cz = b.origin[2] + b.dims[2] / 2;
      const vx = cx - px;
      const vz = cz - pz;
      const d2 = vx * vx + vz * vz;
      if (d2 >= bestD || !inFront(vx, vz, fx, fz, AUTOAIM_RANGE_FV + Math.max(b.dims[0], b.dims[2]) / 2)) continue;
      bestD = d2;
      best = b;
    }
    if (!best) return null;
    return [best.origin[0] + best.dims[0] / 2, best.origin[1] + best.dims[1] / 2, best.origin[2] + best.dims[2] / 2];
  }

  private faceToward(slot: number, dx: number, dz: number): void {
    if (dx * dx + dz * dz < 16) return; // closer than 0.25 m: keep facing
    let best = this.facing[slot]!;
    let bestDot = -Infinity;
    for (let f = 0; f < 8; f++) {
      const d = dx * FACE_X[f]! + dz * FACE_Z[f]!;
      if (d > bestDot) {
        bestDot = d;
        best = f;
      }
    }
    this.facing[slot] = best;
  }

  // ------------------------------------------------------------------ per tick

  /** Per-chef input handling. cx/cz in metres. Call once per chef per tick, ascending slot. */
  updateChef(slot: number, input: InputFrame | undefined, cx: number, cz: number, events: SimEvent[]): void {
    const buttons = input ? input.buttons & 0xffff : 0;
    const last = this.lastButtons[slot]!;
    const pressed = buttons & ~last;
    this.lastButtons[slot] = buttons;
    if (this.cleaverCd[slot]! > 0) this.cleaverCd[slot] = this.cleaverCd[slot]! - 1;
    const px = cx * FV_PER_M;
    const pz = cz * FV_PER_M;
    const auto = !input || (buttons & BTN_AUTOAIM) !== 0;

    let stickFacing = -1;
    if (input) {
      const mx = input.move[0];
      const mz = input.move[1];
      const sx = mx >= STICK_THRESHOLD ? 1 : mx <= -STICK_THRESHOLD ? -1 : 0;
      const sz = mz >= STICK_THRESHOLD ? 1 : mz <= -STICK_THRESHOLD ? -1 : 0;
      stickFacing = FACING_FROM_SIGNS[(sx + 1) * 3 + (sz + 1)]!;
      if (stickFacing >= 0) this.facing[slot] = stickFacing;
    }
    // Mouse play: a click turns the chef toward the aimed point (when not already steering).
    if (input && !auto && stickFacing < 0 && pressed & (BTN_GRAB | BTN_TOOL)) {
      this.faceToward(slot, input.aim[0] - px, input.aim[2] - pz);
    }
    const face = this.facing[slot]!;
    const fx = FACE_X[face]!;
    const fz = FACE_Z[face]!;

    // Resolve the tool aim: the mouse point, or the nearest food in front.
    let ax: number;
    let ay: number;
    let az: number;
    if (!auto && input) {
      ax = input.aim[0];
      ay = input.aim[1];
      az = input.aim[2];
    } else {
      const a = this.autoAim(px, pz, fx, fz);
      if (a) [ax, ay, az] = a;
      else {
        ax = px + fx * HELD_AHEAD_FV;
        ay = TABLE.top;
        az = pz + fz * HELD_AHEAD_FV;
      }
    }
    this.aimOut[slot * 3] = ax;
    this.aimOut[slot * 3 + 1] = ay;
    this.aimOut[slot * 3 + 2] = az;

    if (pressed & BTN_SWAP) {
      this.tool[slot] = this.tool[slot] === 1 ? 0 : 1;
      events.push({ kind: 'ToolSwapped', slot, tool: this.toolOf(slot) });
    }
    if (pressed & BTN_TILT) this.tilt[slot] = (this.tilt[slot]! + 1) % 3;
    if (pressed & BTN_GRAB) this.grab(slot, px, pz, fx, fz, events);

    // Held pile follows the chef.
    const heldId = this.held[slot]!;
    if (heldId >= 0) {
      const b = this.store.get(heldId);
      if (b) {
        const ox = Math.floor(px + fx * HELD_AHEAD_FV - b.dims[0] * 0.5 + 0.5);
        const oz = Math.floor(pz + fz * HELD_AHEAD_FV - b.dims[2] * 0.5 + 0.5);
        this.setOrigin(b, ox, HELD_BOTTOM_Y, oz);
        for (let i = 1; i < this.groupN[slot]!; i++) {
          const m = this.store.get(this.groupIds[slot * MAX_GROUP + i]!);
          if (!m) continue;
          const o = (slot * MAX_GROUP + i) * 3;
          this.setOrigin(m, ox + this.groupOff[o]!, HELD_BOTTOM_Y + this.groupOff[o + 1]!, oz + this.groupOff[o + 2]!);
        }
      } else this.clearHeld(slot);
    }

    // Tools.
    const toolHeld = (buttons & BTN_TOOL) !== 0;
    this.torchOn[slot] = 0;
    if (toolHeld && input) {
      if (this.tool[slot] === 0) {
        if (pressed & BTN_TOOL) this.cleaverCut(slot, ax, ay, az, face, this.tilt[slot] as 0 | 1 | 2, events);
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
    this.nowTick = tick;
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
        if (cells.length > 0) {
          sources.push({ bodyId: id, cells, power: TORCH_POWER });
          this.torchedAt.set(id, tick);
        }
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

  private clearHeld(slot: number): void {
    this.held[slot] = -1;
    this.groupN[slot] = 0;
    for (let i = 0; i < MAX_GROUP; i++) this.groupIds[slot * MAX_GROUP + i] = -1;
  }

  // ------------------------------------------------------------------ pile logic

  private static minY(b: FoodBody): number {
    const [dx, dy] = b.dims;
    const m = b.material;
    for (let i = 0; i < m.length; i++) if (m[i] !== 0) return b.origin[1] + (Math.floor(i / dx) % dy);
    return b.origin[1];
  }

  private static solidAt(b: FoodBody, wx: number, wy: number, wz: number): boolean {
    const [dx, dy, dz] = b.dims;
    const lx = wx - b.origin[0];
    const ly = wy - b.origin[1];
    const lz = wz - b.origin[2];
    if (lx < 0 || ly < 0 || lz < 0 || lx >= dx || ly >= dy || lz >= dz) return false;
    return b.material[lx + dx * (ly + dy * lz)] !== 0;
  }

  /** True when a solid cell of `a` shares a face with a solid cell of `b`. */
  private static touches(a: FoodBody, b: FoodBody): boolean {
    for (let ax = 0; ax < 3; ax++) {
      if (a.origin[ax]! - 1 >= b.origin[ax]! + b.dims[ax]! || a.origin[ax]! + a.dims[ax]! + 1 <= b.origin[ax]!) return false;
    }
    const [dx, dy, dz] = a.dims;
    let i = 0;
    for (let z = 0; z < dz; z++)
      for (let y = 0; y < dy; y++)
        for (let x = 0; x < dx; x++, i++) {
          if (a.material[i] === 0) continue;
          const wx = a.origin[0] + x;
          const wy = a.origin[1] + y;
          const wz = a.origin[2] + z;
          if (
            KitchenSim.solidAt(b, wx - 1, wy, wz) || KitchenSim.solidAt(b, wx + 1, wy, wz) ||
            KitchenSim.solidAt(b, wx, wy - 1, wz) || KitchenSim.solidAt(b, wx, wy + 1, wz) ||
            KitchenSim.solidAt(b, wx, wy, wz - 1) || KitchenSim.solidAt(b, wx, wy, wz + 1)
          )
            return true;
        }
    return false;
  }

  /** True when a lowest solid cell of `c` sits directly on a solid cell of `m`. */
  private static restsOn(c: FoodBody, m: FoodBody): boolean {
    const [dx, , dz] = c.dims;
    for (let lz = 0; lz < dz; lz++)
      for (let lx = 0; lx < dx; lx++) {
        const lb = columnBottom(c, lx, lz);
        if (lb >= 0 && KitchenSim.solidAt(m, c.origin[0] + lx, c.origin[1] + lb - 1, c.origin[2] + lz)) return true;
      }
    return false;
  }

  /**
   * The pile that comes along with `primary`: free bodies touching it (transitively) that rest on the same surface (same
   * lowest y) or on top of a pile member. Capped at MAX_LIFT_CELLS cells and MAX_GROUP bodies. Primary first, then ascending ids.
   */
  collectPile(primary: FoodBody): FoodBody[] {
    const pile = [primary];
    let cells = cellCount(primary);
    const baseY = KitchenSim.minY(primary);
    let grew = true;
    while (grew && pile.length < MAX_GROUP) {
      grew = false;
      for (const id of this.store.ids()) {
        if (pile.length >= MAX_GROUP) break;
        const c = this.store.get(id)!;
        if (c.flags & FLAG_HELD || pile.includes(c)) continue;
        const cc = cellCount(c);
        if (cells + cc > MAX_LIFT_CELLS) continue;
        if (!pile.some((m) => KitchenSim.touches(c, m))) continue;
        if (KitchenSim.minY(c) !== baseY && !pile.some((m) => KitchenSim.restsOn(c, m))) continue;
        pile.push(c);
        cells += cc;
        grew = true;
      }
    }
    return pile;
  }

  // ------------------------------------------------------------------ actions

  private grab(slot: number, px: number, pz: number, fx: number, fz: number, events: SimEvent[]): void {
    if (this.held[slot]! >= 0) {
      if (this.mouthInRange(px, pz, fx, fz)) this.serve(slot, events);
      else this.place(slot, px, pz, fx, fz, events);
      return;
    }
    const bestId = this.bodyInFront(px, pz, fx, fz);
    if (bestId >= 0) {
      const b = this.store.get(bestId)!;
      if (cellCount(b) > MAX_LIFT_CELLS) {
        events.push({ kind: 'TooHeavy', slot, bodyId: bestId });
        return;
      }
      this.pickUp(slot, this.collectPile(b), events);
      return;
    }
    const pad = this.padInFront(px, pz, fx, fz);
    if (pad >= 0) {
      if (this.store.size >= MAX_BODIES) {
        events.push({ kind: 'SpawnRefused', slot, reason: 'max_bodies' });
        return;
      }
      const b = spawnAtPad(this.store, pad, this.rng);
      this.dirtyMesh.add(b.id);
      this.pickUp(slot, [b], events);
    }
  }

  private pickUp(slot: number, pile: FoodBody[], events: SimEvent[]): void {
    const primary = pile[0]!;
    this.clearHeld(slot);
    this.held[slot] = primary.id;
    this.groupN[slot] = pile.length;
    for (let i = 0; i < pile.length; i++) {
      const b = pile[i]!;
      b.flags |= FLAG_HELD;
      this.groupIds[slot * MAX_GROUP + i] = b.id;
      const o = (slot * MAX_GROUP + i) * 3;
      this.groupOff[o] = b.origin[0] - primary.origin[0];
      this.groupOff[o + 1] = b.origin[1] - primary.origin[1];
      this.groupOff[o + 2] = b.origin[2] - primary.origin[2];
    }
    this.settleDirty = true;
    events.push({ kind: 'Grabbed', slot, count: pile.length });
  }

  private place(slot: number, px: number, pz: number, fx: number, fz: number, events: SimEvent[]): void {
    const pile = this.heldBodies(slot);
    this.clearHeld(slot);
    if (pile.length === 0) return;
    const primary = pile[0]!;
    // Snap onto the rock when the chef is facing it.
    let sx = 0;
    let sz = 0;
    if (this.rockInRange(px, pz, fx, fz)) {
      sx = Math.round(ROCK.x0 + ROCK.w / 2 - (primary.origin[0] + primary.dims[0] / 2));
      sz = Math.round(ROCK.z0 + ROCK.d / 2 - (primary.origin[2] + primary.dims[2] / 2));
    }
    const order = pile
      .map((b, i) => ({ b, oy: b.origin[1], i }))
      .sort((a, c) => a.oy - c.oy || a.b.id - c.b.id)
      .map((e) => e.b);
    const home = pile.map((b) => [b.origin[0], b.origin[1], b.origin[2]] as [number, number, number]);
    const drop = (dx: number, dz: number): boolean => {
      for (const b of pile) b.flags |= FLAG_HELD;
      pile.forEach((b, i) => this.setOrigin(b, home[i]![0] + dx, HELD_BOTTOM_Y + (home[i]![1] - home[0]![1]), home[i]![2] + dz));
      for (const b of order) {
        b.flags &= ~FLAG_HELD;
        b.calm = 0;
        b.flags &= ~1; // wake
        this.setOrigin(b, b.origin[0], restingOriginY(this.store, b), b.origin[2]);
      }
      return !pile.some((b) => overlapsOthers(this.store, b));
    };
    if (!drop(sx, sz) && !(sx !== 0 || sz !== 0 ? drop(0, 0) : false)) {
      // Refuse: drop the pile at the chef's feet instead.
      const fxo = Math.floor(px - primary.dims[0] * 0.5 + 0.5) - home[0]![0];
      const fzo = Math.floor(pz - primary.dims[2] * 0.5 + 0.5) - home[0]![2];
      drop(fxo, fzo);
    }
    this.settleDirty = true;
    events.push({ kind: 'Placed', slot });
  }

  private serve(slot: number, events: SimEvent[]): void {
    const bodies = this.heldBodies(slot);
    this.clearHeld(slot);
    if (bodies.length === 0) return;
    const craving = this.game.craving();
    const ev = evaluateDish(bodies, craving);
    let edible = 0;
    for (const b of bodies) {
      const m = b.material;
      for (let i = 0; i < m.length; i++) {
        const mi = m[i]!;
        if (mi === 0 || mi === ASH_INDEX) continue;
        if (materialByIndex(mi)?.edible) edible++;
      }
    }
    for (const b of bodies) this.removeBody(b.id);
    const out = this.game.onServe(ev.score, ev.tier, edible, events);
    events.push({
      kind: 'DishServed',
      slot,
      cravingId: craving.id,
      score: ev.score,
      tier: ev.tier,
      highlights: ev.highlights,
      points: out.points,
      timeBonus: out.timeBonus,
      bellyGain: out.bellyGain,
    });
  }

  private cleaverCut(slot: number, ax: number, ay: number, az: number, face: number, tilt: 0 | 1 | 2, events: SimEvent[]): void {
    if (this.cleaverCd[slot]! > 0) return;
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
    if (cellCount(bestBody) < T.cutting.minCutCells) {
      events.push({ kind: 'TooSmallToCut', slot, bodyId: bestBody.id });
      return;
    }
    const plane = planeFromAim(bestCell, face, tilt);
    const r = cutBody(this.store, bestBody, plane, T.cutting.crumbCells);
    if (r.removedId < 0) return;
    this.cleaverCd[slot] = CLEAVER_COOLDOWN_TICKS;
    this.removedIds.push(r.removedId);
    this.dirtyMesh.delete(r.removedId);
    this.dirtyMove.delete(r.removedId);
    events.push({ kind: 'Cut', slot, x: bestCell[0], y: bestCell[1], z: bestCell[2], crumbs: r.crumbs, crumbAt: r.crumbAt });
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
