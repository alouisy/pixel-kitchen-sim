import React, { useEffect, useState } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { useTranslation } from '../../utils/i18n';
import { LevelLoader, type RoadmapLevel } from '../../utils/LevelLoader';
import { saveManager } from '../../utils/SaveManager';

export const LevelSelectMenu: React.FC = () => {
    const { gameState, setGameState, setLevel } = useGameStore();
    const { t } = useTranslation();
    const [levels, setLevels] = useState<RoadmapLevel[]>([]);

    useEffect(() => {
        LevelLoader.fetchRoadmap().then(setLevels);
    }, []);

    if (gameState !== 'LEVEL_SELECT') return null;

    const handleLevelStart = async (levelInfo: RoadmapLevel, index: number) => {
        if (!saveManager.isLevelUnlocked(index)) return;

        const levelData = await LevelLoader.fetchLevel(levelInfo.filename);
        if (levelData) {
            setLevel(levelData);
            setGameState('INSTRUCTIONS'); // Show instructions first
        }
    };

    return (
        <div className="overlay active menu-screen" style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0,0,0,0.9)',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        }}>
            <div className="menu-container" style={{
                maxWidth: '900px',
                width: '90%',
                maxHeight: '80vh',
                overflowY: 'auto',
                backgroundColor: '#1a1a2e',
                padding: '30px',
                borderRadius: '10px',
                color: 'white'
            }}>
                <h1 style={{ textAlign: 'center', marginBottom: '30px', color: '#FFD700' }}>
                    {t('levelSelect')}
                </h1>

                <div className="level-grid" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                    gap: '20px',
                    marginBottom: '30px'
                }}>
                    {levels.map((level, index) => {
                        const progress = saveManager.getLevelProgress(index);
                        const isUnlocked = saveManager.isLevelUnlocked(index);

                        return (
                            <button
                                key={level.levelId}
                                onClick={() => handleLevelStart(level, index)}
                                disabled={!isUnlocked}
                                className={`menu-button level-button ${!isUnlocked ? 'locked' : ''}`}
                                style={{
                                    padding: '20px',
                                    backgroundColor: isUnlocked ? '#16213e' : '#0a0a0a',
                                    border: isUnlocked ? '2px solid #0f3460' : '2px solid #333',
                                    borderRadius: '10px',
                                    cursor: isUnlocked ? 'pointer' : 'not-allowed',
                                    opacity: isUnlocked ? 1 : 0.5,
                                    textAlign: 'left',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '10px',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <div className="level-name" style={{
                                    fontSize: '1.2em',
                                    fontWeight: 'bold',
                                    color: isUnlocked ? '#FFD700' : '#666'
                                }}>
                                    {t('level')} {level.levelId}: {level.name}
                                </div>

                                {isUnlocked && progress.completed && (
                                    <>
                                        <div className="level-stars" style={{
                                            fontSize: '1.5em',
                                            color: '#FFD700'
                                        }}>
                                            {'★'.repeat(progress.stars)}{'☆'.repeat(3 - progress.stars)}
                                        </div>
                                        <div className="level-score" style={{
                                            fontSize: '0.9em',
                                            color: '#aaa'
                                        }}>
                                            {t('highScore')}: {progress.highScore}
                                        </div>
                                    </>
                                )}

                                {!isUnlocked && (
                                    <div className="level-locked" style={{
                                        fontSize: '1em',
                                        color: '#666',
                                        fontStyle: 'italic'
                                    }}>
                                        🔒 {t('levelLocked')}
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Custom Levels Section */}
                {saveManager.getCustomLevels().length > 0 && (
                    <>
                        <h2 style={{ textAlign: 'center', marginBottom: '20px', color: '#4CAF50' }}>
                            Custom Levels
                        </h2>
                        <div className="level-grid" style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                            gap: '20px',
                            marginBottom: '30px'
                        }}>
                            {saveManager.getCustomLevels().map((level) => (
                                <button
                                    key={level.levelId}
                                    onClick={() => {
                                        setLevel(level);
                                        setGameState('INSTRUCTIONS');
                                    }}
                                    className="menu-button level-button"
                                    style={{
                                        padding: '20px',
                                        backgroundColor: '#1b3a2b',
                                        border: '2px solid #2e7d32',
                                        borderRadius: '10px',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '10px',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <div className="level-name" style={{
                                        fontSize: '1.2em',
                                        fontWeight: 'bold',
                                        color: '#81c784'
                                    }}>
                                        {level.name}
                                    </div>
                                    <div className="level-score" style={{
                                        fontSize: '0.9em',
                                        color: '#aaa'
                                    }}>
                                        Duration: {level.duration}s
                                    </div>
                                </button>
                            ))}
                        </div>
                    </>
                )}

                <button
                    onClick={() => setGameState('MENU')}
                    className="menu-button"
                    style={{
                        width: '100%',
                        padding: '15px',
                        fontSize: '1.1em',
                        backgroundColor: '#16213e',
                        color: 'white',
                        border: '2px solid #0f3460',
                        borderRadius: '5px',
                        cursor: 'pointer'
                    }}
                >
                    {t('back')}
                </button>

                <p className="menu-hint" style={{
                    textAlign: 'center',
                    marginTop: '20px',
                    fontSize: '0.85em',
                    color: '#888'
                }}>
                    Navigate: Arrows/Stick | {t('select')} | Back: Esc/[O]/[B]
                </p>
            </div>
        </div>
    );
};
