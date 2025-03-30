// src/gameData.js
import { INGREDIENT_STATES, STATION_TYPES, COUNTER_HEIGHT } from './constants.js'; // Keep imports if needed

// --- RECIPES ---
// Includes default timeLimit, baseScore, and penalty per recipe
// Ingredient names MUST match the 'finalName' generated in items.js
export const RECIPES = {
    // --- Existing ---
    'French Fries': {
        ingredients: ['cooked_fries'].sort(),
        timeLimit: 75, baseScore: 60, penalty: 30
    },
    'Salad': {
        ingredients: ['chopped_lettuce', 'chopped_tomato'].sort(),
        timeLimit: 90, baseScore: 75, penalty: 40
    },
    'Hamburger': {
        ingredients: ['bun', 'cooked_patty'].sort(),
        timeLimit: 100, baseScore: 100, penalty: 50
    },
    'Cheeseburger': {
        ingredients: ['bun', 'cheese_slice', 'cooked_patty'].sort(),
        timeLimit: 110, baseScore: 120, penalty: 60
    },

    // --- New Recipes ---
    'Onion Rings': { // Requires 'onion', 'coating_mix', 'cooked_onion_rings' items
        ingredients: ['cooked_onion_rings'].sort(),
        timeLimit: 80, baseScore: 70, penalty: 35
    },
    'Chicken Tenders': { // Requires 'cooked_chicken_tenders' item
        ingredients: ['cooked_chicken_tenders'].sort(),
        timeLimit: 95, baseScore: 90, penalty: 45
    },
    'BLT Sandwich': { // Requires 'toasted_bread', 'cooked_bacon', 'chopped_lettuce', 'chopped_tomato' items
        ingredients: ['cooked_bacon', 'chopped_lettuce', 'chopped_tomato', 'toasted_bread'].sort(), // Note: Bread might be assembled differently
        timeLimit: 120, baseScore: 110, penalty: 55
    },
    'Grilled Cheese Sandwich': { // Requires 'grilled_cheese_cooked' item
        ingredients: ['grilled_cheese_cooked'].sort(),
        timeLimit: 85, baseScore: 80, penalty: 40
    },
    'Pancakes': { // Requires 'cooked_pancakes', 'syrup' items
        ingredients: ['cooked_pancakes', 'syrup'].sort(),
        timeLimit: 120, baseScore: 90, penalty: 45
    },
    'Omelette': { // Requires 'cooked_omelette' item
        ingredients: ['cooked_omelette'].sort(),
        timeLimit: 90, baseScore: 80, penalty: 40
    },
    'Fruit & Yogurt Bowl': { // Requires 'yogurt', 'sliced_banana', 'sliced_strawberry', 'granola' items (served in 'bowl')
        ingredients: ['granola', 'sliced_banana', 'sliced_strawberry', 'yogurt'].sort(),
        timeLimit: 70, baseScore: 70, penalty: 30
    },
    'Smoothie': { // Requires 'smoothie_ready' item (served in 'cup')
        ingredients: ['smoothie_ready'].sort(),
        timeLimit: 60, baseScore: 65, penalty: 25
    },
    'Pizza Margherita': { // Requires 'cooked_pizza_margherita' item
        ingredients: ['cooked_pizza_margherita'].sort(),
        timeLimit: 150, baseScore: 150, penalty: 70
    },
    // Add more complex recipes like Cake, Spaghetti, Soup Combo later if needed
};


// --- REMOVED LEVEL_DATABASE ---


// Helper function to get recipe *ingredients* by name
export function getRecipeIngredients(mealName) {
    return RECIPES[mealName]?.ingredients;
}
// Helper function to get recipe *details* (time, score, penalty)
export function getRecipeDetails(mealName) {
    const recipe = RECIPES[mealName];
    if (!recipe) return null;
    return {
        timeLimit: recipe.timeLimit,
        baseScore: recipe.baseScore,
        penalty: recipe.penalty
    };
}