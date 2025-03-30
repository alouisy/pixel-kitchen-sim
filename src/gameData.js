// src/gameData.js
import { INGREDIENT_STATES, STATION_TYPES, COUNTER_HEIGHT } from './constants.js';

// --- RECIPES ---
// Now includes default timeLimit, baseScore, and penalty per recipe
export const RECIPES = {
    'French Fries': {
        ingredients: ['cooked_fries'].sort(),
        timeLimit: 75, // Default time in seconds
        baseScore: 60,
        penalty: 30
    },
    'Salad': {
        ingredients: ['chopped_lettuce', 'chopped_tomato'].sort(),
        timeLimit: 90,
        baseScore: 75,
        penalty: 40
    },
    'Hamburger': {
        ingredients: ['bun', 'cooked_patty'].sort(),
        timeLimit: 100,
        baseScore: 100,
        penalty: 50
    },
    'Cheeseburger': {
        ingredients: ['bun', 'cheese_slice', 'cooked_patty'].sort(),
        timeLimit: 110,
        baseScore: 120,
        penalty: 60
    },
    // Add new recipes with their details here...
    // 'Onion Rings': { ingredients: ['cooked_onion_rings'].sort(), timeLimit: 80, baseScore: 70, penalty: 35 },
};

// --- LEVEL DATABASE ---
export const LEVEL_DATABASE = [
    // --- Level 1: Basic Fry Cook ---
    {
        levelId: 1,
        name: "Fry Cook Training",
        duration: 180, // 3 minutes
        starThresholds: [300, 500, 700], // Adjust thresholds for potentially higher scores
        availableMeals: ['French Fries'], // Only fries available
        maxActiveOrders: 2, // Allow up to 2 orders at once
        newOrderDelay: 15, // Try to generate a new order every 15 seconds if needed
        layout: [ /* ... layout from previous step ... */
            { name: "BackCounter", type: STATION_TYPES.COUNTER, position: { x: 0, z: -4.5 + 0.3 }, size: { width: 9, depth: 0.6, height: COUNTER_HEIGHT } },
            { name: "ServingCounter", type: STATION_TYPES.COUNTER, position: { x: 0, z: 3.9 + 0.3 }, size: { width: 5, depth: 0.6, height: COUNTER_HEIGHT }, isServing: true },
            { name: "potatoBin", type: STATION_TYPES.INGREDIENT_SOURCE, position: { x: -3.75, z: -4.5 + 0.6 }, size: { width: 0.5, depth: 0.5, height: 0.3 }, color: 0xffa500, config: { ingredient: 'potato' } },
            { name: "cuttingBoard", type: STATION_TYPES.PROCESSOR, position: { x: 0, z: -4.5 + 0.6 }, size: { width: 0.6, depth: 0.4, height: 0.05 }, color: 0xdeb887, config: { processes: ['potato'], result: { potato: 'raw_fries' } } },
            { name: "fryer", type: STATION_TYPES.PROCESSOR, position: { x: 2.25, z: -4.5 + 0.6 }, size: { width: 0.5, depth: 0.5, height: 0.4 }, color: 0x444444, config: { processes: ['raw_fries'], result: { raw_fries: 'cooked_fries' }, processingTime: 3000 } },
            { name: "plateStack", type: STATION_TYPES.ITEM_SOURCE, position: { x: 4.1, z: -4.5 + 0.6 }, size: { width: 0.3, depth: 0.3, height: 0.2 }, color: 0xffffff, config: { item: 'plate' } },
            { name: "assembly", type: STATION_TYPES.ASSEMBLY, position: { x: 0, z: -1.5 }, size: { width: 1.8, depth: 0.8, height: 0.05 }, color: 0xd3d3d3, config: {} },
        ]
    },
    // --- Level 2: Salad & Fries ---
    {
        levelId: 2,
        name: "Salad & Fries Rush",
        duration: 210, // 3.5 minutes
        starThresholds: [400, 650, 900],
        availableMeals: ['Salad', 'French Fries'], // Both available
        maxActiveOrders: 3, // More challenging
        newOrderDelay: 12, // Faster orders
        layout: [ /* ... layout from previous step ... */
            { name: "LeftCounter", type: STATION_TYPES.COUNTER, position: { x: -3, z: -4.5 + 0.3 }, size: { width: 3, depth: 0.6, height: COUNTER_HEIGHT } },
            { name: "RightCounter", type: STATION_TYPES.COUNTER, position: { x: 3, z: -4.5 + 0.3 }, size: { width: 3, depth: 0.6, height: COUNTER_HEIGHT } },
            { name: "ServingCounter", type: STATION_TYPES.COUNTER, position: { x: 0, z: 3.9 + 0.3 }, size: { width: 5, depth: 0.6, height: COUNTER_HEIGHT }, isServing: true },
            { name: "lettuceBin", type: STATION_TYPES.INGREDIENT_SOURCE, position: { x: -4, z: -4.5 + 0.6 }, size: { width: 0.5, depth: 0.5, height: 0.3 }, color: 0x90ee90, config: { ingredient: 'lettuce' } },
            { name: "tomatoBin", type: STATION_TYPES.INGREDIENT_SOURCE, position: { x: -3, z: -4.5 + 0.6 }, size: { width: 0.5, depth: 0.5, height: 0.3 }, color: 0xff6347, config: { ingredient: 'tomato' } },
            { name: "cuttingBoard", type: STATION_TYPES.PROCESSOR, position: { x: -1.5, z: -4.5 + 0.6 }, size: { width: 0.6, depth: 0.4, height: 0.05 }, color: 0xdeb887, config: { processes: ['lettuce', 'tomato', 'potato'], result: { lettuce: 'chopped_lettuce', tomato: 'chopped_tomato', potato: 'raw_fries' } } },
            { name: "plateStack", type: STATION_TYPES.ITEM_SOURCE, position: { x: 1.5, z: -4.5 + 0.6 }, size: { width: 0.3, depth: 0.3, height: 0.2 }, color: 0xffffff, config: { item: 'plate' } },
            { name: "assembly", type: STATION_TYPES.ASSEMBLY, position: { x: 0, z: -1.5 }, size: { width: 1.8, depth: 0.8, height: 0.05 }, color: 0xd3d3d3, config: {} },
            { name: "potatoBin", type: STATION_TYPES.INGREDIENT_SOURCE, position: { x: 3, z: -4.5 + 0.6 }, size: { width: 0.5, depth: 0.5, height: 0.3 }, color: 0xffa500, config: { ingredient: 'potato' } },
            { name: "fryer", type: STATION_TYPES.PROCESSOR, position: { x: 4, z: -4.5 + 0.6 }, size: { width: 0.5, depth: 0.5, height: 0.4 }, color: 0x444444, config: { processes: ['raw_fries'], result: { raw_fries: 'cooked_fries' }, processingTime: 3000 } },
        ]
    },
    // --- Level 3: Burger Bonanza ---
    {
        levelId: 3,
        name: "Burger Bonanza",
        duration: 240, // 4 minutes
        starThresholds: [500, 800, 1100],
        availableMeals: ['Hamburger', 'Cheeseburger', 'French Fries'], // Burgers + Fries
        maxActiveOrders: 3,
        newOrderDelay: 10, // Even faster
        layout: [ /* ... layout from previous step ... */
            { name: "BackCounter", type: STATION_TYPES.COUNTER, position: { x: 0, z: -4.5 + 0.3 }, size: { width: 9, depth: 0.6, height: COUNTER_HEIGHT } },
            { name: "ServingCounter", type: STATION_TYPES.COUNTER, position: { x: 0, z: 3.9 + 0.3 }, size: { width: 5, depth: 0.6, height: COUNTER_HEIGHT }, isServing: true },
            { name: "pattyBin", type: STATION_TYPES.INGREDIENT_SOURCE, position: { x: -3.75, z: -4.5 + 0.6 }, size: { width: 0.5, depth: 0.5, height: 0.3 }, color: 0x8B4513, config: { ingredient: 'patty' } },
            { name: "bunRack", type: STATION_TYPES.INGREDIENT_SOURCE, position: { x: -2.75, z: -4.5 + 0.6 }, size: { width: 0.5, depth: 0.5, height: 0.3 }, color: 0xf0d891, config: { ingredient: 'bun' } },
            { name: "cheeseFridge", type: STATION_TYPES.INGREDIENT_SOURCE, position: { x: -1.75, z: -4.5 + 0.6 }, size: { width: 0.4, depth: 0.4, height: 0.6 }, color: 0xe0ffff, config: { ingredient: 'cheese_slice' } },
            { name: "grill", type: STATION_TYPES.PROCESSOR, position: { x: 0, z: -4.5 + 0.6 }, size: { width: 0.7, depth: 0.5, height: 0.1 }, color: 0x333333, config: { processes: ['patty'], result: { patty: 'cooked_patty' }, processingTime: 5000 } },
            { name: "plateStack", type: STATION_TYPES.ITEM_SOURCE, position: { x: 1.5, z: -4.5 + 0.6 }, size: { width: 0.3, depth: 0.3, height: 0.2 }, color: 0xffffff, config: { item: 'plate' } },
            { name: "assembly", type: STATION_TYPES.ASSEMBLY, position: { x: 0, z: -1.5 }, size: { width: 1.8, depth: 0.8, height: 0.05 }, color: 0xd3d3d3, config: {} },
            { name: "potatoBin", type: STATION_TYPES.INGREDIENT_SOURCE, position: { x: 3, z: -4.5 + 0.6 }, size: { width: 0.5, depth: 0.5, height: 0.3 }, color: 0xffa500, config: { ingredient: 'potato' } },
            { name: "cuttingBoard", type: STATION_TYPES.PROCESSOR, position: { x: 4, z: -4.5 + 0.6 }, size: { width: 0.6, depth: 0.4, height: 0.05 }, color: 0xdeb887, config: { processes: ['potato'], result: { potato: 'raw_fries' } } },
            { name: "fryer", type: STATION_TYPES.PROCESSOR, position: { x: 4, z: -3.5 + 0.3 }, size: { width: 0.5, depth: 0.5, height: 0.4 }, color: 0x444444, config: { processes: ['raw_fries'], result: { raw_fries: 'cooked_fries' }, processingTime: 3000 } },
        ]
    },
    // Add more levels...
];

// Helper function to get recipe *ingredients* by name
export function getRecipeIngredients(mealName) {
    return RECIPES[mealName]?.ingredients; // Return only the ingredients array
}
// Helper function to get recipe *details* (time, score)
export function getRecipeDetails(mealName) {
    const recipe = RECIPES[mealName];
    if (!recipe) return null;
    // Return details excluding ingredients
    return {
        timeLimit: recipe.timeLimit,
        baseScore: recipe.baseScore,
        penalty: recipe.penalty
    };
}