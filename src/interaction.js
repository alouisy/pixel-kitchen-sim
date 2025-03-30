// src/interaction.js
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { gsap } from 'gsap';
import { INTERACTION_DISTANCE, STATION_TYPES, ITEM_TYPES } from './constants.js';
import { createItem, checkPlateCompletion } from './items.js';
import { getAssemblySlotIndex } from './world.js';

export class InteractionManager {
    constructor(camera, scene, player, stations, stationInteractables, levelManager, uiManager, preloadedModels, floorMesh) {
        this.camera = camera;
        this.scene = scene;
        this.player = player;
        this.stations = stations;
        this.interactables = stationInteractables ? [...stationInteractables] : [];
        this.levelManager = levelManager;
        this.uiManager = uiManager;
        this.preloadedModels = preloadedModels;
        this.floorMesh = floorMesh;
        this.raycaster = new THREE.Raycaster();
    }

    updateWorldData(newStations, newStationInteractables, newFloorMesh) {
        console.log("InteractionManager updating world data...");
        this.stations = newStations || {};
        this.interactables = newStationInteractables ? [...newStationInteractables] : [];
        this.floorMesh = newFloorMesh;
        console.log("Stations refs updated:", Object.keys(this.stations));
        console.log("Initial Interactables for level:", this.interactables.map(i => i.name));
    }

    clearDynamicItems() {
        console.log("InteractionManager clearing dynamic items...");
        if (!this.interactables) return;
        let removedCount = 0;
        for (let i = this.interactables.length - 1; i >= 0; i--) {
            const item = this.interactables[i];
            if (item.userData && (item.userData.type === ITEM_TYPES.ITEM || item.userData.type === ITEM_TYPES.INGREDIENT)) {
                if (item.parent) item.parent.remove(item);
                this.interactables.splice(i, 1);
                removedCount++;
            }
        }
        console.log(`Dynamic items cleared: ${removedCount}. Remaining interactables: ${this.interactables.length}`);
    }

    _addDynamicInteractable(item) {
        if (item && !this.interactables.includes(item)) {
            if (item.userData?.type !== 'station' && item.userData?.stationType !== STATION_TYPES.COUNTER) {
                this.interactables.push(item);
                // console.log("IM Added dynamic interactable:", item.name);
            }
        }
    }

    _removeDynamicInteractable(item) {
        if (!item) return;
        const index = this.interactables.indexOf(item);
        if (index > -1) {
            this.interactables.splice(index, 1);
            // console.log("IM Removed dynamic interactable:", item.name);
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

                if (targetObject.userData?.type === 'station') {
                    this._placeOrProcessItem(heldItem, targetObject, targetPoint);
                }
                else if (targetObject.userData?.type === ITEM_TYPES.ITEM && this.stations.assembly?.userData?.slots?.includes(targetObject)) {
                    this._placeOrProcessItem(heldItem, this.stations.assembly, targetPoint, targetObject);
                }
                else if (targetObject === this.floorMesh) {
                    const droppedItem = this.player.place();
                    if (droppedItem) this._dropItem(droppedItem, targetPoint);
                }
                else { // Clicked something else (another dynamic item, wall?)
                    const droppedItem = this.player.place();
                    if (droppedItem) this._dropItem(droppedItem, targetPoint || this.player.getPosition().clone().add(this.camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(1.0)));
                }
            } else { // Player clicked empty space while holding
                const droppedItem = this.player.place();
                if (droppedItem) this._dropItem(droppedItem, this.player.getPosition().clone().add(this.camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(1.0)));
            }
        } else { // Player is not holding anything
            if (targetInfo) { // Player is looking at something interactable
                const targetObject = targetInfo.object;
                if (targetObject.userData?.type === ITEM_TYPES.INGREDIENT || targetObject.userData?.type === ITEM_TYPES.ITEM) {
                    if (targetObject.parent && targetObject.parent.userData?.itemType === 'plate') {
                        this.uiManager.showTemporaryMessage("Pick up Plate", 1000);
                    } else {
                        this._pickupItem(targetObject); // Pick up item/ingredient
                    }
                }
                else if (targetObject.userData?.type === 'station') {
                    this._useStation(targetObject, targetInfo.point); // Use station
                }
            }
            // Else: Player clicked empty space or non-interactable while empty-handed - do nothing
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
            while (object.parent && !this.interactables.includes(object) && object !== this.floorMesh && object !== this.scene) {
                if (this.interactables.includes(object.parent)) { object = object.parent; break; }
                object = object.parent;
            }
            const isValidTarget = this.interactables.includes(object) || object === this.floorMesh;
            if (isValidTarget && object !== this.player.getHeldItem()) {
                if (object.userData?.type === ITEM_TYPES.INGREDIENT && object.parent?.userData?.itemType === 'plate' && this.interactables.includes(object.parent)) {
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
        for (const stationName in this.stations) {
            const station = this.stations[stationName];
            if (station.userData?.stationType === STATION_TYPES.PROCESSOR && station.userData.occupiedBy === item) {
                station.userData.occupiedBy = null; removedFromStation = true; break;
            }
        }
        const assemblyStation = this.stations.assembly;
        let slotIndex = -1;
        if (assemblyStation && Array.isArray(assemblyStation.userData.slots)) {
            slotIndex = assemblyStation.userData.slots.indexOf(item);
            if (slotIndex > -1) { assemblyStation.userData.slots[slotIndex] = null; removedFromStation = true; }
        }

        // Remove from list BEFORE player pickup attempt
        this._removeDynamicInteractable(item);

        if (this.player.pickup(item)) { /* Success */ }
        else { // Pickup failed (e.g., hands full)
            console.log("Cannot pick up item.");
            this.uiManager.showTemporaryMessage("Hands Full!", 1000);
            // Add back to list and potentially station
            this._addDynamicInteractable(item);
            if (removedFromStation && assemblyStation && slotIndex > -1) {
                assemblyStation.userData.slots[slotIndex] = item;
            }
            // If removed from processor, it stays off (player needs to place it again)
        }
    }

    _placeOrProcessItem(item, station, targetPoint, targetItemOnStation = null) {
        const itemToPlace = this.player.place();
        if (!itemToPlace || itemToPlace !== item) {
            console.error("Mismatch placing item.");
            if (itemToPlace) this._dropItem(itemToPlace, station.position); return;
        }
        const stationData = station.userData;
        switch (stationData.stationType) {
            case STATION_TYPES.ASSEMBLY: this._handleAssemblyPlacement(itemToPlace, station, targetPoint, targetItemOnStation); break;
            case STATION_TYPES.PROCESSOR: this._handleProcessorStation(itemToPlace, station); break;
            case STATION_TYPES.SERVING: this._handleServingStation(itemToPlace, station, targetPoint); break;
            default:
                console.log(`Cannot perform specific action with ${item.name} on ${station.name}. Placing on surface.`);
                this._placeItemOnSurfaceVisual(itemToPlace, station, targetPoint);
                this._addDynamicInteractable(itemToPlace); // Add back after placing on generic surface
                break;
        }
    }

    _handleAssemblyPlacement(item, station, targetPoint, targetItemOnStation) {
        const stationData = station.userData;
        const itemData = item.userData;
        // Case 1: Placing onto a PLATE in a slot
        if (targetItemOnStation && targetItemOnStation.userData?.itemType === 'plate' && itemData.type === ITEM_TYPES.INGREDIENT) {
            const plate = targetItemOnStation;
            const ingredientId = item.name;
            if (plate.userData.contents.includes(ingredientId)) {
                this.uiManager.showTemporaryMessage("Already Added!", 1000);
                this._dropItem(item, plate.position); return;
            }
            if (!Array.isArray(plate.userData.contents)) plate.userData.contents = [];
            plate.userData.contents.push(ingredientId);
            // Visual Addition
            const contentCount = plate.children.length;
            const plateBox = new THREE.Box3().setFromObject(plate);
            const itemBox = new THREE.Box3().setFromObject(item);
            const itemHeight = itemBox.max.y - itemBox.min.y;
            const offsetY = (plateBox.max.y - plateBox.min.y) / 2 + itemHeight / 2 + (contentCount * 0.01);
            const offsetX = (Math.random() - 0.5) * 0.08;
            const offsetZ = (Math.random() - 0.5) * 0.08;
            item.position.set(offsetX, offsetY, offsetZ);
            item.rotation.set(0, Math.random() * Math.PI * 2, 0);
            plate.add(item); // Item is now child, not directly interactable
            if (checkPlateCompletion(plate)) {
                this.uiManager.showTemporaryMessage(`${plate.userData.mealName} Ready!`, 1500);
                this._animateMealCompletion(plate);
            } else { this.uiManager.showTemporaryMessage("Ingredient Added", 1000); }
            return;
        }
        // Case 2: Placing directly into an assembly SLOT
        if (!targetItemOnStation && station.userData.stationType === STATION_TYPES.ASSEMBLY) {
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
                return;
            } else { this.uiManager.showTemporaryMessage("Slot Full!", 1000); this._dropItem(item, station.position); return; }
        }
        // Case 3: Invalid placement
        console.log(`Invalid assembly placement.`);
        this.uiManager.showTemporaryMessage("Cannot Place Here", 1000);
        this._dropItem(item, station.position);
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

    _handleProcessorStation(item, station) {
        const stationData = station.userData;
        if (stationData.occupiedBy) { this.uiManager.showTemporaryMessage("Station Busy", 1000); this._dropItem(item, station.position); return; }
        let processLookupType = item.name;
        if (processLookupType && stationData.processes?.includes(processLookupType)) {
            this._placeItemOnStationVisual(item, station);
            stationData.occupiedBy = item;
            // Item remains interactable for now
            if (stationData.processingTime) {
                item.visible = false;
                // this._removeDynamicInteractable(item); // Optional: remove during timed process
                setTimeout(() => {
                    // if (!item.parent) this._addDynamicInteractable(item); // Add back if removed
                    if (station.userData.occupiedBy === item) this._finishProcessing(item, station);
                    else if (item.parent) item.parent.remove(item);
                }, stationData.processingTime);
            } else { this._finishProcessing(item, station); }
        } else { this.uiManager.showTemporaryMessage("Cannot Process", 1000); this._dropItem(item, station.position); }
    }

    _finishProcessing(processedItem, station) {
        const stationData = station.userData;
        let resultLookupType = processedItem.name;
        const resultType = stationData.result?.[resultLookupType];
        const newItemPosition = new THREE.Vector3();
        processedItem.getWorldPosition(newItemPosition);
        this._removeDynamicInteractable(processedItem); // Remove original
        if (!resultType) { console.error(`Processing error: No result defined for ${resultLookupType}`); stationData.occupiedBy = null; return; }
        const newItem = createItem(this.scene, resultType, this.preloadedModels, undefined, newItemPosition);
        if (newItem) {
            stationData.occupiedBy = newItem;
            this._placeItemOnStationVisual(newItem, station);
            this._addDynamicInteractable(newItem); // <<< Add NEW item to list
        } else { console.error(`Failed to create result item: ${resultType}`); stationData.occupiedBy = null; }
    }

    _handleServingStation(item, station, targetPoint) {
        const itemData = item.userData;
        if (itemData.itemType === 'plate' && itemData.mealName) {
            const success = this.levelManager.completeOrder(itemData.mealName);
            if (success) {
                this._removeDynamicInteractable(item); // Removes plate and children
                this.uiManager.showTemporaryMessage("Order Served!", 1500);
            } else {
                this.uiManager.showTemporaryMessage("Wrong / No Order!", 1500);
                this._placeItemOnSurfaceVisual(item, station, targetPoint);
                this._addDynamicInteractable(item); // Add back if serve failed
            }
        } else {
            this.uiManager.showTemporaryMessage("Not a Meal!", 1500);
            this._placeItemOnSurfaceVisual(item, station, targetPoint);
            this._addDynamicInteractable(item); // Add back if not a meal
        }
    }

    _useStation(station, hitPoint) {
        const stationData = station.userData;
        // 1. Source Stations
        if (stationData.stationType === STATION_TYPES.INGREDIENT_SOURCE || stationData.stationType === STATION_TYPES.ITEM_SOURCE) {
            if (this.player.getHeldItem()) { this.uiManager.showTemporaryMessage("Hands Full!", 1000); return; }
            const itemTypeToCreate = stationData.ingredient || stationData.item;
            if (!itemTypeToCreate) return;
            const newItem = createItem(this.scene, itemTypeToCreate, this.preloadedModels);
            if (newItem) {
                this._addDynamicInteractable(newItem); // <<< Add to list FIRST
                this._pickupItem(newItem); // <<< Then pickup (which removes it temporarily)
            } else console.error(`Failed to create item from source: ${itemTypeToCreate}`);
        }
        // 2. Pickup from Processor
        else if (stationData.stationType === STATION_TYPES.PROCESSOR && stationData.occupiedBy) {
            if (this.player.getHeldItem()) { this.uiManager.showTemporaryMessage("Hands Full!", 1000); return; }
            const itemToPickup = stationData.occupiedBy;
            if (itemToPickup.visible === false) { this.uiManager.showTemporaryMessage("Still Processing...", 1000); return; }
            stationData.occupiedBy = null;
            this._pickupItem(itemToPickup); // Handles list removal
        }
        // 3. Pickup from Assembly Slot
        else if (stationData.stationType === STATION_TYPES.ASSEMBLY) {
            if (this.player.getHeldItem()) { this.uiManager.showTemporaryMessage("Hands Full!", 1000); return; }
            const slotIndex = getAssemblySlotIndex(station, hitPoint.x);
            const itemInSlot = stationData.slots[slotIndex];
            if (itemInSlot) {
                stationData.slots[slotIndex] = null;
                this._pickupItem(itemInSlot); // Handles list removal
            } else this.uiManager.showTemporaryMessage("Slot Empty", 1000);
        }
        // 4. Other/Empty
        else { if (stationData.stationType === STATION_TYPES.PROCESSOR) this.uiManager.showTemporaryMessage("Station Empty", 1000); }
    }

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