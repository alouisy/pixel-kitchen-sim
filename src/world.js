// src/world.js
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { COUNTER_HEIGHT, COUNTER_DEPTH, LABEL_Y_OFFSET, STATION_TYPES } from './constants.js';

const interactables = []; // Keep track of items player can interact with
const stations = {};      // References to specific station meshes
const labelSprites = [];
let floorMesh = null; // Reference to the floor mesh

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

    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    const aspect = canvas.width / canvas.height;
    sprite.scale.set(scale * aspect * 0.15, scale * 0.15, 1);
    sprite.position.copy(position);
    sprite.position.y += yOffset;
    sprite.renderOrder = 1;

    labelSprites.push(sprite);
    return sprite;
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
    stationMesh.position.set(x, COUNTER_HEIGHT + height / 2, z);
    stationMesh.castShadow = true;
    stationMesh.receiveShadow = true;
    stationMesh.name = name;
    stationMesh.userData = { ...userData, type: 'station', name: name };

    // --- Special setup for Assembly station ---
    if (userData.stationType === STATION_TYPES.ASSEMBLY) {
        stationMesh.userData.slots = [null, null, null]; // [left, center, right] - holds item mesh or null
        stationMesh.userData.slotPositions = []; // Holds Vector3 positions for each slot center

        const stationWidth = width;
        const stationDepth = depth;
        const stationTopY = stationMesh.position.y + height / 2;
        const slotWidth = stationWidth / 3;

        // Calculate center positions for each slot
        const centerZ = stationMesh.position.z; // Assume items centered depth-wise
        const leftSlotX = stationMesh.position.x - slotWidth;
        const centerSlotX = stationMesh.position.x;
        const rightSlotX = stationMesh.position.x + slotWidth;

        stationMesh.userData.slotPositions.push(new THREE.Vector3(leftSlotX, stationTopY, centerZ));
        stationMesh.userData.slotPositions.push(new THREE.Vector3(centerSlotX, stationTopY, centerZ));
        stationMesh.userData.slotPositions.push(new THREE.Vector3(rightSlotX, stationTopY, centerZ));

        // --- Add Visual Dividers (Optional) ---
        const dividerHeight = 0.01; // Slightly above surface
        const dividerDepth = stationDepth * 0.95; // Slightly shorter than station depth
        const dividerMat = new THREE.MeshBasicMaterial({ color: 0x555555, side: THREE.DoubleSide });

        // Divider 1 (between left and center)
        const dividerGeo1 = new THREE.BoxGeometry(0.01, dividerHeight, dividerDepth);
        const divider1 = new THREE.Mesh(dividerGeo1, dividerMat);
        divider1.position.set(stationMesh.position.x - slotWidth / 2, stationTopY + dividerHeight / 2, centerZ);
        stationMesh.add(divider1); // Add as child of station

        // Divider 2 (between center and right)
        const dividerGeo2 = new THREE.BoxGeometry(0.01, dividerHeight, dividerDepth);
        const divider2 = new THREE.Mesh(dividerGeo2, dividerMat);
        divider2.position.set(stationMesh.position.x + slotWidth / 2, stationTopY + dividerHeight / 2, centerZ);
        stationMesh.add(divider2); // Add as child of station
        // --- End Visual Dividers ---

    } else if (userData.stationType === STATION_TYPES.PROCESSOR) {
        stationMesh.userData.occupiedBy = null;
    }

    scene.add(stationMesh);
    interactables.push(stationMesh); // Station itself is interactable

    const label = createLabel(name, stationMesh.position, height / 2 + LABEL_Y_OFFSET);
    scene.add(label);

    return stationMesh;
}

// --- Counter Creation ---
function createCounter(scene, x, z, width, depth = COUNTER_DEPTH) {
    const counterGeo = new THREE.BoxGeometry(width, COUNTER_HEIGHT, depth);
    const counterMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.2, roughness: 0.8 });
    const counter = new THREE.Mesh(counterGeo, counterMat);
    counter.position.set(x, COUNTER_HEIGHT / 2, z);
    counter.castShadow = true;
    counter.receiveShadow = true;
    scene.add(counter);
    return counter;
}

// --- Build the Kitchen ---
export function buildKitchen(scene) {
    // Floor
    const floorGeometry = new THREE.PlaneGeometry(10, 10);
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.9 });
    floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    floorMesh.name = "Floor";
    floorMesh.userData = { type: STATION_TYPES.FLOOR };
    scene.add(floorMesh);

    // Back Counter
    createCounter(scene, 0, -4.5 + COUNTER_DEPTH / 2, 9);
    const backCounterZ = -4.5 + COUNTER_DEPTH;

    // Ingredient Bins
    stations.potatoBin = createStation(scene, 'Potatoes', -3.75, backCounterZ, 0.5, 0.5, 0.3, 0xffa500,
        { stationType: STATION_TYPES.INGREDIENT_SOURCE, ingredient: 'potato' });
    stations.lettuceBin = createStation(scene, 'Lettuce', -2.75, backCounterZ, 0.5, 0.5, 0.3, 0x90ee90,
        { stationType: STATION_TYPES.INGREDIENT_SOURCE, ingredient: 'lettuce' });
    stations.tomatoBin = createStation(scene, 'Tomatoes', -1.75, backCounterZ, 0.5, 0.5, 0.3, 0xff6347,
        { stationType: STATION_TYPES.INGREDIENT_SOURCE, ingredient: 'tomato' });
    stations.pattyBin = createStation(scene, 'Patties', -0.75, backCounterZ, 0.5, 0.5, 0.3, 0x8B4513,
        { stationType: STATION_TYPES.INGREDIENT_SOURCE, ingredient: 'patty' });
    stations.bunRack = createStation(scene, 'Buns', 0.75, backCounterZ, 0.5, 0.5, 0.3, 0xf0d891,
        { stationType: STATION_TYPES.INGREDIENT_SOURCE, ingredient: 'bun' });

    // Processing Stations
    stations.cuttingBoard = createStation(scene, 'Cut', 0, backCounterZ, 0.6, 0.4, 0.05, 0xdeb887,
        { stationType: STATION_TYPES.PROCESSOR, processes: ['potato', 'tomato', 'lettuce'], result: { potato: 'raw_fries', tomato: 'chopped_tomato', lettuce: 'chopped_lettuce' } });
    stations.fryer = createStation(scene, 'Fry', 2.25, backCounterZ, 0.5, 0.5, 0.4, 0x444444,
        { stationType: STATION_TYPES.PROCESSOR, processes: ['raw_fries'], result: { raw_fries: 'cooked_fries' }, processingTime: 3000 });
    stations.grill = createStation(scene, 'Grill', 3.25, backCounterZ, 0.7, 0.5, 0.1, 0x333333,
        { stationType: STATION_TYPES.PROCESSOR, processes: ['patty'], result: { patty: 'cooked_patty' }, processingTime: 5000 });

    // Item Sources
    stations.plateStack = createStation(scene, 'Plates', 4.1, backCounterZ, 0.3, 0.3, 0.2, 0xffffff,
        { stationType: STATION_TYPES.ITEM_SOURCE, item: 'plate' });
    stations.cheeseFridge = createStation(scene, 'Cheese', 4.1, backCounterZ - 0.8, 0.4, 0.4, 0.6, 0xe0ffff,
        { stationType: STATION_TYPES.INGREDIENT_SOURCE, ingredient: 'cheese_slice' });

    // Assembly Station (Wider for 3 slots)
    const assemblyWidth = 1.8; // Increased width
    stations.assembly = createStation(scene, 'Assembly', 0, -1.5, assemblyWidth, 0.8, 0.05, 0xd3d3d3,
        { stationType: STATION_TYPES.ASSEMBLY }); // slots and slotPositions added in createStation

    // Serving Counter
    const servingCounterMesh = createCounter(scene, 0, 3.9 + COUNTER_DEPTH / 2, 5);
    stations.servingCounter = servingCounterMesh;
    stations.servingCounter.name = "Serving Counter";
    stations.servingCounter.userData = { type: 'station', stationType: STATION_TYPES.SERVING, name: "Serving Counter" };
    const servingLabelPos = servingCounterMesh.position.clone();
    const servingLabel = createLabel("Serve Here", servingLabelPos, COUNTER_HEIGHT / 2 + LABEL_Y_OFFSET);
    scene.add(servingLabel);

    return { stations, interactables, floorMesh };
}

// Function to add a newly created item to the list
// NOW ACCEPTS SCENE ARGUMENT
export function addInteractable(item, scene) {
    if (!item || !scene) { // Added null check for scene
        console.warn("addInteractable called with null item or scene");
        return;
    }
    if (!interactables.includes(item)) {
        if (!item.name) {
            item.name = item.userData?.type + "_" + item.id;
        }
        // Simplified check: Add if not already interactable, unless it's a child of a plate
        // (More complex parenting rules might need adjustments here)
        const isChildOfPlate = item.parent?.userData?.itemType === 'plate';

        if (!isChildOfPlate) {
            interactables.push(item);
            // console.log("Added Interactable:", item.name, item.id);
        } else {
            // console.log("Skipped adding child item to interactables:", item.name);
        }
    }
}


// Function to remove an item
export function removeInteractable(item) {
    const index = interactables.indexOf(item);
    if (index > -1) {
        interactables.splice(index, 1);
        // console.log("Removed Interactable:", item.name, item.id);
    }
    // Always try to remove from scene graph if it has a parent
    if (item.parent) {
        item.parent.remove(item);
    }
}

// Helper to get the slot index based on world X coordinate
export function getAssemblySlotIndex(station, worldX) {
    const stationX = station.position.x;
    const stationWidth = station.geometry.parameters.width;
    const slotWidth = stationWidth / 3;
    const relativeX = worldX - stationX; // X relative to station center

    if (relativeX < -slotWidth / 2) {
        return 0; // Left slot
    } else if (relativeX > slotWidth / 2) {
        return 2; // Right slot
    } else {
        return 1; // Center slot
    }
}