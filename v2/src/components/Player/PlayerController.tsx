import React, { useRef, useEffect, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { PointerLockControls, useKeyboardControls } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../../store/useGameStore';
import { InteractionManager } from '../../systems/Interaction';
import { VoxelFactory } from '../../utils/VoxelFactory';


export const PlayerController: React.FC = () => {
    const { camera, scene } = useThree();
    const [, getKeys] = useKeyboardControls();
    const moveSpeed = 5;
    // const velocity = useRef(new THREE.Vector3());
    const { entities } = useGameStore();
    const raycaster = useRef(new THREE.Raycaster());
    // const crosshairRef = useRef<HTMLDivElement>(null); // We'll use HTML overlay for crosshair actually

    // Held Item Logic
    const heldEntity = entities.find(e => e.heldBy === 'player');

    // Raycast State
    const [hoverTarget, setHoverTarget] = useState<any>(null);

    useEffect(() => {
        raycaster.current.far = 3; // Interaction distance
    }, []);

    useFrame((_state, delta) => {
        // Movement Logic
        const { forward, backward, left, right } = getKeys();

        const direction = new THREE.Vector3();
        const frontVector = new THREE.Vector3(0, 0, Number(backward) - Number(forward));
        const sideVector = new THREE.Vector3(Number(left) - Number(right), 0, 0);

        direction.subVectors(frontVector, sideVector).normalize().multiplyScalar(moveSpeed * delta);

        // Apply to camera
        // We need to move relative to camera direction but ignore Y for walking
        // PointerLockControls moves camera directly.

        // Helper to move
        if (forward || backward || left || right) {
            camera.translateX(direction.x);
            camera.translateZ(direction.z);
            // Lock Y
            camera.position.y = 1.6;
        }
        // Raycast from center of screen
        raycaster.current.setFromCamera(new THREE.Vector2(0, 0), camera);

        // Intersect with World Objects (Stations, Walls) and Entities
        // We need to traverse scene or have a list of interactables.
        // For now, let's intersect everything and filter.
        const intersects = raycaster.current.intersectObjects(scene.children, true);

        let found = null;
        for (const hit of intersects) {
            // Check if it's a valid target
            const obj = hit.object;
            // Traverse up to find userData
            let curr: THREE.Object3D | null = obj;
            while (curr) {
                if (curr.userData && (curr.userData.type === 'station' || curr.userData.type === 'ingredient_source' || curr.userData.type === 'item_source' || curr.userData.type === 'trash' || curr.userData.type === 'serving' || curr.userData.type === 'counter' || curr.userData.type === 'processor')) {
                    found = curr;
                    break;
                }
                // Also check for Entities (Items)
                // We need to tag Entity meshes with userData
                if (curr.userData && curr.userData.entityId) {
                    found = curr;
                    break;
                }
                curr = curr.parent;
            }
            if (found) break;
        }

        if (found !== hoverTarget) {
            setHoverTarget(found);
            // Optional: Update cursor or highlight
        }
    });

    useEffect(() => {
        const handleClick = () => {
            if (hoverTarget) {
                // Resolve target to LevelObject or Entity
                let target: any = null;
                if (hoverTarget.userData.entityId) {
                    // It's an entity
                    target = entities.find(e => e.id === hoverTarget.userData.entityId);
                } else {
                    // It's a station/level object
                    // We need to reconstruct the LevelObject from userData or find it in layout
                    // userData should store the config/type
                    target = {
                        ...hoverTarget.userData,
                        position: hoverTarget.position // Vector3
                    };
                }

                if (target) {
                    InteractionManager.handleInteraction(heldEntity || null, target);
                }
            }
        };

        window.addEventListener('mousedown', handleClick);
        return () => window.removeEventListener('mousedown', handleClick);
    }, [hoverTarget, heldEntity, entities]);

    return (
        <>
            <PointerLockControls />

            {/* Render Held Item attached to Camera */}
            {heldEntity && (
                <group position={[0.5, -0.5, -1]} parent={camera}>
                    {/* We need to render the mesh for heldEntity.type */}
                    {/* Using VoxelFactory.createItem(heldEntity.type) */}
                    {/* Note: creating geometry in render loop is bad. Should be memoized or componentized. */}
                    <HeldItemRenderer type={heldEntity.type} />
                </group>
            )}
        </>
    );
};

const HeldItemRenderer: React.FC<{ type: string }> = ({ type }) => {
    const meshRef = useRef<THREE.Mesh>(null);

    useEffect(() => {
        if (meshRef.current) {
            const geo = VoxelFactory.createItem(type);
            meshRef.current.geometry = geo;
        }
    }, [type]);

    return (
        <mesh ref={meshRef} scale={[0.5, 0.5, 0.5]} rotation={[0, Math.PI / 4, 0]}>
            <meshStandardMaterial vertexColors />
        </mesh>
    );
};
