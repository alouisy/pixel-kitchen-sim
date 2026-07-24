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
    WALL: 'wall',
    PREPLACED_ITEM: 'preplaced_item' // New type for individual items
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

export const INGREDIENT_RENDER_ORDER = [
    'bread',
    'toasted_bread',
    'bun',            // Handled as bottom bun during assembly
    'bun_bottom',
    'chopped_lettuce',
    'chopped_tomato',
    'cooked_patty',
    'patty',
    'cooked_bacon',
    'bacon',
    'cheese_slice',
    'bun_top'
];

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
import { STATION } from './ids.js';

export const CATALOG_ITEMS = [
    // --- ARCHITECTURE ---
    { name: STATION.WALL_SHORT, type: STATION_TYPES.WALL, category: "Architecture", size: { width: 1.0, depth: 0.5 }, color: "#EFEBE9" },
    { name: STATION.WALL_LONG, type: STATION_TYPES.WALL, category: "Architecture", size: { width: 2.0, depth: 0.5 }, color: "#EFEBE9" },
    { name: STATION.WALL_CORNER, type: STATION_TYPES.WALL, category: "Architecture", size: { width: 0.5, depth: 0.5 }, color: "#EFEBE9" },
    
    // --- FURNITURE ---
    { name: STATION.COUNTER_WOOD, type: STATION_TYPES.COUNTER, category: "Furniture", color: "#8B4513" },
    { name: STATION.COUNTER_CORNER, type: STATION_TYPES.COUNTER, category: "Furniture", color: "#8B4513" },
    { name: STATION.SERVING_PASS, type: STATION_TYPES.SERVING, category: "Furniture", isServing: true },
    { name: STATION.TABLE, type: STATION_TYPES.TABLE, category: "Furniture", color: "#CCCCCC" },
    { name: STATION.TRASH_BIN, type: STATION_TYPES.TRASH, category: "Furniture", size: { width: 0.5, depth: 0.5 } },

    // --- DECORATIONS ---
    { name: "potted_plant", type: "decoration", category: "Decorations", size: { width: 0.5, depth: 0.5 } },
    { name: "exhaust_hood", type: "decoration", category: "Decorations", size: { width: 0.5, depth: 0.5 } },
    { name: "hanging_lamp", type: "decoration", category: "Decorations", size: { width: 0.5, depth: 0.5 } },

    // --- ITEMS (Single Placeable) ---
    { name: "plate", type: STATION_TYPES.PREPLACED_ITEM, category: "Items", size: { width: 0.5, depth: 0.5 }, config: { item: "plate" } },
    { name: "bowl", type: STATION_TYPES.PREPLACED_ITEM, category: "Items", size: { width: 0.5, depth: 0.5 }, config: { item: "bowl" } },
    { name: "cup", type: STATION_TYPES.PREPLACED_ITEM, category: "Items", size: { width: 0.5, depth: 0.5 }, config: { item: "cup" } },

    // --- PROCESSORS (APPLIANCES) ---
    { name: STATION.CUTTING_BOARD, type: STATION_TYPES.PROCESSOR, category: "Stations", size: { width: 0.5, depth: 0.5 }, color: "#DEB887", config: { processes: ["potato", "tomato", "lettuce", "onion", "banana", "strawberry", "raw_chicken"], result: { "potato": "raw_fries", "tomato": "chopped_tomato", "lettuce": "chopped_lettuce", "onion": "onion_rings_raw", "banana": "sliced_banana", "strawberry": "sliced_strawberry", "raw_chicken": "raw_chicken_strips" } } },
    { name: STATION.STOVE_TOP, type: STATION_TYPES.PROCESSOR, category: "Stations", size: { width: 0.5, depth: 0.5 }, color: "#333", config: { processes: ["patty", "raw_bacon", "pancake_batter", "omelette_mix", "grilled_cheese_raw"], result: { "patty": "cooked_patty", "raw_bacon": "cooked_bacon", "pancake_batter": "cooked_pancakes", "omelette_mix": "cooked_omelette", "grilled_cheese_raw": "grilled_cheese_cooked" }, processingTime: 4000 } },
    { name: STATION.DEEP_FRYER, type: STATION_TYPES.PROCESSOR, category: "Stations", size: { width: 0.5, depth: 0.5 }, color: "#555", config: { processes: ["raw_fries", "onion_rings_coated", "coated_chicken_strips"], result: { "raw_fries": "cooked_fries", "onion_rings_coated": "cooked_onion_rings", "coated_chicken_strips": "cooked_chicken_tenders" }, processingTime: 3000 } },
    { name: STATION.COATING_STATION, type: STATION_TYPES.PROCESSOR, category: "Stations", size: { width: 0.5, depth: 0.5 }, color: "#DEB887", config: { processes: ["raw_chicken_strips", "onion_rings_raw"], result: { "raw_chicken_strips": "coated_chicken_strips", "onion_rings_raw": "onion_rings_coated" }, processingTime: 2000 } },
    { name: STATION.TOASTER, type: STATION_TYPES.PROCESSOR, category: "Stations", size: { width: 0.5, depth: 0.5 }, color: "#D3D3D3", config: { processes: ["bread_slice"], result: { "bread_slice": "toasted_bread" }, processingTime: 3000 } },
    { name: STATION.STAND_MIXER, type: STATION_TYPES.PROCESSOR, category: "Stations", size: { width: 0.5, depth: 0.5 }, color: "#FFF", config: { processes: ["egg", "pancake_mix"], result: { "egg": "omelette_mix", "pancake_mix": "pancake_batter" }, processingTime: 2000 } },
    { name: STATION.BLENDER, type: STATION_TYPES.PROCESSOR, category: "Stations", size: { width: 0.5, depth: 0.5 }, color: "#708090", config: { requiredIngredients: ["sliced_banana", "sliced_strawberry", "milk"], outputItem: "smoothie_ready", acceptsIngredients: ["sliced_banana", "sliced_strawberry", "milk", "yogurt"], acceptsContainer: "cup" } },
    { name: STATION.DOUGH_PRESS, type: STATION_TYPES.PROCESSOR, category: "Stations", size: { width: 0.5, depth: 0.5 }, color: "#B0C4DE", config: { processes: ["pizza_dough"], result: { "pizza_dough": "pizza_base" } } },
    { name: STATION.PIZZA_OVEN, type: STATION_TYPES.PROCESSOR, category: "Stations", size: { width: 0.5, depth: 0.5 }, color: "#8B0000", config: { processes: ["pizza_margherita_raw"], result: { "pizza_margherita_raw": "cooked_pizza_margherita" }, processingTime: 6000 } },
    
    // --- SOURCES (INGREDIENTS) ---
    { name: STATION.PLATE_STACK, type: STATION_TYPES.ITEM_SOURCE, category: "Sources", size: { width: 0.5, depth: 0.5 }, config: { item: "plate" } },
    { name: STATION.BOWL_STACK, type: STATION_TYPES.ITEM_SOURCE, category: "Sources", size: { width: 0.5, depth: 0.5 }, config: { item: "bowl" } },
    { name: STATION.CUP_STACK, type: STATION_TYPES.ITEM_SOURCE, category: "Sources", size: { width: 0.5, depth: 0.5 }, config: { item: "cup" } },
    
    { name: STATION.POTATO_BIN, type: STATION_TYPES.INGREDIENT_SOURCE, category: "Sources", size: { width: 0.5, depth: 0.5 }, color: "#CD853F", config: { ingredient: "potato" } },
    { name: STATION.TOMATO_BIN, type: STATION_TYPES.INGREDIENT_SOURCE, category: "Sources", size: { width: 0.5, depth: 0.5 }, color: "#FF6347", config: { ingredient: "tomato" } },
    { name: STATION.LETTUCE_BIN, type: STATION_TYPES.INGREDIENT_SOURCE, category: "Sources", size: { width: 0.5, depth: 0.5 }, color: "#90EE90", config: { ingredient: "lettuce" } },
    { name: STATION.ONION_BIN, type: STATION_TYPES.INGREDIENT_SOURCE, category: "Sources", size: { width: 0.5, depth: 0.5 }, color: "#F0F8FF", config: { ingredient: "onion" } },
    { name: STATION.BANANA_CRATE, type: STATION_TYPES.INGREDIENT_SOURCE, category: "Sources", size: { width: 0.5, depth: 0.5 }, color: "#FFE135", config: { ingredient: "banana" } },
    { name: STATION.STRAWBERRY_BOX, type: STATION_TYPES.INGREDIENT_SOURCE, category: "Sources", size: { width: 0.5, depth: 0.5 }, color: "#FC5A8D", config: { ingredient: "strawberry" } },
    
    { name: STATION.BUN_RACK, type: STATION_TYPES.INGREDIENT_SOURCE, category: "Sources", size: { width: 0.5, depth: 0.5 }, color: "#F4A460", config: { ingredient: "bun" } },
    { name: STATION.BREAD_RACK, type: STATION_TYPES.INGREDIENT_SOURCE, category: "Sources", size: { width: 0.5, depth: 0.5 }, color: "#DEB887", config: { ingredient: "bread_slice" } },
    { name: STATION.PATTY_BOX, type: STATION_TYPES.INGREDIENT_SOURCE, category: "Sources", size: { width: 0.5, depth: 0.5 }, color: "#A52A2A", config: { ingredient: "patty" } },
    { name: STATION.CHICKEN_BOX, type: STATION_TYPES.INGREDIENT_SOURCE, category: "Sources", size: { width: 0.5, depth: 0.5 }, color: "#FFB6C1", config: { ingredient: "raw_chicken" } },
    { name: STATION.BACON_PACK, type: STATION_TYPES.INGREDIENT_SOURCE, category: "Sources", size: { width: 0.5, depth: 0.5 }, color: "#CD5C5C", config: { ingredient: "raw_bacon" } },
    { name: STATION.CHEESE_FRIDGE, type: STATION_TYPES.INGREDIENT_SOURCE, category: "Sources", size: { width: 0.5, depth: 0.5 }, color: "#FFD700", config: { ingredient: "cheese_slice" } },
    { name: STATION.MOZZARELLA_BIN, type: STATION_TYPES.INGREDIENT_SOURCE, category: "Sources", size: { width: 0.5, depth: 0.5 }, color: "#FFFFF0", config: { ingredient: "shredded_mozzarella" } },
    { name: STATION.PIZZA_DOUGH, type: STATION_TYPES.INGREDIENT_SOURCE, category: "Sources", size: { width: 0.5, depth: 0.5 }, color: "#F5DEB3", config: { ingredient: "pizza_dough" } },
    
    { name: STATION.EGG_CARTON, type: STATION_TYPES.INGREDIENT_SOURCE, category: "Sources", size: { width: 0.5, depth: 0.5 }, color: "#FFF8DC", config: { ingredient: "egg" } },
    { name: STATION.MILK_CARTON, type: STATION_TYPES.INGREDIENT_SOURCE, category: "Sources", size: { width: 0.5, depth: 0.5 }, color: "#FFFFFF", config: { ingredient: "milk" } },
    { name: STATION.YOGURT_POT, type: STATION_TYPES.INGREDIENT_SOURCE, category: "Sources", size: { width: 0.5, depth: 0.5 }, color: "#F0FFFF", config: { ingredient: "yogurt" } },
    { name: STATION.PANCAKE_MIX, type: STATION_TYPES.INGREDIENT_SOURCE, category: "Sources", size: { width: 0.5, depth: 0.5 }, color: "#F5DEB3", config: { ingredient: "pancake_mix" } },
    
    { name: STATION.TOMATO_SAUCE, type: STATION_TYPES.INGREDIENT_SOURCE, category: "Sources", size: { width: 0.5, depth: 0.5 }, color: "#8B0000", config: { ingredient: "tomato_sauce" } },
    { name: STATION.SYRUP_BOTTLE, type: STATION_TYPES.INGREDIENT_SOURCE, category: "Sources", size: { width: 0.5, depth: 0.5 }, color: "#8B4513", config: { ingredient: "syrup" } },
    { name: STATION.GRANOLA_JAR, type: STATION_TYPES.INGREDIENT_SOURCE, category: "Sources", size: { width: 0.5, depth: 0.5 }, color: "#D2691E", config: { ingredient: "granola" } },
    { name: STATION.COATING_MIX, type: STATION_TYPES.INGREDIENT_SOURCE, category: "Sources", size: { width: 0.5, depth: 0.5 }, color: "#F5F5DC", config: { ingredient: "coating_mix" } },

    // --- INGREDIENTS (Preplaceable) ---
    { name: "potato", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "potato" } },
    { name: "tomato", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "tomato" } },
    { name: "lettuce", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "lettuce" } },
    { name: "onion", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "onion" } },
    { name: "banana", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "banana" } },
    { name: "strawberry", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "strawberry" } },
    { name: "bun", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "bun" } },
    { name: "bread_slice", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "bread_slice" } },
    { name: "patty", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "patty" } },
    { name: "cooked_patty", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "cooked_patty" } },
    { name: "raw_chicken", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "raw_chicken" } },
    { name: "raw_bacon", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "raw_bacon" } },
    { name: "cooked_bacon", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "cooked_bacon" } },
    { name: "cheese_slice", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "cheese_slice" } },
    { name: "shredded_mozzarella", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "shredded_mozzarella" } },
    { name: "pizza_dough", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "pizza_dough" } },
    { name: "egg", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "egg" } },
    { name: "milk", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "milk" } },
    { name: "yogurt", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "yogurt" } },
    { name: "pancake_mix", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "pancake_mix" } },
    { name: "tomato_sauce", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "tomato_sauce" } },
    { name: "syrup", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "syrup" } },
    { name: "granola", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "granola" } },
    { name: "coating_mix", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "coating_mix" } },
    { name: "chopped_tomato", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "chopped_tomato" } },
    { name: "chopped_lettuce", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "chopped_lettuce" } },
    { name: "cooked_fries", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "cooked_fries" } },
    { name: "pizza_base", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "pizza_base" } },
    { name: "pancake_batter", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "pancake_batter" } },

    // --- DISHES (Preplaceable Completed Meals) ---
    { name: "french_fries", type: STATION_TYPES.PREPLACED_ITEM, category: "Dishes", size: { width: 0.5, depth: 0.5 }, config: { item: "plate", contents: ["cooked_fries"] } },
    { name: "salad", type: STATION_TYPES.PREPLACED_ITEM, category: "Dishes", size: { width: 0.5, depth: 0.5 }, config: { item: "plate", contents: ["chopped_lettuce", "chopped_tomato"] } },
    { name: "hamburger", type: STATION_TYPES.PREPLACED_ITEM, category: "Dishes", size: { width: 0.5, depth: 0.5 }, config: { item: "plate", contents: ["bun", "cooked_patty"] } },
    { name: "cheeseburger_combo", type: STATION_TYPES.PREPLACED_ITEM, category: "Dishes", size: { width: 0.5, depth: 0.5 }, config: { item: "plate", contents: ["bun", "cheese_slice", "cooked_fries", "cooked_patty"] } },
    { name: "onion_rings", type: STATION_TYPES.PREPLACED_ITEM, category: "Dishes", size: { width: 0.5, depth: 0.5 }, config: { item: "plate", contents: ["cooked_onion_rings"] } },
    { name: "chicken_tenders_fries", type: STATION_TYPES.PREPLACED_ITEM, category: "Dishes", size: { width: 0.5, depth: 0.5 }, config: { item: "plate", contents: ["cooked_chicken_tenders", "cooked_fries"] } },
    { name: "blt_sandwich", type: STATION_TYPES.PREPLACED_ITEM, category: "Dishes", size: { width: 0.5, depth: 0.5 }, config: { item: "plate", contents: ["cooked_bacon", "chopped_lettuce", "chopped_tomato", "toasted_bread"] } },
    { name: "grilled_cheese_sandwich", type: STATION_TYPES.PREPLACED_ITEM, category: "Dishes", size: { width: 0.5, depth: 0.5 }, config: { item: "plate", contents: ["grilled_cheese_cooked"] } },
    { name: "pancakes", type: STATION_TYPES.PREPLACED_ITEM, category: "Dishes", size: { width: 0.5, depth: 0.5 }, config: { item: "plate", contents: ["cooked_pancakes", "syrup"] } },
    { name: "cheese_omelette", type: STATION_TYPES.PREPLACED_ITEM, category: "Dishes", size: { width: 0.5, depth: 0.5 }, config: { item: "plate", contents: ["cheese_slice", "cooked_omelette"] } },
    { name: "fruit_yogurt_bowl", type: STATION_TYPES.PREPLACED_ITEM, category: "Dishes", size: { width: 0.5, depth: 0.5 }, config: { item: "bowl", contents: ["granola", "sliced_banana", "sliced_strawberry", "yogurt"] } },
    { name: "smoothie", type: STATION_TYPES.PREPLACED_ITEM, category: "Dishes", size: { width: 0.5, depth: 0.5 }, config: { item: "cup", contents: ["smoothie_ready"] } },
    { name: "pizza_margherita", type: STATION_TYPES.PREPLACED_ITEM, category: "Dishes", size: { width: 0.5, depth: 0.5 }, config: { item: "plate", contents: ["cooked_pizza_margherita"] } }
];
