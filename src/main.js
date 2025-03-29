// src/main.js
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { setupScene, setupCamera, setupRenderer, setupLighting, setupResizeHandler } from './setup.js';
import { PlayerControls } from './controls.js';
import { Player } from './player.js';
import { buildKitchen, toggleLabels } from './world.js';
import { InteractionManager } from './interaction.js';
import { LevelManager } from './LevelManager.js';
import { UIManager } from './ui.js';
import { MenuManager } from './menuManager.js'; // Import MenuManager
import { LEVEL_DATABASE } from './gameData.js'; // Import level data

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
let scene, camera, renderer, playerControls, player, interactionManager, levelManager, uiManager, menuManager;

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
    if (!uiManager) uiManager = new UIManager();
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

    // PlayerControls is created HERE
    playerControls = new PlayerControls(camera, renderer.domElement);
    scene.add(playerControls.object);

    player = new Player(playerControls);
    player.setScene(scene);

    if (!uiManager) uiManager = new UIManager();
    menuManager = new MenuManager(uiManager);
    levelManager = new LevelManager(uiManager);

    const { stations, interactables, floorMesh } = buildKitchen(scene);
    interactionManager = new InteractionManager(camera, scene, player, stations, interactables, levelManager, uiManager, preloadedModels, floorMesh);

    const initialLabelState = uiManager.getLabelToggleState();
    toggleLabels(initialLabelState);
    uiManager.setLanguage('en');

    addEventListeners();

    console.log("Kitchen Simulator Initialized.");
}

// --- Event Listeners ---
function addEventListeners() {
    document.body.addEventListener('click', handleMenuAction);

    const labelToggle = document.getElementById('toggle-labels-setting');
    if (labelToggle) {
        labelToggle.addEventListener('change', (event) => {
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
    console.log(`Changing state from ${currentGameState} to ${newState}`);
    const previousState = currentGameState;

    // --- Handle Exiting Old State ---
    if (isMenuState(previousState) && previousState !== newState) {
        menuManager.deactivateMenu();
    }
    // Unlock controls when leaving game running (unless pausing)
    if (previousState === GameState.GAME_RUNNING && newState !== GameState.PAUSED) {
        if (playerControls) playerControls.unlock();
    }
    // Unlock controls when leaving paused state (unless going back to running)
    if (previousState === GameState.PAUSED && newState !== GameState.GAME_RUNNING) {
        if (playerControls) playerControls.unlock();
    }


    // --- Set New State ---
    currentGameState = newState;


    // --- Handle Entering New State ---
    switch (newState) {
        case GameState.MAIN_MENU:
            uiManager.showMainMenu();
            menuManager.activateMenu(uiManager.mainMenu);
            // Ensure unlocked
            if (playerControls && playerControls.isLocked) playerControls.unlock();
            break;
        case GameState.SETTINGS:
            const isPause = previousState === GameState.PAUSED || previousState === GameState.GAME_RUNNING;
            uiManager.showSettings(isPause);
            menuManager.activateMenu(uiManager.settingsScreen);
            // Ensure unlocked
            if (playerControls && playerControls.isLocked) playerControls.unlock();
            break;
        case GameState.LEVEL_SELECT:
            uiManager.populateLevelSelect(LEVEL_DATABASE);
            uiManager.showLevelSelect();
            menuManager.activateMenu(uiManager.levelSelectScreen);
            // Ensure unlocked
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
            // Lock controls when entering game running state
            if (playerControls) playerControls.lock();
            break;
        case GameState.PAUSED:
            uiManager.showSettings(true); // Show settings as pause menu
            menuManager.activateMenu(uiManager.settingsScreen);
            // Unlock controls when pausing
            if (playerControls) playerControls.unlock();
            break;
        case GameState.LEVEL_END:
            menuManager.activateMenu(uiManager.levelEndScreen);
            // Ensure unlocked
            if (playerControls && playerControls.isLocked) playerControls.unlock();
            break;
        case GameState.LOADING:
            uiManager.showLoading();
            menuManager.deactivateMenu();
            // Ensure unlocked
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

    if (eventOrAction instanceof Event) {
        const target = eventOrAction.target.closest('[data-action]');
        if (!target) return;
        action = target.dataset.action;
        element = target;
        if (element.tagName === 'A' && action !== 'link') {
            eventOrAction.preventDefault();
        }
    } else if (eventOrAction && eventOrAction.action) {
        action = eventOrAction.action;
        element = eventOrAction.element;
    }

    if (!action || !element) return;

    console.log(`Handling action: ${action}`);

    switch (action) {
        case 'play':
            changeGameState(GameState.LEVEL_SELECT);
            break;
        case 'settings':
            changeGameState(GameState.SETTINGS);
            break;
        case 'back-to-main':
            changeGameState(GameState.MAIN_MENU);
            break;
        case 'start-level':
            const levelIndex = parseInt(element.dataset.levelIndex, 10);
            if (!isNaN(levelIndex)) {
                startGameLevel(levelIndex);
            }
            break;
        case 'set-language':
            const lang = element.dataset.lang;
            uiManager.setLanguage(lang);
            menuManager.activateMenu(uiManager.settingsScreen);
            break;
        case 'toggle-labels':
            menuManager.setSelectedIndex(menuManager.focusableElements.indexOf(element));
            break;
        case 'resume':
            resumeGame();
            break;
        case 'next-level':
            const currentLevel = parseInt(uiManager.levelEndScreen.dataset.levelIndex, 10);
            if (!isNaN(currentLevel)) {
                startGameLevel(currentLevel + 1);
            }
            break;
        case 'restart-level':
            const levelToRestart = parseInt(uiManager.levelEndScreen.dataset.levelIndex, 10);
            if (!isNaN(levelToRestart) && levelToRestart >= 0) {
                startGameLevel(levelToRestart);
            } else {
                startGameLevel(0);
            }
            break;
        case 'link':
            break;
        default:
            console.warn(`Unhandled menu action: ${action}`);
    }
}

function startGameLevel(levelIndex) {
    console.log(`Starting Level ${levelIndex}`);
    if (!levelManager) {
        console.error("LevelManager not initialized before starting level!");
        changeGameState(GameState.MAIN_MENU);
        return;
    }
    const loaded = levelManager.loadLevel(levelIndex);
    if (loaded && levelManager.isRunning()) {
        changeGameState(GameState.GAME_RUNNING); // This will lock controls
    } else if (!loaded) {
        console.log("Level loading failed or game ended.");
    } else {
        console.error("LevelManager loaded but is not running.");
        changeGameState(GameState.LEVEL_SELECT);
    }
}


function pauseGame() {
    if (currentGameState !== GameState.GAME_RUNNING) return;
    changeGameState(GameState.PAUSED); // This will unlock controls
}

function resumeGame() {
    if (currentGameState !== GameState.PAUSED && currentGameState !== GameState.SETTINGS) return;
    if (levelManager && levelManager.isRunning()) {
        changeGameState(GameState.GAME_RUNNING); // This will lock controls
    } else {
        changeGameState(GameState.MAIN_MENU);
    }
}

function handleLevelEnd(score, stars, levelIndex) {
    const hasNextLevel = (levelIndex + 1) < LEVEL_DATABASE.length;
    uiManager.showLevelEnd(score, stars, levelIndex, hasNextLevel);
    changeGameState(GameState.LEVEL_END); // This will unlock controls
}

function handleGameEnd() {
    uiManager.showGameEnd();
    changeGameState(GameState.LEVEL_END); // This will unlock controls
}

// --- Main Loop ---
function animate() {
    requestAnimationFrame(animate);

    if (!renderer || !uiManager || !menuManager || !playerControls) return;

    const delta = clock.getDelta();

    // --- Gamepad Polling ---
    const gamepads = navigator.getGamepads();
    activeGamepad = null;
    for (const gp of gamepads) { if (gp && gp.connected) { activeGamepad = gp; break; } }
    if (uiManager) uiManager.updateGamepadStatus(!!activeGamepad);

    // --- Input Handling ---
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
                pauseGame(); // State change handles unlock
                renderer.render(scene, camera);
                return;
            }
        }
    } else {
        playerControls.handleGamepadInput(null, delta);
        if (isMenuState(currentGameState)) {
            menuManager.prevGamepadButtons = [];
        }
    }

    // Keyboard Pause Check
    if (currentGameState === GameState.GAME_RUNNING && playerControls.consumePauseToggleRequest()) {
        pauseGame(); // State change handles unlock
        renderer.render(scene, camera);
        return;
    }

    // --- Game Logic ---
    if (currentGameState === GameState.GAME_RUNNING) {
        if (levelManager && interactionManager && player) {
            levelManager.update(delta);

            // Player update only happens if controls are locked (implicitly true in GAME_RUNNING unless just paused)
            if (playerControls.isLocked) {
                const movementInput = playerControls.getMovementInput();
                player.update(delta, movementInput);

                if (playerControls.consumeInteractionRequest()) {
                    interactionManager.handleInteractionRequest();
                }
                if (uiManager) uiManager.updateHolding(player.getHeldItem()?.name);
            } else {
                // This case should ideally not happen if state transitions are correct
                // console.warn("GAME_RUNNING but controls not locked?");
                if (uiManager) uiManager.updateHolding(null);
            }
        } else {
            console.error("Missing core component during GAME_RUNNING update!");
        }
    } else if (isMenuState(currentGameState)) {
        // Menu updates
    }

    // --- Rendering ---
    if (scene && camera) {
        renderer.render(scene, camera);
    }
}

// --- Start Execution ---
async function runGame() {
    try {
        uiManager = new UIManager(); // Create UIManager first
        await preloadAssets();
        initializeGameComponents(); // Creates levelManager

        if (levelManager) {
            levelManager.onLevelEnd = handleLevelEnd;
            levelManager.onGameEnd = handleGameEnd;
        } else {
            console.error("LevelManager was not created during initialization!");
            throw new Error("LevelManager initialization failed.");
        }

        changeGameState(GameState.MAIN_MENU); // Start at main menu
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