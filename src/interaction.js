// src/interaction.js
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { gsap } from 'gsap';
import { INTERACTION_DISTANCE, STATION_TYPES, ITEM_TYPES } from './constants.js';
import { createItem, checkPlateCompletion } from './items.js';
import { getAssemblySlotIndex } from './world.js'; // Only need this helper now

export class InteractionManager {
    constructor(camera, scene, player, stations, stationInteractables, levelManager, uiManager, preloadedModels, floorMesh) {
        this.camera = camera;
        this.scene = scene;
        this.player = player;
        this.stations = stations; // Object mapping station names to meshes
        this.interactables = stationInteractables ? [...stationInteractables] : []; // Starts with stations, dynamic items added/removed
        this.levelManager = levelManager;
        this.uiManager = uiManager;
        this.preloadedModels = preloadedModels;
        this.floorMesh = floorMesh;
        this.raycaster = new THREE.Raycaster();
    }

    // Method to update world references when a new level is built
    updateWorldData(newStations, newStationInteractables, newFloorMesh) {
        console.log("InteractionManager updating world data...");
        this.stations = newStations || {};
        this.interactables = newStationInteractables ? [...newStationInteractables] : [];
        this.floorMesh = newFloorMesh;
        console.log("Stations refs updated:", Object.keys(this.stations));
        console.log("Initial Interactables for level:", this.interactables.map(i => i.name));
    }

    // Method to clear dynamic items (called by main.js resetWorldState)
    clearDynamicItems() {
        console.log("InteractionManager clearing dynamic items...");
        if (!this.interactables) return;
        let removedCount = 0;
        for (let i = this.interactables.length - 1; i >= 0; i--) {
            const item = this.interactables[i];
            // Check if it's a dynamic item (not a station or counter)
            if (item.userData && (item.userData.type === ITEM_TYPES.ITEM || item.userData.type === ITEM_TYPES.INGREDIENT)) {
                if (item.parent) item.parent.remove(item); // Remove from scene
                this.interactables.splice(i, 1); // Remove from list
                removedCount++;
            }
        }
        console.log(`Dynamic items cleared: ${removedCount}. Remaining interactables: ${this.interactables.length}`);
    }

    // Helper to add dynamic items to THIS instance's list
    _addDynamicInteractable(item) {
        if (item && !this.interactables.includes(item)) {
            // Avoid adding stations/counters/floor
            if (item.userData?.type !== 'station' && item.userData?.stationType !== STATION_TYPES.COUNTER && item.userData?.type !== STATION_TYPES.FLOOR) {
                this.interactables.push(item);
            }
        }
    }

    // Helper to remove dynamic items from THIS instance's list and scene
    _removeDynamicInteractable(item) {
        if (!item) return;
        const index = this.interactables.indexOf(item);
        if (index > -1) {
            this.interactables.splice(index, 1);
        }
        if (item.parent) {
            item.parent.remove(item);
        }
    }

    _animateMealCompletion(plate) {
        if (!plate || !plate.parent) return;
        const originalScale = plate.scale.clone();
        const targetScale = originalScale.clone().multiplyScalar(1.15);
        gsap.timeline()
            .to(plate.scale, { x: targetScale.x, y: targetScale.y, z: targetScale.z, duration: 0.15, ease: "power1.out" })
            .to(plate.scale, { x: originalScale.x, y: originalScale.y, z: originalScale.z, duration: 0.25, ease: "elastic.out(1, 0.5)" });
    }

    handleInteractionRequest() {
        const targetInfo = this._findTarget();
        const heldItem = this.player.getHeldItem();

        if (heldItem) { // Player is holding something
            if (targetInfo) { // Player is looking at something interactable
                const targetObject = targetInfo.object;
                const targetPoint = targetInfo.point;

                // Route based on the *type* of the target object
                if (targetObject.userData?.type === 'station') {
                    // Pass the specific station hit
                    this._placeOrProcessItem(heldItem, targetObject, targetPoint);
                }
                // Check if target is an ITEM (plate, bowl, cup) currently in an assembly slot or on a processor (mixer/blender)
                else if (targetObject.userData?.type === ITEM_TYPES.ITEM &&
                    (this.stations.assembly?.userData?.slots?.includes(targetObject) || // On assembly
                        (this.stations.robotMixer && this.stations.robotMixer.userData?.occupiedBy === targetObject) || // On Mixer
                        (this.stations.blender && this.stations.blender.userData?.occupiedBy === targetObject)) // On Blender
                ) {
                    // The target is the container item itself (plate, bowl, cup)
                    console.log(`Attempting to place ${heldItem.name} onto container ${targetObject.name}`);
                    this._handleContainerPlacement(heldItem, targetObject, targetPoint); // Use specific handler
                }
                else if (targetObject === this.floorMesh) {
                    const droppedItem = this.player.place();
                    if (droppedItem) this._dropItem(droppedItem, targetPoint);
                }
                else { // Clicked something else
                    const droppedItem = this.player.place();
                    if (droppedItem) this._dropItem(droppedItem, targetPoint || this.player.getPosition().clone().add(this.camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(1.0)));
                }
            } else { // Clicked empty space while holding
                const droppedItem = this.player.place();
                if (droppedItem) this._dropItem(droppedItem, this.player.getPosition().clone().add(this.camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(1.0)));
            }
        } else { // Player is not holding anything
            if (targetInfo) {
                const targetObject = targetInfo.object;
                if (targetObject.userData?.type === ITEM_TYPES.INGREDIENT || targetObject.userData?.type === ITEM_TYPES.ITEM) {
                    // Prevent picking up ingredients attached to plates/bowls/cups
                    if (targetObject.parent && targetObject.parent.userData?.itemType && ['plate', 'bowl', 'mixing_bowl', 'cup'].includes(targetObject.parent.userData.itemType)) {
                        this.uiManager.showTemporaryMessage("Pick up Container", 1000); // Adjust message key
                    } else {
                        this._pickupItem(targetObject);
                    }
                }
                else if (targetObject.userData?.type === 'station') {
                    this._useStation(targetObject, targetInfo.point);
                }
            }
        }
    }

    _findTarget() {
        this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
        const objectsToCheck = [...this.interactables];
        if (this.floorMesh) objectsToCheck.push(this.floorMesh);

        const intersects = this.raycaster.intersectObjects(objectsToCheck, true);

        let closestInteractable = null;
        let closestDistance = INTERACTION_DISTANCE;
        let hitPoint = null;

        for (const intersect of intersects) {
            if (intersect.distance > closestDistance) continue;
            let object = intersect.object;
            // Traverse up to find the object that's in our interactables list or the floor
            while (object.parent && !this.interactables.includes(object) && object !== this.floorMesh && object !== this.scene) {
                if (this.interactables.includes(object.parent)) { object = object.parent; break; }
                object = object.parent;
            }
            const isValidTarget = this.interactables.includes(object) || object === this.floorMesh;
            if (isValidTarget && object !== this.player.getHeldItem()) {
                // Prioritize container over its ingredient children
                if (object.userData?.type === ITEM_TYPES.INGREDIENT && object.parent?.userData?.itemType && ['plate', 'bowl', 'mixing_bowl', 'cup'].includes(object.parent.userData.itemType) && this.interactables.includes(object.parent)) {
                    object = object.parent;
                }
                if (intersect.distance <= INTERACTION_DISTANCE) {
                    if (object === this.floorMesh && !this.player.getHeldItem()) continue;
                    closestInteractable = object;
                    closestDistance = intersect.distance;
                    hitPoint = intersect.point;
                }
            }
        }
        return closestInteractable ? { object: closestInteractable, point: hitPoint } : null;
    }

    _pickupItem(item) {
        let removedFromStation = false;
        let stationNameFound = null; // Track which station it was on
        let slotIndex = -1;

        // Check processor stations
        for (const name in this.stations) {
            const station = this.stations[name];
            if (station.userData?.stationType === STATION_TYPES.PROCESSOR && station.userData.occupiedBy === item) {
                station.userData.occupiedBy = null; removedFromStation = true; stationNameFound = name; break;
            }
        }
        // Check assembly slots only if not found on processor
        if (!removedFromStation) {
            const assemblyStation = this.stations.assembly;
            if (assemblyStation && Array.isArray(assemblyStation.userData.slots)) {
                slotIndex = assemblyStation.userData.slots.indexOf(item);
                if (slotIndex > -1) { assemblyStation.userData.slots[slotIndex] = null; removedFromStation = true; stationNameFound = 'assembly'; }
            }
        }

        // Remove from internal interactables list BEFORE player pickup attempt
        this._removeDynamicInteractable(item);

        if (this.player.pickup(item)) { /* Success */ }
        else { // Pickup failed
            console.log("Cannot pick up item.");
            this.uiManager.showTemporaryMessage("Hands Full!", 1000);
            // Add back to list and potentially station
            this._addDynamicInteractable(item);
            if (removedFromStation && stationNameFound) {
                if (stationNameFound === 'assembly' && slotIndex > -1) {
                    this.stations.assembly.userData.slots[slotIndex] = item; // Put back in slot
                } else if (this.stations[stationNameFound]?.userData?.stationType === STATION_TYPES.PROCESSOR) {
                    this.stations[stationNameFound].userData.occupiedBy = item; // Put back on processor
                }
            }
        }
    }

    // Main router for placing/using an item ON a station
    _placeOrProcessItem(item, station, targetPoint, targetItemOnStation = null) {
        const itemToPlace = this.player.place();
        if (!itemToPlace || itemToPlace !== item) {
            console.error("Mismatch placing item.");
            if (itemToPlace) this._dropItem(itemToPlace, station.position); return;
        }
        const stationData = station.userData;

        switch (stationData.stationType) {
            case STATION_TYPES.ASSEMBLY:
                this._handleAssemblyPlacement(itemToPlace, station, targetPoint, targetItemOnStation);
                break;
            case STATION_TYPES.PROCESSOR:
                // Handle specific processors like Mixer/Blender differently if needed,
                // otherwise use the generic processor logic.
                if (station.name === 'robotMixer' || station.name === 'blender') {
                    // Placing an empty bowl/cup onto the mixer/blender
                    if ((itemToPlace.userData?.itemType === 'mixing_bowl' || itemToPlace.userData?.itemType === 'cup') && !stationData.occupiedBy) {
                        this._placeItemOnStationVisual(itemToPlace, station);
                        stationData.occupiedBy = itemToPlace;
                        this._addDynamicInteractable(itemToPlace); // Bowl/Cup on station is interactable
                        this.uiManager.showTemporaryMessage("Container Placed", 1000);
                    } else if (stationData.occupiedBy) {
                        this.uiManager.showTemporaryMessage("Station Busy", 1000);
                        this._dropItem(itemToPlace, station.position); // Drop item if station busy
                    } else {
                        this.uiManager.showTemporaryMessage("Place Correct Container", 1000);
                        this._dropItem(itemToPlace, station.position); // Drop if wrong item type
                    }
                } else {
                    // Generic processor logic (Grill, Fryer, Oven, Toaster, etc.)
                    this._handleProcessorStation(itemToPlace, station);
                }
                break;
            case STATION_TYPES.SERVING:
                this._handleServingStation(itemToPlace, station, targetPoint);
                break;
            default: // Includes COUNTER type if targeted directly
                console.log(`Cannot perform specific action with ${item.name} on ${station.name}. Placing on surface.`);
                this._placeItemOnSurfaceVisual(itemToPlace, station, targetPoint);
                this._addDynamicInteractable(itemToPlace);
                break;
        }
    }

    // Handles placing items ONTO containers (plates, bowls, cups)
    _handleContainerPlacement(item, container, targetPoint) {
        const itemToPlace = this.player.place(); // Player releases item
        if (!itemToPlace || itemToPlace !== item) { console.error("Mismatch placing onto container."); if (itemToPlace) this._dropItem(itemToPlace, container.position); return; }

        const containerData = container.userData;
        const itemData = itemToPlace.userData;

        // Check if placing a valid ingredient onto a valid container
        if (itemData.type === ITEM_TYPES.INGREDIENT && ['plate', 'bowl', 'mixing_bowl', 'cup'].includes(containerData.itemType)) {
            const ingredientId = itemToPlace.name;

            // Initialize contents if needed
            if (!Array.isArray(containerData.contents)) containerData.contents = [];

            // Prevent duplicates (optional, based on recipe needs)
            if (containerData.contents.includes(ingredientId)) {
                this.uiManager.showTemporaryMessage("Already Added!", 1000);
                this._dropItem(itemToPlace, container.position); return;
            }

            console.log(`Adding ${ingredientId} to container ${container.name} (${containerData.itemType})`);
            containerData.contents.push(ingredientId);

            // Visual Addition (make item child of container)
            const contentCount = container.children.length;
            const containerBox = new THREE.Box3().setFromObject(container);
            const itemBox = new THREE.Box3().setFromObject(itemToPlace);
            const itemHeight = itemBox.max.y - itemBox.min.y;
            const containerHeight = containerBox.max.y - containerBox.min.y;
            // Position relative to container center, stack slightly
            const offsetY = containerHeight / 2 + itemHeight / 2 + (contentCount * 0.01) - (containerHeight * 0.3); // Adjust Y offset inside container
            const offsetX = (Math.random() - 0.5) * 0.05 * containerBox.getSize(new THREE.Vector3()).x; // Offset based on container size
            const offsetZ = (Math.random() - 0.5) * 0.05 * containerBox.getSize(new THREE.Vector3()).z;
            itemToPlace.position.set(offsetX, offsetY, offsetZ);
            itemToPlace.rotation.set(0, Math.random() * Math.PI * 2, 0);
            container.add(itemToPlace); // Add as child

            // Check if container is now a complete meal (plate/bowl) or ready for processing (mixing_bowl/cup)
            if (containerData.itemType === 'plate' || containerData.itemType === 'bowl') {
                if (checkPlateCompletion(container)) { // Use same check function
                    this.uiManager.showTemporaryMessage(`${containerData.mealName} Ready!`, 1500);
                    this._animateMealCompletion(container);
                } else { this.uiManager.showTemporaryMessage("Ingredient Added", 1000); }
            } else if (containerData.itemType === 'mixing_bowl' || containerData.itemType === 'cup') {
                // Check if contents match a "ready to process" state defined implicitly by station processes
                // Example: Check if bowl contents match what mixer expects
                // This logic might need refinement - maybe add a 'readyToProcess' flag?
                this.uiManager.showTemporaryMessage("Ingredient Added to Container", 1000);
                // TODO: Potentially update container name/state if ready for mixer/blender
                // e.g., if bowl has pancake ingredients, maybe rename bowl to 'mixing_bowl_pancake'
                // This requires checking against station process inputs.
            }

        } else {
            console.log(`Cannot place ${itemToPlace.name} onto ${container.name}.`);
            this.uiManager.showTemporaryMessage("Cannot Add!", 1000);
            this._dropItem(itemToPlace, container.position); // Drop if invalid placement
        }
    }


    // Handles placing items directly into Assembly Station slots
    _handleAssemblyPlacement(item, station, targetPoint, targetItemOnStation) {
        // This function is now ONLY for placing items DIRECTLY into slots,
        // as placing onto containers is handled by _handleContainerPlacement
        if (targetItemOnStation) { // Tried to place onto something already in a slot?
            console.log("Cannot place directly onto item in slot. Aim for empty slot or container.");
            this.uiManager.showTemporaryMessage("Aim for Slot/Container", 1500);
            this._dropItem(item, station.position); // Drop near station
            return;
        }

        const stationData = station.userData;
        const slotIndex = getAssemblySlotIndex(station, targetPoint.x);

        if (stationData.slots[slotIndex] === null) {
            stationData.slots[slotIndex] = item;
            const slotPosition = stationData.slotPositions[slotIndex];
            const itemBox = new THREE.Box3().setFromObject(item);
            const itemHeight = itemBox.max.y - itemBox.min.y;
            item.position.copy(slotPosition);
            item.position.y += itemHeight / 2 + 0.005;
            item.rotation.set(0, Math.random() * Math.PI * 2, 0);
            this._addDynamicInteractable(item); // Item in slot IS interactable
            this.scene.add(item);
            this.uiManager.showTemporaryMessage("Item Placed", 1000);
        } else {
            this.uiManager.showTemporaryMessage("Slot Full!", 1000);
            this._dropItem(item, station.position);
        }
    }


    _dropItem(item, nearPosition) {
        const dropPos = nearPosition.clone();
        const itemBox = new THREE.Box3().setFromObject(item);
        const itemHeight = itemBox.max.y - itemBox.min.y;
        dropPos.y = Math.max(itemHeight / 2 + 0.01, 0.01);
        dropPos.x += (Math.random() - 0.5) * 0.1;
        dropPos.z += (Math.random() - 0.5) * 0.1;
        item.position.copy(dropPos);
        item.rotation.set(0, Math.random() * Math.PI * 2, 0);
        this._addDynamicInteractable(item); // Dropped item is interactable
        this.scene.add(item);
        if (item.userData.originalRaycast) { item.raycast = item.userData.originalRaycast; delete item.userData.originalRaycast; }
    }

    // Handles generic processors (Grill, Fryer, Oven, Toaster, DoughPress, CoatingProcessor)
    _handleProcessorStation(item, station) {
        const stationData = station.userData;
        if (stationData.occupiedBy) { this.uiManager.showTemporaryMessage("Station Busy", 1000); this._dropItem(item, station.position); return; }

        let processLookupType = item.name; // Use the item's current name/state

        // Check if this station can process this item
        if (processLookupType && stationData.processes?.includes(processLookupType)) {
            this._placeItemOnStationVisual(item, station);
            stationData.occupiedBy = item;
            // Item remains interactable initially, might be removed during timed process

            if (stationData.processingTime) {
                item.visible = false;
                this._removeDynamicInteractable(item); // Make non-interactable during timed process
                console.log(`Processing ${item.name} for ${stationData.processingTime}ms...`);
                setTimeout(() => {
                    // Check if item is still the one processing
                    if (station.userData.occupiedBy === item) {
                        this._finishProcessing(item, station);
                    } else {
                        console.warn(`Processing finished for ${item.name}, but station ${station.name} no longer holds it.`);
                        // Ensure original item mesh is gone if state changed unexpectedly
                        if (item.parent) item.parent.remove(item);
                    }
                }, stationData.processingTime);
            } else { // Immediate processing
                this._finishProcessing(item, station);
            }
        } else {
            console.log(`Cannot process ${item.name} (${processLookupType}) on ${station.name}.`);
            this.uiManager.showTemporaryMessage("Cannot Process", 1000);
            this._dropItem(item, station.position);
        }
    }

    _finishProcessing(processedItem, station) {
        const stationData = station.userData;
        let resultLookupType = processedItem.name; // The name of the item that *went in*
        const resultType = stationData.result?.[resultLookupType]; // Get the name of the item that *comes out*

        const newItemPosition = new THREE.Vector3();
        // Get position from the processedItem *before* removing it,
        // but ensure visibility is restored if it was hidden for timed processing
        processedItem.visible = true;
        processedItem.getWorldPosition(newItemPosition);

        // Remove original item completely (from list and scene)
        this._removeDynamicInteractable(processedItem);

        if (!resultType) {
            console.error(`Processing error on ${station.name}: No result defined for input "${resultLookupType}"`);
            stationData.occupiedBy = null; // Clear station
            return;
        }

        console.log(`${resultLookupType} processed into ${resultType} on ${station.name}`);
        const newItem = createItem(this.scene, resultType, this.preloadedModels, undefined, newItemPosition);

        if (newItem) {
            stationData.occupiedBy = newItem; // Station now holds the result
            this._placeItemOnStationVisual(newItem, station); // Position it
            this._addDynamicInteractable(newItem); // Make the NEW item interactable
        } else {
            console.error(`Failed to create result item: ${resultType}`);
            stationData.occupiedBy = null; // Clear station if item creation failed
        }
    }

    _handleServingStation(item, station, targetPoint) {
        const itemData = item.userData;
        if (itemData.itemType === 'plate' && itemData.mealName) { // Can also serve bowls? Add check if needed: || itemData.itemType === 'bowl'
            const success = this.levelManager.completeOrder(itemData.mealName);
            if (success) {
                this._removeDynamicInteractable(item); // Removes item and children
                this.uiManager.showTemporaryMessage("Order Served!", 1500);
            } else {
                this.uiManager.showTemporaryMessage("Wrong / No Order!", 1500);
                this._placeItemOnSurfaceVisual(item, station, targetPoint);
                this._addDynamicInteractable(item);
            }
        } else {
            this.uiManager.showTemporaryMessage("Not a Meal!", 1500);
            this._placeItemOnSurfaceVisual(item, station, targetPoint);
            this._addDynamicInteractable(item);
        }
    }

    // Handles interacting with a station while NOT holding an item
    _useStation(station, hitPoint) {
        const stationData = station.userData;
        if (this.player.getHeldItem()) { this.uiManager.showTemporaryMessage("Hands Full!", 1000); return; }

        switch (stationData.stationType) {
            // 1. Source Stations
            case STATION_TYPES.INGREDIENT_SOURCE:
            case STATION_TYPES.ITEM_SOURCE:
                const itemTypeToCreate = stationData.ingredient || stationData.item;
                if (!itemTypeToCreate) return;
                const newItem = createItem(this.scene, itemTypeToCreate, this.preloadedModels);
                if (newItem) {
                    this._addDynamicInteractable(newItem);
                    this._pickupItem(newItem); // Immediately pick up
                } else console.error(`Failed to create item from source: ${itemTypeToCreate}`);
                break;

            // 2. Pickup from Processor (generic) / Mixer / Blender
            case STATION_TYPES.PROCESSOR:
                const itemToPickup = stationData.occupiedBy;
                if (itemToPickup) {
                    if (itemToPickup.visible === false) { // Check for timed processing
                        this.uiManager.showTemporaryMessage("Still Processing...", 1000); return;
                    }
                    stationData.occupiedBy = null; // Clear station first
                    this._pickupItem(itemToPickup); // Handles list removal
                } else {
                    // Special case: Activate Mixer/Blender if it has a ready container
                    if ((station.name === 'robotMixer' || station.name === 'blender') /* && itemToPickup has ready flag? */) {
                        // TODO: Implement activation logic if container is ready
                        console.log(`Attempting to activate ${station.name}... (Not implemented)`);
                        this.uiManager.showTemporaryMessage("Needs Ingredients!", 1000); // Placeholder
                    } else {
                        this.uiManager.showTemporaryMessage("Station Empty", 1000);
                    }
                }
                break;

            // 3. Pickup from Assembly Slot
            case STATION_TYPES.ASSEMBLY:
                const slotIndex = getAssemblySlotIndex(station, hitPoint.x);
                const itemInSlot = stationData.slots[slotIndex];
                if (itemInSlot) {
                    stationData.slots[slotIndex] = null;
                    this._pickupItem(itemInSlot); // Handles list removal
                } else this.uiManager.showTemporaryMessage("Slot Empty", 1000);
                break;

            // 4. Other station types (Serving, Counter) - No action when empty-handed
            case STATION_TYPES.SERVING:
            case STATION_TYPES.COUNTER:
                this.uiManager.showTemporaryMessage("Nothing to Use", 1000);
                break;

            default:
                console.warn(`_useStation: Unhandled station type ${stationData.stationType}`);
                break;
        }
    }

    // --- Visual Placement Helpers ---
    _placeItemOnStationVisual(item, station) {
        const stationBox = new THREE.Box3().setFromObject(station);
        const itemBox = new THREE.Box3().setFromObject(item);
        const itemHeight = itemBox.max.y - itemBox.min.y;
        const targetPos = new THREE.Vector3();
        stationBox.getCenter(targetPos);
        targetPos.y = stationBox.max.y + itemHeight / 2 + 0.01;
        item.position.copy(targetPos);
        item.rotation.set(0, Math.random() * Math.PI * 2, 0);
        this.scene.add(item);
    }

    _placeItemOnSurfaceVisual(item, surfaceMesh, hitPoint) {
        const itemBox = new THREE.Box3().setFromObject(item);
        const itemHeight = itemBox.max.y - itemBox.min.y;
        const targetPos = hitPoint.clone();
        targetPos.y = Math.max(hitPoint.y + itemHeight / 2 + 0.01, itemHeight / 2 + 0.01);
        item.position.copy(targetPos);
        item.rotation.set(0, Math.random() * Math.PI * 2, 0);
        this.scene.add(item);
    }
}