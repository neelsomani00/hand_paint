// --- 1. THREE.JS 3D SCENE SETUP ---
const container = document.getElementById('three-container');
const scene = new THREE.Scene();
const camera3D = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });

renderer.setSize(container.clientWidth, container.clientHeight);
container.appendChild(renderer.domElement);

// Add a glowing ball
const geometry = new THREE.SphereGeometry(1, 32, 32);
const material = new THREE.MeshPhongMaterial({ color: 0x007acc, shininess: 100 });
const ball = new THREE.Mesh(geometry, material);
scene.add(ball);

// Add a grid floor to see movement better
const grid = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
grid.position.y = -2;
scene.add(grid);

// Lighting
const light = new THREE.PointLight(0xffffff, 1, 100);
light.position.set(10, 10, 10);
scene.add(light);
scene.add(new THREE.AmbientLight(0x404040));

camera3D.position.z = 8;

// Animation Loop
function animate() {
    requestAnimationFrame(animate);
    ball.rotation.y += 0.01;
    renderer.render(scene, camera3D);
}
animate();

// --- 2. HAND TRACKING & MIRROR FIX ---
let lastX = 0;
let lastY = 0;
const smoothing = 0.15;

function getDist(p1, p2) {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

function onResults(results) {
    const canvasElement = document.getElementsByClassName('output_canvas')[0];
    const canvasCtx = canvasElement.getContext('2d');
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.multiHandLandmarks) {
        for (const landmarks of results.multiHandLandmarks) {
            // Draw Hand Skeleton
            drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {color: '#007acc', lineWidth: 2});

            const indexTip = landmarks[8];
            const thumbTip = landmarks[4];

            // MIRROR FIX: 
            // MediaPipe gives 0 on left, 1 on right. 
            // In 3D, we want 1 to be right, 0 to be left. 
            // Because our video is mirrored, we use (1 - indexTip.x) to flip it back.
            const rawX = (1 - indexTip.x); 
            const rawY = (1 - indexTip.y);

            // Convert 0-1 range to -5 to 5 for 3D space
            const targetX = (rawX - 0.5) * 15;
            const targetY = (rawY - 0.5) * 10;

            // Apply Smoothing
            ball.position.x += (targetX - ball.position.x) * smoothing;
            ball.position.y += (targetY - ball.position.y) * smoothing;

            // Pinch Detection to change color
            const pinch = getDist(indexTip, thumbTip);
            if(pinch < 0.05) {
                ball.material.color.setHex(0xff0000); // Red when pinching
                document.getElementById('gesture-text').innerText = "PINCH: COLOR CHANGE";
            } else {
                ball.material.color.setHex(0x007acc); // Blue normally
                document.getElementById('gesture-text').innerText = "MOVING BALL";
            }
        }
    }
    canvasCtx.restore();
}

// --- 3. INITIALIZE MEDIAPIPE ---
const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.6, minTrackingConfidence: 0.6 });
hands.onResults(onResults);

const videoElement = document.getElementsByClassName('input_video')[0];
const camera = new Camera(videoElement, {
    onFrame: async () => { await hands.send({image: videoElement}); },
    width: 640, height: 480
});
camera.start();

// Handle Window Resize
window.addEventListener('resize', () => {
    camera3D.aspect = container.clientWidth / container.clientHeight;
    camera3D.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
});