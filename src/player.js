// src/player.js
import * as THREE from 'three';
import { PLAYER_HEIGHT, PLAYER_SPEED, KITCHEN_BOUNDS, ITEM_TYPES, STATION_TYPES } from './constants.js';
import { getKitchenObjects } from './world.js'; // Added ITEM_TYPES

export class Player {
    constructor(controls) {
        this.controls = controls;
        this.cameraObject = controls.object;
        this.velocity = new THREE.Vector3();
        this.holdingItem = null;
        this.scene = null;

        this.holdPositionHelper = new THREE.Object3D();
        this.holdPositionHelper.position.set(0, -0.3, -0.8); // Adjusted hold position slightly
        this.cameraObject.add(this.holdPositionHelper);
    }

    update(delta, movementInput) {
        if (!this.controls.isLocked) return;

        const speed = PLAYER_SPEED * delta;
        this.velocity.set(movementInput.x, 0, movementInput.z);

        if (this.velocity.lengthSq() > 0) {
            this.velocity.normalize().multiplyScalar(speed);
        } else {
            this.velocity.set(0, 0, 0);
        }

        const oldX = this.cameraObject.position.x;
        const oldZ = this.cameraObject.position.z;

        // Try X movement first for sliding
        if (this.velocity.x !== 0) {
            this.controls.moveRight(this.velocity.x);
            this.cameraObject.position.x = Math.max(KITCHEN_BOUNDS.xMin, Math.min(KITCHEN_BOUNDS.xMax, this.cameraObject.position.x));
            if (this.checkCollisions()) {
                this.cameraObject.position.x = oldX;
            }
        }

        // Try Z movement next for sliding
        if (this.velocity.z !== 0) {
            this.controls.moveForward(-this.velocity.z);
            this.cameraObject.position.z = Math.max(KITCHEN_BOUNDS.zMin, Math.min(KITCHEN_BOUNDS.zMax, this.cameraObject.position.z));
            if (this.checkCollisions()) {
                this.cameraObject.position.z = oldZ;
            }
        }

        this.cameraObject.position.y = PLAYER_HEIGHT;

        this._updateHeldItemPosition();
    }

    checkCollisions() {
        const objects = getKitchenObjects ? getKitchenObjects() : [];
        const px = this.cameraObject.position.x;
        const pz = this.cameraObject.position.z;
        const playerRadius = 0.3; // Player thickness radius

        for (const obj of objects) {
            const type = obj.userData?.stationType;
            if (!type || type === 'floor' || type === 'ceiling') continue;
            
            // Skip overhead objects
            if (obj.position.y > 1.2) continue;

            let halfX = 0.25;
            let halfZ = 0.25;

            if (type === STATION_TYPES.WALL) {
                const size = obj.userData.size || { width: 0.5, depth: 0.5 };
                const isRotated = Math.abs(Math.sin(obj.rotation.y)) > 0.707;
                halfX = (isRotated ? size.depth : size.width) / 2;
                halfZ = (isRotated ? size.width : size.depth) / 2;
            } else if (type === 'decoration') {
                const name = (obj.name || '').toLowerCase();
                if (name.includes('lamp') || name.includes('hood') || name.includes('exhaust')) continue;
            }

            const minX = obj.position.x - halfX - playerRadius;
            const maxX = obj.position.x + halfX + playerRadius;
            const minZ = obj.position.z - halfZ - playerRadius;
            const maxZ = obj.position.z + halfZ + playerRadius;

            if (px > minX && px < maxX && pz > minZ && pz < maxZ) {
                return true; // Collision!
            }
        }
        return false;
    }

    _updateHeldItemPosition() {
        if (this.holdingItem) {
            const targetPosition = new THREE.Vector3();
            this.holdPositionHelper.getWorldPosition(targetPosition);
            // Use lerp for smoother movement towards the target position
            this.holdingItem.position.lerp(targetPosition, 0.4); // Increased lerp factor for responsiveness

            const targetRotation = new THREE.Quaternion();
            // Get camera's world rotation directly
            this.cameraObject.getWorldQuaternion(targetRotation);
            // Slerp for smoother rotation towards the target rotation
            this.holdingItem.quaternion.slerp(targetRotation, 0.3); // Increased slerp factor
        }
    }


    pickup(item) {
        if (this.holdingItem || !this.scene || !item) return false;

        this.holdingItem = item;
        // InteractionManager handles removing from its interactables list
        // Ensure item is added to the scene if not already (might be redundant if IM adds it)
        if (!item.parent) {
            this.scene.add(item);
        }

        // Disable raycasting while held
        if (typeof item.raycast === 'function') {
            item.userData.originalRaycast = item.raycast;
        }
        item.raycast = () => { };
        return true;
    }

    place() {
        if (!this.holdingItem) return null;
        const item = this.holdingItem;
        // Restore raycasting
        if (item.userData.originalRaycast) {
            item.raycast = item.userData.originalRaycast;
            delete item.userData.originalRaycast;
        } else {
            // If no original raycast was stored, ensure it defaults back to THREE's default
            delete item.raycast;
        }
        this.holdingItem = null;
        // Return item for InteractionManager to handle placement/adding back to list
        return item;
    }

    // Force drop - just clear internal state and remove from scene
    forceDropItem() {
        if (!this.holdingItem) return;
        console.log(`Player force dropping: ${this.holdingItem.name}`);
        const item = this.holdingItem;
        this.holdingItem = null; // Clear internal reference

        // Remove from scene graph - InteractionManager handles the list
        if (item.parent) {
            item.parent.remove(item);
        }
        // Optional: Dispose geometry/material if needed (handled by IM clearDynamicItems now)
    }

    getHeldItem() { return this.holdingItem; }

    // New method to get the display name for the held item
    getHeldItemName() {
        if (!this.holdingItem) return null;

        // If it's a container (plate/bowl/cup) and has a mealName, return that
        if (this.holdingItem.userData?.type === ITEM_TYPES.ITEM && this.holdingItem.userData?.mealName) {
            return this.holdingItem.userData.mealName;
        }

        // Otherwise, return the item's base name
        return this.holdingItem.name;
    }

    getPosition() { return this.cameraObject.position; }
    setScene(scene) { this.scene = scene; }
}