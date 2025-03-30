// src/world.js
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { COUNTER_HEIGHT, LABEL_Y_OFFSET, STATION_TYPES } from './constants.js';

// Module-level arrays to track created objects for cleanup
let currentKitchenObjects = []; // Tracks static meshes (stations, counters)
let currentLabels = [];         // Tracks label sprites
let currentFloor = null;        // Tracks the floor mesh

// --- Label Creation ---
function createLabel(scene, text, position, yOffset = LABEL_Y_OFFSET, scale = 1.0) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const fontSize = 40;
    context.font = `Bold ${fontSize}px Arial`;
    const textMetrics = context.measureText(text);
    canvas.width = textMetrics.width + 20;
    canvas.height = fontSize + 10;
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
    sprite.scale.set(scale * aspect * 0.3, scale * 0.3, 1);
    sprite.position.copy(position);
    sprite.position.y += yOffset;
    sprite.renderOrder = 1;

    scene.add(sprite);
    currentLabels.push(sprite); // Add to tracking array
    return sprite;
}

// Toggles visibility of currently tracked labels
export function toggleLabels(visible) {
    currentLabels.forEach(sprite => {
        sprite.visible = visible;
    });
}

// --- Station Creation (Builds one station based on definition) ---
function createStation(scene, definition) {
    const { name, type, position, size, color, config } = definition;
    const stationSize = { width: size?.width ?? 0.5, height: size?.height ?? 0.3, depth: size?.depth ?? 0.5 };
    const stationColor = color ?? 0x808080;

    const stationGeo = new THREE.BoxGeometry(stationSize.width, stationSize.height, stationSize.depth);
    const stationMat = new THREE.MeshStandardMaterial({ color: stationColor });
    const stationMesh = new THREE.Mesh(stationGeo, stationMat);

    // Position Y assumes it sits ON TOP of the standard counter height
    stationMesh.position.set(position.x, COUNTER_HEIGHT + stationSize.height / 2, position.z);
    stationMesh.castShadow = true; stationMesh.receiveShadow = true;
    stationMesh.name = name;
    stationMesh.userData = { ...(config || {}), type: 'station', stationType: type, name: name };

    if (type === STATION_TYPES.ASSEMBLY) {
        stationMesh.userData.slots = [null, null, null];
        stationMesh.userData.slotPositions = [];
        const stationWidth = stationSize.width;
        const stationTopY = stationMesh.position.y + stationSize.height / 2;
        const slotWidth = stationWidth / 3;
        const centerZ = stationMesh.position.z;
        const leftSlotX = stationMesh.position.x - slotWidth;
        const centerSlotX = stationMesh.position.x;
        const rightSlotX = stationMesh.position.x + slotWidth;
        stationMesh.userData.slotPositions.push(new THREE.Vector3(leftSlotX, stationTopY, centerZ));
        stationMesh.userData.slotPositions.push(new THREE.Vector3(centerSlotX, stationTopY, centerZ));
        stationMesh.userData.slotPositions.push(new THREE.Vector3(rightSlotX, stationTopY, centerZ));

        // Add Visual Dividers
        const dividerHeight = 0.01; const dividerDepth = stationSize.depth * 0.95;
        const dividerMat = new THREE.MeshBasicMaterial({ color: 0x555555, side: THREE.DoubleSide });
        const dividerGeo1 = new THREE.BoxGeometry(0.01, dividerHeight, dividerDepth);
        const divider1 = new THREE.Mesh(dividerGeo1, dividerMat);
        divider1.position.set(stationMesh.position.x - slotWidth / 2, stationTopY + dividerHeight / 2, centerZ);
        stationMesh.add(divider1);
        const dividerGeo2 = new THREE.BoxGeometry(0.01, dividerHeight, dividerDepth);
        const divider2 = new THREE.Mesh(dividerGeo2, dividerMat);
        divider2.position.set(stationMesh.position.x + slotWidth / 2, stationTopY + dividerHeight / 2, centerZ);
        stationMesh.add(divider2);
    } else if (type === STATION_TYPES.PROCESSOR) {
        stationMesh.userData.occupiedBy = null;
    }

    scene.add(stationMesh);
    currentKitchenObjects.push(stationMesh); // Track static station mesh
    createLabel(scene, name, stationMesh.position, stationSize.height / 2 + LABEL_Y_OFFSET);
    return stationMesh;
}

// --- Counter Creation (Builds one counter based on definition) ---
function createCounter(scene, definition) {
    const { name, position, size, isServing } = definition;
    const counterSize = { width: size?.width ?? 4, height: size?.height ?? COUNTER_HEIGHT, depth: size?.depth ?? 0.6 };
    const counterGeo = new THREE.BoxGeometry(counterSize.width, counterSize.height, counterSize.depth);
    const counterMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.2, roughness: 0.8 });
    const counter = new THREE.Mesh(counterGeo, counterMat);

    counter.position.set(position.x, counterSize.height / 2, position.z);
    counter.castShadow = true; counter.receiveShadow = true;
    counter.name = name;

    if (isServing) {
        counter.userData = { type: 'station', stationType: STATION_TYPES.SERVING, name: name };
        createLabel(scene, "Serve Here", counter.position, counterSize.height / 2 + LABEL_Y_OFFSET);
    } else {
        counter.userData = { type: STATION_TYPES.COUNTER };
    }

    scene.add(counter);
    currentKitchenObjects.push(counter); // Track static counter mesh
    return counter;
}

// --- Clear Kitchen Function ---
export function clearKitchen(scene) {
    console.log("Clearing existing kitchen objects...");
    currentKitchenObjects.forEach(obj => {
        if (obj.parent) obj.parent.remove(obj);
        obj.geometry?.dispose();
        // Only dispose material if known to be unique, otherwise skip
        // obj.material?.dispose();
    });
    currentLabels.forEach(label => {
        if (label.parent) label.parent.remove(label);
        label.material.map?.dispose();
        label.material?.dispose();
    });
    if (currentFloor?.parent) {
        currentFloor.parent.remove(currentFloor);
        currentFloor.geometry?.dispose();
        // currentFloor.material?.dispose();
    }
    currentKitchenObjects = []; currentLabels = []; currentFloor = null;
    console.log("Kitchen cleared.");
}


// --- Build the Kitchen (Dynamic) ---
export function buildKitchen(scene, levelLayout) {
    console.log("Building kitchen for level layout...");
    if (!levelLayout || !Array.isArray(levelLayout)) {
        console.error("Invalid levelLayout data provided to buildKitchen.");
        return { stations: {}, stationInteractables: [], floorMesh: null };
    }
    if (currentKitchenObjects.length > 0 || currentLabels.length > 0 || currentFloor) {
        console.warn("buildKitchen called while previous objects exist. Clearing now.");
        clearKitchen(scene);
    }

    const newStations = {}; // Holds functional stations by name
    const newStationInteractables = []; // Holds station meshes that player interacts with

    // --- Build Floor ---
    const floorGeometry = new THREE.PlaneGeometry(10, 10);
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.9 });
    currentFloor = new THREE.Mesh(floorGeometry, floorMaterial);
    currentFloor.rotation.x = -Math.PI / 2; currentFloor.receiveShadow = true;
    currentFloor.name = "Floor"; currentFloor.userData = { type: STATION_TYPES.FLOOR };
    scene.add(currentFloor);

    // --- Build from Layout Data ---
    levelLayout.forEach(definition => {
        try {
            if (definition.type === STATION_TYPES.COUNTER) {
                const counterMesh = createCounter(scene, definition);
                if (definition.isServing) {
                    newStations[definition.name] = counterMesh;
                    newStationInteractables.push(counterMesh);
                }
            }
            // Check for functional station types (excluding structural types)
            else if (definition.type && definition.type !== STATION_TYPES.COUNTER && definition.type !== STATION_TYPES.FLOOR && definition.type !== STATION_TYPES.WALL) {
                const stationMesh = createStation(scene, definition);
                newStations[definition.name] = stationMesh;
                newStationInteractables.push(stationMesh);
            }
        } catch (error) {
            console.error(`Error creating kitchen object "${definition.name}" (type: ${definition.type}):`, error);
        }
    });

    console.log(`Kitchen built. ${Object.keys(newStations).length} functional stations created.`);
    return { stations: newStations, stationInteractables: newStationInteractables, floorMesh: currentFloor };
}


// --- Dynamic Item Management Helpers (Not used directly by world.js anymore) ---
// These functions are conceptually replaced by InteractionManager's internal helpers
// export function addInteractableToList(item, list) { /* ... */ }
// export function removeInteractableFromList(item, list) { /* ... */ }

// --- getAssemblySlotIndex (Keep as is) ---
export function getAssemblySlotIndex(station, worldX) {
    if (!station?.geometry?.parameters?.width) return 1;
    const stationX = station.position.x;
    const stationWidth = station.geometry.parameters.width;
    const slotWidth = stationWidth / 3;
    const relativeX = worldX - stationX;
    if (relativeX < -slotWidth / 2) return 0;
    if (relativeX > slotWidth / 2) return 2;
    return 1;
}