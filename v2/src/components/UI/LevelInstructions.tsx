import React from 'react';
import { useGameStore } from '../../store/useGameStore';

export const LevelInstructions: React.FC = () => {
    const { gameState, currentLevel, setGameState } = useGameStore();

    // We need a new game state for 'INSTRUCTIONS' or handle it within PLAYING/MENU?
    // v1 had a specific overlay. Let's assume we add 'INSTRUCTIONS' to GameState or use a local state in App?
    // The plan implies we might need to update GameState type.
    // For now, let's assume we check if we are in 'PLAYING' but time hasn't started? 
    // Or better: Add 'INSTRUCTIONS' to GameState in store.

    // Wait, I need to update GameState type in store first if I use it.
    // Let's check if I can use a separate flag or just add it.
    // I'll add it to the store type in the next step.

    if (gameState !== 'INSTRUCTIONS') return null;

    const handleStart = () => {
        setGameState('PLAYING');
    };

    return (
        <div className="overlay active menu-screen">
            <h1>{currentLevel?.name || 'Level Instructions'}</h1>
            <div className="menu-container instructions-box">
                <div className="instructions-content">
                    {/* We could render specific instructions from level data if available */}
                    <p>Prepare the orders before time runs out!</p>
                    <p>Use WASD to move, Click to interact.</p>
                    <p>Recipes:</p>
                    <ul>
                        {currentLevel?.availableMeals.map(meal => (
                            <li key={meal}>{meal}</li>
                        ))}
                    </ul>
                </div>
                <button onClick={handleStart} className="menu-button">
                    Start Level
                </button>
            </div>
        </div>
    );
};
