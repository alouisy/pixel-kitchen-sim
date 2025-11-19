// src/editor.js
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GRID_UNIT } from './constants.js';

export class LevelEditor {
    constructor(camera, renderer, scene, interactionManager) {
        this.camera = camera;
        this.renderer = renderer;
        this.scene = scene;
        this.interactionManager = interactionManager;
        this.enabled = false;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.selectedObject = null;
        this.isDragging = false;
        this.orbit = new OrbitControls(camera, renderer.domElement);
        this.orbit.enabled = false;
        
        this.hud = document.getElementById('editor-hud');
        if(!this.hud) { /* create hud if missing */ }
        
        this.selectionBox = new THREE.BoxHelper(new THREE.Mesh(), 0xffff00);
        this.selectionBox.visible = false;
        this.scene.add(this.selectionBox);

        this.renderer.domElement.addEventListener('pointerdown', (e) => this.onPointerDown(e));
        this.renderer.domElement.addEventListener('pointermove', (e) => this.onPointerMove(e));
        this.renderer.domElement.addEventListener('pointerup', (e) => this.onPointerUp(e));
    }

    enable() {
        this.enabled = true;
        this.orbit.enabled = true;
        if(this.hud) this.hud.style.display = 'block';
        this.camera.position.set(0, 12, 10);
        this.camera.lookAt(0, 0, 0);
    }

    disable() {
        this.enabled = false;
        this.orbit.enabled = false;
        if(this.hud) this.hud.style.display = 'none';
        this.selectionBox.visible = false;
        this.selectedObject = null;
        this.isDragging = false;
    }

    update() {
        if (!this.enabled) return;
        this.orbit.update();
        if (this.selectedObject) this.selectionBox.update();
    }

    onPointerDown(e) {
        if (!this.enabled || e.button !== 0) return;
        // ... Select logic (similar to previous) ...
        // Simplified for brevity
        const mouse = { x: (e.clientX / window.innerWidth) * 2 - 1, y: -(e.clientY / window.innerHeight) * 2 + 1 };
        this.raycaster.setFromCamera(mouse, this.camera);
        const selectables = this.scene.children.filter(c => c.visible && c.userData && (c.userData.type === 'station' || c.userData.type === 'counter' || c.userData.type === 'decoration'));
        const hits = this.raycaster.intersectObjects(selectables, false);
        if (hits.length > 0) {
            this.selectedObject = hits[0].object;
            this.selectionBox.setFromObject(this.selectedObject);
            this.selectionBox.visible = true;
            this.isDragging = true;
            this.orbit.enabled = false;
        } else {
            this.selectedObject = null;
            this.selectionBox.visible = false;
        }
    }

    onPointerMove(e) {
        if (!this.enabled || !this.isDragging || !this.selectedObject) return;
        
        const mouse = { x: (e.clientX / window.innerWidth) * 2 - 1, y: -(e.clientY / window.innerHeight) * 2 + 1 };
        this.raycaster.setFromCamera(mouse, this.camera);

        const surfaces = this.scene.children.filter(c => 
            c.visible && c !== this.selectedObject && (c.userData.type === 'floor' || c.userData.type === 'counter' || c.userData.type === 'station')
        );
        
        const hits = this.raycaster.intersectObjects(surfaces, false);
        if (hits.length > 0) {
            const hit = hits[0];
            const surface = hit.object;
            
            // Grid Snapping Logic
            // If surface has a grid, use it!
            if (surface.userData.grid) {
                const { col, row } = surface.userData.grid.worldToGrid(hit.point);
                const worldPos = surface.userData.grid.gridToWorld(col, row);
                
                const objH = this.selectedObject.geometry?.parameters?.height || 0;
                // Determine Y:
                // If floor, Y = 0 + height/2
                // If counter, Y = counterTopY + height/2
                let baseY = surface.position.y;
                let surfaceH = surface.geometry?.parameters?.height || 0;
                if (surface.userData.type === 'floor') { baseY = 0; surfaceH = 0; }
                
                const topY = baseY + (surfaceH / 2);
                this.selectedObject.position.set(worldPos.x, topY + objH/2, worldPos.z);
            } else {
                // Raw snap
                this.selectedObject.position.set(
                    Math.round(hit.point.x / GRID_UNIT) * GRID_UNIT,
                    hit.point.y + (this.selectedObject.geometry.parameters.height/2),
                    Math.round(hit.point.z / GRID_UNIT) * GRID_UNIT
                );
            }
        }
    }

    onPointerUp() {
        if(this.enabled) {
            this.isDragging = false;
            this.orbit.enabled = true;
        }
    }
}