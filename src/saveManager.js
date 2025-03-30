// src/saveManager.js

const SAVE_KEY = 'pixelKitchenSaveData'; // Key for localStorage

export class SaveManager {
    constructor() {
        this.saveData = this.loadProgress();
        console.log("SaveManager Initialized. Loaded data:", this.saveData);
    }

    // Load progress from localStorage
    loadProgress() {
        try {
            const savedString = localStorage.getItem(SAVE_KEY);
            if (savedString) {
                const data = JSON.parse(savedString);
                // Basic validation (ensure it has the expected structure)
                if (data && typeof data.levels === 'object') {
                    return data;
                } else {
                    console.warn("Invalid save data found in localStorage. Resetting.");
                    return this.createDefaultSaveData();
                }
            } else {
                // No save data found, create default
                return this.createDefaultSaveData();
            }
        } catch (error) {
            console.error("Error loading save data from localStorage:", error);
            // Fallback to default data on error
            return this.createDefaultSaveData();
        }
    }

    // Save current progress to localStorage
    saveProgress() {
        try {
            const dataString = JSON.stringify(this.saveData);
            localStorage.setItem(SAVE_KEY, dataString);
            // console.log("Progress saved:", this.saveData); // Optional: Log on save
        } catch (error) {
            console.error("Error saving progress to localStorage:", error);
        }
    }

    // Create a default save data structure
    createDefaultSaveData() {
        return {
            levels: {} // Use an object keyed by levelIndex (or levelId)
            // Add other global save data here if needed (e.g., language preference)
            // settings: { language: 'en' }
        };
    }

    // Get progress data for a specific level index
    getLevelProgress(levelIndex) {
        return this.saveData.levels[levelIndex] || { completed: false, highScore: 0, stars: 0 };
    }

    // Update progress for a completed level
    updateLevelCompletion(levelIndex, score, stars) {
        const currentProgress = this.getLevelProgress(levelIndex);

        // Only update if completed or if the new score is higher
        if (!currentProgress.completed || score > currentProgress.highScore) {
            console.log(`Updating save data for Level ${levelIndex}: Score=${score}, Stars=${stars} (Previous High: ${currentProgress.highScore})`);
            this.saveData.levels[levelIndex] = {
                completed: true,
                highScore: score,
                stars: stars
            };
            this.saveProgress(); // Save immediately after updating
        } else {
            console.log(`Score ${score} for Level ${levelIndex} is not higher than existing high score ${currentProgress.highScore}. Not saving.`);
        }
    }

    // --- Optional Helper Methods ---

    // Check if a level is unlocked (e.g., previous level completed)
    isLevelUnlocked(levelIndex) {
        if (levelIndex === 0) return true; // First level always unlocked
        const prevLevelProgress = this.getLevelProgress(levelIndex - 1);
        return prevLevelProgress.completed; // Unlocked if previous level is completed
    }

    // Reset all progress (for testing or user option)
    resetAllProgress() {
        console.warn("Resetting all save data!");
        this.saveData = this.createDefaultSaveData();
        this.saveProgress();
    }
}