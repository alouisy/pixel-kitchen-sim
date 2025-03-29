// src/player.js
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { PLAYER_HEIGHT, PLAYER_SPEED, KITCHEN_BOUNDS } from './constants.js';
import { removeInteractable, addInteractable } from './world.js';

export class Player {
    constructor(controls) {
        this.controls = controls;
        this.cameraObject = controls.object;
        this.velocity = new THREE.Vector3();
        this.holdingItem = null;
        this.scene = null;

        this.holdPositionHelper = new THREE.Object3D();
        this.holdPositionHelper.position.set(0, -0.3, -0.8);
        this.cameraObject.add(this.holdPositionHelper);
    }

    update(delta, movementInput) {
        if (!this.controls.isLocked) {
            return;
        }

        const speed = PLAYER_SPEED * delta;
        this.velocity.set(movementInput.x, 0, movementInput.z);

        if (this.velocity.lengthSq() > 0) {
            this.velocity.normalize().multiplyScalar(speed);
        } else {
            this.velocity.set(0, 0, 0);
        }

        this.controls.moveRight(this.velocity.x);
        this.controls.moveForward(-this.velocity.z);

        this.cameraObject.position.x = Math.max(KITCHEN_BOUNDS.xMin, Math.min(KITCHEN_BOUNDS.xMax, this.cameraObject.position.x));
        this.cameraObject.position.z = Math.max(KITCHEN_BOUNDS.zMin, Math.min(KITCHEN_BOUNDS.zMax, this.cameraObject.position.z));
        this.cameraObject.position.y = PLAYER_HEIGHT;

        this._updateHeldItemPosition();
    }

    _updateHeldItemPosition() {
        if (this.holdingItem) {
            const targetPosition = new THREE.Vector3();
            this.holdPositionHelper.getWorldPosition(targetPosition);
            this.holdingItem.position.lerp(targetPosition, 0.3);

            const targetRotation = new THREE.Quaternion();
            this.cameraObject.getWorldQuaternion(targetRotation);
            this.holdingItem.quaternion.slerp(targetRotation, 0.2);
        }
    }

    pickup(item) {
        if (this.holdingItem || !this.scene) return false;

        this.holdingItem = item;
        removeInteractable(item); // Remove from world list/scene temporarily
        this.scene.add(item); // Re-add to scene directly for positioning

        if (typeof item.raycast === 'function') {
            item.userData.originalRaycast = item.raycast;
        }
        item.raycast = () => { };

        // console.log("Player picked up:", item.name);
        return true;
    }

    place() {
        if (!this.holdingItem) return null;

        const item = this.holdingItem;
        if (item.userData.originalRaycast) {
            item.raycast = item.userData.originalRaycast;
            delete item.userData.originalRaycast;
        }
        // InteractionManager handles adding back to interactables/scene on placement/drop
        this.holdingItem = null;
        // console.log("Player released:", item.name);
        return item;
    }

    // --- NEW METHOD ---
    // Forcefully drops the item without placing logic, optionally removing from scene
    forceDropItem() {
        if (!this.holdingItem) return;

        console.log(`Player force dropping: ${this.holdingItem.name}`);
        const item = this.holdingItem;

        // Re-enable raycasting just in case
        if (item.userData.originalRaycast) {
            item.raycast = item.userData.originalRaycast;
            delete item.userData.originalRaycast;
        }

        // Remove the item completely - it shouldn't be placed anywhere
        removeInteractable(item); // Removes from list and scene graph

        this.holdingItem = null;
    }
    // --- END NEW METHOD ---


    getHeldItem() {
        return this.holdingItem;
    }

    getPosition() {
        return this.cameraObject.position;
    }

    setScene(scene) {
        this.scene = scene;
    }
}