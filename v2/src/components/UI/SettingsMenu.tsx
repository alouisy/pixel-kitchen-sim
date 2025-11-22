import React from 'react';
import { useGameStore } from '../../store/useGameStore';
import { useTranslation } from '../../utils/i18n';

export const SettingsMenu: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { settings, setSettings } = useGameStore();
    const { t } = useTranslation();

    const handleLanguageChange = (lang: 'en' | 'fr' | 'es') => {
        setSettings({ language: lang });
        // Assuming i18n has a changeLanguage method or we force update
        // For this simple implementation, we might need to reload or trigger re-render
        // But useTranslation hook should react to key changes if we passed lang to it?
        // The current i18n util is simple. Let's assume we just update store.
        // Ideally i18n util subscribes to store or we pass lang to it.
    };

    return (
        <div className="overlay active menu-screen" style={{ zIndex: 20 }}>
            <div className="menu-container">
                <h1>{t('settings')}</h1>

                <div className="setting-group">
                    <label>{t('language')}:</label>
                    <div className="button-group">
                        {(['en', 'fr', 'es'] as const).map(lang => (
                            <button
                                key={lang}
                                className={`menu-button small ${settings.language === lang ? 'active' : ''}`}
                                onClick={() => handleLanguageChange(lang)}
                            >
                                {lang.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="setting-group">
                    <label>{t('showLabels')}:</label>
                    <input
                        type="checkbox"
                        className="menu-toggle"
                        checked={settings.showLabels}
                        onChange={(e) => setSettings({ showLabels: e.target.checked })}
                    />
                </div>

                <button className="menu-button" onClick={onClose}>{t('back')}</button>
            </div>
        </div>
    );
};
