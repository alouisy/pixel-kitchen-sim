import React, { useEffect, useState } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { useTranslation } from '../../utils/i18n';
import type { LevelSchema } from '../../types/GameTypes';
import { LevelLoader } from '../../utils/LevelLoader';
import type { RoadmapLevel } from '../../utils/LevelLoader';

export const LevelManager: React.FC = () => {
    const { gameState, setGameState, setLevel } = useGameStore();
    const { t } = useTranslation();
    const [levels, setLevels] = useState<RoadmapLevel[]>([]);

    useEffect(() => {
        if (gameState === 'EDITOR_HUB') {
            LevelLoader.fetchRoadmap().then(setLevels);
        }
    }, [gameState]);

    if (gameState !== 'EDITOR_HUB') return null;

    const handleNewLevel = () => {
        const newLevel: LevelSchema = {
            levelId: Date.now(),
            name: "New Level",
            duration: 300,
            starThresholds: [100, 200, 300],
            availableMeals: [],
            maxActiveOrders: 3,
            newOrderDelay: 10,
            layout: []
        };
        setLevel(newLevel);
        setGameState('EDITOR');
    };

    const handleEditLevel = async (levelInfo: RoadmapLevel) => {
        const levelData = await LevelLoader.fetchLevel(levelInfo.filename);
        if (levelData) {
            setLevel(levelData);
            setGameState('EDITOR');
        }
    };

    return (
        <div className="overlay active" style={{ zIndex: 10 }}>
            <div className="menu-container" style={{ minWidth: '600px' }}>
                <h1>{t('levelManager')}</h1>

                <div className="editor-toolbar" style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                    <button className="menu-button small" onClick={handleNewLevel}>➕ {t('newLevel')}</button>
                </div>

                <div className="level-list-editor" style={{
                    display: 'flex', flexDirection: 'column', gap: '10px',
                    maxHeight: '400px', overflowY: 'auto', background: 'rgba(0,0,0,0.3)', padding: '10px'
                }}>
                    {levels.map(level => (
                        <div key={level.levelId} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            background: '#444', padding: '10px', border: '1px solid #666'
                        }}>
                            <span>{level.name} (ID: {level.levelId})</span>
                            <div style={{ display: 'flex', gap: '5px' }}>
                                <button className="menu-button small" onClick={() => handleEditLevel(level)}>{t('edit')}</button>
                                <button className="menu-button small delete" style={{ background: '#822' }}>{t('delete')}</button>
                            </div>
                        </div>
                    ))}
                </div>

                <button className="menu-button" onClick={() => setGameState('MENU')} style={{ marginTop: '20px' }}>{t('back')}</button>
            </div>
        </div>
    );
};
