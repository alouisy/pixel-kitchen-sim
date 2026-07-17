// src/main.js
import * as THREE from 'three';
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
import { OnlineServices } from './onlineService.js';

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
    EDITOR_HUB: 'EDITOR_HUB',
    NICKNAME: 'NICKNAME',
    LEADERBOARD: 'LEADERBOARD'
};

let currentGameState = GameState.LOADING;
let activeGamepad = null;
const clock = new THREE.Clock();

let scene, camera, renderer, playerControls, player, interactionManager, levelManager, uiManager, menuManager, saveManager, levelEditor, audioManager, onlineServices;
let officialLevelDatabase = [];
let levelDatabase = [];
let levelDataCache = {}; // Cache level contents: filename/id -> json data
let pendingLevelIndex = -1;
let pendingLevelData = null;
let currentLevelData = null;
let currentEditingLevelEntry = null;
let currentLeaderboardState = { scope: 'all', rows: [], title: 'Leaderboard', statusText: '' };
let inputCooldownTimer = 0;
const INPUT_COOLDOWN_DURATION = 0.2;

function cloneData(data) {
    return data ? JSON.parse(JSON.stringify(data)) : null;
}

function refreshPlayableLevelDatabase() {
    if (!saveManager) return;
    levelDatabase = saveManager.makePlayableLevelList(officialLevelDatabase);
    if (levelManager) levelManager.levels = levelDatabase;
    if (uiManager) uiManager.setLevelDatabase(levelDatabase);
}

async function preloadAssets() {
    if (!saveManager) saveManager = new SaveManager();
    if (!uiManager) uiManager = new UIManager(saveManager);
    if (!audioManager) audioManager = new AudioManager();
    if (!onlineServices) onlineServices = new OnlineServices();

    uiManager.showLoading();
    currentGameState = GameState.LOADING;
    console.log("Voxel assets are generated at runtime.");
}

async function loadLevelData() {
    try {
        // Load roadmap instead of a giant monolithic file
        const response = await fetch('levels/game_roadmap.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        officialLevelDatabase = await response.json();
        if (!Array.isArray(officialLevelDatabase) || officialLevelDatabase.length === 0) throw new Error("Loaded level roadmap is not a valid non-empty array.");
        if (saveManager) saveManager.setLevelDatabase(officialLevelDatabase);
        refreshPlayableLevelDatabase();
    } catch (error) {
        console.error("Failed to load level data:", error);
        officialLevelDatabase = [];
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

    interactionManager = new InteractionManager(camera, scene, player, {}, [], levelManager, uiManager, null);
    interactionManager.audioManager = audioManager;

    // Pass an exit callback to the editor to return to the editor hub
    levelEditor = new LevelEditor(camera, renderer, scene, interactionManager, {
        onExit: () => changeGameState(GameState.EDITOR_HUB),
        onSaveLocal: saveEditedLevelLocally
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

    const audioEnabled = saveManager.getSetting('audioEnabled') !== false;
    audioManager.setEnabled(audioEnabled);
    uiManager.setSoundEffectsState(audioEnabled);

    const savedVolume = saveManager.getSetting('masterVolume') ?? 0.7;
    audioManager.setVolume(savedVolume);

    const savedSens = saveManager.getSetting('mouseSensitivity') ?? 1.0;
    playerControls.setSensitivity(savedSens);

    addEventListeners();
    console.log("Kitchen Simulator Initialized.");
}

function addEventListeners() {
    document.body.addEventListener('mousedown', (event) => {
        audioManager.resume(); 
        if ((isMenuState(currentGameState) || currentGameState === GameState.EDITOR_HUB) && inputCooldownTimer <= 0) {
            handleMenuAction(event);
        }
    });

    window.addEventListener('keydown', (e) => {
        audioManager.resume();
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

    const soundToggle = document.getElementById('sound-effects-setting');
    if (soundToggle) {
        soundToggle.addEventListener('change', event => {
            const isEnabled = event.target.checked;
            audioManager.setEnabled(isEnabled);
            saveManager.saveSetting('audioEnabled', isEnabled);
        });
    }

    const volumeSlider = document.getElementById('volume-setting');
    const volumeDisplay = document.getElementById('volume-value-display');
    if (volumeSlider && volumeDisplay) {
        const savedVolume = saveManager.getSetting('masterVolume') ?? 0.7;
        volumeSlider.value = savedVolume;
        volumeDisplay.textContent = `${Math.round(savedVolume * 100)}%`;
        
        volumeSlider.addEventListener('input', (event) => {
            const val = parseFloat(event.target.value);
            volumeDisplay.textContent = `${Math.round(val * 100)}%`;
            audioManager.setVolume(val);
            saveManager.saveSetting('masterVolume', val);
        });
    }

    const sensSlider = document.getElementById('sensitivity-setting');
    const sensDisplay = document.getElementById('sensitivity-value-display');
    if (sensSlider && sensDisplay) {
        const savedSens = saveManager.getSetting('mouseSensitivity') ?? 1.0;
        sensSlider.value = savedSens;
        sensDisplay.textContent = savedSens.toFixed(1);
        
        sensSlider.addEventListener('input', (event) => {
            const val = parseFloat(event.target.value);
            sensDisplay.textContent = val.toFixed(1);
            playerControls.setSensitivity(val);
            saveManager.saveSetting('mouseSensitivity', val);
        });
    }

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
        case GameState.NICKNAME: uiManager.showNicknamePrompt(); menuManager.activateMenu(uiManager.nicknameScreen); break;
        case GameState.LEADERBOARD:
            uiManager.showLeaderboard(currentLeaderboardState.scope, currentLeaderboardState.rows, currentLeaderboardState.title, currentLeaderboardState.statusText);
            menuManager.activateMenu(uiManager.leaderboardScreen);
            break;
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
        case GameState.LEVEL_END: currentLevelData = null; uiManager.setCurrentLevelData(null); menuManager.activateMenu(uiManager.levelEndScreen); break;
        case GameState.LOADING: uiManager.showLoading(); menuManager.deactivateMenu(); break;
    }
}

function isMenuState(state) { return [GameState.MAIN_MENU, GameState.NICKNAME, GameState.LEADERBOARD, GameState.SETTINGS, GameState.LEVEL_SELECT, GameState.LEVEL_INSTRUCTIONS, GameState.PAUSED, GameState.LEVEL_END].includes(state); }

function handleMenuAction(eventOrAction) {
    let action = null, element = null;
    if (inputCooldownTimer > 0) return;
    if (eventOrAction instanceof Event) {
        const target = eventOrAction.target.closest('[data-action]');
        if (!target) return;
        action = target.dataset.action;
        element = target;
        if (element.tagName === 'A' && action !== 'link') eventOrAction.preventDefault();
        if (action === 'toggle-labels' || action === 'toggle-sound') return;
    } else if (eventOrAction?.action) {
        action = eventOrAction.action;
        element = eventOrAction.element;
        if (action === 'toggle-labels') { inputCooldownTimer = INPUT_COOLDOWN_DURATION; return; }
        if (action === 'toggle-sound') {
            element.checked = !element.checked;
            element.dispatchEvent(new Event('change', { bubbles: true }));
            inputCooldownTimer = INPUT_COOLDOWN_DURATION;
            return;
        }
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
            case 'import-level': importLevelByCode(); break;
            case 'save-roadmap': downloadRoadmap(); break;
            case 'edit-level': if (!isNaN(idx)) prepareEditLevel(idx); break;
            case 'duplicate': if (!isNaN(idx)) duplicateLevel(idx); break;
            case 'share-level': if (!isNaN(idx)) shareLevel(idx); break;
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
        case 'save-nickname':
            saveManager.setPlayerNickname(uiManager.nicknameInput?.value);
            changeGameState(GameState.MAIN_MENU);
            break;
        case 'leaderboard': {
            const completedIndex = parseInt(uiManager.levelEndScreen.dataset.levelIndex, 10);
            const completedLevel = currentGameState === GameState.LEVEL_END ? levelDatabase[completedIndex] : null;
            openLeaderboard(completedLevel && !completedLevel.customId ? leaderboardScopeForLevel(completedLevel) : 'all');
            break;
        }
        case 'leaderboard-tab': openLeaderboard(element.dataset.scope || 'all'); break;
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
            if (!isNaN(currentLevelIdx) && nextLevelIndex < officialLevelDatabase.length && saveManager.isLevelUnlocked(nextLevelIndex)) prepareStartLevel(nextLevelIndex);
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
        const isCustom = Boolean(level.customId);

        // Sanitize and append title / info
        const infoDiv = document.createElement('div');
        infoDiv.className = 'editor-level-info';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'level-name-display';
        nameSpan.textContent = level.name;
        infoDiv.appendChild(nameSpan);

        const badgeSpan = document.createElement('span');
        badgeSpan.className = 'level-id-badge';
        const displayId = level.levelId || (level.origin?.onlineId ? `online:${level.origin.onlineId.slice(-6)}` : level.customId) || index;
        badgeSpan.textContent = `ID: ${displayId} | ${isCustom ? 'Local' : 'Official'}`;
        infoDiv.appendChild(badgeSpan);

        row.appendChild(infoDiv);

        // Append action buttons safely
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'editor-level-actions';

        const editBtn = document.createElement('button');
        editBtn.className = 'icon-btn';
        editBtn.dataset.action = 'edit-level';
        editBtn.dataset.index = index;
        editBtn.title = 'Edit';
        editBtn.textContent = '✏️';
        actionsDiv.appendChild(editBtn);

        const dupBtn = document.createElement('button');
        dupBtn.className = 'icon-btn';
        dupBtn.dataset.action = 'duplicate';
        dupBtn.dataset.index = index;
        dupBtn.title = isCustom ? 'Duplicate' : 'Save Copy';
        dupBtn.textContent = '📋';
        actionsDiv.appendChild(dupBtn);

        if (isCustom) {
            const shareBtn = document.createElement('button');
            shareBtn.className = 'icon-btn';
            shareBtn.dataset.action = 'share-level';
            shareBtn.dataset.index = index;
            shareBtn.title = level.origin?.onlineId ? 'Update Online' : 'Publish Online';
            shareBtn.textContent = '🌐';
            actionsDiv.appendChild(shareBtn);

            const delBtn = document.createElement('button');
            delBtn.className = 'icon-btn delete';
            delBtn.dataset.action = 'delete-level';
            delBtn.dataset.index = index;
            delBtn.title = 'Delete';
            delBtn.textContent = '🗑️';
            actionsDiv.appendChild(delBtn);
        }

        row.appendChild(actionsDiv);
        container.appendChild(row);
    });
}

function createNewLevel() {
    const newId = levelDatabase.length > 0 ? Math.max(...levelDatabase.map(l => l.levelId || 0)) + 1 : 1;
    const newData = {
        levelId: newId,
        name: `New Level ${newId}`,
        duration: 180,
        starThresholds: [100, 200, 300],
        availableMeals: [],
        maxActiveOrders: 2,
        newOrderDelay: 15,
        layout: [],
        source: 'local'
    };

    if (saveManager) {
        saveManager.saveCustomLevel(newData);
        refreshPlayableLevelDatabase();
    } else {
        levelDataCache[`custom:${newId}`] = cloneData(newData);
        levelDatabase.push({ ...newData, customId: `temp-${newId}` });
    }
    renderEditorHub();
}

async function shareLevel(index) {
    const entry = levelDatabase[index];
    if (!entry || !entry.customId) return;

    try {
        uiManager.showTemporaryMessage('Publishing online...', 3000);
        const data = await getLevelData(entry);
        if (!data) {
            alert("Error: Could not retrieve level data.");
            return;
        }

        let nickname = saveManager.getPlayerNickname();
        if (!nickname) {
            nickname = prompt("Enter your nickname for community credits:") || 'Chef';
            saveManager.setPlayerNickname(nickname);
        }

        const onlineId = entry.origin?.onlineId || null;
        const result = await onlineServices.publishCustomLevel({
            token: saveManager.getPlayerProfile().token,
            nickname,
            name: entry.name,
            data: data,
            id: onlineId
        });

        if (result.id) {
            const updatedOrigin = { type: 'online', onlineId: result.id };
            saveManager.saveCustomLevel(data, entry.customId, updatedOrigin);
            refreshPlayableLevelDatabase();
            renderEditorHub();
            await navigator.clipboard.writeText(result.id).catch(() => {});
            alert(`Level published successfully!\nShare Code: ${result.id}\n(Copied to clipboard)`);
        }
    } catch (error) {
        console.error("Publish failed:", error);
        alert(`Failed to publish level: ${error.message}`);
    }
}

async function importLevelByCode() {
    const code = prompt("Enter Level Share Code (UUID):")?.trim();
    if (!code) return;

    try {
        uiManager.showTemporaryMessage('Importing level...', 3000);
        const levelData = await onlineServices.fetchCustomLevel(code);
        if (levelData && levelData.data) {
            const imported = saveManager.saveCustomLevel({
                ...levelData.data,
                name: levelData.name || 'Imported Level',
            }, null, { type: 'online', onlineId: levelData.id });

            levelDataCache[`custom:${imported.customId}`] = cloneData(imported);
            refreshPlayableLevelDatabase();
            renderEditorHub();
            uiManager.showTemporaryMessage('Level imported successfully!', 2000);
        }
    } catch (error) {
        console.error("Import failed:", error);
        alert(`Failed to import level: ${error.message}`);
    }
}

function deleteLevel(index) {
    const entry = levelDatabase[index];
    if (!entry?.customId) return;
    if (!confirm("Delete this local level?")) return;
    if (saveManager) {
        saveManager.deleteCustomLevel(entry.customId);
        refreshPlayableLevelDatabase();
    }
    renderEditorHub();
}

function leaderboardScopeForLevel(level) {
    return `level:${level.levelId}`;
}

function leaderboardTitleForScope(scope) {
    if (scope === 'all') return uiManager?.uiText?.[uiManager.currentLanguage]?.leaderboard || 'Leaderboard';
    const levelId = scope.replace('level:', '');
    const level = officialLevelDatabase.find(entry => String(entry.levelId) === levelId);
    return level ? `Level ${level.levelId}: ${level.name}` : 'Leaderboard';
}

async function openLeaderboard(scope = 'all') {
    currentLeaderboardState = {
        scope,
        rows: [],
        title: leaderboardTitleForScope(scope),
        statusText: uiManager?.uiText?.[uiManager.currentLanguage]?.leaderboardLoading || 'Loading scores...'
    };
    changeGameState(GameState.LEADERBOARD);

    try {
        const rows = await onlineServices.fetchLeaderboard(scope);
        currentLeaderboardState = { ...currentLeaderboardState, rows, statusText: '' };
    } catch (error) {
        console.warn('Leaderboard unavailable:', error);
        currentLeaderboardState = { ...currentLeaderboardState, rows: [], statusText: 'Leaderboard is temporarily unavailable.' };
    }

    if (currentGameState === GameState.LEADERBOARD) {
        uiManager.showLeaderboard(currentLeaderboardState.scope, currentLeaderboardState.rows, currentLeaderboardState.title, currentLeaderboardState.statusText);
        menuManager.activateMenu(uiManager.leaderboardScreen);
    }
}

async function submitLeaderboardScore(levelIndex, score, stars) {
    const level = levelDatabase[levelIndex];
    if (!level || level.customId || !onlineServices) return;
    try {
        await onlineServices.submitScore({
            ...saveManager.getPlayerProfile(),
            levelKey: leaderboardScopeForLevel(level),
            score,
            stars
        });
    } catch (error) {
        console.warn('Score was saved locally but could not be submitted online:', error);
    }
}

function saveEditedLevelLocally(levelData, sourceEntry) {
    const origin = sourceEntry?.customId ? sourceEntry.origin : sourceEntry ? {
        type: 'official',
        levelId: sourceEntry.levelId,
        sourceKey: saveManager.resolveLevelKey(sourceEntry)
    } : null;
    const existingCopy = sourceEntry?.customId ? sourceEntry : origin?.sourceKey ? saveManager.findCustomLevelBySource(origin.sourceKey) : null;
    const saved = saveManager.saveCustomLevel(levelData, existingCopy?.customId, origin);
    levelDataCache[`custom:${saved.customId}`] = cloneData(saved);
    currentEditingLevelEntry = saved;
    refreshPlayableLevelDatabase();
    uiManager.showTemporaryMessage('Level saved locally', 1800);
}

// Fetch logic helper
async function getLevelData(entry) {
    const cacheKey = entry.customId ? `custom:${entry.customId}` : entry.filename || `level:${entry.levelId}`;

    if (levelDataCache[cacheKey]) {
        return cloneData(levelDataCache[cacheKey]);
    }

    if (entry.customId && saveManager) {
        const customLevel = saveManager.getCustomLevel(entry.customId);
        if (customLevel) {
            levelDataCache[cacheKey] = cloneData(customLevel);
            return cloneData(customLevel);
        }
    }

    if (entry.data) {
        levelDataCache[cacheKey] = cloneData(entry.data);
        return cloneData(entry.data);
    }

    try {
        if (!entry.filename) throw new Error('Missing level filename');
        const res = await fetch(`levels/${entry.filename}`);
        if (!res.ok) throw new Error("File not found");
        const data = await res.json();
        levelDataCache[cacheKey] = data; // Cache it
        return data;
    } catch (e) {
        console.warn(`Could not load ${entry.filename || entry.customId}, creating empty template.`);
        const tmpl = { levelId: entry.levelId, name: entry.name, layout: [] };
        levelDataCache[cacheKey] = tmpl;
        return tmpl;
    }
}

async function duplicateLevel(index) {
    const sourceEntry = levelDatabase[index];
    const sourceData = await getLevelData(sourceEntry);

    const newId = Math.max(...levelDatabase.map(l => l.levelId || 0)) + 1;

    // Clone data
    const newData = JSON.parse(JSON.stringify(sourceData));
    newData.levelId = newId;
    newData.name = `${sourceData.name} (Copy)`;
    newData.source = 'local';

    if (saveManager) {
        const saved = saveManager.saveCustomLevel(newData);
        levelDataCache[`custom:${saved.customId}`] = cloneData(saved);
        refreshPlayableLevelDatabase();
    }

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
        const { stations, stationInteractables, floorMesh } = buildKitchen(scene, data.layout || [], data.theme);
        interactionManager.updateWorldData(stations, stationInteractables, floorMesh);
        
        // Initialize Editor with this data
        currentEditingLevelEntry = entry;
        levelEditor.loadLevel(data, entry);
        
        uiManager.hideLoading();
        changeGameState(GameState.EDITOR);
    } catch (e) {
        console.error(e);
        uiManager.hideLoading();
        alert("Failed to load level for editing");
    }
}

function downloadRoadmap() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(officialLevelDatabase, null, 2));
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
        
        const { stations, stationInteractables, floorMesh } = buildKitchen(scene, levelData.layout, levelData.theme);
        interactionManager.updateWorldData(stations, stationInteractables, floorMesh);
        
        pendingLevelIndex = levelIndex;
        pendingLevelData = levelData;
        currentLevelData = null;
        uiManager.setCurrentLevelData(null);
        
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
    uiManager.setCurrentLevelData(currentLevelData);
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
    submitLeaderboardScore(levelIndex, score, stars);
    currentLevelData = null;
    const hasNextLevel = (levelIndex + 1) < officialLevelDatabase.length;
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
            interactionManager.update(delta);
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
        changeGameState(saveManager.getPlayerNickname() ? GameState.MAIN_MENU : GameState.NICKNAME);
        animate();
    } catch (error) {
        console.error(error);
    }
}
runGame();
