// src/ui.js
// --- REMOVE THIS LINE ---
// import { LEVEL_DATABASE } from './gameData.js'; // To populate level select

// Helper to format time
function formatTime(seconds) {
    const mins = Math.floor(Math.max(0, seconds) / 60);
    const secs = Math.floor(Math.max(0, seconds) % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export class UIManager {
    constructor(saveManager) {
        this.saveManager = saveManager;

        // Screen Elements
        this.loadingScreen = document.getElementById('loading-screen');
        this.mainMenu = document.getElementById('main-menu');
        this.settingsScreen = document.getElementById('settings-screen');
        this.levelSelectScreen = document.getElementById('level-select-screen');
        this.levelEndScreen = document.getElementById('level-end-screen');
        this.gameHud = document.getElementById('game-hud');

        // In-Game HUD Elements
        this.orderListElement = document.getElementById('order-list');
        this.levelTimerDisplay = document.getElementById('level-timer-display');
        this.holdingDisplay = document.getElementById('holding-display');
        this.scoreDisplay = document.getElementById('score-display');
        this.gamepadStatusElement = document.getElementById('gamepad-status');
        this.crosshair = document.getElementById('crosshair');
        this.tempMessageElement = document.getElementById('temp-message');

        // Level End Elements
        this.finalScoreElement = document.getElementById('final-score');
        this.finalStarsElement = document.getElementById('final-stars');

        // Settings Elements
        this.languageButtons = this.settingsScreen.querySelectorAll('.lang-button');
        this.toggleLabelsCheckbox = document.getElementById('toggle-labels-setting');
        this.resumeButtonSettings = document.getElementById('resume-button-settings');
        this.languageLabel = document.getElementById('language-label');

        // Level Select Elements
        this.levelListContainer = document.getElementById('level-list');

        this.activeScreen = null;
        this.messageTimeout = null;

        // --- Language ---
        this.currentLanguage = 'en';
        this.uiText = {
            en: { title: "Pixel Kitchen Sim", play: "Play", settings: "Settings", back: "Back", resume: "Resume Game", level: "Level", score: "Score", stars: "Stars", nextLevel: "Next Level", restartLevel: "Restart Level", mainMenu: "Main Menu", language: "Language", showLabels: "Show Station Labels:", version: "Version:", selectLevel: "Select Level", paused: "Paused", holding: "Holding", nothing: "Nothing", orderServed: "Order Served!", wrongOrder: "Wrong / No Order!", notAMeal: "Not a Meal!", handsFull: "Hands Full!", slotFull: "Slot Full!", itemPlaced: "Item Placed", cannotPlace: "Cannot Place Here", stationBusy: "Station Busy", cannotProcess: "Cannot Process", stillProcessing: "Still Processing...", slotEmpty: "Slot Empty", levelComplete: "Level Complete!", allLevelsDone: "All Levels Done!", playAgain: "Play Again?", loading: "Loading Assets...", order: "Order", levelTime: "Level Time", highScore: "High Score", levelLocked: "Locked" },
            fr: { title: "Pixel Cuisine Sim", play: "Jouer", settings: "Options", back: "Retour", resume: "Reprendre", level: "Niveau", score: "Score", stars: "Étoiles", nextLevel: "Niveau Suivant", restartLevel: "Recommencer", mainMenu: "Menu Principal", language: "Langue", showLabels: "Afficher Étiquettes:", version: "Version:", selectLevel: "Choisir Niveau", paused: "Pause", holding: "Tient", nothing: "Rien", orderServed: "Commande Servie!", wrongOrder: "Mauvaise Commande!", notAMeal: "Pas un Plat!", handsFull: "Mains Pleines!", slotFull: "Emplacement Plein!", itemPlaced: "Objet Placé", cannotPlace: "Impossible Placer Ici", stationBusy: "Station Occupée", cannotProcess: "Impossible Traiter", stillProcessing: "En Cours...", slotEmpty: "Emplacement Vide", levelComplete: "Niveau Terminé!", allLevelsDone: "Tous Niveaux Finis!", playAgain: "Rejouer?", loading: "Chargement...", order: "Commande", levelTime: "Temps Niveau", highScore: "Meilleur Score", levelLocked: "Verrouillé" },
            es: { title: "Pixel Cocina Sim", play: "Jugar", settings: "Ajustes", back: "Volver", resume: "Reanudar", level: "Nivel", score: "Puntos", stars: "Estrellas", nextLevel: "Siguiente Nivel", restartLevel: "Reiniciar", mainMenu: "Menú Principal", language: "Idioma", showLabels: "Mostrar Etiquetas:", version: "Versión:", selectLevel: "Elegir Nivel", paused: "Pausa", holding: "Tiene", nothing: "Nada", orderServed: "¡Pedido Servido!", wrongOrder: "¡Pedido Incorrecto!", notAMeal: "¡No es Comida!", handsFull: "¡Manos Llenas!", slotFull: "¡Espacio Lleno!", itemPlaced: "Objeto Colocado", cannotPlace: "No se puede Colocar", stationBusy: "Estación Ocupada", cannotProcess: "No se puede Procesar", stillProcessing: "Procesando...", slotEmpty: "Espacio Vacío", levelComplete: "¡Nivel Completo!", allLevelsDone: "¡Todos Niveles Hechos!", playAgain: "¿Jugar Otra Vez?", loading: "Cargando...", order: "Pedido", levelTime: "Tiempo Nivel", highScore: "Mejor Puntuación", levelLocked: "Bloqueado" }
        };
        if (this.languageLabel) {
            this.setLanguage(this.currentLanguage);
        } else {
            console.error("Language label element not found during UIManager construction!");
        }
    }

    // --- Screen Management ---
    _setActiveScreen(screenElement) {
        if (this.activeScreen && this.activeScreen !== screenElement) {
            this.activeScreen.classList.remove('active');
        }
        if (screenElement) {
            screenElement.classList.add('active');
        }
        this.activeScreen = screenElement;
    }
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
        if (this.activeScreen && this.activeScreen !== this.gameHud) {
            this.activeScreen.classList.remove('active');
            this.activeScreen = null;
        }
        this.gameHud.style.display = 'block';
        this.crosshair.style.display = 'block';
    }
    hideGameUI() {
        this.gameHud.style.display = 'none';
        this.crosshair.style.display = 'none';
    }

    // --- In-Game HUD Updates ---
    updateLevelTimer(seconds) { this.levelTimerDisplay.textContent = formatTime(seconds); }
    updateScore(score) { this.scoreDisplay.textContent = score; }
    updateHolding(itemName) { this.holdingDisplay.textContent = itemName || (this.uiText[this.currentLanguage].nothing || "Nothing"); }
    updateGamepadStatus(isConnected) { this.gamepadStatusElement.textContent = isConnected ? '🎮' : ''; }
    showTemporaryMessage(messageKey, duration = 2000) {
        const messageText = this.uiText[this.currentLanguage][messageKey] || messageKey;
        this.tempMessageElement.textContent = messageText;
        this.tempMessageElement.classList.add('visible');
        if (this.messageTimeout) clearTimeout(this.messageTimeout);
        this.messageTimeout = setTimeout(() => {
            this.tempMessageElement.classList.remove('visible');
            this.messageTimeout = null;
        }, duration);
    }

    // --- Order Card Management ---
    addOrderCard(orderId, mealName, timeLimit) {
        const card = document.createElement('div');
        card.className = 'order-card'; card.id = `order-${orderId}`;
        const mealSpan = document.createElement('span');
        mealSpan.className = 'order-meal'; mealSpan.textContent = mealName;
        const timerSpan = document.createElement('span');
        timerSpan.className = 'order-timer'; timerSpan.textContent = formatTime(timeLimit);
        card.appendChild(mealSpan); card.appendChild(timerSpan);
        this.orderListElement.appendChild(card);
        return card;
    }
    updateOrderCardTimer(orderId, seconds) {
        const card = document.getElementById(`order-${orderId}`);
        if (card) {
            const timerSpan = card.querySelector('.order-timer');
            if (timerSpan) {
                timerSpan.textContent = formatTime(seconds);
                timerSpan.classList.toggle('low-time', seconds <= 15 && seconds > 0);
                timerSpan.style.color = seconds <= 0 ? 'red' : '';
            }
        }
    }
    removeOrderCard(orderId) {
        const card = document.getElementById(`order-${orderId}`);
        if (card) {
            card.style.transition = 'opacity 0.3s ease-out'; card.style.opacity = '0';
            setTimeout(() => card.remove(), 300);
        }
    }
    clearOrderList() { this.orderListElement.innerHTML = ''; }

    // --- Level Select Population ---
    // Now accepts the actual level data array fetched in main.js
    populateLevelSelect(levelDataArray, saveManager) {
        this.levelListContainer.innerHTML = '';
        if (!levelDataArray || !saveManager) {
            console.error("Missing level data or save manager for populating level select.");
            return;
        }
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

    // --- Settings ---
    setLanguage(lang) {
        if (!this.uiText[lang]) { lang = 'en'; }
        this.currentLanguage = lang;
        console.log(`Setting language to: ${lang}`);
        // Update specific elements
        this.mainMenu.querySelector('h1').textContent = this.uiText[lang].title;
        document.getElementById('play-button').textContent = this.uiText[lang].play;
        document.getElementById('settings-button').textContent = this.uiText[lang].settings;
        this.settingsScreen.querySelector('h1').textContent = this.uiText[lang].settings;
        if (this.languageLabel) this.languageLabel.textContent = this.uiText[lang].language + ":";
        else console.error("Language label element not found when setting language text.");
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
        document.querySelector('#bottom-hud').firstChild.textContent = this.uiText[lang].holding + ": ";
        this.loadingScreen.querySelector('h2').textContent = this.uiText[lang].loading;
        // Update language button selection state
        this.languageButtons.forEach(btn => btn.classList.toggle('active-lang', btn.dataset.lang === lang));
        // Re-populate level select if visible
        if (this.activeScreen === this.levelSelectScreen && this.saveManager) {
            // Need the actual level data array here, which UIManager doesn't store.
            // This indicates populateLevelSelect should ideally be called from main.js
            // when the state changes TO level select, rather than here.
            // For now, it won't update dynamically on language change unless re-entering the screen.
            console.warn("Level select text won't update dynamically on language change unless screen is re-entered.");
        }
    }
    getLabelToggleState() { return this.toggleLabelsCheckbox.checked; }
    setLabelToggleState(isChecked) { this.toggleLabelsCheckbox.checked = isChecked; }
}