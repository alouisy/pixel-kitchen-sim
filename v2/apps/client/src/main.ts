import { materials } from '@ga/content';
import {
  CleaverPreview,
  FACING_DIRS,
  FoodView,
  KitchenScene,
  RenderApp,
  SteamFx,
  TorchFx,
  type KitchenDesc,
} from '@ga/render';
import { SIM_DT_MS } from '@ga/shared';
import {
  CLEAVER_AIM_RADIUS,
  HAND_AHEAD_FV,
  HAND_Y,
  KITCHEN_HALF_M,
  PADS,
  PAD_SIZE,
  PLATE,
  ROCK,
  TABLE,
  type HudState,
  type MainToWorker,
  type WorkerToMain,
} from '@ga/sim';
import { Vector3 } from 'three';
import { AimPicker, padAim } from './aim.js';
import { Hud } from './hud.js';
import { mouse, sampleInput, usingGamepad } from './input.js';
import { EVENT_TEXT } from './strings.js';

const FV = 1 / 16;
const params = new URLSearchParams(location.search);
const canvas = document.getElementById('game') as HTMLCanvasElement;
const hud = new Hud(params.get('debug') === '1');

const app = new RenderApp(canvas, { groundSize: KITCHEN_HALF_M * 2, background: 0x2b2420 });
app.renderer.toneMappingExposure = 0.7;
app.cameraFocusOffset.z = -1.0; // look past the chef so the table is not hidden behind them
app.cameraFocusOffset.y = 0.5;
const worker = new Worker(new URL('./sim.worker.ts', import.meta.url), { type: 'module' });
const send = (m: MainToWorker): void => worker.postMessage(m);

const matIndex = (id: string): number => materials.find((m) => m.id === id)!.index;
const padColor = (id: string): number => parseInt(materials.find((m) => m.id === id)!.colors.cooked.slice(1), 16);

const food = new FoodView(
  app.scene,
  materials,
  () => new Worker(new URL('./mesher.worker.ts', import.meta.url), { type: 'module' }),
  FV,
);
const desc: KitchenDesc = {
  voxelSize: FV,
  table: TABLE,
  rock: ROCK,
  plate: PLATE,
  pads: PADS.map((p) => ({ x: p.x, z: p.z, size: PAD_SIZE, color: padColor(p.material) })),
  woodMaterial: matIndex('potato'),
  stoneMaterial: matIndex('stone'),
};
const kitchen = new KitchenScene(app.scene, food.material, desc);
const cleaverPreview = new CleaverPreview(app.scene, 0xe4572e, FV);
const torchFx = new TorchFx(app.scene);
const steamFx = new SteamFx(app.scene, FV);
const picker = new AimPicker({
  x0: TABLE.x0 * FV,
  x1: (TABLE.x0 + TABLE.w) * FV,
  z0: TABLE.z0 * FV,
  z1: (TABLE.z0 + TABLE.d) * FV,
  topY: TABLE.top * FV,
});

let prev: Float32Array<ArrayBufferLike> = new Float32Array(0);
let curr: Float32Array<ArrayBufferLike> = new Float32Array(0);
let lastStateAt = performance.now();
let tick = 0;
let lastHash = '-';
let hudState: HudState = { tool: 'cleaver', tilt: 0, cravingId: '', heldId: -1, facing: 6, torchOn: false };

worker.onmessage = (e: MessageEvent<WorkerToMain>) => {
  const msg = e.data;
  switch (msg.type) {
    case 'state':
      prev = curr.length === msg.chefs.length ? curr : msg.chefs;
      curr = msg.chefs;
      lastStateAt = performance.now();
      tick = msg.tick;
      if (msg.hash) lastHash = msg.hash;
      break;
    case 'food':
      food.apply(msg.upserts, msg.moves, msg.removed);
      break;
    case 'hud':
      hudState = msg.hud;
      hud.setHud(msg.hud);
      break;
    case 'events':
      for (const ev of msg.events) {
        if (ev.kind === 'DishServed') hud.showResult(ev.cravingId, ev.score, ev.tier, ev.highlights);
        else if (ev.kind === 'TooHeavy' || ev.kind === 'SpawnRefused' || ev.kind === 'PlateEmpty') hud.say(EVENT_TEXT[ev.kind]);
      }
      break;
  }
};

send({ type: 'init', seed: 1, chefSlots: 1, arenaHalf: KITCHEN_HALF_M - 0.2 });

const hand = new Vector3();
const aimM = new Vector3();
let lastFrame = performance.now();
let fps = 0;
let debugTimer = 0;
let time = 0;
let aim: [number, number, number] = [0, TABLE.top, 0];

function frame(now: number): void {
  const dt = Math.min((now - lastFrame) / 1000, 0.1);
  lastFrame = now;
  time += dt;
  fps = fps * 0.9 + (dt > 0 ? 1 / dt : 0) * 0.1;

  const chef = app.chefPosition(0);
  const f = FACING_DIRS[hudState.facing & 7]!;
  if (usingGamepad(now) || !mouse.inside) aim = padAim(chef.x, chef.z, f[0], f[1], TABLE.top * FV);
  else {
    aim = picker.pick(mouse.x, mouse.y, window.innerWidth, window.innerHeight, app.cameraRig.camera, food.meshes(hudState.heldId));
  }
  send({ type: 'input', frame: sampleInput(now, aim) });

  app.setChefOpacity(0, chef.z < -0.4 ? 0.4 : 1); // ghost the chef while at the table so the rock stays visible
  const alpha = Math.min((now - lastStateAt) / SIM_DT_MS, 1);
  app.setChefStates(prev, curr, alpha);
  food.tick(dt);

  // Presentation that depends on the interpolated chef position.
  const cell = hudState.tool === 'cleaver' ? food.nearestCell(aim, CLEAVER_AIM_RADIUS, hudState.heldId) : null;
  cleaverPreview.update(hudState.tool === 'cleaver', cell, hudState.facing, hudState.tilt);
  hand.set(chef.x + f[0] * HAND_AHEAD_FV * FV, HAND_Y * FV, chef.z + f[1] * HAND_AHEAD_FV * FV);
  aimM.set(aim[0] * FV, aim[1] * FV, aim[2] * FV);
  torchFx.update(dt, hudState.torchOn, hand, aimM);
  steamFx.update(dt, food.hotBodies(2));
  kitchen.update(dt, food.anyOver(ROCK, hudState.heldId) ? 1 : 0, time);

  app.render(dt);

  debugTimer += dt;
  if (debugTimer > 0.25) {
    debugTimer = 0;
    hud.debug.textContent =
      `tick ${tick}\nhash ${lastHash}\nfps  ${fps.toFixed(0)}\naim  ${aim.join(',')}\nchef ${chef.x.toFixed(3)},${chef.z.toFixed(3)}\nbodies ${food.bodyCount}\ncrossOriginIsolated ${String(crossOriginIsolated)}`;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
