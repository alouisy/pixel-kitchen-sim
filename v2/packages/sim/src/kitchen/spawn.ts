import { Prng } from '@ga/shared';
import { materialById } from '@ga/content';
import { fillBox, fillSphere, type FoodBody, type FoodStore } from '../food/index.js';
import { PADS, restingOriginY, type PadDef } from './layout.js';

function matIndex(id: PadDef['material']): number {
  const m = materialById(id);
  if (!m) throw new Error(`missing material ${id}`);
  return m.index;
}

/** Create a fresh body for `pad`, centred on the pad and resting on whatever is below. */
export function spawnAtPad(store: FoodStore, padIndex: number, rng: Prng): FoodBody {
  const pad = PADS[padIndex]!;
  const mat = matIndex(pad.material);
  let body: FoodBody;
  switch (pad.material) {
    case 'mushroom': {
      // Cap-like dome r=4, flat at the base (centre sits on the bottom layer).
      body = store.create([9, 5, 9], [pad.x - 4, 0, pad.z - 4]);
      fillSphere(body, [4, 0, 4], 4, mat);
      break;
    }
    case 'potato': {
      body = store.create([6, 6, 8], [pad.x - 3, 0, pad.z - 4]);
      fillBox(body, [0, 0, 0], [5, 5, 7], mat);
      // Round it off: knock out some of the 8 corner cells (deterministic via the food PRNG).
      for (let c = 0; c < 8; c++) {
        if (rng.nextU32() & 1) {
          const x = c & 1 ? 5 : 0;
          const y = c & 2 ? 5 : 0;
          const z = c & 4 ? 7 : 0;
          body.material[x + 6 * (y + 6 * z)] = 0;
        }
      }
      break;
    }
    case 'bread_rock':
      body = store.create([10, 6, 6], [pad.x - 5, 0, pad.z - 3]);
      fillBox(body, [0, 0, 0], [9, 5, 5], mat);
      break;
    case 'pepper':
      body = store.create([4, 4, 10], [pad.x - 2, 0, pad.z - 5]);
      fillBox(body, [0, 0, 0], [3, 3, 9], mat);
      break;
  }
  body.origin[1] = restingOriginY(store, body);
  return body;
}
