/**
 * SaveManager - Handles localStorage persistence for level progress and settings
 * Ported from v1 saveManager.js to TypeScript
 */

const SAVE_KEY = 'pixelKitchenSaveData';

interface LevelProgress {
    completed: boolean;
    highScore: number;
    stars: number;
}

interface SaveData {
    levels: Record<number, LevelProgress>;
    customLevels: import('../types/GameTypes').LevelSchema[];
    settings: {
        language: 'en' | 'fr' | 'es';
        showLabels: boolean;
    };
}

export class SaveManager {
    private saveData: SaveData;

    constructor() {
        this.saveData = this.loadProgress();
        console.log('SaveManager Initialized. Loaded data:', this.saveData);
    }

    private loadProgress(): SaveData {
        try {
            const savedString = localStorage.getItem(SAVE_KEY);
            if (savedString) {
                const data = JSON.parse(savedString) as SaveData;
                // Ensure structure exists
                if (!data.levels) data.levels = {};
                if (!data.customLevels) data.customLevels = [];
                if (!data.settings) {
                    data.settings = { language: 'en', showLabels: true };
                }
                return data;
            } else {
                return this.createDefaultSaveData();
            }
        } catch (error) {
            console.error('Error loading save data:', error);
            return this.createDefaultSaveData();
        }
    }

    private saveProgress(): void {
        try {
            const dataString = JSON.stringify(this.saveData);
            localStorage.setItem(SAVE_KEY, dataString);
        } catch (error) {
            console.error('Error saving progress:', error);
        }
    }

    private createDefaultSaveData(): SaveData {
        return {
            levels: {},
            customLevels: [],
            settings: { language: 'en', showLabels: true }
        };
    }

    getLevelProgress(levelIndex: number): LevelProgress {
        return this.saveData.levels[levelIndex] || {
            completed: false,
            highScore: 0,
            stars: 0
        };
    }

    updateLevelCompletion(levelIndex: number, score: number, stars: number): void {
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

    isLevelUnlocked(levelIndex: number): boolean {
        if (levelIndex === 0) return true; // First level always unlocked
        const prevLevelProgress = this.getLevelProgress(levelIndex - 1);
        return prevLevelProgress.completed;
    }

    // Custom Levels API
    getCustomLevels(): import('../types/GameTypes').LevelSchema[] {
        return this.saveData.customLevels || [];
    }

    saveCustomLevel(level: import('../types/GameTypes').LevelSchema): void {
        if (!this.saveData.customLevels) this.saveData.customLevels = [];

        const existingIndex = this.saveData.customLevels.findIndex(l => l.levelId === level.levelId);
        if (existingIndex >= 0) {
            this.saveData.customLevels[existingIndex] = level;
        } else {
            this.saveData.customLevels.push(level);
        }
        this.saveProgress();
    }

    deleteCustomLevel(levelId: number): void {
        if (!this.saveData.customLevels) return;
        this.saveData.customLevels = this.saveData.customLevels.filter(l => l.levelId !== levelId);
        this.saveProgress();
    }

    // Settings API
    getSetting<K extends keyof SaveData['settings']>(key: K): SaveData['settings'][K] {
        if (this.saveData.settings && this.saveData.settings[key] !== undefined) {
            return this.saveData.settings[key];
        }
        // Defaults
        if (key === 'language') return 'en' as SaveData['settings'][K];
        if (key === 'showLabels') return true as SaveData['settings'][K];
        return 'en' as SaveData['settings'][K];
    }

    saveSetting<K extends keyof SaveData['settings']>(
        key: K,
        value: SaveData['settings'][K]
    ): void {
        if (!this.saveData.settings) {
            this.saveData.settings = { language: 'en', showLabels: true };
        }
        this.saveData.settings[key] = value;
        this.saveProgress();
    }

    getAllLevelProgress(): Record<number, LevelProgress> {
        return this.saveData.levels;
    }

    resetAllProgress(): void {
        this.saveData.levels = {};
        // We probably don't want to delete custom levels on reset?
        // Or maybe we do? For now keep them.
        this.saveProgress();
    }
}

// Singleton instance
export const saveManager = new SaveManager();
