// src/world.js
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { LABEL_Y_OFFSET, STATION_TYPES } from './constants.js'; // Removed COUNTER_HEIGHT import

// Module-level arrays to track created objects for cleanup
let currentKitchenObjects = []; // Tracks static meshes (stations, counters, decorations)
let currentLabels = [];         // Tracks label sprites
let currentFloor = null;        // Tracks the floor mesh

// --- Label Creation ---
function createLabel(scene, text, position, yOffset = LABEL_Y_OFFSET, scale = 1.0) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const fontSize = 40;
    context.font = `Bold ${fontSize}px Arial`;
    const textMetrics = context.measureText(text);
    canvas.width = textMetrics.width + 20; // Add padding
    canvas.height = fontSize + 10; // Add padding
    // Re-set font after resizing canvas
    context.font = `Bold ${fontSize}px Arial`;
    context.fillStyle = 'rgba(0, 0, 0, 0.7)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = 'white';
    context.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    // Ensure crisp rendering
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;

    const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false, // Render on top of other objects
        depthWrite: false
    });
    const sprite = new THREE.Sprite(material);
    const aspect = canvas.width / canvas.height;
    sprite.scale.set(scale * aspect * 0.3, scale * 0.3, 1); // Adjust scale as needed
    sprite.position.copy(position);
    sprite.position.y += yOffset; // Use provided offset
    sprite.renderOrder = 1; // Ensure labels render on top

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

// --- Station Creation (Builds one functional station) ---
export function createStation(scene, definition) {
    const { name, type, position, size, color, config, yOffset = 0 } = definition; // Use yOffset from definition
    const stationSize = { width: size?.width ?? 0.5, height: size?.height ?? 0.3, depth: size?.depth ?? 0.5 };
    const stationColor = color ?? 0x808080;

    const stationGeo = new THREE.BoxGeometry(stationSize.width, stationSize.height, stationSize.depth);
    const stationMat = new THREE.MeshStandardMaterial({ color: stationColor, roughness: 0.7, metalness: 0.2 });
    const stationMesh = new THREE.Mesh(stationGeo, stationMat);

    // Position Y based on the provided yOffset (height of the surface it sits on) + half its own height
    stationMesh.position.set(position.x, yOffset + stationSize.height / 2, position.z);
    stationMesh.castShadow = true; stationMesh.receiveShadow = true;
    stationMesh.name = name;
    // Copy config into userData, adding type info
    stationMesh.userData = { ...(config || {}), type: 'station', stationType: type, name: name };

    // Initialize specific userData based on type
    if (type === STATION_TYPES.ASSEMBLY) {
        stationMesh.userData.slots = [null, null, null];
        stationMesh.userData.slotPositions = [];
        const stationWidth = stationSize.width;
        // Calculate slot positions relative to the station's *actual* placed position
        const stationTopY = stationMesh.position.y + stationSize.height / 2;
        const slotWidth = stationWidth / 3;
        const centerZ = stationMesh.position.z; // Use station's Z
        const leftSlotX = stationMesh.position.x - slotWidth;
        const centerSlotX = stationMesh.position.x;
        const rightSlotX = stationMesh.position.x + slotWidth;
        stationMesh.userData.slotPositions.push(new THREE.Vector3(leftSlotX, stationTopY, centerZ));
        stationMesh.userData.slotPositions.push(new THREE.Vector3(centerSlotX, stationTopY, centerZ));
        stationMesh.userData.slotPositions.push(new THREE.Vector3(rightSlotX, stationTopY, centerZ));

        // Add Visual Dividers (relative to station mesh)
        const dividerHeight = 0.01; const dividerDepth = stationSize.depth * 0.95;
        const dividerMat = new THREE.MeshBasicMaterial({ color: 0x555555, side: THREE.DoubleSide });
        const dividerGeo1 = new THREE.BoxGeometry(0.01, dividerHeight, dividerDepth);
        const divider1 = new THREE.Mesh(dividerGeo1, dividerMat);
        // Position dividers relative to the station's center (0,0,0 in local space)
        divider1.position.set(-slotWidth / 2, stationSize.height / 2 + dividerHeight / 2, 0);
        stationMesh.add(divider1); // Add as child
        const dividerGeo2 = new THREE.BoxGeometry(0.01, dividerHeight, dividerDepth);
        const divider2 = new THREE.Mesh(dividerGeo2, dividerMat);
        divider2.position.set(slotWidth / 2, stationSize.height / 2 + dividerHeight / 2, 0);
        stationMesh.add(divider2); // Add as child

    } else if (type === STATION_TYPES.PROCESSOR) {
        stationMesh.userData.occupiedBy = null;
        if (stationMesh.userData.requiredIngredients) {
            stationMesh.userData.internalContents = [];
        }
    }

    scene.add(stationMesh);
    currentKitchenObjects.push(stationMesh); // Track functional station mesh
    // Create label slightly above the station
    createLabel(scene, name, stationMesh.position, stationSize.height / 2 + LABEL_Y_OFFSET);
    return stationMesh;
}

// --- Counter Creation (Builds one counter base) ---
export function createCounter(scene, definition) {
    const { name, position, size, color, isServing } = definition;
    // Use provided height, default to 0.85 for base
    const counterSize = { width: size?.width ?? 4, height: size?.height ?? 0.85, depth: size?.depth ?? 0.6 };
    const counterColor = color ?? '#B8860B'; // Default to base color

    const counterGeo = new THREE.BoxGeometry(counterSize.width, counterSize.height, counterSize.depth);
    const counterMat = new THREE.MeshStandardMaterial({ color: counterColor, roughness: 0.8, metalness: 0.1 });
    const counter = new THREE.Mesh(counterGeo, counterMat);

    // Position base on the floor
    counter.position.set(position.x, counterSize.height / 2, position.z);
    counter.castShadow = true; counter.receiveShadow = true;
    counter.name = name;

    if (isServing) {
        // Mark as serving station, but it's primarily the base structure
        counter.userData = { type: 'station', stationType: STATION_TYPES.SERVING, name: name, isBase: true };
        // Label the serving counter area (position slightly higher)
        const labelPos = counter.position.clone();
        labelPos.y = counterSize.height + 0.05 + LABEL_Y_OFFSET; // Position above where countertop would be
        createLabel(scene, "Serve Here", labelPos);
    } else {
        // Just a structural counter base
        counter.userData = { type: STATION_TYPES.COUNTER, isBase: true };
    }

    scene.add(counter);
    currentKitchenObjects.push(counter); // Track counter base mesh
    return counter;
}

// --- Decoration Creation (Builds non-interactive elements) ---
export function createDecoration(scene, definition) {
    const { name, position, size, color, yOffset = 0 } = definition;
    const decoSize = { width: size?.width ?? 1, height: size?.height ?? 1, depth: size?.depth ?? 1 };
    const decoColor = color ?? 0x666666;

    const decoGeo = new THREE.BoxGeometry(decoSize.width, decoSize.height, decoSize.depth);
    const decoMat = new THREE.MeshStandardMaterial({ color: decoColor, roughness: 0.9, metalness: 0.1 });
    const decoMesh = new THREE.Mesh(decoGeo, decoMat);

    // Position based on definition, using yOffset correctly
    decoMesh.position.set(position.x, yOffset + decoSize.height / 2, position.z);
    decoMesh.castShadow = true; decoMesh.receiveShadow = true;
    decoMesh.name = name;
    decoMesh.userData = { type: 'decoration' }; // Mark as decoration

    scene.add(decoMesh);
    currentKitchenObjects.push(decoMesh); // Track decoration mesh for cleanup
    return decoMesh;
}

// --- NEW: Wall Creation (Basic Wall) ---
export function createWall(scene, definition) {
    const { name, position, size, color, yOffset = 0 } = definition;
    const wallSize = { width: size?.width ?? 1, height: size?.height ?? 2.5, depth: size?.depth ?? 0.2 }; // Default wall size
    const wallColor = color ?? '#8B4513'; // Default brown color for walls

    const wallGeo = new THREE.BoxGeometry(wallSize.width, wallSize.height, wallSize.depth);
    const wallMat = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.8, metalness: 0 });
    const wallMesh = new THREE.Mesh(wallGeo, wallMat);

    // Position wall - Y offset is from the floor
    wallMesh.position.set(position.x, yOffset + wallSize.height / 2, position.z);
    wallMesh.castShadow = true; wallMesh.receiveShadow = true;
    wallMesh.name = name;
    wallMesh.userData = { type: 'wall' }; // Mark as wall

    scene.add(wallMesh);
    currentKitchenObjects.push(wallMesh); // Track wall mesh for cleanup
    return wallMesh;
}


// --- Clear Kitchen Function ---
export function clearKitchen(scene) {
    console.log("Clearing existing kitchen objects...");
    currentKitchenObjects.forEach(obj => {
        if (obj.parent) obj.parent.remove(obj);
        // Clean up children (like assembly dividers)
        obj.traverse(child => {
            if (child instanceof THREE.Mesh) {
                child.geometry?.dispose();
                // Dispose material cautiously - only if not shared/default
                // if (child.material && !isSharedMaterial(child.material)) {
                //     child.material.dispose();
                // }
            }
        });
        obj.geometry?.dispose();
        // obj.material?.dispose(); // Cautious disposal
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
    // Simple checkerboard pattern
    const floorCanvas = document.createElement('canvas');
    floorCanvas.width = 128;
    floorCanvas.height = 128;
    const context = floorCanvas.getContext('2d');
    const size = 64;
    context.fillStyle = '#AAAAAA'; // Light grey
    context.fillRect(0, 0, 128, 128);
    context.fillStyle = '#BBBBBB'; // Slightly lighter grey
    context.fillRect(0, 0, size, size);
    context.fillRect(size, size, size, size);
    const floorTexture = new THREE.CanvasTexture(floorCanvas);
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(10 / (size / 64), 10 / (size / 64)); // Adjust repeat based on tile size
    floorTexture.magFilter = THREE.NearestFilter; // Pixelated look

    const floorMaterial = new THREE.MeshStandardMaterial({ map: floorTexture, roughness: 0.9 });
    currentFloor = new THREE.Mesh(floorGeometry, floorMaterial);
    currentFloor.rotation.x = -Math.PI / 2; currentFloor.receiveShadow = true;
    currentFloor.name = "Floor"; currentFloor.userData = { type: STATION_TYPES.FLOOR };
    scene.add(currentFloor);

    // --- Build from Layout Data ---
    levelLayout.forEach(definition => {
        try {
            switch (definition.type) {
                case STATION_TYPES.COUNTER:
                    const counterMesh = createCounter(scene, definition);
                    // If the counter itself is the serving station, add it
                    if (definition.isServing) {
                        newStations[definition.name] = counterMesh;
                        newStationInteractables.push(counterMesh);
                    }
                    break;
                case 'decoration': // Handle new decoration type
                    createDecoration(scene, definition);
                    break;
                case STATION_TYPES.FLOOR: // Ignore floor definitions here, handled above
                case STATION_TYPES.WALL: // Ignore wall definitions for now
                    break;
                default: // Assume it's a functional station
                    // Check if it's a known functional type before creating
                    if (Object.values(STATION_TYPES).includes(definition.type)) {
                        const stationMesh = createStation(scene, definition);
                        newStations[definition.name] = stationMesh;
                        newStationInteractables.push(stationMesh);
                    } else {
                        console.warn(`Unknown layout type encountered: ${definition.type} for ${definition.name}`);
                    }
                    break;
            }
        } catch (error) {
            console.error(`Error creating kitchen object "${definition.name}" (type: ${definition.type}):`, error);
        }
    });

    console.log(`Kitchen built. ${Object.keys(newStations).length} functional stations created.`);
    return { stations: newStations, stationInteractables: newStationInteractables, floorMesh: currentFloor };
}


// --- getAssemblySlotIndex (Keep as is) ---
export function getAssemblySlotIndex(station, worldX) {
    // Use actual geometry size if available, fallback to userData if needed
    let stationWidth = station.geometry?.parameters?.width;
    if (!stationWidth && station.userData?.size?.width) {
        stationWidth = station.userData.size.width;
    }
    if (!stationWidth) return 1; // Fallback

    const stationX = station.position.x;
    const slotWidth = stationWidth / 3;
    const relativeX = worldX - stationX;

    if (relativeX < -slotWidth / 2) return 0; // Left slot
    if (relativeX > slotWidth / 2) return 2;  // Right slot
    return 1; // Center slot
}