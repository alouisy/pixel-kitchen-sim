// src/main.js
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { setupScene, setupCamera, setupRenderer, setupLighting, setupResizeHandler } from './setup.js';
import { PlayerControls } from './controls.js';
import { Player } from './player.js';
import { buildKitchen, toggleLabels } from './world.js';
import { InteractionManager } from './interaction.js';
import { LevelManager } from './LevelManager.js';
import { OrderManager } from './orders.js';
import { UIManager } from './ui.js';

// --- Global State ---
let isPaused = false;
let gameHasStarted = false; // Flag to track if the initial start occurred

// --- Initialization ---
const scene = setupScene();
const camera = setupCamera();
const renderer = setupRenderer();
setupLighting(scene);
setupResizeHandler(camera, renderer);

const playerControls = new PlayerControls(camera, renderer.domElement);
console.log('Created playerControls:', playerControls); // Check if it has moveRight method here
scene.add(playerControls.object); // Add camera rig to scene

const player = new Player(playerControls);
const uiManager = new UIManager();
const levelManager = new LevelManager(uiManager);

// Build the kitchen and get references
const { stations, interactables } = buildKitchen(scene);

const interactionManager = new InteractionManager(camera, scene, player, stations, interactables, levelManager, uiManager);

const clock = new THREE.Clock();
let activeGamepad = null; // Store the active gamepad object

// --- Settings Menu Elements ---
const settingsMenu = document.getElementById('settings-menu');
const resumeButton = document.getElementById('resume-button');
const toggleLabelsCheckbox = document.getElementById('toggle-labels');
const levelEndScreen = document.getElementById('level-end-screen');
const nextLevelButton = document.getElementById('next-level-button');
const restartLevelButton = document.getElementById('restart-level-button');
const instructionsScreen = document.getElementById('instructions');

function startGame() {
    if (gameHasStarted) return; // Prevent multiple starts if already running
    gameHasStarted = true;
    instructionsScreen.style.display = 'none'; // Hide instructions
    levelManager.loadLevel(0); // Start Level 1 (index 0)
    playerControls.lock(); // Lock pointer
}

// --- Pause/Resume Logic ---
function togglePause(forceState = null) {
    // Don't allow pausing if level isn't running (e.g., on end screen)
    if (!levelManager.isRunning() && forceState !== false) return;

    const newState = forceState !== null ? forceState : !isPaused;
    if (newState === isPaused) return; // No change

    console.log(`Toggling pause. Current: ${isPaused}, New: ${newState}`); // Debug log
    isPaused = newState;
    console.log("Paused:", isPaused);

    if (isPaused) {
        settingsMenu.style.display = 'flex'; // Show menu
        playerControls.unlock(); // Unlock pointer
        console.log("Game Paused. Pointer unlocked.");
        // Optionally freeze animations or timers here
    } else {
        settingsMenu.style.display = 'none'; // Hide menu
        if (levelManager.isRunning()) {

            playerControls.lock(); // Lock pointer
            console.log("Game Resumed. Pointer lock requested.");
        }
        // Optionally resume animations or timers here
    }
}

// --- Event Listeners for Settings ---
resumeButton.addEventListener('click', () => togglePause(false));
toggleLabelsCheckbox.addEventListener('change', (event) => {
    toggleLabels(event.target.checked); // Call function from world.js
});

// --- Level End/Start Buttons ---
nextLevelButton.addEventListener('click', () => {
    const currentLevel = parseInt(levelEndScreen.dataset.levelIndex, 10);
    uiManager.hideLevelEndScreen();
    levelManager.loadLevel(currentLevel + 1); // Load next level
    playerControls.lock(); // Re-lock pointer
});

restartLevelButton.addEventListener('click', () => {
    const currentLevel = parseInt(levelEndScreen.dataset.levelIndex, 10);
    // If button text changed to 'Play Again?', restart from level 0
    if (restartLevelButton.textContent.includes('Play Again')) {
        uiManager.hideLevelEndScreen();
        levelManager.loadLevel(0);
    } else {
        uiManager.hideLevelEndScreen();
        levelManager.loadLevel(currentLevel); // Restart current level
    }
    playerControls.lock(); // Re-lock pointer
});

// --- Modify Instructions Listener for Start ---
instructionsScreen.addEventListener('click', startGame);

// --- Main Loop ---
function animate() {
    requestAnimationFrame(animate);

    // Handle pause requests first
    if (playerControls.consumePauseToggleRequest()) {
        // Allow pausing even if pointer isn't locked (e.g., from instructions screen)
        togglePause();
    }

    const delta = clock.getDelta();

    // --- GAMEPAD POLLING ---
    const gamepads = navigator.getGamepads();
    activeGamepad = null; // Reset each frame
    for (const gp of gamepads) {
        if (gp && gp.connected) {
            activeGamepad = gp; // Use the first connected gamepad found
            break;
        }
    }

    // If a gamepad is active, process its input
    if (activeGamepad) {
        playerControls.handleGamepadInput(activeGamepad, delta);
        if (!gameHasStarted && playerControls.consumeInteractionRequest()) {
            startGame(); // Start game on 'X' press from instructions
        }
    } else {
        // Optional: Ensure gamepad state is cleared if disconnected without event
        playerControls.handleGamepadInput(null, delta);
    }

    uiManager.updateGamepadStatus(playerControls.gamepadConnected);

    // Skip game updates if paused
    if (isPaused || !levelManager.isRunning()) {
        // Still render the scene to show the menu
        renderer.render(scene, camera);
        return;
    }

    levelManager.update(delta); // Update timers and check for level end

    // Only run game logic if pointer is locked
    if (playerControls.isLocked) {
        // Get input BEFORE updating player
        const movementInput = playerControls.getMovementInput();

        // Update player position based on input
        player.update(delta, movementInput);

        // Check for interaction requests AFTER player update
        if (playerControls.consumeInteractionRequest()) {
            interactionManager.handleInteractionRequest();
        }

        // Update UI
        uiManager.updateHolding(player.getHeldItem()?.name);
        // Order UI is updated by OrderManager when orders change
    } else {
        // If not locked and not paused, likely on instructions screen
        // Reset holding UI if needed
        uiManager.updateHolding(null);
    }
    // Render the scene
    renderer.render(scene, camera);
}

// --- Start ---
console.log("Kitchen Simulator Initialized - Ready to Start Level");
toggleLabels(toggleLabelsCheckbox.checked);
animate(); // Start the animation loop