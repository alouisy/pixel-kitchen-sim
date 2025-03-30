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
// import { LEVEL_DATABASE } from './gameData.js'; // Using JSON now
import { ITEM_TYPES } from './constants.js';

// --- Game States ---
const GameState = { LOADING: 'LOADING', MAIN_MENU: 'MAIN_MENU', SETTINGS: 'SETTINGS', LEVEL_SELECT: 'LEVEL_SELECT', GAME_RUNNING: 'GAME_RUNNING', PAUSED: 'PAUSED', LEVEL_END: 'LEVEL_END' };
let currentGameState = GameState.LOADING;
let preloadedModels = {};
let activeGamepad = null;
const clock = new THREE.Clock();

// --- Core Components ---
let scene, camera, renderer, playerControls, player, interactionManager, levelManager, uiManager, menuManager, saveManager;
let levelDatabase = []; // Store fetched level data here

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
    // Add models for new items: onion, chicken, egg, bread, bacon, dough, sauce, cheese, etc.
    // Add models for new stations: mixer, griddle, oven, blender, toaster, etc.
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
    menuManager = new MenuManager(uiManager);
    // Pass the loaded levelDatabase reference to LevelManager
    levelManager = new LevelManager(uiManager, saveManager, levelDatabase);

    // InteractionManager created, world data set during startGameLevel
    interactionManager = new InteractionManager(camera, scene, player, {}, [], levelManager, uiManager, preloadedModels, null);

    const initialLabelState = uiManager.getLabelToggleState();
    toggleLabels(initialLabelState);
    uiManager.setLanguage('en'); // Set default language

    addEventListeners(); // <<< Call this AFTER all managers are created

    console.log("Kitchen Simulator Initialized.");
}

// --- Event Listeners ---
function addEventListeners() {
    // --- LOG: Confirm listener attachment ---
    console.log("Attaching input event listeners...");
    document.body.addEventListener('mousedown', (event) => {
        // --- LOG: Check if listener fires and conditions ---
        console.log(`Mousedown detected. State: ${currentGameState}, Cooldown: ${inputCooldownTimer.toFixed(2)}`);
        if (isMenuState(currentGameState) && inputCooldownTimer <= 0) {
            console.log("-> Conditions met, calling handleMenuAction for click.");
            handleMenuAction(event);
        } else {
            console.log("-> Conditions NOT met (not menu state or cooldown active).");
        }
    });

    const labelToggle = document.getElementById('toggle-labels-setting');
    if (labelToggle) {
        labelToggle.addEventListener('change', (event) => {
            // console.log("Label toggle changed:", event.target.checked); // Less verbose
            toggleLabels(event.target.checked); // Directly call world toggle function
            if (menuManager?.activeMenuElement === uiManager.settingsScreen) {
                menuManager.setSelectedIndex(menuManager.focusableElements.indexOf(event.target));
            }
        });
    } else { console.error("Label toggle checkbox not found!"); }

    window.addEventListener('gamepadconnected', (event) => { console.log('Gamepad connected:', event.gamepad.id); });
    window.addEventListener('gamepaddisconnected', (event) => { console.log('Gamepad disconnected:', event.gamepad.id); activeGamepad = null; });
    console.log("Event listeners attached.");
}

// --- State Transitions & Actions ---
function changeGameState(newState) {
    console.log(`>>> Changing state from ${currentGameState} to ${newState}`); // <<< LOG State Change
    const previousState = currentGameState;
    if (isMenuState(previousState) && previousState !== newState) menuManager.deactivateMenu();
    if (previousState === GameState.GAME_RUNNING && newState !== GameState.PAUSED) { if (playerControls) playerControls.unlock(); }
    if (previousState === GameState.PAUSED && newState !== GameState.GAME_RUNNING) { if (playerControls) playerControls.unlock(); }
    currentGameState = newState;

    switch (newState) {
        case GameState.MAIN_MENU:
            uiManager.showMainMenu(); menuManager.activateMenu(uiManager.mainMenu);
            if (playerControls?.isLocked) playerControls.unlock(); break;
        case GameState.SETTINGS:
            const isPause = previousState === GameState.PAUSED || previousState === GameState.GAME_RUNNING;
            uiManager.showSettings(isPause); menuManager.activateMenu(uiManager.settingsScreen);
            if (playerControls?.isLocked) playerControls.unlock(); break;
        case GameState.LEVEL_SELECT:
            uiManager.populateLevelSelect(levelDatabase, saveManager);
            uiManager.showLevelSelect(); menuManager.activateMenu(uiManager.levelSelectScreen);
            if (playerControls?.isLocked) playerControls.unlock(); break;
        case GameState.GAME_RUNNING:
            if (previousState === GameState.PAUSED || previousState === GameState.SETTINGS) {
                if (uiManager.settingsScreen.classList.contains('active')) uiManager.settingsScreen.classList.remove('active');
            }
            uiManager.showGameUI(); menuManager.deactivateMenu();
            if (playerControls) playerControls.lock(); break;
        case GameState.PAUSED:
            uiManager.showSettings(true); menuManager.activateMenu(uiManager.settingsScreen);
            if (playerControls) playerControls.unlock(); break;
        case GameState.LEVEL_END:
            menuManager.activateMenu(uiManager.levelEndScreen);
            if (playerControls?.isLocked) playerControls.unlock(); break;
        case GameState.LOADING:
            uiManager.showLoading(); menuManager.deactivateMenu();
            if (playerControls?.isLocked) playerControls.unlock(); break;
    }
}

function isMenuState(state) { return [GameState.MAIN_MENU, GameState.SETTINGS, GameState.LEVEL_SELECT, GameState.PAUSED, GameState.LEVEL_END].includes(state); }

function handleMenuAction(eventOrAction) {
    let action = null, element = null, isGamepadAction = false;
    if (inputCooldownTimer > 0) { console.log("Input cooldown active, ignoring action."); return; }

    if (eventOrAction instanceof Event) {
        const target = eventOrAction.target.closest('[data-action]');
        // --- LOG: Click target ---
        console.log("handleMenuAction (Click): Target =", target);
        if (!target) return;
        action = target.dataset.action;
        element = target;
        if (element.tagName === 'A' && action !== 'link') eventOrAction.preventDefault();
        if (action === 'toggle-labels') return; // Handled by change listener
    } else if (eventOrAction?.action) {
        action = eventOrAction.action;
        element = eventOrAction.element;
        isGamepadAction = true;
        // --- LOG: Gamepad target ---
        console.log("handleMenuAction (Gamepad): Element =", element);
        if (action === 'toggle-labels') { inputCooldownTimer = INPUT_COOLDOWN_DURATION; return; } // Handled by MenuManager triggering change
    } else { return; }

    if (!action || !element) { console.log("handleMenuAction: No action or element found."); return; }

    let actionTaken = true;
    console.log(`--> Processing action: ${action} (Gamepad: ${isGamepadAction})`); // <<< LOG Action Processing

    switch (action) {
        case 'play': changeGameState(GameState.LEVEL_SELECT); break;
        case 'settings': changeGameState(GameState.SETTINGS); break;
        case 'back-to-main': changeGameState(GameState.MAIN_MENU); break;
        case 'start-level':
            const levelIndex = parseInt(element.dataset.levelIndex, 10);
            if (!isNaN(levelIndex) && saveManager.isLevelUnlocked(levelIndex)) startGameLevel(levelIndex);
            else { if (!isNaN(levelIndex)) uiManager.showTemporaryMessage("Level Locked!", 1500); actionTaken = false; }
            break;
        case 'set-language': uiManager.setLanguage(element.dataset.lang); break; // Action taken, no state change
        case 'resume': resumeGame(); break;
        case 'next-level':
            const currentLevel = parseInt(uiManager.levelEndScreen.dataset.levelIndex, 10);
            const nextLevelIndex = currentLevel + 1;
            if (!isNaN(currentLevel) && nextLevelIndex < levelDatabase.length && saveManager.isLevelUnlocked(nextLevelIndex)) startGameLevel(nextLevelIndex);
            else { console.log("Next level not available or locked."); actionTaken = false; }
            break;
        case 'restart-level':
            const levelToRestart = parseInt(uiManager.levelEndScreen.dataset.levelIndex, 10);
            if (!isNaN(levelToRestart) && levelToRestart >= 0) startGameLevel(levelToRestart);
            else startGameLevel(0);
            break;
        case 'link': if (isGamepadAction) window.open(element.href, '_blank'); break; // Action taken
        default: console.warn(`Unhandled menu action: ${action}`); actionTaken = false;
    }

    if (actionTaken) {
        console.log(`Action ${action} processed, setting cooldown.`); // <<< LOG Cooldown Set
        inputCooldownTimer = INPUT_COOLDOWN_DURATION;
    }
}

// --- startGameLevel, resetWorldState, pauseGame, resumeGame, handleLevelEnd, handleGameEnd (Keep as is) ---
function startGameLevel(levelIndex) {
    if (!levelManager || !interactionManager || !scene) { console.error("Core components not initialized!"); changeGameState(GameState.MAIN_MENU); return; }
    if (levelIndex < 0 || levelIndex >= levelDatabase.length) { console.log("Attempted to load invalid level index."); changeGameState(GameState.LEVEL_SELECT); return; }
    resetWorldState(); clearKitchen(scene);
    const levelData = levelDatabase[levelIndex];
    if (!levelData || !levelData.layout) { console.error(`Layout data missing for level index ${levelIndex}!`); changeGameState(GameState.LEVEL_SELECT); return; }
    const { stations, stationInteractables, floorMesh } = buildKitchen(scene, levelData.layout);
    interactionManager.updateWorldData(stations, stationInteractables, floorMesh);
    const loaded = levelManager.loadLevel(levelIndex, levelData);
    if (loaded && levelManager.isRunning()) changeGameState(GameState.GAME_RUNNING);
    else { console.error("LevelManager failed to load or run after world build."); changeGameState(GameState.LEVEL_SELECT); }
}
function resetWorldState() {
    console.log("Resetting dynamic world state...");
    if (player) player.forceDropItem();
    if (interactionManager) interactionManager.clearDynamicItems();
    if (uiManager) { uiManager.clearOrderList(); uiManager.updateHolding(null); }
    console.log("Dynamic world state reset complete.");
}
function pauseGame() { if (currentGameState === GameState.GAME_RUNNING) changeGameState(GameState.PAUSED); }
function resumeGame() {
    if (currentGameState !== GameState.PAUSED && currentGameState !== GameState.SETTINGS) return;
    if (levelManager?.isRunning()) changeGameState(GameState.GAME_RUNNING);
    else changeGameState(GameState.MAIN_MENU);
}
function handleLevelEnd(score, stars, levelIndex) {
    if (saveManager) saveManager.updateLevelCompletion(levelIndex, score, stars);
    const hasNextLevel = (levelIndex + 1) < levelDatabase.length;
    uiManager.showLevelEnd(score, stars, levelIndex, hasNextLevel);
    changeGameState(GameState.LEVEL_END);
}
function handleGameEnd() { uiManager.showGameEnd(); changeGameState(GameState.LEVEL_END); }

// --- Main Loop ---
function animate() {
    requestAnimationFrame(animate);
    if (!renderer || !uiManager || !menuManager || !playerControls) return;
    const delta = clock.getDelta();
    if (inputCooldownTimer > 0) inputCooldownTimer -= delta;

    // --- Input ---
    const gamepads = navigator.getGamepads();
    activeGamepad = null;
    for (const gp of gamepads) { if (gp?.connected) { activeGamepad = gp; break; } }
    if (uiManager) uiManager.updateGamepadStatus(!!activeGamepad);

    if (inputCooldownTimer <= 0) { // Process input only if cooldown is over
        if (activeGamepad) {
            if (isMenuState(currentGameState)) {
                const menuAction = menuManager.handleGamepadNav(activeGamepad, delta);
                if (menuAction) handleMenuAction(menuAction); // Cooldown set inside if action taken
            } else if (currentGameState === GameState.GAME_RUNNING) {
                playerControls.handleGamepadInput(activeGamepad, delta);
                if (playerControls.consumePauseToggleRequest()) { pauseGame(); inputCooldownTimer = INPUT_COOLDOWN_DURATION; renderer.render(scene, camera); return; }
            }
        } else { // No gamepad
            playerControls.handleGamepadInput(null, delta);
            if (isMenuState(currentGameState)) menuManager.prevGamepadButtons = [];
        }
        // Keyboard Pause
        if (currentGameState === GameState.GAME_RUNNING && playerControls.consumePauseToggleRequest()) { pauseGame(); inputCooldownTimer = INPUT_COOLDOWN_DURATION; renderer.render(scene, camera); return; }
    } else { // Cooldown Active
        if (activeGamepad) {
            if (currentGameState === GameState.GAME_RUNNING) { playerControls.handleGamepadInput(activeGamepad, delta); playerControls.consumePauseToggleRequest(); playerControls.consumeInteractionRequest(); }
            else if (isMenuState(currentGameState)) { menuManager.handleGamepadNav(activeGamepad, delta); }
        } else { playerControls.handleGamepadInput(null, delta); }
        playerControls.consumePauseToggleRequest();
    }

    // --- Game Logic ---
    if (currentGameState === GameState.GAME_RUNNING) {
        if (levelManager && interactionManager && player) {
            levelManager.update(delta);
            if (playerControls.isLocked) {
                const movementInput = playerControls.getMovementInput();
                player.update(delta, movementInput);
                if (inputCooldownTimer <= 0 && playerControls.consumeInteractionRequest()) { interactionManager.handleInteractionRequest(); }
                if (uiManager) uiManager.updateHolding(player.getHeldItem()?.name);
            } else { if (uiManager) uiManager.updateHolding(null); }
        } else { console.error("Missing core component during GAME_RUNNING update!"); }
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