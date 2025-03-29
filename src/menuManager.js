// src/menuManager.js

const GAMEPAD_DEADZONE_NAV = 0.5; // Higher deadzone for menu navigation
const GAMEPAD_NAV_DELAY = 150; // Milliseconds between navigation steps

export class MenuManager {
    constructor(uiManager) {
        this.uiManager = uiManager;
        this.activeMenuElement = null;
        this.focusableElements = [];
        this.selectedIndex = -1;
        this.gamepadNavTimer = 0; // Timer for nav delay

        this._addEventListeners();
    }

    _addEventListeners() {
        // Listen for mouseover on potential menu items to update selection
        document.addEventListener('mouseover', (event) => {
            if (!this.activeMenuElement) return;

            const target = event.target.closest('.menu-button, .menu-link, .menu-toggle'); // Include links and toggles
            if (target && this.focusableElements.includes(target)) {
                const index = this.focusableElements.indexOf(target);
                if (index !== this.selectedIndex) {
                    this.setSelectedIndex(index);
                }
            }
        });

        // Listen for clicks globally to trigger actions
        document.addEventListener('click', (event) => {
            if (!this.activeMenuElement) return;

            const target = event.target.closest('.menu-button, .menu-link, .menu-toggle');
            if (target && this.focusableElements.includes(target)) {
                // Action is handled by the main game loop based on data-action
                // We don't need to explicitly call the action here, just ensure selection is right
                this.setSelectedIndex(this.focusableElements.indexOf(target));
                // console.log(`Clicked: ${target.dataset.action}`);
            }
        });
    }

    // Call this when a menu becomes active
    activateMenu(menuElement) {
        if (!menuElement) {
            this.deactivateMenu();
            return;
        }
        // console.log("Activating menu:", menuElement.id);
        this.activeMenuElement = menuElement;
        this.refreshFocusableElements();
        // Select the first element by default, or resume button if present and visible
        let defaultIndex = 0;
        const resumeButton = menuElement.querySelector('[data-action="resume"]');
        if (resumeButton && resumeButton.style.display !== 'none') {
            const resumeIndex = this.focusableElements.indexOf(resumeButton);
            if (resumeIndex > -1) defaultIndex = resumeIndex;
        }
        this.setSelectedIndex(defaultIndex);
    }

    // Call this when a menu is hidden
    deactivateMenu() {
        // console.log("Deactivating menu");
        this.setSelectedIndex(-1); // Deselect all
        this.activeMenuElement = null;
        this.focusableElements = [];
        this.selectedIndex = -1;
    }

    // Find all focusable elements within the active menu
    refreshFocusableElements() {
        if (!this.activeMenuElement) {
            this.focusableElements = [];
            return;
        }
        // Find elements that are visible and have a data-action attribute
        this.focusableElements = Array.from(
            this.activeMenuElement.querySelectorAll('.menu-button, .menu-link, .menu-toggle')
        ).filter(el => el.offsetParent !== null); // Basic visibility check

        // console.log("Focusable elements:", this.focusableElements.map(el => el.id || el.dataset.action));
    }

    // Update the visual selection
    setSelectedIndex(index) {
        if (!this.activeMenuElement || !this.focusableElements.length) {
            index = -1; // Ensure index is -1 if no elements
        }

        // Remove selection from the previously selected element
        if (this.selectedIndex >= 0 && this.selectedIndex < this.focusableElements.length) {
            this.focusableElements[this.selectedIndex].classList.remove('selected');
        }

        this.selectedIndex = index;

        // Add selection to the new element
        if (this.selectedIndex >= 0 && this.selectedIndex < this.focusableElements.length) {
            this.focusableElements[this.selectedIndex].classList.add('selected');
            // Optional: Scroll into view if needed
            // this.focusableElements[this.selectedIndex].scrollIntoView({ block: 'nearest' });
        }
    }

    // Handle gamepad navigation input
    handleGamepadNav(gamepad, delta) {
        if (!this.activeMenuElement || !this.focusableElements.length) return null; // Return null if no action

        this.gamepadNavTimer -= delta * 1000; // Decrement timer

        let navX = gamepad.axes[0] ?? 0; // Left stick horizontal
        let navY = gamepad.axes[1] ?? 0; // Left stick vertical
        let dpadUp = gamepad.buttons[12]?.pressed ?? false;
        let dpadDown = gamepad.buttons[13]?.pressed ?? false;
        let dpadLeft = gamepad.buttons[14]?.pressed ?? false;
        let dpadRight = gamepad.buttons[15]?.pressed ?? false;

        let moveVertical = 0;
        let moveHorizontal = 0;

        if (this.gamepadNavTimer <= 0) {
            if (dpadDown || navY > GAMEPAD_DEADZONE_NAV) moveVertical = 1;
            else if (dpadUp || navY < -GAMEPAD_DEADZONE_NAV) moveVertical = -1;

            if (dpadRight || navX > GAMEPAD_DEADZONE_NAV) moveHorizontal = 1;
            else if (dpadLeft || navX < -GAMEPAD_DEADZONE_NAV) moveHorizontal = -1;

            if (moveVertical !== 0) {
                let newIndex = this.selectedIndex + moveVertical;
                // Basic vertical wrapping
                if (newIndex >= this.focusableElements.length) newIndex = 0;
                if (newIndex < 0) newIndex = this.focusableElements.length - 1;
                this.setSelectedIndex(newIndex);
                this.gamepadNavTimer = GAMEPAD_NAV_DELAY; // Reset timer
            } else if (moveHorizontal !== 0) {
                // Handle horizontal navigation within groups (like language buttons)
                const currentElement = this.focusableElements[this.selectedIndex];
                const parentGroup = currentElement?.closest('.button-group'); // Example group selector
                if (parentGroup) {
                    const groupButtons = Array.from(parentGroup.querySelectorAll('.menu-button, .menu-link, .menu-toggle'))
                        .filter(el => this.focusableElements.includes(el));
                    const currentIndexInGroup = groupButtons.indexOf(currentElement);
                    let newIndexInGroup = currentIndexInGroup + moveHorizontal;

                    if (newIndexInGroup >= 0 && newIndexInGroup < groupButtons.length) {
                        const newElement = groupButtons[newIndexInGroup];
                        const newOverallIndex = this.focusableElements.indexOf(newElement);
                        if (newOverallIndex > -1) {
                            this.setSelectedIndex(newOverallIndex);
                            this.gamepadNavTimer = GAMEPAD_NAV_DELAY;
                        }
                    }
                } else {
                    // Default horizontal: wrap like vertical for now
                    let newIndex = this.selectedIndex + moveHorizontal;
                    if (newIndex >= this.focusableElements.length) newIndex = 0;
                    if (newIndex < 0) newIndex = this.focusableElements.length - 1;
                    this.setSelectedIndex(newIndex);
                    this.gamepadNavTimer = GAMEPAD_NAV_DELAY;
                }
            }
        }

        // Check for confirmation button press (e.g., Cross/A)
        // Use the constant from constants.js if available, otherwise default to 0
        const confirmButtonIndex = 0; // Replace with GAMEPAD_INTERACT_BUTTON if imported
        if (gamepad.buttons[confirmButtonIndex]?.pressed && !(this.prevGamepadButtons && this.prevGamepadButtons[confirmButtonIndex])) {
            if (this.selectedIndex >= 0 && this.selectedIndex < this.focusableElements.length) {
                const selectedElement = this.focusableElements[this.selectedIndex];
                console.log(`Gamepad confirming action: ${selectedElement.dataset.action}`);
                // Return the action to be handled by main.js
                return { action: selectedElement.dataset.action, element: selectedElement };
            }
        }

        // Check for back button press (e.g., Circle/B)
        const backButtonIndex = 1; // Common index for Circle/B
        if (gamepad.buttons[backButtonIndex]?.pressed && !(this.prevGamepadButtons && this.prevGamepadButtons[backButtonIndex])) {
            // Find the 'back' button in the current menu and return its action
            const backButton = this.focusableElements.find(el => el.dataset.action?.startsWith('back'));
            if (backButton) {
                console.log(`Gamepad back action: ${backButton.dataset.action}`);
                return { action: backButton.dataset.action, element: backButton };
            }
        }


        // Store button states for next frame comparison
        this.prevGamepadButtons = gamepad.buttons.map(b => b.pressed);

        return null; // No action confirmed this frame
    }

    // Get the currently selected element
    getSelectedElement() {
        if (this.selectedIndex >= 0 && this.selectedIndex < this.focusableElements.length) {
            return this.focusableElements[this.selectedIndex];
        }
        return null;
    }
}