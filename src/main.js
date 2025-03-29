// src/main.js
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
// --- Add Loaders ---
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
// Optional: import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
// --- End Add ---
import { setupScene, setupCamera, setupRenderer, setupLighting, setupResizeHandler } from './setup.js';
import { PlayerControls } from './controls.js';
import { Player } from './player.js';
import { buildKitchen, toggleLabels } from './world.js';
import { InteractionManager } from './interaction.js';
import { LevelManager } from './LevelManager.js';
import { UIManager } from './ui.js';

// --- Global State ---
let isPaused = false;
let gameHasStarted = false;
let preloadedModels = {}; // Store loaded model templates
// --- End Global State ---

// --- Asset Loading ---
const loadingManager = new THREE.LoadingManager();
const gltfLoader = new GLTFLoader(loadingManager);

// Optional: Setup DRACOLoader if your models use it
// const dracoLoader = new DRACOLoader(loadingManager);
// dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/'); // Use correct path
// gltfLoader.setDRACOLoader(dracoLoader);

const assetsToLoad = {
    // Add model paths here - MUST match keys used in createItem
    tomato: 'models/tomato.glb', // <<< IMPORTANT: Create 'models' folder and place 'tomato.glb' here
    potato: 'models/potato.glb', // <<< IMPORTANT: Create 'models' folder and place 'potato.glb' here
    chopped_tomato: 'models/chopped_tomato.glb',
    lettuce: 'models/lettuce.glb',
    // potato: 'models/potato.glb', // Example for future
};

async function preloadAssets() {
    const promises = [];
    console.log("Starting asset preloading...");

    for (const key in assetsToLoad) {
        promises.push(
            gltfLoader.loadAsync(assetsToLoad[key]).then(gltf => {
                console.log(`Loaded ${key}`);
                const model = gltf.scene;
                // --- Basic processing for template ---
                model.visible = false; // Hide template
                // You might need to adjust scale here if model is too big/small
                // model.scale.set(0.1, 0.1, 0.1);
                // --- End Basic processing ---
                preloadedModels[key] = model; // Store the template scene
            }).catch(error => {
                console.error(`Failed to load ${key}:`, error);
                // Decide how to handle errors - skip model, use primitive?
            })
        );
    }

    // Handle Loading Manager events (optional: for progress bar)
    loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
        console.log(`Loading file: ${url} (${itemsLoaded}/${itemsTotal})`);
        // Update loading bar UI here
    };

    loadingManager.onError = (url) => {
        console.error('There was an error loading ' + url);
    };

    await Promise.all(promises);
    console.log("Asset preloading complete.");
    document.getElementById('loading-screen').style.display = 'none'; // Hide loading screen
    document.getElementById('instructions').style.display = 'block'; // Show instructions
}
// --- End Asset Loading ---


// --- Initialization (Deferred) ---
let scene, camera, renderer, playerControls, player, uiManager, levelManager, interactionManager;

function initializeGameComponents() {
    scene = setupScene();
    camera = setupCamera();
    renderer = setupRenderer();
    setupLighting(scene);
    setupResizeHandler(camera, renderer);

    playerControls = new PlayerControls(camera, renderer.domElement);
    scene.add(playerControls.object);

    player = new Player(playerControls);
    uiManager = new UIManager();
    levelManager = new LevelManager(uiManager);
    const { stations, interactables } = buildKitchen(scene); // Build kitchen *after* scene setup

    // --- Pass preloadedModels to InteractionManager ---
    interactionManager = new InteractionManager(camera, scene, player, stations, interactables, levelManager, uiManager, preloadedModels);
    // --- End Pass ---

    // Add UI element references after DOM is ready and components exist
    setupUIEventListeners();

    // Ensure initial label state matches checkbox
    toggleLabels(document.getElementById('toggle-labels').checked);

    console.log("Kitchen Simulator Initialized - Ready to Start Level");
}
// --- End Initialization ---


// --- UI Elements & Listeners (Setup moved to function) ---
let settingsMenu, resumeButton, toggleLabelsCheckbox, levelEndScreen, nextLevelButton, restartLevelButton, instructionsScreen;

function setupUIEventListeners() {
    settingsMenu = document.getElementById('settings-menu');
    resumeButton = document.getElementById('resume-button');
    toggleLabelsCheckbox = document.getElementById('toggle-labels');
    levelEndScreen = document.getElementById('level-end-screen');
    nextLevelButton = document.getElementById('next-level-button');
    restartLevelButton = document.getElementById('restart-level-button');
    instructionsScreen = document.getElementById('instructions');

    resumeButton.addEventListener('click', () => togglePause(false));
    toggleLabelsCheckbox.addEventListener('change', (event) => {
        toggleLabels(event.target.checked);
    });
    nextLevelButton.addEventListener('click', () => {
        const currentLevel = parseInt(levelEndScreen.dataset.levelIndex, 10);
        uiManager.hideLevelEndScreen();
        levelManager.loadLevel(currentLevel + 1);
        playerControls.lock();
    });
    restartLevelButton.addEventListener('click', () => {
        const currentLevel = parseInt(levelEndScreen.dataset.levelIndex, 10);
        if (restartLevelButton.textContent.includes('Play Again')) {
            uiManager.hideLevelEndScreen();
            levelManager.loadLevel(0);
        } else {
            uiManager.hideLevelEndScreen();
            levelManager.loadLevel(currentLevel);
        }
        playerControls.lock();
    });
    instructionsScreen.addEventListener('click', startGame);
}
// --- End UI Elements & Listeners ---


// --- Game State Logic ---
function startGame() {
    if (gameHasStarted || !levelManager) return; // Ensure levelManager exists
    gameHasStarted = true;
    instructionsScreen.style.display = 'none';
    levelManager.loadLevel(0);
    playerControls.lock();
}

function togglePause(forceState = null) {
    if (!levelManager || (!levelManager.isRunning() && forceState !== false)) return;
    // ... (rest of togglePause remains the same) ...
    const newState = forceState !== null ? forceState : !isPaused;
    if (newState === isPaused) return;

    console.log(`Toggling pause. Current: ${isPaused}, New: ${newState}`);
    isPaused = newState;

    if (isPaused) {
        settingsMenu.style.display = 'flex';
        playerControls.unlock();
    } else {
        settingsMenu.style.display = 'none';
        if (levelManager.isRunning()) {
            playerControls.lock();
        }
    }
}
// --- End Game State Logic ---


const clock = new THREE.Clock();
let activeGamepad = null;

// --- Main Loop ---
function animate() {
    requestAnimationFrame(animate);

    // Ensure components are initialized before running loop logic
    if (!renderer || !levelManager) return;

    if (playerControls.consumePauseToggleRequest()) {
        togglePause();
    }

    const delta = clock.getDelta();

    // --- Gamepad Polling ---
    const gamepads = navigator.getGamepads();
    activeGamepad = null;
    for (const gp of gamepads) { if (gp && gp.connected) { activeGamepad = gp; break; } }

    if (activeGamepad) {
        playerControls.handleGamepadInput(activeGamepad, delta); // Pass delta for look sensitivity
        if (!gameHasStarted && playerControls.consumeInteractionRequest()) {
            startGame();
        }
    } else {
        playerControls.handleGamepadInput(null, delta);
    }
    if (uiManager) uiManager.updateGamepadStatus(playerControls.gamepadConnected);
    // --- End Gamepad ---


    if (isPaused || !levelManager.isRunning()) {
        renderer.render(scene, camera);
        return;
    }

    // --- Game Logic ---
    levelManager.update(delta);

    if (playerControls.isLocked) {
        const movementInput = playerControls.getMovementInput();
        player.update(delta, movementInput);

        if (playerControls.consumeInteractionRequest()) {
            interactionManager.handleInteractionRequest();
        }
        if (uiManager) uiManager.updateHolding(player.getHeldItem()?.name);
    } else {
        if (uiManager) uiManager.updateHolding(null);
    }

    renderer.render(scene, camera);
}
// --- End Main Loop ---


// --- Start Execution ---
async function runGame() {
    await preloadAssets(); // Wait for models to load
    initializeGameComponents(); // Setup scene, managers, UI listeners etc.
    animate(); // Start the main loop
}

runGame(); // Initiate the game loading and startup
// --- End Start Execution ---