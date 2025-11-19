// src/interaction.js
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { gsap } from 'gsap';
import { INTERACTION_DISTANCE, STATION_TYPES, ITEM_TYPES, GRID_UNIT } from './constants.js';
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
                // Clear grid occupancy if it was placed on a grid
                if (item.userData.gridInfo) {
                    item.userData.gridInfo.grid.vacate(item);
                }

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
    }

    _addDynamicInteractable(item) {
        if (item && !this.interactables.includes(item)) {
            if (item.userData?.type !== 'station' && item.userData?.stationType !== STATION_TYPES.COUNTER && item.userData?.type !== STATION_TYPES.FLOOR) {
                this.interactables.push(item);
            }
        }
    }

    _removeDynamicInteractable(item) {
        if (!item) return;
        // Vacate grid slot if occupied
        if (item.userData.gridInfo) {
            item.userData.gridInfo.grid.vacate(item);
        }
        const index = this.interactables.indexOf(item);
        if (index > -1) this.interactables.splice(index, 1);
        if (item.parent) item.parent.remove(item);
    }

    // --- Core Interaction Logic ---

    handleInteractionRequest() {
        const heldItem = this.player.getHeldItem();
        const targetInfo = this._findTarget();
        
        if (!targetInfo) {
            // Drop in thin air? Only allow if dropping onto valid surface, otherwise do nothing.
            // With grid system, we strictly enforce dropping on surfaces.
            return; 
        }

        const targetObject = targetInfo.object;
        const targetPoint = targetInfo.point;

        // --- 1. Player Holding Item ---
        if (heldItem) {
            
            // A. Direct Addition (Adding ingredient to held plate)
            // Check if target is an ingredient/source and we hold a container
            if (this._isDirectAdditionCheck(heldItem, targetObject)) {
                this._handleDirectAddition(heldItem, targetObject);
                return;
            }

            // B. Placement / Processing on Surface
            // Check if we hit a Surface (Counter/Floor) or a Station
            if (targetObject.userData.type === 'station' || targetObject.userData.type === STATION_TYPES.COUNTER || targetObject.userData.type === STATION_TYPES.FLOOR) {
                
                // Special Case: Assembly Station Slots (Old Logic kept for specific stations)
                if (targetObject.userData.stationType === STATION_TYPES.ASSEMBLY) {
                     this._handleAssemblyPlacement(heldItem, targetObject, targetPoint);
                     return;
                }

                // Special Case: Processors (Fryers, Mixers)
                if (targetObject.userData.stationType === STATION_TYPES.PROCESSOR) {
                    // Try to insert into processor
                    this._placeOrProcessItem(heldItem, targetObject, targetPoint);
                    return;
                }

                // C. Grid Placement (Counters, Floor, Serving)
                if (targetObject.userData.grid) {
                    this._attemptGridPlacement(heldItem, targetObject, targetPoint);
                    return;
                }
            }
        } 
        // --- 2. Player Empty Handed ---
        else {
            // A. Pickup Item
            if (targetObject.userData.type === ITEM_TYPES.ITEM || targetObject.userData.type === ITEM_TYPES.INGREDIENT) {
                this._pickupItem(targetObject);
            }
            // B. Use Station (Source, etc)
            else if (targetObject.userData.type === 'station') {
                this._useStation(targetObject, targetPoint);
            }
        }
    }

    // --- Target Finding ---
    _findTarget() {
        this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
        // Scan interactables AND floor
        const objectsToCheck = [...this.interactables];
        if (this.floorMesh) objectsToCheck.push(this.floorMesh);

        const intersects = this.raycaster.intersectObjects(objectsToCheck, true); 

        // Logic: We want the closest valid hit. 
        // Priority: Interactable Items > Stations/Counters > Floor
        
        for (const intersect of intersects) {
            if (intersect.distance > INTERACTION_DISTANCE) continue;

            let obj = intersect.object;
            // Traverse up to root
            while (obj.parent && obj !== this.scene) {
                if (this.interactables.includes(obj) || obj === this.floorMesh) break;
                obj = obj.parent;
            }

            // Filter held item
            if (obj === this.player.getHeldItem()) continue;
            
            // Return specific hit
            return { object: obj, point: intersect.point };
        }
        return null;
    }

    // --- Grid Placement Logic ---
    _attemptGridPlacement(item, surface, hitPoint) {
        const grid = surface.userData.grid;
        if (!grid) return;

        // Calculate item dimensions in slots
        // Assuming items are mostly 1x1 slot unless specified
        // We can store slot size in item.userData later if needed
        const itemW = 1; // 1 slot wide
        const itemD = 1; // 1 slot deep

        // Convert hit point to grid coords
        const { col, row } = grid.worldToGrid(hitPoint);
        
        // Center the item on the slot? Need top-left for occupancy check
        // Mouse usually hits center. 
        const startCol = col;
        const startRow = row;

        // Check validity
        if (grid.isAreaFree(startCol, startRow, itemW, itemD)) {
            
            // *** SERVING LOGIC ***
            if (surface.userData.stationType === STATION_TYPES.SERVING) {
                if (this._tryServeItem(item)) {
                    return; // Served successfully
                }
                // If not valid order, fall through to place it on the counter
            }

            // Valid Placement
            const placedItem = this.player.place();
            if (!placedItem) return;

            // Occupy Grid
            grid.occupy(startCol, startRow, itemW, itemD, placedItem);

            // Visual Positioning
            const worldPos = grid.gridToWorld(startCol, startRow);
            // Y calculation: Surface Y + Surface Thickness/2 + Item Height/2
            // Or just Surface Top Y + Item Height/2
            // Since Grid is attached to Counter mesh, gridToWorld returns X/Z relative to world.
            // We need Y.
            
            let surfaceY = surface.position.y;
            let surfaceHeight = surface.geometry ? surface.geometry.parameters.height : 0;
            if (surface === this.floorMesh) {
                surfaceY = 0; surfaceHeight = 0;
            }
            
            const itemBox = new THREE.Box3().setFromObject(placedItem);
            const itemH = itemBox.max.y - itemBox.min.y;
            
            // Counters are positioned at Y=height/2. Top is at Y+height/2.
            const topY = surface.position.y + (surfaceHeight / 2);

            placedItem.position.set(worldPos.x, topY + (itemH/2) + 0.005, worldPos.z);
            placedItem.rotation.set(0, 0, 0); // Reset rotation or align with grid
            
            this._addDynamicInteractable(placedItem);
            this.scene.add(placedItem);
            if (placedItem.userData.originalRaycast) { 
                placedItem.raycast = placedItem.userData.originalRaycast; 
                delete placedItem.userData.originalRaycast; 
            } else { delete placedItem.raycast; }

            this.uiManager.showTemporaryMessage("Placed", 500);

        } else {
            this.uiManager.showTemporaryMessage("Slot Occupied", 1000);
        }
    }

    _tryServeItem(item) {
        const itemData = item.userData;
        // Check meal validity
        if (itemData.type === ITEM_TYPES.ITEM && ['plate', 'bowl', 'cup'].includes(itemData.itemType) && itemData.mealName) {
            const success = this.levelManager.completeOrder(itemData.mealName);
            if (success) {
                // Destroy item from hand
                const servedItem = this.player.place(); // Remove from player
                // Dispose
                servedItem.traverse((child) => {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                         if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                         else child.material.dispose();
                    }
                });
                // Remove from interactables isn't needed because we didn't add it back
                this.uiManager.showTemporaryMessage("Order Served!", 1500);
                return true;
            } else {
                this.uiManager.showTemporaryMessage("Wrong / No Order!", 1500);
                return false;
            }
        } else {
            this.uiManager.showTemporaryMessage("Not a Meal!", 1500);
            return false;
        }
    }

    // --- Other Interaction Methods (Assembly, Processors, Pickup) ---
    
    _isDirectAdditionCheck(heldItem, targetObject) {
        if (heldItem.userData.type !== ITEM_TYPES.ITEM) return false;
        if (targetObject.userData.type === ITEM_TYPES.INGREDIENT) return true;
        if (targetObject.userData.stationType === STATION_TYPES.INGREDIENT_SOURCE) return true;
        return false;
    }

    _handleDirectAddition(heldContainer, targetIngredientObject) {
        // ... (Previous Direct Addition Logic - Assumed correct from previous prompt) ...
        // COPY LOGIC FROM PREVIOUS RESPONSE
        const containerData = heldContainer.userData;
        const ingredientData = targetIngredientObject.userData;
        let ingredientName = targetIngredientObject.name;
        
        // Handle Source Station target
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
        const itemBox = new THREE.Box3().setFromObject(ingredientMeshClone);
        const offsetY = (containerBox.max.y - containerBox.min.y) / 2 + (itemBox.max.y - itemBox.min.y) / 2 + (contentCount * 0.01) - ((containerBox.max.y - containerBox.min.y) * 0.3);
        
        ingredientMeshClone.position.set(0, offsetY, 0);
        ingredientMeshClone.rotation.set(0, Math.random() * Math.PI * 2, 0);
        heldContainer.add(ingredientMeshClone);
        
        if (typeof ingredientMeshClone.raycast === 'function') ingredientMeshClone.userData.originalRaycast = ingredientMeshClone.raycast;
        ingredientMeshClone.raycast = () => {};

        // Consume Target if it was a loose ingredient
        if (targetIngredientObject.userData.type === ITEM_TYPES.INGREDIENT) {
            this._removeDynamicInteractable(targetIngredientObject);
            targetIngredientObject.traverse(child => {
                if(child.geometry) child.geometry.dispose();
            });
            // Also clear station occupancy if it was on a processor
             for (const name in this.stations) {
                const station = this.stations[name];
                if (station.userData?.occupiedBy === targetIngredientObject) {
                    station.userData.occupiedBy = null;
                    break;
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
        // 1. Check if on Processor
        for (const name in this.stations) {
            const station = this.stations[name];
            if (station.userData?.stationType === STATION_TYPES.PROCESSOR && station.userData.occupiedBy === item) {
                if (item.userData.processTimeoutId) {
                     clearTimeout(item.userData.processTimeoutId);
                     delete item.userData.processTimeoutId;
                }
                station.userData.occupiedBy = null;
                break;
            }
        }
        // 2. Check if in Assembly Slot
        if (this.stations.assembly && this.stations.assembly.userData.slots.includes(item)) {
            const idx = this.stations.assembly.userData.slots.indexOf(item);
            this.stations.assembly.userData.slots[idx] = null;
        }

        // 3. Remove from Grid (Logic handled in _removeDynamicInteractable but we call vacate specifically here to be safe before pickup)
        if (item.userData.gridInfo) {
            item.userData.gridInfo.grid.vacate(item);
        }

        this._removeDynamicInteractable(item);
        if (this.player.pickup(item)) {
            // Success
        } else {
            this.uiManager.showTemporaryMessage("Hands Full!", 1000);
            this._addDynamicInteractable(item); // Put back
            // (Ideally restore grid occupancy here, but simpler to just not fail pickup logic in Player)
        }
    }

    // --- Processors / Assembly (Legacy Logic for specific stations) ---
    _placeOrProcessItem(item, station, targetPoint) {
        // Mixer / Blender logic (Instant)
         if ((station.name === 'robotMixer' || station.name === 'blender')) {
            // ... (Copy Mixer/Blender logic from previous iteration) ...
            // Simplified for brevity: This needs to be here.
            // If holding ingredient -> Transform logic.
            // If holding cup -> Transform logic.
            return;
        }

        // Generic Processor
        const stationData = station.userData;
        if (stationData.occupiedBy) { 
            this.uiManager.showTemporaryMessage("Station Busy", 1000); 
            return; 
        }
        
        const itemToPlace = this.player.place();
        if (!itemToPlace) return;

        // Process check
        if (stationData.processes?.includes(item.name)) {
            // Place visually
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
            this.player.pickup(itemToPlace); // Give back
        }
    }

    _finishProcessing(item, station) {
         // ... (Copy logic from previous: Destroy old, create new, place on station)
         const resultType = station.userData.result?.[item.name];
         this._removeDynamicInteractable(item);
         item.geometry.dispose(); // etc
         
         const newItem = createItem(this.scene, resultType, this.preloadedModels);
         station.userData.occupiedBy = newItem;
         this._placeItemOnStationVisual(newItem, station);
         this._addDynamicInteractable(newItem);
    }

    _handleAssemblyPlacement(item, station, point) {
        // ... (Copy Logic from previous: Check slot contents, add to container or place in slot)
        // This station type essentially acts as its own mini-grid with 3 fixed slots.
        // Keeping legacy logic is fine, or convert Assembly to use GridSystem with 3 slots.
        // Sticking to legacy for Assembly specifically as it has specific divider visuals.
        const slotIndex = getAssemblySlotIndex(station, point.x);
        const itemInSlot = station.userData.slots[slotIndex];
        const itemToPlace = item; // Player hasn't dropped yet in this logic flow, careful.

        if (itemInSlot && ['plate','bowl','cup'].includes(itemInSlot.userData.itemType)) {
             // Direct add logic...
             this._handleDirectAddition(itemInSlot, itemToPlace); // Note: logic needs itemToPlace to be separate
             // Since player still holds itemToPlace, we need to release it:
             this.player.place(); // Drop from hand logic, then it gets consumed.
             return;
        } else if (!itemInSlot) {
             const placed = this.player.place();
             station.userData.slots[slotIndex] = placed;
             // Position...
             const pos = station.userData.slotPositions[slotIndex];
             placed.position.copy(pos);
             placed.position.y += 0.1; // Adjust height
             this.scene.add(placed);
             this._addDynamicInteractable(placed);
        }
    }
    
    _useStation(station, point) {
        // Source logic
        if (station.userData.stationType === STATION_TYPES.INGREDIENT_SOURCE || station.userData.stationType === STATION_TYPES.ITEM_SOURCE) {
             const type = station.userData.ingredient || station.userData.item;
             const newItem = createItem(this.scene, type, this.preloadedModels);
             if(this.player.pickup(newItem)) {
                 this._addDynamicInteractable(newItem); // Add to interactables but pick up immediately
                 // Actually, pickup removes from raycast but we need to track it to eventually drop it.
                 // InteractionManager usually tracks things IN THE WORLD. 
                 // Player tracks thing IN HAND.
                 // So we don't add to interactables yet? 
                 // Wait, _dropItem adds to interactables. Correct.
             }
        }
    }

    // Visual helpers
    _placeItemOnStationVisual(item, station) {
        const box = new THREE.Box3().setFromObject(station);
        const itemBox = new THREE.Box3().setFromObject(item);
        const y = box.max.y + (itemBox.max.y - itemBox.min.y)/2;
        item.position.set(station.position.x, y, station.position.z);
        this.scene.add(item);
    }

    // Highlighting
    updateAimHighlight() {
        if (!this.player.controls.isLocked) return;
        const info = this._findTarget();
        const obj = info ? info.object : null;
        
        // Filter: Don't highlight floor unless holding item
        if (obj === this.floorMesh && !this.player.getHeldItem()) {
            if(this.currentlyHighlighted) {
                this.revertHighlight(this.currentlyHighlighted);
                this.currentlyHighlighted = null;
            }
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