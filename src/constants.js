// src/constants.js
export const PLAYER_HEIGHT = 1.8;
export const PLAYER_SPEED = 5.0;
export const INTERACTION_DISTANCE = 1.8; // Slightly increased
export const KITCHEN_BOUNDS = { xMin: -4.5, xMax: 4.5, zMin: -4.5, zMax: 4.5 };
export const COUNTER_HEIGHT = 0.9;
export const COUNTER_DEPTH = 0.6;
export const LABEL_Y_OFFSET = 0.3;

export const STATION_TYPES = {
    INGREDIENT_SOURCE: 'ingredient_source',
    ITEM_SOURCE: 'item_source',
    PROCESSOR: 'processor',
    ASSEMBLY: 'assembly',
    SERVING: 'serving',
};

export const ITEM_TYPES = {
    INGREDIENT: 'ingredient',
    ITEM: 'item', // For things like plates
};

export const INGREDIENT_STATES = {
    RAW: 'raw',
    CHOPPED: 'chopped', // Example for future use
    COOKING: 'cooking', // Example for future use
    COOKED: 'cooked',
};

// --- GAMEPAD ---
export const GAMEPAD_DEADZONE = 0.15;
export const GAMEPAD_INTERACT_BUTTON = 0; // Cross (X) / A
export const GAMEPAD_PAUSE_BUTTON = 9;    // Options / Menu button (common index for PS/Xbox)
export const GAMEPAD_LOOK_SENSITIVITY_X = 300.0; // Adjust these values to your liking
export const GAMEPAD_LOOK_SENSITIVITY_Y = 300.0;