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
                            {t('editorHub')}
                        </button>
                        <button onClick={() => setGameState('SETTINGS')} className="menu-button">
                            {t('settings')}
                        </button>

                        <div className="credits-section" style={{ marginTop: '20px', fontSize: '0.8em', color: '#aaa' }}>
                            <p>{t('credits')}: A Game By [Your Name]</p>
                        </div>
                    </>
                )}

                {view === 'LEVEL_SELECT' && (
                    <>
                        <h2>{t('levelSelect')}</h2>
                        <div className="level-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', maxHeight: '400px', overflowY: 'auto', padding: '10px' }}>
                            {levels.map(l => (
                                <button key={l.levelId} onClick={() => startLevel(l)} className="menu-button level-card" style={{ height: '100px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                                    <span style={{ fontSize: '1.2em', fontWeight: 'bold' }}>{l.name}</span>
                                    <span style={{ fontSize: '0.8em' }}>{l.filename}</span>
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
