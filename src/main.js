// src/main.js
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { setupScene, setupCamera, setupRenderer, setupLighting, setupResizeHandler } from './setup.js';
import { PlayerControls } from './controls.js';
import { Player } from './player.js';
import { buildKitchen, toggleLabels, removeInteractable } from './world.js';
import { InteractionManager } from './interaction.js';
import { LevelManager } from './LevelManager.js';
import { UIManager } from './ui.js';
import { MenuManager } from './menuManager.js';
import { SaveManager } from './saveManager.js'; // <<< Import SaveManager
import { LEVEL_DATABASE } from './gameData.js';
import { ITEM_TYPES } from './constants.js';

// --- Game States ---
const GameState = {
    LOADING: 'LOADING',
    MAIN_MENU: 'MAIN_MENU',
    SETTINGS: 'SETTINGS',
    LEVEL_SELECT: 'LEVEL_SELECT',
    GAME_RUNNING: 'GAME_RUNNING',
    PAUSED: 'PAUSED',
    LEVEL_END: 'LEVEL_END'
};

let currentGameState = GameState.LOADING;
let preloadedModels = {};
let activeGamepad = null;
const clock = new THREE.Clock();

// --- Core Components ---
let scene, camera, renderer, playerControls, player, interactionManager, levelManager, uiManager, menuManager, saveManager; // <<< Add saveManager

// --- Input Cooldown ---
let inputCooldownTimer = 0;
const INPUT_COOLDOWN_DURATION = 0.2;


// --- Asset Loading ---
const loadingManager = new THREE.LoadingManager();
const gltfLoader = new GLTFLoader(loadingManager);
const assetsToLoad = {
    tomato: 'models/tomato.glb',
    potato: 'models/potato.glb',
    chopped_tomato: 'models/chopped_tomato.glb',
    lettuce: 'models/lettuce.glb',
};

async function preloadAssets() {
    // Create managers needed early
    saveManager = new SaveManager(); // <<< Create SaveManager
    uiManager = new UIManager(saveManager); // <<< Pass SaveManager to UIManager
    uiManager.showLoading();
    currentGameState = GameState.LOADING;
    const promises = [];
    console.log("Starting asset preloading...");

    for (const key in assetsToLoad) {
        promises.push(
            gltfLoader.loadAsync(assetsToLoad[key]).then(gltf => {
                console.log(`Loaded ${key}`);
                const model = gltf.scene;
                model.visible = false;
                model.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
                preloadedModels[key] = model;
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

    // Ensure managers exist (created in preloadAssets or here)
    if (!saveManager) saveManager = new SaveManager();
    if (!uiManager) uiManager = new UIManager(saveManager); // Pass SaveManager
    menuManager = new MenuManager(uiManager);

    const { stations, interactables, floorMesh } = buildKitchen(scene);

    // Pass SaveManager to LevelManager
    levelManager = new LevelManager(uiManager, saveManager); // <<< Pass SaveManager

    interactionManager = new InteractionManager(camera, scene, player, stations, interactables, levelManager, uiManager, preloadedModels, floorMesh);

    const initialLabelState = uiManager.getLabelToggleState();
    toggleLabels(initialLabelState);
    // Load language preference from save data?
    // uiManager.setLanguage(saveManager.getLanguagePreference() || 'en');
    uiManager.setLanguage('en'); // Keep default for now

    addEventListeners();

    console.log("Kitchen Simulator Initialized.");
}

// --- Event Listeners ---
function addEventListeners() {
    document.body.addEventListener('mousedown', (event) => {
        if (isMenuState(currentGameState) && inputCooldownTimer <= 0) {
            handleMenuAction(event);
        }
    });

    const labelToggle = document.getElementById('toggle-labels-setting');
    if (labelToggle) {
        labelToggle.addEventListener('change', (event) => {
            console.log("Label toggle changed:", event.target.checked);
            toggleLabels(event.target.checked);
            if (menuManager && menuManager.activeMenuElement === uiManager.settingsScreen) {
                menuManager.setSelectedIndex(menuManager.focusableElements.indexOf(event.target));
            }
        });
    } else {
        console.error("Label toggle checkbox not found!");
    }

    window.addEventListener('gamepadconnected', (event) => {
        console.log('Gamepad connected:', event.gamepad.id);
    });
    window.addEventListener('gamepaddisconnected', (event) => {
        console.log('Gamepad disconnected:', event.gamepad.id);
        activeGamepad = null;
    });
}

// --- State Transitions & Actions ---

function changeGameState(newState) {
    // console.log(`Changing state from ${currentGameState} to ${newState}`);
    const previousState = currentGameState;

    if (isMenuState(previousState) && previousState !== newState) {
        menuManager.deactivateMenu();
    }
    if (previousState === GameState.GAME_RUNNING && newState !== GameState.PAUSED) {
        if (playerControls) playerControls.unlock();
    }
    if (previousState === GameState.PAUSED && newState !== GameState.GAME_RUNNING) {
        if (playerControls) playerControls.unlock();
    }

    currentGameState = newState;

    switch (newState) {
        case GameState.MAIN_MENU:
            uiManager.showMainMenu();
            menuManager.activateMenu(uiManager.mainMenu);
            if (playerControls && playerControls.isLocked) playerControls.unlock();
            break;
        case GameState.SETTINGS:
            const isPause = previousState === GameState.PAUSED || previousState === GameState.GAME_RUNNING;
            uiManager.showSettings(isPause);
            menuManager.activateMenu(uiManager.settingsScreen);
            if (playerControls && playerControls.isLocked) playerControls.unlock();
            break;
        case GameState.LEVEL_SELECT:
            // Pass level data AND save manager to populate
            uiManager.populateLevelSelect(LEVEL_DATABASE, saveManager); // <<< Pass saveManager
            uiManager.showLevelSelect();
            menuManager.activateMenu(uiManager.levelSelectScreen);
            if (playerControls && playerControls.isLocked) playerControls.unlock();
            break;
        case GameState.GAME_RUNNING:
            if (previousState === GameState.PAUSED || previousState === GameState.SETTINGS) {
                if (uiManager.settingsScreen.classList.contains('active')) {
                    uiManager.settingsScreen.classList.remove('active');
                }
            }
            uiManager.showGameUI();
            menuManager.deactivateMenu();
            if (playerControls) playerControls.lock();
            break;
        case GameState.PAUSED:
            uiManager.showSettings(true);
            menuManager.activateMenu(uiManager.settingsScreen);
            if (playerControls) playerControls.unlock();
            break;
        case GameState.LEVEL_END:
            menuManager.activateMenu(uiManager.levelEndScreen);
            if (playerControls && playerControls.isLocked) playerControls.unlock();
            break;
        case GameState.LOADING:
            uiManager.showLoading();
            menuManager.deactivateMenu();
            if (playerControls && playerControls.isLocked) playerControls.unlock();
            break;
    }
}

function isMenuState(state) {
    return [
        GameState.MAIN_MENU,
        GameState.SETTINGS,
        GameState.LEVEL_SELECT,
        GameState.PAUSED,
        GameState.LEVEL_END
    ].includes(state);
}

function handleMenuAction(eventOrAction) {
    let action = null;
    let element = null;
    let isGamepadAction = false;

    if (inputCooldownTimer > 0) return;

    if (eventOrAction instanceof Event) {
        const target = eventOrAction.target.closest('[data-action]');
        if (!target) return;
        action = target.dataset.action;
        element = target;
        if (element.tagName === 'A' && action !== 'link') {
            eventOrAction.preventDefault();
        }
        if (action === 'toggle-labels') return;
    } else if (eventOrAction && eventOrAction.action) {
        action = eventOrAction.action;
        element = eventOrAction.element;
        isGamepadAction = true;
        if (action === 'toggle-labels') {
            inputCooldownTimer = INPUT_COOLDOWN_DURATION;
            return;
        }
    }

    if (!action || !element) return;

    let actionTaken = true;
    // console.log(`Handling action: ${action} (Gamepad: ${isGamepadAction})`);

    switch (action) {
        case 'play': changeGameState(GameState.LEVEL_SELECT); break;
        case 'settings': changeGameState(GameState.SETTINGS); break;
        case 'back-to-main': changeGameState(GameState.MAIN_MENU); break;
        case 'start-level':
            const levelIndex = parseInt(element.dataset.levelIndex, 10);
            // Check if level is unlocked before starting
            if (!isNaN(levelIndex) && saveManager.isLevelUnlocked(levelIndex)) {
                startGameLevel(levelIndex);
            } else if (!isNaN(levelIndex)) {
                console.log(`Level ${levelIndex + 1} is locked.`);
                uiManager.showTemporaryMessage("Level Locked!", 1500); // Add translation key if needed
                actionTaken = false; // Don't apply cooldown if level is locked
            } else {
                actionTaken = false;
            }
            break;
        case 'set-language': uiManager.setLanguage(element.dataset.lang); break;
        case 'resume': resumeGame(); break;
        case 'next-level':
            const currentLevel = parseInt(uiManager.levelEndScreen.dataset.levelIndex, 10);
            if (!isNaN(currentLevel)) startGameLevel(currentLevel + 1);
            else actionTaken = false;
            break;
        case 'restart-level':
            const levelToRestart = parseInt(uiManager.levelEndScreen.dataset.levelIndex, 10);
            if (!isNaN(levelToRestart) && levelToRestart >= 0) startGameLevel(levelToRestart);
            else startGameLevel(0);
            break;
        case 'link':
            if (isGamepadAction) window.open(element.href, '_blank');
            break;
        default:
            console.warn(`Unhandled menu action: ${action}`);
            actionTaken = false;
    }

    if (actionTaken) {
        inputCooldownTimer = INPUT_COOLDOWN_DURATION;
    }
}

function startGameLevel(levelIndex) {
    if (!levelManager) {
        console.error("LevelManager not initialized!");
        changeGameState(GameState.MAIN_MENU); return;
    }
    // Reset world state is now handled within LevelManager or needs a separate call
    resetWorldState(); // Call cleanup function here
    const loaded = levelManager.loadLevel(levelIndex);
    if (loaded && levelManager.isRunning()) {
        changeGameState(GameState.GAME_RUNNING);
    } else if (!loaded) {
        console.log("Level loading failed or game ended.");
    } else {
        console.error("LevelManager loaded but is not running.");
        changeGameState(GameState.LEVEL_SELECT);
    }
}

// Separate function for resetting world state
function resetWorldState() {
    console.log("Resetting world state...");
    if (player) player.forceDropItem();

    // Use interactionManager's reference to interactables
    if (interactionManager && interactionManager.interactables) {
        const interactables = interactionManager.interactables;
        for (let i = interactables.length - 1; i >= 0; i--) {
            const item = interactables[i];
            if (item.userData?.type === ITEM_TYPES.ITEM || item.userData?.type === ITEM_TYPES.INGREDIENT) {
                // console.log(`Removing dynamic item: ${item.name}`);
                removeInteractable(item);
            }
        }
    } else { console.warn("Cannot reset interactables list."); }

    if (interactionManager && interactionManager.stations) {
        const stations = interactionManager.stations;
        for (const stationName in stations) {
            const station = stations[stationName];
            if (station.userData?.stationType === 'processor') {
                station.userData.occupiedBy = null;
            } else if (station.userData?.stationType === 'assembly') {
                if (Array.isArray(station.userData.slots)) {
                    // Also remove any children from items in slots (e.g., ingredients on plates)
                    station.userData.slots.forEach(itemInSlot => {
                        if (itemInSlot && itemInSlot.userData?.itemType === 'plate') {
                            // Iterate backwards over children to safely remove
                            for (let j = itemInSlot.children.length - 1; j >= 0; j--) {
                                const child = itemInSlot.children[j];
                                // Assuming only ingredients are added as children
                                if (child.userData?.type === ITEM_TYPES.INGREDIENT) {
                                    itemInSlot.remove(child);
                                    // No need to call removeInteractable, they weren't in the main list
                                }
                            }
                            // Reset plate state
                            itemInSlot.userData.contents = [];
                            itemInSlot.userData.mealName = null;
                        }
                    });
                    // Now clear the slots array itself
                    station.userData.slots = [null, null, null];
                } else {
                    station.userData.slots = [null, null, null];
                }
            }
        }
    } else { console.warn("Cannot reset stations object."); }

    if (uiManager) {
        uiManager.clearOrderList();
        uiManager.updateHolding(null);
    }
    console.log("World state reset complete.");
}


function pauseGame() {
    if (currentGameState !== GameState.GAME_RUNNING) return;
    changeGameState(GameState.PAUSED);
}

function resumeGame() {
    if (currentGameState !== GameState.PAUSED && currentGameState !== GameState.SETTINGS) return;
    if (levelManager && levelManager.isRunning()) {
        changeGameState(GameState.GAME_RUNNING);
    } else {
        changeGameState(GameState.MAIN_MENU);
    }
}

function handleLevelEnd(score, stars, levelIndex) {
    // Save progress BEFORE showing the end screen
    if (saveManager) {
        saveManager.updateLevelCompletion(levelIndex, score, stars);
    }
    // Now show the screen
    const hasNextLevel = (levelIndex + 1) < LEVEL_DATABASE.length;
    uiManager.showLevelEnd(score, stars, levelIndex, hasNextLevel);
    changeGameState(GameState.LEVEL_END);
}

function handleGameEnd() {
    uiManager.showGameEnd();
    changeGameState(GameState.LEVEL_END);
}

// --- Main Loop ---
function animate() {
    requestAnimationFrame(animate);

    if (!renderer || !uiManager || !menuManager || !playerControls) return;

    const delta = clock.getDelta();

    if (inputCooldownTimer > 0) {
        inputCooldownTimer -= delta;
    }

    const gamepads = navigator.getGamepads();
    activeGamepad = null;
    for (const gp of gamepads) { if (gp && gp.connected) { activeGamepad = gp; break; } }
    if (uiManager) uiManager.updateGamepadStatus(!!activeGamepad);

    // Process input only if cooldown is over
    if (inputCooldownTimer <= 0) {
        if (activeGamepad) {
            if (isMenuState(currentGameState)) {
                const menuAction = menuManager.handleGamepadNav(activeGamepad, delta);
                if (menuAction) {
                    handleMenuAction(menuAction);
                }
            }
            else if (currentGameState === GameState.GAME_RUNNING) {
                playerControls.handleGamepadInput(activeGamepad, delta);
                if (playerControls.consumePauseToggleRequest()) {
                    pauseGame();
                    inputCooldownTimer = INPUT_COOLDOWN_DURATION;
                    renderer.render(scene, camera); return;
                }
            }
        } else {
            playerControls.handleGamepadInput(null, delta);
            if (isMenuState(currentGameState)) menuManager.prevGamepadButtons = [];
        }

        if (currentGameState === GameState.GAME_RUNNING && playerControls.consumePauseToggleRequest()) {
            pauseGame();
            inputCooldownTimer = INPUT_COOLDOWN_DURATION;
            renderer.render(scene, camera); return;
        }
    } else { // Cooldown active
        if (activeGamepad) {
            if (currentGameState === GameState.GAME_RUNNING) {
                playerControls.handleGamepadInput(activeGamepad, delta);
                playerControls.consumePauseToggleRequest();
                playerControls.consumeInteractionRequest();
            } else if (isMenuState(currentGameState)) {
                menuManager.handleGamepadNav(activeGamepad, delta);
            }
        } else {
            playerControls.handleGamepadInput(null, delta);
        }
        playerControls.consumePauseToggleRequest();
    }


    // --- Game Logic ---
    if (currentGameState === GameState.GAME_RUNNING) {
        if (levelManager && interactionManager && player) {
            levelManager.update(delta);

            if (playerControls.isLocked) {
                const movementInput = playerControls.getMovementInput();
                player.update(delta, movementInput);

                if (inputCooldownTimer <= 0 && playerControls.consumeInteractionRequest()) {
                    interactionManager.handleInteractionRequest();
                }
                if (uiManager) uiManager.updateHolding(player.getHeldItem()?.name);
            } else {
                if (uiManager) uiManager.updateHolding(null);
            }
        } else {
            console.error("Missing core component during GAME_RUNNING update!");
        }
    }

    // --- Rendering ---
    if (scene && camera) {
        renderer.render(scene, camera);
    }
}

// --- Start Execution ---
async function runGame() {
    try {
        // Create SaveManager and UIManager first
        saveManager = new SaveManager();
        uiManager = new UIManager(saveManager); // Pass save manager
        await preloadAssets();
        initializeGameComponents(); // Creates other managers

        if (levelManager) {
            levelManager.onLevelEnd = handleLevelEnd;
            levelManager.onGameEnd = handleGameEnd;
        } else {
            console.error("LevelManager was not created during initialization!");
            throw new Error("LevelManager initialization failed.");
        }

        changeGameState(GameState.MAIN_MENU);
        animate();
    } catch (error) {
        console.error("Failed to initialize or run the game:", error);
        if (uiManager && uiManager.loadingScreen) {
            uiManager.loadingScreen.innerHTML = `<h2>Error loading game. Please check console.</h2><p>${error.message}</p>`;
            uiManager.showLoading();
        } else {
            const loadingScreen = document.getElementById('loading-screen');
            if (loadingScreen) {
                loadingScreen.innerHTML = `<h2>Error loading game. Please check console.</h2><p>${error.message}</p>`;
                loadingScreen.style.display = 'flex';
            }
        }
    }
}

runGame();