// Editor catalog items with categories and icons
export const CATALOG_ITEMS = [
    // Architecture
    { name: 'Wall', category: 'Architecture', type: 'wall', icon: '🧱', size: { width: 0.5, depth: 2 } },

    // Furniture
    { name: 'Counter', category: 'Furniture', type: 'counter', icon: '🟫', color: '#8d6e63' },
    { name: 'Table', category: 'Furniture', type: 'table', icon: '🪑', color: '#795548' },
    { name: 'Serving Counter', category: 'Furniture', type: 'serving', icon: '🛎️', isServing: true, color: '#d32f2f' },

    // ITEMS (Single Placeable) ---
    { name: 'Plate', category: 'Furniture', type: 'preplaced_item', icon: '🍽️', config: { item: 'plate' } },
    { name: 'Bowl', category: 'Furniture', type: 'preplaced_item', icon: '🥣', config: { item: 'bowl' } },
    { name: 'Cup', category: 'Furniture', type: 'preplaced_item', icon: '🥤', config: { item: 'cup' } },

    // Stations
    { name: 'Fryer', category: 'Stations', type: 'processor', icon: '🍳', config: { processes: ['raw_fries', 'cooked_chicken_tenders', 'cooked_onion_rings'] } },
    { name: 'Cutting Board', category: 'Stations', type: 'processor', icon: '🔪', config: { processes: ['potato', 'tomato', 'lettuce', 'onion', 'banana', 'strawberry', 'cheese'] } },
    { name: 'Stove', category: 'Stations', type: 'processor', icon: '🔥', config: { processes: ['raw_patty', 'raw_bacon', 'egg', 'pancake_mix', 'omelette', 'grilled_cheese_cooked'] } },
    { name: 'Toaster', category: 'Stations', type: 'processor', icon: '🍞', config: { processes: ['bun', 'bread'] } },
    { name: 'Pizza Oven', category: 'Stations', type: 'processor', icon: '🍕', config: { processes: ['pizza_margherita'] } },
    { name: 'Blender', category: 'Stations', type: 'processor', icon: '🥤', config: { processes: ['smoothie_ready'] } },
    { name: 'Trash Bin', category: 'Stations', type: 'trash', icon: '🗑️' },

    // Sources - Ingredients
    { name: 'Potato Source', category: 'Sources', type: 'ingredient_source', icon: '🥔', config: { ingredient: 'potato' } },
    { name: 'Tomato Source', category: 'Sources', type: 'ingredient_source', icon: '🍅', config: { ingredient: 'tomato' } },
    { name: 'Lettuce Source', category: 'Sources', type: 'ingredient_source', icon: '🥬', config: { ingredient: 'lettuce' } },
    { name: 'Onion Source', category: 'Sources', type: 'ingredient_source', icon: '🧅', config: { ingredient: 'onion' } },
    { name: 'Cheese Source', category: 'Sources', type: 'ingredient_source', icon: '🧀', config: { ingredient: 'cheese' } },
    { name: 'Meat Source', category: 'Sources', type: 'ingredient_source', icon: '🥩', config: { ingredient: 'patty' } },
    { name: 'Chicken Source', category: 'Sources', type: 'ingredient_source', icon: '🍗', config: { ingredient: 'chicken' } },
    { name: 'Bacon Source', category: 'Sources', type: 'ingredient_source', icon: '🥓', config: { ingredient: 'bacon' } },
    { name: 'Bun Source', category: 'Sources', type: 'ingredient_source', icon: '🥯', config: { ingredient: 'bun' } },
    { name: 'Bread Source', category: 'Sources', type: 'ingredient_source', icon: '🍞', config: { ingredient: 'bread' } },
    { name: 'Egg Source', category: 'Sources', type: 'ingredient_source', icon: '🥚', config: { ingredient: 'egg' } },
    { name: 'Pizza Dough', category: 'Sources', type: 'ingredient_source', icon: '🍕', config: { ingredient: 'pizza_dough' } },
    { name: 'Pancake Mix', category: 'Sources', type: 'ingredient_source', icon: '🥞', config: { ingredient: 'pancake_mix' } },
    { name: 'Banana Source', category: 'Sources', type: 'ingredient_source', icon: '🍌', config: { ingredient: 'banana' } },
    { name: 'Strawberry Source', category: 'Sources', type: 'ingredient_source', icon: '🍓', config: { ingredient: 'strawberry' } },
    { name: 'Milk Source', category: 'Sources', type: 'ingredient_source', icon: '🥛', config: { ingredient: 'milk' } },
    { name: 'Yogurt Source', category: 'Sources', type: 'ingredient_source', icon: '🥣', config: { ingredient: 'yogurt' } },
    { name: 'Syrup Source', category: 'Sources', type: 'ingredient_source', icon: '🍯', config: { ingredient: 'syrup' } },
    { name: 'Granola Source', category: 'Sources', type: 'ingredient_source', icon: '🌾', config: { ingredient: 'granola' } },

    // Sources - Items
    { name: 'Plate Stack', category: 'Sources', type: 'item_source', icon: '🍽️', config: { item: 'plate' } },
    { name: 'Bowl Stack', category: 'Sources', type: 'item_source', icon: '🥣', config: { item: 'bowl' } },
    { name: 'Cup Stack', category: 'Sources', type: 'item_source', icon: '🥤', config: { item: 'cup' } },

    // Utensils (if any others needed, e.g. Pot, Pan - but those are usually part of stations or held items)
];

export const CATALOG_CATEGORIES = ['all', 'Architecture', 'Furniture', 'Stations', 'Sources'] as const;
