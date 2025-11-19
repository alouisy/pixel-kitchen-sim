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

// --- SMART PREFAB FACTORY ---

// 1. Standard Counter (Solid Block)
function createCounterPrefab(name, color, isServing) {
    const group = new THREE.Group();
    group.name = name;

    // Top
    const topGeo = new THREE.BoxGeometry(GRID_UNIT, 0.05, GRID_UNIT);
    const topMat = new THREE.MeshStandardMaterial({ color: 0xE0E0E0, roughness: 0.5 });
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.y = MODULE_HEIGHT - 0.025; 
    top.castShadow = true; top.receiveShadow = true;
    group.add(top);

    // Body
    const bodyGeo = new THREE.BoxGeometry(GRID_UNIT - 0.02, MODULE_HEIGHT - 0.15, GRID_UNIT - 0.05);
    const bodyMat = new THREE.MeshStandardMaterial({ color: color || 0x8B4513, roughness: 0.8 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = (MODULE_HEIGHT / 2) + 0.025;
    body.castShadow = true; body.receiveShadow = true;
    group.add(body);

    // Kickplate
    const kickGeo = new THREE.BoxGeometry(GRID_UNIT - 0.05, 0.1, GRID_UNIT - 0.1);
    const kickMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
    const kick = new THREE.Mesh(kickGeo, kickMat);
    kick.position.y = 0.05;
    group.add(kick);

    // Logic
    group.userData = {
        type: isServing ? 'station' : 'counter', 
        stationType: isServing ? STATION_TYPES.SERVING : STATION_TYPES.COUNTER,
        name: name,
        isBase: true
    };
    group.userData.grid = new GridSystem(GRID_UNIT, GRID_UNIT, 0, 0, group);
    return group;
}

// 2. Smart Table (Adapts Legs based on Neighbors)
function createTablePrefab(name, color, neighbors) {
    const group = new THREE.Group();
    group.name = name;

    // Top Surface
    const topGeo = new THREE.BoxGeometry(GRID_UNIT, 0.05, GRID_UNIT);
    const topMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF });
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.y = MODULE_HEIGHT - 0.025;
    top.castShadow = true; top.receiveShadow = true;
    group.add(top);

    // Smart Legs Logic
    // If there is NO neighbor in a direction, we might need legs on that side.
    // Specifically, legs go in corners. A corner needs a leg if there is no neighbor sharing that corner.
    
    const legGeo = new THREE.CylinderGeometry(0.03, 0.03, MODULE_HEIGHT - 0.05);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x888888 });
    const offset = (GRID_UNIT/2) - 0.05;

    // Check Corners
    // Top-Left (-X, -Z): Needs leg if NO neighbor West (-X) AND NO neighbor North (-Z)
    // But wait, adjacency is simpler:
    // Leg at (-X, -Z) if !West AND !North? Not quite.
    // If I have a table at (0,0) and (0,1), they merge.
    // (0,0) has South neighbor. (0,1) has North neighbor.
    // (0,0) needs legs at Top-Left, Top-Right. Bottom legs?
    // If neighbor South exists, (0,0) doesn't need bottom legs IF the neighbor covers them.
    
    // Simplified Rule: Place a leg at a corner if there are no neighbors adjacent to that corner.
    
    const hasN = neighbors.n; // -Z
    const hasS = neighbors.s; // +Z
    const hasW = neighbors.w; // -X
    const hasE = neighbors.e; // +X

    // Top-Left Leg (-x, -z): Place if !West AND !North
    if (!hasW && !hasN) addLeg(-offset, -offset);
    // Top-Right Leg (+x, -z): Place if !East AND !North
    if (!hasE && !hasN) addLeg(offset, -offset);
    // Bottom-Left Leg (-x, +z): Place if !West AND !South
    if (!hasW && !hasS) addLeg(-offset, offset);
    // Bottom-Right Leg (+x, +z): Place if !East AND !South
    if (!hasE && !hasS) addLeg(offset, offset);

    function addLeg(x, z) {
        const leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(x, (MODULE_HEIGHT-0.05)/2, z);
        leg.castShadow = true;
        group.add(leg);
    }

    group.userData = {
        type: 'counter', 
        stationType: STATION_TYPES.TABLE,
        name: name,
        isBase: true
    };
    group.userData.grid = new GridSystem(GRID_UNIT, GRID_UNIT, 0, 0, group);

    return group;
}

// 3. Functional Station (Sits on top)
function createStationPrefab(def) {
    const { name, type, size, color, config } = def;
    const group = new THREE.Group();
    group.name = name;

    const w = Math.round((size?.width ?? 0.5) / GRID_UNIT) * GRID_UNIT;
    const d = Math.round((size?.depth ?? 0.5) / GRID_UNIT) * GRID_UNIT;
    const h = size?.height ?? 0.3;

    const baseGeo = new THREE.BoxGeometry(w - 0.05, h, d - 0.05);
    const baseMat = new THREE.MeshStandardMaterial({ color: color || 0x555555 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = h / 2;
    base.castShadow = true; base.receiveShadow = true;
    group.add(base);

    if (name.toLowerCase().includes('fryer')) {
        const vatGeo = new THREE.BoxGeometry(w * 0.7, h * 0.6, d * 0.7);
        const vatMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
        const vat = new THREE.Mesh(vatGeo, vatMat);
        vat.position.y = h; 
        group.add(vat);
    } else if (name.toLowerCase().includes('cutting')) {
        base.scale.y = 0.2; base.position.y = (h * 0.2) / 2;
        base.material.color.setHex(0xC19A6B);
    }

    group.userData = {
        ...config,
        type: 'station',
        stationType: type,
        name: name,
        size: { width: w, height: h, depth: d }
    };
    
    if (type === STATION_TYPES.PROCESSOR) {
        group.userData.occupiedBy = null;
        if (config?.requiredIngredients) group.userData.internalContents = [];
    }

    return group;
}

// --- BUILDER LOGIC ---

export function clearKitchen(scene) {
    currentKitchenObjects.forEach(obj => {
        scene.remove(obj);
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
    
    // 1. Adjacency Mapping
    // Map "x,z" string to object type to detect neighbors
    const occupancyMap = new Map();
    levelLayout.forEach(def => {
        if (def.type === STATION_TYPES.TABLE || def.type === STATION_TYPES.COUNTER || def.type === STATION_TYPES.SERVING) {
            // Snap positions to ensure keys match
            const kx = Math.round(def.position.x * 100) / 100;
            const kz = Math.round(def.position.z * 100) / 100;
            occupancyMap.set(`${kx},${kz}`, def.type);
        }
    });

    // 2. Floor
    const floorSize = 20;
    const floorGeo = new THREE.PlaneGeometry(floorSize, floorSize);
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#666'; ctx.fillRect(0,0,64,64); 
    ctx.fillStyle = '#888'; ctx.fillRect(2,2,60,60);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(floorSize * 2, floorSize * 2); tex.magFilter = THREE.NearestFilter;
    const floorMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 });
    currentFloor = new THREE.Mesh(floorGeo, floorMat);
    currentFloor.rotation.x = -Math.PI / 2; 
    currentFloor.receiveShadow = true;
    currentFloor.name = "Floor";
    currentFloor.userData = { type: STATION_TYPES.FLOOR, grid: new GridSystem(floorSize, floorSize, 0, 0, currentFloor) };
    scene.add(currentFloor);

    // 3. Instantiation
    levelLayout.forEach(def => {
        let object3D = null;
        const x = def.position.x; 
        const z = def.position.z;

        if (def.type === STATION_TYPES.COUNTER || def.type === STATION_TYPES.SERVING) {
            object3D = createCounterPrefab(def.name, def.color, def.type === STATION_TYPES.SERVING);
            object3D.position.set(x, 0, z);
            if (def.type === STATION_TYPES.SERVING) {
                object3D.attach(createLabel(scene, "SERVE", object3D.position, 1.5));
            }
            
            // Register grid
            object3D.userData.grid.originX = x - (GRID_UNIT/2);
            object3D.userData.grid.originZ = z - (GRID_UNIT/2);

        } else if (def.type === STATION_TYPES.TABLE) {
            // Check neighbors
            const neighbors = {
                n: occupancyMap.get(`${x},${z-GRID_UNIT}`) === STATION_TYPES.TABLE, // North (-Z)
                s: occupancyMap.get(`${x},${z+GRID_UNIT}`) === STATION_TYPES.TABLE, // South (+Z)
                e: occupancyMap.get(`${x+GRID_UNIT},${z}`) === STATION_TYPES.TABLE, // East (+X)
                w: occupancyMap.get(`${x-GRID_UNIT},${z}`) === STATION_TYPES.TABLE  // West (-X)
            };
            
            object3D = createTablePrefab(def.name, def.color, neighbors);
            object3D.position.set(x, 0, z);
            object3D.userData.grid.originX = x - (GRID_UNIT/2);
            object3D.userData.grid.originZ = z - (GRID_UNIT/2);

        } else if (Object.values(STATION_TYPES).includes(def.type)) {
            object3D = createStationPrefab(def);
            object3D.position.set(x, MODULE_HEIGHT, z);
            object3D.add(createLabel(scene, def.name, new THREE.Vector3(0,0.5,0), 0));
        }

        if (object3D) {
            scene.add(object3D);
            currentKitchenObjects.push(object3D);
            if (def.type !== 'decoration') {
                newStations[def.name] = object3D;
                newStationInteractables.push(object3D);
            }
        }
    });

    return { stations: newStations, stationInteractables: newStationInteractables, floorMesh: currentFloor };
}