import { useGameStore } from '../store/useGameStore';
import type { Entity, LevelObject } from '../types/GameTypes';
import { RecipeSystem } from './RecipeSystem';
import { v4 as uuidv4 } from 'uuid';
import { AudioSystem } from './AudioSystem';

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
        // Can pick up if hand is empty AND (there is an entity on target OR target is a preplaced item)
        return !heldEntity && (!!targetEntity || (target as any).type === 'preplaced_item');
    },
    execute: ({ targetEntity }) => {
        if (targetEntity) {
            // Pick up the entity
            useGameStore.getState().updateEntity(targetEntity.id, {
                heldBy: 'player',
                position: { x: 0, y: 0, z: 0 }
            });
            AudioSystem.play('pop');
        }
    }
};

const PlaceStrategy: InteractionStrategy = {
    canExecute: ({ heldEntity, target, targetEntity }) => {
        if (!heldEntity) return false;
        // Can place on Counter, Table, or empty Processor
        const type = (target as any).type;
        const isSurface = type === 'counter' || type === 'table' || type === 'processor' || type === 'serving';
        // Cannot place if something is already there
        return isSurface && !targetEntity;
    },
    execute: ({ heldEntity, target }) => {
        if (heldEntity) {
            const t = target as LevelObject;
            // Snap to center of target, Y=0.9 (counter height)
            useGameStore.getState().updateEntity(heldEntity.id, {
                heldBy: undefined,
                position: { x: t.position.x, y: 0.9, z: t.position.z },
                rotation: { x: 0, y: 0, z: 0 } // Reset rotation on place
            });
            AudioSystem.play('place');
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
                position: { x: 0, y: 0, z: 0 },
                rotation: { x: 0, y: 0, z: 0 },
                heldBy: 'player'
            };
            useGameStore.getState().addEntity(newEntity);
            AudioSystem.play('pop');
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
            useGameStore.getState().setTempMessage("Trashed item");
            AudioSystem.play('place'); // Or specific trash sound?
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
            // Or it could be a single item if the recipe allows (e.g. just a burger?)
            // Usually recipes are on plates.

            let ingredients: string[] = [];

            if (heldEntity.contents) {
                const entities = useGameStore.getState().entities;
                ingredients = heldEntity.contents.map(id => entities.find(e => e.id === id)?.type).filter(t => t) as string[];
            } else {
                // Maybe the item itself is the ingredient? (e.g. serving a raw apple?)
                ingredients = [heldEntity.type];
            }

            const recipe = RecipeSystem.validatePlate(ingredients);
            if (recipe) {
                // Check active orders
                const orders = useGameStore.getState().orders;
                const matchingOrder = orders.find(o => o.recipeName === recipe.name && o.status === 'active');

                if (matchingOrder) {
                    // Success
                    useGameStore.getState().addScore(recipe.baseScore + Math.floor(matchingOrder.duration)); // Bonus for speed
                    useGameStore.getState().removeOrder(matchingOrder.id);
                    useGameStore.getState().removeEntity(heldEntity.id);
                    // Cleanup contents
                    if (heldEntity.contents) {
                        heldEntity.contents.forEach(id => useGameStore.getState().removeEntity(id));
                    }
                    useGameStore.getState().setTempMessage(`Served ${recipe.name}!`);
                    AudioSystem.play('ding');
                } else {
                    // Wrong order penalty
                    useGameStore.getState().addScore(-10);
                    useGameStore.getState().setTempMessage("Wrong Order! -10");
                    AudioSystem.play('error');
                }
            } else {
                // Invalid recipe penalty
                useGameStore.getState().addScore(-5);
                useGameStore.getState().setTempMessage("Invalid Recipe! -5");
                AudioSystem.play('error');
            }
        }
    }
};

// Combine Strategy (Plate assembly)
const CombineStrategy: InteractionStrategy = {
    canExecute: ({ heldEntity, targetEntity }) => {
        if (!heldEntity) return false;

        // Case 1: Holding Ingredient, Target is Plate/Bowl (on counter)
        if (targetEntity && (targetEntity.type === 'plate' || targetEntity.type === 'bowl')) {
            return true;
        }
        // Case 2: Holding Plate/Bowl, Target is Ingredient (on counter)
        if ((heldEntity.type === 'plate' || heldEntity.type === 'bowl') && targetEntity) {
            // Prevent picking up another plate onto a plate
            if (targetEntity.type === 'plate' || targetEntity.type === 'bowl') return false;
            return true;
        }
        return false;
    },
    execute: ({ heldEntity, targetEntity }) => {
        let container = heldEntity!;
        let ingredient = targetEntity!;
        let isPickingUp = false;

        if (targetEntity?.type === 'plate' || targetEntity?.type === 'bowl') {
            // Putting ingredient onto plate
            container = targetEntity;
            ingredient = heldEntity!;
        } else {
            // Scooping ingredient with plate
            container = heldEntity!;
            ingredient = targetEntity!;
            isPickingUp = true;
        }

        // Add ingredient to container
        const currentContents = container.contents || [];
        useGameStore.getState().updateEntity(container.id, {
            contents: [...currentContents, ingredient.id]
        });

        // Update ingredient state
        useGameStore.getState().updateEntity(ingredient.id, {
            heldBy: container.id,
            position: { x: 0, y: 0, z: 0 } // Relative to container
        });

        // If we put ingredient DOWN onto a plate, we clear hand
        if (!isPickingUp) {
            // heldEntity was ingredient, now it's in plate. Hand is empty.
            // The updateEntity call above handles the logic (heldBy changed from player to container)
        }
        // If we scooped UP, we still hold the plate (container), so no change needed for player hand
        AudioSystem.play('pop');
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
            const time = t.config.processingTime || 3000; // Default 3s

            useGameStore.getState().updateEntity(heldEntity.id, { state: 'processing' });

            // Play sound based on processor type
            if (t.name.includes('Fryer') || t.name.includes('Stove')) AudioSystem.play('fry');
            else AudioSystem.play('chop');

            setTimeout(() => {
                // Check if entity is still there and processing
                const currentEntity = useGameStore.getState().entities.find(e => e.id === heldEntity.id);
                if (currentEntity && !currentEntity.heldBy && currentEntity.state === 'processing') {
                    useGameStore.getState().updateEntity(heldEntity.id, {
                        type: resultType,
                        state: 'processed'
                    });
                    AudioSystem.play('ding');
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

        if ((target as any).id) {
            // Target IS an entity (clicked directly on an item)
            targetEntity = target as Entity;
            // If we clicked an entity, what is the 'station' underneath? 
            // For strategies like Combine, we need to know we clicked an entity.
            // For strategies like Place, we need the station.

            // If we clicked an entity, we treat it as the target for Combine/Pickup.
            // But if we want to Place, we can't place ON an entity (unless combining).
        } else {
            // Target is LevelObject (Station)
            // Check if any entity is resting on this station
            const entities = useGameStore.getState().entities;
            targetEntity = entities.find(e =>
                !e.heldBy &&
                Math.abs(e.position.x - (target as LevelObject).position.x) < 0.2 &&
                Math.abs(e.position.z - (target as LevelObject).position.z) < 0.2
            );
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
