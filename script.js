const videoElement = document.querySelector('.input_video');
const inkCanvas = document.getElementById('ink_layer');
const cursorCanvas = document.getElementById('cursor_layer');
const inkCtx = inkCanvas.getContext('2d');
const cursorCtx = cursorCanvas.getContext('2d');

const colorBar = document.getElementById('color-bar');
const sizeText = document.getElementById('size-text');
const penMode = document.getElementById('pen-mode');
const ctrlState = document.getElementById('ctrl-state');

let brush = { color: '#00f3ff', size: 12, x: 0, y: 0, isDrawing: false };
const palette = ['#00f3ff', '#ff0055', '#00ff88', '#ffff00', '#ffffff', '#aa00ff'];

function resize() {
    inkCanvas.width = cursorCanvas.width = window.innerWidth;
    inkCanvas.height = cursorCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Helper to check finger state
const getFinger = (lm, idx) => lm[idx * 4 + 4].y < lm[idx * 4 + 2].y;

function onResults(results) {
    cursorCtx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);
    
    if (!results.multiHandLandmarks) {
        penMode.innerText = "STANDBY";
        return;
    }

    results.multiHandLandmarks.forEach((lm, i) => {
        // --- HARD POSITION FIX ---
        // We ignore MediaPipe's "Left/Right" label and use screen position.
        // Screen is mirrored, so landmarks.x < 0.5 is actually the user's RIGHT hand.
        const isRightScreen = lm[0].x < 0.5; 
        const x = lm[8].x * cursorCanvas.width;
        const y = lm[8].y * cursorCanvas.height;

        if (!isRightScreen) { 
            // --- MODULE: REMOTE CONTROL (Left Side of User's Reality) ---
            const pinchDist = Math.hypot(lm[4].x - lm[8].x, lm[4].y - lm[8].y);
            
            if (pinchDist < 0.04) {
                ctrlState.innerText = "ACTIVE";
                ctrlState.style.color = "#00ff88";

                // Mapping X to Color Palette
                const colorIdx = Math.floor((lm[8].x - 0.5) * 2 * palette.length);
                const safeIdx = Math.max(0, Math.min(colorIdx, palette.length - 1));
                brush.color = palette[safeIdx];
                colorBar.style.backgroundColor = brush.color;
                colorBar.style.boxShadow = `0 0 20px ${brush.color}`;

                // Mapping Y to Size
                brush.size = Math.max(2, Math.floor((1 - lm[8].y) * 80));
                sizeText.innerText = `${brush.size}px`;

                drawCursor(x, y, brush.color, true);
            } else {
                ctrlState.innerText = "LOCKED";
                ctrlState.style.color = "#ff0055";
                drawCursor(x, y, "rgba(255,255,255,0.2)", false);
            }
        } else {
            // --- MODULE: NEURAL PEN (Right Side of User's Reality) ---
            const indexUp = getFinger(lm, 1);
            const middleUp = getFinger(lm, 2);

            if (!indexUp && !middleUp) {
                // FIST = DRAW
                penMode.innerText = "INKING";
                penMode.style.color = brush.color;
                inkCtx.globalCompositeOperation = 'source-over';
                drawInk(x, y);
            } else if (indexUp && middleUp) {
                // FLAT PALM = ERASE
                penMode.innerText = "ERASER";
                penMode.style.color = "#ff4444";
                inkCtx.globalCompositeOperation = 'destination-out';
                drawInk(x, y);
            } else {
                // POINTING = HOVER
                penMode.innerText = "HOVER";
                penMode.style.color = "#ffffff";
                brush.isDrawing = false;
            }
            drawCursor(x, y, brush.color, true);
        }
    });
}

function drawInk(x, y) {
    inkCtx.lineWidth = brush.size;
    inkCtx.lineCap = 'round';
    inkCtx.lineJoin = 'round';
    inkCtx.strokeStyle = brush.color;

    if (!brush.isDrawing) {
        inkCtx.beginPath();
        inkCtx.moveTo(x, y);
        brush.isDrawing = true;
    } else {
        inkCtx.lineTo(x, y);
        inkCtx.stroke();
    }
}

function drawCursor(x, y, col, active) {
    cursorCtx.beginPath();
    cursorCtx.arc(x, y, active ? brush.size/2 + 5 : 12, 0, Math.PI*2);
    cursorCtx.strokeStyle = col;
    cursorCtx.lineWidth = 3;
    cursorCtx.stroke();
    if(active && brush.isDrawing) {
        cursorCtx.fillStyle = col;
        cursorCtx.fill();
    }
}

const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
hands.setOptions({ maxNumHands: 2, modelComplexity: 0, minDetectionConfidence: 0.7, minTrackingConfidence: 0.7 });
hands.onResults(onResults);

const camera = new Camera(videoElement, {
    onFrame: async () => { await hands.send({image: videoElement}); },
    width: 1280, height: 720
});
camera.start();