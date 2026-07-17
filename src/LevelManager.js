// src/LevelManager.js
import { getRecipeDetails } from './gameData.js'; // Keep recipe helper

export class LevelManager {
    constructor(uiManager, saveManager, levelDatabaseRef) { // Accept levelDatabase reference
        this.uiManager = uiManager;
        this.saveManager = saveManager;
        this.levels = levelDatabaseRef; // Store reference to the fetched data

        this.currentLevelIndex = -1;
        this.currentLevelData = null; // This will hold the specific level object from the database

        // Level parameters (will be set in loadLevel)
        this.availableMeals = [];
        this.maxActiveOrders = 1;
        this.newOrderDelay = 15;
        this.newOrderTimer = 0;

        // Active state
        this.activeOrders = new Map(); // Map: orderId -> orderData { id, mealName, timer, baseScore, penalty }
        this.nextOrderId = 0; // Simple counter for unique IDs per level load

        this.levelTimer = 0;
        this.currentScore = 0;
        this.isLevelRunning = false;

        this.onLevelEnd = null;
        this.onGameEnd = null;
    }

    // Accepts the specific levelData object for the level being loaded
    loadLevel(levelIndex, levelData) {
        if (!levelData) {
            console.error(`No level data provided for index ${levelIndex}`);
            this.isLevelRunning = false;
            if (this.onGameEnd) this.onGameEnd();
            return false;
        }

        // Reset internal state
        this.currentLevelIndex = levelIndex;
        this.currentLevelData = levelData; // Store the specific level object
        this.currentScore = 0;
        this.levelTimer = this.currentLevelData.duration;
        this.isLevelRunning = true;
        this.activeOrders.clear();
        this.nextOrderId = 0;

        // Load parameters from the passed levelData
        this.availableMeals = this.currentLevelData.availableMeals || [];
        this.maxActiveOrders = this.currentLevelData.maxActiveOrders || 1;
        this.newOrderDelay = this.currentLevelData.newOrderDelay || 15;
        this.newOrderTimer = 0; // Reset delay timer

        console.log(`Loading Level ${this.currentLevelData.levelId}: ${this.currentLevelData.name}`);
        
        this.uiManager.updateScore(this.currentScore);
        this.uiManager.updateLevelTimer(this.levelTimer);
        this.uiManager.clearOrderList();

        // Attempt to generate initial orders up to the max allowed
        for (let i = 0; i < this.maxActiveOrders; i++) {
            this.generateNewOrder();
        }
        // Start the cooldown timer after initial generation
        this.newOrderTimer = this.newOrderDelay;

        return true; // Indicate success
    }

    generateNewOrder() {
        if (this.activeOrders.size >= this.maxActiveOrders || this.availableMeals.length === 0) {
            return; // Don't generate if max reached or no meals possible
        }

        const randomIndex = Math.floor(Math.random() * this.availableMeals.length);
        const mealName = this.availableMeals[randomIndex];
        const recipeDetails = getRecipeDetails(mealName);

        if (!recipeDetails) {
            console.error(`Could not find recipe details for "${mealName}"`);
            return; // Skip if recipe details are missing
        }

        const orderId = `order-${this.currentLevelIndex}-${this.nextOrderId++}`;
        const newOrder = {
            id: orderId, mealName: mealName, timer: recipeDetails.timeLimit,
            baseScore: recipeDetails.baseScore, penalty: recipeDetails.penalty
        };

        this.activeOrders.set(orderId, newOrder);
        // Pass timeLimit as maxTime for progress bar calculation
        this.uiManager.addOrderCard(orderId, mealName, newOrder.timer);
        console.log(`Generated new order: ${mealName} (ID: ${orderId})`);

        // Reset the cooldown timer for the *next* potential order
        this.newOrderTimer = this.newOrderDelay;
    }


    update(delta) {
        if (!this.isLevelRunning) return;

        // 1. Update Level Timer & Check End Condition
        this.levelTimer -= delta;
        this.uiManager.updateLevelTimer(this.levelTimer);
        if (this.levelTimer <= 0) { this.endLevel(); return; }

        // 2. Update Active Order Timers & Check Failures
        const failedOrderIds = [];
        this.activeOrders.forEach((order, orderId) => {
            order.timer -= delta;
            this.uiManager.updateOrderCardTimer(orderId, order.timer);
            if (order.timer <= 0) failedOrderIds.push(orderId);
        });
        failedOrderIds.forEach(orderId => this.failOrder(orderId)); // Process failures

        // 3. Check if New Order Should Be Generated
        this.newOrderTimer -= delta;
        if (this.activeOrders.size < this.maxActiveOrders && this.newOrderTimer <= 0) {
            this.generateNewOrder();
        }
    }

    completeOrder(servedMealName) {
        let completedOrderId = null, completedOrderData = null;
        for (const [orderId, orderData] of this.activeOrders.entries()) {
            if (orderData.mealName === servedMealName) {
                completedOrderId = orderId; completedOrderData = orderData; break;
            }
        }

        if (!completedOrderId) { // No matching active order found
            console.warn(`Attempted to complete invalid order: ${servedMealName}.`);
            if (this.activeOrders.size > 0) { // Penalize only if other orders were active
                let penalty = 25; this.currentScore -= penalty;
                this.currentScore = Math.max(0, this.currentScore);
                this.uiManager.updateScore(this.currentScore);
                this.uiManager.showTemporaryMessage('Wrong / No Order!');
            } else { this.uiManager.showTemporaryMessage('Wrong / No Order!'); }
            return false;
        }

        // Success
        let scoreGained = completedOrderData.baseScore;
        let timeBonus = Math.min(20, Math.floor(Math.max(0, completedOrderData.timer) / 2));
        scoreGained += timeBonus;
        this.currentScore += scoreGained;
        this.uiManager.updateScore(this.currentScore);
        this.uiManager.showTemporaryMessage(`+${scoreGained} Points!`, 1500);

        this.activeOrders.delete(completedOrderId); // Remove from map
        this.uiManager.removeOrderCard(completedOrderId); // Remove from UI

        return true;
    }

    failOrder(orderId) {
        const orderData = this.activeOrders.get(orderId);
        if (!orderData) return; // Already removed

        console.log(`Order ${orderData.mealName} (ID: ${orderId}) FAILED (Timeout).`);
        this.uiManager.showTemporaryMessage(`Order Failed! -${orderData.penalty}`, 2000);
        this.currentScore -= orderData.penalty;
        this.currentScore = Math.max(0, this.currentScore);
        this.uiManager.updateScore(this.currentScore);

        this.activeOrders.delete(orderId); // Remove from map
        this.uiManager.removeOrderCard(orderId); // Remove from UI
    }

    endLevel() {
        if (!this.isLevelRunning) return;
        console.log(`Level ${this.currentLevelData.levelId} ended. Final Score: ${this.currentScore}`);
        this.isLevelRunning = false;

        this.activeOrders.clear(); // Clear remaining orders
        this.uiManager.clearOrderList();
        this.uiManager.updateLevelTimer(0);

        let stars = 0;
        const thresholds = [...(this.currentLevelData.starThresholds || [])].sort((a, b) => a - b);
        if (this.currentScore >= thresholds[0]) stars = 1;
        if (thresholds.length > 1 && this.currentScore >= thresholds[1]) stars = 2;
        if (thresholds.length > 2 && this.currentScore >= thresholds[2]) stars = 3;

        if (this.saveManager) {
            this.saveManager.updateLevelCompletion(this.currentLevelData, this.currentScore, stars);
        } else { console.warn("SaveManager not available to save progress."); }

        if (this.onLevelEnd) this.onLevelEnd(this.currentScore, stars, this.currentLevelIndex);
        else console.error("onLevelEnd callback not set in LevelManager");
    }

    isRunning() { return this.isLevelRunning; }
}
