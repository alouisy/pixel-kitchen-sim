import React, { useState, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { OrbitControls, Sky, Stars } from '@react-three/drei';
import { LevelGeometry } from '../World/LevelGeometry';
import { EditorSystem } from '../../systems/EditorSystem';
import { useGameStore } from '../../store/useGameStore';
import * as THREE from 'three';

const EditorControls: React.FC = () => {
    const { camera, scene, gl } = useThree();
    const [isDragging, setIsDragging] = useState(false);
    const dragPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
    const raycaster = useRef(new THREE.Raycaster());
    const { selectedObject, setLevel, currentLevel } = useGameStore();

    const handlePointerDown = (e: PointerEvent) => {
        if (e.button !== 0) return; // Only left click

        EditorSystem.updateMouse(e.clientX, e.clientY);
        EditorSystem.handleInput(camera, scene, 'select');

        // If we have a selected object after click, enable dragging
        const selected = useGameStore.getState().selectedObject;
        if (selected) {
            setIsDragging(true);
        }
    };

    const handlePointerMove = (e: PointerEvent) => {
        if (!isDragging || !selectedObject || !currentLevel) return;

        const mouse = new THREE.Vector2(
            (e.clientX / window.innerWidth) * 2 - 1,
            -(e.clientY / window.innerHeight) * 2 + 1
        );

        raycaster.current.setFromCamera(mouse, camera);

        // Check for surfaces (counters/tables) first
        const surfaces: THREE.Object3D[] = [];
        scene.traverse((obj) => {
            if (obj.userData.stationType === 'counter' ||
                obj.userData.stationType === 'table' ||
                obj.userData.stationType === 'serving') {
                surfaces.push(obj);
            }
        });

        const surfaceHits = raycaster.current.intersectObjects(surfaces, true);
        let targetX = 0;
        let targetZ = 0;
        let foundTarget = false;

        if (surfaceHits.length > 0) {
            // Hit a surface - item will be rendered at Y=0.9 when displayed
            const hit = surfaceHits[0];
            targetX = hit.point.x;
            targetZ = hit.point.z;
            foundTarget = true;
        } else {
            // No surface hit - check ground plane (will render at Y=0)
            const intersectPoint = new THREE.Vector3();
            if (raycaster.current.ray.intersectPlane(dragPlane.current, intersectPoint)) {
                targetX = intersectPoint.x;
                targetZ = intersectPoint.z;
                foundTarget = true;
            }
        }

        if (foundTarget) {
            // Snap to grid (0.5 unit increments)
            const snappedX = Math.round(targetX * 2) / 2;
            const snappedZ = Math.round(targetZ * 2) / 2;

            // Update object position
            const idx = currentLevel.layout.indexOf(selectedObject);
            if (idx !== -1) {
                const newLayout = [...currentLevel.layout];
                newLayout[idx] = {
                    ...selectedObject,
                    position: { x: snappedX, z: snappedZ }
                };
                setLevel({ ...currentLevel, layout: newLayout });
                useGameStore.getState().setSelectedObject(newLayout[idx]);
            }
        }
    };

    const handlePointerUp = () => {
        setIsDragging(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.key === 'Delete' || e.key === 'Backspace') && selectedObject) {
            EditorSystem.handleInput(camera, scene, 'delete');
        } else if (e.key === 'r' && selectedObject) {
            EditorSystem.handleInput(camera, scene, 'rotate');
        }
    };

    React.useEffect(() => {
        // Disable OrbitControls when dragging
        const controls = gl.domElement.parentElement?.querySelector('canvas');
        if (controls) {
            // Access the OrbitControls through the canvas's R3F instance
            // We'll handle this differently - just prevent default drag
        }

        window.addEventListener('keydown', handleKeyDown);
        gl.domElement.addEventListener('pointerdown', handlePointerDown);
        gl.domElement.addEventListener('pointermove', handlePointerMove);
        gl.domElement.addEventListener('pointerup', handlePointerUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            gl.domElement.removeEventListener('pointerdown', handlePointerDown);
            gl.domElement.removeEventListener('pointermove', handlePointerMove);
            gl.domElement.removeEventListener('pointerup', handlePointerUp);
        };
    }, [isDragging, selectedObject, currentLevel, camera, scene, gl]);

    return <OrbitControls enableDamping dampingFactor={0.05} enabled={!isDragging} />;
};

export const LevelEditor: React.FC = () => {
    return (
        <>
            <LevelGeometry />
            <EditorControls />
            <Sky sunPosition={[100, 20, 100]} />
            <Stars radius={100} depth={50} count={5000} factor={4} fade />
            <ambientLight intensity={0.6} />
            <directionalLight position={[10, 10, 5]} intensity={0.8} castShadow />
            <gridHelper args={[20, 20]} position={[0, 0.01, 0]} />
        </>
    );
};
