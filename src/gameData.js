// src/gameData.js
import { INGREDIENT_STATES, STATION_TYPES, COUNTER_HEIGHT } from './constants.js'; // Keep imports if needed

// --- RECIPES ---
// Includes default timeLimit, baseScore, penalty, and NEW instructions per recipe
// Ingredient names MUST match the 'finalName' generated in items.js
export const RECIPES = {
    // --- Existing ---
    'French Fries': {
        ingredients: ['cooked_fries'].sort(),
        timeLimit: 75, baseScore: 60, penalty: 30,
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
    'Salad': {
        ingredients: ['chopped_lettuce', 'chopped_tomato'].sort(),
        timeLimit: 90, baseScore: 75, penalty: 40,
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
    'Hamburger': {
        ingredients: ['bun', 'cooked_patty'].sort(),
        timeLimit: 100, baseScore: 100, penalty: 50,
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
    'Cheeseburger': {
        ingredients: ['bun', 'cheese_slice', 'cooked_patty'].sort(),
        timeLimit: 110, baseScore: 120, penalty: 60,
        instructions: {
            en: [
                "Get Patty (Bin)",
                "Use Grill -> Cooked Patty",
                "Get Bun (Rack)",
                "Get Cheese Slice (Fridge)",
                "Get Plate (Stack)",
                "Combine Plate + Bun + Cooked Patty + Cheese Slice (Assembly)",
                "Serve (Counter)"
            ],
            fr: [
                "Prendre Steak Haché (Bac)",
                "Utiliser Grill -> Steak Cuit",
                "Prendre Pain (Étagère)",
                "Prendre Tranche Fromage (Frigo)",
                "Prendre Assiette (Pile)",
                "Combiner Assiette + Pain + Steak Cuit + Fromage (Assemblage)",
                "Servir (Comptoir)"
            ],
            es: [
                "Coger Hamburguesa (Contenedor)",
                "Usar Parrilla -> Hamburguesa Cocida",
                "Coger Pan (Estante)",
                "Coger Loncha Queso (Nevera)",
                "Coger Plato (Pila)",
                "Combinar Plato + Pan + Hamburguesa Cocida + Queso (Ensamblaje)",
                "Servir (Mostrador)"
            ]
        }
    },
    // --- New Recipes ---
    'Onion Rings': {
        ingredients: ['cooked_onion_rings'].sort(),
        timeLimit: 80, baseScore: 70, penalty: 35,
        instructions: { // Assuming Onion -> Cut -> Coat -> Fry
            en: [
                "Get Onion (Bin)",
                "Use Cutting Board -> Raw Onion Rings",
                "Get Coating Mix (Source)",
                "Use Coating Station w/ Rings -> Coated Onion Rings", // Needs station
                "Use Fryer -> Cooked Onion Rings",
                "Get Plate (Stack)",
                "Combine Plate + Cooked Onion Rings (Assembly)",
                "Serve (Counter)"
            ],
            fr: [
                "Prendre Oignon (Bac)",
                "Utiliser Planche -> Rondelles Oignon Crues",
                "Prendre Panure (Source)",
                "Utiliser Station Panure avec Rondelles -> Rondelles Panées", // Needs station
                "Utiliser Friteuse -> Rondelles Cuites",
                "Prendre Assiette (Pile)",
                "Combiner Assiette + Rondelles Cuites (Assemblage)",
                "Servir (Comptoir)"
            ],
            es: [
                "Coger Cebolla (Contenedor)",
                "Usar Tabla -> Aros Cebolla Crudos",
                "Coger Mezcla Rebozar (Fuente)",
                "Usar Estación Rebozado con Aros -> Aros Rebozados", // Needs station
                "Usar Freidora -> Aros Cocidos",
                "Coger Plato (Pila)",
                "Combinar Plato + Aros Cocidos (Ensamblaje)",
                "Servir (Mostrador)"
            ]
        }
    },
    'Chicken Tenders': {
        ingredients: ['cooked_chicken_tenders'].sort(),
        timeLimit: 95, baseScore: 90, penalty: 45,
        instructions: { // Assuming Chicken -> Cut -> Coat -> Fry
            en: [
                "Get Raw Chicken (Source)",
                "Use Cutting Board -> Raw Chicken Strips",
                "Get Coating Mix (Source)",
                "Use Coating Station w/ Strips -> Coated Chicken Strips", // Needs station
                "Use Fryer -> Cooked Chicken Tenders",
                "Get Plate (Stack)",
                "Combine Plate + Cooked Chicken Tenders (Assembly)",
                "Serve (Counter)"
            ],
            fr: [
                "Prendre Poulet Cru (Source)",
                "Utiliser Planche -> Lanières Poulet Crues",
                "Prendre Panure (Source)",
                "Utiliser Station Panure avec Lanières -> Lanières Panées", // Needs station
                "Utiliser Friteuse -> Lanières Cuites",
                "Prendre Assiette (Pile)",
                "Combiner Assiette + Lanières Cuites (Assemblage)",
                "Servir (Comptoir)"
            ],
            es: [
                "Coger Pollo Crudo (Fuente)",
                "Usar Tabla -> Tiras Pollo Crudas",
                "Coger Mezcla Rebozar (Fuente)",
                "Usar Estación Rebozado con Tiras -> Tiras Rebozadas", // Needs station
                "Usar Freidora -> Tiras Cocidas",
                "Coger Plato (Pila)",
                "Combinar Plato + Tiras Cocidas (Ensamblaje)",
                "Servir (Mostrador)"
            ]
        }
    },
    'BLT Sandwich': {
        ingredients: ['cooked_bacon', 'chopped_lettuce', 'chopped_tomato', 'toasted_bread'].sort(),
        timeLimit: 120, baseScore: 110, penalty: 55,
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
    'Grilled Cheese Sandwich': {
        ingredients: ['grilled_cheese_cooked'].sort(),
        timeLimit: 85, baseScore: 80, penalty: 40,
        instructions: { // Assuming Bread + Cheese -> Assemble -> Griddle
            en: [
                "Get Bread Slice (Source)",
                "Get Cheese Slice (Fridge)",
                "Combine Bread + Cheese (Assembly) -> Grilled Cheese Raw", // Implicit assembly step
                "Use Griddle -> Grilled Cheese Cooked",
                "Get Plate (Stack)",
                "Combine Plate + Grilled Cheese Cooked (Assembly)",
                "Serve (Counter)"
            ],
            fr: [
                "Prendre Tranche Pain (Source)",
                "Prendre Tranche Fromage (Frigo)",
                "Combiner Pain + Fromage (Assemblage) -> Sandwich Cru", // Implicit assembly step
                "Utiliser Plaque -> Sandwich Grillé Cuit",
                "Prendre Assiette (Pile)",
                "Combiner Assiette + Sandwich Grillé Cuit (Assemblage)",
                "Servir (Comptoir)"
            ],
            es: [
                "Coger Rebanada Pan (Fuente)",
                "Coger Loncha Queso (Nevera)",
                "Combinar Pan + Queso (Ensamblaje) -> Sándwich Crudo", // Implicit assembly step
                "Usar Plancha -> Sándwich Queso Cocido",
                "Coger Plato (Pila)",
                "Combinar Plato + Sándwich Queso Cocido (Ensamblaje)",
                "Servir (Mostrador)"
            ]
        }
    },
    'Pancakes': {
        ingredients: ['cooked_pancakes', 'syrup'].sort(),
        timeLimit: 120, baseScore: 90, penalty: 45,
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
    'Omelette': {
        ingredients: ['cooked_omelette'].sort(),
        timeLimit: 90, baseScore: 80, penalty: 40,
        instructions: {
            en: [
                "Get Egg (Source)",
                "Use Mixer -> Omelette Mix",
                "Use Griddle -> Cooked Omelette",
                "Get Plate (Stack)",
                "Combine Plate + Cooked Omelette (Assembly)",
                "Serve (Counter)"
            ],
            fr: [
                "Prendre Oeuf (Source)",
                "Utiliser Mixeur -> Mélange Omelette",
                "Utiliser Plaque -> Omelette Cuite",
                "Prendre Assiette (Pile)",
                "Combiner Assiette + Omelette Cuite (Assemblage)",
                "Servir (Comptoir)"
            ],
            es: [
                "Coger Huevo (Fuente)",
                "Usar Batidora -> Mezcla Tortilla",
                "Usar Plancha -> Tortilla Cocida",
                "Coger Plato (Pila)",
                "Combinar Plato + Tortilla Cocida (Ensamblaje)",
                "Servir (Mostrador)"
            ]
        }
    },
    'Fruit & Yogurt Bowl': {
        ingredients: ['granola', 'sliced_banana', 'sliced_strawberry', 'yogurt'].sort(),
        timeLimit: 70, baseScore: 70, penalty: 30,
        instructions: {
            en: [
                "Get Banana (Bin)",
                "Use Cutting Board -> Sliced Banana",
                "Get Strawberry (Bin)",
                "Use Cutting Board -> Sliced Strawberry",
                "Get Yogurt (Source)",
                "Get Granola (Source)",
                "Get Bowl (Source)", // Needs Bowl source
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
                "Prendre Bol (Source)", // Needs Bowl source
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
                "Coger Bol (Fuente)", // Needs Bowl source
                "Combinar Bol + Yogur + Plátano + Fresa + Granola (Ensamblaje)",
                "Servir (Mostrador)"
            ]
        }
    },
    'Smoothie': {
        ingredients: ['smoothie_ready'].sort(),
        timeLimit: 60, baseScore: 65, penalty: 25,
        instructions: { // Using new Blender logic
            en: [
                "Get Banana (Bin)",
                "Use Cutting Board -> Sliced Banana",
                "Use Blender w/ Sliced Banana",
                "Get Strawberry (Bin)",
                "Use Cutting Board -> Sliced Strawberry",
                "Use Blender w/ Sliced Strawberry",
                "Get Milk/Yogurt (Source)", // Depends on level
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
                "Prendre Lait/Yaourt (Source)", // Depends on level
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
                "Coger Leche/Yogur (Fuente)", // Depends on level
                "Usar Licuadora con Leche/Yogur",
                "Coger Vaso (Fuente)",
                "Usar Licuadora con Vaso -> Batido Listo",
                "Servir (Mostrador)"
            ]
        }
    },
    'Pizza Margherita': {
        ingredients: ['cooked_pizza_margherita'].sort(),
        timeLimit: 150, baseScore: 150, penalty: 70,
        instructions: { // Dough -> Press -> Sauce -> Cheese -> Assemble -> Oven
            en: [
                "Get Pizza Dough (Source)",
                "Use Dough Press -> Pizza Base",
                "Get Tomato Sauce (Source)",
                "Get Shredded Mozzarella (Source)",
                "Combine Base + Sauce + Cheese (Assembly Pizza) -> Pizza Margherita Raw",
                "Use Oven -> Cooked Pizza Margherita",
                "Get Plate (Stack)", // Or maybe serve directly? Let's use plate for now.
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
    },
};


// Helper function to get recipe *ingredients* by name
export function getRecipeIngredients(mealName) {
    return RECIPES[mealName]?.ingredients;
}
// Helper function to get recipe *details* (time, score, penalty, instructions)
export function getRecipeDetails(mealName) {
    const recipe = RECIPES[mealName];
    if (!recipe) return null;
    return {
        timeLimit: recipe.timeLimit,
        baseScore: recipe.baseScore,
        penalty: recipe.penalty,
        instructions: recipe.instructions // Include instructions
    };
}