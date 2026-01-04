// --- 1. THREE.JS SCENE SETUP ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('canvas-container').appendChild(renderer.domElement);

// Add Lighting
const light = new THREE.PointLight(0xffffff, 1, 100);
light.position.set(0, 10, 10);
scene.add(light);
scene.add(new THREE.AmbientLight(0x404040));
camera.position.z = 8;

// --- 2. THE OBJECTS (Stuff to pick up) ---
const shapes = [];
const shapeGeometries = [new THREE.BoxGeometry(1, 1, 1), new THREE.SphereGeometry(0.7, 32, 32), new THREE.TorusGeometry(0.5, 0.2, 16, 100)];
const colors = [0xff0055, 0x00f3ff, 0xffaa00];

for(let i = 0; i < 3; i++) {
    const mesh = new THREE.Mesh(shapeGeometries[i], new THREE.MeshStandardMaterial({ color: colors[i] }));
    mesh.position.set((i - 1) * 3, 0, 0);
    scene.add(mesh);
    shapes.push(mesh);
}

// --- 3. THE SKELETON HANDS ---
function createSkeletonHand() {
    const group = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({ color: 0x00f3ff });
    const points = [];
    for(let i = 0; i < 21; i++) {
        const p = new THREE.Mesh(new THREE.SphereGeometry(0.1), material);
        group.add(p);
        points.push(p);
    }
    scene.add(group);
    return { group, points };
}

const hand1 = createSkeletonHand();
const hand2 = createSkeletonHand();
let grabbedObject = [null, null]; // Track what each hand is holding

// --- 4. FIRE EFFECT (Pinch) ---
const fireParticles = new THREE.Points(
    new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(300), 3)),
    new THREE.PointsMaterial({ color: 0xff4400, size: 0.1, transparent: true })
);
scene.add(fireParticles);

// --- 5. AI TRACKING & GESTURES ---
function onResults(results) {
    const canvas = document.querySelector('.output_canvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Reset Hand Visibility
    hand1.group.visible = false;
    hand2.group.visible = false;

    if (results.multiHandLandmarks) {
        results.multiHandLandmarks.forEach((landmarks, index) => {
            const h = index === 0 ? hand1 : hand2;
            h.group.visible = true;

            // Update Hand Point Positions
            landmarks.forEach((lm, i) => {
                const x = ((1 - lm.x) - 0.5) * 18;
                const y = (-(lm.y - 0.5)) * 12;
                h.points[i].position.set(x, y, -lm.z * 10);
            });

            const wrist = h.points[0].position;
            const indexTip = h.points[8].position;
            const thumbTip = h.points[4].position;

            // GESTURE 1: PINCH (FIRE BLAST)
            const pinchDist = indexTip.distanceTo(thumbTip);
            if(pinchDist < 0.5) {
                h.points.forEach(p => p.material.color.setHex(0xff4400));
                // Move fire particles to index tip
                fireParticles.position.copy(indexTip);
            } else {
                h.points.forEach(p => p.material.color.setHex(0x00f3ff));
            }

            // GESTURE 2: FIST / GRAB
            const isFist = indexTip.distanceTo(wrist) < 1.5;
            if(isFist) {
                shapes.forEach(shape => {
                    if(shape.position.distanceTo(indexTip) < 1.5 || grabbedObject[index] === shape) {
                        grabbedObject[index] = shape;
                        shape.position.lerp(indexTip, 0.2); // Smoothly follow hand
                    }
                });
            } else {
                grabbedObject[index] = null;
            }
        });
    }
}

// --- 6. INITIALIZE ---
const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
hands.setOptions({ maxNumHands: 2, minDetectionConfidence: 0.7 });
hands.onResults(onResults);

const cam = new Camera(document.querySelector('.input_video'), {
    onFrame: async () => { await hands.send({image: document.querySelector('.input_video')}); },
    width: 640, height: 480
});
cam.start();

function animate() {
    requestAnimationFrame(animate);
    shapes.forEach(s => { if(!grabbedObject.includes(s)) s.rotation.y += 0.01; });
    renderer.render(scene, camera);
}
animate();