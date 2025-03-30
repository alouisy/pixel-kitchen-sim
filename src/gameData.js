// src/gameData.js
import { INGREDIENT_STATES, STATION_TYPES, COUNTER_HEIGHT } from './constants.js';

// --- RECIPES ---
// Ingredients are defined by the 'name' property of the item mesh.
// IMPORTANT: Keep ingredient lists sorted alphabetically for consistent checking!
export const RECIPES = {
    'French Fries': ['cooked_fries'].sort(),
    'Salad': ['chopped_lettuce', 'chopped_tomato'].sort(),
    'Hamburger': ['bun', 'cooked_patty'].sort(),
    'Cheeseburger': ['bun', 'cheese_slice', 'cooked_patty'].sort(),
    // Add new recipes here later...
    // 'Onion Rings': ['cooked_onion_rings'].sort(), // Example
    // 'BLT Sandwich': ['cooked_bacon', 'chopped_lettuce', 'chopped_tomato', 'toasted_bread'].sort(), // Example
};

// --- LEVEL DATABASE ---
export const LEVEL_DATABASE = [
    // --- Level 1: Basic Fry Cook ---
    {
        levelId: 1,
        name: "Fry Cook Training",
        duration: 180, // 3 minutes
        starThresholds: [100, 250, 400],
        orders: [
            { mealName: 'French Fries', timeLimit: 90, baseScore: 50, penalty: 25 },
            { mealName: 'French Fries', timeLimit: 80, baseScore: 60, penalty: 30 },
            { mealName: 'French Fries', timeLimit: 70, baseScore: 70, penalty: 35 },
        ],
        layout: [
            // --- Counters ---
            // name: Unique identifier for the object within the level
            // type: From STATION_TYPES
            // position: { x, z } - Center position on the XZ plane
            // size: { width, depth, height }
            // isServing: (Optional) boolean, marks the serving counter
            { name: "BackCounter", type: STATION_TYPES.COUNTER, position: { x: 0, z: -4.5 + 0.3 }, size: { width: 9, depth: 0.6, height: COUNTER_HEIGHT } },
            { name: "ServingCounter", type: STATION_TYPES.COUNTER, position: { x: 0, z: 3.9 + 0.3 }, size: { width: 5, depth: 0.6, height: COUNTER_HEIGHT }, isServing: true },

            // --- Stations ---
            // name: Unique identifier
            // type: Functional type from STATION_TYPES
            // position: { x, z } - Center position
            // size: { width, depth, height } - Size of the station block
            // color: Hex color code for the mesh
            // config: Object containing station-specific data (ingredient, item, processes, result, processingTime)
            { name: "potatoBin", type: STATION_TYPES.INGREDIENT_SOURCE, position: { x: -3.75, z: -4.5 + 0.6 }, size: { width: 0.5, depth: 0.5, height: 0.3 }, color: 0xffa500, config: { ingredient: 'potato' } },
            { name: "cuttingBoard", type: STATION_TYPES.PROCESSOR, position: { x: 0, z: -4.5 + 0.6 }, size: { width: 0.6, depth: 0.4, height: 0.05 }, color: 0xdeb887, config: { processes: ['potato'], result: { potato: 'raw_fries' } } },
            { name: "fryer", type: STATION_TYPES.PROCESSOR, position: { x: 2.25, z: -4.5 + 0.6 }, size: { width: 0.5, depth: 0.5, height: 0.4 }, color: 0x444444, config: { processes: ['raw_fries'], result: { raw_fries: 'cooked_fries' }, processingTime: 3000 } },
            { name: "plateStack", type: STATION_TYPES.ITEM_SOURCE, position: { x: 4.1, z: -4.5 + 0.6 }, size: { width: 0.3, depth: 0.3, height: 0.2 }, color: 0xffffff, config: { item: 'plate' } },
            { name: "assembly", type: STATION_TYPES.ASSEMBLY, position: { x: 0, z: -1.5 }, size: { width: 1.8, depth: 0.8, height: 0.05 }, color: 0xd3d3d3, config: {} },
        ]
    },
    // --- Level 2: Salad Prep ---
    {
        levelId: 2,
        name: "Salad Prep",
        duration: 180,
        starThresholds: [120, 280, 450],
        orders: [
            { mealName: 'Salad', timeLimit: 90, baseScore: 75, penalty: 40 },
            { mealName: 'Salad', timeLimit: 80, baseScore: 80, penalty: 40 },
            { mealName: 'French Fries', timeLimit: 70, baseScore: 65, penalty: 35 }, // Mix it up
        ],
        layout: [
            // Different Counter Setup
            { name: "LeftCounter", type: STATION_TYPES.COUNTER, position: { x: -3, z: -4.5 + 0.3 }, size: { width: 3, depth: 0.6, height: COUNTER_HEIGHT } },
            { name: "RightCounter", type: STATION_TYPES.COUNTER, position: { x: 3, z: -4.5 + 0.3 }, size: { width: 3, depth: 0.6, height: COUNTER_HEIGHT } },
            { name: "ServingCounter", type: STATION_TYPES.COUNTER, position: { x: 0, z: 3.9 + 0.3 }, size: { width: 5, depth: 0.6, height: COUNTER_HEIGHT }, isServing: true },

            // Stations - Different Positions
            { name: "lettuceBin", type: STATION_TYPES.INGREDIENT_SOURCE, position: { x: -4, z: -4.5 + 0.6 }, size: { width: 0.5, depth: 0.5, height: 0.3 }, color: 0x90ee90, config: { ingredient: 'lettuce' } },
            { name: "tomatoBin", type: STATION_TYPES.INGREDIENT_SOURCE, position: { x: -3, z: -4.5 + 0.6 }, size: { width: 0.5, depth: 0.5, height: 0.3 }, color: 0xff6347, config: { ingredient: 'tomato' } },
            { name: "cuttingBoard", type: STATION_TYPES.PROCESSOR, position: { x: -1.5, z: -4.5 + 0.6 }, size: { width: 0.6, depth: 0.4, height: 0.05 }, color: 0xdeb887, config: { processes: ['lettuce', 'tomato', 'potato'], result: { lettuce: 'chopped_lettuce', tomato: 'chopped_tomato', potato: 'raw_fries' } } }, // Add potato process
            { name: "plateStack", type: STATION_TYPES.ITEM_SOURCE, position: { x: 1.5, z: -4.5 + 0.6 }, size: { width: 0.3, depth: 0.3, height: 0.2 }, color: 0xffffff, config: { item: 'plate' } },
            { name: "assembly", type: STATION_TYPES.ASSEMBLY, position: { x: 0, z: -1.5 }, size: { width: 1.8, depth: 0.8, height: 0.05 }, color: 0xd3d3d3, config: {} },
            // Add Fryer/Potato for the Fries order
            { name: "potatoBin", type: STATION_TYPES.INGREDIENT_SOURCE, position: { x: 3, z: -4.5 + 0.6 }, size: { width: 0.5, depth: 0.5, height: 0.3 }, color: 0xffa500, config: { ingredient: 'potato' } },
            { name: "fryer", type: STATION_TYPES.PROCESSOR, position: { x: 4, z: -4.5 + 0.6 }, size: { width: 0.5, depth: 0.5, height: 0.4 }, color: 0x444444, config: { processes: ['raw_fries'], result: { raw_fries: 'cooked_fries' }, processingTime: 3000 } },
        ]
    },
    // --- Level 3: Burger Time ---
    {
        levelId: 3,
        name: "Burger Time",
        duration: 210, // 3.5 minutes
        starThresholds: [150, 320, 500],
        orders: [
            { mealName: 'Hamburger', timeLimit: 100, baseScore: 100, penalty: 50 },
            { mealName: 'Cheeseburger', timeLimit: 110, baseScore: 120, penalty: 60 },
            { mealName: 'French Fries', timeLimit: 60, baseScore: 60, penalty: 30 },
            { mealName: 'Hamburger', timeLimit: 90, baseScore: 105, penalty: 50 },
        ],
        layout: [
            // Layout focused on burger ingredients and grill
            { name: "BackCounter", type: STATION_TYPES.COUNTER, position: { x: 0, z: -4.5 + 0.3 }, size: { width: 9, depth: 0.6, height: COUNTER_HEIGHT } },
            { name: "ServingCounter", type: STATION_TYPES.COUNTER, position: { x: 0, z: 3.9 + 0.3 }, size: { width: 5, depth: 0.6, height: COUNTER_HEIGHT }, isServing: true },

            { name: "pattyBin", type: STATION_TYPES.INGREDIENT_SOURCE, position: { x: -3.75, z: -4.5 + 0.6 }, size: { width: 0.5, depth: 0.5, height: 0.3 }, color: 0x8B4513, config: { ingredient: 'patty' } },
            { name: "bunRack", type: STATION_TYPES.INGREDIENT_SOURCE, position: { x: -2.75, z: -4.5 + 0.6 }, size: { width: 0.5, depth: 0.5, height: 0.3 }, color: 0xf0d891, config: { ingredient: 'bun' } },
            { name: "cheeseFridge", type: STATION_TYPES.INGREDIENT_SOURCE, position: { x: -1.75, z: -4.5 + 0.6 }, size: { width: 0.4, depth: 0.4, height: 0.6 }, color: 0xe0ffff, config: { ingredient: 'cheese_slice' } },
            { name: "grill", type: STATION_TYPES.PROCESSOR, position: { x: 0, z: -4.5 + 0.6 }, size: { width: 0.7, depth: 0.5, height: 0.1 }, color: 0x333333, config: { processes: ['patty'], result: { patty: 'cooked_patty' }, processingTime: 5000 } },
            { name: "plateStack", type: STATION_TYPES.ITEM_SOURCE, position: { x: 1.5, z: -4.5 + 0.6 }, size: { width: 0.3, depth: 0.3, height: 0.2 }, color: 0xffffff, config: { item: 'plate' } },
            { name: "assembly", type: STATION_TYPES.ASSEMBLY, position: { x: 0, z: -1.5 }, size: { width: 1.8, depth: 0.8, height: 0.05 }, color: 0xd3d3d3, config: {} },
            // Add Fryer/Potato/Cutting Board for Fries
            { name: "potatoBin", type: STATION_TYPES.INGREDIENT_SOURCE, position: { x: 3, z: -4.5 + 0.6 }, size: { width: 0.5, depth: 0.5, height: 0.3 }, color: 0xffa500, config: { ingredient: 'potato' } },
            { name: "cuttingBoard", type: STATION_TYPES.PROCESSOR, position: { x: 4, z: -4.5 + 0.6 }, size: { width: 0.6, depth: 0.4, height: 0.05 }, color: 0xdeb887, config: { processes: ['potato'], result: { potato: 'raw_fries' } } },
            { name: "fryer", type: STATION_TYPES.PROCESSOR, position: { x: 4, z: -3.5 + 0.3 }, size: { width: 0.5, depth: 0.5, height: 0.4 }, color: 0x444444, config: { processes: ['raw_fries'], result: { raw_fries: 'cooked_fries' }, processingTime: 3000 } }, // Side fryer
        ]
    },
    // Add Level 4, 5, 6, 7, 8, 9, 10+ here with different layouts and order combinations
    // Example: Level 4 might introduce the BLT and require a Toaster station.
    // Example: Level 5 might focus on breakfast with Pancake/Omelette and require Mixer/Griddle.
];

// Helper function to get recipe by name
export function getRecipe(mealName) {
    return RECIPES[mealName];
}