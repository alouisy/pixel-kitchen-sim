import React from 'react';
import { useGameStore } from '../../store/useGameStore';
import { useTranslation } from '../../utils/i18n';

export const SettingsMenu: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { settings, setSettings } = useGameStore();
    const { t } = useTranslation();

    return (
        <div className="overlay active">
            <div className="menu-container">
                <h1>{t('settings')}</h1>

                <div className="setting-group">
                    <label>{t('language')}:</label>
                    <div className="button-group">
                        {['en', 'fr', 'es'].map(lang => (
                            <button
                                key={lang}
                                className={`lang-button ${settings.language === lang ? 'active' : ''}`}
                                onClick={() => setSettings({ language: lang as any })}
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
