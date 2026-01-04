// --- 1. CORE 3D SCENE ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('canvas-container').appendChild(renderer.domElement);

// --- 2. THE PARTICLE SYSTEM ---
const particleCount = 5000;
const positions = new Float32Array(particleCount * 3);
const velocities = new Float32Array(particleCount * 3);

// Set bounds based on camera view
const xBound = 8; 
const yBound = 5;

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

// --- 3. PHYSICS ENGINE WITH BOUNDARIES ---
function animate() {
    requestAnimationFrame(animate);
    const posAttr = geo.attributes.position;
    
    for (let i = 0; i < particleCount; i++) {
        let ix = i * 3, iy = i * 3 + 1, iz = i * 3 + 2;
        
        // Direction to hand
        let dx = target.x - posAttr.array[ix];
        let dy = target.y - posAttr.array[iy];
        let dz = target.z - posAttr.array[iz];
        let d = Math.sqrt(dx*dx + dy*dy + dz*dz) + 0.1;

        // GESTURE PHYSICS
        if (currentGesture === "SHOCKWAVE") {
            velocities[ix] -= dx / (d * 5); 
            velocities[iy] -= dy / (d * 5);
            mat.color.setHex(0xff0055); 
        } else if (currentGesture === "PULSE") {
            velocities[ix] += (Math.random() - 0.5) * 0.5;
            velocities[iy] += (Math.random() - 0.5) * 0.5;
            mat.color.setHex(0x00ff88);
        } else {
            velocities[ix] += dx / (d * 300); 
            velocities[iy] += dy / (d * 300);
            mat.color.setHex(0x00f3ff);
        }

        // Apply velocities
        posAttr.array[ix] += velocities[ix];
        posAttr.array[iy] += velocities[iy];

        // SCREEN BOUNDARY CHECK (The Fix!)
        if (Math.abs(posAttr.array[ix]) > xBound) velocities[ix] *= -1.2;
        if (Math.abs(posAttr.array[iy]) > yBound) velocities[iy] *= -1.2;

        // Friction
        velocities[ix] *= 0.95;
        velocities[iy] *= 0.95;
    }
    posAttr.needsUpdate = true;
    renderer.render(scene, camera);
}
animate();

// --- 4. GESTURE RECOGNITION ---
function getDist(p1, p2) { return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2)); }

function onResults(results) {
    const canvas = document.querySelector('.output_canvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks[0]) {
        const landmarks = results.multiHandLandmarks[0];
        
        // DRAW SKELETON (Always visible for the flex)
        drawConnectors(ctx, landmarks, HAND_CONNECTIONS, {color: '#00f3ff', lineWidth: 2});
        drawLandmarks(ctx, landmarks, {color: '#ffffff', lineWidth: 1, radius: 2});

        // FIXED MIRRORING: (1 - x) to match hand movement
        target.x = ((1 - landmarks[8].x) - 0.5) * 15;
        target.y = ((1 - landmarks[8].y) - 0.5) * -10; // Negative to fix Y flip

        // DISTANCE CHECKS
        const pinch = getDist(landmarks[8], landmarks[4]);
        const palmOpen = getDist(landmarks[8], landmarks[0]) > 0.4;

        if (pinch < 0.05) currentGesture = "SHOCKWAVE";
        else if (palmOpen) currentGesture = "PULSE";
        else currentGesture = "VORTEX";

        document.getElementById('gesture-name').innerText = currentGesture;
        document.getElementById('sync-val').innerText = "LINK_STABLE";
    }
}

const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
hands.setOptions({ maxNumHands: 1, minDetectionConfidence: 0.7 });
hands.onResults(onResults);

const videoElement = document.querySelector('.input_video');
const cam = new Camera(videoElement, { onFrame: async () => { await hands.send({image: videoElement}); }, width: 640, height: 480 });
cam.start();