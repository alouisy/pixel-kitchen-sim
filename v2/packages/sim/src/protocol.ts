import type { GameHud, HudState, InputFrame, SimCommand, SimEvent } from './types.js';

export type MainToWorker =
  | { type: 'init'; seed: number; chefSlots: number; arenaHalf?: number }
  | { type: 'input'; frame: InputFrame }
  | { type: 'command'; command: SimCommand }
  | { type: 'pause'; paused: boolean }
  /** Dev only (client gates it behind ?dev=1): move chef 0 to (x, z) metres. */
  | { type: 'dev-teleport'; x: number; z: number }
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
  | { type: 'hud'; tick: number; hud: HudState }
  /** Game flow + HUD numbers; posted every few ticks and on phase changes. */
  | { type: 'game'; tick: number; game: GameHud };

export interface FoodUpsert {
  id: number;
  dims: [number, number, number];
  origin: [number, number, number];
  material: Uint8Array;
  doneness: Uint8Array | null;
  char: Uint8Array | null;
}
