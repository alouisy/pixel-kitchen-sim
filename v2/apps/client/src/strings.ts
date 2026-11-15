/** Tiny English string table (i18n keys from @ga/content cravings -> text). */
export const CRAVING_TEXT: Record<string, string> = {
  'craving.seared_mushroom': 'A seared, savory mushroom, cooked just right.',
  'craving.crunchy_hot': 'Something crunchy and piping hot.',
  'craving.tall_tower': 'A tall, savory tower of food!',
};

export const HIGHLIGHT_TEXT: Record<string, string> = {
  TOO_SMALL: 'Too small',
  PERFECT_SEAR: 'Perfect sear',
  RAW_CENTER: 'Raw center',
  MOSTLY_ASH: 'Mostly ash',
  TALL_TOWER: 'Tall tower',
  TOO_SPICY: 'Too spicy',
};

export const TIER_COLOR: Record<string, string> = {
  perfect: '#ffd23f',
  great: '#6fd36f',
  okay: '#f4a259',
  yuck: '#e4572e',
};

export const TIER_TEXT: Record<string, string> = {
  perfect: 'Perfect!',
  great: 'Great',
  okay: 'Okay',
  yuck: 'Yuck',
};

export const TILT_TEXT = ['Vertical', '45°', 'Flat'] as const;
export const TILT_ICON = ['│', '╱', '─'] as const;

export const TOOL_TEXT = { cleaver: 'Cleaver', torch: 'Torch' } as const;
export const TOOL_ICON = { cleaver: '🔪', torch: '🔥' } as const;

export const EVENT_TEXT = {
  TooHeavy: 'Too heavy to lift!',
  SpawnRefused: 'Kitchen is full (40 items max).',
  PlateEmpty: 'Put some food on the plate first.',
} as const;

export const HELP_LINES: ReadonlyArray<readonly [string, string]> = [
  ['WASD', 'move'],
  ['Mouse', 'aim'],
  ['Left click', 'use tool'],
  ['E / Space', 'grab / place / interact'],
  ['Q', 'swap tool'],
  ['R', 'cut angle'],
  ['H', 'toggle help'],
  ['Gamepad', 'stick move, RT tool, A grab, Y swap, X angle'],
];
