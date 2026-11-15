import { materials } from '@ga/content';
import {
  BurstFx,
  CleaverPreview,
  DoneGauges,
  FACING_DIRS,
  FoodView,
  GiantView,
  KitchenScene,
  RenderApp,
  SteamFx,
  TorchFx,
  TutorialMarker,
  type KitchenDesc,
} from '@ga/render';
import { SIM_DT_MS } from '@ga/shared';
import {
  CLEAVER_AIM_RADIUS,
  GIANT_M,
  HAND_AHEAD_FV,
  HAND_Y,
  KITCHEN_HALF_M,
  MOUTH_M,
  PADS,
  PAD_SIZE,
  ROCK,
  TABLE,
  type GameHud,
  type HudState,
  type MainToWorker,
  type SimCommand,
  type SimEvent,
  type WorkerToMain,
} from '@ga/sim';
import { Vector3 } from 'three';
import { AimPicker } from './aim.js';
import { AudioManager } from './audio.js';
import { Hud, cravingName } from './hud.js';
import {
  consumeAnyInput,
  consumeMute,
  consumePause,
  currentDevice,
  drainMenu,
  idleFrame,
  mouse,
  onDeviceChange,
  pollGamepad,
  sampleInput,
  skipProgress,
  wantsAutoAim,
} from './input.js';
import { glyph, learnKeyboardLayout, t, TIER_COLOR } from './strings.js';

const FV = 1 / 16;
const params = new URLSearchParams(location.search);
const dev = params.get('dev') === '1';
const canvas = document.getElementById('game') as HTMLCanvasElement;
const hud = new Hud(params.get('debug') === '1');
const audio = new AudioManager();
learnKeyboardLayout();

// ---------------------------------------------------------------- persistence (never throws)
const store = {
  get(k: string): string | null {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string): void {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* private mode: progress is simply not remembered */
    }
  },
};
const TUTORIAL_KEY = 'ga.tutorialDone';
const BEST_KEY = 'ga.best';

// ---------------------------------------------------------------- scene
const app = new RenderApp(canvas, { groundSize: 20, background: 0x2b2420 });
app.renderer.toneMappingExposure = 0.7;
const worker = new Worker(new URL('./sim.worker.ts', import.meta.url), { type: 'module' });
const send = (m: MainToWorker): void => worker.postMessage(m);
const command = (c: SimCommand): void => send({ type: 'command', command: c });

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
  pads: PADS.map((p) => ({ x: p.x, z: p.z, size: PAD_SIZE, color: padColor(p.material) })),
  woodMaterial: matIndex('potato'),
  stoneMaterial: matIndex('stone'),
};
const kitchen = new KitchenScene(app.scene, food.material, desc);
const giant = new GiantView(app.scene, { x: GIANT_M.x, y: 0, z: GIANT_M.z }, MOUTH_M);
const cleaverPreview = new CleaverPreview(app.scene, 0xe4572e, FV);
const torchFx = new TorchFx(app.scene);
const steamFx = new SteamFx(app.scene, FV);
const gauges = new DoneGauges(app.scene);
const marker = new TutorialMarker(app.scene);
const puffs = new BurstFx(app.scene, 160, 0.05);
const picker = new AimPicker({
  x0: TABLE.x0 * FV,
  x1: (TABLE.x0 + TABLE.w) * FV,
  z0: TABLE.z0 * FV,
  z1: (TABLE.z0 + TABLE.d) * FV,
  topY: TABLE.top * FV,
});

// ---------------------------------------------------------------- state
let prev: Float32Array<ArrayBufferLike> = new Float32Array(0);
let curr: Float32Array<ArrayBufferLike> = new Float32Array(0);
let lastStateAt = performance.now();
let tick = 0;
let lastHash = '-';
let hudState: HudState = { tool: 'cleaver', tilt: 0, cravingId: '', heldId: -1, facing: 6, torchOn: false };
let game: GameHud = {
  phase: 'title', tutorialStep: -1, timeLeft: 180, belly: 70, band: 0, mood: 0, patience: 3, cravingId: 'ch1_seared_mushroom',
  cravingTimeLeft: 50, cravingWindow: 50, score: 0, served: 0, bestDishScore: 0, bestDishCravingId: '', bestDishTier: '',
  endReason: '', stars: 0, target: null, prompt: null, gauges: [], aim: [0, 16, 0], heldCount: 0,
};
let shownPhase: GameHud['phase'] | '' = '';
let paused = false;
let lastTickSecond = -1;
let hangryShakeAt = 0;
const bandState = new Map<number, boolean>();
const tooSmallShown = new Set<number>();

const isPlaying = (): boolean => game.phase === 'tutorial' || game.phase === 'service';

// ---------------------------------------------------------------- menus
function startPlay(): void {
  command(store.get(TUTORIAL_KEY) === '1' ? 'startService' : 'startTutorial');
}

function openTitle(): void {
  hud.openMenu({
    id: 'title',
    title: t('title.name'),
    subtitle: t('title.tagline'),
    buttons: [
      { label: () => t('btn.play'), onSelect: startPlay },
      { label: () => t('btn.tutorial'), onSelect: () => command('startTutorial') },
    ],
  });
}

function openResults(g: GameHud): void {
  const best = Number(store.get(BEST_KEY) ?? 0);
  const record = g.score > best && g.score > 0;
  if (record) store.set(BEST_KEY, String(g.score));
  hud.openMenu(
    {
      id: 'results',
      title: t('results.title'),
      subtitle: g.endReason === 'patience' ? t('results.patience') : t('results.time'),
      body: (card) => {
        const stars = document.createElement('div');
        stars.className = 'menu-stars';
        stars.setAttribute('aria-label', t('results.stars', { n: g.stars }));
        for (let i = 0; i < 3; i++) {
          const s = document.createElement('span');
          s.textContent = '★';
          if (i >= g.stars) s.className = 'off';
          stars.appendChild(s);
        }
        const score = document.createElement('div');
        score.className = 'menu-score';
        const label = document.createElement('small');
        label.textContent = t('results.score');
        score.append(label, String(g.score));
        card.append(stars, score);
        const rec = document.createElement('div');
        if (record) {
          rec.className = 'menu-record';
          rec.textContent = t('results.record');
        } else {
          rec.className = 'menu-hint';
          rec.textContent = t('results.bestScore', { n: Math.max(best, g.score) });
        }
        card.appendChild(rec);
        const rows = document.createElement('dl');
        rows.className = 'menu-rows';
        const add = (k: string, v: string, color?: string): void => {
          const dt = document.createElement('dt');
          dt.textContent = k;
          const dd = document.createElement('dd');
          dd.textContent = v;
          if (color) dd.style.color = color;
          rows.append(dt, dd);
        };
        add(t('results.served'), String(g.served));
        const tier = g.bestDishTier;
        add(
          t('results.best'),
          g.served > 0 && tier ? `${cravingName(g.bestDishCravingId)} · ${t(`tier.${tier}`)}` : t('results.none'),
          tier ? TIER_COLOR[tier] : undefined,
        );
        card.appendChild(rows);
      },
      buttons: [
        { label: () => t('btn.replay'), onSelect: () => command('startService') },
        { label: () => t('btn.tutorial'), onSelect: () => command('startTutorial') },
      ],
    },
    900,
  );
}

function setPaused(p: boolean): void {
  if (p === paused) return;
  paused = p;
  send({ type: 'pause', paused: p });
  if (p) {
    audio.setSizzle(0);
    hud.openMenu(
      {
        id: 'pause',
        title: t('pause.title'),
        buttons: [
          { label: () => t('btn.resume'), onSelect: () => setPaused(false) },
          {
            label: () => t('btn.restart'),
            onSelect: () => {
              setPaused(false);
              command(game.phase === 'tutorial' ? 'startTutorial' : 'startService');
            },
          },
          {
            label: () => t('btn.quit'),
            onSelect: () => {
              location.href = location.pathname;
            },
          },
          {
            label: () => t(audio.isMuted ? 'btn.sound.off' : 'btn.sound.on'),
            onSelect: () => {
              audio.toggleMuted();
              hud.refreshMenu();
            },
          },
        ],
      },
      0,
    );
  } else hud.closeMenu();
}

function onPhaseEnter(g: GameHud): void {
  shownPhase = g.phase;
  lastTickSecond = -1;
  hangryShakeAt = 0;
  tooSmallShown.clear();
  bandState.clear();
  if (g.phase === 'title') openTitle();
  else if (g.phase === 'results') openResults(g);
  else hud.closeMenu();
}

openTitle();
shownPhase = 'title';
onDeviceChange((d) => hud.setDevice(d));
hud.setDevice(currentDevice());

// ---------------------------------------------------------------- sim messages
function onGame(g: GameHud): void {
  game = g;
  if (g.phase !== shownPhase) {
    if (paused) setPaused(false);
    onPhaseEnter(g);
  }
  hud.setGame(g);
  giant.setHangry(g.phase === 'service' && g.band === 3);

  // Gauge feedback: ping when a food enters its perfect band, hiss when it leaves it upward.
  const seen = new Set<number>();
  for (const ga of g.gauges) {
    const inBand = ga.doneMarker >= ga.perfectLo && ga.doneMarker <= ga.perfectHi;
    const was = bandState.get(ga.id);
    if (was === false && inBand) {
      audio.play('ding');
      puffs.emit(ga.x, ga.y - 0.05, ga.z, 14, { color: 0x7dff6a, speed: 0.5, up: 1.0, life: 0.8, gravity: 1.5, scatter: 0.12 });
    } else if (was === true && !inBand && ga.doneMarker > ga.perfectHi) audio.play('hiss');
    bandState.set(ga.id, inBand);
    seen.add(ga.id);
  }
  for (const id of [...bandState.keys()]) if (!seen.has(id)) bandState.delete(id);

  if (g.phase === 'service' && g.timeLeft > 0 && g.timeLeft <= 10) {
    const sec = Math.ceil(g.timeLeft);
    if (sec !== lastTickSecond) {
      lastTickSecond = sec;
      audio.play('tick');
    }
  }
}

function onEvent(ev: SimEvent): void {
  switch (ev.kind) {
    case 'DishServed': {
      hud.showServe(ev.tier, ev.cravingId, ev.score, ev.points, ev.timeBonus, ev.highlights);
      giant.react(ev.tier);
      audio.play(ev.tier === 'perfect' || ev.tier === 'great' ? 'happy' : ev.tier === 'okay' ? 'pop' : 'sad');
      break;
    }
    case 'Grabbed':
      audio.play('pop');
      break;
    case 'Placed':
      audio.play('place');
      break;
    case 'ToolSwapped':
      audio.play('pop');
      break;
    case 'Cut':
      audio.play('chop');
      for (const c of ev.crumbAt) puffs.emit(c[0] * FV, c[1] * FV, c[2] * FV, 10, { color: 0xd9b779, speed: 0.5, up: 0.7, life: 0.6, gravity: 4, scatter: 0.06 });
      break;
    case 'TooHeavy':
      audio.play('error');
      hud.say(t('toast.tooHeavy'));
      break;
    case 'SpawnRefused':
      audio.play('error');
      hud.say(t('toast.full'));
      break;
    case 'TooSmallToCut':
      audio.play('error');
      if (!tooSmallShown.has(ev.bodyId)) {
        tooSmallShown.add(ev.bodyId);
        hud.say(t('toast.tooSmall'));
      }
      break;
    case 'HangryEntered':
      hud.say(t('toast.hangry'));
      app.shake(0.15);
      hangryShakeAt = 0;
      break;
    case 'CravingExpired':
      hud.say(t('toast.expired'));
      audio.play('error');
      break;
    case 'TutorialDone':
      store.set(TUTORIAL_KEY, '1');
      audio.play('happy');
      break;
    case 'ServiceEnded':
      audio.play(ev.reason === 'time' ? 'happy' : 'sad');
      audio.setSizzle(0);
      break;
    default:
      break;
  }
}

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
    case 'game':
      onGame(msg.game);
      break;
    case 'events':
      for (const ev of msg.events) onEvent(ev);
      break;
  }
};

send({ type: 'init', seed: (Date.now() & 0x7fffffff) | 1, chefSlots: 1, arenaHalf: KITCHEN_HALF_M - 0.2 });

if (dev) {
  // Dev-only hooks for the headless smoke test (never present without ?dev=1).
  (window as unknown as { __ga: unknown }).__ga = {
    teleport: (x: number, z: number) => send({ type: 'dev-teleport', x, z }),
    command: (c: SimCommand) => command(c),
    game: () => game,
    hud: () => hudState,
    bodies: () => food.bodyCount,
  };
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && isPlaying() && !paused) setPaused(true);
});

// ---------------------------------------------------------------- frame loop
const hand = new Vector3();
const aimM = new Vector3();
const chefV = new Vector3();
const promptV = new Vector3();
let lastFrame = performance.now();
let fps = 0;
let debugTimer = 0;
let time = 0;

function frame(now: number): void {
  const dt = Math.min((now - lastFrame) / 1000, 0.1);
  lastFrame = now;
  time += dt;
  fps = fps * 0.9 + (dt > 0 ? 1 / dt : 0) * 0.1;

  // ---- input plumbing
  pollGamepad(now);
  if (consumeAnyInput()) audio.unlock();
  for (const cmd of drainMenu()) {
    if (hud.menuId === 'pause' && cmd === 'back') setPaused(false);
    else hud.menuNav(cmd);
  }
  if (consumeMute()) {
    audio.toggleMuted();
    hud.refreshMenu();
    hud.say(t(audio.isMuted ? 'btn.sound.off' : 'btn.sound.on'));
  }
  if (consumePause()) {
    if (paused) setPaused(false);
    else if (isPlaying()) setPaused(true);
  }
  const skipEnabled = game.phase === 'tutorial' && !paused;
  const skipP = skipProgress(now, skipEnabled);
  hud.setSkipProgress(skipP);
  if (skipP >= 1) {
    store.set(TUTORIAL_KEY, '1');
    command('skipTutorial');
  }

  // ---- aim + input frame
  const chef = app.chefPosition(0);
  const f = FACING_DIRS[hudState.facing & 7]!;
  const auto = wantsAutoAim(now);
  let aim: [number, number, number];
  if (auto) aim = game.aim;
  else aim = picker.pick(mouse.x, mouse.y, window.innerWidth, window.innerHeight, app.cameraRig.camera, food.meshes(hudState.heldId));
  if (isPlaying() && !paused) send({ type: 'input', frame: sampleInput(now, aim, auto) });
  else send({ type: 'input', frame: idleFrame() });

  // ---- scene
  app.setChefOpacity(0, chef.z < -0.4 ? 0.4 : 1); // ghost the chef while at the table so the rock stays visible
  const alpha = Math.min((now - lastStateAt) / SIM_DT_MS, 1);
  app.setChefStates(prev, curr, alpha);
  food.tick(dt);
  // Look slightly past the chef toward Mossback so his head stays in frame.
  app.cameraFocusOffset.x = 0.25 * (MOUTH_M.x - chef.x);
  app.cameraFocusOffset.y = 0.5;
  app.cameraFocusOffset.z = -0.6 + 0.25 * (MOUTH_M.z - chef.z);

  const playing = isPlaying() && !paused;
  const showAim = auto ? game.aim : aim;
  const cell = playing && hudState.tool === 'cleaver' ? food.nearestCell(showAim, CLEAVER_AIM_RADIUS, hudState.heldId) : null;
  cleaverPreview.update(playing && hudState.tool === 'cleaver', cell, hudState.facing, hudState.tilt);
  hand.set(chef.x + f[0] * HAND_AHEAD_FV * FV, HAND_Y * FV, chef.z + f[1] * HAND_AHEAD_FV * FV);
  aimM.set(showAim[0] * FV, showAim[1] * FV, showAim[2] * FV);
  torchFx.update(dt, playing && hudState.torchOn, hand, aimM);
  steamFx.update(dt, food.hotBodies(2));
  const onRock = food.anyOver(ROCK, hudState.heldId);
  kitchen.update(dt, onRock ? 1 : 0, time);
  audio.setSizzle(playing ? Math.min(3, game.gauges.length) : 0);

  chefV.set(chef.x, chef.y, chef.z);
  if (!paused) giant.update(dt, time, chefV, game.heldCount > 0);
  gauges.update(playing ? game.gauges : [], app.cameraRig.camera, time);
  marker.update(time, playing && game.phase === 'tutorial' ? game.target : null);
  puffs.update(dt);

  if (playing && game.phase === 'service' && game.band === 3) {
    hangryShakeAt += dt;
    if (hangryShakeAt >= 6) {
      hangryShakeAt = 0;
      app.shake(0.15);
    }
  }

  // ---- floating prompt
  if (playing && game.prompt) {
    promptV.set(game.prompt.x, game.prompt.y, game.prompt.z).project(app.cameraRig.camera);
    if (promptV.z < 1) {
      hud.setPrompt((promptV.x * 0.5 + 0.5) * window.innerWidth, (-promptV.y * 0.5 + 0.5) * window.innerHeight, game.prompt.kind);
    } else hud.setPrompt(0, 0, null);
  } else hud.setPrompt(0, 0, null);

  app.render(dt);

  debugTimer += dt;
  if (debugTimer > 0.25) {
    debugTimer = 0;
    hud.debug.textContent =
      `tick ${tick}\nhash ${lastHash}\nfps  ${fps.toFixed(0)}\nphase ${game.phase} step ${game.tutorialStep}\naim  ${showAim.join(',')}\nchef ${chef.x.toFixed(3)},${chef.z.toFixed(3)}\nbodies ${food.bodyCount}\ndevice ${currentDevice()} grab=${glyph('grab', currentDevice())}\ncrossOriginIsolated ${String(crossOriginIsolated)}`;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
