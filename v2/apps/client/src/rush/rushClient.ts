import { rushLevelById } from '@ga/content';
import { HarbourApp, HarbourScene, SLOT_COLORS, parseVox, type VoxModel } from '@ga/render';
import type { MainToWorker, RushEvent, RushInput, RushView, WorkerToMain } from '@ga/sim';
import { idleRushInput } from '@ga/sim';
import { Plane, Raycaster, Vector2, Vector3 } from 'three';
import { AudioManager } from '../audio.js';
import { glyph, learnKeyboardLayout, t, type Device, type StringKey } from '../strings.js';
import {
  MAX_PLAYERS,
  consumeAnyInput,
  consumeKbJoin,
  consumeMute,
  consumePause,
  drainMenu,
  drainPadJoins,
  pollPads,
  sampleSource,
  type Source,
} from './rushInput.js';
import { RushHud } from './rushHud.js';

const LEVEL_ID = 'l01_kiosque';
const params = new URLSearchParams(location.search);
const dev = params.get('dev') === '1';
const level = rushLevelById(LEVEL_ID)!;
const layout = level.layout;
learnKeyboardLayout();

// ---------------------------------------------------------------- storage (never throws)
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
      /* private mode */
    }
  },
};
const bestKey = (bucket: string): string => `pk.best.${LEVEL_ID}.${bucket}`;
const bestOf = (bucket: string): number => Number(store.get(bestKey(bucket)) ?? 0);

// ---------------------------------------------------------------- assets
const voxUrls = import.meta.glob('../../../../content-src/vox/v1/{items,stations,meals}/*.vox', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
async function loadModels(): Promise<Record<string, VoxModel>> {
  const out: Record<string, VoxModel> = {};
  await Promise.all(
    Object.entries(voxUrls).map(async ([path, url]) => {
      const name = path.replace(/^.*\/v1\//, '').replace(/\.vox$/, '');
      try {
        out[name] = parseVox(await (await fetch(url)).arrayBuffer());
      } catch {
        /* a missing model falls back to a placeholder cube */
      }
    }),
  );
  return out;
}

// ---------------------------------------------------------------- state
type Mode = 'loading' | 'title' | 'intro' | 'play' | 'results';
let mode: Mode = 'loading';
let paused = false;
let view: RushView | null = null;
let prevPhase = '';
let joined: Source[] = [{ kind: 'kb' }];
let introSince = 0;
let introPressed = new Set<string>();
let device: Device = 'keyboard';
let lastClockSec = -1;
let resultsTimer = 0;
let lastHash = '-';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const audio = new AudioManager();
const app = new HarbourApp(canvas);
const worker = new Worker(new URL('../sim.worker.ts', import.meta.url), { type: 'module' });
const send = (m: MainToWorker): void => worker.postMessage(m);

let scene: HarbourScene | null = null;
let hud: RushHud | null = null;

function newRun(players: number, paused0: boolean, ff = 0): void {
  send({ type: 'rush-init', seed: (Date.now() & 0x7fffffff) | 1, players, levelId: LEVEL_ID, ff });
  send({ type: 'pause', paused: paused0 });
  view = null;
  prevPhase = '';
  hud?.resetTickets();
  hud?.hideCenter();
  lastClockSec = -1;
}

// ---------------------------------------------------------------- menus
function openTitle(): void {
  mode = 'title';
  app.mode = 'title';
  hud!.setPlaying(false);
  hud!.hideCenter();
  hud!.openMenu({
    id: 'title',
    title: () => t('rt.title'),
    subtitle: () => t('rt.subtitle'),
    wide: true,
    items: [
      { title: () => t('card.l1.name'), sub: () => `${t('card.l1.sub')}${bestOf('solo') > 0 ? ' · ' + t('card.best', { n: bestOf('solo') }) : ''}`, card: true, onSelect: () => openIntro() },
      { title: () => t('card.demo.name'), sub: () => t('card.demo.sub'), card: true, onSelect: () => (location.search = '?mode=giant') },
    ],
  });
}

function openIntro(): void {
  mode = 'intro';
  app.mode = 'play';
  introSince = performance.now();
  introPressed = new Set();
  hud!.setPlaying(false);
  newRun(joined.length, true);
  renderIntro();
}

function sourceKey(s: Source): string {
  return s.kind === 'kb' ? 'kb' : `p${s.index}`;
}

function renderIntro(): void {
  hud!.openMenu({
    id: 'intro',
    title: () => t('level.l01.name'),
    subtitle: () => t('intro.goal'),
    hint: false,
    guardMs: 0,
    body: (card) => {
      const gl = document.createElement('div');
      gl.className = 'rm-glyphs';
      const add = (g: string, key: StringKey): void => {
        const s = document.createElement('span');
        const c = document.createElement('b');
        c.className = 'chip';
        c.textContent = g;
        s.append(c, t(key));
        gl.appendChild(s);
      };
      const gp = device === 'gamepad';
      add(glyph('grab', device), 'help.grab');
      add(gp ? 'Ⓧ' : 'E', 'help.chop');
      add(glyph('dash', device), 'help.dash');
      card.appendChild(gl);
      const slots = document.createElement('div');
      slots.className = 'rm-slots';
      for (let i = 0; i < MAX_PLAYERS; i++) {
        const s = document.createElement('div');
        const src = joined[i];
        s.className = src ? 'rm-slot on' : 'rm-slot';
        if (src) s.style.background = `#${(SLOT_COLORS[i]! + 0x1000000).toString(16).slice(1)}`;
        s.textContent = src ? `${t('intro.slot', { n: i + 1 })} · ${src.kind === 'kb' ? '⌨' : '🎮'}` : '+';
        slots.appendChild(s);
      }
      card.appendChild(slots);
      const j = document.createElement('div');
      j.className = 'rm-hint';
      j.textContent = `${t('intro.join')} · ${t('intro.joinKb')}`;
      card.appendChild(j);
    },
    items: [{ title: () => t('intro.go'), onSelect: () => beginRun() }],
  });
}

function beginRun(): void {
  hud!.closeMenu();
  hud!.counting = true;
  mode = 'play';
  hud!.setPlaying(true);
  newRun(joined.length, false);
  audio.setAmbience(true);
}

function restart(): void {
  setPaused(false);
  hud!.counting = true;
  hud!.closeMenu();
  hud!.setPlaying(true);
  mode = 'play';
  clearTimeout(resultsTimer);
  newRun(joined.length, false);
}

function toMenu(): void {
  setPaused(false);
  hud!.counting = false;
  hud!.hideCenter();
  clearTimeout(resultsTimer);
  joined = [{ kind: 'kb' }];
  hud!.closeMenu();
  newRun(1, true);
  openTitle();
}

function setPaused(p: boolean): void {
  if (p === paused) return;
  paused = p;
  send({ type: 'pause', paused: p });
  audio.setSizzle(0);
  if (p) {
    hud!.openMenu({
      id: 'pause',
      title: () => t('pause.title'),
      items: [
        { title: () => t('btn.resume'), onSelect: () => setPaused(false) },
        { title: () => t('btn.restart'), onSelect: () => restart() },
        { title: () => t('btn.menu'), onSelect: () => toMenu() },
        { title: () => t(audio.isMuted ? 'btn.sound.off' : 'btn.sound.on'), onSelect: () => (audio.toggleMuted(), hud!.refreshMenu()) },
      ],
    });
  } else hud!.closeMenu();
}

function openResults(v: RushView): void {
  mode = 'results';
  hud!.setPlaying(false);
  const prevBest = bestOf(v.bucket);
  const record = v.score > prevBest && v.score > 0;
  if (record) store.set(bestKey(v.bucket), String(v.score));
  const next = v.starThresholds.find((x) => x > v.score);
  hud!.openMenu({
    id: 'results',
    title: () => t('res.title'),
    subtitle: () => t(`res.bucket.${v.bucket}` as StringKey),
    guardMs: 900,
    body: (card) => {
      const stars = document.createElement('div');
      stars.className = 'rm-stars';
      for (let i = 0; i < 3; i++) {
        const s = document.createElement('span');
        s.textContent = '★';
        if (i >= v.stars) s.className = 'off';
        else {
          s.className = 'in';
          s.style.animationDelay = `${0.25 + i * 0.25}s`;
        }
        stars.appendChild(s);
      }
      const score = document.createElement('div');
      score.className = 'rm-score';
      const small = document.createElement('small');
      small.textContent = t('results.score');
      score.append(small, String(v.score));
      card.append(stars, score);
      const rec = document.createElement('div');
      if (record) {
        rec.className = 'rm-rec';
        rec.textContent = t('results.record');
      } else {
        rec.className = 'rm-hint';
        rec.textContent = t('results.bestScore', { n: Math.max(prevBest, v.score) });
      }
      card.appendChild(rec);
      const rows = document.createElement('dl');
      rows.className = 'rm-rows';
      const row = (k: string, val: string): void => {
        const dt = document.createElement('dt');
        dt.textContent = k;
        const dd = document.createElement('dd');
        dd.textContent = val;
        rows.append(dt, dd);
      };
      row(t('res.served'), String(v.served));
      row(t('res.expired'), String(v.expired));
      row(next ? t('res.next', { n: next }) : t('res.max'), '');
      card.appendChild(rows);
    },
    items: [
      { title: () => t('btn.replay'), onSelect: () => restart() },
      { title: () => t('btn.menu'), onSelect: () => toMenu() },
    ],
  });
}

// ---------------------------------------------------------------- sim messages
worker.onmessage = (e: MessageEvent<WorkerToMain>) => {
  const msg = e.data;
  if (msg.type !== 'rush') return;
  view = msg.view;
  if (msg.hash) lastHash = msg.hash;
  for (const ev of msg.events) onEvent(ev);
  if (view.phase !== prevPhase) {
    prevPhase = view.phase;
    if (view.phase === 'ended' && mode === 'play') {
      const v = view;
      resultsTimer = window.setTimeout(() => openResults(v), 1500);
    }
  }
};

function onEvent(ev: RushEvent): void {
  scene?.onEvent(ev, null);
  const pass = layout.stations.findIndex((s) => s.def === 'pass');
  void pass;
  switch (ev.kind) {
    case 'Countdown':
      audio.play('tick');
      break;
    case 'Go':
      audio.play('happy');
      hud?.hideCenter();
      hud?.showGo();
      break;
    case 'Grabbed':
      audio.play('pop');
      break;
    case 'Placed':
    case 'Plated':
    case 'CookStart':
      audio.play('place');
      break;
    case 'ChopHit':
      audio.play('chop');
      break;
    case 'ChopDone':
      audio.play('pop');
      break;
    case 'Cooked':
      audio.play('ding');
      break;
    case 'BurnWarning':
      audio.play('tick');
      break;
    case 'Burnt':
      audio.play('error');
      hud?.say(t('toast.burnt'));
      break;
    case 'Trashed':
      audio.play('hiss');
      break;
    case 'Dash':
      audio.play('pop');
      break;
    case 'TicketNew':
      audio.play('bell');
      break;
    case 'TicketExpired':
      audio.play('error');
      hud?.say(t('toast.late', { n: ev.penalty }));
      app.shake(0.06);
      break;
    case 'Served': {
      audio.play('ding');
      audio.play('happy');
      const p = passScreen();
      if (p) hud?.flyScore(`+${ev.points}`, p);
      break;
    }
    case 'WrongDish': {
      audio.play('error');
      hud?.redFlash();
      hud?.say(t('toast.wrong', { n: ev.penalty }));
      const p = passScreen();
      if (p) hud?.flyScore(`−${ev.penalty}`, p, true);
      break;
    }
    case 'Refused':
      audio.play('error');
      if (ev.reason === 'burnt') hud?.say(t('toast.burnt'));
      break;
    case 'TimeUp':
      audio.play(ev.stars > 0 ? 'happy' : 'sad');
      audio.setSizzle(0);
      break;
    default:
      break;
  }
}

function passScreen(): { x: number; y: number } | null {
  const i = layout.stations.findIndex((s) => s.def === 'pass');
  const s = layout.stations[i];
  return s ? app.project(s.x + 0.6, 1.7, s.z) : null;
}

// ---------------------------------------------------------------- mouse picking
const raycaster = new Raycaster();
const ndc = new Vector2();
const hit = new Vector3();
function pickStation(mx: number, my: number): number {
  ndc.set((mx / window.innerWidth) * 2 - 1, -(my / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, app.camera);
  for (const y of [1.0, 0.5]) {
    if (!raycaster.ray.intersectPlane(new Plane(new Vector3(0, 1, 0), -y), hit)) continue;
    let best = -1;
    let bd = 1e9;
    layout.stations.forEach((s, i) => {
      const dx = Math.max(Math.abs(hit.x - s.x) - s.w / 2, 0);
      const dz = Math.max(Math.abs(hit.z - s.z) - s.d / 2, 0);
      const d = Math.hypot(dx, dz);
      if (d < 0.12 && d < bd) {
        bd = d;
        best = i;
      }
    });
    if (best >= 0) return best;
  }
  return -1;
}

// ---------------------------------------------------------------- guide trail (first order only)
function guideTarget(v: RushView): number {
  if (!v.firstOrder || v.phase === 'ended') return -1;
  const idx = (def: string, pred: (s: RushView['stations'][number]) => boolean = () => true): number => v.stations.find((s) => s.def === def && s.enabled && pred(s))?.index ?? -1;
  const first = v.chefs[0];
  const held = first?.held;
  const fryerCooked = idx('fryer', (s) => s.item?.def === 'cooked_fries' && s.item.state !== 'burnt');
  if (held) {
    if (held.def === 'potato') return idx('board', (s) => !s.item);
    if (held.def === 'raw_fries') return idx('fryer', (s) => !s.item);
    if (held.def === 'plate') {
      if (held.contents.length > 0) return idx('pass');
      if (fryerCooked >= 0) return fryerCooked;
      return idx('fryer', (s) => !!s.item);
    }
    if (held.state === 'burnt') return idx('bin');
    return -1;
  }
  if (fryerCooked >= 0) return idx('plates');
  const boardFries = idx('board', (s) => s.item?.def === 'raw_fries');
  if (boardFries >= 0) return boardFries;
  const boardPotato = idx('board', (s) => s.item?.def === 'potato');
  if (boardPotato >= 0) return boardPotato;
  if (idx('fryer', (s) => !!s.item) >= 0) return idx('plates');
  return idx('crate');
}

// ---------------------------------------------------------------- init
if (dev) {
  (window as unknown as { __pk: unknown }).__pk = {
    view: () => view,
    screenOf: (id: string) => {
      const s = layout.stations.find((q) => q.id === id)!;
      return app.project(s.x, 1.0, s.z);
    },
    mode: () => mode,
    start: (n = 1, ff = 0) => {
      joined = Array.from({ length: n }, (_, i) => (i === 0 ? { kind: 'kb' } : { kind: 'pad', index: i })) as Source[];
      hud!.closeMenu();
      hud!.counting = true;
      mode = 'play';
      app.mode = 'play';
      hud!.setPlaying(true);
      newRun(n, false, ff);
    },
    intro: () => openIntro(),
    title: () => openTitle(),
    results: () => view && openResults(view),
    pause: (p: boolean) => setPaused(p),
  };
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && mode === 'play' && !paused) setPaused(true);
});

let last = performance.now();
let time = 0;
let lastTickSec = -1;

function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  time += dt;
  if (!scene || !hud) {
    requestAnimationFrame(frame);
    return;
  }
  const padDev = pollPads(now);
  if (padDev) device = 'gamepad';
  if (consumeAnyInput()) {
    audio.unlock();
    if (!padDev) device = 'keyboard';
  }
  hud.setDevice(device);
  const padJoins = drainPadJoins();
  const kbJoin = consumeKbJoin();

  for (const c of drainMenu()) {
    if (hud.menuId === 'pause' && c === 'back') setPaused(false);
    else if (hud.menuId === 'intro') {
      if (c === 'back') openTitle();
      // 'accept' on the intro is handled below through join presses.
    } else hud.menuNav(c);
  }
  if (consumeMute()) {
    audio.toggleMuted();
    hud.say(t(audio.isMuted ? 'btn.sound.off' : 'btn.sound.on'));
  }
  if (consumePause()) {
    if (paused) setPaused(false);
    else if (mode === 'play' && view && view.phase !== 'ended') setPaused(true);
  }

  // Intro: joining and starting.
  if (mode === 'intro') {
    let changed = false;
    for (const index of padJoins) {
      const key = `p${index}`;
      if (joined.some((s) => sourceKey(s) === key)) {
        if (introPressed.has(key)) beginRun();
        introPressed.add(key);
      } else if (joined.length < MAX_PLAYERS) {
        // Keyboard-only default is dropped when a pad takes the first slot.
        if (joined.length === 1 && joined[0]!.kind === 'kb' && !introPressed.has('kb')) joined = [];
        joined.push({ kind: 'pad', index });
        introPressed.add(key);
        changed = true;
      }
    }
    if (kbJoin) {
      if (!joined.some((s) => s.kind === 'kb')) {
        if (joined.length < MAX_PLAYERS) {
          joined.push({ kind: 'kb' });
          changed = true;
        }
      } else if (introPressed.has('kb')) beginRun();
      introPressed.add('kb');
    }
    if (mode === 'intro') {
      if (changed) {
        introSince = now;
        newRun(joined.length, true);
        renderIntro();
      } else if (now - introSince > 3000) beginRun();
    }
  } else if (mode === 'title') {
    // The pad that picked the card becomes player 1 at the intro.
    if (padJoins.length > 0) joined = [{ kind: 'pad', index: padJoins[0]! }];
    else if (kbJoin) joined = [{ kind: 'kb' }];
  }

  // Input frames.
  const playing = mode === 'play' && !paused && view !== null && view.phase !== 'ended';
  const frames: RushInput[] = [];
  let used: Device | null = null;
  joined.forEach((src, slot) => {
    const r = sampleSource(src, slot, now, pickStation);
    frames.push(playing ? r.frame : idleRushInput());
    if (slot === 0 && r.device) used = r.device;
  });
  if (used && playing) device = used;
  send({ type: 'rush-input', frames });

  // Scene.
  if (view) {
    scene.setGuide(mode === 'play' && !paused ? guideTarget(view) : -1);
    scene.update(view, dt, time);
    hud.update(view, dt);
    hud.updateWorldUi(view, (i, h) => {
      const p = scene!.anchor(i, h);
      return app.project(p.x, p.y, p.z);
    });
    let cooking = 0;
    for (const s of view.stations) if (s.def === 'fryer' && s.item && ['cooking', 'cooked', 'burning'].includes(s.item.state)) cooking++;
    audio.setSizzle(playing ? Math.min(3, cooking) : 0);
    if (view.phase === 'playing' && view.timeLeftTicks > 0 && view.timeLeftTicks <= 300) {
      const sec = Math.ceil(view.timeLeftTicks / 30);
      if (sec !== lastTickSec) {
        lastTickSec = sec;
        audio.play('tick');
      }
    }
  }
  audio.tickAmbience(dt);
  app.render(dt, time, scene.centroid);
  if (hud.debug.style.display !== 'none') hud.debug.textContent = `tick ${view?.tick ?? 0}\nhash ${lastHash}\nmode ${mode}`;
  void lastClockSec;
  requestAnimationFrame(frame);
}

async function boot(): Promise<void> {
  const models = await loadModels();
  hud = new RushHud(models, params.get('debug') === '1');
  scene = new HarbourScene(app, { stations: layout.stations.map((s) => ({ ...s, enabled: true })), queue: layout.queue }, models, MAX_PLAYERS);
  newRun(1, true);
  if (params.get('level') === '1') openIntro();
  else openTitle();
  requestAnimationFrame(frame);
}
void boot();
