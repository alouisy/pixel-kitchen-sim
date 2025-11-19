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

    // Meta Data Logic (Keep consistent)
    if (type === 'tomato') userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'tomato', state: INGREDIENT_STATES.RAW };
    else if (type === 'potato') userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'potato', state: INGREDIENT_STATES.RAW };
    else if (type === 'lettuce') userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'lettuce', state: INGREDIENT_STATES.RAW };
    else if (type === 'chopped_tomato') userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'tomato', state: INGREDIENT_STATES.CHOPPED };
    else if (type === 'raw_fries') userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'fries', state: INGREDIENT_STATES.RAW };
    else if (type === 'cooked_fries') userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'fries', state: INGREDIENT_STATES.COOKED };
    else if (type === 'plate') userData = { type: ITEM_TYPES.ITEM, itemType: 'plate', contents: [], mealName: null };
    else {
        // Generic Fallback
        userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: type, state: 'unknown' };
    }

    mesh.castShadow = true; 
    mesh.receiveShadow = true;
    mesh.position.copy(position || defaultPos);
    mesh.name = finalName; 
    mesh.userData = userData;
    
    scene.add(mesh);
    return mesh;
}