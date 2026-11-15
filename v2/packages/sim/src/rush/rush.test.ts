import { describe, expect, it } from 'vitest';
import { RB_A, RB_B, RB_X, RushSim, idleRushInput, runBots, streakMultiplier, type BotRole, type RushEvent, type RushInput } from './index.js';
import { rushLevelById } from '@ga/content';

const press = (buttons: number, extra: Partial<RushInput> = {}): RushInput => ({ ...idleRushInput(), buttons, ...extra });

/** Run `n` idle ticks, collecting events. */
function idle(sim: RushSim, n: number, inputs: () => RushInput[] = () => [idleRushInput()]): RushEvent[] {
  const out: RushEvent[] = [];
  for (let i = 0; i < n; i++) out.push(...sim.step(inputs()));
  return out;
}

/** Start playing immediately (skips the countdown). */
function playing(players = 1, seed = 7): RushSim {
  const sim = new RushSim({ seed, players });
  idle(sim, 95);
  expect(sim.phase).toBe('playing');
  return sim;
}

/** Stand in front of station `id` (south of it) facing it and tap A. */
function tapA(sim: RushSim, id: string, slot = 0): RushEvent[] {
  const i = sim.stationIndex(id);
  const st = sim.stations[i]!;
  if (['pass', 'counter_e1', 'counter_e2'].includes(id)) sim.placeChef(slot, st.x - 1.0, st.z, 1, 0);
  else if (id === 'bin') sim.placeChef(slot, 3.5, -1.0, 0, -1);
  else sim.placeChef(slot, st.x, st.z + 1.0, 0, -1);
  const a = sim.step([press(RB_A)]);
  return [...a, ...sim.step([idleRushInput()])];
}

describe('rush: items, chop, cook, burn', () => {
  it('chops a potato on the board in 1.6 s while X is held', () => {
    const sim = playing();
    sim.giveItem(0, 'potato');
    tapA(sim, 'board_1');
    const board = sim.stations[sim.stationIndex('board_1')]!;
    expect(sim.items.get(board.socket)!.def).toBe('potato');
    let done = false;
    for (let i = 0; i < 47; i++) sim.step([press(RB_X)]);
    expect(sim.items.get(board.socket)!.def).toBe('potato');
    expect(sim.items.get(board.socket)!.progress).toBeGreaterThan(240);
    for (let i = 0; i < 3; i++) if (sim.step([press(RB_X)]).some((e) => e.kind === 'ChopDone')) done = true;
    expect(done).toBe(true);
    expect(sim.items.get(board.socket)!.def).toBe('raw_fries');
    expect(sim.items.get(board.socket)!.state).toBe('chopped');
  });

  it('chop progress is kept when X is released and resumes', () => {
    const sim = playing();
    sim.giveItem(0, 'potato');
    tapA(sim, 'board_1');
    for (let i = 0; i < 20; i++) sim.step([press(RB_X)]);
    idle(sim, 30);
    for (let i = 0; i < 28; i++) sim.step([press(RB_X)]);
    const board = sim.stations[sim.stationIndex('board_1')]!;
    expect(sim.items.get(board.socket)!.def).toBe('raw_fries');
  });

  it('cooks in 5 s, warns, then burns after the 6 s window', () => {
    const sim = playing();
    sim.putItem('fryer_1', 'raw_fries', 'chopped');
    const fr = sim.stations[sim.stationIndex('fryer_1')]!;
    const evs = idle(sim, 149);
    expect(sim.items.get(fr.socket)!.state).toBe('cooking');
    evs.push(...idle(sim, 1));
    expect(sim.items.get(fr.socket)!.def).toBe('cooked_fries');
    expect(sim.items.get(fr.socket)!.state).toBe('cooked');
    expect(evs.filter((e) => e.kind === 'CookStart')).toHaveLength(1);
    expect(evs.filter((e) => e.kind === 'Cooked')).toHaveLength(1);
    const burn = idle(sim, 119);
    expect(sim.items.get(fr.socket)!.state).toBe('cooked');
    burn.push(...idle(sim, 1));
    expect(sim.items.get(fr.socket)!.state).toBe('burning');
    expect(burn.some((e) => e.kind === 'BurnWarning')).toBe(true);
    burn.push(...idle(sim, 59));
    expect(sim.items.get(fr.socket)!.state).toBe('burning');
    burn.push(...idle(sim, 1));
    expect(sim.items.get(fr.socket)!.state).toBe('burnt');
    expect(burn.some((e) => e.kind === 'Burnt')).toBe(true);
  });

  it('a held (taken) cooking item pauses and resumes when put back', () => {
    const sim = playing();
    sim.putItem('fryer_1', 'raw_fries', 'chopped');
    idle(sim, 60);
    tapA(sim, 'fryer_1');
    const held = sim.items.get(sim.chefs[0]!.held)!;
    const ticks = held.ticks;
    expect(ticks).toBeGreaterThan(50);
    idle(sim, 100);
    expect(held.ticks).toBe(ticks);
    tapA(sim, 'fryer_1');
    let n = 0;
    while (held.def === 'raw_fries' && n < 400) {
      idle(sim, 1);
      n++;
    }
    expect(Math.abs(n - (150 - ticks))).toBeLessThanOrEqual(3);
    expect(held.def).toBe('cooked_fries');
  });

  it('the fryer refuses cooked fries and plates; the board refuses a plate', () => {
    const sim = playing();
    sim.giveItem(0, 'cooked_fries', 'cooked');
    expect(tapA(sim, 'fryer_1').some((e) => e.kind === 'Refused')).toBe(true);
    sim.giveItem(0, 'plate');
    expect(tapA(sim, 'board_1').some((e) => e.kind === 'Refused')).toBe(true);
    expect(sim.chefs[0]!.held).toBeGreaterThan(-1);
  });
});

describe('rush: plating rules', () => {
  it('plate accepts cooked fries once, refuses raw, burnt and duplicates', () => {
    const sim = playing();
    const plate = sim.giveItem(0, 'plate');
    sim.putItem('counter_e1', 'raw_fries', 'chopped');
    expect(tapA(sim, 'counter_e1').some((e) => e.kind === 'Refused')).toBe(true);
    expect(plate.contents).toEqual([]);
    sim.putItem('counter_e1', 'cooked_fries', 'burnt');
    const ev = tapA(sim, 'counter_e1');
    expect(ev.find((e) => e.kind === 'Refused')).toMatchObject({ reason: 'burnt' });
    sim.putItem('counter_e1', 'cooked_fries', 'cooked');
    expect(tapA(sim, 'counter_e1').some((e) => e.kind === 'Plated')).toBe(true);
    expect(plate.contents).toEqual(['cooked_fries']);
    sim.putItem('counter_e1', 'cooked_fries', 'cooked');
    expect(tapA(sim, 'counter_e1').some((e) => e.kind === 'Refused')).toBe(true);
  });

  it('both plating routes work: drop fries onto a plate on a counter, or scoop from the fryer', () => {
    const sim = playing();
    sim.putItem('counter_e2', 'plate');
    sim.giveItem(0, 'cooked_fries', 'cooked');
    tapA(sim, 'counter_e2');
    expect(sim.items.get(sim.stations[sim.stationIndex('counter_e2')]!.socket)!.contents).toEqual(['cooked_fries']);
    expect(sim.chefs[0]!.held).toBe(-1);
    const plate = sim.giveItem(0, 'plate');
    sim.putItem('fryer_2', 'cooked_fries', 'burning');
    tapA(sim, 'fryer_2');
    expect(plate.contents).toEqual(['cooked_fries']);
    expect(sim.stations[sim.stationIndex('fryer_2')]!.socket).toBe(-1);
  });

  it('the bin empties a plate but keeps it, and destroys other items', () => {
    const sim = playing();
    const plate = sim.giveItem(0, 'plate', undefined, ['cooked_fries']);
    tapA(sim, 'bin');
    expect(plate.contents).toEqual([]);
    expect(sim.chefs[0]!.held).toBe(plate.id);
    sim.giveItem(0, 'cooked_fries', 'burnt');
    tapA(sim, 'bin');
    expect(sim.chefs[0]!.held).toBe(-1);
  });

  it('a plate dispenser and crate give items only to empty hands', () => {
    const sim = playing();
    expect(tapA(sim, 'plates').some((e) => e.kind === 'Grabbed')).toBe(true);
    expect(tapA(sim, 'crate_potato').some((e) => e.kind === 'Refused')).toBe(true);
  });
});

describe('rush: serving and scoring', () => {
  const fries = (sim: RushSim): void => void sim.giveItem(0, 'plate', undefined, ['cooked_fries']);

  it('serves a matching plate: 100 + min(30, secondsLeft / 2) at x1', () => {
    const sim = playing();
    expect(sim.tickets).toHaveLength(1);
    fries(sim);
    const left = sim.tickets[0]!.left;
    const ev = tapA(sim, 'pass');
    const served = ev.find((e) => e.kind === 'Served');
    expect(served).toBeDefined();
    const secondsLeft = Math.floor(left / 30);
    expect(sim.score).toBe(100 + Math.min(30, Math.floor(secondsLeft / 2)));
    expect(sim.streak).toBe(1);
    expect(sim.tickets.some((t) => t.id === 1)).toBe(false);
    expect(sim.chefs[0]!.held).toBe(-1);
  });

  it('refuses an empty plate or a burnt item with -20, keeps it in hand and resets the streak', () => {
    const sim = playing();
    sim.streak = 4;
    sim.score = 100;
    const plate = sim.giveItem(0, 'plate');
    const ev = tapA(sim, 'pass');
    expect(ev.some((e) => e.kind === 'WrongDish')).toBe(true);
    expect(sim.score).toBe(80);
    expect(sim.streak).toBe(0);
    expect(sim.chefs[0]!.held).toBe(plate.id);
    sim.giveItem(0, 'cooked_fries', 'burnt');
    tapA(sim, 'pass');
    expect(sim.score).toBe(60);
  });

  it('a loose ingredient at the pass is simply refused (no penalty)', () => {
    const sim = playing();
    sim.giveItem(0, 'potato');
    const ev = tapA(sim, 'pass');
    expect(ev.some((e) => e.kind === 'Refused')).toBe(true);
    expect(sim.score).toBe(0);
  });

  it('streak multiplier steps at 3, 6 and 10 consecutive serves', () => {
    const level = rushLevelById('l01_kiosque')!.level;
    expect([0, 2, 3, 5, 6, 9, 10, 20].map((n) => streakMultiplier(level, n))).toEqual([1000, 1000, 1250, 1250, 1500, 1500, 2000, 2000]);
    const sim = playing();
    sim.streak = 3;
    fries(sim);
    const left = sim.tickets[0]!.left;
    tapA(sim, 'pass');
    const bonus = Math.min(30, Math.floor(Math.floor(left / 30) / 2));
    expect(sim.score).toBe(Math.floor(((100 + bonus) * 1250) / 1000));
  });

  it('serves the ticket with the least time left', () => {
    const sim = playing(2, 3);
    idle(sim, 26 * 30, () => [idleRushInput(), idleRushInput()]);
    // The first ticket is older, so it is the one that gets served.
    expect(sim.tickets.length).toBeGreaterThanOrEqual(2);
    const oldest = [...sim.tickets].sort((a, b) => a.left - b.left)[0]!.id;
    fries(sim);
    const ev = tapA(sim, 'pass');
    expect(ev.find((e) => e.kind === 'Served')).toMatchObject({ ticket: oldest });
  });

  it('expired tickets cost 50 and reset the streak', () => {
    const sim = playing();
    sim.score = 200;
    sim.streak = 5;
    const left = sim.tickets[0]!.left;
    const ev = idle(sim, left);
    expect(ev.some((e) => e.kind === 'TicketExpired')).toBe(true);
    expect(sim.score).toBe(150);
    expect(sim.streak).toBe(0);
    expect(sim.expired).toBe(1);
  });

  it('ends after 180 s with stars from the bucket thresholds', () => {
    const sim = new RushSim({ seed: 1, players: 1 });
    let ended = false;
    for (let i = 0; i < 90 + 5400 + 5; i++) if (sim.step([idleRushInput()]).some((e) => e.kind === 'TimeUp')) ended = true;
    expect(ended).toBe(true);
    expect(sim.phase).toBe('ended');
    expect(sim.view().stars).toBe(0);
    sim.score = 10_000;
    expect(sim.view().stars).toBe(3);
  });
});

describe('rush: ticket pacing', () => {
  const firstTicketTicks = (seed: number, players: number, ticks: number): number[] => {
    const sim = new RushSim({ seed, players });
    const at: number[] = [];
    for (let i = 0; i < ticks; i++) for (const e of sim.step(Array.from({ length: players }, () => idleRushInput()))) if (e.kind === 'TicketNew') at.push(sim.tick);
    return at;
  };

  it('same seed gives the same ticket sequence; another seed differs', () => {
    const a = firstTicketTicks(11, 2, 3000);
    expect(firstTicketTicks(11, 2, 3000)).toEqual(a);
    expect(a.length).toBeGreaterThan(1);
    const seqs = new Set([1, 2, 3, 4, 5, 6].map((s) => firstTicketTicks(s, 3, 3000).join(',')));
    expect(seqs.size).toBeGreaterThan(1);
  });

  it('opens safely: ticket 1 at t=0, ticket 2 only after 25 s when nothing is served', () => {
    for (const seed of [1, 2, 3]) {
      const at = firstTicketTicks(seed, 1, 3000);
      expect(at[0]).toBe(90);
      expect(at[1]).toBe(at[0]! + 25 * 30 - 1); // 25 s of play after the Go tick
    }
  });

  it('serving the first ticket opens the second right away', () => {
    const sim = playing();
    sim.giveItem(0, 'plate', undefined, ['cooked_fries']);
    tapA(sim, 'pass');
    idle(sim, 2);
    expect(sim.tickets.length).toBe(1);
  });

  it('never exceeds the bucket max of active tickets', () => {
    for (const players of [1, 2, 3]) {
      const sim = new RushSim({ seed: 5, players });
      let max = 0;
      for (let i = 0; i < 5000; i++) {
        sim.step(Array.from({ length: players }, () => idleRushInput()));
        max = Math.max(max, sim.tickets.length);
      }
      expect(max).toBeLessThanOrEqual(sim.level.buckets[sim.bucket]!.maxActive);
    }
  });

  it('maps player counts to buckets and enables optional stations from squad up', () => {
    expect(new RushSim({ seed: 1, players: 1 }).bucket).toBe('solo');
    expect(new RushSim({ seed: 1, players: 2 }).bucket).toBe('duo');
    expect(new RushSim({ seed: 1, players: 4 }).bucket).toBe('squad');
    const solo = new RushSim({ seed: 1, players: 1 });
    expect(solo.stations.filter((s) => s.def === 'fryer')).toHaveLength(2);
    const squad = new RushSim({ seed: 1, players: 3 });
    expect(squad.stations.filter((s) => s.def === 'fryer')).toHaveLength(3);
    expect(squad.stations.filter((s) => s.def === 'board')).toHaveLength(2);
  });
});

describe('rush: movement, collision, mouse and dash', () => {
  it('chefs cannot walk through counters', () => {
    const sim = playing();
    sim.placeChef(0, 0, -0.8);
    for (let i = 0; i < 60; i++) sim.step([{ ...idleRushInput(), move: [0, -127] }]);
    const c = sim.chefs[0]!;
    expect(c.z).toBeGreaterThanOrEqual(-1.5 + 0.35 - 1e-6);
  });

  it('chefs collide with each other', () => {
    const sim = playing(2);
    sim.placeChef(0, 0, 0.5);
    sim.placeChef(1, 1.5, 0.5);
    for (let i = 0; i < 60; i++) sim.step([{ ...idleRushInput(), move: [127, 0] }, idleRushInput()]);
    const a = sim.chefs[0]!;
    const b = sim.chefs[1]!;
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(0.69);
  });

  it('click-to-walk reaches a far station and interacts on arrival', () => {
    const sim = playing();
    sim.placeChef(0, 3, 1.5);
    const crate = sim.stationIndex('crate_potato');
    sim.step([{ ...idleRushInput(), click: crate, clickSeq: 1 }]);
    const ev = idle(sim, 200);
    expect(ev.some((e) => e.kind === 'Grabbed' && e.def === 'potato')).toBe(true);
    expect(sim.chefs[0]!.held).toBeGreaterThan(-1);
  });

  it('a right-click walk goes there without interacting; holding X then chops', () => {
    const sim = playing();
    sim.putItem('board_1', 'potato');
    sim.placeChef(0, 2, 1.5);
    const board = sim.stationIndex('board_1');
    sim.step([{ ...idleRushInput(), click: board, clickKind: 1, clickSeq: 1 }]);
    const ev = idle(sim, 200, () => [press(RB_X)]);
    expect(ev.some((e) => e.kind === 'ChopDone')).toBe(true);
    expect(sim.chefs[0]!.held).toBe(-1);
  });

  it('stick input cancels a click-to-walk', () => {
    const sim = playing();
    sim.placeChef(0, 3, 1.5);
    sim.step([{ ...idleRushInput(), click: sim.stationIndex('crate_potato'), clickSeq: 1 }]);
    expect(sim.view().chefs[0]!.walking).toBe(true);
    sim.step([{ ...idleRushInput(), move: [127, 0] }]);
    expect(sim.view().chefs[0]!.walking).toBe(false);
  });

  it('dash covers extra distance and has a 0.6 s cooldown', () => {
    const sim = playing();
    sim.placeChef(0, -2, 1, 1, 0);
    const x0 = sim.chefs[0]!.x;
    sim.step([press(RB_B, { move: [127, 0] })]);
    expect(sim.view().chefs[0]!.dashing).toBe(true);
    for (let i = 0; i < 7; i++) sim.step([{ ...idleRushInput(), move: [127, 0] }]);
    expect(sim.chefs[0]!.x - x0).toBeGreaterThan(1.8);
    expect(sim.view().chefs[0]!.dashReady).toBe(false);
    idle(sim, 18);
    expect(sim.view().chefs[0]!.dashReady).toBe(true);
  });

  it('the target is the station in front, biased by facing', () => {
    const sim = playing();
    sim.placeChef(0, -1.0, -0.8, 0, -1); // below the board/counter seam, facing north
    sim.step([idleRushInput()]);
    expect(sim.stations[sim.chefs[0]!.target]!.id).toBe('board_1');
  });
});

describe('rush: bot plays the level', () => {
  const rolesFor = (n: number): BotRole[] => (n === 1 ? ['all'] : ['prep', 'serve']);
  const run = (players: number, seed: number): RushSim => {
    const sim = new RushSim({ seed, players });
    runBots(sim, rolesFor(players));
    return sim;
  };
  const SEEDS = [1, 2, 3, 4, 5];

  it('state hash after a full bot run is identical across two runs', () => {
    for (const players of [1, 2]) {
      const a = run(players, 42);
      const b = run(players, 42);
      expect(a.stateHash()).toBe(b.stateHash());
      expect(a.score).toBe(b.score);
      expect(a.phase).toBe('ended');
    }
    expect(run(1, 42).stateHash()).not.toBe(run(1, 43).stateHash());
  });

  it('solo and duo bots clear 3 stars; thresholds are about 75 / 55 / 30 % of the bot mean', () => {
    const level = rushLevelById('l01_kiosque')!.level;
    for (const [players, bucket] of [[1, 'solo'], [2, 'duo']] as const) {
      const scores = SEEDS.map((s) => run(players, s).score);
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      const [s1, s2, s3] = level.stars[bucket];
      expect(Math.min(...scores)).toBeGreaterThanOrEqual(s3 * 0.9);
      expect(mean).toBeGreaterThanOrEqual(s3 / 0.75 - 0.02 * mean);
      expect(Math.abs(s3 / mean - 0.75)).toBeLessThan(0.08);
      expect(Math.abs(s2 / mean - 0.55)).toBeLessThan(0.08);
      expect(Math.abs(s1 / mean - 0.3)).toBeLessThan(0.08);
      for (const s of SEEDS) expect(run(players, s).view().stars).toBe(3);
    }
  });
});
