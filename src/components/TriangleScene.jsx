import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

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
            
            float dist = distance(vUv, vec2(0.5));
            
            vec2 rOffset = offset * dist * 2.0; 
            vec2 gOffset = offset * dist * 1.0; 
            vec2 bOffset = offset * dist * 2.5; 
            
            vec4 cr = texture2D(tDiffuse, vUv + rOffset);
            vec4 cg = texture2D(tDiffuse, vUv);
            vec4 cb = texture2D(tDiffuse, vUv - bOffset);
            
            gl_FragColor = vec4(cr.r, cg.g, cb.b, 1.0);
        }
    `
};

const TriangleScene = () => {
    const containerRef = useRef();
    const requestRef = useRef();

    useEffect(() => {
        if (!containerRef.current) return;

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
        containerRef.current.appendChild(renderer.domElement);

        // --- Post-Processing Setup ---
        const composer = new EffectComposer(renderer);
        const renderPass = new RenderPass(scene, camera);
        composer.addPass(renderPass);

        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            1.5, 0.4, 0.85
        );
        bloomPass.strength = 1.8;
        bloomPass.radius = 0.8;
        bloomPass.threshold = 0.1;
        composer.addPass(bloomPass);

        const rgbShiftPass = new ShaderPass(RadialRGBShiftShader);
        rgbShiftPass.uniforms['amount'].value = 0.005;
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
                sunColor: 0x808080,
                waterColor: 0x001e0f,
                distortionScale: 3.7,
                fog: scene.fog !== undefined
            }
        );
        water.rotation.x = -Math.PI / 2;
        water.position.y = -30;
        scene.add(water);

        // --- 2. The Triangle ---
        const triangleRadius = 35;
        const triangleWidthFactor = 1.3;
        const topPt = new THREE.Vector3(0, triangleRadius * Math.sqrt(3) / 2, 0);
        const botRightPt = new THREE.Vector3(triangleRadius / 2 * triangleWidthFactor, -triangleRadius * Math.sqrt(3) / 4, 0);
        const botLeftPt = new THREE.Vector3(-triangleRadius / 2 * triangleWidthFactor, -triangleRadius * Math.sqrt(3) / 4, 0);
        const triPoints = [botLeftPt, botRightPt, topPt];

        const triangleGroup = new THREE.Group();
        triangleGroup.position.set(0, 10, -20);
        scene.add(triangleGroup);

        const maskShape = new THREE.Shape();
        maskShape.moveTo(botLeftPt.x, botLeftPt.y);
        maskShape.lineTo(botRightPt.x, botRightPt.y);
        maskShape.lineTo(topPt.x, topPt.y);
        maskShape.closePath();

        const maskGeo = new THREE.ShapeGeometry(maskShape);
        const maskMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const maskMesh = new THREE.Mesh(maskGeo, maskMat);
        maskMesh.position.z = -0.1;
        triangleGroup.add(maskMesh);

        const borderMat = new THREE.MeshBasicMaterial({ color: 0xff4500 });
        const jointGeo = new THREE.SphereGeometry(0.5, 16, 16);
        [botLeftPt, botRightPt, topPt].forEach(pt => {
            const joint = new THREE.Mesh(jointGeo, borderMat);
            joint.position.copy(pt);
            triangleGroup.add(joint);
        });

        function createEdge(p1, p2) {
            const dist = p1.distanceTo(p2);
            const edgeGeo = new THREE.CylinderGeometry(0.5, 0.5, dist, 8);
            const edge = new THREE.Mesh(edgeGeo, borderMat);
            edge.position.copy(p1).add(p2).multiplyScalar(0.5);
            edge.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p2.clone().sub(p1).normalize());
            triangleGroup.add(edge);
        }
        createEdge(botLeftPt, botRightPt);
        createEdge(botRightPt, topPt);
        createEdge(topPt, botLeftPt);

        // Orbiting Lights
        const light1 = new THREE.PointLight(0xffaa00, 5, 80);
        const light2 = new THREE.PointLight(0xff4500, 5, 80);
        const outerGeo = new THREE.SphereGeometry(1.5);
        const baseOuterMat = new THREE.MeshBasicMaterial({ color: 0xff4500, transparent: true, opacity: 0.8 });
        const innerGeo = new THREE.SphereGeometry(0.8);
        const baseInnerMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1.0 });

        const createOrbitMesh = (outerMat, innerMat) => {
            const g = new THREE.Group();
            const outer = new THREE.Mesh(outerGeo, outerMat.clone());
            const inner = new THREE.Mesh(innerGeo, innerMat.clone());
            outer.scale.set(1.5, 0.5, 0.5);
            inner.scale.set(1.5, 0.5, 0.5);
            g.add(outer);
            g.add(inner);
            return { group: g, outer, inner };
        };

        const or1 = createOrbitMesh(baseOuterMat, baseInnerMat);
        const or2 = createOrbitMesh(baseOuterMat, baseInnerMat);
        light1.add(or1.group);
        light2.add(or2.group);
        scene.add(light1);
        scene.add(light2);

        // --- 3. Starfield ---
        const starGeometry = new THREE.BufferGeometry();
        const starCount = 3000;
        const starPositions = new Float32Array(starCount * 3);
        const starOpacities = new Float32Array(starCount);

        for (let i = 0; i < starCount; i++) {
            starPositions[i * 3] = (Math.random() - 0.5) * 2000;
            starPositions[i * 3 + 1] = (Math.random() - 0.5) * 2000;
            starPositions[i * 3 + 2] = (Math.random() - 0.5) * 2000;
            starOpacities[i] = Math.random();
        }
        starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
        starGeometry.setAttribute('aOpacity', new THREE.BufferAttribute(starOpacities, 1));

        const starMaterial = new THREE.ShaderMaterial({
            vertexShader: `
                attribute float aOpacity;
                varying float vAlpha;
                void main() {
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_Position = projectionMatrix * mvPosition;
                    gl_PointSize = (300.0 / -mvPosition.z);
                    float dist = position.z;
                    float fadeIn = smoothstep(-1000.0, -500.0, dist);
                    float fadeOut = 1.0 - smoothstep(100.0, 200.0, dist);
                    vAlpha = fadeIn * fadeOut;
                }
            `,
            fragmentShader: `
                varying float vAlpha;
                void main() {
                    vec2 coord = gl_PointCoord - vec2(0.5);
                    if(length(coord) > 0.5) discard;
                    gl_FragColor = vec4(1.0, 1.0, 1.0, vAlpha);
                }
            `,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        const starField = new THREE.Points(starGeometry, starMaterial);
        scene.add(starField);

        // --- 4. Nebula ---
        const nebulaGeometry = new THREE.BufferGeometry();
        const nebulaCount = 50;
        const nebulaPosArr = new Float32Array(nebulaCount * 3);
        for (let i = 0; i < nebulaCount; i++) {
            nebulaPosArr[i * 3] = (Math.random() - 0.5) * 400;
            nebulaPosArr[i * 3 + 1] = (Math.random() - 0.5) * 200 + 50;
            nebulaPosArr[i * 3 + 2] = (Math.random() - 0.5) * 400 - 100;
        }
        nebulaGeometry.setAttribute('position', new THREE.BufferAttribute(nebulaPosArr, 3));

        const nebulaCanvas = document.createElement('canvas');
        nebulaCanvas.width = 32;
        nebulaCanvas.height = 32;
        const ctx = nebulaCanvas.getContext('2d');
        const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
        grad.addColorStop(0, 'rgba(100, 0, 255, 0.2)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 32, 32);
        const nebulaTexture = new THREE.CanvasTexture(nebulaCanvas);

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

        // --- 5. Shooting Star ---
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

        // Controls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;

        const handleResize = () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            composer.setSize(window.innerWidth, window.innerHeight);
            composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        };
        window.addEventListener('resize', handleResize);

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

        const clock = new THREE.Clock();
        const animate = () => {
            const elapsedTime = clock.getElapsedTime();
            water.material.uniforms['time'].value += 1.0 / 120.0;

            const loopTime = 50;
            const t1 = (elapsedTime % loopTime) / loopTime;
            const t2 = ((elapsedTime + loopTime / 2) % loopTime) / loopTime;

            const data1 = getTriangleData(t1, triPoints);
            const data2 = getTriangleData(t2, triPoints);

            const corners = [0, 1 / 3, 2 / 3, 1];
            function getOpacity(t, thresh = 0.12) {
                let minDist = 1.0;
                for (let c of corners) {
                    let d = Math.abs(t - c);
                    if (d > 0.5) d = 1.0 - d;
                    if (d < minDist) minDist = d;
                }
                return THREE.MathUtils.smoothstep(minDist, 0.0, thresh);
            }

            const op1 = getOpacity(t1);
            const op2 = getOpacity(t2);

            or1.outer.material.opacity = 0.8 * op1;
            or1.inner.material.opacity = 1.0 * op1;
            or2.outer.material.opacity = 0.8 * op2;
            or2.inner.material.opacity = 1.0 * op2;

            const zOffset = new THREE.Vector3(0, 0, 0.5);
            light1.position.copy(data1.position).add(zOffset).add(triangleGroup.position);
            light2.position.copy(data2.position).add(zOffset).add(triangleGroup.position);

            const axis = new THREE.Vector3(1, 0, 0);
            if (data1.tangent.lengthSq() > 0) light1.quaternion.setFromUnitVectors(axis, data1.tangent);
            if (data2.tangent.lengthSq() > 0) light2.quaternion.setFromUnitVectors(axis, data2.tangent);

            const hue = 0.6 + Math.sin(elapsedTime * 0.05) * 0.1;
            const lightness = 0.05 + Math.sin(elapsedTime * 0.1) * 0.02;
            const bgColor = new THREE.Color().setHSL(hue, 0.5, lightness);
            scene.background = bgColor;
            scene.fog.color = bgColor;

            const starPosArr = starField.geometry.attributes.position.array;
            for (let i = 0; i < starCount; i++) {
                starPosArr[i * 3 + 2] += 0.5;
                if (starPosArr[i * 3 + 2] > 200) {
                    starPosArr[i * 3 + 2] = -1000 - Math.random() * 500;
                    starPosArr[i * 3] = (Math.random() - 0.5) * 2000;
                    starPosArr[i * 3 + 1] = (Math.random() - 0.5) * 2000;
                }
            }
            starField.geometry.attributes.position.needsUpdate = true;

            nebulaCloud.rotation.z += 0.0001;

            if (!shootActive) {
                shootTimer += 1 / 60;
                if (shootTimer > 5 + Math.random() * 10) {
                    shootActive = true;
                    shootingStar.material.opacity = 1;
                    shootPos[0] = (Math.random() - 0.5) * 200;
                    shootPos[1] = 50 + Math.random() * 50;
                    shootPos[2] = -100;
                    shootVelocity.set((Math.random() - 0.5) * 2, -1 - Math.random(), Math.random() * 0.5);
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
            requestRef.current = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            window.removeEventListener('resize', handleResize);
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            renderer.dispose();
            composer.dispose();
            // Dispose geometries and materials
            scene.traverse((object) => {
                if (object.geometry) object.geometry.dispose();
                if (object.material) {
                    if (Array.isArray(object.material)) {
                        object.material.forEach(mat => mat.dispose());
                    } else {
                        object.material.dispose();
                    }
                }
            });
        };
    }, []);

    return <div ref={containerRef} style={{ width: '100%', height: '100vh', overflow: 'hidden' }} />;
};

export default TriangleScene;
