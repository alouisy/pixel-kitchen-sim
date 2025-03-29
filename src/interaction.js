// src/interaction.js
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { gsap } from 'gsap'; // Import GSAP
import { INTERACTION_DISTANCE, STATION_TYPES, ITEM_TYPES, INGREDIENT_STATES } from './constants.js';
import { createItem, checkPlateCompletion } from './items.js';
import { addInteractable, removeInteractable, getAssemblySlotIndex } from './world.js';

export class InteractionManager {
    constructor(camera, scene, player, stations, interactables, levelManager, uiManager, preloadedModels, floorMesh) {
        this.camera = camera;
        this.scene = scene; // Store scene reference
        this.player = player;
        this.stations = stations;
        this.interactables = interactables;
        this.levelManager = levelManager;
        this.uiManager = uiManager;
        this.preloadedModels = preloadedModels;
        this.floorMesh = floorMesh;
        this.raycaster = new THREE.Raycaster();
    }

    // --- Meal Completion Animation ---
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

        if (heldItem) {
            // --- Placing or Using Held Item ---
            if (targetInfo) {
                const targetObject = targetInfo.object;
                const targetPoint = targetInfo.point;

                // --- Updated Logic ---
                // Check if the target is specifically the serving counter first
                if (targetObject.userData?.stationType === STATION_TYPES.SERVING) {
                    this._placeOrProcessItem(heldItem, targetObject, targetPoint);
                }
                // Then check if it's the assembly station (for placing in slots or on plates)
                else if (targetObject.userData?.stationType === STATION_TYPES.ASSEMBLY) {
                    this._placeOrProcessItem(heldItem, targetObject, targetPoint);
                }
                // Then check if it's a plate *on* the assembly station
                else if (targetObject.userData?.type === ITEM_TYPES.ITEM &&
                    this.stations.assembly.userData.slots.includes(targetObject)) {
                    // Target is the plate itself, but the action context is the assembly station
                    this._placeOrProcessItem(heldItem, this.stations.assembly, targetPoint, targetObject);
                }
                // Then check for other station types (processor, sources etc.)
                else if (targetObject.userData?.type === 'station') {
                    this._placeOrProcessItem(heldItem, targetObject, targetPoint);
                }
                // Otherwise, drop the item
                else {
                    const droppedItem = this.player.place();
                    if (droppedItem) {
                        this._dropItem(droppedItem, targetPoint || this.player.getPosition().clone().add(this.camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(1.0)));
                    }
                }
                // --- End Updated Logic ---

            } else { // Clicked empty space
                const droppedItem = this.player.place();
                if (droppedItem) {
                    this._dropItem(droppedItem, this.player.getPosition().clone().add(this.camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(1.0)));
                }
            }
        } else {
            // --- Picking Up or Using Station ---
            if (targetInfo) {
                const targetObject = targetInfo.object;

                if (targetObject.userData?.type === ITEM_TYPES.INGREDIENT || targetObject.userData?.type === ITEM_TYPES.ITEM) {
                    if (targetObject.parent && targetObject.parent.userData?.itemType === 'plate') {
                        this.uiManager.showTemporaryMessage("Pick up Plate", 1000);
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
        // Ensure all potential station meshes are included if they aren't in interactables
        const objectsToCheck = [...this.interactables, this.stations.servingCounter, this.stations.assembly]; // Add key stations
        const uniqueObjectsToCheck = [...new Set(objectsToCheck)]; // Remove duplicates

        const intersects = this.raycaster.intersectObjects(uniqueObjectsToCheck, true);

        let closestInteractable = null;
        let closestDistance = INTERACTION_DISTANCE;
        let hitPoint = null;

        for (const intersect of intersects) {
            if (intersect.distance > closestDistance) continue;

            let object = intersect.object;
            // Traverse up to find the object that's actually interactable or a known station
            while (object.parent && !uniqueObjectsToCheck.includes(object) && object !== this.scene) {
                // Check if parent is a known station before giving up
                if (object.parent.userData?.type === 'station' && uniqueObjectsToCheck.includes(object.parent)) {
                    object = object.parent;
                    break; // Found the station parent
                }
                object = object.parent;
            }


            // Check if it's a valid target (in check list) and not the held item
            const isValidTarget = uniqueObjectsToCheck.includes(object);

            if (isValidTarget && object !== this.player.getHeldItem()) {
                // Prioritize plate over ingredient child IF the plate is interactable/in a slot
                if (object.userData?.type === ITEM_TYPES.INGREDIENT && object.parent?.userData?.itemType === 'plate' && uniqueObjectsToCheck.includes(object.parent)) {
                    object = object.parent;
                }

                // Check distance again after potential parent swap
                if (intersect.distance <= INTERACTION_DISTANCE) {
                    closestInteractable = object;
                    closestDistance = intersect.distance;
                    hitPoint = intersect.point;
                }
            }
        }
        // if (closestInteractable) console.log("Target:", closestInteractable.name);
        return closestInteractable ? { object: closestInteractable, point: hitPoint } : null;
    }


    _pickupItem(item) {
        let removedFromStation = false;
        for (const stationName in this.stations) {
            const station = this.stations[stationName];
            if (station.userData?.stationType === STATION_TYPES.PROCESSOR && station.userData.occupiedBy === item) {
                station.userData.occupiedBy = null;
                removedFromStation = true;
                break;
            }
        }
        const assemblyStation = this.stations.assembly;
        const slotIndex = assemblyStation.userData.slots.indexOf(item);
        if (slotIndex > -1) {
            assemblyStation.userData.slots[slotIndex] = null;
            removedFromStation = true;
        }

        if (item.userData?.itemType === 'plate') {
            // Logs from previous step
        }

        if (this.player.pickup(item)) {
            // Success
        } else {
            console.log("Cannot pick up item.");
            this.uiManager.showTemporaryMessage("Hands Full!", 1000);
            addInteractable(item, this.scene);
            if (removedFromStation && slotIndex > -1) {
                assemblyStation.userData.slots[slotIndex] = item;
            }
        }
    }

    // This function now correctly routes based on station.userData.stationType
    _placeOrProcessItem(item, station, targetPoint, targetItemOnStation = null) {
        const itemToPlace = this.player.place();
        if (!itemToPlace || itemToPlace !== item) {
            console.error("Mismatch placing item.");
            if (itemToPlace) this._dropItem(itemToPlace, station.position);
            return;
        }

        const stationData = station.userData;

        // --- Route based on the actual station type ---
        switch (stationData.stationType) {
            case STATION_TYPES.ASSEMBLY:
                // Pass targetItemOnStation if we were aiming at a plate specifically
                this._handleAssemblyPlacement(itemToPlace, station, targetPoint, targetItemOnStation);
                break;
            case STATION_TYPES.PROCESSOR:
                this._handleProcessorStation(itemToPlace, station);
                break;
            case STATION_TYPES.SERVING:
                // Pass the hit point for accurate placement if serving fails
                this._handleServingStation(itemToPlace, station, targetPoint);
                break;
            // Add cases for ITEM_SOURCE, INGREDIENT_SOURCE if needed (usually just drop)
            default:
                // Includes generic counters or unknown station types
                console.log(`Cannot perform action with ${item.name} on ${station.name}. Dropping.`);
                // Use the hit point for a more accurate drop location on the surface
                this._placeItemOnSurfaceVisual(itemToPlace, station, targetPoint);
                addInteractable(itemToPlace, this.scene); // Make sure it's interactable after dropping
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
                this._dropItem(item, plate.position); // Drop near plate
                return;
            }

            if (!Array.isArray(plate.userData.contents)) {
                plate.userData.contents = [];
            }
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
            plate.add(item);

            if (checkPlateCompletion(plate)) {
                this.uiManager.showTemporaryMessage(`${plate.userData.mealName} Ready!`, 1500);
                this._animateMealCompletion(plate);
            } else {
                this.uiManager.showTemporaryMessage("Ingredient Added", 1000);
            }
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

                addInteractable(item, this.scene);
                this.scene.add(item);

                this.uiManager.showTemporaryMessage("Item Placed", 1000);
                return;
            } else {
                this.uiManager.showTemporaryMessage("Slot Full!", 1000);
                this._dropItem(item, station.position); // Drop near station center if slot full
                return;
            }
        }

        // Case 3: Invalid placement
        console.log(`Invalid assembly placement: Cannot place ${item.name} onto ${targetItemOnStation ? targetItemOnStation.name : 'surface/slot'}.`);
        this.uiManager.showTemporaryMessage("Cannot Place Here", 1000);
        this._dropItem(item, station.position); // Drop near station center
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

        addInteractable(item, this.scene);
        this.scene.add(item);

        if (item.userData.originalRaycast) {
            item.raycast = item.userData.originalRaycast;
            delete item.userData.originalRaycast;
        }
    }


    _handleProcessorStation(item, station) {
        const stationData = station.userData;

        if (stationData.occupiedBy) {
            this.uiManager.showTemporaryMessage("Station Busy", 1000);
            this._dropItem(item, station.position);
            return;
        }

        let processLookupType = item.name;

        if (processLookupType && stationData.processes?.includes(processLookupType)) {
            this._placeItemOnStationVisual(item, station);
            stationData.occupiedBy = item;
            removeInteractable(item);

            if (stationData.processingTime) {
                item.visible = false;
                setTimeout(() => {
                    if (station.userData.occupiedBy === item) {
                        this._finishProcessing(item, station);
                    } else {
                        console.warn(`Processing finished for ${item.name}, but station ${station.name} is no longer occupied by it.`);
                        if (item.parent) item.parent.remove(item);
                    }
                }, stationData.processingTime);
            } else {
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

        const newItemPosition = new THREE.Vector3();
        processedItem.getWorldPosition(newItemPosition);

        removeInteractable(processedItem);

        if (!resultType) {
            console.error(`Processing error: No result defined for ${resultLookupType} on ${station.name}`);
            stationData.occupiedBy = null;
            return;
        }

        const newItem = createItem(this.scene, resultType, this.preloadedModels, undefined, newItemPosition);
        if (newItem) {
            stationData.occupiedBy = newItem;
            this._placeItemOnStationVisual(newItem, station);
            addInteractable(newItem, this.scene);
        } else {
            console.error(`Failed to create result item: ${resultType}`);
            stationData.occupiedBy = null;
        }
    }

    _handleServingStation(item, station, targetPoint) {
        // Logs from previous step are still useful here
        console.log(`--- Attempting to Serve ---`);
        console.log(`Item Name: ${item.name}, Type: ${item.userData?.itemType}, Meal Name on Plate: ${item.userData?.mealName}`);
        console.log(`LevelManager State: isOrderActive=${this.levelManager.isOrderActive}, Current Order=${this.levelManager.getCurrentOrderName()}`);

        const itemData = item.userData;

        if (itemData.itemType === 'plate' && itemData.mealName) {
            const success = this.levelManager.completeOrder(itemData.mealName);

            if (success) {
                console.log(`   ✅ Successfully served ${itemData.mealName}!`);
                removeInteractable(item);
                this.uiManager.showTemporaryMessage("Order Served!", 1500);
            } else {
                console.log(`   ❌ Serving failed (LevelManager rejected).`);
                this.uiManager.showTemporaryMessage("Wrong / No Order!", 1500);
                this._placeItemOnSurfaceVisual(item, station, targetPoint); // Place visually on counter
                addInteractable(item, this.scene); // Make interactable again
            }
        } else {
            console.log("   ❌ This isn't a completed meal on a plate to serve.");
            this.uiManager.showTemporaryMessage("Not a Meal!", 1500);
            this._placeItemOnSurfaceVisual(item, station, targetPoint); // Place visually on counter
            addInteractable(item, this.scene); // Make interactable again
        }
        console.log(`---------------------------`);
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
                this.player.pickup(newItem);
            } else {
                console.error(`Failed to create item from source: ${itemTypeToCreate}`);
            }
        }
        // 2. Pickup from Processor Station
        else if (stationData.stationType === STATION_TYPES.PROCESSOR && stationData.occupiedBy) {
            if (this.player.getHeldItem()) { this.uiManager.showTemporaryMessage("Hands Full!", 1000); return; }
            const itemToPickup = stationData.occupiedBy;
            if (itemToPickup.visible === false) {
                this.uiManager.showTemporaryMessage("Still Processing...", 1000);
                return;
            }
            stationData.occupiedBy = null;
            this.player.pickup(itemToPickup);
        }
        // 3. Pickup from Assembly Station Slot
        else if (stationData.stationType === STATION_TYPES.ASSEMBLY) {
            if (this.player.getHeldItem()) { this.uiManager.showTemporaryMessage("Hands Full!", 1000); return; }

            const slotIndex = getAssemblySlotIndex(station, hitPoint.x);
            const itemInSlot = stationData.slots[slotIndex];

            if (itemInSlot) {
                stationData.slots[slotIndex] = null;
                this._pickupItem(itemInSlot);
            } else {
                this.uiManager.showTemporaryMessage("Slot Empty", 1000);
            }
        }
        // 4. Other station types or empty stations
        else {
            if (stationData.stationType === STATION_TYPES.PROCESSOR) {
                this.uiManager.showTemporaryMessage("Station Empty", 1000);
            }
        }
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
        // Ensure Y position is slightly above the hit surface
        targetPos.y = Math.max(hitPoint.y + itemHeight / 2 + 0.01, itemHeight / 2 + 0.01); // Prevent going below floor if hit point is low

        item.position.copy(targetPos);
        item.rotation.set(0, Math.random() * Math.PI * 2, 0);

        // console.log(`Placed ${item.name} visually on surface at ${targetPos.x.toFixed(2)}, ${targetPos.y.toFixed(2)}, ${targetPos.z.toFixed(2)}`);

        this.scene.add(item);
    }
}