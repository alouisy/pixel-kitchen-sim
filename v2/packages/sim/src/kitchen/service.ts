import { SIM_HZ, type Hasher64, type Prng } from '@ga/shared';
import { RECIPES } from './recipes.js';

/*
 * Rush mode service: a timed shift with an order queue (V1's core loop). Pure and tick-driven, so it is deterministic and
 * part of the state hash / snapshot.
 */
export const SERVICE_S = 180;
export const MAX_ORDERS = 4;
export const FIRST_GAP_S = 18;
/** Gap between orders shrinks linearly from START to END over the shift. */
export const GAP_START_S = 26;
export const GAP_END_S = 14;
export const EXPIRE_PENALTY = 10;
/** Score thresholds for 1, 2 and 3 stars. */
export const STAR_SCORES = [100, 220, 340] as const;
/** Ticks the results screen ignores the interact button (so a mashed E does not restart instantly). */
export const RESTART_LOCK_TICKS = SIM_HZ * 2;

export const PHASE_TITLE = 0;
export const PHASE_PLAYING = 1;
export const PHASE_OVER = 2;

export interface Order {
  uid: number;
  recipe: number;
  born: number;
  deadline: number;
}

export type ServiceEvent =
  | { kind: 'OrderAdded'; uid: number; recipeId: string }
  | { kind: 'OrderExpired'; uid: number; recipeId: string; penalty: number };

export class Service {
  phase = PHASE_TITLE;
  /** Ticks since the shift started (or since it ended, in PHASE_OVER). */
  t = 0;
  nextOrderAt = 0;
  orders: Order[] = [];
  score = 0;
  served = 0;
  missed = 0;
  nextUid = 1;
  lastRecipe = -1;

  get timeLeftTicks(): number {
    return this.phase === PHASE_PLAYING ? Math.max(0, SERVICE_S * SIM_HZ - this.t) : 0;
  }

  start(): void {
    this.phase = PHASE_PLAYING;
    this.t = 0;
    this.orders = [];
    this.score = 0;
    this.served = 0;
    this.missed = 0;
    this.nextUid = 1;
    this.lastRecipe = -1;
    this.nextOrderAt = 0;
  }

  /** Advance one tick. Returns true on the tick the shift ends. */
  step(rng: Prng, events: { push(e: ServiceEvent): unknown }): boolean {
    if (this.phase !== PHASE_PLAYING) {
      if (this.phase === PHASE_OVER) this.t++;
      return false;
    }
    this.t++;
    for (const o of this.orders) {
      if (this.t < o.deadline) continue;
      this.missed++;
      this.score = Math.max(0, this.score - EXPIRE_PENALTY);
      events.push({ kind: 'OrderExpired', uid: o.uid, recipeId: RECIPES[o.recipe]!.id, penalty: EXPIRE_PENALTY });
    }
    this.orders = this.orders.filter((o) => this.t < o.deadline);
    if (this.orders.length === 0 && this.nextOrderAt > this.t + SIM_HZ * 3) this.nextOrderAt = this.t + SIM_HZ * 3;
    if (this.t >= this.nextOrderAt && this.orders.length < MAX_ORDERS && this.t < (SERVICE_S - 15) * SIM_HZ) {
      this.addOrder(rng, events);
      const progress = this.t / (SERVICE_S * SIM_HZ);
      const gapS = this.served + this.missed === 0 && this.orders.length === 1 ? FIRST_GAP_S : GAP_START_S + (GAP_END_S - GAP_START_S) * progress;
      this.nextOrderAt = this.t + Math.round(gapS * SIM_HZ);
    }
    if (this.t >= SERVICE_S * SIM_HZ) {
      this.phase = PHASE_OVER;
      this.t = 0;
      this.orders = [];
      return true;
    }
    return false;
  }

  private addOrder(rng: Prng, events: { push(e: ServiceEvent): unknown }): void {
    const nowS = this.t / SIM_HZ;
    const pool: number[] = [];
    for (let i = 0; i < RECIPES.length; i++) if (RECIPES[i]!.unlockS <= nowS) pool.push(i);
    // The newest unlocked recipe is weighted x2 so the player meets it soon; avoid three of a kind in a row.
    const newest = pool[pool.length - 1]!;
    const weighted = pool.length > 1 ? [...pool, newest] : pool;
    let pick = weighted[rng.nextU32() % weighted.length]!;
    if (pick === this.lastRecipe && pool.length > 1 && rng.nextU32() % 2 === 0) pick = pool[rng.nextU32() % pool.length]!;
    this.lastRecipe = pick;
    const r = RECIPES[pick]!;
    const o: Order = { uid: this.nextUid++, recipe: pick, born: this.t, deadline: this.t + r.patienceS * SIM_HZ };
    this.orders.push(o);
    events.push({ kind: 'OrderAdded', uid: o.uid, recipeId: r.id });
  }

  /** Complete order `uid`; returns points awarded (base + speed tip). */
  complete(uid: number): { points: number; tip: number } {
    const o = this.orders.find((x) => x.uid === uid);
    if (!o) return { points: 0, tip: 0 };
    const r = RECIPES[o.recipe]!;
    const left = (o.deadline - this.t) / (o.deadline - o.born);
    const tip = Math.round(r.points * 0.5 * Math.max(0, Math.min(1, left)));
    this.orders = this.orders.filter((x) => x.uid !== uid);
    this.served++;
    this.score += r.points + tip;
    // Keep the kitchen busy: a served order pulls the next one closer.
    if (this.nextOrderAt > this.t + SIM_HZ * 6) this.nextOrderAt = this.t + SIM_HZ * 6;
    return { points: r.points + tip, tip };
  }

  stars(): number {
    let s = 0;
    for (const th of STAR_SCORES) if (this.score >= th) s++;
    return s;
  }

  hash(h: Hasher64): void {
    h.u32(this.phase).u32(this.t).u32(this.nextOrderAt).u32(this.score).u32(this.served).u32(this.missed);
    h.u32(this.nextUid).i32(this.lastRecipe).u32(this.orders.length);
    for (const o of this.orders) h.u32(o.uid).u32(o.recipe).u32(o.born).u32(o.deadline);
  }

  toBytes(): Uint8Array {
    const n = 9 + this.orders.length * 4;
    const a = new Int32Array(n);
    a.set([this.phase, this.t, this.nextOrderAt, this.score, this.served, this.missed, this.nextUid, this.lastRecipe, this.orders.length]);
    this.orders.forEach((o, i) => a.set([o.uid, o.recipe, o.born, o.deadline], 9 + i * 4));
    return new Uint8Array(a.buffer);
  }

  /** Reads what toBytes wrote; returns bytes consumed. */
  fromBytes(bytes: Uint8Array): number {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const g = (i: number): number => dv.getInt32(i * 4, true);
    this.phase = g(0);
    this.t = g(1);
    this.nextOrderAt = g(2);
    this.score = g(3);
    this.served = g(4);
    this.missed = g(5);
    this.nextUid = g(6);
    this.lastRecipe = g(7);
    const n = g(8);
    this.orders = [];
    for (let i = 0; i < n; i++) this.orders.push({ uid: g(9 + i * 4), recipe: g(10 + i * 4), born: g(11 + i * 4), deadline: g(12 + i * 4) });
    return (9 + n * 4) * 4;
  }
}
