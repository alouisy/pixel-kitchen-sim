import { addComponents, addEntity, createWorld, query } from 'bitecs';
import { Hasher64, Prng, SIM_DT, clamp, fsqrt } from '@ga/shared';
import { createComponents, type Components } from './components.js';
import type { InputFrame, SimEvent } from './types.js';

export const MAX_SPEED = 4.2; // m/s, docs/v2/04 §2
export const ACCEL_RAMP_S = 0.08;
export const ARENA_HALF_EXTENT = 20; // metres
const TICK_EVENT_EVERY = 30;
const SNAPSHOT_MAGIC = 0x47413031; // 'GA01'

export interface SimWorldOptions {
  seed: number;
  chefSlots: number;
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
  private readonly chefSlots: number;
  /** Chef entity ids, indexed by slot (ascending). */
  private readonly chefEids: number[] = [];

  constructor(opts: SimWorldOptions) {
    this.chefSlots = opts.chefSlots;
    this.prng = new Prng(opts.seed);
    const { Transform, Velocity, Chef } = this.comps;
    for (let slot = 0; slot < opts.chefSlots; slot++) {
      const eid = addEntity(this.world);
      addComponents(this.world, eid, Transform, Velocity, Chef);
      Chef.slot[eid] = slot;
      Transform.x[eid] = slot * 2;
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
      Transform.x[eid] = clamp(Transform.x[eid]! + Velocity.x[eid]! * SIM_DT, -ARENA_HALF_EXTENT, ARENA_HALF_EXTENT);
      Transform.z[eid] = clamp(Transform.z[eid]! + Velocity.z[eid]! * SIM_DT, -ARENA_HALF_EXTENT, ARENA_HALF_EXTENT);
    }

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

  readChefVelocity(slot: number): { x: number; y: number; z: number } {
    const eid = this.chefEids[slot]!;
    const { Velocity } = this.comps;
    return { x: Velocity.x[eid]!, y: Velocity.y[eid]!, z: Velocity.z[eid]! };
  }

  stateHash(): string {
    const h = new Hasher64();
    h.u32(this._tick);
    h.bytes(new Uint8Array(this.prng.getState().buffer));
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
    return new Uint8Array(buf);
  }

  static restore(bytes: Uint8Array): SimWorld {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (dv.getUint32(0, true) !== SNAPSHOT_MAGIC) throw new Error('bad snapshot magic');
    const sim = new SimWorld({ seed: 0, chefSlots: dv.getUint32(8, true) });
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
    return sim;
  }
}
