import { useGameStore } from '../../store/useGameStore';
import { useTranslation } from '../../utils/i18n';
import { useState, useEffect } from 'react';
import { LevelLoader } from '../../utils/LevelLoader';
import type { RoadmapLevel } from '../../utils/LevelLoader';

export const MainMenu: React.FC = () => {
    const { gameState, setGameState, setLevel } = useGameStore();
    const { t } = useTranslation();
    const [view, setView] = useState<'MAIN' | 'LEVEL_SELECT'>('MAIN');
    const [levels, setLevels] = useState<RoadmapLevel[]>([]);

    useEffect(() => {
        LevelLoader.fetchRoadmap().then(setLevels);
    }, []);

    if (gameState !== 'MENU') return null;

    const startLevel = async (levelInfo: RoadmapLevel) => {
        const levelData = await LevelLoader.fetchLevel(levelInfo.filename);
        if (levelData) {
            setLevel(levelData);
            setGameState('PLAYING');
        }
    };

    const startEditor = () => {
        setGameState('EDITOR_HUB');
    };

    if (gameState !== 'MENU') return null;

    return (
        <div className="overlay active" style={{ zIndex: 10 }}>
            <div className="menu-container">
                <h1>Pixel Kitchen Sim v2</h1>

                {view === 'MAIN' && (
                    <>
                        <button onClick={() => setView('LEVEL_SELECT')} className="menu-button">
                            {t('play')}
                        </button>
                        <button onClick={startEditor} className="menu-button">
                            {t('editor')}
                        </button>
                        <button onClick={() => setGameState('SETTINGS')} className="menu-button">
                            {t('settings')}
                        </button>
                    </>
                )}

                {view === 'LEVEL_SELECT' && (
                    <>
                        <h2>{t('levelSelect')}</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto' }}>
                            {levels.map(l => (
                                <button key={l.levelId} onClick={() => startLevel(l)} className="menu-button">
                                    {l.name}
                                </button>
                            ))}
                        </div>
                        <button onClick={() => setView('MAIN')} className="menu-button" style={{ marginTop: '20px' }}>
                            {t('back')}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};
