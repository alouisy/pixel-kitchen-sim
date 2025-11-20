// src/constants.js
export const PLAYER_HEIGHT = 1.8;
export const PLAYER_SPEED = 5.0;
export const INTERACTION_DISTANCE = 3.0;
// Bounds match the new 8x8 floor (Radius 4)
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
    WALL: 'wall'
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

// --- EDITOR CATALOG ---
export const CATALOG_ITEMS = [
    // Architecture
    { name: "Wall (Short)", type: STATION_TYPES.WALL, category: "Architecture", size: { width: 1.0, depth: 0.5 }, color: "#EFEBE9" },
    { name: "Wall (Long)", type: STATION_TYPES.WALL, category: "Architecture", size: { width: 2.0, depth: 0.5 }, color: "#EFEBE9" },
    { name: "Corner Wall", type: STATION_TYPES.WALL, category: "Architecture", size: { width: 0.5, depth: 0.5 }, color: "#EFEBE9" },
    
    // Counters
    { name: "Counter (Wood)", type: STATION_TYPES.COUNTER, category: "Furniture", color: "#8B4513" },
    { name: "Counter (Corner)", type: STATION_TYPES.COUNTER, category: "Furniture", color: "#8B4513" },
    { name: "Serving Pass", type: STATION_TYPES.SERVING, category: "Furniture", isServing: true },
    { name: "Table", type: STATION_TYPES.TABLE, category: "Furniture", color: "#CCCCCC" },
    { name: "Trash Bin", type: STATION_TYPES.TRASH, category: "Furniture", size: { width: 0.5, depth: 0.5 } },

    // Stations
    { name: "Cutting Board", type: STATION_TYPES.PROCESSOR, category: "Stations", size: { width: 0.5, depth: 0.5 }, color: "#DEB887", config: { processes: ["potato", "tomato", "lettuce"], processingTime: 0 } },
    { name: "Fryer", type: STATION_TYPES.PROCESSOR, category: "Stations", size: { width: 0.5, depth: 0.5 }, color: "#555", config: { processes: ["raw_fries"], processingTime: 3000 } },
    { name: "Stove", type: STATION_TYPES.PROCESSOR, category: "Stations", size: { width: 0.5, depth: 0.5 }, color: "#333", config: { processes: ["patty"], processingTime: 4000 } },
    
    // Sources
    { name: "Plate Stack", type: STATION_TYPES.ITEM_SOURCE, category: "Sources", size: { width: 0.5, depth: 0.5 }, config: { item: "plate" } },
    { name: "Potato Bin", type: STATION_TYPES.INGREDIENT_SOURCE, category: "Sources", size: { width: 0.5, depth: 0.5 }, color: "#CD853F", config: { ingredient: "potato" } },
    { name: "Tomato Bin", type: STATION_TYPES.INGREDIENT_SOURCE, category: "Sources", size: { width: 0.5, depth: 0.5 }, color: "#FF6347", config: { ingredient: "tomato" } },
    { name: "Lettuce Bin", type: STATION_TYPES.INGREDIENT_SOURCE, category: "Sources", size: { width: 0.5, depth: 0.5 }, color: "#90EE90", config: { ingredient: "lettuce" } },
    { name: "Bun Rack", type: STATION_TYPES.INGREDIENT_SOURCE, category: "Sources", size: { width: 0.5, depth: 0.5 }, color: "#F4A460", config: { ingredient: "bun" } },
    { name: "Patty Box", type: STATION_TYPES.INGREDIENT_SOURCE, category: "Sources", size: { width: 0.5, depth: 0.5 }, color: "#A52A2A", config: { ingredient: "patty" } },
];