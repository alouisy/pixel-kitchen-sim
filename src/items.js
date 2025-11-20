// src/items.js
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { ITEM_TYPES, INGREDIENT_STATES } from './constants.js';
import { RECIPES } from './gameData.js';
import { createItemMesh } from './voxelBuilder.js';

export function checkPlateCompletion(plate) {
    if (!plate || plate.userData.type !== ITEM_TYPES.ITEM || !['plate', 'bowl', 'cup'].includes(plate.userData.itemType)) return false;
    const contents = Array.isArray(plate.userData.contents) ? plate.userData.contents.slice().sort() : [];

    for (const mealName in RECIPES) {
        const recipeData = RECIPES[mealName];
        if (!recipeData || !recipeData.ingredients) continue;
        const recipeIngredients = recipeData.ingredients;
        let lengthsMatch = contents.length === recipeIngredients.length;
        let elementsMatch = lengthsMatch && contents.every((value, index) => value === recipeIngredients[index]);

        if (lengthsMatch && elementsMatch) {
            plate.userData.mealName = mealName;
            return true;
        }
    }
    plate.userData.mealName = null;
    return false;
}

export function createItem(scene, type, preloadedModels, state = INGREDIENT_STATES.RAW, position = null) {
    // Use Voxel Generator instead of Primitives
    const mesh = createItemMesh(type);

    const defaultPos = new THREE.Vector3(0, 0.2, 0);
    let userData = {};
    let finalName = type;

    // Determine type based on string analysis or direct match
    // This logic is critical for interaction compatibility
    
    if (['plate', 'bowl', 'cup'].includes(type)) {
         userData = { type: ITEM_TYPES.ITEM, itemType: type, contents: [], mealName: null };
    }
    else if (type.includes('smoothie_ready') || type.includes('cooked') || type.includes('chopped') || type.includes('sliced') || type.includes('toasted') || type.includes('coated') || type.includes('mixed') || type.includes('batter') || type.includes('base')) {
        userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: type, state: INGREDIENT_STATES.COOKED }; // Generalized state
    }
    else {
        userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: type, state: INGREDIENT_STATES.RAW };
    }

    mesh.castShadow = true; 
    mesh.receiveShadow = true;
    mesh.position.copy(position || defaultPos);
    mesh.name = finalName; 
    mesh.userData = userData;
    
    scene.add(mesh);
    return mesh;
}