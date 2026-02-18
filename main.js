import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { RGBShiftShader } from 'three/examples/jsm/shaders/RGBShiftShader.js';

// --- Scene Setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
scene.fog = new THREE.FogExp2(0x000000, 0.001);

// Camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 2, 8);
camera.lookAt(0, 0, 0);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

// --- Post-Processing Setup ---
const composer = new EffectComposer(renderer);

const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1.5, // Strength (High for neon glow)
    0.4, // Radius
    0.85 // Threshold
);
bloomPass.strength = 1.5;
bloomPass.radius = 0.5;
bloomPass.threshold = 0.1;
composer.addPass(bloomPass);

const rgbShiftPass = new ShaderPass(RGBShiftShader);
rgbShiftPass.uniforms['amount'].value = 0.0025; // Subtle RGB shift
composer.addPass(rgbShiftPass);

// --- 1. The Sea ---
const waterGeometry = new THREE.PlaneGeometry(10000, 10000);
const water = new Water(
    waterGeometry,
    {
        textureWidth: 512,
        textureHeight: 512,
        waterNormals: new THREE.TextureLoader().load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/waternormals.jpg', function (texture) {
            texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        }),
        sunDirection: new THREE.Vector3(),
        sunColor: 0xffffff,
        waterColor: 0x001e0f,
        distortionScale: 3.7,
        fog: scene.fog !== undefined
    }
);
water.rotation.x = -Math.PI / 2;
scene.add(water);

// --- 2. The Triangle ---
const triangleRadius = 20;
const triangleGeometry = new THREE.BufferGeometry();
const triangleVertices = [];
const topPt = new THREE.Vector3(0, triangleRadius * Math.sqrt(3) / 2, 0);
const botRightPt = new THREE.Vector3(triangleRadius / 2, -triangleRadius * Math.sqrt(3) / 4, 0);
const botLeftPt = new THREE.Vector3(-triangleRadius / 2, -triangleRadius * Math.sqrt(3) / 4, 0);

triangleVertices.push(
    botLeftPt.x, botLeftPt.y, botLeftPt.z,
    botRightPt.x, botRightPt.y, botRightPt.z,
    topPt.x, topPt.y, topPt.z
);
triangleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(triangleVertices, 3));

const triangleMaterial = new THREE.LineBasicMaterial({
    color: 0xff4500, // Orange-Red Neon
    linewidth: 2
});

const triangleMesh = new THREE.LineLoop(triangleGeometry, triangleMaterial);
triangleMesh.position.y = 5;
triangleMesh.position.z = -20;
scene.add(triangleMesh);

// Orbiting Lights
const light1 = new THREE.PointLight(0xffaa00, 3, 50);
const light2 = new THREE.PointLight(0xff4500, 3, 50);

const lightSphereGeo = new THREE.SphereGeometry(0.5);
const lightSphereMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

const lightMesh1 = new THREE.Mesh(lightSphereGeo, lightSphereMat);
const lightMesh2 = new THREE.Mesh(lightSphereGeo, lightSphereMat);

light1.add(lightMesh1);
light2.add(lightMesh2);

scene.add(light1);
scene.add(light2);

const triPoints = [botLeftPt, botRightPt, topPt];

// --- 3. The Starfield (Warp Effect) ---
const starGeometry = new THREE.BufferGeometry();
const starCount = 6000;
const starPositions = new Float32Array(starCount * 3);

for (let i = 0; i < starCount; i++) {
    const x = (Math.random() - 0.5) * 2000;
    const y = (Math.random() - 0.5) * 2000;
    const z = (Math.random() - 0.5) * 2000;
    starPositions[i * 3] = x;
    starPositions[i * 3 + 1] = y;
    starPositions[i * 3 + 2] = z;
}

starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
const starMaterial = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.7,
    transparent: true,
    opacity: 0.8,
    sizeAttenuation: true
});
const starField = new THREE.Points(starGeometry, starMaterial);
scene.add(starField);

// --- 5. Astrological Elements (Nebula/Clouds) ---
const nebulaGeometry = new THREE.BufferGeometry();
const nebulaCount = 50;
const nebulaPositions = new Float32Array(nebulaCount * 3);

for (let i = 0; i < nebulaCount; i++) {
    const x = (Math.random() - 0.5) * 400;
    const y = (Math.random() - 0.5) * 200 + 50;
    const z = (Math.random() - 0.5) * 400 - 100;
    nebulaPositions[i * 3] = x;
    nebulaPositions[i * 3 + 1] = y;
    nebulaPositions[i * 3 + 2] = z;
}

nebulaGeometry.setAttribute('position', new THREE.BufferAttribute(nebulaPositions, 3));

const canvas = document.createElement('canvas');
canvas.width = 32;
canvas.height = 32;
const context = canvas.getContext('2d');
const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);
gradient.addColorStop(0, 'rgba(100, 0, 255, 0.2)');
gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
context.fillStyle = gradient;
context.fillRect(0, 0, 32, 32);
const nebulaTexture = new THREE.CanvasTexture(canvas);

const nebulaMaterial = new THREE.PointsMaterial({
    color: 0x8800ff,
    size: 80,
    map: nebulaTexture,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
    blending: THREE.AdditiveBlending
});

const nebulaCloud = new THREE.Points(nebulaGeometry, nebulaMaterial);
scene.add(nebulaCloud);

// --- 6. Wandering Stars (Shooting Stars) ---
const shootingStarGeo = new THREE.BufferGeometry();
const shootPos = new Float32Array([0, 0, 0]);
shootingStarGeo.setAttribute('position', new THREE.BufferAttribute(shootPos, 3));
const shootingStarMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 2,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending
});
const shootingStar = new THREE.Points(shootingStarGeo, shootingStarMat);
scene.add(shootingStar);

let shootActive = false;
let shootVelocity = new THREE.Vector3();
let shootTimer = 0;

// Controls (Optional)
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Handle Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    composer.setSize(window.innerWidth, window.innerHeight);
    composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// Helper Function
function getPointOnTriangle(t, points) {
    let pos = t * 3;
    let index = Math.floor(pos);
    let segmentT = pos - index;
    let p1 = points[index % 3];
    let p2 = points[(index + 1) % 3];
    return new THREE.Vector3().lerpVectors(p1, p2, segmentT);
}

// --- Animation Loop ---
const clock = new THREE.Clock();

function animate() {
    const elapsedTime = clock.getElapsedTime();

    // Water
    water.material.uniforms['time'].value += 1.0 / 60.0;

    // Triangle Lights
    const loopTime = 5;
    const t1 = (elapsedTime % loopTime) / loopTime;
    const t2 = ((elapsedTime + loopTime / 2) % loopTime) / loopTime;

    const pos1 = getPointOnTriangle(t1, triPoints);
    const pos2 = getPointOnTriangle(t2, triPoints);

    light1.position.copy(pos1).add(triangleMesh.position);
    light2.position.copy(pos2).add(triangleMesh.position);

    // Dynamic Background
    // Smooth oscillation between Black and Dark Blue/Purple
    const hue = 0.6 + Math.sin(elapsedTime * 0.1) * 0.1; // 0.5 to 0.7
    const lightness = 0.05 + Math.sin(elapsedTime * 0.2) * 0.02; // Very dark
    const bgColor = new THREE.Color().setHSL(hue, 0.5, lightness);
    scene.background = bgColor;
    scene.fog.color = bgColor;

    // Stars
    const positions = starField.geometry.attributes.position.array;
    for (let i = 0; i < starCount; i++) {
        positions[i * 3 + 2] += 5; // Speed
        if (positions[i * 3 + 2] > 200) {
            positions[i * 3 + 2] = -1000;
            positions[i * 3] = (Math.random() - 0.5) * 2000;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 2000;
        }
    }
    starField.geometry.attributes.position.needsUpdate = true;

    // Animate Nebula
    nebulaCloud.rotation.z += 0.0005;

    // Animate Shooting Star
    if (!shootActive) {
        shootTimer += 1 / 60;
        if (shootTimer > 3 + Math.random() * 5) {
            shootActive = true;
            shootingStar.material.opacity = 1;
            const startX = (Math.random() - 0.5) * 200;
            const startY = 50 + Math.random() * 50;
            shootPos[0] = startX;
            shootPos[1] = startY;
            shootPos[2] = -100;

            shootVelocity.set(
                (Math.random() - 0.5) * 2,
                -1 - Math.random(),
                Math.random() * 0.5
            );
            shootingStar.geometry.attributes.position.needsUpdate = true;
        }
    } else {
        shootPos[0] += shootVelocity.x;
        shootPos[1] += shootVelocity.y;
        shootPos[2] += shootVelocity.z;

        shootingStar.material.opacity -= 0.01;

        if (shootingStar.material.opacity <= 0) {
            shootActive = false;
            shootTimer = 0;
        }
        shootingStar.geometry.attributes.position.needsUpdate = true;
    }

    controls.update();
    composer.render(); // Use composer
    requestAnimationFrame(animate);
}

animate();
