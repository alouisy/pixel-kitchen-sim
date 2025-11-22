import React, { useState, useRef } from 'react';
import { TransformControls } from '@react-three/drei';
// import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../store/useGameStore';
import { VoxelFactory } from '../../utils/VoxelFactory';
import type { LevelObject } from '../../types/GameTypes';
import { PALETTE } from '../../config/constants';

export const LevelEditor: React.FC = () => {
    const { currentLevel, setLevel } = useGameStore();
    const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
    // const { scene } = useThree();

    if (!currentLevel) return null;

    const handleSelect = (index: number, e: any) => {
        e.stopPropagation();
        setSelectedIndices([index]);
    };

    const handleTransformChange = (index: number, newPos: THREE.Vector3) => {
        const newLayout = [...currentLevel.layout];
        const obj = { ...newLayout[index] };

        // Snap to grid
        const snap = 0.5;
        obj.position = {
            x: Math.round(newPos.x / snap) * snap,
            z: Math.round(newPos.z / snap) * snap
        };
        // obj.rotation = newRot.y; // Handle rotation later

        newLayout[index] = obj;
        setLevel({ ...currentLevel, layout: newLayout });
    };

    return (
        <group>
            {/* Floor (Non-editable for now) */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow onPointerMissed={() => setSelectedIndices([])}>
                <planeGeometry args={[8, 8]} />
                <meshStandardMaterial color="#37474F" roughness={0.5} metalness={0.1} />
            </mesh>

            {currentLevel.layout.map((obj, i) => (
                <EditorObject
                    key={i}
                    obj={obj}
                    isSelected={selectedIndices.includes(i)}
                    onSelect={(e) => handleSelect(i, e)}
                    onTransform={(pos) => handleTransformChange(i, pos)}
                />
            ))}
        </group>
    );
};

const EditorObject: React.FC<{
    obj: LevelObject;
    isSelected: boolean;
    onSelect: (e: any) => void;
    onTransform: (pos: THREE.Vector3, rot: THREE.Euler) => void;
}> = ({ obj, isSelected, onSelect, onTransform }) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const geometry = React.useMemo(() => {
        if (obj.type === 'wall') return new THREE.BoxGeometry(obj.size?.width || 0.5, 2.5, obj.size?.depth || 0.5);
        if (obj.type === 'counter') return VoxelFactory.createCounter();
        if (obj.type === 'processor') {
            if (obj.name.includes('Fryer')) return VoxelFactory.createFryer();
            if (obj.name.includes('Cutting')) return VoxelFactory.createCuttingBoard();
            if (obj.name.includes('Stove')) return VoxelFactory.createStove();
            return VoxelFactory.createCounter(); // Fallback
        }
        if (obj.type === 'ingredient_source') return VoxelFactory.createIngredientBin(obj.config?.ingredient || 'generic');
        if (obj.type === 'item_source') return VoxelFactory.createPlateStack(); // Fallback
        if (obj.type === 'serving') return VoxelFactory.createCounter(); // Reuse counter
        if (obj.type === 'trash') return VoxelFactory.createTrashBin();
        if (obj.type === 'table') return VoxelFactory.createTable({ n: false, s: false, e: false, w: false }); // Generic table
        return new THREE.BoxGeometry(0.5, 0.5, 0.5);
    }, [obj.type, obj.name, obj.config, obj.size]);

    const yPos = obj.type === 'wall' ? 1.25 : 0; // Wall center is at 1.25 (height 2.5)

    return (
        <>
            <mesh
                ref={meshRef}
                position={[obj.position.x, yPos, obj.position.z]}
                rotation={[0, obj.rotation || 0, 0]}
                geometry={geometry}
                onClick={onSelect}
            >
                <meshStandardMaterial
                    vertexColors={obj.type !== 'wall'}
                    color={obj.type === 'wall' ? PALETTE.WALL_WHITE : undefined}
                    emissive={isSelected ? 0x444444 : 0x000000}
                />
            </mesh>
            {isSelected && meshRef.current && (
                <TransformControls
                    object={meshRef.current}
                    mode="translate"
                    onMouseUp={() => {
                        if (meshRef.current) {
                            onTransform(meshRef.current.position, meshRef.current.rotation);
                        }
                    }}
                />
            )}
        </>
    );
};
