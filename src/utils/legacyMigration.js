// src/utils/legacyMigration.js

const LEGACY_NAME_MAPPINGS = {
    // Stations & Catalog Items
    "Potato Bin": "potato_bin",
    "PotatoBin": "potato_bin",
    "Cutting Board": "cutting_board",
    "CuttingBoard": "cutting_board",
    "Deep Fryer": "deep_fryer",
    "Fryer": "deep_fryer",
    "Plate Stack": "plate_stack",
    "PlateStack": "plate_stack",
    "Coating Station": "coating_station",
    "CoatingStation": "coating_station",
    "Lettuce Bin": "lettuce_bin",
    "LettuceBin": "lettuce_bin",
    "Tomato Bin": "tomato_bin",
    "TomatoBin": "tomato_bin",
    "Patty Box": "patty_box",
    "PattyBox": "patty_box",
    "Stove Top": "stove_top",
    "StoveTop": "stove_top",
    "Bun Rack": "bun_rack",
    "BunRack": "bun_rack",
    "Cheese Fridge": "cheese_fridge",
    "CheeseFridge": "cheese_fridge",
    "Onion Bin": "onion_bin",
    "OnionBin": "onion_bin",
    "Chicken Box": "chicken_box",
    "ChickenBox": "chicken_box",
    "Bread Rack": "bread_rack",
    "BreadRack": "bread_rack",
    "Toaster": "toaster",
    "Bacon Pack": "bacon_pack",
    "BaconPack": "bacon_pack",
    "Pancake Mix": "pancake_mix_src",
    "PancakeMix": "pancake_mix_src",
    "Stand Mixer": "stand_mixer",
    "StandMixer": "stand_mixer",
    "Syrup Bottle": "syrup_bottle",
    "SyrupBottle": "syrup_bottle",
    "Egg Carton": "egg_carton",
    "EggCarton": "egg_carton",
    "Yogurt Pot": "yogurt_pot",
    "YogurtPot": "yogurt_pot",
    "Granola Jar": "granola_jar",
    "GranolaJar": "granola_jar",
    "Bowl Stack": "bowl_stack",
    "BowlStack": "bowl_stack",
    "Blender": "blender",
    "Cup Stack": "cup_stack",
    "CupStack": "cup_stack",
    "Pizza Dough": "pizza_dough_src",
    "PizzaDough": "pizza_dough_src",
    "Dough Press": "dough_press",
    "DoughPress": "dough_press",
    "Tomato Sauce": "tomato_sauce_src",
    "TomatoSauce": "tomato_sauce_src",
    "Mozzarella Bin": "mozzarella_bin",
    "MozzarellaBin": "mozzarella_bin",
    "Pizza Oven": "pizza_oven",
    "PizzaOven": "pizza_oven",
    "Serving Pass": "serving_pass",
    "ServingPass": "serving_pass",
    "SERVE": "serve_label",
    "Trash Bin": "trash_bin",
    "TrashBin": "trash_bin",
    "Trash": "trash_bin",
    "Counter": "counter",
    "Counter Corner": "counter_corner",
    "Counter (Wood)": "counter_wood",
    "Table": "table",
    "Wall": "wall",
    "Wall (Short)": "wall_short",
    "Wall (Long)": "wall_long",
    "Corner Wall": "wall_corner",
    "Wall Back": "wall_back",
    "Wall Left": "wall_left",
    "Wall Right": "wall_right",
    "Wall Front Left": "wall_front_left",
    "Wall Front Right": "wall_front_right",
    "Banana Crate": "banana_crate",
    "Strawberry Box": "strawberry_box",
    "Milk Carton": "milk_carton",
    "Coating Mix": "coating_mix_src",

    // Meals
    "French Fries": "french_fries",
    "Salad": "salad",
    "Hamburger": "hamburger",
    "Cheeseburger Combo": "cheeseburger_combo",
    "Onion Rings": "onion_rings",
    "Chicken Tenders & Fries": "chicken_tenders_fries",
    "BLT Sandwich": "blt_sandwich",
    "Grilled Cheese Sandwich": "grilled_cheese_sandwich",
    "Pancakes": "pancakes",
    "Cheese Omelette": "cheese_omelette",
    "Fruit & Yogurt Bowl": "fruit_yogurt_bowl",
    "Smoothie": "smoothie",
    "Pizza Margherita": "pizza_margherita"
};

/**
 * Silently normalizes level data from legacy English names to standard snake_case IDs.
 * Ensures existing levels in localStorage or Supabase load seamlessly without losing progress or breaking.
 */
export function normalizeLevelData(levelData) {
    if (!levelData || typeof levelData !== 'object') return levelData;

    const copy = JSON.parse(JSON.stringify(levelData));

    if (Array.isArray(copy.availableMeals)) {
        copy.availableMeals = copy.availableMeals.map(m => LEGACY_NAME_MAPPINGS[m] || m);
    }

    if (Array.isArray(copy.layout)) {
        copy.layout.forEach(item => {
            if (item.name && LEGACY_NAME_MAPPINGS[item.name]) {
                item.name = LEGACY_NAME_MAPPINGS[item.name];
            }
        });
    }

    return copy;
}
