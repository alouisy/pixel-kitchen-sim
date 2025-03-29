// src/ui.js

// Helper to format time
function formatTime(seconds) {
    const mins = Math.floor(Math.max(0, seconds) / 60);
    const secs = Math.floor(Math.max(0, seconds) % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export class UIManager {
    constructor() {
        this.orderElement = document.getElementById('order');
        this.holdingElement = document.getElementById('holding');
        // Optional: Add an element for temporary messages
        this.messageElement = document.getElementById('temp-message'); // Use existing div
        this.gamepadStatusElement = document.getElementById('gamepad-status'); // Get status element

        this.scoreElement = document.getElementById('score');
        this.levelTimerElement = document.getElementById('level-timer');
        this.orderTimerElement = document.getElementById('order-timer');
        this.levelEndScreen = document.getElementById('level-end-screen');
        this.finalScoreElement = document.getElementById('final-score');
        this.finalStarsElement = document.getElementById('final-stars');
        // Keep track of message timeout
        this.messageTimeout = null;
    }

    updateOrder(orderName) {
        this.orderElement.textContent = orderName || 'None';
    }

    updateHolding(itemName) {
        // If item is a plate with contents, show contents count? Or meal name if ready?
        if (itemName && itemName === 'plate') {
            // We don't have direct access to the item object here.
            // For simplicity, just show "Plate". InteractionManager could potentially update this differently.
            this.holdingElement.textContent = 'Plate';
            // TODO: Could potentially pass the actual item object or its data for a richer display
        } else {
            this.holdingElement.textContent = itemName || 'Nothing';
        }
    }


    updateGamepadStatus(isConnected) {
        if (this.gamepadStatusElement) {
            this.gamepadStatusElement.textContent = isConnected ? '🎮 Gamepad Connected' : '';
            this.gamepadStatusElement.style.color = isConnected ? '#90ee90' : 'inherit'; // Light green if connected
        }
    }

    showTemporaryMessage(message, duration = 2000) {
        if (!this.messageElement) return;

        this.messageElement.textContent = message;
        this.messageElement.style.display = 'block';
        this.messageElement.style.opacity = 1; // Ensure visible

        // Clear previous timeout if any
        if (this.messageTimeout) clearTimeout(this.messageTimeout);

        // Fade out slightly before hiding
        this.messageTimeout = setTimeout(() => {
            this.messageElement.style.transition = 'opacity 0.5s ease-out';
            this.messageElement.style.opacity = 0;
            setTimeout(() => {
                if (this.messageElement.style.opacity === '0') { // Check if it wasn't reset by a new message
                    this.messageElement.style.display = 'none';
                    this.messageElement.style.transition = ''; // Reset transition
                }
                this.messageTimeout = null;
            }, 500); // Wait for fade out transition
        }, duration - 500); // Start fade slightly before duration ends
    }


    updateScore(score) {
        if (this.scoreElement) {
            this.scoreElement.textContent = score;
        }
    }

    updateLevelTimer(seconds) {
        if (this.levelTimerElement) {
            this.levelTimerElement.textContent = formatTime(seconds);
        }
    }

    updateOrderTimer(seconds) {
        if (this.orderTimerElement) {
            this.orderTimerElement.textContent = formatTime(seconds);
            // Optional: Change color if time is low
            this.orderTimerElement.style.color = (seconds > 0 && seconds <= 15) ? 'orange' : (seconds <= 0 ? 'red' : 'white');
        }
    }

    showLevelEndScreen(score, stars, levelIndex) {
        if (this.levelEndScreen) {
            this.levelEndScreen.querySelector('h2').textContent = "Level Complete!";
            this.finalScoreElement.textContent = score;
            this.finalStarsElement.textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
            // Store level index for buttons
            this.levelEndScreen.dataset.levelIndex = levelIndex;

            // Show/hide buttons appropriately
            document.getElementById('next-level-button').style.display = 'block'; // Or check if next level exists
            const restartButton = document.getElementById('restart-level-button');
            restartButton.textContent = 'Restart Level';
            restartButton.style.display = 'block';


            this.levelEndScreen.style.display = 'flex';
        }
    }

    hideLevelEndScreen() {
        if (this.levelEndScreen) {
            this.levelEndScreen.style.display = 'none';
        }
    }

    // Added function for end of all levels
    showGameEndScreen() {
        console.log("GAME OVER / ALL LEVELS COMPLETE");
        if (this.levelEndScreen) {
            this.levelEndScreen.querySelector('h2').textContent = "Congratulations!";
            this.finalScoreElement.textContent = "-"; // Or maybe total score?
            this.finalStarsElement.textContent = "All Levels Done!";
            this.levelEndScreen.dataset.levelIndex = '-1'; // Indicate game end

            // Hide next level, change restart text
            document.getElementById('next-level-button').style.display = 'none';
            const restartButton = document.getElementById('restart-level-button');
            restartButton.textContent = 'Play Again? (Start Lvl 1)';
            restartButton.style.display = 'block';

            this.levelEndScreen.style.display = 'flex';
        }
    }
}