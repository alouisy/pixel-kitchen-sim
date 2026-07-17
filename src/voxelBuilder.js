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

const ICONS = {
    patty: {
        art: [
            "                ",
            "                ",
            "     DDDDDD     ",
            "   DDMMMMMMDD   ",
            "  DMMMDDMMMMMD  ",
            "  DMMDDMMDDMMD  ",
            " DMMMDDMMMDDMMD ",
            " DMMDDMMMDDMMMD ",
            " DMMMDDMMMDDMMD ",
            " DMMMDDMMDDMMMD ",
            "  DMMMMDDMMMMD  ",
            "  DMMMMMMMMMMD  ",
            "   DDMMMMMMDD   ",
            "     DDDDDD     ",
            "                ",
            "                "
        ],
        colors: { M: 0xe57373, D: 0xb71c1c } 
    },
    raw_chicken: {
        art: [
            "                ",
            "                ",
            "            DD  ",
            "          DDDD  ",
            "         DDD D  ",
            "     DDDDDDD    ",
            "   DDDDDDDDD    ",
            "  DDDDDDDDDD    ",
            "  DDDDDDDDD     ",
            "   DDDDDDDD     ",
            "     WWWDD      ",
            "    WW W        ",
            "   WW           ",
            "  W             ",
            "                ",
            "                "
        ],
        colors: { D: 0xFFB6C1, W: 0xffffff } 
    },
    raw_bacon: {
        art: [
            "                ",
            "     MMMMMMMMM  ",
            "    MWWWWMMMM   ",
            "   MMMMWWWWMM   ",
            "   MMWMMMWMWM   ",
            "   MWWWWMMMMM   ",
            "   MMWWWWMMM    ",
            "   MMMWMMMWWM   ",
            "   MMMWWWWMMM   ",
            "   MMWWWWMMMM   ",
            "   MMMWMMMWWM   ",
            "    MMMMMMMM    ",
            "                ",
            "                ",
            "                ",
            "                "
        ],
        colors: { M: 0xFA8072, W: 0xffffff } 
    },
    cheese_slice: {
        art: [
            "                ",
            "                ",
            "   YYYYYYYYYY   ",
            "   YYYYYYYYYY   ",
            "   YYYYDDYYYY   ",
            "   YYDDYYYYYY   ",
            "   YYYYYYYYYY   ",
            "   YYYYYYYYDD   ",
            "   YYYYDDYYYY   ",
            "   YYDDYYYYYY   ",
            "   YYYYYYYYYY   ",
            "   YYYYYYYYYY   ",
            "   YYYYYYYYYY   ",
            "                ",
            "                ",
            "                "
        ],
        colors: { Y: 0xfbc02d, D: 0xf9a825 } 
    },
    shredded_mozzarella: {
        art: [
            "                ",
            "                ",
            "                ",
            "       WW       ",
            "      W  WW     ",
            "     W WW  W    ",
            "   WW W  WW W   ",
            "  W  WW WW  WW  ",
            " WW WW   WW W   ",
            " W WW  WW  W    ",
            "  WW WW WW W    ",
            "   WWWWWWWW     ",
            "                ",
            "                ",
            "                ",
            "                "
        ],
        colors: { W: 0xFFFFF0 } 
    },
    pizza_dough: {
        art: [
            "                ",
            "                ",
            "     DDDDDD     ",
            "   DDDDDDDDDD   ",
            "  DDDDDDDDDDDD  ",
            "  DDDDDDDDDDDD  ",
            " DDDDDDDDDDDDDD ",
            " DDDDDDDDDDDDDD ",
            " DDDDDDDDDDDDDD ",
            " DDDDDDDDDDDDDD ",
            "  DDDDDDDDDDDD  ",
            "  DDDDDDDDDDDD  ",
            "   DDDDDDDDDD   ",
            "     DDDDDD     ",
            "                ",
            "                "
        ],
        colors: { D: 0xDEB887 } 
    },
    egg: {
        art: [
            "                ",
            "                ",
            "                ",
            "     WWWWWW     ",
            "   WWWWWWWWWW   ",
            "  WWWWWWWWWWWW  ",
            "  WWWWYYYYWWWW  ",
            " WWWWYYYYYYWWWW ",
            " WWWWYYYYYYWWWW ",
            " WWWWYYYYYYWWWW ",
            "  WWWWYYYYWWWW  ",
            "  WWWWWWWWWWWW  ",
            "   WWWWWWWWWW   ",
            "     WWWWWW     ",
            "                ",
            "                "
        ],
        colors: { W: 0xFFFFFF, Y: 0xFFD700 } 
    },
    milk: {
        art: [
            "                ",
            "     WWWWWW     ",
            "    WWWWWWWW    ",
            "    WBBBBBBW    ",
            "   WWWWWWWWWW   ",
            "   WBBBBBBBBW   ",
            "   WBBBBBBBBW   ",
            "   WWWWWWWWWW   ",
            "   WBBBBBBBBW   ",
            "   WBBBBBBBBW   ",
            "   WWWWWWWWWW   ",
            "   WWWWWWWWWW   ",
            "                ",
            "                ",
            "                ",
            "                "
        ],
        colors: { W: 0xffffff, B: 0x29b6f6 }
    },
    yogurt: {
        art: [
            "                ",
            "                ",
            "                ",
            "    WWWWWWWW    ",
            "    W      W    ",
            "   WWWWWWWWWW   ",
            "   WBBBBBBBBW   ",
            "   WBBBBBBBBW   ",
            "   WWWWWWWWWW   ",
            "    WWWWWWWW    ",
            "    WWWWWWWW    ",
            "                ",
            "                ",
            "                ",
            "                ",
            "                "
        ],
        colors: { W: 0xffffff, B: 0x29b6f6 }
    },
    pancake_mix: {
        art: [
            "                ",
            "   BBBBBBBBBB   ",
            "   B        B   ",
            "   B Y    Y B   ",
            "   B Y    Y B   ",
            "   B YYYYYY B   ",
            "   B Y    Y B   ",
            "   B Y    Y B   ",
            "   B        B   ",
            "   BBBBBBBBBB   ",
            "   B YYYYYY B   ",
            "   BBBBBBBBBB   ",
            "                ",
            "                ",
            "                ",
            "                "
        ],
        colors: { B: 0x8B4513, Y: 0xF4A460 } 
    },
    tomato_sauce: {
        art: [
            "                ",
            "                ",
            "    MMMMMMMM    ",
            "   MMMMMMMMMM   ",
            "   MRRRRRRRRM   ",
            "   MRRRRRRRRM   ",
            "   MRRRRRRRRM   ",
            "   MRRRRRRRRM   ",
            "   MRRRRRRRRM   ",
            "   MRRRRRRRRM   ",
            "   MMMMMMMMMM   ",
            "    MMMMMMMM    ",
            "                ",
            "                ",
            "                ",
            "                "
        ],
        colors: { M: 0xbdbdbd, R: 0xB22222 } 
    },
    syrup: {
        art: [
            "                ",
            "      BBBB      ",
            "      BBBB      ",
            "      SSSS      ",
            "      SSSS      ",
            "     SSSSSS     ",
            "     S    S     ",
            "    SSSSSSSS    ",
            "    SSSSSSSS    ",
            "    SSSSSSSS    ",
            "    SSSSSSSS    ",
            "    SSSSSSSS    ",
            "     SSSSSS     ",
            "                ",
            "                ",
            "                "
        ],
        colors: { S: 0x8B4513, B: 0x1a1a1a } 
    },
    granola: {
        art: [
            "                ",
            "                ",
            "      BBBB      ",
            "     B    B     ",
            "    B      B    ",
            "    B O  O B    ",
            "   B  O OO  B   ",
            "   B O OO O B   ",
            "   B OOO OO B   ",
            "   B OOOOOO B   ",
            "    BBBBBBBB    ",
            "     BBBBBB     ",
            "                ",
            "                ",
            "                ",
            "                "
        ],
        colors: { O: 0xD2691E, B: 0x8d6e63 } 
    },
    coating_mix: {
        art: [
            "                ",
            "   BBBBBBBBBB   ",
            "   B        B   ",
            "   B  CCCC  B   ",
            "   B  CCCC  B   ",
            "   B  CCCC  B   ",
            "   B  CCCC  B   ",
            "   B  CCCC  B   ",
            "   B  CCCC  B   ",
            "   B        B   ",
            "   BBBBBBBBBB   ",
            "                ",
            "                ",
            "                ",
            "                ",
            "                "
        ],
        colors: { B: 0x8d6e63, C: 0xF5DEB3 }
    },
    potato: {
        art: [
            "                ",
            "                ",
            "                ",
            "     PPPPPP     ",
            "    PPPPPPPP    ",
            "   PPPPPPPPPP   ",
            "   PPPPPPPPPP   ",
            "  PPPPPPPPPPPP  ",
            "  PPPPPPPPPPPP  ",
            "  PPPPPPPPPPPP  ",
            "   PPPPPPPPPP   ",
            "   PPPPPPPPPP   ",
            "    PPPPPPPP    ",
            "     PPPPPP     ",
            "                ",
            "                "
        ],
        colors: { P: 0xd7ccc8 } 
    },
    tomato: {
        art: [
            "                ",
            "                ",
            "      GGGG      ",
            "     RRRRRR     ",
            "   RRRRRRRRRR   ",
            "  RRRRRRRRRRRR  ",
            " RRRRRRRRRRRRRR ",
            " RRRRRRRRRRRRRR ",
            " RRRRRRRRRRRRRR ",
            " RRRRRRRRRRRRRR ",
            "  RRRRRRRRRRRR  ",
            "   RRRRRRRRRR   ",
            "     RRRRRR     ",
            "                ",
            "                ",
            "                "
        ],
        colors: { R: 0xd32f2f, G: 0x43a047 } 
    },
    lettuce: {
        art: [
            "                ",
            "                ",
            "     GGGGGG     ",
            "    GGGGGGGG    ",
            "   GGLGGLGGLGG  ",
            "  GGGLGGGLGGGLG ",
            "  GGGGGGGGGGGGG ",
            " GGGGGGGGGGGGGG ",
            " GGGGGGGGGGGGGG ",
            " GGGGGGGGGGGGGG ",
            "  GGLGGGGLGGGG  ",
            "   GGGGGGGGGG   ",
            "    GGGGGGGG    ",
            "     GGGGGG     ",
            "                ",
            "                "
        ],
        colors: { G: 0x43a047, L: 0x66bb6a }
    },
    onion: {
        art: [
            "                ",
            "                ",
            "       YY       ",
            "       YY       ",
            "      OOOO      ",
            "     OOOOOO     ",
            "    OOOOOOOO    ",
            "    OOOOOOOO    ",
            "   OOOOOOOOOO   ",
            "   OOOOOOOOOO   ",
            "   OOOOOOOOOO   ",
            "    OOOOOOOO    ",
            "     OOOOOO     ",
            "                ",
            "                ",
            "                "
        ],
        colors: { O: 0xeceff1, Y: 0x81c784 } 
    },
    banana: {
        art: [
            "                ",
            "          YY    ",
            "         YYY    ",
            "        YYY     ",
            "       YYY      ",
            "      YYY       ",
            "     YYY        ",
            "    YYY         ",
            "    YYY         ",
            "   YYY          ",
            "   YY           ",
            "                ",
            "                ",
            "                ",
            "                ",
            "                "
        ],
        colors: { Y: 0xFFE135 } 
    },
    strawberry: {
        art: [
            "                ",
            "                ",
            "      GGGG      ",
            "     RRRRRR     ",
            "    RYRRYRRR    ",
            "    RRRRYRRY    ",
            "   RYRRRYRRRY   ",
            "   RRRYRRRYRR   ",
            "    RRRRRRRR    ",
            "    RYRRYRRR    ",
            "     RRRRRR     ",
            "      RRRR      ",
            "                ",
            "                ",
            "                ",
            "                "
        ],
        colors: { R: 0xFC5A8D, G: 0x43a047, Y: 0xffd54f } 
    },
    bun: {
        art: [
            "                ",
            "                ",
            "      BBBB      ",
            "    BBBBBBBB    ",
            "   BBBSBBBSBBB  ",
            "  BBBBBBBBBBBBB ",
            "  BSBBBSBBBSBBB ",
            " BBBBBBBBBBBBBBB",
            " BBSBBBSBBBSBBBB",
            " BBBBBBBBBBBBBBB",
            " BBBBBBBBBBBBBBB",
            "  BBBBBBBBBBBBB ",
            "   BBBBBBBBBBB  ",
            "                ",
            "                ",
            "                "
        ],
        colors: { B: 0xf4a460, S: 0xfffdd0 } 
    },
    bread_slice: {
        art: [
            "                ",
            "   CC      CC   ",
            "  CCCC    CCCC  ",
            " CCCCCCCCCCCCCC ",
            " CWWWWWWWWWWWWC ",
            " CWWWWWWWWWWWWC ",
            " CWWWWWWWWWWWWC ",
            " CWWWWWWWWWWWWC ",
            " CWWWWWWWWWWWWC ",
            " CWWWWWWWWWWWWC ",
            " CWWWWWWWWWWWWC ",
            " CWWWWWWWWWWWWC ",
            " CWWWWWWWWWWWWC ",
            "  CCCCCCCCCCCC  ",
            "                ",
            "                "
        ],
        colors: { C: 0xa0522d, W: 0xFFF8DC } 
    }
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
    
    const iconData = ICONS[ingredientType] || ICONS['potato'];
    const art = iconData ? iconData.art : null;
    const colors = iconData ? iconData.colors : null;
    
    // Fill the full 16x16 area
    for (let x = 0; x <= 15; x++) {
        for (let z = 0; z <= 15; z++) {
            let color = PALETTE.WOOD_BOARD; // Default beige background
            
            // Add a dark brown border to delimit plates side-by-side
            if (x === 0 || x === 15 || z === 0 || z === 15) {
                color = PALETTE.WOOD_DARK;
            } 
            // Draw the ingredient icon, scaled down to 12x12 (25% smaller) to leave room
            else if (art) {
                if (x >= 2 && x <= 13 && z >= 2 && z <= 13) {
                    const c = Math.floor((x - 2) * (16 / 12));
                    const r = Math.floor((z - 2) * (16 / 12));
                    
                    if (r < art.length && c < art[r].length) {
                        const char = art[r][c];
                        if (char !== ' ' && colors[char]) {
                            color = colors[char];
                        }
                    }
                }
            }
            vb.add(x, 0, z, color);
        }
    }
    
    const mesh = vb.buildMesh();
    mesh.position.y = GRID_UNIT/2;
    
    return mesh;
}

export function createPlateStackMesh() {
    const vb = new VoxelBuilder();
    const cx = 7.5, cz = 7.5;
    for(let i=0; i<6; i++) {
        const yBase = i * 2;
        for (let x = 1; x <= 14; x++) {
            for (let z = 1; z <= 14; z++) {
                const dist2 = (x-cx)*(x-cx) + (z-cz)*(z-cz);
                if (dist2 <= 36) {
                    if (dist2 >= 25) vb.add(x, yBase + 1, z, PALETTE.PLATE_WHITE); // Rim
                    vb.add(x, yBase, z, PALETTE.PLATE_WHITE); // Base
                }
            }
        }
    }
    const mesh = vb.buildMesh();
    mesh.position.y = GRID_UNIT/2;
    return mesh;
}

export function createCupStackMesh() {
    const vb = new VoxelBuilder();
    const cx = 7.5, cz = 7.5;
    for(let i=0; i<3; i++) {
        let yBase = i * 3;
        for (let y = 0; y <= 5; y++) {
            for (let x = 4; x <= 11; x++) {
                for (let z = 4; z <= 11; z++) {
                    const dist2 = (x-cx)*(x-cx) + (z-cz)*(z-cz);
                    if (dist2 <= 10) {
                        if (y === 0 || dist2 >= 5) {
                            vb.add(x, yBase + y, z, PALETTE.GLASS_BLUE);
                        }
                    }
                }
            }
        }
        // Handle
        vb.addBox(10, yBase + 2, 7, 12, yBase + 2, 8, PALETTE.GLASS_BLUE);
        vb.addBox(12, yBase + 2, 7, 12, yBase + 4, 8, PALETTE.GLASS_BLUE);
        vb.addBox(10, yBase + 4, 7, 12, yBase + 4, 8, PALETTE.GLASS_BLUE);
    }
    const mesh = vb.buildMesh();
    mesh.position.y = GRID_UNIT/2;
    return mesh;
}

export function createBowlStackMesh() {
    const vb = new VoxelBuilder();
    const cx = 7.5, cz = 7.5;
    for(let i=0; i<4; i++) {
        let yBase = i * 2;
        for (let y = 0; y <= 3; y++) {
            const rOuter = 4 + y*0.5;
            const rInner = y === 0 ? 0 : rOuter - 1.5;
            for (let x = 2; x <= 13; x++) {
                for (let z = 2; z <= 13; z++) {
                    const dist2 = (x-cx)*(x-cx) + (z-cz)*(z-cz);
                    if (dist2 <= rOuter*rOuter && dist2 >= rInner*rInner) {
                        vb.add(x, yBase + y, z, PALETTE.WOOD_BOARD);
                    }
                }
            }
        }
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
    if(type.includes('bread')) return type.includes('toasted') ? PALETTE.WOOD_BOARD : 0xFFF8DC;
    if(type.includes('bun')) return PALETTE.BUN;
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

const BREAD_GRID = [
    "  CC  CC  ",
    " CWWCCWWC ",
    "CWWWWWWWWC",
    "CWWWWWWWWC",
    "CWWWWWWWWC",
    "CWWWWWWWWC",
    "CWWWWWWWWC",
    "CWWWWWWWWC",
    " CWWWWWWC ",
    "  CCCCCC  "
];

function addSandwichHalf(vb, dx, dy, dz, isHalf2, isBLT, isCooked) {
    const crustColor = isCooked ? 0x5d4037 : 0xa0522d; // toasted vs raw sienna crust
    const crumbBaseColor = isCooked ? 0xeecfa1 : 0xFFF8DC; // toasted wood board vs cornsilk
    
    const maxLy = isBLT ? 6 : 5;
    
    for (let ly = 0; ly <= maxLy; ly++) {
        let layerType = 'bread'; 
        if (isBLT) {
            if (ly === 2) layerType = 'lettuce';
            else if (ly === 3) layerType = 'tomato';
            else if (ly === 4) layerType = 'bacon';
        } else {
            if (ly === 2 || ly === 3) layerType = 'cheese';
        }
        
        for (let pz = 0; pz < 10; pz++) {
            for (let px = 0; px < 10; px++) {
                const inHalf = !isHalf2 ? (px + pz <= 9) : (px + pz >= 10);
                if (!inHalf) continue;
                
                const gridChar = BREAD_GRID[pz][px];
                if (gridChar === ' ') continue; 
                
                const isCutFace = !isHalf2 ? (px + pz === 9) : (px + pz === 10);
                
                const x = px + 3 + dx;
                const z = pz + 3 + dz;
                const y = ly + dy;
                
                if (layerType === 'bread') {
                    const isCrust = (gridChar === 'C') && !isCutFace;
                    if (isCrust) {
                        vb.add(x, y, z, crustColor);
                    } else {
                        let color = crumbBaseColor;
                        if (isCooked) {
                            const noise = (x * 7 + z * 13 + y * 3) % 6;
                            if (noise === 0) color = 0xcd853f; 
                            else if (noise === 1) color = 0x8b4513; 
                            else if (noise === 2) color = 0xd7ccc8;
                        }
                        vb.add(x, y, z, color);
                    }
                } 
                else if (layerType === 'lettuce') {
                    let color = PALETTE.LETTUCE;
                    if ((x + z) % 3 === 0) color = 0x66bb6a; 
                    vb.add(x, y, z, color);
                } 
                else if (layerType === 'tomato') {
                    let color = PALETTE.TOMATO;
                    if ((x + z) % 2 === 0) color = 0xe53935; 
                    vb.add(x, y, z, color);
                } 
                else if (layerType === 'bacon') {
                    let color = PALETTE.BACON_COOKED;
                    if ((x + z) % 4 === 0) color = 0xffa07a; 
                    vb.add(x, y, z, color);
                } 
                else if (layerType === 'cheese') {
                    vb.add(x, y, z, PALETTE.CHEESE);
                }
            }
        }
    }
}

// --- ITEMS (Physical objects in hand/world) ---

export function createItemMesh(type, contents = [], mealName = null) {
    const vb = new VoxelBuilder();
    
    if (type === 'plate') {
        const cx = 7.5, cz = 7.5;
        for (let x = 1; x <= 14; x++) {
            for (let z = 1; z <= 14; z++) {
                const dist2 = (x-cx)*(x-cx) + (z-cz)*(z-cz);
                if (dist2 <= 36) {
                    if (dist2 >= 25) vb.add(x, 1, z, PALETTE.PLATE_WHITE); // Rim
                    vb.add(x, 0, z, PALETTE.PLATE_WHITE); // Base
                }
            }
        }
    } 
    else if (type === 'bowl') {
        const cx = 7.5, cz = 7.5;
        for (let y = 0; y <= 3; y++) {
            const rOuter = 4 + y*0.5;
            const rInner = y === 0 ? 0 : rOuter - 1.5;
            for (let x = 2; x <= 13; x++) {
                for (let z = 2; z <= 13; z++) {
                    const dist2 = (x-cx)*(x-cx) + (z-cz)*(z-cz);
                    if (dist2 <= rOuter*rOuter && dist2 >= rInner*rInner) {
                        vb.add(x, y, z, PALETTE.WOOD_BOARD);
                    }
                }
            }
        }
    }
    else if (type === 'cup') {
        const cx = 7.5, cz = 7.5;
        for (let y = 0; y <= 5; y++) {
            for (let x = 4; x <= 11; x++) {
                for (let z = 4; z <= 11; z++) {
                    const dist2 = (x-cx)*(x-cx) + (z-cz)*(z-cz);
                    if (dist2 <= 10) {
                        if (y === 0 || dist2 >= 5) {
                            vb.add(x, y, z, PALETTE.GLASS_BLUE);
                        }
                    }
                }
            }
        }
        vb.addBox(10, 2, 7, 12, 2, 8, PALETTE.GLASS_BLUE);
        vb.addBox(12, 2, 7, 12, 4, 8, PALETTE.GLASS_BLUE);
        vb.addBox(10, 4, 7, 12, 4, 8, PALETTE.GLASS_BLUE);
    }
    // --- Completed Meals ---
    else if (type === 'Hamburger' || type === 'Cheeseburger' || type === 'Cheeseburger Combo') {
        const hasCheese = type.includes('Cheeseburger');
        const cx = (type === 'Cheeseburger Combo') ? 5.5 : 7.5, cz = 7.5;
        for (let y = 0; y <= 1; y++) {
            let r = y === 0 ? 4.2 : 4.8;
            for (let x = 2; x <= 13; x++) {
                for (let z = 2; z <= 13; z++) {
                    if ((x-cx)*(x-cx) + (z-cz)*(z-cz) <= r*r) vb.add(x, y, z, PALETTE.BUN);
                }
            }
        }
        let pattyR = 4.8;
        for (let y = 2; y <= 3; y++) {
            for (let x = 2; x <= 13; x++) {
                for (let z = 2; z <= 13; z++) {
                    if ((x-cx)*(x-cx) + (z-cz)*(z-cz) <= pattyR*pattyR) {
                        let color = PALETTE.MEAT_COOKED;
                        if (y === 3 && (x + z) % 4 === 0) color = 0x271a15;
                        vb.add(x, y, z, color);
                    }
                }
            }
        }
        let currentY = 4;
        if (hasCheese) {
            const lx = Math.floor(cx - 4.5);
            const rx = Math.floor(cx + 4.5);
            vb.addBox(lx, currentY, 3, rx, currentY, 12, PALETTE.CHEESE);
            vb.addBox(lx, currentY-1, 6, lx, currentY, 9, PALETTE.CHEESE); 
            vb.addBox(rx, currentY-1, 6, rx, currentY, 9, PALETTE.CHEESE); 
            currentY++;
        }
        for (let y = currentY; y <= currentY+2; y++) {
            let r = 4.8;
            if (y === currentY+1) r = 4.2;
            if (y === currentY+2) r = 3.2;
            for (let x = 2; x <= 13; x++) {
                for (let z = 2; z <= 13; z++) {
                    if ((x-cx)*(x-cx) + (z-cz)*(z-cz) <= r*r) {
                        let voxelColor = PALETTE.BUN;
                        if (y === currentY+2 && (x + z) % 3 === 0 && (x * z) % 2 === 0) voxelColor = 0xfffdd0;
                        vb.add(x, y, z, voxelColor);
                    }
                }
            }
        }
        if (type === 'Cheeseburger Combo') {
            // Draw some fries on the side
            vb.addBox(11, 0, 4, 12, 2, 5, PALETTE.FRIES_COOKED);
            vb.addBox(13, 0, 5, 14, 3, 6, PALETTE.FRIES_COOKED);
            vb.addBox(12, 0, 7, 13, 2, 8, PALETTE.FRIES_COOKED);
            vb.addBox(11, 1, 6, 13, 1, 9, PALETTE.FRIES_COOKED);
            vb.addBox(12, 0, 9, 14, 2, 10, PALETTE.FRIES_COOKED);
        }
    }
    else if (type === 'French Fries') {
        vb.addBox(5, 0, 4, 6, 3, 5, PALETTE.FRIES_COOKED);
        vb.addBox(7, 0, 5, 8, 4, 6, PALETTE.FRIES_COOKED);
        vb.addBox(9, 0, 7, 10, 3, 8, PALETTE.FRIES_COOKED);
        vb.addBox(6, 1, 6, 9, 2, 9, PALETTE.FRIES_COOKED);
        vb.addBox(4, 0, 8, 5, 4, 9, PALETTE.FRIES_COOKED);
        vb.addBox(6, 2, 7, 7, 5, 8, PALETTE.FRIES_COOKED);
        vb.addBox(8, 2, 5, 9, 5, 6, PALETTE.FRIES_COOKED);
    }
    else if (type === 'Salad') {
        const cx = 7.5, cz = 7.5;
        const radius = 4.5;
        for (let x = 2; x <= 13; x++) {
            for (let z = 2; z <= 13; z++) {
                const dist2 = (x-cx)*(x-cx) + (z-cz)*(z-cz);
                if (dist2 <= radius*radius) {
                    vb.add(x, 0, z, PALETTE.LETTUCE);
                    if (dist2 <= 10) {
                        vb.add(x, 1, z, 0x66bb6a); // lighter green
                    }
                    if (dist2 <= 4) {
                        vb.add(x, 2, z, PALETTE.LETTUCE);
                    }
                }
            }
        }
        // Add random mixed lettuce leaves sticking out
        const leaves = [[4,1,4], [10,1,5], [5,1,10], [11,1,10], [6,2,6], [9,2,9], [4,0,8], [11,0,7]];
        for (const [x,y,z] of leaves) {
            vb.addBox(x, y, z, x+1, y+1, z+1, 0x66bb6a);
        }
        // Add tomato wedges/chunks beautifully distributed
        const tomatoes = [[5,2,7], [9,2,5], [7,3,8], [10,1,8], [5,1,5]];
        for (const [x,y,z] of tomatoes) {
            vb.addBox(x, y, z, x+1, y, z+1, PALETTE.TOMATO); 
        }
        // A few seeds/highlights to tomatoes
        vb.add(5, 3, 7, 0xffd54f);
        vb.add(9, 3, 5, 0xffd54f);
    }
    else if (type === 'Onion Rings') {
        const ring = (y, offsetX, offsetZ) => {
            const cx = 7.5 + offsetX, cz = 7.5 + offsetZ;
            for (let x = 2; x <= 13; x++) {
                for (let z = 2; z <= 13; z++) {
                    const d2 = (x-cx)*(x-cx) + (z-cz)*(z-cz);
                    if (d2 >= 9 && d2 <= 20) vb.add(x, y, z, PALETTE.WOOD_BOARD);
                }
            }
        };
        ring(0, 0, 0); ring(1, 1, -1); ring(2, -1, 1); ring(3, 0, 0);
    }
    else if (type === 'Chicken Tenders' || type === 'Chicken Tenders & Fries') {
        // Chicken tenders on the left side
        vb.addBox(2, 0, 4, 8, 2, 6, PALETTE.CHICKEN_COOKED);
        vb.addBox(4, 1, 7, 10, 3, 9, PALETTE.CHICKEN_COOKED);
        vb.addBox(2, 0, 9, 8, 2, 11, PALETTE.CHICKEN_COOKED);
        
        if (type === 'Chicken Tenders & Fries') {
            // Fries on the right side
            vb.addBox(10, 0, 4, 11, 3, 5, PALETTE.FRIES_COOKED);
            vb.addBox(12, 0, 5, 13, 4, 6, PALETTE.FRIES_COOKED);
            vb.addBox(13, 0, 7, 14, 3, 8, PALETTE.FRIES_COOKED);
            vb.addBox(11, 1, 6, 13, 2, 9, PALETTE.FRIES_COOKED);
            vb.addBox(10, 0, 8, 11, 4, 9, PALETTE.FRIES_COOKED);
        }
    }
    else if (type === 'BLT Sandwich') {
        // Half 1: shifted to dx = -1, dz = -1, dy = 0
        addSandwichHalf(vb, -1, 0, -1, false, true, true);
        // Half 2: shifted to dx = 1, dz = 1, dy = 0
        addSandwichHalf(vb, 1, 0, 1, true, true, true);
        
        // --- BLT Extras (garnish, extensions) ---
        // Half 1 extras (Lettuce, Tomato, Bacon)
        vb.add(1, 2, 6, 0x66bb6a);
        vb.add(2, 2, 9, PALETTE.LETTUCE);
        vb.add(5, 2, 1, 0x66bb6a);
        vb.add(9, 2, 2, PALETTE.LETTUCE);
        
        vb.addBox(1, 3, 7, 1, 3, 8, PALETTE.TOMATO);
        vb.addBox(7, 3, 1, 8, 3, 1, PALETTE.TOMATO);
        
        vb.addBox(1, 4, 4, 11, 4, 4, PALETTE.BACON_COOKED);
        vb.add(0, 4, 4, 0xffa07a);
        vb.add(12, 4, 4, PALETTE.BACON_COOKED);
        vb.addBox(1, 4, 7, 11, 4, 7, PALETTE.BACON_COOKED);
        vb.add(12, 4, 7, 0xffa07a);
        
        // Half 2 extras (Lettuce, Tomato, Bacon)
        vb.add(14, 2, 7, 0x66bb6a);
        vb.add(13, 2, 10, PALETTE.LETTUCE);
        vb.add(10, 2, 14, 0x66bb6a);
        vb.add(7, 2, 13, PALETTE.LETTUCE);
        
        vb.addBox(13, 3, 8, 13, 3, 9, PALETTE.TOMATO);
        vb.addBox(8, 3, 13, 9, 3, 13, PALETTE.TOMATO);
        
        vb.addBox(4, 4, 8, 4, 4, 14, PALETTE.BACON_COOKED);
        vb.add(4, 4, 15, 0xffa07a);
        vb.add(4, 4, 7, PALETTE.BACON_COOKED);
        vb.addBox(8, 4, 4, 8, 4, 14, PALETTE.BACON_COOKED);
        vb.add(8, 4, 15, 0xffa07a);
        
        // Toothpick & Olive Garnish on Half 2
        vb.addBox(10, 7, 10, 10, 10, 10, 0xeecfa1);
        vb.addBox(9, 11, 9, 11, 12, 11, 0x2e7d32);
        vb.add(10, 12, 10, 0xd32f2f);
    }
    else if (type.includes('grilled_cheese') || type === 'Grilled Cheese Sandwich') {
        const isCooked = !type.includes('raw');
        
        // Half 1: shifted to dx = -1, dz = -1, dy = 0
        addSandwichHalf(vb, -1, 0, -1, false, false, isCooked);
        // Half 2: shifted to dx = 1, dz = 1, dy = 0
        addSandwichHalf(vb, 1, 0, 1, true, false, isCooked);
        
        // --- Grilled Cheese Extras (melty gooey cheese drips) ---
        if (isCooked) {
            // Half 1 cut face & edge drips
            vb.add(5, 1, 6, PALETTE.CHEESE);
            vb.add(5, 0, 6, PALETTE.CHEESE); // drips onto plate
            vb.add(7, 1, 4, PALETTE.CHEESE);
            vb.add(7, 0, 4, PALETTE.CHEESE);
            vb.add(2, 2, 2, PALETTE.CHEESE); 
            vb.add(2, 1, 2, PALETTE.CHEESE); 
            
            // Half 2 cut face & edge drips
            vb.add(10, 1, 9, PALETTE.CHEESE);
            vb.add(10, 0, 9, PALETTE.CHEESE);
            vb.add(8, 1, 11, PALETTE.CHEESE);
            vb.add(8, 0, 11, PALETTE.CHEESE);
            vb.add(13, 2, 13, PALETTE.CHEESE);
            vb.add(13, 1, 13, PALETTE.CHEESE);
        } else {
            // Raw cheese corners sticking out
            vb.add(2, 2, 2, PALETTE.CHEESE);
            vb.add(13, 2, 13, PALETTE.CHEESE);
        }
    }
    else if (type === 'Pancakes') {
        vb.addBox(3, 0, 3, 12, 1, 12, PALETTE.PANCAKE);
        vb.addBox(4, 1, 4, 11, 2, 11, PALETTE.PANCAKE);
        vb.addBox(5, 2, 5, 10, 3, 10, PALETTE.PANCAKE);
        vb.addBox(7, 3, 7, 8, 4, 8, 0xfffdd0);
        vb.addBox(6, 3, 6, 9, 3, 9, PALETTE.WOOD_DARK);
        vb.addBox(5, 1, 8, 5, 3, 8, PALETTE.WOOD_DARK);
        vb.addBox(10, 0, 6, 10, 3, 6, PALETTE.WOOD_DARK);
    }
    else if (type === 'Omelette' || type === 'Cheese Omelette') {
        vb.addBox(2, 0, 5, 13, 2, 10, PALETTE.EGG_YOLK);
        vb.addBox(3, 2, 6, 12, 3, 9, PALETTE.EGG_YOLK);
        
        if (type === 'Cheese Omelette') {
            // Cheese melting out / on top
            vb.addBox(4, 2, 4, 6, 2, 5, PALETTE.CHEESE);
            vb.addBox(10, 2, 4, 11, 2, 5, PALETTE.CHEESE);
            vb.addBox(6, 3, 6, 9, 3, 8, PALETTE.CHEESE);
        }
        
        // Chives (green specks)
        vb.addBox(5, 3, 7, 5, 3, 7, 0x2e7d32);
        vb.addBox(8, 3, 8, 8, 3, 8, 0x2e7d32);
        vb.addBox(10, 3, 6, 10, 3, 6, 0x2e7d32);
    }
    else if (type === 'Fruit & Yogurt Bowl') {
        const cx = 7.5, cz = 7.5;
        for (let y = 0; y <= 3; y++) {
            const rOuter = 4 + y*0.5;
            const rInner = y === 0 ? 0 : rOuter - 1.5;
            for (let x = 2; x <= 13; x++) {
                for (let z = 2; z <= 13; z++) {
                    const dist2 = (x-cx)*(x-cx) + (z-cz)*(z-cz);
                    if (dist2 <= rOuter*rOuter && dist2 >= rInner*rInner) {
                        vb.add(x, y, z, PALETTE.PLATE_WHITE);
                    } else if (y < 3 && dist2 < rInner*rInner) {
                        vb.add(x, y, z, 0xffffff); // Yogurt inside
                    }
                }
            }
        }
        vb.addBox(8, 3, 4, 10, 4, 6, PALETTE.BANANA);
        vb.addBox(9, 3, 6, 11, 4, 8, PALETTE.BANANA);
        vb.addBox(5, 3, 8, 7, 4, 10, PALETTE.STRAWBERRY);
        vb.addBox(7, 3, 9, 9, 4, 11, PALETTE.STRAWBERRY);
    }
    else if (type === 'Smoothie' || type === 'smoothie_ready') {
        const cx = 7.5, cz = 7.5;
        for (let y = 0; y <= 7; y++) {
            for (let x = 5; x <= 10; x++) {
                for (let z = 5; z <= 10; z++) {
                    const dist2 = (x-cx)*(x-cx) + (z-cz)*(z-cz);
                    if (dist2 <= 7) { 
                        if (dist2 >= 4 && y > 0) {
                            vb.add(x, y, z, PALETTE.GLASS_BLUE);
                        } else if (y < 7) {
                            vb.add(x, y, z, PALETTE.STRAWBERRY); // Smoothie
                        }
                    }
                }
            }
        }
        // Straw
        vb.addBox(7, 4, 7, 7, 9, 7, 0xffffff);
        vb.add(7, 10, 8, 0xffffff);
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
    else if (type.includes('bread')) {
        const isToasted = type.includes('toasted');
        const crustColor = isToasted ? 0x5d4037 : 0xa0522d; // WOOD_DARK vs sienna
        const crumbBaseColor = isToasted ? 0xeecfa1 : 0xFFF8DC; // WOOD_BOARD vs cornsilk
        
        for (let y = 0; y <= 1; y++) {
            for (let r = 0; r < 10; r++) {
                const z = r + 3;
                const row = BREAD_GRID[r];
                for (let c = 0; c < 10; c++) {
                    const x = c + 3;
                    const char = row[c];
                    if (char === 'C') {
                        vb.add(x, y, z, crustColor);
                    } else if (char === 'W') {
                        let color = crumbBaseColor;
                        if (isToasted) {
                            const noise = (x * 7 + z * 13 + y * 3) % 6;
                            if (noise === 0) color = 0xcd853f; 
                            else if (noise === 1) color = 0x8b4513; 
                            else if (noise === 2) color = 0xd7ccc8;
                        }
                        vb.add(x, y, z, color);
                    }
                }
            }
        }
    }
    else if (type === 'bun' || type === 'bun_bottom' || type === 'bun_top') {
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
    else if (type.toLowerCase().includes('pizza_margherita') || type === 'Pizza Margherita') {
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
        vb.addBox(5, 0, 5, 10, 8, 10, PALETTE.PLATE_WHITE);
    }
    else if (type.includes('granola')) {
        vb.addBox(5, 0, 5, 10, 6, 10, PALETTE.GLASS_BLUE); // Glass body
        vb.addBox(6, 1, 6, 9, 5, 9, PALETTE.WOOD_LIGHT); // Granola inside
        vb.addBox(5, 6, 5, 10, 7, 10, PALETTE.BLACK); // Lid
    }
    else if (type.includes('syrup')) {
        vb.addBox(6, 0, 6, 9, 5, 9, PALETTE.WOOD_DARK); // Bottle body
        vb.addBox(7, 5, 7, 8, 7, 8, PALETTE.METAL_SHINY); // Cap
    }
    else if (type.includes('coating')) {
        vb.addBox(5, 0, 4, 10, 7, 11, PALETTE.WOOD_BOARD); // Bag
        vb.addBox(6, 7, 5, 9, 8, 10, PALETTE.METAL_LIGHT); // Top fold
    }
    else {
        vb.addBox(4, 0, 4, 11, 7, 11, PALETTE.PLASTIC_BLUE); // Generic
    }

    const mesh = vb.buildMesh();
    
    // *** KEY FIX: NORMALIZE ORIGIN ***
    // VoxelBuilder 0,0,0 is center of grid unit.
    // This shift makes (0,0,0) the BOTTOM of the mesh.
    // (Note: grid coordinates are scaled inside items/prefabs)
    mesh.geometry.translate(0, GRID_UNIT/2, 0); 
    
    return mesh;
}

export function createExhaustHoodMesh() {
    const vb = new VoxelBuilder();
    // Metal hood body
    vb.addBox(0, 8, 0, 15, 15, 15, PALETTE.METAL_DARK);
    vb.addBox(3, 0, 3, 12, 7, 12, PALETTE.METAL_LIGHT);
    // Grid details on front
    vb.addBox(1, 9, 14, 14, 14, 15, PALETTE.METAL_SHINY);
    const mesh = vb.buildMesh();
    mesh.position.y = GRID_UNIT / 2;
    return mesh;
}

export function createPlantMesh() {
    const vb = new VoxelBuilder();
    
    // Pot (tapered shape)
    vb.addBox(5, 0, 5, 10, 1, 10, 0x8d6e63); // Base
    vb.addBox(4, 2, 4, 11, 4, 11, 0x8d6e63); // Middle
    vb.addBox(3, 5, 3, 12, 6, 12, 0x8d6e63); // Rim
    vb.addBox(4, 6, 4, 11, 6, 11, 0x3e2723); // Soil

    // Stem
    vb.addBox(7, 6, 7, 8, 11, 8, 0x2e7d32); 

    // Leaves - Lower layer
    vb.addBox(3, 8, 7, 6, 8, 8, 0x4caf50); // Left
    vb.addBox(9, 8, 7, 12, 8, 8, 0x4caf50); // Right
    vb.addBox(7, 8, 3, 8, 8, 6, 0x4caf50); // Front
    vb.addBox(7, 8, 9, 8, 8, 12, 0x4caf50); // Back

    // Leaves - Middle layer
    vb.addBox(4, 10, 6, 7, 10, 9, 0x4caf50);
    vb.addBox(8, 10, 6, 11, 10, 9, 0x4caf50);
    vb.addBox(6, 10, 4, 9, 10, 7, 0x4caf50);
    vb.addBox(6, 10, 8, 9, 10, 11, 0x4caf50);

    // Leaves - Top bushy part
    vb.addBox(5, 12, 5, 10, 14, 10, 0x2e7d32);
    vb.addBox(6, 15, 6, 9, 15, 9, 0x4caf50);

    const mesh = vb.buildMesh();
    mesh.position.y = GRID_UNIT / 2;
    return mesh;
}

export function createKitchenLampMesh() {
    const vb = new VoxelBuilder();
    // Wire
    vb.addBox(7, 8, 7, 8, 15, 8, PALETTE.BLACK);
    // Lamp shade
    vb.addBox(5, 3, 5, 10, 7, 10, PALETTE.METAL_LIGHT);
    // Bulb
    vb.addBox(6, 1, 6, 9, 2, 9, 0xffeb3b);
    const mesh = vb.buildMesh();
    mesh.position.y = GRID_UNIT / 2;
    return mesh;
}

export function createCoatingStationMesh() {
    const vb = new VoxelBuilder();
    // Metal tray/container base
    vb.addBox(2, 0, 2, 13, 2, 13, PALETTE.METAL_DARK);
    // Breading/panure powder inside the container
    vb.addBox(3, 2, 3, 12, 4, 12, PALETTE.PIZZA_CRUST); // golden flour/crumb color
    // Highlights in the breadcrumbs
    vb.addBox(4, 4, 4, 6, 4, 6, PALETTE.CHEESE); // brighter yellow crumbs
    vb.addBox(9, 4, 8, 10, 4, 9, PALETTE.CHEESE);
    const mesh = vb.buildMesh();
    mesh.position.y = GRID_UNIT/2;
    return mesh;
}