import React, { useRef, useEffect, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { PointerLockControls, useKeyboardControls } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../../store/useGameStore';
import { InteractionManager } from '../../systems/Interaction';
import { VoxelFactory } from '../../utils/VoxelFactory';
import { gamepadSystem } from '../../systems/GamepadSystem';


export const PlayerController: React.FC = () => {
    const { camera, scene } = useThree();
    const [, getKeys] = useKeyboardControls();
    const moveSpeed = 5;

    // Selector optimization: Only re-render if entities array reference changes
    // But entities array changes on every entity update.
    // We only need heldEntity.
    // And we need entities for raycasting? No, raycasting uses scene.children.
    // We need entities to resolve userData.entityId to actual entity object.
    // So we do need entities.
    const entities = useGameStore(state => state.entities);

    const raycaster = useRef(new THREE.Raycaster());
    const frameCount = useRef(0);

    // Held Item Logic
    const heldEntity = entities.find(e => e.heldBy === 'player');

    // Raycast State
    const [hoverTarget, setHoverTarget] = useState<any>(null);

    useEffect(() => {
        raycaster.current.far = 3; // Interaction distance
    }, []);

    // Collision Detection
    const checkCollision = (newPos: THREE.Vector3) => {
        const wallThickness = 0.8; // Slightly larger than 0.5 to keep distance
        const walls = scene.children.filter(c => c.userData?.stationType === 'wall');

        for (const wall of walls) {
            const wp = wall.position;
            // Simple AABB check (walls are 1x1x1 scaled)
            // Wall scale is in userData or we assume 1x1? 
            // LevelGeometry scales walls. We need to check bounds.
            // Let's use a simple distance check for now assuming grid alignment.
            // Walls are at integer coordinates usually.

            if (Math.abs(newPos.x - wp.x) < wallThickness && Math.abs(newPos.z - wp.z) < wallThickness) {
                return true;
            }
        }
        return false;
    };

    useFrame((_state, delta) => {
        // Update Gamepad
        gamepadSystem.update();

        // Movement Logic (Keyboard + Gamepad)
        const { forward, backward, left, right } = getKeys();

        const direction = new THREE.Vector3();

        // Combine inputs
        const inputZ = (Number(backward) - Number(forward)) + gamepadSystem.axes.y;
        const inputX = (Number(left) - Number(right)) - gamepadSystem.axes.x;

        const frontVector = new THREE.Vector3(0, 0, inputZ);
        const sideVector = new THREE.Vector3(inputX, 0, 0);

        direction.subVectors(frontVector, sideVector).normalize().multiplyScalar(moveSpeed * delta);

        // Apply to camera with Collision Check
        if (direction.lengthSq() > 0.0001) {
            const currentPos = camera.position.clone();
            // Calculate next X position
            const nextPosX = currentPos.clone().add(new THREE.Vector3(direction.x, 0, 0));

            // Check X movement
            if (!checkCollision(new THREE.Vector3(nextPosX.x, currentPos.y, currentPos.z))) {
                camera.translateX(direction.x);
            }

            // Calculate next Z position (approximate for sliding check)
            // Since we use camera.translateZ which depends on rotation, we need to be careful.
            // But we can just check the final position after a theoretical move?
            // No, we want to prevent the move if it collides.

            // Let's calculate the world movement vector for Z component of input
            // Actually, 'direction' is already in local camera space (mostly).
            // Wait, direction calculation:
            // direction.subVectors(frontVector, sideVector)
            // frontVector = (0, 0, inputZ)
            // sideVector = (inputX, 0, 0)
            // So 'direction' is in local space relative to camera orientation? 
            // No, camera.translateX/Z moves in local space.

            // To check collision in world space, we need to know where that local move puts us.
            // inputZ = backward - forward. So + is backward.
            // forward vector is -Z. So we want to move -forward if inputZ is +?
            // Let's stick to what works: camera.translateZ(direction.z)

            // Let's just simulate the move on a clone.
            const testCam = camera.clone();
            testCam.translateX(direction.x);

            // We already handled X. Now Z.
            testCam.position.copy(camera.position); // Reset
            testCam.translateZ(direction.z);
            const posAfterZ = testCam.position.clone();

            // Check Z movement
            if (!checkCollision(new THREE.Vector3(camera.position.x, camera.position.y, posAfterZ.z))) {
                camera.translateZ(direction.z);
            }

            camera.position.y = 1.6;
        }

        // Raycast Throttling (Every 5 frames ~ 12 times per second at 60fps)
        frameCount.current++;
        if (frameCount.current % 5 === 0) {
            // Raycast from center of screen
            raycaster.current.setFromCamera(new THREE.Vector2(0, 0), camera);

            // Intersect with World Objects (Stations, Walls) and Entities
            const intersects = raycaster.current.intersectObjects(scene.children, true);

            let found = null;
            for (const hit of intersects) {
                // Check if it's a valid target
                const obj = hit.object;
                // Traverse up to find userData
                let curr: THREE.Object3D | null = obj;
                while (curr) {
                    // Check for stations using stationType (as set by LevelGeometry)
                    if (curr.userData && curr.userData.stationType) {
                        found = curr;
                        break;
                    }
                    // Also check for Entities (Items)
                    if (curr.userData && curr.userData.entityId) {
                        found = curr;
                        break;
                    }
                    curr = curr.parent;
                }
                if (found) break;
            }

            if (found !== hoverTarget) {
                // Reset scale of previous target
                if (hoverTarget && hoverTarget.scale) {
                    hoverTarget.scale.set(1, 1, 1);
                }
                // Set new target
                setHoverTarget(found);
            }
        }

        // Scale Effect for Hover Target
        if (hoverTarget) {
            // Pulse effect or static scale? User said "grow up the scale".
            // Let's just set it to 1.1
            // We need to be careful not to fight with other scale logic if any.
            // But stations are usually scale 1.
            hoverTarget.scale.set(1.1, 1.1, 1.1);
        }
    });

    // Gamepad Button Listener (Simulated)
    useEffect(() => {
        let lastInteract = false;
        const checkGamepad = () => {
            if (gamepadSystem.buttons.interact && !lastInteract) {
                // Trigger interaction
                if (hoverTarget) {
                    const target = hoverTarget.userData.entityId
                        ? entities.find(e => e.id === hoverTarget.userData.entityId)
                        : { ...hoverTarget.userData, position: hoverTarget.position };

                    if (target) InteractionManager.handleInteraction(heldEntity || null, target);
                }
            }
            lastInteract = gamepadSystem.buttons.interact;
            requestAnimationFrame(checkGamepad);
        };
        const handle = requestAnimationFrame(checkGamepad);
        return () => cancelAnimationFrame(handle);
    }, [hoverTarget, heldEntity, entities]);

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
