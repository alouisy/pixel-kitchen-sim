// src/LevelManager.js
import { LEVEL_DATABASE, getRecipeDetails } from './gameData.js'; // Import helper

export class LevelManager {
    constructor(uiManager, saveManager) {
        this.uiManager = uiManager;
        this.saveManager = saveManager;
        this.levels = LEVEL_DATABASE;

        this.currentLevelIndex = -1;
        this.currentLevelData = null;

        // Level parameters
        this.availableMeals = [];
        this.maxActiveOrders = 1;
        this.newOrderDelay = 15; // Default delay
        this.newOrderTimer = 0; // Timer to track delay

        // Active state
        this.activeOrders = new Map(); // Use Map: orderId -> orderData { id, mealName, timer, baseScore, penalty }
        this.nextOrderId = 0; // Simple counter for unique IDs

        this.levelTimer = 0;
        this.currentScore = 0;
        this.isLevelRunning = false;

        this.onLevelEnd = null;
        this.onGameEnd = null;
    }

    loadLevel(levelIndex) {
        if (levelIndex < 0 || levelIndex >= this.levels.length) {
            console.log(`Invalid level index: ${levelIndex}. Triggering game end.`);
            this.isLevelRunning = false;
            if (this.onGameEnd) this.onGameEnd();
            return false;
        }

        // Reset state for new level
        this.currentLevelIndex = levelIndex;
        this.currentLevelData = this.levels[this.currentLevelIndex];
        this.currentScore = 0;
        this.levelTimer = this.currentLevelData.duration;
        this.isLevelRunning = true;
        this.activeOrders.clear(); // Clear previous active orders
        this.nextOrderId = 0;

        // Load level-specific parameters
        this.availableMeals = this.currentLevelData.availableMeals || [];
        this.maxActiveOrders = this.currentLevelData.maxActiveOrders || 1;
        this.newOrderDelay = this.currentLevelData.newOrderDelay || 15;
        this.newOrderTimer = 0; // Reset delay timer

        console.log(`Loading Level ${this.currentLevelData.levelId}: ${this.currentLevelData.name}`);
        console.log(` - Available Meals: ${this.availableMeals.join(', ')}`);
        console.log(` - Max Orders: ${this.maxActiveOrders}, Delay: ${this.newOrderDelay}s`);

        this.uiManager.updateScore(this.currentScore);
        this.uiManager.updateLevelTimer(this.levelTimer);
        this.uiManager.clearOrderList();

        // Attempt to generate initial orders
        for (let i = 0; i < this.maxActiveOrders; i++) {
            this.generateNewOrder();
        }
        // Start the cooldown timer after initial generation
        this.newOrderTimer = this.newOrderDelay;


        return true;
    }

    generateNewOrder() {
        // Check if max orders reached or no meals available
        if (this.activeOrders.size >= this.maxActiveOrders || this.availableMeals.length === 0) {
            return;
        }

        // Select a random meal
        const randomIndex = Math.floor(Math.random() * this.availableMeals.length);
        const mealName = this.availableMeals[randomIndex];
        const recipeDetails = getRecipeDetails(mealName);

        if (!recipeDetails) {
            console.error(`Could not find recipe details for "${mealName}"`);
            return;
        }

        // Create unique ID
        const orderId = `order-${this.currentLevelIndex}-${this.nextOrderId++}`;

        // Create order data object
        const newOrder = {
            id: orderId,
            mealName: mealName,
            timer: recipeDetails.timeLimit,
            baseScore: recipeDetails.baseScore,
            penalty: recipeDetails.penalty
        };

        // Add to active orders map
        this.activeOrders.set(orderId, newOrder);

        // Add card to UI
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
        if (this.levelTimer <= 0) {
            this.endLevel();
            return; // Stop processing if level ended
        }

        // 2. Update Active Order Timers & Check Failures
        const failedOrderIds = []; // Collect IDs of failed orders
        this.activeOrders.forEach((order, orderId) => {
            order.timer -= delta;
            this.uiManager.updateOrderCardTimer(orderId, order.timer);
            if (order.timer <= 0) {
                failedOrderIds.push(orderId); // Mark for failure
            }
        });

        // Process failures outside the loop to avoid modifying map during iteration
        failedOrderIds.forEach(orderId => {
            this.failOrder(orderId);
        });

        // 3. Check if New Order Should Be Generated
        this.newOrderTimer -= delta;
        if (this.activeOrders.size < this.maxActiveOrders && this.newOrderTimer <= 0) {
            this.generateNewOrder();
            // generateNewOrder resets the timer internally
        }
    }

    completeOrder(servedMealName) {
        let completedOrderId = null;
        let completedOrderData = null;

        // Find the first active order matching the served meal
        for (const [orderId, orderData] of this.activeOrders.entries()) {
            if (orderData.mealName === servedMealName) {
                completedOrderId = orderId;
                completedOrderData = orderData;
                break; // Found a match, stop searching
            }
        }

        if (!completedOrderId || !completedOrderData) {
            console.warn(`Attempted to complete invalid order: ${servedMealName}. No active order found.`);
            // Apply penalty only if there *are* active orders they could have matched
            if (this.activeOrders.size > 0) {
                // Simple penalty: average penalty of active orders? Or fixed?
                let penalty = 25; // Fixed penalty for wrong item
                this.currentScore -= penalty;
                this.currentScore = Math.max(0, this.currentScore);
                this.uiManager.updateScore(this.currentScore);
                this.uiManager.showTemporaryMessage('wrongOrder');
            } else {
                this.uiManager.showTemporaryMessage('wrongOrder'); // Or "No Active Order"
            }
            return false;
        }

        // Order completed successfully
        console.log(`Order ${completedOrderData.mealName} (ID: ${completedOrderId}) completed.`);
        let scoreGained = completedOrderData.baseScore;
        let timeBonus = Math.min(20, Math.floor(Math.max(0, completedOrderData.timer) / 2)); // Use timer from completed order
        scoreGained += timeBonus;

        this.currentScore += scoreGained;
        this.uiManager.updateScore(this.currentScore);
        this.uiManager.showTemporaryMessage(`+${scoreGained} Points!`, 1500);

        // Remove the completed order
        this.activeOrders.delete(completedOrderId);
        this.uiManager.removeOrderCard(completedOrderId);

        // Reset cooldown to potentially allow faster next order after success? Optional.
        // this.newOrderTimer = Math.min(this.newOrderTimer, 5); // e.g., min 5s cooldown

        return true;
    }

    // Fail a specific order by ID
    failOrder(orderId) {
        const orderData = this.activeOrders.get(orderId);
        if (!orderData) return; // Already removed or doesn't exist

        console.log(`Order ${orderData.mealName} (ID: ${orderId}) FAILED (Timeout).`);
        this.uiManager.showTemporaryMessage(`Order Failed! -${orderData.penalty}`, 2000);

        this.currentScore -= orderData.penalty;
        this.currentScore = Math.max(0, this.currentScore);
        this.uiManager.updateScore(this.currentScore);

        // Remove the failed order
        this.activeOrders.delete(orderId);
        this.uiManager.removeOrderCard(orderId);

        // Reset cooldown to potentially allow faster next order after failure? Optional.
        // this.newOrderTimer = Math.min(this.newOrderTimer, 5);
    }

    endLevel() {
        if (!this.isLevelRunning) return;
        console.log(`Level ${this.currentLevelData.levelId} ended. Final Score: ${this.currentScore}`);
        this.isLevelRunning = false;

        // Clear any remaining orders from map and UI
        this.activeOrders.clear();
        this.uiManager.clearOrderList();
        this.uiManager.updateLevelTimer(0);

        let stars = 0;
        const thresholds = this.currentLevelData.starThresholds.sort((a, b) => a - b);
        if (this.currentScore >= thresholds[0]) stars = 1;
        if (thresholds.length > 1 && this.currentScore >= thresholds[1]) stars = 2;
        if (thresholds.length > 2 && this.currentScore >= thresholds[2]) stars = 3;

        if (this.saveManager) {
            this.saveManager.updateLevelCompletion(this.currentLevelIndex, this.currentScore, stars);
        } else { console.warn("SaveManager not available to save progress."); }

        if (this.onLevelEnd) this.onLevelEnd(this.currentScore, stars, this.currentLevelIndex);
        else console.error("onLevelEnd callback not set in LevelManager");
    }

    // No longer needed / relevant with new system
    // getCurrentOrderName() { return ""; }

    isRunning() { return this.isLevelRunning; }
}