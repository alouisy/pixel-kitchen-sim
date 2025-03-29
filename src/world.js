// src/world.js
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { COUNTER_HEIGHT, COUNTER_DEPTH, LABEL_Y_OFFSET, STATION_TYPES } from './constants.js';

const interactables = []; // Keep track of items player can interact with
const stations = {};      // References to specific station meshes
const labelSprites = [];

// --- Label Creation ---
function createLabel(text, position, yOffset = LABEL_Y_OFFSET, scale = 1.0) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const fontSize = 40;
    context.font = `Bold ${fontSize}px Arial`;
    const textMetrics = context.measureText(text);
    canvas.width = textMetrics.width + 20;
    canvas.height = fontSize + 10;

    // Re-set font and draw after sizing
    context.font = `Bold ${fontSize}px Arial`;
    context.fillStyle = 'rgba(0, 0, 0, 0.7)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = 'white';
    context.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false }); // Make labels always visible?
    const sprite = new THREE.Sprite(material);
    const aspect = canvas.width / canvas.height;
    sprite.scale.set(scale * aspect * 0.3, scale * 0.3, 1);
    sprite.position.copy(position);
    sprite.position.y += yOffset;
    sprite.renderOrder = 1; // Attempt to render labels on top

    labelSprites.push(sprite); // Keep track of sprites for removal
    return sprite; // Return sprite to be added to scene
}

export function toggleLabels(visible) {
    labelSprites.forEach(sprite => {
        sprite.visible = visible;
    });
    console.log(`Labels set to visible: ${visible}`);
}

// --- Station Creation ---
function createStation(scene, name, x, z, width, depth, height, color, userData) {
    const stationGeo = new THREE.BoxGeometry(width, height, depth);
    const stationMat = new THREE.MeshStandardMaterial({ color: color });
    const stationMesh = new THREE.Mesh(stationGeo, stationMat);
    stationMesh.position.set(x + width / 2, COUNTER_HEIGHT + height / 2, z + depth / 2);
    stationMesh.castShadow = true;
    stationMesh.receiveShadow = true;
    stationMesh.name = name;
    stationMesh.userData = { ...userData, type: 'station' }; // Ensure type is set
    scene.add(stationMesh);
    interactables.push(stationMesh);

    // Add label
    const label = createLabel(name, stationMesh.position, height / 2 + LABEL_Y_OFFSET);
    scene.add(label);

    return stationMesh;
}

// --- Counter Creation ---
function createCounter(scene, x, z, width, depth = COUNTER_DEPTH) {
    const counterGeo = new THREE.BoxGeometry(width, COUNTER_HEIGHT, depth);
    const counterMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.2, roughness: 0.8 });
    const counter = new THREE.Mesh(counterGeo, counterMat);
    counter.position.set(x + width / 2, COUNTER_HEIGHT / 2, z + depth / 2);
    counter.castShadow = true;
    counter.receiveShadow = true;
    scene.add(counter);
    return counter;
}

// --- Build the Kitchen ---
export function buildKitchen(scene) {
    // Floor
    const floorGeometry = new THREE.PlaneGeometry(10, 10);
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.9 }); // Lighter floor
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Back Counter
    createCounter(scene, -4.5, -4.5, 9);

    // Ingredient Bins
    stations.potatoBin = createStation(scene, 'Potatoes', -4, -4.5 + COUNTER_DEPTH, 0.5, 0.5, 0.3, 0xffa500,
        { stationType: STATION_TYPES.INGREDIENT_SOURCE, ingredient: 'potato' });
    stations.lettuceBin = createStation(scene, 'Lettuce', -3, -4.5 + COUNTER_DEPTH, 0.5, 0.5, 0.3, 0x90ee90,
        { stationType: STATION_TYPES.INGREDIENT_SOURCE, ingredient: 'lettuce' });
    stations.tomatoBin = createStation(scene, 'Tomatoes', -2, -4.5 + COUNTER_DEPTH, 0.5, 0.5, 0.3, 0xff6347,
        { stationType: STATION_TYPES.INGREDIENT_SOURCE, ingredient: 'tomato' });
    // Add more bins here...

    stations.pattyBin = createStation(scene, 'Patties', -1, -4.5 + COUNTER_DEPTH, 0.5, 0.5, 0.3, 0x8B4513, // Brown bin
        { stationType: STATION_TYPES.INGREDIENT_SOURCE, ingredient: 'patty' });
    stations.bunRack = createStation(scene, 'Buns', 1, -4.5 + COUNTER_DEPTH, 0.5, 0.5, 0.3, 0xf0d891, // Bun color bin
        { stationType: STATION_TYPES.INGREDIENT_SOURCE, ingredient: 'bun' });
    // Place cheese near plates maybe?
    stations.cheeseFridge = createStation(scene, 'Cheese', 4, -3.5, 0.4, 0.4, 0.6, 0xe0ffff, // Light blue fridge-like box
        { stationType: STATION_TYPES.INGREDIENT_SOURCE, ingredient: 'cheese_slice' });
    // Processing Stations
    stations.cuttingBoard = createStation(scene, 'Cut', 0, -4.5 + COUNTER_DEPTH, 0.6, 0.4, 0.05, 0xdeb887,
        { stationType: STATION_TYPES.PROCESSOR, processes: ['potato', 'tomato', 'lettuce'], result: { potato: 'raw_fries', tomato: 'chopped_tomato', lettuce: 'chopped_lettuce' }, occupiedBy: null });
    stations.fryer = createStation(scene, 'Fry', 2, -4.5 + COUNTER_DEPTH, 0.5, 0.5, 0.4, 0x444444,
        { stationType: STATION_TYPES.PROCESSOR, processes: ['raw_fries'], result: { raw_fries: 'cooked_fries' }, occupiedBy: null, processingTime: 3000 });
    stations.grill = createStation(scene, 'Grill', 3, -4.5 + COUNTER_DEPTH, 0.7, 0.5, 0.1, 0x333333,
        { stationType: STATION_TYPES.PROCESSOR, processes: ['patty'], result: { patty: 'cooked_patty' }, occupiedBy: null, processingTime: 5000 }); // 5 seconds to cook patty

    // Assembly & Serving
    stations.assembly = createStation(scene, 'Assembly', -0.5, -3.5, 1.0, 0.5, 0.02, 0xd3d3d3, // Moved slightly forward
        { stationType: STATION_TYPES.ASSEMBLY, occupiedBy: null });
    const servingCounterMesh = createCounter(scene, -2.5, 3.9, 5, 0.6);
    stations.servingCounter = servingCounterMesh; // Use the mesh itself
    stations.servingCounter.userData = { type: 'station', stationType: STATION_TYPES.SERVING };
    const servingLabelPos = servingCounterMesh.position.clone();
    const servingLabel = createLabel("Serve Here", servingLabelPos, COUNTER_HEIGHT / 2 + LABEL_Y_OFFSET);
    scene.add(servingLabel);

    // Item Sources
    stations.plateStack = createStation(scene, 'Plates', 4, -4.5 + COUNTER_DEPTH, 0.3, 0.3, 0.2, 0xffffff,
        { stationType: STATION_TYPES.ITEM_SOURCE, item: 'plate' });

    // Return references needed by other modules
    return { stations, interactables };
}

// Function to add a newly created item (like an ingredient) to the list
export function addInteractable(item) {
    if (item && !interactables.includes(item)) {
        interactables.push(item);
    }
}

// Function to remove an item (e.g., after serving or processing)
export function removeInteractable(item) {
    const index = interactables.indexOf(item);
    if (index > -1) {
        interactables.splice(index, 1);
        if (item.parent) {
            item.parent.remove(item); // Remove from scene graph
        }
        // Dispose geometry/material if needed for memory management
        // item.geometry?.dispose();
        // item.material?.dispose();
    }
}