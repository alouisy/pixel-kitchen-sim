// src/orders.js

// Expand this list as you implement more recipes
const possibleOrders = ['French Fries']; // Add 'Salad', 'Hamburger', 'Cheeseburger'

export class OrderManager {
    constructor(uiManager) {
        this.currentOrder = null;
        this.uiManager = uiManager; // To update the UI
        this.generateNewOrder(); // Start with an order
    }

    generateNewOrder() {
        const randomIndex = Math.floor(Math.random() * possibleOrders.length);
        this.currentOrder = possibleOrders[randomIndex];
        console.log("New Order:", this.currentOrder);
        this.uiManager.updateOrder(this.currentOrder);
    }

    getCurrentOrder() {
        return this.currentOrder;
    }

    completeOrder() {
        // TODO: Add scoring or other logic here
        this.generateNewOrder();
    }
}