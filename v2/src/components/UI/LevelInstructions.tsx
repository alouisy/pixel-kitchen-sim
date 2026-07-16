import React from 'react';
import { useGameStore } from '../../store/useGameStore';
import { useTranslation } from '../../utils/i18n';
import { RECIPES } from '../../systems/RecipeSystem';

export const LevelInstructions: React.FC = () => {
    const { gameState, setGameState, currentLevel } = useGameStore();
    const { t } = useTranslation();

    // Show in pre-level (INSTRUCTIONS state)
    const isPreLevel = gameState === 'INSTRUCTIONS';

    if (!isPreLevel) return null; // For now, only support pre-level instructions
    if (!currentLevel) return null;

    const startLevel = () => {
        setGameState('PLAYING');
    };

    return (
        <div className="overlay active menu-screen" style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0,0,0,0.95)',
            zIndex: 15,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflowY: 'auto'
        }}>
            <div className="menu-container" style={{
                maxWidth: '800px',
                width: '90%',
                maxHeight: '85vh',
                overflowY: 'auto',
                backgroundColor: '#1a1a2e',
                padding: '30px',
                borderRadius: '10px',
                color: 'white'
            }}>
                <h1 style={{ textAlign: 'center', marginBottom: '10px', color: '#FFD700' }}>
                    {t('level')} {currentLevel.levelId}: {currentLevel.name}
                </h1>

                <div style={{ textAlign: 'center', marginBottom: '30px', fontSize: '1.1em', color: '#aaa' }}>
                    {t('levelInstructions')}
                </div>

                {/* Recipe Instructions for Available Meals */}
                <div style={{ marginBottom: '30px' }}>
                    {currentLevel.availableMeals.map(mealName => {
                        const recipe = RECIPES[mealName];
                        if (!recipe) return null;

                        return (
                            <div key={mealName} className="recipe-instruction" style={{
                                marginBottom: '25px',
                                padding: '20px',
                                backgroundColor: '#16213e',
                                borderRadius: '8px',
                                border: '2px solid #0f3460'
                            }}>
                                <h3 style={{ color: '#FFD700', marginBottom: '15px', fontSize: '1.5em' }}>
                                    {t(mealName as any) || mealName}
                                </h3>

                                {/* Ingredients */}
                                <div style={{ marginBottom: '15px' }}>
                                    <div style={{ fontWeight: 'bold', color: '#4CAF50', marginBottom: '8px' }}>
                                        📋 {t('recipe')}:
                                    </div>
                                    <ul style={{ marginLeft: '20px', lineHeight: '1.8' }}>
                                        {recipe.ingredients.map((ing, idx) => (
                                            <li key={idx} style={{ color: '#ddd' }}>
                                                {t(ing as any) || ing}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Stats */}
                                <div style={{ display: 'flex', gap: '20px', fontSize: '0.9em', color: '#888' }}>
                                    <div>⏱ {t('time')}: {recipe.timeLimit}s</div>
                                    <div>⭐ {t('score')}: {recipe.baseScore} pts</div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Level Stats */}
                <div style={{
                    padding: '15px',
                    backgroundColor: '#0f3460',
                    borderRadius: '5px',
                    marginBottom: '25px'
                }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.95em' }}>
                        <div>⏰ {t('levelTime')}: {formatTime(currentLevel.duration)}</div>
                        <div>📋 Max {t('orders')}: {currentLevel.maxActiveOrders}</div>
                        <div>⭐ 1 Star: {currentLevel.starThresholds[0]} pts</div>
                        <div>⭐ 2 Stars: {currentLevel.starThresholds[1]} pts</div>
                        <div>⭐ 3 Stars: {currentLevel.starThresholds[2]} pts</div>
                    </div>
                </div>

                {/* Start Button */}
                {isPreLevel && (
                    <button
                        onClick={startLevel}
                        className="menu-button"
                        style={{
                            width: '100%',
                            padding: '15px',
                            fontSize: '1.3em',
                            backgroundColor: '#4CAF50',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            marginBottom: '15px'
                        }}
                    >
                        {t('startLevel')} 🚀
                    </button>
                )}

                <p className="menu-hint" style={{
                    textAlign: 'center',
                    fontSize: '0.85em',
                    color: '#666'
                }}>
                    {isPreLevel ? (t('select') || "Select: Enter/[X]/[A]") : (t('hintToggleInstructions') || "Toggle: [I] / [△/Y]")}
                </p>
            </div>
        </div>
    );
};

// Helper for time formatting
function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}
