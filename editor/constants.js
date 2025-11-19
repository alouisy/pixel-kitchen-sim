// editor/constants.js)
export const PLAYER_HEIGHT = 1.8;
export const PLAYER_SPEED = 5.0;
export const INTERACTION_DISTANCE = 2.0;
export const KITCHEN_BOUNDS = { xMin: -4.5, xMax: 4.5, zMin: -4.5, zMax: 4.5 }; // May need adjustment based on layouts
export const COUNTER_HEIGHT = 0.9;
export const COUNTER_DEPTH = 0.6; // Default depth, can be overridden
export const LABEL_Y_OFFSET = 0.3;

export const STATION_TYPES = {
    // Functional Stations
    INGREDIENT_SOURCE: 'ingredient_source',
    ITEM_SOURCE: 'item_source',
    PROCESSOR: 'processor',
    ASSEMBLY: 'assembly',
    SERVING: 'serving',
    // Non-interactable / Structural
    COUNTER: 'counter', // Explicit type for counters
    FLOOR: 'floor',
    WALL: 'wall', // For potential future use - ADDED WALL TYPE
    DECORATION: 'decoration' // Existing decoration type
};

export const ITEM_TYPES = {
    INGREDIENT: 'ingredient',
    ITEM: 'item', // For things like plates, bowls, cups
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
    BASE: 'base', // e.g., pizza base
    READY: 'ready', // Generic ready state for things like syrup, yogurt
    DRY: 'dry', // e.g., pancake mix
    SHREDDED: 'shredded', // e.g., cheese
};

// --- GAMEPAD ---
export const GAMEPAD_DEADZONE = 0.15;
export const GAMEPAD_INTERACT_BUTTON = 0; // Cross (X) / A
export const GAMEPAD_BACK_BUTTON = 1;     // Circle / B (Used in MenuManager)
export const GAMEPAD_INSTRUCTIONS_BUTTON = 3; // Triangle / Y
export const GAMEPAD_PAUSE_BUTTON = 9;    // Options / Menu button (common index for PS/Xbox)
export const GAMEPAD_LOOK_SENSITIVITY_X = 300.0;
export const GAMEPAD_LOOK_SENSITIVITY_Y = 300.0;

// --- KEYBOARD ---
export const KEYBOARD_INSTRUCTIONS_KEY = 'KeyI'; // 'I' key for Instructions

// --- ASSEMBLY STATION ---
export const ASSEMBLY_STATION_CAPACITY = 3; // Max items directly on the station surface (now managed by slots)