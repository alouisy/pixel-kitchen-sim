# Gameplay Loop & Progression

## 1. The Core Loop
The moment-to-moment experience follows a strict cycle: **Receive Order → Prepare → Cook → Plate → Serve**.

### 1.1 The Order System (`LevelManager.js`)
*   **Generation:** Orders are generated automatically based on `newOrderDelay`.
*   **Capacity:** A level has a `maxActiveOrders` limit. No new orders spawn if this limit is reached.
*   **Life Cycle:**
    1.  Order appears in UI with a countdown timer.
    2.  **Timer Green:** >50% time remaining.
    3.  **Timer Yellow:** >25% time remaining.
    4.  **Timer Red:** <25% time remaining (Critical State).
    5.  **Failure:** If timer hits 0, the order fails, and a score penalty is applied.

### 1.2 The Chef (Player)
*   **Perspective:** First-person.
*   **Movement:** WASD + Mouse Look (Pointer Lock).
*   **Capacity:** The player can hold exactly **one** object at a time.
*   **Actions:**
    *   `Pick Up`: Grab item from counter/station.
    *   `Drop/Place`: Put item onto a valid surface/grid slot.
    *   `Interact`: Trigger a station (e.g., turn on mixer) or combine items (add tomato to plate).
    *   `Throw/Drop`: (Safety feature) Force drop item if stuck.

## 2. Scoring & Progression

### 2.1 Scoring Rules
Scores are calculated per order completion:
*   **Base Score:** Defined in `RECIPES` (e.g., Fries = 60pts, Burger = 100pts).
*   **Time Bonus:** Awarded for fast service. `Min(20, RemainingTime / 2)`.
*   **Penalty:** Deducted if an order times out or if the wrong meal is served (`baseScore / 2` approx).

### 2.2 Star System
Levels define three score thresholds in JSON:
*   ★: Minimum required to "Pass" (internally usually tracked, though not strictly enforced for next level unlock in v1).
*   ★★: Good performance.
*   ★★★: Mastery.

### 2.3 Unlocking
*   Levels are linear (1 -> 2 -> 3).
*   Completing Level N unlocks Level N+1.
*   Progress is saved via `localStorage` key `pixelKitchenSaveData`.

## 3. Game States

### 3.1 Level Start
1.  **Briefing:** Player sees the list of recipes available in the level.
2.  **Initialization:** Kitchen generates. Orders populate immediately up to `maxActiveOrders`.

### 3.2 Win/Loss Conditions
*   **Win:** The level timer reaches `0:00`. The game ends, and the final score is tallied against Star Thresholds.
*   **Loss:** There is no "Game Over" state in v1. The player simply gets 0 stars if they perform poorly, but the level always runs to completion of the timer.

### 3.3 Pause
Pressing `Esc` or `Start` (Gamepad) pauses the game loop. The timer stops, and input is blocked until resumed.