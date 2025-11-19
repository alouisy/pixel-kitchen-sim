// src/setup.js  (Note: File path is corrected to editor/setup.js)
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { PLAYER_HEIGHT } from './constants.js'; // Corrected import path

export function setupScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb); // Sky blue
    scene.fog = new THREE.Fog(0x87ceeb, 0, 50);
    return scene;
}

export function setupCamera() {
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, PLAYER_HEIGHT, 3); // Start position
    return camera;
}

// Modified setupRenderer to accept canvasElement as argument
export function setupRenderer(canvasElement) {
    const renderer = new THREE.WebGLRenderer({
        canvas: canvasElement, // Use the passed canvasElement
        antialias: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows
    return renderer;
}

export function setupLighting(scene) {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // Slightly brighter ambient
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0); // Slightly stronger directional
    directionalLight.position.set(5, 15, 10); // Higher and further back
    directionalLight.castShadow = true;
    // Configure shadow properties for better quality (optional)
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -10;
    directionalLight.shadow.camera.right = 10;
    directionalLight.shadow.camera.top = 10;
    directionalLight.shadow.camera.bottom = -10;

    scene.add(directionalLight);
    // scene.add(new THREE.CameraHelper(directionalLight.shadow.camera)); // Debug shadows
}

export function setupResizeHandler(camera, renderer) {
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}