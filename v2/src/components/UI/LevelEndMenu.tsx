import React, { useEffect, useState } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { useTranslation } from '../../utils/i18n';
import { saveManager } from '../../utils/SaveManager';
import { LevelLoader, type RoadmapLevel } from '../../utils/LevelLoader';

export const LevelEndMenu: React.FC = () => {
    const { gameState, setGameState, score, currentLevel, setLevel, reset } = useGameStore();
    const { t } = useTranslation();
    const [stars, setStars] = useState(0);
    const [canContinue, setCanContinue] = useState(false);
    const [levels, setLevels] = useState<RoadmapLevel[]>([]);

    useEffect(() => {
        if (gameState === 'LEVEL_END' && currentLevel) {
            // Calculate stars based on star thresholds
            const thresholds = currentLevel.starThresholds;
            let earnedStars = 0;
            if (score >= thresholds[0]) earnedStars = 1;
            if (score >= thresholds[1]) earnedStars = 2;
            if (score >= thresholds[2]) earnedStars = 3;
            setStars(earnedStars);

            // Save progress
            saveManager.updateLevelCompletion(currentLevel.levelId - 1, score, earnedStars);

            // Check if next level exists
            LevelLoader.fetchRoadmap().then(roadmap => {
                setLevels(roadmap);
                setCanContinue(currentLevel.levelId < roadmap.length);
            });
        }
    }, [gameState, score, currentLevel]);

    if (gameState !== 'LEVEL_END') return null;

    const handleNextLevel = async () => {
        if (!currentLevel || !canContinue) return;

        const nextLevelInfo = levels.find(l => l.levelId === currentLevel.levelId + 1);
        if (nextLevelInfo) {
            const levelData = await LevelLoader.fetchLevel(nextLevelInfo.filename);
            if (levelData) {
                reset();
                setLevel(levelData);
                setGameState('INSTRUCTIONS');
            }
        }
    };

    const handleRestart = () => {
        if (currentLevel) {
            reset();
            setLevel(currentLevel);
            setGameState('INSTRUCTIONS');
        }
    };

    const handleMainMenu = () => {
        reset();
        setGameState('MENU');
    };

    const isAllLevelsDone = !canContinue && currentLevel?.levelId === levels.length;

    return (
        <div className="overlay active menu-screen" style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0,0,0,0.95)',
            zIndex: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        }}>
            <div className="menu-container" style={{
                maxWidth: '500px',
                width: '90%',
                backgroundColor: '#1a1a2e',
                padding: '40px',
                borderRadius: '15px',
                color: 'white',
                textAlign: 'center'
            }}>
                <h1 style={{
                    marginBottom: '30px',
                    color: '#FFD700',
                    fontSize: '2.5em'
                }}>
                    {isAllLevelsDone ? t('allLevelsDone') : t('levelComplete')}
                </h1>

                {/* Stars Display */}
                <div style={{
                    fontSize: '3em',
                    marginBottom: '20px',
                    color: '#FFD700'
                }}>
                    {'★'.repeat(stars)}{'☆'.repeat(3 - stars)}
                </div>

                {/* Score Display */}
                <div style={{
                    marginBottom: '30px',
                    fontSize: '1.5em'
                }}>
                    <div style={{ marginBottom: '10px' }}>
                        <span style={{ color: '#aaa' }}>{t('score')}: </span>
                        <span style={{ color: '#FFD700', fontWeight: 'bold' }}>{score}</span>
                    </div>
                </div>

                {/* Action Buttons */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '15px'
                }}>
                    {canContinue && !isAllLevelsDone && (
                        <button
                            onClick={handleNextLevel}
                            className="menu-button"
                            style={{
                                padding: '15px',
                                fontSize: '1.2em',
                                backgroundColor: '#4CAF50',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontWeight: 'bold'
                            }}
                        >
                            {t('nextLevel')} →
                        </button>
                    )}

                    <button
                        onClick={handleRestart}
                        className="menu-button"
                        style={{
                            padding: '15px',
                            fontSize: '1.1em',
                            backgroundColor: '#2196F3',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer'
                        }}
                    >
                        🔄 {isAllLevelsDone ? t('playAgain') : t('restart')}
                    </button>

                    <button
                        onClick={handleMainMenu}
                        className="menu-button"
                        style={{
                            padding: '15px',
                            fontSize: '1.1em',
                            backgroundColor: '#16213e',
                            color: 'white',
                            border: '2px solid #0f3460',
                            borderRadius: '8px',
                            cursor: 'pointer'
                        }}
                    >
                        {t('mainMenu')}
                    </button>
                </div>
            </div>
        </div>
    );
};
