import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { GRID_UNIT, INGREDIENT_RENDER_ORDER } from './constants.js';

const VOXEL_RESOLUTION = 16;  
const VOXEL_SIZE = GRID_UNIT / VOXEL_RESOLUTION; 

export const PALETTE = {
    WOOD_DARK: 0x5d4037,
    WOOD_LIGHT: 0x8d6e63,
    WOOD_BOARD: 0xeecfa1,
    METAL_DARK: 0x424242,
    METAL_LIGHT: 0xbdbdbd,
    METAL_SHINY: 0xe0e0e0,
    BLACK: 0x1a1a1a,
    COUNTER_TOP: 0xf5f5f5, 
    TRASH_GREEN: 0x2e7d32,
    TRASH_LID: 0x1b5e20,
    PLASTIC_RED: 0xc62828,
    PLASTIC_BLUE: 0x1565c0,
    OIL_GOLD: 0xffd700,
    WATER_BLUE: 0x29b6f6,
    FIRE_ORANGE: 0xff5722,
    TOMATO: 0xd32f2f,
    LETTUCE: 0x43a047,
    CHEESE: 0xfbc02d,
    BUN: 0xf4a460,
    MEAT_RAW: 0xe57373,
    MEAT_COOKED: 0x5d4037,
    POTATO: 0xd7ccc8,
    FRIES_RAW: 0xffecb3,
    FRIES_COOKED: 0xffeb3b,
    PLATE_WHITE: 0xffffff,
    ONION: 0xeceff1,
    MUSHROOM: 0xa1887f,
    WALL_WHITE: 0xEFEBE9,
    // New Colors
    CHICKEN_RAW: 0xFFB6C1,
    CHICKEN_COOKED: 0xCD853F,
    BACON_RAW: 0xFA8072,
    BACON_COOKED: 0x8B0000,
    EGG_WHITE: 0xFFFFFF,
    EGG_YOLK: 0xFFD700,
    PANCAKE: 0xF4A460,
    PIZZA_CRUST: 0xDEB887,
    SAUCE_RED: 0xB22222,
    MOZZARELLA: 0xFFFFF0,
    BANANA: 0xFFE135,
    STRAWBERRY: 0xFC5A8D,
    GLASS_BLUE: 0xAADDFF
};

export class VoxelBuilder {
    constructor() {
        this.geometries = [];
        this.baseGeometry = new THREE.BoxGeometry(VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE);
    }

    add(x, y, z, color) {
        const matrix = new THREE.Matrix4();
        const offset = (VOXEL_SIZE / 2);
        const tx = (x * VOXEL_SIZE) - (GRID_UNIT / 2) + offset;
        const ty = (y * VOXEL_SIZE) - (GRID_UNIT / 2) + offset;
        const tz = (z * VOXEL_SIZE) - (GRID_UNIT / 2) + offset;
        matrix.makeTranslation(tx, ty, tz);

        const geometry = this.baseGeometry.clone();
        geometry.applyMatrix4(matrix);

        const colors = [];
        const c = new THREE.Color(color);
        for (let i = 0; i < geometry.attributes.position.count; i++) {
            colors.push(c.r, c.g, c.b);
        }
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        this.geometries.push(geometry);
        return this;
    }

    addBox(x1, y1, z1, x2, y2, z2, color) {
        for(let x = x1; x <= x2; x++) {
            for(let y = y1; y <= y2; y++) {
                for(let z = z1; z <= z2; z++) {
                    this.add(x, y, z, color);
                }
            }
        }
        return this;
    }

    buildMesh() {
        if (this.geometries.length === 0) return new THREE.Mesh();
        const mergedGeometry = BufferGeometryUtils.mergeGeometries(this.geometries, false);
        const material = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.8,
            metalness: 0.1,
            flatShading: true
        });
        const mesh = new THREE.Mesh(mergedGeometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.geometries.forEach(g => g.dispose());
        this.geometries = [];
        return mesh;
    }
}

// --- APPLIANCES ---

export function createTrashBinMesh() {
    const vb = new VoxelBuilder();
    vb.addBox(3, 0, 3, 12, 10, 12, PALETTE.TRASH_GREEN);
    vb.addBox(2, 10, 2, 13, 11, 13, PALETTE.TRASH_LID);
    vb.addBox(6, 0, 13, 9, 1, 15, PALETTE.METAL_LIGHT);
    vb.addBox(4, 9, 4, 11, 10, 11, PALETTE.BLACK);
    const mesh = vb.buildMesh();
    mesh.position.y = GRID_UNIT/2; 
    return mesh;
}

export function createFryerMesh() {
    const vb = new VoxelBuilder();
    vb.addBox(1, 0, 1, 14, 8, 14, PALETTE.METAL_SHINY);
    vb.addBox(2, 5, 2, 13, 7, 13, PALETTE.OIL_GOLD);
    vb.addBox(1, 8, 1, 14, 12, 3, PALETTE.METAL_DARK);
    vb.addBox(4, 9, 4, 4, 14, 4, PALETTE.BLACK); // Basket handle L
    vb.addBox(11, 9, 4, 11, 14, 4, PALETTE.BLACK); // Basket handle R
    vb.addBox(4, 5, 4, 11, 8, 11, PALETTE.METAL_DARK); // Basket mesh area
    const mesh = vb.buildMesh();
    mesh.position.y = GRID_UNIT/2;
    return mesh;
}

export function createCuttingBoardMesh() {
    const vb = new VoxelBuilder();
    vb.addBox(2, 0, 2, 13, 1, 13, PALETTE.WOOD_BOARD);
    vb.addBox(10, 1, 3, 10, 1, 10, PALETTE.METAL_SHINY); // Knife blade
    vb.addBox(10, 1, 11, 10, 1, 13, PALETTE.BLACK); // Knife handle
    const mesh = vb.buildMesh();
    mesh.position.y = GRID_UNIT/2;
    return mesh;
}

export function createStoveMesh() {
    const vb = new VoxelBuilder();
    vb.addBox(1, 0, 1, 14, 2, 14, PALETTE.METAL_DARK);
    vb.addBox(2, 2, 2, 13, 2, 13, PALETTE.BLACK);
    vb.addBox(4, 2, 4, 5, 2, 5, PALETTE.FIRE_ORANGE);
    vb.addBox(10, 2, 10, 11, 2, 11, PALETTE.FIRE_ORANGE);
    vb.addBox(3, 1, 14, 4, 1, 15, PALETTE.PLASTIC_RED); // Knob
    vb.addBox(11, 1, 14, 12, 1, 15, PALETTE.PLASTIC_RED); // Knob
    const mesh = vb.buildMesh();
    mesh.position.y = GRID_UNIT/2;
    return mesh;
}

export function createSinkMesh() {
    const vb = new VoxelBuilder();
    vb.addBox(1, 0, 1, 14, 4, 14, PALETTE.METAL_SHINY);
    vb.addBox(2, 2, 2, 13, 3, 13, PALETTE.WATER_BLUE);
    vb.addBox(7, 4, 1, 8, 10, 2, PALETTE.METAL_LIGHT); 
    vb.addBox(7, 10, 2, 8, 11, 8, PALETTE.METAL_LIGHT); 
    vb.addBox(7, 8, 8, 8, 9, 8, PALETTE.METAL_LIGHT); 
    const mesh = vb.buildMesh();
    mesh.position.y = GRID_UNIT/2;
    return mesh;
}

export function createToasterMesh() {
    const vb = new VoxelBuilder();
    vb.addBox(3, 0, 3, 12, 6, 12, PALETTE.METAL_SHINY);
    vb.addBox(4, 6, 5, 11, 6, 6, PALETTE.BLACK); // Slot 1
    vb.addBox(4, 6, 9, 11, 6, 10, PALETTE.BLACK); // Slot 2
    vb.addBox(13, 2, 7, 14, 4, 8, PALETTE.BLACK); // Lever
    const mesh = vb.buildMesh();
    mesh.position.y = GRID_UNIT/2;
    return mesh;
}

export function createMixerMesh() {
    const vb = new VoxelBuilder();
    vb.addBox(4, 0, 4, 11, 1, 11, PALETTE.METAL_LIGHT); // Base
    vb.addBox(4, 1, 4, 6, 10, 6, PALETTE.METAL_LIGHT); // Neck
    vb.addBox(4, 10, 4, 11, 12, 6, PALETTE.METAL_LIGHT); // Top arm
    vb.addBox(9, 2, 6, 11, 6, 11, PALETTE.METAL_SHINY); // Bowl
    vb.addBox(9, 6, 8, 9, 10, 9, PALETTE.METAL_DARK); // Beater
    const mesh = vb.buildMesh();
    mesh.position.y = GRID_UNIT/2;
    return mesh;
}

export function createBlenderMesh() {
    const vb = new VoxelBuilder();
    vb.addBox(5, 0, 5, 10, 4, 10, PALETTE.METAL_DARK); // Base
    vb.addBox(6, 4, 6, 9, 11, 9, PALETTE.GLASS_BLUE); // Jug
    vb.addBox(6, 11, 6, 9, 12, 9, PALETTE.BLACK); // Lid
    const mesh = vb.buildMesh();
    mesh.position.y = GRID_UNIT/2;
    return mesh;
}

export function createDoughPressMesh() {
    const vb = new VoxelBuilder();
    vb.addBox(2, 0, 2, 13, 1, 13, PALETTE.METAL_LIGHT); // Base
    vb.addBox(7, 1, 2, 8, 8, 3, PALETTE.METAL_DARK); // Hinge pillar
    vb.addBox(3, 8, 3, 12, 9, 12, PALETTE.METAL_LIGHT); // Top Plate
    vb.addBox(7, 9, 7, 8, 12, 8, PALETTE.BLACK); // Handle vert
    vb.addBox(5, 12, 7, 10, 13, 8, PALETTE.BLACK); // Handle horiz
    const mesh = vb.buildMesh();
    mesh.position.y = GRID_UNIT/2;
    return mesh;
}

export function createPizzaOvenMesh() {
    const vb = new VoxelBuilder();
    vb.addBox(1, 0, 1, 14, 1, 14, PALETTE.METAL_DARK); // Floor
    // Arch
    vb.addBox(1, 1, 1, 3, 10, 14, PALETTE.WOOD_DARK); // L wall
    vb.addBox(12, 1, 1, 14, 10, 14, PALETTE.WOOD_DARK); // R wall
    vb.addBox(1, 1, 1, 14, 10, 3, PALETTE.WOOD_DARK); // Back wall
    vb.addBox(1, 10, 1, 14, 12, 14, PALETTE.WOOD_DARK); // Roof
    vb.addBox(6, 2, 6, 9, 4, 9, PALETTE.FIRE_ORANGE); // Fire inside
    const mesh = vb.buildMesh();
    mesh.position.y = GRID_UNIT/2;
    return mesh;
}

export function createTableMesh(neighbors) {
    const vb = new VoxelBuilder();
    // Top
    vb.addBox(0, 15, 0, 15, 15, 15, PALETTE.METAL_SHINY);
    vb.addBox(1, 5, 1, 14, 5, 14, PALETTE.METAL_DARK); // Underside brace
    
    // Smart Legs Logic: Add leg only if no neighbor in that direction
    // Corners need legs if either adjacent side is open? 
    // Standard logic: 4 corners. 
    // NW Leg (x=1, z=1) - Remove if N or W has neighbor?
    // Actually, tables usually fuse. If there is a table to the West, we don't need the West legs? 
    // Or rather, shared legs?
    // Let's simply: Only place a leg if NO neighbor is present on the two adjacent sides.
    
    const addLeg = (x, z) => vb.addBox(x, 0, z, x+1, 14, z+1, PALETTE.METAL_LIGHT);
    
    // NW Corner (1,1)
    if(!neighbors.w && !neighbors.n) addLeg(1, 1);
    
    // NE Corner (13,1)
    if(!neighbors.e && !neighbors.n) addLeg(13, 1);
    
    // SW Corner (1,13)
    if(!neighbors.w && !neighbors.s) addLeg(1, 13);
    
    // SE Corner (13,13)
    if(!neighbors.e && !neighbors.s) addLeg(13, 13);

    const mesh = vb.buildMesh();
    mesh.scale.set(1, GRID_UNIT*1.8 / GRID_UNIT, 1); // Adjust height scalar (1.8 units ~ 0.9 world height)
    // Wait, normal voxel scale is 1.
    // GRID_UNIT is 0.5. 
    // Voxel Size = 0.5/16.
    // Mesh is 16 voxels high = 0.5 height.
    // We want 0.9 height. Scale Y by 1.8.
    mesh.scale.set(1, 1.8, 1);
    
    mesh.position.y = (GRID_UNIT * 1.8) / 2;
    return mesh;
}

// --- SOURCES ---

export function createIngredientBinMesh(ingredientType) {
    const vb = new VoxelBuilder();
    vb.addBox(1, 0, 1, 14, 6, 14, PALETTE.WOOD_LIGHT);
    vb.addBox(2, 1, 2, 13, 6, 13, PALETTE.BLACK); // Interior void illusion
    
    // Content fill
    const c = getIngredientColor(ingredientType);
    if (c) {
        vb.addBox(3, 2, 3, 6, 5, 6, c);
        vb.addBox(7, 3, 4, 10, 5, 8, c);
        vb.addBox(4, 4, 8, 8, 6, 11, c);
    }
    const mesh = vb.buildMesh();
    mesh.position.y = GRID_UNIT/2;
    return mesh;
}

export function createPlateStackMesh() {
    const vb = new VoxelBuilder();
    for(let y=0; y<8; y+=2) {
        vb.addBox(3, y, 3, 12, y+1, 12, PALETTE.PLATE_WHITE);
    }
    const mesh = vb.buildMesh();
    mesh.position.y = GRID_UNIT/2;
    return mesh;
}

export function createCupStackMesh() {
    const vb = new VoxelBuilder();
    // Stack of cups
    for(let i=0; i<3; i++) {
        let y = i * 3;
        vb.addBox(5, y, 5, 10, y+2, 10, PALETTE.WATER_BLUE);
    }
    const mesh = vb.buildMesh();
    mesh.position.y = GRID_UNIT/2;
    return mesh;
}

export function createBowlStackMesh() {
    const vb = new VoxelBuilder();
    for(let i=0; i<4; i++) {
        let y = i * 2;
        vb.addBox(4, y, 4, 11, y+1, 11, PALETTE.WOOD_BOARD); // Beige bowls
    }
    const mesh = vb.buildMesh();
    mesh.position.y = GRID_UNIT/2;
    return mesh;
}

// --- HELPERS ---

function getIngredientColor(type) {
    if(type.includes('tomato')) return type.includes('sauce') ? PALETTE.SAUCE_RED : PALETTE.TOMATO;
    if(type.includes('lettuce')) return PALETTE.LETTUCE;
    if(type.includes('cheese') || type.includes('mozzarella')) return PALETTE.CHEESE;
    if(type.includes('bun') || type.includes('bread')) return PALETTE.BUN;
    if(type.includes('patty')) return PALETTE.MEAT_RAW;
    if(type.includes('cooked_patty')) return PALETTE.MEAT_COOKED;
    if(type.includes('potato')) return PALETTE.POTATO;
    if(type.includes('fries')) return PALETTE.FRIES_RAW;
    if(type.includes('onion')) return PALETTE.ONION;
    if(type.includes('chicken')) return PALETTE.CHICKEN_RAW;
    if(type.includes('bacon')) return PALETTE.BACON_RAW;
    if(type.includes('banana')) return PALETTE.BANANA;
    if(type.includes('strawberry')) return PALETTE.STRAWBERRY;
    if(type.includes('egg')) return PALETTE.EGG_WHITE;
    if(type.includes('pizza')) return PALETTE.PIZZA_CRUST;
    if(type.includes('coating')) return PALETTE.WOOD_BOARD;
    return null;
}

// --- ITEMS (Physical objects in hand/world) ---

export function createItemMesh(type, contents = [], mealName = null) {
    const vb = new VoxelBuilder();
    
    if (type === 'plate') {
        // Build the physical plate
        vb.addBox(2, 0, 2, 13, 1, 13, PALETTE.PLATE_WHITE);
        vb.addBox(2, 1, 2, 13, 2, 3, PALETTE.PLATE_WHITE); 
        vb.addBox(2, 1, 12, 13, 2, 13, PALETTE.PLATE_WHITE);
        vb.addBox(2, 1, 3, 3, 2, 12, PALETTE.PLATE_WHITE);
        vb.addBox(12, 1, 3, 13, 2, 12, PALETTE.PLATE_WHITE);
    } 
    else if (type === 'bowl') {
        vb.addBox(3, 0, 3, 12, 1, 12, PALETTE.WOOD_BOARD);
        vb.addBox(3, 1, 3, 12, 4, 4, PALETTE.WOOD_BOARD);
        vb.addBox(3, 1, 11, 12, 4, 12, PALETTE.WOOD_BOARD);
        vb.addBox(3, 1, 4, 4, 4, 11, PALETTE.WOOD_BOARD);
        vb.addBox(11, 1, 4, 12, 4, 11, PALETTE.WOOD_BOARD);
    }
    else if (type === 'cup') {
        vb.addBox(5, 0, 5, 10, 6, 10, PALETTE.GLASS_BLUE);
    }
    // --- Food Items ---
    else if (type.includes('tomato')) {
        if (type.includes('sauce')) {
             vb.addBox(4, 0, 4, 11, 5, 11, PALETTE.METAL_LIGHT); // Can
             vb.addBox(4, 2, 4, 11, 4, 11, PALETTE.SAUCE_RED); // Label
        } else if (type.includes('chopped')) {
            // Chopped tomato: Draw two flat tomato slices/quarters lying down
            // Slice 1: center at (5.5, 0.5, 5.5)
            for (let x = 2; x <= 9; x++) {
                for (let z = 2; z <= 9; z++) {
                    const dx = x - 5.5;
                    const dz = z - 5.5;
                    if (dx*dx + dz*dz <= 12.25) {
                        const isRim = (dx*dx + dz*dz >= 6.25);
                        vb.add(x, 0, z, isRim ? PALETTE.TOMATO : 0xe53935);
                        if (!isRim && (x+z)%2 === 0) {
                            vb.add(x, 1, z, 0xffd54f); // seeds
                        } else {
                            vb.add(x, 1, z, PALETTE.TOMATO);
                        }
                    }
                }
            }
            // Slice 2: center at (10.5, 0.5, 10.5)
            for (let x = 7; x <= 14; x++) {
                for (let z = 7; z <= 14; z++) {
                    const dx = x - 10.5;
                    const dz = z - 10.5;
                    if (dx*dx + dz*dz <= 12.25) {
                        const isRim = (dx*dx + dz*dz >= 6.25);
                        vb.add(x, 0, z, isRim ? PALETTE.TOMATO : 0xe53935);
                        if (!isRim && (x+z)%2 === 1) {
                            vb.add(x, 1, z, 0xffd54f); // seeds
                        } else {
                            vb.add(x, 1, z, PALETTE.TOMATO);
                        }
                    }
                }
            }
        } else {
            // Rounded tomato
            const rx = 4.5, ry = 3.5, rz = 4.5;
            const cx = 7.5, cy = 3.5, cz = 7.5;
            for (let x = 3; x <= 12; x++) {
                for (let y = 0; y <= 7; y++) {
                    for (let z = 3; z <= 12; z++) {
                        const dx = (x - cx) / rx;
                        const dy = (y - cy) / ry;
                        const dz = (z - cz) / rz;
                        if (dx*dx + dy*dy + dz*dz <= 1.0) {
                            vb.add(x, y, z, PALETTE.TOMATO);
                        }
                    }
                }
            }
            // Leaf/Stem star on top
            vb.add(7, 8, 7, 0x2e7d32); // Stem center high
            vb.add(7, 7, 7, 0x2e7d32); // Stem center
            // Star leaves
            vb.add(6, 7, 7, PALETTE.LETTUCE);
            vb.add(8, 7, 7, PALETTE.LETTUCE);
            vb.add(7, 7, 6, PALETTE.LETTUCE);
            vb.add(7, 7, 8, PALETTE.LETTUCE);
            vb.add(5, 7, 5, PALETTE.LETTUCE);
            vb.add(9, 7, 9, PALETTE.LETTUCE);
            vb.add(5, 7, 9, PALETTE.LETTUCE);
            vb.add(9, 7, 5, PALETTE.LETTUCE);
        }
    }
    else if (type.includes('lettuce')) {
        if (type.includes('chopped')) {
            // Chopped lettuce: scattered small green strips/leafy bits
            vb.addBox(3, 0, 3, 6, 0, 4, PALETTE.LETTUCE);
            vb.addBox(5, 1, 3, 7, 1, 5, 0x66bb6a);
            vb.addBox(8, 0, 4, 11, 0, 5, PALETTE.LETTUCE);
            vb.addBox(9, 1, 5, 10, 1, 8, 0x66bb6a);
            vb.addBox(4, 0, 8, 5, 0, 12, PALETTE.LETTUCE);
            vb.addBox(5, 1, 10, 8, 1, 11, 0x66bb6a);
            vb.addBox(9, 0, 9, 12, 0, 10, 0x2e7d32);
            vb.addBox(10, 1, 8, 12, 1, 12, PALETTE.LETTUCE);
        } else {
            // Lettuce head: bulbous sphere with leafy folds
            const cx = 7.5, cy = 4.5, cz = 7.5;
            const r = 4.5;
            for (let x = 3; x <= 12; x++) {
                for (let y = 0; y <= 8; y++) {
                    for (let z = 3; z <= 12; z++) {
                        const dx = x - cx;
                        const dy = y - cy;
                        const dz = z - cz;
                        if (dx*dx + dy*dy + dz*dz <= r*r) {
                            let color = PALETTE.LETTUCE;
                            if ((x + y + z) % 3 === 0) {
                                color = 0x66bb6a; // Lighter green leaf highlight
                            } else if ((x - y + z) % 4 === 0) {
                                color = 0x2e7d32; // Darker green leaf shadow
                            }
                            vb.add(x, y, z, color);
                        }
                    }
                }
            }
        }
    }
    else if (type.includes('potato')) {
        // Draw an organic rounded potato
        const rx = 4.5, ry = 3.5, rz = 5.5;
        const cx = 7.5, cy = 3.5, cz = 7.5;
        for (let x = 3; x <= 12; x++) {
            for (let y = 0; y <= 7; y++) {
                for (let z = 2; z <= 13; z++) {
                    const dx = (x - cx) / rx;
                    const dy = (y - cy) / ry;
                    const dz = (z - cz) / rz;
                    if (dx*dx + dy*dy + dz*dz <= 1.0) {
                        let color = PALETTE.POTATO;
                        // Add some eyes (dark spots)
                        if ((x === 4 && y === 4 && z === 5) || 
                            (x === 11 && y === 2 && z === 8) || 
                            (x === 7 && y === 6 && z === 11) ||
                            (x === 8 && y === 1 && z === 3)) {
                            color = 0x8d6e63; // Slightly darker potato eye
                        }
                        vb.add(x, y, z, color);
                    }
                }
            }
        }
    }
    else if (type === 'raw_fries') {
        vb.addBox(6, 0, 4, 7, 4, 5, PALETTE.FRIES_RAW); vb.addBox(8, 0, 6, 9, 4, 7, PALETTE.FRIES_RAW); vb.addBox(5, 0, 7, 6, 4, 8, PALETTE.FRIES_RAW);
    }
    else if (type === 'cooked_fries') {
        vb.addBox(6, 0, 4, 7, 4, 5, PALETTE.FRIES_COOKED); vb.addBox(8, 0, 6, 9, 4, 7, PALETTE.FRIES_COOKED); vb.addBox(5, 0, 7, 6, 4, 8, PALETTE.FRIES_COOKED);
    }
    else if (type.includes('patty')) {
        const isCooked = type.includes('cooked');
        const c = isCooked ? PALETTE.MEAT_COOKED : PALETTE.MEAT_RAW;
        const cx = 7.5, cz = 7.5, r = 4.8;
        for (let x = 2; x <= 13; x++) {
            for (let z = 2; z <= 13; z++) {
                const dx = x - cx;
                const dz = z - cz;
                if (dx*dx + dz*dz <= r*r) {
                    for (let y = 0; y <= 1; y++) {
                        let voxelColor = c;
                        if (isCooked) {
                            // Cooked: Add dark grill marks on the top surface (y === 1)
                            if (y === 1 && (x + z) % 4 === 0) {
                                voxelColor = 0x271a15; // Dark charcoal grill lines
                            }
                        } else {
                            // Raw: Add some fat marbling (white streaks)
                            if ((x - z) === 2 || (x + z) === 10) {
                                voxelColor = 0xffebee; // Pinkish-white fat marbling
                            }
                        }
                        vb.add(x, y, z, voxelColor);
                    }
                }
            }
        }
    }
    else if (type === 'bun' || type.includes('bread') || type === 'bun_bottom' || type === 'bun_top') {
        const isToasted = type.includes('toasted');
        const c = isToasted ? PALETTE.WOOD_DARK : PALETTE.BUN;
        const drawBottom = type !== 'bun_top';
        const drawTop = type !== 'bun_bottom';
        
        const cx = 7.5, cz = 7.5;
        
        // Bottom Bun (y=0 to y=1)
        if (drawBottom) {
            for (let y = 0; y <= 1; y++) {
                let r = y === 0 ? 4.2 : 4.8;
                for (let x = 2; x <= 13; x++) {
                    for (let z = 2; z <= 13; z++) {
                        const dx = x - cx, dz = z - cz;
                        if (dx*dx + dz*dz <= r*r) {
                            vb.add(x, y, z, c);
                        }
                    }
                }
            }
        }
        
        // Top Bun (y=2 to y=4)
        if (drawTop) {
            // Offset y if we are only drawing the top half so it rests on the ground if spawned alone
            const yOffset = drawBottom ? 0 : -2; 
            for (let y = 2; y <= 4; y++) {
                let r = 4.8;
                if (y === 3) r = 4.2;
                if (y === 4) r = 3.2;
                
                for (let x = 2; x <= 13; x++) {
                    for (let z = 2; z <= 13; z++) {
                        const dx = x - cx, dz = z - cz;
                        if (dx*dx + dz*dz <= r*r) {
                            let voxelColor = c;
                            if (!isToasted && y === 4 && (x + z) % 3 === 0 && (x * z) % 2 === 0) {
                                voxelColor = 0xfffdd0;
                            }
                            vb.add(x, y + yOffset, z, voxelColor);
                        }
                    }
                }
            }
        }
    }
    else if (type.includes('cheese') || type.includes('mozzarella')) {
        const isMozzarella = type.includes('mozzarella');
        const color = isMozzarella ? PALETTE.MOZZARELLA : PALETTE.CHEESE;
        if (isMozzarella) {
            // Rounded slice of mozzarella
            const cx = 7.5, cz = 7.5, r = 4.5;
            for (let x = 3; x <= 12; x++) {
                for (let z = 3; z <= 12; z++) {
                    const dx = x - cx;
                    const dz = z - cz;
                    if (dx*dx + dz*dz <= r*r) {
                        vb.add(x, 0, z, color);
                    }
                }
            }
        } else {
            // Cheddar cheese slice
            vb.addBox(3, 0, 3, 12, 0, 12, color);
        }
    }
    else if (type.includes('chicken')) {
        const c = type.includes('cooked') ? PALETTE.CHICKEN_COOKED : (type.includes('coated') ? PALETTE.WOOD_BOARD : PALETTE.CHICKEN_RAW);
        vb.addBox(4, 0, 4, 11, 3, 9, c);
    }
    else if (type.includes('bacon')) {
        const c = type.includes('cooked') ? PALETTE.BACON_COOKED : PALETTE.BACON_RAW;
        vb.addBox(2, 0, 6, 13, 1, 9, c);
    }
    else if (type.includes('onion')) {
        vb.addBox(5, 0, 5, 10, 5, 10, PALETTE.ONION);
    }
    else if (type.includes('banana')) {
        vb.addBox(3, 0, 7, 12, 3, 9, PALETTE.BANANA); // Curved shape approximation
    }
    else if (type.includes('strawberry')) {
        vb.addBox(6, 0, 6, 9, 3, 9, PALETTE.STRAWBERRY);
    }
    else if (type.includes('pizza_dough') || type.includes('pizza_base')) {
        vb.addBox(3, 0, 3, 12, 2, 12, PALETTE.PIZZA_CRUST);
    }
    else if (type.includes('pizza_margherita')) {
        const c = type.includes('cooked') ? PALETTE.PIZZA_CRUST : PALETTE.PIZZA_CRUST;
        vb.addBox(3, 0, 3, 12, 2, 12, c);
        vb.addBox(4, 2, 4, 11, 3, 11, PALETTE.SAUCE_RED);
        vb.addBox(5, 3, 5, 10, 4, 10, PALETTE.MOZZARELLA);
    }
    else if (type.includes('egg')) {
        vb.addBox(6, 0, 6, 9, 4, 9, PALETTE.EGG_WHITE);
    }
    else if (type.includes('pancake')) {
        if (type.includes('mix') || type.includes('batter')) vb.addBox(5, 0, 5, 10, 6, 10, PALETTE.WOOD_BOARD); // Box
        else vb.addBox(3, 0, 3, 12, 2, 12, PALETTE.PANCAKE); // Cooked
    }
    else if (type.includes('omelette')) {
        vb.addBox(3, 0, 6, 12, 3, 10, PALETTE.EGG_YOLK); // Folded
    }
    else if (type.includes('milk') || type.includes('yogurt')) {
        vb.addBox(5, 0, 5, 10, 8, 10, PALETTE.WHITE);
    }
    else {
        vb.addBox(4, 0, 4, 11, 7, 11, PALETTE.PLASTIC_BLUE); // Generic
    }

    const mesh = vb.buildMesh();
    
    // *** KEY FIX: NORMALIZE ORIGIN ***
    // VoxelBuilder 0,0,0 is center of grid unit.
    // This shift makes (0,0,0) the BOTTOM of the mesh.
    mesh.geometry.translate(0, GRID_UNIT/2, 0); 
    
    return mesh;
}