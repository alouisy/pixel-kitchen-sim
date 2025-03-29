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

        this.levelTimer = 0;
        this.orderTimer = 0;
        this.currentScore = 0;

        this.isLevelRunning = false;
        this.isOrderActive = false;
    }

    loadLevel(levelIndex) {
        if (levelIndex < 0 || levelIndex >= this.levels.length) {
            console.error(`Invalid level index: ${levelIndex}. Ending game.`);
            // Maybe show a "Game Complete" screen or loop back?
            this.isLevelRunning = false; // Stop game logic
            this.isOrderActive = false;
            this.uiManager.showGameEndScreen(); // <<< ADDED CALL HERE
            return;
        }

        this.currentLevelIndex = levelIndex;
        this.currentLevelData = this.levels[this.currentLevelIndex];
        this.currentOrderIndex = -1; // Will be incremented by nextOrder
        this.currentScore = 0;
        this.levelTimer = this.currentLevelData.duration;
        this.isLevelRunning = true;
        this.isOrderActive = false; // No order active initially

        console.log(`Loading Level ${this.currentLevelData.levelId}: ${this.currentLevelData.name}`);
        this.uiManager.updateScore(this.currentScore);
        this.uiManager.updateLevelTimer(this.levelTimer);
        this.uiManager.updateOrder('None'); // Clear order initially
        this.uiManager.updateOrderTimer(0); // Clear order timer initially
        this.uiManager.hideLevelEndScreen(); // Ensure end screen is hidden

        // Delay starting the first order slightly? Optional.
        // setTimeout(() => this.nextOrder(), 500);
        this.nextOrder(); // Start the first order
    }

    nextOrder() {
        if (!this.isLevelRunning) return;

        // If previous order was active, clear UI for it
        if (this.isOrderActive) {
            this.uiManager.updateOrder('None');
            this.uiManager.updateOrderTimer(0);
        }

        this.currentOrderIndex++;
        if (this.currentOrderIndex >= this.currentLevelData.orders.length) {
            // Level complete - all orders issued
            console.log("All orders for level issued. Level continues until timer runs out.");
            // Don't end level here, wait for level timer.
            this.isOrderActive = false;
            this.currentOrderData = null; // No current order
            this.uiManager.updateOrder("No More Orders"); // Or ""
            this.uiManager.updateOrderTimer(0);
            // Maybe trigger endLevel check here if timer is also low?
            return;
        }

        this.currentOrderData = this.currentLevelData.orders[this.currentOrderIndex];
        this.orderTimer = this.currentOrderData.timeLimit;
        this.isOrderActive = true;

        console.log(`New Order: ${this.currentOrderData.mealName}`);
        this.uiManager.updateOrder(this.currentOrderData.mealName);
        this.uiManager.updateOrderTimer(this.orderTimer);
    }

    update(delta) {
        if (!this.isLevelRunning) return;

        // Update Level Timer
        this.levelTimer -= delta;
        this.uiManager.updateLevelTimer(this.levelTimer);

        if (this.levelTimer <= 0) {
            this.endLevel(); // End level due to time out
            return; // Stop further processing this frame
        }

        // Update Order Timer
        if (this.isOrderActive) {
            this.orderTimer -= delta;
            // Ensure timer doesn't visually go negative in UI
            this.uiManager.updateOrderTimer(Math.max(0, this.orderTimer));

            if (this.orderTimer <= 0) {
                this.failOrder(); // Order timed out
            }
        }
    }

    completeOrder(servedMealName) {
        if (!this.isOrderActive || !this.currentOrderData || servedMealName !== this.currentOrderData.mealName) {
            console.warn(`Attempted to complete invalid order. Active: ${this.isOrderActive}, Expected: ${this.currentOrderData?.mealName}, Served: ${servedMealName}`);
            // Optional: Add penalty for serving wrong meal?
            if (this.isOrderActive && this.currentOrderData) { // If there was an active order they got wrong
                this.currentScore -= Math.floor(this.currentOrderData.penalty / 2); // Smaller penalty for wrong item?
                this.currentScore = Math.max(0, this.currentScore);
                this.uiManager.updateScore(this.currentScore);
            }
            return false; // Indicate failure
        }

        console.log(`Order ${this.currentOrderData.mealName} completed successfully.`);
        // --- Scoring ---
        // Basic score + time bonus maybe?
        let scoreGained = this.currentOrderData.baseScore;
        // Example time bonus: +1 point per 2 seconds remaining, max 20 bonus
        let timeBonus = Math.min(20, Math.floor(Math.max(0, this.orderTimer) / 2));
        scoreGained += timeBonus;

        this.currentScore += scoreGained;
        this.uiManager.updateScore(this.currentScore);
        this.uiManager.showTemporaryMessage(`+${scoreGained} Points!`, 1500);
        // --- End Scoring ---

        const completedOrderName = this.currentOrderData.mealName; // Store before moving next
        this.isOrderActive = false; // Mark order as inactive
        this.currentOrderData = null;

        this.nextOrder(); // Move to the next order
        return true; // Indicate success
    }

    failOrder() {
        if (!this.isOrderActive || !this.currentOrderData) return;

        const failedOrderName = this.currentOrderData.mealName;
        console.log(`Order ${failedOrderName} FAILED (Timeout).`);
        this.uiManager.showTemporaryMessage(`Order Failed! -${this.currentOrderData.penalty}`, 2000);
        // --- Scoring Penalty ---
        this.currentScore -= this.currentOrderData.penalty;
        this.currentScore = Math.max(0, this.currentScore); // Don't go below zero
        this.uiManager.updateScore(this.currentScore);
        // --- End Scoring Penalty ---

        this.isOrderActive = false; // Mark order as inactive
        this.currentOrderData = null;
        this.nextOrder(); // Move to the next order
    }

    endLevel() {
        if (!this.isLevelRunning) return; // Prevent double execution

        console.log(`Level ${this.currentLevelData.levelId} ended. Final Score: ${this.currentScore}`);
        this.isLevelRunning = false;
        this.isOrderActive = false;

        // Clear timers visually
        this.uiManager.updateLevelTimer(0);
        this.uiManager.updateOrderTimer(0);
        this.uiManager.updateOrder("Level Over");


        // --- Calculate Stars ---
        let stars = 0;
        // Ensure thresholds are sorted ascending if not already guaranteed
        const thresholds = this.currentLevelData.starThresholds.sort((a, b) => a - b);
        if (this.currentScore >= thresholds[0]) stars = 1;
        if (thresholds.length > 1 && this.currentScore >= thresholds[1]) stars = 2;
        if (thresholds.length > 2 && this.currentScore >= thresholds[2]) stars = 3;
        console.log(`Stars Earned: ${stars}`);
        // --- End Calculate Stars ---

        // Display results
        this.uiManager.showLevelEndScreen(this.currentScore, stars, this.currentLevelIndex);
    }

    // --- Getters for UI ---
    getCurrentOrderName() {
        return this.isOrderActive ? this.currentOrderData?.mealName : "";
    }

    getLevelTimer() {
        return this.levelTimer;
    }

    getOrderTimer() {
        return this.isOrderActive ? this.orderTimer : 0;
    }

    getCurrentScore() {
        return this.currentScore;
    }

    isRunning() {
        return this.isLevelRunning;
    }
}