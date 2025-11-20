// src/constants.js
export const PLAYER_HEIGHT = 1.8;
export const PLAYER_SPEED = 5.0;
export const INTERACTION_DISTANCE = 3.0;
// Tightened bounds to match the new 8x8 kitchen walls (approx +/- 4.0)
export const KITCHEN_BOUNDS = { xMin: -3.5, xMax: 3.5, zMin: -3.5, zMax: 3.5 }; 

// --- GRID & DIMENSIONS ---
export const GRID_UNIT = 0.5; 
export const MODULE_HEIGHT = 0.9; 
export const LABEL_Y_OFFSET = 0.3;

export const STATION_TYPES = {
    INGREDIENT_SOURCE: 'ingredient_source',
    ITEM_SOURCE: 'item_source',
    PROCESSOR: 'processor',
    SERVING: 'serving',
    COUNTER: 'counter', // Solid block
    TABLE: 'table',     // With smart legs
    FLOOR: 'floor',
    TRASH: 'trash',
    WALL: 'wall'        // Added Wall type
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
    READY: 'ready',
};

// --- INPUT ---
export const GAMEPAD_DEADZONE = 0.15;
export const GAMEPAD_INTERACT_BUTTON = 0; // Cross/A
export const GAMEPAD_BACK_BUTTON = 1;     // Circle/B
export const GAMEPAD_INSTRUCTIONS_BUTTON = 3; // Triangle/Y
export const GAMEPAD_PAUSE_BUTTON = 9;    // Options/Start
export const GAMEPAD_LOOK_SENSITIVITY_X = 300.0;
export const GAMEPAD_LOOK_SENSITIVITY_Y = 300.0;

export const KEYBOARD_INSTRUCTIONS_KEY = 'KeyI';