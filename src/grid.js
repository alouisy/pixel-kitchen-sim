// src/grid.js
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { GRID_UNIT } from './constants.js';

export class GridSystem {
    constructor(widthUnits, depthUnits, worldCenterX, worldCenterZ, parentMesh) {
        this.parentMesh = parentMesh;
        this.cols = Math.round(widthUnits / GRID_UNIT);
        this.rows = Math.round(depthUnits / GRID_UNIT);
        
        // Calculate the top-left corner of the grid in world space
        this.originX = worldCenterX - (widthUnits / 2);
        this.originZ = worldCenterZ - (depthUnits / 2);

        // 2D array to track occupancy: occupied[col][row] = ItemObject | null
        this.occupied = Array(this.cols).fill().map(() => Array(this.rows).fill(null));
        
        // Visual debug (optional, can be toggled)
        // this.createDebugLines(); 
    }

    // Convert World Vector3 to Grid Coordinates {col, row}
    worldToGrid(point) {
        const localX = point.x - this.originX;
        const localZ = point.z - this.originZ;

        const col = Math.floor(localX / GRID_UNIT);
        const row = Math.floor(localZ / GRID_UNIT);

        return { col, row };
    }

    // Convert Grid Coordinates to World Vector3 (Center of the slot)
    gridToWorld(col, row) {
        const x = this.originX + (col * GRID_UNIT) + (GRID_UNIT / 2);
        const z = this.originZ + (row * GRID_UNIT) + (GRID_UNIT / 2);
        // Y is handled by the interactable placement logic
        return new THREE.Vector3(x, 0, z);
    }

    // Check if a specific area is within bounds and empty
    // widthSlots/depthSlots: dimensions of the item in slots
    isAreaFree(startCol, startRow, widthSlots, depthSlots, ignoreItem = null) {
        if (startCol < 0 || startRow < 0 || startCol + widthSlots > this.cols || startRow + depthSlots > this.rows) {
            return false; // Out of bounds
        }

        for (let i = 0; i < widthSlots; i++) {
            for (let j = 0; j < depthSlots; j++) {
                const item = this.occupied[startCol + i][startRow + j];
                if (item !== null && item !== ignoreItem) {
                    return false; // Occupied
                }
            }
        }
        return true;
    }

    // Mark an area as occupied by an item
    occupy(startCol, startRow, widthSlots, depthSlots, item) {
        for (let i = 0; i < widthSlots; i++) {
            for (let j = 0; j < depthSlots; j++) {
                this.occupied[startCol + i][startRow + j] = item;
            }
        }
        // Store grid info on the item for easy removal
        item.userData.gridInfo = {
            grid: this,
            col: startCol,
            row: startRow,
            w: widthSlots,
            d: depthSlots
        };
    }

    // Clear occupancy for an item
    vacate(item) {
        if (!item.userData.gridInfo || item.userData.gridInfo.grid !== this) return;
        const { col, row, w, d } = item.userData.gridInfo;
        
        for (let i = 0; i < w; i++) {
            for (let j = 0; j < d; j++) {
                if (this.occupied[col + i][row + j] === item) {
                    this.occupied[col + i][row + j] = null;
                }
            }
        }
        delete item.userData.gridInfo;
    }

    createDebugLines() {
        // Helper to visualize grid
        const material = new THREE.LineBasicMaterial({ color: 0x00ff00, opacity: 0.2, transparent: true });
        const points = [];
        
        // Vertical lines
        for (let i = 0; i <= this.cols; i++) {
            const x = this.originX + (i * GRID_UNIT);
            points.push(new THREE.Vector3(x, 0.01, this.originZ));
            points.push(new THREE.Vector3(x, 0.01, this.originZ + (this.rows * GRID_UNIT)));
        }
        // Horizontal lines
        for (let j = 0; j <= this.rows; j++) {
            const z = this.originZ + (j * GRID_UNIT);
            points.push(new THREE.Vector3(this.originX, 0.01, z));
            points.push(new THREE.Vector3(this.originX + (this.cols * GRID_UNIT), 0.01, z));
        }

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const lines = new THREE.LineSegments(geometry, material);
        
        // Add to parent mesh logic in World
        if(this.parentMesh && this.parentMesh.parent) {
             this.parentMesh.add(lines);
             // Adjust Y relative to parent
             lines.position.y = (this.parentMesh.geometry.parameters.height / 2) + 0.01;
             // Adjust X/Z because originX/Z are world coords, need local if adding as child
             // Actually, grid logic uses World Coords. Debug lines easier added to Scene.
             // Skipping complex debug visualization implementation for simplicity in this file.
        }
    }
}