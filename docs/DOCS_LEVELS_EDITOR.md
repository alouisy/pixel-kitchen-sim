# Level Design & Editor Guide

## 1. Level Data Structure
Levels are stored as `.json` files in the `levels/` directory.

### 1.1 JSON Schema
```json
{
  "levelId": 1,
  "name": "Fry Cook Training",
  "duration": 180,           // Seconds
  "starThresholds": [300, 500, 700], // 1, 2, 3 Stars
  "availableMeals": ["French Fries"], // Must match keys in RECIPES
  "maxActiveOrders": 2,
  "newOrderDelay": 15,
  "layout": [ ... ]          // Array of Objects
}
```

### 1.2 Layout Objects
Every object in the scene is defined here.
*   **Coordinates:** `x, z` (Float). 1 Unit = 2 Grid Blocks.
*   **Rotation:** Radians (Y-axis).
*   **Types:** `wall`, `counter`, `processor`, `ingredient_source`, `serving`, `trash`, `table`.

**Example Entry:**
```json
{
  "name": "Fryer1",
  "type": "processor",
  "position": { "x": -1, "z": -3.5 },
  "config": {
    "processes": ["raw_fries"],
    "result": { "raw_fries": "cooked_fries" },
    "processingTime": 3000
  }
}
```

---

## 2. In-Game Editor (`editor.js`)
The game includes a WYSIWYG editor accessible from the Main Menu.

### 2.1 Navigation
*   **Pan:** Right-Click Drag.
*   **Zoom:** Scroll Wheel.
*   **Select:** Left-Click on object.

### 2.2 Placement & Manipulation
*   **Library:** Bottom panel contains all available assets. Click to select a ghost template.
*   **Snapping:** Objects snap to `0.5` grid units automatically.
*   **Stacking:** Objects verify what is beneath them. Stations will automatically snap to the top of Counters (`y=0.9`), or the floor (`y=0`) if no counter exists.
*   **Rotation:** Press `R` to rotate 90 degrees.
*   **Clone:** Press `C` to duplicate selected.
*   **Delete:** Press `Del` to remove.

### 2.3 Intelligent Features
*   **Wall Resizing:** Select a wall to see drag handles (Blue dots). Dragging resizes the wall dynamically.
*   **Counter Tiling:** Dragging handles on a Counter/Table creates *copies* of the object in that direction (Arraying), rather than stretching the mesh.
*   **Smart Meshing:** Placing Tables next to each other automatically updates their geometry (legs disappear) to form a cohesive surface.

### 2.4 Configuration
When a generic station (like a Processor or Source) is selected, the **Inspector Panel** (Right) allows editing its JSON `config` property directly. This allows creating custom stations (e.g., a "Magic Box" that turns potatoes into burgers) without code changes.

### 2.5 Exporting
1.  Click **Save JSON**.
2.  The browser downloads a `.json` file.
3.  **Manual Step:** This file must be moved into the project's `levels/` folder and referenced in `levels/game_roadmap.json` to be playable in the main game loop.
