import type { LevelSchema } from '../types/GameTypes';

export interface RoadmapLevel {
    levelId: number;
    name: string;
    filename: string;
}

export const LevelLoader = {
    fetchRoadmap: async (): Promise<RoadmapLevel[]> => {
        try {
            const response = await fetch('/levels/game_roadmap.json');
            if (!response.ok) throw new Error('Failed to load roadmap');
            return await response.json();
        } catch (error) {
            console.error('Error loading roadmap:', error);
            return [];
        }
    },

    fetchLevel: async (filename: string): Promise<LevelSchema | null> => {
        try {
            const response = await fetch(`/levels/${filename}`);
            if (!response.ok) throw new Error(`Failed to load level: ${filename}`);
            return await response.json();
        } catch (error) {
            console.error(`Error loading level ${filename}:`, error);
            return null;
        }
    }
};
