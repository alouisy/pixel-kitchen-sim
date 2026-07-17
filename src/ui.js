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

        // Initial UI Dictionary
        this.uiText = {
            en: { select: "Select: Enter/[X]/[A]", title: "Pixel Kitchen Sim", play: "Play", levelEditor: "Level Editor", settings: "Settings", back: "Back", resume: "Resume Game", level: "Level", score: "Score", stars: "Stars", nextLevel: "Next Level", restartLevel: "Restart Level", mainMenu: "Main Menu", language: "Language", showLabels: "Show Station Labels:", version: "Version:", selectLevel: "Select Level", paused: "Paused", holding: "Holding", nothing: "Nothing", levelComplete: "Level Complete!", allLevelsDone: "All Levels Done!", playAgain: "Play Again?", loading: "Loading Assets...", levelTime: "Level Time", highScore: "High Score", levelLocked: "Locked", levelInstructions: "Level Instructions", startLevel: "Start Level", recipe: "Recipe", close: "Close", hintToggleInstructions: "Toggle: [I] / [△/Y]", editorHubTitle: "Level Editor", createLevel: "➕ New Level", downloadRoadmap: "💾 Download Roadmap", backToMenu: "Back to Menu", credits: "A Game By Azzxl Studio", hintMenu: "Navigate: Arrows/Stick | Select: Enter/[X]/[A]", hintSettings: "Navigate: Arrows/Stick | Select: Enter/[X]/[A] | Back: Esc/[O]/[B]" },
            fr: { select: "Confirmer: Entrée/[X]/[A]", title: "Pixel Cuisine Sim", play: "Jouer", levelEditor: "Éditeur de Niveau", settings: "Options", back: "Retour", resume: "Reprendre", level: "Niveau", score: "Score", stars: "Étoiles", nextLevel: "Niveau Suivant", restartLevel: "Recommencer", mainMenu: "Menu Principal", language: "Langue", showLabels: "Afficher les Étiquettes:", version: "Version:", selectLevel: "Choisir le Niveau", paused: "Pause", holding: "Tient", nothing: "Rien", levelComplete: "Niveau Terminé!", allLevelsDone: "Tous les Niveaux sont Finis!", playAgain: "Rejouer?", loading: "Chargement...", levelTime: "Temps du Niveau", highScore: "Meilleur Score", levelLocked: "Verrouillé", levelInstructions: "Instructions du Niveau", startLevel: "Commencer le Niveau", recipe: "Recette", close: "Fermer", hintToggleInstructions: "Basculer: [I] / [△/Y]", editorHubTitle: "Éditeur", createLevel: "➕ Nouveau", downloadRoadmap: "💾 Télécharger le Niveau", backToMenu: "Retour au Menu", credits: "Un jeu par Azzxl Studio", hintMenu: "Naviguer: Flèches/Stick | Confirmer: Entrée/[X]/[A]", hintSettings: "Naviguer: Flèches/Stick | Confirmer: Entrée/[X]/[A] | Retour: Échap/[O]/[B]" },
            es: { select: "Entrar: Enter/[X]/[A]", title: "Pixel Cocina Sim", play: "Jugar", levelEditor: "Editor de Niveles", settings: "Ajustes", back: "Volver", resume: "Reanudar", level: "Nivel", score: "Puntos", stars: "Estrellas", nextLevel: "Siguiente Nivel", restartLevel: "Reiniciar", mainMenu: "Menú Principal", language: "Idioma", showLabels: "Mostrar Etiquetas:", version: "Versión:", selectLevel: "Elegir el Nivel", paused: "Pausa", holding: "Tiene", nothing: "Nada", levelComplete: "¡Nivel Completo!", allLevelsDone: "¡Todos los Niveles están Hechos!", playAgain: "¿Jugar Otra Vez?", loading: "Cargando...", levelTime: "Tiempo del Nivel", highScore: "Mejor Puntuación", levelLocked: "Bloqueado", levelInstructions: "Instrucciones del Nivel", startLevel: "Empezar el Nivel", recipe: "Receta", close: "Cerrar", hintToggleInstructions: "Alternar: [I] / [△/Y]", editorHubTitle: "Editor", createLevel: "➕ Nuevo Nivel", downloadRoadmap: "💾 Descargar el Nivel", backToMenu: "Volver al Menú", credits: "Un Juego De Azzxl Studio", hintMenu: "Navegar: Flechas/Stick | Entrar: Enter/[X]/[A]", hintSettings: "Navegar: Flechas/Stick | Entrar: Enter/[X]/[A] | Volver: Esc/[O]/[B]" }
        };

        // Initialize Recipe Book container
        this.createRecipeBook();

        // Set Language from Save or Default
        const savedLang = this.saveManager.getSetting('language') || 'en';
        this.setLanguage(savedLang);
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
    showMainMenu() { this._setActiveScreen(this.mainMenu); this.hideGameUI(); }
    showSettings(isPauseMenu = false) {
        this._setActiveScreen(this.settingsScreen);
        this.resumeButtonSettings.style.display = isPauseMenu ? 'block' : 'none';
        this.hideGameUI();
    }
    showLevelSelect() { this._setActiveScreen(this.levelSelectScreen); this.hideGameUI(); }
    showLevelEnd(score, stars, levelIndex, canContinue) {
        this.finalScoreElement.textContent = score;
        this.finalStarsElement.textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
        this.levelEndScreen.dataset.levelIndex = levelIndex;
        const nextButton = document.getElementById('next-level-button');
        const isNextLevelUnlocked = this.saveManager.isLevelUnlocked(levelIndex + 1);
        if (nextButton) nextButton.style.display = (canContinue && isNextLevelUnlocked) ? 'block' : 'none';
        const restartButton = document.getElementById('restart-level-button');
        if (restartButton) restartButton.textContent = this.uiText[this.currentLanguage].restartLevel || "Restart Level";
        this._setActiveScreen(this.levelEndScreen);
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
            const levelProgress = saveManager.getLevelProgress(index);
            const isUnlocked = saveManager.isLevelUnlocked(index);
            let buttonHTML = `<span class="level-name">${this.uiText[this.currentLanguage].level || "Level"} ${level.levelId}: ${level.name}</span>`;
            if (isUnlocked) {
                if (levelProgress.completed) {
                    buttonHTML += `<span class="level-stars">${'★'.repeat(levelProgress.stars)}${'☆'.repeat(3 - levelProgress.stars)}</span><span class="level-score">${this.uiText[this.currentLanguage].highScore || "High Score"}: ${levelProgress.highScore}</span>`;
                } else { buttonHTML += `<span class="level-status"></span>`; }
            } else {
                buttonHTML += `<span class="level-locked">${this.uiText[this.currentLanguage].levelLocked || "Locked"}</span>`;
                button.disabled = true; button.classList.add('locked');
            }
            button.innerHTML = buttonHTML;
            this.levelListContainer.appendChild(button);
        });
    }

    setLanguage(lang) {
        if (!this.uiText[lang]) { lang = 'en'; }
        this.currentLanguage = lang;

        this.mainMenu.querySelector('h1').textContent = this.uiText[lang].title;
        document.getElementById('play-button').textContent = this.uiText[lang].play;
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
        this.settingsScreen.querySelector('label[for="toggle-labels-setting"]').textContent = this.uiText[lang].showLabels;
        document.getElementById('back-to-main-button').textContent = this.uiText[lang].back;
        document.getElementById('resume-button-settings').textContent = this.uiText[lang].resume;
        document.getElementById('game-version').textContent = `${this.uiText[lang].version} 1.0 Beta`;
        this.levelSelectScreen.querySelector('h1').textContent = this.uiText[lang].selectLevel;
        document.getElementById('back-to-main-from-level-select').textContent = this.uiText[lang].back;
        this.levelEndScreen.querySelector('h1').textContent = this.uiText[lang].levelComplete;
        this.levelEndScreen.querySelector('#final-score').parentNode.firstChild.textContent = this.uiText[lang].score + ": ";
        this.levelEndScreen.querySelector('#final-stars').parentNode.firstChild.textContent = this.uiText[lang].stars + ": ";
        document.getElementById('next-level-button').textContent = this.uiText[lang].nextLevel;
        document.getElementById('restart-level-button').textContent = this.uiText[lang].restartLevel;
        document.getElementById('level-end-main-menu-button').textContent = this.uiText[lang].mainMenu;
        document.querySelector('#game-timer-container').firstChild.textContent = this.uiText[lang].levelTime + ": ";
        // document.querySelector('#bottom-hud').firstChild.textContent = this.uiText[lang].holding + ": "; // Removed hardcoded prefix
        this.loadingScreen.querySelector('h2').textContent = this.uiText[lang].loading;

        if (this.instructionsTitle) this.instructionsTitle.textContent = this.uiText[lang].levelInstructions || "Level Instructions";
        if (this.startLevelInstructionsButton) this.startLevelInstructionsButton.textContent = this.uiText[lang].startLevel || "Start Level";
        if (this.instructionsHint) {
            const startButtonVisible = this.startLevelInstructionsButton && this.startLevelInstructionsButton.style.display !== 'none';
            this.instructionsHint.textContent = startButtonVisible ? (this.uiText[lang].select || "Select: Enter/[X]/[A]") : (this.uiText[lang].hintToggleInstructions || "Toggle: [I] / [△/Y]");
        }

        this.languageButtons.forEach(btn => btn.classList.toggle('active-lang', btn.dataset.lang === lang));

        this.updateRecipeBook(lang);

        if (this.activeScreen === this.levelSelectScreen && this.saveManager && typeof levelDatabase !== 'undefined') {
            this.populateLevelSelect(levelDatabase, this.saveManager);
        }
        if (this.activeScreen === this.levelInstructionsScreen && typeof currentLevelData !== 'undefined' && currentLevelData) {
            this.showLevelInstructions(currentLevelData, true);
        }

        // Update holding display immediately to reflect language change
        const holdingEl = document.getElementById('holding-display');
        if (holdingEl) this.updateHolding(holdingEl.dataset.rawItem);
    }

    getLabelToggleState() { return this.toggleLabelsCheckbox.checked; }
    setLabelToggleState(isChecked) { this.toggleLabelsCheckbox.checked = isChecked; }
}