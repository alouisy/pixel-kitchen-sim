import { useGameStore } from '../store/useGameStore';
import type { Entity, LevelObject } from '../types/GameTypes';
import { RecipeSystem } from './RecipeSystem';
import { v4 as uuidv4 } from 'uuid';

interface InteractionContext {
    heldEntity: Entity | null;
    target: LevelObject | Entity;
    targetEntity?: Entity | null; // If target is a station, this is the item on it
}

interface InteractionStrategy {
    canExecute: (ctx: InteractionContext) => boolean;
    execute: (ctx: InteractionContext) => void;
}

const PickupStrategy: InteractionStrategy = {
    canExecute: ({ heldEntity, target, targetEntity }) => {
        return !heldEntity && (!!targetEntity || (target as any).type === 'preplaced_item');
    },
    execute: ({ targetEntity }) => {
        if (targetEntity) {
            useGameStore.getState().updateEntity(targetEntity.id, { heldBy: 'player', position: { x: 0, y: 0, z: 0 } });
        }
    }
};

const PlaceStrategy: InteractionStrategy = {
    canExecute: ({ heldEntity, target, targetEntity }) => {
        if (!heldEntity) return false;
        // Can place on Counter, Table, or empty Processor
        const type = (target as any).type; // StationType or Entity type
        const isSurface = type === 'counter' || type === 'table' || type === 'processor';
        return isSurface && !targetEntity;
    },
    execute: ({ heldEntity, target }) => {
        if (heldEntity) {
            // Snap to center of target
            const pos = (target as LevelObject).position;
            // If target is a LevelObject, it has x, z. y is usually counter height.
            // We need to know the height.
            // For now assume counter height 0.9
            useGameStore.getState().updateEntity(heldEntity.id, {
                heldBy: undefined,
                position: { x: pos.x, y: 0.9, z: pos.z }
            });
        }
    }
};

const SpawnStrategy: InteractionStrategy = {
    canExecute: ({ heldEntity, target }) => {
        return !heldEntity && ((target as any).type === 'ingredient_source' || (target as any).type === 'item_source');
    },
    execute: ({ target }) => {
        const t = target as LevelObject;
        const itemType = t.config?.ingredient || t.config?.item;
        if (itemType) {
            const newEntity: Entity = {
                id: uuidv4(),
                type: itemType,
                position: { x: 0, y: 0, z: 0 }, // Will be attached to player
                rotation: { x: 0, y: 0, z: 0 },
                heldBy: 'player'
            };
            useGameStore.getState().addEntity(newEntity);
        }
    }
};

const TrashStrategy: InteractionStrategy = {
    canExecute: ({ heldEntity, target }) => {
        return !!heldEntity && (target as any).type === 'trash';
    },
    execute: ({ heldEntity }) => {
        if (heldEntity) {
            useGameStore.getState().removeEntity(heldEntity.id);
        }
    }
};

const ServeStrategy: InteractionStrategy = {
    canExecute: ({ heldEntity, target }) => {
        return !!heldEntity && (target as any).type === 'serving';
    },
    execute: ({ heldEntity }) => {
        if (heldEntity) {
            // Validate Recipe
            // Assume heldEntity is a plate with contents
            if (heldEntity.contents) {
                // Get types of contents
                const entities = useGameStore.getState().entities;
                const ingredients = heldEntity.contents.map(id => entities.find(e => e.id === id)?.type).filter(t => t) as string[];

                const recipe = RecipeSystem.validatePlate(ingredients);
                if (recipe) {
                    // Check active orders
                    const orders = useGameStore.getState().orders;
                    const matchingOrder = orders.find(o => o.recipeName === recipe.name && o.status === 'active');

                    if (matchingOrder) {
                        // Success
                        useGameStore.getState().addScore(recipe.baseScore);
                        useGameStore.getState().removeOrder(matchingOrder.id);
                        useGameStore.getState().removeEntity(heldEntity.id);
                        // Cleanup contents
                        if (heldEntity.contents) {
                            heldEntity.contents.forEach(id => useGameStore.getState().removeEntity(id));
                        }
                        useGameStore.getState().setTempMessage(`Served ${recipe.name}! +${recipe.baseScore}`);
                    } else {
                        // Wrong order penalty
                        useGameStore.getState().addScore(-10);
                        useGameStore.getState().setTempMessage("Wrong Order! -10");
                    }
                } else {
                    // Invalid recipe penalty
                    useGameStore.getState().addScore(-5);
                    useGameStore.getState().setTempMessage("Invalid Recipe! -5");
                }
            }
            // If not a plate or empty, maybe just fail or nothing?
        }
    }
};

// Combine Strategy (Plate assembly)
const CombineStrategy: InteractionStrategy = {
    canExecute: ({ heldEntity, targetEntity }) => {
        if (!heldEntity) return false;
        // Case 1: Holding Ingredient, Target is Plate (on counter)
        if (targetEntity && (targetEntity.type === 'plate' || targetEntity.type === 'bowl')) {
            return true; // Add ingredient to plate
        }
        // Case 2: Holding Plate, Target is Ingredient (on counter)
        if ((heldEntity.type === 'plate' || heldEntity.type === 'bowl') && targetEntity) {
            return true; // Pick up ingredient onto plate
        }
        return false;
    },
    execute: ({ heldEntity, targetEntity }) => {
        // Logic for combining
        // We need to know which is container and which is ingredient
        let container = heldEntity!;
        let ingredient = targetEntity!;

        if (targetEntity?.type === 'plate' || targetEntity?.type === 'bowl') {
            container = targetEntity;
            ingredient = heldEntity!;
        }

        // Add ingredient to container
        const currentContents = container.contents || [];
        useGameStore.getState().updateEntity(container.id, {
            contents: [...currentContents, ingredient.id]
        });

        // Hide ingredient or attach it to container visually
        // We'll set heldBy to container ID? Or just remove from world and keep in contents list?
        // If we remove from entities list, we lose its data.
        // Better to keep it but set heldBy to container.
        useGameStore.getState().updateEntity(ingredient.id, {
            heldBy: container.id,
            position: { x: 0, y: 0, z: 0 } // Relative to container
        });

        // If we were holding the ingredient, we are now holding nothing (if we put it on a plate on counter)
        if (heldEntity === ingredient) {
            // We placed it.
            // heldEntity is now null (handled by updateEntity heldBy change)
        }
    }
};

// Process Strategy (Chopping, Frying)
const ProcessStrategy: InteractionStrategy = {
    canExecute: ({ heldEntity, target, targetEntity }) => {
        if (!heldEntity) return false;
        if ((target as any).type !== 'processor') return false;
        if (targetEntity) return false; // Processor occupied

        // Check if processor supports this ingredient
        const config = (target as LevelObject).config;
        if (!config || !config.processes) return false;
        return config.processes.includes(heldEntity.type);
    },
    execute: ({ heldEntity, target }) => {
        if (heldEntity) {
            const t = target as LevelObject;
            // Place on processor
            useGameStore.getState().updateEntity(heldEntity.id, {
                heldBy: undefined,
                position: { x: t.position.x, y: 0.9, z: t.position.z }
            });

            // Start processing logic
            const resultType = t.config.result[heldEntity.type];
            const time = t.config.processingTime || 0;

            // We should store 'processingStart' on the entity to resume if game reloads
            // For now, setTimeout is okay for prototype but bad for ECS.
            // Better: Set state='processing' and let a System handle it?
            // Let's stick to setTimeout for simplicity in this refactor phase, 
            // but ensure we update state to 'processing' so UI can show progress if needed.

            useGameStore.getState().updateEntity(heldEntity.id, { state: 'processing' });

            setTimeout(() => {
                // Check if entity is still there and processing (hasn't been picked up)
                const currentEntity = useGameStore.getState().entities.find(e => e.id === heldEntity.id);
                if (currentEntity && !currentEntity.heldBy && currentEntity.state === 'processing') {
                    useGameStore.getState().updateEntity(heldEntity.id, {
                        type: resultType,
                        state: 'processed' // or 'cooked', 'chopped'
                    });
                }
            }, time);
        }
    }
};


const strategies = [
    TrashStrategy,
    ServeStrategy,
    CombineStrategy,
    ProcessStrategy,
    PickupStrategy,
    PlaceStrategy,
    SpawnStrategy
];

export const InteractionManager = {
    handleInteraction: (heldEntity: Entity | null, target: LevelObject | Entity) => {
        // Find if there is an entity on the target (if target is a station)
        let targetEntity: Entity | null | undefined = undefined;

        if ((target as any).position) { // It's a LevelObject or Entity
            // const pos = (target as any).position; // LevelObject has x,z. Entity has x,y,z.
            // Find entity at this position (approx)
            // This is expensive to do here. Ideally Raycaster gives us the Entity directly if we hit it.
            // If we hit a Station, we check if any entity is resting on it.

            // If 'target' passed in IS an Entity, then targetEntity is that entity.
            if ((target as any).id) {
                targetEntity = target as Entity;
                // But wait, if we clicked an Entity, what is the 'target'?
                // The Raycaster hits objects.
                // If we hit a Station Mesh, target is LevelObject.
                // If we hit an Item Mesh, target is Entity.
            } else {
                // Target is LevelObject (Station)
                // Check if any entity is heldBy this station? 
                // Entities on stations usually have heldBy = undefined but position = station position.
                // Or we can introduce 'heldBy: stationID' concept?
                // For now, let's check position overlap.
                const entities = useGameStore.getState().entities;
                targetEntity = entities.find(e =>
                    !e.heldBy &&
                    Math.abs(e.position.x - (target as LevelObject).position.x) < 0.1 &&
                    Math.abs(e.position.z - (target as LevelObject).position.z) < 0.1
                );
            }
        }

        const ctx: InteractionContext = { heldEntity, target, targetEntity };

        for (const strategy of strategies) {
            if (strategy.canExecute(ctx)) {
                strategy.execute(ctx);
                return;
            }
        }
    }
};
