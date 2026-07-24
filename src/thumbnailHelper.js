// src/thumbnailHelper.js
import * as THREE from 'three';
import { CATALOG_ITEMS, STATION_TYPES } from './constants.js';
import { createItemMesh } from './voxelBuilder.js';
import { createStationPrefab, createCounterPrefab } from './world.js';

let sharedRenderer = null;
const thumbnailCache = new Map();

export function setThumbnailRenderer(renderer) {
    sharedRenderer = renderer;
}

function getRenderer() {
    if (sharedRenderer) return sharedRenderer;
    // Fallback offscreen WebGL renderer if main renderer not passed yet
    const canvas = document.createElement('canvas');
    sharedRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    sharedRenderer.setSize(128, 128);
    return sharedRenderer;
}

/**
 * Creates a 3D Three.js Object3D for the given key (station name or item/dish name).
 */
function createModelForKey(key) {
    // 1. Check if key matches a station or source from CATALOG_ITEMS
    const catalogMatch = CATALOG_ITEMS.find(item => 
        (item.name && item.name.toLowerCase() === key.toLowerCase()) ||
        (item.config && (item.config.ingredient === key || item.config.item === key))
    );

    if (catalogMatch) {
        if (catalogMatch.type === STATION_TYPES.COUNTER || catalogMatch.type === STATION_TYPES.SERVING) {
            return createCounterPrefab(catalogMatch.name, catalogMatch.color || '#8B4513', catalogMatch.isServing);
        } else {
            const def = {
                name: catalogMatch.name,
                type: catalogMatch.type,
                size: catalogMatch.size,
                color: catalogMatch.color || '#FFFFFF',
                config: catalogMatch.config,
                position: { x: 0, z: 0 }
            };
            return createStationPrefab(def);
        }
    }

    // 2. Try creating as a Voxel item mesh (ingredient or meal dish)
    try {
        const itemMesh = createItemMesh(key);
        if (itemMesh) return itemMesh;
    } catch (e) {
        // Fallback
    }

    // 3. Fallback generic station
    const def = {
        name: key,
        type: STATION_TYPES.COUNTER,
        color: '#555555',
        position: { x: 0, z: 0 }
    };
    return createCounterPrefab(key, '#8B4513', false);
}

/**
 * Renders a 3D Three.js Object3D model to a crisp PNG Data URL.
 */
export function renderModelToDataURL(model, width = 128, height = 128) {
    const renderer = getRenderer();

    const renderTarget = new THREE.WebGLRenderTarget(width, height, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.NearestFilter,
        format: THREE.RGBAFormat
    });

    const tempScene = new THREE.Scene();

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.25);
    tempScene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.35);
    dirLight1.position.set(5, 8, 5);
    tempScene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xfffae0, 0.75);
    dirLight2.position.set(-5, 4, -3);
    tempScene.add(dirLight2);

    const fillLight = new THREE.DirectionalLight(0xb0d4ff, 0.5);
    fillLight.position.set(0, -5, 4);
    tempScene.add(fillLight);

    tempScene.add(model);

    const box = new THREE.Box3().setFromObject(model);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = new THREE.Vector3();
    box.getSize(size);

    const maxDim = Math.max(size.x, size.y, size.z, 0.1);
    const fov = 35;
    const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 100);

    const dist = (maxDim / (2 * Math.tan((fov * Math.PI) / 360))) * 1.5;
    camera.position.set(
        center.x + dist * 0.7,
        center.y + dist * 0.7,
        center.z + dist * 1.1
    );
    camera.lookAt(center);

    const originalClearColor = new THREE.Color();
    renderer.getClearColor(originalClearColor);
    const originalClearAlpha = renderer.getClearAlpha();

    renderer.setClearColor(0x000000, 0);
    renderer.setRenderTarget(renderTarget);
    renderer.clear();
    renderer.render(tempScene, camera);

    const pixels = new Uint8Array(width * height * 4);
    renderer.readRenderTargetPixels(renderTarget, 0, 0, width, height, pixels);

    renderer.setRenderTarget(null);
    renderer.setClearColor(originalClearColor, originalClearAlpha);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(width, height);

    const linearToSRGB = (c) => {
        const val = c / 255;
        if (val <= 0.0031308) {
            return Math.max(0, Math.min(255, Math.round(val * 12.92 * 255)));
        }
        return Math.max(0, Math.min(255, Math.round((1.055 * Math.pow(val, 1 / 2.4) - 0.055) * 255)));
    };

    for (let y = 0; y < height; y++) {
        const srcY = height - 1 - y;
        for (let x = 0; x < width; x++) {
            const srcIdx = (srcY * width + x) * 4;
            const dstIdx = (y * width + x) * 4;
            imgData.data[dstIdx] = linearToSRGB(pixels[srcIdx]);
            imgData.data[dstIdx + 1] = linearToSRGB(pixels[srcIdx + 1]);
            imgData.data[dstIdx + 2] = linearToSRGB(pixels[srcIdx + 2]);
            imgData.data[dstIdx + 3] = pixels[srcIdx + 3];
        }
    }
    ctx.putImageData(imgData, 0, 0);
    const dataURL = canvas.toDataURL('image/png');

    // Cleanup
    tempScene.remove(model);
    model.traverse(c => {
        if (c.geometry) c.geometry.dispose();
        if (c.material) {
            if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
            else c.material.dispose();
        }
    });
    renderTarget.dispose();

    return dataURL;
}

/**
 * Gets or creates a cached 3D voxel thumbnail Data URL for the specified key.
 */
export function getVoxelThumbnail(key) {
    if (!key) return '';
    const cacheKey = String(key).trim();
    if (thumbnailCache.has(cacheKey)) {
        return thumbnailCache.get(cacheKey);
    }

    try {
        const model = createModelForKey(cacheKey);
        const dataURL = renderModelToDataURL(model);
        thumbnailCache.set(cacheKey, dataURL);
        return dataURL;
    } catch (err) {
        console.warn(`Failed to generate thumbnail for ${cacheKey}:`, err);
        return '';
    }
}
