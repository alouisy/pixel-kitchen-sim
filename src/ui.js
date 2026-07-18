// src/ui.js
import { getRecipeDetails, getRecipeIngredients, RECIPES } from './gameData.js';
import { getTrans } from './i18nData.js';

function formatTime(seconds) {
    const mins = Math.floor(Math.max(0, seconds) / 60);
    const secs = Math.floor(Math.max(0, seconds) % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export class UIManager {
    constructor(saveManager) {
        this.saveManager = saveManager;
        this.loadingScreen = document.getElementById('loading-screen');
        this.mainMenu = document.getElementById('main-menu');
        this.settingsScreen = document.getElementById('settings-screen');
        this.levelSelectScreen = document.getElementById('level-select-screen');
        this.levelEndScreen = document.getElementById('level-end-screen');
        this.gameHud = document.getElementById('game-hud');
        this.levelInstructionsScreen = document.getElementById('level-instructions-screen');
        this.nicknameScreen = document.getElementById('nickname-screen');
        this.nicknameInput = document.getElementById('nickname-input');
        this.nicknameSaveButton = document.getElementById('nickname-save-button');
        this.nicknameHint = document.getElementById('nickname-hint');
        this.leaderboardScreen = document.getElementById('leaderboard-screen');
        this.leaderboardLevelTabs = document.getElementById('leaderboard-level-tabs');
        this.leaderboardList = document.getElementById('leaderboard-list');
        this.leaderboardBackButton = document.getElementById('leaderboard-back-button');
        this.gameCompletedScreen = document.getElementById('game-completed-screen');
        this.congratsScore = document.getElementById('congrats-score');
        this.congratsStars = document.getElementById('congrats-stars');

        this.orderListElement = document.getElementById('order-list');
        this.levelTimerDisplay = document.getElementById('level-timer-display');
        this.holdingDisplay = document.getElementById('holding-display');
        this.scoreDisplay = document.getElementById('score-display');
        this.gamepadStatusElement = document.getElementById('gamepad-status');
        this.crosshair = document.getElementById('crosshair');
        this.tempMessageElement = document.getElementById('temp-message');

        this.finalScoreElement = document.getElementById('final-score');
        this.finalStarsElement = document.getElementById('final-stars');
        this.languageButtons = this.settingsScreen.querySelectorAll('.lang-button');
        this.toggleLabelsCheckbox = document.getElementById('toggle-labels-setting');
        this.soundEffectsCheckbox = document.getElementById('sound-effects-setting');
        this.resumeButtonSettings = document.getElementById('resume-button-settings');
        this.languageLabel = document.getElementById('language-label');
        this.levelListContainer = document.getElementById('level-list');

        this.instructionsTitle = document.getElementById('instructions-title');
        this.instructionsContent = document.getElementById('instructions-content');
        this.startLevelInstructionsButton = document.getElementById('start-level-instructions-button');
        this.instructionsHint = this.levelInstructionsScreen.querySelector('.menu-hint');

        this.activeScreen = null;
        this.messageTimeout = null;
        this.currentLanguage = 'en';
        this.levelDatabase = [];
        this.currentLevelData = null;

        // Initial UI Dictionary
        this.uiText = {
            en: { select: "Select: Enter/[X]/[A]", title: "Pixel Kitchen Sim", play: "Play", levelEditor: "Level Editor", settings: "Settings", back: "Back", resume: "Resume Game", level: "Level", score: "Score", stars: "Stars", nextLevel: "Next Level", restartLevel: "Restart Level", mainMenu: "Main Menu", language: "Language", showLabels: "Show Station Labels:", soundEffects: "Sound Effects:", version: "Version:", selectLevel: "Select Level", paused: "Paused", holding: "Holding", nothing: "Nothing", levelComplete: "Level Complete!", allLevelsDone: "All Levels Done!", playAgain: "Play Again?", loading: "Loading Assets...", levelTime: "Level Time", highScore: "High Score", levelLocked: "Locked", levelInstructions: "Level Instructions", startLevel: "Start Level", recipe: "Recipe", close: "Close", hintToggleInstructions: "Toggle: [I] / [△/Y]", editorHubTitle: "Level Editor", createLevel: "New Level", downloadRoadmap: "Download Roadmap", backToMenu: "Back to Menu", credits: "A Game By Azzxl Studio", hintMenu: "Navigate: Arrows/Stick | Select: Enter/[X]/[A]", hintSettings: "Navigate: Arrows/Stick | Select: Enter/[X]/[A] | Back: Esc/[O]/[B]", leaderboard: "Leaderboard", nicknameTitle: "Choose Nickname", nicknameLabel: "Nickname", nicknameContinue: "Continue", nicknameHint: "Used for the online leaderboard.", leaderboardEmpty: "No scores yet. Be the first chef on the board.", leaderboardLoading: "Loading scores...", localLevel: "Local", controlsTitle: "Controls", ctrlMove: "Move", ctrlLook: "Look Around", ctrlInteract: "Interact", ctrlRecipes: "Recipes / Help", ctrlPause: "Pause / Menu", globalRanking: "Global Ranking", levelRankings: "Level Rankings", globalOfficial: "Official Levels", globalCommunity: "With Community", labelOfficial: "Official:", labelCommunity: "Community:", selectLevelOption: "-- Select a level --", globalLeaderboardOfficial: "Official Global Leaderboard", globalLeaderboardCommunity: "Community Global Leaderboard", communityLeaderboardTitle: "Community Level Leaderboard" },
            fr: { select: "Confirmer: Entrée/[X]/[A]", title: "Pixel Cuisine Sim", play: "Jouer", levelEditor: "Éditeur de Niveau", settings: "Options", back: "Retour", resume: "Reprendre", level: "Niveau", score: "Score", stars: "Étoiles", nextLevel: "Niveau Suivant", restartLevel: "Recommencer", mainMenu: "Menu Principal", language: "Langue", showLabels: "Afficher les Étiquettes:", soundEffects: "Effets sonores:", version: "Version:", selectLevel: "Choisir le Niveau", paused: "Pause", holding: "Tient", nothing: "Rien", levelComplete: "Niveau Terminé!", allLevelsDone: "Tous les Niveaux sont Finis!", playAgain: "Rejouer?", loading: "Chargement...", levelTime: "Temps du Niveau", highScore: "Meilleur Score", levelLocked: "Verrouillé", levelInstructions: "Instructions du Niveau", startLevel: "Commencer le Niveau", recipe: "Recette", close: "Fermer", hintToggleInstructions: "Basculer: [I] / [△/Y]", editorHubTitle: "Éditeur", createLevel: "Nouveau", downloadRoadmap: "Télécharger le Niveau", backToMenu: "Retour au Menu", credits: "Un jeu par Azzxl Studio", hintMenu: "Naviguer: Flèches/Stick | Confirmer: Entrée/[X]/[A]", hintSettings: "Naviguer: Flèches/Stick | Confirmer: Entrée/[X]/[A] | Retour: Échap/[O]/[B]", leaderboard: "Classement", nicknameTitle: "Choisissez un pseudo", nicknameLabel: "Pseudo", nicknameContinue: "Continuer", nicknameHint: "Utilisé pour le classement en ligne.", leaderboardEmpty: "Aucun score. Soyez le premier chef.", leaderboardLoading: "Chargement des scores...", localLevel: "Local", controlsTitle: "Contrôles", ctrlMove: "Déplacer", ctrlLook: "Regarder", ctrlInteract: "Interagir", ctrlRecipes: "Recettes / Aide", ctrlPause: "Pause / Menu", globalRanking: "Classement Général", levelRankings: "Classements par Niveau", globalOfficial: "Niveaux Officiels", globalCommunity: "Avec Communauté", labelOfficial: "Officiels :", labelCommunity: "Communauté :", selectLevelOption: "-- Choisir un niveau --", globalLeaderboardOfficial: "Classement Général Officiel", globalLeaderboardCommunity: "Classement Général de la Communauté", communityLeaderboardTitle: "Classement du Niveau de la Communauté" },
            es: { select: "Entrar: Enter/[X]/[A]", title: "Pixel Cocina Sim", play: "Jugar", levelEditor: "Editor de Niveles", settings: "Ajustes", back: "Volver", resume: "Reanudar", level: "Nivel", score: "Puntos", stars: "Estrellas", nextLevel: "Siguiente Nivel", restartLevel: "Reiniciar", mainMenu: "Menú Principal", language: "Idioma", showLabels: "Mostrar Etiquetas:", soundEffects: "Efectos de sonido:", version: "Versión:", selectLevel: "Elegir el Nivel", paused: "Pausa", holding: "Tiene", nothing: "Nada", levelComplete: "¡Nivel Completo!", allLevelsDone: "¡Todos los Niveles están Hechos!", playAgain: "¿Jugar Otra Vez?", loading: "Cargando...", levelTime: "Tiempo del Nivel", highScore: "Mejor Puntuación", levelLocked: "Bloqueado", levelInstructions: "Instrucciones del Nivel", startLevel: "Empezar el Nivel", recipe: "Receta", close: "Cerrar", hintToggleInstructions: "Alternar: [I] / [△/Y]", editorHubTitle: "Editor", createLevel: "Nuevo Nivel", downloadRoadmap: "Descargar el Nivel", backToMenu: "Volver al Menú", credits: "Un Juego De Azzxl Studio", hintMenu: "Navegar: Flechas/Stick | Entrar: Enter/[X]/[A]", hintSettings: "Navegar: Flechas/Stick | Entrar: Enter/[X]/[A] | Volver: Esc/[O]/[B]", leaderboard: "Clasificación", nicknameTitle: "Elige un apodo", nicknameLabel: "Apodo", nicknameContinue: "Continuar", nicknameHint: "Se usa para la clasificación en línea.", leaderboardEmpty: "Aún no hay puntuaciones. Sé el primer chef.", leaderboardLoading: "Cargando puntuaciones...", localLevel: "Local", controlsTitle: "Controles", ctrlMove: "Mover", ctrlLook: "Mirar", ctrlInteract: "Interactuar", ctrlRecipes: "Recetas / Ayuda", ctrlPause: "Pausa / Menú", globalRanking: "Clasificación General", levelRankings: "Clasificaciones por Nivel", globalOfficial: "Niveles Oficiales", globalCommunity: "Con Comunidad", labelOfficial: "Oficiales:", labelCommunity: "Comunidad:", selectLevelOption: "-- Elegir un nivel --", globalLeaderboardOfficial: "Clasificación General Oficial", globalLeaderboardCommunity: "Clasificación General de la Comunidad", communityLeaderboardTitle: "Clasificación del Nivel de la Comunidad" }
        };

        // Initialize Recipe Book container
        this.createRecipeBook();

        // Set Language from Save or Default
        const savedLang = this.saveManager.getSetting('language') || 'en';
        this.setLanguage(savedLang);

        // Load controller visualization preference
        const savedController = this.saveManager.getSetting('controllerType') || 'xbox';
        this.setControllerType(savedController);
        this.nicknameInput?.addEventListener('keydown', event => {
            if (event.key === 'Enter') this.nicknameSaveButton?.click();
        });
    }

    createRecipeBook() {
        const container = document.createElement('div');
        container.id = 'recipe-book-container';
        this.settingsScreen.querySelector('.menu-container').insertBefore(container, document.getElementById('back-to-main-button'));
        this.recipeBookContainer = container;
    }

    updateRecipeBook(lang) {
        if (!this.recipeBookContainer || !this.uiText || !this.uiText[lang]) return;
        this.recipeBookContainer.innerHTML = '';
        const title = document.createElement('h3');
        title.textContent = (this.uiText[lang].recipe || "Recipes") + " Book";
        title.style.color = '#FFD700';
        this.recipeBookContainer.appendChild(title);
        for (const [mealName, data] of Object.entries(RECIPES)) {
            if (data.instructions && data.instructions[lang]) {
                const entry = document.createElement('div');
                entry.className = 'recipe-entry';
                const h4 = document.createElement('h4');
                h4.textContent = getTrans(mealName, lang);
                const p = document.createElement('p');
                p.textContent = data.instructions[lang].join(" → ");
                entry.appendChild(h4); entry.appendChild(p);
                this.recipeBookContainer.appendChild(entry);
            }
        }
    }

    _setActiveScreen(screenElement) { if (this.activeScreen && this.activeScreen !== screenElement) this.activeScreen.classList.remove('active'); if (screenElement) screenElement.classList.add('active'); this.activeScreen = screenElement; }
    showLoading() { this._setActiveScreen(this.loadingScreen); }
    hideLoading() { if (this.activeScreen === this.loadingScreen) this.loadingScreen.classList.remove('active'); }
    areOfficialLevelsCompleted() {
        // Automatically unlock the level editor for local testing
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return true;
        }
        if (!this.levelDatabase || this.levelDatabase.length === 0) return false;
        const official = this.levelDatabase.filter(l => !l.customId);
        if (official.length === 0) return false;
        return official.every(l => this.saveManager.getLevelProgress(l).completed);
    }
    showMainMenu() { 
        this._setActiveScreen(this.mainMenu); 
        this.hideGameUI(); 
        
        // Lock Level Editor button if official levels are not completed
        const editorBtn = document.getElementById('editor-button');
        const lockMsg = document.getElementById('editor-lock-message');
        if (editorBtn) {
            const completed = this.areOfficialLevelsCompleted();
            editorBtn.disabled = !completed;
            if (!completed) {
                editorBtn.classList.add('locked');
                editorBtn.style.opacity = '0.5';
                editorBtn.style.cursor = 'not-allowed';
                if (lockMsg) {
                    lockMsg.style.display = 'block';
                    lockMsg.textContent = this.uiText[this.currentLanguage].editorLockedInfo || "🔒 Complete all 5 official levels to unlock";
                }
            } else {
                editorBtn.classList.remove('locked');
                editorBtn.style.opacity = '1';
                editorBtn.style.cursor = 'pointer';
                if (lockMsg) lockMsg.style.display = 'none';
            }
        }
    }
    showSettings(isPauseMenu = false) {
        this._setActiveScreen(this.settingsScreen);
        this.resumeButtonSettings.style.display = isPauseMenu ? 'block' : 'none';
        this.hideGameUI();
    }
    showLevelSelect() { this._setActiveScreen(this.levelSelectScreen); this.hideGameUI(); }
    setLevelDatabase(levelDataArray) { this.levelDatabase = Array.isArray(levelDataArray) ? levelDataArray : []; }
    setCurrentLevelData(levelData) { this.currentLevelData = levelData || null; }
    showNicknamePrompt() {
        if (this.nicknameInput) this.nicknameInput.value = this.saveManager.getPlayerNickname();
        this._setActiveScreen(this.nicknameScreen);
        this.hideGameUI();
        requestAnimationFrame(() => this.nicknameInput?.focus());
    }
    showLeaderboard(scope = 'all', rows = [], title = '', statusText = '') {
        const text = this.uiText[this.currentLanguage];
        
        // Update Title & Back button text
        const titleEl = document.getElementById('leaderboard-title');
        if (titleEl) titleEl.textContent = title || text.leaderboard;
        if (this.leaderboardBackButton) this.leaderboardBackButton.textContent = text.back;

        // Get all tabs and option containers
        const tabGlobal = document.getElementById('leaderboard-tab-global');
        const tabLevels = document.getElementById('leaderboard-tab-levels');
        const globalOptions = document.getElementById('leaderboard-global-options');
        const levelOptions = document.getElementById('leaderboard-level-options');

        const btnGlobalOfficial = document.getElementById('leaderboard-btn-global-official');
        const btnGlobalCommunity = document.getElementById('leaderboard-btn-global-community');
        
        const officialButtons = document.querySelectorAll('#leaderboard-official-buttons button');
        const commSelect = document.getElementById('leaderboard-community-select');

        // Set text for static labels/buttons according to current language
        if (tabGlobal) tabGlobal.textContent = text.globalRanking || "Global Ranking";
        if (tabLevels) tabLevels.textContent = text.levelRankings || "Level Rankings";
        if (btnGlobalOfficial) btnGlobalOfficial.textContent = text.globalOfficial || "Official Levels";
        if (btnGlobalCommunity) btnGlobalCommunity.textContent = text.globalCommunity || "With Community";
        
        const labelOfficial = document.getElementById('label-official-levels');
        if (labelOfficial) labelOfficial.textContent = text.labelOfficial || "Official:";
        const labelCommunity = document.getElementById('label-community-level');
        if (labelCommunity) labelCommunity.textContent = text.labelCommunity || "Community:";
        
        // Update select placeholder text
        if (commSelect) {
            const firstOpt = commSelect.options[0];
            if (firstOpt) firstOpt.textContent = text.selectLevelOption || "-- Select a level --";
        }

        // Adjust visibility and selections based on the scope
        const isGlobal = scope === 'all' || scope === 'global:official' || scope === 'global:community';
        if (isGlobal) {
            if (tabGlobal) tabGlobal.classList.add('selected');
            if (tabLevels) tabLevels.classList.remove('selected');
            if (globalOptions) globalOptions.style.display = 'flex';
            if (levelOptions) levelOptions.style.display = 'none';

            if (scope === 'all' || scope === 'global:official') {
                if (btnGlobalOfficial) btnGlobalOfficial.classList.add('selected');
                if (btnGlobalCommunity) btnGlobalCommunity.classList.remove('selected');
            } else {
                if (btnGlobalOfficial) btnGlobalOfficial.classList.remove('selected');
                if (btnGlobalCommunity) btnGlobalCommunity.classList.add('selected');
            }
        } else {
            if (tabGlobal) tabGlobal.classList.remove('selected');
            if (tabLevels) tabLevels.classList.add('selected');
            if (globalOptions) globalOptions.style.display = 'none';
            if (levelOptions) levelOptions.style.display = 'flex';

            // Check if official level key or custom
            if (scope.startsWith('level:')) {
                officialButtons.forEach(btn => {
                    if (btn.dataset.scope === scope) {
                        btn.classList.add('selected');
                    } else {
                        btn.classList.remove('selected');
                    }
                });
                if (commSelect) commSelect.value = '';
            } else if (scope.startsWith('custom:')) {
                officialButtons.forEach(btn => btn.classList.remove('selected'));
                if (commSelect) commSelect.value = scope;
            }
        }

        // Populate Leaderboard list
        if (this.leaderboardList) {
            this.leaderboardList.innerHTML = '';
            const message = statusText || (!rows.length ? text.leaderboardEmpty : '');
            if (message) {
                const empty = document.createElement('p');
                empty.className = 'leaderboard-empty';
                empty.textContent = message;
                this.leaderboardList.appendChild(empty);
            } else {
                rows.forEach((row, index) => {
                    const item = document.createElement('div');
                    item.className = 'leaderboard-row';
                    const rank = document.createElement('span'); rank.textContent = `${index + 1}.`;
                    const nickname = document.createElement('span'); nickname.textContent = row.nickname || 'Chef';
                    const score = document.createElement('span'); score.textContent = `${Math.max(0, Number(row.score) || 0)} pts`;
                    item.append(rank, nickname, score);
                    this.leaderboardList.appendChild(item);
                });
            }
        }
        
        this._setActiveScreen(this.leaderboardScreen);
        this.hideGameUI();
    }
    showLevelEnd(score, stars, levelIndex, canContinue, isCommunityLevel = false) {
        this.finalScoreElement.textContent = score;
        this.finalStarsElement.textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
        this.levelEndScreen.dataset.levelIndex = levelIndex;
        
        const nextButton = document.getElementById('next-level-button');
        const isNextLevelUnlocked = levelIndex !== -999 && this.saveManager.isLevelUnlocked(levelIndex + 1);
        if (nextButton) nextButton.style.display = (canContinue && isNextLevelUnlocked) ? 'block' : 'none';
        
        const restartButton = document.getElementById('restart-level-button');
        if (restartButton) restartButton.textContent = this.uiText[this.currentLanguage].restartLevel || "Restart Level";
        
        // Handle community level rating section display
        const ratingSection = document.getElementById('community-rating-section');
        if (ratingSection) {
            ratingSection.style.display = isCommunityLevel ? 'block' : 'none';
            const stars = ratingSection.querySelectorAll('.rate-star');
            stars.forEach(star => {
                star.textContent = '☆';
                star.style.color = '#666';
            });
            const statusMsg = document.getElementById('rating-status-message');
            if (statusMsg) statusMsg.textContent = '';
        }
        
        this._setActiveScreen(this.levelEndScreen);
        this.hideGameUI();
    }
    showGameCompletedCongrats(score, stars) {
        if (this.congratsScore) this.congratsScore.textContent = score;
        if (this.congratsStars) this.congratsStars.textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
        this._setActiveScreen(this.gameCompletedScreen);
        this.hideGameUI();
    }
    showGameEnd() {
        this.finalScoreElement.textContent = "-";
        this.finalStarsElement.textContent = this.uiText[this.currentLanguage].allLevelsDone || "All Levels Done!";
        this.levelEndScreen.dataset.levelIndex = -1;
        const nextButton = document.getElementById('next-level-button');
        if (nextButton) nextButton.style.display = 'none';
        const restartButton = document.getElementById('restart-level-button');
        if (restartButton) restartButton.textContent = this.uiText[this.currentLanguage].playAgain || "Play Again?";
        this._setActiveScreen(this.levelEndScreen);
        this.hideGameUI();
    }
    showGameUI() {
        if (this.activeScreen && this.activeScreen !== this.gameHud) { this.activeScreen.classList.remove('active'); this.activeScreen = null; }
        this.gameHud.style.display = 'block';
        this.crosshair.style.display = 'block';
    }
    hideGameUI() {
        this.gameHud.style.display = 'none';
        this.crosshair.style.display = 'none';
    }

    showLevelInstructions(levelData, isMidGame = false) {
        if (!levelData || !this.instructionsTitle || !this.instructionsContent) return;
        const lang = this.currentLanguage;
        this.instructionsTitle.textContent = `${this.uiText[lang].level || "Level"} ${levelData.levelId}: ${levelData.name}`;
        this.instructionsContent.innerHTML = '';
        levelData.availableMeals.forEach(mealName => {
            const details = getRecipeDetails(mealName);
            if (details && details.instructions && details.instructions[lang]) {
                const recipeDiv = document.createElement('div');
                recipeDiv.className = 'recipe-instruction';
                const title = document.createElement('h3');
                title.textContent = getTrans(mealName, lang);
                recipeDiv.appendChild(title);
                const stepList = document.createElement('ul');
                details.instructions[lang].forEach(step => {
                    const listItem = document.createElement('li');
                    listItem.textContent = step;
                    stepList.appendChild(listItem);
                });
                recipeDiv.appendChild(stepList);
                this.instructionsContent.appendChild(recipeDiv);
            }
        });
        if (isMidGame) {
            this.startLevelInstructionsButton.style.display = 'none';
            this.instructionsHint.textContent = this.uiText[lang].hintToggleInstructions || "Toggle: [I] / [△/Y]";
        } else {
            this.startLevelInstructionsButton.style.display = 'block';
            this.startLevelInstructionsButton.textContent = this.uiText[lang].startLevel || "Start Level";
            this.instructionsHint.textContent = this.uiText[lang].select || "Select: Enter/[X]/[A]";
        }
        this._setActiveScreen(this.levelInstructionsScreen);
        this.hideGameUI();
    }

    updateLevelTimer(seconds) { this.levelTimerDisplay.textContent = formatTime(seconds); }
    updateScore(score) { this.scoreDisplay.textContent = score; }

    updateHolding(heldItemName) {
        // Translate the holding text
        const text = heldItemName ? getTrans(heldItemName, this.currentLanguage) : (this.uiText[this.currentLanguage].nothing || "Nothing");
        this.holdingDisplay.textContent = text;
        this.holdingDisplay.dataset.rawItem = heldItemName || '';
    }

    updateGamepadStatus(isConnected) { this.gamepadStatusElement.textContent = isConnected ? '🎮' : ''; }

    showTemporaryMessage(messageKey, duration = 2000) {
        let messageText = getTrans(messageKey, this.currentLanguage);
        if (messageText === messageKey && this.uiText[this.currentLanguage][messageKey]) {
            messageText = this.uiText[this.currentLanguage][messageKey];
        }
        this.tempMessageElement.textContent = messageText;
        this.tempMessageElement.classList.add('visible');
        if (this.messageTimeout) clearTimeout(this.messageTimeout);
        this.messageTimeout = setTimeout(() => {
            this.tempMessageElement.classList.remove('visible');
            this.messageTimeout = null;
        }, duration);
    }

    // Updated Order Card Logic for Overcooked-style UI
    addOrderCard(orderId, mealName, timeLimit) {
        const card = document.createElement('div');
        card.className = 'order-card';
        card.id = orderId;
        card.dataset.maxTime = timeLimit; // Store max time for calculation

        // 1. Timer Bar (Top)
        const timerContainer = document.createElement('div');
        timerContainer.className = 'order-timer-container';
        const timerBar = document.createElement('div');
        timerBar.className = 'order-timer-bar';
        timerContainer.appendChild(timerBar);
        card.appendChild(timerContainer);

        // 2. Header (Meal Name)
        const header = document.createElement('div');
        header.className = 'order-header';
        header.textContent = getTrans(mealName, this.currentLanguage);
        card.appendChild(header);

        // 3. Ingredient List
        const ingredientsContainer = document.createElement('div');
        ingredientsContainer.className = 'order-ingredients';

        const ingredients = getRecipeIngredients(mealName) || [];
        ingredients.forEach(ing => {
            const ingEl = document.createElement('div');
            ingEl.className = 'ingredient-item';
            // Use shorter translation or mapping if available, for now standard translation
            ingEl.textContent = getTrans(ing, this.currentLanguage);
            ingredientsContainer.appendChild(ingEl);
        });
        card.appendChild(ingredientsContainer);

        this.orderListElement.appendChild(card);
        return card;
    }

    updateOrderCardTimer(orderId, seconds) {
        const card = document.getElementById(orderId);
        if (card) {
            const maxTime = parseFloat(card.dataset.maxTime) || seconds;
            const percentage = Math.max(0, Math.min(100, (seconds / maxTime) * 100));

            const bar = card.querySelector('.order-timer-bar');
            if (bar) {
                bar.style.width = `${percentage}%`;

                // Color states
                if (percentage > 50) {
                    bar.style.backgroundColor = '#4CAF50'; // Green
                    card.classList.remove('critical');
                } else if (percentage > 25) {
                    bar.style.backgroundColor = '#FFC107'; // Yellow
                    card.classList.remove('critical');
                } else {
                    bar.style.backgroundColor = '#D32F2F'; // Red
                    card.classList.add('critical'); // Adds shake animation
                }
            }
        }
    }

    removeOrderCard(orderId) {
        const card = document.getElementById(orderId);
        if (card) {
            // Slide up animation
            card.style.transform = 'translateY(-120%)';
            card.style.opacity = '0';
            setTimeout(() => card.remove(), 400);
        }
    }

    clearOrderList() { this.orderListElement.innerHTML = ''; }

    populateLevelSelect(levelDataArray, saveManager) {
        this.levelListContainer.innerHTML = '';
        if (!levelDataArray || !saveManager) return;
        levelDataArray.forEach((level, index) => {
            const button = document.createElement('button');
            button.className = 'menu-button level-button';
            button.dataset.action = 'start-level';
            button.dataset.levelIndex = index;
            const levelProgress = saveManager.getLevelProgress(level);
            const isUnlocked = saveManager.isLevelUnlocked(level);

            const nameSpan = document.createElement('span');
            nameSpan.className = 'level-name';
            nameSpan.textContent = `${this.uiText[this.currentLanguage].level || "Level"} ${level.levelId}: ${level.name}`;
            button.appendChild(nameSpan);

            if (level.customId) {
                const badge = document.createElement('span');
                badge.className = 'level-custom-badge';
                badge.textContent = this.uiText[this.currentLanguage].localLevel;
                button.appendChild(badge);
            }

            if (isUnlocked) {
                if (levelProgress.completed) {
                    const starsSpan = document.createElement('span');
                    starsSpan.className = 'level-stars';
                    starsSpan.textContent = '★'.repeat(levelProgress.stars) + '☆'.repeat(3 - levelProgress.stars);
                    button.appendChild(starsSpan);

                    const scoreSpan = document.createElement('span');
                    scoreSpan.className = 'level-score';
                    scoreSpan.textContent = `${this.uiText[this.currentLanguage].highScore || "High Score"}: ${levelProgress.highScore}`;
                    button.appendChild(scoreSpan);
                } else {
                    const statusSpan = document.createElement('span');
                    statusSpan.className = 'level-status';
                    button.appendChild(statusSpan);
                }
            } else {
                const lockedSpan = document.createElement('span');
                lockedSpan.className = 'level-locked';
                lockedSpan.textContent = this.uiText[this.currentLanguage].levelLocked || "Locked";
                button.appendChild(lockedSpan);
                button.disabled = true;
                button.classList.add('locked');
            }

            this.levelListContainer.appendChild(button);
        });
    }

    setLanguage(lang) {
        if (!this.uiText) {
            this.uiText = {};
        }
        if (!this.uiText[lang]) { lang = 'en'; }
        this.currentLanguage = lang;
        this.uiText = {
            en: { select: "Select: Enter/[X]/[A]", title: "Pixel Kitchen Sim", play: "Play", levelEditor: "Level Editor", settings: "Settings", back: "Back", resume: "Resume Game", level: "Level", score: "Score", stars: "Stars", nextLevel: "Next Level", restartLevel: "Restart Level", mainMenu: "Main Menu", language: "Language", showLabels: "Show Station Labels:", soundEffects: "Sound Effects:", version: "Version:", selectLevel: "Select Level", paused: "Paused", holding: "Holding", nothing: "Nothing", levelComplete: "Level Complete!", allLevelsDone: "All Levels Done!", playAgain: "Play Again?", loading: "Loading Assets...", levelTime: "Level Time", highScore: "High Score", levelLocked: "Locked", levelInstructions: "Level Instructions", startLevel: "Start Level", recipe: "Recipe", close: "Close", hintToggleInstructions: "Toggle: [I] / [△/Y]", editorHubTitle: "Level Editor", createLevel: "New Level", downloadRoadmap: "Download Roadmap", backToMenu: "Back to Menu", credits: "A Game By Azzxl Studio", hintMenu: "Navigate: Arrows/Stick | Select: Enter/[X]/[A]", hintSettings: "Navigate: Arrows/Stick | Select: Enter/[X]/[A] | Back: Esc/[O]/[B]", leaderboard: "Leaderboard", nicknameTitle: "Choose Nickname", nicknameLabel: "Nickname", nicknameContinue: "Continue", nicknameHint: "Used for the online leaderboard.", leaderboardEmpty: "No scores yet. Be the first chef on the board.", leaderboardLoading: "Loading scores...", localLevel: "Local", officialLevels: "Official Levels", communityLevels: "Community Levels", noCommunityLevels: "No community levels available yet.", sortBy: "Sort By:", newest: "Newest", highestRated: "Highest Rated", mostPopular: "Most Popular", page: "Page", prev: "◀ Prev", next: "Next ▶", myLevels: "My Levels", noMyLevels: "No custom levels created yet.", customVersion: "Custom Version", basedOnOfficial: "Based on Level", controlsTitle: "Controls", ctrlMove: "Move", ctrlLook: "Look Around", ctrlInteract: "Interact", ctrlRecipes: "Recipes / Help", ctrlPause: "Pause / Menu", editorLockedInfo: "🔒 Complete all 5 official levels to unlock", congratsTitle: "🎉 CONGRATULATIONS! 🎉", congratsText: "You have completed all 5 official levels of Pixel Kitchen Sim!<br><br>🛠️ The <strong>Level Editor</strong> and <strong>Community Levels</strong> are now fully unlocked!<br><br>Go back to the main menu to build your own dream kitchens and share them with the world.", globalRanking: "Global Ranking", levelRankings: "Level Rankings", globalOfficial: "Official Levels", globalCommunity: "With Community", labelOfficial: "Official:", labelCommunity: "Community:", selectLevelOption: "-- Select a level --", globalLeaderboardOfficial: "Official Global Leaderboard", globalLeaderboardCommunity: "Community Global Leaderboard", communityLeaderboardTitle: "Community Level Leaderboard" },
            fr: { select: "Confirmer: Entrée/[X]/[A]", title: "Pixel Cuisine Sim", play: "Jouer", levelEditor: "Éditeur de Niveau", settings: "Options", back: "Retour", resume: "Reprendre", level: "Niveau", score: "Score", stars: "Étoiles", nextLevel: "Niveau Suivant", restartLevel: "Recommencer", mainMenu: "Menu Principal", language: "Langue", showLabels: "Afficher les Étiquettes:", soundEffects: "Effets sonores:", version: "Version:", selectLevel: "Choisir le Niveau", paused: "Pause", holding: "Tient", nothing: "Rien", levelComplete: "Niveau Terminé!", allLevelsDone: "Tous les Niveaux sont Finis!", playAgain: "Rejouer?", loading: "Chargement...", levelTime: "Temps du Niveau", highScore: "Meilleur Score", levelLocked: "Verrouillé", levelInstructions: "Instructions du Niveau", startLevel: "Commencer le Niveau", recipe: "Recette", close: "Fermer", hintToggleInstructions: "Basculer: [I] / [△/Y]", editorHubTitle: "Éditeur", createLevel: "Nouveau", downloadRoadmap: "Télécharger le Niveau", backToMenu: "Retour au Menu", credits: "Un jeu par Azzxl Studio", hintMenu: "Naviguer: Flèches/Stick | Confirmer: Entrée/[X]/[A]", hintSettings: "Naviguer: Flèches/Stick | Confirmer: Entrée/[X]/[A] | Retour: Échap/[O]/[B]", leaderboard: "Classement", nicknameTitle: "Choisissez un pseudo", nicknameLabel: "Pseudo", nicknameContinue: "Continuer", nicknameHint: "Utilisé pour le classement en ligne.", leaderboardEmpty: "Aucun score. Soyez le premier chef.", leaderboardLoading: "Classement des scores...", localLevel: "Local", officialLevels: "Niveaux Officiels", communityLevels: "Niveaux de la Communauté", noCommunityLevels: "Aucun niveau de la communauté disponible pour le moment.", sortBy: "Trier par :", newest: "Plus récents", highestRated: "Mieux notés", mostPopular: "Plus populaires", page: "Page", prev: "◀ Précédent", next: "Suivant ▶", myLevels: "Mes Niveaux", noMyLevels: "Aucun niveau personnalisé créé pour le moment.", customVersion: "Version Personnalisée", basedOnOfficial: "Basé sur le Niveau", controlsTitle: "Contrôles", ctrlMove: "Déplacer", ctrlLook: "Regarder", ctrlInteract: "Interagir", ctrlRecipes: "Recettes / Aide", ctrlPause: "Pause / Menu", editorLockedInfo: "🔒 Complétez les 5 niveaux officiels pour déverrouiller", congratsTitle: "🎉 FÉLICITATIONS ! 🎉", congratsText: "Vous avez terminé les 5 niveaux officiels de Pixel Kitchen Sim !<br><br>🛠️ L'<strong>Éditeur de Niveaux</strong> et les <strong>Niveaux de la Communauté</strong> sont maintenant déverrouillés !<br><br>Retournez au menu principal pour créer vos cuisines et les partager avec le monde.", globalRanking: "Classement Général", levelRankings: "Classements par Niveau", globalOfficial: "Niveaux Officiels", globalCommunity: "Avec Communauté", labelOfficial: "Officiels :", labelCommunity: "Communauté :", selectLevelOption: "-- Choisir un niveau --", globalLeaderboardOfficial: "Classement Général Officiel", globalLeaderboardCommunity: "Classement Général de la Communauté", communityLeaderboardTitle: "Classement du Niveau de la Communauté" },
            es: { select: "Entrar: Enter/[X]/[A]", title: "Pixel Cocina Sim", play: "Jugar", levelEditor: "Editor de Niveles", settings: "Ajustes", back: "Volver", resume: "Reanudar", level: "Nivel", score: "Puntos", stars: "Estrellas", nextLevel: "Siguiente Nivel", restartLevel: "Reiniciar", mainMenu: "Menu Principal", language: "Idioma", showLabels: "Mostrar Etiquetas:", soundEffects: "Efectos de sonido:", version: "Versión:", selectLevel: "Elegir el Nivel", paused: "Pausa", holding: "Tiene", nothing: "Nada", levelComplete: "¡Nivel Completo!", allLevelsDone: "¡Todos los Niveles están Hechos!", playAgain: "¿Jugar Otra Vez?", loading: "Cargando...", levelTime: "Tiempo del Nivel", highScore: "Mejor Puntuación", levelLocked: "Bloqueado", levelInstructions: "Instrucciones del Nivel", startLevel: "Empezar el Nivel", recipe: "Receta", close: "Cerrar", hintToggleInstructions: "Alternar: [I] / [△/Y]", editorHubTitle: "Editor", createLevel: "Nuevo Nivel", downloadRoadmap: "Descargar el Nivel", backToMenu: "Volver al Menú", credits: "Un Juego De Azzxl Studio", hintMenu: "Navegar: Flechas/Stick | Entrar: Enter/[X]/[A]", hintSettings: "Navegar: Flechas/Stick | Entrar: Enter/[X]/[A] | Volver: Esc/[O]/[B]", leaderboard: "Clasificación", nicknameTitle: "Elige un apodo", nicknameLabel: "Apodo", nicknameContinue: "Continuar", nicknameHint: "Se usa para la clasificación en línea.", leaderboardEmpty: "Aún no hay puntuaciones. Sé el primer chef.", leaderboardLoading: "Cargando puntuaciones...", localLevel: "Local", officialLevels: "Niveles Oficiales", communityLevels: "Niveles de la Comunidad", noCommunityLevels: "No hay niveles de la comunidad disponibles todavía.", sortBy: "Ordenar por:", newest: "Más nuevos", highestRated: "Mejor valorados", mostPopular: "Más populares", page: "Página", prev: "◀ Anterior", next: "Siguiente ▶", myLevels: "Mis Niveles", noMyLevels: "No hay niveles personalizados creados todavía.", customVersion: "Versión Personalizada", basedOnOfficial: "Basado en el Nivel", controlsTitle: "Controles", ctrlMove: "Mover", ctrlLook: "Mirar", ctrlInteract: "Interactuar", ctrlRecipes: "Recetas / Ayuda", ctrlPause: "Pausa / Menú", editorLockedInfo: "🔒 Completa los 5 niveles oficiales para desbloquear", congratsTitle: "🎉 ¡FELICITACIONES! 🎉", congratsText: "¡Has completado los 5 niveles oficiales de Pixel Cocina Sim!<br><br>🛠️ ¡El <strong>Editor de Niveles</strong> y los <strong>Niveles de la Comunidad</strong> ya están desbloqueados!<br><br>Vuelve al menu principal para diseñar tus cocinas y compartirlas con el mundo.", globalRanking: "Clasificación General", levelRankings: "Clasificaciones por Nivel", globalOfficial: "Niveles Oficiales", globalCommunity: "Con Comunidad", labelOfficial: "Oficiales:", labelCommunity: "Comunidad:", selectLevelOption: "-- Elegir un nivel --", globalLeaderboardOfficial: "Clasificación General Oficial", globalLeaderboardCommunity: "Clasificación General de la Comunidad", communityLeaderboardTitle: "Clasificación del Nivel de la Comunidad" }
        };

        this.mainMenu.querySelector('h1').textContent = this.uiText[lang].title;
        document.getElementById('play-button').textContent = this.uiText[lang].play;
        const leaderboardButton = document.getElementById('leaderboard-button'); if (leaderboardButton) leaderboardButton.textContent = this.uiText[lang].leaderboard;
        const editorBtn = document.getElementById('editor-button'); if (editorBtn) editorBtn.textContent = this.uiText[lang].levelEditor;
        document.getElementById('settings-button').textContent = this.uiText[lang].settings;
        const creditsEl = document.getElementById('credits-text'); if (creditsEl) creditsEl.textContent = this.uiText[lang].credits;

        const editorHubTitle = document.getElementById('editor-hub-title'); if (editorHubTitle) editorHubTitle.textContent = this.uiText[lang].editorHubTitle;
        const createLevelBtn = document.getElementById('create-level-btn'); if (createLevelBtn) createLevelBtn.textContent = this.uiText[lang].createLevel;
        const dlRoadmapBtn = document.getElementById('download-roadmap-btn'); if (dlRoadmapBtn) dlRoadmapBtn.textContent = this.uiText[lang].downloadRoadmap;
        const editorHubBackBtn = document.getElementById('editor-hub-back-btn'); if (editorHubBackBtn) editorHubBackBtn.textContent = this.uiText[lang].backToMenu;

        const mainMenuHint = document.getElementById('main-menu-hint'); if (mainMenuHint) mainMenuHint.textContent = this.uiText[lang].hintMenu;
        const settingsHint = document.getElementById('settings-hint'); if (settingsHint) settingsHint.textContent = this.uiText[lang].hintSettings;
        const levelSelectHint = document.getElementById('level-select-hint'); if (levelSelectHint) levelSelectHint.textContent = this.uiText[lang].hintSettings;
        const levelEndHint = document.getElementById('level-end-hint'); if (levelEndHint) levelEndHint.textContent = this.uiText[lang].hintMenu;
        this.settingsScreen.querySelector('h1').textContent = this.uiText[lang].settings;
        if (this.languageLabel) this.languageLabel.textContent = this.uiText[lang].language + ":";
        
        // Translate Controls Guide
        const ctrlTitle = document.getElementById('controls-guide-title'); if (ctrlTitle) ctrlTitle.textContent = this.uiText[lang].controlsTitle;
        const ctrlMoveEl = document.getElementById('ctrl-move'); if (ctrlMoveEl) ctrlMoveEl.textContent = this.uiText[lang].ctrlMove + ":";
        const ctrlLookEl = document.getElementById('ctrl-look'); if (ctrlLookEl) ctrlLookEl.textContent = this.uiText[lang].ctrlLook + ":";
        const ctrlInteractEl = document.getElementById('ctrl-interact'); if (ctrlInteractEl) ctrlInteractEl.textContent = this.uiText[lang].ctrlInteract + ":";
        const ctrlRecipesEl = document.getElementById('ctrl-recipes'); if (ctrlRecipesEl) ctrlRecipesEl.textContent = this.uiText[lang].ctrlRecipes + ":";
        const ctrlPauseEl = document.getElementById('ctrl-pause'); if (ctrlPauseEl) ctrlPauseEl.textContent = this.uiText[lang].ctrlPause + ":";
        this.settingsScreen.querySelector('label[for="toggle-labels-setting"]').textContent = this.uiText[lang].showLabels;
        const soundLabel = this.settingsScreen.querySelector('label[for="sound-effects-setting"]'); if (soundLabel) soundLabel.textContent = this.uiText[lang].soundEffects;
        document.getElementById('back-to-main-button').textContent = this.uiText[lang].back;
        document.getElementById('resume-button-settings').textContent = this.uiText[lang].resume;
        document.getElementById('game-version').textContent = `${this.uiText[lang].version} 1.0 Beta`;
        const congratsTitle = document.getElementById('congrats-title');
        const congratsText = document.getElementById('congrats-text');
        const congratsScoreLabel = document.getElementById('congrats-score-label');
        const congratsStarsLabel = document.getElementById('congrats-stars-label');
        const congratsBackBtn = document.getElementById('congrats-back-button');

        if (congratsTitle) congratsTitle.textContent = this.uiText[lang].congratsTitle || "🎉 CONGRATULATIONS! 🎉";
        if (congratsText) congratsText.innerHTML = this.uiText[lang].congratsText || "You have completed all 5 official levels...";
        if (congratsScoreLabel) congratsScoreLabel.textContent = this.uiText[lang].score || "Score";
        if (congratsStarsLabel) congratsStarsLabel.textContent = this.uiText[lang].stars || "Stars";
        if (congratsBackBtn) congratsBackBtn.textContent = this.uiText[lang].backToMenu || "Back to Menu";

        const lockMsg = document.getElementById('editor-lock-message');
        if (lockMsg && lockMsg.style.display !== 'none') {
            lockMsg.textContent = this.uiText[lang].editorLockedInfo || "🔒 Complete all 5 official levels to unlock";
        }

        this.levelSelectScreen.querySelector('h1').textContent = this.uiText[lang].selectLevel;
        document.getElementById('back-to-main-from-level-select').textContent = this.uiText[lang].back;
        this.levelEndScreen.querySelector('h1').textContent = this.uiText[lang].levelComplete;
        this.levelEndScreen.querySelector('#final-score').parentNode.firstChild.textContent = this.uiText[lang].score + ": ";
        this.levelEndScreen.querySelector('#final-stars').parentNode.firstChild.textContent = this.uiText[lang].stars + ": ";
        document.getElementById('next-level-button').textContent = this.uiText[lang].nextLevel;
        document.getElementById('restart-level-button').textContent = this.uiText[lang].restartLevel;
        document.getElementById('level-end-main-menu-button').textContent = this.uiText[lang].mainMenu;
        const levelEndLeaderboardButton = document.getElementById('level-end-leaderboard-button'); if (levelEndLeaderboardButton) levelEndLeaderboardButton.textContent = this.uiText[lang].leaderboard;
        if (this.nicknameScreen) this.nicknameScreen.querySelector('h1').textContent = this.uiText[lang].nicknameTitle;
        const nicknameLabel = this.nicknameScreen?.querySelector('label'); if (nicknameLabel) nicknameLabel.textContent = this.uiText[lang].nicknameLabel;
        if (this.nicknameSaveButton) this.nicknameSaveButton.textContent = this.uiText[lang].nicknameContinue;
        if (this.nicknameHint) this.nicknameHint.textContent = this.uiText[lang].nicknameHint;
        document.querySelector('#game-timer-container').firstChild.textContent = this.uiText[lang].levelTime + ": ";
        this.loadingScreen.querySelector('h2').textContent = this.uiText[lang].loading;

        if (this.instructionsTitle) this.instructionsTitle.textContent = this.uiText[lang].levelInstructions || "Level Instructions";
        if (this.startLevelInstructionsButton) this.startLevelInstructionsButton.textContent = this.uiText[lang].startLevel || "Start Level";
        if (this.instructionsHint) {
            const startButtonVisible = this.startLevelInstructionsButton && this.startLevelInstructionsButton.style.display !== 'none';
            this.instructionsHint.textContent = startButtonVisible ? (this.uiText[lang].select || "Select: Enter/[X]/[A]") : (this.uiText[lang].hintToggleInstructions || "Toggle: [I] / [△/Y]");
        }

        const tabOfficial = document.getElementById('tab-official');
        if (tabOfficial) tabOfficial.textContent = this.uiText[lang].officialLevels || "Official Levels";
        const tabMyLevels = document.getElementById('tab-my-levels');
        if (tabMyLevels) tabMyLevels.textContent = this.uiText[lang].myLevels || "My Levels";
        const tabCommunity = document.getElementById('tab-community');
        if (tabCommunity) tabCommunity.textContent = this.uiText[lang].communityLevels || "Community Levels";

        const sortByLabel = document.getElementById('community-sort-label');
        if (sortByLabel) sortByLabel.textContent = this.uiText[lang].sortBy || "Sort By:";
        const sortSelect = document.getElementById('community-sort');
        if (sortSelect && sortSelect.options.length >= 3) {
            sortSelect.options[0].textContent = this.uiText[lang].newest || "Newest";
            sortSelect.options[1].textContent = this.uiText[lang].highestRated || "Highest Rated";
            sortSelect.options[2].textContent = this.uiText[lang].mostPopular || "Most Popular";
        }
        const pageLabel = document.getElementById('community-page-label');
        if (pageLabel) pageLabel.textContent = this.uiText[lang].page || "Page";
        const prevBtn = document.getElementById('community-prev-btn');
        if (prevBtn) prevBtn.textContent = this.uiText[lang].prev || "◀ Prev";
        const nextBtn = document.getElementById('community-next-btn');
        if (nextBtn) nextBtn.textContent = this.uiText[lang].next || "Next ▶";

        this.languageButtons.forEach(btn => btn.classList.toggle('active-lang', btn.dataset.lang === lang));

        this.updateRecipeBook(lang);

        if (this.activeScreen === this.levelSelectScreen && this.saveManager) {
            const isOfficialTab = tabOfficial && tabOfficial.classList.contains('selected');
            const isMyLevelsTab = tabMyLevels && tabMyLevels.classList.contains('selected');
            if (isOfficialTab) {
                const officialLevelsOnly = this.levelDatabase.filter(l => !l.customId);
                this.populateLevelSelect(officialLevelsOnly, this.saveManager);
            } else if (isMyLevelsTab) {
                if (typeof window.onMyLevelsLanguageChange === 'function') {
                    window.onMyLevelsLanguageChange();
                }
            } else {
                if (typeof window.onCommunityLanguageChange === 'function') {
                    window.onCommunityLanguageChange();
                }
            }
        }
        if (this.activeScreen === this.levelInstructionsScreen && this.currentLevelData) {
            this.showLevelInstructions(this.currentLevelData, true);
        }

        // Update holding display immediately to reflect language change
        const holdingEl = document.getElementById('holding-display');
        if (holdingEl) this.updateHolding(holdingEl.dataset.rawItem);
    }

    setControllerType(type) {
        // Toggle active status of controller toggle buttons
        const toggleButtons = this.settingsScreen.querySelectorAll('.controller-toggle-btn');
        toggleButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === type);
        });

        // Toggle visual styling and content of gamepad badges in controls list
        const interactBtn = this.settingsScreen.querySelector('.gp-button-interact');
        const recipesBtn = this.settingsScreen.querySelector('.gp-button-recipes');
        const pauseBtn = this.settingsScreen.querySelector('.gp-button-pause');

        if (type === 'playstation') {
            if (interactBtn) {
                interactBtn.textContent = '✕';
                interactBtn.className = 'gp-btn btn-ps-cross gp-button-interact';
            }
            if (recipesBtn) {
                recipesBtn.textContent = '▲';
                recipesBtn.className = 'gp-btn btn-ps-triangle gp-button-recipes';
            }
            if (pauseBtn) {
                pauseBtn.textContent = 'OPTIONS';
                pauseBtn.className = 'gp-btn btn-ps-options gp-button-pause';
            }
        } else { // default to xbox
            if (interactBtn) {
                interactBtn.textContent = 'A';
                interactBtn.className = 'gp-btn btn-a gp-button-interact';
            }
            if (recipesBtn) {
                recipesBtn.textContent = 'Y';
                recipesBtn.className = 'gp-btn btn-y gp-button-recipes';
            }
            if (pauseBtn) {
                pauseBtn.textContent = 'START';
                pauseBtn.className = 'gp-btn btn-b gp-button-pause';
            }
        }
    }

    getLabelToggleState() { return this.toggleLabelsCheckbox.checked; }
    setLabelToggleState(isChecked) { this.toggleLabelsCheckbox.checked = isChecked; }
    setSoundEffectsState(isChecked) { if (this.soundEffectsCheckbox) this.soundEffectsCheckbox.checked = isChecked; }
}
