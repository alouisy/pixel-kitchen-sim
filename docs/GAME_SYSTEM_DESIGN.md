# Game System Design & Architecture (v1.0)

## 1. Overview
**Pixel Kitchen Simulator** is a first-person, time-management cooking simulation built with **Three.js**. The player acts as a chef in a voxel-based kitchen, receiving orders, preparing ingredients through various stations (chopping, frying, grilling), assembling meals, and serving them within a time limit.

This document serves as the authoritative **Game Bible**. It outlines the high-level architecture and references specific subsystem documentation.

## 2. Documentation Index
For detailed implementation specifics, refer to the following sub-documents:

*   **[DOCS_GAMEPLAY_LOOP.md](./DOCS_GAMEPLAY_LOOP.md)**  
    *Covers the Order System, Scoring, Win/Loss conditions, Player Controls, and the core Game Loop.*
*   **[DOCS_INTERACTIONS_COOKING.md](./DOCS_INTERACTIONS_COOKING.md)**  
    *Covers the Interaction Manager, raycasting logic, ingredient states, recipe validation, and station mechanics.*
*   **[DOCS_LEVELS_EDITOR.md](./DOCS_LEVELS_EDITOR.md)**  
    *Covers the JSON level format, the in-game Level Editor tools, grid systems, and world generation.*

---

## 3. Technical Architecture

### 3.1 Core Technology
*   **Engine:** Three.js (Rendering, Scenegraph, Math).
*   **Physics/Movement:** Custom implementation utilizing `PointerLockControls` and basic AABB collision logic via `GridSystem`.
*   **State Management:** Vanilla JS Modules managing singleton-like instances (`LevelManager`, `InteractionManager`, `UIManager`).
*   **Persistence:** `localStorage` via `SaveManager`.

### 3.2 System Hierarchy
The application entry point is `main.js`, which orchestrates the following subsystems:

1.  **World & Rendering (`setup.js`, `world.js`, `voxelBuilder.js`)**
    *   Sets up the scene, lighting, and camera.
    *   Generates procedural voxel meshes for items and stations.
    *   Constructs the level geometry based on JSON data.

2.  **Game Logic (`LevelManager.js`, `gameData.js`)**
    *   Manages the session timer and active orders.
    *   Validates served meals against active orders.
    *   Calculates scores and star ratings.

3.  **Input & Interaction (`controls.js`, `interaction.js`, `player.js`)**
    *   Handles First-Person movement and view.
    *   Performs raycasting to detect interactable objects.
    *   Manages the "Hand" state (Holding items vs. Empty hands).

4.  **UI & Menus (`ui.js`, `menuManager.js`)**
    *   Draws the HUD (Orders, Score, Crosshair).
    *   Manages DOM overlays (Main Menu, Settings, Level Select).

### 3.3 Game State Machine
The game operates on a strict state machine defined in `main.js`:
*   `LOADING`: Preloading GLTF assets and textures.
*   `MAIN_MENU`: Entry point.
*   `LEVEL_SELECT`: Grid view of available levels.
*   `LEVEL_INSTRUCTIONS`: Recipe briefing before start.
*   `GAME_RUNNING`: The core simulation loop.
*   `PAUSED`: Overlay menu stopping the delta time updates.
*   `LEVEL_END`: Score summary and "Next Level" logic.
*   `EDITOR`: The creative mode for building layouts.

### 3.4 Data Flow
1.  **Level Load:** `LevelManager` fetches JSON -> `world.js` builds meshes -> `InteractionManager` indexes interactables.
2.  **Update Loop:** `main.js` calls `LevelManager.update(delta)` (timers) and `Player.update(delta)`.
3.  **Interaction:** Input -> `InteractionManager` -> Modify State (e.g., chop vegetable) -> Update Visuals -> Check Recipe.

---

## 4. Global Standards
*   **Grid System:** The world is divided into `0.5` unit blocks (`GRID_UNIT`).
*   **Y-Axis:** Y is Up. Floor is `0`. Counter height is `0.9`. Player height is `1.8`.
*   **UserData:** Most logic relies on `Mesh.userData` to store state (e.g., `userData.type = 'ingredient'`, `userData.state = 'cooked'`).