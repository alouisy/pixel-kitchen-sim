// src/controls.js
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js'; // Import THREE
import { PointerLockControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/PointerLockControls.js';

const GAMEPAD_DEADZONE = 0.15; // Axis values below this are ignored
const GAMEPAD_INTERACT_BUTTON = 0; // Index 0 ('Cross' on PS, 'A' on Xbox)
const GAMEPAD_LOOK_SENSITIVITY_X = 2.0;
const GAMEPAD_LOOK_SENSITIVITY_Y = 1.5;

// Helper for vertical look clamping
const _euler = new THREE.Euler(0, 0, 0, 'YXZ'); // Use YXZ order like PointerLockControls
const _PI_2 = Math.PI / 2;

export class PlayerControls {
    constructor(camera, domElement) {
        this._pointerLockControls = new PointerLockControls(camera, domElement);
        this._camera = camera; // Store reference to the actual camera

        // Keyboard states        
        this.kbMovingForward = false;
        this.kbMovingBackward = false;
        this.kbMovingLeft = false;
        this.kbMovingRight = false;

        // Gamepad movement states
        this.gpMovingForward = false;
        this.gpMovingBackward = false;
        this.gpMovingLeft = false;
        this.gpMovingRight = false;

        this.gamepadConnected = false;
        this.prevGamepadButtons = []; // Store previous frame's button states

        this.interactRequested = false; // Flag for interaction requests

        this.instructions = document.getElementById('instructions');
        this.crosshair = document.getElementById('crosshair');

        this._addEventListeners();
    }

    _addEventListeners() {
        this.instructions.addEventListener('click', () => {
            this._pointerLockControls.lock();
        });

        this._pointerLockControls.addEventListener('lock', () => {
            this.instructions.style.display = 'none';
            this.crosshair.style.display = 'block';
        });

        this._pointerLockControls.addEventListener('unlock', () => {
            this.instructions.style.display = '';
            this.crosshair.style.display = 'none';
            // Reset movement keys on unlock to prevent sticky movement
            this.kbMovingForward = this.kbMovingBackward = this.kbMovingLeft = this.kbMovingRight = false;
        });

        document.addEventListener('keydown', (event) => this._onKeyDown(event));
        document.addEventListener('keyup', (event) => this._onKeyUp(event));
        document.addEventListener('click', () => this._onClick());

        // --- Optional: Listen for gamepad connection/disconnection ---
        window.addEventListener('gamepadconnected', (event) => {
            console.log('Gamepad connected:', event.gamepad.id);
            this.gamepadConnected = true;
            // You could store the specific gamepad index here if needed
        });

        window.addEventListener('gamepaddisconnected', (event) => {
            console.log('Gamepad disconnected:', event.gamepad.id);
            this.gamepadConnected = false;
            // Reset gamepad-specific states if necessary
            this.prevGamepadButtons = [];
        });
    }

    handleGamepadInput(gamepad, delta) {
        if (!gamepad) {
            // Clear previous state if gamepad disconnects mid-game without event firing
            this.prevGamepadButtons = [];
            this.gpMovingForward = this.gpMovingBackward = this.gpMovingLeft = this.gpMovingRight = false;
            return;
        }

        // --- Movement (Left Stick) ---
        const leftStickX = gamepad.axes[0] ?? 0; // Axis 0: Left (-1) to Right (+1)
        const leftStickY = gamepad.axes[1] ?? 0; // Axis 1: Up (-1) to Down (+1)

        // Apply deadzone and update movement flags (don't overwrite keyboard)
        const moveZ = Math.abs(leftStickY) > GAMEPAD_DEADZONE ? -leftStickY : 0; // Invert Y-axis
        const moveX = Math.abs(leftStickX) > GAMEPAD_DEADZONE ? leftStickX : 0;

        // Set flags based on gamepad input - these will be combined with keyboard later
        this.gpMovingForward = moveZ > 0;
        this.gpMovingBackward = moveZ < 0;
        this.gpMovingLeft = moveX < 0;
        this.gpMovingRight = moveX > 0;


        // --- Interaction (Button 0 - Cross/A) ---
        const interactButtonPressed = gamepad.buttons[GAMEPAD_INTERACT_BUTTON]?.pressed ?? false;
        const prevInteractButtonPressed = this.prevGamepadButtons[GAMEPAD_INTERACT_BUTTON] ?? false;

        if (interactButtonPressed && !prevInteractButtonPressed && this._pointerLockControls.isLocked) {
            this.interactRequested = true; // Trigger interaction on button press
        }

        // Store current button states for next frame comparison
        this.prevGamepadButtons = gamepad.buttons.map(b => b.pressed);

        // --- Right Stick Look (Deferred) ---
        // const rightStickX = gamepad.axes[2] ?? 0;
        // const rightStickY = gamepad.axes[3] ?? 0;
        // if (Math.abs(rightStickX) > GAMEPAD_DEADZONE) { /* Rotate camera horizontally */ }
        // if (Math.abs(rightStickY) > GAMEPAD_DEADZONE) { /* Rotate camera vertically */ }
        // --- Right Stick Look
        if (this._pointerLockControls.isLocked) { // Only look if locked
            const rightStickX = gamepad.axes[2] ?? 0; // Axis 2: Horizontal
            const rightStickY = gamepad.axes[3] ?? 0; // Axis 3: Vertical

            const lookSpeedX = delta * GAMEPAD_LOOK_SENSITIVITY_X;
            const lookSpeedY = delta * GAMEPAD_LOOK_SENSITIVITY_Y;

            let deltaYaw = 0;
            let deltaPitch = 0;

            if (Math.abs(rightStickX) > GAMEPAD_DEADZONE) {
                deltaYaw = -rightStickX * lookSpeedX; // Negative because stick right should turn right (negative yaw change in THREE's default)
            }
            if (Math.abs(rightStickY) > GAMEPAD_DEADZONE) {
                deltaPitch = -rightStickY * lookSpeedY; // Negative because stick down should look down (negative pitch change)
            }

            if (deltaYaw !== 0 || deltaPitch !== 0) {
                // Apply rotation manually
                const yawObject = this._pointerLockControls.getObject(); // The object controlling yaw (Y rotation)
                const pitchObject = this._camera; // The camera object controlling pitch (X rotation)

                _euler.setFromQuaternion(pitchObject.quaternion, 'YXZ'); // Get current pitch rotation

                _euler.y = 0; // Isolate pitch
                _euler.x += deltaPitch; // Apply pitch change

                // Clamp vertical look (pitch) like PointerLockControls does
                _euler.x = Math.max(_PI_2 - this._pointerLockControls.maxPolarAngle, Math.min(_PI_2 - this._pointerLockControls.minPolarAngle, _euler.x));

                pitchObject.quaternion.setFromEuler(_euler); // Apply clamped pitch back to camera

                // Apply yaw change to the parent object
                yawObject.rotation.y += deltaYaw;
            }
        }
    }

    _onKeyDown(event) {
        if (!this._pointerLockControls.isLocked) return;
        switch (event.code) {
            case 'KeyW': case 'ArrowUp': this.kbMovingForward = true; break;
            case 'KeyA': case 'ArrowLeft': this.kbMovingLeft = true; break;
            case 'KeyS': case 'ArrowDown': this.kbMovingBackward = true; break;
            case 'KeyD': case 'ArrowRight': this.kbMovingRight = true; break;
        }
    }

    _onKeyUp(event) {
        // No need to check isLocked here, always reset keys
        switch (event.code) {
            case 'KeyW': case 'ArrowUp': this.kbMovingForward = false; break;
            case 'KeyA': case 'ArrowLeft': this.kbMovingLeft = false; break;
            case 'KeyS': case 'ArrowDown': this.kbMovingBackward = false; break;
            case 'KeyD': case 'ArrowRight': this.kbMovingRight = false; break;
        }
    }

    _onClick() {
        if (this._pointerLockControls.isLocked) {
            this.interactRequested = true; // Set flag on click
        }
    }

    // Method to get movement input vector (direction only)
    getMovementInput() {
        const direction = { x: 0, z: 0 };

        const forward = this.kbMovingForward || this.gpMovingForward;
        const backward = this.kbMovingBackward || this.gpMovingBackward;
        const left = this.kbMovingLeft || this.gpMovingLeft;
        const right = this.kbMovingRight || this.gpMovingRight;

        if (forward) direction.z -= 1;
        if (backward) direction.z += 1;
        if (left) direction.x -= 1;
        if (right) direction.x += 1;

        // Reset gamepad flags each time input is read, as they are set fresh each frame
        this.gpMovingForward = this.gpMovingBackward = this.gpMovingLeft = this.gpMovingRight = false;

        return direction; // Not normalized here, handled in Player update
    }

    // Method to check and consume the interaction request
    consumeInteractionRequest() {
        if (this.interactRequested) {
            this.interactRequested = false; // Reset flag after checking
            return true;
        }
        return false;
    }

    get isLocked() {
        return this._pointerLockControls.isLocked;
    }

    // Expose the underlying PointerLockControls object if needed
    get object() {
        return this._pointerLockControls.getObject();
    }

    // Expose moveForward/moveRight methods for player movement
    moveForward(distance) {
        this._pointerLockControls.moveForward(distance);
    }

    moveRight(distance) {
        this._pointerLockControls.moveRight(distance);
    }
}