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
export const CATALOG_ITEMS = [
    // --- ARCHITECTURE ---
    { name: "Wall (Short)", type: STATION_TYPES.WALL, category: "Architecture", size: { width: 1.0, depth: 0.5 }, color: "#EFEBE9" },
    { name: "Wall (Long)", type: STATION_TYPES.WALL, category: "Architecture", size: { width: 2.0, depth: 0.5 }, color: "#EFEBE9" },
    { name: "Corner Wall", type: STATION_TYPES.WALL, category: "Architecture", size: { width: 0.5, depth: 0.5 }, color: "#EFEBE9" },
    
    // --- FURNITURE ---
    { name: "Counter (Wood)", type: STATION_TYPES.COUNTER, category: "Furniture", color: "#8B4513" },
    { name: "Counter (Corner)", type: STATION_TYPES.COUNTER, category: "Furniture", color: "#8B4513" },
    { name: "Serving Pass", type: STATION_TYPES.SERVING, category: "Furniture", isServing: true },
    { name: "Table", type: STATION_TYPES.TABLE, category: "Furniture", color: "#CCCCCC" },
    { name: "Trash Bin", type: STATION_TYPES.TRASH, category: "Furniture", size: { width: 0.5, depth: 0.5 } },

    // --- ITEMS (Single Placeable) ---
    { name: "Plate (Single)", type: STATION_TYPES.PREPLACED_ITEM, category: "Items", size: { width: 0.5, depth: 0.5 }, config: { item: "plate" } },
    { name: "Bowl (Single)", type: STATION_TYPES.PREPLACED_ITEM, category: "Items", size: { width: 0.5, depth: 0.5 }, config: { item: "bowl" } },
    { name: "Cup (Single)", type: STATION_TYPES.PREPLACED_ITEM, category: "Items", size: { width: 0.5, depth: 0.5 }, config: { item: "cup" } },

    // --- PROCESSORS (APPLIANCES) ---
    { name: "Cutting Board", type: STATION_TYPES.PROCESSOR, category: "Stations", size: { width: 0.5, depth: 0.5 }, color: "#DEB887", config: { processes: ["potato", "tomato", "lettuce", "onion", "banana", "strawberry", "raw_chicken"], result: { "potato": "raw_fries", "tomato": "chopped_tomato", "lettuce": "chopped_lettuce", "onion": "onion_rings_raw", "banana": "sliced_banana", "strawberry": "sliced_strawberry", "raw_chicken": "raw_chicken_strips" } } },
    { name: "Stove Top", type: STATION_TYPES.PROCESSOR, category: "Stations", size: { width: 0.5, depth: 0.5 }, color: "#333", config: { processes: ["patty", "raw_bacon", "pancake_batter", "omelette_mix", "grilled_cheese_raw"], result: { "patty": "cooked_patty", "raw_bacon": "cooked_bacon", "pancake_batter": "cooked_pancakes", "omelette_mix": "cooked_omelette", "grilled_cheese_raw": "grilled_cheese_cooked" }, processingTime: 4000 } },
    { name: "Deep Fryer", type: STATION_TYPES.PROCESSOR, category: "Stations", size: { width: 0.5, depth: 0.5 }, color: "#555", config: { processes: ["raw_fries", "onion_rings_coated", "coated_chicken_strips"], result: { "raw_fries": "cooked_fries", "onion_rings_coated": "cooked_onion_rings", "coated_chicken_strips": "cooked_chicken_tenders" }, processingTime: 3000 } },
    { name: "Toaster", type: STATION_TYPES.PROCESSOR, category: "Stations", size: { width: 0.5, depth: 0.5 }, color: "#D3D3D3", config: { processes: ["bread_slice"], result: { "bread_slice": "toasted_bread" }, processingTime: 3000 } },
    { name: "Stand Mixer", type: STATION_TYPES.PROCESSOR, category: "Stations", size: { width: 0.5, depth: 0.5 }, color: "#FFF", config: { processes: ["egg", "pancake_mix"], result: { "egg": "omelette_mix", "pancake_mix": "pancake_batter" }, processingTime: 2000 } },
    { name: "Blender", type: STATION_TYPES.PROCESSOR, category: "Stations", size: { width: 0.5, depth: 0.5 }, color: "#708090", config: { requiredIngredients: ["sliced_banana", "sliced_strawberry", "milk"], outputItem: "smoothie_ready", acceptsIngredients: ["sliced_banana", "sliced_strawberry", "milk", "yogurt"], acceptsContainer: "cup" } },
    { name: "Dough Press", type: STATION_TYPES.PROCESSOR, category: "Stations", size: { width: 0.5, depth: 0.5 }, color: "#B0C4DE", config: { processes: ["pizza_dough"], result: { "pizza_dough": "pizza_base" } } },
    { name: "Pizza Oven", type: STATION_TYPES.PROCESSOR, category: "Stations", size: { width: 0.5, depth: 0.5 }, color: "#8B0000", config: { processes: ["pizza_margherita_raw"], result: { "pizza_margherita_raw": "cooked_pizza_margherita" }, processingTime: 6000 } },
    
    // --- SOURCES (INGREDIENTS) ---
    { name: "Plate Stack", type: STATION_TYPES.ITEM_SOURCE, category: "Sources", size: { width: 0.5, depth: 0.5 }, config: { item: "plate" } },
    { name: "Bowl Stack", type: STATION_TYPES.ITEM_SOURCE, category: "Sources", size: { width: 0.5, depth: 0.5 }, config: { item: "bowl" } },
    { name: "Cup Stack", type: STATION_TYPES.ITEM_SOURCE, category: "Sources", size: { width: 0.5, depth: 0.5 }, config: { item: "cup" } },
    
    { name: "Potato Bin", type: STATION_TYPES.INGREDIENT_SOURCE, category: "Sources", size: { width: 0.5, depth: 0.5 }, color: "#CD853F", config: { ingredient: "potato" } },
    { name: "Tomato Bin", type: STATION_TYPES.INGREDIENT_SOURCE, category: "Sources", size: { width: 0.5, depth: 0.5 }, color: "#FF6347", config: { ingredient: "tomato" } },
    { name: "Lettuce Bin", type: STATION_TYPES.INGREDIENT_SOURCE, category: "Sources", size: { width: 0.5, depth: 0.5 }, color: "#90EE90", config: { ingredient: "lettuce" } },
    { name: "Onion Bin", type: STATION_TYPES.INGREDIENT_SOURCE, category: "Sources", size: { width: 0.5, depth: 0.5 }, color: "#F0F8FF", config: { ingredient: "onion" } },
    { name: "Banana Crate", type: STATION_TYPES.INGREDIENT_SOURCE, category: "Sources", size: { width: 0.5, depth: 0.5 }, color: "#FFE135", config: { ingredient: "banana" } },
    { name: "Strawberry Box", type: STATION_TYPES.INGREDIENT_SOURCE, category: "Sources", size: { width: 0.5, depth: 0.5 }, color: "#FC5A8D", config: { ingredient: "strawberry" } },
    
    { name: "Bun Rack", type: STATION_TYPES.INGREDIENT_SOURCE, category: "Sources", size: { width: 0.5, depth: 0.5 }, color: "#F4A460", config: { ingredient: "bun" } },
    { name: "Bread Rack", type: STATION_TYPES.INGREDIENT_SOURCE, category: "Sources", size: { width: 0.5, depth: 0.5 }, color: "#DEB887", config: { ingredient: "bread_slice" } },
    { name: "Patty Box", type: STATION_TYPES.INGREDIENT_SOURCE, category: "Sources", size: { width: 0.5, depth: 0.5 }, color: "#A52A2A", config: { ingredient: "patty" } },
    { name: "Chicken Box", type: STATION_TYPES.INGREDIENT_SOURCE, category: "Sources", size: { width: 0.5, depth: 0.5 }, color: "#FFB6C1", config: { ingredient: "raw_chicken" } },
    { name: "Bacon Pack", type: STATION_TYPES.INGREDIENT_SOURCE, category: "Sources", size: { width: 0.5, depth: 0.5 }, color: "#CD5C5C", config: { ingredient: "raw_bacon" } },
    { name: "Cheese Fridge", type: STATION_TYPES.INGREDIENT_SOURCE, category: "Sources", size: { width: 0.5, depth: 0.5 }, color: "#FFD700", config: { ingredient: "cheese_slice" } },
    { name: "Mozzarella Bin", type: STATION_TYPES.INGREDIENT_SOURCE, category: "Sources", size: { width: 0.5, depth: 0.5 }, color: "#FFFFF0", config: { ingredient: "shredded_mozzarella" } },
    { name: "Pizza Dough", type: STATION_TYPES.INGREDIENT_SOURCE, category: "Sources", size: { width: 0.5, depth: 0.5 }, color: "#F5DEB3", config: { ingredient: "pizza_dough" } },
    
    { name: "Egg Carton", type: STATION_TYPES.INGREDIENT_SOURCE, category: "Sources", size: { width: 0.5, depth: 0.5 }, color: "#FFF8DC", config: { ingredient: "egg" } },
    { name: "Milk Carton", type: STATION_TYPES.INGREDIENT_SOURCE, category: "Sources", size: { width: 0.5, depth: 0.5 }, color: "#FFFFFF", config: { ingredient: "milk" } },
    { name: "Yogurt Pot", type: STATION_TYPES.INGREDIENT_SOURCE, category: "Sources", size: { width: 0.5, depth: 0.5 }, color: "#F0FFFF", config: { ingredient: "yogurt" } },
    { name: "Pancake Mix", type: STATION_TYPES.INGREDIENT_SOURCE, category: "Sources", size: { width: 0.5, depth: 0.5 }, color: "#F5DEB3", config: { ingredient: "pancake_mix" } },
    
    { name: "Tomato Sauce", type: STATION_TYPES.INGREDIENT_SOURCE, category: "Sources", size: { width: 0.5, depth: 0.5 }, color: "#8B0000", config: { ingredient: "tomato_sauce" } },
    { name: "Syrup Bottle", type: STATION_TYPES.INGREDIENT_SOURCE, category: "Sources", size: { width: 0.5, depth: 0.5 }, color: "#8B4513", config: { ingredient: "syrup" } },
    { name: "Granola Jar", type: STATION_TYPES.INGREDIENT_SOURCE, category: "Sources", size: { width: 0.5, depth: 0.5 }, color: "#D2691E", config: { ingredient: "granola" } },
    { name: "Coating Mix", type: STATION_TYPES.INGREDIENT_SOURCE, category: "Sources", size: { width: 0.5, depth: 0.5 }, color: "#F5F5DC", config: { ingredient: "coating_mix" } },

    // --- INGREDIENTS (Preplaceable) ---
    { name: "Potato", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "potato" } },
    { name: "Tomato", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "tomato" } },
    { name: "Lettuce", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "lettuce" } },
    { name: "Onion", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "onion" } },
    { name: "Banana", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "banana" } },
    { name: "Strawberry", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "strawberry" } },
    { name: "Burger Bun", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "bun" } },
    { name: "Bread Slice", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "bread_slice" } },
    { name: "Patty (Raw)", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "patty" } },
    { name: "Patty (Cooked)", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "cooked_patty" } },
    { name: "Raw Chicken", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "raw_chicken" } },
    { name: "Raw Bacon", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "raw_bacon" } },
    { name: "Cooked Bacon", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "cooked_bacon" } },
    { name: "Cheese Slice", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "cheese_slice" } },
    { name: "Mozzarella", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "shredded_mozzarella" } },
    { name: "Pizza Dough", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "pizza_dough" } },
    { name: "Egg", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "egg" } },
    { name: "Milk", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "milk" } },
    { name: "Yogurt", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "yogurt" } },
    { name: "Pancake Mix", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "pancake_mix" } },
    { name: "Tomato Sauce", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "tomato_sauce" } },
    { name: "Syrup", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "syrup" } },
    { name: "Granola", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "granola" } },
    { name: "Coating Mix", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "coating_mix" } },
    { name: "Chopped Tomato", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "chopped_tomato" } },
    { name: "Chopped Lettuce", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "chopped_lettuce" } },
    { name: "Cooked Fries", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "cooked_fries" } },
    { name: "Pizza Base", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "pizza_base" } },
    { name: "Pancake Batter", type: STATION_TYPES.PREPLACED_ITEM, category: "Ingredients", size: { width: 0.5, depth: 0.5 }, config: { item: "pancake_batter" } },

    // --- DISHES (Preplaceable Completed Meals) ---
    { name: "French Fries", type: STATION_TYPES.PREPLACED_ITEM, category: "Dishes", size: { width: 0.5, depth: 0.5 }, config: { item: "plate", contents: ["cooked_fries"] } },
    { name: "Salad", type: STATION_TYPES.PREPLACED_ITEM, category: "Dishes", size: { width: 0.5, depth: 0.5 }, config: { item: "plate", contents: ["chopped_lettuce", "chopped_tomato"] } },
    { name: "Hamburger", type: STATION_TYPES.PREPLACED_ITEM, category: "Dishes", size: { width: 0.5, depth: 0.5 }, config: { item: "plate", contents: ["bun", "cooked_patty"] } },
    { name: "Cheeseburger", type: STATION_TYPES.PREPLACED_ITEM, category: "Dishes", size: { width: 0.5, depth: 0.5 }, config: { item: "plate", contents: ["bun", "cooked_patty", "cheese_slice"] } },
    { name: "Onion Rings", type: STATION_TYPES.PREPLACED_ITEM, category: "Dishes", size: { width: 0.5, depth: 0.5 }, config: { item: "plate", contents: ["cooked_onion_rings"] } },
    { name: "Chicken Tenders", type: STATION_TYPES.PREPLACED_ITEM, category: "Dishes", size: { width: 0.5, depth: 0.5 }, config: { item: "plate", contents: ["cooked_chicken_tenders"] } },
    { name: "BLT Sandwich", type: STATION_TYPES.PREPLACED_ITEM, category: "Dishes", size: { width: 0.5, depth: 0.5 }, config: { item: "plate", contents: ["cooked_bacon", "chopped_lettuce", "chopped_tomato", "toasted_bread"] } },
    { name: "Grilled Cheese", type: STATION_TYPES.PREPLACED_ITEM, category: "Dishes", size: { width: 0.5, depth: 0.5 }, config: { item: "plate", contents: ["grilled_cheese_cooked"] } },
    { name: "Pancakes", type: STATION_TYPES.PREPLACED_ITEM, category: "Dishes", size: { width: 0.5, depth: 0.5 }, config: { item: "plate", contents: ["cooked_pancakes", "syrup"] } },
    { name: "Omelette", type: STATION_TYPES.PREPLACED_ITEM, category: "Dishes", size: { width: 0.5, depth: 0.5 }, config: { item: "plate", contents: ["cooked_omelette"] } },
    { name: "Yogurt Bowl", type: STATION_TYPES.PREPLACED_ITEM, category: "Dishes", size: { width: 0.5, depth: 0.5 }, config: { item: "bowl", contents: ["granola", "sliced_banana", "sliced_strawberry", "yogurt"] } },
    { name: "Smoothie", type: STATION_TYPES.PREPLACED_ITEM, category: "Dishes", size: { width: 0.5, depth: 0.5 }, config: { item: "cup", contents: ["smoothie_ready"] } },
    { name: "Pizza Margherita", type: STATION_TYPES.PREPLACED_ITEM, category: "Dishes", size: { width: 0.5, depth: 0.5 }, config: { item: "plate", contents: ["cooked_pizza_margherita"] } }
];