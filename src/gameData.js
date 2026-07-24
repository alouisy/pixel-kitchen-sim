// src/gameData.js
import { MEAL, STATION } from './ids.js';

// --- RECIPES ---
// Includes default timeLimit, baseScore, penalty, and instructions per recipe
// Ingredient names MUST match the 'finalName' generated in items.js
export const RECIPES = {
    [MEAL.FRENCH_FRIES]: {
        ingredients: ['cooked_fries'].sort(),
        timeLimit: 75, baseScore: 60, penalty: 30,
        visualSteps: [
            { type: 'source', station: STATION.POTATO_BIN, item: 'potato' },
            { type: 'process', station: STATION.CUTTING_BOARD, item: 'raw_fries' },
            { type: 'process', station: STATION.DEEP_FRYER, item: 'cooked_fries' },
            { type: 'container', station: STATION.PLATE_STACK, item: 'plate' },
            { type: 'serve', station: STATION.SERVING_PASS, item: MEAL.FRENCH_FRIES }
        ],
        instructions: {
            en: [
                "Get Potato (Bin)",
                "Use Cutting Board -> Raw Fries",
                "Use Fryer -> Cooked Fries",
                "Get Plate (Stack)",
                "Combine Plate + Cooked Fries (Assembly)",
                "Serve (Counter)"
            ],
            fr: [
                "Prendre Patate (Bac)",
                "Utiliser Planche -> Frites Crues",
                "Utiliser Friteuse -> Frites Cuites",
                "Prendre Assiette (Pile)",
                "Combiner Assiette + Frites Cuites (Assemblage)",
                "Servir (Comptoir)"
            ],
            es: [
                "Coger Patata (Contenedor)",
                "Usar Tabla -> Patatas Crudas",
                "Usar Freidora -> Patatas Cocidas",
                "Coger Plato (Pila)",
                "Combinar Plato + Patatas Cocidas (Ensamblaje)",
                "Servir (Mostrador)"
            ]
        }
    },
    [MEAL.SALAD]: {
        ingredients: ['chopped_lettuce', 'chopped_tomato'].sort(),
        timeLimit: 90, baseScore: 75, penalty: 40,
        visualSteps: [
            { type: 'source', station: STATION.LETTUCE_BIN, item: 'lettuce' },
            { type: 'process', station: STATION.CUTTING_BOARD, item: 'chopped_lettuce' },
            { type: 'source', station: STATION.TOMATO_BIN, item: 'tomato' },
            { type: 'process', station: STATION.CUTTING_BOARD, item: 'chopped_tomato' },
            { type: 'container', station: STATION.PLATE_STACK, item: 'plate' },
            { type: 'serve', station: STATION.SERVING_PASS, item: MEAL.SALAD }
        ],
        instructions: {
            en: [
                "Get Lettuce (Bin)",
                "Use Cutting Board -> Chopped Lettuce",
                "Get Tomato (Bin)",
                "Use Cutting Board -> Chopped Tomato",
                "Get Plate (Stack)",
                "Combine Plate + Chopped Lettuce + Chopped Tomato (Assembly)",
                "Serve (Counter)"
            ],
            fr: [
                "Prendre Laitue (Bac)",
                "Utiliser Planche -> Laitue Hachée",
                "Prendre Tomate (Bac)",
                "Utiliser Planche -> Tomate Hachée",
                "Prendre Assiette (Pile)",
                "Combiner Assiette + Laitue Hachée + Tomate Hachée (Assemblage)",
                "Servir (Comptoir)"
            ],
            es: [
                "Coger Lechuga (Contenedor)",
                "Usar Tabla -> Lechuga Picada",
                "Coger Tomate (Contenedor)",
                "Usar Tabla -> Tomate Picado",
                "Coger Plato (Pila)",
                "Combinar Plato + Lechuga Picada + Tomate Picado (Ensamblaje)",
                "Servir (Mostrador)"
            ]
        }
    },
    [MEAL.HAMBURGER]: {
        ingredients: ['bun', 'cooked_patty'].sort(),
        timeLimit: 100, baseScore: 100, penalty: 50,
        visualSteps: [
            { type: 'source', station: STATION.PATTY_BOX, item: 'patty' },
            { type: 'process', station: STATION.STOVE_TOP, item: 'cooked_patty' },
            { type: 'source', station: STATION.BUN_RACK, item: 'bun' },
            { type: 'container', station: STATION.PLATE_STACK, item: 'plate' },
            { type: 'serve', station: STATION.SERVING_PASS, item: MEAL.HAMBURGER }
        ],
        instructions: {
            en: [
                "Get Patty (Bin)",
                "Use Grill -> Cooked Patty",
                "Get Bun (Rack)",
                "Get Plate (Stack)",
                "Combine Plate + Bun + Cooked Patty (Assembly)",
                "Serve (Counter)"
            ],
            fr: [
                "Prendre Steak Haché (Bac)",
                "Utiliser Grill -> Steak Cuit",
                "Prendre Pain (Étagère)",
                "Prendre Assiette (Pile)",
                "Combiner Assiette + Pain + Steak Cuit (Assemblage)",
                "Servir (Comptoir)"
            ],
            es: [
                "Coger Hamburguesa (Contenedor)",
                "Usar Parrilla -> Hamburguesa Cocida",
                "Coger Pan (Estante)",
                "Coger Plato (Pila)",
                "Combinar Plato + Pan + Hamburguesa Cocida (Ensamblaje)",
                "Servir (Mostrador)"
            ]
        }
    },
    [MEAL.CHEESEBURGER_COMBO]: {
        ingredients: ['bun', 'cheese_slice', 'cooked_fries', 'cooked_patty'].sort(),
        timeLimit: 130, baseScore: 120, penalty: 60,
        visualSteps: [
            { type: 'source', station: STATION.PATTY_BOX, item: 'patty' },
            { type: 'process', station: STATION.STOVE_TOP, item: 'cooked_patty' },
            { type: 'source', station: STATION.BUN_RACK, item: 'bun' },
            { type: 'source', station: STATION.CHEESE_FRIDGE, item: 'cheese_slice' },
            { type: 'process', station: STATION.DEEP_FRYER, item: 'cooked_fries' },
            { type: 'container', station: STATION.PLATE_STACK, item: 'plate' },
            { type: 'serve', station: STATION.SERVING_PASS, item: MEAL.CHEESEBURGER_COMBO }
        ],
        instructions: {
            en: [
                "Get Patty (Bin)",
                "Use Grill -> Cooked Patty",
                "Get Bun (Rack)",
                "Get Cheese Slice (Fridge)",
                "Get Potato (Bin)",
                "Use Cutting Board -> Raw Fries",
                "Use Fryer -> Cooked Fries",
                "Get Plate (Stack)",
                "Combine Plate + Bun + Cooked Patty + Cheese Slice + Cooked Fries (Assembly)",
                "Serve (Counter)"
            ],
            fr: [
                "Prendre Steak Haché (Bac)",
                "Utiliser Grill -> Steak Cuit",
                "Prendre Pain (Étagère)",
                "Prendre Tranche Fromage (Frigo)",
                "Prendre Patate (Bac)",
                "Utiliser Planche -> Frites Crues",
                "Utiliser Friteuse -> Frites Cuites",
                "Prendre Assiette (Pile)",
                "Combiner Assiette + Pain + Steak Cuit + Fromage + Frites Cuites (Assemblage)",
                "Servir (Comptoir)"
            ],
            es: [
                "Coger Hamburguesa (Contenedor)",
                "Usar Parrilla -> Hamburguesa Cocida",
                "Coger Pan (Estante)",
                "Coger Loncha Queso (Nevera)",
                "Coger Patata (Contenedor)",
                "Usar Tabla -> Patatas Crudas",
                "Usar Freidora -> Patatas Cocidas",
                "Coger Plato (Pila)",
                "Combinar Plato + Pan + Hamburguesa Cocida + Queso + Patatas Cocidas (Ensamblaje)",
                "Servir (Mostrador)"
            ]
        }
    },
    [MEAL.ONION_RINGS]: {
        ingredients: ['cooked_onion_rings'].sort(),
        timeLimit: 80, baseScore: 70, penalty: 35,
        visualSteps: [
            { type: 'source', station: STATION.ONION_BIN, item: 'onion' },
            { type: 'process', station: STATION.CUTTING_BOARD, item: 'raw_onion_rings' },
            { type: 'process', station: STATION.COATING_STATION, item: 'onion_rings_coated' },
            { type: 'process', station: STATION.DEEP_FRYER, item: 'cooked_onion_rings' },
            { type: 'container', station: STATION.PLATE_STACK, item: 'plate' },
            { type: 'serve', station: STATION.SERVING_PASS, item: MEAL.ONION_RINGS }
        ],
        instructions: {
            en: [
                "Get Onion (Bin)",
                "Use Cutting Board -> Raw Onion Rings",
                "Get Coating Mix (Source)",
                "Use Coating Station w/ Rings -> Coated Onion Rings",
                "Use Fryer -> Cooked Onion Rings",
                "Get Plate (Stack)",
                "Combine Plate + Cooked Onion Rings (Assembly)",
                "Serve (Counter)"
            ],
            fr: [
                "Prendre Oignon (Bac)",
                "Utiliser Planche -> Rondelles Oignon Crues",
                "Prendre Panure (Source)",
                "Utiliser Station Panure avec Rondelles -> Rondelles Panées",
                "Utiliser Friteuse -> Rondelles Cuites",
                "Prendre Assiette (Pile)",
                "Combiner Assiette + Rondelles Cuites (Assemblage)",
                "Servir (Comptoir)"
            ],
            es: [
                "Coger Cebolla (Contenedor)",
                "Usar Tabla -> Aros Cebolla Crudos",
                "Coger Mezcla Rebozar (Fuente)",
                "Usar Estación Rebozado con Aros -> Aros Rebozados",
                "Usar Freidora -> Aros Cocidos",
                "Coger Plato (Pila)",
                "Combinar Plato + Aros Cocidos (Ensamblaje)",
                "Servir (Mostrador)"
            ]
        }
    },
    [MEAL.CHICKEN_TENDERS_FRIES]: {
        ingredients: ['cooked_chicken_tenders', 'cooked_fries'].sort(),
        timeLimit: 120, baseScore: 120, penalty: 45,
        visualSteps: [
            { type: 'source', station: STATION.CHICKEN_BOX, item: 'raw_chicken' },
            { type: 'process', station: STATION.CUTTING_BOARD, item: 'raw_chicken_strips' },
            { type: 'process', station: STATION.COATING_STATION, item: 'coated_chicken_strips' },
            { type: 'process', station: STATION.DEEP_FRYER, item: 'cooked_chicken_tenders' },
            { type: 'process', station: STATION.DEEP_FRYER, item: 'cooked_fries' },
            { type: 'container', station: STATION.PLATE_STACK, item: 'plate' },
            { type: 'serve', station: STATION.SERVING_PASS, item: MEAL.CHICKEN_TENDERS_FRIES }
        ],
        instructions: {
            en: [
                "Get Raw Chicken (Source)",
                "Use Cutting Board -> Raw Chicken Strips",
                "Get Coating Mix (Source)",
                "Use Coating Station w/ Strips -> Coated Chicken Strips",
                "Use Fryer -> Cooked Chicken Tenders",
                "Get Potato (Bin)",
                "Use Cutting Board -> Raw Fries",
                "Use Fryer -> Cooked Fries",
                "Get Plate (Stack)",
                "Combine Plate + Cooked Chicken Tenders + Cooked Fries (Assembly)",
                "Serve (Counter)"
            ],
            fr: [
                "Prendre Poulet Cru (Source)",
                "Utiliser Planche -> Lanières Poulet Crues",
                "Prendre Panure (Source)",
                "Utiliser Station Panure avec Lanières -> Lanières Panées",
                "Utiliser Friteuse -> Lanières Cuites",
                "Prendre Patate (Bac)",
                "Utiliser Planche -> Frites Crues",
                "Utiliser Friteuse -> Frites Cuites",
                "Prendre Assiette (Pile)",
                "Combiner Assiette + Lanières Cuites + Frites Cuites (Assemblage)",
                "Servir (Comptoir)"
            ],
            es: [
                "Coger Pollo Crudo (Fuente)",
                "Usar Tabla -> Tiras Pollo Crudas",
                "Coger Mezcla Rebozar (Fuente)",
                "Usar Estación Rebozado con Tiras -> Tiras Rebozadas",
                "Usar Freidora -> Tiras Cocidas",
                "Coger Patata (Contenedor)",
                "Usar Tabla -> Patatas Crudas",
                "Usar Freidora -> Patatas Cocidas",
                "Coger Plato (Pila)",
                "Combinar Plato + Tiras Cocidas + Patatas Cocidas (Ensamblaje)",
                "Servir (Mostrador)"
            ]
        }
    },
    [MEAL.BLT_SANDWICH]: {
        ingredients: ['cooked_bacon', 'chopped_lettuce', 'chopped_tomato', 'toasted_bread'].sort(),
        timeLimit: 120, baseScore: 110, penalty: 55,
        visualSteps: [
            { type: 'source', station: STATION.BREAD_RACK, item: 'bread_slice' },
            { type: 'process', station: STATION.TOASTER, item: 'toasted_bread' },
            { type: 'source', station: STATION.BACON_PACK, item: 'raw_bacon' },
            { type: 'process', station: STATION.STOVE_TOP, item: 'cooked_bacon' },
            { type: 'process', station: STATION.CUTTING_BOARD, item: 'chopped_lettuce' },
            { type: 'process', station: STATION.CUTTING_BOARD, item: 'chopped_tomato' },
            { type: 'container', station: STATION.PLATE_STACK, item: 'plate' },
            { type: 'serve', station: STATION.SERVING_PASS, item: MEAL.BLT_SANDWICH }
        ],
        instructions: {
            en: [
                "Get Bread Slice (Source)",
                "Use Toaster -> Toasted Bread",
                "Get Raw Bacon (Source)",
                "Use Griddle -> Cooked Bacon",
                "Get Lettuce (Bin)",
                "Use Cutting Board -> Chopped Lettuce",
                "Get Tomato (Bin)",
                "Use Cutting Board -> Chopped Tomato",
                "Get Plate (Stack)",
                "Combine Plate + Toasted Bread + Cooked Bacon + Lettuce + Tomato (Assembly)",
                "Serve (Counter)"
            ],
            fr: [
                "Prendre Tranche Pain (Source)",
                "Utiliser Grille-pain -> Pain Grillé",
                "Prendre Bacon Cru (Source)",
                "Utiliser Plaque -> Bacon Cuit",
                "Prendre Laitue (Bac)",
                "Utiliser Planche -> Laitue Hachée",
                "Prendre Tomate (Bac)",
                "Utiliser Planche -> Tomate Hachée",
                "Prendre Assiette (Pile)",
                "Combiner Assiette + Pain Grillé + Bacon Cuit + Laitue + Tomate (Assemblage)",
                "Servir (Comptoir)"
            ],
            es: [
                "Coger Rebanada Pan (Fuente)",
                "Usar Tostadora -> Pan Tostado",
                "Coger Bacon Crudo (Fuente)",
                "Usar Plancha -> Bacon Cocido",
                "Coger Lechuga (Contenedor)",
                "Usar Tabla -> Lechuga Picada",
                "Coger Tomate (Contenedor)",
                "Usar Tabla -> Tomate Picado",
                "Coger Plato (Pila)",
                "Combinar Plato + Pan Tostado + Bacon Cocido + Lechuga + Tomate (Ensamblaje)",
                "Servir (Mostrador)"
            ]
        }
    },
    [MEAL.GRILLED_CHEESE_SANDWICH]: {
        ingredients: ['grilled_cheese_cooked'].sort(),
        timeLimit: 85, baseScore: 80, penalty: 40,
        visualSteps: [
            { type: 'source', station: STATION.BREAD_RACK, item: 'bread_slice' },
            { type: 'source', station: STATION.CHEESE_FRIDGE, item: 'cheese_slice' },
            { type: 'process', station: STATION.STOVE_TOP, item: 'grilled_cheese_cooked' },
            { type: 'container', station: STATION.PLATE_STACK, item: 'plate' },
            { type: 'serve', station: STATION.SERVING_PASS, item: MEAL.GRILLED_CHEESE_SANDWICH }
        ],
        instructions: {
            en: [
                "Get Bread Slice (Source)",
                "Get Cheese Slice (Fridge)",
                "Combine Bread + Cheese (Assembly) -> Grilled Cheese Raw",
                "Use Griddle -> Grilled Cheese Cooked",
                "Get Plate (Stack)",
                "Combine Plate + Grilled Cheese Cooked (Assembly)",
                "Serve (Counter)"
            ],
            fr: [
                "Prendre Tranche Pain (Source)",
                "Prendre Tranche Fromage (Frigo)",
                "Combiner Pain + Fromage (Assemblage) -> Sandwich Cru",
                "Utiliser Plaque -> Sandwich Grillé Cuit",
                "Prendre Assiette (Pile)",
                "Combiner Assiette + Sandwich Grillé Cuit (Assemblage)",
                "Servir (Comptoir)"
            ],
            es: [
                "Coger Rebanada Pan (Fuente)",
                "Coger Loncha Queso (Nevera)",
                "Combinar Pan + Queso (Ensamblaje) -> Sándwich Crudo",
                "Usar Plancha -> Sándwich Queso Cocido",
                "Coger Plato (Pila)",
                "Combinar Plato + Sándwich Queso Cocido (Ensamblaje)",
                "Servir (Mostrador)"
            ]
        }
    },
    [MEAL.PANCAKES]: {
        ingredients: ['cooked_pancakes', 'syrup'].sort(),
        timeLimit: 120, baseScore: 90, penalty: 45,
        visualSteps: [
            { type: 'source', station: STATION.PANCAKE_MIX, item: 'pancake_mix' },
            { type: 'process', station: STATION.STAND_MIXER, item: 'pancake_batter' },
            { type: 'process', station: STATION.STOVE_TOP, item: 'cooked_pancakes' },
            { type: 'source', station: STATION.SYRUP_BOTTLE, item: 'syrup' },
            { type: 'container', station: STATION.PLATE_STACK, item: 'plate' },
            { type: 'serve', station: STATION.SERVING_PASS, item: MEAL.PANCAKES }
        ],
        instructions: {
            en: [
                "Get Pancake Mix (Source)",
                "Use Mixer -> Pancake Batter",
                "Use Griddle -> Cooked Pancakes",
                "Get Syrup (Source)",
                "Get Plate (Stack)",
                "Combine Plate + Cooked Pancakes + Syrup (Assembly)",
                "Serve (Counter)"
            ],
            fr: [
                "Prendre Mix Pancake (Source)",
                "Utiliser Mixeur -> Pâte à Pancake",
                "Utiliser Plaque -> Pancakes Cuits",
                "Prendre Sirop (Source)",
                "Prendre Assiette (Pile)",
                "Combiner Assiette + Pancakes Cuits + Sirop (Assemblage)",
                "Servir (Comptoir)"
            ],
            es: [
                "Coger Mezcla Tortitas (Fuente)",
                "Usar Batidora -> Masa Tortitas",
                "Usar Plancha -> Tortitas Cocidas",
                "Coger Sirope (Fuente)",
                "Coger Plato (Pila)",
                "Combinar Plato + Tortitas Cocidas + Sirope (Ensamblaje)",
                "Servir (Mostrador)"
            ]
        }
    },
    [MEAL.CHEESE_OMELETTE]: {
        ingredients: ['cheese_slice', 'cooked_omelette'].sort(),
        timeLimit: 90, baseScore: 80, penalty: 40,
        visualSteps: [
            { type: 'source', station: STATION.EGG_CARTON, item: 'egg' },
            { type: 'process', station: STATION.STAND_MIXER, item: 'omelette_mix' },
            { type: 'process', station: STATION.STOVE_TOP, item: 'cooked_omelette' },
            { type: 'source', station: STATION.CHEESE_FRIDGE, item: 'cheese_slice' },
            { type: 'container', station: STATION.PLATE_STACK, item: 'plate' },
            { type: 'serve', station: STATION.SERVING_PASS, item: MEAL.CHEESE_OMELETTE }
        ],
        instructions: {
            en: [
                "Get Egg (Source)",
                "Get Cheese Slice (Fridge)",
                "Use Mixer -> Omelette Mix",
                "Use Griddle -> Cooked Omelette",
                "Get Plate (Stack)",
                "Combine Plate + Cooked Omelette + Cheese Slice (Assembly)",
                "Serve (Counter)"
            ],
            fr: [
                "Prendre Oeuf (Source)",
                "Prendre Tranche Fromage (Frigo)",
                "Utiliser Mixeur -> Mélange Omelette",
                "Utiliser Plaque -> Omelette Cuite",
                "Prendre Assiette (Pile)",
                "Combiner Assiette + Omelette Cuite + Fromage (Assemblage)",
                "Servir (Comptoir)"
            ],
            es: [
                "Coger Huevo (Fuente)",
                "Coger Loncha Queso (Nevera)",
                "Usar Batidora -> Mezcla Tortilla",
                "Usar Plancha -> Tortilla Cocida",
                "Coger Plato (Pila)",
                "Combinar Plato + Tortilla Cocida + Queso (Ensamblaje)",
                "Servir (Mostrador)"
            ]
        }
    },
    [MEAL.FRUIT_YOGURT_BOWL]: {
        ingredients: ['granola', 'sliced_banana', 'sliced_strawberry', 'yogurt'].sort(),
        timeLimit: 70, baseScore: 70, penalty: 30,
        visualSteps: [
            { type: 'process', station: STATION.CUTTING_BOARD, item: 'sliced_banana' },
            { type: 'process', station: STATION.CUTTING_BOARD, item: 'sliced_strawberry' },
            { type: 'source', station: STATION.YOGURT_POT, item: 'yogurt' },
            { type: 'source', station: STATION.GRANOLA_JAR, item: 'granola' },
            { type: 'container', station: STATION.BOWL_STACK, item: 'bowl' },
            { type: 'serve', station: STATION.SERVING_PASS, item: MEAL.FRUIT_YOGURT_BOWL }
        ],
        instructions: {
            en: [
                "Get Banana (Bin)",
                "Use Cutting Board -> Sliced Banana",
                "Get Strawberry (Bin)",
                "Use Cutting Board -> Sliced Strawberry",
                "Get Yogurt (Source)",
                "Get Granola (Source)",
                "Get Bowl (Source)",
                "Combine Bowl + Yogurt + Banana + Strawberry + Granola (Assembly)",
                "Serve (Counter)"
            ],
            fr: [
                "Prendre Banane (Bac)",
                "Utiliser Planche -> Banane Tranchée",
                "Prendre Fraise (Bac)",
                "Utiliser Planche -> Fraise Tranchée",
                "Prendre Yaourt (Source)",
                "Prendre Granola (Source)",
                "Prendre Bol (Source)",
                "Combiner Bol + Yaourt + Banane + Fraise + Granola (Assemblage)",
                "Servir (Comptoir)"
            ],
            es: [
                "Coger Plátano (Contenedor)",
                "Usar Tabla -> Plátano Rebanado",
                "Coger Fresa (Contenedor)",
                "Usar Tabla -> Fresa Rebanada",
                "Coger Yogur (Fuente)",
                "Coger Granola (Fuente)",
                "Coger Bol (Fuente)",
                "Combinar Bol + Yogur + Plátano + Fresa + Granola (Ensamblaje)",
                "Servir (Mostrador)"
            ]
        }
    },
    [MEAL.SMOOTHIE]: {
        ingredients: ['smoothie_ready'].sort(),
        timeLimit: 60, baseScore: 65, penalty: 25,
        visualSteps: [
            { type: 'process', station: STATION.CUTTING_BOARD, item: 'sliced_banana' },
            { type: 'process', station: STATION.CUTTING_BOARD, item: 'sliced_strawberry' },
            { type: 'process', station: STATION.BLENDER, item: 'smoothie_ready' },
            { type: 'container', station: STATION.CUP_STACK, item: 'cup' },
            { type: 'serve', station: STATION.SERVING_PASS, item: MEAL.SMOOTHIE }
        ],
        instructions: {
            en: [
                "Get Banana (Bin)",
                "Use Cutting Board -> Sliced Banana",
                "Use Blender w/ Sliced Banana",
                "Get Strawberry (Bin)",
                "Use Cutting Board -> Sliced Strawberry",
                "Use Blender w/ Sliced Strawberry",
                "Get Milk/Yogurt (Source)",
                "Use Blender w/ Milk/Yogurt",
                "Get Cup (Source)",
                "Use Blender w/ Cup -> Smoothie Ready",
                "Serve (Counter)"
            ],
            fr: [
                "Prendre Banane (Bac)",
                "Utiliser Planche -> Banane Tranchée",
                "Utiliser Blender avec Banane",
                "Prendre Fraise (Bac)",
                "Utiliser Planche -> Fraise Tranchée",
                "Utiliser Blender avec Fraise",
                "Prendre Lait/Yaourt (Source)",
                "Utiliser Blender avec Lait/Yaourt",
                "Prendre Gobelet (Source)",
                "Utiliser Blender avec Gobelet -> Smoothie Prêt",
                "Servir (Comptoir)"
            ],
            es: [
                "Coger Plátano (Contenedor)",
                "Usar Tabla -> Plátano Rebanado",
                "Usar Licuadora con Plátano",
                "Coger Fresa (Contenedor)",
                "Usar Tabla -> Fresa Rebanada",
                "Usar Licuadora con Fresa",
                "Coger Leche/Yogur (Fuente)",
                "Usar Licuadora con Leche/Yogur",
                "Coger Vaso (Fuente)",
                "Usar Licuadora con Vaso -> Batido Listo",
                "Servir (Mostrador)"
            ]
        }
    },
    [MEAL.PIZZA_MARGHERITA]: {
        ingredients: ['cooked_pizza_margherita'].sort(),
        timeLimit: 150, baseScore: 150, penalty: 70,
        visualSteps: [
            { type: 'source', station: STATION.PIZZA_DOUGH, item: 'pizza_dough' },
            { type: 'process', station: STATION.DOUGH_PRESS, item: 'pizza_base' },
            { type: 'source', station: STATION.TOMATO_SAUCE, item: 'tomato_sauce' },
            { type: 'source', station: STATION.MOZZARELLA_BIN, item: 'shredded_mozzarella' },
            { type: 'process', station: STATION.PIZZA_OVEN, item: 'cooked_pizza_margherita' },
            { type: 'container', station: STATION.PLATE_STACK, item: 'plate' },
            { type: 'serve', station: STATION.SERVING_PASS, item: MEAL.PIZZA_MARGHERITA }
        ],
        instructions: {
            en: [
                "Get Pizza Dough (Source)",
                "Use Dough Press -> Pizza Base",
                "Get Tomato Sauce (Source)",
                "Get Shredded Mozzarella (Source)",
                "Combine Base + Sauce + Cheese (Assembly Pizza) -> Pizza Margherita Raw",
                "Use Oven -> Cooked Pizza Margherita",
                "Get Plate (Stack)",
                "Combine Plate + Cooked Pizza (Assembly)",
                "Serve (Counter)"
            ],
            fr: [
                "Prendre Pâte à Pizza (Source)",
                "Utiliser Presse -> Base Pizza",
                "Prendre Sauce Tomate (Source)",
                "Prendre Mozzarella Râpée (Source)",
                "Combiner Base + Sauce + Fromage (Assemblage Pizza) -> Pizza Margherita Crue",
                "Utiliser Four -> Pizza Margherita Cuite",
                "Prendre Assiette (Pile)",
                "Combiner Assiette + Pizza Cuite (Assemblage)",
                "Servir (Comptoir)"
            ],
            es: [
                "Coger Masa Pizza (Fuente)",
                "Usar Prensa Masa -> Base Pizza",
                "Coger Salsa Tomate (Fuente)",
                "Coger Mozzarella Rallada (Fuente)",
                "Combinar Base + Salsa + Queso (Ensamblaje Pizza) -> Pizza Margherita Cruda",
                "Usar Horno -> Pizza Margherita Cocida",
                "Coger Plato (Pila)",
                "Combinar Plato + Pizza Cocida (Ensamblaje)",
                "Servir (Mostrador)"
            ]
        }
    }
};

// Calculate dynamic complexity weight based on station visual steps
export function calculateRecipeWeight(mealName) {
    const recipe = RECIPES[mealName];
    if (!recipe) return 5;
    if (typeof recipe.weight === 'number') return recipe.weight;

    const visualSteps = recipe.visualSteps || [];
    if (visualSteps.length === 0) return 5;

    let totalWeight = 0;
    visualSteps.forEach(step => {
        if (step.type === 'process') totalWeight += 2.0;      // Station action
        else if (step.type === 'source') totalWeight += 1.0;  // Fetching raw ingredient
        else totalWeight += 1.0;                              // Plating / container / serve
    });

    return Math.max(3, totalWeight);
}

// Helper function to get recipe ingredients by name
export function getRecipeIngredients(mealName) {
    return RECIPES[mealName]?.ingredients;
}

// Helper function to get recipe details (time, score, penalty, instructions)
export function getRecipeDetails(mealName, orderTimeMultiplier = 1.0) {
    const recipe = RECIPES[mealName];
    if (!recipe) return null;

    const weight = calculateRecipeWeight(mealName);
    const multiplier = typeof orderTimeMultiplier === 'number' && !isNaN(orderTimeMultiplier) ? orderTimeMultiplier : 1.0;

    // Standard timing: 10 seconds per weight unit at 1.0x multiplier
    const calculatedTimeLimit = Math.max(30, Math.round(weight * 10 * multiplier));
    
    // Base score: 12 points per weight unit
    const calculatedBaseScore = Math.max(30, Math.round(weight * 12));
    
    // Penalty on order failure (timeout): 50% of dish base score
    const calculatedPenalty = Math.round(calculatedBaseScore * 0.5);

    return {
        weight: weight,
        timeLimit: calculatedTimeLimit,
        baseScore: calculatedBaseScore,
        penalty: calculatedPenalty,
        instructions: recipe.instructions,
        visualSteps: recipe.visualSteps || []
    };
}