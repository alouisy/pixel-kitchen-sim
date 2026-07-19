// src/controls.js
import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import {
    GAMEPAD_DEADZONE, GAMEPAD_INTERACT_BUTTON, GAMEPAD_PAUSE_BUTTON,
    GAMEPAD_LOOK_SENSITIVITY_X, GAMEPAD_LOOK_SENSITIVITY_Y,
    GAMEPAD_INSTRUCTIONS_BUTTON, KEYBOARD_INSTRUCTIONS_KEY,
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
        this.instructionToggleRequested = false;

        this.crosshair = document.getElementById('crosshair'); // Keep crosshair reference

        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        this.mobileControlsActive = false;
        this.leftJoystickInput = { x: 0, y: 0 };

        // Swipe-to-Look camera properties
        this.lookTouchId = null;
        this.lookLastX = 0;
        this.lookLastY = 0;
        this.lookDeltaX = 0;
        this.lookDeltaY = 0;
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchMoved = false;

        // Settings sensitivities
        this.sensitivity = 1.0;
        this.mobileLookSensitivity = 1.0;
        this.mobileMoveSensitivity = 1.0;

        this._setupMobileControls();

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
        // Editor Toggle (No standard gamepad button assigned yet)

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
        // Request interaction only if pointer is locked (GAME_RUNNING state)
        // Editor clicks are handled differently in main.js
        if (this._pointerLockControls.isLocked) {
            this.interactRequested = true;
        }
    }

    getMovementInput(delta = 0.016) {
        const direction = { x: 0, z: 0 };
        
        if (this.mobileControlsActive) {
            // Update camera look rotation via swipe touch deltas
            const camera = this._pointerLockControls.getObject();
            if (camera) {
                const euler = new THREE.Euler( 0, 0, 0, 'YXZ' );
                euler.setFromQuaternion( camera.quaternion );

                // Apply touch deltas scaled by mobile look sensitivity
                const baseLookSpeed = 0.003; 
                euler.y -= this.lookDeltaX * baseLookSpeed * this.mobileLookSensitivity;
                euler.x -= this.lookDeltaY * baseLookSpeed * this.mobileLookSensitivity;

                euler.x = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, euler.x));

                camera.quaternion.setFromEuler( euler );
                
                // Clear look accumulation deltas
                this.lookDeltaX = 0;
                this.lookDeltaY = 0;
            }
            
            // Add left joystick movement scaled by mobile move sensitivity
            direction.x = this.leftJoystickInput.x * this.mobileMoveSensitivity;
            direction.z = this.leftJoystickInput.y * this.mobileMoveSensitivity;
            
            if (direction.x !== 0 || direction.z !== 0) {
                return direction;
            }
        }

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

    consumeInstructionToggleRequest() {
        if (this.instructionToggleRequested) {
            this.instructionToggleRequested = false;
            return true;
        }
        return false;
    }

    get isLocked() {
        return this._pointerLockControls.isLocked || this.mobileControlsActive;
    }

    get object() {
        return this._pointerLockControls.getObject();
    }

    // Explicit lock/unlock methods called by main.js state changes
    lock() {
        if (this.isMobile) {
            this.mobileControlsActive = true;
            if (this.mobileOverlay) this.mobileOverlay.style.display = 'block';
            if (this.mobilePauseBtn) this.mobilePauseBtn.style.display = 'flex';
            if (this.crosshair) this.crosshair.style.display = 'block';
        } else {
            this._pointerLockControls.lock();
        }
    }

    unlock() {
        if (this.isMobile) {
            this.mobileControlsActive = false;
            if (this.mobileOverlay) this.mobileOverlay.style.display = 'none';
            if (this.mobilePauseBtn) this.mobilePauseBtn.style.display = 'none';
            if (this.crosshair) this.crosshair.style.display = 'none';
        } else {
            this._pointerLockControls.unlock();
        }
    }

    moveForward(distance) {
        this._pointerLockControls.moveForward(distance);
    }

    moveRight(distance) {
        this._pointerLockControls.moveRight(distance);
    }

    setSensitivity(value) {
        if (this._pointerLockControls) {
            this._pointerLockControls.pointerSpeed = Number(value) || 1.0;
        }
    }

    _setupMobileControls() {
        if (!this.isMobile) return;

        // Create overlay element
        this.mobileOverlay = document.createElement('div');
        this.mobileOverlay.id = 'mobile-controls-overlay';
        this.mobileOverlay.style.cssText = `
            display: none;
            position: absolute;
            bottom: 0;
            left: 0;
            width: 100%;
            height: 180px;
            z-index: 9999;
            pointer-events: none;
            user-select: none;
            -webkit-user-select: none;
        `;

        // Left joystick
        const leftZone = document.createElement('div');
        leftZone.id = 'joystick-left-zone';
        leftZone.style.cssText = `
            position: absolute;
            bottom: 20px;
            left: 20px;
            width: 110px;
            height: 110px;
            border-radius: 50%;
            background: rgba(255,255,255,0.08);
            border: 2px solid rgba(255,255,255,0.25);
            pointer-events: auto;
            display: flex;
            justify-content: center;
            align-items: center;
            touch-action: none;
        `;
        const leftKnob = document.createElement('div');
        leftKnob.style.cssText = `
            width: 45px;
            height: 45px;
            border-radius: 50%;
            background: rgba(255,255,255,0.4);
            box-shadow: 0 0 8px rgba(0,0,0,0.4);
        `;
        leftZone.appendChild(leftKnob);

        this.mobileOverlay.appendChild(leftZone);
        document.body.appendChild(this.mobileOverlay);

        // Pause button
        this.mobilePauseBtn = document.createElement('div');
        this.mobilePauseBtn.id = 'mobile-pause-btn';
        this.mobilePauseBtn.innerText = '⏸';
        this.mobilePauseBtn.addEventListener('touchstart', (e) => {
            e.stopPropagation();
            this.pauseToggleRequested = true;
        }, { passive: true });
        
        document.body.appendChild(this.mobilePauseBtn);

        // Handle Left Joystick touch events
        this._setupJoystickEvents(leftZone, leftKnob, (input) => {
            this.leftJoystickInput = input;
        });

        // Handle touchstart on document for look swipe or interaction
        document.addEventListener('touchstart', (e) => {
            if (!this.mobileControlsActive) return;
            
            for (const touch of e.changedTouches) {
                const leftRect = leftZone.getBoundingClientRect();
                const pauseRect = this.mobilePauseBtn.getBoundingClientRect();
                
                const insideLeft = touch.clientX >= leftRect.left && touch.clientX <= leftRect.right &&
                                   touch.clientY >= leftRect.top && touch.clientY <= leftRect.bottom;
                const insidePause = touch.clientX >= pauseRect.left && touch.clientX <= pauseRect.right &&
                                    touch.clientY >= pauseRect.top && touch.clientY <= pauseRect.bottom;
                                    
                if (!insideLeft && !insidePause) {
                    if (this.lookTouchId === null) {
                        this.lookTouchId = touch.identifier;
                        this.lookLastX = touch.clientX;
                        this.lookLastY = touch.clientY;
                        this.touchStartX = touch.clientX;
                        this.touchStartY = touch.clientY;
                        this.touchMoved = false;
                    }
                }
            }
        }, { passive: true });

        document.addEventListener('touchmove', (e) => {
            if (!this.mobileControlsActive || this.lookTouchId === null) return;
            
            const touch = Array.from(e.touches).find(t => t.identifier === this.lookTouchId);
            if (!touch) return;
            
            const dx = touch.clientX - this.lookLastX;
            const dy = touch.clientY - this.lookLastY;
            
            this.lookLastX = touch.clientX;
            this.lookLastY = touch.clientY;
            
            const dist = Math.sqrt((touch.clientX - this.touchStartX) ** 2 + (touch.clientY - this.touchStartY) ** 2);
            if (dist > 8) {
                this.touchMoved = true;
            }
            
            this.lookDeltaX += dx;
            this.lookDeltaY += dy;
        }, { passive: true });

        const handleTouchEnd = (e) => {
            if (!this.mobileControlsActive || this.lookTouchId === null) return;
            
            const touch = Array.from(e.changedTouches).find(t => t.identifier === this.lookTouchId);
            if (!touch) return;
            
            if (!this.touchMoved) {
                this.interactRequested = true;
            }
            
            this.lookTouchId = null;
            this.touchMoved = false;
        };
        
        document.addEventListener('touchend', handleTouchEnd, { passive: true });
        document.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    }

    _setupJoystickEvents(zone, knob, onInput) {
        const maxDist = 40; // max displacement in pixels
        let touchId = null;
        let startX = 0;
        let startY = 0;

        zone.addEventListener('touchstart', (e) => {
            if (touchId !== null) return;
            const touch = Array.from(e.changedTouches).find(t => t.target === zone || zone.contains(t.target));
            if (!touch) return;
            
            touchId = touch.identifier;
            const rect = zone.getBoundingClientRect();
            startX = rect.left + rect.width / 2;
            startY = rect.top + rect.height / 2;
            
            knob.style.transition = 'none';
        }, { passive: true });

        const handleMove = (e) => {
            if (touchId === null) return;
            const touch = Array.from(e.touches).find(t => t.identifier === touchId);
            if (!touch) return;

            let dx = touch.clientX - startX;
            let dy = touch.clientY - startY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > maxDist) {
                dx = (dx / dist) * maxDist;
                dy = (dy / dist) * maxDist;
            }

            knob.style.transform = `translate(${dx}px, ${dy}px)`;
            onInput({ x: dx / maxDist, y: dy / maxDist });
        };

        const handleEnd = (e) => {
            if (touchId === null) return;
            const touch = Array.from(e.changedTouches).find(t => t.identifier === touchId);
            if (!touch) return;

            touchId = null;
            knob.style.transition = 'transform 0.15s ease-out';
            knob.style.transform = 'translate(0px, 0px)';
            onInput({ x: 0, y: 0 });
        };

        window.addEventListener('touchmove', handleMove, { passive: true });
        window.addEventListener('touchend', handleEnd, { passive: true });
        window.addEventListener('touchcancel', handleEnd, { passive: true });
    }
}