import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GRID_UNIT, PALETTE, VOXEL_SIZE } from '../config/constants';

export class VoxelBuilder {
    private geometries: THREE.BufferGeometry[] = [];
    private baseGeometry: THREE.BoxGeometry;

    constructor() {
        this.baseGeometry = new THREE.BoxGeometry(VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE);
    }

    add(x: number, y: number, z: number, color: number): this {
        const matrix = new THREE.Matrix4();
        const offset = (VOXEL_SIZE / 2);
        const tx = (x * VOXEL_SIZE) - (GRID_UNIT / 2) + offset;
        const ty = (y * VOXEL_SIZE) - (GRID_UNIT / 2) + offset;
        const tz = (z * VOXEL_SIZE) - (GRID_UNIT / 2) + offset;
        matrix.makeTranslation(tx, ty, tz);

        const geometry = this.baseGeometry.clone();
        geometry.applyMatrix4(matrix);

        const colors: number[] = [];
        const c = new THREE.Color(color);
        const count = geometry.attributes.position.count;
        for (let i = 0; i < count; i++) {
            colors.push(c.r, c.g, c.b);
        }
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        this.geometries.push(geometry);
        return this;
    }

    addBox(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, color: number): this {
        for (let x = x1; x <= x2; x++) {
            for (let y = y1; y <= y2; y++) {
                for (let z = z1; z <= z2; z++) {
                    this.add(x, y, z, color);
                }
            }
        }
        return this;
    }

    buildGeometry(): THREE.BufferGeometry {
        if (this.geometries.length === 0) return new THREE.BufferGeometry();
        const mergedGeometry = BufferGeometryUtils.mergeGeometries(this.geometries, false);
        this.geometries.forEach(g => g.dispose());
        this.geometries = [];
        return mergedGeometry;
    }
}

export const VoxelFactory = {
    cache: new Map<string, THREE.BufferGeometry>(),

    getCached: (key: string, creator: () => THREE.BufferGeometry) => {
        if (VoxelFactory.cache.has(key)) {
            return VoxelFactory.cache.get(key)!;
        }
        const geo = creator();
        VoxelFactory.cache.set(key, geo);
        return geo;
    },

    createTrashBin: () => {
        return VoxelFactory.getCached('trash', () => {
            const vb = new VoxelBuilder();
            vb.addBox(3, 0, 3, 12, 10, 12, PALETTE.TRASH_GREEN);
            vb.addBox(2, 10, 2, 13, 11, 13, PALETTE.TRASH_LID);
            vb.addBox(6, 0, 13, 9, 1, 15, PALETTE.METAL_LIGHT);
            vb.addBox(4, 9, 4, 11, 10, 11, PALETTE.BLACK);
            const geo = vb.buildGeometry();
            geo.translate(0, GRID_UNIT / 2, 0);
            return geo;
        });
    },

    createFryer: () => {
        return VoxelFactory.getCached('fryer', () => {
            const vb = new VoxelBuilder();
            vb.addBox(1, 0, 1, 14, 8, 14, PALETTE.METAL_SHINY);
            vb.addBox(2, 5, 2, 13, 7, 13, PALETTE.OIL_GOLD);
            vb.addBox(1, 8, 1, 14, 12, 3, PALETTE.METAL_DARK);
            vb.addBox(4, 9, 4, 4, 14, 4, PALETTE.BLACK);
            vb.addBox(11, 9, 4, 11, 14, 4, PALETTE.BLACK);
            vb.addBox(4, 5, 4, 11, 8, 11, PALETTE.METAL_DARK);
            const geo = vb.buildGeometry();
            geo.translate(0, GRID_UNIT / 2, 0);
            return geo;
        });
    },

    createCuttingBoard: () => {
        return VoxelFactory.getCached('cutting_board', () => {
            const vb = new VoxelBuilder();
            vb.addBox(2, 0, 2, 13, 1, 13, PALETTE.WOOD_BOARD);
            vb.addBox(10, 1, 3, 10, 1, 10, PALETTE.METAL_SHINY);
            vb.addBox(10, 1, 11, 10, 1, 13, PALETTE.BLACK);
            const geo = vb.buildGeometry();
            geo.translate(0, GRID_UNIT / 2, 0);
            return geo;
        });
    },

    createStove: () => {
        return VoxelFactory.getCached('stove', () => {
            const vb = new VoxelBuilder();
            vb.addBox(1, 0, 1, 14, 2, 14, PALETTE.METAL_DARK);
            vb.addBox(2, 2, 2, 13, 2, 13, PALETTE.BLACK);
            vb.addBox(4, 2, 4, 5, 2, 5, PALETTE.FIRE_ORANGE);
            vb.addBox(10, 2, 10, 11, 2, 11, PALETTE.FIRE_ORANGE);
            vb.addBox(3, 1, 14, 4, 1, 15, PALETTE.PLASTIC_RED);
            vb.addBox(11, 1, 14, 12, 1, 15, PALETTE.PLASTIC_RED);
            const geo = vb.buildGeometry();
            geo.translate(0, GRID_UNIT / 2, 0);
            return geo;
        });
    },

    createSink: () => {
        return VoxelFactory.getCached('sink', () => {
            const vb = new VoxelBuilder();
            vb.addBox(1, 0, 1, 14, 4, 14, PALETTE.METAL_SHINY);
            vb.addBox(2, 2, 2, 13, 3, 13, PALETTE.WATER_BLUE);
            vb.addBox(7, 4, 1, 8, 10, 2, PALETTE.METAL_LIGHT);
            vb.addBox(7, 10, 2, 8, 11, 8, PALETTE.METAL_LIGHT);
            vb.addBox(7, 8, 8, 8, 9, 8, PALETTE.METAL_LIGHT);
            const geo = vb.buildGeometry();
            geo.translate(0, GRID_UNIT / 2, 0);
            return geo;
        });
    },

    createToaster: () => {
        return VoxelFactory.getCached('toaster', () => {
            const vb = new VoxelBuilder();
            vb.addBox(3, 0, 3, 12, 6, 12, PALETTE.METAL_SHINY);
            vb.addBox(4, 6, 5, 11, 6, 6, PALETTE.BLACK);
            vb.addBox(4, 6, 9, 11, 6, 10, PALETTE.BLACK);
            vb.addBox(13, 2, 7, 14, 4, 8, PALETTE.BLACK);
            const geo = vb.buildGeometry();
            geo.translate(0, GRID_UNIT / 2, 0);
            return geo;
        });
    },

    createMixer: () => {
        return VoxelFactory.getCached('mixer', () => {
            const vb = new VoxelBuilder();
            vb.addBox(4, 0, 4, 11, 1, 11, PALETTE.METAL_LIGHT);
            vb.addBox(4, 1, 4, 6, 10, 6, PALETTE.METAL_LIGHT);
            vb.addBox(4, 10, 4, 11, 12, 6, PALETTE.METAL_LIGHT);
            vb.addBox(9, 2, 6, 11, 6, 11, PALETTE.METAL_SHINY);
            vb.addBox(9, 6, 8, 9, 10, 9, PALETTE.METAL_DARK);
            const geo = vb.buildGeometry();
            geo.translate(0, GRID_UNIT / 2, 0);
            return geo;
        });
    },

    createBlender: () => {
        return VoxelFactory.getCached('blender', () => {
            const vb = new VoxelBuilder();
            vb.addBox(5, 0, 5, 10, 4, 10, PALETTE.METAL_DARK);
            vb.addBox(6, 4, 6, 9, 11, 9, PALETTE.GLASS_BLUE);
            vb.addBox(6, 11, 6, 9, 12, 9, PALETTE.BLACK);
            const geo = vb.buildGeometry();
            geo.translate(0, GRID_UNIT / 2, 0);
            return geo;
        });
    },

    createDoughPress: () => {
        return VoxelFactory.getCached('dough_press', () => {
            const vb = new VoxelBuilder();
            vb.addBox(2, 0, 2, 13, 1, 13, PALETTE.METAL_LIGHT);
            vb.addBox(7, 1, 2, 8, 8, 3, PALETTE.METAL_DARK);
            vb.addBox(3, 8, 3, 12, 9, 12, PALETTE.METAL_LIGHT);
            vb.addBox(7, 9, 7, 8, 12, 8, PALETTE.BLACK);
            vb.addBox(5, 12, 7, 10, 13, 8, PALETTE.BLACK);
            const geo = vb.buildGeometry();
            geo.translate(0, GRID_UNIT / 2, 0);
            return geo;
        });
    },

    createPizzaOven: () => {
        return VoxelFactory.getCached('pizza_oven', () => {
            const vb = new VoxelBuilder();
            vb.addBox(1, 0, 1, 14, 1, 14, PALETTE.METAL_DARK);
            vb.addBox(1, 1, 1, 3, 10, 14, PALETTE.WOOD_DARK);
            vb.addBox(12, 1, 1, 14, 10, 14, PALETTE.WOOD_DARK);
            vb.addBox(1, 1, 1, 14, 10, 3, PALETTE.WOOD_DARK);
            vb.addBox(1, 10, 1, 14, 12, 14, PALETTE.WOOD_DARK);
            vb.addBox(6, 2, 6, 9, 4, 9, PALETTE.FIRE_ORANGE);
            const geo = vb.buildGeometry();
            geo.translate(0, GRID_UNIT / 2, 0);
            return geo;
        });
    },

    createTable: (neighbors: { n: boolean, s: boolean, e: boolean, w: boolean }) => {
        // Tables depend on neighbors, so key must include them
        const key = `table_${neighbors.n ? 'n' : ''}${neighbors.s ? 's' : ''}${neighbors.e ? 'e' : ''}${neighbors.w ? 'w' : ''}`;
        return VoxelFactory.getCached(key, () => {
            const vb = new VoxelBuilder();
            vb.addBox(0, 15, 0, 15, 15, 15, PALETTE.METAL_SHINY);
            vb.addBox(1, 5, 1, 14, 5, 14, PALETTE.METAL_DARK);

            const addLeg = (x: number, z: number) => vb.addBox(x, 0, z, x + 1, 14, z + 1, PALETTE.METAL_LIGHT);

            if (!neighbors.w && !neighbors.n) addLeg(1, 1);
            if (!neighbors.e && !neighbors.n) addLeg(13, 1);
            if (!neighbors.w && !neighbors.s) addLeg(1, 13);
            if (!neighbors.e && !neighbors.s) addLeg(13, 13);

            const geo = vb.buildGeometry();
            geo.scale(1, 1.8, 1);
            geo.translate(0, (GRID_UNIT * 1.8) / 2, 0);
            return geo;
        });
    },

    createIngredientBin: (ingredientType: string) => {
        return VoxelFactory.getCached(`bin_${ingredientType}`, () => {
            const vb = new VoxelBuilder();
            vb.addBox(1, 0, 1, 14, 6, 14, PALETTE.WOOD_LIGHT);
            vb.addBox(2, 1, 2, 13, 6, 13, PALETTE.BLACK);

            const c = getIngredientColor(ingredientType);
            if (c) {
                vb.addBox(3, 2, 3, 6, 5, 6, c);
                vb.addBox(7, 3, 4, 10, 5, 8, c);
                vb.addBox(4, 4, 8, 8, 6, 11, c);
            }
            const geo = vb.buildGeometry();
            geo.translate(0, GRID_UNIT / 2, 0);
            return geo;
        });
    },

    createPlateStack: () => {
        return VoxelFactory.getCached('plate_stack', () => {
            const vb = new VoxelBuilder();
            for (let y = 0; y < 8; y += 2) {
                vb.addBox(3, y, 3, 12, y + 1, 12, PALETTE.PLATE_WHITE);
            }
            const geo = vb.buildGeometry();
            geo.translate(0, GRID_UNIT / 2, 0);
            return geo;
        });
    },

    createCupStack: () => {
        return VoxelFactory.getCached('cup_stack', () => {
            const vb = new VoxelBuilder();
            for (let i = 0; i < 3; i++) {
                let y = i * 3;
                vb.addBox(5, y, 5, 10, y + 2, 10, PALETTE.WATER_BLUE);
            }
            const geo = vb.buildGeometry();
            geo.translate(0, GRID_UNIT / 2, 0);
            return geo;
        });
    },

    createBowlStack: () => {
        return VoxelFactory.getCached('bowl_stack', () => {
            const vb = new VoxelBuilder();
            for (let i = 0; i < 4; i++) {
                let y = i * 2;
                vb.addBox(4, y, 4, 11, y + 1, 11, PALETTE.WOOD_BOARD);
            }
            const geo = vb.buildGeometry();
            geo.translate(0, GRID_UNIT / 2, 0);
            return geo;
        });
    },

    createItem: (type: string) => {
        return VoxelFactory.getCached(`item_${type}`, () => {
            const vb = new VoxelBuilder();

            if (type === 'plate') {
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
            else if (type.includes('tomato')) {
                if (type.includes('sauce')) {
                    vb.addBox(4, 0, 4, 11, 5, 11, PALETTE.METAL_LIGHT);
                    vb.addBox(4, 2, 4, 11, 4, 11, PALETTE.SAUCE_RED);
                } else {
                    vb.addBox(5, 0, 5, 10, 4, 10, PALETTE.TOMATO);
                    if (!type.includes('chopped')) vb.addBox(6, 4, 6, 9, 5, 9, PALETTE.LETTUCE);
                }
            }
            else if (type.includes('lettuce')) {
                vb.addBox(4, 0, 4, 11, 7, 11, PALETTE.LETTUCE);
            }
            else if (type.includes('potato')) {
                vb.addBox(5, 0, 4, 10, 3, 11, PALETTE.POTATO);
            }
            else if (type === 'raw_fries') {
                vb.addBox(6, 0, 4, 7, 4, 5, PALETTE.FRIES_RAW); vb.addBox(8, 0, 6, 9, 4, 7, PALETTE.FRIES_RAW); vb.addBox(5, 0, 7, 6, 4, 8, PALETTE.FRIES_RAW);
            }
            else if (type === 'cooked_fries') {
                vb.addBox(6, 0, 4, 7, 4, 5, PALETTE.FRIES_COOKED); vb.addBox(8, 0, 6, 9, 4, 7, PALETTE.FRIES_COOKED); vb.addBox(5, 0, 7, 6, 4, 8, PALETTE.FRIES_COOKED);
            }
            else if (type.includes('patty')) {
                const c = type.includes('cooked') ? PALETTE.MEAT_COOKED : PALETTE.MEAT_RAW;
                vb.addBox(3, 0, 3, 12, 2, 12, c);
            }
            else if (type === 'bun' || type.includes('bread')) {
                const c = type.includes('toasted') ? PALETTE.WOOD_DARK : PALETTE.BUN;
                vb.addBox(3, 0, 3, 12, 2, 12, c);
            }
            else if (type.includes('cheese') || type.includes('mozzarella')) {
                vb.addBox(3, 0, 3, 12, 1, 12, PALETTE.CHEESE);
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
                vb.addBox(3, 0, 7, 12, 3, 9, PALETTE.BANANA);
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
                if (type.includes('mix') || type.includes('batter')) vb.addBox(5, 0, 5, 10, 6, 10, PALETTE.WOOD_BOARD);
                else vb.addBox(3, 0, 3, 12, 2, 12, PALETTE.PANCAKE);
            }
            else if (type.includes('omelette')) {
                vb.addBox(3, 0, 6, 12, 3, 10, PALETTE.EGG_YOLK);
            }
            else if (type.includes('milk') || type.includes('yogurt')) {
                vb.addBox(5, 0, 5, 10, 8, 10, PALETTE.WHITE);
            }
            else if (type === 'syrup') {
                vb.addBox(6, 0, 6, 9, 8, 9, PALETTE.WOOD_DARK); // Brown bottle
            }
            else if (type === 'granola') {
                vb.addBox(4, 0, 4, 11, 3, 11, PALETTE.WOOD_LIGHT);
            }
            else if (type === 'smoothie_ready') {
                vb.addBox(5, 0, 5, 10, 6, 10, PALETTE.PLASTIC_RED); // Pinkish
            }
            else if (type === 'grilled_cheese_cooked') {
                vb.addBox(3, 0, 3, 12, 2, 12, PALETTE.WOOD_DARK); // Toasted
            }
            else if (type === 'cooked_onion_rings') {
                vb.addBox(4, 0, 4, 11, 2, 11, PALETTE.FRIES_COOKED);
            }
            else if (type === 'cooked_chicken_tenders') {
                vb.addBox(4, 0, 4, 11, 2, 9, PALETTE.CHICKEN_COOKED);
            }
            else {
                vb.addBox(4, 0, 4, 11, 7, 11, PALETTE.PLASTIC_BLUE);
            }

            const geo = vb.buildGeometry();
            geo.translate(0, GRID_UNIT / 2, 0);
            return geo;
        });
    },

    createWall: () => {
        return VoxelFactory.getCached('wall', () => {
            const vb = new VoxelBuilder();
            vb.addBox(0, 0, 0, 15, 15, 15, PALETTE.WALL_WHITE);
            const geo = vb.buildGeometry();
            return geo;
        });
    },

    createCounter: () => {
        return VoxelFactory.getCached('counter', () => {
            const vb = new VoxelBuilder();
            vb.addBox(0, 0, 0, 15, 15, 15, PALETTE.WOOD_LIGHT);
            vb.addBox(0, 15, 0, 15, 15, 15, PALETTE.COUNTER_TOP);
            const geo = vb.buildGeometry();
            geo.scale(1, 1.8, 1);
            geo.translate(0, (GRID_UNIT * 1.8) / 2, 0);
            return geo;
        });
    }
};

function getIngredientColor(type: string): number | null {
    if (type.includes('tomato')) return type.includes('sauce') ? PALETTE.SAUCE_RED : PALETTE.TOMATO;
    if (type.includes('lettuce')) return PALETTE.LETTUCE;
    if (type.includes('cheese') || type.includes('mozzarella')) return PALETTE.CHEESE;
    if (type.includes('bun') || type.includes('bread')) return PALETTE.BUN;
    if (type.includes('patty')) return PALETTE.MEAT_RAW;
    if (type.includes('cooked_patty')) return PALETTE.MEAT_COOKED;
    if (type.includes('potato')) return PALETTE.POTATO;
    if (type.includes('fries')) return PALETTE.FRIES_RAW;
    if (type.includes('onion')) return PALETTE.ONION;
    if (type.includes('chicken')) return PALETTE.CHICKEN_RAW;
    if (type.includes('bacon')) return PALETTE.BACON_RAW;
    if (type.includes('banana')) return PALETTE.BANANA;
    if (type.includes('strawberry')) return PALETTE.STRAWBERRY;
    if (type.includes('egg')) return PALETTE.EGG_WHITE;
    if (type.includes('pizza')) return PALETTE.PIZZA_CRUST;
    if (type.includes('coating')) return PALETTE.WOOD_BOARD;
    return null;
}
