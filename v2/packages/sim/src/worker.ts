/// <reference lib="webworker" />
/*
 * Web Worker entry. This is the ONLY file in packages/sim allowed to read a clock
 * (performance.now): it converts wall time into elapsed ms for FixedStepLoop. The
 * simulation itself never sees time. Exempted from the determinism lint rule in eslint.config.js.
 */
import { FixedStepLoop } from './loop.js';
import type { MainToWorker, WorkerToMain } from './protocol.js';
import type { InputFrame } from './types.js';
import { SimWorld } from './world.js';

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const HASH_EVERY_N_TICKS = 30;

let sim: SimWorld | undefined;
let loop: FixedStepLoop | undefined;
let timer: ReturnType<typeof setInterval> | undefined;
let lastInput: InputFrame | undefined;

function post(msg: WorkerToMain, transfer: Transferable[] = []): void {
  ctx.postMessage(msg, transfer);
}

function start(seed: number, chefSlots: number): void {
  stop();
  sim = new SimWorld({ seed, chefSlots });
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
      },
    );
    void alpha; // alpha is recomputed by the main thread from its own receive clock.
  }, 4);
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
      start(msg.seed, msg.chefSlots);
      break;
    case 'input':
      lastInput = msg.frame;
      break;
    case 'stop':
      stop();
      break;
  }
};
