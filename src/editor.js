// src/editor.js
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GRID_UNIT, GAMEPAD_DEADZONE, CATALOG_ITEMS, STATION_TYPES, MODULE_HEIGHT, ITEM_TYPES } from './constants.js';
import { createCounterPrefab, createStationPrefab, createTablePrefab, getFloorMesh, resizeWall, refreshSmartObjects } from './world.js';
import { RECIPES } from './gameData.js';
import { getTrans } from './i18nData.js';

// Editor translations dictionary
const EDITOR_TRANSLATIONS = {
    en: {
        title: "🏗️ LEVEL EDITOR: ",
        controls_hint: "<span><b>Left Click:</b> Place</span> | <span><b>Right Drag:</b> Pan</span> | <span><b>T:</b> Save JSON</span>",
        btn_settings: "⚙️ Level Settings",
        btn_save_local: "💾 Save Local",
        btn_save_json: "💾 Save JSON",
        btn_exit: "Exit",
        map_status: "📋 MAP STATUS",
        playable: "✓ Playable",
        issues_detected: "⚠️ Issues Detected",
        setup_incomplete: "⚠️ Setup Incomplete",
        playable_msg: "Level is playable! All required stations, ingredients, and utensils are present on the map.",
        no_recipes_msg: "No recipes selected. Click level settings to add them.",
        missing_objects: "Missing Required Objects:",
        required_by: "Required by: ",
        warning_export: "⚠️ Warning: This level is missing required objects for the selected recipes. It may not be playable.\n\nAre you sure you want to export?",

        settings_title: "⚙️ Level Settings",
        lbl_level_name: "Level Name:",
        lbl_duration: "Duration (s):",
        lbl_order_delay: "Order Delay (s):",
        lbl_max_orders: "Max Active Orders:",
        sec_stars: "⭐ Star Score Thresholds",
        lbl_star1: "1 Star:",
        lbl_star2: "2 Stars:",
        lbl_star3: "3 Stars:",
        sec_recipes: "🍳 Available Recipes",
        btn_close: "Close",

        tab_all: "All",
        tab_arch: "Walls/Floors",
        tab_furniture: "Furniture",
        tab_stations: "Stations",
        tab_sources: "Sources",
        tab_utensils: "Utensils",
        tab_ingredients: "Ingredients",
        tab_dishes: "Dishes",
        tab_decorations: "Decorations",

        inspector_title: "Selected Object",
        btn_rotate: "🔄 Rotate",
        btn_clone: "📋 Duplicate",
        btn_delete: "🗑️ Delete",
        lbl_config: "Config (JSON):",
        btn_save_config: "💾 Save Config",
        inspector_none: "None"
    },
    fr: {
        title: "🏗️ ÉDITEUR DE NIVEAU : ",
        controls_hint: "<span><b>Clic Gauche :</b> Placer</span> | <span><b>Clic Droit Glisser :</b> Déplacer</span> | <span><b>T :</b> Enregistrer le JSON</span>",
        btn_settings: "⚙️ Paramètres",
        btn_save_local: "💾 Sauvegarder localement",
        btn_save_json: "💾 Enregistrer",
        btn_exit: "Quitter",
        map_status: "📋 STATUS DE LA MAP",
        playable: "✓ Jouable",
        issues_detected: "⚠️ Problèmes détectés",
        setup_incomplete: "⚠️ Config incomplète",
        playable_msg: "Le niveau est jouable ! Toutes les stations, ingrédients et ustensiles requis sont présents sur le niveau.",
        no_recipes_msg: "Aucune recette sélectionnée. Cliquez sur Paramètres pour en ajouter.",
        missing_objects: "Objets requis manquants :",
        required_by: "Requis par : ",
        warning_export: "⚠️ Attention : Ce niveau ne contient pas tous les objets requis pour les recettes sélectionnées. Il risque de ne pas être jouable.\n\nVoulez-vous vraiment l'exporter ?",

        settings_title: "⚙️ Paramètres du niveau",
        lbl_level_name: "Nom du niveau :",
        lbl_duration: "Durée (s) :",
        lbl_order_delay: "Délai des commandes (s) :",
        lbl_max_orders: "Commandes actives max :",
        sec_stars: "⭐ Seuils des étoiles",
        lbl_star1: "1 Étoile :",
        lbl_star2: "2 Étoiles :",
        lbl_star3: "3 Étoiles :",
        sec_recipes: "🍳 Recettes disponibles",
        btn_close: "Fermer",

        tab_all: "Tout",
        tab_arch: "Murs/Sols",
        tab_furniture: "Meubles",
        tab_stations: "Stations",
        tab_sources: "Bacs ingrédients",
        tab_utensils: "Ustensiles",
        tab_ingredients: "Ingrédients (Unité)",
        tab_dishes: "Plats",
        tab_decorations: "Décorations",

        inspector_title: "Objet sélectionné",
        btn_rotate: "🔄 Pivoter",
        btn_clone: "📋 Dupliquer",
        btn_delete: "🗑️ Supprimer",
        lbl_config: "Configuration (JSON) :",
        btn_save_config: "💾 Enregistrer",
        inspector_none: "Aucun"
    }
};

// Mappings for validation check descriptions
const FRIENDLY_NAMES = {
    // Ingredients
    'potato': 'Potato Bin (or preplaced Potato)',
    'lettuce': 'Lettuce Bin (or preplaced Lettuce)',
    'tomato': 'Tomato Bin (or preplaced Tomato)',
    'bun': 'Bun Rack (or preplaced Burger Bun)',
    'patty': 'Patty Box (or preplaced Patty)',
    'cheese_slice': 'Cheese Fridge (or preplaced Cheese Slice)',
    'onion': 'Onion Bin (or preplaced Onion)',
    'coating_mix': 'Coating Mix (or preplaced Coating Mix)',
    'raw_chicken': 'Chicken Box (or preplaced Raw Chicken)',
    'raw_bacon': 'Bacon Pack (or preplaced Raw Bacon)',
    'bread_slice': 'Bread Rack (or preplaced Bread Slice)',
    'pancake_mix': 'Pancake Mix (or preplaced Pancake Mix)',
    'egg': 'Egg Carton (or preplaced Egg)',
    'banana': 'Banana Crate (or preplaced Banana)',
    'strawberry': 'Strawberry Box (or preplaced Strawberry)',
    'yogurt': 'Yogurt Pot (or preplaced Yogurt)',
    'granola': 'Granola Jar (or preplaced Granola)',
    'milk': 'Milk Carton (or preplaced Milk)',
    'pizza_dough': 'Pizza Dough (or preplaced Pizza Dough)',
    'tomato_sauce': 'Tomato Sauce (or preplaced Tomato Sauce)',
    'shredded_mozzarella': 'Mozzarella Bin (or preplaced Mozzarella)',

    // Containers
    'plate': 'Plate Stack (or preplaced Plate)',
    'bowl': 'Bowl Stack (or preplaced Bowl)',
    'cup': 'Cup Stack (or preplaced Cup)',

    // General
    'serving': 'Serving Pass'
};

// Requirements tree for each recipe
const RECIPE_REQUIREMENTS = {
    'French Fries': {
        ingredients: ['potato'],
        processors: [
            {
                name: 'Cutting Board',
                check: (objects) => objects.some(obj =>
                    obj.type === 'processor' &&
                    (obj.config?.processes?.includes('potato') || obj.name?.toLowerCase().includes('cutting'))
                )
            },
            {
                name: 'Deep Fryer',
                check: (objects) => objects.some(obj =>
                    obj.type === 'processor' &&
                    (obj.config?.processes?.includes('raw_fries') || obj.name?.toLowerCase().includes('fryer'))
                )
            }
        ],
        containers: ['plate']
    },
    'Salad': {
        ingredients: ['lettuce', 'tomato'],
        processors: [
            {
                name: 'Cutting Board',
                check: (objects) => objects.some(obj =>
                    obj.type === 'processor' &&
                    (obj.config?.processes?.includes('lettuce') || obj.config?.processes?.includes('tomato') || obj.name?.toLowerCase().includes('cutting'))
                )
            }
        ],
        containers: ['plate']
    },
    'Hamburger': {
        ingredients: ['bun', 'patty'],
        processors: [
            {
                name: 'Stove Top',
                check: (objects) => objects.some(obj =>
                    obj.type === 'processor' &&
                    (obj.config?.processes?.includes('patty') || obj.name?.toLowerCase().includes('stove') || obj.name?.toLowerCase().includes('grill') || obj.name?.toLowerCase().includes('griddle'))
                )
            }
        ],
        containers: ['plate']
    },
    'Cheeseburger Combo': {
        ingredients: ['bun', 'patty', 'cheese_slice', 'potato'],
        processors: [
            {
                name: 'Stove Top',
                check: (objects) => objects.some(obj =>
                    obj.type === 'processor' &&
                    (obj.config?.processes?.includes('patty') || obj.name?.toLowerCase().includes('stove') || obj.name?.toLowerCase().includes('grill') || obj.name?.toLowerCase().includes('griddle'))
                )
            },
            {
                name: 'Cutting Board',
                check: (objects) => objects.some(obj =>
                    obj.type === 'processor' &&
                    (obj.config?.processes?.includes('potato') || obj.name?.toLowerCase().includes('cutting'))
                )
            },
            {
                name: 'Deep Fryer',
                check: (objects) => objects.some(obj =>
                    obj.type === 'processor' &&
                    (obj.config?.processes?.includes('raw_fries') || obj.name?.toLowerCase().includes('fryer'))
                )
            }
        ],
        containers: ['plate']
    },
    'Onion Rings': {
        ingredients: ['onion', 'coating_mix'],
        processors: [
            {
                name: 'Cutting Board',
                check: (objects) => objects.some(obj =>
                    obj.type === 'processor' &&
                    (obj.config?.processes?.includes('onion') || obj.name?.toLowerCase().includes('cutting'))
                )
            },
            {
                name: 'Coating Station',
                check: (objects) => objects.some(obj =>
                    obj.type === 'processor' &&
                    (
                        obj.config?.processes?.includes('onion_rings_raw') ||
                        obj.config?.result?.['onion_rings_raw'] === 'onion_rings_coated' ||
                        obj.config?.outputItem === 'onion_rings_coated' ||
                        (obj.config?.requiredIngredients?.includes('onion_rings_raw') && obj.config?.requiredIngredients?.includes('coating_mix')) ||
                        obj.name?.toLowerCase().includes('coating')
                    )
                )
            },
            {
                name: 'Deep Fryer',
                check: (objects) => objects.some(obj =>
                    obj.type === 'processor' &&
                    (obj.config?.processes?.includes('onion_rings_coated') || obj.name?.toLowerCase().includes('fryer'))
                )
            }
        ],
        containers: ['plate']
    },
    'Chicken Tenders & Fries': {
        ingredients: ['raw_chicken', 'coating_mix', 'potato'],
        processors: [
            {
                name: 'Cutting Board',
                check: (objects) => objects.some(obj =>
                    obj.type === 'processor' &&
                    (obj.config?.processes?.includes('raw_chicken') || obj.name?.toLowerCase().includes('cutting'))
                )
            },
            {
                name: 'Coating Station',
                check: (objects) => objects.some(obj =>
                    obj.type === 'processor' &&
                    (
                        obj.config?.processes?.includes('raw_chicken_strips') ||
                        obj.config?.result?.['raw_chicken_strips'] === 'coated_chicken_strips' ||
                        obj.config?.outputItem === 'coated_chicken_strips' ||
                        (obj.config?.requiredIngredients?.includes('raw_chicken_strips') && obj.config?.requiredIngredients?.includes('coating_mix')) ||
                        obj.name?.toLowerCase().includes('coating')
                    )
                )
            },
            {
                name: 'Deep Fryer',
                check: (objects) => objects.some(obj =>
                    obj.type === 'processor' &&
                    (obj.config?.processes?.includes('coated_chicken_strips') || obj.name?.toLowerCase().includes('fryer'))
                )
            }
        ],
        containers: ['plate']
    },
    'BLT Sandwich': {
        ingredients: ['bread_slice', 'raw_bacon', 'lettuce', 'tomato'],
        processors: [
            {
                name: 'Toaster',
                check: (objects) => objects.some(obj =>
                    obj.type === 'processor' &&
                    (obj.config?.processes?.includes('bread_slice') || obj.name?.toLowerCase().includes('toaster'))
                )
            },
            {
                name: 'Stove Top',
                check: (objects) => objects.some(obj =>
                    obj.type === 'processor' &&
                    (obj.config?.processes?.includes('raw_bacon') || obj.name?.toLowerCase().includes('stove') || obj.name?.toLowerCase().includes('grill') || obj.name?.toLowerCase().includes('griddle'))
                )
            },
            {
                name: 'Cutting Board',
                check: (objects) => objects.some(obj =>
                    obj.type === 'processor' &&
                    (obj.config?.processes?.includes('lettuce') || obj.config?.processes?.includes('tomato') || obj.name?.toLowerCase().includes('cutting'))
                )
            }
        ],
        containers: ['plate']
    },
    'Grilled Cheese Sandwich': {
        ingredients: ['bread_slice', 'cheese_slice'],
        processors: [
            {
                name: 'Stove Top',
                check: (objects) => objects.some(obj =>
                    obj.type === 'processor' &&
                    (obj.config?.processes?.includes('grilled_cheese_raw') || obj.name?.toLowerCase().includes('stove') || obj.name?.toLowerCase().includes('grill') || obj.name?.toLowerCase().includes('griddle'))
                )
            }
        ],
        containers: ['plate']
    },
    'Pancakes': {
        ingredients: ['pancake_mix', 'syrup'],
        processors: [
            {
                name: 'Stand Mixer',
                check: (objects) => objects.some(obj =>
                    obj.type === 'processor' &&
                    (obj.config?.processes?.includes('pancake_mix') || obj.name?.toLowerCase().includes('mixer'))
                )
            },
            {
                name: 'Stove Top',
                check: (objects) => objects.some(obj =>
                    obj.type === 'processor' &&
                    (obj.config?.processes?.includes('pancake_batter') || obj.name?.toLowerCase().includes('stove') || obj.name?.toLowerCase().includes('grill') || obj.name?.toLowerCase().includes('griddle'))
                )
            }
        ],
        containers: ['plate']
    },
    'Cheese Omelette': {
        ingredients: ['egg', 'cheese_slice'],
        processors: [
            {
                name: 'Stand Mixer',
                check: (objects) => objects.some(obj =>
                    obj.type === 'processor' &&
                    (obj.config?.processes?.includes('egg') || obj.name?.toLowerCase().includes('mixer'))
                )
            },
            {
                name: 'Stove Top',
                check: (objects) => objects.some(obj =>
                    obj.type === 'processor' &&
                    (obj.config?.processes?.includes('omelette_mix') || obj.name?.toLowerCase().includes('stove') || obj.name?.toLowerCase().includes('grill') || obj.name?.toLowerCase().includes('griddle'))
                )
            }
        ],
        containers: ['plate']
    },
    'Fruit & Yogurt Bowl': {
        ingredients: ['banana', 'strawberry', 'yogurt', 'granola'],
        processors: [
            {
                name: 'Cutting Board',
                check: (objects) => objects.some(obj =>
                    obj.type === 'processor' &&
                    (obj.config?.processes?.includes('banana') || obj.config?.processes?.includes('strawberry') || obj.name?.toLowerCase().includes('cutting'))
                )
            }
        ],
        containers: ['bowl']
    },
    'Smoothie': {
        ingredients: ['banana', 'strawberry', 'milk'],
        processors: [
            {
                name: 'Cutting Board',
                check: (objects) => objects.some(obj =>
                    obj.type === 'processor' &&
                    (obj.config?.processes?.includes('banana') || obj.config?.processes?.includes('strawberry') || obj.name?.toLowerCase().includes('cutting'))
                )
            },
            {
                name: 'Blender',
                check: (objects) => objects.some(obj =>
                    obj.type === 'processor' &&
                    (obj.config?.outputItem === 'smoothie_ready' || obj.name?.toLowerCase().includes('blender'))
                )
            }
        ],
        containers: ['cup']
    },
    'Pizza Margherita': {
        ingredients: ['pizza_dough', 'tomato_sauce', 'shredded_mozzarella'],
        processors: [
            {
                name: 'Dough Press',
                check: (objects) => objects.some(obj =>
                    obj.type === 'processor' &&
                    (obj.config?.processes?.includes('pizza_dough') || obj.name?.toLowerCase().includes('press'))
                )
            },
            {
                name: 'Pizza Oven',
                check: (objects) => objects.some(obj =>
                    obj.type === 'processor' &&
                    (obj.config?.processes?.includes('pizza_margherita_raw') || obj.name?.toLowerCase().includes('oven'))
                )
            }
        ],
        containers: ['plate']
    }
};

export class LevelEditor {
    constructor(camera, renderer, scene, interactionManager, callbacks = {}) {
        this.camera = camera;
        this.renderer = renderer;
        this.scene = scene;
        this.interactionManager = interactionManager;
        this.callbacks = typeof callbacks === 'function' ? { onExit: callbacks } : callbacks;
        this.enabled = false;
        this.raycaster = new THREE.Raycaster();

        // Loaded Level Metadata
        this.currentLevelData = {};
        this.currentSourceEntry = null;
        this.validationWarningsCount = 0;
        this.lang = 'en';

        // State
        this.selectedObject = null;
        this.ghostObject = null; // Object currently being placed
        this.isDragging = false;
        this.placementMode = false; // If true, we are trying to place a new item

        // Resize/Extend State
        this.activeHandle = null;
        this.startDragPos = new THREE.Vector3();
        this.originalSize = { width: 0, depth: 0 };
        this.originalPos = new THREE.Vector3();
        this.extendingGhosts = []; // For counters/tables

        // Ground Plane for Raycasting (Y=0)
        this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

        // Grid Helper (Visible only in Editor)
        // 8x8 size, 0.5 unit cells = 16 divisions
        this.gridHelper = new THREE.GridHelper(8, 16, 0xFFD700, 0x444444);
        this.gridHelper.position.y = 0.01; // Slight offset to avoid z-fighting if floor was visible
        this.gridHelper.visible = false;
        this.scene.add(this.gridHelper);

        // Controls
        this.orbit = new OrbitControls(camera, renderer.domElement);
        this.orbit.enabled = false;
        this.orbit.enableDamping = true;
        this.orbit.dampingFactor = 0.1;

        // Visual Helpers
        this.selectionBox = new THREE.BoxHelper(new THREE.Mesh(), 0xffff00);
        this.selectionBox.visible = false;
        this.scene.add(this.selectionBox);

        // Resize Handles
        this.handlesGroup = new THREE.Group();
        this.scene.add(this.handlesGroup);
        this.handles = {};
        ['n', 's', 'e', 'w'].forEach(dir => {
            const g = new THREE.SphereGeometry(0.25, 16, 16);
            const m = new THREE.MeshBasicMaterial({ color: 0x00FFFF, depthTest: false, transparent: true, opacity: 0.8 });
            const mesh = new THREE.Mesh(g, m);
            mesh.userData = { isHandle: true, direction: dir };
            mesh.renderOrder = 999;
            mesh.visible = false;
            this.handlesGroup.add(mesh);
            this.handles[dir] = mesh;
        });


        // Init UI
        this.ui = document.getElementById('editor-ui');
        this.libraryContent = document.getElementById('library-content');
        this.inspector = document.getElementById('editor-inspector');
        this.inspectorName = document.getElementById('inspector-name');
        this.inspectorX = document.getElementById('val-x');
        this.inspectorZ = document.getElementById('val-z');

        // Meta Modal
        this.metaModal = document.getElementById('editor-meta-modal');

        this.thumbnailCache = new Map();
        this.rightClickStart = { x: 0, y: 0 };

        this._initUI();
        this._bindEvents();
    }

    _initUI() {
        // Populate Library
        this._renderLibrary('all');

        // Populate Meals for Meta
        this._populateMealsGrid();

        // Bind Tab Switching
        const tabs = document.querySelectorAll('.tab-btn');
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                tabs.forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                this._renderLibrary(e.target.dataset.category);
            });
        });

        // Bind Inspector Actions
        document.getElementById('btn-rotate').addEventListener('click', () => this.rotateSelected());
        document.getElementById('btn-clone').addEventListener('click', () => this.cloneSelected());
        document.getElementById('btn-delete').addEventListener('click', () => this.deleteSelected());
        document.getElementById('editor-export-btn').addEventListener('click', () => this.exportLayout());
        document.getElementById('editor-save-local-btn').addEventListener('click', () => this.saveLocalLevel());
        document.getElementById('editor-exit-btn').addEventListener('click', () => {
            this.callbacks.onExit?.();
        });

        // Meta Button
        document.getElementById('editor-meta-btn').addEventListener('click', () => {
            this.openMetaModal();
        });
        document.getElementById('meta-close-btn').addEventListener('click', () => {
            this.saveMetaFromModal();
            this.metaModal.style.display = 'none';
        });

        // Bind Config Editor
        this.inspectorConfig = document.getElementById('inspector-config');
        document.getElementById('btn-save-config').addEventListener('click', () => this.saveConfig());

        // Bind Validation panel toggle
        const toggleValBtn = document.getElementById('btn-toggle-validation');
        const validationPanel = document.getElementById('editor-validation-panel');
        if (toggleValBtn && validationPanel) {
            toggleValBtn.addEventListener('click', () => {
                validationPanel.classList.toggle('collapsed');
                toggleValBtn.textContent = validationPanel.classList.contains('collapsed') ? '▲' : '▼';
            });
        }
    }

    _renderLibrary(category) {
        this.libraryContent.innerHTML = '';
        const items = category === 'all'
            ? CATALOG_ITEMS
            : CATALOG_ITEMS.filter(i => i.category === category);

        items.forEach(item => {
            const el = document.createElement('div');
            el.className = 'library-item';

            const imgSrc = this.generateThumbnail(item);

            const displayName = this.translateText(item.name);
            el.innerHTML = `
                <img class="library-item-icon-3d" src="${imgSrc}" alt="${displayName}">
                <div class="library-item-name">${displayName}</div>
            `;

            el.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent canvas click
                this.startPlacement(item);
            });

            this.libraryContent.appendChild(el);
        });
    }

    _bindEvents() {
        // Mouse Events
        this.renderer.domElement.addEventListener('pointerdown', (e) => this.onPointerDown(e));
        this.renderer.domElement.addEventListener('pointermove', (e) => this.onPointerMove(e));
        this.renderer.domElement.addEventListener('pointerup', (e) => this.onPointerUp(e));

        // Prevent default context menu in editor mode
        this.renderer.domElement.addEventListener('contextmenu', (e) => {
            if (this.enabled) e.preventDefault();
        });

        // Keyboard Shortcuts
        window.addEventListener('keydown', (e) => {
            if (!this.enabled) return;
            // Do not trigger shortcuts if user is typing in textarea or inputs
            if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;

            switch (e.key.toLowerCase()) {
                case 'escape':
                    this.cancelPlacement();
                    this.deselect();
                    break;
                case 'delete':
                case 'backspace':
                    this.deleteSelected();
                    break;
                case 'r':
                    this.rotateSelected();
                    break;
                case 'c':
                    this.cloneSelected();
                    break;
                case 't':
                    this.exportLayout();
                    break;
            }
        });
    }

    // Called when opening editor for a specific level
    loadLevel(levelData, sourceEntry = null) {
        // We store the metadata locally. The 3D objects are already added by main.js using buildKitchen
        // We just need to sync our internal state.
        this.currentLevelData = JSON.parse(JSON.stringify(levelData)); // Deep copy
        this.currentSourceEntry = sourceEntry ? JSON.parse(JSON.stringify(sourceEntry)) : null;
        document.getElementById('editor-current-level-name').textContent = levelData.name || "Untitled";
        this.validateLevel();
    }

    enable() {
        this.enabled = true;
        this.orbit.enabled = true;
        this.ui.style.display = 'block';

        // Load active language and translate UI
        this.loadActiveLanguage();
        this.translateUI();

        // Show Schematic Grid
        this.gridHelper.visible = true;

        // Hide textured floor for clean CAD look
        const gameFloor = getFloorMesh();
        if (gameFloor) gameFloor.visible = false;

        // Set optimal editor view
        this.camera.position.set(0, 12, 8);
        this.camera.lookAt(0, 0, 0);
        this.orbit.target.set(0, 0, 0);

        // Show validation panel on load
        const validationPanel = document.getElementById('editor-validation-panel');
        if (validationPanel) validationPanel.style.display = 'flex';

        this.validateLevel();
    }

    disable() {
        this.enabled = false;
        this.orbit.enabled = false;
        this.ui.style.display = 'none';
        this.cancelPlacement();
        this.deselect();

        // Revert Visuals
        this.gridHelper.visible = false;
        const gameFloor = getFloorMesh();
        if (gameFloor) gameFloor.visible = true;

        // Hide validation panel
        const validationPanel = document.getElementById('editor-validation-panel');
        if (validationPanel) validationPanel.style.display = 'none';
    }

    loadActiveLanguage() {
        const savedString = localStorage.getItem('pixelKitchenSaveData');
        if (savedString) {
            try {
                const data = JSON.parse(savedString);
                if (data.settings && data.settings.language) {
                    this.lang = data.settings.language;
                    return;
                }
            } catch (e) { }
        }
        this.lang = 'en';
    }

    translateText(key) {
        const lang = this.lang || 'en';
        if (EDITOR_TRANSLATIONS[lang] && EDITOR_TRANSLATIONS[lang][key]) {
            return EDITOR_TRANSLATIONS[lang][key];
        }
        if (FRIENDLY_NAMES[key]) {
            return this.translateText(FRIENDLY_NAMES[key]);
        }
        const transVal = getTrans(key, lang);
        if (transVal !== key) return transVal;
        return key;
    }

    translateUI() {
        // 1. Top bar title & controls hint
        const titleContainer = document.querySelector('.editor-title');
        if (titleContainer) {
            const textNode = Array.from(titleContainer.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
            if (textNode) {
                textNode.textContent = this.translateText('title');
            }
        }

        const controlsHint = document.querySelector('.editor-controls-hint');
        if (controlsHint) {
            controlsHint.innerHTML = this.translateText('controls_hint');
        }

        // Top action buttons
        const btnSettings = document.getElementById('editor-meta-btn');
        if (btnSettings) btnSettings.textContent = this.translateText('btn_settings');

        const btnSaveLocal = document.getElementById('editor-save-local-btn');
        if (btnSaveLocal) btnSaveLocal.textContent = this.translateText('btn_save_local');

        const btnSaveJson = document.getElementById('editor-export-btn');
        if (btnSaveJson) btnSaveJson.textContent = this.translateText('btn_save_json');

        const btnExit = document.getElementById('editor-exit-btn');
        if (btnExit) btnExit.textContent = this.translateText('btn_exit');

        // 2. Validation Panel Title
        const valTitle = document.querySelector('.validation-title');
        if (valTitle) valTitle.textContent = this.translateText('map_status');

        // 3. Settings Modal Title
        const modalTitle = document.querySelector('#editor-meta-modal h3');
        if (modalTitle) modalTitle.textContent = this.translateText('settings_title');

        // Settings Modal Inputs
        const nameLabel = document.querySelector('label[for="meta-name"]');
        if (nameLabel) nameLabel.textContent = this.translateText('lbl_level_name');

        const durationLabel = document.querySelector('label[for="meta-duration"]');
        if (durationLabel) durationLabel.textContent = this.translateText('lbl_duration');

        const delayLabel = document.querySelector('label[for="meta-delay"]');
        if (delayLabel) delayLabel.textContent = this.translateText('lbl_order_delay');

        const maxOrdersLabel = document.querySelector('label[for="meta-max-orders"]');
        if (maxOrdersLabel) maxOrdersLabel.textContent = this.translateText('lbl_max_orders');

        const star1Label = document.querySelector('label[for="meta-star1"]');
        if (star1Label) star1Label.textContent = this.translateText('lbl_star1');

        const star2Label = document.querySelector('label[for="meta-star2"]');
        if (star2Label) star2Label.textContent = this.translateText('lbl_star2');

        const star3Label = document.querySelector('label[for="meta-star3"]');
        if (star3Label) star3Label.textContent = this.translateText('lbl_star3');

        const secTitles = document.querySelectorAll('#editor-meta-modal .meta-section-title');
        if (secTitles[0]) secTitles[0].textContent = this.translateText('sec_stars');
        if (secTitles[1]) secTitles[1].textContent = this.translateText('sec_recipes');

        const btnClose = document.getElementById('meta-close-btn');
        if (btnClose) btnClose.textContent = this.translateText('btn_close');

        // 4. Library Tabs
        const tabBtns = document.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            const cat = btn.dataset.category;
            let key = '';
            if (cat === 'all') key = 'tab_all';
            else if (cat === 'Architecture') key = 'tab_arch';
            else if (cat === 'Furniture') key = 'tab_furniture';
            else if (cat === 'Stations') key = 'tab_stations';
            else if (cat === 'Sources') key = 'tab_sources';
            else if (cat === 'Items') key = 'tab_utensils';
            else if (cat === 'Ingredients') key = 'tab_ingredients';
            else if (cat === 'Dishes') key = 'tab_dishes';
            else if (cat === 'Decorations') key = 'tab_decorations';

            if (key) {
                btn.textContent = this.translateText(key);
            }
        });

        // 5. Inspector Panel
        const inspectorTitle = document.querySelector('#editor-inspector h3');
        if (inspectorTitle) inspectorTitle.textContent = this.translateText('inspector_title');

        const inspectorLabel = document.querySelector('#editor-inspector label');
        if (inspectorLabel) inspectorLabel.textContent = this.translateText('lbl_config');

        const btnSaveConfig = document.getElementById('btn-save-config');
        if (btnSaveConfig) btnSaveConfig.textContent = this.translateText('btn_save_config');

        const btnRotate = document.getElementById('btn-rotate');
        if (btnRotate) btnRotate.textContent = this.translateText('btn_rotate');

        const btnClone = document.getElementById('btn-clone');
        if (btnClone) btnClone.textContent = this.translateText('btn_clone');

        const btnDelete = document.getElementById('btn-delete');
        if (btnDelete) btnDelete.textContent = this.translateText('btn_delete');

        // 6. Refresh meals tag selectors
        this._populateMealsGrid();
    }

    _populateMealsGrid() {
        const mealsGrid = document.getElementById('meta-meals-grid');
        if (mealsGrid) {
            mealsGrid.innerHTML = '';
            Object.keys(RECIPES).forEach(r => {
                const tag = document.createElement('div');
                tag.className = 'meal-tag';
                tag.dataset.value = r;

                const translatedMealName = this.translateText(r);

                tag.innerHTML = `<span class="checkbox-box"></span><span class="meal-name">${translatedMealName}</span>`;

                const isSelected = this.currentLevelData?.availableMeals?.includes(r) || false;
                if (isSelected) {
                    tag.classList.add('selected');
                }

                tag.addEventListener('click', () => {
                    tag.classList.toggle('selected');
                    this.saveMetaFromModal(); // Autosave in memory
                });
                mealsGrid.appendChild(tag);
            });
        }
    }

    update(delta) {
        if (!this.enabled) return;
        this.orbit.update();

        if (this.selectedObject) {
            this.selectionBox.update();
            this._updateInspectorData();
            this._updateHandles();
        }
    }

    // --- Meta Modal ---

    openMetaModal() {
        this.metaModal.style.display = 'flex';
        const d = this.currentLevelData;
        document.getElementById('meta-name').value = d.name || "";
        document.getElementById('meta-duration').value = d.duration || 180;
        document.getElementById('meta-delay').value = d.newOrderDelay || 15;
        document.getElementById('meta-max-orders').value = d.maxActiveOrders || 2;
        document.getElementById('meta-star1').value = d.starThresholds ? d.starThresholds[0] : 100;
        document.getElementById('meta-star2').value = d.starThresholds ? d.starThresholds[1] : 200;
        document.getElementById('meta-star3').value = d.starThresholds ? d.starThresholds[2] : 300;

        const tags = document.querySelectorAll('#meta-meals-grid .meal-tag');
        tags.forEach(tag => {
            const val = tag.dataset.value;
            const isSelected = d.availableMeals ? d.availableMeals.includes(val) : false;
            tag.classList.toggle('selected', isSelected);
        });
    }

    saveMetaFromModal() {
        const d = this.currentLevelData;
        d.name = document.getElementById('meta-name').value;
        d.duration = parseInt(document.getElementById('meta-duration').value) || 180;
        d.newOrderDelay = parseInt(document.getElementById('meta-delay').value) || 15;
        d.maxActiveOrders = parseInt(document.getElementById('meta-max-orders').value) || 2;
        d.starThresholds = [
            parseInt(document.getElementById('meta-star1').value) || 100,
            parseInt(document.getElementById('meta-star2').value) || 200,
            parseInt(document.getElementById('meta-star3').value) || 300,
        ];

        const selectedTags = Array.from(document.querySelectorAll('#meta-meals-grid .meal-tag.selected'));
        d.availableMeals = selectedTags.map(tag => tag.dataset.value);

        document.getElementById('editor-current-level-name').textContent = d.name;
        this.validateLevel();
    }

    // --- Core Logic ---

    _getVisualTopY(object) {
        const box = new THREE.Box3();
        object.traverse((child) => {
            if (child.isMesh && child.visible) {
                child.updateWorldMatrix(true, false);
                if (child.geometry) {
                    child.geometry.computeBoundingBox();
                    const childBox = child.geometry.boundingBox.clone();
                    childBox.applyMatrix4(child.matrixWorld);
                    box.union(childBox);
                }
            }
        });
        if (box.isEmpty()) return object.position.y;
        return box.max.y;
    }

    startPlacement(template) {
        this.cancelPlacement(); // Clear existing ghost
        this.deselect(); // Clear selection

        this.placementMode = true;
        this.ghostObject = this._createObjectFromTemplate(template);

        // Make ghost transparent
        this.ghostObject.traverse(c => {
            if (c.isMesh) {
                c.material = c.material.clone();
                c.material.transparent = true;
                c.material.opacity = 0.6;
                c.material.emissive = new THREE.Color(0x00FF00);
                c.material.emissiveIntensity = 0.2;
            }
        });

        this.scene.add(this.ghostObject);
    }

    cancelPlacement() {
        if (this.ghostObject) {
            this.scene.remove(this.ghostObject);
            this.ghostObject = null;
        }
        this.placementMode = false;
    }

    confirmPlacement() {
        if (this.ghostObject) {
            const template = this.ghostObject.userData.template;
            const isBlocked = this._checkOccupied(this.ghostObject.position.x, this.ghostObject.position.z, this.ghostObject.position.y, template);
            if (isBlocked) return;

            // Create a real solid instance
            const realObject = this._createObjectFromTemplate(template);

            realObject.position.copy(this.ghostObject.position);
            realObject.rotation.copy(this.ghostObject.rotation);

            this.scene.add(realObject);

            // Auto-fuse visuals
            refreshSmartObjects(this.scene);
            this.validateLevel();
        }
    }

    _createObjectFromTemplate(t) {
        // Map template to world.js creation functions
        let obj;
        const fakeColor = t.color || '#FFFFFF';
        const dummyPos = { x: 0, z: 0 }; // Position set later

        if (t.type === STATION_TYPES.COUNTER || t.type === STATION_TYPES.SERVING) {
            obj = createCounterPrefab(t.name, fakeColor, t.isServing, this.currentLevelData?.theme);
        } else if (t.type === STATION_TYPES.TABLE) {
            // Neighbors default to false, will fuse later
            obj = createTablePrefab(t.name, fakeColor, { n: false, s: false, e: false, w: false });
        } else {
            // Generic Station / Wall / Source / Preplaced Item / Decoration
            const def = {
                name: t.name,
                type: t.type,
                size: t.size,
                color: fakeColor,
                config: t.config,
                position: dummyPos
            };
            obj = createStationPrefab(def, this.currentLevelData?.theme);
        }

        // Store template data for serialization later
        obj.userData.template = t;
        // Y position will be handled by onPointerMove snapping
        obj.position.y = 0;

        return obj;
    }

    select(object) {
        if (this.selectedObject === object) return;
        this.selectedObject = object;
        this.selectionBox.setFromObject(object);
        this.selectionBox.visible = true;

        // Update UI
        this.inspector.style.display = 'flex';
        this.inspectorName.textContent = object.name;

        // Populate Config
        // Use existing userData.config if set, otherwise fallback to template config
        const config = object.userData.config || object.userData.template?.config || {};
        this.inspectorConfig.value = JSON.stringify(config, null, 2);

        this._updateHandles();
    }

    deselect() {
        this.selectedObject = null;
        this.selectionBox.visible = false;
        this.inspector.style.display = 'none';
        this.handlesGroup.visible = false;
    }

    // --- Manipulation ---

    saveConfig() {
        if (!this.selectedObject) return;
        try {
            const newConfig = JSON.parse(this.inspectorConfig.value);
            this.selectedObject.userData.config = newConfig;

            // Visual feedback
            const btn = document.getElementById('btn-save-config');
            const originalText = btn.innerText;
            btn.innerText = "✅ Saved!";
            setTimeout(() => btn.innerText = originalText, 1000);
            this.validateLevel();

        } catch (e) {
            alert("Invalid JSON syntax! Check your brackets and quotes.");
        }
    }

    rotateSelected() {
        const target = this.placementMode ? this.ghostObject : this.selectedObject;
        if (target) {
            target.rotation.y -= Math.PI / 2;
            target.updateMatrixWorld();
            if (this.selectionBox.visible) this.selectionBox.update();
            // If rotating placed object, refresh visuals
            if (!this.placementMode) {
                refreshSmartObjects(this.scene);
                this.validateLevel();
            }
        }
    }

    deleteSelected() {
        if (this.selectedObject) {
            this.scene.remove(this.selectedObject);
            this.deselect();
            refreshSmartObjects(this.scene);
            this.validateLevel();
        }
    }

    cloneSelected() {
        if (this.selectedObject) {
            const template = this.selectedObject.userData.template || {
                name: this.selectedObject.name,
                type: this.selectedObject.userData.stationType || this.selectedObject.userData.type,
            };

            if (this.selectedObject.userData.template) {
                this.startPlacement(this.selectedObject.userData.template);
            } else {
                const clone = this.selectedObject.clone();
                clone.position.x += GRID_UNIT;
                this.scene.add(clone);
                this.select(clone);
                refreshSmartObjects(this.scene);
                this.validateLevel();
            }
        }
    }

    _updateInspectorData() {
        if (this.selectedObject) {
            this.inspectorX.textContent = this.selectedObject.position.x.toFixed(1);
            this.inspectorZ.textContent = this.selectedObject.position.z.toFixed(1);
        }
    }

    // --- Handle Management ---

    _updateHandles() {
        const obj = this.selectedObject;
        if (!obj) {
            this.handlesGroup.visible = false;
            return;
        }

        const type = obj.userData.stationType || obj.userData.type;
        const resizable = type === STATION_TYPES.WALL;
        const extendable = type === STATION_TYPES.COUNTER || type === STATION_TYPES.TABLE || type === STATION_TYPES.SERVING;

        if (!resizable && !extendable) {
            this.handlesGroup.visible = false;
            return;
        }

        this.handlesGroup.visible = true;

        // Calculate bounds
        const box = new THREE.Box3().setFromObject(obj);
        const center = obj.position;
        // Use simple box dimensions based on userData for walls to be precise, or bounding box for others
        let w, d;
        if (resizable && obj.userData.size) {
            w = obj.userData.size.width;
            d = obj.userData.size.depth;
        } else {
            w = box.max.x - box.min.x;
            d = box.max.z - box.min.z;
        }

        const y = center.y;
        const offset = 0.3;

        this.handles.n.position.set(center.x, y, center.z - d / 2 - offset);
        this.handles.s.position.set(center.x, y, center.z + d / 2 + offset);
        this.handles.e.position.set(center.x + w / 2 + offset, y, center.z);
        this.handles.w.position.set(center.x - w / 2 - offset, y, center.z);

        Object.values(this.handles).forEach(h => h.visible = true);
    }

    // --- Input Handling ---

    onPointerDown(e) {
        if (!this.enabled) return;

        // Ignore clicks on UI panels
        if (e.target.closest('.editor-panel') || e.target.closest('.editor-top-bar')) return;

        if (e.button === 2) {
            this.rightClickStart = { x: e.clientX, y: e.clientY };
            return;
        }

        if (e.button !== 0) return;

        const mouse = {
            x: (e.clientX / window.innerWidth) * 2 - 1,
            y: -(e.clientY / window.innerHeight) * 2 + 1
        };
        this.raycaster.setFromCamera(mouse, this.camera);

        // Check Handle Click first
        if (this.handlesGroup.visible) {
            const handleIntersects = this.raycaster.intersectObjects(this.handlesGroup.children);
            if (handleIntersects.length > 0) {
                this.activeHandle = handleIntersects[0].object;
                this.isDragging = true;
                this.orbit.enabled = false;

                // Setup drag state
                const planeIntersect = new THREE.Vector3();
                this.raycaster.ray.intersectPlane(this.groundPlane, planeIntersect);
                this.startDragPos.copy(planeIntersect);
                this.originalPos.copy(this.selectedObject.position);

                if (this.selectedObject.userData.stationType === STATION_TYPES.WALL) {
                    this.originalSize = { ...this.selectedObject.userData.size };
                }

                return; // Consumed
            }
        }

        if (this.placementMode) {
            this.confirmPlacement();
        } else {
            // Raycast for selection
            const candidates = [];
            this.scene.traverse(c => {
                // Find root objects that are direct children of the scene and not system helpers or the floor
                if (c.parent === this.scene &&
                    c !== this.gridHelper &&
                    c !== this.selectionBox &&
                    c !== this.handlesGroup &&
                    c !== this.orbit &&
                    c.name !== "Floor" &&
                    c.userData &&
                    c.userData.type !== 'floor') {
                    candidates.push(c);
                }
            });

            const hits = this.raycaster.intersectObjects(candidates, true);

            if (hits.length > 0) {
                // Walk up to the root group
                let root = hits[0].object;
                while (root.parent && root.parent !== this.scene) { root = root.parent; }

                if (this.selectedObject !== root) {
                    this.select(root);
                }
                this.isDragging = true;
                this.orbit.enabled = false;
            } else {
                this.deselect();
            }
        }
    }

    onPointerMove(e) {
        if (!this.enabled) return;

        const mouse = {
            x: (e.clientX / window.innerWidth) * 2 - 1,
            y: -(e.clientY / window.innerHeight) * 2 + 1
        };
        this.raycaster.setFromCamera(mouse, this.camera);

        // --- RESIZE / EXTEND LOGIC ---
        if (this.isDragging && this.activeHandle && this.selectedObject) {
            const intersect = new THREE.Vector3();
            if (this.raycaster.ray.intersectPlane(this.groundPlane, intersect)) {
                const delta = intersect.clone().sub(this.startDragPos);
                const type = this.selectedObject.userData.stationType;

                // Direction multipliers based on handle
                const dir = this.activeHandle.userData.direction;
                // n: z-, s: z+, e: x+, w: x-

                if (type === STATION_TYPES.WALL) {
                    // Resize Logic
                    let dw = 0;
                    let dd = 0;
                    let dx = 0;
                    let dz = 0;

                    // Calculate dimension changes locally aligned
                    if (dir === 'e') dw = delta.x;
                    if (dir === 'w') dw = -delta.x;
                    if (dir === 's') dd = delta.z;
                    if (dir === 'n') dd = -delta.z;

                    // Snap to grid unit
                    let newW = Math.max(GRID_UNIT, Math.round((this.originalSize.width + dw) * 2) / 2);
                    let newD = Math.max(GRID_UNIT, Math.round((this.originalSize.depth + dd) * 2) / 2);

                    // Shift center to compensate anchor
                    if (dir === 'e') dx = (newW - this.originalSize.width) / 2;
                    if (dir === 'w') dx = -(newW - this.originalSize.width) / 2;
                    if (dir === 's') dz = (newD - this.originalSize.depth) / 2;
                    if (dir === 'n') dz = -(newD - this.originalSize.depth) / 2;

                    // Update Wall
                    resizeWall(this.selectedObject, newW, newD);
                    this.selectedObject.position.set(
                        this.originalPos.x + dx,
                        this.originalPos.y,
                        this.originalPos.z + dz
                    );
                    this.selectionBox.setFromObject(this.selectedObject);
                }
                else if (type === STATION_TYPES.COUNTER || type === STATION_TYPES.TABLE || type === STATION_TYPES.SERVING) {
                    // Tiling Logic
                    // Calculate how many units moved along axis
                    let axisDelta = 0;
                    let axisVector = new THREE.Vector3();

                    if (dir === 'e') { axisDelta = delta.x; axisVector.set(1, 0, 0); }
                    if (dir === 'w') { axisDelta = -delta.x; axisVector.set(-1, 0, 0); }
                    if (dir === 's') { axisDelta = delta.z; axisVector.set(0, 0, 1); }
                    if (dir === 'n') { axisDelta = -delta.z; axisVector.set(0, 0, -1); }

                    const count = Math.floor((axisDelta + (GRID_UNIT / 2)) / GRID_UNIT);

                    // Cleanup old ghosts
                    this.extendingGhosts.forEach(g => this.scene.remove(g));
                    this.extendingGhosts = [];

                    if (count > 0) {
                        // Create ghosts
                        const t = this.selectedObject.userData.template;
                        for (let i = 1; i <= count; i++) {
                            const ghost = this._createObjectFromTemplate(t);
                            ghost.position.copy(this.originalPos).add(axisVector.clone().multiplyScalar(i * GRID_UNIT));

                            // Make ghost transparent
                            ghost.traverse(c => {
                                if (c.isMesh) {
                                    c.material = c.material.clone();
                                    c.material.transparent = true;
                                    c.material.opacity = 0.5;
                                    c.material.color.setHex(0x00FF00);
                                }
                            });

                            this.scene.add(ghost);
                            this.extendingGhosts.push(ghost);
                        }
                    }
                }

                // Update handle positions to follow the expansion
                this._updateHandles();
            }
            return;
        }

        // --- STACKING LOGIC (Existing) ---
        // 1. Find potential support objects (Counters, Tables)
        const supports = [];
        this.scene.traverse(c => {
            // Must be visible, and not the object currently being dragged/placed
            if (c.visible && c !== this.ghostObject && c !== this.selectedObject) {
                if (c.userData && (c.userData.stationType === STATION_TYPES.COUNTER || c.userData.stationType === STATION_TYPES.TABLE || c.userData.stationType === STATION_TYPES.SERVING || c.userData.stationType === STATION_TYPES.INGREDIENT_SOURCE || c.userData.stationType === STATION_TYPES.ITEM_SOURCE)) {
                    supports.push(c);
                }
            }
        });

        // 2. Check intersections with supports
        const hits = this.raycaster.intersectObjects(supports, true);

        let targetY = 0;
        let targetX = 0;
        let targetZ = 0;
        let foundSupport = false;

        if (hits.length > 0) {
            // Hit a counter/table -> Stack on top
            foundSupport = true;
            const hit = hits[0];
            const p = hit.point;
            targetX = p.x;
            targetZ = p.z;

            let root = hit.object;
            while (root && !supports.includes(root)) root = root.parent;
            if (root) {
                targetY = this._getVisualTopY(root);
            } else {
                targetY = MODULE_HEIGHT;
            }
        } else {
            // Hit nothing valid -> Check Ground Plane (Y=0)
            const target = new THREE.Vector3();
            if (this.raycaster.ray.intersectPlane(this.groundPlane, target)) {
                foundSupport = true;
                targetX = target.x;
                targetZ = target.z;
                targetY = 0;
            }
        }

        // Global height overrides based on template type or active object name
        const activeObject = (this.placementMode && this.ghostObject) ? this.ghostObject : this.selectedObject;
        if (activeObject) {
            const n = activeObject.name.toLowerCase();
            if (n.includes('lamp') || n.includes('light')) {
                targetY = 2.0; // Snap to ceiling lamp height (matching world.js)
            } else if (n.includes('hood') || n.includes('exhaust')) {
                targetY = MODULE_HEIGHT + 0.6; // Snap above stoves/counters (matching world.js)
            }
        }

        if (foundSupport) {
            // Snap X/Z to grid
            const finalX = Math.round(targetX * 2) / 2;
            const finalZ = Math.round(targetZ * 2) / 2;

            if (this.placementMode && this.ghostObject) {
                this.ghostObject.position.set(finalX, targetY, finalZ);

                // Color ghost based on occupancy
                const template = this.ghostObject.userData.template;
                const isBlocked = this._checkOccupied(finalX, finalZ, targetY, template);
                const emissiveColor = isBlocked ? new THREE.Color(0xFF0000) : new THREE.Color(0x00FF00);

                this.ghostObject.traverse(c => {
                    if (c.isMesh && c.material) {
                        c.material.emissive = emissiveColor;
                    }
                });
            } else if (this.isDragging && this.selectedObject) {
                this.selectedObject.position.set(finalX, targetY, finalZ);
            }
        }
    }

    onPointerUp(e) {
        if (!this.enabled) return;

        if (e && e.button === 2 && this.rightClickStart) {
            const dx = e.clientX - this.rightClickStart.x;
            const dy = e.clientY - this.rightClickStart.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 5) {
                if (this.placementMode) {
                    this.cancelPlacement();
                } else if (this.selectedObject) {
                    this.deselect();
                }
            }
            return;
        }

        if (this.activeHandle) {
            // Finish Extend/Resize
            if (this.extendingGhosts.length > 0) {
                // Solidify ghosts
                this.extendingGhosts.forEach(g => {
                    const t = g.userData.template;
                    const real = this._createObjectFromTemplate(t);
                    real.position.copy(g.position);
                    real.rotation.copy(g.rotation);
                    this.scene.add(real);
                    this.scene.remove(g);
                });
                this.extendingGhosts = [];
                refreshSmartObjects(this.scene); // Fuse visuals
                this.validateLevel();
            }

            this.activeHandle = null;
            this._updateHandles();
        }

        this.isDragging = false;
        this.orbit.enabled = true;
    }

    validateLevel() {
        if (!this.enabled) return;

        const placedObjects = [];
        this.scene.traverse(c => {
            if (c.parent === this.scene &&
                c !== this.gridHelper &&
                c !== this.selectionBox &&
                c !== this.handlesGroup &&
                c !== this.orbit &&
                c.name !== "Floor" &&
                c.userData &&
                c.userData.type !== 'floor') {

                placedObjects.push({
                    name: c.name,
                    type: c.userData.stationType || c.userData.type,
                    config: c.userData.config || c.userData.template?.config,
                    isServing: c.userData.isServing || c.userData.template?.isServing
                });
            }
        });

        const warnings = [];
        const missingItemsMap = new Map();

        const addWarning = (itemKey, recipeName) => {
            if (!missingItemsMap.has(itemKey)) {
                missingItemsMap.set(itemKey, new Set());
            }
            missingItemsMap.get(itemKey).add(recipeName);
        };

        // Serving Pass Check
        const hasServingPass = placedObjects.some(obj =>
            obj.type === STATION_TYPES.SERVING ||
            obj.isServing === true ||
            obj.name?.toLowerCase().includes('serving')
        );

        if (!hasServingPass) {
            addWarning('serving', 'All Recipes');
        }

        const availableMeals = this.currentLevelData.availableMeals || [];

        if (availableMeals.length === 0) {
            warnings.push({ desc: this.translateText("no_recipes_msg") });
        } else {
            availableMeals.forEach(mealName => {
                const reqs = RECIPE_REQUIREMENTS[mealName];
                if (!reqs) return;

                reqs.ingredients.forEach(ing => {
                    const hasIng = placedObjects.some(obj =>
                        (obj.type === STATION_TYPES.INGREDIENT_SOURCE && obj.config?.ingredient === ing) ||
                        (obj.type === STATION_TYPES.PREPLACED_ITEM && obj.config?.item === ing)
                    );
                    if (!hasIng) {
                        addWarning(ing, mealName);
                    }
                });

                reqs.containers.forEach(container => {
                    const hasContainer = placedObjects.some(obj =>
                        (obj.type === STATION_TYPES.ITEM_SOURCE && obj.config?.item === container) ||
                        (obj.type === STATION_TYPES.PREPLACED_ITEM && obj.config?.item === container)
                    );
                    if (!hasContainer) {
                        addWarning(container, mealName);
                    }
                });

                reqs.processors.forEach(proc => {
                    if (!proc.check(placedObjects)) {
                        addWarning(proc.name, mealName);
                    }
                });
            });
        }

        missingItemsMap.forEach((recipesSet, itemKey) => {
            const friendlyName = FRIENDLY_NAMES[itemKey] || itemKey;
            const recipesList = Array.from(recipesSet).map(r => this.translateText(r)).join(', ');
            warnings.push({
                desc: this.translateText(friendlyName),
                recipes: recipesList
            });
        });

        const statusBadge = document.getElementById('validation-status-badge');
        const detailsContainer = document.getElementById('validation-details');

        if (!statusBadge || !detailsContainer) return;

        this.validationWarningsCount = warnings.length;

        if (warnings.length === 0 && availableMeals.length > 0) {
            statusBadge.textContent = this.translateText("playable");
            statusBadge.className = "status-badge valid";
            detailsContainer.innerHTML = `<div class="validation-success-msg">${this.translateText("playable_msg")}</div>`;
        } else {
            statusBadge.textContent = availableMeals.length === 0 ? this.translateText("setup_incomplete") : this.translateText("issues_detected");
            statusBadge.className = "status-badge invalid";

            let html = "";
            if (availableMeals.length === 0) {
                html = `<div class="validation-item" style="color: #ffaa55; font-size: 0.9em; padding-left: 0;">${this.translateText("no_recipes_msg")}</div>`;
            } else {
                html = `<div class="validation-group-title">${this.translateText("missing_objects")}</div>`;
                warnings.forEach(w => {
                    html += `
                        <div class="validation-item">
                            <strong style="color: #ffb3b3;">${w.desc}</strong>
                            <div style="font-size: 0.85em; color: #aaa; margin-top: 2px;">${this.translateText("required_by")}${w.recipes}</div>
                        </div>
                    `;
                });
            }
            detailsContainer.innerHTML = html;
        }
    }

    // --- Export ---

    _collectLayout() {
        const layout = [];
        this.scene.traverse(c => {
            if (c.parent === this.scene &&
                c !== this.gridHelper &&
                c !== this.selectionBox &&
                c !== this.handlesGroup &&
                c !== this.orbit &&
                c.name !== "Floor" &&
                c.userData &&
                c.userData.type !== 'floor') {

                let entry = null;
                const type = c.userData.stationType || c.userData.type;

                // Any station-like object (including decorations, trash, walls)
                const isStation = [
                    STATION_TYPES.TABLE,
                    STATION_TYPES.COUNTER,
                    STATION_TYPES.SERVING,
                    STATION_TYPES.TRASH,
                    STATION_TYPES.WALL,
                    STATION_TYPES.INGREDIENT_SOURCE,
                    STATION_TYPES.ITEM_SOURCE,
                    STATION_TYPES.PROCESSOR,
                    'decoration',
                    'station'
                ].includes(type) || c.userData.type === 'station';

                if (isStation) {
                    entry = {
                        name: c.name,
                        type: c.userData.stationType || c.userData.type || 'station',
                        position: { x: parseFloat(c.position.x.toFixed(2)), z: parseFloat(c.position.z.toFixed(2)) },
                    };

                    if (c.rotation.y !== 0) {
                        entry.rotation = parseFloat(c.rotation.y.toFixed(2));
                    }

                    if (c.userData.size) entry.size = { width: c.userData.size.width, depth: c.userData.size.depth };
                    if (c.userData.template?.color) entry.color = c.userData.template.color;
                    if (c.userData.isServing) entry.isServing = true;

                    if (c.userData.config) {
                        entry.config = c.userData.config;
                    } else if (c.userData.template?.config) {
                        entry.config = c.userData.template.config;
                    }
                }
                else if (c.userData.type === ITEM_TYPES.ITEM || c.userData.type === ITEM_TYPES.INGREDIENT || c.userData.stationType === STATION_TYPES.PREPLACED_ITEM) {
                    let itemType = '';
                    let contents = null;

                    if (c.userData.stationType === STATION_TYPES.PREPLACED_ITEM) {
                        itemType = c.userData.config?.item || c.userData.template?.config?.item || 'plate';
                        contents = c.userData.config?.contents || c.userData.template?.config?.contents;
                    } else if (c.userData.type === ITEM_TYPES.ITEM) {
                        itemType = c.userData.itemType;
                        contents = c.userData.contents;
                    } else {
                        itemType = c.userData.ingredientType;
                    }

                    const config = { item: itemType };
                    if (contents && contents.length > 0) {
                        config.contents = [...contents];
                    }

                    entry = {
                        name: c.name || (itemType.charAt(0).toUpperCase() + itemType.slice(1)),
                        type: STATION_TYPES.PREPLACED_ITEM,
                        position: { x: parseFloat(c.position.x.toFixed(2)), z: parseFloat(c.position.z.toFixed(2)) },
                        config: config
                    };

                    if (c.rotation.y !== 0) {
                        entry.rotation = parseFloat(c.rotation.y.toFixed(2));
                    }
                }

                if (entry) {
                    layout.push(entry);
                }
            }
        });

        return layout;
    }

    buildLevelData() {
        const data = JSON.parse(JSON.stringify(this.currentLevelData || {}));
        data.name = String(data.name || 'Untitled Kitchen').trim().slice(0, 60) || 'Untitled Kitchen';
        data.duration = Math.max(30, Number(data.duration) || 180);
        data.newOrderDelay = Math.max(1, Number(data.newOrderDelay) || 15);
        data.maxActiveOrders = Math.max(1, Math.floor(Number(data.maxActiveOrders) || 2));
        data.starThresholds = Array.isArray(data.starThresholds) ? data.starThresholds.map(Number).filter(Number.isFinite) : [100, 200, 300];
        data.availableMeals = Array.isArray(data.availableMeals) ? data.availableMeals : [];
        data.layout = this._collectLayout();
        delete data.customId;
        delete data.source;
        delete data.origin;
        delete data.createdAt;
        delete data.updatedAt;
        delete data.filename;
        return data;
    }

    _confirmIncompleteLevel() {
        return this.validationWarningsCount === 0 || confirm(this.translateText('warning_export'));
    }

    exportLayout() {
        if (!this._confirmIncompleteLevel()) return;
        const data = this.buildLevelData();
        const fileName = `level_${data.levelId || 'custom'}.json`;
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.href = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(data, null, 2))}`;
        downloadAnchorNode.download = fileName;
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }

    saveLocalLevel() {
        if (!this._confirmIncompleteLevel()) return;
        this.callbacks.onSaveLocal?.(this.buildLevelData(), this.currentSourceEntry);
    }

    generateThumbnail(item) {
        const cacheKey = JSON.stringify(item);
        if (this.thumbnailCache.has(cacheKey)) {
            return this.thumbnailCache.get(cacheKey);
        }

        const model = this._createObjectFromTemplate(item);
        const dataURL = this.renderModelToDataURL(model);
        this.thumbnailCache.set(cacheKey, dataURL);
        return dataURL;
    }

    renderModelToDataURL(model) {
        const width = 128;
        const height = 128;

        const renderTarget = new THREE.WebGLRenderTarget(width, height, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.NearestFilter,
            format: THREE.RGBAFormat
        });

        const tempScene = new THREE.Scene();

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
        tempScene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
        dirLight.position.set(3, 5, 4);
        tempScene.add(dirLight);

        const fillLight = new THREE.DirectionalLight(0x8899ff, 0.35);
        fillLight.position.set(-3, 3, -4);
        tempScene.add(fillLight);

        tempScene.add(model);

        const box = new THREE.Box3().setFromObject(model);
        const center = new THREE.Vector3();
        box.getCenter(center);
        const size = new THREE.Vector3();
        box.getSize(size);

        const maxDim = Math.max(size.x, size.y, size.z, 0.1);
        const fov = 35;
        const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 100);

        const dist = (maxDim / (2 * Math.tan((fov * Math.PI) / 360))) * 1.5;
        camera.position.set(
            center.x + dist * 0.7,
            center.y + dist * 0.7,
            center.z + dist * 1.1
        );
        camera.lookAt(center);

        const originalClearColor = new THREE.Color();
        this.renderer.getClearColor(originalClearColor);
        const originalClearAlpha = this.renderer.getClearAlpha();

        this.renderer.setClearColor(0x000000, 0);
        this.renderer.setRenderTarget(renderTarget);
        this.renderer.clear();
        this.renderer.render(tempScene, camera);

        const pixels = new Uint8Array(width * height * 4);
        this.renderer.readRenderTargetPixels(renderTarget, 0, 0, width, height, pixels);

        this.renderer.setRenderTarget(null);
        this.renderer.setClearColor(originalClearColor, originalClearAlpha);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        const imgData = ctx.createImageData(width, height);

        // Helper to convert linear color channel to sRGB
        const linearToSRGB = (c) => {
            const val = c / 255;
            if (val <= 0.0031308) {
                return Math.max(0, Math.min(255, Math.round(val * 12.92 * 255)));
            }
            return Math.max(0, Math.min(255, Math.round((1.055 * Math.pow(val, 1 / 2.4) - 0.055) * 255)));
        };

        for (let y = 0; y < height; y++) {
            const srcY = height - 1 - y;
            for (let x = 0; x < width; x++) {
                const srcIdx = (srcY * width + x) * 4;
                const dstIdx = (y * width + x) * 4;
                imgData.data[dstIdx] = linearToSRGB(pixels[srcIdx]);
                imgData.data[dstIdx + 1] = linearToSRGB(pixels[srcIdx + 1]);
                imgData.data[dstIdx + 2] = linearToSRGB(pixels[srcIdx + 2]);
                imgData.data[dstIdx + 3] = pixels[srcIdx + 3];
            }
        }
        ctx.putImageData(imgData, 0, 0);
        const dataURL = canvas.toDataURL('image/png');

        tempScene.remove(model);
        model.traverse(c => {
            if (c.geometry) c.geometry.dispose();
            if (c.material) {
                if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
                else c.material.dispose();
            }
        });
        ambientLight.dispose();
        dirLight.dispose();
        fillLight.dispose();
        renderTarget.dispose();

        return dataURL;
    }

    _checkOccupied(x, z, y, ghostTemplate) {
        const gx = Math.round(x * 100) / 100;
        const gz = Math.round(z * 100) / 100;

        const isTopGhost = [
            STATION_TYPES.PROCESSOR,
            STATION_TYPES.INGREDIENT_SOURCE,
            STATION_TYPES.ITEM_SOURCE,
            STATION_TYPES.PREPLACED_ITEM,
            'decoration'
        ].includes(ghostTemplate.type);

        const isBaseGhost = !isTopGhost;

        if (ghostTemplate.type !== 'decoration') {
            // Base items cannot be placed on top of other items (y > 0.1)
            if (isBaseGhost && y > 0.1) {
                return true;
            }

            // Top items MUST be placed on top of a support (y > 0.1)
            if (isTopGhost && y < 0.1) {
                return true;
            }
        }

        let occupied = false;
        this.scene.traverse(c => {
            if (occupied) return; // fast exit
            if (c.parent === this.scene &&
                c !== this.ghostObject &&
                c !== this.selectedObject &&
                c !== this.gridHelper &&
                c !== this.selectionBox &&
                c !== this.handlesGroup &&
                c !== this.orbit &&
                c.name !== "Floor" &&
                c.userData && c.userData.type !== 'floor') {

                const cx = Math.round(c.position.x * 100) / 100;
                const cz = Math.round(c.position.z * 100) / 100;

                if (Math.abs(cx - gx) < 0.1 && Math.abs(cz - gz) < 0.1) {
                    // Walls block everything on the same cell
                    if (c.userData.stationType === STATION_TYPES.WALL || ghostTemplate.type === STATION_TYPES.WALL) {
                        occupied = true;
                    } else {
                        // Otherwise, block only if they occupy the same height level
                        if (Math.abs(c.position.y - y) < 0.3) {
                            occupied = true;
                        }
                    }
                }
            }
        });
        return occupied;
    }
}
