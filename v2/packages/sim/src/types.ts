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
/** Level flag: ignore `aim` and let the sim aim the tool at the nearest food in front of the chef. */
export const BTN_AUTOAIM = 16;

export type ToolKind = 'cleaver' | 'torch';
export type DishTier = 'perfect' | 'great' | 'okay' | 'yuck';

export type Phase = 'title' | 'tutorial' | 'service' | 'results';
export type EndReason = 'time' | 'patience';
/** Commands that change the game phase (applied between ticks, see SimWorld.command). */
export type SimCommand = 'startTutorial' | 'startService' | 'toTitle' | 'skipTutorial';

export type SimEvent =
  | { kind: 'tick'; tick: number }
  | {
      kind: 'DishServed';
      slot: number;
      cravingId: string;
      score: number;
      tier: DishTier;
      highlights: string[];
      /** Points added to the service score (0 in the tutorial). */
      points: number;
      timeBonus: number;
      bellyGain: number;
    }
  | { kind: 'TooHeavy'; slot: number; bodyId: number }
  | { kind: 'SpawnRefused'; slot: number; reason: 'max_bodies' }
  | { kind: 'ToolSwapped'; slot: number; tool: ToolKind }
  | { kind: 'TooSmallToCut'; slot: number; bodyId: number }
  /** A cleaver cut happened at world food-voxel cell (x, y, z); crumbs were removed at `crumbAt`. */
  | { kind: 'Cut'; slot: number; x: number; y: number; z: number; crumbs: number; crumbAt: Array<[number, number, number]> }
  | { kind: 'Grabbed'; slot: number; count: number }
  | { kind: 'Placed'; slot: number }
  | { kind: 'PhaseChanged'; phase: Phase }
  | { kind: 'TutorialStep'; step: number }
  | { kind: 'TutorialDone' }
  | { kind: 'CravingExpired'; cravingId: string }
  | { kind: 'CravingChanged'; cravingId: string }
  | { kind: 'HangryEntered'; patience: number }
  | { kind: 'ServiceEnded'; reason: EndReason; score: number; served: number };

/** Per-chef presentation state posted by the worker (and read by tests). */
export interface HudState {
  tool: ToolKind;
  tilt: 0 | 1 | 2;
  cravingId: string;
  heldId: number;
  facing: number;
  torchOn: boolean;
}

export type PromptKind = 'take' | 'place' | 'serve';
export interface GaugeInfo {
  id: number;
  /** Bottom-layer average doneness 0..255. */
  doneMarker: number;
  /** Perfect band (0..255) from the material. */
  perfectLo: number;
  perfectHi: number;
  /** Doneness at which charring starts (0..255). */
  burnAt: number;
  /** Top-centre of the body in metres. */
  x: number;
  y: number;
  z: number;
}

/** Everything the DOM HUD needs about the game (posted by the worker ~10 Hz). Positions in metres. */
export interface GameHud {
  phase: Phase;
  /** 0-based tutorial step (0..4), -1 outside the tutorial. */
  tutorialStep: number;
  /** Seconds of service left. */
  timeLeft: number;
  belly: number;
  /** 0 content, 1 peckish, 2 hungry, 3 hangry. */
  band: 0 | 1 | 2 | 3;
  mood: number;
  patience: number;
  cravingId: string;
  cravingTimeLeft: number;
  cravingWindow: number;
  score: number;
  served: number;
  bestDishScore: number;
  bestDishCravingId: string;
  bestDishTier: DishTier | '';
  endReason: EndReason | '';
  stars: 0 | 1 | 2 | 3;
  /** Tutorial arrow target (metres) or null. */
  target: { x: number; y: number; z: number; kind: 'pad' | 'rock' | 'mouth' } | null;
  prompt: { kind: PromptKind; x: number; y: number; z: number } | null;
  gauges: GaugeInfo[];
  /** Resolved tool aim in food voxels (mouse aim or auto-aim). */
  aim: [number, number, number];
  heldCount: number;
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
