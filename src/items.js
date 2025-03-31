// src/items.js
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { ITEM_TYPES, INGREDIENT_STATES } from './constants.js';
import { RECIPES, getRecipeIngredients } from './gameData.js'; // Import RECIPES

export function checkPlateCompletion(plate) {
    // This function now also needs to handle completion in a 'bowl' or 'cup' if needed
    if (!plate || plate.userData.type !== ITEM_TYPES.ITEM || !['plate', 'bowl', 'cup'].includes(plate.userData.itemType)) {
        // console.log("checkPlateCompletion: Invalid object passed or not a plate/bowl/cup.");
        return false;
    }
    // Ensure contents is always an array, even if empty
    const contents = Array.isArray(plate.userData.contents) ? plate.userData.contents.slice().sort() : [];
    // console.log(`--- Checking Completion [${plate.userData.itemType}] ---`);
    // console.log(`ID: ${plate.id}, Contents: [${contents.join(', ')}]`);

    for (const mealName in RECIPES) {
        const recipeData = RECIPES[mealName];
        if (!recipeData || !recipeData.ingredients) continue;
        const recipeIngredients = recipeData.ingredients; // Already sorted

        // console.log(` -> Comparing with Recipe [${mealName}]: [${recipeIngredients.join(', ')}]`);
        let lengthsMatch = contents.length === recipeIngredients.length;
        let elementsMatch = lengthsMatch && contents.every((value, index) => value === recipeIngredients[index]);

        if (lengthsMatch && elementsMatch) {
            plate.userData.mealName = mealName;
            // console.log(`   ✅ COMPLETED as: ${mealName}`);
            // console.log(`---------------------------------`);
            return true;
        }
    }

    // console.log("   ❌ No recipe match found.");
    // console.log(`---------------------------------`);
    plate.userData.mealName = null;
    return false;
}

// Central function to create items/ingredients
export function createItem(scene, type, preloadedModels, state = INGREDIENT_STATES.RAW, position = null) {
    let geometry, material, mesh;
    const defaultPos = new THREE.Vector3(0, 0.2, 0);
    let userData = {};
    let finalName = type; // Use specific name like 'raw_fries', 'cooked_pancakes'

    // --- Check for Preloaded Model Template ---
    const templateModel = preloadedModels[type];
    if (templateModel) {
        mesh = templateModel.clone();
        mesh.visible = true;
        mesh.position.copy(position || defaultPos);
        mesh.traverse((child) => {
            if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }
        });
        // Assign userData based on PRELOADED model key
        switch (type) {
            case 'tomato': userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'tomato', state: INGREDIENT_STATES.RAW }; finalName = 'tomato'; break;
            case 'potato': userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'potato', state: INGREDIENT_STATES.RAW }; finalName = 'potato'; break;
            case 'lettuce': userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'lettuce', state: INGREDIENT_STATES.RAW }; finalName = 'lettuce'; break;
            case 'chopped_tomato': userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'tomato', state: INGREDIENT_STATES.CHOPPED }; finalName = 'chopped_tomato'; break;
            case 'banana': userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'banana', state: INGREDIENT_STATES.RAW }; finalName = 'banana'; break;
            case 'strawberry': userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'strawberry', state: INGREDIENT_STATES.RAW }; finalName = 'strawberry'; break;
            // case 'onion': userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'onion', state: INGREDIENT_STATES.RAW }; finalName = 'onion'; break;
            // case 'raw_chicken': userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'chicken', state: INGREDIENT_STATES.RAW }; finalName = 'raw_chicken'; break;
            case 'egg': userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'egg', state: INGREDIENT_STATES.RAW }; finalName = 'egg'; break;
            // case 'bread_slice': userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'bread', state: INGREDIENT_STATES.RAW }; finalName = 'bread_slice'; break;
            // case 'raw_bacon': userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'bacon', state: INGREDIENT_STATES.RAW }; finalName = 'raw_bacon'; break;
            // case 'pizza_dough': userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'dough', state: INGREDIENT_STATES.RAW }; finalName = 'pizza_dough'; break;
            // case 'tomato_sauce': userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'sauce', state: 'ready' }; finalName = 'tomato_sauce'; break;
            // case 'shredded_mozzarella': userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'cheese', state: 'shredded' }; finalName = 'shredded_mozzarella'; break;
            case 'pancake_mix': userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'mix', state: 'dry' }; finalName = 'pancake_mix'; break;
            // case 'coating_mix': userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'mix', state: 'coating' }; finalName = 'coating_mix'; break;
            case 'yogurt': userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'yogurt', state: 'ready' }; finalName = 'yogurt'; break;
            case 'milk': userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'milk', state: 'ready' }; finalName = 'milk'; break; // Added mapping if model exists
            case 'granola': userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'granola', state: 'ready' }; finalName = 'granola'; break;
            case 'syrup': userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'syrup', state: 'ready' }; finalName = 'syrup'; break;
            // case 'mixing_bowl': userData = { type: ITEM_TYPES.ITEM, itemType: 'mixing_bowl', contents: [] }; finalName = 'mixing_bowl'; break; // No longer needed for mixing
            case 'bowl': userData = { type: ITEM_TYPES.ITEM, itemType: 'bowl', contents: [], mealName: null }; finalName = 'bowl'; break; // Still needed for serving fruit bowl etc.
            case 'cup': userData = { type: ITEM_TYPES.ITEM, itemType: 'cup', contents: [], mealName: null }; finalName = 'cup'; break; // Still needed for serving smoothie
            default: console.warn(`Preloaded model found for "${type}" but no userData mapping defined.`); userData = { type: ITEM_TYPES.ITEM }; break;
        }
        mesh.userData = userData;
        mesh.name = finalName;
        scene.add(mesh);
        return mesh; // InteractionManager adds to list
    }

    // --- Primitive Geometry Fallbacks ---
    // Use default grey for missing colors
    const defaultColor = 0x808080;
    material = new THREE.MeshStandardMaterial({ color: defaultColor, roughness: 0.7, metalness: 0.1 });

    switch (type) {
        // --- Existing Ingredients ---
        case 'raw_fries': geometry = new THREE.BoxGeometry(0.15, 0.05, 0.15); material.color.setHex(0xfffacd); userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'fries', state: INGREDIENT_STATES.RAW }; finalName = 'raw_fries'; break;
        case 'cooked_fries': geometry = new THREE.BoxGeometry(0.15, 0.05, 0.15); material.color.setHex(0xffd700); userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'fries', state: INGREDIENT_STATES.COOKED }; finalName = 'cooked_fries'; break;
        case 'chopped_lettuce': geometry = new THREE.BoxGeometry(0.12, 0.04, 0.12); material.color.setHex(0x90ee90); userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'lettuce', state: INGREDIENT_STATES.CHOPPED }; finalName = 'chopped_lettuce'; break;
        case 'chopped_tomato': geometry = new THREE.BoxGeometry(0.1, 0.03, 0.1); material.color.setHex(0xff6347); userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'tomato', state: INGREDIENT_STATES.CHOPPED }; finalName = 'chopped_tomato'; break; // Added primitive if model missing
        case 'patty': geometry = new THREE.CylinderGeometry(0.12, 0.12, 0.03, 16); material.color.setHex(0x8B4513); userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'patty', state: INGREDIENT_STATES.RAW }; break;
        case 'cooked_patty': geometry = new THREE.CylinderGeometry(0.12, 0.12, 0.03, 16); material.color.setHex(0x5c2e0a); userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'patty', state: INGREDIENT_STATES.COOKED }; finalName = 'cooked_patty'; break;
        case 'bun': geometry = new THREE.CylinderGeometry(0.14, 0.13, 0.08, 16); material.color.setHex(0xf0d891); userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'bun', state: 'ready' }; finalName = 'bun'; break;
        case 'cheese_slice': geometry = new THREE.BoxGeometry(0.11, 0.01, 0.11); material.color.setHex(0xffd700); userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'cheese_slice', state: 'ready' }; finalName = 'cheese_slice'; break;
        case 'plate': geometry = new THREE.CylinderGeometry(0.15, 0.14, 0.02, 16); material.color.setHex(0xffffff); material.metalness = 0.1; material.roughness = 0.5; userData = { type: ITEM_TYPES.ITEM, itemType: 'plate', contents: [], mealName: null }; break;

        // --- New Ingredient Primitives ---
        case 'onion': geometry = new THREE.SphereGeometry(0.09, 12, 8); material.color.setHex(0xE0CFAF); userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'onion', state: INGREDIENT_STATES.RAW }; break;
        case 'raw_onion_rings': geometry = new THREE.TorusGeometry(0.08, 0.015, 8, 16); material.color.setHex(0xFDF5E6); userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'onion_rings', state: INGREDIENT_STATES.RAW }; finalName = 'raw_onion_rings'; break;
        case 'coated_onion_rings': geometry = new THREE.TorusGeometry(0.08, 0.018, 8, 16); material.color.setHex(0xF5DEB3); userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'onion_rings', state: 'coated' }; finalName = 'coated_onion_rings'; break;
        case 'cooked_onion_rings': geometry = new THREE.TorusGeometry(0.08, 0.018, 8, 16); material.color.setHex(0xDAA520); userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'onion_rings', state: INGREDIENT_STATES.COOKED }; finalName = 'cooked_onion_rings'; break;

        case 'raw_chicken': geometry = new THREE.BoxGeometry(0.2, 0.05, 0.1); material.color.setHex(0xFFC0CB); userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'chicken', state: INGREDIENT_STATES.RAW }; finalName = 'raw_chicken'; break;
        case 'raw_chicken_strips': geometry = new THREE.BoxGeometry(0.18, 0.04, 0.04); material.color.setHex(0xFFD1DC); userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'chicken_strips', state: INGREDIENT_STATES.RAW }; finalName = 'raw_chicken_strips'; break;
        case 'coating_mix': geometry = new THREE.BoxGeometry(0.1, 0.1, 0.1); material.color.setHex(0xF5F5DC); userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'mix', state: 'coating' }; finalName = 'coating_mix'; break; // Represents the source box
        case 'coated_chicken_strips': geometry = new THREE.BoxGeometry(0.18, 0.045, 0.045); material.color.setHex(0xF0E68C); userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'chicken_strips', state: 'coated' }; finalName = 'coated_chicken_strips'; break;
        case 'cooked_chicken_tenders': geometry = new THREE.BoxGeometry(0.18, 0.045, 0.045); material.color.setHex(0xB8860B); userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'chicken_tenders', state: INGREDIENT_STATES.COOKED }; finalName = 'cooked_chicken_tenders'; break;

        case 'bread_slice': geometry = new THREE.BoxGeometry(0.12, 0.12, 0.02); material.color.setHex(0xD2B48C); userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'bread', state: INGREDIENT_STATES.RAW }; finalName = 'bread_slice'; break;
        case 'toasted_bread': geometry = new THREE.BoxGeometry(0.12, 0.12, 0.02); material.color.setHex(0xAF8F6D); userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'bread', state: 'toasted' }; finalName = 'toasted_bread'; break;
        case 'raw_bacon': geometry = new THREE.BoxGeometry(0.15, 0.01, 0.04); material.color.setHex(0xFF7F50); userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'bacon', state: INGREDIENT_STATES.RAW }; finalName = 'raw_bacon'; break;
        case 'cooked_bacon': geometry = new THREE.BoxGeometry(0.14, 0.01, 0.04); material.color.setHex(0x8B0000); userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'bacon', state: INGREDIENT_STATES.COOKED }; finalName = 'cooked_bacon'; break;
        case 'grilled_cheese_raw': geometry = new THREE.BoxGeometry(0.13, 0.13, 0.05); material.color.setHex(0xE0CDAC); userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'grilled_cheese', state: INGREDIENT_STATES.RAW }; finalName = 'grilled_cheese_raw'; break; // Represents assembled sandwich before cooking
        case 'grilled_cheese_cooked': geometry = new THREE.BoxGeometry(0.13, 0.13, 0.05); material.color.setHex(0xCD853F); userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'grilled_cheese', state: INGREDIENT_STATES.COOKED }; finalName = 'grilled_cheese_cooked'; break;

        case 'egg': geometry = new THREE.SphereGeometry(0.04, 8, 6); material.color.setHex(0xFFE4B5); userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'egg', state: INGREDIENT_STATES.RAW }; break;
        case 'pancake_mix': geometry = new THREE.BoxGeometry(0.1, 0.15, 0.08); material.color.setHex(0xF5DEB3); userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'mix', state: 'dry' }; finalName = 'pancake_mix'; break; // Box of mix
        // case 'mixing_bowl': geometry = new THREE.CylinderGeometry(0.12, 0.08, 0.08, 16, 1, true); material.color.setHex(0xD2B48C); material.side = THREE.DoubleSide; userData = { type: ITEM_TYPES.ITEM, itemType: 'mixing_bowl', contents: [] }; finalName = 'mixing_bowl'; break; // No longer needed for mixing
        case 'omelette_mix': geometry = new THREE.CylinderGeometry(0.1, 0.1, 0.02, 16); material.color.setHex(0xFFFFE0); userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'egg_mix', state: 'mixed' }; finalName = 'omelette_mix'; break; // Represents the liquid mix
        case 'pancake_batter': geometry = new THREE.CylinderGeometry(0.1, 0.1, 0.02, 16); material.color.setHex(0xF5F5DC); userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'pancake_batter', state: 'mixed' }; finalName = 'pancake_batter'; break; // Represents the liquid batter
        case 'cooked_pancakes': geometry = new THREE.CylinderGeometry(0.1, 0.1, 0.04, 16); material.color.setHex(0xCD853F); userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'pancakes', state: INGREDIENT_STATES.COOKED }; finalName = 'cooked_pancakes'; break; // Stack of 3
        case 'cooked_omelette': geometry = new THREE.CylinderGeometry(0.13, 0.13, 0.02, 16, 1, false, 0, Math.PI); material.color.setHex(0xFFE484); material.side = THREE.DoubleSide; userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'omelette', state: INGREDIENT_STATES.COOKED }; finalName = 'cooked_omelette'; break; // Half cylinder
        case 'syrup': geometry = new THREE.CylinderGeometry(0.03, 0.04, 0.1, 12); material.color.setHex(0x8B4513); userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'syrup', state: 'ready' }; break; // Syrup bottle

        case 'banana': geometry = new THREE.CapsuleGeometry(0.03, 0.1, 4, 8); material.color.setHex(0xFFFFE0); userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'banana', state: INGREDIENT_STATES.RAW }; break;
        case 'sliced_banana': geometry = new THREE.CylinderGeometry(0.03, 0.03, 0.01, 12); material.color.setHex(0xFFFFF0); userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'banana', state: 'sliced' }; finalName = 'sliced_banana'; break;
        case 'strawberry': geometry = new THREE.ConeGeometry(0.04, 0.06, 8); material.color.setHex(0xFF6347); userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'strawberry', state: INGREDIENT_STATES.RAW }; break;
        case 'sliced_strawberry': geometry = new THREE.BoxGeometry(0.03, 0.01, 0.03); material.color.setHex(0xFF8367); userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'strawberry', state: 'sliced' }; finalName = 'sliced_strawberry'; break;
        case 'yogurt': geometry = new THREE.CylinderGeometry(0.05, 0.04, 0.06, 16); material.color.setHex(0xF0FFFF); userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'yogurt', state: 'ready' }; break; // Yogurt cup
        case 'milk': geometry = new THREE.CylinderGeometry(0.04, 0.04, 0.12, 12); material.color.setHex(0xFFFFFF); userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'milk', state: 'ready' }; break; // Milk carton/bottle
        case 'granola': geometry = new THREE.BoxGeometry(0.1, 0.12, 0.05); material.color.setHex(0xD2691E); userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'granola', state: 'ready' }; break; // Granola box
        case 'bowl': geometry = new THREE.CylinderGeometry(0.13, 0.09, 0.07, 16, 1, true); material.color.setHex(0xE6E6FA); material.side = THREE.DoubleSide; userData = { type: ITEM_TYPES.ITEM, itemType: 'bowl', contents: [], mealName: null }; break; // Serving bowl

        case 'cup': geometry = new THREE.CylinderGeometry(0.05, 0.04, 0.1, 16); material.color.setHex(0xADD8E6); material.transparent = true; material.opacity = 0.8; userData = { type: ITEM_TYPES.ITEM, itemType: 'cup', contents: [], mealName: null }; break; // Smoothie cup
        // case 'blender_cup_smoothie': geometry = new THREE.CylinderGeometry(0.05, 0.04, 0.1, 16); material.color.setHex(0xFFC0CB); userData = { type: ITEM_TYPES.ITEM, itemType: 'cup', contents: ['smoothie_mix'] }; finalName = 'blender_cup_smoothie'; break; // REMOVED - No longer used
        case 'smoothie_ready': geometry = new THREE.CylinderGeometry(0.05, 0.04, 0.1, 16); material.color.setHex(0xFF69B4); userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'smoothie', state: 'ready' }; finalName = 'smoothie_ready'; break; // Represents the final smoothie (conceptually in a cup)

        case 'pizza_dough': geometry = new THREE.SphereGeometry(0.1, 16, 12); material.color.setHex(0xF5F5DC); userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'dough', state: INGREDIENT_STATES.RAW }; finalName = 'pizza_dough'; break;
        case 'pizza_base': geometry = new THREE.CylinderGeometry(0.2, 0.2, 0.01, 24); material.color.setHex(0xFDF5E6); userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'dough', state: 'base' }; finalName = 'pizza_base'; break; // Flattened dough
        case 'tomato_sauce': geometry = new THREE.CylinderGeometry(0.05, 0.05, 0.08, 12); material.color.setHex(0xB22222); userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'sauce', state: 'ready' }; finalName = 'tomato_sauce'; break; // Can of sauce
        case 'shredded_mozzarella': geometry = new THREE.BoxGeometry(0.1, 0.05, 0.1); material.color.setHex(0xFFFACD); userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'cheese', state: 'shredded' }; finalName = 'shredded_mozzarella'; break; // Pile of cheese
        case 'pizza_margherita_raw': geometry = new THREE.CylinderGeometry(0.2, 0.2, 0.02, 24); material.color.setHex(0xFFA07A); userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'pizza', state: INGREDIENT_STATES.RAW }; finalName = 'pizza_margherita_raw'; break; // Assembled raw pizza
        case 'cooked_pizza_margherita': geometry = new THREE.CylinderGeometry(0.2, 0.2, 0.02, 24); material.color.setHex(0xCD5C5C); userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'pizza', state: INGREDIENT_STATES.COOKED }; finalName = 'cooked_pizza_margherita'; break; // Cooked pizza

        default: console.warn("Unknown item type requested (primitive fallback):", type); return null;
    }

    mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.position.copy(position || defaultPos);
    mesh.name = finalName; mesh.userData = userData;
    scene.add(mesh);
    // InteractionManager adds the item to its interactables list
    return mesh;
}