# Interactions & Cooking Systems

## 1. Interaction Model (`InteractionManager.js`)
Interaction is determined by a **Raycast** from the center of the camera.

### 1.1 Target Validation
1.  Raycast detects the first object with `userData`.
2.  **Distance Check:** Interaction is valid only within `3.0` units.
3.  **Highlighting:** Valid targets scale up (1.1x) or show a green grid cursor (`slotHighlight`) on surfaces.

### 1.2 Interaction Matrix
The result of an interaction depends on what the player is holding (Hand) and what they are looking at (Target).

| Hand State | Target State | Action | Result |
| :--- | :--- | :--- | :--- |
| **Empty** | **Item** | Pick Up | Item attaches to Player View. |
| **Empty** | **Station (Occupied)** | Pick Up | Player picks up the item *on* the station. |
| **Empty** | **Source (Bin)** | Spawn | Player receives a new raw ingredient (e.g., Potato). |
| **Item** | **Surface (Empty)** | Place | Item is placed on the grid. |
| **Item** | **Surface (Occupied)** | **Fail** | "Slot Occupied" message. |
| **Ingredient** | **Processor (Empty)** | Process | Item placed on processor (e.g., Potato on Board). |
| **Ingredient** | **Container (Plate)** | **Combine** | Ingredient is added to the Plate/Bowl/Cup. |
| **Container** | **Ingredient** | **Combine** | Ingredient is picked up into the Container. |
| **Meal** | **Serving Window** | Serve | Order is checked. If correct, score goes up. |

---

## 2. Item Architecture (`items.js`, `constants.js`)

### 2.1 Item Types
1.  **Ingredient:** Raw or processed food (e.g., `potato`, `chopped_tomato`, `patty`).
2.  **Container:** Holds ingredients (e.g., `plate`, `bowl`, `cup`).
    *   *Logic:* Contains an array `userData.contents`.
3.  **Meal:** A container that matches a specific Recipe definition.

### 2.2 State Transitions
Ingredients change names/states via Processors.
*   *Example:* `potato` (Raw) -> [Cutting Board] -> `raw_fries` (Chopped) -> [Fryer] -> `cooked_fries` (Cooked).

---

## 3. Station Mechanics

### 3.1 Processors (`Station Type: processor`)
Processors transform items based on `config.processes` and `config.result`.

*   **Instant Processors (e.g., Cutting Board):**
    *   Action: Place valid item.
    *   Effect: Immediate transformation (Mesh swap).
    *   Audio: `chop`.

*   **Timed Processors (e.g., Fryer, Stove):**
    *   Action: Place valid item.
    *   Effect: Item waits for `processingTime` (ms).
    *   Result: Transforms after timeout.
    *   Audio: `fry` (loop) -> `ding` (complete).

### 3.2 Sources (`Station Type: ingredient_source`)
Infinite dispensers. Interacting spawns a new instance of the defined item into the player's hand.

### 3.3 Assembly (Containers)
*   Items are combined physically by parenting the ingredient mesh to the container mesh.
*   **Validation:** Every time an ingredient is added, `checkPlateCompletion()` runs against `RECIPES`.
*   **Visuals:** Added ingredients are randomized slightly in rotation/position on the plate to look organic.

---

## 4. Recipes (`gameData.js`)
Recipes determine if a collection of ingredients on a plate constitutes a valid meal.

*   **Structure:**
    ```javascript
    'Burger': {
        ingredients: ['bun', 'cooked_patty'], // Must match exactly (sorted)
        timeLimit: 100,
        baseScore: 100
    }
    ```
*   **Matching:** The game sorts the contents of a plate alphabetically and compares them to the sorted ingredient lists of all known recipes.