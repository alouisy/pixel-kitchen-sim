import React from 'react';
import { useGameStore } from '../../store/useGameStore';
import { useTranslation } from '../../utils/i18n';

export const LevelEndMenu: React.FC = () => {
    const { gameState, score, currentLevel, setGameState, reset } = useGameStore();
    const { t } = useTranslation();

    if (gameState !== 'LEVEL_END') return null;

    // Calculate stars based on score
    let stars = 0;
    if (currentLevel) {
        if (score >= currentLevel.starThresholds[2]) stars = 3;
        else if (score >= currentLevel.starThresholds[1]) stars = 2;
        else if (score >= currentLevel.starThresholds[0]) stars = 1;
    }

    const handleRestart = () => {
        // Reset game state and restart level
        reset();
        if (currentLevel) {
            // We need to re-trigger level load or just reset variables?
            // setLevel(currentLevel) resets time.
            useGameStore.getState().setLevel(currentLevel);
            setGameState('PLAYING');
        }
    };

    const handleMainMenu = () => {
        setGameState('MENU');
    };

    return (
        <div className="overlay active menu-screen">
            <div className="menu-container">
                <h1>{t('levelComplete')}</h1>
                <p className="score-display">{t('score')}: {score}</p>
                <div className="stars-display">
                    {'★'.repeat(stars)}{'☆'.repeat(3 - stars)}
                </div>

                <div className="button-group-vertical">
                    <button onClick={handleRestart} className="menu-button">
                        {t('restart')}
                    </button>
                    <button onClick={handleMainMenu} className="menu-button">
                        {t('mainMenu')}
                    </button>
                </div>
            </div>
        </div>
    );
};
