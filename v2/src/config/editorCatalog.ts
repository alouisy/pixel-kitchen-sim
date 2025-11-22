// Editor catalog items with categories and icons
export const CATALOG_ITEMS = [
    // Architecture
    { name: 'Wall', category: 'Architecture', type: 'wall', icon: '🧱', size: { width: 0.5, depth: 2 } },

    // Furniture
    { name: 'Counter', category: 'Furniture', type: 'counter', icon: '🟫', color: '#8d6e63' },
    { name: 'Table', category: 'Furniture', type: 'table', icon: '🪑', color: '#795548' },
    { name: 'Serving Counter', category: 'Furniture', type: 'serving', icon: '🛎️', isServing: true, color: '#d32f2f' },

    // Stations
    { name: 'Fryer', category: 'Stations', type: 'processor', icon: '🍳', config: { processes: ['raw_fries'] } },
    { name: 'Cutting Board', category: 'Stations', type: 'processor', icon: '🔪', config: { processes: ['potato'] } },
    { name: 'Stove', category: 'Stations', type: 'processor', icon: '🔥', config: { processes: ['raw_patty'] } },
    { name: 'Trash Bin', category: 'Stations', type: 'trash', icon: '🗑️' },

    // Sources
    { name: 'Potato Source', category: 'Sources', type: 'ingredient_source', icon: '🥔', config: { ingredient: 'potato' } },
    { name: 'Tomato Source', category: 'Sources', type: 'ingredient_source', icon: '🍅', config: { ingredient: 'tomato' } },
    { name: 'Lettuce Source', category: 'Sources', type: 'ingredient_source', icon: '🥬', config: { ingredient: 'lettuce' } },
    { name: 'Cheese Source', category: 'Sources', type: 'ingredient_source', icon: '🧀', config: { ingredient: 'cheese' } },
    { name: 'Meat Source', category: 'Sources', type: 'ingredient_source', icon: '🥩', config: { ingredient: 'raw_patty' } },
    { name: 'Bun Source', category: 'Sources', type: 'ingredient_source', icon: '🍞', config: { ingredient: 'bun' } },
    { name: 'Plate Stack', category: 'Sources', type: 'item_source', icon: '🍽️', config: { item: 'plate' } },
];

export const CATALOG_CATEGORIES = ['all', 'Architecture', 'Furniture', 'Stations', 'Sources'] as const;
