// src/player.js
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { PLAYER_HEIGHT, PLAYER_SPEED, KITCHEN_BOUNDS, ITEM_TYPES } from './constants.js'; // Added ITEM_TYPES

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

        this.controls.moveRight(this.velocity.x);
        this.controls.moveForward(-this.velocity.z); // Use negative Z for forward relative to camera

        // Apply bounds - consider making bounds dynamic based on level layout later
        this.cameraObject.position.x = Math.max(KITCHEN_BOUNDS.xMin, Math.min(KITCHEN_BOUNDS.xMax, this.cameraObject.position.x));
        this.cameraObject.position.z = Math.max(KITCHEN_BOUNDS.zMin, Math.min(KITCHEN_BOUNDS.zMax, this.cameraObject.position.z));
        this.cameraObject.position.y = PLAYER_HEIGHT;

        this._updateHeldItemPosition();
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