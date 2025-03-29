// src/controls.js
import { PointerLockControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/PointerLockControls.js';
import { GAMEPAD_DEADZONE, GAMEPAD_INTERACT_BUTTON, GAMEPAD_PAUSE_BUTTON, GAMEPAD_LOOK_SENSITIVITY_X, GAMEPAD_LOOK_SENSITIVITY_Y } from './constants.js'; // Import new constant

export class PlayerControls {
    constructor(camera, domElement) {
        this._pointerLockControls = new PointerLockControls(camera, domElement);
        this._domElement = domElement; // Store reference to the element controls listen on

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
            // Don't show instructions automatically on unlock if pausing
            if (!document.getElementById('settings-menu').style.display || document.getElementById('settings-menu').style.display === 'none') {
                this.instructions.style.display = ''; // Show only if not paused
            }
            this.crosshair.style.display = 'none';
            // Reset movement keys on unlock to prevent sticky movement
            this.kbMovingForward = this.kbMovingBackward = this.kbMovingLeft = this.kbMovingRight = false;
            this.gpMovingForward = this.gpMovingBackward = this.gpMovingLeft = this.gpMovingRight = false; // Reset flags
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
            this.gpMovingForward = this.gpMovingBackward = this.gpMovingLeft = this.gpMovingRight = false; // Reset flags
        });
    }

    handleGamepadInput(gamepad, delta) {
        const wasConnected = this.gamepadConnected;
        this.gamepadConnected = !!gamepad; // Update connection status based on presence

        if (!gamepad) {
            if (wasConnected) { // Only clear if it *was* connected
                this.prevGamepadButtons = [];
                this.gpMovingForward = this.gpMovingBackward = this.gpMovingLeft = this.gpMovingRight = false;
            }
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

        const pauseButtonPressed = gamepad.buttons[GAMEPAD_PAUSE_BUTTON]?.pressed ?? false;
        const prevPauseButtonPressed = this.prevGamepadButtons[GAMEPAD_PAUSE_BUTTON] ?? false;

        // Check if instructions are visible (game not started/locked)
        const isInstructionsVisible = this.instructions.style.display !== 'none';
        if (isInstructionsVisible && interactButtonPressed && !prevInteractButtonPressed) {
            this._pointerLockControls.lock(); // Lock pointer to start
        }

        if (this._pointerLockControls.isLocked && interactButtonPressed && !prevInteractButtonPressed) {
            this.interactRequested = true; // Trigger interaction on button press
        }

        if (pauseButtonPressed && !prevPauseButtonPressed) {
            this.pauseToggleRequested = true; // Signal pause toggle
            console.log("Pause toggle requested via gamepad."); // Debug log
        }

        // Store current button states for next frame comparison
        this.prevGamepadButtons = gamepad.buttons.map(b => b.pressed);

        // --- Right Stick Look (Deferred) ---
        // const rightStickX = gamepad.axes[2] ?? 0;
        // const rightStickY = gamepad.axes[3] ?? 0;
        // if (Math.abs(rightStickX) > GAMEPAD_DEADZONE) { /* Rotate camera horizontally */ }
        // if (Math.abs(rightStickY) > GAMEPAD_DEADZONE) { /* Rotate camera vertically */ }
        // --- Right Stick Look (Synthetic Mouse Events) ---
        if (this._pointerLockControls.isLocked) { // Only look if locked
            const rightStickX = gamepad.axes[2] ?? 0; // Axis 2: Horizontal
            const rightStickY = gamepad.axes[3] ?? 0; // Axis 3: Vertical

            let movementX = 0;
            let movementY = 0;

            if (Math.abs(rightStickX) > GAMEPAD_DEADZONE) {
                // Stick right (+X) should cause positive movementX
                movementX = rightStickX * GAMEPAD_LOOK_SENSITIVITY_X * delta;
            }
            if (Math.abs(rightStickY) > GAMEPAD_DEADZONE) {
                // Stick down (+Y) should cause positive movementY
                movementY = rightStickY * GAMEPAD_LOOK_SENSITIVITY_Y * delta;
            }

            if (movementX !== 0 || movementY !== 0) {
                // Dispatch a synthetic mousemove event
                const event = new MouseEvent('mousemove', {
                    movementX: movementX,
                    movementY: movementY,
                    bubbles: true, // Necessary for event to propagate
                    cancelable: true
                });
                // Dispatch on the element PointerLockControls is listening to
                this._domElement.dispatchEvent(event);
            }
        }
    }

    _onKeyDown(event) {
        if (event.code === 'KeyP') {
            this.pauseToggleRequested = true;
            console.log("Pause toggle requested via keyboard."); // Debug log
            return; // Don't process movement keys if pause is pressed
        }

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

    consumePauseToggleRequest() {
        if (this.pauseToggleRequested) {
            this.pauseToggleRequested = false;
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

    lock() {
        this._pointerLockControls.lock();
    }

    unlock() {
        this._pointerLockControls.unlock();
    }

    // Expose moveForward/moveRight methods for player movement
    moveForward(distance) {
        this._pointerLockControls.moveForward(distance);
    }

    moveRight(distance) {
        this._pointerLockControls.moveRight(distance);
    }
}