// 测试Three.js npm包是否正常工作
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

console.log('Three.js version:', THREE.REVISION);
console.log('GLTFLoader available:', !!GLTFLoader);
console.log('OrbitControls available:', !!OrbitControls);

// 测试基本功能
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();

console.log('✅ Three.js npm packages are working correctly!');
console.log('Scene:', scene);
console.log('Camera:', camera);
console.log('Renderer:', renderer);

// 清理
renderer.dispose();
