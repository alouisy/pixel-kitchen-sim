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
                    />
                ))}
            </Instances>

            {/* Render Stations individually since they have different geometries */}
            {stations.map((station, i) => {
                const geo = useMemo(() => getStationGeo(station.type, station.config), [station.type, station.config]);
                return (
                    <group key={i} position={[station.position.x, 0, station.position.z]} rotation={[0, station.rotation || 0, 0]}>
                        <mesh
                            geometry={geo}
                            castShadow
                            receiveShadow
                        >
                            <meshStandardMaterial vertexColors roughness={0.8} metalness={0.1} />
                        </mesh>
                        {!['counter', 'table', 'serving'].includes(station.type) && (
                            <LabelRenderer position={[0, 2, 0]} text={station.name || station.type} />
                        )}
                    </group>
                );
            })}
        </group>
    );
}
