import type { BucketId } from '@ga/content';

export type ItemState = 'raw' | 'chopped' | 'cooking' | 'cooked' | 'burning' | 'burnt';

/** Discrete item model (docs/v2/05 §1). `progress` is Q8 (0..256) of the current step; `ticks` is the integer tick counter behind it. */
export interface RushItem {
  id: number;
  def: string;
  state: ItemState;
  progress: number;
  ticks: number;
  /** Containers only: component defs, kept sorted. */
  contents: string[];
  /** Burn window in ticks once cooked (0 = never burns). */
  burnTicks: number;
  holder: { kind: 'chef' | 'socket'; id: number };
}

/** Input of one chef for one tick. */
export interface RushInput {
  /** i8 stick, x right, y towards +z (screen down). */
  move: [number, number];
  buttons: number;
  /** Station index clicked, or -1. Acted on when `clickSeq` changes. */
  click: number;
  clickSeq: number;
  /** 0: walk there then interact (left click). 1: walk there only (right click, chop is driven by the held X bit). */
  clickKind: 0 | 1;
}

/** Buttons: A is edge-triggered (take / place / serve), X is level-held (chop), B is edge-triggered (dash). */
export const RB_A = 1;
export const RB_X = 2;
export const RB_B = 4;

export function idleRushInput(): RushInput {
  return { move: [0, 0], buttons: 0, click: -1, clickSeq: 0, clickKind: 0 };
}

export type RushPhase = 'countdown' | 'playing' | 'ended';

export type Verb = 'none' | 'take' | 'place' | 'add' | 'scoop' | 'serve' | 'trash' | 'chop';

export type RefuseReason = 'cannot_place' | 'cannot_add' | 'burnt' | 'hands_full' | 'nothing';

export type RushEvent =
  | { kind: 'Countdown'; n: number }
  | { kind: 'Go' }
  | { kind: 'TimeUp'; score: number; stars: number }
  | { kind: 'Grabbed'; slot: number; def: string }
  | { kind: 'Placed'; slot: number; station: number }
  | { kind: 'Plated'; slot: number; station: number }
  | { kind: 'Trashed'; slot: number }
  | { kind: 'ChopHit'; slot: number; station: number }
  | { kind: 'ChopDone'; slot: number; station: number }
  | { kind: 'CookStart'; station: number }
  | { kind: 'Cooked'; station: number }
  | { kind: 'BurnWarning'; station: number }
  | { kind: 'Burnt'; station: number }
  | { kind: 'Dash'; slot: number }
  | { kind: 'Refused'; slot: number; reason: RefuseReason }
  | { kind: 'TicketNew'; ticket: number; recipe: string }
  | { kind: 'TicketExpired'; ticket: number; recipe: string; penalty: number }
  | { kind: 'Served'; slot: number; ticket: number; recipe: string; points: number; streak: number; multPermille: number; secondsLeft: number }
  | { kind: 'WrongDish'; slot: number; penalty: number };

export interface ItemView {
  id: number;
  def: string;
  state: ItemState;
  progress: number;
  contents: string[];
}

export interface ChefView {
  slot: number;
  x: number;
  z: number;
  /** Unit facing vector (the client derives the yaw). */
  fx: number;
  fz: number;
  held: ItemView | null;
  /** Station index in reach (the glow), or -1. */
  target: number;
  verb: Verb;
  /** True when holding X on this target would chop. */
  canChop: boolean;
  chopping: boolean;
  dashing: boolean;
  walking: boolean;
  dashReady: boolean;
}

export interface StationView {
  index: number;
  id: string;
  def: string;
  enabled: boolean;
  item: ItemView | null;
}

export interface TicketView {
  id: number;
  recipe: string;
  leftTicks: number;
  totalTicks: number;
}

export interface RushView {
  tick: number;
  phase: RushPhase;
  /** Whole seconds of countdown left (3, 2, 1) while counting down, else 0. */
  countdown: number;
  timeLeftTicks: number;
  score: number;
  streak: number;
  multPermille: number;
  served: number;
  expired: number;
  wrong: number;
  bucket: BucketId;
  stars: 0 | 1 | 2 | 3;
  starThresholds: [number, number, number];
  chefs: ChefView[];
  stations: StationView[];
  tickets: TicketView[];
  /** True until the first successful serve (drives the guide trail). */
  firstOrder: boolean;
}
