import type { InputFrame } from '@ga/sim';

const GAMEPAD_DEADZONE = 0.15; // ported in spirit from V1 src/controls.js

const keys = new Set<string>();
window.addEventListener('keydown', (e) => keys.add(e.code));
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

function deadzone(v: number): number {
  return Math.abs(v) > GAMEPAD_DEADZONE ? v : 0;
}

function toI8(v: number): number {
  return Math.max(-127, Math.min(127, Math.round(v * 127)));
}

let seq = 0;

/** Sample keyboard + first gamepad into an InputFrame. x = right, y = down/back (maps to world +z). */
export function sampleInput(): InputFrame {
  let x = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
  let y = (keys.has('KeyS') ? 1 : 0) - (keys.has('KeyW') ? 1 : 0);
  const pad = navigator.getGamepads?.().find((p) => p !== null && p !== undefined);
  if (pad) {
    x += deadzone(pad.axes[0] ?? 0);
    y += deadzone(pad.axes[1] ?? 0);
  }
  const len = Math.hypot(x, y);
  if (len > 1) {
    x /= len;
    y /= len;
  }
  seq = (seq + 1) & 0xffff;
  return { tick: 0, move: [toI8(x), toI8(y)], aim: [0, 0, 0], buttons: 0, analog: { tool: 0 }, seq };
}
