export type Vector3 = { x: number, y: number, z: number };
export type Vector2 = { x: number, z: number };

export type ItemType =
    | 'plate' | 'bowl' | 'cup'
    | 'tomato' | 'chopped_tomato' | 'tomato_sauce'
    | 'lettuce' | 'chopped_lettuce'
    | 'potato' | 'raw_fries' | 'cooked_fries'
    | 'patty' | 'cooked_patty'
    | 'bun' | 'toasted_bun'
    | 'cheese' | 'cheese_slice' | 'grilled_cheese_cooked'
    | 'chicken' | 'coated_chicken' | 'cooked_chicken' | 'cooked_chicken_tenders'
    | 'bacon' | 'cooked_bacon'
    | 'onion' | 'chopped_onion' | 'onion_rings' | 'cooked_onion_rings'
    | 'banana' | 'sliced_banana'
    | 'strawberry' | 'sliced_strawberry'
    | 'pizza_dough' | 'pizza_base' | 'pizza_margherita' | 'cooked_pizza_margherita'
    | 'egg' | 'fried_egg'
    | 'pancake_mix' | 'pancake' | 'cooked_pancakes'
    | 'omelette' | 'cooked_omelette'
    | 'milk' | 'yogurt'
    | 'bread' | 'toasted_bread'
    | 'syrup'
    | 'granola'
    | 'smoothie_ready';

export type StationType = 'wall' | 'counter' | 'processor' | 'ingredient_source' | 'item_source' | 'serving' | 'trash' | 'table' | 'preplaced_item';

export interface LevelObject {
    name: string;
    type: StationType;
    position: Vector2; // x, z
    rotation?: number; // y-axis radians
    size?: { width: number, depth: number };
    config?: any;
}

export interface LevelSchema {
    levelId: number;
    name: string;
    duration: number;
    starThresholds: [number, number, number];
    availableMeals: string[];
    maxActiveOrders: number;
    newOrderDelay: number;
    layout: LevelObject[];
}

export interface Entity {
    id: string;
    type: ItemType;
    position: Vector3;
    rotation: Vector3;
    heldBy?: string; // 'player' or station ID
    state?: string; // 'raw', 'cooked', 'chopped', etc.
    contents?: string[]; // IDs of other entities contained within (for plates)
}

export interface Recipe {
    name: string;
    ingredients: string[]; // Sorted list of ingredients
    timeLimit: number;
    baseScore: number;
    primesProduct?: number; // Pre-calculated hash
}

export interface Order {
    id: string;
    recipeName: string;
    startTime: number;
    duration: number;
    status: 'active' | 'completed' | 'failed';
    score: number;
}
