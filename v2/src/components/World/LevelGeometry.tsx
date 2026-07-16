import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Instances, Instance } from '@react-three/drei';
import { useGameStore } from '../../store/useGameStore';
import { VoxelFactory } from '../../utils/VoxelFactory';
import { PALETTE } from '../../config/constants';
import { LabelRenderer } from './LabelRenderer';

const WALL_HEIGHT = 2.5;

export const LevelGeometry: React.FC = () => {
    const currentLevel = useGameStore(state => state.currentLevel);
    const selectedObject = useGameStore(state => state.selectedObject);
    const gameState = useGameStore(state => state.gameState);

    const { walls, stations } = useMemo(() => {
        if (!currentLevel) return { walls: [], stations: [] };
        const walls = currentLevel.layout.filter(o => o.type === 'wall');
        const stations = currentLevel.layout.filter(o => o.type !== 'wall');
        return { walls, stations };
    }, [currentLevel]);

    const wallGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
    const wallMat = useMemo(() => new THREE.MeshStandardMaterial({ color: PALETTE.WALL_WHITE }), []);

    // Floor
    const floorTex = useMemo(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 128;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#37474F'; ctx.fillRect(0, 0, 128, 128);
        ctx.fillStyle = '#546E7A'; ctx.fillRect(0, 0, 64, 64); ctx.fillRect(64, 64, 64, 64);
        ctx.strokeStyle = '#263238'; ctx.lineWidth = 4; ctx.strokeRect(0, 0, 128, 128);
        ctx.beginPath(); ctx.moveTo(64, 0); ctx.lineTo(64, 128); ctx.moveTo(0, 64); ctx.lineTo(128, 64); ctx.stroke();
        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(4, 4);
        tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
        return tex;
    }, []);
    const getStationGeo = (type: string, config?: any) => {
        switch (type) {
            case 'counter': return VoxelFactory.createCounter();
            case 'serving': return VoxelFactory.createCounter(); // Tint red later?
            case 'trash': return VoxelFactory.createTrashBin();
            case 'processor':
                if (config?.processes?.includes('raw_fries')) return VoxelFactory.createFryer();
                if (config?.processes?.includes('potato')) return VoxelFactory.createCuttingBoard();
                if (config?.processes?.includes('raw_patty')) return VoxelFactory.createStove();
                return VoxelFactory.createCounter(); // Fallback
            case 'ingredient_source': return VoxelFactory.createIngredientBin(config?.ingredient || 'tomato');
            case 'item_source':
                if (config?.item === 'plate') return VoxelFactory.createPlateStack();
                return VoxelFactory.createCounter();
            case 'table': return VoxelFactory.createTable({ n: false, s: false, e: false, w: false }); // TODO: Neighbors
            default: return VoxelFactory.createCounter();
        }
    };

    const stationMat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.1 }), []);

    return (
        <group>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
                <planeGeometry args={[8, 8]} />
                <meshStandardMaterial map={floorTex} roughness={0.5} metalness={0.1} />
            </mesh>

            <Instances range={walls.length} geometry={wallGeo} material={wallMat} castShadow receiveShadow>
                {walls.map((wall, i) => (
                    <Instance
                        key={i}
                        position={[wall.position.x, WALL_HEIGHT / 2, wall.position.z]}
                        scale={[wall.size?.width ?? 0.5, WALL_HEIGHT, wall.size?.depth ?? 0.5]}
                        rotation={[0, wall.rotation || 0, 0]}
                        userData={{
                            layoutIndex: currentLevel?.layout.indexOf(wall),
                            stationType: 'wall'
                        }}
                    />
                ))}
            </Instances>

            {/* Stations (individual) */}
            {stations.map((station, index) => {
                const geo = getStationGeo(station.type, station.config);
                const mat = stationMat;
                const isSelected = gameState === 'EDITOR' && selectedObject === station;

                // Check if this object is placed on top of a surface
                let yPosition = 0;

                // Small objects (processors, sources, items) should check if they're on a surface
                const isSmallObject = ['processor', 'ingredient_source', 'item_source', 'trash'].includes(station.type);

                if (isSmallObject) {
                    // Check if there's a counter/table/serving at the same X/Z position
                    const hasSurfaceBelow = stations.some(other =>
                        (other.type === 'counter' || other.type === 'table' || other.type === 'serving') &&
                        Math.abs(other.position.x - station.position.x) < 0.1 &&
                        Math.abs(other.position.z - station.position.z) < 0.1 &&
                        other !== station
                    );

                    if (hasSurfaceBelow) {
                        yPosition = 0.9; // MODULE_HEIGHT - place on top of surface
                    }
                }

                return (
                    <group key={`${station.type}-${index}`}>
                        <mesh
                            position={[station.position.x, yPosition, station.position.z]}
                            rotation={[0, station.rotation || 0, 0]}
                            geometry={geo}
                            material={mat}
                            castShadow
                            receiveShadow
                            userData={{
                                layoutIndex: currentLevel?.layout.indexOf(station),
                                stationType: station.type,
                                ...station // Pass full config, type, name, etc.
                            }}
                        >
                            {!['counter', 'table', 'serving'].includes(station.type) && (
                                <LabelRenderer position={[0, 2, 0]} text={station.name || station.type} />
                            )}
                        </mesh>

                        {/* Selection Highlight */}
                        {isSelected && (
                            <mesh position={[station.position.x, yPosition + 0.5, station.position.z]}>
                                <boxGeometry args={[0.6, 1, 0.6]} />
                                <meshBasicMaterial color="#00ff00" wireframe transparent opacity={0.5} />
                            </mesh>
                        )}
                    </group>
                );
            })}
        </group>
    );
};
