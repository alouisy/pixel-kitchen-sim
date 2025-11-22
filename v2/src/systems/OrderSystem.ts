import { useGameStore } from '../store/useGameStore';
import { RECIPES } from './RecipeSystem';
import { v4 as uuidv4 } from 'uuid';
import type { Order } from '../types/GameTypes';

export const OrderSystem = {
    update: () => {
        const state = useGameStore.getState();
        const { currentLevel } = state;

        if (!currentLevel) return;

        // 1. Update existing orders
        // We need to update order duration. 
        // Since orders are in store, we might need a way to update them efficiently.
        // Or we just let GameLoop handle the timer decrement?
        // GameLoop decrements main timer. Order timers need to be decremented too.
        // Let's do it here.

        // Note: Updating store every frame for every order might be heavy for React.
        // But for < 10 orders it's fine.

        // However, useGameStore doesn't have updateOrder method exposed easily for batch updates.
        // Let's just check for expiration here and maybe update time every second?
        // Or better: Store 'startTime' and 'duration' and calculate remaining time in UI?
        // That's better for performance. 
        // But we need to fail orders when time runs out.

        // Let's stick to checking expiration.
        // const now = Date.now();

        // We need to store when the order was added to calculate remaining time properly without updating store every frame.
        // But our Order type has 'duration' which implies remaining time?
        // Let's assume 'duration' is remaining time for now as per previous HUD code.

        // Actually, let's update 'duration' (remaining time) every tick.
        // To avoid too many re-renders, maybe we only update it in the store every second?
        // Or we use a ref for the loop and only sync to store occasionally?

        // Simplest approach for now: Update every frame (or 100ms).
        // But wait, HUD uses it for progress bar.

        // Let's implement a tick accumulator.

    },

    // Called every second by GameLoop
    tick: () => {
        const state = useGameStore.getState();
        const { currentLevel, orders, addOrder, tickOrders } = state;

        if (!currentLevel || state.gameState !== 'PLAYING') return;

        // 1. Update Timers & Remove Expired
        tickOrders();

        // 2. Generate New Orders
        if (orders.length < currentLevel.maxActiveOrders) {
            // Simple random chance based on delay
            // If delay is 10s, chance is 1/10 per second.
            if (Math.random() < 1 / currentLevel.newOrderDelay) {
                const recipeName = currentLevel.availableMeals[Math.floor(Math.random() * currentLevel.availableMeals.length)];
                const recipe = RECIPES[recipeName];
                if (recipe) {
                    const newOrder: Order = {
                        id: uuidv4(),
                        recipeName: recipe.name,
                        status: 'active',
                        duration: recipe.timeLimit,
                        startTime: Date.now(),
                        score: recipe.baseScore
                    };
                    addOrder(newOrder);
                }
            }
        }
    }
};
