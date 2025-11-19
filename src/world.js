// src/world.js
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { LABEL_Y_OFFSET, STATION_TYPES, GRID_UNIT, MODULE_HEIGHT } from './constants.js';
import { GridSystem } from './grid.js';
import { 
    VoxelBuilder, PALETTE, 
    createTrashBinMesh, createFryerMesh, createCuttingBoardMesh, 
    createStoveMesh, createSinkMesh, createIngredientBinMesh, createPlateStackMesh
} from './voxelBuilder.js';

let currentKitchenObjects = [];
let currentLabels = [];
let currentFloor = null;

function createLabel(scene, text, position, yOffset = LABEL_Y_OFFSET) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = "Bold 40px 'Courier New'";
    const metrics = context.measureText(text);
    canvas.width = metrics.width + 20;
    canvas.height = 50;
    context.font = "Bold 40px 'Courier New'";
    context.fillStyle = 'rgba(0, 0, 0, 0.6)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#FFD700';
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

// --- VOXEL PREFABS ---

function createCounterMesh(isServing) {
    const vb = new VoxelBuilder();
    vb.addBox(1, 0, 1, 14, 1, 14, PALETTE.BLACK);
    vb.addBox(0, 2, 0, 15, 14, 15, isServing ? PALETTE.WOOD_LIGHT : PALETTE.WOOD_DARK);
    vb.addBox(0, 15, 0, 15, 15, 15, PALETTE.COUNTER_TOP);
    if (!isServing) {
        vb.addBox(1, 11, 15, 14, 13, 15, PALETTE.WOOD_BOARD); 
        vb.addBox(6, 12, 16, 9, 12, 16, PALETTE.METAL_LIGHT);
        vb.addBox(1, 3, 15, 14, 9, 15, PALETTE.WOOD_BOARD);
        vb.addBox(12, 6, 16, 12, 8, 16, PALETTE.METAL_LIGHT);
    } else {
        vb.addBox(1, 3, 15, 14, 13, 15, PALETTE.PLASTIC_RED);
    }
    const mesh = vb.buildMesh();
    mesh.scale.set(1, MODULE_HEIGHT / GRID_UNIT, 1);
    mesh.position.y = MODULE_HEIGHT / 2;
    return mesh;
}

function createTableMesh(neighbors) {
    const vb = new VoxelBuilder();
    vb.addBox(0, 15, 0, 15, 15, 15, PALETTE.METAL_SHINY);
    vb.addBox(1, 5, 1, 14, 5, 14, PALETTE.METAL_DARK);
    const addLeg = (x, z) => vb.addBox(x, 0, z, x+1, 14, z+1, PALETTE.METAL_LIGHT);
    if(!neighbors.w && !neighbors.n) addLeg(1, 1);   
    if(!neighbors.e && !neighbors.n) addLeg(13, 1);  
    if(!neighbors.w && !neighbors.s) addLeg(1, 13);  
    if(!neighbors.e && !neighbors.s) addLeg(13, 13); 
    const mesh = vb.buildMesh();
    mesh.scale.set(1, MODULE_HEIGHT / GRID_UNIT, 1);
    mesh.position.y = MODULE_HEIGHT / 2;
    return mesh;
}

function createCounterPrefab(name, color, isServing) {
    const group = new THREE.Group();
    group.name = name;
    const visual = createCounterMesh(isServing);
    group.add(visual);
    group.userData = { type: isServing ? 'station' : 'counter', stationType: isServing ? STATION_TYPES.SERVING : STATION_TYPES.COUNTER, name: name, isBase: true };
    group.userData.grid = new GridSystem(GRID_UNIT, GRID_UNIT, 0, 0, group);
    return group;
}

function createTablePrefab(name, color, neighbors) {
    const group = new THREE.Group();
    group.name = name;
    const visual = createTableMesh(neighbors);
    group.add(visual);
    group.userData = { type: 'counter', stationType: STATION_TYPES.TABLE, name: name, isBase: true };
    group.userData.grid = new GridSystem(GRID_UNIT, GRID_UNIT, 0, 0, group);
    return group;
}

function createStationPrefab(def) {
    const { name, type, size, color, config } = def;
    const group = new THREE.Group();
    group.name = name;

    const w = Math.round((size?.width ?? 0.5) / GRID_UNIT) * GRID_UNIT;
    const d = Math.round((size?.depth ?? 0.5) / GRID_UNIT) * GRID_UNIT;
    const h = 0.3; 

    let mesh = null;
    const n = name.toLowerCase();

    // --- Select Voxel Mesh based on Name/Type ---
    if (type === STATION_TYPES.TRASH) {
        mesh = createTrashBinMesh();
    } else if (type === STATION_TYPES.INGREDIENT_SOURCE) {
        mesh = createIngredientBinMesh(config?.ingredient || 'generic');
    } else if (type === STATION_TYPES.ITEM_SOURCE && config?.item === 'plate') {
        mesh = createPlateStackMesh();
    } else if (n.includes('fryer')) {
        mesh = createFryerMesh();
    } else if (n.includes('cutting') || n.includes('board')) {
        mesh = createCuttingBoardMesh();
    } else if (n.includes('stove') || n.includes('grill') || n.includes('oven')) {
        mesh = createStoveMesh();
    } else if (n.includes('sink')) {
        mesh = createSinkMesh();
    } else {
        const geo = new THREE.BoxGeometry(w - 0.05, h, d - 0.05);
        const mat = new THREE.MeshStandardMaterial({ color: color || 0x555555 });
        mesh = new THREE.Mesh(geo, mat);
        mesh.position.y = h/2;
        mesh.castShadow = true; mesh.receiveShadow = true;
    }

    if (mesh) group.add(mesh);

    group.userData = { ...config, type: 'station', stationType: type, name: name, size: { width: w, height: h, depth: d } };
    
    if (type === STATION_TYPES.PROCESSOR) {
        group.userData.occupiedBy = null;
        if (config?.requiredIngredients) group.userData.internalContents = [];
    }
    if (type === STATION_TYPES.ASSEMBLY) {
        group.userData.slots = [null, null, null];
        const divGeo = new THREE.BoxGeometry(0.02, 0.1, d * 0.9);
        const divMat = new THREE.MeshStandardMaterial({color:0x333});
        const d1 = new THREE.Mesh(divGeo, divMat); d1.position.set(-0.5, 0.05, 0); group.add(d1);
        const d2 = new THREE.Mesh(divGeo, divMat); d2.position.set(0.5, 0.05, 0); group.add(d2);
    }

    return group;
}

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
    
    const occupancyMap = new Map();
    levelLayout.forEach(def => {
        if (def.type === STATION_TYPES.TABLE || def.type === STATION_TYPES.COUNTER || def.type === STATION_TYPES.SERVING) {
            const kx = Math.round(def.position.x * 100) / 100;
            const kz = Math.round(def.position.z * 100) / 100;
            occupancyMap.set(`${kx},${kz}`, def.type);
        }
    });

    const floorSize = 20;
    const floorGeo = new THREE.PlaneGeometry(floorSize, floorSize);
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#E0E0E0'; ctx.fillRect(0,0,64,64);
    ctx.fillStyle = '#90CAF9'; ctx.fillRect(0,0,32,32); ctx.fillRect(32,32,32,32);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(floorSize, floorSize); tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    const floorMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 });
    currentFloor = new THREE.Mesh(floorGeo, floorMat);
    currentFloor.rotation.x = -Math.PI / 2; 
    currentFloor.receiveShadow = true;
    currentFloor.name = "Floor";
    currentFloor.userData = { type: STATION_TYPES.FLOOR, grid: new GridSystem(floorSize, floorSize, 0, 0, currentFloor) };
    scene.add(currentFloor);

    levelLayout.forEach(def => {
        let object3D = null;
        const x = def.position.x; 
        const z = def.position.z;

        if (def.type === STATION_TYPES.COUNTER || def.type === STATION_TYPES.SERVING) {
            object3D = createCounterPrefab(def.name, def.color, def.type === STATION_TYPES.SERVING);
            object3D.position.set(x, 0, z);
            object3D.userData.grid.originX = x - (GRID_UNIT/2);
            object3D.userData.grid.originZ = z - (GRID_UNIT/2);
            if (def.type === STATION_TYPES.SERVING) object3D.attach(createLabel(scene, "SERVE", object3D.position, 1.5));

        } else if (def.type === STATION_TYPES.TABLE) {
            const neighbors = {
                n: occupancyMap.get(`${x},${z-GRID_UNIT}`) === STATION_TYPES.TABLE,
                s: occupancyMap.get(`${x},${z+GRID_UNIT}`) === STATION_TYPES.TABLE,
                e: occupancyMap.get(`${x+GRID_UNIT},${z}`) === STATION_TYPES.TABLE,
                w: occupancyMap.get(`${x-GRID_UNIT},${z}`) === STATION_TYPES.TABLE
            };
            object3D = createTablePrefab(def.name, def.color, neighbors);
            object3D.position.set(x, 0, z);
            object3D.userData.grid.originX = x - (GRID_UNIT/2);
            object3D.userData.grid.originZ = z - (GRID_UNIT/2);

        } else if (Object.values(STATION_TYPES).includes(def.type)) {
            object3D = createStationPrefab(def);
            if (def.type === STATION_TYPES.TRASH) object3D.position.set(x, 0, z);
            else object3D.position.set(x, MODULE_HEIGHT, z);
            
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

export function getAssemblySlotIndex(station, worldX) {
    const w = station.userData.size.width;
    const relativeX = worldX - station.position.x;
    const slotW = w/3;
    if (relativeX < -slotW/2) return 0;
    if (relativeX > slotW/2) return 2;
    return 1;
}