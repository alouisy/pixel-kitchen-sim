import { describe, expect, it } from 'vitest';
import {
  BTN_GRAB, BTN_SWAP, BTN_TILT, BTN_TOOL, FoodStore, PADS, ROCK, SimWorld, TABLE,
  supportHeightAt, restingOriginY, type InputFrame, type SimEvent,
} from '../index.js';

const TICKS = 1200;
const ARENA = 3.8;

class Driver {
  w = new SimWorld({ seed: 7, chefSlots: 1, arenaHalf: ARENA });
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
  /** Closed-loop walk: x first, then push north against the table so the chef faces +table. */
  walkX(tx: number): void {
    for (let i = 0; i < 400; i++) {
      const dx = tx - this.pos().x;
      if (Math.abs(dx) < 0.04) break;
      this.step([Math.max(-127, Math.min(127, Math.round(dx * 320))), 0]);
    }
    this.idle(6);
  }
  faceNorth(): void {
    for (let i = 0; i < 20; i++) this.step([0, -127]);
    this.idle(6);
  }
  walkZ(tz: number): void {
    for (let i = 0; i < 400; i++) {
      const dz = tz - this.pos().z;
      if (Math.abs(dz) < 0.04) break;
      this.step([0, Math.max(-127, Math.min(127, Math.round(dz * 320)))]);
    }
    this.idle(6);
  }
  dish(): Extract<SimEvent, { kind: 'DishServed' }> | undefined {
    return this.events.find((e): e is Extract<SimEvent, { kind: 'DishServed' }> => e.kind === 'DishServed');
  }
}

/** Scripted toy session. `useRock` cooks the mushroom for 40 heat steps first. Always exactly TICKS ticks. */
function session(useRock: boolean, snapshotAt?: number): { d: Driver; hash: string } {
  let d = new Driver();
  let snapped = false;
  const maybeSnap = (): void => {
    if (snapshotAt !== undefined && !snapped && d.w.tick >= snapshotAt) {
      snapped = true;
      const seq = d.seq;
      const events = d.events;
      const restored = SimWorld.restore(d.w.snapshot());
      expect(restored.stateHash()).toBe(d.w.stateHash());
      const nd = new Driver();
      nd.w = restored;
      nd.seq = seq;
      nd.events = events;
      d = nd;
    }
  };
  d.walkZ(-1.2);
  d.walkX(PADS[0]!.x / 16);
  d.faceNorth();
  d.press(BTN_GRAB); // spawn mushroom
  expect(d.w.kitchen.store.size).toBe(1);
  d.press(BTN_GRAB); // pick up
  expect(d.w.kitchen.held[0]).toBeGreaterThan(0);
  maybeSnap();
  if (useRock) {
    d.walkX((ROCK.x0 + ROCK.w / 2) / 16);
    d.faceNorth();
    d.press(BTN_GRAB); // place on rock
    expect(d.w.kitchen.held[0]).toBe(-1);
    const b = d.w.kitchen.store.get(1)!;
    expect(d.w.kitchen.onRock(b)).toBe(true);
    for (let i = 0; i < 120; i++) {
      d.idle(1);
      maybeSnap();
    }
    d.press(BTN_GRAB); // pick up cooked
    expect(d.w.kitchen.held[0]).toBe(1);
  } else {
    for (let i = 0; i < 120; i++) {
      d.idle(1);
      maybeSnap();
    }
  }
  d.walkX(26 / 16);
  d.faceNorth();
  maybeSnap();
  d.press(BTN_GRAB); // place on plate
  expect(d.w.kitchen.held[0]).toBe(-1);
  d.press(BTN_GRAB); // taste
  expect(d.dish()).toBeDefined();
  while (d.w.tick < TICKS) {
    d.idle(1);
    maybeSnap();
  }
  expect(d.w.tick).toBe(TICKS);
  return { d, hash: d.w.stateHash() };
}

describe('kitchen layout', () => {
  it('supportHeightAt covers floor, table, rock and stacked bodies', () => {
    const s = new FoodStore();
    expect(supportHeightAt(s, 0, 0, -1)).toBe(0);
    expect(supportHeightAt(s, 0, -40, -1)).toBe(TABLE.top);
    expect(supportHeightAt(s, ROCK.x0 + 1, ROCK.z0 + 1, -1)).toBe(ROCK.top);
    const b = s.create([2, 3, 2], [0, 0, 0]);
    b.material.fill(1);
    b.origin[1] = restingOriginY(s, b);
    expect(b.origin[1]).toBe(0);
    expect(supportHeightAt(s, 1, 1, -1)).toBe(3);
    expect(supportHeightAt(s, 1, 1, b.id)).toBe(0);
    const c = s.create([2, 2, 2], [1, 9, 1]);
    c.material.fill(1);
    expect(restingOriginY(s, c)).toBe(3);
  });
});

describe('Cut & Burn session', () => {
  it('cooking on the rock scores higher than skipping it', () => {
    const a = session(true).d.dish()!;
    const b = session(false).d.dish()!;
    expect(a.cravingId).toBe('ch1_seared_mushroom');
    expect(a.score).toBeGreaterThan(b.score);
  });
  it('is deterministic and survives snapshot/restore mid-run', () => {
    const h1 = session(true).hash;
    expect(session(true).hash).toBe(h1);
    expect(session(true, 300).hash).toBe(h1);
    expect(session(true, 150).hash).toBe(h1);
  });
});

describe('toy rules', () => {
  it('cycles tool/tilt on edges, cuts with the cleaver and refuses a 41st body', () => {
    const d = new Driver();
    d.press(BTN_SWAP);
    d.press(BTN_SWAP);
    expect(d.w.readHud(0).tool).toBe('cleaver');
    d.press(BTN_TILT);
    expect(d.w.readHud(0).tilt).toBe(1);
    d.press(BTN_TILT);
    d.press(BTN_TILT);
    expect(d.w.readHud(0).tilt).toBe(0);
    d.walkZ(-1.2);
    d.walkX(PADS[0]!.x / 16);
    d.faceNorth();
    d.press(BTN_GRAB);
    const b = d.w.kitchen.store.get(1)!;
    const aim: [number, number, number] = [b.origin[0] + 4, b.origin[1] + 2, b.origin[2] + 4];
    d.step([0, -127], BTN_TOOL, aim);
    d.step([0, 0], 0);
    expect(d.w.kitchen.store.get(1)).toBeUndefined();
    expect(d.w.kitchen.store.size).toBe(2);
    // Replace the world's bodies with 40 far-away blocks so the pad is the only target.
    const store = d.w.kitchen.store;
    for (const id of store.ids()) store.remove(id);
    while (store.size < 40) store.create([2, 2, 2], [100 + store.size * 3, 0, 100]).material.fill(1);
    d.press(BTN_GRAB);
    expect(d.events.some((e) => e.kind === 'SpawnRefused')).toBe(true);
    expect(store.size).toBe(40);
  });
  it('torch heats bodies in the cone and the delta stream reports it', () => {
    const d = new Driver();
    d.walkZ(-1.2);
    d.walkX(PADS[0]!.x / 16);
    d.faceNorth();
    d.press(BTN_GRAB);
    d.w.drainFoodDelta();
    d.press(BTN_SWAP);
    const b = d.w.kitchen.store.get(1)!;
    const aim: [number, number, number] = [b.origin[0] + 4, b.origin[1] + 2, b.origin[2] + 4];
    for (let i = 0; i < 60; i++) d.step([0, -127], BTN_TOOL, aim);
    expect(b.temp).not.toBeNull();
    const delta = d.w.drainFoodDelta();
    expect(delta.upserts.some((u) => u.id === 1 && u.doneness !== null)).toBe(true);
  });
});
