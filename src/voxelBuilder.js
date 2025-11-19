import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { GRID_UNIT } from './constants.js';

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
    MUSHROOM: 0xa1887f
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
    vb.addBox(4, 9, 4, 4, 14, 4, PALETTE.BLACK);
    vb.addBox(4, 14, 4, 11, 14, 4, PALETTE.BLACK);
    vb.addBox(4, 5, 4, 11, 8, 11, PALETTE.METAL_DARK);
    const mesh = vb.buildMesh();
    mesh.position.y = GRID_UNIT/2;
    return mesh;
}

export function createCuttingBoardMesh() {
    const vb = new VoxelBuilder();
    vb.addBox(2, 0, 2, 13, 1, 13, PALETTE.WOOD_BOARD);
    vb.addBox(10, 1, 3, 10, 1, 10, PALETTE.METAL_SHINY); 
    vb.addBox(10, 1, 11, 10, 1, 13, PALETTE.BLACK); 
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
    vb.addBox(3, 1, 14, 4, 1, 15, PALETTE.PLASTIC_RED);
    vb.addBox(11, 1, 14, 12, 1, 15, PALETTE.PLASTIC_RED);
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

export function createIngredientBinMesh(ingredientType) {
    const vb = new VoxelBuilder();
    vb.addBox(1, 0, 1, 14, 6, 14, PALETTE.WOOD_LIGHT);
    vb.addBox(2, 1, 2, 13, 6, 13, PALETTE.BLACK); 
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

function getIngredientColor(type) {
    if(type.includes('tomato')) return PALETTE.TOMATO;
    if(type.includes('lettuce')) return PALETTE.LETTUCE;
    if(type.includes('cheese')) return PALETTE.CHEESE;
    if(type.includes('bun')) return PALETTE.BUN;
    if(type.includes('patty')) return PALETTE.MEAT_RAW;
    if(type.includes('cooked_patty')) return PALETTE.MEAT_COOKED;
    if(type.includes('potato')) return PALETTE.POTATO;
    if(type.includes('fries')) return PALETTE.FRIES_RAW;
    if(type.includes('onion')) return PALETTE.ONION;
    return PALETTE.WHITE;
}

export function createItemMesh(type) {
    const vb = new VoxelBuilder();
    
    if (type === 'plate') {
        vb.addBox(2, 0, 2, 13, 1, 13, PALETTE.PLATE_WHITE);
        vb.addBox(2, 1, 2, 13, 2, 3, PALETTE.PLATE_WHITE); 
        vb.addBox(2, 1, 12, 13, 2, 13, PALETTE.PLATE_WHITE);
        vb.addBox(2, 1, 3, 3, 2, 12, PALETTE.PLATE_WHITE);
        vb.addBox(12, 1, 3, 13, 2, 12, PALETTE.PLATE_WHITE);
    } 
    else if (type.includes('tomato')) {
        vb.addBox(5, 0, 5, 10, 4, 10, PALETTE.TOMATO);
        vb.addBox(6, 4, 6, 9, 5, 9, PALETTE.LETTUCE);
    }
    else if (type.includes('lettuce')) {
        vb.addBox(4, 0, 4, 11, 7, 11, PALETTE.LETTUCE);
    }
    else if (type.includes('potato')) {
        vb.addBox(5, 0, 4, 10, 3, 11, PALETTE.POTATO);
    }
    else if (type === 'raw_fries') {
        vb.addBox(6, 0, 4, 7, 4, 5, PALETTE.FRIES_RAW);
        vb.addBox(8, 0, 6, 9, 4, 7, PALETTE.FRIES_RAW);
        vb.addBox(5, 0, 7, 6, 4, 8, PALETTE.FRIES_RAW);
    }
    else if (type === 'cooked_fries') {
        vb.addBox(6, 0, 4, 7, 4, 5, PALETTE.FRIES_COOKED);
        vb.addBox(8, 0, 6, 9, 4, 7, PALETTE.FRIES_COOKED);
        vb.addBox(5, 0, 7, 6, 4, 8, PALETTE.FRIES_COOKED);
    }
    else if (type.includes('patty')) {
        const c = type.includes('cooked') ? PALETTE.MEAT_COOKED : PALETTE.MEAT_RAW;
        vb.addBox(3, 0, 3, 12, 2, 12, c);
    }
    else if (type === 'bun') {
        vb.addBox(3, 0, 3, 12, 3, 12, PALETTE.BUN);
    }
    else if (type === 'cheese_slice') {
        vb.addBox(3, 0, 3, 12, 1, 12, PALETTE.CHEESE);
    }
    else {
        vb.addBox(4, 0, 4, 11, 7, 11, PALETTE.PLASTIC_BLUE);
    }

    const mesh = vb.buildMesh();
    
    // *** KEY FIX: NORMALIZE ORIGIN ***
    // VoxelBuilder 0,0,0 is center of grid unit.
    // This shift makes (0,0,0) the BOTTOM of the mesh.
    // Interaction Manager logic `yBase - minLocalY` relies on this.
    mesh.geometry.translate(0, GRID_UNIT/2, 0); 
    
    return mesh;
}