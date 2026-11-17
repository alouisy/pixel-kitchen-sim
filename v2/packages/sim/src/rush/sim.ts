import {
  rushItemById,
  rushLevelById,
  rushRecipeById,
  rushStationById,
  type BucketId,
  type ItemDef,
  type LayoutStation,
  type RushLevel,
  type Recipe,
} from '@ga/content';
import { Hasher64, Prng, SIM_DT, SIM_HZ, clamp, fsqrt } from '@ga/shared';
import { WalkGrid, distToBox, pushOutOfBox, type Box } from './grid.js';
import { nextOrderDelayTicks } from './pacing.js';
import {
  RB_A,
  RB_B,
  RB_X,
  type ChefView,
  type ItemState,
  type ItemView,
  type RefuseReason,
  type RushEvent,
  type RushInput,
  type RushItem,
  type RushPhase,
  type RushView,
  type StationView,
  type TicketView,
  type Verb,
} from './types.js';

export const CHEF_RADIUS = 0.35;
const ACCEL_RAMP_S = 0.08;
const CHOP_HIT_EVERY = 8;
const STICK_CANCEL = 0.3;
const WALK_TIMEOUT_TICKS = 600;
const STUCK_TICKS = 75;
const WAYPOINT_EPS = 0.2;

export interface RushOptions {
  seed: number;
  players: number;
  /** Defaults to level 1. */
  level?: RushLevel;
}

interface StationRt {
  index: number;
  id: string;
  /** Effective def (disabled optional stations act as counters). */
  def: string;
  kind: string;
  process: string | undefined;
  enabled: boolean;
  x: number;
  z: number;
  box: Box;
  dispenses: string | undefined;
  socket: number;
}

interface ChefRt {
  x: number;
  z: number;
  vx: number;
  vz: number;
  fx: number;
  fz: number;
  held: number;
  dashLeft: number;
  dashCd: number;
  dashX: number;
  dashZ: number;
  lastButtons: number;
  lastClickSeq: number;
  walkTarget: number;
  walkKind: 0 | 1;
  path: number[];
  walkTicks: number;
  stuck: number;
  chopping: boolean;
  /** Station the chef walked to; stays the target until the stick moves. */
  sticky: number;
  target: number;
  verb: Verb;
  canChop: boolean;
}

interface TicketRt {
  id: number;
  recipe: string;
  left: number;
  total: number;
}

export function bucketForPlayers(level: RushLevel['level'], players: number): BucketId {
  for (const b of ['solo', 'duo', 'squad', 'party'] as const) {
    const cfg = level.buckets[b];
    if (cfg && players >= cfg.players[0] && players <= cfg.players[1]) return b;
  }
  return 'party';
}

export function streakMultiplier(level: RushLevel['level'], streak: number): number {
  let m = 1000;
  for (const [n, mult] of level.scoring.streakSteps) if (streak >= n) m = mult;
  return m;
}

const secs = (s: number): number => Math.round(s * SIM_HZ);

function approach(current: number, target: number, maxDelta: number): number {
  const d = target - current;
  if (d > maxDelta) return current + maxDelta;
  if (d < -maxDelta) return current - maxDelta;
  return target;
}

/** The rush simulation: chefs, stations, items, tickets and score on a fixed 30 Hz tick. Pure data in, events and views out. */
export class RushSim {
  readonly level: RushLevel['level'];
  readonly layout: RushLevel['layout'];
  readonly bucket: BucketId;
  readonly players: number;
  readonly recipes: Recipe[];
  readonly stations: StationRt[] = [];
  readonly chefs: ChefRt[] = [];
  readonly items = new Map<number, RushItem>();
  readonly tickets: TicketRt[] = [];
  readonly grid: WalkGrid;

  tick = 0;
  phase: RushPhase = 'countdown';
  score = 0;
  streak = 0;
  served = 0;
  expired = 0;
  wrong = 0;
  timeLeft: number;

  private countdownTicks: number;
  private nextItemId = 1;
  private nextTicketId = 1;
  private rng: Prng;
  private spawned = 0;
  private openingDone = false;
  private nextSpawnTick = 0;
  private playTick = 0;
  private readonly maxActive: number;
  private readonly ticketMul: number;
  private readonly chopTicks: number;
  private readonly burnWarnTicks: number;
  private readonly dashCdTicks: number;
  private readonly bounds: Box;

  constructor(opts: RushOptions) {
    const rl = opts.level ?? rushLevelById('l01_kiosque')!;
    this.level = rl.level;
    this.layout = rl.layout;
    this.players = opts.players;
    this.bucket = bucketForPlayers(this.level, opts.players);
    const cfg = this.level.buckets[this.bucket]!;
    this.maxActive = cfg.maxActive;
    this.ticketMul = cfg.ticketTimeMul;
    this.recipes = this.level.recipes.map((id) => rushRecipeById.get(id)!);
    this.rng = new Prng(opts.seed).split('rush');
    const tu = this.level.tuning;
    this.chopTicks = secs(tu.chopSeconds);
    this.burnWarnTicks = secs(tu.burnWarnSeconds);
    this.dashCdTicks = secs(tu.dashCooldownSeconds);
    this.bounds = this.layout.bounds;
    this.countdownTicks = secs(this.level.countdownSeconds);
    this.timeLeft = secs(this.level.durationSeconds);

    const order = ['squad', 'party'];
    const bucketRank = (b: string): number => (b === 'solo' || b === 'duo' ? 0 : order.indexOf(b) + 1);
    this.layout.stations.forEach((ls: LayoutStation, index) => {
      const enabled = !ls.optional || bucketRank(this.bucket) >= bucketRank(ls.optional);
      const def = enabled ? ls.def : 'counter';
      const sd = rushStationById.get(def)!;
      this.stations.push({
        index,
        id: ls.id,
        def,
        kind: sd.kind,
        process: sd.process,
        enabled,
        x: ls.x,
        z: ls.z,
        box: { x0: ls.x - ls.w / 2, x1: ls.x + ls.w / 2, z0: ls.z - ls.d / 2, z1: ls.z + ls.d / 2 },
        dispenses: enabled ? ls.dispenses : undefined,
        socket: -1,
      });
    });
    this.grid = new WalkGrid(
      this.bounds,
      this.layout.cell,
      this.stations.map((s) => s.box),
      CHEF_RADIUS + 0.01,
    );
    for (let slot = 0; slot < opts.players; slot++) {
      const sp = this.layout.spawns[slot % this.layout.spawns.length]!;
      this.chefs.push({
        x: sp[0], z: sp[1], vx: 0, vz: 0, fx: 0, fz: -1, held: -1,
        dashLeft: 0, dashCd: 0, dashX: 0, dashZ: 0, lastButtons: 0, lastClickSeq: 0,
        walkTarget: -1, walkKind: 0, path: [], walkTicks: 0, stuck: 0, chopping: false, sticky: -1, target: -1, verb: 'none', canChop: false,
      });
    }
  }

  // ------------------------------------------------------------------ data helpers

  private def(id: string): ItemDef {
    return rushItemById.get(id)!;
  }

  private newItem(def: string, holder: RushItem['holder']): RushItem {
    const item: RushItem = { id: this.nextItemId++, def, state: 'raw', progress: 0, ticks: 0, contents: [], burnTicks: 0, holder };
    const d = this.def(def);
    if (d.component && !d.cook) item.state = 'cooked';
    this.items.set(item.id, item);
    return item;
  }

  private removeItem(id: number): void {
    this.items.delete(id);
  }

  /** Items in a container may only be components that can still lead to an available recipe (docs/v2/05 §3). */
  canAdd(container: RushItem, comp: RushItem): 'ok' | 'burnt' | 'no' {
    const cd = this.def(container.def);
    const d = this.def(comp.def);
    if (!cd.container || !d.component || comp.state === 'cooking') return 'no';
    if (comp.state === 'burnt') return 'burnt';
    if (container.contents.includes(comp.def)) return 'no';
    const merged = new Set([...container.contents, comp.def]);
    for (const r of this.recipes) {
      if (r.container !== container.def) continue;
      let all = true;
      for (const c of merged) if (!r.components.includes(c)) all = false;
      if (all) return 'ok';
    }
    return 'no';
  }

  private accepts(st: StationRt, item: RushItem): boolean {
    const d = this.def(item.def);
    if (st.kind === 'counter') return true;
    if (st.kind !== 'processor') return false;
    if (st.process === 'chop') return !!d.chop && item.state === 'raw';
    return !!d.cook && d.cook.station === st.def && (item.state === 'raw' || item.state === 'chopped' || item.state === 'cooking');
  }

  // ------------------------------------------------------------------ targeting

  /** Station in front of the chef within reach, with a gentle bias to the facing direction. */
  private findTarget(c: ChefRt): number {
    const reach = this.level.tuning.reach;
    let best = -1;
    let bestScore = Infinity;
    for (const s of this.stations) {
      const px = clamp(c.x, s.box.x0, s.box.x1);
      const pz = clamp(c.z, s.box.z0, s.box.z1);
      const dx = px - c.x;
      const dz = pz - c.z;
      const dist = fsqrt(dx * dx + dz * dz);
      if (dist > reach) continue;
      const dot = dist > 1e-6 ? (dx / dist) * c.fx + (dz / dist) * c.fz : 1;
      if (dot < -0.1 && dist > 0.1) continue;
      const score = dist + (1 - dot) * 0.6;
      if (score < bestScore) {
        bestScore = score;
        best = s.index;
      }
    }
    return best;
  }

  private inReach(c: ChefRt, s: StationRt): boolean {
    return distToBox(c.x, c.z, s.box) <= this.level.tuning.reach;
  }

  // ------------------------------------------------------------------ interaction

  /** Evaluate (and with `apply` perform) the A button of chef `slot` on station `si`. */
  private interact(slot: number, si: number, apply: boolean, events: RushEvent[]): Verb {
    const c = this.chefs[slot]!;
    const st = this.stations[si];
    if (!st) return 'none';
    const hand = c.held >= 0 ? this.items.get(c.held)! : null;
    const refuse = (reason: RefuseReason): Verb => {
      if (apply) events.push({ kind: 'Refused', slot, reason });
      return 'none';
    };

    if (st.kind === 'dispenser') {
      if (hand) return refuse('hands_full');
      if (!st.dispenses) return 'none';
      if (apply) {
        const it = this.newItem(st.dispenses, { kind: 'chef', id: slot });
        c.held = it.id;
        events.push({ kind: 'Grabbed', slot, def: it.def });
      }
      return 'take';
    }
    if (st.kind === 'bin') {
      if (!hand) return 'none';
      if (apply) {
        if (this.def(hand.def).container) hand.contents = [];
        else {
          this.removeItem(hand.id);
          c.held = -1;
        }
        events.push({ kind: 'Trashed', slot });
      }
      return 'trash';
    }
    if (st.kind === 'pass') {
      if (!hand) return 'none';
      if (this.phase !== 'playing') return 'none';
      const isContainer = this.def(hand.def).container;
      if (!isContainer && hand.state !== 'burnt') return refuse('cannot_place');
      if (apply) this.serve(slot, hand, st, events);
      return 'serve';
    }

    // Socket stations: counter, board, fryer, ...
    const sock = st.socket >= 0 ? this.items.get(st.socket)! : null;
    if (!hand && !sock) return 'none';
    if (!hand && sock) {
      if (apply) {
        st.socket = -1;
        sock.holder = { kind: 'chef', id: slot };
        c.held = sock.id;
        events.push({ kind: 'Grabbed', slot, def: sock.def });
      }
      return 'take';
    }
    if (hand && !sock) {
      if (!this.accepts(st, hand)) return refuse('cannot_place');
      if (apply) {
        st.socket = hand.id;
        hand.holder = { kind: 'socket', id: st.index };
        c.held = -1;
        events.push({ kind: 'Placed', slot, station: st.index });
      }
      return 'place';
    }
    // Both hands and socket occupied.
    const h = hand!;
    const s = sock!;
    const hc = this.def(h.def).container;
    const sc = this.def(s.def).container;
    if (!hc && sc) {
      const r = this.canAdd(s, h);
      if (r !== 'ok') return refuse(r === 'burnt' ? 'burnt' : 'cannot_add');
      if (apply) {
        s.contents = [...s.contents, h.def].sort();
        this.removeItem(h.id);
        c.held = -1;
        events.push({ kind: 'Plated', slot, station: st.index });
      }
      return 'add';
    }
    if (hc && !sc) {
      const r = this.canAdd(h, s);
      if (r !== 'ok') return refuse(r === 'burnt' ? 'burnt' : 'cannot_add');
      if (apply) {
        h.contents = [...h.contents, s.def].sort();
        this.removeItem(s.id);
        st.socket = -1;
        events.push({ kind: 'Plated', slot, station: st.index });
      }
      return 'scoop';
    }
    return refuse('cannot_place');
  }

  private serve(slot: number, hand: RushItem, st: StationRt, events: RushEvent[]): void {
    const comps = hand.contents;
    let best: TicketRt | null = null;
    if (hand.state !== 'burnt' && comps.length > 0) {
      for (const t of this.tickets) {
        const r = rushRecipeById.get(t.recipe)!;
        if (r.container !== hand.def || r.components.length !== comps.length) continue;
        if (!r.components.every((x) => comps.includes(x))) continue;
        if (!best || t.left < best.left) best = t;
      }
    }
    if (!best) {
      const penalty = this.level.scoring.wrongPenalty;
      this.score = Math.max(0, this.score - penalty);
      this.streak = 0;
      this.wrong++;
      events.push({ kind: 'WrongDish', slot, penalty });
      return;
    }
    const r = rushRecipeById.get(best.recipe)!;
    const secondsLeft = Math.floor(best.left / SIM_HZ);
    const bonus = Math.min(this.level.scoring.speedBonusCap, Math.floor(secondsLeft / 2));
    const mult = streakMultiplier(this.level, this.streak);
    const points = Math.floor(((r.baseScore + bonus) * mult) / 1000);
    this.score += points;
    this.streak++;
    this.served++;
    this.tickets.splice(this.tickets.indexOf(best), 1);
    const c = this.chefs[slot]!;
    this.removeItem(hand.id);
    c.held = -1;
    void st;
    events.push({ kind: 'Served', slot, ticket: best.id, recipe: best.recipe, points, streak: this.streak, multPermille: mult, secondsLeft });
  }

  // ------------------------------------------------------------------ step

  step(inputs: ReadonlyArray<RushInput | undefined>): RushEvent[] {
    const events: RushEvent[] = [];
    this.tick = (this.tick + 1) >>> 0;

    if (this.phase === 'countdown') {
      if (this.countdownTicks % SIM_HZ === 0 && this.countdownTicks > 0) events.push({ kind: 'Countdown', n: this.countdownTicks / SIM_HZ });
      this.countdownTicks--;
      if (this.countdownTicks <= 0) {
        this.phase = 'playing';
        events.push({ kind: 'Go' });
        this.spawnTicket(events);
        this.nextSpawnTick = 0;
      }
    }

    for (let slot = 0; slot < this.chefs.length; slot++) {
      this.updateChef(slot, this.phase === 'ended' ? undefined : inputs[slot], events);
    }
    this.separateChefs();

    if (this.phase === 'playing') {
      this.playTick++;
      this.updateStations(events);
      this.updateTickets(events);
      this.timeLeft--;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.phase = 'ended';
        events.push({ kind: 'TimeUp', score: this.score, stars: this.starCount() });
      }
    }
    return events;
  }

  private updateChef(slot: number, input: RushInput | undefined, events: RushEvent[]): void {
    const c = this.chefs[slot]!;
    const tu = this.level.tuning;
    let mx = input ? input.move[0] / 127 : 0;
    let mz = input ? input.move[1] / 127 : 0;
    let len = fsqrt(mx * mx + mz * mz);
    if (len > 1) {
      mx /= len;
      mz /= len;
      len = 1;
    }
    const buttons = input ? input.buttons : 0;
    const pressed = buttons & ~c.lastButtons;
    c.lastButtons = buttons;

    // Click-to-walk.
    if (input && input.clickSeq !== c.lastClickSeq) {
      c.lastClickSeq = input.clickSeq;
      if (input.click >= 0 && input.click < this.stations.length) this.startWalk(c, input.click, input.clickKind);
    }
    if (len > STICK_CANCEL) {
      this.clearWalk(c);
      c.sticky = -1;
    }

    // Walking steers the chef when the stick is idle.
    let arrivedInteract = -1;
    if (c.walkTarget >= 0 && len <= STICK_CANCEL) {
      const st = this.stations[c.walkTarget]!;
      const reached = this.inReach(c, st) && (c.path.length === 0 || distToBox(c.x, c.z, st.box) <= 0.6);
      if (reached) {
        this.faceStation(c, st);
        if (c.walkKind === 0) arrivedInteract = c.walkTarget;
        c.sticky = c.walkTarget;
        c.walkTarget = -1;
        c.path = [];
      } else {
        while (c.path.length > 0) {
          const cell = c.path[0]!;
          const dx = this.grid.cx(cell % this.grid.cols) - c.x;
          const dz = this.grid.cz(Math.floor(cell / this.grid.cols)) - c.z;
          if (dx * dx + dz * dz < WAYPOINT_EPS * WAYPOINT_EPS) c.path.shift();
          else {
            const d = fsqrt(dx * dx + dz * dz);
            mx = dx / d;
            mz = dz / d;
            len = 1;
            break;
          }
        }
        c.walkTicks++;
        if (c.path.length === 0 && !this.inReach(c, st)) this.clearWalk(c);
        else if (c.walkTicks > WALK_TIMEOUT_TICKS) this.clearWalk(c);
      }
    }

    // Dash.
    if (c.dashCd > 0) c.dashCd--;
    if (pressed & RB_B && c.dashCd === 0 && c.dashLeft === 0) {
      c.dashLeft = tu.dashTicks;
      c.dashCd = this.dashCdTicks;
      if (len > 0.1) {
        c.dashX = mx / len;
        c.dashZ = mz / len;
      } else {
        c.dashX = c.fx;
        c.dashZ = c.fz;
      }
      events.push({ kind: 'Dash', slot });
    }

    // Velocity.
    const maxDelta = (tu.walkSpeed * SIM_DT) / ACCEL_RAMP_S;
    if (c.dashLeft > 0) {
      c.vx = c.dashX * tu.dashSpeed;
      c.vz = c.dashZ * tu.dashSpeed;
      c.dashLeft--;
    } else {
      c.vx = approach(c.vx, mx * tu.walkSpeed, maxDelta);
      c.vz = approach(c.vz, mz * tu.walkSpeed, maxDelta);
    }
    const px = c.x;
    const pz = c.z;
    this.moveChef(slot, c.x + c.vx * SIM_DT, c.z + c.vz * SIM_DT);
    if (c.walkTarget >= 0) {
      const moved = (c.x - px) * (c.x - px) + (c.z - pz) * (c.z - pz);
      c.stuck = moved < 0.0004 ? c.stuck + 1 : 0;
      if (c.stuck > STUCK_TICKS) this.clearWalk(c);
    }
    if (len > 0.2 && c.dashLeft === 0) {
      c.fx = mx / len;
      c.fz = mz / len;
    }

    // Target, verb, actions.
    if (c.sticky >= 0 && !this.inReach(c, this.stations[c.sticky]!)) c.sticky = -1;
    c.target = c.walkTarget >= 0 ? c.walkTarget : c.sticky >= 0 ? c.sticky : this.findTarget(c);
    if (this.phase === 'ended') {
      c.verb = 'none';
      c.canChop = false;
      c.chopping = false;
      return;
    }
    const ts = c.target >= 0 && this.inReach(c, this.stations[c.target]!) ? this.stations[c.target]! : null;
    c.verb = ts ? this.interact(slot, ts.index, false, events) : 'none';
    const held = c.held >= 0;
    const tItem = ts && ts.socket >= 0 ? this.items.get(ts.socket)! : null;
    c.canChop = !!(ts && ts.kind === 'processor' && ts.process === 'chop' && !held && tItem && this.def(tItem.def).chop && tItem.state === 'raw');

    if (arrivedInteract >= 0) {
      this.interact(slot, arrivedInteract, true, events);
      c.target = arrivedInteract;
    } else if (pressed & RB_A && ts) {
      this.faceStation(c, ts);
      this.interact(slot, ts.index, true, events);
    }

    // Chop (X held).
    c.chopping = false;
    if (buttons & RB_X && c.canChop && ts && tItem) {
      c.chopping = true;
      this.faceStation(c, ts);
      tItem.ticks++;
      tItem.progress = Math.min(256, Math.floor((tItem.ticks * 256) / this.chopTicks));
      if (tItem.ticks % CHOP_HIT_EVERY === 0) events.push({ kind: 'ChopHit', slot, station: ts.index });
      if (tItem.ticks >= this.chopTicks) {
        tItem.def = this.def(tItem.def).chop!;
        tItem.state = 'chopped';
        tItem.ticks = 0;
        tItem.progress = 0;
        events.push({ kind: 'ChopDone', slot, station: ts.index });
      }
    }
  }

  private faceStation(c: ChefRt, st: StationRt): void {
    const dx = st.x - c.x;
    const dz = st.z - c.z;
    const d = fsqrt(dx * dx + dz * dz);
    if (d > 1e-6) {
      c.fx = dx / d;
      c.fz = dz / d;
    }
  }

  private clearWalk(c: ChefRt): void {
    c.walkTarget = -1;
    c.path = [];
    c.walkTicks = 0;
    c.stuck = 0;
  }

  private startWalk(c: ChefRt, stationIndex: number, kind: 0 | 1): void {
    c.walkTarget = stationIndex;
    c.sticky = -1;
    c.walkKind = kind;
    c.walkTicks = 0;
    c.stuck = 0;
    c.path = [];
    const st = this.stations[stationIndex]!;
    if (distToBox(c.x, c.z, st.box) <= 0.75) return;
    const goal = new Uint8Array(this.grid.blocked.length);
    const reach = this.level.tuning.reach - 0.15;
    for (let i = 0; i < goal.length; i++) {
      if (this.grid.blocked[i]) continue;
      if (distToBox(this.grid.cx(i % this.grid.cols), this.grid.cz(Math.floor(i / this.grid.cols)), st.box) <= reach) goal[i] = 1;
    }
    const start = this.grid.nearestFree(c.x, c.z);
    if (start < 0) {
      this.clearWalk(c);
      return;
    }
    if (goal[start]) return; // already at a standing cell: the arrival logic interacts next
    c.path = this.grid.path(start, goal);
    if (c.path.length === 0) this.clearWalk(c);
  }

  private moveChef(slot: number, nx: number, nz: number): void {
    const c = this.chefs[slot]!;
    const out = { x: 0, z: 0 };
    const b = this.bounds;
    const r = CHEF_RADIUS;
    // Axis-separated so chefs slide along counters.
    let x = clamp(nx, b.x0 + r, b.x1 - r);
    let z = c.z;
    for (const s of this.stations) {
      pushOutOfBox(x, z, r, s.box, out);
      x = out.x;
      z = out.z;
    }
    z = clamp(nz, b.z0 + r, b.z1 - r);
    for (const s of this.stations) {
      pushOutOfBox(x, z, r, s.box, out);
      x = out.x;
      z = out.z;
    }
    c.x = clamp(x, b.x0 + r, b.x1 - r);
    c.z = clamp(z, b.z0 + r, b.z1 - r);
    // Chefs are solid for each other: push the mover out (lower slots win ties through update order).
    for (let j = 0; j < this.chefs.length; j++) {
      if (j === slot) continue;
      const o = this.chefs[j]!;
      const dx = c.x - o.x;
      const dz = c.z - o.z;
      const d2 = dx * dx + dz * dz;
      const min = 2 * r;
      if (d2 >= min * min) continue;
      if (d2 > 1e-9) {
        const d = fsqrt(d2);
        c.x = o.x + (dx / d) * min;
        c.z = o.z + (dz / d) * min;
      } else c.x += min;
    }
    c.x = clamp(c.x, b.x0 + r, b.x1 - r);
    c.z = clamp(c.z, b.z0 + r, b.z1 - r);
    const out2 = { x: 0, z: 0 };
    for (const s of this.stations) {
      pushOutOfBox(c.x, c.z, r, s.box, out2);
      c.x = out2.x;
      c.z = out2.z;
    }
  }

  /** Second pass so two chefs pushing into each other cannot overlap after both moved. */
  private separateChefs(): void {
    const r = CHEF_RADIUS;
    for (let i = 0; i < this.chefs.length; i++)
      for (let j = i + 1; j < this.chefs.length; j++) {
        const a = this.chefs[i]!;
        const b = this.chefs[j]!;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d2 = dx * dx + dz * dz;
        const min = 2 * r;
        if (d2 >= min * min || d2 < 1e-9) continue;
        const d = fsqrt(d2);
        const push = (min - d) / 2;
        a.x -= (dx / d) * push;
        a.z -= (dz / d) * push;
        b.x += (dx / d) * push;
        b.z += (dz / d) * push;
      }
  }

  // ------------------------------------------------------------------ stations

  private updateStations(events: RushEvent[]): void {
    for (const st of this.stations) {
      if (st.kind !== 'processor' || st.process !== 'auto' || st.socket < 0) continue;
      const item = this.items.get(st.socket)!;
      const d = this.def(item.def);
      if ((item.state === 'raw' || item.state === 'chopped' || item.state === 'cooking') && d.cook && d.cook.station === st.def) {
        if (item.state !== 'cooking') {
          item.state = 'cooking';
          events.push({ kind: 'CookStart', station: st.index });
        }
        const total = secs(d.cook.time);
        item.ticks++;
        item.progress = Math.min(256, Math.floor((item.ticks * 256) / total));
        if (item.ticks >= total) {
          item.def = d.cook.result;
          item.state = 'cooked';
          item.ticks = 0;
          item.progress = 0;
          item.burnTicks = secs(d.cook.burnWindow);
          events.push({ kind: 'Cooked', station: st.index });
        }
      } else if ((item.state === 'cooked' || item.state === 'burning') && item.burnTicks > 0) {
        item.ticks++;
        item.progress = Math.min(256, Math.floor((item.ticks * 256) / item.burnTicks));
        if (item.state === 'cooked' && item.ticks >= item.burnTicks - this.burnWarnTicks) {
          item.state = 'burning';
          events.push({ kind: 'BurnWarning', station: st.index });
        }
        if (item.ticks >= item.burnTicks) {
          item.state = 'burnt';
          item.progress = 256;
          events.push({ kind: 'Burnt', station: st.index });
        }
      }
    }
  }

  // ------------------------------------------------------------------ tickets

  private spawnTicket(events: RushEvent[]): void {
    const r = this.recipes[this.rng.int(0, this.recipes.length - 1)]!;
    const total = secs(r.ticketTime * this.ticketMul);
    const t: TicketRt = { id: this.nextTicketId++, recipe: r.id, left: total, total };
    this.tickets.push(t);
    this.spawned++;
    events.push({ kind: 'TicketNew', ticket: t.id, recipe: r.id });
  }

  private updateTickets(events: RushEvent[]): void {
    for (let i = 0; i < this.tickets.length; ) {
      const t = this.tickets[i]!;
      t.left--;
      if (t.left <= 0) {
        this.tickets.splice(i, 1);
        const penalty = this.level.scoring.expiredPenalty;
        this.score = Math.max(0, this.score - penalty);
        this.streak = 0;
        this.expired++;
        events.push({ kind: 'TicketExpired', ticket: t.id, recipe: t.recipe, penalty });
      } else i++;
    }
    const active = this.tickets.length;
    if (!this.openingDone) {
      if (this.spawned >= 1 && active < this.maxActive && (active === 0 || this.playTick >= secs(this.level.secondTicketAfterSeconds))) {
        this.spawnTicket(events);
        this.openingDone = true;
        this.nextSpawnTick = this.playTick + this.delay();
      }
      return;
    }
    if (active < this.maxActive && this.playTick >= this.nextSpawnTick) {
      this.spawnTicket(events);
      this.nextSpawnTick = this.playTick + this.delay();
    }
  }

  private delay(): number {
    return nextOrderDelayTicks(this.level, this.recipes, this.level.buckets[this.bucket]!, this.tickets.length, this.rng);
  }

  // ------------------------------------------------------------------ test and debug helpers

  /** Put a new item into chef `slot`'s hands (tests, dev hooks). */
  giveItem(slot: number, def: string, state?: ItemState, contents: string[] = []): RushItem {
    const c = this.chefs[slot]!;
    if (c.held >= 0) this.removeItem(c.held);
    const it = this.newItem(def, { kind: 'chef', id: slot });
    if (state) it.state = state;
    it.contents = contents.slice().sort();
    c.held = it.id;
    return it;
  }

  /** Put a new item on a station by id (tests, dev hooks). */
  putItem(stationId: string, def: string, state?: ItemState, contents: string[] = []): RushItem {
    const st = this.stations.find((s) => s.id === stationId)!;
    if (st.socket >= 0) this.removeItem(st.socket);
    const it = this.newItem(def, { kind: 'socket', id: st.index });
    if (state) it.state = state;
    it.contents = contents.slice().sort();
    st.socket = it.id;
    return it;
  }

  /** Teleport a chef (tests, dev hooks). */
  placeChef(slot: number, x: number, z: number, fx = 0, fz = -1): void {
    const c = this.chefs[slot]!;
    c.x = x;
    c.z = z;
    c.fx = fx;
    c.fz = fz;
  }

  stationIndex(id: string): number {
    return this.stations.findIndex((s) => s.id === id);
  }

  // ------------------------------------------------------------------ results and views

  starThresholds(): [number, number, number] {
    const s = this.level.stars[this.bucket]!;
    return [s[0], s[1], s[2]];
  }

  starCount(): 0 | 1 | 2 | 3 {
    const s = this.starThresholds();
    return this.score >= s[2] ? 3 : this.score >= s[1] ? 2 : this.score >= s[0] ? 1 : 0;
  }

  private itemView(it: RushItem): ItemView {
    return { id: it.id, def: it.def, state: it.state, progress: it.progress, contents: it.contents.slice() };
  }

  view(): RushView {
    const chefs: ChefView[] = this.chefs.map((c, slot) => ({
      slot,
      x: c.x,
      z: c.z,
      fx: c.fx,
      fz: c.fz,
      held: c.held >= 0 ? this.itemView(this.items.get(c.held)!) : null,
      target: c.target,
      verb: c.verb,
      canChop: c.canChop,
      chopping: c.chopping,
      dashing: c.dashLeft > 0,
      walking: c.walkTarget >= 0,
      dashReady: c.dashCd === 0,
    }));
    const stations: StationView[] = this.stations.map((s) => ({
      index: s.index,
      id: s.id,
      def: s.def,
      enabled: s.enabled,
      item: s.socket >= 0 ? this.itemView(this.items.get(s.socket)!) : null,
    }));
    const tickets: TicketView[] = this.tickets.map((t) => ({ id: t.id, recipe: t.recipe, leftTicks: t.left, totalTicks: t.total }));
    return {
      tick: this.tick,
      phase: this.phase,
      countdown: this.phase === 'countdown' ? Math.ceil(this.countdownTicks / SIM_HZ) : 0,
      timeLeftTicks: this.timeLeft,
      score: this.score,
      streak: this.streak,
      multPermille: streakMultiplier(this.level, this.streak),
      served: this.served,
      expired: this.expired,
      wrong: this.wrong,
      bucket: this.bucket,
      stars: this.starCount(),
      starThresholds: this.starThresholds(),
      chefs,
      stations,
      tickets,
      firstOrder: this.served === 0,
    };
  }

  /** Determinism check: every piece of mutable state, in a fixed order. */
  stateHash(): string {
    const h = new Hasher64();
    h.u32(this.tick).u32(this.phase === 'countdown' ? 0 : this.phase === 'playing' ? 1 : 2);
    h.bytes(new Uint8Array(this.rng.getState().buffer));
    h.i32(this.score).i32(this.streak).i32(this.served).i32(this.expired).i32(this.wrong).i32(this.timeLeft);
    h.i32(this.spawned).i32(this.nextSpawnTick).i32(this.playTick).i32(this.openingDone ? 1 : 0);
    h.i32(this.nextItemId).i32(this.nextTicketId).i32(this.countdownTicks);
    for (const c of this.chefs) {
      h.i32(c.sticky);
      h.f64(c.x).f64(c.z).f64(c.vx).f64(c.vz).f64(c.fx).f64(c.fz);
      h.i32(c.held).i32(c.dashLeft).i32(c.dashCd).u32(c.lastButtons).i32(c.lastClickSeq).i32(c.walkTarget);
      for (const p of c.path) h.i32(p);
    }
    for (const s of this.stations) h.i32(s.socket);
    for (const id of [...this.items.keys()].sort((a, b) => a - b)) {
      const it = this.items.get(id)!;
      h.i32(it.id).u32(hashStr(it.def)).u32(stateCode(it.state)).i32(it.progress).i32(it.ticks).i32(it.burnTicks);
      h.i32(it.holder.kind === 'chef' ? 0 : 1).i32(it.holder.id);
      for (const c of it.contents) h.u32(hashStr(c));
    }
    for (const t of this.tickets) h.i32(t.id).u32(hashStr(t.recipe)).i32(t.left).i32(t.total);
    return h.digest();
  }
}

function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

const STATE_CODES: Record<ItemState, number> = { raw: 0, chopped: 1, cooking: 2, cooked: 3, burning: 4, burnt: 5 };
function stateCode(s: ItemState): number {
  return STATE_CODES[s];
}
