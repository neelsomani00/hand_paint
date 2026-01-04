// --- 1. CORE 3D SCENE ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('canvas-container').appendChild(renderer.domElement);

// --- 2. THE PARTICLE SWARM ---
const particleCount = 5000;
const positions = new Float32Array(particleCount * 3);
const velocities = new Float32Array(particleCount * 3);

for (let i = 0; i < particleCount * 3; i++) {
    positions[i] = (Math.random() - 0.5) * 10;
    velocities[i] = 0;
}

const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

const mat = new THREE.PointsMaterial({
    color: 0x00f3ff,
    size: 0.05,
    transparent: true,
    blending: THREE.AdditiveBlending
});

const particles = new THREE.Points(geo, mat);
scene.add(particles);
camera.position.z = 5;

// Pointer Target (This follows your hand)
let target = new THREE.Vector3(0, 0, 0);
let isPinching = false;

// --- 3. ANIMATION LOOP (The Physics) ---
function animate() {
    requestAnimationFrame(animate);
    
    const posAttr = geo.attributes.position;
    for (let i = 0; i < particleCount; i++) {
        let ix = i * 3, iy = i * 3 + 1, iz = i * 3 + 2;

        // Vector from particle to hand
        let dx = target.x - posAttr.array[ix];
        let dy = target.y - posAttr.array[iy];
        let dz = target.z - posAttr.array[iz];
        let dist = Math.sqrt(dx*dx + dy*dy + dz*dz);

        if (isPinching) {
            // EXPLOSION MODE
            velocities[ix] -= dx / (dist * 10);
            velocities[iy] -= dy / (dist * 10);
        } else {
            // SWARM MODE (Gravity toward hand)
            velocities[ix] += dx / (dist * 500);
            velocities[iy] += dy / (dist * 500);
            velocities[iz] += dz / (dist * 500);
        }

        // Friction (slows them down so they don't fly away forever)
        velocities[ix] *= 0.95;
        velocities[iy] *= 0.95;
        velocities[iz] *= 0.95;

        // Update positions
        posAttr.array[ix] += velocities[ix];
        posAttr.array[iy] += velocities[iy];
        posAttr.array[iz] += velocities[iz];
    }
    posAttr.needsUpdate = true;
    renderer.render(scene, camera);
}
animate();

// --- 4. AI HAND TRACKING ---
const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });

hands.onResults((results) => {
    const canvasElement = document.querySelector('.output_canvas');
    const canvasCtx = canvasElement.getContext('2d');
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks[0]) {
        const landmarks = results.multiHandLandmarks[0];
        
        // Map 2D to 3D Space (Fixed Mirroring)
        target.x = ((1 - landmarks[8].x) - 0.5) * 10;
        target.y = ((1 - landmarks[8].y) - 0.5) * 8;
        
        // Pinch Detection
        const dist = Math.sqrt(Math.pow(landmarks[8].x - landmarks[4].x, 2) + Math.pow(landmarks[8].y - landmarks[4].y, 2));
        isPinching = dist < 0.05;

        document.getElementById('sync-val').innerText = "100%";
        document.getElementById('gesture-name').innerText = isPinching ? "SHOCKWAVE_EMITTED" : "VORTEX_LOCKED";
        mat.color.setHex(isPinching ? 0xff0055 : 0x00f3ff);
    } else {
        document.getElementById('sync-val').innerText = "0%";
        document.getElementById('gesture-name').innerText = "LOST_SIGNAL";
    }
});

const videoElement = document.querySelector('.input_video');
const cameraDevice = new Camera(videoElement, {
    onFrame: async () => { await hands.send({image: videoElement}); },
    width: 640, height: 480
});
cameraDevice.start();