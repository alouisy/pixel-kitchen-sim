// src/LevelManager.js
import { LEVEL_DATABASE } from './gameData.js';

export class LevelManager {
    // --- Updated Constructor ---
    constructor(uiManager, saveManager) { // <<< Add saveManager
        this.uiManager = uiManager;
        this.saveManager = saveManager; // <<< Store saveManager
        this.levels = LEVEL_DATABASE;

        this.currentLevelIndex = -1;
        this.currentLevelData = null;
        this.currentOrderIndex = -1;
        this.currentOrderData = null;
        this.activeOrderCardId = null;

        this.levelTimer = 0;
        this.orderTimer = 0;
        this.currentScore = 0;

        this.isLevelRunning = false;
        this.isOrderActive = false;

        this.onLevelEnd = null;
        this.onGameEnd = null;
    }

    // World reset is handled BEFORE this is called
    loadLevel(levelIndex) {
        if (levelIndex < 0 || levelIndex >= this.levels.length) {
            console.log(`Invalid level index: ${levelIndex}. Triggering game end.`);
            this.isLevelRunning = false;
            this.isOrderActive = false;
            if (this.onGameEnd) this.onGameEnd();
            else console.error("onGameEnd callback not set in LevelManager");
            return false;
        }

        this.currentLevelIndex = levelIndex;
        this.currentLevelData = this.levels[this.currentLevelIndex];
        this.currentOrderIndex = -1;
        this.currentScore = 0;
        this.levelTimer = this.currentLevelData.duration;
        this.isLevelRunning = true;
        this.isOrderActive = false;
        this.activeOrderCardId = null;

        console.log(`Loading Level ${this.currentLevelData.levelId}: ${this.currentLevelData.name} internal state.`);
        this.uiManager.updateScore(this.currentScore);
        this.uiManager.updateLevelTimer(this.levelTimer);
        this.uiManager.clearOrderList();

        this.nextOrder();
        return true;
    }

    nextOrder() {
        if (!this.isLevelRunning) return;

        if (this.activeOrderCardId) {
            this.activeOrderCardId = null;
        }

        this.currentOrderIndex++;
        if (this.currentOrderIndex >= this.currentLevelData.orders.length) {
            console.log("All orders for level issued.");
            this.isOrderActive = false;
            this.currentOrderData = null;
            return;
        }

        this.currentOrderData = this.currentLevelData.orders[this.currentOrderIndex];
        this.orderTimer = this.currentOrderData.timeLimit;
        this.isOrderActive = true;
        this.activeOrderCardId = `l${this.currentLevelIndex}-o${this.currentOrderIndex}`;

        this.uiManager.addOrderCard(
            this.activeOrderCardId,
            this.currentOrderData.mealName,
            this.orderTimer
        );
    }

    update(delta) {
        if (!this.isLevelRunning) return;

        this.levelTimer -= delta;
        this.uiManager.updateLevelTimer(this.levelTimer);

        if (this.levelTimer <= 0) {
            this.endLevel();
            return;
        }

        if (this.isOrderActive && this.activeOrderCardId) {
            this.orderTimer -= delta;
            this.uiManager.updateOrderCardTimer(this.activeOrderCardId, this.orderTimer);

            if (this.orderTimer <= 0) {
                this.failOrder();
            }
        }
    }

    completeOrder(servedMealName) {
        if (!this.isOrderActive || !this.currentOrderData || servedMealName !== this.currentOrderData.mealName) {
            if (this.isOrderActive && this.currentOrderData) {
                this.currentScore -= Math.floor(this.currentOrderData.penalty / 2);
                this.currentScore = Math.max(0, this.currentScore);
                this.uiManager.updateScore(this.currentScore);
                this.uiManager.showTemporaryMessage('wrongOrder');
            } else {
                this.uiManager.showTemporaryMessage('wrongOrder');
            }
            return false;
        }

        let scoreGained = this.currentOrderData.baseScore;
        let timeBonus = Math.min(20, Math.floor(Math.max(0, this.orderTimer) / 2));
        scoreGained += timeBonus;

        this.currentScore += scoreGained;
        this.uiManager.updateScore(this.currentScore);
        this.uiManager.showTemporaryMessage(`+${scoreGained} Points!`, 1500);

        if (this.activeOrderCardId) {
            this.uiManager.removeOrderCard(this.activeOrderCardId);
            this.activeOrderCardId = null;
        }

        this.isOrderActive = false;
        this.currentOrderData = null;
        this.nextOrder();
        return true;
    }

    failOrder() {
        if (!this.isOrderActive || !this.currentOrderData || !this.activeOrderCardId) return;

        const failedOrderName = this.currentOrderData.mealName;
        this.uiManager.showTemporaryMessage(`Order Failed! -${this.currentOrderData.penalty}`, 2000);

        this.currentScore -= this.currentOrderData.penalty;
        this.currentScore = Math.max(0, this.currentScore);
        this.uiManager.updateScore(this.currentScore);

        this.uiManager.removeOrderCard(this.activeOrderCardId);
        this.activeOrderCardId = null;

        this.isOrderActive = false;
        this.currentOrderData = null;
        this.nextOrder();
    }

    endLevel() {
        if (!this.isLevelRunning) return;

        console.log(`Level ${this.currentLevelData.levelId} ended. Final Score: ${this.currentScore}`);
        this.isLevelRunning = false;
        this.isOrderActive = false;

        if (this.activeOrderCardId) {
            this.uiManager.removeOrderCard(this.activeOrderCardId);
            this.activeOrderCardId = null;
        }
        this.uiManager.updateLevelTimer(0);

        let stars = 0;
        const thresholds = this.currentLevelData.starThresholds.sort((a, b) => a - b);
        if (this.currentScore >= thresholds[0]) stars = 1;
        if (thresholds.length > 1 && this.currentScore >= thresholds[1]) stars = 2;
        if (thresholds.length > 2 && this.currentScore >= thresholds[2]) stars = 3;

        // --- Save Progress ---
        if (this.saveManager) {
            this.saveManager.updateLevelCompletion(this.currentLevelIndex, this.currentScore, stars);
        } else {
            console.warn("SaveManager not available in LevelManager to save progress.");
        }
        // --- End Save Progress ---

        if (this.onLevelEnd) {
            this.onLevelEnd(this.currentScore, stars, this.currentLevelIndex);
        } else {
            console.error("onLevelEnd callback not set in LevelManager");
        }
    }

    getCurrentOrderName() {
        return this.isOrderActive ? this.currentOrderData?.mealName : "";
    }

    isRunning() {
        return this.isLevelRunning;
    }
}