// src/player.js
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { PLAYER_HEIGHT, PLAYER_SPEED, KITCHEN_BOUNDS } from './constants.js';

export class Player {
    constructor(controls) {
        console.log('Player received controls:', controls); // Check the object passed in
        this.controls = controls; // The PlayerControls instance
        this.cameraObject = controls.object; // The camera rig from PointerLockControls
        this.velocity = new THREE.Vector3();
        this.holdingItem = null;
    }

    update(delta, movementInput) {
        // console.log('Player update - this.controls:', this.controls); // Check the object right before the error
        if (!this.controls.isLocked) {
            // console.log('Controls not locked');
            return; // Don't move if pointer isn't locked
        }

        const speed = PLAYER_SPEED * delta;
        this.velocity.set(movementInput.x, 0, movementInput.z);
        // Normalize only if there's input to avoid normalizing a zero vector (results in NaN)
        if (this.velocity.lengthSq() > 0) {
            this.velocity.normalize().multiplyScalar(speed);
        } else {
            this.velocity.set(0, 0, 0); // Ensure velocity is zero if no input
        }
        // Apply movement based on camera direction
        this.controls.moveRight(this.velocity.x);
        this.controls.moveForward(-this.velocity.z);

        // Apply simple boundary collision
        this.cameraObject.position.x = Math.max(KITCHEN_BOUNDS.xMin, Math.min(KITCHEN_BOUNDS.xMax, this.cameraObject.position.x));
        this.cameraObject.position.z = Math.max(KITCHEN_BOUNDS.zMin, Math.min(KITCHEN_BOUNDS.zMax, this.cameraObject.position.z));

        // Keep player at constant height (no jumping/gravity)
        this.cameraObject.position.y = PLAYER_HEIGHT;

        // Update held item position smoothly
        this._updateHeldItemPosition();
    }

    _updateHeldItemPosition() {
        if (this.holdingItem) {
            const cameraDirection = new THREE.Vector3();
            this.cameraObject.getWorldDirection(cameraDirection); // Use cameraObject for direction
            const offset = cameraDirection.multiplyScalar(0.8); // Distance in front
            const targetPosition = this.cameraObject.position.clone().add(offset);
            targetPosition.y -= 0.3; // Lower it slightly

            // Smoothly move item towards target position
            this.holdingItem.position.lerp(targetPosition, 0.3);
            this.holdingItem.rotation.set(0, this.cameraObject.rotation.y, 0); // Match player's horizontal rotation
        }
    }

    pickup(item) {
        if (this.holdingItem) return false; // Already holding something

        this.holdingItem = item;
        // Disable raycasting for the held item so we don't interact with it
        this.holdingItem.userData.originalRaycast = this.holdingItem.raycast;
        this.holdingItem.raycast = () => { };
        console.log("Picked up:", item.name);
        return true;
    }

    // Returns the item and clears the player's hold
    place() {
        if (!this.holdingItem) return null;

        const item = this.holdingItem;
        // Re-enable raycasting
        if (item.userData.originalRaycast) {
            item.raycast = item.userData.originalRaycast;
            delete item.userData.originalRaycast;
        }
        this.holdingItem = null;
        console.log("Placed/Used:", item.name);
        return item;
    }

    getHeldItem() {
        return this.holdingItem;
    }

    getPosition() {
        return this.cameraObject.position;
    }
}