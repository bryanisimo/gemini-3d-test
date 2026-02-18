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

// --- Custom Radial RGB Shift Shader ---
const RadialRGBShiftShader = {
    uniforms: {
        'tDiffuse': { value: null },
        'amount': { value: 0.005 },
        'angle': { value: 0.0 }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float amount;
        uniform float angle;
        varying vec2 vUv;

        void main() {
            vec2 offset = amount * vec2( cos(angle), sin(angle));
            
            // Calculate distance from center (0.5, 0.5)
            float dist = distance(vUv, vec2(0.5));
            
            // Increase offset based on distance (squared for non-linear effect)
            vec2 rOffset = offset * dist * 2.0; 
            vec2 gOffset = offset * dist * 1.0; // Less shift for green
            vec2 bOffset = offset * dist * 2.5; 
            
            vec4 cr = texture2D(tDiffuse, vUv + rOffset);
            vec4 cg = texture2D(tDiffuse, vUv);
            vec4 cb = texture2D(tDiffuse, vUv - bOffset);
            
            gl_FragColor = vec4(cr.r, cg.g, cb.b, 1.0);
        }
    `
};

const rgbShiftPass = new ShaderPass(RadialRGBShiftShader);
rgbShiftPass.uniforms['amount'].value = 0.005; // Base amount, scales with distance
rgbShiftPass.uniforms['angle'].value = 3.5;
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
const triangleRadius = 35;
const triangleWidthFactor = 1.3;

const topPt = new THREE.Vector3(0, triangleRadius * Math.sqrt(3) / 2, 0);
const botRightPt = new THREE.Vector3(triangleRadius / 2 * triangleWidthFactor, -triangleRadius * Math.sqrt(3) / 4, 0);
const botLeftPt = new THREE.Vector3(-triangleRadius / 2 * triangleWidthFactor, -triangleRadius * Math.sqrt(3) / 4, 0);

const triangleGroup = new THREE.Group();
triangleGroup.position.set(0, 10, -20);
scene.add(triangleGroup);

// Create the Black Mask (Solid Center)
const maskShape = new THREE.Shape();
maskShape.moveTo(botLeftPt.x, botLeftPt.y);
maskShape.lineTo(botRightPt.x, botRightPt.y);
maskShape.lineTo(topPt.x, topPt.y);
maskShape.closePath();

const maskGeo = new THREE.ShapeGeometry(maskShape);
const maskMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
const maskMesh = new THREE.Mesh(maskGeo, maskMat);
maskMesh.position.z = -0.1; // Behind the border
triangleGroup.add(maskMesh);

// Create Clean Border (Neon Frame)
// We use a LineLoop but with a custom material or just a very clear LineSegments
const borderPoints = [botLeftPt, botRightPt, topPt, botLeftPt];
const borderGeo = new THREE.BufferGeometry().setFromPoints(borderPoints);
const borderMat = new THREE.LineBasicMaterial({ color: 0xff4500 });
const borderLine = new THREE.Line(borderGeo, borderMat);
triangleGroup.add(borderLine);

// Add a slightly thicker "glow" mesh for the border using a Shape with a hole
const thickness = 0.5;
const outerShape = new THREE.Shape();
outerShape.moveTo(botLeftPt.x - thickness, botLeftPt.y - thickness);
outerShape.lineTo(botRightPt.x + thickness, botRightPt.y - thickness);
outerShape.lineTo(topPt.x, topPt.y + thickness);
outerShape.closePath();

const innerShape = new THREE.Path();
innerShape.moveTo(botLeftPt.x, botLeftPt.y);
innerShape.lineTo(botRightPt.x, botRightPt.y);
innerShape.lineTo(topPt.x, topPt.y);
innerShape.closePath();
outerShape.holes.push(innerShape);

const glowGeo = new THREE.ShapeGeometry(outerShape);
const glowMat = new THREE.MeshBasicMaterial({ color: 0xff4500, transparent: true, opacity: 0.8 });
const glowMesh = new THREE.Mesh(glowGeo, glowMat);
glowMesh.position.z = 0.01;
triangleGroup.add(glowMesh);

// Orbiting Lights (Oval, Brighter Center)
const light1 = new THREE.PointLight(0xffaa00, 5, 80); // Increased intensity
const light2 = new THREE.PointLight(0xff4500, 5, 80);

// Outer Oval (Colored) - Made larger
const outerGeo = new THREE.SphereGeometry(1.5);
const outerMat = new THREE.MeshBasicMaterial({ color: 0xff4500, transparent: true, opacity: 0.8 });
const outerMesh1 = new THREE.Mesh(outerGeo, outerMat);
const outerMesh2 = new THREE.Mesh(outerGeo, outerMat);
outerMesh1.scale.set(1.5, 0.5, 0.5); // More pronounced oval
outerMesh2.scale.set(1.5, 0.5, 0.5);

// Inner Core (White/Bright) - Made larger
const innerGeo = new THREE.SphereGeometry(0.8);
const innerMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
const innerMesh1 = new THREE.Mesh(innerGeo, innerMat);
const innerMesh2 = new THREE.Mesh(innerGeo, innerMat);
innerMesh1.scale.set(1.5, 0.5, 0.5);
innerMesh2.scale.set(1.5, 0.5, 0.5);

light1.add(outerMesh1);
light1.add(innerMesh1);
light2.add(outerMesh2);
light2.add(innerMesh2);

scene.add(light1);
scene.add(light2);

const triPoints = [botLeftPt, botRightPt, topPt];

// --- 3. The Starfield (Custom Shader for Fade In) ---
const starGeometry = new THREE.BufferGeometry();
const starCount = 3000;
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
function getTriangleData(t, points) {
    let pos = t * 3;
    let index = Math.floor(pos);
    let segmentT = pos - index;
    let p1 = points[index % 3];
    let p2 = points[(index + 1) % 3];

    return {
        position: new THREE.Vector3().lerpVectors(p1, p2, segmentT),
        tangent: new THREE.Vector3().subVectors(p2, p1).normalize()
    };
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

    const data1 = getTriangleData(t1, triPoints);
    const data2 = getTriangleData(t2, triPoints);

    // Position lights relative to the triangle group
    light1.position.copy(data1.position).add(triangleGroup.position);
    light2.position.copy(data2.position).add(triangleGroup.position);

    // Align ovals (X axis) with tangent
    const axis = new THREE.Vector3(1, 0, 0);
    // Add quaternion rotation to align
    if (data1.tangent.lengthSq() > 0) light1.quaternion.setFromUnitVectors(axis, data1.tangent);
    if (data2.tangent.lengthSq() > 0) light2.quaternion.setFromUnitVectors(axis, data2.tangent);

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
