// src/editor.js
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GRID_UNIT, GAMEPAD_DEADZONE } from './constants.js';

export class LevelEditor {
    constructor(camera, renderer, scene, interactionManager) {
        this.camera = camera;
        this.renderer = renderer;
        this.scene = scene;
        this.interactionManager = interactionManager;
        this.enabled = false;
        this.raycaster = new THREE.Raycaster();
        this.selectedObject = null;
        
        // Controls
        this.orbit = new OrbitControls(camera, renderer.domElement);
        this.orbit.enabled = false;
        
        // UI
        this.hud = document.getElementById('editor-hud');
        if (!this.hud) {
            this.hud = document.createElement('div');
            this.hud.id = 'editor-hud';
            this.hud.style.cssText = "display:none; position:absolute; top:10px; right:10px; z-index:20; background:rgba(0,0,0,0.8); padding:10px; color:orange; border:2px solid orange; font-family: monospace;";
            this.hud.innerHTML = `
                <h3>EDITOR MODE</h3>
                <p><b>Mouse:</b> Click/Drag</p>
                <p><b>Gamepad:</b></p>
                <p>L-Stick: Pan Cam</p>
                <p>R-Stick: Move Obj / Rot Cam</p>
                <p>A (X): Select/Drop</p>
                <p>X (Sq): Clone</p>
                <p>Y (Tri): Export</p>
            `;
            document.body.appendChild(this.hud);
        }

        // Helper
        this.selectionBox = new THREE.BoxHelper(new THREE.Mesh(), 0xffff00);
        this.selectionBox.visible = false;
        this.scene.add(this.selectionBox);

        // Inputs
        this.renderer.domElement.addEventListener('pointerdown', (e) => this.onPointerDown(e));
        this.renderer.domElement.addEventListener('pointermove', (e) => this.onPointerMove(e));
        this.renderer.domElement.addEventListener('pointerup', (e) => this.onPointerUp(e));
        window.addEventListener('keydown', (e) => this.onKeyDown(e));

        // Gamepad State
        this.prevButtons = [];
        this.moveTimer = 0;
    }

    enable() {
        this.enabled = true;
        this.orbit.enabled = true;
        this.hud.style.display = 'block';
        // High angle view
        this.camera.position.set(0, 10, 8);
        this.camera.lookAt(0, 0, 0);
        this.orbit.target.set(0,0,0);
    }

    disable() {
        this.enabled = false;
        this.orbit.enabled = false;
        this.hud.style.display = 'none';
        this.selectionBox.visible = false;
        this.selectedObject = null;
    }

    update(delta) {
        if (!this.enabled) return;
        
        this.orbit.update();
        if (this.selectedObject) this.selectionBox.update();

        // Gamepad Handling
        const gamepad = navigator.getGamepads()[0]; 
        if (gamepad) this.handleGamepad(gamepad, delta);
    }

    handleGamepad(gp, delta) {
        // 1. Camera Pan (Left Stick)
        const lx = gp.axes[0]; 
        const ly = gp.axes[1];
        if (Math.abs(lx) > GAMEPAD_DEADZONE || Math.abs(ly) > GAMEPAD_DEADZONE) {
            // Move orbit target and camera relative to camera rotation
            // Simple X/Z pan implementation
            const speed = 10 * delta;
            // Right vector
            const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion).setY(0).normalize();
            // Forward vector
            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion).setY(0).normalize();
            
            const move = new THREE.Vector3().addScaledVector(right, lx * speed).addScaledVector(forward, ly * speed);
            
            this.camera.position.add(move);
            this.orbit.target.add(move);
        }

        // 2. Object Move (Right Stick) - Discrete steps
        if (this.selectedObject) {
            this.moveTimer -= delta;
            if (this.moveTimer <= 0) {
                const rx = gp.axes[2];
                const ry = gp.axes[3];
                if (Math.abs(rx) > 0.5) {
                    this.selectedObject.position.x += Math.sign(rx) * GRID_UNIT;
                    this.moveTimer = 0.2; // Delay
                }
                if (Math.abs(ry) > 0.5) {
                    this.selectedObject.position.z += Math.sign(ry) * GRID_UNIT;
                    this.moveTimer = 0.2;
                }
            }
        } else {
            // If no object selected, Right Stick rotates camera
            const rx = gp.axes[2];
            if (Math.abs(rx) > GAMEPAD_DEADZONE) {
                // OrbitControls handles rotation if we feed it input? 
                // Easier to manually adjust camera position for simple orbit
                // Or just rely on Mouse/Touch for rotation usually. 
                // Let's implement simple rotation around target
                const speed = 2 * delta;
                const x = this.camera.position.x - this.orbit.target.x;
                const z = this.camera.position.z - this.orbit.target.z;
                const angle = -rx * speed;
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);
                this.camera.position.x = x * cos - z * sin + this.orbit.target.x;
                this.camera.position.z = x * sin + z * cos + this.orbit.target.z;
                this.camera.lookAt(this.orbit.target);
            }
        }

        // 3. Buttons
        const btnPressed = (i) => gp.buttons[i].pressed && !this.prevButtons[i];
        
        // A (0): Select Center Screen or Drop
        if (btnPressed(0)) {
            if (this.selectedObject) {
                // Drop
                this.selectedObject = null;
                this.selectionBox.visible = false;
            } else {
                // Select object at screen center
                this.raycaster.setFromCamera({x:0, y:0}, this.camera);
                const candidates = [];
                this.scene.traverse(c => {
                    if (c.userData && (c.userData.type === 'station' || c.userData.type === 'counter' || c.userData.type === 'table')) {
                        candidates.push(c);
                    }
                });
                const hits = this.raycaster.intersectObjects(candidates, true);
                if (hits.length > 0) {
                    let root = hits[0].object;
                    while(root.parent && root.parent !== this.scene) { root = root.parent; }
                    this.selectedObject = root;
                    this.selectionBox.setFromObject(this.selectedObject);
                    this.selectionBox.visible = true;
                }
            }
        }

        // X (2): Clone
        if (btnPressed(2) && this.selectedObject) {
            this.cloneSelected();
        }

        // Y (3): Export
        if (btnPressed(3)) {
            this.exportLayout();
        }

        this.prevButtons = gp.buttons.map(b => b.pressed);
    }

    // --- Mouse Logic (Keep existing) ---

    onPointerDown(e) {
        if (!this.enabled || e.button !== 0) return;
        const mouse = { x: (e.clientX / window.innerWidth) * 2 - 1, y: -(e.clientY / window.innerHeight) * 2 + 1 };
        this.raycaster.setFromCamera(mouse, this.camera);
        
        const candidates = [];
        this.scene.traverse(c => {
            if (c.userData && (c.userData.type === 'station' || c.userData.type === 'counter' || c.userData.type === 'table')) {
                candidates.push(c);
            }
        });

        const hits = this.raycaster.intersectObjects(candidates, true);
        if (hits.length > 0) {
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

        const surfaces = [];
        this.scene.traverse(c => {
            if (c.visible && c !== this.selectedObject && (c.userData.type === 'floor' || c.userData.type === 'counter' || c.userData.type === 'table')) {
                surfaces.push(c);
            }
        });
        
        const hits = this.raycaster.intersectObjects(surfaces, true);
        if (hits.length > 0) {
            const hitPoint = hits[0].point;
            const snapX = Math.floor(hitPoint.x / GRID_UNIT) * GRID_UNIT + (GRID_UNIT/2);
            const snapZ = Math.floor(hitPoint.z / GRID_UNIT) * GRID_UNIT + (GRID_UNIT/2);
            
            let y = 0;
            if (hits[0].object.userData.type !== 'floor') y = 0.9; 
            if (this.selectedObject.userData.isBase) y = 0; 

            this.selectedObject.position.set(snapX, y, snapZ);
        }
    }

    onPointerUp() {
        if(this.enabled) {
            this.isDragging = false;
            this.orbit.enabled = true;
        }
    }

    onKeyDown(e) {
        if(!this.enabled) return;
        if (e.key.toLowerCase() === 'c' && this.selectedObject) this.cloneSelected();
        if (e.key.toLowerCase() === 't') this.exportLayout();
    }

    cloneSelected() {
        const clone = this.selectedObject.clone();
        clone.position.x += GRID_UNIT; 
        this.scene.add(clone);
        this.selectedObject = clone;
        this.selectionBox.setFromObject(clone);
        // Copy UserData logic manually if needed, clone handles simple structure
        clone.userData = JSON.parse(JSON.stringify(this.selectedObject.userData));
    }

    exportLayout() {
        const data = [];
        this.scene.traverse(c => {
            if (c.parent === this.scene && c.userData.type) {
                if(['station','counter','table','serving'].includes(c.userData.type) || ['station','counter','table','serving'].includes(c.userData.stationType)) {
                    const entry = {
                        name: c.name,
                        type: c.userData.stationType || c.userData.type,
                        position: { x: parseFloat(c.position.x.toFixed(2)), z: parseFloat(c.position.z.toFixed(2)) },
                        color: c.children[1]?.material?.color ? '#' + c.children[1].material.color.getHexString() : undefined
                    };
                    // Pass through configs
                    if(c.userData.isServing) entry.isServing = true;
                    if(c.userData.ingredient) entry.config = { ingredient: c.userData.ingredient };
                    if(c.userData.item) entry.config = { item: c.userData.item };
                    if(c.userData.processes) entry.config = { processes: c.userData.processes, result: c.userData.result, processingTime: c.userData.processingTime };
                    
                    data.push(entry);
                }
            }
        });
        console.log(JSON.stringify(data, null, 2));
        alert("Exported to Console");
    }
}