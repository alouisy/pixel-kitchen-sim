// src/interaction.js
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { gsap } from 'gsap';
import { INTERACTION_DISTANCE, STATION_TYPES, ITEM_TYPES, GRID_UNIT } from './constants.js';
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
        
        this.currentlyHighlightedObject = null;

        // --- Slot Highlight Mesh ---
        const highlightGeo = new THREE.PlaneGeometry(GRID_UNIT * 0.9, GRID_UNIT * 0.9);
        const highlightMat = new THREE.MeshBasicMaterial({ color: 0x00FF00, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
        this.slotHighlight = new THREE.Mesh(highlightGeo, highlightMat);
        this.slotHighlight.rotation.x = -Math.PI / 2;
        this.slotHighlight.visible = false;
        this.scene.add(this.slotHighlight);
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
                item.traverse(child => {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                        else child.material.dispose();
                    }
                });
                this.interactables.splice(i, 1); 
            }
        }
        this.slotHighlight.visible = false;
    }

    _addDynamicInteractable(item) {
        if (item && !this.interactables.includes(item)) {
            // Add only loose items/ingredients, NOT stations/counters/floor
            if (item.userData?.type === ITEM_TYPES.ITEM || item.userData?.type === ITEM_TYPES.INGREDIENT) {
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

    // --- Main Interaction Logic ---

    handleInteractionRequest() {
        const heldItem = this.player.getHeldItem();
        const targetInfo = this._findTarget();
        
        if (!targetInfo) return;
        const targetObject = targetInfo.object;
        const targetPoint = targetInfo.point;

        // 1. Player Holding Item
        if (heldItem) {
            // A. Direct Add (Adding to held container)
            if (this._isDirectAdditionCheck(heldItem, targetObject)) {
                this._handleDirectAddition(heldItem, targetObject);
                return;
            }

            // B. Processing / Placing
            const type = targetObject.userData.type;
            const stType = targetObject.userData.stationType;

            if (type === 'station' || type === STATION_TYPES.COUNTER || type === STATION_TYPES.TABLE || type === STATION_TYPES.FLOOR) {
                
                // Special: Processor (Fryer, Board)
                if (stType === STATION_TYPES.PROCESSOR) {
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
            // Use Station (Source)
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

    // --- Grid Placement ---
    _attemptGridPlacement(item, surface, hitPoint) {
        const grid = surface.userData.grid;
        if (!grid) return;

        const { col, row } = grid.worldToGrid(hitPoint);
        const existingItem = grid.occupied[col]?.[row];

        // Case 1: Serving
        if (surface.userData.stationType === STATION_TYPES.SERVING) {
            if (this._tryServeItem(item)) return;
        }

        // Case 2: Slot Occupied -> Assembly
        if (existingItem) {
            const heldIsIng = item.userData.type === ITEM_TYPES.INGREDIENT;
            const targetIsContainer = existingItem.userData.type === ITEM_TYPES.ITEM && ['plate','bowl','cup'].includes(existingItem.userData.itemType);
            
            if (heldIsIng && targetIsContainer) {
                this._handleDirectAddition(existingItem, item);
                this.player.place(); 
                return;
            } else {
                this.uiManager.showTemporaryMessage("Slot Occupied", 1000);
                return;
            }
        }

        // Case 3: Place Item
        if (grid.isAreaFree(col, row, 1, 1)) {
            const placedItem = this.player.place();
            if (!placedItem) return;

            grid.occupy(col, row, 1, 1, placedItem);
            
            const worldPos = grid.gridToWorld(col, row);
            
            // Determine correct Y height.
            // Floor = 0. Counter/Table = 0.9 (MODULE_HEIGHT)
            let yBase = 0;
            if (surface.userData.stationType === STATION_TYPES.COUNTER || surface.userData.stationType === STATION_TYPES.TABLE || surface.userData.stationType === STATION_TYPES.SERVING) {
                yBase = 0.9;
            }
            
            const itemBox = new THREE.Box3().setFromObject(placedItem);
            const itemH = itemBox.max.y - itemBox.min.y;

            placedItem.position.set(worldPos.x, yBase + itemH/2 + 0.005, worldPos.z);
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
                servedItem.traverse((c) => { if(c.geometry) c.geometry.dispose(); });
                this.uiManager.showTemporaryMessage("Order Served!", 1500);
                return true;
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
        // Simple stacking
        const offsetY = 0.05 + (contentCount * 0.01); 
        
        ingredientMeshClone.position.set(0, offsetY, 0);
        ingredientMeshClone.rotation.set(0, Math.random() * Math.PI * 2, 0);
        heldContainer.add(ingredientMeshClone);
        
        if (typeof ingredientMeshClone.raycast === 'function') ingredientMeshClone.userData.originalRaycast = ingredientMeshClone.raycast;
        ingredientMeshClone.raycast = () => {};

        if (targetIngredientObject.userData.type === ITEM_TYPES.INGREDIENT) {
            this._removeDynamicInteractable(targetIngredientObject);
            targetIngredientObject.traverse(c => { if(c.geometry) c.geometry.dispose(); });
            // If on station, clear occupancy
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
        // Clear Station Occupancy
        for (const name in this.stations) {
            const station = this.stations[name];
            if (station.userData?.occupiedBy === item) {
                if (item.userData.processTimeoutId) {
                     clearTimeout(item.userData.processTimeoutId);
                     delete item.userData.processTimeoutId;
                }
                station.userData.occupiedBy = null; break;
            }
        }
        if (item.userData.gridInfo) item.userData.gridInfo.grid.vacate(item);
        this._removeDynamicInteractable(item);
        
        if (!this.player.pickup(item)) {
            this.uiManager.showTemporaryMessage("Hands Full!", 1000);
            this._addDynamicInteractable(item);
            // Ideally should restore grid, but simple drop handles it next
        }
    }

    _placeOrProcessItem(item, station, targetPoint) {
        // 1. Mixer/Blender Logic (Instant)
        if ((station.name === 'robotMixer' || station.name === 'blender')) {
            // ... (Mixer logic assumed) ...
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
         
         // Create new item FIRST to ensure it works
         const newItem = createItem(this.scene, resultType, this.preloadedModels);
         if (!newItem) {
             console.error("Failed to create processed item:", resultType);
             return; // Abort destroying the old item
         }

         // Destroy Old
         this._removeDynamicInteractable(item);
         item.traverse(c => { if(c.geometry) c.geometry.dispose(); });
         
         // Place New
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
        // Use Bounding Boxes to stack perfectly
        const stationBox = new THREE.Box3().setFromObject(station);
        const itemBox = new THREE.Box3().setFromObject(item);
        
        const stationTopY = stationBox.max.y;
        const itemHeight = itemBox.max.y - itemBox.min.y;
        
        // Center on station
        item.position.set(station.position.x, stationTopY + (itemHeight / 2) + 0.005, station.position.z);
        item.rotation.set(0, 0, 0);
        this.scene.add(item);
    }

    // --- Highlight Logic ---
    updateAimHighlight() {
        if (!this.player.controls.isLocked) {
            this.slotHighlight.visible = false;
            return;
        }

        const info = this._findTarget();
        const obj = info ? info.object : null;
        const point = info ? info.point : null;

        // Reset Object Highlight
        if (this.currentlyHighlightedObject && this.currentlyHighlightedObject !== obj) {
            this.revertObjectHighlight(this.currentlyHighlightedObject);
            this.currentlyHighlightedObject = null;
        }

        this.slotHighlight.visible = false; // Default hidden

        if (obj) {
            // 1. Highlight Grid Slot (Counters, Tables, Floor)
            // ONLY if empty
            if (obj.userData.grid) {
                const grid = obj.userData.grid;
                const { col, row } = grid.worldToGrid(point);
                if (grid.isAreaFree(col, row, 1, 1)) {
                    const worldPos = grid.gridToWorld(col, row);
                    // Align highlight
                    let y = obj.position.y;
                    if (obj.userData.type === STATION_TYPES.FLOOR) y = 0.01;
                    else y = 0.9 + 0.01;

                    this.slotHighlight.position.set(worldPos.x, y, worldPos.z);
                    this.slotHighlight.visible = true;
                }
            }
            // 2. Highlight Interactable Objects (Ingredients, Stations, Plates)
            // DO NOT highlight Counters/Tables themselves
            else if (obj.userData.type === ITEM_TYPES.ITEM || obj.userData.type === ITEM_TYPES.INGREDIENT || obj.userData.type === 'station') {
                // Exclude base counters
                if (obj.userData.stationType !== STATION_TYPES.COUNTER && obj.userData.stationType !== STATION_TYPES.TABLE) {
                    this.applyObjectHighlight(obj);
                    this.currentlyHighlightedObject = obj;
                }
            }
        }
    }

    applyObjectHighlight(obj) {
        if (!obj.userData.originalScale) obj.userData.originalScale = obj.scale.clone();
        gsap.to(obj.scale, { x: obj.userData.originalScale.x * 1.1, y: obj.userData.originalScale.y * 1.1, z: obj.userData.originalScale.z * 1.1, duration: 0.15 });
    }

    revertObjectHighlight(obj) {
        if (!obj || !obj.userData.originalScale) return;
        gsap.to(obj.scale, { x: obj.userData.originalScale.x, y: obj.userData.originalScale.y, z: obj.userData.originalScale.z, duration: 0.1 });
    }
}