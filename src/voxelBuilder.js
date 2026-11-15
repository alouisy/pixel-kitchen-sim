import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
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
    FIRE_RED: 0xd84315,
    TOMATO: 0xd32f2f,
    TOMATO_DARK: 0xb71c1c,
    LETTUCE: 0x43a047,
    LETTUCE_LIGHT: 0x66bb6a,
    LETTUCE_DARK: 0x2e7d32,
    CHEESE: 0xfbc02d,
    CHEESE_ORANGE: 0xf57f17,
    BUN: 0xf4a460,
    MEAT_RAW: 0xe57373,
    MEAT_COOKED: 0x5d4037,
    POTATO: 0xd7ccc8,
    POTATO_EYE: 0x8d6e63,
    FRIES_RAW: 0xffecb3,
    FRIES_COOKED: 0xffeb3b,
    PLATE_WHITE: 0xffffff,
    ONION: 0xeceff1,
    ONION_SKIN: 0xd78a48,
    ONION_SKIN_DARK: 0xa0522d,
    ONION_PURPLE: 0x8e24aa,
    ONION_PURPLE_LIGHT: 0xba68c8,
    ONION_WHITE: 0xf5f5f5,
    MUSHROOM: 0xa1887f,
    WALL_WHITE: 0xEFEBE9,
    // Culinary HD Colors
    CHICKEN_RAW: 0xFFB6C1,
    CHICKEN_RAW_SHADOW: 0xF48FB1,
    CHICKEN_COOKED: 0xCD853F,
    CHICKEN_CRISP: 0xB87333,
    CHICKEN_DARK: 0x8B4513,
    BACON_RAW: 0xFA8072,
    BACON_COOKED: 0x8B0000,
    EGG_WHITE: 0xFFFFFF,
    EGG_SHELL: 0xFFF8E7,
    EGG_YOLK: 0xFFD700,
    EGG_YOLK_COOKED: 0xFFCA28,
    PANCAKE: 0xF4A460,
    PANCAKE_BROWN: 0xD2691E,
    PANCAKE_LIGHT: 0xFFE0B2,
    PIZZA_CRUST: 0xDEB887,
    PIZZA_CRUST_BAKED: 0xCD853F,
    PIZZA_CHAR: 0x4E342E,
    SAUCE_RED: 0xB22222,
    SAUCE_BRIGHT: 0xD32F2F,
    MOZZARELLA: 0xFFFFF0,
    MOZZARELLA_MELTED: 0xFFF9C4,
    MOZZARELLA_BROWNED: 0xFBC02D,
    BANANA: 0xFFE135,
    BANANA_PALE: 0xFFF9C4,
    BANANA_STEM: 0x689F38,
    STRAWBERRY: 0xFC5A8D,
    STRAWBERRY_RED: 0xE53935,
    STRAWBERRY_PULP: 0xFFCDD2,
    GLASS_BLUE: 0xAADDFF,
    SYRUP_AMBER: 0x793802,
    SYRUP_GLAZE: 0x9E4700,
    BUTTER: 0xFFF176,
    BUTTER_LIGHT: 0xFFF9C4,
    BASIL_LEAF: 0x2E7D32,
    DIP_CUP: 0xFFFFFF,
    DIP_KETCHUP: 0xD32F2F,
    DIP_BBQ: 0x4E342E,
    PARSLEY: 0x388E3C
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
            "      DDDD      ",
            "     DOOOOD     ",
            "    DOOOOOOD    ",
            "    DOOOOOOD    ",
            "   DOOOOOOOOD   ",
            "   DOOOOOOOOD   ",
            "   DOOOOOOOOD   ",
            "    DOOOOOOD    ",
            "     DDDDDD     ",
            "       WW       ",
            "                ",
            "                "
        ],
        colors: { O: 0xd78a48, D: 0xa0522d, Y: 0x81c784, W: 0x5d4037 } 
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
    // Brick Arch
    vb.addBox(1, 1, 1, 3, 10, 14, PALETTE.WOOD_DARK); // L wall
    vb.addBox(12, 1, 1, 14, 10, 14, PALETTE.WOOD_DARK); // R wall
    vb.addBox(1, 1, 1, 14, 10, 3, PALETTE.WOOD_DARK); // Back wall
    // Terracotta roof & chimney
    vb.addBox(1, 10, 1, 14, 12, 14, PALETTE.SAUCE_RED); 
    vb.addBox(6, 12, 6, 9, 15, 9, PALETTE.METAL_DARK); // Chimney pipe
    // Glowing wood fire & logs inside
    vb.addBox(4, 1, 3, 11, 2, 5, PALETTE.WOOD_DARK); // Log base
    vb.addBox(5, 2, 4, 10, 4, 7, PALETTE.FIRE_ORANGE); // Fire flame
    vb.addBox(6, 3, 5, 9, 5, 6, PALETTE.FIRE_RED);
    vb.addBox(7, 4, 5, 8, 6, 6, PALETTE.EGG_YOLK); // Yellow hot core
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

export function createItemMesh(type, contents = [], mealName = null) {
    // Map snake_case to Title Case if needed for backwards compatibility
    const legacyMapping = {
        'french_fries': 'French Fries',
        'salad': 'Salad',
        'hamburger': 'Hamburger',
        'cheeseburger_combo': 'Cheeseburger Combo',
        'onion_rings': 'Onion Rings',
        'chicken_tenders_fries': 'Chicken Tenders & Fries',
        'blt_sandwich': 'BLT Sandwich',
        'grilled_cheese_sandwich': 'Grilled Cheese Sandwich',
        'pancakes': 'Pancakes',
        'cheese_omelette': 'Cheese Omelette',
        'fruit_yogurt_bowl': 'Fruit & Yogurt Bowl',
        'smoothie': 'Smoothie',
        'pizza_margherita': 'Pizza Margherita'
    };
    if (legacyMapping[type]) {
        type = legacyMapping[type];
    }

    const vb = new VoxelBuilder();
    
    // --- UTENSILS & CONTAINERS ---
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

    // --- COMPLETED MEALS ---
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
            // Crisp french fries on the side
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
        // Add a few golden-brown highlights
        vb.add(7, 4, 6, PALETTE.CRISP_GOLDEN);
        vb.add(6, 5, 7, PALETTE.CRISP_GOLDEN);
        vb.add(8, 5, 6, PALETTE.CRISP_GOLDEN);
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
                        vb.add(x, 1, z, PALETTE.LETTUCE_LIGHT);
                    }
                    if (dist2 <= 4) {
                        vb.add(x, 2, z, PALETTE.LETTUCE);
                    }
                }
            }
        }
        // Random mixed lettuce leaves
        const leaves = [[4,1,4], [10,1,5], [5,1,10], [11,1,10], [6,2,6], [9,2,9], [4,0,8], [11,0,7]];
        for (const [x,y,z] of leaves) {
            vb.addBox(x, y, z, x+1, y+1, z+1, PALETTE.LETTUCE_LIGHT);
        }
        // Tomato wedges
        const tomatoes = [[5,2,7], [9,2,5], [7,3,8], [10,1,8], [5,1,5]];
        for (const [x,y,z] of tomatoes) {
            vb.addBox(x, y, z, x+1, y, z+1, PALETTE.TOMATO); 
        }
        // Highlights on tomatoes
        vb.add(5, 3, 7, 0xffd54f);
        vb.add(9, 3, 5, 0xffd54f);
    }
    else if (type === 'Onion Rings') {
        // High-definition tower of 4 crispy golden onion rings on plate
        const drawRing = (cx, cz, yBase, outerR, innerR, tiltColor = PALETTE.CHICKEN_COOKED) => {
            for (let x = 1; x <= 14; x++) {
                for (let z = 1; z <= 14; z++) {
                    const d2 = (x - cx) * (x - cx) + (z - cz) * (z - cz);
                    if (d2 <= outerR * outerR && d2 >= innerR * innerR) {
                        let c = tiltColor;
                        if ((x + z + yBase) % 3 === 0) c = PALETTE.CHICKEN_CRISP;
                        else if ((x * z) % 5 === 0) c = PALETTE.COATING_CRUMB;
                        vb.add(x, yBase, z, c);
                        vb.add(x, yBase + 1, z, c);
                    }
                }
            }
        };

        // Ring 1 (base left)
        drawRing(5.5, 6.0, 0, 3.8, 2.3, PALETTE.CHICKEN_COOKED);
        // Ring 2 (base right)
        drawRing(9.5, 6.5, 0, 3.6, 2.2, PALETTE.CHICKEN_COOKED);
        // Ring 3 (middle layer, tilted)
        drawRing(6.5, 9.0, 1, 3.5, 2.1, PALETTE.CHICKEN_CRISP);
        // Ring 4 (top crown ring)
        drawRing(8.0, 8.0, 2, 3.2, 1.9, PALETTE.CHICKEN_COOKED);

        // White ceramic dip ramekin at bottom right
        vb.addBox(11, 0, 11, 14, 2, 14, PALETTE.DIP_CUP);
        vb.addBox(12, 1, 12, 13, 2, 13, PALETTE.DIP_KETCHUP);

        // Fresh parsley garnishes
        vb.add(6, 3, 8, PALETTE.PARSLEY);
        vb.add(8, 4, 7, PALETTE.PARSLEY);
        vb.add(9, 2, 10, PALETTE.PARSLEY);
    }
    else if (type === 'Chicken Tenders' || type === 'Chicken Tenders & Fries') {
        // High-definition crispy chicken tenders (curved, golden crunchy crust)
        const drawTender = (x1, y1, z1, x2, y2, z2) => {
            vb.addBox(x1, y1, z1, x2, y2, z2, PALETTE.CHICKEN_COOKED);
            // Add crunchy surface texturing
            for (let x = x1; x <= x2; x++) {
                for (let z = z1; z <= z2; z++) {
                    if ((x + z) % 2 === 0) vb.add(x, y2 + 1, z, PALETTE.CHICKEN_CRISP);
                    if ((x * z) % 3 === 0) vb.add(x, y1, z, PALETTE.CHICKEN_DARK);
                }
            }
        };

        // 3 Large golden crispy chicken tenders on the left
        drawTender(2, 0, 3, 7, 2, 6);
        drawTender(3, 1, 6, 8, 3, 9);
        drawTender(2, 0, 9, 7, 2, 12);
        
        if (type === 'Chicken Tenders & Fries') {
            // Golden crispy fries on the right side
            vb.addBox(9, 0, 4, 10, 3, 5, PALETTE.FRIES_COOKED);
            vb.addBox(11, 0, 5, 12, 4, 6, PALETTE.FRIES_COOKED);
            vb.addBox(12, 0, 7, 13, 3, 8, PALETTE.FRIES_COOKED);
            vb.addBox(10, 1, 6, 12, 2, 9, PALETTE.FRIES_COOKED);
            vb.addBox(9, 0, 8, 10, 4, 9, PALETTE.FRIES_COOKED);
            vb.addBox(11, 2, 8, 13, 3, 10, PALETTE.FRIES_COOKED);
            // Dip cup in the upper center
            vb.addBox(8, 0, 2, 11, 2, 5, PALETTE.DIP_CUP);
            vb.addBox(9, 1, 3, 10, 2, 4, PALETTE.DIP_BBQ);
        }
    }
    else if (type === 'BLT Sandwich') {
        // Half 1: shifted to dx = -1, dz = -1, dy = 0
        addSandwichHalf(vb, -1, 0, -1, false, true, true);
        // Half 2: shifted to dx = 1, dz = 1, dy = 0
        addSandwichHalf(vb, 1, 0, 1, true, true, true);
        
        // --- BLT Extras (garnish, extensions) ---
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
            vb.add(5, 1, 6, PALETTE.CHEESE);
            vb.add(5, 0, 6, PALETTE.CHEESE_ORANGE); // drips onto plate
            vb.add(7, 1, 4, PALETTE.CHEESE);
            vb.add(7, 0, 4, PALETTE.CHEESE_ORANGE);
            vb.add(2, 2, 2, PALETTE.CHEESE); 
            vb.add(2, 1, 2, PALETTE.CHEESE); 
            
            vb.add(10, 1, 9, PALETTE.CHEESE);
            vb.add(10, 0, 9, PALETTE.CHEESE_ORANGE);
            vb.add(8, 1, 11, PALETTE.CHEESE);
            vb.add(8, 0, 11, PALETTE.CHEESE_ORANGE);
            vb.add(13, 2, 13, PALETTE.CHEESE);
            vb.add(13, 1, 13, PALETTE.CHEESE);
        } else {
            vb.add(2, 2, 2, PALETTE.CHEESE);
            vb.add(13, 2, 13, PALETTE.CHEESE);
        }
    }
    else if (type === 'Pancakes') {
        // High-definition triple pancake stack with melting butter & dripping maple syrup
        const cx = 7.5, cz = 7.5;
        
        const drawPancakeDisc = (yBase, r, topBrown = false) => {
            for (let x = 2; x <= 13; x++) {
                for (let z = 2; z <= 13; z++) {
                    const d2 = (x - cx) * (x - cx) + (z - cz) * (z - cz);
                    if (d2 <= r * r) {
                        let col = PALETTE.PANCAKE;
                        if (d2 >= (r - 1.2) * (r - 1.2)) col = PALETTE.PANCAKE_BROWN; // Toasted edge
                        vb.add(x, yBase, z, col);
                        
                        let topCol = col;
                        if (topBrown && d2 <= (r - 1.5) * (r - 1.5) && (x + z) % 2 === 0) {
                            topCol = PALETTE.PANCAKE_BROWN; // Griddle ring
                        }
                        vb.add(x, yBase + 1, z, topCol);
                    }
                }
            }
        };

        // Pancake 1 (Bottom)
        drawPancakeDisc(0, 5.0, false);
        // Pancake 2 (Middle)
        drawPancakeDisc(2, 4.5, false);
        // Pancake 3 (Top)
        drawPancakeDisc(4, 4.0, true);

        // Melting Butter Pat on top
        vb.addBox(7, 6, 7, 8, 7, 8, PALETTE.BUTTER);
        vb.add(6, 6, 7, PALETTE.BUTTER_LIGHT); // Melting drip

        // Glossy Maple Syrup on top and dripping over edges
        vb.addBox(6, 5, 6, 9, 5, 9, PALETTE.SYRUP_AMBER);
        // Dripping syrup trails
        vb.addBox(4, 1, 7, 4, 4, 7, PALETTE.SYRUP_AMBER);
        vb.add(3, 0, 7, PALETTE.SYRUP_GLAZE); // Syrup puddle on plate
        vb.addBox(11, 1, 8, 11, 4, 8, PALETTE.SYRUP_AMBER);
        vb.add(12, 0, 8, PALETTE.SYRUP_GLAZE);
        vb.addBox(7, 1, 4, 7, 4, 4, PALETTE.SYRUP_AMBER);
        vb.add(7, 0, 3, PALETTE.SYRUP_GLAZE);
    }
    else if (type === 'Omelette' || type === 'Cheese Omelette') {
        // High-definition French folded golden omelette
        vb.addBox(2, 0, 5, 13, 2, 10, PALETTE.EGG_YOLK);
        vb.addBox(3, 2, 6, 12, 3, 9, PALETTE.EGG_YOLK_COOKED);
        
        if (type === 'Cheese Omelette') {
            // Gooey melted cheese oozing from the folded seam
            vb.addBox(4, 2, 4, 6, 2, 5, PALETTE.CHEESE);
            vb.addBox(10, 2, 4, 11, 2, 5, PALETTE.CHEESE);
            vb.addBox(6, 3, 6, 9, 3, 8, PALETTE.CHEESE);
            vb.add(5, 1, 4, PALETTE.CHEESE_ORANGE);
            vb.add(10, 1, 4, PALETTE.CHEESE_ORANGE);
        }
        
        // Fresh chopped chives
        vb.addBox(5, 3, 7, 5, 3, 7, PALETTE.PARSLEY);
        vb.addBox(8, 3, 8, 8, 3, 8, PALETTE.PARSLEY);
        vb.addBox(10, 3, 6, 10, 3, 6, PALETTE.PARSLEY);
        vb.addBox(7, 3, 6, 7, 3, 6, PALETTE.PARSLEY);
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
                        vb.add(x, y, z, 0xffffff); // Creamy Greek yogurt inside
                    }
                }
            }
        }
        // Banana slices fan
        vb.addBox(8, 3, 4, 10, 4, 6, PALETTE.BANANA);
        vb.add(9, 4, 5, PALETTE.WOOD_DARK); // seed core
        vb.addBox(9, 3, 6, 11, 4, 8, PALETTE.BANANA);
        vb.add(10, 4, 7, PALETTE.WOOD_DARK);
        
        // Strawberry slices
        vb.addBox(5, 3, 8, 7, 4, 10, PALETTE.STRAWBERRY_RED);
        vb.add(6, 4, 9, PALETTE.STRAWBERRY_PULP);
        vb.addBox(7, 3, 9, 9, 4, 11, PALETTE.STRAWBERRY_RED);
        vb.add(8, 4, 10, PALETTE.STRAWBERRY_PULP);

        // Granola clusters
        vb.add(4, 3, 5, PALETTE.PANCAKE_BROWN);
        vb.add(5, 3, 4, PALETTE.COATING_CRUMB);
        vb.add(4, 3, 7, PALETTE.PANCAKE_BROWN);
        vb.add(6, 3, 4, PALETTE.WOOD_LIGHT);
        // Mint leaf garnish
        vb.add(7, 4, 7, PALETTE.LETTUCE_LIGHT);
        vb.add(8, 4, 7, PALETTE.LETTUCE_DARK);
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
                            let smoothieCol = PALETTE.STRAWBERRY;
                            if (y === 6 && (x + z) % 2 === 0) smoothieCol = PALETTE.STRAWBERRY_PULP; // Cream swirl
                            vb.add(x, y, z, smoothieCol);
                        }
                    }
                }
            }
        }
        // Striped drinking straw
        for (let sy = 4; sy <= 10; sy++) {
            const strawCol = (sy % 2 === 0) ? 0xffffff : PALETTE.TOMATO;
            vb.add(7, sy, 7, strawCol);
        }
        vb.add(7, 11, 8, PALETTE.TOMATO); // Bent straw tip
    }
    else if (type === 'Pizza Margherita' || type === 'cooked_pizza_margherita') {
        // High-definition Italian Neapolitan Pizza with blistered crust, melted mozzarella islands & basil
        const cx = 7.5, cz = 7.5;
        const outerR = 5.6;
        const rimInnerR = 4.4;

        for (let x = 1; x <= 14; x++) {
            for (let z = 1; z <= 14; z++) {
                const d2 = (x - cx) * (x - cx) + (z - cz) * (z - cz);
                if (d2 <= outerR * outerR) {
                    // Pizza crust base
                    vb.add(x, 0, z, PALETTE.PIZZA_CRUST);

                    // Puffy raised outer crust (cornicione)
                    if (d2 >= rimInnerR * rimInnerR) {
                        let crustCol = PALETTE.PIZZA_CRUST_BAKED;
                        if ((x * 3 + z * 7) % 11 === 0) crustCol = PALETTE.PIZZA_CHAR; // Woodfire charred blister spot
                        else if ((x + z) % 4 === 0) crustCol = PALETTE.PIZZA_CRUST;
                        vb.add(x, 1, z, crustCol);
                        if (d2 >= 4.8 * 4.8) vb.add(x, 2, z, crustCol);
                    } else {
                        // Crushed rich tomato sauce center
                        let sauceCol = PALETTE.SAUCE_RED;
                        if ((x + z) % 3 === 0) sauceCol = PALETTE.SAUCE_BRIGHT;
                        vb.add(x, 1, z, sauceCol);
                    }
                }
            }
        }

        // Melted fresh mozzarella pools
        const cheesePools = [
            [6, 6, 1.8], [9, 6, 1.5], [6, 9, 1.5], [9, 9, 1.8], [7, 7, 1.4]
        ];
        cheesePools.forEach(([px, pz, pr]) => {
            for (let x = px - 2; x <= px + 2; x++) {
                for (let z = pz - 2; z <= pz + 2; z++) {
                    const cd2 = (x - px) * (x - px) + (z - pz) * (z - pz);
                    if (cd2 <= pr * pr) {
                        let cCol = PALETTE.MOZZARELLA_MELTED;
                        if (cd2 >= (pr - 0.5) * (pr - 0.5)) cCol = PALETTE.MOZZARELLA_BROWNED; // Toasted melted edge
                        vb.add(x, 2, z, cCol);
                    }
                }
            }
        });

        // Fresh basil leaves on top
        const basilLeaves = [[5, 3, 7], [9, 3, 5], [8, 3, 9], [6, 3, 8]];
        basilLeaves.forEach(([bx, by, bz]) => {
            vb.add(bx, by, bz, PALETTE.BASIL_LEAF);
            vb.add(bx + 1, by, bz, PALETTE.LETTUCE_DARK);
        });
    }

    // --- INDIVIDUAL INGREDIENTS & INTERMEDIATE ITEMS ---
    else if (type.includes('tomato')) {
        if (type.includes('sauce')) {
            // Sauce tin can with rich crushed tomato label
            vb.addBox(4, 0, 4, 11, 5, 11, PALETTE.METAL_LIGHT);
            vb.addBox(4, 2, 4, 11, 4, 11, PALETTE.SAUCE_RED);
            vb.addBox(6, 5, 6, 9, 5, 9, PALETTE.SAUCE_BRIGHT); // open top with sauce
        } else if (type.includes('chopped')) {
            // Chopped tomato slices lying flat
            for (let x = 2; x <= 9; x++) {
                for (let z = 2; z <= 9; z++) {
                    const dx = x - 5.5, dz = z - 5.5;
                    if (dx*dx + dz*dz <= 12.25) {
                        const isRim = (dx*dx + dz*dz >= 6.25);
                        vb.add(x, 0, z, isRim ? PALETTE.TOMATO : 0xe53935);
                        vb.add(x, 1, z, isRim ? PALETTE.TOMATO : ((x+z)%2 === 0 ? 0xffd54f : PALETTE.TOMATO));
                    }
                }
            }
            for (let x = 7; x <= 14; x++) {
                for (let z = 7; z <= 14; z++) {
                    const dx = x - 10.5, dz = z - 10.5;
                    if (dx*dx + dz*dz <= 12.25) {
                        const isRim = (dx*dx + dz*dz >= 6.25);
                        vb.add(x, 0, z, isRim ? PALETTE.TOMATO : 0xe53935);
                        vb.add(x, 1, z, isRim ? PALETTE.TOMATO : ((x+z)%2 === 1 ? 0xffd54f : PALETTE.TOMATO));
                    }
                }
            }
        } else {
            // Rounded ripe tomato with leafy star calyx
            const rx = 4.5, ry = 3.5, rz = 4.5;
            const cx = 7.5, cy = 3.5, cz = 7.5;
            for (let x = 3; x <= 12; x++) {
                for (let y = 0; y <= 7; y++) {
                    for (let z = 3; z <= 12; z++) {
                        const dx = (x - cx) / rx, dy = (y - cy) / ry, dz = (z - cz) / rz;
                        if (dx*dx + dy*dy + dz*dz <= 1.0) {
                            vb.add(x, y, z, PALETTE.TOMATO);
                        }
                    }
                }
            }
            vb.add(7, 8, 7, PALETTE.LETTUCE_DARK);
            vb.add(7, 7, 7, PALETTE.LETTUCE_DARK);
            vb.add(6, 7, 7, PALETTE.LETTUCE);
            vb.add(8, 7, 7, PALETTE.LETTUCE);
            vb.add(7, 7, 6, PALETTE.LETTUCE);
            vb.add(7, 7, 8, PALETTE.LETTUCE);
        }
    }
    else if (type.includes('lettuce')) {
        if (type.includes('chopped')) {
            vb.addBox(3, 0, 3, 6, 0, 4, PALETTE.LETTUCE);
            vb.addBox(5, 1, 3, 7, 1, 5, PALETTE.LETTUCE_LIGHT);
            vb.addBox(8, 0, 4, 11, 0, 5, PALETTE.LETTUCE);
            vb.addBox(9, 1, 5, 10, 1, 8, PALETTE.LETTUCE_LIGHT);
            vb.addBox(4, 0, 8, 5, 0, 12, PALETTE.LETTUCE);
            vb.addBox(5, 1, 10, 8, 1, 11, PALETTE.LETTUCE_LIGHT);
            vb.addBox(9, 0, 9, 12, 0, 10, PALETTE.LETTUCE_DARK);
            vb.addBox(10, 1, 8, 12, 1, 12, PALETTE.LETTUCE);
        } else {
            const cx = 7.5, cy = 4.5, cz = 7.5, r = 4.5;
            for (let x = 3; x <= 12; x++) {
                for (let y = 0; y <= 8; y++) {
                    for (let z = 3; z <= 12; z++) {
                        const dx = x - cx, dy = y - cy, dz = z - cz;
                        if (dx*dx + dy*dy + dz*dz <= r*r) {
                            let color = PALETTE.LETTUCE;
                            if ((x + y + z) % 3 === 0) color = PALETTE.LETTUCE_LIGHT;
                            else if ((x - y + z) % 4 === 0) color = PALETTE.LETTUCE_DARK;
                            vb.add(x, y, z, color);
                        }
                    }
                }
            }
        }
    }
    else if (type.includes('potato')) {
        const rx = 4.5, ry = 3.5, rz = 5.5;
        const cx = 7.5, cy = 3.5, cz = 7.5;
        for (let x = 3; x <= 12; x++) {
            for (let y = 0; y <= 7; y++) {
                for (let z = 2; z <= 13; z++) {
                    const dx = (x - cx) / rx, dy = (y - cy) / ry, dz = (z - cz) / rz;
                    if (dx*dx + dy*dy + dz*dz <= 1.0) {
                        let color = PALETTE.POTATO;
                        if ((x === 4 && y === 4 && z === 5) || 
                            (x === 11 && y === 2 && z === 8) || 
                            (x === 7 && y === 6 && z === 11) ||
                            (x === 8 && y === 1 && z === 3)) {
                            color = PALETTE.POTATO_EYE;
                        }
                        vb.add(x, y, z, color);
                    }
                }
            }
        }
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
        vb.add(7, 4, 5, PALETTE.CRISP_GOLDEN);
    }
    else if (type.includes('patty')) {
        const isCooked = type.includes('cooked');
        const c = isCooked ? PALETTE.MEAT_COOKED : PALETTE.MEAT_RAW;
        const cx = 7.5, cz = 7.5, r = 4.8;
        for (let x = 2; x <= 13; x++) {
            for (let z = 2; z <= 13; z++) {
                const dx = x - cx, dz = z - cz;
                if (dx*dx + dz*dz <= r*r) {
                    for (let y = 0; y <= 1; y++) {
                        let voxelColor = c;
                        if (isCooked) {
                            if (y === 1 && (x + z) % 4 === 0) voxelColor = 0x271a15; // grill mark
                        } else {
                            if ((x - z) === 2 || (x + z) === 10) voxelColor = 0xffebee; // fat marbling
                        }
                        vb.add(x, y, z, voxelColor);
                    }
                }
            }
        }
    }
    else if (type.includes('bread')) {
        const isToasted = type.includes('toasted');
        const crustColor = isToasted ? 0x5d4037 : 0xa0522d;
        const crumbBaseColor = isToasted ? 0xeecfa1 : 0xFFF8DC;
        
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
        
        if (drawBottom) {
            for (let y = 0; y <= 1; y++) {
                let r = y === 0 ? 4.2 : 4.8;
                for (let x = 2; x <= 13; x++) {
                    for (let z = 2; z <= 13; z++) {
                        const dx = x - cx, dz = z - cz;
                        if (dx*dx + dz*dz <= r*r) vb.add(x, y, z, c);
                    }
                }
            }
        }
        if (drawTop) {
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
                                voxelColor = 0xfffdd0; // Sesame seed
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
        if (isMozzarella) {
            // Rounded slice of fresh mozzarella
            const cx = 7.5, cz = 7.5, r = 4.5;
            for (let x = 3; x <= 12; x++) {
                for (let z = 3; z <= 12; z++) {
                    const dx = x - cx, dz = z - cz;
                    if (dx*dx + dz*dz <= r*r) vb.add(x, 0, z, PALETTE.MOZZARELLA);
                }
            }
        } else {
            // Cheddar cheese slice with realistic corner fold
            vb.addBox(3, 0, 3, 12, 0, 12, PALETTE.CHEESE);
            vb.add(12, 1, 12, PALETTE.CHEESE_ORANGE);
        }
    }
    else if (type.includes('onion')) {
        if (type.includes('cooked')) {
            // 2 crispy cooked onion rings
            const ring = (cx, cz, yBase) => {
                for (let x = 1; x <= 14; x++) {
                    for (let z = 1; z <= 14; z++) {
                        const d2 = (x-cx)*(x-cx) + (z-cz)*(z-cz);
                        if (d2 <= 14 && d2 >= 5) {
                            vb.add(x, yBase, z, (x+z)%2===0 ? PALETTE.CHICKEN_COOKED : PALETTE.CHICKEN_CRISP);
                        }
                    }
                }
            };
            ring(5.5, 6.0, 0);
            ring(9.5, 8.5, 1);
        } else if (type.includes('coated')) {
            // 2 breaded raw onion rings
            const ring = (cx, cz, yBase) => {
                for (let x = 1; x <= 14; x++) {
                    for (let z = 1; z <= 14; z++) {
                        const d2 = (x-cx)*(x-cx) + (z-cz)*(z-cz);
                        if (d2 <= 14 && d2 >= 5) {
                            vb.add(x, yBase, z, (x+z)%2===0 ? PALETTE.COATING_GOLD : PALETTE.COATING_CRUMB);
                        }
                    }
                }
            };
            ring(5.5, 6.0, 0);
            ring(9.5, 8.5, 1);
        } else if (type.includes('raw_onion_rings') || type.includes('onion_rings_raw') || type.includes('sliced')) {
            // 2 sliced raw onion rings (purple skin rim, crisp white interior)
            const ring = (cx, cz, yBase) => {
                for (let x = 1; x <= 14; x++) {
                    for (let z = 1; z <= 14; z++) {
                        const d2 = (x-cx)*(x-cx) + (z-cz)*(z-cz);
                        if (d2 <= 14 && d2 >= 5) {
                            const isRim = d2 >= 10;
                            vb.add(x, yBase, z, isRim ? PALETTE.ONION_PURPLE : PALETTE.ONION_WHITE);
                        }
                    }
                }
            };
            ring(5.5, 6.0, 0);
            ring(9.5, 8.5, 1);
        } else {
            // Whole 3D bulbous onion with skin and green sprout tip
            const cx = 7.5, cy = 3.5, cz = 7.5;
            const rx = 4.0, ry = 3.8, rz = 4.0;
            for (let x = 3; x <= 12; x++) {
                for (let y = 0; y <= 7; y++) {
                    for (let z = 3; z <= 12; z++) {
                        const dx = (x - cx) / rx, dy = (y - cy) / ry, dz = (z - cz) / rz;
                        if (dx*dx + dy*dy + dz*dz <= 1.0) {
                            let col = PALETTE.ONION_SKIN;
                            if ((x + z) % 3 === 0) col = PALETTE.ONION_SKIN_DARK;
                            vb.add(x, y, z, col);
                        }
                    }
                }
            }
            vb.add(7, 0, 7, PALETTE.WOOD_DARK); // Root
            vb.add(7, 8, 7, PALETTE.LETTUCE_LIGHT); // Sprout tip
            vb.add(7, 9, 7, PALETTE.LETTUCE);
        }
    }
    else if (type.includes('chicken')) {
        if (type.includes('cooked')) {
            // 3 crispy cooked golden-brown chicken tenders
            vb.addBox(3, 0, 3, 8, 2, 5, PALETTE.CHICKEN_COOKED);
            vb.addBox(4, 1, 6, 11, 3, 8, PALETTE.CHICKEN_CRISP);
            vb.addBox(3, 0, 9, 9, 2, 12, PALETTE.CHICKEN_COOKED);
        } else if (type.includes('coated')) {
            // 3 breaded chicken strips with breadcrumbs
            vb.addBox(3, 0, 3, 8, 2, 5, PALETTE.COATING_GOLD);
            vb.addBox(4, 1, 6, 11, 3, 8, PALETTE.COATING_CRUMB);
            vb.addBox(3, 0, 9, 9, 2, 12, PALETTE.COATING_GOLD);
        } else if (type.includes('strips')) {
            // 3 raw chicken strips
            vb.addBox(3, 0, 3, 8, 1, 5, PALETTE.CHICKEN_RAW);
            vb.addBox(4, 0, 6, 11, 1, 8, PALETTE.CHICKEN_RAW_SHADOW);
            vb.addBox(3, 0, 9, 9, 1, 12, PALETTE.CHICKEN_RAW);
        } else {
            // Whole raw chicken breast fillet
            const cx = 7.5, cy = 2.0, cz = 7.5;
            const rx = 4.5, ry = 2.0, rz = 4.0;
            for (let x = 3; x <= 12; x++) {
                for (let y = 0; y <= 4; y++) {
                    for (let z = 3; z <= 12; z++) {
                        const dx = (x - cx) / rx, dy = (y - cy) / ry, dz = (z - cz) / rz;
                        if (dx*dx + dy*dy + dz*dz <= 1.0) {
                            let col = PALETTE.CHICKEN_RAW;
                            if ((x + z) % 4 === 0) col = 0xffffff; // Tendon streak
                            vb.add(x, y, z, col);
                        }
                    }
                }
            }
        }
    }
    else if (type.includes('bacon')) {
        const c = type.includes('cooked') ? PALETTE.BACON_COOKED : PALETTE.BACON_RAW;
        vb.addBox(2, 0, 5, 13, 1, 7, c);
        vb.add(4, 1, 6, 0xffffff); // Fat streak
        vb.add(9, 1, 6, 0xffffff);
        vb.addBox(2, 0, 9, 13, 1, 11, c);
        vb.add(5, 1, 10, 0xffffff);
        vb.add(10, 1, 10, 0xffffff);
    }
    else if (type.includes('banana')) {
        if (type.includes('sliced')) {
            // 3 sliced banana discs with central star core
            const drawSlice = (cx, cz) => {
                for (let x = cx - 2; x <= cx + 2; x++) {
                    for (let z = cz - 2; z <= cz + 2; z++) {
                        const d2 = (x-cx)*(x-cx) + (z-cz)*(z-cz);
                        if (d2 <= 4.5) {
                            let c = PALETTE.BANANA;
                            if (d2 <= 1.0) c = PALETTE.WOOD_DARK; // seed
                            else if (d2 <= 3.0) c = PALETTE.BANANA_PALE;
                            vb.add(x, 0, z, c);
                        }
                    }
                }
            };
            drawSlice(4, 5);
            drawSlice(11, 6);
            drawSlice(7, 10);
        } else {
            // Curved 3D yellow banana with stem
            vb.addBox(3, 0, 6, 4, 1, 7, PALETTE.WOOD_DARK); // Blossom tip
            vb.addBox(4, 0, 7, 7, 2, 9, PALETTE.BANANA);
            vb.addBox(7, 1, 8, 11, 3, 9, PALETTE.BANANA);
            vb.addBox(11, 2, 7, 13, 4, 8, PALETTE.BANANA);
            vb.addBox(13, 4, 6, 14, 5, 7, PALETTE.BANANA_STEM); // Green stem
        }
    }
    else if (type.includes('strawberry')) {
        if (type.includes('sliced')) {
            // 2 strawberry halves
            vb.addBox(3, 0, 4, 7, 1, 8, PALETTE.STRAWBERRY_RED);
            vb.addBox(4, 1, 5, 6, 1, 7, PALETTE.STRAWBERRY_PULP);
            vb.addBox(9, 0, 7, 13, 1, 11, PALETTE.STRAWBERRY_RED);
            vb.addBox(10, 1, 8, 12, 1, 10, PALETTE.STRAWBERRY_PULP);
        } else {
            // 3D conical strawberry with seeds and green leafy crown
            vb.addBox(6, 0, 6, 9, 1, 9, PALETTE.STRAWBERRY_RED);
            vb.addBox(5, 2, 5, 10, 4, 10, PALETTE.STRAWBERRY_RED);
            vb.add(5, 3, 5, PALETTE.EGG_YOLK); // Yellow seed dot
            vb.add(10, 3, 5, PALETTE.EGG_YOLK);
            vb.add(5, 3, 10, PALETTE.EGG_YOLK);
            vb.add(10, 3, 10, PALETTE.EGG_YOLK);
            // Green leafy top
            vb.addBox(4, 5, 4, 11, 5, 11, PALETTE.LETTUCE);
            vb.addBox(7, 6, 7, 8, 7, 8, PALETTE.LETTUCE_DARK); // Stem
        }
    }
    else if (type.includes('pizza_dough')) {
        // Floured 3D soft dough ball
        const cx = 7.5, cy = 3.0, cz = 7.5, r = 4.0;
        for (let x = 3; x <= 12; x++) {
            for (let y = 0; y <= 6; y++) {
                for (let z = 3; z <= 12; z++) {
                    const dx = x - cx, dy = y - cy, dz = z - cz;
                    if (dx*dx + dy*dy + dz*dz <= r*r) {
                        let c = PALETTE.PIZZA_CRUST;
                        if ((x + y + z) % 3 === 0) c = 0xffffff; // Flour dust
                        vb.add(x, y, z, c);
                    }
                }
            }
        }
    }
    else if (type.includes('pizza_base')) {
        // Flat round pizza base with rolled crust rim
        const cx = 7.5, cz = 7.5;
        for (let x = 2; x <= 13; x++) {
            for (let z = 2; z <= 13; z++) {
                const d2 = (x-cx)*(x-cx) + (z-cz)*(z-cz);
                if (d2 <= 25) {
                    vb.add(x, 0, z, PALETTE.PIZZA_CRUST);
                    if (d2 >= 16) vb.add(x, 1, z, PALETTE.PIZZA_CRUST_BAKED); // Rim
                }
            }
        }
    }
    else if (type.includes('pizza_margherita_raw')) {
        // Raw assembled pizza with red sauce, fresh mozzarella & basil
        const cx = 7.5, cz = 7.5;
        for (let x = 2; x <= 13; x++) {
            for (let z = 2; z <= 13; z++) {
                const d2 = (x-cx)*(x-cx) + (z-cz)*(z-cz);
                if (d2 <= 25) {
                    vb.add(x, 0, z, PALETTE.PIZZA_CRUST);
                    if (d2 >= 16) {
                        vb.add(x, 1, z, PALETTE.PIZZA_CRUST);
                    } else {
                        vb.add(x, 1, z, PALETTE.SAUCE_RED);
                    }
                }
            }
        }
        // Raw mozzarella slices
        vb.addBox(5, 2, 5, 7, 2, 7, PALETTE.MOZZARELLA);
        vb.addBox(8, 2, 8, 10, 2, 10, PALETTE.MOZZARELLA);
        vb.addBox(8, 2, 5, 10, 2, 6, PALETTE.MOZZARELLA);
        vb.add(6, 2, 9, PALETTE.BASIL_LEAF); // Fresh basil
    }
    else if (type.includes('egg')) {
        // 3D smooth oval egg
        const cx = 7.5, cy = 3.5, cz = 7.5;
        const rx = 3.2, ry = 4.2, rz = 3.2;
        for (let x = 4; x <= 11; x++) {
            for (let y = 0; y <= 7; y++) {
                for (let z = 4; z <= 11; z++) {
                    const dx = (x - cx) / rx, dy = (y - cy) / ry, dz = (z - cz) / rz;
                    if (dx*dx + dy*dy + dz*dz <= 1.0) {
                        vb.add(x, y, z, PALETTE.EGG_SHELL);
                    }
                }
            }
        }
    }
    else if (type.includes('pancake')) {
        if (type.includes('mix')) {
            // Branded pancake mix box
            vb.addBox(4, 0, 4, 11, 7, 11, PALETTE.WOOD_BOARD);
            vb.addBox(4, 2, 4, 11, 5, 11, PALETTE.PLASTIC_BLUE); // Brand banner
            vb.addBox(6, 3, 12, 9, 4, 12, PALETTE.EGG_YOLK); // Wheat logo
        } else if (type.includes('batter')) {
            // Bowl filled with smooth golden pancake batter
            const cx = 7.5, cz = 7.5;
            for (let y = 0; y <= 3; y++) {
                const rOuter = 4 + y*0.5;
                for (let x = 2; x <= 13; x++) {
                    for (let z = 2; z <= 13; z++) {
                        const dist2 = (x-cx)*(x-cx) + (z-cz)*(z-cz);
                        if (dist2 <= rOuter*rOuter) {
                            if (dist2 >= (rOuter - 1.5) * (rOuter - 1.5) || y === 0) {
                                vb.add(x, y, z, PALETTE.METAL_SHINY); // Bowl
                            } else {
                                vb.add(x, y, z, PALETTE.FRIES_RAW); // Batter
                            }
                        }
                    }
                }
            }
        } else {
            // Cooked pancakes (2 stack)
            const cx = 7.5, cz = 7.5;
            for (let y = 0; y <= 2; y++) {
                for (let x = 3; x <= 12; x++) {
                    for (let z = 3; z <= 12; z++) {
                        const d2 = (x-cx)*(x-cx) + (z-cz)*(z-cz);
                        if (d2 <= 16) vb.add(x, y, z, (y === 2 && (x+z)%2 === 0) ? PALETTE.PANCAKE_BROWN : PALETTE.PANCAKE);
                    }
                }
            }
        }
    }
    else if (type.includes('omelette')) {
        if (type.includes('mix')) {
            // Whisked yellow egg liquid in bowl
            vb.addBox(4, 0, 4, 11, 2, 11, PALETTE.METAL_SHINY);
            vb.addBox(5, 2, 5, 10, 2, 10, PALETTE.EGG_YOLK);
        } else {
            // Folded cooked golden omelette
            vb.addBox(3, 0, 5, 12, 2, 10, PALETTE.EGG_YOLK);
            vb.add(6, 2, 7, PALETTE.PARSLEY);
            vb.add(9, 2, 8, PALETTE.PARSLEY);
        }
    }
    else if (type.includes('milk')) {
        // Classic blue & white dairy carton with folded gable spout
        vb.addBox(5, 0, 5, 10, 6, 10, PALETTE.PLATE_WHITE);
        vb.addBox(5, 2, 5, 10, 4, 10, PALETTE.PLASTIC_BLUE); // Blue label
        // Triangular gable roof
        vb.addBox(5, 7, 6, 10, 7, 9, PALETTE.PLATE_WHITE);
        vb.addBox(5, 8, 7, 10, 8, 8, PALETTE.PLATE_WHITE);
    }
    else if (type.includes('yogurt')) {
        // Greek yogurt tub with foil lid
        vb.addBox(5, 0, 5, 10, 4, 10, PALETTE.PLATE_WHITE);
        vb.addBox(4, 5, 4, 11, 5, 11, PALETTE.METAL_SHINY); // Silver foil lid
        vb.addBox(5, 2, 4, 10, 3, 4, PALETTE.STRAWBERRY); // Fruit flavor stripe
    }
    else if (type.includes('granola')) {
        // Glass mason jar with granola clusters & screw lid
        vb.addBox(5, 0, 5, 10, 5, 10, PALETTE.GLASS_BLUE);
        vb.addBox(6, 1, 6, 9, 4, 9, PALETTE.PANCAKE_BROWN); // Granola inside
        vb.add(7, 3, 7, PALETTE.COATING_CRUMB);
        vb.addBox(5, 6, 5, 10, 7, 10, PALETTE.METAL_DARK); // Lid
    }
    else if (type.includes('syrup')) {
        // Glass maple syrup jug with handle & amber liquid
        vb.addBox(5, 0, 5, 10, 5, 10, PALETTE.GLASS_BLUE);
        vb.addBox(6, 1, 6, 9, 4, 9, PALETTE.SYRUP_AMBER); // Amber maple syrup
        vb.addBox(7, 6, 7, 8, 8, 8, PALETTE.METAL_SHINY); // Neck & cap
        vb.addBox(4, 2, 7, 4, 4, 8, PALETTE.GLASS_BLUE); // Handle
    }
    else if (type.includes('coating')) {
        // Bag of golden panko breadcrumb mix
        vb.addBox(5, 0, 4, 10, 6, 11, PALETTE.WOOD_BOARD);
        vb.addBox(6, 2, 3, 9, 4, 3, PALETTE.COATING_GOLD); // Label
        vb.addBox(6, 7, 5, 9, 8, 10, PALETTE.METAL_LIGHT); // Folded top clip
    }
    else {
        vb.addBox(4, 0, 4, 11, 7, 11, PALETTE.PLASTIC_BLUE); // Generic fallback
    }

    const mesh = vb.buildMesh();
    
    // *** KEY FIX: NORMALIZE ORIGIN ***
    // VoxelBuilder 0,0,0 is center of grid unit.
    // This shift makes (0,0,0) the BOTTOM of the mesh.
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