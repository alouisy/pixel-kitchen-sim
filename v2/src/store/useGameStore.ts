import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LevelObject } from '../types/GameTypes';
import type { LevelSchema, Order } from '../types/GameTypes';

interface GameState {
    score: number;
    timeRemaining: number;
    currentLevel: LevelSchema | null;
    orders: Order[];
    entities: import('../types/GameTypes').Entity[];
    gameState: 'MENU' | 'PLAYING' | 'PAUSED' | 'LEVEL_END' | 'EDITOR' | 'EDITOR_HUB' | 'SETTINGS' | 'INSTRUCTIONS';
    tempMessage: string | null;
    selectedObject: LevelObject | null; // For editor
    settings: {
        language: 'en' | 'fr' | 'es';
        showLabels: boolean;
    };

    setScore: (score: number) => void;
    addScore: (amount: number) => void;
    setTimeRemaining: (time: number) => void;
    setLevel: (level: LevelSchema) => void;
    setGameState: (state: 'MENU' | 'PLAYING' | 'PAUSED' | 'LEVEL_END' | 'EDITOR' | 'EDITOR_HUB' | 'SETTINGS' | 'INSTRUCTIONS') => void;
    addOrder: (order: Order) => void;
    removeOrder: (id: string) => void;
    addEntity: (entity: import('../types/GameTypes').Entity) => void;
    removeEntity: (id: string) => void;
    updateEntity: (id: string, updates: Partial<import('../types/GameTypes').Entity>) => void;
    tickOrders: () => void;
    setSettings: (settings: Partial<GameState['settings']>) => void;
    setTempMessage: (msg: string | null) => void;
    setSelectedObject: (obj: LevelObject | null) => void;
    reset: () => void;
}

export const useGameStore = create<GameState>()(
    persist(
        (set) => ({
            score: 0,
            timeRemaining: 0,
            currentLevel: null,
            orders: [],
            entities: [],
            gameState: 'MENU',
            tempMessage: '',
            selectedObject: null,
            settings: {
                language: 'en',
                showLabels: true
            },

            setScore: (score) => set({ score }),
            addScore: (amount) => set((state) => ({ score: state.score + amount })),
            setTimeRemaining: (time) => set({ timeRemaining: time }),
            setLevel: (level) => set({ currentLevel: level, timeRemaining: level.duration }),
            setGameState: (state) => set({ gameState: state }),
            addOrder: (order) => set((state) => ({ orders: [...state.orders, order] })),
            removeOrder: (id) => set((state) => ({ orders: state.orders.filter(o => o.id !== id) })),
            addEntity: (entity) => set((state) => ({ entities: [...state.entities, entity] })),
            removeEntity: (id) => set((state) => ({ entities: state.entities.filter(e => e.id !== id) })),
            updateEntity: (id, updates) => set((state) => ({
                entities: state.entities.map(e => e.id === id ? { ...e, ...updates } : e)
            })),
            tickOrders: () => set((state) => {
                if (state.gameState !== 'PLAYING') return {};

                const updatedOrders = state.orders.map(o => ({ ...o, duration: o.duration - 1 }));
                const activeOrders = updatedOrders.filter(o => o.duration > 0);
                const expiredCount = state.orders.length - activeOrders.length;

                // If orders expired, penalize
                let newScore = state.score;
                if (expiredCount > 0) {
                    newScore -= (expiredCount * 10);
                    // Optional: Show message?
                }

                return {
                    orders: activeOrders,
                    score: newScore
                };
            }),
            setTempMessage: (msg: string | null) => {
                set({ tempMessage: msg || '' });
                if (msg) {
                    setTimeout(() => {
                        if (useGameStore.getState().tempMessage === msg) {
                            set({ tempMessage: '' });
                        }
                    }, 3000);
                }
            },
            setSelectedObject: (obj: LevelObject | null) => set({ selectedObject: obj }),
            setSettings: (newSettings) => set((state) => ({ settings: { ...state.settings, ...newSettings } })),
            reset: () => set({ score: 0, orders: [], timeRemaining: 0, entities: [] })
        }),
        {
            name: 'kitchen-sim-storage',
            partialize: (state) => ({ settings: state.settings }), // Only persist settings
        }
    )
);
