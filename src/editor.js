// src/editor.js
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GRID_UNIT, MODULE_HEIGHT } from './constants.js';

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
        const mouse = { x: (e.clientX / window.innerWidth) * 2 - 1, y: -(e.clientY / window.innerHeight) * 2 + 1 };
        this.raycaster.setFromCamera(mouse, this.camera);
        
        // Filter for kitchen objects
        const candidates = [];
        this.scene.traverse(c => {
            if (c.userData && (c.userData.type === 'station' || c.userData.type === 'counter' || c.userData.type === 'table')) {
                candidates.push(c);
            }
        });

        const hits = this.raycaster.intersectObjects(candidates, true);
        if (hits.length > 0) {
            // Walk up to root
            let root = hits[0].object;
            while(root.parent && root.parent !== this.scene) { root = root.parent; }
            
            this.selectedObject = root;
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

        // Find surface (Floor or Counter)
        const surfaces = [];
        this.scene.traverse(c => {
            if (c.visible && c !== this.selectedObject) {
                if (c.userData.type === 'floor' || c.userData.type === 'counter' || c.userData.type === 'table') {
                    surfaces.push(c);
                }
            }
        });
        
        const hits = this.raycaster.intersectObjects(surfaces, true);
        if (hits.length > 0) {
            let surface = hits[0].object;
            while(surface.parent && surface.parent !== this.scene) surface = surface.parent;

            const hitPoint = hits[0].point;
            
            // Snap to Grid Logic
            // Calculate grid center
            const snapX = Math.floor(hitPoint.x / GRID_UNIT) * GRID_UNIT + (GRID_UNIT/2);
            const snapZ = Math.floor(hitPoint.z / GRID_UNIT) * GRID_UNIT + (GRID_UNIT/2);

            // Calculate Y
            // If floor, Y = 0. If Counter, Y = MODULE_HEIGHT.
            let yBase = 0;
            if (surface.userData.type === 'counter' || surface.userData.type === 'table') {
                yBase = MODULE_HEIGHT;
            }
            
            // If dragging a counter, it sits on floor (y=0)
            if (this.selectedObject.userData.isBase) {
                yBase = 0;
            }

            this.selectedObject.position.set(snapX, yBase, snapZ);
        }
    }

    onPointerUp() {
        if(this.enabled) {
            this.isDragging = false;
            this.orbit.enabled = true;
        }
    }
}