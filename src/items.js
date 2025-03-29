// src/items.js
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { ITEM_TYPES, INGREDIENT_STATES } from './constants.js';
import { addInteractable } from './world.js'; // To add newly created items
import { RECIPES } from './gameData.js'; // Import recipes

export function checkPlateCompletion(plate) {
    if (!plate || plate.userData.type !== ITEM_TYPES.ITEM || plate.userData.itemType !== 'plate') {
        return false;
    }

    const contents = plate.userData.contents.slice().sort(); // Get sorted copy

    for (const mealName in RECIPES) {
        const recipeIngredients = RECIPES[mealName]; // Already sorted in gameData.js
        if (contents.length === recipeIngredients.length &&
            contents.every((value, index) => value === recipeIngredients[index])) {
            // Match found!
            plate.userData.mealName = mealName;
            console.log(`Plate completed as: ${mealName}`);
            return true; // Indicate completion
        }
    }

    // No match found, ensure mealName is null if contents change
    plate.userData.mealName = null;
    return false;
}

// Central function to create items/ingredients
export function createItem(scene, type, preloadedModels, state = INGREDIENT_STATES.RAW, position = null) {
    let geometry, material, mesh;
    const defaultPos = new THREE.Vector3(0, 0.2, 0); // Default spawn if no pos
    let userData = {};
    let finalName = type; // Use specific name like 'raw_fries'

    // --- Check for Preloaded Model Template ---
    const templateModel = preloadedModels[type];
    if (templateModel) {
        console.log(`Cloning preloaded model for: ${type}`);
        mesh = templateModel.clone(); // Clone the template
        mesh.visible = true; // Ensure clone is visible
        mesh.position.copy(position || defaultPos);

        // Apply shadows to all children of the clone
        mesh.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        // Assign userData and name based on type (must match primitive logic)
        // This part needs to be carefully maintained if more models are added
        switch (type) {
            case 'tomato':
                userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'tomato', state: INGREDIENT_STATES.RAW };
                finalName = 'tomato';
                break;
            case 'potato':
                userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'potato', state: INGREDIENT_STATES.RAW };
                finalName = 'potato';
                break;
            case 'lettuce':
                userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'lettuce', state: INGREDIENT_STATES.RAW };
                finalName = 'lettuce';
                break;
            case 'chopped_tomato':
                userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'tomato', state: INGREDIENT_STATES.CHOPPED };
                finalName = 'chopped_tomato';
                break;
            // Add cases for other preloaded models here...
        }
        mesh.userData = userData;
        mesh.name = finalName;

        scene.add(mesh);
        addInteractable(mesh);
        return mesh; // Return the cloned model
    }

    switch (type) {
        // Ingredients
        // case 'potato':
        //     geometry = new THREE.SphereGeometry(0.1, 8, 6);
        //     material = new THREE.MeshStandardMaterial({ color: 0x966919 });
        //     userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'potato', state: INGREDIENT_STATES.RAW };
        //     break;
        case 'raw_fries': // Specific type for fries after cutting
            geometry = new THREE.BoxGeometry(0.15, 0.05, 0.15);
            material = new THREE.MeshStandardMaterial({ color: 0xfffacd });
            userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'fries', state: INGREDIENT_STATES.RAW };
            finalName = 'raw_fries'; // Keep name consistent
            break;
        case 'cooked_fries':
            geometry = new THREE.BoxGeometry(0.15, 0.05, 0.15);
            material = new THREE.MeshStandardMaterial({ color: 0xffd700 });
            userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'fries', state: INGREDIENT_STATES.COOKED };
            finalName = 'cooked_fries'; // Keep name consistent
            break;
        // case 'tomato':
        //     geometry = new THREE.SphereGeometry(0.08, 16, 16);
        //     material = new THREE.MeshStandardMaterial({ color: 0xff4500 });
        //     userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'tomato', state: INGREDIENT_STATES.RAW };
        //     break;
        // case 'chopped_tomato': // New state/item
        //     geometry = new THREE.BoxGeometry(0.1, 0.03, 0.1); // Represent chopped bits
        //     material = new THREE.MeshStandardMaterial({ color: 0xff6347 });
        //     userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'tomato', state: INGREDIENT_STATES.CHOPPED };
        //     finalName = 'chopped_tomato';
        //     break;
        // case 'lettuce':
        //     geometry = new THREE.SphereGeometry(0.1, 16, 8);
        //     material = new THREE.MeshStandardMaterial({ color: 0x32cd32 });
        //     userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'lettuce', state: INGREDIENT_STATES.RAW };
        //     break;
        case 'chopped_lettuce': // New state/item
            geometry = new THREE.BoxGeometry(0.12, 0.04, 0.12); // Represent chopped bits
            material = new THREE.MeshStandardMaterial({ color: 0x90ee90 });
            userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'lettuce', state: INGREDIENT_STATES.CHOPPED };
            finalName = 'chopped_lettuce';
            break;
        case 'patty': // Raw patty
            geometry = new THREE.CylinderGeometry(0.12, 0.12, 0.03, 16);
            material = new THREE.MeshStandardMaterial({ color: 0x8B4513 }); // Brown
            userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'patty', state: INGREDIENT_STATES.RAW };
            break;
        case 'cooked_patty':
            geometry = new THREE.CylinderGeometry(0.12, 0.12, 0.03, 16);
            material = new THREE.MeshStandardMaterial({ color: 0x5c2e0a }); // Darker Brown
            userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'patty', state: INGREDIENT_STATES.COOKED };
            finalName = 'cooked_patty';
            break;
        case 'bun': // Single bun item
            geometry = new THREE.CylinderGeometry(0.14, 0.13, 0.08, 16); // Represents whole bun
            material = new THREE.MeshStandardMaterial({ color: 0xf0d891 }); // Bun color
            userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'bun', state: 'ready' }; // Ready state
            finalName = 'bun';
            break;
        case 'cheese_slice':
            geometry = new THREE.BoxGeometry(0.11, 0.01, 0.11); // Thin square
            material = new THREE.MeshStandardMaterial({ color: 0xffd700 }); // Yellow
            userData = { type: ITEM_TYPES.INGREDIENT, ingredientType: 'cheese_slice', state: 'ready' };
            finalName = 'cheese_slice';
            break;
        // Add chopped versions, patties, buns, cheese here...

        // Non-Ingredient Items
        case 'plate':
            geometry = new THREE.CylinderGeometry(0.15, 0.14, 0.02, 16);
            material = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.1, roughness: 0.5 });
            userData = { type: ITEM_TYPES.ITEM, itemType: 'plate', contents: [], mealName: null };
            break;

        default:
            // Only warn if not handled by preloading either
            if (!templateModel) {
                console.warn("Unknown item type requested:", type);
            }
            return null;
    }

    mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.copy(position || defaultPos);
    mesh.name = finalName; // Use the specific name
    mesh.userData = userData;

    scene.add(mesh);
    addInteractable(mesh); // Register the new item as interactable

    return mesh;
}