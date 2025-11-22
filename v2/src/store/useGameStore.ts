import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LevelSchema, Order } from '../types/GameTypes';

interface GameState {
    score: number;
    timeRemaining: number;
    currentLevel: LevelSchema | null;
    orders: Order[];
    entities: import('../types/GameTypes').Entity[];
    gameState: 'MENU' | 'PLAYING' | 'PAUSED' | 'LEVEL_END' | 'EDITOR' | 'EDITOR_HUB' | 'SETTINGS';
    settings: {
        language: 'en' | 'fr' | 'es';
        showLabels: boolean;
    };

    setScore: (score: number) => void;
    addScore: (amount: number) => void;
    setTimeRemaining: (time: number) => void;
    setLevel: (level: LevelSchema) => void;
    setGameState: (state: 'MENU' | 'PLAYING' | 'PAUSED' | 'LEVEL_END' | 'EDITOR' | 'EDITOR_HUB' | 'SETTINGS') => void;
    addOrder: (order: Order) => void;
    removeOrder: (id: string) => void;
    addEntity: (entity: import('../types/GameTypes').Entity) => void;
    removeEntity: (id: string) => void;
    updateEntity: (id: string, updates: Partial<import('../types/GameTypes').Entity>) => void;
    tickOrders: () => void;
    setSettings: (settings: Partial<GameState['settings']>) => void;
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
                const updatedOrders = state.orders.map(o => ({ ...o, duration: o.duration - 1 }));
                const activeOrders = updatedOrders.filter(o => o.duration > 0);
                const expiredCount = state.orders.length - activeOrders.length;
                return {
                    orders: activeOrders,
                    score: state.score - (expiredCount * 10) // Penalty for expired
                };
            }),
            setSettings: (newSettings) => set((state) => ({ settings: { ...state.settings, ...newSettings } })),
            reset: () => set({ score: 0, orders: [], timeRemaining: 0, entities: [] })
        }),
        {
            name: 'kitchen-sim-storage',
            partialize: (state) => ({ settings: state.settings }), // Only persist settings
        }
    )
);
