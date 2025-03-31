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
        // Ensure internal contents for relevant stations are reset
        Object.values(this.stations).forEach(station => {
            if (station.userData?.internalContents) {
                station.userData.internalContents = [];
            }
        });
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
                // Dispose geometry/material if they are unique to this item
                item.geometry?.dispose();
                if (Array.isArray(item.material)) {
                    item.material.forEach(m => m.dispose());
                } else {
                    item.material?.dispose();
                }
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
        // Optional: Dispose geometry/material here if not done elsewhere
        // item.geometry?.dispose();
        // item.material?.dispose(); // Be careful with shared materials
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
                // Check if target is an ITEM (plate, bowl, cup) currently in an assembly slot
                else if (targetObject.userData?.type === ITEM_TYPES.ITEM &&
                    (this.stations.assembly?.userData?.slots?.includes(targetObject))
                ) {
                    // The target is the container item itself (plate, bowl, cup)
                    console.log(`Attempting to place ${heldItem.name} onto container ${targetObject.name}`);
                    this._handleContainerPlacement(heldItem, targetObject, targetPoint); // Use specific handler
                }
                else if (targetObject === this.floorMesh) {
                    const droppedItem = this.player.place();
                    if (droppedItem) this._dropItem(droppedItem, targetPoint);
                }
                else { // Clicked something else (could be another dynamic item)
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
                    if (targetObject.parent && targetObject.parent.userData?.itemType && ['plate', 'bowl', 'cup'].includes(targetObject.parent.userData.itemType)) {
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

        const intersects = this.raycaster.intersectObjects(objectsToCheck, true); // Check children too

        let closestInteractable = null;
        let closestDistance = INTERACTION_DISTANCE;
        let hitPoint = null;

        for (const intersect of intersects) {
            if (intersect.distance > closestDistance) continue;

            let object = intersect.object;
            let parentInteractable = null;

            // Traverse up to find the object that's in our interactables list or the floor
            let tempObj = object;
            while (tempObj.parent && tempObj !== this.scene) {
                if (this.interactables.includes(tempObj)) {
                    parentInteractable = tempObj;
                    break;
                }
                tempObj = tempObj.parent;
            }

            // Decide which object to target (prioritize container over content, interactable over child mesh)
            const targetObject = parentInteractable || (this.interactables.includes(object) ? object : null);

            // If the direct hit is the floor, target it only if holding something
            if (object === this.floorMesh && !this.player.getHeldItem()) continue;
            if (object === this.floorMesh && this.player.getHeldItem()) {
                if (intersect.distance < closestDistance) {
                    closestInteractable = object; // Target the floor
                    closestDistance = intersect.distance;
                    hitPoint = intersect.point;
                }
                continue; // Don't check other conditions if floor is hit while holding
            }


            // If we found a valid interactable target (or its child)
            if (targetObject && targetObject !== this.player.getHeldItem()) {
                if (intersect.distance < closestDistance) {
                    closestInteractable = targetObject; // Target the interactable object itself
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
                // Clear timeout if picking up item mid-process
                if (item.userData.processTimeoutId) {
                    clearTimeout(item.userData.processTimeoutId);
                    delete item.userData.processTimeoutId;
                    console.log(`Cancelled processing for ${item.name}`);
                }
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
        this._removeDynamicInteractable(item); // This now also removes from scene

        if (this.player.pickup(item)) { /* Success */ }
        else { // Pickup failed
            console.log("Cannot pick up item.");
            this.uiManager.showTemporaryMessage("Hands Full!", 1000);
            // Add back to list and potentially station
            this._addDynamicInteractable(item);
            this.scene.add(item); // Add back to scene
            if (removedFromStation && stationNameFound) {
                if (stationNameFound === 'assembly' && slotIndex > -1) {
                    this.stations.assembly.userData.slots[slotIndex] = item; // Put back in slot
                    // Reposition in slot visually
                    const slotPosition = this.stations.assembly.userData.slotPositions[slotIndex];
                    const itemBox = new THREE.Box3().setFromObject(item);
                    const itemHeight = itemBox.max.y - itemBox.min.y;
                    item.position.copy(slotPosition);
                    item.position.y += itemHeight / 2 + 0.005;

                } else if (this.stations[stationNameFound]?.userData?.stationType === STATION_TYPES.PROCESSOR) {
                    this.stations[stationNameFound].userData.occupiedBy = item; // Put back on processor
                    this._placeItemOnStationVisual(item, this.stations[stationNameFound]); // Reposition
                }
            }
        }
    }

    // Main router for placing/using an item ON a station
    _placeOrProcessItem(item, station, targetPoint, targetItemOnStation = null) {
        const stationData = station.userData;
        const heldItemName = item.name;
        const heldItemType = item.userData.type;
        const heldItemSpecificType = item.userData.itemType; // e.g., 'cup'

        // --- Handle Instant Processors (Mixer) ---
        if (station.name === 'robotMixer' && stationData.processes?.includes(heldItemName)) {
            const resultType = stationData.result?.[heldItemName];
            if (resultType) {
                const originalItem = this.player.place();
                if (originalItem && originalItem === item) {
                    const newItem = createItem(this.scene, resultType, this.preloadedModels);
                    if (newItem) {
                        this._addDynamicInteractable(newItem);
                        if (this.player.pickup(newItem)) {
                            console.log(`Transformed ${heldItemName} into ${resultType} via ${station.name}`);
                            this.uiManager.showTemporaryMessage("Mixed!", 1000);
                            this._removeDynamicInteractable(originalItem);
                            originalItem.geometry?.dispose();
                            if (Array.isArray(originalItem.material)) originalItem.material.forEach(m => m.dispose());
                            else originalItem.material?.dispose();
                        } else {
                            this.uiManager.showTemporaryMessage("Hands Full!", 1000);
                            this._dropItem(newItem, station.position);
                            this.player.pickup(originalItem);
                        }
                    } else {
                        console.error(`Failed to create result item: ${resultType}`);
                        this.player.pickup(originalItem);
                        this.uiManager.showTemporaryMessage("Error!", 1000);
                    }
                } else {
                    console.error("Item mismatch during instant processing.");
                    if (originalItem) this.player.pickup(originalItem);
                }
            } else {
                console.warn(`No result defined for ${heldItemName} on ${station.name}`);
                this.uiManager.showTemporaryMessage("Cannot Process", 1000);
            }
            return; // Stop further processing
        }
        // --- END Mixer ---

        // --- Handle Blender (New Logic) ---
        if (station.name === 'blender') {
            // Case 1: Adding an ingredient
            if (heldItemType === ITEM_TYPES.INGREDIENT && stationData.acceptsIngredients?.includes(heldItemName)) {
                const originalItem = this.player.place();
                if (originalItem && originalItem === item) {
                    if (!Array.isArray(stationData.internalContents)) stationData.internalContents = [];
                    // Avoid duplicates if necessary
                    if (!stationData.internalContents.includes(heldItemName)) {
                        stationData.internalContents.push(heldItemName);
                        console.log(`Added ${heldItemName} to Blender. Contents: [${stationData.internalContents.join(', ')}]`);
                        this.uiManager.showTemporaryMessage(`Added ${heldItemName}`, 1000);
                        // Remove and dispose the ingredient mesh
                        this._removeDynamicInteractable(originalItem);
                        originalItem.geometry?.dispose();
                        if (Array.isArray(originalItem.material)) originalItem.material.forEach(m => m.dispose());
                        else originalItem.material?.dispose();
                    } else {
                        this.uiManager.showTemporaryMessage("Already Added!", 1000);
                        this.player.pickup(originalItem); // Give item back
                    }
                } else {
                    console.error("Item mismatch adding ingredient to blender.");
                    if (originalItem) this.player.pickup(originalItem);
                }
                return; // Stop further processing
            }
            // Case 2: Using a cup to get the smoothie
            else if (heldItemType === ITEM_TYPES.ITEM && heldItemSpecificType === stationData.acceptsContainer) { // Check if holding the right container ('cup')
                const required = stationData.requiredIngredients?.slice().sort() || [];
                const current = stationData.internalContents?.slice().sort() || [];
                const ingredientsMatch = required.length === current.length && required.every((val, index) => val === current[index]);

                if (ingredientsMatch && stationData.outputItem) {
                    const originalCup = this.player.place();
                    if (originalCup && originalCup === item) {
                        const smoothieItem = createItem(this.scene, stationData.outputItem, this.preloadedModels);
                        if (smoothieItem) {
                            this._addDynamicInteractable(smoothieItem);
                            if (this.player.pickup(smoothieItem)) {
                                console.log(`Created ${stationData.outputItem} from Blender.`);
                                this.uiManager.showTemporaryMessage("Smoothie Ready!", 1500);
                                stationData.internalContents = []; // Clear blender contents
                                // Remove and dispose the empty cup mesh
                                this._removeDynamicInteractable(originalCup);
                                originalCup.geometry?.dispose();
                                if (Array.isArray(originalCup.material)) originalCup.material.forEach(m => m.dispose());
                                else originalCup.material?.dispose();
                            } else {
                                this.uiManager.showTemporaryMessage("Hands Full!", 1000);
                                this._dropItem(smoothieItem, station.position); // Drop smoothie
                                this.player.pickup(originalCup); // Give cup back
                            }
                        } else {
                            console.error(`Failed to create result item: ${stationData.outputItem}`);
                            this.player.pickup(originalCup); // Give cup back
                            this.uiManager.showTemporaryMessage("Error!", 1000);
                        }
                    } else {
                        console.error("Item mismatch getting smoothie from blender.");
                        if (originalCup) this.player.pickup(originalCup);
                    }
                } else {
                    this.uiManager.showTemporaryMessage("Blender Not Ready!", 1000);
                    // Don't take the cup, player keeps holding it.
                }
                return; // Stop further processing
            }
            // Case 3: Trying to place something invalid
            else {
                this.uiManager.showTemporaryMessage("Cannot Use Here", 1000);
                // Player keeps holding the item, interaction fails.
                return; // Stop further processing
            }
        }
        // --- END Blender ---


        // --- Existing Logic for Placing/Processing (Non-Mixer/Blender) ---
        const itemToPlace = this.player.place();
        if (!itemToPlace || itemToPlace !== item) {
            console.error("Mismatch placing item.");
            if (itemToPlace) this._dropItem(itemToPlace, station.position); return;
        }

        switch (stationData.stationType) {
            case STATION_TYPES.ASSEMBLY:
                this._handleAssemblyPlacement(itemToPlace, station, targetPoint, targetItemOnStation);
                break;
            case STATION_TYPES.PROCESSOR: // Grill, Fryer, Oven, Toaster, etc.
                this._handleProcessorStation(itemToPlace, station);
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
        if (itemData.type === ITEM_TYPES.INGREDIENT && ['plate', 'bowl', 'cup'].includes(containerData.itemType)) {
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
            // Item added to container is no longer directly interactable on its own
            // this._removeDynamicInteractable(itemToPlace); // Don't remove from list, just make non-raycastable? No, removing is fine.

            // Check if container is now a complete meal (plate/bowl/cup)
            if (checkPlateCompletion(container)) { // Use same check function
                this.uiManager.showTemporaryMessage(`${containerData.mealName} Ready!`, 1500);
                this._animateMealCompletion(container);
            } else { this.uiManager.showTemporaryMessage("Ingredient Added", 1000); }

        } else {
            console.log(`Cannot place ${itemToPlace.name} onto ${container.name}.`);
            this.uiManager.showTemporaryMessage("Cannot Add!", 1000);
            this._dropItem(itemToPlace, container.position); // Drop if invalid placement
        }
    }


    // Handles placing items directly into Assembly Station slots
    _handleAssemblyPlacement(item, station, targetPoint, targetItemOnStation) {
        if (targetItemOnStation) {
            console.log("Cannot place directly onto item in slot. Aim for empty slot or container.");
            this.uiManager.showTemporaryMessage("Aim for Slot/Container", 1500);
            this._dropItem(item, station.position);
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
            this._addDynamicInteractable(item); // Item is interactable while processing (can be picked up early)

            if (stationData.processingTime) {
                console.log(`Processing ${item.name} for ${stationData.processingTime}ms...`);
                item.userData.processTimeoutId = setTimeout(() => {
                    if (station.userData.occupiedBy === item) {
                        this._finishProcessing(item, station);
                    } else {
                        console.warn(`Processing timer finished for ${item.name}, but station ${station.name} no longer holds it.`);
                    }
                    delete item.userData.processTimeoutId;
                }, stationData.processingTime);
            } else { // Immediate processing (e.g., cutting board)
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
        let resultLookupType = processedItem.name;
        const resultType = stationData.result?.[resultLookupType];

        if (processedItem.userData.processTimeoutId) {
            clearTimeout(processedItem.userData.processTimeoutId);
            delete processedItem.userData.processTimeoutId;
        }

        this._removeDynamicInteractable(processedItem);
        processedItem.geometry?.dispose();
        if (Array.isArray(processedItem.material)) processedItem.material.forEach(m => m.dispose());
        else processedItem.material?.dispose();


        if (!resultType) {
            console.error(`Processing error on ${station.name}: No result defined for input "${resultLookupType}"`);
            stationData.occupiedBy = null;
            return;
        }

        console.log(`${resultLookupType} processed into ${resultType} on ${station.name}`);
        const newItem = createItem(this.scene, resultType, this.preloadedModels);

        if (newItem) {
            stationData.occupiedBy = newItem;
            this._placeItemOnStationVisual(newItem, station);
            this._addDynamicInteractable(newItem);
        } else {
            console.error(`Failed to create result item: ${resultType}`);
            stationData.occupiedBy = null;
        }
    }

    _handleServingStation(item, station, targetPoint) {
        const itemData = item.userData;
        if (itemData.type === ITEM_TYPES.ITEM && ['plate', 'bowl', 'cup'].includes(itemData.itemType) && itemData.mealName) {
            const success = this.levelManager.completeOrder(itemData.mealName);
            if (success) {
                item.traverse((child) => {
                    child.geometry?.dispose();
                    if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                    else child.material?.dispose();
                });
                this._removeDynamicInteractable(item);
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
                    this._pickupItem(newItem);
                } else console.error(`Failed to create item from source: ${itemTypeToCreate}`);
                break;

            // 2. Pickup from Processor (generic)
            case STATION_TYPES.PROCESSOR:
                // Special check for Blender - cannot pick up from it directly
                if (station.name === 'blender') {
                    const contents = stationData.internalContents || [];
                    if (contents.length > 0) {
                        this.uiManager.showTemporaryMessage(`Blender contains: ${contents.join(', ')}`, 1500);
                    } else {
                        this.uiManager.showTemporaryMessage("Blender Empty", 1000);
                    }
                    return; // No pickup action
                }

                // Generic processor pickup
                const itemToPickup = stationData.occupiedBy;
                if (itemToPickup) {
                    if (itemToPickup.userData.processTimeoutId) {
                        this.uiManager.showTemporaryMessage("Still Processing...", 1000);
                        return;
                    }
                    stationData.occupiedBy = null;
                    this._pickupItem(itemToPickup);
                } else {
                    this.uiManager.showTemporaryMessage("Station Empty", 1000);
                }
                break;

            // 3. Pickup from Assembly Slot
            case STATION_TYPES.ASSEMBLY:
                const slotIndex = getAssemblySlotIndex(station, hitPoint.x);
                const itemInSlot = stationData.slots[slotIndex];
                if (itemInSlot) {
                    stationData.slots[slotIndex] = null;
                    this._pickupItem(itemInSlot);
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