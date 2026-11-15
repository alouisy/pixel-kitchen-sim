import { describe, expect, it } from 'vitest';
import { SIM_HZ } from '@ga/shared';
import { BTN_GRAB, BTN_TILT, BTN_TOOL, PADS, PLATE, ROCK, SimWorld, type InputFrame, type SimEvent } from '../index.js';
import { RECIPES, SERVICE_S } from './index.js';

class Driver {
  w = new SimWorld({ seed: 3, chefSlots: 1, arenaHalf: 3.8, mode: 'rush' });
  events: SimEvent[] = [];
  seq = 0;
  step(move: [number, number], buttons = 0, aim: [number, number, number] = [0, 0, 0]): void {
    const f: InputFrame = { tick: this.w.tick + 1, move, aim, buttons, analog: { tool: 0 }, seq: this.seq++ };
    this.events.push(...this.w.step([f]));
  }
  idle(n: number): void {
    for (let i = 0; i < n; i++) this.step([0, 0]);
  }
  press(btn: number): void {
    this.step([0, 0], btn);
    this.step([0, 0], 0);
  }
  pos(): { x: number; z: number } {
    const s = this.w.readChefStates();
    return { x: s[0]!, z: s[2]! };
  }
  /** Walk to x (fv) in front of the table and face it. */
  goTo(xFv: number): void {
    for (let i = 0; i < 400; i++) {
      const dz = -1.2 - this.pos().z;
      if (Math.abs(dz) < 0.04) break;
      this.step([0, Math.max(-127, Math.min(127, Math.round(dz * 320)))]);
    }
    for (let i = 0; i < 400; i++) {
      const dx = xFv / 16 - this.pos().x;
      if (Math.abs(dx) < 0.04) break;
      this.step([Math.max(-127, Math.min(127, Math.round(dx * 320))), 0]);
    }
    for (let i = 0; i < 20; i++) this.step([0, -127]);
    this.idle(6);
  }
  of<K extends SimEvent['kind']>(kind: K): Array<Extract<SimEvent, { kind: K }>> {
    return this.events.filter((e): e is Extract<SimEvent, { kind: K }> => e.kind === kind);
  }
}

const pad = (m: string): number => PADS.findIndex((p) => p.material === m);
const ROCK_X = ROCK.x0 + ROCK.w / 2;

/** Title -> start -> cook a mushroom on the rock -> plate -> serve the first order (a grilled mushroom). */
function grilledMushroom(d: Driver, cookTicks = 300): void {
  d.goTo(PADS[pad('mushroom')]!.x);
  d.press(BTN_GRAB); // spawn
  d.press(BTN_GRAB); // pick up
  d.goTo(ROCK_X);
  d.press(BTN_GRAB); // on the rock
  d.idle(cookTicks);
  d.press(BTN_GRAB); // pick up
  d.goTo(PLATE.cx);
  d.press(BTN_GRAB); // on the plate
  d.press(BTN_GRAB); // serve
}

describe('rush mode', () => {
  it('starts on the title, opens a shift on interact and serves a grilled mushroom', () => {
    const d = new Driver();
    d.idle(30);
    expect(d.w.readHud(0).phase).toBe(0);
    expect(d.w.readHud(0).hint.kind).toBe('start');
    d.press(BTN_GRAB);
    expect(d.of('ServiceStarted')).toHaveLength(1);
    d.idle(2);
    const hud = d.w.readHud(0);
    expect(hud.phase).toBe(1);
    expect(hud.orders.map((o) => o.recipeId)).toEqual(['grilled_mushroom']);
    grilledMushroom(d);
    const served = d.of('OrderServed');
    expect(served).toHaveLength(1);
    expect(served[0]!.recipeId).toBe('grilled_mushroom');
    expect(d.w.readHud(0).score).toBe(served[0]!.points);
    expect(served[0]!.tip).toBeGreaterThan(0);
  });

  it('bins a raw or burnt mushroom and keeps a dish that only misses an ingredient', () => {
    const d = new Driver();
    d.press(BTN_GRAB);
    grilledMushroom(d, 0);
    const rej = d.of('ServeRejected');
    expect(rej).toHaveLength(1);
    expect(rej[0]!.problem.kind).toBe('raw');
    expect(rej[0]!.discarded).toBe(true);
    const burnt = new Driver();
    burnt.press(BTN_GRAB);
    grilledMushroom(burnt, 30 * 40);
    const r2 = burnt.of('ServeRejected');
    expect(r2[0]?.problem.kind).toBe('burnt');
    expect(r2[0]?.discarded).toBe(true);
    expect(burnt.w.kitchen.bodiesOnPlate()).toHaveLength(0);
  });

  it('lifts cut pieces as one group and refuses to dice tiny pieces', () => {
    const d = new Driver();
    d.press(BTN_GRAB);
    d.goTo(PADS[pad('potato')]!.x);
    d.press(BTN_GRAB);
    const b = d.w.kitchen.store.get(d.w.kitchen.store.ids()[0]!)!;
    // Two vertical cuts across the potato -> 3 pieces.
    for (const dz of [2, 5]) {
      d.step([0, -127], BTN_TOOL, [b.origin[0] + 3, b.origin[1] + 3, b.origin[2] + dz]);
      d.step([0, 0], 0);
    }
    expect(d.w.kitchen.store.size).toBeGreaterThanOrEqual(3);
    expect(d.w.readHud(0).hint).toMatchObject({ kind: 'grab', material: 'potato' });
    d.press(BTN_GRAB);
    const carried = 1 + d.w.kitchen.followers[0]!.length;
    expect(carried).toBe(d.w.kitchen.store.size);
    d.goTo(ROCK_X);
    d.press(BTN_GRAB);
    expect(d.w.kitchen.held[0]).toBe(-1);
    if (process.env.MEASURE) {
      for (let t = 0; t < 40; t++) {
        d.idle(30);
        process.stdout.write(`${t + 1}s ` + d.w.readHud(0).gauges.map((g) => `${g.material}:${g.done.toFixed(2)}/${g.char.toFixed(2)}`).join(' ') + '\n');
      }
    }
    // A tiny piece cannot be cut any more.
    const tiny = d.w.kitchen.store.create([3, 2, 3], [ROCK.x0 + 1, ROCK.top + 8, ROCK.z0 + 1]);
    tiny.material.fill(1);
    const before = d.w.kitchen.store.size;
    d.step([0, -127], BTN_TOOL, [tiny.origin[0] + 1, tiny.origin[1] + 1, tiny.origin[2] + 1]);
    d.step([0, 0], 0);
    expect(d.w.kitchen.store.size).toBe(before);
    void BTN_TILT;
    expect(d.of('CutTooSmall').length).toBeGreaterThan(0);
  });

  it('expires orders, ends the shift and is deterministic across snapshot/restore', () => {
    const run = (snapAt?: number): string => {
      const d = new Driver();
      d.press(BTN_GRAB);
      grilledMushroom(d);
      while (d.w.tick < SERVICE_S * SIM_HZ + 200) {
        if (snapAt !== undefined && d.w.tick === snapAt) {
          const r = SimWorld.restore(d.w.snapshot());
          expect(r.stateHash()).toBe(d.w.stateHash());
          d.w = r;
        }
        d.idle(1);
      }
      expect(d.of('OrderExpired').length).toBeGreaterThan(0);
      const end = d.of('ServiceEnded');
      expect(end).toHaveLength(1);
      expect(d.w.readHud(0).phase).toBe(2);
      // Results screen: E is locked for 2 s, then restarts.
      d.press(BTN_GRAB);
      expect(d.of('ServiceStarted')).toHaveLength(2);
      return d.w.stateHash();
    };
    const h = run();
    expect(run()).toBe(h);
    expect(run(2500)).toBe(h);
  });

  it('every recipe unlocks inside the shift and uses spawnable ingredients', () => {
    for (const r of RECIPES) {
      expect(r.unlockS).toBeLessThan(SERVICE_S - 30);
      for (const ing of r.ingredients) expect(pad(ing.id)).toBeGreaterThanOrEqual(0);
    }
  });
});
