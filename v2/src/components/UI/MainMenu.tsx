import { useGameStore } from '../../store/useGameStore';
import { useTranslation } from '../../utils/i18n';

export const MainMenu: React.FC = () => {
    const { gameState, setGameState } = useGameStore();
    const { t } = useTranslation();

    if (gameState !== 'MENU') return null;

    return (
        <div className="overlay active" style={{ zIndex: 10 }}>
            <div className="menu-container" style={{
                maxWidth: '500px',
                margin: '0 auto',
                marginTop: '10vh',
                backgroundColor: '#1a1a2e',
                padding: '40px',
                borderRadius: '10px',
                textAlign: 'center'
            }}>
                <h1 style={{ color: '#FFD700', fontSize: '3em', marginBottom: '30px' }}>
                    {t('title')}
                </h1>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <button
                        onClick={() => setGameState('LEVEL_SELECT')}
                        className="menu-button"
                        style={{
                            padding: '15px 30px',
                            fontSize: '1.5em',
                            backgroundColor: '#4CAF50',
                            color: 'white',
                            border: 'none',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        {t('play')}
                    </button>

                    <button
                        onClick={() => setGameState('EDITOR_HUB')}
                        className="menu-button"
                        style={{
                            padding: '12px 25px',
                            fontSize: '1.2em',
                            backgroundColor: '#2196F3',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer'
                        }}
                    >
                        {t('editorHub')}
                    </button>

                    <button
                        onClick={() => setGameState('SETTINGS')}
                        className="menu-button"
                        style={{
                            padding: '12px 25px',
                            fontSize: '1.2em',
                            backgroundColor: '#16213e',
                            color: 'white',
                            border: '2px solid #0f3460',
                            borderRadius: '8px',
                            cursor: 'pointer'
                        }}
                    >
                        {t('settings')}
                    </button>
                </div>

                <div className="credits-section" style={{
                    marginTop: '40px',
                    fontSize: '0.9em',
                    color: '#888'
                }}>
                    <p>{t('credits')}: A Game By [Your Name]</p>
                    <p style={{ marginTop: '10px' }}>
                        <a href="#" style={{ color: '#4CAF50', textDecoration: 'none', margin: '0 10px' }}>X</a>
                        <a href="#" style={{ color: '#4CAF50', textDecoration: 'none', margin: '0 10px' }}>Instagram</a>
                        <a href="#" style={{ color: '#4CAF50', textDecoration: 'none', margin: '0 10px' }}>GitHub</a>
                    </p>
                </div>

                <p className="menu-hint" style={{
                    marginTop: '30px',
                    fontSize: '0.85em',
                    color: '#666'
                }}>
                    Navigate: Arrows/Stick | {t('select')}
                </p>
            </div>
        </div>
    );
};
