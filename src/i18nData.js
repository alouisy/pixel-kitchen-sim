// src/i18nData.js

export const DATA_TRANSLATIONS = {
    en: {
        // Ingredients & Items
        "potato": "Potato",
        "raw_fries": "Raw Fries",
        "cooked_fries": "Cooked Fries",
        "plate": "Plate",
        "French Fries": "French Fries",
        "Salad": "Salad",
        "Hamburger": "Hamburger",
        "Cheeseburger": "Cheeseburger",
        "bun": "Bun",
        "patty": "Patty",
        "cooked_patty": "Cooked Patty",
        "cheese_slice": "Cheese",
        "lettuce": "Lettuce",
        "chopped_lettuce": "Chopped Lettuce",
        "tomato": "Tomato",
        "chopped_tomato": "Chopped Tomato",
        
        // Stations
        "PotatoBin": "Potato Bin",
        "CuttingBoard": "Cutting Board",
        "Fryer": "Fryer",
        "PlateStack": "Plates",
        "AssemblyTable": "Assembly",
        "SERVE": "SERVE",
        "Trash": "Trash",
        
        // UI Messages
        "Placed": "Placed",
        "Slot Occupied": "Slot Occupied",
        "Order Served!": "Order Served!",
        "Wrong / No Order!": "Wrong Order!",
        "Not a Meal!": "Not a Meal!",
        "Ingredient Added": "Ingredient Added",
        "Already Added!": "Already Added!",
        "Hands Full!": "Hands Full!",
        "Station Busy": "Station Busy",
        "Cannot Process": "Cannot Process",
        "Station Empty": "Station Empty",
        "Slot Empty": "Slot Empty",
        "Nothing to Use": "Nothing to Use",
        "Pick up Container": "Pick up Container",
        "Cannot Add This!": "Cannot Add This!",
        "Mixed!": "Mixed!",
        "Blender Not Ready!": "Blender Not Ready!",
        "Smoothie Ready!": "Smoothie Ready!"
    },
    fr: {
        "potato": "Patate",
        "raw_fries": "Frites Crues",
        "cooked_fries": "Frites Cuites",
        "plate": "Assiette",
        "French Fries": "Frites",
        "Salad": "Salade",
        "Hamburger": "Hamburger",
        "Cheeseburger": "Cheeseburger",
        "bun": "Pain",
        "patty": "Steak",
        "cooked_patty": "Steak Cuit",
        "cheese_slice": "Fromage",
        "lettuce": "Laitue",
        "chopped_lettuce": "Laitue Hachée",
        "tomato": "Tomate",
        "chopped_tomato": "Tomate Hachée",

        "PotatoBin": "Bac Patates",
        "CuttingBoard": "Planche",
        "Fryer": "Friteuse",
        "PlateStack": "Assiettes",
        "AssemblyTable": "Assemblage",
        "SERVE": "SERVIR",
        "Trash": "Poubelle",

        "Placed": "Placé",
        "Slot Occupied": "Occupé",
        "Order Served!": "Servi !",
        "Wrong / No Order!": "Erreur Commande !",
        "Not a Meal!": "Pas un Plat !",
        "Ingredient Added": "Ingrédient Ajouté",
        "Already Added!": "Déjà Ajouté !",
        "Hands Full!": "Mains Pleines !",
        "Station Busy": "Station Occupée",
        "Cannot Process": "Impossible",
        "Station Empty": "Station Vide",
        "Slot Empty": "Vide",
        "Nothing to Use": "Rien à utiliser",
        "Pick up Container": "Prendre le Contenant",
        "Cannot Add This!": "Impossible d'ajouter",
        "Mixed!": "Mélangé !",
        "Blender Not Ready!": "Blender Pas Prêt !",
        "Smoothie Ready!": "Smoothie Prêt !"
    },
    es: {
        "potato": "Patata",
        "raw_fries": "Patatas Crudas",
        "cooked_fries": "Patatas Fritas",
        "plate": "Plato",
        "French Fries": "Patatas Fritas",
        "Salad": "Ensalada",
        "Hamburger": "Hamburguesa",
        "Cheeseburger": "Hamburguesa con Queso",
        "bun": "Pan",
        "patty": "Carne",
        "cooked_patty": "Carne Cocida",
        "cheese_slice": "Queso",
        "lettuce": "Lechuga",
        "chopped_lettuce": "Lechuga Picada",
        "tomato": "Tomate",
        "chopped_tomato": "Tomate Picado",

        "PotatoBin": "Patatas",
        "CuttingBoard": "Tabla",
        "Fryer": "Freidora",
        "PlateStack": "Platos",
        "AssemblyTable": "Montaje",
        "SERVE": "SERVIR",
        "Trash": "Basura",

        "Placed": "Colocado",
        "Slot Occupied": "Ocupado",
        "Order Served!": "¡Servido!",
        "Wrong / No Order!": "¡Error Pedido!",
        "Not a Meal!": "¡No es Comida!",
        "Ingredient Added": "Ingrediente Añadido",
        "Already Added!": "¡Ya Añadido!",
        "Hands Full!": "¡Manos Llenas!",
        "Station Busy": "Ocupado",
        "Cannot Process": "Imposible",
        "Station Empty": "Vacío",
        "Slot Empty": "Vacío",
        "Nothing to Use": "Nada que usar",
        "Pick up Container": "Coger Recipiente",
        "Cannot Add This!": "¡No se puede añadir!",
        "Mixed!": "¡Mezclado!",
        "Blender Not Ready!": "¡Licuadora no lista!",
        "Smoothie Ready!": "¡Batido listo!"
    }
};

export function getTrans(key, lang = 'en') {
    // 1. Try direct key match
    if (DATA_TRANSLATIONS[lang] && DATA_TRANSLATIONS[lang][key]) {
        return DATA_TRANSLATIONS[lang][key];
    }
    // 2. Fallback to English
    if (DATA_TRANSLATIONS['en'][key]) {
        return DATA_TRANSLATIONS['en'][key];
    }
    // 3. Return key as is (debug)
    return key;
}