import { SIM_HZ } from '@ga/shared';
import { RB_X, type ItemView, type RushInput, type RushView, type StationView } from './types.js';
import type { RushSim } from './sim.js';

/**
 * Scripted player for tests and star tuning. It only uses what a human has: the view, click-to-walk and the X button.
 * Roles: 'all' does everything (solo); with two bots 'prep' does potato -> board -> fryer and 'serve' does plates, scoops and the pass.
 */
export type BotRole = 'all' | 'prep' | 'serve';

const isFries = (it: ItemView | null, state?: string): boolean => !!it && it.def === 'cooked_fries' && (state ? it.state === state : it.state !== 'burnt');

export class RushBot {
  private seq = 0;
  private waitUntil = 0;
  private chopping = -1;
  private last: { held: number; sig: string } = { held: -2, sig: '' };
  private step = 0;
  private lastTick = -1;

  constructor(
    readonly slot: number,
    readonly role: BotRole = 'all',
  ) {}

  /** One input frame for this tick. */
  act(sim: RushSim): RushInput {
    const v = sim.view();
    const me = v.chefs[this.slot]!;
    const input: RushInput = { move: [0, 0], buttons: 0, click: -1, clickSeq: this.seq, clickKind: 0 };
    // Keep holding X while chopping.
    if (this.chopping >= 0) {
      const st = v.stations[this.chopping]!;
      const done = !st.item || st.item.def !== 'potato' || me.held !== null;
      if (done || sim.tick - this.step > 120) this.chopping = -1;
      else {
        input.buttons |= RB_X;
        return input;
      }
    }
    if (me.walking) return input;
    if (sim.tick < this.waitUntil) return input;
    const sig = `${me.held?.id ?? -1}:${me.held?.contents.join(',') ?? ''}:${v.stations.map((s) => s.item?.id ?? -1).join(',')}`;
    void sig;
    const go = (st: StationView | undefined, kind: 0 | 1 = 0, waitTicks = 3): RushInput => {
      if (!st) return input;
      this.seq = (this.seq + 1) & 0xffff;
      input.click = st.index;
      input.clickKind = kind;
      input.clickSeq = this.seq;
      this.waitUntil = sim.tick + waitTicks;
      this.step = sim.tick;
      return input;
    };
    const act = this.decide(v, go, sim);
    this.lastTick = sim.tick;
    return act ?? input;
  }

  private decide(v: RushView, go: (st: StationView | undefined, kind?: 0 | 1, wait?: number) => RushInput, sim: RushSim): RushInput | null {
    const me = v.chefs[this.slot]!;
    const held = me.held;
    const by = (def: string): StationView[] => v.stations.filter((s) => s.def === def && s.enabled);
    const boards = by('board');
    const fryers = by('fryer');
    const plates = by('plates')[0];
    const crate = v.stations.find((s) => s.id.startsWith('crate'));
    const pass = by('pass')[0];
    const bin = by('bin')[0];
    const counters = by('counter');
    const dist = (s: StationView): number => {
      const ls = sim.stations[s.index]!;
      return (ls.x - me.x) * (ls.x - me.x) + (ls.z - me.z) * (ls.z - me.z);
    };
    const nearest = (list: StationView[]): StationView | undefined => [...list].sort((a, b) => dist(a) - dist(b) || a.index - b.index)[0];
    const otherHolds = (st: StationView): boolean => v.chefs.some((c) => c.slot !== this.slot && c.walking && c.target === st.index);

    const cookedFryers = fryers.filter((f) => isFries(f.item) && f.item!.state !== 'burnt');
    const burntFryers = fryers.filter((f) => f.item && f.item.state === 'burnt');
    const cookingFryers = fryers.filter((f) => f.item && (f.item.state === 'cooking' || f.item.state === 'chopped' || f.item.state === 'raw') && f.item.def === 'raw_fries');
    const emptyFryers = fryers.filter((f) => !f.item && !otherHolds(f));
    const potatoBoards = boards.filter((b) => b.item && b.item.def === 'potato');
    const readyBoards = boards.filter((b) => b.item && b.item.def === 'raw_fries');
    const emptyBoards = boards.filter((b) => !b.item && !otherHolds(b));
    const platedOnCounter = counters.filter((c) => c.item && c.item.def === 'plate' && c.item.contents.includes('cooked_fries'));

    // Units of fries anywhere in the pipeline.
    let units = 0;
    const countItem = (it: ItemView | null): void => {
      if (!it) return;
      if (it.def === 'potato' || it.def === 'raw_fries' || isFries(it)) units++;
      else if (it.def === 'plate' && it.contents.includes('cooked_fries')) units++;
    };
    for (const s of v.stations) countItem(s.item);
    for (const c of v.chefs) countItem(c.held);
    const secondsLeft = v.timeLeftTicks / SIM_HZ;
    const want = v.tickets.length + (secondsLeft > 20 ? 1 : 0);
    const prep = this.role !== 'serve';
    const serve = this.role !== 'prep';

    // ---- hands full
    if (held) {
      if (held.def === 'plate') {
        if (held.contents.includes('cooked_fries')) {
          if (v.tickets.length > 0) return go(pass, 0, 4);
          const free = counters.filter((c) => !c.item && !otherHolds(c));
          return go(nearest([...free].filter((c) => c.id.startsWith('counter_e'))) ?? nearest(free), 0, 4);
        }
        if (!serve) return go(nearest(counters), 0, 4);
        if (cookedFryers.length > 0) return go(nearest(cookedFryers), 0, 4);
        if (cookingFryers.length > 0) {
          // wait at the fryer that finishes first
          const f = [...cookingFryers].sort((a, b) => b.item!.progress - a.item!.progress)[0]!;
          const ls = sim.stations[f.index]!;
          const d = (ls.x - me.x) * (ls.x - me.x) + (ls.z - me.z) * (ls.z - me.z);
          if (d > 1.4) return go(f, 1, 6);
          return null;
        }
        if (v.tickets.length === 0 && units === 0) return go(bin, 0, 4);
        return null;
      }
      if (held.def === 'potato') {
        const b = nearest(emptyBoards);
        if (b) return go(b, 0, 4);
        return null;
      }
      if (held.def === 'raw_fries') {
        const f = nearest(emptyFryers);
        if (f) return go(f, 0, 4);
        return null;
      }
      return go(bin, 0, 4);
    }

    // ---- hands empty
    if (serve) {
      if (burntFryers.length > 0) return go(nearest(burntFryers), 0, 4);
    }
    if (serve && platedOnCounter.length > 0 && v.tickets.length > 0) return go(nearest(platedOnCounter), 0, 4);
    const urgentCooked = cookedFryers.filter((f) => f.item!.progress > 140);
    if (serve && (urgentCooked.length > 0 || (cookedFryers.length > 0 && readyBoards.length === 0 && potatoBoards.length === 0))) {
      if (platedOnCounter.length > 0 && v.tickets.length === 0) return go(nearest(platedOnCounter), 0, 4);
      return go(plates, 0, 4);
    }
    if (prep) {
      if (readyBoards.length > 0 && emptyFryers.length > 0) return go(nearest(readyBoards), 0, 4);
      if (potatoBoards.length > 0) {
        const b = nearest(potatoBoards)!;
        this.chopping = b.index;
        this.step = sim.tick;
        return go(b, 1, 2);
      }
    }
    if (serve && cookedFryers.length > 0) return go(plates, 0, 4);
    if (prep && units < want && emptyBoards.length > 0 && (emptyFryers.length > 0 || cookingFryers.length < fryers.length)) return go(crate, 0, 4);
    if (serve && platedOnCounter.length > 0) return go(nearest(platedOnCounter), 0, 4);
    if (serve && (cookingFryers.length > 0 || cookedFryers.length > 0)) return go(plates, 0, 4);
    return null;
  }
}

/** Run a bot team for the whole level and return the final sim. `seed` picks the ticket sequence. */
export function runBots(sim: RushSim, roles: BotRole[], maxTicks = 10000): void {
  const bots = roles.map((r, i) => new RushBot(i, r));
  while (sim.phase !== 'ended' && sim.tick < maxTicks) {
    const inputs = bots.map((b) => b.act(sim));
    sim.step(inputs);
  }
}
