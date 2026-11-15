import type { InputFrame, SimEvent } from './types.js';

export type MainToWorker =
  | { type: 'init'; seed: number; chefSlots: number }
  | { type: 'input'; frame: InputFrame }
  | { type: 'stop' };

export type WorkerToMain =
  | {
      type: 'state';
      tick: number;
      alpha: number;
      /** x,y,z,yaw per chef slot. The buffer is transferred. */
      chefs: Float32Array;
      hash?: string;
    }
  | { type: 'events'; events: SimEvent[] };
