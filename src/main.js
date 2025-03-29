// src/main.js
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
// Optional: import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
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

const assetsToLoad = {
    tomato: 'models/tomato.glb',
    potato: 'models/potato.glb',
    chopped_tomato: 'models/chopped_tomato.glb',
    lettuce: 'models/lettuce.glb',
    // Add paths for other models if you have them (bun, patty, plate etc.)
    // 'plate': 'models/plate.glb',
};

async function preloadAssets() {
    const promises = [];
    console.log("Starting asset preloading...");

    for (const key in assetsToLoad) {
        promises.push(
            gltfLoader.loadAsync(assetsToLoad[key]).then(gltf => {
                console.log(`Loaded ${key}`);
                const model = gltf.scene;
                model.visible = false; // Hide template
                // Apply necessary transformations/settings to the template model
                model.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        // Optional: Adjust material properties if needed
                    }
                });
                // Example scale adjustment (uncomment and adjust if needed)
                // if (key === 'tomato') model.scale.set(0.5, 0.5, 0.5);

                preloadedModels[key] = model; // Store the template scene
            }).catch(error => {
                console.error(`Failed to load ${key}:`, error);
            })
        );
    }

    loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
        console.log(`Loading file: ${url} (${itemsLoaded}/${itemsTotal})`);
        // Update loading bar UI here
    };

    loadingManager.onError = (url) => {
        console.error('There was an error loading ' + url);
    };

    await Promise.all(promises);
    console.log("Asset preloading complete.");
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('instructions').style.display = 'block';
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
    scene.add(playerControls.object); // Add camera rig to scene

    player = new Player(playerControls);
    player.setScene(scene); // Give player reference to the scene

    uiManager = new UIManager();
    levelManager = new LevelManager(uiManager);
    // Build kitchen returns stations, interactables list, and floor mesh
    const { stations, interactables, floorMesh } = buildKitchen(scene);

    // Pass preloadedModels and floorMesh to InteractionManager
    interactionManager = new InteractionManager(camera, scene, player, stations, interactables, levelManager, uiManager, preloadedModels, floorMesh);

    setupUIEventListeners();

    // Ensure initial label state matches checkbox
    toggleLabels(document.getElementById('toggle-labels').checked);

    console.log("Kitchen Simulator Initialized - Ready to Start Level");
}
// --- End Initialization ---


// --- UI Elements & Listeners ---
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
        if (!isNaN(currentLevel) && currentLevel >= 0) {
            uiManager.hideLevelEndScreen();
            levelManager.loadLevel(currentLevel + 1); // Load next level
            // No need to lock here, lock happens on resume/start
        }
    });
    restartLevelButton.addEventListener('click', () => {
        const currentLevel = parseInt(levelEndScreen.dataset.levelIndex, 10);
        uiManager.hideLevelEndScreen();
        if (restartLevelButton.textContent.includes('Play Again')) {
            levelManager.loadLevel(0); // Restart from level 1
        } else if (!isNaN(currentLevel) && currentLevel >= 0) {
            levelManager.loadLevel(currentLevel); // Restart current level
        } else {
            levelManager.loadLevel(0); // Fallback: start level 0
        }
        // No need to lock here, lock happens on resume/start
    });
    instructionsScreen.addEventListener('click', startGame); // Use named function
}
// --- End UI Elements & Listeners ---


// --- Game State Logic ---
function startGame() {
    // Ensure components are initialized and game hasn't started
    if (!levelManager || !playerControls || gameHasStarted) return;

    console.log("Starting game...");
    gameHasStarted = true;
    isPaused = false; // Ensure not paused
    instructionsScreen.style.display = 'none';
    settingsMenu.style.display = 'none'; // Ensure settings menu is hidden
    levelManager.loadLevel(0); // Load the first level
    playerControls.lock(); // Lock controls to start playing
}

function togglePause(forceState = null) {
    // Allow pausing only if the game has started and a level is running or paused
    if (!gameHasStarted || (!levelManager.isRunning() && !isPaused && forceState !== false)) return;

    const newState = forceState !== null ? forceState : !isPaused;
    if (newState === isPaused) return; // No change

    console.log(`Toggling pause. Current: ${isPaused}, New: ${newState}`);
    isPaused = newState;

    if (isPaused) {
        settingsMenu.style.display = 'flex';
        playerControls.unlock(); // Unlock mouse when paused
    } else {
        settingsMenu.style.display = 'none';
        // Only lock controls if a level is actually running
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
    if (!renderer || !levelManager || !player || !interactionManager || !playerControls || !uiManager) {
        // console.log("Waiting for components..."); // Debug log
        return;
    }

    // Handle Pause Request (Keyboard or Gamepad)
    if (playerControls.consumePauseToggleRequest()) {
        // Allow pause toggle even from instructions screen if game has started logic is adjusted
        togglePause();
    }

    const delta = clock.getDelta();

    // --- Gamepad Polling ---
    const gamepads = navigator.getGamepads();
    activeGamepad = null;
    for (const gp of gamepads) { if (gp && gp.connected) { activeGamepad = gp; break; } }

    if (activeGamepad) {
        playerControls.handleGamepadInput(activeGamepad, delta);
        // Handle starting game with gamepad from instructions screen
        if (!gameHasStarted && instructionsScreen.style.display !== 'none' && playerControls.consumeInteractionRequest()) {
            startGame();
        }
    } else {
        playerControls.handleGamepadInput(null, delta); // Handle disconnection
    }
    uiManager.updateGamepadStatus(playerControls.gamepadConnected);
    // --- End Gamepad ---


    // If paused, only render the scene and return
    if (isPaused) {
        renderer.render(scene, camera);
        return;
    }

    // --- Game Logic (Runs only if not paused) ---

    // Update level state (timers, orders) only if a level is running
    if (levelManager.isRunning()) {
        levelManager.update(delta);
    }

    // Update player movement and interactions only if controls are locked
    if (playerControls.isLocked) {
        const movementInput = playerControls.getMovementInput();
        player.update(delta, movementInput); // Update player position, held item visuals

        // Handle interaction requests (mouse click or gamepad button)
        if (playerControls.consumeInteractionRequest()) {
            interactionManager.handleInteractionRequest();
        }
        // Update UI holding status based on player state
        uiManager.updateHolding(player.getHeldItem()?.name);
    } else {
        // If controls are not locked (e.g., menu open, instructions visible)
        // Ensure holding UI is cleared
        if (uiManager) uiManager.updateHolding(null);
        // Player update is skipped, no movement or interaction checks needed
    }

    // Render the scene regardless of pause state (unless returned earlier)
    renderer.render(scene, camera);
}
// --- End Main Loop ---


// --- Start Execution ---
async function runGame() {
    try {
        await preloadAssets(); // Wait for models to load
        initializeGameComponents(); // Setup scene, managers, UI listeners etc.
        animate(); // Start the main loop
    } catch (error) {
        console.error("Failed to initialize or run the game:", error);
        // Display error message to the user?
        document.getElementById('loading-screen').innerHTML = `<h2>Error loading game. Please check console.</h2><p>${error.message}</p>`;
        document.getElementById('loading-screen').style.display = 'flex';
        document.getElementById('instructions').style.display = 'none';
    }
}

runGame(); // Initiate the game loading and startup
// --- End Start Execution ---