// src/items.js
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { ITEM_TYPES, INGREDIENT_STATES } from './constants.js';
// --- Import RECIPES using ES Module syntax ---
import { RECIPES, getRecipeIngredients } from './gameData.js'; // Import RECIPES directly

export function checkPlateCompletion(plate) {
    if (!plate || plate.userData.type !== ITEM_TYPES.ITEM || plate.userData.itemType !== 'plate') {
        return false;
    }

    const contents = plate.userData.contents.slice().sort();
    // console.log(`--- Checking Plate Completion ---`);
    // console.log(`Plate ID: ${plate.id}, Current Contents (Sorted): [${contents.join(', ')}]`);

    // --- Remove require line ---
    // const globalRecipes = require('./gameData.js').RECIPES; // REMOVE THIS LINE

    // --- Iterate over the imported RECIPES object ---
    for (const mealName in RECIPES) {
        const recipeData = RECIPES[mealName]; // Get the whole recipe object
        if (!recipeData || !recipeData.ingredients) continue; // Skip if invalid

        const recipeIngredients = recipeData.ingredients; // Already sorted in gameData.js

        // console.log(` -> Comparing with Recipe [${mealName}]: [${recipeIngredients.join(', ')}]`);
        let lengthsMatch = contents.length === recipeIngredients.length;
        let elementsMatch = lengthsMatch && contents.every((value, index) => value === recipeIngredients[index]);
        // console.log(` -> Lengths Match: ${lengthsMatch}, Elements Match: ${elementsMatch}`);

        if (lengthsMatch && elementsMatch) {
            plate.userData.mealName = mealName;
            // console.log(`   ✅ Plate COMPLETED as: ${mealName}`);
            // console.log(`---------------------------------`);
            return true;
        }
    }

    // console.log("   ❌ No recipe match found.");
    // console.log(`---------------------------------`);
    plate.userData.mealName = null;
    return false;
}

// createItem function remains the same
export function createItem(scene, type, preloadedModels, state = INGREDIENT_STATES.RAW, position = null) {
    let geometry, material, mesh;
    const defaultPos = new THREE.Vector3(0, 0.2, 0);
    let userData = {};
    let finalName = type;

    const templateModel = preloadedModels[type];
    if (templateModel) {
        mesh = templateModel.clone();
        mesh.visible = true;
        mesh.position.copy(position || defaultPos);
        mesh.traverse((child) => {
            if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }
        });
        switch (type) {
            case 'tomato': userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'tomato', state: INGREDIENT_STATES.RAW }; finalName = 'tomato'; break;
            case 'potato': userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'potato', state: INGREDIENT_STATES.RAW }; finalName = 'potato'; break;
            case 'lettuce': userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'lettuce', state: INGREDIENT_STATES.RAW }; finalName = 'lettuce'; break;
            case 'chopped_tomato': userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'tomato', state: INGREDIENT_STATES.CHOPPED }; finalName = 'chopped_tomato'; break;
            default: console.warn(`Preloaded model found for "${type}" but no userData mapping defined.`); userData = { type: ITEM_TYPES.ITEM }; break;
        }
        mesh.userData = userData;
        mesh.name = finalName;
        scene.add(mesh);
        return mesh;
    }

    switch (type) {
        case 'raw_fries': geometry = new THREE.BoxGeometry(0.15, 0.05, 0.15); material = new THREE.MeshStandardMaterial({ color: 0xfffacd }); userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'fries', state: INGREDIENT_STATES.RAW }; finalName = 'raw_fries'; break;
        case 'cooked_fries': geometry = new THREE.BoxGeometry(0.15, 0.05, 0.15); material = new THREE.MeshStandardMaterial({ color: 0xffd700 }); userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'fries', state: INGREDIENT_STATES.COOKED }; finalName = 'cooked_fries'; break;
        case 'chopped_lettuce': geometry = new THREE.BoxGeometry(0.12, 0.04, 0.12); material = new THREE.MeshStandardMaterial({ color: 0x90ee90 }); userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'lettuce', state: INGREDIENT_STATES.CHOPPED }; finalName = 'chopped_lettuce'; break;
        case 'patty': geometry = new THREE.CylinderGeometry(0.12, 0.12, 0.03, 16); material = new THREE.MeshStandardMaterial({ color: 0x8B4513 }); userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'patty', state: INGREDIENT_STATES.RAW }; break;
        case 'cooked_patty': geometry = new THREE.CylinderGeometry(0.12, 0.12, 0.03, 16); material = new THREE.MeshStandardMaterial({ color: 0x5c2e0a }); userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'patty', state: INGREDIENT_STATES.COOKED }; finalName = 'cooked_patty'; break;
        case 'bun': geometry = new THREE.CylinderGeometry(0.14, 0.13, 0.08, 16); material = new THREE.MeshStandardMaterial({ color: 0xf0d891 }); userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'bun', state: 'ready' }; finalName = 'bun'; break;
        case 'cheese_slice': geometry = new THREE.BoxGeometry(0.11, 0.01, 0.11); material = new THREE.MeshStandardMaterial({ color: 0xffd700 }); userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'cheese_slice', state: 'ready' }; finalName = 'cheese_slice'; break;
        case 'plate': geometry = new THREE.CylinderGeometry(0.15, 0.14, 0.02, 16); material = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.1, roughness: 0.5 }); userData = { type: ITEM_TYPES.ITEM, itemType: 'plate', contents: [], mealName: null }; break;
        default: console.warn("Unknown item type requested (primitive):", type); return null;
    }

    mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.position.copy(position || defaultPos);
    mesh.name = finalName; mesh.userData = userData;
    scene.add(mesh);
    return mesh;
}