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
camera.position.set(0.6, -6.4, 15.23);
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
bloomPass.strength = 1.8; // Slightly stronger bloom for the bold triangle
bloomPass.radius = 0.8; // Wider blur
bloomPass.threshold = 0.1;
composer.addPass(bloomPass);

const rgbShiftPass = new ShaderPass(RGBShiftShader);
rgbShiftPass.uniforms['amount'].value = 0.0020;
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
water.position.y = -30; // Move water down significantly
scene.add(water);

// --- 2. The Triangle ---
// 70% of screen height at z=-20.
// Approx radius 35.
const triangleRadius = 35;
const topPt = new THREE.Vector3(0, triangleRadius * Math.sqrt(3) / 2, 0);
const botRightPt = new THREE.Vector3(triangleRadius / 2 * 1.3, -triangleRadius * Math.sqrt(3) / 4, 0);
const botLeftPt = new THREE.Vector3(-triangleRadius / 2 * 1.3, -triangleRadius * Math.sqrt(3) / 4, 0);

// Path for TubeGeometry
const curve = new THREE.CatmullRomCurve3([
    botLeftPt, botRightPt, topPt
], true, 'catmullrom', 0); // closed, type, tension (0 for straight lines between points)

const tubeGeometry = new THREE.TubeGeometry(curve, 64, 0.4, 8, true); // radius 0.4 for thickness

const triangleMaterial = new THREE.MeshBasicMaterial({
    color: 0xff4500, // Orange-Red Neon
});

const triangleMesh = new THREE.Mesh(tubeGeometry, triangleMaterial);
triangleMesh.position.y = 10;
triangleMesh.position.z = -20;
scene.add(triangleMesh);

// --- Black Fill (Mask) ---
const triangleShape = new THREE.Shape();
triangleShape.moveTo(botLeftPt.x, botLeftPt.y);
triangleShape.lineTo(botRightPt.x, botRightPt.y);
triangleShape.lineTo(topPt.x, topPt.y);
triangleShape.closePath();

const fillGeometry = new THREE.ShapeGeometry(triangleShape);
const fillMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
const triangleFill = new THREE.Mesh(fillGeometry, fillMaterial);
// Position it slightly behind the neon frame to avoid z-fighting
triangleFill.position.copy(triangleMesh.position);
triangleFill.position.z -= 0.1;
scene.add(triangleFill);

// Orbiting Lights (Oval, Brighter Center)
const light1 = new THREE.PointLight(0xffaa00, 2, 60);
const light2 = new THREE.PointLight(0xff4500, 2, 60);

// Outer Oval (Colored)
const outerGeo = new THREE.SphereGeometry(1);
const outerMat = new THREE.MeshBasicMaterial({ color: 0xff4500, transparent: true, opacity: 0.6 });
const outerMesh1 = new THREE.Mesh(outerGeo, outerMat);
const outerMesh2 = new THREE.Mesh(outerGeo, outerMat);
outerMesh1.scale.set(0.6, 0.3, 0.3); // Oval
outerMesh2.scale.set(0.6, 0.3, 0.3);

// Inner Core (White/Bright)
const innerGeo = new THREE.SphereGeometry(0.5);
const innerMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
const innerMesh1 = new THREE.Mesh(innerGeo, innerMat);
const innerMesh2 = new THREE.Mesh(innerGeo, innerMat);
innerMesh1.scale.set(0.6, 0.3, 0.3); // Oval
innerMesh2.scale.set(0.6, 0.3, 0.3);

light1.add(outerMesh1);
light1.add(innerMesh1);
light2.add(outerMesh2);
light2.add(innerMesh2);

scene.add(light1);
scene.add(light2);

const triPoints = [botLeftPt, botRightPt, topPt];

// --- 3. The Starfield (Custom Shader for Fade In) ---
const starGeometry = new THREE.BufferGeometry();
const starCount = 6000;
const starPositions = new Float32Array(starCount * 3);
const starOpacities = new Float32Array(starCount);

for (let i = 0; i < starCount; i++) {
    const x = (Math.random() - 0.5) * 2000;
    const y = (Math.random() - 0.5) * 2000;
    const z = (Math.random() - 0.5) * 2000; // Spread out depth
    starPositions[i * 3] = x;
    starPositions[i * 3 + 1] = y;
    starPositions[i * 3 + 2] = z;
    starOpacities[i] = Math.random(); // Phase
}

starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
starGeometry.setAttribute('aOpacity', new THREE.BufferAttribute(starOpacities, 1));

// Vertex Shader
const starVertexShader = `
    attribute float aOpacity;
    varying float vAlpha;
    void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = (300.0 / -mvPosition.z); // Size attenuation
        
        // Fade in logic:
        // Map z from -1000 (far) to 200 (near camera)
        // We want opacity 0 at -1000, 1 at -500.
        
        float dist = position.z;
        // Smoothstep for fade in
        float fadeIn = smoothstep(-1000.0, -500.0, dist);
        // Fade out near camera
        float fadeOut = 1.0 - smoothstep(100.0, 200.0, dist);
        
        vAlpha = fadeIn * fadeOut;
    }
`;

// Fragment Shader
const starFragmentShader = `
    varying float vAlpha;
    void main() {
        // Circle shape
        vec2 coord = gl_PointCoord - vec2(0.5);
        if(length(coord) > 0.5) discard;
        
        gl_FragColor = vec4(1.0, 1.0, 1.0, vAlpha);
    }
`;

const starMaterial = new THREE.ShaderMaterial({
    uniforms: {},
    vertexShader: starVertexShader,
    fragmentShader: starFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
});

const starField = new THREE.Points(starGeometry, starMaterial);
scene.add(starField);


// --- 5. Astrological (Nebula) ---
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

// --- 6. Shooting Stars ---
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

    // Water - slower
    water.material.uniforms['time'].value += 1.0 / 120.0;

    // Triangle Lights - slower
    const loopTime = 15; // Slower loop
    const t1 = (elapsedTime % loopTime) / loopTime;
    const t2 = ((elapsedTime + loopTime / 2) % loopTime) / loopTime;

    const pos1 = getPointOnTriangle(t1, triPoints);
    const pos2 = getPointOnTriangle(t2, triPoints);

    // Rotate oval lights to align with path tangent? 
    // Simplified: Just position.
    light1.position.copy(pos1).add(triangleMesh.position);
    light2.position.copy(pos2).add(triangleMesh.position);

    // Dynamic Background - slower
    const hue = 0.6 + Math.sin(elapsedTime * 0.05) * 0.1;
    const lightness = 0.05 + Math.sin(elapsedTime * 0.1) * 0.02;
    const bgColor = new THREE.Color().setHSL(hue, 0.5, lightness);
    scene.background = bgColor;
    scene.fog.color = bgColor;

    // Stars - Slower, Randomized Reset
    const positions = starField.geometry.attributes.position.array;
    for (let i = 0; i < starCount; i++) {
        positions[i * 3 + 2] += 0.5; // Much slower speed
        if (positions[i * 3 + 2] > 200) {
            // Reset to far back, but randomized depth to prevent "walls"
            positions[i * 3 + 2] = -1000 - Math.random() * 500;
            positions[i * 3] = (Math.random() - 0.5) * 2000;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 2000;
        }
    }
    starField.geometry.attributes.position.needsUpdate = true;

    // Nebula - Slower
    nebulaCloud.rotation.z += 0.0001;

    // Shooting Star logic (Keep speed fast, but frequency low)
    if (!shootActive) {
        shootTimer += 1 / 60;
        if (shootTimer > 5 + Math.random() * 10) {
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
    composer.render();
    requestAnimationFrame(animate);
}

animate();
