// src/grid.js
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { GRID_UNIT } from './constants.js';

export class GridSystem {
    constructor(widthUnits, depthUnits, worldCenterX, worldCenterZ, parentMesh) {
        this.parentMesh = parentMesh;
        // Dimensions in Slots (integer)
        this.cols = Math.round(widthUnits / GRID_UNIT);
        this.rows = Math.round(depthUnits / GRID_UNIT);
        
        // Top-Left corner in World Space
        this.originX = worldCenterX - (widthUnits / 2);
        this.originZ = worldCenterZ - (depthUnits / 2);

        // Occupancy Map
        this.occupied = Array(this.cols).fill().map(() => Array(this.rows).fill(null));
    }

    worldToGrid(point) {
        const localX = point.x - this.originX;
        const localZ = point.z - this.originZ;
        const col = Math.floor(localX / GRID_UNIT);
        const row = Math.floor(localZ / GRID_UNIT);
        return { col, row };
    }

    gridToWorld(col, row) {
        const x = this.originX + (col * GRID_UNIT) + (GRID_UNIT / 2);
        const z = this.originZ + (row * GRID_UNIT) + (GRID_UNIT / 2);
        return new THREE.Vector3(x, 0, z);
    }

    isAreaFree(startCol, startRow, widthSlots, depthSlots, ignoreItem = null) {
        if (startCol < 0 || startRow < 0 || startCol + widthSlots > this.cols || startRow + depthSlots > this.rows) {
            return false; 
        }
        for (let i = 0; i < widthSlots; i++) {
            for (let j = 0; j < depthSlots; j++) {
                const item = this.occupied[startCol + i][startRow + j];
                if (item !== null && item !== ignoreItem) return false;
            }
        }
        return true;
    }

    occupy(startCol, startRow, widthSlots, depthSlots, item) {
        for (let i = 0; i < widthSlots; i++) {
            for (let j = 0; j < depthSlots; j++) {
                this.occupied[startCol + i][startRow + j] = item;
            }
        }
        item.userData.gridInfo = { grid: this, col: startCol, row: startRow, w: widthSlots, d: depthSlots };
    }

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
}