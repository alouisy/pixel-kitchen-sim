// src/world.js
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { LABEL_Y_OFFSET, STATION_TYPES, GRID_UNIT, COUNTER_HEIGHT } from './constants.js';
import { GridSystem } from './grid.js';

let currentKitchenObjects = [];
let currentLabels = [];
let currentFloor = null;

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
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;

    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    const aspect = canvas.width / canvas.height;
    sprite.scale.set(scale * aspect * 0.3, scale * 0.3, 1);
    sprite.position.copy(position);
    sprite.position.y += yOffset;
    sprite.renderOrder = 1;

    scene.add(sprite);
    currentLabels.push(sprite);
    return sprite;
}

export function toggleLabels(visible) {
    currentLabels.forEach(sprite => sprite.visible = visible);
}

function createMesh(size, color) {
    const geo = new THREE.BoxGeometry(size.width, size.height, size.depth);
    const mat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.7, metalness: 0.1 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

// --- Counter Creation ---
function createCounter(scene, definition) {
    const { name, position, size, color, isServing } = definition;
    // Snap dimensions to Grid Unit multiples
    const width = Math.round(size?.width / GRID_UNIT) * GRID_UNIT || 2;
    const depth = Math.round(size?.depth / GRID_UNIT) * GRID_UNIT || 1;
    const height = size?.height ?? COUNTER_HEIGHT;

    const counterSize = { width, height, depth };
    
    const counterMesh = createMesh(counterSize, color ?? '#B8860B');
    counterMesh.name = name;
    counterMesh.position.set(position.x, height / 2, position.z);
    
    counterMesh.userData = { 
        type: isServing ? 'station' : 'counter', 
        stationType: isServing ? STATION_TYPES.SERVING : STATION_TYPES.COUNTER,
        name: name,
        isBase: true,
        size: counterSize,
        originalColor: color
    };

    // *** Attach Grid to Counter Top ***
    // Grid center is world position of counter. Dimensions match counter top.
    counterMesh.userData.grid = new GridSystem(width, depth, position.x, position.z, counterMesh);

    if (isServing) {
        const label = createLabel(scene, "Serve Here", new THREE.Vector3(position.x, height + 0.5, position.z));
        counterMesh.userData.labelRef = label;
    }

    scene.add(counterMesh);
    currentKitchenObjects.push(counterMesh);
    return counterMesh;
}

// --- Station Creation (Items placed on grids) ---
function createStation(scene, definition) {
    const { name, type, position, size, color, config } = definition;
    const stationSize = { 
        width: Math.round((size?.width ?? 0.5) / GRID_UNIT) * GRID_UNIT, 
        height: size?.height ?? 0.3, 
        depth: Math.round((size?.depth ?? 0.5) / GRID_UNIT) * GRID_UNIT 
    };
    if(stationSize.width < GRID_UNIT) stationSize.width = GRID_UNIT;
    if(stationSize.depth < GRID_UNIT) stationSize.depth = GRID_UNIT;

    const stationMesh = createMesh(stationSize, color ?? 0x808080);
    stationMesh.name = name;
    // Store config and type
    stationMesh.userData = { ...(config || {}), type: 'station', stationType: type, name: name, size: stationSize, originalColor: color };

    // Initial Position logic is now tricky because we should respect the grid.
    // However, levels.json defines World Positions. We will place it there visually, 
    // but we SHOULD register it to the underlying grid if one exists.
    // For initialization, we usually don't have the grid references fully linked until build is done.
    // So we place it visually. The InteractionManager doesn't strictly require it to be registered 
    // for initial interaction, but it helps.
    // For now, place visually based on level data.
    
    // Logic to find yOffset based on what's underneath would be complex here. 
    // We rely on `yOffset` provided or assume standard counter height.
    const yPos = (definition.yOffset ?? COUNTER_HEIGHT) + stationSize.height / 2;
    stationMesh.position.set(position.x, yPos, position.z);

    // Specific Station Visuals
    if (type === STATION_TYPES.ASSEMBLY) {
        stationMesh.userData.slots = [null, null, null];
        // Legacy slot logic for mouse interaction if needed, though we move to Grid logic mostly
        const slotWidth = stationSize.width / 3;
        const divH = 0.02; const divD = stationSize.depth * 0.9;
        const divGeo = new THREE.BoxGeometry(0.02, divH, divD);
        const divMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const d1 = new THREE.Mesh(divGeo, divMat);
        d1.position.set(-slotWidth / 2, stationSize.height/2 + divH/2, 0);
        stationMesh.add(d1);
        const d2 = new THREE.Mesh(divGeo, divMat);
        d2.position.set(slotWidth / 2, stationSize.height/2 + divH/2, 0);
        stationMesh.add(d2);
    } 
    else if (type === STATION_TYPES.PROCESSOR) {
        stationMesh.userData.occupiedBy = null;
        if (stationMesh.userData.requiredIngredients) stationMesh.userData.internalContents = [];
        if (name.toLowerCase().includes('fryer')) {
            const vatGeo = new THREE.BoxGeometry(stationSize.width * 0.8, 0.1, stationSize.depth * 0.8);
            const vatMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
            const vat = new THREE.Mesh(vatGeo, vatMat);
            vat.position.y = stationSize.height / 2 + 0.05; 
            stationMesh.add(vat);
        }
    }

    scene.add(stationMesh);
    currentKitchenObjects.push(stationMesh);
    
    const label = createLabel(scene, name, stationMesh.position, stationSize.height/2 + LABEL_Y_OFFSET);
    stationMesh.userData.labelRef = label;

    return stationMesh;
}

function createDecoration(scene, definition) {
    const { name, position, size, color, yOffset = 0 } = definition;
    const decoSize = { width: size?.width ?? 1, height: size?.height ?? 1, depth: size?.depth ?? 1 };
    
    const mesh = createMesh(decoSize, color ?? 0x666666);
    mesh.name = name;
    mesh.position.set(position.x, yOffset + decoSize.height / 2, position.z);
    mesh.userData = { type: 'decoration', size: decoSize, originalColor: color, name: name };

    scene.add(mesh);
    currentKitchenObjects.push(mesh);
    return mesh;
}

export function clearKitchen(scene) {
    currentKitchenObjects.forEach(obj => {
        if (obj.userData.labelRef) {
            const label = obj.userData.labelRef;
            if (label.parent) label.parent.remove(label);
            label.material.map.dispose();
            label.material.dispose();
        }
        scene.remove(obj);
        obj.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                else child.material.dispose();
            }
        });
    });
    currentKitchenObjects = [];
    currentLabels = [];
    
    if (currentFloor) {
        scene.remove(currentFloor);
        currentFloor.geometry.dispose();
        currentFloor.material.map?.dispose();
        currentFloor.material.dispose();
        currentFloor = null;
    }
}

export function buildKitchen(scene, levelLayout) {
    clearKitchen(scene);

    const newStations = {};
    const newStationInteractables = [];

    // 1. Create Floor with a Grid
    const floorSize = 20; // 20x20 meters
    const floorGeo = new THREE.PlaneGeometry(floorSize, floorSize);
    
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#AAAAAA'; ctx.fillRect(0,0,128,128);
    ctx.fillStyle = '#BBBBBB'; ctx.fillRect(0,0,64,64); ctx.fillRect(64,64,64,64);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(floorSize, floorSize); tex.magFilter = THREE.NearestFilter;
    
    const floorMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
    currentFloor = new THREE.Mesh(floorGeo, floorMat);
    currentFloor.rotation.x = -Math.PI / 2; 
    currentFloor.receiveShadow = true;
    currentFloor.name = "Floor";
    
    // Attach Grid to Floor
    // Center is 0,0. Width/Depth = floorSize.
    currentFloor.userData = { 
        type: STATION_TYPES.FLOOR,
        grid: new GridSystem(floorSize, floorSize, 0, 0, currentFloor) 
    };
    scene.add(currentFloor);

    // 2. Build Layout
    // We build counters first so stations can logically sit on them later if we wanted to auto-snap
    levelLayout.forEach(def => {
        try {
            if (def.type === STATION_TYPES.COUNTER) {
                const mesh = createCounter(scene, def);
                // Counters are surfaces. They are added to interactables so we can place things ON them.
                // But we also add them to stations map for reference.
                newStations[def.name] = mesh; 
                newStationInteractables.push(mesh); 
                
                // Register Counter on Floor Grid?
                // Ideally yes, to prevent placing things inside counters.
                // Calculating grid pos from world pos:
                const gridCoords = currentFloor.userData.grid.worldToGrid(mesh.position);
                const wSlots = Math.round(mesh.geometry.parameters.width / GRID_UNIT);
                const dSlots = Math.round(mesh.geometry.parameters.depth / GRID_UNIT);
                // Need to offset center to top-left for occupancy
                const startCol = gridCoords.col - Math.floor(wSlots/2);
                const startRow = gridCoords.row - Math.floor(dSlots/2);
                currentFloor.userData.grid.occupy(startCol, startRow, wSlots, dSlots, mesh);

            } else if (def.type === 'decoration') {
                createDecoration(scene, def);
            } else if (Object.values(STATION_TYPES).includes(def.type) && def.type !== STATION_TYPES.FLOOR) {
                const mesh = createStation(scene, def);
                newStations[def.name] = mesh;
                newStationInteractables.push(mesh);
                
                // Register Station on underlying grid? 
                // For now, we assume levels.json is valid. 
                // Dynamic placement happens in interaction.js
            }
        } catch (e) { console.error("Build Error", e); }
    });

    return { stations: newStations, stationInteractables: newStationInteractables, floorMesh: currentFloor };
}

// Legacy helper - can be deprecated eventually
export function getAssemblySlotIndex(station, worldX) {
    let w = station.geometry?.parameters?.width || 0.5;
    const relativeX = worldX - station.position.x;
    const slotW = w / 3;
    if (relativeX < -slotW/2) return 0;
    if (relativeX > slotW/2) return 2;
    return 1;
}