// src/editor.js
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GRID_UNIT, GAMEPAD_DEADZONE, CATALOG_ITEMS, STATION_TYPES, MODULE_HEIGHT } from './constants.js';
import { createCounterPrefab, createStationPrefab, createTablePrefab, getFloorMesh } from './world.js';

export class LevelEditor {
    constructor(camera, renderer, scene, interactionManager) {
        this.camera = camera;
        this.renderer = renderer;
        this.scene = scene;
        this.interactionManager = interactionManager;
        this.enabled = false;
        this.raycaster = new THREE.Raycaster();
        
        // State
        this.selectedObject = null;
        this.ghostObject = null; // Object currently being placed
        this.isDragging = false;
        this.placementMode = false; // If true, we are trying to place a new item

        // Ground Plane for Raycasting (Y=0)
        this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

        // Grid Helper (Visible only in Editor)
        // 8x8 size, 0.5 unit cells = 16 divisions
        this.gridHelper = new THREE.GridHelper(8, 16, 0xFFD700, 0x444444);
        this.gridHelper.position.y = 0.01; // Slight offset to avoid z-fighting if floor was visible
        this.gridHelper.visible = false;
        this.scene.add(this.gridHelper);

        // Controls
        this.orbit = new OrbitControls(camera, renderer.domElement);
        this.orbit.enabled = false;
        this.orbit.enableDamping = true;
        this.orbit.dampingFactor = 0.1;

        // Visual Helpers
        this.selectionBox = new THREE.BoxHelper(new THREE.Mesh(), 0xffff00);
        this.selectionBox.visible = false;
        this.scene.add(this.selectionBox);

        // Init UI
        this.ui = document.getElementById('editor-ui');
        this.libraryContent = document.getElementById('library-content');
        this.inspector = document.getElementById('editor-inspector');
        this.inspectorName = document.getElementById('inspector-name');
        this.inspectorX = document.getElementById('val-x');
        this.inspectorZ = document.getElementById('val-z');

        this._initUI();
        this._bindEvents();
    }

    _initUI() {
        // Populate Library
        this._renderLibrary('all');

        // Bind Tab Switching
        const tabs = document.querySelectorAll('.tab-btn');
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                tabs.forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                this._renderLibrary(e.target.dataset.category);
            });
        });

        // Bind Inspector Actions
        document.getElementById('btn-rotate').addEventListener('click', () => this.rotateSelected());
        document.getElementById('btn-clone').addEventListener('click', () => this.cloneSelected());
        document.getElementById('btn-delete').addEventListener('click', () => this.deleteSelected());
        document.getElementById('editor-export-btn').addEventListener('click', () => this.exportLayout());
    }

    _renderLibrary(category) {
        this.libraryContent.innerHTML = '';
        const items = category === 'all' 
            ? CATALOG_ITEMS 
            : CATALOG_ITEMS.filter(i => i.category === category);

        items.forEach(item => {
            const el = document.createElement('div');
            el.className = 'library-item';
            
            // Simple icon selection based on type
            let icon = '📦';
            if(item.type.includes('wall')) icon = '🧱';
            else if(item.type.includes('counter')) icon = '🟫';
            else if(item.type.includes('processor')) icon = '🍳';
            else if(item.type.includes('source')) icon = '🧺';
            else if(item.isServing) icon = '🛎️';

            el.innerHTML = `
                <div class="library-item-icon">${icon}</div>
                <div class="library-item-name">${item.name}</div>
            `;
            
            el.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent canvas click
                this.startPlacement(item);
            });
            
            this.libraryContent.appendChild(el);
        });
    }

    _bindEvents() {
        // Mouse Events
        this.renderer.domElement.addEventListener('pointerdown', (e) => this.onPointerDown(e));
        this.renderer.domElement.addEventListener('pointermove', (e) => this.onPointerMove(e));
        this.renderer.domElement.addEventListener('pointerup', (e) => this.onPointerUp(e));
        
        // Keyboard Shortcuts
        window.addEventListener('keydown', (e) => {
            if (!this.enabled) return;
            switch(e.key.toLowerCase()) {
                case 'escape': 
                    this.cancelPlacement(); 
                    this.deselect(); 
                    break;
                case 'delete': 
                case 'backspace':
                    this.deleteSelected(); 
                    break;
                case 'r': 
                    this.rotateSelected(); 
                    break;
                case 'c': 
                    this.cloneSelected(); 
                    break;
                case 't':
                    this.exportLayout();
                    break;
            }
        });
    }

    enable() {
        this.enabled = true;
        this.orbit.enabled = true;
        this.ui.style.display = 'block';
        
        // Show Schematic Grid
        this.gridHelper.visible = true;
        
        // Hide textured floor for clean CAD look
        const gameFloor = getFloorMesh();
        if(gameFloor) gameFloor.visible = false;

        // Set optimal editor view
        this.camera.position.set(0, 12, 8);
        this.camera.lookAt(0, 0, 0);
        this.orbit.target.set(0,0,0);
    }

    disable() {
        this.enabled = false;
        this.orbit.enabled = false;
        this.ui.style.display = 'none';
        this.cancelPlacement();
        this.deselect();

        // Revert Visuals
        this.gridHelper.visible = false;
        const gameFloor = getFloorMesh();
        if(gameFloor) gameFloor.visible = true;
    }

    update(delta) {
        if (!this.enabled) return;
        this.orbit.update();
        
        if (this.selectedObject) {
            this.selectionBox.update();
            this._updateInspectorData();
        }
    }

    // --- Core Logic ---

    startPlacement(template) {
        this.cancelPlacement(); // Clear existing ghost
        this.deselect(); // Clear selection
        
        this.placementMode = true;
        this.ghostObject = this._createObjectFromTemplate(template);
        
        // Make ghost transparent
        this.ghostObject.traverse(c => {
            if (c.isMesh) {
                c.material = c.material.clone();
                c.material.transparent = true;
                c.material.opacity = 0.6;
                c.material.emissive = new THREE.Color(0x00FF00);
                c.material.emissiveIntensity = 0.2;
            }
        });

        this.scene.add(this.ghostObject);
    }

    cancelPlacement() {
        if (this.ghostObject) {
            this.scene.remove(this.ghostObject);
            this.ghostObject = null;
        }
        this.placementMode = false;
    }

    confirmPlacement() {
        if (this.ghostObject) {
            // Create a real solid instance
            const template = this.ghostObject.userData.template;
            const realObject = this._createObjectFromTemplate(template);
            
            realObject.position.copy(this.ghostObject.position);
            realObject.rotation.copy(this.ghostObject.rotation);
            
            this.scene.add(realObject);
        }
    }

    _createObjectFromTemplate(t) {
        // Map template to world.js creation functions
        let obj;
        const fakeColor = t.color || '#FFFFFF';
        const dummyPos = { x: 0, z: 0 }; // Position set later

        if (t.type === STATION_TYPES.COUNTER || t.type === STATION_TYPES.SERVING) {
            obj = createCounterPrefab(t.name, fakeColor, t.isServing);
        } else if (t.type === STATION_TYPES.TABLE) {
            obj = createTablePrefab(t.name, fakeColor, {n:false, s:false, e:false, w:false});
        } else {
            // Generic Station / Wall / Source
            const def = {
                name: t.name,
                type: t.type,
                size: t.size,
                color: fakeColor,
                config: t.config,
                position: dummyPos
            };
            obj = createStationPrefab(def);
        }

        // Store template data for serialization later
        obj.userData.template = t; 
        // Y position will be handled by onPointerMove snapping
        obj.position.y = 0;

        return obj;
    }

    select(object) {
        if (this.selectedObject === object) return;
        this.selectedObject = object;
        this.selectionBox.setFromObject(object);
        this.selectionBox.visible = true;
        
        // Update UI
        this.inspector.style.display = 'flex';
        this.inspectorName.textContent = object.name;
    }

    deselect() {
        this.selectedObject = null;
        this.selectionBox.visible = false;
        this.inspector.style.display = 'none';
    }

    // --- Manipulation ---

    rotateSelected() {
        const target = this.placementMode ? this.ghostObject : this.selectedObject;
        if (target) {
            target.rotation.y -= Math.PI / 2;
            target.updateMatrixWorld();
            if (this.selectionBox.visible) this.selectionBox.update();
        }
    }

    deleteSelected() {
        if (this.selectedObject) {
            this.scene.remove(this.selectedObject);
            this.deselect();
        }
    }

    cloneSelected() {
        if (this.selectedObject) {
            const template = this.selectedObject.userData.template || {
                name: this.selectedObject.name,
                type: this.selectedObject.userData.stationType || this.selectedObject.userData.type,
            };
            
            if (this.selectedObject.userData.template) {
                this.startPlacement(this.selectedObject.userData.template);
            } else {
                const clone = this.selectedObject.clone();
                clone.position.x += GRID_UNIT;
                this.scene.add(clone);
                this.select(clone);
            }
        }
    }

    _updateInspectorData() {
        if (this.selectedObject) {
            this.inspectorX.textContent = this.selectedObject.position.x.toFixed(1);
            this.inspectorZ.textContent = this.selectedObject.position.z.toFixed(1);
        }
    }

    // --- Input Handling ---

    onPointerDown(e) {
        if (!this.enabled || e.button !== 0) return;
        
        // Ignore clicks on UI panels
        if (e.target.closest('.editor-panel') || e.target.closest('.editor-top-bar')) return;

        if (this.placementMode) {
            this.confirmPlacement();
        } else {
            // Raycast for selection
            const mouse = { 
                x: (e.clientX / window.innerWidth) * 2 - 1, 
                y: -(e.clientY / window.innerHeight) * 2 + 1 
            };
            this.raycaster.setFromCamera(mouse, this.camera);
            
            const candidates = [];
            this.scene.traverse(c => {
                // Find root objects
                if (c.userData && (c.userData.type === 'station' || c.userData.type === 'counter' || c.userData.stationType)) {
                    candidates.push(c);
                }
            });

            const hits = this.raycaster.intersectObjects(candidates, true);
            
            if (hits.length > 0) {
                // Walk up to the root group
                let root = hits[0].object;
                while(root.parent && root.parent !== this.scene) { root = root.parent; }
                
                if (this.selectedObject !== root) {
                    this.select(root);
                }
                this.isDragging = true;
                this.orbit.enabled = false; 
            } else {
                this.deselect();
            }
        }
    }

    onPointerMove(e) {
        if (!this.enabled) return;

        const mouse = { 
            x: (e.clientX / window.innerWidth) * 2 - 1, 
            y: -(e.clientY / window.innerHeight) * 2 + 1 
        };
        this.raycaster.setFromCamera(mouse, this.camera);

        // --- STACKING LOGIC ---
        // 1. Find potential support objects (Counters, Tables)
        const supports = [];
        this.scene.traverse(c => {
            // Must be visible, and not the object currently being dragged/placed
            if (c.visible && c !== this.ghostObject && c !== this.selectedObject) {
                if (c.userData && (c.userData.stationType === STATION_TYPES.COUNTER || c.userData.stationType === STATION_TYPES.TABLE || c.userData.stationType === STATION_TYPES.SERVING)) {
                    supports.push(c);
                }
            }
        });

        // 2. Check intersections with supports
        const hits = this.raycaster.intersectObjects(supports, true);
        
        let targetY = 0;
        let targetX = 0;
        let targetZ = 0;
        let foundSupport = false;

        if (hits.length > 0) {
            // Hit a counter/table -> Stack on top
            foundSupport = true;
            const hit = hits[0];
            const p = hit.point;
            targetX = p.x;
            targetZ = p.z;
            targetY = MODULE_HEIGHT; // Place on top of counter (0.9)
        } else {
            // Hit nothing valid -> Check Ground Plane (Y=0)
            const target = new THREE.Vector3();
            if (this.raycaster.ray.intersectPlane(this.groundPlane, target)) {
                foundSupport = true;
                targetX = target.x;
                targetZ = target.z;
                targetY = 0;
            }
        }

        if (foundSupport) {
            // Snap X/Z to grid
            const finalX = Math.round(targetX * 2) / 2; 
            const finalZ = Math.round(targetZ * 2) / 2;

            if (this.placementMode && this.ghostObject) {
                this.ghostObject.position.set(finalX, targetY, finalZ);
            } else if (this.isDragging && this.selectedObject) {
                this.selectedObject.position.set(finalX, targetY, finalZ);
            }
        }
    }

    onPointerUp() {
        if (this.enabled) {
            this.isDragging = false;
            this.orbit.enabled = true;
        }
    }

    // --- Export ---

    exportLayout() {
        const data = [];
        this.scene.traverse(c => {
            if (c.parent === this.scene && c.userData && (c.userData.type === 'station' || c.userData.type === 'counter')) {
                const entry = {
                    name: c.name,
                    type: c.userData.stationType || c.userData.type,
                    position: { x: parseFloat(c.position.x.toFixed(2)), z: parseFloat(c.position.z.toFixed(2)) },
                };
                
                // Check Y position to see if it's stacked (optional context)
                // Generally we export X/Z. Game logic snaps Y based on type.
                // But if we support custom stacking, we might need Y or "onTop" logic.
                // For now, the game engine assumes stations are at MODULE_HEIGHT if not walls.
                
                if (c.userData.size) entry.size = { width: c.userData.size.width, depth: c.userData.size.depth };
                if (c.userData.template?.color) entry.color = c.userData.template.color;
                if (c.userData.isServing) entry.isServing = true;
                if (c.userData.config) entry.config = c.userData.config;

                data.push(entry);
            }
        });
        
        console.log("--- LEVEL JSON EXPORT ---");
        console.log(JSON.stringify(data, null, 2));
        alert("Layout JSON exported to Console (F12)");
    }
}