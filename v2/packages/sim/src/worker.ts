/// <reference lib="webworker" />
/*
 * Web Worker entry. This is the ONLY file in packages/sim allowed to read a clock
 * (performance.now): it converts wall time into elapsed ms for FixedStepLoop. The
 * simulation itself never sees time. Exempted from the determinism lint rule in eslint.config.js.
 */
import { SIM_DT_MS } from '@ga/shared';
import { FixedStepLoop } from './loop.js';
import type { MainToWorker, WorkerToMain } from './protocol.js';
import type { InputFrame, SimEvent } from './types.js';
import { SimWorld } from './world.js';
import { RushSim } from './rush/sim.js';
import { idleRushInput, type RushInput } from './rush/types.js';
import { rushLevelById } from '@ga/content';

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const HASH_EVERY_N_TICKS = 30;

let sim: SimWorld | undefined;
let loop: FixedStepLoop | undefined;
let timer: ReturnType<typeof setInterval> | undefined;
let lastInput: InputFrame | undefined;
let lastHudKey = '';
let paused = false;
const GAME_POST_EVERY_N_TICKS = 3;

function post(msg: WorkerToMain, transfer: Transferable[] = []): void {
  ctx.postMessage(msg, transfer);
}

function postFood(world: SimWorld): void {
  const delta = world.drainFoodDelta();
  if (delta.upserts.length > 0 || delta.moves.length > 0 || delta.removed.length > 0) {
    const transfer: Transferable[] = [];
    for (const u of delta.upserts) {
      transfer.push(u.material.buffer);
      if (u.doneness) transfer.push(u.doneness.buffer);
      if (u.char) transfer.push(u.char.buffer);
    }
    post({ type: 'food', tick: world.tick, ...delta }, transfer);
  }
}

function postHud(world: SimWorld, force = false): void {
  const hud = world.readHud(0);
  const key = `${hud.tool}|${hud.tilt}|${hud.cravingId}|${hud.heldId}|${hud.facing}|${hud.torchOn}`;
  if (force || key !== lastHudKey) {
    lastHudKey = key;
    post({ type: 'hud', tick: world.tick, hud });
  }
}

function postChefs(world: SimWorld): void {
  const chefs = world.readChefStates();
  post({ type: 'state', tick: world.tick, alpha: 0, chefs }, [chefs.buffer]);
}

function postEvents(events: SimEvent[]): void {
  if (events.length > 0) post({ type: 'events', events });
}

function start(seed: number, chefSlots: number, arenaHalf?: number): void {
  stop();
  sim = new SimWorld({ seed, chefSlots, arenaHalf, phase: 'title' });
  lastHudKey = '';
  paused = false;
  loop = new FixedStepLoop(sim);
  let last = performance.now();
  timer = setInterval(() => {
    if (!sim || !loop) return;
    const now = performance.now();
    const elapsed = Math.min(now - last, 250);
    last = now;
    if (paused) return;
    const world = sim;
    const alpha = loop.advance(
      elapsed,
      () => [lastInput],
      (events) => {
        const chefs = world.readChefStates();
        const msg: WorkerToMain = { type: 'state', tick: world.tick, alpha: 0, chefs };
        if (world.tick % HASH_EVERY_N_TICKS === 0) msg.hash = world.stateHash();
        post(msg, [chefs.buffer]);
        postEvents(events);
        postFood(world);
        postHud(world);
        if (world.tick % GAME_POST_EVERY_N_TICKS === 0 || events.some((e) => e.kind === 'PhaseChanged')) {
          post({ type: 'game', tick: world.tick, game: world.readGameHud(0) });
        }
      },
    );
    void alpha; // alpha is recomputed by the main thread from its own receive clock.
  }, 4);
}

let rush: RushSim | undefined;
let rushFrames: RushInput[] = [];

function startRush(seed: number, players: number, levelId: string, ff = 0): void {
  stop();
  rush = new RushSim({ seed, players, level: rushLevelById(levelId) });
  rushFrames = [];
  paused = false;
  for (let i = 0; i < ff; i++) rush.step(Array.from({ length: players }, () => idleRushInput()));
  post({ type: 'rush', view: rush.view(), events: [] });
  let last = performance.now();
  let acc = 0;
  timer = setInterval(() => {
    if (!rush) return;
    const now = performance.now();
    acc += Math.min(now - last, 250);
    last = now;
    if (paused) return;
    let steps = 0;
    const events = [];
    while (acc >= SIM_DT_MS && steps < 5) {
      const inputs = Array.from({ length: players }, (_, i) => rushFrames[i] ?? idleRushInput());
      events.push(...rush.step(inputs));
      acc -= SIM_DT_MS;
      steps++;
    }
    if (acc >= SIM_DT_MS) acc %= SIM_DT_MS;
    if (steps > 0) post({ type: 'rush', view: rush.view(), events, hash: rush.tick % 30 === 0 ? rush.stateHash() : undefined });
  }, 8);
}

function stop(): void {
  rush = undefined;
  if (timer !== undefined) clearInterval(timer);
  timer = undefined;
  sim = undefined;
  loop = undefined;
}

ctx.onmessage = (e: MessageEvent<MainToWorker>) => {
  const msg = e.data;
  switch (msg.type) {
    case 'init':
      start(msg.seed, msg.chefSlots, msg.arenaHalf);
      break;
    case 'rush-init':
      startRush(msg.seed, msg.players, msg.levelId, msg.ff);
      break;
    case 'rush-input':
      rushFrames = msg.frames;
      break;
    case 'input':
      lastInput = msg.frame;
      break;
    case 'command':
      if (sim) {
        postEvents(sim.command(msg.command));
        postChefs(sim);
        postFood(sim);
        postHud(sim, true);
        post({ type: 'game', tick: sim.tick, game: sim.readGameHud(0) });
      }
      break;
    case 'pause':
      paused = msg.paused;
      break;
    case 'dev-teleport':
      sim?.teleport(0, msg.x, msg.z);
      break;
    case 'stop':
      stop();
      break;
  }
};
