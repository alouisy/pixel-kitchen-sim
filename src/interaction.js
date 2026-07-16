// src/interaction.js
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { gsap } from 'gsap';
import { INTERACTION_DISTANCE, STATION_TYPES, ITEM_TYPES, GRID_UNIT, INGREDIENT_RENDER_ORDER } from './constants.js';
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
        this.audioManager = null;

        // Slot Highlight
        const highlightGeo = new THREE.PlaneGeometry(GRID_UNIT * 0.9, GRID_UNIT * 0.9);
        const highlightMat = new THREE.MeshBasicMaterial({ color: 0x00FF00, transparent: true, opacity: 0.4, side: THREE.DoubleSide });
        this.slotHighlight = new THREE.Mesh(highlightGeo, highlightMat);
        this.slotHighlight.rotation.x = -Math.PI / 2;
        this.slotHighlight.visible = false;
        this.scene.add(this.slotHighlight);
    }

    updateWorldData(newStations, newStationInteractables, newFloorMesh) {
        this.stations = newStations || [];
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

    _animateMealCompletion(plate) {
        if (!plate || !plate.parent) return;
        const originalScale = plate.scale.clone();
        const targetScale = originalScale.clone().multiplyScalar(1.15);
        gsap.timeline()
            .to(plate.scale, { x: targetScale.x, y: targetScale.y, z: targetScale.z, duration: 0.15, ease: "power1.out" })
            .to(plate.scale, { x: originalScale.x, y: originalScale.y, z: originalScale.z, duration: 0.25, ease: "elastic.out(1, 0.5)" });
    }

    // --- Main Logic ---

    handleInteractionRequest() {
        const heldItem = this.player.getHeldItem();
        const targetInfo = this._findTarget();
        
        if (!targetInfo) return;
        let targetObject = targetInfo.object;
        const targetPoint = targetInfo.point;

        // Redirect from Grid Slot to Item inside
        if (targetObject.userData.grid) {
            const grid = targetObject.userData.grid;
            const { col, row } = grid.worldToGrid(targetPoint);
            const itemInSlot = grid.occupied[col]?.[row];
            if (itemInSlot && itemInSlot !== heldItem) {
                targetObject = itemInSlot;
            }
        }
        // Redirect from Station to Item (e.g. pick up fries from cutting board)
        if (targetObject.userData.type === 'station' && targetObject.userData.occupiedBy) {
             // If holding nothing, or if holding something that can't be processed, default to the item on station
             // This makes clicking the "cutting board with fries" pick up the fries.
             if (!heldItem || !targetObject.userData.processes?.includes(heldItem.name)) {
                 targetObject = targetObject.userData.occupiedBy;
             }
        }

        if (heldItem) {
            if (this._isDirectAdditionCheck(heldItem, targetObject)) {
                this._handleDirectAddition(heldItem, targetObject);
                return;
            }

            const type = targetObject.userData.type;
            const stType = targetObject.userData.stationType;

            if (type === 'station' || type === STATION_TYPES.COUNTER || type === STATION_TYPES.TABLE || type === STATION_TYPES.FLOOR) {
                if (stType === STATION_TYPES.PROCESSOR) {
                    this._placeOrProcessItem(heldItem, targetObject, targetPoint);
                    return;
                }
                if (targetObject.userData.grid) {
                    this._attemptGridPlacement(heldItem, targetObject, targetPoint);
                    return;
                }
            }
        } else {
            if (targetObject.userData.type === ITEM_TYPES.ITEM || targetObject.userData.type === ITEM_TYPES.INGREDIENT) {
                this._pickupItem(targetObject);
            }
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

    _attemptGridPlacement(item, surface, hitPoint) {
        const grid = surface.userData.grid;
        if (!grid) return;
        const { col, row } = grid.worldToGrid(hitPoint);
        const existingItem = grid.occupied[col]?.[row];

        if (surface.userData.stationType === STATION_TYPES.SERVING) {
            if (this._tryServeItem(item)) return;
        }

        if (existingItem) {
            const heldIsIng = item.userData.type === ITEM_TYPES.INGREDIENT;
            const targetIsContainer = existingItem.userData.type === ITEM_TYPES.ITEM && ['plate','bowl','cup'].includes(existingItem.userData.itemType);
            if (heldIsIng && targetIsContainer) {
                this._handleDirectAddition(existingItem, item); 
                return;
            } else {
                this.uiManager.showTemporaryMessage("Slot Occupied", 1000);
                if(this.audioManager) this.audioManager.play('error');
                return;
            }
        }

        if (grid.isAreaFree(col, row, 1, 1)) {
            const placedItem = this.player.place();
            if (!placedItem) return;
            grid.occupy(col, row, 1, 1, placedItem);
            
            const worldPos = grid.gridToWorld(col, row);
            let yBase = 0;
            if (surface.userData.stationType === STATION_TYPES.COUNTER || surface.userData.stationType === STATION_TYPES.TABLE || surface.userData.stationType === STATION_TYPES.SERVING) {
                yBase = 0.9;
            }
            
            // *** FIX FLOATING PLATE ON COUNTER ***
            // Voxel items have their origin (0,0,0) at the bottom.
            // So we simply place them at yBase. 
            // We remove BB calculation here to avoid issues with invisible children or bounds.
            placedItem.position.set(worldPos.x, yBase + 0.005, worldPos.z);

            placedItem.rotation.set(0, 0, 0);
            this._addDynamicInteractable(placedItem);
            this.scene.add(placedItem);
            if (placedItem.userData.originalRaycast) { placedItem.raycast = placedItem.userData.originalRaycast; delete placedItem.userData.originalRaycast; } else { delete placedItem.raycast; }
            if(this.audioManager) this.audioManager.play('place');
        }
    }

    _tryServeItem(item) {
        const itemData = item.userData;
        if (itemData.type === ITEM_TYPES.ITEM && ['plate', 'bowl', 'cup'].includes(itemData.itemType) && itemData.mealName) {
            const success = this.levelManager.completeOrder(itemData.mealName);
            if (success) {
                const servedItem = this.player.place(); 
                this._removeDynamicInteractable(servedItem); 
                this.scene.remove(servedItem); 
                servedItem.traverse((c) => { if(c.geometry) c.geometry.dispose(); });
                this.uiManager.showTemporaryMessage("Order Served!", 1500);
                if(this.audioManager) this.audioManager.play('ding');
                return true;
            }
        }
        return false;
    }

    _isDirectAdditionCheck(heldItem, targetObject) {
        if (heldItem.userData.type === ITEM_TYPES.ITEM && ['plate','bowl','cup'].includes(heldItem.userData.itemType)) {
             if (targetObject.userData.type === ITEM_TYPES.INGREDIENT) return true;
             if (targetObject.userData.stationType === STATION_TYPES.INGREDIENT_SOURCE) return true;
        }
        if (heldItem.userData.type === ITEM_TYPES.INGREDIENT) {
             if (targetObject.userData.type === ITEM_TYPES.ITEM && ['plate','bowl','cup'].includes(targetObject.userData.itemType)) {
                 return true;
             }
        }
        return false;
    }

    _handleDirectAddition(itemA, itemB) {
        let container, ingredientObject;
        if (itemA.userData.type === ITEM_TYPES.ITEM) { container = itemA; ingredientObject = itemB; } 
        else { container = itemB; ingredientObject = itemA; }

        const containerData = container.userData;
        let ingredientName = ingredientObject.name;
        if (ingredientObject.userData.stationType === STATION_TYPES.INGREDIENT_SOURCE) {
            ingredientName = ingredientObject.userData.ingredient;
        }

        if (!['plate', 'bowl', 'cup'].includes(containerData.itemType)) return;
        if (!Array.isArray(containerData.contents)) containerData.contents = [];
        if (containerData.contents.includes(ingredientName)) {
            this.uiManager.showTemporaryMessage("Already Added!", 1000);
            return;
        }

        containerData.contents.push(ingredientName);
        
        this._updatePlateVisuals(container);

        if (ingredientObject === this.player.getHeldItem()) {
            this.player.place(); 
            this._removeDynamicInteractable(ingredientObject);
            this.scene.remove(ingredientObject);
            ingredientObject.traverse(c => { if(c.geometry) c.geometry.dispose(); });
        } 
        else if (ingredientObject.userData.type === ITEM_TYPES.INGREDIENT) {
            this._removeDynamicInteractable(ingredientObject);
            this.scene.remove(ingredientObject);
            ingredientObject.traverse(c => { if(c.geometry) c.geometry.dispose(); });
            if (ingredientObject.userData.gridInfo) ingredientObject.userData.gridInfo.grid.vacate(ingredientObject);
            for (const station of this.stations) {
                if (station.userData?.occupiedBy === ingredientObject) {
                    station.userData.occupiedBy = null; break;
                }
            }
        }

        if (checkPlateCompletion(container)) {
            this.uiManager.showTemporaryMessage(`${containerData.mealName} Ready!`, 1500);
            this._animateMealCompletion(container);
            if(this.audioManager) this.audioManager.play('ding');
        } else {
            this.uiManager.showTemporaryMessage("Ingredient Added", 1000);
            if(this.audioManager) this.audioManager.play('place');
        }
    }

    _updatePlateVisuals(plate) {
        if (!plate || !plate.parent) return;

        // Clear existing ingredient meshes
        for (let i = plate.children.length - 1; i >= 0; i--) {
            const child = plate.children[i];
            if (child.userData && child.userData.type === ITEM_TYPES.INGREDIENT) {
                plate.remove(child);
                child.traverse(c => { if (c.geometry) c.geometry.dispose(); });
            }
        }

        const contents = plate.userData.contents || [];
        if (contents.length === 0) return;

        let itemsToDraw = [...contents];
        const bunIndex = itemsToDraw.indexOf('bun');
        
        // If a meal is complete, we could just render a solid meal, but for now
        // splitting the bun and ordering the items correctly provides a perfect meal visual!
        if (bunIndex !== -1 && contents.length > 1) {
            // Only split the bun if there's more than just a bun on the plate
            itemsToDraw.splice(bunIndex, 1, 'bun_bottom', 'bun_top');
        }

        // Sort itemsToDraw based on INGREDIENT_RENDER_ORDER
        itemsToDraw.sort((a, b) => {
            let indexA = INGREDIENT_RENDER_ORDER.indexOf(a);
            let indexB = INGREDIENT_RENDER_ORDER.indexOf(b);
            if (indexA === -1) indexA = 999;
            if (indexB === -1) indexB = 999;
            return indexA - indexB;
        });

        let offsetY = 0.05; 
        for (const itemName of itemsToDraw) {
            const mesh = createItem(this.scene, itemName, this.preloadedModels);
            if (!mesh) continue;
            
            this.scene.remove(mesh); // It's going to be a child of the plate
            
            if (typeof mesh.raycast === 'function') mesh.userData.originalRaycast = mesh.raycast;
            mesh.raycast = () => {}; // Disable raycast for plate children

            mesh.position.set(0, offsetY, 0);
            
            // Random rotation for natural look, except for buns
            if (!itemName.includes('bun')) {
                 mesh.rotation.set(0, Math.random() * Math.PI * 2, 0);
            }

            plate.add(mesh);
            
            // Increment height based on item
            let thickness = 0.1;
            if (itemName === 'bun_bottom') thickness = 0.15;
            if (itemName === 'bun_top') thickness = 0.2;
            if (itemName.includes('patty')) thickness = 0.15;
            if (itemName.includes('cheese') || itemName.includes('lettuce') || itemName.includes('bacon') || itemName.includes('tomato')) thickness = 0.05;
            if (itemName.includes('bread')) thickness = 0.08;

            offsetY += thickness;
        }
    }

    _pickupItem(item) {
        for (const station of this.stations) {
            if (station.userData?.stationType === STATION_TYPES.PROCESSOR && station.userData.occupiedBy === item) {
                if (item.userData.processTimeoutId) { clearTimeout(item.userData.processTimeoutId); delete item.userData.processTimeoutId; }
                station.userData.occupiedBy = null; break;
            }
        }
        if (item.userData.gridInfo) item.userData.gridInfo.grid.vacate(item);
        this._removeDynamicInteractable(item);
        if (this.player.pickup(item)) {
             if(this.audioManager) this.audioManager.play('pop');
        } else {
            this.uiManager.showTemporaryMessage("Hands Full!", 1000);
            this._addDynamicInteractable(item);
        }
    }

    // *** FIX: HELPER TO GET ACCURATE HEIGHT (IGNORING LABELS) ***
    _getVisualTopY(object) {
        const box = new THREE.Box3();
        // Traverse and expand box ONLY for Meshes, excluding children that look like UI (Sprites)
        object.traverse((child) => {
            if (child.isMesh && child.visible) {
                // Optional: Check if it's a helper or overlay
                // For now, assume all Meshes are physical parts of the station
                child.updateWorldMatrix(true, false);
                if (child.geometry) {
                    child.geometry.computeBoundingBox();
                    const childBox = child.geometry.boundingBox.clone();
                    childBox.applyMatrix4(child.matrixWorld);
                    box.union(childBox);
                }
            }
        });
        if (box.isEmpty()) return object.position.y; // Fallback
        return box.max.y;
    }

    _placeOrProcessItem(item, station, targetPoint) {
         if ((station.name === 'robotMixer' || station.name === 'blender')) return; 
        const stationData = station.userData;
        if (stationData.occupiedBy) { this.uiManager.showTemporaryMessage("Station Busy", 1000); if(this.audioManager) this.audioManager.play('error'); return; }
        
        const itemToPlace = this.player.place();
        if (!itemToPlace) return;

        if (stationData.processes?.includes(item.name)) {
            // Calculate visual top ignoring labels
            const topY = this._getVisualTopY(station);
            itemToPlace.position.set(station.position.x, topY + 0.005, station.position.z);
            this.scene.add(itemToPlace);

            stationData.occupiedBy = itemToPlace;
            this._addDynamicInteractable(itemToPlace);
            
            if (stationData.processingTime) {
                if(this.audioManager) this.audioManager.play('fry'); 
                itemToPlace.userData.processTimeoutId = setTimeout(() => {
                    if (station.userData.occupiedBy === itemToPlace) this._finishProcessing(itemToPlace, station);
                    delete itemToPlace.userData.processTimeoutId;
                }, stationData.processingTime);
            } else {
                if(this.audioManager) this.audioManager.play('chop'); 
                this._finishProcessing(itemToPlace, station);
            }
        } else {
            this.uiManager.showTemporaryMessage("Cannot Process", 1000);
            if(this.audioManager) this.audioManager.play('error');
            this.player.pickup(itemToPlace);
        }
    }

    _finishProcessing(item, station) {
         const resultType = station.userData.result?.[item.name];
         const newItem = createItem(this.scene, resultType, this.preloadedModels);
         if (!newItem) return;

         this._removeDynamicInteractable(item);
         item.traverse(c => { if(c.geometry) c.geometry.dispose(); });
         this.scene.remove(item);
         
         station.userData.occupiedBy = newItem;
         this._placeItemOnStationVisual(newItem, station);
         this._addDynamicInteractable(newItem);
         
         if(this.audioManager) this.audioManager.play('ding');
    }

    _useStation(station, point) {
        if (station.userData.stationType === STATION_TYPES.INGREDIENT_SOURCE || station.userData.stationType === STATION_TYPES.ITEM_SOURCE) {
             const type = station.userData.ingredient || station.userData.item;
             const newItem = createItem(this.scene, type, this.preloadedModels);
             if(this.player.pickup(newItem)) { 
                 if(this.audioManager) this.audioManager.play('pop');
             }
        }
    }

    _placeItemOnStationVisual(item, station) {
        // *** FIX: FLOATING ITEM ON STATION ***
        const topY = this._getVisualTopY(station);
        item.position.set(station.position.x, topY + 0.005, station.position.z);
        item.rotation.set(0, 0, 0);
        this.scene.add(item);
    }

    updateAimHighlight() {
        if (!this.player.controls.isLocked) { this.slotHighlight.visible = false; return; }
        const info = this._findTarget();
        const obj = info ? info.object : null;
        const point = info ? info.point : null;

        if (this.currentlyHighlightedObject && this.currentlyHighlightedObject !== obj) {
            this.revertObjectHighlight(this.currentlyHighlightedObject);
            this.currentlyHighlightedObject = null;
        }

        this.slotHighlight.visible = false;

        if (obj) {
            if (obj.userData.grid) {
                const grid = obj.userData.grid;
                const { col, row } = grid.worldToGrid(point);
                const itemInside = grid.occupied[col]?.[row];
                if (itemInside) {
                    this.applyObjectHighlight(itemInside);
                    this.currentlyHighlightedObject = itemInside;
                } 
                else if (grid.isAreaFree(col, row, 1, 1)) {
                    const worldPos = grid.gridToWorld(col, row);
                    let y = obj.position.y;
                    if (obj.userData.type === STATION_TYPES.FLOOR) y = 0.01;
                    else y = 0.9 + 0.01; 
                    this.slotHighlight.position.set(worldPos.x, y, worldPos.z);
                    this.slotHighlight.visible = true;
                }
            }
            else if (obj.userData.type === ITEM_TYPES.ITEM || obj.userData.type === ITEM_TYPES.INGREDIENT || obj.userData.type === 'station') {
                if (obj.userData.occupiedBy) {
                     this.applyObjectHighlight(obj.userData.occupiedBy);
                     this.currentlyHighlightedObject = obj.userData.occupiedBy;
                } else if (obj.userData.stationType !== STATION_TYPES.COUNTER && obj.userData.stationType !== STATION_TYPES.TABLE) {
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