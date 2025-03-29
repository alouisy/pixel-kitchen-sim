// src/gameData.js
import { INGREDIENT_STATES } from './constants.js'; // Assuming constants.js exports this

// --- RECIPES ---
// Ingredients are defined as 'ingredientType_state'
// IMPORTANT: Keep ingredient lists sorted alphabetically for consistent checking!
export const RECIPES = {
    'French Fries': [
        'cooked_fries' // Changed from fries_cooked
    ].sort(),
    'Salad': [
        'chopped_lettuce', // Changed from lettuce_chopped
        'chopped_tomato'   // Changed from tomato_chopped
    ].sort(),
    'Hamburger': [
        'bun',
        'cooked_patty' // Changed from patty_cooked
    ].sort(),
    'Cheeseburger': [
        'bun',
        'cheese_slice',
        'cooked_patty' // Changed from patty_cooked
    ].sort(),
};

// --- LEVEL DATABASE ---
// Structure: Array of level objects
export const LEVEL_DATABASE = [
    // --- Level 1 ---
    {
        levelId: 1,
        name: "Fry Cook Training",
        duration: 180, // 3 minutes in seconds
        starThresholds: [100, 250, 400], // Score needed for 1, 2, 3 stars
        orders: [
            { mealName: 'French Fries', timeLimit: 90, baseScore: 50, penalty: 25 },
            { mealName: 'French Fries', timeLimit: 80, baseScore: 60, penalty: 30 },
            { mealName: 'Salad', timeLimit: 90, baseScore: 75, penalty: 40 }, // Added Salad
            { mealName: 'Hamburger', timeLimit: 100, baseScore: 100, penalty: 50 }, // Added Hamburger
            { mealName: 'Cheeseburger', timeLimit: 110, baseScore: 120, penalty: 60 }, // Added Cheeseburger
            // Add more orders for Level 1...
            // { mealName: 'Salad', timeLimit: 90, baseScore: 75, penalty: 40 },
        ]
    },
    // --- Level 2 ---
    // {
    //     levelId: 2,
    //     name: "Salad Prep",
    //     duration: 180,
    //     starThresholds: [150, 300, 500],
    //     orders: [
    //         { mealName: 'Salad', timeLimit: 90, baseScore: 75, penalty: 40 },
    //         { mealName: 'French Fries', timeLimit: 70, baseScore: 65, penalty: 35 },
    //         { mealName: 'Salad', timeLimit: 80, baseScore: 80, penalty: 40 },
    //         // ...
    //     ]
    // },
    // Add more levels...
];

// Helper function to get recipe by name
export function getRecipe(mealName) {
    return RECIPES[mealName];
}