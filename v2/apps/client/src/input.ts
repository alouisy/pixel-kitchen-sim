import { BTN_GRAB, BTN_SWAP, BTN_TILT, BTN_TOOL, type InputFrame } from '@ga/sim';

const GAMEPAD_DEADZONE = 0.15; // ported in spirit from V1 src/controls.js
/** Buttons stay down at least this long so a quick tap always spans a 30 Hz sim tick. */
const MIN_HOLD_MS = 50;

const keys = new Set<string>();
/** Keys pressed since the last sample: a tap shorter than a frame still registers. */
const tapped = new Set<string>();
const heldUntil = new Map<number, number>();
let mouseDown = false;
let clickTapped = false;
export const mouse = { x: 0, y: 0, inside: false, lastMoveAt: 0 };
let padActiveAt = -1e9;

function latch(bit: number, down: boolean, now: number): void {
  if (down) heldUntil.set(bit, now + MIN_HOLD_MS);
}

window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (!e.repeat) tapped.add(e.code);
  if (e.code === 'Space' || e.code === 'Tab' || e.code.startsWith('Arrow')) e.preventDefault();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => {
  keys.clear();
  mouseDown = false;
});
window.addEventListener('mousedown', (e) => {
  if (e.button === 0) mouseDown = clickTapped = true;
});
window.addEventListener('mouseup', (e) => {
  if (e.button === 0) mouseDown = false;
});
window.addEventListener('mousemove', (e) => {
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

/** True when the last meaningful input came from a gamepad (aim then follows the chef instead of the mouse). */
export function usingGamepad(now: number): boolean {
  return padActiveAt > mouse.lastMoveAt && now - padActiveAt < 5000;
}

/**
 * Sample keyboard + mouse + first gamepad into an InputFrame. x = right, y = down/back (maps to world +z).
 * `aim` (food voxels) is supplied by the caller, who owns the camera raycast.
 */
export function sampleInput(now: number, aim: [number, number, number]): InputFrame {
  const down = (code: string): boolean => keys.has(code) || tapped.has(code);
  // Physical key codes: KeyW/A/S/D are Z/Q/S/D on an AZERTY keyboard. Arrows work too.
  let x = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  let y = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
  latch(BTN_GRAB, down('KeyE') || down('Space') || down('Enter'), now);
  // Tab swaps tools (KeyQ kept for QWERTY players; on AZERTY that physical key is A, so it never clashes with ZQSD).
  latch(BTN_SWAP, down('Tab') || down('KeyQ'), now);
  latch(BTN_TILT, down('KeyR'), now);
  tapped.clear();
  latch(BTN_TOOL, mouseDown || clickTapped, now);
  clickTapped = false;
  const pad = navigator.getGamepads?.().find((p) => p !== null && p !== undefined);
  if (pad) {
    const px = deadzone(pad.axes[0] ?? 0);
    const py = deadzone(pad.axes[1] ?? 0);
    x += px;
    y += py;
    const b = (i: number) => (pad.buttons[i]?.value ?? 0) > 0.4 || pad.buttons[i]?.pressed === true;
    const anyButton = b(0) || b(2) || b(3) || b(7) || b(9);
    if (px !== 0 || py !== 0 || anyButton) padActiveAt = now;
    latch(BTN_GRAB, b(0) || b(9), now); // A, or Start on the title/results screens
    latch(BTN_TILT, b(2), now);
    latch(BTN_SWAP, b(3), now);
    latch(BTN_TOOL, b(7), now);
  }
  let buttons = 0;
  for (const [bit, until] of heldUntil) if (now < until) buttons |= bit;
  const len = Math.sqrt(x * x + y * y);
  if (len > 1) {
    x /= len;
    y /= len;
  }
  seq = (seq + 1) & 0xffff;
  return { tick: 0, move: [toI8(x), toI8(y)], aim, buttons, analog: { tool: 0 }, seq };
}
