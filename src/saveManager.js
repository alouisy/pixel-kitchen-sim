// src/saveManager.js

const SAVE_KEY = 'pixelKitchenSaveData'; 

export class SaveManager {
    constructor() {
        this.saveData = this.loadProgress();
        console.log("SaveManager Initialized. Loaded data:", this.saveData);
    }

    loadProgress() {
        try {
            const savedString = localStorage.getItem(SAVE_KEY);
            if (savedString) {
                const data = JSON.parse(savedString);
                // Ensure structure exists
                if (!data.levels) data.levels = {};
                if (!data.settings) data.settings = { language: 'en', showLabels: true };
                return data;
            } else {
                return this.createDefaultSaveData();
            }
        } catch (error) {
            console.error("Error loading save data:", error);
            return this.createDefaultSaveData();
        }
    }

    saveProgress() {
        try {
            const dataString = JSON.stringify(this.saveData);
            localStorage.setItem(SAVE_KEY, dataString);
        } catch (error) {
            console.error("Error saving progress:", error);
        }
    }

    createDefaultSaveData() {
        return {
            levels: {}, 
            settings: { language: 'en', showLabels: true }
        };
    }

    getLevelProgress(levelIndex) {
        return this.saveData.levels[levelIndex] || { completed: false, highScore: 0, stars: 0 };
    }

    updateLevelCompletion(levelIndex, score, stars) {
        const currentProgress = this.getLevelProgress(levelIndex);
        if (!currentProgress.completed || score > currentProgress.highScore) {
            this.saveData.levels[levelIndex] = {
                completed: true,
                highScore: score,
                stars: stars
            };
            this.saveProgress();
        }
    }

    isLevelUnlocked(levelIndex) {
        if (levelIndex === 0) return true; 
        const prevLevelProgress = this.getLevelProgress(levelIndex - 1);
        return prevLevelProgress.completed; 
    }

    // --- Settings API ---
    getSetting(key) {
        // Return default if key missing
        if (this.saveData.settings && this.saveData.settings[key] !== undefined) {
            return this.saveData.settings[key];
        }
        // Defaults
        if (key === 'language') return 'en';
        if (key === 'showLabels') return true;
        return null;
    }

    saveSetting(key, value) {
        if (!this.saveData.settings) this.saveData.settings = {};
        this.saveData.settings[key] = value;
        this.saveProgress();
    }
}