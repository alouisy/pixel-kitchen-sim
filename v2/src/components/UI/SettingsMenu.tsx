import React from 'react';
import { useGameStore } from '../../store/useGameStore';
import { useTranslation } from '../../utils/i18n';
import { saveManager } from '../../utils/SaveManager';
import { RECIPES } from '../../systems/RecipeSystem';

interface SettingsMenuProps {
    onClose: () => void;
    isPauseMenu?: boolean;
}

export const SettingsMenu: React.FC<SettingsMenuProps> = ({ onClose, isPauseMenu = false }) => {
    const { gameState, settings, setSettings } = useGameStore();
    const { t, language } = useTranslation();

    if (gameState !== 'SETTINGS') return null;

    const handleLanguageChange = (lang: 'en' | 'fr' | 'es') => {
        setSettings({ language: lang });
        saveManager.saveSetting('language', lang);
    };

    const handleLabelsToggle = (checked: boolean) => {
        setSettings({ showLabels: checked });
        saveManager.saveSetting('showLabels', checked);
    };

    return (
        <div className="overlay active" style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0,0,0,0.9)',
            zIndex: 15,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        }}>
            <div className="menu-container" style={{
                maxWidth: '600px',
                width: '90%',
                maxHeight: '80vh',
                overflowY: 'auto',
                backgroundColor: '#1a1a2e',
                padding: '30px',
                borderRadius: '10px',
                color: 'white'
            }}>
                <h1 style={{ textAlign: 'center', marginBottom: '30px', color: '#FFD700' }}>
                    {t('settings')}
                </h1>

                {/* Language Selection */}
                <div className="setting-group" style={{ marginBottom: '30px' }}>
                    <label style={{ display: 'block', marginBottom: '10px', fontSize: '1.2em' }}>
                        {t('language')}:
                    </label>
                    <div className="button-group" style={{ display: 'flex', gap: '10px' }}>
                        {(['en', 'fr', 'es'] as const).map(lang => (
                            <button
                                key={lang}
                                onClick={() => handleLanguageChange(lang)}
                                className={`menu-button lang-button ${language === lang ? 'active-lang' : ''}`}
                                style={{
                                    flex: 1,
                                    padding: '10px',
                                    fontSize: '1em',
                                    backgroundColor: language === lang ? '#FFD700' : '#16213e',
                                    color: language === lang ? '#000' : '#fff',
                                    border: language === lang ? '2px solid #FFD700' : '2px solid #0f3460',
                                    cursor: 'pointer',
                                    borderRadius: '5px',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {lang === 'en' ? 'English' : lang === 'fr' ? 'Français' : 'Español'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Show Labels Toggle */}
                <div className="setting-group" style={{ marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <label htmlFor="toggle-labels-setting" style={{ fontSize: '1.2em' }}>
                        {t('showLabels')}
                    </label>
                    <input
                        type="checkbox"
                        id="toggle-labels-setting"
                        className="menu-toggle"
                        checked={settings.showLabels}
                        onChange={(e) => handleLabelsToggle(e.target.checked)}
                        style={{
                            width: '20px',
                            height: '20px',
                            cursor: 'pointer'
                        }}
                    />
                </div>

                {/* Recipe Book Section */}
                <div id="recipe-book-container" style={{
                    marginBottom: '30px',
                    padding: '20px',
                    backgroundColor: '#0f3460',
                    borderRadius: '5px',
                    maxHeight: '300px',
                    overflowY: 'auto'
                }}>
                    <h3 style={{ color: '#FFD700', marginBottom: '15px' }}>
                        {t('recipeBook')}
                    </h3>
                    {Object.values(RECIPES).map(recipe => (
                        <div key={recipe.name} className="recipe-entry" style={{
                            marginBottom: '15px',
                            padding: '10px',
                            backgroundColor: '#16213e',
                            borderRadius: '5px'
                        }}>
                            <h4 style={{ color: '#fff', marginBottom: '5px' }}>
                                {t(recipe.name as any) || recipe.name}
                            </h4>
                            <p style={{ fontSize: '0.9em', color: '#aaa' }}>
                                {recipe.ingredients.map(ing => t(ing as any) || ing).join(' + ')}
                            </p>
                            <p style={{ fontSize: '0.85em', color: '#888' }}>
                                {t('time')}: {recipe.timeLimit}s | {t('score')}: {recipe.baseScore}pts
                            </p>
                        </div>
                    ))}
                </div>

                {/* Version Info */}
                <p style={{ textAlign: 'center', fontSize: '0.9em', color: '#888', marginBottom: '20px' }}>
                    {t('version')} 2.0 Beta
                </p>

                {/* Action Buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {isPauseMenu && (
                        <button
                            onClick={onClose}
                            className="menu-button"
                            style={{
                                padding: '15px',
                                fontSize: '1.1em',
                                backgroundColor: '#4CAF50',
                                color: 'white',
                                border: 'none',
                                borderRadius: '5px',
                                cursor: 'pointer'
                            }}
                        >
                            {t('resume')}
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="menu-button"
                        style={{
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
                </div>

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
