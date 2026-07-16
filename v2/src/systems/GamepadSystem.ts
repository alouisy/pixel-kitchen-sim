export class GamepadSystem {
    private static instance: GamepadSystem;

    // State
    public axes: { x: number, y: number } = { x: 0, y: 0 };
    public buttons: {
        interact: boolean;
        jump: boolean;
        pause: boolean;
        sprint: boolean;
    } = { interact: false, jump: false, pause: false, sprint: false };

    constructor() {
        if (GamepadSystem.instance) return GamepadSystem.instance;
        GamepadSystem.instance = this;
    }

    update() {
        const gamepads = navigator.getGamepads();
        const gp = gamepads[0]; // Use first gamepad

        if (gp) {
            // Axes (Left Stick)
            // Apply deadzone
            const deadzone = 0.1;
            let x = gp.axes[0];
            let y = gp.axes[1];

            if (Math.abs(x) < deadzone) x = 0;
            if (Math.abs(y) < deadzone) y = 0;

            this.axes.x = x;
            this.axes.y = y;

            // Buttons (Standard Mapping)
            // 0: A / Cross (Interact)
            // 1: B / Circle (Cancel/Sprint?)
            // 2: X / Square
            // 3: Y / Triangle
            // 9: Start (Pause)

            this.buttons.interact = gp.buttons[0].pressed;
            this.buttons.sprint = gp.buttons[1].pressed;
            this.buttons.pause = gp.buttons[9].pressed;

            // Debounce / Edge detection could be handled here if needed
            // But for continuous movement, state is fine.
            // For toggle actions (pause), we need edge detection in the consumer.
        } else {
            this.axes = { x: 0, y: 0 };
            this.buttons = { interact: false, jump: false, pause: false, sprint: false };
        }
    }

    isPressed(button: 'interact' | 'pause' | 'sprint'): boolean {
        return this.buttons[button];
    }
}

export const gamepadSystem = new GamepadSystem();
