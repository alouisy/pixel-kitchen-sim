// src/menuManager.js

const GAMEPAD_DEADZONE_NAV = 0.5;
const GAMEPAD_NAV_DELAY = 150;
const GAMEPAD_CONFIRM_BUTTON = 0; // Cross (X) / A
const GAMEPAD_BACK_BUTTON = 1;    // Circle / B

export class MenuManager {
    constructor(uiManager) {
        this.uiManager = uiManager;
        this.activeMenuElement = null;
        this.focusableElements = [];
        this.selectedIndex = -1;
        this.gamepadNavTimer = 0;
        this.prevGamepadButtons = []; // Store previous frame's buttons
        this._addEventListeners(); // Add listeners during construction
    }

    _addEventListeners() {
        document.addEventListener('mouseover', (event) => {
            if (!this.activeMenuElement) return;
            const target = event.target.closest('.menu-button, .menu-link, .menu-toggle');
            if (target && this.focusableElements.includes(target)) {
                const index = this.focusableElements.indexOf(target);
                if (index !== this.selectedIndex) {
                    this.setSelectedIndex(index);
                }
            }
        });

        document.addEventListener('mouseout', (event) => {
            if (!this.activeMenuElement) return;
            const target = event.target.closest('.menu-button, .menu-link, .menu-toggle');
            if (target && this.focusableElements.includes(target)) {
                const relatedTarget = event.relatedTarget;
                if (!relatedTarget || !target.contains(relatedTarget)) {
                    const index = this.focusableElements.indexOf(target);
                    if (index === this.selectedIndex) {
                        this.setSelectedIndex(-1);
                    }
                }
            }
        });

        // Clicks are handled by main.js calling handleMenuAction
    }

    activateMenu(menuElement) {
        this.setSelectedIndex(-1); // Clean up previous selection before switching menus

        if (!menuElement) {
            this.deactivateMenu();
            return;
        }
        this.activeMenuElement = menuElement;
        this.refreshFocusableElements();

        let defaultIndex = 0;
        // Prioritize specific buttons like "Resume" or "Start" if they exist and are visible
        const priorityActions = ['save-nickname', 'start-level-confirm', 'resume', 'next-level', 'restart-level'];
        let priorityButtonFound = false;
        for (const action of priorityActions) {
            const button = menuElement.querySelector(`[data-action="${action}"]`);
            if (button && button.offsetParent !== null && !button.disabled) { // Check visibility and enabled
                const buttonIndex = this.focusableElements.indexOf(button);
                if (buttonIndex > -1) {
                    defaultIndex = buttonIndex;
                    priorityButtonFound = true;
                    break;
                }
            }
        }

        // Fallback to first non-link element if no priority button found
        if (!priorityButtonFound) {
            const firstButtonIndex = this.focusableElements.findIndex(el => el.tagName === 'BUTTON' || el.tagName === 'INPUT');
            if (firstButtonIndex > -1) defaultIndex = firstButtonIndex;
        }

        this.defaultIndex = defaultIndex;
        this.setSelectedIndex(-1); // Start with NO element selected visually
        this.prevGamepadButtons = []; // Reset button history when menu activates
        this.gamepadNavTimer = GAMEPAD_NAV_DELAY; // Add initial delay
    }

    deactivateMenu() {
        this.setSelectedIndex(-1); // Deselect current item visually
        this.activeMenuElement = null;
        this.focusableElements = [];
        this.selectedIndex = -1;
    }

    refreshFocusableElements() {
        if (!this.activeMenuElement) {
            this.focusableElements = [];
            return;
        }
        this.focusableElements = Array.from(
            this.activeMenuElement.querySelectorAll('.menu-button, .menu-link, .menu-toggle')
        ).filter(el => el.offsetParent !== null && !el.disabled); // Check visibility and disabled state

        // console.log("Focusable elements:", this.focusableElements.map(el => el.id || el.dataset.action));
    }

    setSelectedIndex(index) {
        if (!this.activeMenuElement || !this.focusableElements.length) {
            index = -1;
        }

        // Clamp index
        index = Math.max(-1, Math.min(index, this.focusableElements.length - 1));


        if (this.selectedIndex >= 0 && this.selectedIndex < this.focusableElements.length) {
            this.focusableElements[this.selectedIndex].classList.remove('selected');
        }

        this.selectedIndex = index;

        if (this.selectedIndex >= 0 && this.selectedIndex < this.focusableElements.length) {
            this.focusableElements[this.selectedIndex].classList.add('selected');
            // Scroll into view if needed (especially for level select)
            this.focusableElements[this.selectedIndex].scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
    }

    // Returns object { action: string, element: HTMLElement } if confirmed, or null
    handleGamepadNav(gamepad, delta) {
        if (!this.activeMenuElement || !this.focusableElements.length) return null;

        // Update button states for edge detection (pressed this frame, not last)
        const currentButtons = gamepad.buttons.map(b => b.pressed);
        const buttonJustPressed = (index) => currentButtons[index] && !this.prevGamepadButtons[index];

        this.gamepadNavTimer -= delta * 1000;

        let navX = gamepad.axes[0] ?? 0;
        let navY = gamepad.axes[1] ?? 0;
        // Use buttonJustPressed for dpad to avoid continuous scrolling
        let dpadUp = buttonJustPressed(12);
        let dpadDown = buttonJustPressed(13);
        let dpadLeft = buttonJustPressed(14);
        let dpadRight = buttonJustPressed(15);

        let moveVertical = 0;
        let moveHorizontal = 0;
        let stickMovedV = false;
        let stickMovedH = false;

        // Check stick movement only if timer allows
        if (this.gamepadNavTimer <= 0) {
            if (navY > GAMEPAD_DEADZONE_NAV) { moveVertical = 1; stickMovedV = true; }
            else if (navY < -GAMEPAD_DEADZONE_NAV) { moveVertical = -1; stickMovedV = true; }

            if (navX > GAMEPAD_DEADZONE_NAV) { moveHorizontal = 1; stickMovedH = true; }
            else if (navX < -GAMEPAD_DEADZONE_NAV) { moveHorizontal = -1; stickMovedH = true; }
        }

        // Prioritize D-pad over stick if both pressed
        if (dpadDown) moveVertical = 1;
        else if (dpadUp) moveVertical = -1;

        if (dpadRight) moveHorizontal = 1;
        else if (dpadLeft) moveHorizontal = -1;


        // --- Navigation Logic ---
        let moveDirection = null;
        if (dpadUp) moveDirection = 'up';
        else if (dpadDown) moveDirection = 'down';
        else if (dpadLeft) moveDirection = 'left';
        else if (dpadRight) moveDirection = 'right';
        else if (this.gamepadNavTimer <= 0 && (moveVertical !== 0 || moveHorizontal !== 0)) {
            if (Math.abs(navX) > Math.abs(navY)) {
                if (moveHorizontal !== 0) moveDirection = moveHorizontal > 0 ? 'right' : 'left';
                else moveDirection = moveVertical > 0 ? 'down' : 'up';
            } else {
                if (moveVertical !== 0) moveDirection = moveVertical > 0 ? 'down' : 'up';
                else moveDirection = moveHorizontal > 0 ? 'right' : 'left';
            }
        }

        if (moveDirection) {
            if (this.selectedIndex === -1) {
                // If nothing was selected yet (e.g. user is on mouse/touch), focus the default button first
                this.setSelectedIndex(this.defaultIndex ?? 0);
                this.gamepadNavTimer = GAMEPAD_NAV_DELAY;
            } else {
                const nextElement = this._findNextElement(moveDirection);
                if (nextElement) {
                    const newIndex = this.focusableElements.indexOf(nextElement);
                    if (newIndex > -1) {
                        this.setSelectedIndex(newIndex);
                        this.gamepadNavTimer = GAMEPAD_NAV_DELAY;
                    }
                }
            }
        }


        // --- Confirmation ---
        if (buttonJustPressed(GAMEPAD_CONFIRM_BUTTON)) {
            if (this.selectedIndex >= 0 && this.selectedIndex < this.focusableElements.length) {
                const selectedElement = this.focusableElements[this.selectedIndex];
                console.log(`Gamepad confirming action: ${selectedElement.dataset.action} on element:`, selectedElement);

                // --- Special Handling for Checkbox ---
                if (selectedElement.matches('.menu-toggle')) {
                    selectedElement.checked = !selectedElement.checked; // Toggle the state
                    // Manually trigger the change event so listeners (like in main.js) fire
                    selectedElement.dispatchEvent(new Event('change', { bubbles: true }));
                    // Return the action so main.js knows something happened, even if handled here
                    this.prevGamepadButtons = currentButtons; // Update history *before* returning
                    return { action: selectedElement.dataset.action, element: selectedElement };
                }
                // --- End Special Handling ---

                this.prevGamepadButtons = currentButtons; // Update history *before* returning
                // Return action and the specific element confirmed
                return { action: selectedElement.dataset.action, element: selectedElement };
            }
        }

        // --- Back Action ---
        // Only allow back if not on main menu
        if (buttonJustPressed(GAMEPAD_BACK_BUTTON) && this.activeMenuElement !== this.uiManager.mainMenu) {
            // Find the appropriate back button for the current menu
            const backButton = this.focusableElements.find(el =>
                el.dataset.action?.startsWith('back') || // Generic back
                (this.activeMenuElement === this.uiManager.settingsScreen && el.dataset.action === 'resume' && el.style.display !== 'none') // Resume acts as back if paused
            );
            if (backButton) {
                console.log(`Gamepad back action: ${backButton.dataset.action}`);
                this.prevGamepadButtons = currentButtons; // Update history *before* returning
                return { action: backButton.dataset.action, element: backButton };
            } else {
                console.log("Gamepad back pressed, but no suitable back/resume button found on current menu.");
            }
        }

        // Update button history for the next frame
        this.prevGamepadButtons = currentButtons;
        return null; // No action confirmed this frame
    }

    _findNextElement(direction) {
        if (this.selectedIndex < 0 || !this.focusableElements.length) return null;
        const currentElement = this.focusableElements[this.selectedIndex];
        const currRect = currentElement.getBoundingClientRect();
        const currCenterX = currRect.left + currRect.width / 2;
        const currCenterY = currRect.top + currRect.height / 2;

        let dirX = 0;
        let dirY = 0;
        if (direction === 'left') dirX = -1;
        else if (direction === 'right') dirX = 1;
        else if (direction === 'up') dirY = -1;
        else if (direction === 'down') dirY = 1;

        let bestCandidate = null;
        let minDistance = Infinity;

        // Weight for orthogonal distance to penalize diagonal jumps
        const orthoWeight = 3.0;

        for (const el of this.focusableElements) {
            if (el === currentElement) continue;
            const rect = el.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            const dx = centerX - currCenterX;
            const dy = centerY - currCenterY;

            // Project onto the movement vector
            const proj = dx * dirX + dy * dirY;
            const ortho = Math.abs(dx * -dirY + dy * dirX);

            // We only consider candidates that are in the positive direction of movement
            if (proj > 0.5) { // 0.5px threshold to avoid float precision issues
                const dist = proj + orthoWeight * ortho;
                if (dist < minDistance) {
                    minDistance = dist;
                    bestCandidate = el;
                }
            }
        }

        // Optional wrap-around logic: if no element in direct path, wrap to the opposite edge
        if (!bestCandidate) {
            let oppositeMin = Infinity;
            for (const el of this.focusableElements) {
                if (el === currentElement) continue;
                const rect = el.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;

                const dx = centerX - currCenterX;
                const dy = centerY - currCenterY;

                // For wrap around, we project in the OPPOSITE direction of movement
                const proj = dx * -dirX + dy * -dirY;
                const ortho = Math.abs(dx * dirY + dy * -dirX);

                if (proj > 0.5) {
                    const dist = -proj + orthoWeight * ortho;
                    if (dist < oppositeMin) {
                        oppositeMin = dist;
                        bestCandidate = el;
                    }
                }
            }
        }

        return bestCandidate;
    }

    getSelectedElement() {
        if (this.selectedIndex >= 0 && this.selectedIndex < this.focusableElements.length) {
            return this.focusableElements[this.selectedIndex];
        }
        return null;
    }
}
