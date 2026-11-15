import { describe, expect, it } from 'vitest';
import { gameTuning } from '@ga/content';
import {
  BTN_GRAB, BTN_TOOL, FoodStore, MOUTH_M, PADS, ROCK, SimWorld, TABLE,
  cellCount, fillBox, restingOriginY, type SimEvent,
} from '../index.js';
import { G } from './game.js';
import { Driver } from './testkit.js';

const ARENA = 4.8;
const world = (phase: 'title' | 'tutorial' | 'service', seed = 7): SimWorld => new SimWorld({ seed, chefSlots: 1, arenaHalf: ARENA, phase });
const MUSH = 1;

describe('phases', () => {
  it('starts on the title, ignores input there, and commands switch phases', () => {
    const w = new SimWorld({ seed: 1, chefSlots: 1, arenaHalf: ARENA });
    expect(w.phase).toBe('title');
    const d = new Driver(w);
    d.step([127, 0]);
    expect(d.pos().x).toBe(0);
    expect(w.command('startTutorial')).toEqual([{ kind: 'PhaseChanged', phase: 'tutorial' }]);
    expect(w.phase).toBe('tutorial');
    d.walkZ(-1.2);
    w.command('skipTutorial');
    expect(w.phase).toBe('service');
    expect(d.pos().z).toBe(0); // the kitchen was reset
    w.command('skipTutorial'); // no-op outside the tutorial
    expect(w.phase).toBe('service');
    w.command('toTitle');
    expect(w.phase).toBe('title');
  });
});

describe('tutorial', () => {
  it('advances step by step from sim events and then starts the service', () => {
    const d = new Driver(world('tutorial'));
    const k = d.w.kitchen;
    const step = (): number => d.w.readGameHud(0).tutorialStep;
    expect(step()).toBe(0);
    expect(d.w.readGameHud(0).target?.kind).toBe('pad');
    // 1. take a mushroom
    d.goToTable(PADS[0]!.x / 16);
    d.press(BTN_GRAB);
    d.idle(1);
    expect(step()).toBe(1);
    expect(d.w.readGameHud(0).target?.kind).toBe('rock');
    // 2. put it on the hot rock
    d.walkX((ROCK.x0 + ROCK.w / 2) / 16);
    d.faceNorth();
    expect(d.w.readGameHud(0).prompt?.kind).toBe('place');
    d.press(BTN_GRAB);
    d.idle(1);
    expect(step()).toBe(2);
    // 3. wait for it to enter the perfect band (the gauge marker is exposed in the HUD)
    let ticks = 0;
    while (step() === 2 && ticks++ < 700) d.idle(1);
    expect(step()).toBe(3);
    expect(ticks).toBeGreaterThan(150); // not instant: browning takes seconds
    const g = d.w.readGameHud(0).gauges[0]!;
    expect(g.doneMarker).toBeGreaterThanOrEqual(g.perfectLo);
    expect(g.doneMarker).toBeLessThanOrEqual(g.perfectHi);
    // belly is frozen during the tutorial
    expect(d.w.readGameHud(0).belly).toBe(gameTuning.belly.start);
    // 4. take it back and serve it
    d.press(BTN_GRAB);
    expect(k.held[0]).toBeGreaterThan(0);
    d.walkX(MOUTH_M.x);
    d.faceNorth();
    expect(d.w.readGameHud(0).prompt?.kind).toBe('serve');
    d.press(BTN_GRAB);
    d.idle(1);
    expect(step()).toBe(4);
    expect(d.count('TutorialDone')).toBe(1);
    const dish = d.events.find((e): e is Extract<SimEvent, { kind: 'DishServed' }> => e.kind === 'DishServed')!;
    expect(dish.points).toBe(0);
    // 5. closing message, then the real service
    d.idle(Math.round(gameTuning.tutorial.doneSeconds * 30) + 2);
    expect(d.w.phase).toBe('service');
    expect(d.w.readGameHud(0).timeLeft).toBeGreaterThan(gameTuning.serviceSeconds - 2);
  });

  it('falls back to step 1 when the mushroom is gone', () => {
    const d = new Driver(world('tutorial'));
    d.goToTable(PADS[0]!.x / 16);
    d.press(BTN_GRAB);
    d.idle(1);
    expect(d.w.readGameHud(0).tutorialStep).toBe(1);
    d.walkX(MOUTH_M.x);
    d.faceNorth();
    d.press(BTN_GRAB); // serve it raw, too early
    d.idle(2);
    expect(d.w.readGameHud(0).tutorialStep).toBe(0);
  });
});

describe('service', () => {
  it('drains the belly, rotates cravings and ends at 0:00 with results', () => {
    const w = world('service');
    const d = new Driver(w);
    const total = Math.round(gameTuning.serviceSeconds * 30);
    const seen = new Set<string>();
    for (let i = 0; i < total - 1; i++) {
      d.idle(1);
      seen.add(w.readGameHud(0).cravingId);
    }
    const expired = d.count('CravingExpired');
    expect(w.phase).toBe('service');
    expect(w.readGameHud(0).timeLeft).toBeLessThan(0.1);
    expect(w.readGameHud(0).belly).toBeLessThan(gameTuning.belly.start - 60);
    expect(expired).toBeGreaterThanOrEqual(2);
    expect(seen.size).toBe(3); // every craving came up
    d.idle(1);
    expect(w.phase).toBe('results');
    const ended = d.events.find((e): e is Extract<SimEvent, { kind: 'ServiceEnded' }> => e.kind === 'ServiceEnded')!;
    expect(ended.reason).toBe('time');
    expect(w.readGameHud(0).endReason).toBe('time');
    expect(w.readGameHud(0).mood).toBeLessThan(0); // expired cravings and hangry entries hurt
  });

  it('craving order is a seeded shuffle', () => {
    const order = (seed: number): string[] => {
      const w = world('service', seed);
      const ids: string[] = [w.readGameHud(0).cravingId];
      const d = new Driver(w);
      for (let i = 0; i < 6; i++) {
        d.idle(Math.round(60 * 30));
        ids.push(w.readGameHud(0).cravingId);
        if (w.phase !== 'service') break;
      }
      return ids;
    };
    expect(order(3)).toEqual(order(3));
    expect(new Set(order(3).slice(0, 3)).size).toBe(3);
    const seeds = [1, 2, 3, 4, 5, 6].map((s) => order(s)[0]);
    expect(new Set(seeds).size).toBeGreaterThan(1);
  });

  it('losing all patience ends the service early', () => {
    const w = world('service');
    const d = new Driver(w);
    const f = w.kitchen.game.f;
    for (let n = 0; n < 3; n++) {
      f[G.BELLY] = 5;
      d.idle(2);
      expect(d.count('HangryEntered')).toBe(n + 1);
      if (n < 2) {
        expect(w.phase).toBe('service');
        f[G.BELLY] = 50; // fed again: the band is left
        d.idle(2);
      }
    }
    expect(w.phase).toBe('results');
    expect(w.readGameHud(0).endReason).toBe('patience');
    expect(w.readGameHud(0).timeLeft).toBeGreaterThan(100);
    expect(w.readGameHud(0).patience).toBe(0);
  });

  it('serving scores, refills the belly and moves to the next craving', () => {
    const w = world('service');
    const d = new Driver(w);
    const first = w.readGameHud(0).cravingId;
    d.idle(300);
    const bellyBefore = w.readGameHud(0).belly;
    d.goToTable(PADS[0]!.x / 16);
    d.press(BTN_GRAB);
    d.walkX(MOUTH_M.x);
    d.faceNorth();
    d.press(BTN_GRAB);
    const dish = d.events.find((e): e is Extract<SimEvent, { kind: 'DishServed' }> => e.kind === 'DishServed')!;
    expect(dish.cravingId).toBe(first);
    const hud = w.readGameHud(0);
    expect(hud.served).toBe(1);
    expect(hud.cravingId).not.toBe(first);
    expect(hud.score).toBe(dish.points);
    expect(dish.points).toBe(Math.round(dish.score * (1 + 0 / 200)) + dish.timeBonus);
    expect(dish.timeBonus).toBeLessThanOrEqual(gameTuning.timeBonusCap);
    expect(dish.bellyGain).toBeGreaterThan(0);
    expect(hud.belly).toBeGreaterThan(bellyBefore);
    expect(hud.bestDishCravingId).toBe(first);
  });
});

/** Put a solid box body at world cell (x, z), resting on the table. */
function box(w: SimWorld, dims: [number, number, number], x: number, z: number, mat = MUSH) {
  const store = w.kitchen.store;
  const b = store.create(dims, [x, 0, z]);
  fillBox(b, [0, 0, 0], [dims[0] - 1, dims[1] - 1, dims[2] - 1], mat);
  b.origin[1] = restingOriginY(store, b);
  return b;
}

describe('pile grab', () => {
  it('lifts a touching group together, keeps offsets, and serves them together', () => {
    const w = world('service');
    const d = new Driver(w);
    const a = box(w, [6, 4, 5], -22, -44); // 120 cells
    const b = box(w, [6, 4, 5], -16, -44); // touches a on x
    const c = box(w, [6, 4, 5], -10, -44); // touches b: part of the same pile (a + b + c + top = 378 <= 384)
    const far = box(w, [6, 4, 5], -2, -44); // 2 cells gap from c: separate
    const top = box(w, [3, 2, 3], -21, -43); // rests on top of a
    expect(top.origin[1]).toBe(TABLE.top + 4);
    d.goToTable(-17 / 16);
    d.press(BTN_GRAB);
    const k = w.kitchen;
    expect(k.groupN[0]).toBe(4); // a, b, c and the piece resting on a
    const ids = k.heldBodies(0).map((x) => x.id).sort((p, q) => p - q);
    expect(ids).toEqual([a.id, b.id, c.id, top.id].sort((p, q) => p - q));
    expect(ids).not.toContain(far.id);
    const cells = k.heldBodies(0).reduce((s, x) => s + cellCount(x), 0);
    expect(cells).toBeLessThanOrEqual(384);
    const offB = [b.origin[0] - a.origin[0], b.origin[1] - a.origin[1], b.origin[2] - a.origin[2]];
    d.walkX(0.2);
    expect([b.origin[0] - a.origin[0], b.origin[1] - a.origin[1], b.origin[2] - a.origin[2]]).toEqual(offB);
    expect(a.origin[1]).toBe(16);
    // serve at the mouth: every member is eaten
    d.walkX(MOUTH_M.x);
    d.faceNorth();
    d.press(BTN_GRAB);
    expect(d.count('DishServed')).toBe(1);
    for (const x of [a, b, c, top]) expect(k.store.get(x.id)).toBeUndefined();
    expect(k.store.get(far.id)).toBeDefined();
    expect(k.groupN[0]).toBe(0);
  });

  it('respects the 384-cell cap, ignores bodies on other surfaces, and places the pile back down', () => {
    const w = world('service');
    const d = new Driver(w);
    const k = w.kitchen;
    const a = box(w, [8, 6, 8], -22, -44); // 384 cells: heaviest legal primary
    const big = box(w, [6, 3, 6], -14, -44); // touches a but would exceed the cap
    d.goToTable(-18 / 16);
    d.press(BTN_GRAB);
    expect(k.held[0]).toBe(a.id);
    expect(k.groupN[0]).toBe(1);
    expect(k.store.get(big.id)!.flags & 4).toBe(0);
    d.walkX(-0.6);
    d.faceNorth();
    d.press(BTN_GRAB); // put it down (it lands on top of whatever is below)
    expect(k.held[0]).toBe(-1);
    expect(a.flags & 4).toBe(0);
    expect(a.origin[1]).toBeGreaterThanOrEqual(TABLE.top);
  });
});

describe('cutting rules', () => {
  it('refuses to cut bodies under 48 cells, crumbs pieces under 24, and has a cooldown', () => {
    const w = world('service');
    const d = new Driver(w);
    const k = w.kitchen;
    d.goToTable(-1);
    const tiny = box(w, [5, 2, 4], -40 + 8, -44); // 40 cells
    const aimOf = (b: typeof tiny, fz: number): [number, number, number] => [b.origin[0] + b.dims[0] / 2, b.origin[1] + b.dims[1] / 2, b.origin[2] + fz];
    d.step([0, -127], BTN_TOOL, aimOf(tiny, 2));
    d.step([0, 0], 0);
    expect(k.store.get(tiny.id)).toBeDefined();
    expect(d.count('TooSmallToCut')).toBe(1);
    // 10x2x10 = 200 cells; the cut plane isolates a single 20-cell row -> crumbs, one 180-cell body remains
    const slab = box(w, [10, 2, 10], 20, -46);
    d.idle(20);
    d.step([0, -127], BTN_TOOL, aimOf(slab, 0.5));
    d.step([0, 0], 0);
    expect(k.store.get(slab.id)).toBeUndefined();
    const cut = d.events.find((e): e is Extract<SimEvent, { kind: 'Cut' }> => e.kind === 'Cut')!;
    expect(cut.crumbs).toBe(20);
    expect(cut.crumbAt.length).toBe(1);
    const left = k.store.ids().map((id) => k.store.get(id)!).filter((b) => b.id !== tiny.id);
    expect(left.length).toBe(1);
    expect(cellCount(left[0]!)).toBe(180);
    // cooldown: an immediate second cut does nothing; after 0.35 s it works again
    const before = k.store.ids().length;
    d.step([0, -127], BTN_TOOL, aimOf(left[0]!, 5.5));
    d.step([0, 0], 0);
    expect(k.store.ids().length).toBe(before);
    d.idle(12);
    d.step([0, -127], BTN_TOOL, aimOf(left[0]!, 5.5));
    d.step([0, 0], 0);
    expect(k.store.ids().length).toBe(before + 1);
    for (const id of k.store.ids()) if (id !== tiny.id) expect(cellCount(k.store.get(id)!)).toBeGreaterThanOrEqual(24);
  });

  it('auto-aims the tool at the nearest food in front when no mouse aim is active', () => {
    const w = world('service');
    const d = new Driver(w);
    d.goToTable(-1);
    const b = box(w, [10, 4, 10], -20, -46);
    d.step([0, -127]);
    d.step([0, 0], BTN_TOOL | 16); // BTN_AUTOAIM
    const aim = w.readGameHud(0).aim;
    expect(aim[0]).toBeCloseTo(b.origin[0] + 5, 0);
    expect(aim[2]).toBeCloseTo(b.origin[2] + 5, 0);
    expect(w.kitchen.store.get(b.id)).toBeUndefined(); // the cut happened
  });
});

describe('gauges and prompts', () => {
  it('shows a gauge for food on the rock only, and prompts match the context', () => {
    const w = world('service');
    const d = new Driver(w);
    expect(w.readGameHud(0).prompt).toBeNull();
    d.goToTable(PADS[0]!.x / 16);
    expect(w.readGameHud(0).prompt?.kind).toBe('take');
    d.press(BTN_GRAB);
    expect(w.readGameHud(0).gauges).toEqual([]);
    expect(w.readGameHud(0).prompt).toBeNull(); // carrying, nothing to do here
    d.walkX((ROCK.x0 + ROCK.w / 2) / 16);
    d.faceNorth();
    d.press(BTN_GRAB);
    d.idle(200);
    const gs = w.readGameHud(0).gauges;
    expect(gs.length).toBe(1);
    expect(gs[0]!.perfectLo).toBeLessThan(gs[0]!.perfectHi);
    expect(gs[0]!.doneMarker).toBeGreaterThan(0);
  });
});

/** Scripted service run: cook a mushroom, serve it, then idle past a craving expiry. */
function script(w: SimWorld, snapAt?: number): SimWorld {
  let cur = w;
  const d = new Driver(cur);
  let snapped = false;
  const maybeSnap = (): void => {
    if (snapAt !== undefined && !snapped && d.w.tick >= snapAt) {
      snapped = true;
      const r = SimWorld.restore(d.w.snapshot());
      expect(r.stateHash()).toBe(d.w.stateHash());
      d.w = r;
      cur = r;
    }
  };
  const run = (n: number): void => {
    for (let i = 0; i < n; i++) {
      d.idle(1);
      maybeSnap();
    }
  };
  d.goToTable(PADS[0]!.x / 16);
  d.press(BTN_GRAB);
  d.walkX((ROCK.x0 + ROCK.w / 2) / 16);
  d.faceNorth();
  d.press(BTN_GRAB);
  run(340);
  d.press(BTN_GRAB);
  d.walkX(MOUTH_M.x);
  d.faceNorth();
  d.press(BTN_GRAB);
  run(1800);
  return d.w;
}

describe('determinism', () => {
  it('same seed + scripted inputs gives the same hash; snapshot/restore mid-service matches', () => {
    const h1 = script(world('service')).stateHash();
    expect(script(world('service')).stateHash()).toBe(h1);
    expect(script(world('service'), 200).stateHash()).toBe(h1);
    expect(script(world('service'), 700).stateHash()).toBe(h1);
    expect(script(world('service'), 1500).stateHash()).toBe(h1);
    expect(script(world('service', 8)).stateHash()).not.toBe(h1);
  });
  it('restores the game state, held pile and phase exactly', () => {
    const w = world('service');
    const d = new Driver(w);
    box(w, [6, 4, 6], -22, -44);
    box(w, [6, 4, 6], -16, -44);
    d.goToTable(-17 / 16);
    d.press(BTN_GRAB);
    expect(w.kitchen.groupN[0]).toBe(2);
    d.idle(100);
    const r = SimWorld.restore(w.snapshot());
    expect(r.readGameHud(0)).toEqual(w.readGameHud(0));
    expect(r.kitchen.groupN[0]).toBe(2);
    expect(r.phase).toBe('service');
    const store = new FoodStore();
    expect(store.size).toBe(0);
  });
});
