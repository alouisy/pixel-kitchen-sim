import React, { useEffect, useState } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { useTranslation } from '../../utils/i18n';
import type { LevelSchema } from '../../types/GameTypes';
import { saveManager } from '../../utils/SaveManager';

export const LevelManager: React.FC = () => {
    const { gameState, setGameState, setLevel } = useGameStore();
    const { t } = useTranslation();
    const [customLevels, setCustomLevels] = useState<LevelSchema[]>([]);

    useEffect(() => {
        if (gameState === 'EDITOR_HUB') {
            setCustomLevels(saveManager.getCustomLevels());
        }
    }, [gameState]);

    if (gameState !== 'EDITOR_HUB') return null;

    const handleNewLevel = () => {
        const newLevel: LevelSchema = {
            levelId: Date.now(),
            name: "New Custom Level",
            duration: 300,
            starThresholds: [100, 200, 300],
            availableMeals: ['Hamburger'],
            maxActiveOrders: 3,
            newOrderDelay: 15,
            layout: []
        };
        // Save immediately so it exists
        saveManager.saveCustomLevel(newLevel);
        setLevel(newLevel);
        setGameState('EDITOR');
    };

    const handleEditLevel = (level: LevelSchema) => {
        setLevel(level);
        setGameState('EDITOR');
    };

    const handleDeleteLevel = (id: number) => {
        if (confirm(t('deleteConfirm') || 'Delete this level?')) {
            saveManager.deleteCustomLevel(id);
            setCustomLevels(saveManager.getCustomLevels());
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
                    {customLevels.length === 0 && (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#aaa' }}>
                            No custom levels found. Create one!
                        </div>
                    )}
                    {customLevels.map(level => (
                        <div key={level.levelId} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            background: '#444', padding: '10px', border: '1px solid #666'
                        }}>
                            <span>{level.name}</span>
                            <div style={{ display: 'flex', gap: '5px' }}>
                                <button className="menu-button small" onClick={() => handleEditLevel(level)}>{t('edit')}</button>
                                <button
                                    className="menu-button small delete"
                                    style={{ background: '#822' }}
                                    onClick={() => handleDeleteLevel(level.levelId)}
                                >
                                    {t('delete')}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <button className="menu-button" onClick={() => setGameState('MENU')} style={{ marginTop: '20px' }}>{t('back')}</button>
            </div>
        </div>
    );
};
