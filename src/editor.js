// src/editor.js
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GRID_UNIT, GAMEPAD_DEADZONE, CATALOG_ITEMS, STATION_TYPES, MODULE_HEIGHT } from './constants.js';
import { createCounterPrefab, createStationPrefab, createTablePrefab, getFloorMesh, resizeWall, refreshSmartObjects } from './world.js';
import { RECIPES } from './gameData.js';

export class LevelEditor {
    constructor(camera, renderer, scene, interactionManager, onExit) {
        this.camera = camera;
        this.renderer = renderer;
        this.scene = scene;
        this.interactionManager = interactionManager;
        this.onExit = onExit;
        this.enabled = false;
        this.raycaster = new THREE.Raycaster();
        
        // Loaded Level Metadata
        this.currentLevelData = {};

        // State
        this.selectedObject = null;
        this.ghostObject = null; // Object currently being placed
        this.isDragging = false;
        this.placementMode = false; // If true, we are trying to place a new item
        
        // Resize/Extend State
        this.activeHandle = null;
        this.startDragPos = new THREE.Vector3();
        this.originalSize = { width: 0, depth: 0 };
        this.originalPos = new THREE.Vector3();
        this.extendingGhosts = []; // For counters/tables

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

        // Resize Handles
        this.handlesGroup = new THREE.Group();
        this.scene.add(this.handlesGroup);
        this.handles = {};
        ['n', 's', 'e', 'w'].forEach(dir => {
            const g = new THREE.SphereGeometry(0.25, 16, 16);
            const m = new THREE.MeshBasicMaterial({ color: 0x00FFFF, depthTest: false, transparent: true, opacity: 0.8 });
            const mesh = new THREE.Mesh(g, m);
            mesh.userData = { isHandle: true, direction: dir };
            mesh.renderOrder = 999;
            mesh.visible = false;
            this.handlesGroup.add(mesh);
            this.handles[dir] = mesh;
        });


        // Init UI
        this.ui = document.getElementById('editor-ui');
        this.libraryContent = document.getElementById('library-content');
        this.inspector = document.getElementById('editor-inspector');
        this.inspectorName = document.getElementById('inspector-name');
        this.inspectorX = document.getElementById('val-x');
        this.inspectorZ = document.getElementById('val-z');

        // Meta Modal
        this.metaModal = document.getElementById('editor-meta-modal');

        this._initUI();
        this._bindEvents();
    }

    _initUI() {
        // Populate Library
        this._renderLibrary('all');

        // Populate Meals for Meta
        const mealsSelect = document.getElementById('meta-meals');
        Object.keys(RECIPES).forEach(r => {
            const opt = document.createElement('option');
            opt.value = r;
            opt.textContent = r;
            mealsSelect.appendChild(opt);
        });

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
        document.getElementById('editor-exit-btn').addEventListener('click', () => {
            if (this.onExit) this.onExit();
        });

        // Meta Button
        document.getElementById('editor-meta-btn').addEventListener('click', () => {
            this.openMetaModal();
        });
        document.getElementById('meta-close-btn').addEventListener('click', () => {
            this.saveMetaFromModal();
            this.metaModal.style.display = 'none';
        });

        // Bind Config Editor
        this.inspectorConfig = document.getElementById('inspector-config');
        document.getElementById('btn-save-config').addEventListener('click', () => this.saveConfig());
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
            else if(item.category === 'Items') icon = '🍽️';

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
            // Do not trigger shortcuts if user is typing in textarea or inputs
            if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;

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

    // Called when opening editor for a specific level
    loadLevel(levelData) {
        // We store the metadata locally. The 3D objects are already added by main.js using buildKitchen
        // We just need to sync our internal state.
        this.currentLevelData = JSON.parse(JSON.stringify(levelData)); // Deep copy
        document.getElementById('editor-current-level-name').textContent = levelData.name || "Untitled";
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
            this._updateHandles();
        }
    }

    // --- Meta Modal ---

    openMetaModal() {
        this.metaModal.style.display = 'flex';
        const d = this.currentLevelData;
        document.getElementById('meta-name').value = d.name || "";
        document.getElementById('meta-duration').value = d.duration || 180;
        document.getElementById('meta-delay').value = d.newOrderDelay || 15;
        document.getElementById('meta-max-orders').value = d.maxActiveOrders || 2;
        document.getElementById('meta-star1').value = d.starThresholds ? d.starThresholds[0] : 100;
        document.getElementById('meta-star2').value = d.starThresholds ? d.starThresholds[1] : 200;
        document.getElementById('meta-star3').value = d.starThresholds ? d.starThresholds[2] : 300;
        
        const mealsSelect = document.getElementById('meta-meals');
        Array.from(mealsSelect.options).forEach(opt => {
            opt.selected = d.availableMeals ? d.availableMeals.includes(opt.value) : false;
        });
    }

    saveMetaFromModal() {
        const d = this.currentLevelData;
        d.name = document.getElementById('meta-name').value;
        d.duration = parseInt(document.getElementById('meta-duration').value);
        d.newOrderDelay = parseInt(document.getElementById('meta-delay').value);
        d.maxActiveOrders = parseInt(document.getElementById('meta-max-orders').value);
        d.starThresholds = [
            parseInt(document.getElementById('meta-star1').value),
            parseInt(document.getElementById('meta-star2').value),
            parseInt(document.getElementById('meta-star3').value),
        ];
        
        const mealsSelect = document.getElementById('meta-meals');
        d.availableMeals = Array.from(mealsSelect.selectedOptions).map(opt => opt.value);

        document.getElementById('editor-current-level-name').textContent = d.name;
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
            
            // Auto-fuse visuals
            refreshSmartObjects(this.scene);
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
            // Neighbors default to false, will fuse later
            obj = createTablePrefab(t.name, fakeColor, {n:false, s:false, e:false, w:false});
        } else {
            // Generic Station / Wall / Source / Preplaced Item
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

        // Populate Config
        // Use existing userData.config if set, otherwise fallback to template config
        const config = object.userData.config || object.userData.template?.config || {};
        this.inspectorConfig.value = JSON.stringify(config, null, 2);
        
        this._updateHandles();
    }

    deselect() {
        this.selectedObject = null;
        this.selectionBox.visible = false;
        this.inspector.style.display = 'none';
        this.handlesGroup.visible = false;
    }

    // --- Manipulation ---

    saveConfig() {
        if (!this.selectedObject) return;
        try {
            const newConfig = JSON.parse(this.inspectorConfig.value);
            this.selectedObject.userData.config = newConfig;
            
            // Visual feedback
            const btn = document.getElementById('btn-save-config');
            const originalText = btn.innerText;
            btn.innerText = "✅ Saved!";
            setTimeout(() => btn.innerText = originalText, 1000);
            
        } catch (e) {
            alert("Invalid JSON syntax! Check your brackets and quotes.");
        }
    }

    rotateSelected() {
        const target = this.placementMode ? this.ghostObject : this.selectedObject;
        if (target) {
            target.rotation.y -= Math.PI / 2;
            target.updateMatrixWorld();
            if (this.selectionBox.visible) this.selectionBox.update();
            // If rotating placed object, refresh visuals
            if (!this.placementMode) refreshSmartObjects(this.scene);
        }
    }

    deleteSelected() {
        if (this.selectedObject) {
            this.scene.remove(this.selectedObject);
            this.deselect();
            refreshSmartObjects(this.scene);
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
                refreshSmartObjects(this.scene);
            }
        }
    }

    _updateInspectorData() {
        if (this.selectedObject) {
            this.inspectorX.textContent = this.selectedObject.position.x.toFixed(1);
            this.inspectorZ.textContent = this.selectedObject.position.z.toFixed(1);
        }
    }
    
    // --- Handle Management ---

    _updateHandles() {
        const obj = this.selectedObject;
        if (!obj) {
            this.handlesGroup.visible = false;
            return;
        }
        
        const type = obj.userData.stationType || obj.userData.type;
        const resizable = type === STATION_TYPES.WALL;
        const extendable = type === STATION_TYPES.COUNTER || type === STATION_TYPES.TABLE || type === STATION_TYPES.SERVING;
        
        if (!resizable && !extendable) {
            this.handlesGroup.visible = false;
            return;
        }
        
        this.handlesGroup.visible = true;
        
        // Calculate bounds
        const box = new THREE.Box3().setFromObject(obj);
        const center = obj.position;
        // Use simple box dimensions based on userData for walls to be precise, or bounding box for others
        let w, d;
        if (resizable && obj.userData.size) {
            w = obj.userData.size.width;
            d = obj.userData.size.depth;
        } else {
            w = box.max.x - box.min.x;
            d = box.max.z - box.min.z;
        }
        
        const y = center.y;
        const offset = 0.3;

        this.handles.n.position.set(center.x, y, center.z - d/2 - offset);
        this.handles.s.position.set(center.x, y, center.z + d/2 + offset);
        this.handles.e.position.set(center.x + w/2 + offset, y, center.z);
        this.handles.w.position.set(center.x - w/2 - offset, y, center.z);
        
        Object.values(this.handles).forEach(h => h.visible = true);
    }

    // --- Input Handling ---

    onPointerDown(e) {
        if (!this.enabled || e.button !== 0) return;
        
        // Ignore clicks on UI panels
        if (e.target.closest('.editor-panel') || e.target.closest('.editor-top-bar')) return;

        const mouse = { 
            x: (e.clientX / window.innerWidth) * 2 - 1, 
            y: -(e.clientY / window.innerHeight) * 2 + 1 
        };
        this.raycaster.setFromCamera(mouse, this.camera);

        // Check Handle Click first
        if (this.handlesGroup.visible) {
            const handleIntersects = this.raycaster.intersectObjects(this.handlesGroup.children);
            if (handleIntersects.length > 0) {
                this.activeHandle = handleIntersects[0].object;
                this.isDragging = true;
                this.orbit.enabled = false;
                
                // Setup drag state
                const planeIntersect = new THREE.Vector3();
                this.raycaster.ray.intersectPlane(this.groundPlane, planeIntersect);
                this.startDragPos.copy(planeIntersect);
                this.originalPos.copy(this.selectedObject.position);
                
                if (this.selectedObject.userData.stationType === STATION_TYPES.WALL) {
                    this.originalSize = { ...this.selectedObject.userData.size };
                }
                
                return; // Consumed
            }
        }

        if (this.placementMode) {
            this.confirmPlacement();
        } else {
            // Raycast for selection
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
        
        // --- RESIZE / EXTEND LOGIC ---
        if (this.isDragging && this.activeHandle && this.selectedObject) {
            const intersect = new THREE.Vector3();
            if (this.raycaster.ray.intersectPlane(this.groundPlane, intersect)) {
                const delta = intersect.clone().sub(this.startDragPos);
                const type = this.selectedObject.userData.stationType;
                
                // Direction multipliers based on handle
                const dir = this.activeHandle.userData.direction;
                // n: z-, s: z+, e: x+, w: x-
                
                if (type === STATION_TYPES.WALL) {
                    // Resize Logic
                    let dw = 0; 
                    let dd = 0;
                    let dx = 0;
                    let dz = 0;
                    
                    // Calculate dimension changes locally aligned
                    if (dir === 'e') dw = delta.x;
                    if (dir === 'w') dw = -delta.x;
                    if (dir === 's') dd = delta.z;
                    if (dir === 'n') dd = -delta.z;
                    
                    // Snap to grid unit
                    let newW = Math.max(GRID_UNIT, Math.round((this.originalSize.width + dw) * 2) / 2);
                    let newD = Math.max(GRID_UNIT, Math.round((this.originalSize.depth + dd) * 2) / 2);
                    
                    // Shift center to compensate anchor
                    if (dir === 'e') dx = (newW - this.originalSize.width) / 2;
                    if (dir === 'w') dx = -(newW - this.originalSize.width) / 2;
                    if (dir === 's') dz = (newD - this.originalSize.depth) / 2;
                    if (dir === 'n') dz = -(newD - this.originalSize.depth) / 2;

                    // Update Wall
                    resizeWall(this.selectedObject, newW, newD);
                    this.selectedObject.position.set(
                        this.originalPos.x + dx,
                        this.originalPos.y,
                        this.originalPos.z + dz
                    );
                    this.selectionBox.setFromObject(this.selectedObject);
                } 
                else if (type === STATION_TYPES.COUNTER || type === STATION_TYPES.TABLE || type === STATION_TYPES.SERVING) {
                    // Tiling Logic
                    // Calculate how many units moved along axis
                    let axisDelta = 0;
                    let axisVector = new THREE.Vector3();
                    
                    if (dir === 'e') { axisDelta = delta.x; axisVector.set(1,0,0); }
                    if (dir === 'w') { axisDelta = -delta.x; axisVector.set(-1,0,0); }
                    if (dir === 's') { axisDelta = delta.z; axisVector.set(0,0,1); }
                    if (dir === 'n') { axisDelta = -delta.z; axisVector.set(0,0,-1); }
                    
                    const count = Math.floor((axisDelta + (GRID_UNIT/2)) / GRID_UNIT);
                    
                    // Cleanup old ghosts
                    this.extendingGhosts.forEach(g => this.scene.remove(g));
                    this.extendingGhosts = [];
                    
                    if (count > 0) {
                        // Create ghosts
                        const t = this.selectedObject.userData.template;
                        for(let i=1; i<=count; i++) {
                            const ghost = this._createObjectFromTemplate(t);
                            ghost.position.copy(this.originalPos).add(axisVector.clone().multiplyScalar(i * GRID_UNIT));
                            
                            // Make ghost transparent
                             ghost.traverse(c => {
                                if (c.isMesh) {
                                    c.material = c.material.clone();
                                    c.material.transparent = true;
                                    c.material.opacity = 0.5;
                                    c.material.color.setHex(0x00FF00);
                                }
                            });
                            
                            this.scene.add(ghost);
                            this.extendingGhosts.push(ghost);
                        }
                    }
                }
                
                // Update handle positions to follow the expansion
                this._updateHandles(); 
            }
            return;
        }

        // --- STACKING LOGIC (Existing) ---
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
            if (this.activeHandle) {
                // Finish Extend/Resize
                if (this.extendingGhosts.length > 0) {
                    // Solidify ghosts
                    this.extendingGhosts.forEach(g => {
                         const t = g.userData.template;
                         const real = this._createObjectFromTemplate(t);
                         real.position.copy(g.position);
                         real.rotation.copy(g.rotation);
                         this.scene.add(real);
                         this.scene.remove(g);
                    });
                    this.extendingGhosts = [];
                    refreshSmartObjects(this.scene); // Fuse visuals
                }
                
                this.activeHandle = null;
                this._updateHandles();
            }
            
            this.isDragging = false;
            this.orbit.enabled = true;
        }
    }

    // --- Export ---

    exportLayout() {
        const layout = [];
        this.scene.traverse(c => {
            if (c.parent === this.scene && c.userData && (c.userData.type === 'station' || c.userData.type === 'counter')) {
                const entry = {
                    name: c.name,
                    type: c.userData.stationType || c.userData.type,
                    position: { x: parseFloat(c.position.x.toFixed(2)), z: parseFloat(c.position.z.toFixed(2)) },
                };
                
                // Include rotation if not zero
                if (c.rotation.y !== 0) {
                    entry.rotation = parseFloat(c.rotation.y.toFixed(2));
                }

                if (c.userData.size) entry.size = { width: c.userData.size.width, depth: c.userData.size.depth };
                if (c.userData.template?.color) entry.color = c.userData.template.color;
                if (c.userData.isServing) entry.isServing = true;
                
                // Config: Prioritize userData.config (preserved from loaded levels)
                // Fallback to template config if available (editor-created items)
                if (c.userData.config) {
                    entry.config = c.userData.config;
                } else if (c.userData.template?.config) {
                    entry.config = c.userData.template.config;
                }

                layout.push(entry);
            }
        });
        
        // Update current level data with new layout
        this.currentLevelData.layout = layout;
        
        const jsonStr = JSON.stringify(this.currentLevelData, null, 2);
        const fileName = `level_${this.currentLevelData.levelId || 'custom'}.json`;

        // Trigger Download
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(jsonStr);
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", fileName);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        
        alert(`Level Exported! Replace the file in 'levels/${fileName}' to persist changes.`);
    }
}