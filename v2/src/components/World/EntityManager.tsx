import React, { useMemo } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { VoxelFactory } from '../../utils/VoxelFactory';
import type { Entity } from '../../types/GameTypes';
import * as THREE from 'three';

export const EntityManager: React.FC = () => {
    const entities = useGameStore(state => state.entities);

    // Filter out items held by player (rendered by PlayerController)
    // Items held by stations (heldBy = stationID) should be rendered at station position?
    // Or we update their position in InteractionManager?
    // InteractionManager updates position when placing.
    // So we just render based on position.
    // But if heldBy is set, maybe we should attach to the parent object?
    // For now, we assume position is updated in world coordinates for station-held items.
    // Only player-held items are excluded.

    const worldEntities = entities.filter(e => {
        if (e.heldBy === 'player') return false;
        // If held by another entity (e.g. ingredient on plate), don't render at top level
        if (e.heldBy && entities.some(parent => parent.id === e.heldBy)) return false;
        return true;
    });

    return (
        <group>
            {worldEntities.map(entity => (
                <EntityMesh key={entity.id} entity={entity} />
            ))}
        </group>
    );
};

const EntityMesh: React.FC<{ entity: Entity }> = ({ entity }) => {
    const geometry = useMemo(() => VoxelFactory.createItem(entity.type), [entity.type]);

    // If it's a plate, we might need to render contents?
    // VoxelFactory.createItem('plate') just creates the plate.
    // Contents are separate entities?
    // In Interaction.ts, we added contents to `contents` array of plate.
    // But we also kept them in `entities` list?
    // "useGameStore.getState().updateEntity(ingredient.id, { heldBy: container.id ... })"
    // So ingredients are still in entities list, but heldBy = container.id.
    // So they are in `worldEntities` (since heldBy !== 'player').
    // But their position is {0,0,0} relative to container?
    // If we render them here at {0,0,0}, they will be at world origin if we don't parent them.
    // We need to parent them to the container or calculate world position.
    // R3F doesn't easily support dynamic parenting across the tree without portals.
    // Easier approach: Calculate world position for ingredients or just render them relative to container if we can find it.

    // Alternative: EntityManager renders containers. Container renders its contents.
    // So we filter out entities that are held by *another entity*.

    // Let's check if heldBy is another entity ID.
    // We need to know if heldBy is a station or entity.
    // Stations don't have IDs in the same pool usually, or we use names.
    // In Interaction.ts, we didn't set heldBy for stations, we just set position.
    // So heldBy is only used for Player or Containers.

    // So:
    // If heldBy is set and it's NOT 'player', it's likely a container.
    // So we should NOT render it at top level.
    // The Container should render it.

    // But wait, `EntityMesh` for container needs to render children.

    // Let's update the filter.

    return (
        <group position={[entity.position.x, entity.position.y, entity.position.z]} rotation={[entity.rotation.x, entity.rotation.y, entity.rotation.z]}>
            <mesh geometry={geometry} castShadow receiveShadow>
                <meshStandardMaterial vertexColors roughness={0.8} metalness={0.1} />
            </mesh>
            {/* Render Contents if any */}
            {entity.contents && <EntityContents contentIds={entity.contents} />}

            {/* UserData for Raycasting */}
            <primitive object={new THREE.Group()} userData={{ entityId: entity.id, type: 'entity' }} />
            {/* Actually attach userData to the mesh or group */}
        </group>
    );
};

const EntityContents: React.FC<{ contentIds: string[] }> = ({ contentIds }) => {
    const allEntities = useGameStore(state => state.entities);
    const contents = contentIds.map(id => allEntities.find(e => e.id === id)).filter(e => e) as Entity[];

    return (
        <group>
            {contents.map((item, i) => (
                <group key={item.id} position={[0, 0.1 + (i * 0.05), 0]}>
                    {/* Stack them slightly? or randomize? */}
                    <EntityMesh entity={item} />
                </group>
            ))}
        </group>
    );
};
