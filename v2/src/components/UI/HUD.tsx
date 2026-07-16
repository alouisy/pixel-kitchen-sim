import React from 'react';
import { useGameStore } from '../../store/useGameStore';
import { useTranslation } from '../../utils/i18n';
import { RecipeSystem } from '../../systems/RecipeSystem';

export const HUD: React.FC = () => {
    const { score, timeRemaining, orders, gameState, entities, tempMessage } = useGameStore();
    const { t } = useTranslation();
    const heldEntity = entities.find(e => e.heldBy === 'player');

    if (gameState !== 'PLAYING') return null;

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // Get held item display name (translate if possible, show meal name if recipe complete)
    const getHeldItemName = () => {
        if (!heldEntity) return t('nothing');

        // If it's a container with contents, check if it's a complete recipe
        if (heldEntity.contents && heldEntity.contents.length > 0) {
            const ingredientTypes = heldEntity.contents
                .map(id => entities.find(e => e.id === id)?.type)
                .filter(t => t) as string[];

            const recipe = RecipeSystem.validatePlate(ingredientTypes);
            if (recipe) {
                return t(recipe.name as any) || recipe.name;
            }
        }

        return t(heldEntity.type as any) || heldEntity.type;
    };

    return (
        <div id="game-hud" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 5 }}>
            {/* Crosshair */}
            <div style={{
                position: 'absolute', top: '50%', left: '50%', width: '10px', height: '10px',
                backgroundColor: 'white', borderRadius: '50%', transform: 'translate(-50%, -50%)',
                border: '1px solid black', opacity: 0.8
            }} />

            {/* Top Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '20px', color: 'white', fontSize: '24px', textShadow: '2px 2px 0 #000' }}>
                <div>{t('levelTime')}: {formatTime(timeRemaining)}</div>
                <div>{t('score')}: {score}</div>
            </div>

            {/* Order Cards (Overcooked Style) */}
            <div style={{ position: 'absolute', top: '70px', left: '20px', display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '300px' }}>
                {orders.map(order => {
                    const recipe = RecipeSystem.getRecipeByName(order.recipeName);
                    const maxTime = recipe?.timeLimit || order.duration;
                    const percentage = Math.max(0, Math.min(100, (order.duration / maxTime) * 100));
                    const isCritical = percentage < 25;

                    return (
                        <div
                            key={order.id}
                            className={`order-card ${isCritical ? 'critical' : ''}`}
                            style={{
                                background: 'rgba(10, 10, 10, 0.95)',
                                borderRadius: '8px',
                                overflow: 'hidden',
                                border: isCritical ? '2px solid #D32F2F' : '2px solid #333',
                                boxShadow: isCritical ? '0 0 15px rgba(211, 47, 47, 0.7)' : '0 4px 6px rgba(0,0,0,0.3)',
                                animation: isCritical ? 'shake 0.5s infinite' : 'none',
                                transition: 'all 0.3s'
                            }}
                        >
                            {/* Timer Bar */}
                            <div style={{ width: '100%', height: '6px', backgroundColor: '#222' }}>
                                <div style={{
                                    width: `${percentage}%`,
                                    height: '100%',
                                    backgroundColor: percentage > 50 ? '#4CAF50' : percentage > 25 ? '#FFC107' : '#D32F2F',
                                    transition: 'width 0.3s, background-color 0.3s'
                                }} />
                            </div>

                            {/* Order Content */}
                            <div style={{ padding: '12px' }}>
                                {/* Meal Name */}
                                <div style={{ fontWeight: 'bold', fontSize: '1.1em', color: '#FFD700', marginBottom: '8px' }}>
                                    {t(order.recipeName as any) || order.recipeName}
                                </div>

                                {/* Ingredients */}
                                {recipe && (
                                    <div style={{ fontSize: '0.85em', color: '#ccc' }}>
                                        {recipe.ingredients.map((ing, idx) => (
                                            <div key={idx} style={{ marginLeft: '8px', marginBottom: '2px' }}>
                                                • {t(ing as any) || ing}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Time */}
                                <div style={{ fontSize: '0.8em', color: isCritical ? '#ff6b6b' : '#888', marginTop: '6px', fontWeight: 'bold' }}>
                                    ⏱ {Math.floor(order.duration)}s
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Temp Message */}
            {tempMessage && (
                <div style={{
                    position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
                    background: 'rgba(0,0,0,0.9)', color: '#ffeb3b', padding: '15px 30px', borderRadius: '25px',
                    fontSize: '1.4em', fontWeight: 'bold',
                    border: '2px solid #ffeb3b',
                    boxShadow: '0 4px 15px rgba(255, 235, 59, 0.4)',
                    animation: 'fadeIn 0.3s'
                }}>
                    {tempMessage}
                </div>
            )}

            {/* Bottom HUD */}
            <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', textAlign: 'center' }}>
                {/* Held Item */}
                <div style={{
                    background: 'rgba(0,0,0,0.8)', color: 'white', padding: '12px 24px', borderRadius: '8px',
                    display: 'inline-block',
                    border: '2px solid #333',
                    minWidth: '200px'
                }}>
                    <div style={{ fontSize: '0.9em', color: '#888', marginBottom: '4px' }}>{t('holding')}:</div>
                    <div style={{ fontSize: '1.3em', fontWeight: 'bold', color: heldEntity ? '#FFD700' : '#666' }}>
                        {getHeldItemName()}
                    </div>
                    {heldEntity && heldEntity.contents && heldEntity.contents.length > 0 && (
                        <div style={{ fontSize: '0.75em', color: '#aaa', marginTop: '4px' }}>
                            (+{heldEntity.contents.length} {heldEntity.contents.length === 1 ? 'item' : 'items'})
                        </div>
                    )}
                </div>
            </div>

            {/* CSS for shake animation - injected via style tag */}
            <style>{`
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-4px); }
                    75% { transform: translateX(4px); }
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
                    to { opacity: 1; transform: translateX(-50%) translateY(0); }
                }
            `}</style>
        </div>
    );
};
