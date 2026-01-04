// --- 1. CORE 3D SCENE ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('canvas-container').appendChild(renderer.domElement);

const particleCount = 5000;
const positions = new Float32Array(particleCount * 3);
const velocities = new Float32Array(particleCount * 3);
const xBound = 8, yBound = 5;

for (let i = 0; i < particleCount * 3; i++) {
    positions[i] = (Math.random() - 0.5) * 10;
    velocities[i] = 0;
}

const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
const mat = new THREE.PointsMaterial({ size: 0.05, transparent: true, blending: THREE.AdditiveBlending });
const particles = new THREE.Points(geo, mat);
scene.add(particles);
camera.position.z = 6;

let target = new THREE.Vector3(0, 0, 0);
let currentGesture = "VORTEX";

// --- 2. PHYSICS ENGINE (With Bounds) ---
function animate() {
    requestAnimationFrame(animate);
    const posAttr = geo.attributes.position;
    
    for (let i = 0; i < particleCount; i++) {
        let ix = i * 3, iy = i * 3 + 1, iz = i * 3 + 2;
        let dx = target.x - posAttr.array[ix];
        let dy = target.y - posAttr.array[iy];
        let dz = target.z - posAttr.array[iz];
        let d = Math.sqrt(dx*dx + dy*dy + dz*dz) + 0.1;

        if (currentGesture === "SHOCKWAVE") {
            velocities[ix] -= dx / (d * 5); velocities[iy] -= dy / (d * 5);
            mat.color.setHex(0xff0055); 
        } else if (currentGesture === "PULSE") {
            velocities[ix] += (Math.random() - 0.5) * 0.2;
            velocities[iy] += (Math.random() - 0.5) * 0.2;
            mat.color.setHex(0x00ff88);
        } else {
            velocities[ix] += dx / (d * 300); velocities[iy] += dy / (d * 300);
            mat.color.setHex(0x00f3ff);
        }

        posAttr.array[ix] += velocities[ix];
        posAttr.array[iy] += velocities[iy];

        if (Math.abs(posAttr.array[ix]) > xBound) velocities[ix] *= -1.1;
        if (Math.abs(posAttr.array[iy]) > yBound) velocities[iy] *= -1.1;

        velocities[ix] *= 0.95; velocities[iy] *= 0.95;
    }
    posAttr.needsUpdate = true;
    renderer.render(scene, camera);
}
animate();

// --- 3. STABLE CAMERA & MEDIAPIPE ---
const videoElement = document.querySelector('.input_video');
const canvasElement = document.querySelector('.output_canvas');
const canvasCtx = canvasElement.getContext('2d');

function onResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks[0]) {
        const landmarks = results.multiHandLandmarks[0];
        
        // SKELETON DRAWING
        drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {color: '#00f3ff', lineWidth: 2});
        drawLandmarks(canvasCtx, landmarks, {color: '#ffffff', lineWidth: 1, radius: 2});

        // MIRROR FIX: Right is Right, Left is Left
        target.x = ((1 - landmarks[8].x) - 0.5) * 15;
        target.y = (-(landmarks[8].y - 0.5)) * 10; 

        const pinch = Math.sqrt(Math.pow(landmarks[8].x - landmarks[4].x, 2) + Math.pow(landmarks[8].y - landmarks[4].y, 2));
        const palmOpen = Math.sqrt(Math.pow(landmarks[8].x - landmarks[0].x, 2) + Math.pow(landmarks[8].y - landmarks[0].y, 2)) > 0.4;

        if (pinch < 0.05) currentGesture = "SHOCKWAVE";
        else if (palmOpen) currentGesture = "PULSE";
        else currentGesture = "VORTEX";

        document.getElementById('gesture-name').innerText = currentGesture;
        document.getElementById('sync-val').innerText = "STABLE";
    }
    canvasCtx.restore();
}

const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
hands.onResults(onResults);

// Start camera only when video is ready
const cam = new Camera(videoElement, {
    onFrame: async () => { await hands.send({image: videoElement}); },
    width: 640, height: 480
});

// Explicit error catching for the camera
cam.start().catch(err => {
    console.error("Camera failed:", err);
    document.getElementById('gesture-name').innerText = "CAMERA_ERROR: Check Permissions";
});