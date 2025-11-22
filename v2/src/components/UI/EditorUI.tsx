import React, { useState } from 'react';
import { useGameStore } from '../../store/useGameStore';
import type { LevelObject, StationType } from '../../types/GameTypes';

const CATEGORIES = {
    'Architecture': ['wall', 'floor'],
    'Stations': ['counter', 'processor', 'serving', 'trash', 'table'],
    'Sources': ['ingredient_source', 'item_source']
};

const PREFABS: Record<string, Partial<LevelObject>> = {
    'Wall': { type: 'wall', size: { width: 0.5, depth: 0.5 } },
    'Counter': { type: 'counter' },
    'Serving': { type: 'serving' },
    'Trash': { type: 'trash' },
    'Table': { type: 'table' },
    'Fryer': { type: 'processor', name: 'Fryer', config: { processes: ['raw_fries'], result: { 'raw_fries': 'cooked_fries' }, processingTime: 3000 } },
    'CuttingBoard': { type: 'processor', name: 'CuttingBoard', config: { processes: ['potato', 'lettuce', 'tomato'], result: { 'potato': 'raw_fries', 'lettuce': 'chopped_lettuce', 'tomato': 'chopped_tomato' } } },
    'Stove': { type: 'processor', name: 'Stove', config: { processes: ['raw_patty'], result: { 'raw_patty': 'cooked_patty' }, processingTime: 5000 } },
    'PotatoBin': { type: 'ingredient_source', name: 'PotatoBin', config: { ingredient: 'potato' } },
    'TomatoBin': { type: 'ingredient_source', name: 'TomatoBin', config: { ingredient: 'tomato' } },
    'LettuceBin': { type: 'ingredient_source', name: 'LettuceBin', config: { ingredient: 'lettuce' } },
    'PlateStack': { type: 'item_source', name: 'PlateStack', config: { item: 'plate' } },
};

export const EditorUI: React.FC = () => {
    const { gameState, setGameState, currentLevel, setLevel } = useGameStore();
    const [selectedCategory, setSelectedCategory] = useState('Stations');

    if (gameState !== 'EDITOR') return null;

    const handleAdd = (key: string) => {
        const prefab = PREFABS[key];
        if (!prefab) return;

        const newObj: LevelObject = {
            name: key + '_' + Date.now(),
            type: prefab.type as StationType,
            position: { x: 0, z: 0 },
            ...prefab
        };

        if (currentLevel) {
            const newLayout = [...currentLevel.layout, newObj];
            setLevel({ ...currentLevel, layout: newLayout });
        }
    };

    const handleSave = () => {
        if (!currentLevel) return;
        const json = JSON.stringify(currentLevel, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `level_${currentLevel.levelId}.json`;
        a.click();
    };

    return (
        <div className="editor-ui" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 20 }}>
            {/* Top Bar */}
            <div className="editor-top-bar">
                <div className="editor-title">Level Editor: {currentLevel?.name}</div>
                <div className="editor-controls-hint">
                    <span>WASD: Move Camera</span>
                    <span>Click: Select</span>
                    <span>Drag: Move Object</span>
                </div>
                <div>
                    <button className="menu-button small" onClick={handleSave}>Save JSON</button>
                    <button className="menu-button small" onClick={() => setGameState('MENU')} style={{ marginLeft: '10px' }}>Exit</button>
                </div>
            </div>

            {/* Bottom Panel (Library) */}
            <div className="editor-bottom-panel">
                <div className="library-tabs">
                    {Object.keys(CATEGORIES).map(cat => (
                        <button
                            key={cat}
                            className={`tab-btn ${selectedCategory === cat ? 'active' : ''}`}
                            onClick={() => setSelectedCategory(cat)}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
                <div className="library-grid">
                    {Object.keys(PREFABS).filter(key => {
                        if (selectedCategory === 'Architecture') return ['Wall'].includes(key);
                        if (selectedCategory === 'Sources') return key.includes('Bin') || key.includes('Stack');
                        return !['Wall'].includes(key) && !key.includes('Bin') && !key.includes('Stack');
                    }).map(key => (
                        <div key={key} className="library-item" onClick={() => handleAdd(key)}>
                            <div className="library-item-icon">📦</div>
                            <div className="library-item-name">{key}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
