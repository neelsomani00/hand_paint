// --- 1. LIGHTWEIGHT 3D ENGINE ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(1); // Force 1:1 pixel ratio for max speed
document.getElementById('canvas-container').appendChild(renderer.domElement);

camera.position.z = 12;

// --- 2. ARTISTIC GHOST HANDS (Point Cloud Design) ---
function createGhostHand(colorValue) {
    const group = new THREE.Group();
    
    // Joint Particles
    const mat = new THREE.PointsMaterial({ color: colorValue, size: 0.3, blending: THREE.AdditiveBlending });
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(21 * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particles = new THREE.Points(geo, mat);
    
    group.add(particles);
    scene.add(group);
    return { group, geo, positions };
}

const handR = createGhostHand(0x00f3ff); // Neon Blue
const handL = createGhostHand(0x00ff88); // Neon Green

// --- 3. THE ARTISTIC TARGET (Crystal) ---
const crystalGeo = new THREE.IcosahedronGeometry(1.5, 1);
const crystalMat = new THREE.MeshPhongMaterial({ 
    color: 0xffffff, 
    wireframe: true, 
    emissive: 0x00f3ff,
    emissiveIntensity: 0.5 
});
const crystal = new THREE.Mesh(crystalGeo, crystalMat);
scene.add(crystal);

const pLight = new THREE.PointLight(0x00f3ff, 2, 20);
scene.add(pLight);
scene.add(new THREE.AmbientLight(0x111111));

// --- 4. STABLE CAMERA & AI HANDLER ---
const video = document.querySelector('.input_video');
const canvas = document.querySelector('.output_canvas');
const ctx = canvas.getContext('2d');

async function startSystem() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 640, height: 480, frameRate: 30 } 
        });
        video.srcObject = stream;
        await video.play();

        const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
        
        hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 0, // FASTEST MODE
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        hands.onResults(onResults);

        const process = () => {
            hands.send({image: video});
            requestAnimationFrame(process);
        };
        process();

    } catch (e) {
        console.error("System Error:", e);
        document.getElementById('gesture-name').innerText = "ERROR: CAMERA_BLOCKED";
    }
}

function onResults(results) {
    // Draw Mini-Preview
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    handR.group.visible = false;
    handL.group.visible = false;

    if (results.multiHandLandmarks) {
        results.multiHandLandmarks.forEach((lm, i) => {
            const label = results.multiHandedness[i].label; // "Left" or "Right"
            // Note: MediaPipe labels are often flipped, so we adjust
            const h = label === "Left" ? handR : handL; 
            h.group.visible = true;

            const pos = h.positions;
            lm.forEach((p, j) => {
                // Correct Mapping: (1-p.x) for Mirroring
                pos[j * 3] = ((1 - p.x) - 0.5) * 25;
                pos[j * 3 + 1] = (-(p.y - 0.5)) * 18;
                pos[j * 3 + 2] = -p.z * 15;
            });
            h.geo.attributes.position.needsUpdate = true;

            // GESTURE: FIST DETECT (Check Index Tip vs Wrist distance)
            const indexTip = new THREE.Vector3(pos[24], pos[25], pos[26]);
            const wrist = new THREE.Vector3(pos[0], pos[1], pos[2]);
            const dist = indexTip.distanceTo(wrist);

            if (dist < 4) { // Hand is closed/fist
                document.getElementById('gesture-name').innerText = "MODE: CRYSTAL_GRAB";
                crystal.position.lerp(indexTip, 0.1);
                crystal.rotation.x += 0.05;
                crystal.material.color.setHex(label === "Left" ? 0x00f3ff : 0x00ff88);
            } else {
                document.getElementById('gesture-name').innerText = "MODE: SCANNING";
                crystal.material.color.setHex(0xffffff);
            }
        });
    }
}

function animate() {
    requestAnimationFrame(animate);
    crystal.rotation.y += 0.01;
    pLight.position.copy(crystal.position);
    renderer.render(scene, camera);
}

// BOOT SYSTEM
startSystem();
animate();

// Handle Window Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});