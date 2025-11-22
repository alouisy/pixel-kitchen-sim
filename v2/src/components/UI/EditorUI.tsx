import React, { useState } from 'react';
import { useGameStore } from '../../store/useGameStore';
import type { LevelObject } from '../../types/GameTypes';
import { CATALOG_ITEMS, CATALOG_CATEGORIES } from '../../config/editorCatalog';
import './EditorUI.css';

export const EditorUI: React.FC = () => {
    const { gameState, setGameState, currentLevel, setLevel, selectedObject, setSelectedObject } = useGameStore();
    const [selectedCategory, setSelectedCategory] = useState<typeof CATALOG_CATEGORIES[number]>('all');
    const [showMetaModal, setShowMetaModal] = useState(false);
    const [configText, setConfigText] = useState('{}');

    // Filter items by category
    const filteredItems = selectedCategory === 'all'
        ? CATALOG_ITEMS
        : CATALOG_ITEMS.filter(item => item.category === selectedCategory);

    const handleAddObject = (template: typeof CATALOG_ITEMS[0]) => {
        const newObj: LevelObject = {
            name: template.name,
            type: template.type as any,
            position: { x: 0, z: 0 },
            ...(template.size && { size: template.size }),
            ...(template.color && { color: template.color }),
            ...(template.config && { config: template.config }),
            ...(template.isServing && { isServing: template.isServing }),
        };

        if (currentLevel) {
            const newLayout = [...currentLevel.layout, newObj];
            setLevel({ ...currentLevel, layout: newLayout });
            setSelectedObject(newObj);
        }
    };

    const handleRotateSelected = () => {
        if (!selectedObject || !currentLevel) return;
        const idx = currentLevel.layout.indexOf(selectedObject);
        if (idx !== -1) {
            const newLayout = [...currentLevel.layout];
            const currentRotation = newLayout[idx].rotation || 0;
            newLayout[idx] = { ...selectedObject, rotation: currentRotation + Math.PI / 2 };
            setLevel({ ...currentLevel, layout: newLayout });
            setSelectedObject(newLayout[idx]);
        }
    };

    const handleCloneSelected = () => {
        if (!selectedObject || !currentLevel) return;
        const clone: LevelObject = {
            ...selectedObject,
            name: selectedObject.name + '_clone',
            position: { x: selectedObject.position.x + 0.5, z: selectedObject.position.z }
        };
        const newLayout = [...currentLevel.layout, clone];
        setLevel({ ...currentLevel, layout: newLayout });
        setSelectedObject(clone);
    };

    const handleDeleteSelected = () => {
        if (!selectedObject || !currentLevel) return;
        const idx = currentLevel.layout.indexOf(selectedObject);
        if (idx !== -1) {
            const newLayout = [...currentLevel.layout];
            newLayout.splice(idx, 1);
            setLevel({ ...currentLevel, layout: newLayout });
            setSelectedObject(null);
        }
    };

    const handleSaveConfig = () => {
        if (!selectedObject || !currentLevel) return;
        try {
            const newConfig = JSON.parse(configText);
            const idx = currentLevel.layout.indexOf(selectedObject);
            if (idx !== -1) {
                const newLayout = [...currentLevel.layout];
                newLayout[idx] = { ...selectedObject, config: newConfig };
                setLevel({ ...currentLevel, layout: newLayout });
                setSelectedObject(newLayout[idx]);
            }
        } catch (e) {
            alert('Invalid JSON format!');
        }
    };

    const handleExportLevel = () => {
        if (!currentLevel) return;
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentLevel, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `level_${currentLevel.levelId || 'custom'}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const handleExitEditor = () => {
        setGameState('MENU');
    };

    // Update config text when selection changes - MUST be before early return
    React.useEffect(() => {
        if (selectedObject?.config) {
            setConfigText(JSON.stringify(selectedObject.config, null, 2));
        } else {
            setConfigText('{}');
        }
    }, [selectedObject]);

    // Early return AFTER all hooks
    if (gameState !== 'EDITOR') return null;

    return (
        <div id="editor-ui">
            {/* Top Bar */}
            <div className="editor-top-bar">
                <div className="editor-title">
                    🏗️ LEVEL EDITOR: <span>{currentLevel?.name || 'Untitled'}</span>
                </div>
                <div className="editor-controls-hint">
                    <span><b>Left Click:</b> Select/Place</span> |
                    <span><b>Drag:</b> Move</span> |
                    <span><b>Delete:</b> Remove</span> |
                    <span><b>R:</b> Rotate</span>
                </div>
                <div className="editor-top-actions">
                    <button className="editor-action-btn small" onClick={() => setShowMetaModal(true)}>
                        ⚙️ Settings
                    </button>
                    <button className="editor-action-btn small" onClick={handleExportLevel}>
                        💾 Save JSON
                    </button>
                    <button className="editor-action-btn small delete" onClick={handleExitEditor}>
                        Exit
                    </button>
                </div>
            </div>

            {/* Level Metadata Modal */}
            {showMetaModal && (
                <div className="editor-panel center-panel">
                    <h3>Level Settings</h3>
                    <div className="meta-row">
                        <label>Name:</label>
                        <input
                            type="text"
                            value={currentLevel?.name || ''}
                            onChange={(e) => currentLevel && setLevel({ ...currentLevel, name: e.target.value })}
                        />
                    </div>
                    <div className="meta-row">
                        <label>Duration (s):</label>
                        <input
                            type="number"
                            value={currentLevel?.duration || 180}
                            onChange={(e) => currentLevel && setLevel({ ...currentLevel, duration: parseInt(e.target.value) })}
                        />
                    </div>
                    <div className="meta-row">
                        <label>Order Delay (s):</label>
                        <input
                            type="number"
                            value={currentLevel?.newOrderDelay || 15}
                            onChange={(e) => currentLevel && setLevel({ ...currentLevel, newOrderDelay: parseInt(e.target.value) })}
                        />
                    </div>
                    <div className="meta-row">
                        <label>Max Orders:</label>
                        <input
                            type="number"
                            value={currentLevel?.maxActiveOrders || 2}
                            onChange={(e) => currentLevel && setLevel({ ...currentLevel, maxActiveOrders: parseInt(e.target.value) })}
                        />
                    </div>
                    <button className="editor-action-btn" onClick={() => setShowMetaModal(false)}>Close</button>
                </div>
            )}

            {/* Bottom Library Panel */}
            <div className="editor-panel bottom-panel">
                <div className="library-tabs">
                    {CATALOG_CATEGORIES.map(cat => (
                        <button
                            key={cat}
                            className={`tab-btn ${selectedCategory === cat ? 'active' : ''}`}
                            onClick={() => setSelectedCategory(cat)}
                        >
                            {cat === 'all' ? 'All' : cat}
                        </button>
                    ))}
                </div>
                <div className="library-grid">
                    {filteredItems.map((item, idx) => (
                        <div
                            key={idx}
                            className="library-item"
                            onClick={() => handleAddObject(item)}
                        >
                            <div className="library-item-icon">{item.icon}</div>
                            <div className="library-item-name">{item.name}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right Inspector Panel */}
            {selectedObject && (
                <div className="editor-panel right-panel">
                    <h3>Selected Object</h3>
                    <div className="inspector-field">{selectedObject.name}</div>

                    <div className="inspector-coords">
                        <div>X: {selectedObject.position.x.toFixed(1)}</div>
                        <div>Z: {selectedObject.position.z.toFixed(1)}</div>
                        {selectedObject.rotation && <div>Rot: {(selectedObject.rotation * 180 / Math.PI).toFixed(0)}°</div>}
                    </div>

                    <div className="inspector-actions">
                        <button className="editor-action-btn" onClick={handleRotateSelected}>
                            🔄 Rotate
                        </button>
                        <button className="editor-action-btn" onClick={handleCloneSelected}>
                            📋 Clone
                        </button>
                        <button className="editor-action-btn delete" onClick={handleDeleteSelected}>
                            🗑️ Delete
                        </button>
                    </div>

                    <div className="inspector-config-section">
                        <label>Config (JSON):</label>
                        <textarea
                            id="inspector-config"
                            rows={6}
                            value={configText}
                            onChange={(e) => setConfigText(e.target.value)}
                        />
                        <button className="editor-action-btn" onClick={handleSaveConfig}>
                            💾 Save Config
                        </button>
                    </div>
                </div>
            )
            }
        </div >
    );
};
