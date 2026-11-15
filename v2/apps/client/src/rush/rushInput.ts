import { RB_A, RB_B, RB_X, type RushInput } from '@ga/sim';
import type { Device } from '../strings.js';

/** Multi-player input for the rush: one keyboard + mouse player and up to four gamepads, joined in the level intro. */
export type MenuCmd = 'up' | 'down' | 'left' | 'right' | 'accept' | 'back';

export type Source = { kind: 'kb' } | { kind: 'pad'; index: number };

const DEADZONE = 0.18;
const MIN_HOLD_MS = 55;
export const MAX_PLAYERS = 4;

const keys = new Set<string>();
const mouse = { x: 0, y: 0, left: false, right: false };
const menuQueue: MenuCmd[] = [];
const padPrev = new Map<string, boolean>();
const stickNext = new Map<string, number>();
let pause = false;
let mute = false;
let anyKey = false;
let kbUsed = false;
/** Pads that pressed A since the last drain (for joining). */
const padJoinPresses: number[] = [];
let kbJoin = false;
let mouseClick: { x: number; y: number; button: number } | null = null;

const NAV: Record<string, MenuCmd> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
  Enter: 'accept', NumpadEnter: 'accept', Space: 'accept',
};

window.addEventListener('keydown', (e) => {
  anyKey = true;
  kbUsed = true;
  keys.add(e.code);
  if (e.code === 'Space' || e.code.startsWith('Arrow') || e.code === 'Tab') e.preventDefault();
  const n = NAV[e.code];
  if (n) menuQueue.push(n);
  if (!e.repeat) {
    if (e.code === 'Escape') {
      pause = true;
      menuQueue.push('back');
    }
    if (e.code === 'KeyM') mute = true;
    if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') kbJoin = true;
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => {
  keys.clear();
  mouse.left = mouse.right = false;
});
window.addEventListener('mousemove', (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});
window.addEventListener('mousedown', (e) => {
  anyKey = true;
  kbUsed = true;
  mouse.x = e.clientX;
  mouse.y = e.clientY;
  if ((e.target as HTMLElement | null)?.tagName !== 'CANVAS') return;
  if (e.button === 0) mouse.left = true;
  if (e.button === 2) mouse.right = true;
  mouseClick = { x: e.clientX, y: e.clientY, button: e.button };
  kbJoin = true;
});
window.addEventListener('mouseup', (e) => {
  if (e.button === 0) mouse.left = false;
  if (e.button === 2) mouse.right = false;
});
window.addEventListener('contextmenu', (e) => e.preventDefault());

export function consumeAnyInput(): boolean {
  const v = anyKey;
  anyKey = false;
  return v;
}
export function consumePause(): boolean {
  const v = pause;
  pause = false;
  return v;
}
export function consumeMute(): boolean {
  const v = mute;
  mute = false;
  return v;
}
export function drainMenu(): MenuCmd[] {
  return menuQueue.splice(0, menuQueue.length);
}
export function drainPadJoins(): number[] {
  return padJoinPresses.splice(0, padJoinPresses.length);
}
export function consumeKbJoin(): boolean {
  const v = kbJoin;
  kbJoin = false;
  return v;
}
export function keyboardTouched(): boolean {
  return kbUsed;
}
export function pads(): Gamepad[] {
  return Array.from(navigator.getGamepads?.() ?? []).filter((p): p is Gamepad => !!p);
}

/** Poll gamepads for menu navigation, Start (pause) and A presses (join). Call once per frame. */
export function pollPads(now: number): Device | null {
  let used: Device | null = null;
  for (const pad of pads()) {
    const id = `p${pad.index}`;
    const down = (i: number): boolean => (pad.buttons[i]?.value ?? 0) > 0.5 || pad.buttons[i]?.pressed === true;
    const edge = (i: number): boolean => {
      const d = down(i);
      const k = `${id}:${i}`;
      const was = padPrev.get(k) ?? false;
      padPrev.set(k, d);
      return d && !was;
    };
    if (edge(0)) {
      menuQueue.push('accept');
      padJoinPresses.push(pad.index);
      used = 'gamepad';
    }
    if (edge(1)) {
      menuQueue.push('back');
      used = 'gamepad';
    }
    if (edge(9)) {
      pause = true;
      used = 'gamepad';
    }
    if (edge(12)) menuQueue.push('up');
    if (edge(13)) menuQueue.push('down');
    if (edge(14)) menuQueue.push('left');
    if (edge(15)) menuQueue.push('right');
    const stick = (v: number, axis: 'x' | 'y', neg: MenuCmd, plus: MenuCmd): void => {
      const k = `${id}:${axis}`;
      if (Math.abs(v) < 0.6) {
        stickNext.set(k, 0);
        return;
      }
      const next = stickNext.get(k) ?? 0;
      if (now >= next) {
        menuQueue.push(v < 0 ? neg : plus);
        stickNext.set(k, now + (next === 0 ? 380 : 160));
      }
    };
    stick(pad.axes[0] ?? 0, 'x', 'left', 'right');
    stick(pad.axes[1] ?? 0, 'y', 'up', 'down');
    if (Math.abs(pad.axes[0] ?? 0) > 0.3 || Math.abs(pad.axes[1] ?? 0) > 0.3 || [0, 1, 2, 3, 9].some(down)) used = 'gamepad';
  }
  return used;
}

const heldUntil = new Map<string, number>();

export interface PlayerInput {
  frame: RushInput;
  /** Which device produced input this frame, for glyphs. */
  device: Device | null;
}

interface PlayerState {
  clickSeq: number;
  click: number;
  clickKind: 0 | 1;
}
const players = new Map<string, PlayerState>();

function pstate(k: string): PlayerState {
  let s = players.get(k);
  if (!s) {
    s = { clickSeq: 0, click: -1, clickKind: 0 };
    players.set(k, s);
  }
  return s;
}

function latch(k: string, down: boolean, now: number): boolean {
  if (down) heldUntil.set(k, now + MIN_HOLD_MS);
  return now < (heldUntil.get(k) ?? 0);
}

const toI8 = (v: number): number => Math.max(-127, Math.min(127, Math.round(v * 127)));
const dz = (v: number): number => (Math.abs(v) > DEADZONE ? v : 0);

/**
 * Sample the frame of one player. `pick` converts the mouse position to a station index (keyboard player only);
 * a left click walks and acts, a held right click walks there and chops.
 */
export function sampleSource(src: Source, slot: number, now: number, pick: (x: number, y: number) => number): PlayerInput {
  const key = src.kind === 'kb' ? 'kb' : `p${src.index}`;
  const st = pstate(key);
  let x = 0;
  let y = 0;
  let a = false;
  let xb = false;
  let b = false;
  let device: Device | null = null;
  if (src.kind === 'kb') {
    const k = (c: string): number => (keys.has(c) ? 1 : 0);
    // Key codes are physical positions, so WASD also means ZQSD on AZERTY keyboards.
    x = k('KeyD') + k('ArrowRight') - k('KeyA') - k('ArrowLeft');
    y = k('KeyS') + k('ArrowDown') - k('KeyW') - k('ArrowUp');
    a = keys.has('Space');
    xb = keys.has('KeyE') || keys.has('KeyX') || mouse.right;
    b = keys.has('ShiftLeft') || keys.has('ShiftRight');
    if (x || y || a || xb || b) device = 'keyboard';
    if (mouseClick) {
      const c = mouseClick;
      mouseClick = null;
      const idx = pick(c.x, c.y);
      if (idx >= 0) {
        st.click = idx;
        st.clickSeq = (st.clickSeq + 1) & 0xffff;
        st.clickKind = c.button === 2 ? 1 : 0;
        device = 'keyboard';
      }
    }
  } else {
    const pad = pads().find((p) => p.index === src.index);
    if (pad) {
      const bt = (i: number): boolean => (pad.buttons[i]?.value ?? 0) > 0.4 || pad.buttons[i]?.pressed === true;
      x = dz(pad.axes[0] ?? 0) + (bt(15) ? 1 : 0) - (bt(14) ? 1 : 0);
      y = dz(pad.axes[1] ?? 0) + (bt(13) ? 1 : 0) - (bt(12) ? 1 : 0);
      a = bt(0);
      xb = bt(2) || bt(7);
      b = bt(1) || bt(5);
      if (x || y || a || xb || b) device = 'gamepad';
    }
  }
  const len = Math.hypot(x, y);
  if (len > 1) {
    x /= len;
    y /= len;
  }
  let buttons = 0;
  if (latch(`${key}:a`, a, now)) buttons |= RB_A;
  if (xb) buttons |= RB_X;
  if (latch(`${key}:b`, b, now)) buttons |= RB_B;
  return { frame: { move: [toI8(x), toI8(y)], buttons, click: st.click, clickSeq: st.clickSeq, clickKind: st.clickKind }, device };
}
