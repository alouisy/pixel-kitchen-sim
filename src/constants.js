// src/constants.js
export const PLAYER_HEIGHT = 1.8;
export const PLAYER_SPEED = 5.0;
export const INTERACTION_DISTANCE = 3.0; // Increased slightly for easier floor reach
export const KITCHEN_BOUNDS = { xMin: -4.5, xMax: 4.5, zMin: -4.5, zMax: 4.5 }; 
export const COUNTER_HEIGHT = 0.85; // Base height
export const COUNTER_TOP_HEIGHT = 0.05; // Thickness
export const LABEL_Y_OFFSET = 0.3;

// --- GRID SYSTEM ---
export const GRID_UNIT = 0.5; // 1 Slot = 0.5x0.5 Three.js units

export const STATION_TYPES = {
    INGREDIENT_SOURCE: 'ingredient_source',
    ITEM_SOURCE: 'item_source',
    PROCESSOR: 'processor',
    ASSEMBLY: 'assembly',
    SERVING: 'serving',
    COUNTER: 'counter',
    FLOOR: 'floor',
    WALL: 'wall',
};

export const ITEM_TYPES = {
    INGREDIENT: 'ingredient',
    ITEM: 'item', 
};

export const INGREDIENT_STATES = {
    RAW: 'raw',
    CHOPPED: 'chopped',
    COOKED: 'cooked',
    MIXED: 'mixed',
    BATTER: 'batter',
    SLICED: 'sliced',
    TOASTED: 'toasted',
    COATED: 'coated',
    BASE: 'base',
    READY: 'ready',
    DRY: 'dry',
    SHREDDED: 'shredded',
};

export const GAMEPAD_DEADZONE = 0.15;
export const GAMEPAD_INTERACT_BUTTON = 0; 
export const GAMEPAD_BACK_BUTTON = 1;     
export const GAMEPAD_INSTRUCTIONS_BUTTON = 3; 
export const GAMEPAD_PAUSE_BUTTON = 9;    
export const GAMEPAD_LOOK_SENSITIVITY_X = 300.0;
export const GAMEPAD_LOOK_SENSITIVITY_Y = 300.0;
export const KEYBOARD_INSTRUCTIONS_KEY = 'KeyI';

export const ASSEMBLY_STATION_CAPACITY = 3;