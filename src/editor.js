// src/editor.js
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

export class LevelEditor {
    constructor(camera, renderer, scene, interactionManager) {
        this.camera = camera;
        this.renderer = renderer;
        this.scene = scene;
        this.interactionManager = interactionManager;

        this.enabled = false;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // Tools
        this.orbit = new OrbitControls(camera, renderer.domElement);
        this.orbit.enabled = false; // Disabled by default
        this.orbit.enableDamping = true;

        this.transformControl = new TransformControls(camera, renderer.domElement);
        this.transformControl.addEventListener('dragging-changed', (event) => {
            // Disable camera movement while dragging an object
            this.orbit.enabled = !event.value;
        });
        this.scene.add(this.transformControl);

        // UI
        this.hud = document.getElementById('editor-hud');
        this.exportBtn = document.getElementById('editor-export-btn');
        this.exportBtn.addEventListener('click', () => this.exportLayout());

        // Selection
        this.renderer.domElement.addEventListener('mousedown', (e) => this.onMouseDown(e));
        window.addEventListener('keydown', (e) => this.onKeyDown(e));
    }

    enable() {
        this.enabled = true;
        this.orbit.enabled = true;
        this.hud.style.display = 'block';
        
        // Set initial camera view for editor (higher up)
        this.camera.position.set(0, 10, 8);
        this.camera.lookAt(0, 0, 0);
    }

    disable() {
        this.enabled = false;
        this.orbit.enabled = false;
        this.transformControl.detach();
        this.hud.style.display = 'none';
    }

    update() {
        if (!this.enabled) return;
        this.orbit.update();
    }

    onMouseDown(event) {
        if (!this.enabled) return;
        
        // Don't select if clicking on the Transform Gizmo
        if (this.transformControl.dragging) return;

        // Calculate mouse position in normalized device coordinates (-1 to +1)
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);

        // Intersect against all kitchen objects tracked by InteractionManager
        // Note: InteractionManager might contain dynamic items, we mainly want static stations
        const interactables = this.interactionManager.interactables;
        // Also check Counters (which might not be in interactables if they are just bases)
        // For a full editor, we'd pass `currentKitchenObjects` from world.js, 
        // but let's try targeting everything in the scene that has userData.type
        const candidates = this.scene.children.filter(c => c.userData && (c.userData.type === 'station' || c.userData.type === 'counter' || c.userData.type === 'decoration'));

        const intersects = this.raycaster.intersectObjects(candidates, true);

        if (intersects.length > 0) {
            // Find the root object (in case we hit a child part)
            let target = intersects[0].object;
            while (target.parent && target.parent !== this.scene) {
                target = target.parent;
            }
            
            this.transformControl.attach(target);
            console.log("Selected:", target.name, target.userData);
        } else {
            this.transformControl.detach();
        }
    }

    onKeyDown(event) {
        if (!this.enabled) return;
        switch (event.key.toLowerCase()) {
            case 't': this.transformControl.setMode('translate'); break;
            case 'r': this.transformControl.setMode('rotate'); break;
            // case 's': this.transformControl.setMode('scale'); break; // Scale usually breaks layout logic unless careful
        }
    }

    exportLayout() {
        const layoutData = [];
        
        // Iterate through scene children to find level components
        this.scene.children.forEach(obj => {
            if (!obj.userData) return;
            
            const type = obj.userData.type;
            const stType = obj.userData.stationType; // specific station type
            
            // Check if it's a relevant object
            if (type === 'station' || type === 'counter' || type === 'decoration') {
                const entry = {
                    name: obj.name,
                    type: stType || type, // Use specific station type if available (e.g. 'processor'), else generic 'decoration'
                    position: { 
                        x: parseFloat(obj.position.x.toFixed(2)), 
                        z: parseFloat(obj.position.z.toFixed(2)) 
                    },
                    size: {
                        width: obj.geometry.parameters.width,
                        depth: obj.geometry.parameters.depth,
                        height: obj.geometry.parameters.height
                    },
                    color: '#' + obj.material.color.getHexString()
                };

                // Recover config if it exists
                if (obj.userData.ingredient) entry.config = { ingredient: obj.userData.ingredient };
                if (obj.userData.item) entry.config = { item: obj.userData.item };
                if (obj.userData.processes) {
                    entry.config = {
                        processes: obj.userData.processes,
                        result: obj.userData.result,
                        processingTime: obj.userData.processingTime
                    };
                }
                
                // Recover yOffset for decorations/stations sitting on counters
                // Logic: Mesh Y = yOffset + height/2. So yOffset = Mesh Y - height/2
                const calculatedYOffset = obj.position.y - (entry.size.height / 2);
                if (calculatedYOffset > 0.01) {
                    entry.yOffset = parseFloat(calculatedYOffset.toFixed(2));
                }

                // Handle special flags
                if (obj.userData.isServing) entry.isServing = true;

                layoutData.push(entry);
            }
        });

        console.log("--- EXPORTED LAYOUT JSON ---");
        console.log(JSON.stringify(layoutData, null, 4));
        alert("Layout JSON exported to Console (F12).");
    }
}