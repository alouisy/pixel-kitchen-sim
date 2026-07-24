import { getRecipeDetails } from './gameData.js'; // Keep recipe helper
import { normalizeLevelData } from './utils/legacyMigration.js';
import { getTrans } from './i18nData.js';

export class LevelManager {
    constructor(uiManager, saveManager, levelDatabase = []) {
        this.uiManager = uiManager;
        this.saveManager = saveManager;
        this.levelDatabase = levelDatabase;

        this.currentLevelIndex = -1;
        this.currentLevelData = null;
        this.currentScore = 0;
        this.levelTimer = 0;
        this.isLevelRunning = false;

        this.activeOrders = new Map();
        this.nextOrderId = 0;
        this.newOrderTimer = 0;
        this.newOrderDelay = 15;
        this.maxActiveOrders = 1;
        this.availableMeals = [];

        this.onOrderAdded = null;
        this.onOrderRemoved = null;
        this.onGameEnd = null;
        this.onLevelEnd = null;
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
        this.currentLevelData = normalizeLevelData(levelData); // Silently normalize legacy level keys
        this.currentScore = 0;
        this.levelTimer = this.currentLevelData.duration;
        this.isLevelRunning = true;
        this.activeOrders.clear();
        this.nextOrderId = 0;

        // Load parameters from the passed levelData
        const diff = this.saveManager?.getSetting('difficulty') || 'beginner';
        let delayFactor = 1.0;
        if (diff === 'beginner') delayFactor = 1.25;
        else if (diff === 'expert') delayFactor = 0.80;

        this.availableMeals = this.currentLevelData.availableMeals || [];
        this.maxActiveOrders = this.currentLevelData.maxActiveOrders || 1;
        this.newOrderDelay = (this.currentLevelData.newOrderDelay || 15) * delayFactor;
        this.newOrderTimer = 0; // Reset delay timer

        console.log(`Loading Level ${this.currentLevelData.levelId}: ${this.currentLevelData.name} (Difficulty: ${diff})`);
        
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

        const diff = this.saveManager?.getSetting('difficulty') || 'beginner';
        let diffTimeFactor = 1.0;
        if (diff === 'beginner') diffTimeFactor = 1.30;
        else if (diff === 'expert') diffTimeFactor = 0.75;

        const baseMultiplier = this.currentLevelData?.orderTimeMultiplier ?? 1.0;
        const finalTimeMultiplier = baseMultiplier * diffTimeFactor;

        const recipeDetails = getRecipeDetails(mealName, finalTimeMultiplier);

        if (!recipeDetails) {
            console.error(`Could not find recipe details for "${mealName}"`);
            return; // Skip if recipe details are missing
        }

        const orderId = `order-${this.currentLevelIndex}-${this.nextOrderId++}`;
        const newOrder = {
            id: orderId, mealName: mealName, timer: recipeDetails.timeLimit,
            maxTime: recipeDetails.timeLimit,
            baseScore: recipeDetails.baseScore, penalty: recipeDetails.penalty
        };

        this.activeOrders.set(orderId, newOrder);
        // Pass timeLimit as maxTime for progress bar calculation
        this.uiManager.addOrderCard(orderId, mealName, newOrder.timer);
        console.log(`Generated new order: ${mealName} (ID: ${orderId}, Time: ${newOrder.timer}s, Diff: ${diff})`);

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
                let penalty = 30; this.currentScore -= penalty;
                this.currentScore = Math.max(0, this.currentScore);
                this.uiManager.updateScore(this.currentScore);
                this.uiManager.showTemporaryMessage('wrong_order');
            } else { this.uiManager.showTemporaryMessage('wrong_order'); }
            return false;
        }

        // Success - Overcooked-style dynamic speed bonus
        let baseScore = completedOrderData.baseScore;
        let maxTime = completedOrderData.maxTime || completedOrderData.timer || 60;
        let remainingTime = Math.max(0, completedOrderData.timer);
        let timeRatio = Math.min(1.0, remainingTime / maxTime);

        // Speed tip bonus: up to +50% of base score for fast delivery
        let timeBonus = Math.round(baseScore * 0.5 * timeRatio);
        let scoreGained = baseScore + timeBonus;

        this.currentScore += scoreGained;
        this.uiManager.updateScore(this.currentScore);

        const lang = this.uiManager.currentLanguage || 'en';
        const ptsText = getTrans('pts', lang) || 'pts';
        const speedText = getTrans('speed_bonus', lang) || 'Speed Bonus';

        let msg = `+${scoreGained} ${ptsText}!`;
        if (timeBonus > 0) {
            msg += ` (+${timeBonus} ${speedText})`;
        }
        this.uiManager.showTemporaryMessage(msg, 2500);

        this.activeOrders.delete(completedOrderId); // Remove from map
        this.uiManager.removeOrderCard(completedOrderId); // Remove from UI

        return true;
    }

    failOrder(orderId) {
        const orderData = this.activeOrders.get(orderId);
        if (!orderData) return; // Already removed

        console.log(`Order ${orderData.mealName} (ID: ${orderId}) FAILED (Timeout).`);
        const lang = this.uiManager.currentLanguage || 'en';
        const failPattern = getTrans('order_failed', lang) || 'Order Failed! -{penalty}';
        this.uiManager.showTemporaryMessage(failPattern.replace('{penalty}', orderData.penalty), 2000);
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
