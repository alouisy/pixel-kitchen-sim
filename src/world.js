// src/world.js
import * as THREE from 'three';
import { LABEL_Y_OFFSET, STATION_TYPES, GRID_UNIT, MODULE_HEIGHT } from './constants.js';
import { GridSystem } from './grid.js';
import { 
    VoxelBuilder, PALETTE, 
    createTrashBinMesh, createFryerMesh, createCuttingBoardMesh, createStoveMesh, createSinkMesh, 
    createIngredientBinMesh, createPlateStackMesh, createCupStackMesh, createBowlStackMesh,
    createToasterMesh, createMixerMesh, createBlenderMesh, createDoughPressMesh, createPizzaOvenMesh,
    createItemMesh, createTableMesh,
    createExhaustHoodMesh, createPlantMesh, createKitchenLampMesh, createCoatingStationMesh
} from './voxelBuilder.js';
import { getTrans } from './i18nData.js';
import { LEGACY_NAME_MAPPINGS } from './utils/legacyMigration.js';
import { createItem, updatePlateVisuals } from './items.js';
import { RECIPES } from './gameData.js';

let currentKitchenObjects = [];
let currentLabels = [];
let currentFloor = null;
let currentLang = 'en'; 
let currentLabelVisibility = true;

export function setWorldLanguage(lang) {
    currentLang = lang;
}

export function getKitchenObjects() {
    return currentKitchenObjects;
}

export function refreshSmartObjects(scene) {
    // Updates the mesh of smart objects (Tables) based on their neighbors
    scene.traverse(c => {
        if (c.userData && (c.userData.stationType === STATION_TYPES.TABLE)) {
            updateSmartObjectMesh(c, scene);
        }
    });
}

function updateSmartObjectMesh(object, scene) {
    const type = object.userData.stationType;
    const x = object.position.x;
    const z = object.position.z;
    const w = GRID_UNIT; 
    
    // Check neighbors in the scene
    const checkNeighbor = (dx, dz) => {
        const targetX = x + dx;
        const targetZ = z + dz;
        let found = false;
        
        // Iterate scene children manually to be robust in editor
        for(let i=0; i<scene.children.length; i++) {
            const c = scene.children[i];
            if (c !== object && c.userData && c.userData.stationType === type) {
                if (Math.abs(c.position.x - targetX) < 0.1 && Math.abs(c.position.z - targetZ) < 0.1) {
                    found = true;
                    break;
                }
            }
        }
        return found;
    };

    const neighbors = {
        n: checkNeighbor(0, -w),
        s: checkNeighbor(0, w),
        e: checkNeighbor(w, 0),
        w: checkNeighbor(-w, 0)
    };

    // Remove old visual child
    const oldVisual = object.children.find(c => c.type === 'Mesh' || c.type === 'Group');
    if (oldVisual) {
        object.remove(oldVisual);
        if(oldVisual.geometry) oldVisual.geometry.dispose();
        if(oldVisual.material) {
            if(Array.isArray(oldVisual.material)) oldVisual.material.forEach(m=>m.dispose());
            else oldVisual.material.dispose();
        }
    }

    // Create new visual
    if (type === STATION_TYPES.TABLE) {
        const visual = createTableMesh(neighbors);
        object.add(visual);
    }
}

export function resizeWall(wallObject, width, depth) {
    if (wallObject.userData.stationType !== STATION_TYPES.WALL) return;

    const h = 2.5; // Wall height
    const oldMesh = wallObject.children.find(c => c.isMesh);
    
    if (oldMesh) {
        // Reuse geometry if possible, but easier to recreate box
        oldMesh.geometry.dispose();
        oldMesh.geometry = new THREE.BoxGeometry(width, h, depth);
        // Re-center geometry vertically so origin is bottom
        oldMesh.position.y = h/2;
    }

    // Update userData
    wallObject.userData.size = { width, depth };
    
    // Ensure object name reflects resize if it helps debugging, or keep generic
}

const LABEL_SCALE = 0.0035;
const LABEL_STATION_Y = MODULE_HEIGHT + 0.55; // Floating height above stations
const LABEL_SERVE_Y = 1.5; // Floating height above serving counters

// Stations that get a floating label. Counters/tables/walls/decoration stay muted.
const LABEL_STATION_TYPES = [
    STATION_TYPES.SERVING,
    STATION_TYPES.INGREDIENT_SOURCE,
    STATION_TYPES.ITEM_SOURCE,
    STATION_TYPES.PROCESSOR,
    STATION_TYPES.TRASH
];

function createLabel(scene, text, position, yOffset = LABEL_Y_OFFSET) {
    const translatedText = getTrans(text, currentLang);

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    // System font (no external font loaded, so the UI keeps its original look).
    context.font = "Bold 14px 'Courier New', monospace";
    const metrics = context.measureText(translatedText);
    const padX = 10;
    const padY = 7;
    canvas.width = Math.ceil(metrics.width) + padX * 2;
    canvas.height = 18 + padY * 2;
    context.font = "Bold 14px 'Courier New', monospace";

    // Rounded backdrop (small radius, pixel-ish)
    const radius = 4;
    context.fillStyle = 'rgba(18, 18, 28, 0.85)';
    context.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(radius, 0);
    context.lineTo(canvas.width - radius, 0);
    context.quadraticCurveTo(canvas.width, 0, canvas.width, radius);
    context.lineTo(canvas.width, canvas.height - radius);
    context.quadraticCurveTo(canvas.width, canvas.height, canvas.width - radius, canvas.height);
    context.lineTo(radius, canvas.height);
    context.quadraticCurveTo(0, canvas.height, 0, canvas.height - radius);
    context.lineTo(0, radius);
    context.quadraticCurveTo(0, 0, radius, 0);
    context.closePath();
    context.fill();
    context.stroke();

    context.textAlign = 'center';
    context.textBaseline = 'middle';
    // Gold accent for the service counter, white for the rest
    const isServe = text === 'serve_label';
    context.fillStyle = isServe ? '#FFE082' : '#FFFFFF';
    context.strokeStyle = '#000000';
    context.lineWidth = 3;
    context.strokeText(translatedText, canvas.width / 2, canvas.height / 2);
    context.fillText(translatedText, canvas.width / 2, canvas.height / 2);

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
    sprite.scale.set(canvas.width * LABEL_SCALE, canvas.height * LABEL_SCALE, 1);
    sprite.position.copy(position);
    sprite.position.y += yOffset;
    sprite.renderOrder = 999;
    
    sprite.visible = currentLabelVisibility;

    scene.add(sprite);
    currentLabels.push(sprite);
    return sprite;
}

export function toggleLabels(visible) {
    currentLabelVisibility = visible;
    currentLabels.forEach(s => s.visible = visible);
}

export function getFloorMesh() {
    return currentFloor;
}

function createCounterMesh(isServing, isCorner, theme) {
    const vb = new VoxelBuilder();
    
    // Determine colors based on theme.counterStyle or theme colors
    let baseCol = isServing ? PALETTE.WOOD_LIGHT : PALETTE.WOOD_DARK;
    let topCol = PALETTE.COUNTER_TOP;
    let boardCol = PALETTE.WOOD_BOARD;
    let handleCol = PALETTE.METAL_LIGHT;
    
    if (theme?.counterStyle === 'industrial') {
        baseCol = 0x616161; // steel grey
        topCol = 0xbdbdbd;  // light steel
        boardCol = 0x424242; // dark drawer
        handleCol = 0xe0e0e0;
    } else if (theme?.counterStyle === 'retro') {
        baseCol = 0xc62828; // bright retro red
        topCol = 0xffffff;  // retro white top
        boardCol = 0x1565c0; // retro blue details
        handleCol = 0xe0e0e0;
    } else if (theme?.counterStyle === 'organic') {
        baseCol = 0xffffff; // white base
        topCol = 0xa5d6a7;  // minty light green top
        boardCol = 0x81c784; // solid green drawers
        handleCol = 0x5d4037; // wood handle
    } else if (theme?.counterStyle === 'diner') {
        baseCol = 0x8d6e63; // light wood
        topCol = 0xffeb3b;  // bright yellow top
        boardCol = 0xffd54f; // golden yellow drawers
        handleCol = 0xe0e0e0;
    }

    vb.addBox(1, 0, 1, 14, 1, 14, PALETTE.BLACK);
    vb.addBox(0, 2, 0, 15, 14, 15, baseCol);
    vb.addBox(0, 15, 0, 15, 15, 15, topCol);
    
    // Only add front details if it's NOT a serving counter AND NOT a corner
    if (!isServing && !isCorner) {
        vb.addBox(1, 11, 15, 14, 13, 15, boardCol); 
        vb.addBox(6, 12, 16, 9, 12, 16, handleCol);
        vb.addBox(1, 3, 15, 14, 9, 15, boardCol);
        vb.addBox(12, 6, 16, 12, 8, 16, handleCol);
    } else if (isServing) {
        vb.addBox(1, 3, 15, 14, 13, 15, theme?.servingColor || PALETTE.PLASTIC_RED);
    }
    const mesh = vb.buildMesh();
    mesh.scale.set(1, MODULE_HEIGHT / GRID_UNIT, 1);
    mesh.position.y = MODULE_HEIGHT / 2;
    return mesh;
}

// Exported for Editor use
export function createCounterPrefab(name, color, isServing, theme) {
    const group = new THREE.Group();
    group.name = name;
    // Detect corner from name
    const isCorner = name && name.toLowerCase().includes('corner');
    const visual = createCounterMesh(isServing, isCorner, theme);
    group.add(visual);
    group.userData = { type: isServing ? 'station' : 'counter', stationType: isServing ? STATION_TYPES.SERVING : STATION_TYPES.COUNTER, name: name, isBase: true };
    group.userData.grid = new GridSystem(GRID_UNIT, GRID_UNIT, 0, 0, group);
    return group;
}

// Exported for Editor use
export function createTablePrefab(name, color, neighbors) {
    const group = new THREE.Group();
    group.name = name;
    const visual = createTableMesh(neighbors);
    group.add(visual);
    group.userData = { type: 'counter', stationType: STATION_TYPES.TABLE, name: name, isBase: true };
    group.userData.grid = new GridSystem(GRID_UNIT, GRID_UNIT, 0, 0, group);
    return group;
}

// Exported for Editor use
export function createStationPrefab(def, theme) {
    const { name, type, size, color, config } = def;
    const group = new THREE.Group();
    group.name = name;
    const w = Math.round((size?.width ?? 0.5) / GRID_UNIT) * GRID_UNIT;
    const d = Math.round((size?.depth ?? 0.5) / GRID_UNIT) * GRID_UNIT;
    const h = 0.3; 
    let mesh = null;
    const n = name.toLowerCase();

    if (type === STATION_TYPES.WALL) {
        const wallH = 2.5;
        const geo = new THREE.BoxGeometry(w, wallH, d);
        const mat = new THREE.MeshStandardMaterial({ color: color || theme?.wallColor || PALETTE.WALL_WHITE });
        mesh = new THREE.Mesh(geo, mat);
        mesh.position.y = wallH / 2;
        mesh.castShadow = true; 
        mesh.receiveShadow = true;
    } 
    else if (type === 'decoration') {
        if (n.includes('hood') || n.includes('exhaust')) {
            mesh = createExhaustHoodMesh();
        } else if (n.includes('plant')) {
            mesh = createPlantMesh();
        } else if (n.includes('lamp') || n.includes('light')) {
            mesh = createKitchenLampMesh();
        } else {
            const geo = new THREE.BoxGeometry(w - 0.05, h, d - 0.05);
            const mat = new THREE.MeshStandardMaterial({ color: color || 0x555555 });
            mesh = new THREE.Mesh(geo, mat);
            mesh.position.y = h/2;
            mesh.castShadow = true; mesh.receiveShadow = true;
        }
    }
    else if (type === STATION_TYPES.TRASH) {
        mesh = createTrashBinMesh();
    } 
    else if (type === STATION_TYPES.INGREDIENT_SOURCE) {
        mesh = createIngredientBinMesh(config?.ingredient || 'generic');
    } 
    else if (type === STATION_TYPES.ITEM_SOURCE) {
        if (config?.item === 'plate') mesh = createPlateStackMesh();
        else if (config?.item === 'cup') mesh = createCupStackMesh();
        else if (config?.item === 'bowl') mesh = createBowlStackMesh();
        else mesh = createPlateStackMesh(); // Fallback
    } 
    else if (type === STATION_TYPES.PREPLACED_ITEM) {
        // For the editor/ghost, we just want a visual representation.
        // We use createItemMesh directly.
        mesh = createItemMesh(config?.item || 'plate');
        // Shift Y to bottom to match station origin expectations
        mesh.position.y = 0; 
    }
    else if (n.includes('fryer')) {
        mesh = createFryerMesh();
    } 
    else if (n.includes('cutting') || n.includes('board')) {
        mesh = createCuttingBoardMesh();
    } 
    else if (n.includes('stove') || n.includes('grill') || n.includes('hob')) {
        mesh = createStoveMesh();
    } 
    else if (n.includes('sink')) {
        mesh = createSinkMesh();
    } 
    else if (n.includes('toaster')) {
        mesh = createToasterMesh();
    }
    else if (n.includes('mixer')) {
        mesh = createMixerMesh();
    }
    else if (n.includes('blender')) {
        mesh = createBlenderMesh();
    }
    else if (n.includes('press')) {
        mesh = createDoughPressMesh();
    }
    else if (n.includes('oven') || n.includes('pizza')) {
        mesh = createPizzaOvenMesh();
    }
    else if (n.includes('coating') || n.includes('panure')) {
        mesh = createCoatingStationMesh();
    }
    else {
        // Generic fallback
        const geo = new THREE.BoxGeometry(w - 0.05, h, d - 0.05);
        const mat = new THREE.MeshStandardMaterial({ color: color || 0x555555 });
        mesh = new THREE.Mesh(geo, mat);
        mesh.position.y = h/2;
        mesh.castShadow = true; mesh.receiveShadow = true;
    }

    if (mesh) group.add(mesh);
    
    // Store config separately in userData so it's accessible for export
    group.userData = { ...config, type: 'station', stationType: type, name: name, size: { width: w, height: h, depth: d } };
    if (config) group.userData.config = config;

    if (type === STATION_TYPES.PREPLACED_ITEM && config?.contents) {
        group.userData.contents = [...config.contents];
        if (RECIPES[name]) {
            group.userData.mealName = name;
        }
        updatePlateVisuals(group, group);
    }

    if (type === STATION_TYPES.PROCESSOR) {
        group.userData.occupiedBy = null;
        if (config?.requiredIngredients) group.userData.internalContents = [];
    } else if (type === STATION_TYPES.INGREDIENT_SOURCE || type === STATION_TYPES.ITEM_SOURCE) {
        group.userData.grid = new GridSystem(GRID_UNIT, GRID_UNIT, 0, 0, group);
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

// Groups adjacent stations of the same type/name into runs so each run gets a
// single label (centered on the run) instead of one label per station.
function groupLabelStations(levelLayout) {
    const candidates = levelLayout.filter(def =>
        def && LABEL_STATION_TYPES.includes(def.type) && def.name
    ).map(def => ({
        ...def,
        name: LEGACY_NAME_MAPPINGS[def.name] || def.name
    }));

    const groups = new Map();
    candidates.forEach(def => {
        const key = `${def.type}|${def.name}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(def);
    });

    const runs = [];
    groups.forEach(defs => {
        const remaining = [...defs];
        while (remaining.length) {
            const run = [remaining.pop()];
            // Grow the run by absorbing any remaining station adjacent to the current run
            let grew = true;
            while (grew) {
                grew = false;
                for (let i = remaining.length - 1; i >= 0; i--) {
                    const candidate = remaining[i];
                    const adjacent = run.some(placed =>
                        (Math.abs(placed.position.x - candidate.position.x) < 0.1 &&
                         Math.abs(placed.position.z - candidate.position.z - GRID_UNIT) < 0.1) ||
                        (Math.abs(placed.position.x - candidate.position.x) < 0.1 &&
                         Math.abs(placed.position.z - candidate.position.z + GRID_UNIT) < 0.1) ||
                        (Math.abs(placed.position.x - candidate.position.x - GRID_UNIT) < 0.1 &&
                         Math.abs(placed.position.z - candidate.position.z) < 0.1) ||
                        (Math.abs(placed.position.x - candidate.position.x + GRID_UNIT) < 0.1 &&
                         Math.abs(placed.position.z - candidate.position.z) < 0.1)
                    );
                    if (adjacent) {
                        run.push(candidate);
                        remaining.splice(i, 1);
                        grew = true;
                    }
                }
            }
            runs.push(run);
        }
    });
    return runs;
}

export function buildKitchen(scene, levelLayout, theme) {
    clearKitchen(scene);
    const newStations = [];
    const newStationInteractables = [];
    const occupancyMap = new Map();
    levelLayout.forEach(def => {
        if (def.type === STATION_TYPES.TABLE || def.type === STATION_TYPES.COUNTER || def.type === STATION_TYPES.SERVING) {
            const kx = Math.round(def.position.x * 100) / 100;
            const kz = Math.round(def.position.z * 100) / 100;
            occupancyMap.set(`${kx},${kz}`, def.type);
        }
    });
    
    // Reduced floor size 8x8 (matches bounds -3.5 to 3.5 visual padding)
    const floorSize = 8; 
    const floorGeo = new THREE.PlaneGeometry(floorSize, floorSize);
    
    // Improved "Kitchen Tile" texture
    const canvas = document.createElement('canvas'); 
    canvas.width = 128; 
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    
    // Theme defaults
    const bgCol = theme?.floorColor1 || '#37474F';
    const tileCol = theme?.floorColor2 || '#546E7A';
    const borderCol = theme?.borderColor || '#263238';

    // Dark slate background
    ctx.fillStyle = bgCol; 
    ctx.fillRect(0, 0, 128, 128);
    
    // Lighter grey tiles (checkerboard pattern)
    ctx.fillStyle = tileCol; 
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillRect(64, 64, 64, 64);
    
    // Draw a thin border
    ctx.strokeStyle = borderCol;
    ctx.lineWidth = 4;
    ctx.strokeRect(0,0,128,128);
    ctx.beginPath();
    ctx.moveTo(64,0); ctx.lineTo(64,128);
    ctx.moveTo(0,64); ctx.lineTo(128,64);
    ctx.stroke();

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    // Repeat per unit (size)
    tex.repeat.set(floorSize/2, floorSize/2); 
    tex.magFilter = THREE.NearestFilter; 
    tex.minFilter = THREE.NearestFilter;
    
    const floorMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, metalness: 0.1 });
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
            object3D = createCounterPrefab(def.name, def.color, def.type === STATION_TYPES.SERVING, theme);
            object3D.position.set(x, 0, z);
            object3D.userData.grid.originX = x - (GRID_UNIT/2);
            object3D.userData.grid.originZ = z - (GRID_UNIT/2);

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
        } else if (def.type === STATION_TYPES.PREPLACED_ITEM) {
            // Special Case: Create a dynamic item instead of a station
            // This item will be pickup-able immediately
            const item = createItem(scene, def.config.item);
            
            // Adjust position to sit on top of counters/tables if present, otherwise on the floor
            const kx = Math.round(x * 100) / 100;
            const kz = Math.round(z * 100) / 100;
            const hasSupport = occupancyMap.has(`${kx},${kz}`);
            const spawnY = hasSupport ? MODULE_HEIGHT + 0.01 : 0.01;
            item.position.set(x, spawnY, z);
            
            if (def.rotation) item.rotation.y = def.rotation;
            
            if (def.config.contents) {
                item.userData.contents = [...def.config.contents];
                if (RECIPES[def.name]) {
                    item.userData.mealName = def.name;
                }
                updatePlateVisuals(scene, item);
            }
            
            currentKitchenObjects.push(item);
            newStationInteractables.push(item);
            // Do NOT add to newStations, as it's not a fixed machine
            object3D = null; 

        } else if (Object.values(STATION_TYPES).includes(def.type) || def.type === 'decoration') {
            object3D = createStationPrefab(def, theme);
            if (def.type === STATION_TYPES.WALL) {
                object3D.position.set(x, 0, z);
            } else if (def.type === 'decoration' || def.type === STATION_TYPES.TRASH) {
                const n = def.name.toLowerCase();
                if (n.includes('lamp') || n.includes('light')) {
                    object3D.position.set(x, 2.0, z);
                } else if (n.includes('hood') || n.includes('exhaust')) {
                    object3D.position.set(x, MODULE_HEIGHT + 0.6, z);
                } else {
                    const kx = Math.round(x * 100) / 100;
                    const kz = Math.round(z * 100) / 100;
                    const hasSupport = occupancyMap.has(`${kx},${kz}`);
                    object3D.position.set(x, hasSupport ? MODULE_HEIGHT : 0, z);
                }
            } else {
                object3D.position.set(x, MODULE_HEIGHT, z);
            }
            
            if (object3D.userData.grid) {
                object3D.userData.grid.originX = x - (GRID_UNIT/2);
                object3D.userData.grid.originZ = z - (GRID_UNIT/2);
            }
        }

        if (object3D) {
            // Apply rotation if present in layout definition
            if (def.rotation) {
                object3D.rotation.y = def.rotation;
            }
            
            scene.add(object3D);
            currentKitchenObjects.push(object3D);
            if (def.type !== 'decoration' && def.type !== STATION_TYPES.WALL) {
                newStations.push(object3D);
                newStationInteractables.push(object3D);
            }
        }
    });

    // Post-processing pass: occupy grid slots for preplaced items
    newStationInteractables.forEach(item => {
        if (item.userData && (item.userData.type === 'item' || item.userData.type === 'ingredient')) {
            const support = newStations.find(s => 
                s.userData && 
                (s.userData.stationType === STATION_TYPES.COUNTER || 
                 s.userData.stationType === STATION_TYPES.TABLE || 
                 s.userData.stationType === STATION_TYPES.SERVING) &&
                Math.abs(s.position.x - item.position.x) < 0.1 && 
                Math.abs(s.position.z - item.position.z) < 0.1
            );
            if (support && support.userData.grid) {
                const grid = support.userData.grid;
                const { col, row } = grid.worldToGrid(item.position);
                grid.occupy(col, row, 1, 1, item);
            }
        }
    });

    // Grouped floating labels: one per contiguous run of identical stations.
    groupLabelStations(levelLayout).forEach(run => {
        const first = run[0];
        const isServe = first.type === STATION_TYPES.SERVING;
        const text = isServe ? 'serve_label' : first.name;
        const cx = run.reduce((sum, d) => sum + d.position.x, 0) / run.length;
        const cz = run.reduce((sum, d) => sum + d.position.z, 0) / run.length;
        createLabel(
            scene,
            text,
            new THREE.Vector3(cx, isServe ? LABEL_SERVE_Y : LABEL_STATION_Y, cz),
            0
        );
    });

    return { stations: newStations, stationInteractables: newStationInteractables, floorMesh: currentFloor };
}
