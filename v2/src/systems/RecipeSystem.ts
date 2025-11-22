import type { Recipe } from '../types/GameTypes';

// Prime numbers for ingredients
export const INGREDIENT_PRIMES: Record<string, number> = {
    'cooked_fries': 2,
    'chopped_lettuce': 3,
    'chopped_tomato': 5,
    'bun': 7,
    'cooked_patty': 11,
    'cheese_slice': 13,
    'cooked_onion_rings': 17,
    'cooked_chicken_tenders': 19,
    'cooked_bacon': 23,
    'toasted_bread': 29,
    'grilled_cheese_cooked': 31,
    'cooked_pancakes': 37,
    'syrup': 41,
    'cooked_omelette': 43,
    'granola': 47,
    'sliced_banana': 53,
    'sliced_strawberry': 59,
    'yogurt': 61,
    'smoothie_ready': 67,
    'cooked_pizza_margherita': 71,
    // Add more as needed
    'plate': 1, // Containers don't contribute to hash usually, or we multiply by 1
};

export const RECIPES: Record<string, Recipe> = {
    'French Fries': {
        name: 'French Fries',
        ingredients: ['cooked_fries'],
        timeLimit: 75, baseScore: 60,
        primesProduct: 2
    },
    'Salad': {
        name: 'Salad',
        ingredients: ['chopped_lettuce', 'chopped_tomato'],
        timeLimit: 90, baseScore: 75,
        primesProduct: 3 * 5
    },
    'Hamburger': {
        name: 'Hamburger',
        ingredients: ['bun', 'cooked_patty'],
        timeLimit: 100, baseScore: 100,
        primesProduct: 7 * 11
    },
    'Cheeseburger': {
        name: 'Cheeseburger',
        ingredients: ['bun', 'cheese_slice', 'cooked_patty'],
        timeLimit: 110, baseScore: 120,
        primesProduct: 7 * 13 * 11
    },
    'Onion Rings': {
        name: 'Onion Rings',
        ingredients: ['cooked_onion_rings'],
        timeLimit: 80, baseScore: 70,
        primesProduct: 17
    },
    'Chicken Tenders': {
        name: 'Chicken Tenders',
        ingredients: ['cooked_chicken_tenders'],
        timeLimit: 95, baseScore: 90,
        primesProduct: 19
    },
    'BLT Sandwich': {
        name: 'BLT Sandwich',
        ingredients: ['cooked_bacon', 'chopped_lettuce', 'chopped_tomato', 'toasted_bread'],
        timeLimit: 120, baseScore: 110,
        primesProduct: 23 * 3 * 5 * 29
    },
    'Grilled Cheese Sandwich': {
        name: 'Grilled Cheese Sandwich',
        ingredients: ['grilled_cheese_cooked'],
        timeLimit: 85, baseScore: 80,
        primesProduct: 31
    },
    'Pancakes': {
        name: 'Pancakes',
        ingredients: ['cooked_pancakes', 'syrup'],
        timeLimit: 120, baseScore: 90,
        primesProduct: 37 * 41
    },
    'Omelette': {
        name: 'Omelette',
        ingredients: ['cooked_omelette'],
        timeLimit: 90, baseScore: 80,
        primesProduct: 43
    },
    'Fruit & Yogurt Bowl': {
        name: 'Fruit & Yogurt Bowl',
        ingredients: ['granola', 'sliced_banana', 'sliced_strawberry', 'yogurt'],
        timeLimit: 70, baseScore: 70,
        primesProduct: 47 * 53 * 59 * 61
    },
    'Smoothie': {
        name: 'Smoothie',
        ingredients: ['smoothie_ready'],
        timeLimit: 60, baseScore: 65,
        primesProduct: 67
    },
    'Pizza Margherita': {
        name: 'Pizza Margherita',
        ingredients: ['cooked_pizza_margherita'],
        timeLimit: 150, baseScore: 150,
        primesProduct: 71
    }
};

// Reverse lookup map for O(1) validation
const RECIPE_HASH_MAP = new Map<number, Recipe>();
Object.values(RECIPES).forEach(r => {
    if (r.primesProduct) RECIPE_HASH_MAP.set(r.primesProduct, r);
});

export const RecipeSystem = {
    validatePlate: (ingredients: string[]): Recipe | null => {
        let product = 1;
        for (const ing of ingredients) {
            const prime = INGREDIENT_PRIMES[ing];
            if (prime) product *= prime;
        }
        return RECIPE_HASH_MAP.get(product) || null;
    },

    getRecipeByName: (name: string): Recipe | undefined => {
        return RECIPES[name];
    }
};
