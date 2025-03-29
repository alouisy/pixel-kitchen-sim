// src/LevelManager.js
import { LEVEL_DATABASE } from './gameData.js';

export class LevelManager {
    constructor(uiManager) {
        this.uiManager = uiManager;
        this.levels = LEVEL_DATABASE;

        this.currentLevelIndex = -1;
        this.currentLevelData = null;
        this.currentOrderIndex = -1;
        this.currentOrderData = null;
        this.activeOrderCardId = null; // Track the ID for UI updates

        this.levelTimer = 0;
        this.orderTimer = 0;
        this.currentScore = 0;

        this.isLevelRunning = false;
        this.isOrderActive = false;

        // Callbacks to signal main game loop
        this.onLevelEnd = null;
        this.onGameEnd = null;
    }

    loadLevel(levelIndex) {
        if (levelIndex < 0 || levelIndex >= this.levels.length) {
            console.log(`Invalid level index: ${levelIndex}. Triggering game end.`);
            this.isLevelRunning = false;
            this.isOrderActive = false;
            if (this.onGameEnd) this.onGameEnd(); // Signal game end
            else console.error("onGameEnd callback not set in LevelManager");
            return false; // Indicate loading failed
        }

        this.currentLevelIndex = levelIndex;
        this.currentLevelData = this.levels[this.currentLevelIndex];
        this.currentOrderIndex = -1;
        this.currentScore = 0;
        this.levelTimer = this.currentLevelData.duration;
        this.isLevelRunning = true;
        this.isOrderActive = false;
        this.activeOrderCardId = null;

        console.log(`Loading Level ${this.currentLevelData.levelId}: ${this.currentLevelData.name}`);
        this.uiManager.updateScore(this.currentScore);
        this.uiManager.updateLevelTimer(this.levelTimer);
        this.uiManager.clearOrderList(); // Clear previous orders

        this.nextOrder(); // Start the first order
        return true; // Indicate success
    }

    nextOrder() {
        if (!this.isLevelRunning) return;

        // If previous order was active, maybe remove its card or mark as missed?
        // For now, we just replace it. Consider multiple cards later.
        if (this.activeOrderCardId) {
            // Optionally remove the old card immediately or let it fade
            // this.uiManager.removeOrderCard(this.activeOrderCardId);
            this.activeOrderCardId = null;
        }


        this.currentOrderIndex++;
        if (this.currentOrderIndex >= this.currentLevelData.orders.length) {
            console.log("All orders for level issued.");
            this.isOrderActive = false;
            this.currentOrderData = null;
            // Maybe show "No More Orders" in UI? Handled by not adding a new card.
            return;
        }

        this.currentOrderData = this.currentLevelData.orders[this.currentOrderIndex];
        this.orderTimer = this.currentOrderData.timeLimit;
        this.isOrderActive = true;

        // Generate a unique ID for the order card (e.g., using level and order index)
        this.activeOrderCardId = `l${this.currentLevelIndex}-o${this.currentOrderIndex}`;

        console.log(`New Order: ${this.currentOrderData.mealName} (ID: ${this.activeOrderCardId})`);
        // Add the new order card to the UI
        this.uiManager.addOrderCard(
            this.activeOrderCardId,
            this.currentOrderData.mealName,
            this.orderTimer
        );
    }

    update(delta) {
        if (!this.isLevelRunning) return;

        // Update Level Timer
        this.levelTimer -= delta;
        this.uiManager.updateLevelTimer(this.levelTimer);

        if (this.levelTimer <= 0) {
            this.endLevel(); // End level due to time out
            return;
        }

        // Update Order Timer
        if (this.isOrderActive && this.activeOrderCardId) {
            this.orderTimer -= delta;
            this.uiManager.updateOrderCardTimer(this.activeOrderCardId, this.orderTimer);

            if (this.orderTimer <= 0) {
                this.failOrder(); // Order timed out
            }
        }
    }

    completeOrder(servedMealName) {
        if (!this.isOrderActive || !this.currentOrderData || servedMealName !== this.currentOrderData.mealName) {
            console.warn(`Attempted to complete invalid order. Active: ${this.isOrderActive}, Expected: ${this.currentOrderData?.mealName}, Served: ${servedMealName}`);
            if (this.isOrderActive && this.currentOrderData) {
                this.currentScore -= Math.floor(this.currentOrderData.penalty / 2);
                this.currentScore = Math.max(0, this.currentScore);
                this.uiManager.updateScore(this.currentScore);
                this.uiManager.showTemporaryMessage('wrongOrder'); // Use key for translation
            } else {
                this.uiManager.showTemporaryMessage('wrongOrder');
            }
            return false;
        }

        console.log(`Order ${this.currentOrderData.mealName} completed successfully.`);
        let scoreGained = this.currentOrderData.baseScore;
        let timeBonus = Math.min(20, Math.floor(Math.max(0, this.orderTimer) / 2));
        scoreGained += timeBonus;

        this.currentScore += scoreGained;
        this.uiManager.updateScore(this.currentScore);
        // Show score gain message - maybe needs specific text handling in UIManager
        this.uiManager.showTemporaryMessage(`+${scoreGained} Points!`, 1500); // Keep specific message for score

        // Remove the completed order card
        if (this.activeOrderCardId) {
            this.uiManager.removeOrderCard(this.activeOrderCardId);
            this.activeOrderCardId = null;
        }

        this.isOrderActive = false;
        this.currentOrderData = null;
        this.nextOrder(); // Move to the next order
        return true;
    }

    failOrder() {
        if (!this.isOrderActive || !this.currentOrderData || !this.activeOrderCardId) return;

        const failedOrderName = this.currentOrderData.mealName;
        console.log(`Order ${failedOrderName} FAILED (Timeout).`);
        // Show penalty message - maybe needs specific text handling in UIManager
        this.uiManager.showTemporaryMessage(`Order Failed! -${this.currentOrderData.penalty}`, 2000); // Keep specific message

        this.currentScore -= this.currentOrderData.penalty;
        this.currentScore = Math.max(0, this.currentScore);
        this.uiManager.updateScore(this.currentScore);

        // Remove the failed order card
        this.uiManager.removeOrderCard(this.activeOrderCardId);
        this.activeOrderCardId = null;

        this.isOrderActive = false;
        this.currentOrderData = null;
        this.nextOrder(); // Move to the next order
    }

    endLevel() {
        if (!this.isLevelRunning) return;

        console.log(`Level ${this.currentLevelData.levelId} ended. Final Score: ${this.currentScore}`);
        this.isLevelRunning = false;
        this.isOrderActive = false;

        // Clear any remaining order card
        if (this.activeOrderCardId) {
            this.uiManager.removeOrderCard(this.activeOrderCardId);
            this.activeOrderCardId = null;
        }
        this.uiManager.updateLevelTimer(0); // Ensure timer shows 0

        let stars = 0;
        const thresholds = this.currentLevelData.starThresholds.sort((a, b) => a - b);
        if (this.currentScore >= thresholds[0]) stars = 1;
        if (thresholds.length > 1 && this.currentScore >= thresholds[1]) stars = 2;
        if (thresholds.length > 2 && this.currentScore >= thresholds[2]) stars = 3;
        console.log(`Stars Earned: ${stars}`);

        // Signal the main loop to show the end screen
        if (this.onLevelEnd) {
            this.onLevelEnd(this.currentScore, stars, this.currentLevelIndex);
        } else {
            console.error("onLevelEnd callback not set in LevelManager");
        }
    }

    getCurrentOrderName() { // Still useful for internal checks maybe
        return this.isOrderActive ? this.currentOrderData?.mealName : "";
    }

    isRunning() {
        return this.isLevelRunning;
    }
}