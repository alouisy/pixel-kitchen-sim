import { SimWorld } from '../world.js';
import type { InputFrame, SimEvent } from '../types.js';
import { BTN_AUTOAIM } from '../types.js';

/** Scripted-input driver shared by the sim tests (not imported by the app). */
export class Driver {
  events: SimEvent[] = [];
  seq = 0;
  constructor(public w: SimWorld) {}
  step(move: [number, number], buttons = 0, aim: [number, number, number] = [0, 0, 0]): void {
    const f: InputFrame = { tick: this.w.tick + 1, move, aim, buttons, analog: { tool: 0 }, seq: this.seq++ };
    this.events.push(...this.w.step([f]));
  }
  idle(n: number): void {
    for (let i = 0; i < n; i++) this.step([0, 0]);
  }
  /** Press and release `btn` (auto-aim so the facing is not turned toward the zero aim point). */
  press(btn: number): void {
    this.step([0, 0], btn | BTN_AUTOAIM);
    this.step([0, 0], 0);
  }
  pos(): { x: number; z: number } {
    const s = this.w.readChefStates();
    return { x: s[0]!, z: s[2]! };
  }
  walkX(tx: number): void {
    for (let i = 0; i < 600; i++) {
      const dx = tx - this.pos().x;
      if (Math.abs(dx) < 0.04) break;
      this.step([Math.max(-127, Math.min(127, Math.round(dx * 320))), 0]);
    }
    this.idle(6);
  }
  walkZ(tz: number): void {
    for (let i = 0; i < 600; i++) {
      const dz = tz - this.pos().z;
      if (Math.abs(dz) < 0.04) break;
      this.step([0, Math.max(-127, Math.min(127, Math.round(dz * 320)))]);
    }
    this.idle(6);
  }
  faceNorth(): void {
    for (let i = 0; i < 20; i++) this.step([0, -127]);
    this.idle(6);
  }
  /** Walk to the table edge at metre x and face north (the pose for pads, the rock and the mouth). */
  goToTable(x: number): void {
    if (this.pos().z > -1.2) this.walkZ(-1.2);
    this.walkX(x);
    this.faceNorth();
  }
  count(kind: SimEvent['kind']): number {
    return this.events.filter((e) => e.kind === kind).length;
  }
}
