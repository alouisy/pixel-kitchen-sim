import React, { useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../../store/useGameStore';
import { OrderSystem } from '../../systems/OrderSystem';

export const GameLoop: React.FC = () => {
    const { gameState, timeRemaining, setTimeRemaining, setGameState } = useGameStore();

    // Timer Logic
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (gameState === 'PLAYING' && timeRemaining > 0) {
            interval = setInterval(() => {
                useGameStore.getState().setTimeRemaining(Math.max(0, useGameStore.getState().timeRemaining - 1));
                OrderSystem.tick();
            }, 1000);
        } else if (timeRemaining === 0 && gameState === 'PLAYING') {
            setGameState('LEVEL_END');
        }
        return () => clearInterval(interval);
    }, [gameState, timeRemaining, setTimeRemaining, setGameState]);

    // Frame Loop (for things that need per-frame updates, currently handled by React state for timer)
    useFrame(() => {
        // Future: Update order timers here for smooth progress bars
    });

    return null;
};
