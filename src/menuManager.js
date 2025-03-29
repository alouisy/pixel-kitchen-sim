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

        // Clicks are handled by main.js calling handleMenuAction
        // We don't need a separate click listener here that might conflict
    }

    activateMenu(menuElement) {
        if (!menuElement) {
            this.deactivateMenu();
            return;
        }
        this.activeMenuElement = menuElement;
        this.refreshFocusableElements();
        let defaultIndex = 0;
        const resumeButton = menuElement.querySelector('[data-action="resume"]');
        if (resumeButton && resumeButton.style.display !== 'none') {
            const resumeIndex = this.focusableElements.indexOf(resumeButton);
            if (resumeIndex > -1) defaultIndex = resumeIndex;
        } else {
            // Find first non-link element if possible
            const firstButtonIndex = this.focusableElements.findIndex(el => el.tagName === 'BUTTON' || el.tagName === 'INPUT');
            if (firstButtonIndex > -1) defaultIndex = firstButtonIndex;
        }
        this.setSelectedIndex(defaultIndex);
        this.prevGamepadButtons = []; // Reset button history when menu activates
    }

    deactivateMenu() {
        this.setSelectedIndex(-1);
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
        if (moveVertical !== 0 || moveHorizontal !== 0) {
            const currentElement = this.focusableElements[this.selectedIndex];
            let moved = false;

            // Try horizontal first within specific groups
            if (moveHorizontal !== 0) {
                const parentGroup = currentElement?.closest('.button-group'); // Language buttons
                if (parentGroup) {
                    const groupElements = this.focusableElements.filter(el => parentGroup.contains(el));
                    const currentIndexInGroup = groupElements.indexOf(currentElement);
                    let newIndexInGroup = currentIndexInGroup + moveHorizontal;

                    if (newIndexInGroup >= 0 && newIndexInGroup < groupElements.length) {
                        const newElement = groupElements[newIndexInGroup];
                        const newOverallIndex = this.focusableElements.indexOf(newElement);
                        if (newOverallIndex > -1) {
                            this.setSelectedIndex(newOverallIndex);
                            moved = true;
                        }
                    }
                }
            }

            // If horizontal didn't move (or wasn't applicable), try vertical
            if (!moved && moveVertical !== 0) {
                // Simple vertical navigation: find next/prev element in the flat list
                let newIndex = this.selectedIndex + moveVertical;
                // Basic wrapping
                if (newIndex >= this.focusableElements.length) newIndex = 0;
                if (newIndex < 0) newIndex = this.focusableElements.length - 1;
                this.setSelectedIndex(newIndex);
                moved = true;
            }

            // Reset timer if movement occurred via stick or dpad press
            if (moved && (stickMovedV || stickMovedH || dpadUp || dpadDown || dpadLeft || dpadRight)) {
                this.gamepadNavTimer = GAMEPAD_NAV_DELAY;
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
        if (buttonJustPressed(GAMEPAD_BACK_BUTTON)) {
            const backButton = this.focusableElements.find(el => el.dataset.action?.startsWith('back'));
            if (backButton) {
                console.log(`Gamepad back action: ${backButton.dataset.action}`);
                this.prevGamepadButtons = currentButtons; // Update history *before* returning
                return { action: backButton.dataset.action, element: backButton };
            }
        }

        // Update button history for the next frame
        this.prevGamepadButtons = currentButtons;
        return null; // No action confirmed this frame
    }

    getSelectedElement() {
        if (this.selectedIndex >= 0 && this.selectedIndex < this.focusableElements.length) {
            return this.focusableElements[this.selectedIndex];
        }
        return null;
    }
}