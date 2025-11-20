// src/main.js
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { setupScene, setupCamera, setupRenderer, setupLighting, setupResizeHandler } from './setup.js';
import { PlayerControls } from './controls.js';
import { Player } from './player.js';
import { buildKitchen, clearKitchen, toggleLabels, setWorldLanguage } from './world.js';
import { InteractionManager } from './interaction.js';
import { LevelManager } from './LevelManager.js';
import { UIManager } from './ui.js';
import { MenuManager } from './menuManager.js';
import { SaveManager } from './saveManager.js';
import { LevelEditor } from './editor.js';
import { AudioManager } from './audioManager.js'; 

const GameState = { 
    LOADING: 'LOADING', 
    MAIN_MENU: 'MAIN_MENU', 
    SETTINGS: 'SETTINGS', 
    LEVEL_SELECT: 'LEVEL_SELECT', 
    LEVEL_INSTRUCTIONS: 'LEVEL_INSTRUCTIONS', 
    GAME_RUNNING: 'GAME_RUNNING', 
    PAUSED: 'PAUSED', 
    VIEWING_INSTRUCTIONS: 'VIEWING_INSTRUCTIONS', 
    LEVEL_END: 'LEVEL_END',
    EDITOR: 'EDITOR',
    EDITOR_HUB: 'EDITOR_HUB'
};

let currentGameState = GameState.LOADING;
let preloadedModels = {};
let activeGamepad = null;
const clock = new THREE.Clock();

let scene, camera, renderer, playerControls, player, interactionManager, levelManager, uiManager, menuManager, saveManager, levelEditor, audioManager;
let levelDatabase = []; 
let levelDataCache = {}; // Cache level contents: filename/id -> json data
let pendingLevelIndex = -1;
let pendingLevelData = null;
let currentLevelData = null; 
let inputCooldownTimer = 0;
const INPUT_COOLDOWN_DURATION = 0.2;

const loadingManager = new THREE.LoadingManager();
const gltfLoader = new GLTFLoader(loadingManager);
const assetsToLoad = { 
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
};

async function preloadAssets() {
    if (!saveManager) saveManager = new SaveManager();
    if (!uiManager) uiManager = new UIManager(saveManager);
    if (!audioManager) audioManager = new AudioManager();

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

async function loadLevelData() {
    try {
        // Load roadmap instead of a giant monolithic file
        const response = await fetch('levels/game_roadmap.json'); 
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        levelDatabase = await response.json();
        if (!Array.isArray(levelDatabase) || levelDatabase.length === 0) throw new Error("Loaded level roadmap is not a valid non-empty array.");
    } catch (error) {
        console.error("Failed to load level data:", error);
        levelDatabase = [];
        if (uiManager && uiManager.loadingScreen) {
            uiManager.loadingScreen.innerHTML = `<h2>Error loading game roadmap!</h2><p>${error.message}</p>`;
        }
    }
}

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

    if (!saveManager) saveManager = new SaveManager();
    if (!uiManager) uiManager = new UIManager(saveManager);
    if (!audioManager) audioManager = new AudioManager();

    menuManager = new MenuManager(uiManager);
    levelManager = new LevelManager(uiManager, saveManager, levelDatabase);
    levelManager.audioManager = audioManager;

    interactionManager = new InteractionManager(camera, scene, player, {}, [], levelManager, uiManager, preloadedModels, null);
    interactionManager.audioManager = audioManager;

    // Pass an exit callback to the editor to return to the editor hub
    levelEditor = new LevelEditor(camera, renderer, scene, interactionManager, () => {
        changeGameState(GameState.EDITOR_HUB);
    });

    // --- APPLY SAVED SETTINGS ---
    const savedLang = saveManager.getSetting('language') || 'en';
    uiManager.setLanguage(savedLang);
    setWorldLanguage(savedLang); // Set for World builder

    const savedLabels = saveManager.getSetting('showLabels'); // Could be true, false, or undefined
    // If undefined, default to true (handled by getSetting in previous file, but safe here)
    const showLabels = savedLabels !== false;
    toggleLabels(showLabels);
    uiManager.setLabelToggleState(showLabels);

    addEventListeners();
    console.log("Kitchen Simulator Initialized.");
}

function addEventListeners() {
    document.body.addEventListener('mousedown', (event) => {
        audioManager.resume(); 
        // Allow handling interaction if we are in a menu OR editor hub
        if ((isMenuState(currentGameState) || currentGameState === GameState.EDITOR_HUB) && inputCooldownTimer <= 0) {
            handleMenuAction(event);
        }
    });
    window.addEventListener('keydown', (e) => {
        audioManager.resume();
        // Removed F1 toggle, using Editor Exit button now
    });

    // --- FIX: Label Toggle Listener ---
    const labelToggle = document.getElementById('toggle-labels-setting');
    if (labelToggle) {
        // Clone to clear old listeners if any
        const newToggle = labelToggle.cloneNode(true);
        labelToggle.parentNode.replaceChild(newToggle, labelToggle);
        
        newToggle.addEventListener('change', (event) => {
            const isChecked = event.target.checked;
            toggleLabels(isChecked);
            saveManager.saveSetting('showLabels', isChecked); // Persist to localStorage
            
            // Sync with MenuManager focus
            if (menuManager?.activeMenuElement === uiManager.settingsScreen) {
                menuManager.setSelectedIndex(menuManager.focusableElements.indexOf(event.target));
            }
        });
        // Update ref in UI Manager
        uiManager.toggleLabelsCheckbox = newToggle;
    } else { console.error("Label toggle checkbox not found!"); }

    window.addEventListener('gamepadconnected', (event) => { console.log('Gamepad connected:', event.gamepad.id); });
    window.addEventListener('gamepaddisconnected', (event) => { console.log('Gamepad disconnected:', event.gamepad.id); activeGamepad = null; });
}

function changeGameState(newState) {
    const previousState = currentGameState;
    if (isMenuState(previousState) && !isMenuState(newState) && newState !== GameState.EDITOR_HUB) menuManager.deactivateMenu();
    
    if ((previousState === GameState.GAME_RUNNING || previousState === GameState.VIEWING_INSTRUCTIONS) && newState !== GameState.PAUSED && newState !== GameState.VIEWING_INSTRUCTIONS && newState !== GameState.EDITOR) {
        if (playerControls) playerControls.unlock();
    }

    if (newState === GameState.EDITOR) {
        if (playerControls) playerControls.unlock();
        uiManager.hideGameUI();
        levelEditor.enable();
    } else if (previousState === GameState.EDITOR) {
        levelEditor.disable();
        if (newState === GameState.GAME_RUNNING && player) {
            const pos = player.getPosition();
            camera.position.copy(pos);
            camera.rotation.set(0,0,0);
        }
    }

    currentGameState = newState;
    const editorHubScreen = document.getElementById('editor-hub-screen');
    if (editorHubScreen) editorHubScreen.classList.remove('active');

    switch (newState) {
        case GameState.MAIN_MENU: uiManager.showMainMenu(); menuManager.activateMenu(uiManager.mainMenu); break;
        case GameState.EDITOR_HUB: 
            uiManager.hideGameUI();
            renderEditorHub();
            editorHubScreen.classList.add('active');
            menuManager.activateMenu(editorHubScreen);
            break;
        case GameState.SETTINGS:
            const isPause = previousState === GameState.PAUSED || previousState === GameState.GAME_RUNNING || previousState === GameState.VIEWING_INSTRUCTIONS;
            uiManager.showSettings(isPause); menuManager.activateMenu(uiManager.settingsScreen);
            break;
        case GameState.LEVEL_SELECT: uiManager.populateLevelSelect(levelDatabase, saveManager); uiManager.showLevelSelect(); menuManager.activateMenu(uiManager.levelSelectScreen); break;
        case GameState.LEVEL_INSTRUCTIONS: menuManager.activateMenu(uiManager.levelInstructionsScreen); break;
        case GameState.VIEWING_INSTRUCTIONS: 
            if (currentLevelData) uiManager.showLevelInstructions(currentLevelData, true); 
            else changeGameState(GameState.GAME_RUNNING); 
            break;
        case GameState.GAME_RUNNING:
            if (uiManager.settingsScreen.classList.contains('active')) uiManager.settingsScreen.classList.remove('active');
            if (uiManager.levelInstructionsScreen.classList.contains('active')) uiManager.levelInstructionsScreen.classList.remove('active');
            uiManager.showGameUI();
            if (playerControls) playerControls.lock();
            break;
        case GameState.PAUSED: uiManager.showSettings(true); menuManager.activateMenu(uiManager.settingsScreen); break;
        case GameState.LEVEL_END: currentLevelData = null; menuManager.activateMenu(uiManager.levelEndScreen); break;
        case GameState.LOADING: uiManager.showLoading(); menuManager.deactivateMenu(); break;
    }
}

function isMenuState(state) { return [GameState.MAIN_MENU, GameState.SETTINGS, GameState.LEVEL_SELECT, GameState.LEVEL_INSTRUCTIONS, GameState.PAUSED, GameState.LEVEL_END].includes(state); }

function handleMenuAction(eventOrAction) {
    let action = null, element = null;
    if (inputCooldownTimer > 0) return;
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
        if (action === 'toggle-labels') { inputCooldownTimer = INPUT_COOLDOWN_DURATION; return; }
    } else { return; }
    if (!action || !element) return;

    let actionTaken = true;
    // Only play pop sound for menu clicks, not generic editor clicks if already in editor
    if (currentGameState !== GameState.EDITOR) audioManager.play('pop'); 

    // --- Editor Hub Actions ---
    if (currentGameState === GameState.EDITOR_HUB) {
        const idx = parseInt(element.dataset.index, 10);
        switch (action) {
            case 'back-to-main': changeGameState(GameState.MAIN_MENU); break;
            case 'create-level': createNewLevel(); break;
            case 'save-roadmap': downloadRoadmap(); break;
            case 'edit-level': if (!isNaN(idx)) prepareEditLevel(idx); break;
            case 'move-up': if (!isNaN(idx)) reorderLevel(idx, -1); break;
            case 'move-down': if (!isNaN(idx)) reorderLevel(idx, 1); break;
            case 'duplicate': if (!isNaN(idx)) duplicateLevel(idx); break;
            case 'delete-level': if (!isNaN(idx)) deleteLevel(idx); break;
            default: actionTaken = false;
        }
        if (actionTaken) {
            inputCooldownTimer = INPUT_COOLDOWN_DURATION;
            return;
        }
    }

    switch (action) {
        case 'play': changeGameState(GameState.LEVEL_SELECT); break;
        case 'editor-hub': changeGameState(GameState.EDITOR_HUB); break; 
        case 'settings': changeGameState(GameState.SETTINGS); break;
        case 'back-to-main': changeGameState(GameState.MAIN_MENU); break;
        case 'start-level':
            const levelIndex = parseInt(element.dataset.levelIndex, 10);
            if (!isNaN(levelIndex) && saveManager.isLevelUnlocked(levelIndex)) {
                prepareStartLevel(levelIndex);
            } else { 
                if (!isNaN(levelIndex)) uiManager.showTemporaryMessage("Level Locked!", 1500); 
                actionTaken = false; 
            }
            break;
        case 'start-level-confirm':
            if (currentGameState === GameState.LEVEL_INSTRUCTIONS) { confirmStartLevel(); audioManager.play('music_start'); } else actionTaken = false;
            break;
        case 'set-language':
            const lang = element.dataset.lang;
            uiManager.setLanguage(lang);
            setWorldLanguage(lang); // Set for future levels
            saveManager.saveSetting('language', lang); // Persist
            break;
        case 'resume': resumeGame(); break;
        case 'next-level':
            const currentLevelIdx = parseInt(uiManager.levelEndScreen.dataset.levelIndex, 10);
            const nextLevelIndex = currentLevelIdx + 1;
            if (!isNaN(currentLevelIdx) && nextLevelIndex < levelDatabase.length && saveManager.isLevelUnlocked(nextLevelIndex)) prepareStartLevel(nextLevelIndex);
            else actionTaken = false;
            break;
        case 'restart-level':
            const levelToRestart = parseInt(uiManager.levelEndScreen.dataset.levelIndex, 10);
            if (!isNaN(levelToRestart) && levelToRestart >= 0) prepareStartLevel(levelToRestart);
            else prepareStartLevel(0);
            break;
        case 'link': window.open(element.href, '_blank'); break;
        default: actionTaken = false;
    }
    if (actionTaken) inputCooldownTimer = INPUT_COOLDOWN_DURATION;
}

// --- Editor Hub Logic ---

function renderEditorHub() {
    const container = document.getElementById('editor-level-list');
    if (!container) return;
    container.innerHTML = '';

    levelDatabase.forEach((level, index) => {
        const row = document.createElement('div');
        row.className = 'editor-level-row';
        row.innerHTML = `
            <div class="editor-level-actions">
                <button class="icon-btn" data-action="move-up" data-index="${index}" title="Move Up">▲</button>
                <button class="icon-btn" data-action="move-down" data-index="${index}" title="Move Down">▼</button>
            </div>
            <div class="editor-level-info">
                <span class="level-name-display">${level.name}</span>
                <span class="level-id-badge">ID: ${level.levelId} | File: ${level.filename || 'unsaved'}</span>
            </div>
            <div class="editor-level-actions">
                <button class="icon-btn" data-action="edit-level" data-index="${index}" title="Edit">✏️</button>
                <button class="icon-btn" data-action="duplicate" data-index="${index}" title="Duplicate">📋</button>
                <button class="icon-btn delete" data-action="delete-level" data-index="${index}" title="Delete">🗑️</button>
            </div>
        `;
        container.appendChild(row);
    });
}

function createNewLevel() {
    const newId = levelDatabase.length > 0 ? Math.max(...levelDatabase.map(l => l.levelId)) + 1 : 1;
    const filename = `level_${newId}.json`;
    const newEntry = {
        levelId: newId,
        name: `New Level ${newId}`,
        filename: filename
    };
    
    // Create default content in cache
    levelDataCache[filename] = {
        levelId: newId,
        name: `New Level ${newId}`,
        duration: 180,
        starThresholds: [100, 200, 300],
        availableMeals: [],
        maxActiveOrders: 2,
        newOrderDelay: 15,
        layout: []
    };

    levelDatabase.push(newEntry);
    renderEditorHub();
}

function reorderLevel(index, direction) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= levelDatabase.length) return;
    
    // Swap
    const temp = levelDatabase[index];
    levelDatabase[index] = levelDatabase[newIndex];
    levelDatabase[newIndex] = temp;
    
    renderEditorHub();
}

function deleteLevel(index) {
    if (!confirm("Delete this level reference? (Files cannot be deleted by web browser)")) return;
    levelDatabase.splice(index, 1);
    renderEditorHub();
}

// Fetch logic helper
async function getLevelData(entry) {
    // Check cache first
    if (levelDataCache[entry.filename]) {
        return JSON.parse(JSON.stringify(levelDataCache[entry.filename])); // Deep copy
    }
    
    // Fetch from server
    try {
        const res = await fetch(`levels/${entry.filename}`);
        if (!res.ok) throw new Error("File not found");
        const data = await res.json();
        levelDataCache[entry.filename] = data; // Cache it
        return data;
    } catch (e) {
        console.warn(`Could not load ${entry.filename}, creating empty template.`);
        const tmpl = { levelId: entry.levelId, name: entry.name, layout: [] };
        levelDataCache[entry.filename] = tmpl;
        return tmpl;
    }
}

async function duplicateLevel(index) {
    const sourceEntry = levelDatabase[index];
    const sourceData = await getLevelData(sourceEntry);
    
    const newId = Math.max(...levelDatabase.map(l => l.levelId)) + 1;
    const newFilename = `level_${newId}.json`;
    
    // Clone data
    const newData = JSON.parse(JSON.stringify(sourceData));
    newData.levelId = newId;
    newData.name = `${sourceData.name} (Copy)`;
    
    // Update Roadmap
    const newEntry = {
        levelId: newId,
        name: newData.name,
        filename: newFilename
    };
    levelDatabase.push(newEntry);
    
    // Update Cache
    levelDataCache[newFilename] = newData;
    
    renderEditorHub();
}

async function prepareEditLevel(index) {
    const entry = levelDatabase[index];
    uiManager.showLoading();
    try {
        const data = await getLevelData(entry);
        
        resetWorldState();
        clearKitchen(scene);
        
        // Use builder to show current state
        const { stations, stationInteractables, floorMesh } = buildKitchen(scene, data.layout || [], preloadedModels);
        interactionManager.updateWorldData(stations, stationInteractables, floorMesh);
        
        // Initialize Editor with this data
        levelEditor.loadLevel(data);
        
        uiManager.hideLoading();
        changeGameState(GameState.EDITOR);
    } catch (e) {
        console.error(e);
        uiManager.hideLoading();
        alert("Failed to load level for editing");
    }
}

function downloadRoadmap() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(levelDatabase, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "game_roadmap.json");
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    alert("Roadmap downloaded. Overwrite levels/game_roadmap.json in your project.");
}

// --- Game Load Logic ---

// Converted to async to handle fetching individual level files
async function prepareStartLevel(levelIndex) {
    if (!levelManager || !interactionManager || !scene || !uiManager) { changeGameState(GameState.MAIN_MENU); return; }
    if (levelIndex < 0 || levelIndex >= levelDatabase.length) { changeGameState(GameState.LEVEL_SELECT); return; }
    
    uiManager.showLoading();
    
    try {
        const levelEntry = levelDatabase[levelIndex];
        // Fetch specific level data
        const levelData = await getLevelData(levelEntry);

        resetWorldState();
        clearKitchen(scene);
        
        // Pass preloadedModels to buildKitchen so preplaced items can be instantiated
        const { stations, stationInteractables, floorMesh } = buildKitchen(scene, levelData.layout, preloadedModels);
        interactionManager.updateWorldData(stations, stationInteractables, floorMesh);
        
        pendingLevelIndex = levelIndex;
        pendingLevelData = levelData;
        currentLevelData = null; 
        
        uiManager.hideLoading();
        uiManager.showLevelInstructions(levelData, false);
        changeGameState(GameState.LEVEL_INSTRUCTIONS);
    } catch (e) {
        console.error(e);
        uiManager.hideLoading();
        uiManager.showTemporaryMessage("Error loading level", 2000);
        changeGameState(GameState.LEVEL_SELECT);
    }
}

function confirmStartLevel() {
    if (pendingLevelIndex < 0 || !pendingLevelData || !levelManager) { changeGameState(GameState.LEVEL_SELECT); return; }
    currentLevelData = pendingLevelData;
    const loaded = levelManager.loadLevel(pendingLevelIndex, pendingLevelData);
    pendingLevelIndex = -1;
    pendingLevelData = null;
    if (loaded && levelManager.isRunning()) changeGameState(GameState.GAME_RUNNING);
    else { currentLevelData = null; changeGameState(GameState.LEVEL_SELECT); }
}

function resetWorldState() {
    if (player) player.forceDropItem();
    if (interactionManager) {
        if (interactionManager.currentlyHighlighted) {
            interactionManager.revertHighlight(interactionManager.currentlyHighlighted);
            interactionManager.currentlyHighlighted = null;
        }
        interactionManager.clearDynamicItems();
    }
    if (uiManager) { uiManager.clearOrderList(); uiManager.updateHolding(null); }
    pendingLevelIndex = -1;
    pendingLevelData = null;
}

function pauseGame() { if (currentGameState === GameState.GAME_RUNNING) changeGameState(GameState.PAUSED); }
function resumeGame() {
    if (currentGameState === GameState.PAUSED || currentGameState === GameState.SETTINGS || currentGameState === GameState.VIEWING_INSTRUCTIONS) {
         if (levelManager?.isRunning()) changeGameState(GameState.GAME_RUNNING);
         else changeGameState(GameState.MAIN_MENU);
    }
}
function handleLevelEnd(score, stars, levelIndex) {
    currentLevelData = null; 
    if (saveManager) saveManager.updateLevelCompletion(levelIndex, score, stars);
    const hasNextLevel = (levelIndex + 1) < levelDatabase.length;
    uiManager.showLevelEnd(score, stars, levelIndex, hasNextLevel);
    changeGameState(GameState.LEVEL_END);
}
function handleGameEnd() {
    currentLevelData = null; 
    uiManager.showGameEnd();
    changeGameState(GameState.LEVEL_END);
}

function animate() {
    requestAnimationFrame(animate);
    if (!renderer || !uiManager || !menuManager || !playerControls || !player || !interactionManager) return;
    const delta = clock.getDelta();
    if (inputCooldownTimer > 0) inputCooldownTimer -= delta;
    const gamepads = navigator.getGamepads();
    activeGamepad = null;
    for (const gp of gamepads) { if (gp?.connected) { activeGamepad = gp; break; } }
    if (uiManager) uiManager.updateGamepadStatus(!!activeGamepad);
    let pausePressed = false;
    let instructionPressed = false;
    if (activeGamepad) {
        playerControls.handleGamepadInput(activeGamepad, delta); 
        pausePressed = playerControls.consumePauseToggleRequest();
        instructionPressed = playerControls.consumeInstructionToggleRequest();
    } else {
        playerControls.handleGamepadInput(null, delta); 
        pausePressed = playerControls.consumePauseToggleRequest(); 
        instructionPressed = playerControls.consumeInstructionToggleRequest(); 
    }
    
    // Handle gamepad in editor hub
    if (currentGameState === GameState.EDITOR_HUB && activeGamepad && inputCooldownTimer <= 0) {
        const menuAction = menuManager.handleGamepadNav(activeGamepad, delta); 
        if (menuAction) handleMenuAction(menuAction);
    }

    if (currentGameState === GameState.GAME_RUNNING) {
        if (pausePressed) { pauseGame(); inputCooldownTimer = INPUT_COOLDOWN_DURATION; renderer.render(scene, camera); return; }
        if (instructionPressed) { changeGameState(GameState.VIEWING_INSTRUCTIONS); inputCooldownTimer = INPUT_COOLDOWN_DURATION; renderer.render(scene, camera); return; }
        if (levelManager && interactionManager && player) {
            levelManager.update(delta); 
            if (playerControls.isLocked) {
                player.update(delta, playerControls.getMovementInput()); 
                interactionManager.updateAimHighlight();
                if (inputCooldownTimer <= 0 && playerControls.consumeInteractionRequest()) interactionManager.handleInteractionRequest();
                if (uiManager) uiManager.updateHolding(player.getHeldItemName());
            } else {
                 if (uiManager) uiManager.updateHolding(null);
                 if (interactionManager.currentlyHighlighted) { interactionManager.revertHighlight(interactionManager.currentlyHighlighted); interactionManager.currentlyHighlighted = null; }
            }
        }
    }
    else if (currentGameState === GameState.PAUSED) {
        if (pausePressed) { resumeGame(); inputCooldownTimer = INPUT_COOLDOWN_DURATION; renderer.render(scene, camera); return; }
        if (inputCooldownTimer <= 0 && isMenuState(currentGameState) && activeGamepad) { const menuAction = menuManager.handleGamepadNav(activeGamepad, delta); if (menuAction) handleMenuAction(menuAction); }
    }
    else if (currentGameState === GameState.VIEWING_INSTRUCTIONS) { if (instructionPressed || pausePressed) { resumeGame(); inputCooldownTimer = INPUT_COOLDOWN_DURATION; renderer.render(scene, camera); return; } }
    else if (currentGameState === GameState.EDITOR) { levelEditor.update(delta); renderer.render(scene, camera); return; }
    else if (isMenuState(currentGameState)) { if (inputCooldownTimer <= 0 && activeGamepad) { const menuAction = menuManager.handleGamepadNav(activeGamepad, delta); if (menuAction) handleMenuAction(menuAction); } }
    
    if (currentGameState !== GameState.EDITOR) renderer.render(scene, camera);
}

async function runGame() {
    try {
        saveManager = new SaveManager();
        uiManager = new UIManager(saveManager);
        await preloadAssets();
        await loadLevelData();
        initializeGameComponents();
        levelManager.onLevelEnd = handleLevelEnd;
        levelManager.onGameEnd = handleGameEnd;
        changeGameState(GameState.MAIN_MENU);
        animate();
    } catch (error) {
        console.error(error);
    }
}
runGame();