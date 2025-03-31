// src/controls.js
import { PointerLockControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/PointerLockControls.js';
import {
    GAMEPAD_DEADZONE, GAMEPAD_INTERACT_BUTTON, GAMEPAD_PAUSE_BUTTON,
    GAMEPAD_LOOK_SENSITIVITY_X, GAMEPAD_LOOK_SENSITIVITY_Y,
    GAMEPAD_INSTRUCTIONS_BUTTON, KEYBOARD_INSTRUCTIONS_KEY // Import new constants
} from './constants.js';

export class PlayerControls {
    constructor(camera, domElement) {
        this._pointerLockControls = new PointerLockControls(camera, domElement);
        this._domElement = domElement;

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
        this.prevGamepadButtons = [];

        this.interactRequested = false;
        this.pauseToggleRequested = false;
        this.instructionToggleRequested = false; // Added flag for instructions

        this.crosshair = document.getElementById('crosshair'); // Keep crosshair reference

        this._addEventListeners();
    }

    _addEventListeners() {
        this._pointerLockControls.addEventListener('lock', () => {
            if (this.crosshair) this.crosshair.style.display = 'block'; // Show crosshair on lock
        });

        this._pointerLockControls.addEventListener('unlock', () => {
            if (this.crosshair) this.crosshair.style.display = 'none'; // Hide crosshair on unlock
            // Reset movement keys on unlock
            this.kbMovingForward = this.kbMovingBackward = this.kbMovingLeft = this.kbMovingRight = false;
            this.gpMovingForward = this.gpMovingBackward = this.gpMovingLeft = this.gpMovingRight = false;
        });

        document.addEventListener('keydown', (event) => this._onKeyDown(event));
        document.addEventListener('keyup', (event) => this._onKeyUp(event));
        document.addEventListener('click', () => this._onClick());

        window.addEventListener('gamepadconnected', (event) => {
            console.log('Gamepad connected:', event.gamepad.id);
            this.gamepadConnected = true;
        });

        window.addEventListener('gamepaddisconnected', (event) => {
            console.log('Gamepad disconnected:', event.gamepad.id);
            this.gamepadConnected = false;
            this.prevGamepadButtons = [];
            this.gpMovingForward = this.gpMovingBackward = this.gpMovingLeft = this.gpMovingRight = false;
        });
    }

    handleGamepadInput(gamepad, delta) {
        const wasConnected = this.gamepadConnected;
        this.gamepadConnected = !!gamepad;

        if (!gamepad) {
            if (wasConnected) {
                this.prevGamepadButtons = [];
                this.gpMovingForward = this.gpMovingBackward = this.gpMovingLeft = this.gpMovingRight = false;
            }
            return;
        }

        // --- Movement (Left Stick) ---
        const leftStickX = gamepad.axes[0] ?? 0;
        const leftStickY = gamepad.axes[1] ?? 0;
        const moveZ = Math.abs(leftStickY) > GAMEPAD_DEADZONE ? -leftStickY : 0;
        const moveX = Math.abs(leftStickX) > GAMEPAD_DEADZONE ? leftStickX : 0;
        this.gpMovingForward = moveZ > 0;
        this.gpMovingBackward = moveZ < 0;
        this.gpMovingLeft = moveX < 0;
        this.gpMovingRight = moveX > 0;

        // --- Button Presses (Edge Detection) ---
        const currentButtons = gamepad.buttons.map(b => b.pressed);
        const buttonJustPressed = (index) => currentButtons[index] && !(this.prevGamepadButtons[index] ?? false);

        // --- Request Flags ---
        // Interaction (Cross/A) - only if pointer locked
        if (this._pointerLockControls.isLocked && buttonJustPressed(GAMEPAD_INTERACT_BUTTON)) {
            this.interactRequested = true;
        }
        // Pause (Options/Menu)
        if (buttonJustPressed(GAMEPAD_PAUSE_BUTTON)) {
            this.pauseToggleRequested = true;
        }
        // Instructions (Triangle/Y)
        if (buttonJustPressed(GAMEPAD_INSTRUCTIONS_BUTTON)) {
            this.instructionToggleRequested = true;
        }

        // Store current button states for next frame's edge detection
        this.prevGamepadButtons = currentButtons;

        // --- Right Stick Look (Synthetic Mouse Events) ---
        if (this._pointerLockControls.isLocked) {
            const rightStickX = gamepad.axes[2] ?? 0;
            const rightStickY = gamepad.axes[3] ?? 0;
            let movementX = 0;
            let movementY = 0;

            if (Math.abs(rightStickX) > GAMEPAD_DEADZONE) {
                movementX = rightStickX * GAMEPAD_LOOK_SENSITIVITY_X * delta;
            }
            if (Math.abs(rightStickY) > GAMEPAD_DEADZONE) {
                movementY = rightStickY * GAMEPAD_LOOK_SENSITIVITY_Y * delta;
            }

            if (movementX !== 0 || movementY !== 0) {
                const event = new MouseEvent('mousemove', {
                    movementX: movementX,
                    movementY: movementY,
                    bubbles: true,
                    cancelable: true
                });
                this._domElement.dispatchEvent(event);
            }
        }
    }

    _onKeyDown(event) {
        // Handle non-movement keys first, regardless of lock state
        if (event.code === 'KeyP') { // Pause
            this.pauseToggleRequested = true;
            return;
        }
        if (event.code === KEYBOARD_INSTRUCTIONS_KEY) { // Instructions
            this.instructionToggleRequested = true;
            return;
        }

        // Only process movement if pointer is locked
        if (!this._pointerLockControls.isLocked) return;
        switch (event.code) {
            case 'KeyW': case 'ArrowUp': this.kbMovingForward = true; break;
            case 'KeyA': case 'ArrowLeft': this.kbMovingLeft = true; break;
            case 'KeyS': case 'ArrowDown': this.kbMovingBackward = true; break;
            case 'KeyD': case 'ArrowRight': this.kbMovingRight = true; break;
        }
    }

    _onKeyUp(event) {
        // Always reset keys on keyup, regardless of lock state
        switch (event.code) {
            case 'KeyW': case 'ArrowUp': this.kbMovingForward = false; break;
            case 'KeyA': case 'ArrowLeft': this.kbMovingLeft = false; break;
            case 'KeyS': case 'ArrowDown': this.kbMovingBackward = false; break;
            case 'KeyD': case 'ArrowRight': this.kbMovingRight = false; break;
        }
    }

    _onClick() {
        // Request interaction only if pointer is locked
        if (this._pointerLockControls.isLocked) {
            this.interactRequested = true;
        }
        // If not locked, clicks are handled by the menu system (handleMenuAction in main.js)
    }

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

        // Reset gamepad flags each frame after reading (movement only)
        this.gpMovingForward = this.gpMovingBackward = this.gpMovingLeft = this.gpMovingRight = false;

        return direction;
    }

    consumeInteractionRequest() {
        if (this.interactRequested) {
            this.interactRequested = false;
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

    consumeInstructionToggleRequest() { // New consumer method
        if (this.instructionToggleRequested) {
            this.instructionToggleRequested = false;
            return true;
        }
        return false;
    }


    get isLocked() {
        return this._pointerLockControls.isLocked;
    }

    get object() {
        return this._pointerLockControls.getObject();
    }

    // Explicit lock/unlock methods called by main.js state changes
    lock() {
        this._pointerLockControls.lock();
    }

    unlock() {
        this._pointerLockControls.unlock();
    }

    moveForward(distance) {
        this._pointerLockControls.moveForward(distance);
    }

    moveRight(distance) {
        this._pointerLockControls.moveRight(distance);
    }
}