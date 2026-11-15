/// <reference lib="webworker" />
/*
 * Web Worker entry. This is the ONLY file in packages/sim allowed to read a clock
 * (performance.now): it converts wall time into elapsed ms for FixedStepLoop. The
 * simulation itself never sees time. Exempted from the determinism lint rule in eslint.config.js.
 */
import { FixedStepLoop } from './loop.js';
import type { MainToWorker, WorkerToMain } from './protocol.js';
import type { GameMode, HudState, InputFrame } from './types.js';
import { SimWorld } from './world.js';

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const HASH_EVERY_N_TICKS = 30;

let sim: SimWorld | undefined;
let loop: FixedStepLoop | undefined;
let timer: ReturnType<typeof setInterval> | undefined;
let lastInput: InputFrame | undefined;
let lastHudKey = '';

function post(msg: WorkerToMain, transfer: Transferable[] = []): void {
  ctx.postMessage(msg, transfer);
}

function start(seed: number, chefSlots: number, arenaHalf?: number, mode?: GameMode): void {
  stop();
  sim = new SimWorld({ seed, chefSlots, arenaHalf, mode });
  lastHudKey = '';
  loop = new FixedStepLoop(sim);
  let last = performance.now();
  timer = setInterval(() => {
    if (!sim || !loop) return;
    const now = performance.now();
    const elapsed = Math.min(now - last, 250);
    last = now;
    const world = sim;
    const alpha = loop.advance(
      elapsed,
      () => [lastInput],
      (events) => {
        const chefs = world.readChefStates();
        const msg: WorkerToMain = { type: 'state', tick: world.tick, alpha: 0, chefs };
        if (world.tick % HASH_EVERY_N_TICKS === 0) msg.hash = world.stateHash();
        post(msg, [chefs.buffer]);
        if (events.length > 0) post({ type: 'events', events });
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
        const hud = world.readHud(0);
        const key = hudKey(hud);
        if (key !== lastHudKey) {
          lastHudKey = key;
          post({ type: 'hud', tick: world.tick, hud });
        }
      },
    );
    void alpha; // alpha is recomputed by the main thread from its own receive clock.
  }, 4);
}

/** Change key for the HUD post: timers and gauges are quantised so the post rate stays low (a few per second). */
function hudKey(h: HudState): string {
  return JSON.stringify([
    h.tool, h.tilt, h.cravingId, h.heldId, h.facing, h.torchOn, h.phase, h.timeLeftS, h.score, h.served, h.missed, h.hint,
    h.orders.map((o) => [o.uid, Math.floor(o.left * 60)]),
    h.gauges.map((g) => [g.id, Math.floor(g.done * 40), Math.floor(g.char * 40), g.pos]),
  ]);
}

function stop(): void {
  if (timer !== undefined) clearInterval(timer);
  timer = undefined;
  sim = undefined;
  loop = undefined;
}

ctx.onmessage = (e: MessageEvent<MainToWorker>) => {
  const msg = e.data;
  switch (msg.type) {
    case 'init':
      start(msg.seed, msg.chefSlots, msg.arenaHalf, msg.mode);
      break;
    case 'input':
      lastInput = msg.frame;
      break;
    case 'stop':
      stop();
      break;
  }
};
