// src/world.js
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { LABEL_Y_OFFSET, STATION_TYPES, GRID_UNIT, MODULE_HEIGHT } from './constants.js';
import { GridSystem } from './grid.js';

let currentKitchenObjects = [];
let currentLabels = [];
let currentFloor = null;

// --- Label Helper ---
function createLabel(scene, text, position, yOffset = LABEL_Y_OFFSET) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = "Bold 40px Arial";
    const metrics = context.measureText(text);
    canvas.width = metrics.width + 20;
    canvas.height = 50;
    
    context.font = "Bold 40px Arial";
    context.fillStyle = 'rgba(0, 0, 0, 0.8)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = 'white';
    context.fillText(text, canvas.width / 2, canvas.height / 2);

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.NearestFilter;
    
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
    sprite.scale.set(canvas.width * 0.005, canvas.height * 0.005, 1);
    sprite.position.copy(position);
    sprite.position.y += yOffset;
    sprite.renderOrder = 999;

    scene.add(sprite);
    currentLabels.push(sprite);
    return sprite;
}

export function toggleLabels(visible) {
    currentLabels.forEach(s => s.visible = visible);
}

// --- PREFAB FACTORY ---

/**
 * Creates a standard 1x1 Counter Block (0.5m x 0.5m x 0.9m)
 * Returns a THREE.Group containing the visual parts.
 */
function createCounterPrefab(name, color, isServing) {
    const group = new THREE.Group();
    group.name = name;

    // 1. Counter Top (The surface)
    const topGeo = new THREE.BoxGeometry(GRID_UNIT, 0.05, GRID_UNIT); // 0.5 x 0.05 x 0.5
    const topMat = new THREE.MeshStandardMaterial({ color: 0xE0E0E0, roughness: 0.5 }); // Light marble
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.y = MODULE_HEIGHT - 0.025; 
    top.castShadow = true; top.receiveShadow = true;
    group.add(top);

    // 2. Cabinet Body
    const bodyGeo = new THREE.BoxGeometry(GRID_UNIT - 0.02, MODULE_HEIGHT - 0.15, GRID_UNIT - 0.05);
    const bodyMat = new THREE.MeshStandardMaterial({ color: color || 0x8B4513, roughness: 0.8 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = (MODULE_HEIGHT / 2) + 0.025;
    body.castShadow = true; body.receiveShadow = true;
    group.add(body);

    // 3. Kickplate (Dark bottom)
    const kickGeo = new THREE.BoxGeometry(GRID_UNIT - 0.05, 0.1, GRID_UNIT - 0.1);
    const kickMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
    const kick = new THREE.Mesh(kickGeo, kickMat);
    kick.position.y = 0.05;
    group.add(kick);

    // 4. Decoration (Door/Handle) - Visual front
    const doorGeo = new THREE.BoxGeometry(GRID_UNIT - 0.06, MODULE_HEIGHT - 0.2, 0.02);
    const doorMat = new THREE.MeshStandardMaterial({ color: color || 0x8B4513 }); // Same color but separate mesh for depth
    // Lighten door slightly
    doorMat.color.offsetHSL(0, 0, 0.05); 
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(0, body.position.y, (GRID_UNIT/2) - 0.02); // Front Z
    group.add(door);

    const handleGeo = new THREE.BoxGeometry(0.02, 0.1, 0.02);
    const handleMat = new THREE.MeshStandardMaterial({ color: 0xCCCCCC });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.position.set(0.15, body.position.y + 0.1, (GRID_UNIT/2) - 0.01);
    group.add(handle);

    // Metadata
    group.userData = {
        type: isServing ? 'station' : 'counter', // Interactable type
        stationType: isServing ? STATION_TYPES.SERVING : STATION_TYPES.COUNTER,
        name: name,
        isBase: true
    };

    // Attach Grid System to this Counter (1x1)
    // Dimensions: width=GRID_UNIT, depth=GRID_UNIT
    // Note: GridSystem expects World Coordinates. The Group will be moved later.
    // We initialize it with 0,0 and update it via interaction logic or assume static.
    // Actually, for static levels, we can init it here but it won't have position yet.
    // GridSystem calculates based on parentMesh position if we don't pass hard coords?
    // No, our GridSystem takes world X/Z. 
    // Solution: We attach the grid logic, but we must update its origin once placed.
    group.userData.grid = new GridSystem(GRID_UNIT, GRID_UNIT, 0, 0, group);

    return group;
}

/**
 * Creates a Table (Legs instead of solid body)
 */
function createTablePrefab(name, color) {
    const group = new THREE.Group();
    group.name = name;

    // Top
    const topGeo = new THREE.BoxGeometry(GRID_UNIT, 0.05, GRID_UNIT);
    const topMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF }); // Stainless steel top
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.y = MODULE_HEIGHT - 0.025;
    top.castShadow = true; top.receiveShadow = true;
    group.add(top);

    // Legs
    const legGeo = new THREE.CylinderGeometry(0.03, 0.03, MODULE_HEIGHT - 0.05);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x888888 });
    const offset = (GRID_UNIT/2) - 0.05;
    
    const positions = [
        {x: -offset, z: -offset}, {x: offset, z: -offset},
        {x: -offset, z: offset},  {x: offset, z: offset}
    ];

    positions.forEach(pos => {
        const leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(pos.x, (MODULE_HEIGHT-0.05)/2, pos.z);
        leg.castShadow = true;
        group.add(leg);
    });

    group.userData = {
        type: 'counter', // Acts as a counter surface
        stationType: STATION_TYPES.TABLE,
        name: name,
        isBase: true
    };
    group.userData.grid = new GridSystem(GRID_UNIT, GRID_UNIT, 0, 0, group);

    return group;
}

/**
 * Creates Functional Stations (Fryer, Board, etc.)
 * These fit into the 1x1 grid on top of counters.
 */
function createStationPrefab(def) {
    const { name, type, size, color, config } = def;
    const group = new THREE.Group();
    group.name = name;

    // Calculate dimensions based on slot multiples
    // Default to 1x1 slot (0.5m x 0.5m) if not specified
    const w = Math.round((size?.width ?? 0.5) / GRID_UNIT) * GRID_UNIT;
    const d = Math.round((size?.depth ?? 0.5) / GRID_UNIT) * GRID_UNIT;
    const h = size?.height ?? 0.3;

    // Base Mesh
    const baseGeo = new THREE.BoxGeometry(w - 0.05, h, d - 0.05); // Slight padding
    const baseMat = new THREE.MeshStandardMaterial({ color: color || 0x555555 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = h / 2;
    base.castShadow = true; base.receiveShadow = true;
    group.add(base);

    // Visual Specifics
    if (name.toLowerCase().includes('fryer')) {
        const vatGeo = new THREE.BoxGeometry(w * 0.7, h * 0.6, d * 0.7);
        const vatMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
        const vat = new THREE.Mesh(vatGeo, vatMat);
        vat.position.y = h; // Stick out top
        group.add(vat);
    } else if (name.toLowerCase().includes('cutting')) {
        base.scale.y = 0.2; // Make board thin
        base.position.y = (h * 0.2) / 2;
        base.material.color.setHex(0xC19A6B); // Wood
    } else if (type === STATION_TYPES.ASSEMBLY) {
        base.scale.y = 0.1;
        base.position.y = (h * 0.1) / 2;
        
        // Slots Visuals (Dividers)
        // Assembly usually 3 slots wide (1.5m)
        if (w >= 1.5) {
            const divGeo = new THREE.BoxGeometry(0.02, 0.1, d * 0.9);
            const d1 = new THREE.Mesh(divGeo, new THREE.MeshStandardMaterial({color:0x333}));
            d1.position.set(-0.5, 0.05, 0);
            group.add(d1);
            const d2 = new THREE.Mesh(divGeo, new THREE.MeshStandardMaterial({color:0x333}));
            d2.position.set(0.5, 0.05, 0);
            group.add(d2);
        }
        
        // Data for logic
        group.userData.slots = [null, null, null];
        // slotPositions calculated after placement
    }

    group.userData = {
        ...config,
        type: 'station',
        stationType: type,
        name: name,
        size: { width: w, height: h, depth: d }
    };
    
    // Processor internal state
    if (type === STATION_TYPES.PROCESSOR) {
        group.userData.occupiedBy = null;
        if (config?.requiredIngredients) group.userData.internalContents = [];
    }

    return group;
}

// --- BUILDER ---

export function clearKitchen(scene) {
    currentKitchenObjects.forEach(obj => {
        scene.remove(obj);
        // Deep dispose
        obj.traverse(c => {
            if (c.geometry) c.geometry.dispose();
            if (c.material) {
                if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
                else c.material.dispose();
            }
        });
    });
    currentLabels.forEach(l => {
        scene.remove(l);
        l.material.map.dispose();
        l.material.dispose();
    });
    currentKitchenObjects = [];
    currentLabels = [];
    
    if (currentFloor) {
        scene.remove(currentFloor);
        currentFloor.geometry.dispose();
        currentFloor.material.map.dispose();
        currentFloor.material.dispose();
        currentFloor = null;
    }
}

export function buildKitchen(scene, levelLayout) {
    clearKitchen(scene);

    const newStations = {};
    const newStationInteractables = [];

    // 1. Create Floor (15x15 Grid)
    const floorSize = 15;
    const floorGeo = new THREE.PlaneGeometry(floorSize, floorSize);
    
    // Texture
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#666'; ctx.fillRect(0,0,64,64); // Darker grout
    ctx.fillStyle = '#888'; ctx.fillRect(2,2,60,60); // Tile
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(floorSize * 2, floorSize * 2); // 2 tiles per meter
    tex.magFilter = THREE.NearestFilter;

    const floorMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 });
    currentFloor = new THREE.Mesh(floorGeo, floorMat);
    currentFloor.rotation.x = -Math.PI / 2;
    currentFloor.receiveShadow = true;
    currentFloor.name = "Floor";
    
    // Floor Grid
    currentFloor.userData = { 
        type: STATION_TYPES.FLOOR,
        grid: new GridSystem(floorSize, floorSize, 0, 0, currentFloor)
    };
    scene.add(currentFloor);


    // 2. Build Layout
    levelLayout.forEach(def => {
        let object3D = null;

        if (def.type === STATION_TYPES.COUNTER || def.type === STATION_TYPES.SERVING) {
            // Counter Modules
            object3D = createCounterPrefab(def.name, def.color, def.type === STATION_TYPES.SERVING);
            object3D.position.set(def.position.x, 0, def.position.z);
            
            // Register on Floor Grid
            const floorGrid = currentFloor.userData.grid;
            const gridPos = floorGrid.worldToGrid(object3D.position);
            // Counters are 1x1 (0.5m)
            floorGrid.occupy(gridPos.col, gridPos.row, 1, 1, object3D);
            
            // Update Internal Grid Origin
            object3D.userData.grid.originX = def.position.x - (GRID_UNIT/2);
            object3D.userData.grid.originZ = def.position.z - (GRID_UNIT/2);

            if (def.type === STATION_TYPES.SERVING) {
                const lbl = createLabel(scene, "SERVE", object3D.position, 1.5);
                object3D.attach(lbl); // Make child
            }

        } else if (def.type === STATION_TYPES.TABLE) {
            object3D = createTablePrefab(def.name, def.color);
            object3D.position.set(def.position.x, 0, def.position.z);
            
            // Register on Floor
            const floorGrid = currentFloor.userData.grid;
            const gridPos = floorGrid.worldToGrid(object3D.position);
            floorGrid.occupy(gridPos.col, gridPos.row, 1, 1, object3D);

            // Update Internal Grid Origin
            object3D.userData.grid.originX = def.position.x - (GRID_UNIT/2);
            object3D.userData.grid.originZ = def.position.z - (GRID_UNIT/2);

        } else if (Object.values(STATION_TYPES).includes(def.type)) {
            // Functional Stations (Fryers, Bins, etc)
            // These sit ON TOP of counters.
            object3D = createStationPrefab(def);
            
            // Position Logic:
            // Y = Module Height
            object3D.position.set(def.position.x, MODULE_HEIGHT, def.position.z);

            // Register on specific Counter Grid?
            // In the editor, we drag them. In loading, we assume valid pos.
            // We find the surface underneath to register occupancy.
            // For now, we just place them in world. Interaction system checks grids dynamically.
            
            const lbl = createLabel(scene, def.name, new THREE.Vector3(0,0.5,0), 0);
            object3D.add(lbl); // Add label as child
            
            // Assembly Logic Update
            if (def.type === STATION_TYPES.ASSEMBLY) {
                // Recalculate slots based on placed position
                const w = object3D.userData.size.width;
                const slotW = w / 3;
                const y = object3D.position.y + object3D.userData.size.height/2;
                object3D.userData.slotPositions = [
                    new THREE.Vector3(object3D.position.x - slotW, y, object3D.position.z),
                    new THREE.Vector3(object3D.position.x, y, object3D.position.z),
                    new THREE.Vector3(object3D.position.x + slotW, y, object3D.position.z)
                ];
            }
        }

        if (object3D) {
            scene.add(object3D);
            currentKitchenObjects.push(object3D);
            
            // Add to functional lists
            if (def.type !== 'decoration') {
                newStations[def.name] = object3D;
                newStationInteractables.push(object3D);
            }
        }
    });

    return { stations: newStations, stationInteractables: newStationInteractables, floorMesh: currentFloor };
}

export function getAssemblySlotIndex(station, worldX) {
    // Simple relative check
    const relativeX = worldX - station.position.x;
    const w = station.userData.size.width;
    const slotW = w/3;
    if (relativeX < -slotW/2) return 0;
    if (relativeX > slotW/2) return 2;
    return 1;
}