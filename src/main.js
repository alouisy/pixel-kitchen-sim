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
    GAME_COMPLETED: 'GAME_COMPLETED',
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
let currentPlayingCommunityLevel = null;
let pendingPublishIndex = -1;
let communityLevelsState = {
    page: 1,
    sortBy: 'newest',
    levels: [],
    hasMore: false,
    loading: false
};
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
        loadCommunityLevels().catch(err => console.error("Initial load of community levels failed:", err));
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

    // Unify Escape / Pause Menu flow: when PointerLock is unlocked while playing, pause the game
    playerControls._pointerLockControls.addEventListener('unlock', () => {
        if (currentGameState === GameState.GAME_RUNNING) {
            pauseGame();
        }
    });

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

    const commSelect = document.getElementById('leaderboard-community-select');
    if (commSelect) {
        commSelect.addEventListener('change', (e) => {
            const scope = e.target.value;
            if (scope) {
                const buttons = document.querySelectorAll('#leaderboard-official-buttons button');
                buttons.forEach(btn => btn.classList.remove('selected'));
                openLeaderboard(scope);
            }
        });
    }

    // Community level sorting
    const communitySort = document.getElementById('community-sort');
    if (communitySort) {
        communitySort.addEventListener('change', (e) => {
            communityLevelsState.sortBy = e.target.value;
            communityLevelsState.page = 1;
            loadCommunityLevels();
        });
    }

    // Community pagination buttons
    const prevBtn = document.getElementById('community-prev-btn');
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (communityLevelsState.page > 1) {
                communityLevelsState.page--;
                loadCommunityLevels();
            }
        });
    }

    const nextBtn = document.getElementById('community-next-btn');
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (communityLevelsState.hasMore) {
                communityLevelsState.page++;
                loadCommunityLevels();
            }
        });
    }

    // Confirm/Cancel buttons inside Publish Level Modal
    const publishConfirm = document.getElementById('publish-confirm-btn');
    if (publishConfirm) {
        publishConfirm.addEventListener('click', async () => {
            if (pendingPublishIndex === -1) return;
            
            const descInput = document.getElementById('publish-level-description');
            const diffInput = document.getElementById('publish-level-difficulty');
            const description = descInput ? descInput.value.trim() : '';
            const difficulty = diffInput ? parseInt(diffInput.value, 10) : 3;
            
            const modal = document.getElementById('publish-level-modal');
            if (modal) modal.style.display = 'none';
            
            await executePublishLevel(pendingPublishIndex, description, difficulty);
            pendingPublishIndex = -1;
        });
    }

    const publishCancel = document.getElementById('publish-cancel-btn');
    if (publishCancel) {
        publishCancel.addEventListener('click', () => {
            const modal = document.getElementById('publish-level-modal');
            if (modal) modal.style.display = 'none';
            pendingPublishIndex = -1;
        });
    }

    // Stars rating system for community levels
    const ratingSection = document.getElementById('community-rating-section');
    if (ratingSection) {
        const stars = ratingSection.querySelectorAll('.rate-star');
        stars.forEach(star => {
            // Hover effect
            star.addEventListener('mouseenter', (e) => {
                const hoverRating = parseInt(e.target.dataset.rating, 10);
                stars.forEach((s, idx) => {
                    if (idx < hoverRating) {
                        s.textContent = '★';
                        s.style.color = '#ffeb3b';
                    } else {
                        s.textContent = '☆';
                        s.style.color = '#666';
                    }
                });
            });
            
            // Revert hover when mouse leaves
            const starRatingContainer = ratingSection.querySelector('.star-rating');
            if (starRatingContainer) {
                starRatingContainer.addEventListener('mouseleave', () => {
                    const activeRating = parseInt(ratingSection.dataset.selectedRating || '0', 10);
                    stars.forEach((s, idx) => {
                        if (idx < activeRating) {
                            s.textContent = '★';
                            s.style.color = '#ffeb3b';
                        } else {
                            s.textContent = '☆';
                            s.style.color = '#666';
                        }
                    });
                });
            }

            // Click to submit rating
            star.addEventListener('click', async (e) => {
                const rating = parseInt(e.target.dataset.rating, 10);
                ratingSection.dataset.selectedRating = rating;
                
                stars.forEach((s, idx) => {
                    if (idx < rating) {
                        s.textContent = '★';
                        s.style.color = '#ffeb3b';
                    } else {
                        s.textContent = '☆';
                        s.style.color = '#666';
                    }
                });

                const statusMsg = document.getElementById('rating-status-message');
                if (statusMsg) {
                    statusMsg.textContent = 'Submitting rating...';
                    statusMsg.style.color = '#aaa';
                }

                if (!currentPlayingCommunityLevel || !currentPlayingCommunityLevel.id) {
                    if (statusMsg) {
                        statusMsg.textContent = 'Error: Level ID not found.';
                        statusMsg.style.color = '#f44336';
                    }
                    return;
                }

                try {
                    await onlineServices.submitLevelRating({
                        levelId: currentPlayingCommunityLevel.id,
                        token: saveManager.getPlayerProfile().token,
                        rating: rating
                    });
                    if (statusMsg) {
                        statusMsg.textContent = 'Rating submitted! Thank you!';
                        statusMsg.style.color = '#4caf50';
                    }
                } catch (error) {
                    console.error("Submit rating failed:", error);
                    if (statusMsg) {
                        statusMsg.textContent = `Failed: ${error.message}`;
                        statusMsg.style.color = '#f44336';
                    }
                }
            });
        });
    }
}

function changeGameState(newState) {
    const previousState = currentGameState;
    if (isMenuState(previousState) && !isMenuState(newState) && newState !== GameState.EDITOR_HUB) menuManager.deactivateMenu();
    
    if (previousState === GameState.GAME_RUNNING && newState !== GameState.GAME_RUNNING) {
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
        case GameState.LEVEL_SELECT: {
            const tabOfficial = document.getElementById('tab-official');
            const tabMyLevels = document.getElementById('tab-my-levels');
            const tabCommunity = document.getElementById('tab-community');
            const officialContainer = document.getElementById('official-levels-container');
            const myLevelsContainer = document.getElementById('my-levels-container');
            const communityContainer = document.getElementById('community-levels-container');
            
            if (tabOfficial) tabOfficial.classList.add('selected');
            if (tabMyLevels) tabMyLevels.classList.remove('selected');
            if (tabCommunity) tabCommunity.classList.remove('selected');
            if (officialContainer) officialContainer.style.display = 'block';
            if (myLevelsContainer) myLevelsContainer.style.display = 'none';
            if (communityContainer) communityContainer.style.display = 'none';

            const officialLevelsOnly = levelDatabase.filter(l => !l.customId);
            uiManager.populateLevelSelect(officialLevelsOnly, saveManager);
            uiManager.showLevelSelect();
            menuManager.activateMenu(uiManager.levelSelectScreen);
            break;
        }
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
        case GameState.GAME_COMPLETED: currentLevelData = null; uiManager.setCurrentLevelData(null); menuManager.activateMenu(uiManager.gameCompletedScreen); break;
        case GameState.LOADING: uiManager.showLoading(); menuManager.deactivateMenu(); break;
    }
}

function isMenuState(state) { return [GameState.MAIN_MENU, GameState.NICKNAME, GameState.LEADERBOARD, GameState.SETTINGS, GameState.LEVEL_SELECT, GameState.LEVEL_INSTRUCTIONS, GameState.PAUSED, GameState.LEVEL_END, GameState.GAME_COMPLETED].includes(state); }

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
        case 'toggle-level-tab': {
            const tab = element.dataset.tab;
            const tabOfficial = document.getElementById('tab-official');
            const tabMyLevels = document.getElementById('tab-my-levels');
            const tabCommunity = document.getElementById('tab-community');
            const officialContainer = document.getElementById('official-levels-container');
            const myLevelsContainer = document.getElementById('my-levels-container');
            const communityContainer = document.getElementById('community-levels-container');
            
            if (tab === 'official') {
                if (tabOfficial) tabOfficial.classList.add('selected');
                if (tabMyLevels) tabMyLevels.classList.remove('selected');
                if (tabCommunity) tabCommunity.classList.remove('selected');
                if (officialContainer) officialContainer.style.display = 'block';
                if (myLevelsContainer) myLevelsContainer.style.display = 'none';
                if (communityContainer) communityContainer.style.display = 'none';
                if (menuManager) menuManager.refreshFocusableElements();
            } else if (tab === 'my-levels') {
                if (tabOfficial) tabOfficial.classList.remove('selected');
                if (tabMyLevels) tabMyLevels.classList.add('selected');
                if (tabCommunity) tabCommunity.classList.remove('selected');
                if (officialContainer) officialContainer.style.display = 'none';
                if (myLevelsContainer) myLevelsContainer.style.display = 'block';
                if (communityContainer) communityContainer.style.display = 'none';
                
                renderMyLevelsList();
            } else if (tab === 'community') {
                if (tabOfficial) tabOfficial.classList.remove('selected');
                if (tabMyLevels) tabMyLevels.classList.remove('selected');
                if (tabCommunity) tabCommunity.classList.add('selected');
                if (officialContainer) officialContainer.style.display = 'none';
                if (myLevelsContainer) myLevelsContainer.style.display = 'none';
                if (communityContainer) communityContainer.style.display = 'block';
                
                communityLevelsState.page = 1;
                loadCommunityLevels();
            }
            break;
        }
        case 'play-community-level': {
            const onlineId = element.dataset.onlineId;
            if (onlineId) {
                prepareStartCommunityLevel(onlineId);
            }
            break;
        }
        case 'play': changeGameState(GameState.LEVEL_SELECT); break;
        case 'save-nickname':
            saveManager.setPlayerNickname(uiManager.nicknameInput?.value);
            changeGameState(GameState.MAIN_MENU);
            break;
        case 'leaderboard': {
            if (currentPlayingCommunityLevel) {
                openLeaderboard(`custom:${currentPlayingCommunityLevel.id}`);
            } else {
                const completedIndex = parseInt(uiManager.levelEndScreen.dataset.levelIndex, 10);
                const completedLevel = currentGameState === GameState.LEVEL_END ? levelDatabase[completedIndex] : null;
                openLeaderboard(completedLevel && !completedLevel.customId ? leaderboardScopeForLevel(completedLevel) : 'all');
            }
            break;
        }
        case 'leaderboard-tab': openLeaderboard(element.dataset.scope || 'all'); break;
        case 'leaderboard-category': {
            const category = element.dataset.category;
            const tabGlobal = document.getElementById('leaderboard-tab-global');
            const tabLevels = document.getElementById('leaderboard-tab-levels');
            const globalOptions = document.getElementById('leaderboard-global-options');
            const levelOptions = document.getElementById('leaderboard-level-options');
            
            if (category === 'global') {
                if (tabGlobal) tabGlobal.classList.add('selected');
                if (tabLevels) tabLevels.classList.remove('selected');
                if (globalOptions) globalOptions.style.display = 'flex';
                if (levelOptions) levelOptions.style.display = 'none';
                
                const activeGlobalBtn = document.querySelector('#leaderboard-global-options .selected') 
                    || document.getElementById('leaderboard-btn-global-official');
                const scope = activeGlobalBtn?.dataset.scope || 'global:official';
                openLeaderboard(scope);
            } else if (category === 'levels') {
                if (tabGlobal) tabGlobal.classList.remove('selected');
                if (tabLevels) tabLevels.classList.add('selected');
                if (globalOptions) globalOptions.style.display = 'none';
                if (levelOptions) levelOptions.style.display = 'flex';
                
                const activeLevelBtn = document.querySelector('#leaderboard-official-buttons .selected');
                const selectEl = document.getElementById('leaderboard-community-select');
                if (selectEl && selectEl.value) {
                    openLeaderboard(selectEl.value);
                } else if (activeLevelBtn) {
                    openLeaderboard(activeLevelBtn.dataset.scope);
                } else {
                    const lvl1Btn = document.querySelector('#leaderboard-official-buttons button[data-scope="level:1"]');
                    if (lvl1Btn) lvl1Btn.classList.add('selected');
                    openLeaderboard('level:1');
                }
            }
            break;
        }
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
        case 'set-controller-type':
            const cType = element.dataset.type;
            uiManager.setControllerType(cType);
            saveManager.saveSetting('controllerType', cType); // Persist
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
            if (levelToRestart === -999) {
                if (currentPlayingCommunityLevel) {
                    prepareStartCommunityLevel(currentPlayingCommunityLevel.id);
                } else {
                    changeGameState(GameState.LEVEL_SELECT);
                }
            } else if (!isNaN(levelToRestart) && levelToRestart >= 0) {
                prepareStartLevel(levelToRestart);
            } else {
                prepareStartLevel(0);
            }
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
    const customLevelsCount = levelDatabase.filter(l => l.customId).length + 1;
    const newData = {
        name: `Custom Level ${customLevelsCount}`,
        duration: 180,
        starThresholds: [100, 200, 300],
        availableMeals: [],
        maxActiveOrders: 2,
        newOrderDelay: 15,
        layout: [],
        source: 'local'
    };

    if (saveManager) {
        const saved = saveManager.saveCustomLevel(newData);
        levelDataCache[`custom:${saved.customId}`] = cloneData(saved);
        refreshPlayableLevelDatabase();
    } else {
        const tempId = `temp-${Date.now()}`;
        const saved = { ...newData, customId: tempId, levelId: `custom-${tempId.slice(-6)}` };
        levelDataCache[`custom:${tempId}`] = cloneData(saved);
        levelDatabase.push(saved);
    }
    renderEditorHub();
}

function shareLevel(index) {
    const entry = levelDatabase[index];
    if (!entry || !entry.customId) return;

    pendingPublishIndex = index;
    
    // Open the publish modal
    const modal = document.getElementById('publish-level-modal');
    if (modal) {
        modal.style.display = 'flex';
        // Populate inputs if they already have defaults or are previously typed
        document.getElementById('publish-level-description').value = entry.description || '';
        document.getElementById('publish-level-difficulty').value = entry.difficulty || '3';
    }
}

async function executePublishLevel(index, description, difficulty) {
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
            description,
            difficulty,
            data: data,
            id: onlineId
        });

        if (result.id) {
            const updatedOrigin = { type: 'online', onlineId: result.id };
            entry.description = description;
            entry.difficulty = difficulty;
            saveManager.saveCustomLevel(entry, entry.customId, updatedOrigin);
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
    const text = uiManager?.uiText?.[uiManager.currentLanguage] || {};
    if (scope === 'all' || scope === 'global:official') {
        return text.globalLeaderboardOfficial || 'Official Global Leaderboard';
    }
    if (scope === 'global:community') {
        return text.globalLeaderboardCommunity || 'Community Global Leaderboard';
    }
    if (scope.startsWith('custom:')) {
        const id = scope.replace('custom:', '');
        if (currentPlayingCommunityLevel && currentPlayingCommunityLevel.id === id) {
            return `🏆 ${currentPlayingCommunityLevel.name}`;
        }
        const select = document.getElementById('leaderboard-community-select');
        if (select) {
            const opt = select.querySelector(`option[value="${scope}"]`);
            if (opt) return `🏆 ${opt.textContent}`;
        }
        return text.communityLeaderboardTitle || 'Community Level Leaderboard';
    }
    const levelId = scope.replace('level:', '');
    const level = officialLevelDatabase.find(entry => String(entry.levelId) === levelId);
    return level ? `${text.level || 'Level'} ${level.levelId}: ${level.name}` : (text.leaderboard || 'Leaderboard');
}

async function openLeaderboard(scope = 'all') {
    currentLeaderboardState = {
        scope,
        rows: [],
        title: leaderboardTitleForScope(scope),
        statusText: uiManager?.uiText?.[uiManager.currentLanguage]?.leaderboardLoading || 'Loading scores...'
    };
    changeGameState(GameState.LEADERBOARD);

    await populateCommunityLeaderboardSelect(scope).catch(console.error);

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

async function populateCommunityLeaderboardSelect(selectedValue = '') {
    const select = document.getElementById('leaderboard-community-select');
    if (!select) return;

    select.innerHTML = '';
    
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = '-- Select Community Level --';
    defaultOpt.disabled = true;
    if (!selectedValue || !selectedValue.startsWith('custom:')) defaultOpt.selected = true;
    select.appendChild(defaultOpt);

    try {
        if (!onlineServices) return;
        const response = await onlineServices.listCommunityLevels({ limit: 50 });
        const levels = response?.levels || [];
        
        levels.forEach(level => {
            const opt = document.createElement('option');
            opt.value = `custom:${level.id}`;
            opt.textContent = `${level.name} (by ${level.nickname})`;
            if (selectedValue === `custom:${level.id}`) {
                opt.selected = true;
            }
            select.appendChild(opt);
        });
    } catch (error) {
        console.warn('Failed to load community levels for select:', error);
    }
}

async function submitLeaderboardScore(levelIndex, score, stars) {
    if (levelIndex === -999) {
        if (!currentPlayingCommunityLevel || !onlineServices) return;
        try {
            await onlineServices.submitScore({
                ...saveManager.getPlayerProfile(),
                levelKey: `custom:${currentPlayingCommunityLevel.id}`,
                score,
                stars
            });
            console.log('Community level score submitted successfully');
        } catch (error) {
            console.warn('Community score could not be submitted online:', error);
        }
        return;
    }

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

    const cleanData = { ...levelData };
    delete cleanData.levelId;

    if (origin && origin.type === 'official' && !sourceEntry?.customId) {
        // Appending (Custom) to custom variant
        if (!cleanData.name.includes('(Custom)')) {
            cleanData.name = `${sourceEntry.name} (Custom)`;
        }
    }

    const existingCopy = sourceEntry?.customId ? sourceEntry : origin?.sourceKey ? saveManager.findCustomLevelBySource(origin.sourceKey) : null;
    const saved = saveManager.saveCustomLevel(cleanData, existingCopy?.customId, origin);
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

    // Clone data
    const newData = JSON.parse(JSON.stringify(sourceData));
    delete newData.levelId;
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
    if ((pendingLevelIndex < 0 && pendingLevelIndex !== -999) || !pendingLevelData || !levelManager) { changeGameState(GameState.LEVEL_SELECT); return; }
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
        if (interactionManager.currentlyHighlightedObject) {
            interactionManager.revertObjectHighlight(interactionManager.currentlyHighlightedObject);
            interactionManager.currentlyHighlightedObject = null;
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
    if (levelIndex !== -999) {
        submitLeaderboardScore(levelIndex, score, stars);
    } else {
        submitLeaderboardScore(-999, score, stars);
    }
    
    let showCongrats = false;
    if (levelIndex === 4) { // Official Level 5
        const wasCompletedBefore = saveManager.isGameCompleted();
        if (!wasCompletedBefore) {
            showCongrats = true;
            saveManager.setGameCompleted(true);
        }
    }

    currentLevelData = null;
    const isCommunityLevel = levelIndex === -999;
    const hasNextLevel = !isCommunityLevel && (levelIndex + 1) < officialLevelDatabase.length;
    
    if (showCongrats) {
        uiManager.showGameCompletedCongrats(score, stars);
        changeGameState(GameState.GAME_COMPLETED);
    } else {
        uiManager.showLevelEnd(score, stars, levelIndex, hasNextLevel, isCommunityLevel);
        changeGameState(GameState.LEVEL_END);
    }
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
                player.update(delta, playerControls.getMovementInput(delta));
                interactionManager.updateAimHighlight();
                if (inputCooldownTimer <= 0 && playerControls.consumeInteractionRequest()) interactionManager.handleInteractionRequest();
                if (uiManager) uiManager.updateHolding(player.getHeldItemName());
            } else {
                 if (uiManager) uiManager.updateHolding(null);
                 if (interactionManager.currentlyHighlightedObject) { interactionManager.revertObjectHighlight(interactionManager.currentlyHighlightedObject); interactionManager.currentlyHighlightedObject = null; }
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


async function loadCommunityLevels() {
    const listContainer = document.getElementById('community-level-list');
    if (!listContainer) return;
    
    listContainer.innerHTML = '<div style="grid-column: 1/-1; text-align: center; font-family: monospace; padding: 20px; color: #888;">Loading community levels...</div>';
    communityLevelsState.loading = true;
    
    updateCommunityPaginationButtons(true);
    
    try {
        const response = await onlineServices.listCommunityLevels({
            page: communityLevelsState.page,
            sortBy: communityLevelsState.sortBy,
            limit: 6 // Show 6 per page
        });
        
        communityLevelsState.levels = response.levels || [];
        communityLevelsState.hasMore = response.hasMore || false;
        
        renderCommunityLevelsList();
    } catch (error) {
        console.error("Error loading community levels:", error);
        listContainer.innerHTML = '<div style="grid-column: 1/-1; text-align: center; font-family: monospace; padding: 20px; color: #f44;">Failed to load community levels.</div>';
    } finally {
        communityLevelsState.loading = false;
        updateCommunityPaginationButtons(false);
    }
}

function updateCommunityPaginationButtons(disabled) {
    const prevBtn = document.getElementById('community-prev-btn');
    const nextBtn = document.getElementById('community-next-btn');
    const pageDisplay = document.getElementById('community-current-page');
    
    if (pageDisplay) pageDisplay.textContent = communityLevelsState.page;
    if (prevBtn) prevBtn.disabled = disabled || communityLevelsState.page <= 1;
    if (nextBtn) nextBtn.disabled = disabled || !communityLevelsState.hasMore;
}

function renderCommunityLevelsList() {
    const listContainer = document.getElementById('community-level-list');
    if (!listContainer) return;
    
    listContainer.innerHTML = '';
    
    const onlineLevels = communityLevelsState.levels || [];
    
    if (onlineLevels.length === 0) {
        const lang = uiManager ? uiManager.currentLanguage : 'en';
        const noLevelsText = (uiManager && uiManager.uiText && uiManager.uiText[lang] && uiManager.uiText[lang].noCommunityLevels) || "No community levels available yet.";
        listContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; font-family: monospace; padding: 20px; color: #888;">${noLevelsText}</div>`;
        return;
    }
    
    onlineLevels.forEach(level => {
        const card = document.createElement('div');
        card.className = 'menu-button level-button community-level-card';
        card.style.height = 'auto';
        card.style.padding = '15px';
        card.style.flexDirection = 'column';
        card.style.alignItems = 'flex-start';
        card.style.textAlign = 'left';
        card.style.cursor = 'pointer';
        card.dataset.onlineId = level.id;
        card.dataset.action = 'play-community-level';
        
        const nameEl = document.createElement('div');
        nameEl.style.fontWeight = 'bold';
        nameEl.style.fontSize = '16px';
        nameEl.style.marginBottom = '5px';
        nameEl.style.color = '#fff';
        nameEl.textContent = level.name;
        card.appendChild(nameEl);
        
        const authorEl = document.createElement('div');
        authorEl.style.fontSize = '12px';
        authorEl.style.color = '#888';
        authorEl.style.marginBottom = '8px';
        authorEl.textContent = `By ${level.nickname || 'Chef'}`;
        card.appendChild(authorEl);
        
        const descEl = document.createElement('div');
        descEl.style.fontSize = '13px';
        descEl.style.color = '#ccc';
        descEl.style.marginBottom = '10px';
        descEl.style.fontStyle = 'italic';
        descEl.style.lineHeight = '1.3';
        descEl.textContent = level.description || 'No description provided.';
        card.appendChild(descEl);
        
        const metaRow = document.createElement('div');
        metaRow.style.display = 'flex';
        metaRow.style.justifyContent = 'space-between';
        metaRow.style.width = '100%';
        metaRow.style.fontSize = '12px';
        metaRow.style.fontFamily = 'monospace';
        
        const diffSpan = document.createElement('span');
        diffSpan.style.color = '#ff9800';
        diffSpan.textContent = `Diff: ${'★'.repeat(level.difficulty || 3)}`;
        metaRow.appendChild(diffSpan);
        
        const ratingSpan = document.createElement('span');
        ratingSpan.style.color = '#ffeb3b';
        const avg = parseFloat(level.average_rating || 0).toFixed(1);
        const count = level.rating_count || 0;
        ratingSpan.textContent = `Rating: ${avg}★ (${count})`;
        metaRow.appendChild(ratingSpan);
        
        card.appendChild(metaRow);
        listContainer.appendChild(card);
    });
    if (menuManager && menuManager.activeMenuElement === document.getElementById('level-select-screen')) {
        menuManager.refreshFocusableElements();
    }
}

// Hook to trigger community levels list refresh on language change
window.onCommunityLanguageChange = renderCommunityLevelsList;

function renderMyLevelsList() {
    const listContainer = document.getElementById('my-level-list');
    if (!listContainer) return;
    
    listContainer.innerHTML = '';
    
    const localLevels = saveManager ? saveManager.getCustomLevels() : [];
    
    if (localLevels.length === 0) {
        const lang = uiManager ? uiManager.currentLanguage : 'en';
        const noLevelsText = (uiManager && uiManager.uiText && uiManager.uiText[lang] && uiManager.uiText[lang].noMyLevels) || "No custom levels created yet.";
        listContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; font-family: monospace; padding: 20px; color: #888;">${noLevelsText}</div>`;
        return;
    }
    
    localLevels.forEach(level => {
        const button = document.createElement('button');
        button.className = 'menu-button level-button';
        button.style.height = 'auto';
        button.style.padding = '15px';
        button.style.flexDirection = 'column';
        button.style.alignItems = 'center';
        button.style.textAlign = 'center';
        button.style.cursor = 'pointer';
        button.dataset.action = 'start-level';
        
        // Find global index in levelDatabase for play action
        const globalIndex = levelDatabase.findIndex(l => l.customId === level.customId);
        button.dataset.levelIndex = globalIndex >= 0 ? globalIndex : '';
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'level-name';
        nameSpan.textContent = level.name;
        button.appendChild(nameSpan);
        
        // Show if it is based on an official level
        if (level.origin && level.origin.type === 'official') {
            const basedOnSpan = document.createElement('span');
            basedOnSpan.className = 'level-custom-badge';
            basedOnSpan.style.fontSize = '11px';
            basedOnSpan.style.color = '#ff9800';
            basedOnSpan.style.marginTop = '6px';
            basedOnSpan.style.display = 'block';
            
            const lang = uiManager ? uiManager.currentLanguage : 'en';
            const basedOnText = (uiManager && uiManager.uiText && uiManager.uiText[lang] && uiManager.uiText[lang].basedOnOfficial) || "Based on Level";
            const customVersionText = (uiManager && uiManager.uiText && uiManager.uiText[lang] && uiManager.uiText[lang].customVersion) || "Custom Version";
            basedOnSpan.textContent = `${customVersionText} | ${basedOnText} ${level.origin.levelId}`;
            button.appendChild(basedOnSpan);
        } else {
            // Original custom level
            const customSpan = document.createElement('span');
            customSpan.className = 'level-custom-badge';
            customSpan.style.fontSize = '11px';
            customSpan.style.color = '#87ceeb';
            customSpan.style.marginTop = '6px';
            customSpan.style.display = 'block';
            
            const lang = uiManager ? uiManager.currentLanguage : 'en';
            const customVersionText = (uiManager && uiManager.uiText && uiManager.uiText[lang] && uiManager.uiText[lang].customVersion) || "Custom Version";
            customSpan.textContent = customVersionText;
            button.appendChild(customSpan);
        }
        
        // Render progress if completed
        const levelProgress = saveManager.getLevelProgress(level);
        if (levelProgress && levelProgress.completed) {
            const starsSpan = document.createElement('span');
            starsSpan.className = 'level-stars';
            starsSpan.style.display = 'block';
            starsSpan.style.marginTop = '5px';
            starsSpan.textContent = '★'.repeat(levelProgress.stars) + '☆'.repeat(3 - levelProgress.stars);
            button.appendChild(starsSpan);

            const scoreSpan = document.createElement('span');
            scoreSpan.className = 'level-score';
            scoreSpan.style.display = 'block';
            scoreSpan.style.fontSize = '11px';
            scoreSpan.style.marginTop = '4px';
            scoreSpan.style.color = '#fff';
            const lang = uiManager ? uiManager.currentLanguage : 'en';
            const highScoreText = (uiManager && uiManager.uiText && uiManager.uiText[lang] && uiManager.uiText[lang].highScore) || "High Score";
            scoreSpan.textContent = `${highScoreText}: ${levelProgress.highScore}`;
            button.appendChild(scoreSpan);
        }
        
        listContainer.appendChild(button);
    });
    if (menuManager && menuManager.activeMenuElement === document.getElementById('level-select-screen')) {
        menuManager.refreshFocusableElements();
    }
}

// Hook to trigger My Levels list refresh on language change
window.onMyLevelsLanguageChange = renderMyLevelsList;

async function prepareStartCommunityLevel(onlineId) {
    if (!levelManager || !interactionManager || !scene || !uiManager) { changeGameState(GameState.MAIN_MENU); return; }
    
    uiManager.showLoading();
    
    try {
        const levelDataResponse = await onlineServices.fetchCustomLevel(onlineId);
        if (!levelDataResponse || !levelDataResponse.data) {
            throw new Error("Invalid level data");
        }
        
        const levelData = levelDataResponse.data;
        levelData.levelId = onlineId;
        levelData.name = levelDataResponse.name || levelData.name || "Community Level";
        levelData.description = levelDataResponse.description || "";
        levelData.creator = levelDataResponse.nickname || "Chef";

        resetWorldState();
        clearKitchen(scene);
        
        const { stations, stationInteractables, floorMesh } = buildKitchen(scene, levelData.layout, levelData.theme);
        interactionManager.updateWorldData(stations, stationInteractables, floorMesh);
        
        pendingLevelIndex = -999; // Sentinel indicating community level
        pendingLevelData = levelData;
        currentLevelData = null;
        uiManager.setCurrentLevelData(null);
        currentPlayingCommunityLevel = {
            id: onlineId,
            name: levelData.name,
            creator: levelData.creator
        };
        
        uiManager.hideLoading();
        uiManager.showLevelInstructions(levelData, false);
        changeGameState(GameState.LEVEL_INSTRUCTIONS);
    } catch (e) {
        console.error("Failed to load community level:", e);
        uiManager.hideLoading();
        uiManager.showTemporaryMessage("Error loading community level", 2000);
        changeGameState(GameState.LEVEL_SELECT);
    }
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
