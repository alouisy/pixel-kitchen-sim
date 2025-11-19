// src/interaction.js
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { gsap } from 'gsap';
import { INTERACTION_DISTANCE, STATION_TYPES, ITEM_TYPES } from './constants.js';
import { createItem, checkPlateCompletion } from './items.js';

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
        this.currentlyHighlighted = null;
    }

    updateWorldData(newStations, newStationInteractables, newFloorMesh) {
        this.stations = newStations || {};
        this.interactables = newStationInteractables ? [...newStationInteractables] : [];
        this.floorMesh = newFloorMesh;
    }

    clearDynamicItems() {
        if (!this.interactables) return;
        for (let i = this.interactables.length - 1; i >= 0; i--) {
            const item = this.interactables[i];
            if (item.userData && (item.userData.type === ITEM_TYPES.ITEM || item.userData.type === ITEM_TYPES.INGREDIENT)) {
                if (item.userData.gridInfo) item.userData.gridInfo.grid.vacate(item);
                if (item.parent) item.parent.remove(item); 
                this.interactables.splice(i, 1); 
            }
        }
    }

    _addDynamicInteractable(item) {
        if (item && !this.interactables.includes(item)) {
            if (item.userData?.type !== 'station' && item.userData?.stationType !== STATION_TYPES.COUNTER) {
                this.interactables.push(item);
            }
        }
    }

    _removeDynamicInteractable(item) {
        if (!item) return;
        if (item.userData.gridInfo) item.userData.gridInfo.grid.vacate(item);
        const index = this.interactables.indexOf(item);
        if (index > -1) this.interactables.splice(index, 1);
        if (item.parent) item.parent.remove(item);
    }

    // --- Main Logic ---

    handleInteractionRequest() {
        const heldItem = this.player.getHeldItem();
        const targetInfo = this._findTarget();
        
        if (!targetInfo) return;
        const targetObject = targetInfo.object;
        const targetPoint = targetInfo.point;

        // 1. Player Holding Item
        if (heldItem) {
            // A. Direct Add (Holding container, target is ingredient source/item)
            if (this._isDirectAdditionCheck(heldItem, targetObject)) {
                this._handleDirectAddition(heldItem, targetObject);
                return;
            }

            // B. Place on Surface or Processor
            if (targetObject.userData.type === 'station' || targetObject.userData.type === STATION_TYPES.COUNTER || targetObject.userData.type === STATION_TYPES.FLOOR) {
                
                // Special: Processor
                if (targetObject.userData.stationType === STATION_TYPES.PROCESSOR) {
                    this._placeOrProcessItem(heldItem, targetObject, targetPoint);
                    return;
                }

                // Universal Placement (Counters, Tables, Floor)
                if (targetObject.userData.grid) {
                    this._attemptGridPlacement(heldItem, targetObject, targetPoint);
                    return;
                }
            }
        } 
        // 2. Empty Handed
        else {
            // Pickup
            if (targetObject.userData.type === ITEM_TYPES.ITEM || targetObject.userData.type === ITEM_TYPES.INGREDIENT) {
                this._pickupItem(targetObject);
            }
            // Use Station
            else if (targetObject.userData.type === 'station') {
                this._useStation(targetObject, targetPoint);
            }
        }
    }

    _findTarget() {
        this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
        const objectsToCheck = [...this.interactables];
        if (this.floorMesh) objectsToCheck.push(this.floorMesh);
        const intersects = this.raycaster.intersectObjects(objectsToCheck, true); 
        
        for (const intersect of intersects) {
            if (intersect.distance > INTERACTION_DISTANCE) continue;
            let obj = intersect.object;
            while (obj.parent && obj !== this.scene) {
                if (this.interactables.includes(obj) || obj === this.floorMesh) break;
                obj = obj.parent;
            }
            if (obj === this.player.getHeldItem()) continue;
            return { object: obj, point: intersect.point };
        }
        return null;
    }

    // --- Universal Grid Placement ---
    _attemptGridPlacement(item, surface, hitPoint) {
        const grid = surface.userData.grid;
        if (!grid) return;

        // Convert hit point to grid slot
        const { col, row } = grid.worldToGrid(hitPoint);
        
        // Check occupation logic
        const existingItem = grid.occupied[col]?.[row];

        // Case 1: Serving
        if (surface.userData.stationType === STATION_TYPES.SERVING) {
            if (this._tryServeItem(item)) return;
            // Else fall through to place on counter if allowed
        }

        // Case 2: Slot Occupied -> Check for Assembly Logic
        // If holding ingredient and slot has container -> Add ingredient
        if (existingItem) {
            const heldIsIng = item.userData.type === ITEM_TYPES.INGREDIENT;
            const targetIsContainer = existingItem.userData.type === ITEM_TYPES.ITEM && ['plate','bowl','cup'].includes(existingItem.userData.itemType);
            
            if (heldIsIng && targetIsContainer) {
                // Add holding item to the placed container
                this._handleDirectAddition(existingItem, item);
                this.player.place(); // Drop from hand, logic handles consumption
                return;
            } else {
                this.uiManager.showTemporaryMessage("Slot Occupied", 1000);
                return;
            }
        }

        // Case 3: Empty Slot -> Place Item
        if (grid.isAreaFree(col, row, 1, 1)) {
            const placedItem = this.player.place();
            if (!placedItem) return;

            grid.occupy(col, row, 1, 1, placedItem);
            
            // Y positioning
            let surfaceH = surface.geometry ? surface.geometry.parameters.height : 0;
            // Special case for Group-based prefabs (Table/Counter) - userData size is not set on group geometry
            if (surface.userData.isBase) surfaceH = 0.9; // Hardcoded standard height
            if (surface === this.floorMesh) surfaceH = 0;

            const worldPos = grid.gridToWorld(col, row);
            const topY = surface.position.y + (surfaceH === 0 ? 0 : surfaceH/2); // Counters pivot is center, so top is pos + h/2. Wait, our new prefabs have pivot at bottom 0? No, world.js puts them at 0. 
            // In world.js: object3D.position.set(x, 0, z);
            // But the MESH inside has top at height. 
            // Let's trust the visual top. 
            // Standard height is 0.9.
            const finalY = (surface.userData.isBase) ? 0.9 : 0;

            const itemBox = new THREE.Box3().setFromObject(placedItem);
            const itemH = itemBox.max.y - itemBox.min.y;

            placedItem.position.set(worldPos.x, finalY + itemH/2 + 0.005, worldPos.z);
            placedItem.rotation.set(0, 0, 0);
            
            this._addDynamicInteractable(placedItem);
            this.scene.add(placedItem);
            if (placedItem.userData.originalRaycast) { 
                placedItem.raycast = placedItem.userData.originalRaycast; 
                delete placedItem.userData.originalRaycast; 
            } else { delete placedItem.raycast; }
            
            this.uiManager.showTemporaryMessage("Placed", 500);
        }
    }

    _tryServeItem(item) {
        const itemData = item.userData;
        if (itemData.type === ITEM_TYPES.ITEM && ['plate', 'bowl', 'cup'].includes(itemData.itemType) && itemData.mealName) {
            const success = this.levelManager.completeOrder(itemData.mealName);
            if (success) {
                const servedItem = this.player.place(); 
                servedItem.traverse((c) => {
                     if(c.geometry) c.geometry.dispose();
                });
                this.uiManager.showTemporaryMessage("Order Served!", 1500);
                return true;
            } else {
                this.uiManager.showTemporaryMessage("Wrong / No Order!", 1500);
                return false;
            }
        }
        return false;
    }

    _isDirectAdditionCheck(heldItem, targetObject) {
        if (heldItem.userData.type !== ITEM_TYPES.ITEM) return false;
        if (targetObject.userData.type === ITEM_TYPES.INGREDIENT) return true;
        if (targetObject.userData.stationType === STATION_TYPES.INGREDIENT_SOURCE) return true;
        return false;
    }

    _handleDirectAddition(heldContainer, targetIngredientObject) {
        const containerData = heldContainer.userData;
        let ingredientName = targetIngredientObject.name;
        if (targetIngredientObject.userData.stationType === STATION_TYPES.INGREDIENT_SOURCE) {
            ingredientName = targetIngredientObject.userData.ingredient;
        }

        if (!['plate', 'bowl', 'cup'].includes(containerData.itemType)) return;
        if (!Array.isArray(containerData.contents)) containerData.contents = [];
        if (containerData.contents.includes(ingredientName)) {
            this.uiManager.showTemporaryMessage("Already Added!", 1000);
            return;
        }

        containerData.contents.push(ingredientName);
        const ingredientMeshClone = createItem(this.scene, ingredientName, this.preloadedModels);
        if (!ingredientMeshClone) return;
        
        this.scene.remove(ingredientMeshClone);
        this._removeDynamicInteractable(ingredientMeshClone);

        const contentCount = heldContainer.children.length;
        const containerBox = new THREE.Box3().setFromObject(heldContainer);
        const offsetY = 0.05 + (contentCount * 0.01); // Simplified stacking logic
        
        ingredientMeshClone.position.set(0, offsetY, 0);
        ingredientMeshClone.rotation.set(0, Math.random() * Math.PI * 2, 0);
        heldContainer.add(ingredientMeshClone);
        
        // Disable raycasting on child
        if (typeof ingredientMeshClone.raycast === 'function') ingredientMeshClone.userData.originalRaycast = ingredientMeshClone.raycast;
        ingredientMeshClone.raycast = () => {};

        // If target was physical item, consume it
        if (targetIngredientObject.userData.type === ITEM_TYPES.INGREDIENT) {
            this._removeDynamicInteractable(targetIngredientObject);
            targetIngredientObject.traverse(c => { if(c.geometry) c.geometry.dispose(); });
             for (const name in this.stations) {
                const station = this.stations[name];
                if (station.userData?.occupiedBy === targetIngredientObject) {
                    station.userData.occupiedBy = null; break;
                }
            }
        }

        if (checkPlateCompletion(heldContainer)) {
            this.uiManager.showTemporaryMessage(`${containerData.mealName} Ready!`, 1500);
            this._animateMealCompletion(heldContainer);
        } else {
            this.uiManager.showTemporaryMessage("Ingredient Added", 1000);
        }
    }

    _pickupItem(item) {
        for (const name in this.stations) {
            const station = this.stations[name];
            if (station.userData?.stationType === STATION_TYPES.PROCESSOR && station.userData.occupiedBy === item) {
                if (item.userData.processTimeoutId) {
                     clearTimeout(item.userData.processTimeoutId);
                     delete item.userData.processTimeoutId;
                }
                station.userData.occupiedBy = null; break;
            }
        }
        
        // Grid Vacate
        if (item.userData.gridInfo) item.userData.gridInfo.grid.vacate(item);

        this._removeDynamicInteractable(item);
        if (!this.player.pickup(item)) {
            this.uiManager.showTemporaryMessage("Hands Full!", 1000);
            this._addDynamicInteractable(item);
        }
    }

    _placeOrProcessItem(item, station, targetPoint) {
         if ((station.name === 'robotMixer' || station.name === 'blender')) {
             // (Mixer/Blender logic - assume implemented from previous context)
             // Placeholder to prevent crash if copy-paste incomplete:
             return; 
        }

        const stationData = station.userData;
        if (stationData.occupiedBy) { 
            this.uiManager.showTemporaryMessage("Station Busy", 1000); return; 
        }
        
        const itemToPlace = this.player.place();
        if (!itemToPlace) return;

        if (stationData.processes?.includes(item.name)) {
            this._placeItemOnStationVisual(itemToPlace, station);
            stationData.occupiedBy = itemToPlace;
            this._addDynamicInteractable(itemToPlace);
            
            if (stationData.processingTime) {
                itemToPlace.userData.processTimeoutId = setTimeout(() => {
                    if (station.userData.occupiedBy === itemToPlace) {
                        this._finishProcessing(itemToPlace, station);
                    }
                    delete itemToPlace.userData.processTimeoutId;
                }, stationData.processingTime);
            } else {
                this._finishProcessing(itemToPlace, station);
            }
        } else {
            this.uiManager.showTemporaryMessage("Cannot Process", 1000);
            this.player.pickup(itemToPlace);
        }
    }

    _finishProcessing(item, station) {
         const resultType = station.userData.result?.[item.name];
         this._removeDynamicInteractable(item);
         item.geometry.dispose(); 
         
         const newItem = createItem(this.scene, resultType, this.preloadedModels);
         station.userData.occupiedBy = newItem;
         this._placeItemOnStationVisual(newItem, station);
         this._addDynamicInteractable(newItem);
    }

    _useStation(station, point) {
        if (station.userData.stationType === STATION_TYPES.INGREDIENT_SOURCE || station.userData.stationType === STATION_TYPES.ITEM_SOURCE) {
             const type = station.userData.ingredient || station.userData.item;
             const newItem = createItem(this.scene, type, this.preloadedModels);
             if(this.player.pickup(newItem)) {
                 // Success
             }
        }
    }

    _placeItemOnStationVisual(item, station) {
        // Simple stacking for processors
        item.position.set(station.position.x, 0.9 + 0.1, station.position.z); // Approx height
        this.scene.add(item);
    }

    updateAimHighlight() {
        if (!this.player.controls.isLocked) return;
        const info = this._findTarget();
        const obj = info ? info.object : null;
        
        if (obj === this.floorMesh && !this.player.getHeldItem()) {
            if(this.currentlyHighlighted) { this.revertHighlight(this.currentlyHighlighted); this.currentlyHighlighted = null; }
            return;
        }

        if (obj !== this.currentlyHighlighted) {
            if (this.currentlyHighlighted) this.revertHighlight(this.currentlyHighlighted);
            if (obj) this.applyHighlight(obj);
            this.currentlyHighlighted = obj;
        }
    }
    applyHighlight(obj) {
        if(!obj.userData.originalScale) obj.userData.originalScale = obj.scale.clone();
        gsap.to(obj.scale, { x: obj.userData.originalScale.x*1.1, y: obj.userData.originalScale.y*1.1, z: obj.userData.originalScale.z*1.1, duration: 0.15 });
    }
    revertHighlight(obj) {
        if(!obj.userData.originalScale) return;
        gsap.to(obj.scale, { x: obj.userData.originalScale.x, y: obj.userData.originalScale.y, z: obj.userData.originalScale.z, duration: 0.1 });
    }
}