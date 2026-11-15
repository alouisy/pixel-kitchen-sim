import { RenderApp } from '@ga/render';
import { SIM_DT_MS } from '@ga/shared';
import type { MainToWorker, WorkerToMain } from '@ga/sim';
import { sampleInput } from './input.js';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const debug = document.getElementById('debug') as HTMLDivElement;

const app = new RenderApp(canvas);
const worker = new Worker(new URL('./sim.worker.ts', import.meta.url), { type: 'module' });
const send = (m: MainToWorker): void => worker.postMessage(m);

let prev: Float32Array<ArrayBufferLike> = new Float32Array(0);
let curr: Float32Array<ArrayBufferLike> = new Float32Array(0);
let lastStateAt = performance.now();
let tick = 0;
let lastHash = '-';

worker.onmessage = (e: MessageEvent<WorkerToMain>) => {
  const msg = e.data;
  if (msg.type === 'state') {
    prev = curr.length === msg.chefs.length ? curr : msg.chefs;
    curr = msg.chefs;
    lastStateAt = performance.now();
    tick = msg.tick;
    if (msg.hash) lastHash = msg.hash;
  }
};

send({ type: 'init', seed: 1, chefSlots: 1 });

let lastFrame = performance.now();
let fps = 0;
let debugTimer = 0;

function frame(now: number): void {
  const dt = Math.min((now - lastFrame) / 1000, 0.1);
  lastFrame = now;
  fps = fps * 0.9 + (dt > 0 ? 1 / dt : 0) * 0.1;

  send({ type: 'input', frame: sampleInput() });

  const alpha = Math.min((now - lastStateAt) / SIM_DT_MS, 1);
  app.setChefStates(prev, curr, alpha);
  app.render(dt);

  debugTimer += dt;
  if (debugTimer > 0.25) {
    debugTimer = 0;
    debug.textContent =
      `tick ${tick}\nhash ${lastHash}\nfps  ${fps.toFixed(0)}\ncrossOriginIsolated ${String(crossOriginIsolated)}`;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
