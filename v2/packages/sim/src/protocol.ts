import type { GameMode, HudState, InputFrame, SimEvent } from './types.js';

export type MainToWorker =
  | { type: 'init'; seed: number; chefSlots: number; arenaHalf?: number; mode?: GameMode }
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
  | { type: 'events'; events: SimEvent[] }
  /** Food bodies changed since the last post. Arrays are copies and are transferred. */
  | {
      type: 'food';
      tick: number;
      upserts: FoodUpsert[];
      moves: Array<{ id: number; origin: [number, number, number] }>;
      removed: number[];
    }
  /** Chef 0's presentation state; posted when it changes. */
  | { type: 'hud'; tick: number; hud: HudState };

export interface FoodUpsert {
  id: number;
  dims: [number, number, number];
  origin: [number, number, number];
  material: Uint8Array;
  doneness: Uint8Array | null;
  char: Uint8Array | null;
}
