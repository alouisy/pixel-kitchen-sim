// src/main.js
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { setupScene, setupCamera, setupRenderer, setupLighting, setupResizeHandler } from './setup.js';
import { PlayerControls } from './controls.js';
import { Player } from './player.js';
import { buildKitchen, clearKitchen, toggleLabels } from './world.js';
import { InteractionManager } from './interaction.js';
import { LevelManager } from './LevelManager.js';
import { UIManager } from './ui.js';
import { MenuManager } from './menuManager.js';
import { SaveManager } from './saveManager.js';
import { RECIPES } from './gameData.js'; // Import RECIPES for instructions
import { ITEM_TYPES } from './constants.js';

// --- Game States ---
// Added VIEWING_INSTRUCTIONS
const GameState = { LOADING: 'LOADING', MAIN_MENU: 'MAIN_MENU', SETTINGS: 'SETTINGS', LEVEL_SELECT: 'LEVEL_SELECT', LEVEL_INSTRUCTIONS: 'LEVEL_INSTRUCTIONS', GAME_RUNNING: 'GAME_RUNNING', PAUSED: 'PAUSED', VIEWING_INSTRUCTIONS: 'VIEWING_INSTRUCTIONS', LEVEL_END: 'LEVEL_END' };
let currentGameState = GameState.LOADING;
let preloadedModels = {};
let activeGamepad = null;
const clock = new THREE.Clock();

// --- Core Components ---
let scene, camera, renderer, playerControls, player, interactionManager, levelManager, uiManager, menuManager, saveManager;
let levelDatabase = []; // Store fetched level data here

// --- State Variables ---
let pendingLevelIndex = -1;
let pendingLevelData = null;
let currentLevelData = null; // Store the data of the currently running level

// --- Input Cooldown ---
let inputCooldownTimer = 0;
const INPUT_COOLDOWN_DURATION = 0.2; // Cooldown duration in seconds

// --- Asset Loading ---
const loadingManager = new THREE.LoadingManager();
const gltfLoader = new GLTFLoader(loadingManager);
const assetsToLoad = { // Add paths to your 3D models here
    tomato: 'models/tomato.glb',
    potato: 'models/potato.glb',
    chopped_tomato: 'models/chopped_tomato.glb',
    lettuce: 'models/lettuce.glb',
    banana: 'models/banana.glb',
    strawberry: 'models/strawberry.glb',
    milk: 'models/milk.glb',
    yogurt: 'models/yogurt.glb',
    cup: 'models/cup.glb',
    egg: 'models/egg.glb',
    pancake_mix: 'models/pancake_mix.glb',
    syrup: 'models/syrup.glb',
    bowl: 'models/bowl.glb',
    granola: 'models/granola.glb',
    // Add others as needed
};

async function preloadAssets() {
    // Create managers needed early (SaveManager, UIManager)
    if (!saveManager) saveManager = new SaveManager();
    if (!uiManager) uiManager = new UIManager(saveManager);
    uiManager.showLoading();
    currentGameState = GameState.LOADING;
    const promises = [];
    console.log("Starting asset preloading...");

    for (const key in assetsToLoad) {
        promises.push(
            gltfLoader.loadAsync(assetsToLoad[key]).then(gltf => {
                console.log(`Loaded ${key}`);
                const model = gltf.scene;
                model.visible = false; // Hide template model
                model.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
                preloadedModels[key] = model; // Store for use in createItem
            }).catch(error => {
                console.error(`Failed to load ${key}:`, error);
            })
        );
    }

    loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => { };
    loadingManager.onError = (url) => console.error('There was an error loading ' + url);

    await Promise.all(promises);
    console.log("Asset preloading complete.");
}

// --- Function to load level data from JSON ---
async function loadLevelData() {
    try {
        console.log("Fetching level data from levels.json...");
        const response = await fetch('./levels.json'); // Assumes levels.json is in the root
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        levelDatabase = await response.json(); // Parse JSON into the array
        console.log(`Level data loaded successfully (${levelDatabase.length} levels).`);
        if (!Array.isArray(levelDatabase) || levelDatabase.length === 0) {
            throw new Error("Loaded level data is not a valid non-empty array.");
        }
    } catch (error) {
        console.error("Failed to load level data:", error);
        levelDatabase = []; // Ensure it's an empty array on error
        // Display error in UI
        if (uiManager && uiManager.loadingScreen) {
            uiManager.loadingScreen.innerHTML = `<h2>Error loading level data! Cannot start game.</h2><p>${error.message}</p>`;
        }
    }
}


// --- Initialization ---
function initializeGameComponents() {
    console.log("Initializing game components...");
    scene = setupScene();
    camera = setupCamera();
    renderer = setupRenderer();
    setupLighting(scene);
    setupResizeHandler(camera, renderer);

    playerControls = new PlayerControls(camera, renderer.domElement);
    scene.add(playerControls.object);

    player = new Player(playerControls);
    player.setScene(scene);

    // Ensure managers created during preload exist
    if (!saveManager) saveManager = new SaveManager();
    if (!uiManager) uiManager = new UIManager(saveManager);
    // Pass UIManager to MenuManager
    menuManager = new MenuManager(uiManager);
    // Pass the loaded levelDatabase reference to LevelManager
    levelManager = new LevelManager(uiManager, saveManager, levelDatabase);

    // InteractionManager created, world data set during startGameLevel
    interactionManager = new InteractionManager(camera, scene, player, {}, [], levelManager, uiManager, preloadedModels, null);

    const initialLabelState = uiManager.getLabelToggleState();
    toggleLabels(initialLabelState);
    // Set default language (could load from saveManager later)
    const savedLang = 'en'; // Replace with saveManager.getSetting('language') || 'en';
    uiManager.setLanguage(savedLang);


    addEventListeners(); // <<< Call this AFTER all managers are created

    console.log("Kitchen Simulator Initialized.");
}

// --- Event Listeners ---
function addEventListeners() {
    console.log("Attaching input event listeners...");
    document.body.addEventListener('mousedown', (event) => {
        if (isMenuState(currentGameState) && inputCooldownTimer <= 0) {
            handleMenuAction(event);
        }
    });

    const labelToggle = document.getElementById('toggle-labels-setting');
    if (labelToggle) {
        labelToggle.addEventListener('change', (event) => {
            toggleLabels(event.target.checked);
            if (menuManager?.activeMenuElement === uiManager.settingsScreen) {
                menuManager.setSelectedIndex(menuManager.focusableElements.indexOf(event.target));
            }
            // saveManager.saveSetting('showLabels', event.target.checked); // Optional: Save setting
        });
        // Load saved label state
        // labelToggle.checked = saveManager.getSetting('showLabels') ?? true;
        // toggleLabels(labelToggle.checked);
    } else { console.error("Label toggle checkbox not found!"); }

    window.addEventListener('gamepadconnected', (event) => { console.log('Gamepad connected:', event.gamepad.id); });
    window.addEventListener('gamepaddisconnected', (event) => { console.log('Gamepad disconnected:', event.gamepad.id); activeGamepad = null; });
    console.log("Event listeners attached.");
}

// --- State Transitions & Actions ---
function changeGameState(newState) {
    console.log(`>>> Changing state from ${currentGameState} to ${newState}`);
    const previousState = currentGameState;

    // Deactivate menu if leaving a menu state
    if (isMenuState(previousState) && !isMenuState(newState)) {
        menuManager.deactivateMenu();
    }

    // Unlock controls if leaving a game-active state (unless pausing)
    if ((previousState === GameState.GAME_RUNNING || previousState === GameState.VIEWING_INSTRUCTIONS) && newState !== GameState.PAUSED && newState !== GameState.VIEWING_INSTRUCTIONS) {
        if (playerControls) playerControls.unlock();
    }
    // Unlock controls if leaving pause (unless going back to game)
    if (previousState === GameState.PAUSED && newState !== GameState.GAME_RUNNING && newState !== GameState.VIEWING_INSTRUCTIONS) {
        if (playerControls) playerControls.unlock();
    }

    // Pause LevelManager timer if entering a non-running state from running
    if (previousState === GameState.GAME_RUNNING && newState !== GameState.GAME_RUNNING && levelManager) {
        // levelManager.pauseTimer(); // Assuming LevelManager has pause/resume timer methods
    }
    // Resume LevelManager timer if returning to running state
    if (newState === GameState.GAME_RUNNING && previousState !== GameState.GAME_RUNNING && levelManager) {
        // levelManager.resumeTimer();
    }


    currentGameState = newState;

    // Handle entering the new state
    switch (newState) {
        case GameState.MAIN_MENU:
            uiManager.showMainMenu(); menuManager.activateMenu(uiManager.mainMenu);
            break;
        case GameState.SETTINGS:
            const isPause = previousState === GameState.PAUSED || previousState === GameState.GAME_RUNNING || previousState === GameState.VIEWING_INSTRUCTIONS;
            uiManager.showSettings(isPause); menuManager.activateMenu(uiManager.settingsScreen);
            break;
        case GameState.LEVEL_SELECT:
            uiManager.populateLevelSelect(levelDatabase, saveManager);
            uiManager.showLevelSelect(); menuManager.activateMenu(uiManager.levelSelectScreen);
            break;
        case GameState.LEVEL_INSTRUCTIONS:
            // Assumes uiManager.showLevelInstructions was called before this state change
            menuManager.activateMenu(uiManager.levelInstructionsScreen);
            break;
        case GameState.VIEWING_INSTRUCTIONS: // New state handling
            if (currentLevelData) {
                uiManager.showLevelInstructions(currentLevelData, true); // Show instructions mid-game
                // No menu activation needed, just the overlay
            } else {
                console.error("Cannot view instructions, currentLevelData is missing.");
                changeGameState(GameState.GAME_RUNNING); // Revert if no data
            }
            break;
        case GameState.GAME_RUNNING:
            // Hide overlays if coming from pause/settings/instructions
            if (uiManager.settingsScreen.classList.contains('active')) uiManager.settingsScreen.classList.remove('active');
            if (uiManager.levelInstructionsScreen.classList.contains('active')) uiManager.levelInstructionsScreen.classList.remove('active');
            if (uiManager.levelInstructionsScreen.classList.contains('active')) uiManager.levelInstructionsScreen.classList.remove('active'); // Hide instructions overlay too

            uiManager.showGameUI();
            if (playerControls) playerControls.lock();
            break;
        case GameState.PAUSED:
            uiManager.showSettings(true); menuManager.activateMenu(uiManager.settingsScreen);
            break;
        case GameState.LEVEL_END:
            currentLevelData = null; // Clear current level data on end
            menuManager.activateMenu(uiManager.levelEndScreen);
            break;
        case GameState.LOADING:
            uiManager.showLoading(); menuManager.deactivateMenu();
            break;
    }
}

// Updated to include VIEWING_INSTRUCTIONS
function isMenuState(state) { return [GameState.MAIN_MENU, GameState.SETTINGS, GameState.LEVEL_SELECT, GameState.LEVEL_INSTRUCTIONS, GameState.PAUSED, GameState.LEVEL_END].includes(state); }

function handleMenuAction(eventOrAction) {
    let action = null, element = null, isGamepadAction = false;
    if (inputCooldownTimer > 0) { console.log("Input cooldown active, ignoring action."); return; }

    if (eventOrAction instanceof Event) {
        const target = eventOrAction.target.closest('[data-action]');
        if (!target) return;
        action = target.dataset.action;
        element = target;
        if (element.tagName === 'A' && action !== 'link') eventOrAction.preventDefault();
        if (action === 'toggle-labels') return;
    } else if (eventOrAction?.action) {
        action = eventOrAction.action;
        element = eventOrAction.element;
        isGamepadAction = true;
        if (action === 'toggle-labels') { inputCooldownTimer = INPUT_COOLDOWN_DURATION; return; }
    } else { return; }

    if (!action || !element) { console.log("handleMenuAction: No action or element found."); return; }

    let actionTaken = true;
    console.log(`--> Processing action: ${action} (Gamepad: ${isGamepadAction})`);

    switch (action) {
        case 'play': changeGameState(GameState.LEVEL_SELECT); break;
        case 'settings': changeGameState(GameState.SETTINGS); break;
        case 'back-to-main': changeGameState(GameState.MAIN_MENU); break;
        case 'start-level': // Action from Level Select screen
            const levelIndex = parseInt(element.dataset.levelIndex, 10);
            if (!isNaN(levelIndex) && saveManager.isLevelUnlocked(levelIndex)) {
                prepareStartLevel(levelIndex); // Go to instructions first
            } else {
                if (!isNaN(levelIndex)) uiManager.showTemporaryMessage("Level Locked!", 1500);
                actionTaken = false;
            }
            break;
        case 'start-level-confirm': // Action from Instructions screen (pre-game)
            if (currentGameState === GameState.LEVEL_INSTRUCTIONS) { // Only works in this state
                confirmStartLevel();
            } else {
                actionTaken = false; // Ignore if not in the right state
            }
            break;
        case 'set-language':
            const lang = element.dataset.lang;
            uiManager.setLanguage(lang);
            // saveManager.saveSetting('language', lang); // Optional: Save setting
            break;
        case 'resume': resumeGame(); break;
        case 'next-level':
            const currentLevelIdx = parseInt(uiManager.levelEndScreen.dataset.levelIndex, 10);
            const nextLevelIndex = currentLevelIdx + 1;
            if (!isNaN(currentLevelIdx) && nextLevelIndex < levelDatabase.length && saveManager.isLevelUnlocked(nextLevelIndex)) {
                prepareStartLevel(nextLevelIndex); // Go to instructions
            } else {
                console.log("Next level not available or locked.");
                actionTaken = false;
            }
            break;
        case 'restart-level':
            const levelToRestart = parseInt(uiManager.levelEndScreen.dataset.levelIndex, 10);
            if (!isNaN(levelToRestart) && levelToRestart >= 0) {
                prepareStartLevel(levelToRestart); // Go to instructions
            } else {
                prepareStartLevel(0); // Default to first level if index invalid
            }
            break;
        case 'link': if (isGamepadAction) window.open(element.href, '_blank'); break; // Action taken
        default: console.warn(`Unhandled menu action: ${action}`); actionTaken = false;
    }

    if (actionTaken) {
        inputCooldownTimer = INPUT_COOLDOWN_DURATION;
    }
}

// --- Modified Level Start Flow ---

// Step 1: Prepare level, show instructions
function prepareStartLevel(levelIndex) {
    if (!levelManager || !interactionManager || !scene || !uiManager) { console.error("Core components not initialized!"); changeGameState(GameState.MAIN_MENU); return; }
    if (levelIndex < 0 || levelIndex >= levelDatabase.length) { console.log("Attempted to load invalid level index."); changeGameState(GameState.LEVEL_SELECT); return; }

    resetWorldState();
    clearKitchen(scene);

    const levelData = levelDatabase[levelIndex];
    if (!levelData || !levelData.layout) { console.error(`Layout data missing for level index ${levelIndex}!`); changeGameState(GameState.LEVEL_SELECT); return; }

    const { stations, stationInteractables, floorMesh } = buildKitchen(scene, levelData.layout);
    interactionManager.updateWorldData(stations, stationInteractables, floorMesh);

    // Store data needed after instructions
    pendingLevelIndex = levelIndex;
    pendingLevelData = levelData;
    currentLevelData = null; // Clear current level data until confirmed

    // Show instructions screen (pre-game version)
    uiManager.showLevelInstructions(levelData, false);
    changeGameState(GameState.LEVEL_INSTRUCTIONS);
}

// Step 2: Confirm start from instructions, load LevelManager, start game
function confirmStartLevel() {
    if (pendingLevelIndex < 0 || !pendingLevelData || !levelManager) {
        console.error("Cannot confirm start level: Missing pending level data or LevelManager.");
        changeGameState(GameState.LEVEL_SELECT); // Go back if data is lost
        return;
    }

    // Store current level data for in-game instruction access
    currentLevelData = pendingLevelData;

    const loaded = levelManager.loadLevel(pendingLevelIndex, pendingLevelData);

    // Clear pending data
    pendingLevelIndex = -1;
    pendingLevelData = null;

    if (loaded && levelManager.isRunning()) {
        changeGameState(GameState.GAME_RUNNING);
    } else {
        console.error("LevelManager failed to load or run after instructions.");
        currentLevelData = null; // Clear if failed
        changeGameState(GameState.LEVEL_SELECT);
    }
}


// --- resetWorldState, pauseGame, resumeGame, handleLevelEnd, handleGameEnd (Keep as is, but check resetWorldState) ---
function resetWorldState() {
    console.log("Resetting dynamic world state...");
    if (player) player.forceDropItem();
    if (interactionManager) {
        // Ensure highlight is removed before clearing items
        if (interactionManager.currentlyHighlighted) {
            interactionManager.revertHighlight(interactionManager.currentlyHighlighted);
            interactionManager.currentlyHighlighted = null;
        }
        interactionManager.clearDynamicItems();
    }
    if (uiManager) { uiManager.clearOrderList(); uiManager.updateHolding(null); }
    // Reset pending level data if reset happens unexpectedly
    pendingLevelIndex = -1;
    pendingLevelData = null;
    // Don't clear currentLevelData here, only on level end or failed start
    console.log("Dynamic world state reset complete.");
}
function pauseGame() { if (currentGameState === GameState.GAME_RUNNING) changeGameState(GameState.PAUSED); }
function resumeGame() {
    // Resume should go back to GAME_RUNNING, not MAIN_MENU if level was running
    if (currentGameState === GameState.PAUSED || currentGameState === GameState.SETTINGS || currentGameState === GameState.VIEWING_INSTRUCTIONS) {
        if (levelManager?.isRunning()) {
            changeGameState(GameState.GAME_RUNNING);
        } else {
            // If somehow paused but level not running, go back to menu
            changeGameState(GameState.MAIN_MENU);
        }
    }
}
function handleLevelEnd(score, stars, levelIndex) {
    currentLevelData = null; // Clear current level data
    if (saveManager) saveManager.updateLevelCompletion(levelIndex, score, stars);
    const hasNextLevel = (levelIndex + 1) < levelDatabase.length;
    uiManager.showLevelEnd(score, stars, levelIndex, hasNextLevel);
    changeGameState(GameState.LEVEL_END);
}
function handleGameEnd() {
    currentLevelData = null; // Clear current level data
    uiManager.showGameEnd();
    changeGameState(GameState.LEVEL_END);
}

// --- Main Loop ---
function animate() {
    requestAnimationFrame(animate);
    if (!renderer || !uiManager || !menuManager || !playerControls || !player || !interactionManager) return; // Added interactionManager check
    const delta = clock.getDelta();
    if (inputCooldownTimer > 0) inputCooldownTimer -= delta;

    // --- Input ---
    const gamepads = navigator.getGamepads();
    activeGamepad = null;
    for (const gp of gamepads) { if (gp?.connected) { activeGamepad = gp; break; } }
    if (uiManager) uiManager.updateGamepadStatus(!!activeGamepad);

    // Process button presses regardless of cooldown for state changes
    let pausePressed = false;
    let instructionPressed = false;
    if (activeGamepad) {
        playerControls.handleGamepadInput(activeGamepad, delta); // Handle movement/look always
        pausePressed = playerControls.consumePauseToggleRequest();
        instructionPressed = playerControls.consumeInstructionToggleRequest();
    } else {
        playerControls.handleGamepadInput(null, delta); // Clear gamepad states if disconnected
        pausePressed = playerControls.consumePauseToggleRequest(); // Check keyboard
        instructionPressed = playerControls.consumeInstructionToggleRequest(); // Check keyboard
    }

    // --- State-Based Input Handling ---
    if (currentGameState === GameState.GAME_RUNNING) {
        if (pausePressed) {
            pauseGame();
            inputCooldownTimer = INPUT_COOLDOWN_DURATION;
            renderer.render(scene, camera); return;
        }
        if (instructionPressed) {
            changeGameState(GameState.VIEWING_INSTRUCTIONS);
            inputCooldownTimer = INPUT_COOLDOWN_DURATION;
            renderer.render(scene, camera); return;
        }
        // Interaction check happens later in GAME_RUNNING logic
    }
    else if (currentGameState === GameState.PAUSED) {
        if (pausePressed) {
            resumeGame();
            inputCooldownTimer = INPUT_COOLDOWN_DURATION;
            renderer.render(scene, camera); return;
        }
        if (inputCooldownTimer <= 0 && isMenuState(currentGameState)) {
            if (activeGamepad) {
                const menuAction = menuManager.handleGamepadNav(activeGamepad, delta);
                if (menuAction) handleMenuAction(menuAction);
            }
        }
    }
    else if (currentGameState === GameState.VIEWING_INSTRUCTIONS) {
        if (instructionPressed || pausePressed) {
            resumeGame();
            inputCooldownTimer = INPUT_COOLDOWN_DURATION;
            renderer.render(scene, camera); return;
        }
    }
    else if (isMenuState(currentGameState)) {
        if (inputCooldownTimer <= 0) {
            if (activeGamepad) {
                const menuAction = menuManager.handleGamepadNav(activeGamepad, delta);
                if (menuAction) handleMenuAction(menuAction);
            }
        }
    }


    // --- Game Logic ---
    if (currentGameState === GameState.GAME_RUNNING) {
        if (levelManager && interactionManager && player) {
            levelManager.update(delta); // Update timers, orders etc.
            if (playerControls.isLocked) {
                const movementInput = playerControls.getMovementInput();
                player.update(delta, movementInput); // Update player position/held item visuals

                // *** NEW: Update Aim Highlight ***
                interactionManager.updateAimHighlight();

                // Process interaction request only if cooldown is over
                if (inputCooldownTimer <= 0 && playerControls.consumeInteractionRequest()) {
                    interactionManager.handleInteractionRequest();
                    // Optional: Add a small cooldown after interaction?
                    // inputCooldownTimer = 0.1;
                }
                // Update HUD holding display using the new player method
                if (uiManager) uiManager.updateHolding(player.getHeldItemName());

            } else {
                // If controls somehow get unlocked during GAME_RUNNING, maybe pause?
                if (uiManager) uiManager.updateHolding(null);
                // Ensure highlight is removed if controls unlock unexpectedly
                if (interactionManager.currentlyHighlighted) {
                    interactionManager.revertHighlight(interactionManager.currentlyHighlighted);
                    interactionManager.currentlyHighlighted = null;
                }
            }
        } else { console.error("Missing core component during GAME_RUNNING update!"); }
    } else if (currentGameState === GameState.PAUSED || currentGameState === GameState.VIEWING_INSTRUCTIONS) {
        // Game logic is paused, but keep updating held item position if player moved camera before unlock
        if (player) player._updateHeldItemPosition();
        // Ensure highlight is removed when paused or viewing instructions
        if (interactionManager.currentlyHighlighted) {
            interactionManager.revertHighlight(interactionManager.currentlyHighlighted);
            interactionManager.currentlyHighlighted = null;
        }
    }

    // --- Rendering ---
    if (scene && camera) renderer.render(scene, camera);
}

// --- Start Execution ---
async function runGame() {
    try {
        saveManager = new SaveManager();
        uiManager = new UIManager(saveManager);
        await preloadAssets();
        await loadLevelData();
        if (levelDatabase.length === 0) throw new Error("Failed to load critical level data.");
        initializeGameComponents();
        if (levelManager) {
            levelManager.onLevelEnd = handleLevelEnd;
            levelManager.onGameEnd = handleGameEnd;
        } else { throw new Error("LevelManager initialization failed."); }
        changeGameState(GameState.MAIN_MENU);
        animate();
    } catch (error) {
        console.error("Failed to initialize or run the game:", error);
        if (uiManager?.loadingScreen) {
            uiManager.loadingScreen.innerHTML = `<h2>Error loading game. Check console.</h2><p>${error.message}</p>`;
            uiManager.showLoading();
        } else { /* Fallback error display */ }
    }
}

runGame();