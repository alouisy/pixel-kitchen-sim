import React from 'react';
import { useGameStore } from '../../store/useGameStore';
import { useTranslation } from '../../utils/i18n';

export const PauseMenu: React.FC = () => {
    const { gameState, setGameState, reset } = useGameStore();
    const { t } = useTranslation();

    if (gameState !== 'PAUSED') return null;

    const handleResume = () => {
        setGameState('PLAYING');
    };

    const handleSettings = () => {
        setGameState('SETTINGS');
    };

    const handleQuit = () => {
        reset();
        setGameState('MENU');
    };

    return (
        <div className="overlay active pause-menu" style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0,0,0,0.85)',
            zIndex: 15,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        }}>
            <div className="menu-container" style={{
                maxWidth: '400px',
                width: '90%',
                backgroundColor: '#1a1a2e',
                padding: '40px',
                borderRadius: '10px',
                color: 'white',
                textAlign: 'center'
            }}>
                <h1 style={{ marginBottom: '30px', color: '#FFD700', fontSize: '2.5em' }}>
                    {t('paused')}
                </h1>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <button
                        onClick={handleResume}
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
                        {t('resume')} ▶
                    </button>

                    <button
                        onClick={handleSettings}
                        className="menu-button"
                        style={{
                            padding: '12px',
                            fontSize: '1.1em',
                            backgroundColor: '#2196F3',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer'
                        }}
                    >
                        {t('settings')} ⚙️
                    </button>

                    <button
                        onClick={handleQuit}
                        className="menu-button"
                        style={{
                            padding: '12px',
                            fontSize: '1.1em',
                            backgroundColor: '#D32F2F',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer'
                        }}
                    >
                        {t('quit')} 🚪
                    </button>
                </div>

                <p className="menu-hint" style={{
                    marginTop: '30px',
                    fontSize: '0.85em',
                    color: '#666'
                }}>
                    Press ESC/[O]/[B] to resume
                </p>
            </div>
        </div>
    );
};
