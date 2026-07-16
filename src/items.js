// src/items.js
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { ITEM_TYPES, INGREDIENT_STATES, INGREDIENT_RENDER_ORDER } from './constants.js';
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

export function updatePlateVisuals(scene, plate, preloadedModels) {
    if (!plate) return;

    // Clear existing ingredient meshes
    for (let i = plate.children.length - 1; i >= 0; i--) {
        const child = plate.children[i];
        if (child.userData && child.userData.type === ITEM_TYPES.INGREDIENT) {
            plate.remove(child);
            child.traverse(c => { if (c.geometry) c.geometry.dispose(); });
        }
    }

    const contents = plate.userData.contents || [];
    if (contents.length === 0) return;

    let offsetY = 0.05; 
    
    // If it's a completed meal, render the meal mesh instead of stacked ingredients
    if (plate.userData.mealName) {
        const mesh = createItem(scene, plate.userData.mealName, preloadedModels);
        if (mesh) {
            scene.remove(mesh);
            if (typeof mesh.raycast === 'function') mesh.userData.originalRaycast = mesh.raycast;
            mesh.raycast = () => {};
            mesh.position.set(0, offsetY, 0);
            plate.add(mesh);
        }
        return;
    }

    let itemsToDraw = [...contents];
    const bunIndex = itemsToDraw.indexOf('bun');
    
    if (bunIndex !== -1 && contents.length > 1) {
        itemsToDraw.splice(bunIndex, 1, 'bun_bottom', 'bun_top');
    }

    // Sort itemsToDraw based on INGREDIENT_RENDER_ORDER
    itemsToDraw.sort((a, b) => {
        let indexA = INGREDIENT_RENDER_ORDER.indexOf(a);
        let indexB = INGREDIENT_RENDER_ORDER.indexOf(b);
        if (indexA === -1) indexA = 999;
        if (indexB === -1) indexB = 999;
        return indexA - indexB;
    });

    for (const itemName of itemsToDraw) {
        const mesh = createItem(scene, itemName, preloadedModels);
        if (!mesh) continue;
        
        scene.remove(mesh); // It's going to be a child of the plate
        
        if (typeof mesh.raycast === 'function') mesh.userData.originalRaycast = mesh.raycast;
        mesh.raycast = () => {}; // Disable raycast for plate children

        mesh.position.set(0, offsetY, 0);
        
        // Random rotation for natural look, except for buns
        if (!itemName.includes('bun')) {
             mesh.rotation.set(0, Math.random() * Math.PI * 2, 0);
        }

        plate.add(mesh);
        
        // Increment height based on item
        let thickness = 0.05;
        if (itemName === 'bun_bottom') thickness = 0.15;
        if (itemName === 'bun_top') thickness = 0.2;
        if (itemName.includes('patty')) thickness = 0.15;
        if (itemName.includes('cheese') || itemName.includes('lettuce') || itemName.includes('bacon') || itemName.includes('tomato')) thickness = 0.05;
        if (itemName.includes('bread')) thickness = 0.08;

        offsetY += thickness;
    }
}