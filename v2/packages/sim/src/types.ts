/** Per-tick input for one chef (docs/v2/09 §7). */
export interface InputFrame {
  tick: number; // u32
  move: [number, number]; // i8, i8
  aim: [number, number, number]; // i16 x3, quantized world point
  buttons: number; // u16 bitfield
  analog: { tool: number }; // u8
  seq: number; // u16
}

/** InputFrame.buttons bits. GRAB/SWAP/TILT are edge-triggered in the sim; TOOL is level-held. */
export const BTN_GRAB = 1;
export const BTN_TOOL = 2;
export const BTN_SWAP = 4;
export const BTN_TILT = 8;

export type ToolKind = 'cleaver' | 'torch';
export type DishTier = 'perfect' | 'great' | 'okay' | 'yuck';

export type SimEvent =
  | { kind: 'tick'; tick: number }
  | { kind: 'DishServed'; slot: number; cravingId: string; score: number; tier: DishTier; highlights: string[] }
  | { kind: 'TooHeavy'; slot: number; bodyId: number }
  | { kind: 'SpawnRefused'; slot: number; reason: 'max_bodies' }
  | { kind: 'ToolSwapped'; slot: number; tool: ToolKind }
  | { kind: 'PlateEmpty'; slot: number };

/** Per-chef presentation state posted by the worker (and read by tests). */
export interface HudState {
  tool: ToolKind;
  tilt: 0 | 1 | 2;
  cravingId: string;
  heldId: number;
  facing: number;
  torchOn: boolean;
}

/**
 * Wire layout (little-endian):
 * tick u32 (0) | moveX i8 (4) | moveY i8 (5) | aim i16 x3 (6,8,10) | buttons u16 (12) | tool u8 (14) | seq u16 (15)
 * = 17 bytes. (The task brief said 14, but the listed fields sum to 17.)
 */
export const INPUT_FRAME_BYTES = 17;

export function encodeInputFrame(f: InputFrame, out: DataView = new DataView(new ArrayBuffer(INPUT_FRAME_BYTES)), offset = 0): DataView {
  out.setUint32(offset, f.tick, true);
  out.setInt8(offset + 4, f.move[0]);
  out.setInt8(offset + 5, f.move[1]);
  out.setInt16(offset + 6, f.aim[0], true);
  out.setInt16(offset + 8, f.aim[1], true);
  out.setInt16(offset + 10, f.aim[2], true);
  out.setUint16(offset + 12, f.buttons, true);
  out.setUint8(offset + 14, f.analog.tool);
  out.setUint16(offset + 15, f.seq, true);
  return out;
}

export function decodeInputFrame(v: DataView, offset = 0): InputFrame {
  return {
    tick: v.getUint32(offset, true),
    move: [v.getInt8(offset + 4), v.getInt8(offset + 5)],
    aim: [v.getInt16(offset + 6, true), v.getInt16(offset + 8, true), v.getInt16(offset + 10, true)],
    buttons: v.getUint16(offset + 12, true),
    analog: { tool: v.getUint8(offset + 14) },
    seq: v.getUint16(offset + 15, true),
  };
}
