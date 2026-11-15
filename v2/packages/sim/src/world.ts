import { addComponents, addEntity, createWorld, query } from 'bitecs';
import { HEAT_EVERY_N_TICKS, Hasher64, Prng, SIM_DT, clamp, fsqrt } from '@ga/shared';
import { createComponents, type Components } from './components.js';
import type { GameMode, HudState, InputFrame, SimEvent } from './types.js';
import { bodyHash } from './food/body.js';
import { KitchenSim, FACE_YAW, type FoodDeltaData } from './kitchen/play.js';
import { CHEF_RADIUS_M, SPAWN_M, TABLE, FV_PER_M } from './kitchen/layout.js';

export const MAX_SPEED = 4.2; // m/s, docs/v2/04 §2
export const ACCEL_RAMP_S = 0.08;
export const ARENA_HALF_EXTENT = 20; // metres
const TICK_EVENT_EVERY = 30;
const SNAPSHOT_MAGIC = 0x47413031; // 'GA01'

export interface SimWorldOptions {
  seed: number;
  chefSlots: number;
  /** Half extent (m) of the square the chefs are clamped to. Default ARENA_HALF_EXTENT; the toy kitchen uses 3.8. */
  arenaHalf?: number;
  /** 'toy' (free play, default) or 'rush' (timed service with orders). */
  mode?: GameMode;
}

const TABLE_X0_M = TABLE.x0 / FV_PER_M - CHEF_RADIUS_M;
const TABLE_X1_M = (TABLE.x0 + TABLE.w) / FV_PER_M + CHEF_RADIUS_M;
const TABLE_Z0_M = TABLE.z0 / FV_PER_M - CHEF_RADIUS_M;
const TABLE_Z1_M = (TABLE.z0 + TABLE.d) / FV_PER_M + CHEF_RADIUS_M;
function insideTable(x: number, z: number): boolean {
  return x > TABLE_X0_M && x < TABLE_X1_M && z > TABLE_Z0_M && z < TABLE_Z1_M;
}

function approach(current: number, target: number, maxDelta: number): number {
  const d = target - current;
  if (d > maxDelta) return current + maxDelta;
  if (d < -maxDelta) return current - maxDelta;
  return target;
}

export class SimWorld {
  private _tick = 0;
  private readonly world = createWorld();
  readonly comps: Components = createComponents();
  private prng: Prng;
  readonly kitchen: KitchenSim;
  private readonly arenaHalf: number;
  private readonly chefSlots: number;
  /** Chef entity ids, indexed by slot (ascending). */
  private readonly chefEids: number[] = [];

  constructor(opts: SimWorldOptions) {
    this.chefSlots = opts.chefSlots;
    this.prng = new Prng(opts.seed);
    this.arenaHalf = opts.arenaHalf ?? ARENA_HALF_EXTENT;
    this.kitchen = new KitchenSim(opts.chefSlots, this.prng.split('food'), opts.mode ?? 'toy');
    const { Transform, Velocity, Chef } = this.comps;
    for (let slot = 0; slot < opts.chefSlots; slot++) {
      const eid = addEntity(this.world);
      addComponents(this.world, eid, Transform, Velocity, Chef);
      Chef.slot[eid] = slot;
      Transform.x[eid] = SPAWN_M.x + slot * 2;
      Transform.z[eid] = SPAWN_M.z;
      Transform.yaw[eid] = FACE_YAW[this.kitchen.facing[slot]!]!;
      this.chefEids.push(eid);
    }
  }

  get tick(): number {
    return this._tick;
  }

  get slotCount(): number {
    return this.chefSlots;
  }

  /** Entities in ascending id order (bitECS query order is not guaranteed). */
  private liveChefs(): number[] {
    const { Transform, Velocity, Chef } = this.comps;
    return Array.from(query(this.world, [Transform, Velocity, Chef])).sort((a, b) => a - b);
  }

  step(inputs: ReadonlyArray<InputFrame | undefined>): SimEvent[] {
    const events: SimEvent[] = [];
    this._tick = (this._tick + 1) >>> 0;
    const { Transform, Velocity, Chef } = this.comps;
    const maxDelta = (MAX_SPEED * SIM_DT) / ACCEL_RAMP_S;

    for (const eid of this.liveChefs()) {
      const input = inputs[Chef.slot[eid]!];
      let mx = input ? input.move[0] / 127 : 0;
      let mz = input ? input.move[1] / 127 : 0;
      const len = fsqrt(mx * mx + mz * mz);
      if (len > 1) {
        mx /= len;
        mz /= len;
      }
      const vx = approach(Velocity.x[eid]!, mx * MAX_SPEED, maxDelta);
      const vz = approach(Velocity.z[eid]!, mz * MAX_SPEED, maxDelta);
      Velocity.x[eid] = vx;
      Velocity.z[eid] = vz;
      const half = this.arenaHalf;
      const nx = clamp(Transform.x[eid]! + Velocity.x[eid]! * SIM_DT, -half, half);
      if (!insideTable(nx, Transform.z[eid]!)) Transform.x[eid] = nx;
      else Velocity.x[eid] = 0;
      const nz = clamp(Transform.z[eid]! + Velocity.z[eid]! * SIM_DT, -half, half);
      if (!insideTable(Transform.x[eid]!, nz)) Transform.z[eid] = nz;
      else Velocity.z[eid] = 0;

      const slot = Chef.slot[eid]!;
      this.kitchen.updateChef(slot, input, Transform.x[eid]!, Transform.z[eid]!, events);
      Transform.yaw[eid] = FACE_YAW[this.kitchen.facing[slot]!]!;
    }
    this.kitchen.afterChefs(this._tick, HEAT_EVERY_N_TICKS, events);

    if (this._tick % TICK_EVENT_EVERY === 0) events.push({ kind: 'tick', tick: this._tick });
    return events;
  }

  /** Chef positions as x,y,z,yaw per chef slot. */
  readChefStates(out: Float32Array = new Float32Array(this.chefSlots * 4)): Float32Array {
    const { Transform } = this.comps;
    for (let slot = 0; slot < this.chefEids.length; slot++) {
      const eid = this.chefEids[slot]!;
      out[slot * 4] = Transform.x[eid]!;
      out[slot * 4 + 1] = Transform.y[eid]!;
      out[slot * 4 + 2] = Transform.z[eid]!;
      out[slot * 4 + 3] = Transform.yaw[eid]!;
    }
    return out;
  }

  readHud(slot: number): HudState {
    const eid = this.chefEids[slot]!;
    return this.kitchen.hud(slot, this.comps.Transform.x[eid]!, this.comps.Transform.z[eid]!);
  }

  /** Food changes since the last call (see KitchenSim.drainDelta). */
  drainFoodDelta(): FoodDeltaData {
    return this.kitchen.drainDelta();
  }

  readChefVelocity(slot: number): { x: number; y: number; z: number } {
    const eid = this.chefEids[slot]!;
    const { Velocity } = this.comps;
    return { x: Velocity.x[eid]!, y: Velocity.y[eid]!, z: Velocity.z[eid]! };
  }

  stateHash(): string {
    const h = new Hasher64();
    h.u32(this._tick);
    h.bytes(new Uint8Array(this.prng.getState().buffer));
    h.bytes(new Uint8Array(this.kitchen.rng.getState().buffer));
    const k = this.kitchen;
    h.u32(k.cravingIdx);
    for (let s = 0; s < this.chefSlots; s++) {
      h.u32(k.tool[s]!).u32(k.tilt[s]!).u32(k.facing[s]!).i32(k.held[s]!).u32(k.lastButtons[s]!);
    }
    h.u32(k.store.nextId);
    for (const id of k.store.ids()) bodyHash(k.store.get(id)!, h);
    if (k.isRush) k.hashRush(h);
    const { Transform, Velocity, Chef } = this.comps;
    for (const eid of this.liveChefs()) {
      h.u32(eid).u32(Chef.slot[eid]!);
      h.f64(Transform.x[eid]!).f64(Transform.y[eid]!).f64(Transform.z[eid]!).f64(Transform.yaw[eid]!);
      h.f64(Velocity.x[eid]!).f64(Velocity.y[eid]!).f64(Velocity.z[eid]!);
    }
    return h.digest();
  }

  /** Layout: magic u32, tick u32, chefSlots u32, prng 4xu32, then per chef (ascending): 7 x f32. */
  snapshot(): Uint8Array {
    const chefs = this.liveChefs();
    const buf = new ArrayBuffer(4 * 3 + 16 + chefs.length * 7 * 4);
    const dv = new DataView(buf);
    let o = 0;
    dv.setUint32(o, SNAPSHOT_MAGIC, true);
    dv.setUint32((o += 4), this._tick, true);
    dv.setUint32((o += 4), this.chefSlots, true);
    for (const w of this.prng.getState()) dv.setUint32((o += 4), w, true);
    o += 4;
    const { Transform, Velocity } = this.comps;
    for (const eid of chefs) {
      for (const v of [
        Transform.x[eid]!, Transform.y[eid]!, Transform.z[eid]!, Transform.yaw[eid]!,
        Velocity.x[eid]!, Velocity.y[eid]!, Velocity.z[eid]!,
      ]) {
        dv.setFloat32(o, v, true);
        o += 4;
      }
    }
    // Kitchen tail: arenaHalf f32, foodPrng 4xu32, cravingIdx u32, per slot (tool u8, tilt u8, facing u8, pad u8, held i32,
    // lastButtons u32), then food store (u32 length + bytes).
    const k = this.kitchen;
    const food = k.store.snapshot();
    const rush = k.rushBytes();
    const tail = new Uint8Array(4 + 16 + 4 + this.chefSlots * 12 + 4 + food.length + rush.length);
    const tv = new DataView(tail.buffer);
    let t = 0;
    tv.setFloat32(t, this.arenaHalf, true);
    t += 4;
    for (const v of k.rng.getState()) {
      tv.setUint32(t, v, true);
      t += 4;
    }
    tv.setUint32(t, k.cravingIdx, true);
    t += 4;
    for (let s = 0; s < this.chefSlots; s++) {
      tv.setUint8(t, k.tool[s]!);
      tv.setUint8(t + 1, k.tilt[s]!);
      tv.setUint8(t + 2, k.facing[s]!);
      tv.setInt32(t + 4, k.held[s]!, true);
      tv.setUint32(t + 8, k.lastButtons[s]!, true);
      t += 12;
    }
    tv.setUint32(t, food.length, true);
    t += 4;
    tail.set(food, t);
    tail.set(rush, t + food.length);
    const out = new Uint8Array(buf.byteLength + tail.length);
    out.set(new Uint8Array(buf), 0);
    out.set(tail, buf.byteLength);
    return out;
  }

  static restore(bytes: Uint8Array): SimWorld {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (dv.getUint32(0, true) !== SNAPSHOT_MAGIC) throw new Error('bad snapshot magic');
    const slots = dv.getUint32(8, true);
    const chefBytes = 28 + slots * 28;
    const arenaHalf = dv.getFloat32(chefBytes, true);
    const sim = new SimWorld({ seed: 0, chefSlots: slots, arenaHalf });
    sim._tick = dv.getUint32(4, true);
    const state = new Uint32Array(4);
    for (let i = 0; i < 4; i++) state[i] = dv.getUint32(12 + i * 4, true);
    sim.prng = Prng.fromState(state);
    let o = 28;
    const { Transform, Velocity } = sim.comps;
    for (const eid of sim.liveChefs()) {
      Transform.x[eid] = dv.getFloat32(o, true);
      Transform.y[eid] = dv.getFloat32(o + 4, true);
      Transform.z[eid] = dv.getFloat32(o + 8, true);
      Transform.yaw[eid] = dv.getFloat32(o + 12, true);
      Velocity.x[eid] = dv.getFloat32(o + 16, true);
      Velocity.y[eid] = dv.getFloat32(o + 20, true);
      Velocity.z[eid] = dv.getFloat32(o + 24, true);
      o += 28;
    }
    // Kitchen tail (see snapshot()).
    const k = sim.kitchen;
    o += 4; // arenaHalf, already read
    const fstate = new Uint32Array(4);
    for (let i = 0; i < 4; i++) fstate[i] = dv.getUint32(o + i * 4, true);
    k.rng = Prng.fromState(fstate);
    o += 16;
    k.cravingIdx = dv.getUint32(o, true);
    o += 4;
    for (let s = 0; s < slots; s++) {
      k.tool[s] = dv.getUint8(o);
      k.tilt[s] = dv.getUint8(o + 1);
      k.facing[s] = dv.getUint8(o + 2);
      k.held[s] = dv.getInt32(o + 4, true);
      k.lastButtons[s] = dv.getUint32(o + 8, true);
      o += 12;
    }
    const flen = dv.getUint32(o, true);
    o += 4;
    k.store.restore(bytes.subarray(o, o + flen));
    if (o + flen < bytes.length) {
      k.restoreRush(bytes.subarray(o + flen));
      if (!k.isRush) k.service.phase = 1;
    }
    k.markAllDirty();
    return sim;
  }
}
