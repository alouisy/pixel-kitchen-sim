import { SIM_DT_MS } from '@ga/shared';
import type { InputFrame, SimEvent } from './types.js';

export const MAX_STEPS_PER_ADVANCE = 5;

export interface Steppable {
  readonly tick: number;
  step(inputs: ReadonlyArray<InputFrame | undefined>): SimEvent[];
}

/** Accumulator-based fixed-step driver. Time is injected by the caller (this file never reads a clock). */
export class FixedStepLoop {
  private accumulatorMs = 0;

  constructor(private readonly sim: Steppable) {}

  /**
   * Add `elapsedMs` of wall time and run 0..MAX_STEPS_PER_ADVANCE ticks.
   * `onStep` fires after each tick. Returns alpha in [0,1) for render interpolation.
   */
  advance(
    elapsedMs: number,
    getInputs: () => ReadonlyArray<InputFrame | undefined>,
    onStep?: (events: SimEvent[]) => void,
  ): number {
    this.accumulatorMs += elapsedMs;
    let steps = 0;
    while (this.accumulatorMs >= SIM_DT_MS && steps < MAX_STEPS_PER_ADVANCE) {
      const events = this.sim.step(getInputs());
      this.accumulatorMs -= SIM_DT_MS;
      steps++;
      onStep?.(events);
    }
    // Spiral-of-death guard: drop backlog beyond the cap.
    if (this.accumulatorMs >= SIM_DT_MS) this.accumulatorMs = this.accumulatorMs % SIM_DT_MS;
    return this.accumulatorMs / SIM_DT_MS;
  }
}
