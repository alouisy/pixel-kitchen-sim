import React from 'react';
import { useGameStore } from '../../store/useGameStore';

export const HUD: React.FC = () => {
    const { score, timeRemaining, orders, gameState, entities } = useGameStore();
    const heldEntity = entities.find(e => e.heldBy === 'player');

    if (gameState !== 'PLAYING') return null;

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
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
                <div>Time: {formatTime(timeRemaining)}</div>
                <div>Score: {score}</div>
            </div>

            {/* Orders */}
            <div style={{ position: 'absolute', top: '60px', left: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {orders.map(order => (
                    <div key={order.id} style={{
                        background: 'rgba(0,0,0,0.7)', color: 'white', padding: '10px', borderRadius: '5px',
                        borderLeft: '5px solid ' + (order.duration < 30 ? 'red' : 'green')
                    }}>
                        <div style={{ fontWeight: 'bold' }}>{order.recipeName}</div>
                        <div style={{ fontSize: '0.8em' }}>{Math.floor(order.duration)}s</div>
                    </div>
                ))}
            </div>

            {/* Held Item */}
            {heldEntity && (
                <div style={{
                    position: 'absolute', bottom: '20px', right: '20px',
                    background: 'rgba(0,0,0,0.5)', color: 'white', padding: '10px', borderRadius: '5px',
                    display: 'flex', alignItems: 'center', gap: '10px'
                }}>
                    <div style={{ fontSize: '20px' }}>Held: {heldEntity.type}</div>
                    {heldEntity.contents && heldEntity.contents.length > 0 && (
                        <div style={{ fontSize: '14px', color: '#ccc' }}>
                            (+ {heldEntity.contents.length} items)
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
