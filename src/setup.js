// src/setup.js
import * as THREE from 'three';
import { PLAYER_HEIGHT } from './constants.js';

export function setupScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x202025); // Darker background to make lights pop
    scene.fog = new THREE.Fog(0x202025, 5, 20);
    return scene;
}

export function setupCamera() {
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, PLAYER_HEIGHT, 3); 
    return camera;
}

export function setupRenderer() {
    const renderer = new THREE.WebGLRenderer({
        canvas: document.getElementById('gameCanvas'),
        antialias: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    
    // Shadow Map settings
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows
    
    // Tone Mapping for better colors
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    return renderer;
}

export function setupLighting(scene) {
    // 1. Ambient Light (Soft fill)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); 
    scene.add(ambientLight);

    // 2. Directional Light (Sun/Main Source)
    const dirLight = new THREE.DirectionalLight(0xffeeb1, 1.2); // Warm light
    dirLight.position.set(5, 10, 5);
    dirLight.castShadow = true;
    
    // Optimize Shadow Map
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 50;
    const d = 10;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0005; // Fix shadow acne on voxels
    
    scene.add(dirLight);

    // 3. Rim Light (Cool blue from back for contrast)
    const rimLight = new THREE.DirectionalLight(0x4455ff, 0.3);
    rimLight.position.set(-5, 5, -5);
    scene.add(rimLight);
}

export function setupResizeHandler(camera, renderer) {
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}