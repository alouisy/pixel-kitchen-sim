// src/interaction.js
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { INTERACTION_DISTANCE, STATION_TYPES, ITEM_TYPES, INGREDIENT_STATES } from './constants.js';
import { createItem, checkPlateCompletion } from './items.js';
import { removeInteractable } from './world.js'; // To remove items from scene/list

export class InteractionManager {
    constructor(camera, scene, player, stations, interactables, levelManager, uiManager, preloadedModels) {
        this.camera = camera;
        this.scene = scene;
        this.player = player;
        this.stations = stations; // Reference to the stations object from world.js
        this.interactables = interactables; // Reference to the interactables array from world.js
        this.levelManager = levelManager; // Store reference
        this.uiManager = uiManager;
        this.preloadedModels = preloadedModels; // Store reference to preloaded models
        this.raycaster = new THREE.Raycaster();
    }

    handleInteractionRequest() {
        const target = this._findTarget();
        const heldItem = this.player.getHeldItem();

        if (heldItem) {
            // Try to place or process the item
            if (target && target.userData.type === 'station') {
                this._placeOrProcessItem(heldItem, target);
            } else {
                // Optional: Implement dropping item on floor
                console.log("Clicked empty space while holding item. Attempting safe drop.");
                // Player releases the item logically
                const droppedItem = this.player.place();
                if (droppedItem) {
                    this._dropItem(droppedItem, this.player.getPosition().clone().add(this.camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(1.0))); // Drop in front
                }
            }
        } else {
            // Try to pick up an item or use a station
            if (target) {
                if (target.userData.type === ITEM_TYPES.INGREDIENT || target.userData.type === ITEM_TYPES.ITEM) {
                    // Special check: Don't pick up items that are children of a plate on assembly
                    if (target.parent && target.parent.userData?.itemType === 'plate') {
                        console.log("Cannot pick up ingredient already on plate. Pick up the plate.");
                    } else {
                        this._pickupItem(target);
                    }
                } else if (target.userData.type === 'station') {
                    this._useStation(target);
                }
            }
        }
    }

    _findTarget() {
        this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera); // Center of screen
        const potentialTargets = this.interactables.filter(obj => obj !== this.player.getHeldItem()); // Don't target held item
        const intersects = this.raycaster.intersectObjects(potentialTargets, true); // Check children too (for complex models)

        // Find the closest valid intersectable object (not a child mesh unless it's the intended target)
        for (const intersect of intersects) {
            if (intersect.distance < INTERACTION_DISTANCE) {
                let object = intersect.object;
                // Traverse up to find the main interactable object if we hit a child mesh
                while (object.parent && !this.interactables.includes(object)) {
                    object = object.parent;
                }
                // Ensure the final object is interactable and not the held item
                if (this.interactables.includes(object) && object !== this.player.getHeldItem()) {
                    return object;
                }
            }
        }
        return null; // No target found
    }


    _pickupItem(item) {
        // Check if item is on a station and needs to be taken from there
        for (const stationName in this.stations) {
            const station = this.stations[stationName];
            if (station.userData.occupiedBy === item) {
                station.userData.occupiedBy = null; // Free up the station
                break;
            }
        }
        // Player handles the actual pickup logic
        if (this.player.pickup(item)) {
            // Optional: Add visual cue or sound
        } else {
            console.log("Cannot pick up item."); // Hands likely full
        }
    }

    _placeOrProcessItem(item, station) {
        // Player releases the item *before* we decide what to do with it
        const itemToPlace = this.player.place();
        if (!itemToPlace || itemToPlace !== item) {
            console.error("Mismatch between held item and item being placed.");
            // Attempt to recover - put item back in hand? Or just drop?
            if (itemToPlace) this._dropItem(itemToPlace, station.position); // Drop near station
            return;
        }

        console.log(`Trying to use ${item.name} on ${station.name}`);
        const stationData = station.userData;

        // --- Specific Station Logic ---
        switch (stationData.stationType) {
            case STATION_TYPES.PROCESSOR:
                this._handleProcessorStation(item, station);
                break;
            case STATION_TYPES.SERVING:
                this._handleServingStation(item, station);
                break;
            case STATION_TYPES.ASSEMBLY:
                this._handleAssemblyStation(item, station);
                break;
            // Add cases for other station types (e.g., trash)
            default:
                console.log(`Cannot place ${item.name} on ${station.name}. Invalid station type or action.`);
                // Item was already released by player.place(), drop it nearby.
                this._dropItem(item, station.position);
                break;
        }
    }

    _dropItem(item, nearPosition) {
        // Simple drop: place slightly above the ground near the target position
        const dropPos = nearPosition.clone();
        dropPos.y = 0.1; // Adjust Y to be just above floor
        // Add small random offset to prevent perfect stacking if dropped repeatedly
        dropPos.x += (Math.random() - 0.5) * 0.1;
        dropPos.z += (Math.random() - 0.5) * 0.1;

        item.position.copy(dropPos);
        item.rotation.set(0, Math.random() * Math.PI * 2, 0); // Random rotation on floor
        console.log(`Dropped ${item.name} near ${nearPosition.x.toFixed(1)}, ${nearPosition.z.toFixed(1)}`);
        // Ensure it's interactable again if it wasn't (e.g., if place failed mid-process)
        if (!this.interactables.includes(item)) {
            addInteractable(item);
        }
        // Re-enable raycasting if it was disabled
        if (item.userData.originalRaycast) {
            item.raycast = item.userData.originalRaycast;
            delete item.userData.originalRaycast;
        }
    }


    _handleProcessorStation(item, station) {
        const itemData = item.userData;
        const stationData = station.userData;

        if (stationData.occupiedBy) {
            console.log(`${station.name} is busy.`);
            this._dropItem(item, station.position); // Drop item nearby
            return;
        }

        // Determine the correct type to check against station's processes/results
        // Use the item's unique name for lookup consistency
        let processLookupType = item.name; // e.g., 'potato', 'raw_fries', 'patty'

        if (processLookupType && stationData.processes?.includes(processLookupType)) {
            console.log(`Placing ${item.name} on ${station.name} for processing.`);
            this._placeItemOnStation(item, station);
            stationData.occupiedBy = item;
            // Make item non-interactable while processing
            removeInteractable(item);

            if (stationData.processingTime) {
                item.visible = false; // Hide during timed processing
                console.log(`Processing ${item.name}...`);
                setTimeout(() => {
                    // Ensure the item is still the one processing before finishing
                    if (station.userData.occupiedBy === item) {
                        this._finishProcessing(item, station);
                    } else {
                        console.warn(`Processing finished for ${item.name}, but station ${station.name} is no longer occupied by it.`);
                    }
                }, stationData.processingTime);
            } else {
                // Immediate processing (like cutting)
                this._finishProcessing(item, station);
            }
        } else {
            console.log(`Cannot process ${item.name} (${processLookupType}) on ${station.name}.`);
            this._dropItem(item, station.position); // Drop item nearby
        }
    }

    _finishProcessing(processedItem, station) {
        const stationData = station.userData;

        // Determine the result based on the *original* item name used for lookup
        let resultLookupType = processedItem.name; // e.g., 'potato', 'raw_fries', 'patty'

        const resultType = stationData.result?.[resultLookupType];

        if (!resultType) {
            console.error(`Processing error: No result defined for ${resultLookupType} on ${station.name}`);
            processedItem.visible = true; // Make item visible again
            addInteractable(processedItem); // Make interactable again
            stationData.occupiedBy = processedItem; // Leave it on the station (or should it be dropped?)
            // Drop it instead? _dropItem(processedItem, station.position); stationData.occupiedBy = null;
            return;
        }

        console.log(`${processedItem.name} processed into ${resultType}`);
        const newItemPosition = processedItem.position.clone(); // Get position before removing original

        // Remove old item completely (was already removed from interactables)
        if (processedItem.parent) {
            processedItem.parent.remove(processedItem);
        }
        // Optionally dispose geometry/material here if needed

        // Create new item
        const newItem = createItem(this.scene, resultType, this.preloadedModels, undefined, newItemPosition);
        if (newItem) {
            stationData.occupiedBy = newItem; // Station now holds the result
            this._placeItemOnStation(newItem, station); // Position it correctly
            // newItem is added to interactables by createItem
        } else {
            console.error(`Failed to create result item: ${resultType}`);
            stationData.occupiedBy = null; // Processing failed to create item
        }
    }


    _handleServingStation(item, station) {
        const itemData = item.userData;

        // Check if it's a completed meal (mealName is set on the plate)
        if (itemData.itemType === 'plate' && itemData.mealName) {
            // --- Call LevelManager to complete order ---
            const success = this.levelManager.completeOrder(itemData.mealName);
            if (success) {
                console.log(`Successfully served ${itemData.mealName}!`);
                // Remove the plate *and its contents* from the world
                item.traverse((child) => {
                    // If children ingredients were added to the plate mesh, remove them too
                    if (child !== item && child.userData?.type === ITEM_TYPES.INGREDIENT) {
                        removeInteractable(child); // Remove from logic
                        // child.parent.remove(child); // Removed by plate removal below
                    }
                });
                removeInteractable(item); // Remove the plate itself from logic and scene
                this.uiManager.showTemporaryMessage("Order Served!", 1500);
            } else {
                // Order was wrong or not active - LevelManager handles logging
                this.uiManager.showTemporaryMessage("Wrong / No Order!", 1500);
                this._dropItem(item, station.position); // Drop the plate back
            }
            // --- End Call ---
        } else {
            console.log("This isn't a completed meal on a plate to serve.");
            this.uiManager.showTemporaryMessage("Not a Meal!", 1500);
            this._dropItem(item, station.position); // Drop the item
        }
    }

    _handleAssemblyStation(item, station) {
        const itemData = item.userData;
        const stationData = station.userData;

        // Placing an empty plate
        if (itemData.itemType === 'plate' && !stationData.occupiedBy) {
            console.log(`Placing ${item.name} on assembly area.`);
            this._placeItemOnStation(item, station);
            stationData.occupiedBy = item;
        }
        // Adding an ingredient to the plate on the station
        else if (stationData.occupiedBy?.userData.itemType === 'plate' && (itemData.type === ITEM_TYPES.INGREDIENT || itemData.type === ITEM_TYPES.ITEM /* like bun */)) {
            const plate = stationData.occupiedBy;
            const ingredientId = item.name; // Use the unique item name

            // Check if this specific ingredient is already on the plate
            if (plate.userData.contents.includes(ingredientId)) {
                console.log(`${ingredientId} is already on the plate.`);
                this.uiManager.showTemporaryMessage("Already Added!", 1000);
                this._dropItem(item, station.position); // Drop the duplicate item
                return; // Stop here
            }

            console.log(`Adding ${ingredientId} to the plate.`);
            plate.userData.contents.push(ingredientId); // Add to plate's contents

            // --- Visual Addition (Optional but recommended) ---
            // Make the ingredient a child of the plate mesh for easier management
            // Calculate offset based on number of items already on plate? Or random placement?
            const contentCount = plate.children.filter(c => c.userData?.type === ITEM_TYPES.INGREDIENT).length; // Count existing ingredient children
            const offsetX = (Math.random() - 0.5) * 0.1;
            const offsetZ = (Math.random() - 0.5) * 0.1;
            const offsetY = (plate.geometry.parameters.height / 2) + 0.01 + (contentCount * 0.02); // Stack slightly

            // Position relative to plate center BEFORE adding as child
            item.position.set(offsetX, offsetY, offsetZ);
            item.rotation.set(0, Math.random() * Math.PI * 2, 0); // Random rotation on plate
            plate.add(item); // Make it a child

            // IMPORTANT: Item is now physically part of the plate.
            // It should NOT be in the main 'interactables' list anymore,
            // as interaction should happen with the plate itself.
            removeInteractable(item);
            // Note: Raycasting against the plate will now hit the children too.
            // _findTarget logic might need adjustment if this causes issues. (Updated _findTarget above)
            // --- End Visual Addition ---


            // --- Check if plate is now a complete meal ---
            if (checkPlateCompletion(plate)) {
                this.uiManager.showTemporaryMessage(`${plate.userData.mealName} Ready!`, 1500);
            } else {
                this.uiManager.showTemporaryMessage("Ingredient Added", 1000);
            }
            // --- End Check ---

            // DO NOT REMOVE THE ITEM HERE - Handled by player.place() earlier
            // removeInteractable(item); // <<< REMOVED THIS LINE

        } else if (stationData.occupiedBy?.userData.itemType === 'plate') {
            console.log("Assembly: Cannot add this type of item to the plate.");
            this.uiManager.showTemporaryMessage("Cannot Add!", 1000);
            this._dropItem(item, station.position); // Drop item if invalid action
        }
        else {
            console.log("Assembly: Need to place an empty plate first, or add ingredients to an existing plate.");
            this.uiManager.showTemporaryMessage("Place Plate First!", 1000);
            this._dropItem(item, station.position); // Drop item if invalid action
        }
    }

    _useStation(station) {
        const stationData = station.userData;

        // 1. Source Stations
        if (stationData.stationType === STATION_TYPES.INGREDIENT_SOURCE || stationData.stationType === STATION_TYPES.ITEM_SOURCE) {
            if (this.player.getHeldItem()) { console.log("Hands full."); this.uiManager.showTemporaryMessage("Hands Full!", 1000); return; }
            const itemTypeToCreate = stationData.ingredient || stationData.item;
            if (!itemTypeToCreate) return;

            console.log(`Getting ${itemTypeToCreate}`);
            const newItem = createItem(this.scene, itemTypeToCreate, this.preloadedModels);
            if (newItem) {
                // Pick up immediately - player handles position update
                this.player.pickup(newItem);
            } else {
                console.error(`Failed to create item from source: ${itemTypeToCreate}`);
            }
        }
        // 2. Pickup from Occupied Stations (Processor, Assembly)
        else if ((stationData.stationType === STATION_TYPES.PROCESSOR || stationData.stationType === STATION_TYPES.ASSEMBLY) && stationData.occupiedBy) {
            if (this.player.getHeldItem()) { console.log("Hands full."); this.uiManager.showTemporaryMessage("Hands Full!", 1000); return; }

            const itemToPickup = stationData.occupiedBy;

            // Check if item is visible (relevant for timed processing)
            if (itemToPickup.visible === false) {
                console.log("Item is still processing.");
                this.uiManager.showTemporaryMessage("Still Processing...", 1000);
                return;
            }

            // Log pickup message
            if (itemToPickup.userData.itemType === 'plate' && itemToPickup.userData.mealName) {
                console.log(`Picking up completed ${itemToPickup.userData.mealName} plate.`);
            } else {
                console.log(`Picking up ${itemToPickup.name} from ${station.name}`);
            }

            stationData.occupiedBy = null; // Clear station first
            // If the item was on assembly and had children, they remain children.
            // Player pickup logic will handle positioning.
            this.player.pickup(itemToPickup); // Then pickup
        }
        else {
            console.log(`Used station ${station.name}, but no action defined or possible.`);
            // Provide feedback if station is empty or unusable in this state
            if (stationData.stationType === STATION_TYPES.PROCESSOR || stationData.stationType === STATION_TYPES.ASSEMBLY) {
                this.uiManager.showTemporaryMessage("Station Empty", 1000);
            }
        }
    }

    // Helper to position an item correctly on top of a station mesh
    _placeItemOnStation(item, station) {
        // Calculate heights more reliably using bounding boxes
        const stationBox = new THREE.Box3().setFromObject(station);
        const itemBox = new THREE.Box3().setFromObject(item);
        const stationHeight = stationBox.max.y - stationBox.min.y;
        const itemHeight = itemBox.max.y - itemBox.min.y;

        // Calculate target position
        const targetPos = new THREE.Vector3();
        stationBox.getCenter(targetPos); // Get center of the station's bounding box
        targetPos.y = stationBox.max.y + itemHeight / 2 + 0.01; // Place on top surface

        item.position.copy(targetPos);
        item.rotation.set(0, Math.random() * Math.PI * 2, 0); // Random rotation
    }
}