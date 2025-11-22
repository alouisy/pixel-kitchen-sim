import React, { useEffect } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { useTranslation } from '../../utils/i18n';

export const PauseMenu: React.FC = () => {
    const { gameState, setGameState } = useGameStore();
    const { t } = useTranslation();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (gameState === 'PLAYING') setGameState('PAUSED');
                else if (gameState === 'PAUSED') setGameState('PLAYING');
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [gameState, setGameState]);

    if (gameState !== 'PAUSED') return null;

    return (
        <div className="overlay active" style={{ zIndex: 20 }}>
            <div className="menu-container">
                <h1>{t('paused')}</h1>
                <button onClick={() => setGameState('PLAYING')} className="menu-button">{t('resume')}</button>
                <button onClick={() => setGameState('MENU')} className="menu-button">{t('quit')}</button>
            </div>
        </div>
    );
};
