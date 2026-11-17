import { BTN_AUTOAIM, BTN_GRAB, BTN_SWAP, BTN_TILT, BTN_TOOL, type InputFrame } from '@ga/sim';
import type { Device } from './strings.js';

const GAMEPAD_DEADZONE = 0.15; // ported in spirit from V1 src/controls.js
/** Buttons stay down at least this long so a quick tap always spans a 30 Hz sim tick. */
const MIN_HOLD_MS = 50;
/** Holding B / Escape this long skips the tutorial. */
export const SKIP_HOLD_MS = 1000;
/** Without mouse movement for this long, the tool falls back to auto-aim. */
export const MOUSE_IDLE_MS = 2000;

export type MenuCommand = 'up' | 'down' | 'left' | 'right' | 'accept' | 'back';

const keys = new Set<string>();
const heldUntil = new Map<number, number>();
/** Press events seen since the last sample: they are honoured by the next frame even if the frame is slow. */
let pendingBits = 0;
let mouseRight = false;
export const mouse = { x: 0, y: 0, inside: false, lastMoveAt: -1e9 };
let device: Device = 'keyboard';
let deviceListener: ((d: Device) => void) | null = null;
const menuQueue: MenuCommand[] = [];
let pauseRequested = false;
let muteRequested = false;
let anyInput = false;
let escDownAt = -1;
let skipFired = false;

function setDevice(d: Device): void {
  if (d === device) return;
  device = d;
  deviceListener?.(d);
}
export function currentDevice(): Device {
  return device;
}
export function onDeviceChange(fn: (d: Device) => void): void {
  deviceListener = fn;
}
/** True once since the last call if any user input happened (used to unlock audio). */
export function consumeAnyInput(): boolean {
  const v = anyInput;
  anyInput = false;
  return v;
}
export function consumePause(): boolean {
  const v = pauseRequested;
  pauseRequested = false;
  return v;
}
export function consumeMute(): boolean {
  const v = muteRequested;
  muteRequested = false;
  return v;
}
export function drainMenu(): MenuCommand[] {
  return menuQueue.splice(0, menuQueue.length);
}

const NAV_KEYS: Record<string, MenuCommand> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
  Enter: 'accept', NumpadEnter: 'accept', Space: 'accept', KeyE: 'accept',
};

/** Keep `bit` pressed for at least MIN_HOLD_MS while `down`. */
function latch(bit: number, down: boolean, now: number): void {
  if (down) heldUntil.set(bit, now + MIN_HOLD_MS);
}

window.addEventListener('keydown', (e) => {
  anyInput = true;
  setDevice('keyboard');
  keys.add(e.code);
  if (e.code === 'Space' || e.code.startsWith('Arrow') || e.code === 'Tab') e.preventDefault();
  const nav = NAV_KEYS[e.code];
  if (nav) menuQueue.push(nav);
  if (!e.repeat) {
    if (e.code === 'KeyE' || e.code === 'Space') pendingBits |= BTN_GRAB;
    else if (e.code === 'KeyQ') pendingBits |= BTN_SWAP;
    else if (e.code === 'KeyR') pendingBits |= BTN_TILT;
  }
  if (e.code === 'Escape' && !e.repeat) {
    escDownAt = performance.now();
    skipFired = false;
  }
  if (e.code === 'KeyM' && !e.repeat) muteRequested = true;
});
window.addEventListener('keyup', (e) => {
  keys.delete(e.code);
  if (e.code === 'Escape') {
    const held = performance.now() - escDownAt;
    if (!skipFired && held < SKIP_HOLD_MS) {
      pauseRequested = true;
    }
    escDownAt = -1;
  }
});
window.addEventListener('blur', () => {
  keys.clear();
  mouseRight = false;
  escDownAt = -1;
});

const canvas = document.getElementById('game');
(canvas ?? window).addEventListener('mousedown', (ev) => {
  const e = ev as MouseEvent;
  anyInput = true;
  setDevice('keyboard');
  if (e.button === 0) pendingBits |= BTN_GRAB;
  if (e.button === 2) mouseRight = true;
});
window.addEventListener('mouseup', (e) => {
  if (e.button === 2) mouseRight = false;
});
window.addEventListener('mousemove', (e) => {
  if (Math.abs(e.movementX) + Math.abs(e.movementY) > 0 || !mouse.inside) setDevice('keyboard');
  mouse.x = e.clientX;
  mouse.y = e.clientY;
  mouse.inside = true;
  mouse.lastMoveAt = performance.now();
});
window.addEventListener('contextmenu', (e) => e.preventDefault());

function deadzone(v: number): number {
  return Math.abs(v) > GAMEPAD_DEADZONE ? v : 0;
}
function toI8(v: number): number {
  return Math.max(-127, Math.min(127, Math.round(v * 127)));
}

let seq = 0;

/** True when the tool should auto-aim: gamepad in use, or the mouse never moved / has been idle for 2 s. */
export function wantsAutoAim(now: number): boolean {
  return device === 'gamepad' || !mouse.inside || now - mouse.lastMoveAt > MOUSE_IDLE_MS;
}

function firstPad(): Gamepad | undefined {
  return navigator.getGamepads?.().find((p): p is Gamepad => p !== null && p !== undefined);
}

// Edge state for gamepad menu navigation.
const padPrev = new Map<number, boolean>();
const stickNext = { x: 0, y: 0 };
let skipPadAt = -1;

/** Poll the gamepad for menu navigation and the Start (pause) button. Call once per frame. */
export function pollGamepad(now: number): void {
  const pad = firstPad();
  if (!pad) return;
  const down = (i: number): boolean => (pad.buttons[i]?.value ?? 0) > 0.5 || pad.buttons[i]?.pressed === true;
  const edge = (i: number): boolean => {
    const d = down(i);
    const was = padPrev.get(i) ?? false;
    padPrev.set(i, d);
    return d && !was;
  };
  if (edge(0)) {
    menuQueue.push('accept');
    setDevice('gamepad');
    anyInput = true;
  }
  if (edge(1)) {
    menuQueue.push('back');
    setDevice('gamepad');
    anyInput = true;
  }
  if (edge(9)) {
    pauseRequested = true;
    setDevice('gamepad');
    anyInput = true;
  }
  if (edge(12)) menuQueue.push('up');
  if (edge(13)) menuQueue.push('down');
  if (edge(14)) menuQueue.push('left');
  if (edge(15)) menuQueue.push('right');
  // Stick as a d-pad with auto-repeat.
  const sx = pad.axes[0] ?? 0;
  const sy = pad.axes[1] ?? 0;
  const stickDir = (v: number, axis: 'x' | 'y', neg: MenuCommand, pos: MenuCommand): void => {
    if (Math.abs(v) < 0.6) {
      stickNext[axis] = 0;
      return;
    }
    if (now >= stickNext[axis]) {
      menuQueue.push(v < 0 ? neg : pos);
      stickNext[axis] = now + (stickNext[axis] === 0 ? 380 : 150);
    }
  };
  stickDir(sx, 'x', 'left', 'right');
  stickDir(sy, 'y', 'up', 'down');
  if (Math.abs(sx) > 0.3 || Math.abs(sy) > 0.3 || [0, 1, 2, 3, 5, 7, 9].some(down)) setDevice('gamepad');
  // B held: tutorial skip progress (see skipProgress).
  if (down(1)) {
    if (skipPadAt < 0) skipPadAt = now;
  } else skipPadAt = -1;
}

/** 0..1 progress of holding B / Escape. Returns 1 once (and then resets) when the hold completes. */
export function skipProgress(now: number, enabled: boolean): number {
  if (!enabled) return 0;
  let p = 0;
  if (skipPadAt >= 0) p = Math.max(p, (now - skipPadAt) / SKIP_HOLD_MS);
  if (escDownAt >= 0 && !skipFired) p = Math.max(p, (now - escDownAt) / SKIP_HOLD_MS);
  if (p >= 1) {
    skipFired = true;
    skipPadAt = -1;
    escDownAt = -1;
    return 1;
  }
  return p;
}

/**
 * Sample keyboard + mouse + first gamepad into an InputFrame. x = right, y = down/back (maps to world +z).
 * `aim` (food voxels) comes from the caller (camera raycast); with `autoAim` the sim aims the tool itself.
 */
export function sampleInput(now: number, aim: [number, number, number], autoAim: boolean): InputFrame {
  const k = (c: string): number => (keys.has(c) ? 1 : 0);
  let x = k('KeyD') + k('ArrowRight') - k('KeyA') - k('ArrowLeft');
  let y = k('KeyS') + k('ArrowDown') - k('KeyW') - k('ArrowUp');
  latch(BTN_GRAB, keys.has('KeyE') || keys.has('Space'), now);
  latch(BTN_SWAP, keys.has('KeyQ'), now);
  latch(BTN_TILT, keys.has('KeyR'), now);
  latch(BTN_TOOL, mouseRight, now);
  const pad = firstPad();
  if (pad) {
    const px = deadzone(pad.axes[0] ?? 0);
    const py = deadzone(pad.axes[1] ?? 0);
    x += px;
    y += py;
    const b = (i: number): boolean => (pad.buttons[i]?.value ?? 0) > 0.4 || pad.buttons[i]?.pressed === true;
    x += (b(15) ? 1 : 0) - (b(14) ? 1 : 0);
    y += (b(13) ? 1 : 0) - (b(12) ? 1 : 0);
    latch(BTN_GRAB, b(0), now); // A
    latch(BTN_TOOL, b(2) || b(7), now); // X (or RT)
    latch(BTN_SWAP, b(3), now); // Y
    latch(BTN_TILT, b(5), now); // RB
  }
  for (const bit of [BTN_GRAB, BTN_SWAP, BTN_TILT]) if (pendingBits & bit) heldUntil.set(bit, now + MIN_HOLD_MS);
  pendingBits = 0;
  let buttons = autoAim ? BTN_AUTOAIM : 0;
  for (const [bit, until] of heldUntil) if (now < until) buttons |= bit;
  const len = Math.sqrt(x * x + y * y);
  if (len > 1) {
    x /= len;
    y /= len;
  }
  seq = (seq + 1) & 0xffff;
  return { tick: 0, move: [toI8(x), toI8(y)], aim, buttons, analog: { tool: 0 }, seq };
}

/** Frame with no input (title, results, pause). */
export function idleFrame(): InputFrame {
  pendingBits = 0;
  seq = (seq + 1) & 0xffff;
  return { tick: 0, move: [0, 0], aim: [0, 0, 0], buttons: BTN_AUTOAIM, analog: { tool: 0 }, seq };
}
