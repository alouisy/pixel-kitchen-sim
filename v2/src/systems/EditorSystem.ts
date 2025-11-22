import * as THREE from 'three';
import { useGameStore } from '../store/useGameStore';

export const EditorSystem = {
    raycaster: new THREE.Raycaster(),
    mouse: new THREE.Vector2(),

    handleInput: (camera: THREE.Camera, scene: THREE.Scene, action: 'select' | 'delete' | 'rotate') => {
        const state = useGameStore.getState();
        if (state.gameState !== 'EDITOR' || !state.currentLevel) return;

        EditorSystem.raycaster.setFromCamera(EditorSystem.mouse, camera);
        const intersects = EditorSystem.raycaster.intersectObjects(scene.children, true);

        let target: THREE.Object3D | null = null;

        // Find first valid level object
        for (const hit of intersects) {
            let curr: THREE.Object3D | null = hit.object;
            while (curr) {
                if (curr.userData && curr.userData.layoutIndex !== undefined) {
                    target = curr;
                    break;
                }
                curr = curr.parent;
            }
            if (target) break;
        }

        if (target && target.userData.layoutIndex !== undefined) {
            const layout = state.currentLevel.layout;
            const index = target.userData.layoutIndex;

            if (index >= 0 && index < layout.length) {
                const obj = layout[index];

                if (action === 'delete') {
                    const newLayout = [...layout];
                    newLayout.splice(index, 1);
                    state.setLevel({ ...state.currentLevel, layout: newLayout });
                    state.setSelectedObject(null);
                } else if (action === 'rotate') {
                    const newLayout = [...layout];
                    const newRot = (obj.rotation || 0) + Math.PI / 2;
                    newLayout[index] = { ...obj, rotation: newRot };
                    state.setLevel({ ...state.currentLevel, layout: newLayout });
                } else if (action === 'select') {
                    state.setSelectedObject(obj);
                }
            }
        } else if (action === 'select') {
            // Clicked empty space, deselect
            state.setSelectedObject(null);
        }
    },

    updateMouse: (x: number, y: number) => {
        EditorSystem.mouse.x = (x / window.innerWidth) * 2 - 1;
        EditorSystem.mouse.y = -(y / window.innerHeight) * 2 + 1;
    }
};
